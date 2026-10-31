import AsyncStorage from '@react-native-async-storage/async-storage';
import { decode } from 'jpeg-js';

import { atLuminance, hexToRgb, rgbToHex, saturate } from '@/lib/color';

/**
 * The dominant colour of a piece of box art, read from the actual pixels — the
 * seed `use-album-art-color` hands Material 3 wherever the native extractor
 * (`react-native-image-colors`) cannot load, which is Expo Go.
 *
 * ## Why this is done in JavaScript
 *
 * Reading pixels normally means a native module (`react-native-image-colors`),
 * and a native module means a development build — which this project does not
 * have: it runs in Expo Go. So the image is fetched as bytes and decoded by
 * `jpeg-js`, which is pure JavaScript with no dependencies and therefore works
 * unchanged in Expo Go, on a device, and on the web.
 *
 * That is affordable only because IGDB publishes a thumbnail. `t_thumb` is
 * 90×90 and around 3 KB; decoding it is roughly 8,100 pixels, which is nothing.
 * Pointing this at `t_cover_big` — let alone the 1080p artwork — would be a
 * different proposition entirely, so `swatchUrl` below rewrites the size in the
 * URL rather than trusting whatever the caller had on hand.
 *
 * ## What "dominant" means here
 *
 * Not "most common pixel". A cover is mostly sky, mostly concrete or mostly
 * night, so the modal colour of almost every game is a desaturated grey-blue and
 * every page would look the same — which is the failure this whole feature
 * exists to avoid. What we want is the colour a person would *name* if asked
 * what colour the box is: the one that is both plentiful and vivid.
 *
 * So pixels vote into **hue** bins, weighted by saturation and by how mid-toned
 * they are, and near-black and near-white are dropped before they can vote.
 * Watch Dogs 2's cover is pale sky and grey rubble around a blue jacket: it
 * resolves to blue at a 51% share. DOOM resolves red, Cyberpunk yellow, Portal 2
 * blue, Elden Ring gold. Celeste resolves nothing at all — its best hue holds
 * 20%, under the confidence floor — and correctly falls back to its genre.
 */

/** Cache version. Bump to invalidate every stored swatch after a scoring change. */
const CACHE_VERSION = 'v3';
const CACHE_PREFIX = `artwork-color:${CACHE_VERSION}:`;

/**
 * Hue bins, 15 degrees each.
 *
 * **Binning by hue, not by RGB.** The first version bucketed raw RGB and picked
 * the heaviest bucket, which returned `#161519` for Watch Dogs 2 — the near
 * black of the rubble, because dark pixels crowd into very few buckets while the
 * blue of the sky and the jacket spreads across dozens. Asking "which hue is
 * this box art" instead of "which exact colour repeats most" is both the
 * question a person actually means and the one that survives a gradient.
 */
const HUE_BINS = 24;

/**
 * Lightness gates, applied before anything else.
 *
 * Near-black and near-white pixels have a hue in the arithmetic sense and none
 * in any sense a viewer cares about; letting them vote is what made a night
 * scene resolve to grey-lilac and a bright farm scene to beige.
 */
const MIN_LIGHTNESS = 0.15;
const MAX_LIGHTNESS = 0.85;

/** Below this a pixel is grey and casts no vote. */
const MIN_SATURATION = 0.15;

/**
 * How much of the image's colour has to agree before we trust the answer.
 *
 * Celeste's cover scores its best hue at 20% — it is genuinely several colours
 * and no one of them is *the* colour. Returning a confident wrong answer there
 * is worse than returning nothing, because nothing falls back to the genre hue,
 * which is at least true about the game.
 */
const MIN_SHARE = 0.28;

/** Saturation floor for the extracted accent. See `saturate`. */
const SATURATION_FLOOR = 0.5;

/**
 * Where the extracted hue is allowed to land, as WCAG relative luminance.
 *
 * The colour comes back at whatever brightness the art happens to be, and a page
 * accent has a job to do: it lands on buttons, links and an active tab. A hue
 * lifted off a night scene would be nearly black and one off a snow level nearly
 * white. Normalising to the band the hand-tuned identity ramp occupies means
 * every extracted colour behaves like a ramp member — which is what keeps the
 * contrast guarantees true for colours nobody chose.
 */
const TARGET_LUMINANCE = 0.34;

export type ArtworkColor = {
  /** The extracted hue, normalised into the accent band. */
  color: string;
  /** The raw colour as it appears in the art, before normalisation: the M3 seed. */
  raw: string;
};

/**
 * The small variant of a cover, for reading its colour — or null when there is
 * no small variant to read.
 *
 * IGDB encodes the size in the path (`.../t_cover_big/co1wyy.jpg`), so its
 * 90×90 thumbnail is a string replace. Steam's CDN keeps every asset of an app
 * in one folder, so a legacy Steam cover (`library_600x900.jpg`) swaps its file
 * for `capsule_sm_120.jpg` — 120×45, about 4 KB, the same key art.
 *
 * **Anything else is not decoded at all.** This used to return an unrecognised
 * URL as-is, "at more cost to fetch" — and the cost was never the fetch. A
 * 600×900 Steam cover is 540,000 pixels through a JPEG decoder written in
 * JavaScript, on the JS thread: seconds of a frozen app, every time a legacy
 * game's page opened, with the genre hue as the only visible result either way.
 */
export function swatchUrl(uri: string): string | null {
  if (/\/t_[a-z0-9_]+\//i.test(uri)) return uri.replace(/\/t_[a-z0-9_]+\//i, '/t_thumb/');
  const steam =
    /^(https:\/\/[^/]*steamstatic\.com\/(?:store_item_assets\/)?steam\/apps\/\d+\/)/.exec(uri);
  if (steam) return `${steam[1]}capsule_sm_120.jpg`;
  return null;
}

/**
 * The most this will ever decode, in megapixels, and the most it will download.
 *
 * Both far above a 90×90 thumbnail (0.008 MP, ~3 KB) and far below anything that
 * would be felt. The decoder checks the size in the JPEG header before touching
 * a single scanline, so an oversized image fails in microseconds rather than
 * after the seconds it would have cost — the backstop for a host that ignores
 * the size in its URL.
 */
const MAX_SWATCH_MP = 0.1;
const MAX_SWATCH_BYTES = 120_000;

/**
 * The dominant colour of an image, or null if it cannot be read.
 *
 * Null is a real answer and callers must handle it: the network may be down, the
 * host may serve WebP, a legacy Steam URL may 404. Everything falls back to the
 * genre hue in that case, which is why that system stays.
 */
export async function extractArtworkColor(uri: string): Promise<ArtworkColor | null> {
  const cached = await readCache(uri);
  if (cached) return cached;

  const pixels = await decodeSwatch(uri);
  if (!pixels) return null;

  const raw = dominantOf(pixels);
  if (!raw) return null;

  const color = atLuminance(saturate(raw, SATURATION_FLOOR), TARGET_LUMINANCE);
  const result: ArtworkColor = { color, raw };
  await writeCache(uri, result);
  return result;
}

/**
 * The swatch-sized thumbnail of `uri`, decoded to RGBA — or null when there is
 * no thumbnail to read or it could not be fetched or decoded.
 *
 * The 3 KB file, under the size caps above.
 */
async function decodeSwatch(uri: string): Promise<Uint8Array | null> {
  const swatch = swatchUrl(uri);
  if (!swatch) return null;

  try {
    const response = await fetch(swatch);
    if (!response.ok) return null;

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_SWATCH_BYTES) return null;
    /* `useTArray` returns a Uint8Array rather than a Node Buffer, which does not
       exist in React Native. Without it `jpeg-js` reaches for `Buffer` and
       throws before decoding a single scanline. */
    const image = decode(bytes, {
      useTArray: true,
      maxMemoryUsageInMB: 16,
      maxResolutionInMP: MAX_SWATCH_MP,
    });
    return image.data;
  } catch {
    /* Swallowed on purpose. A cover whose colour cannot be read is not an error
       the user should ever see — the page falls back to its genre hue, or to
       the plain page colour, and looks entirely normal. */
    return null;
  }
}

/**
 * The dominant hue of an RGBA buffer, as a hex, or null if none dominates.
 *
 * Every qualifying pixel votes into a hue bin, weighted by saturation and by how
 * mid-toned it is — a vivid pixel at 50% lightness is what a viewer registers as
 * "the colour", while the same hue in deep shadow or blown highlight is not.
 * The winning bin is read together with its two neighbours, because a real
 * "blue" spans considerably more than fifteen degrees.
 */
function dominantOf(data: Uint8Array | Uint8ClampedArray): string | null {
  const bins = Array.from({ length: HUE_BINS }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
  let total = 0;

  // Four bytes per pixel (RGBA). At 90x90 every pixel is sampled: skipping
  // would save nothing measurable and biases toward scanline patterns.
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lightness = (max + min) / 2;
    if (lightness < MIN_LIGHTNESS || lightness > MAX_LIGHTNESS) continue;

    const delta = max - min;
    const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
    if (saturation < MIN_SATURATION) continue;

    let hue: number;
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;

    const weight = saturation * (1 - Math.abs(lightness - 0.5) * 1.1);
    const bin = bins[Math.floor(hue / (360 / HUE_BINS)) % HUE_BINS];
    bin.w += weight;
    bin.r += data[i] * weight;
    bin.g += data[i + 1] * weight;
    bin.b += data[i + 2] * weight;
    total += weight;
  }

  if (total === 0) return null;

  let bestIndex = -1;
  let bestWeight = 0;
  for (let i = 0; i < HUE_BINS; i += 1) {
    const grouped =
      bins[(i - 1 + HUE_BINS) % HUE_BINS].w * 0.5 + bins[i].w + bins[(i + 1) % HUE_BINS].w * 0.5;
    if (grouped > bestWeight) {
      bestWeight = grouped;
      bestIndex = i;
    }
  }
  if (bestIndex < 0 || bestWeight / total < MIN_SHARE) return null;

  const group = [
    bins[(bestIndex - 1 + HUE_BINS) % HUE_BINS],
    bins[bestIndex],
    bins[(bestIndex + 1) % HUE_BINS],
  ];
  const weight = group.reduce((sum, bin) => sum + bin.w, 0);
  if (weight <= 0) return null;

  return rgbToHex({
    r: group.reduce((sum, bin) => sum + bin.r, 0) / weight,
    g: group.reduce((sum, bin) => sum + bin.g, 0) / weight,
    b: group.reduce((sum, bin) => sum + bin.b, 0) / weight,
  });
}

const ARTWORK_MEMORY_CACHE = new Map<string, ArtworkColor>();

async function readCache(uri: string): Promise<ArtworkColor | null> {
  if (ARTWORK_MEMORY_CACHE.has(uri)) {
    return ARTWORK_MEMORY_CACHE.get(uri) ?? null;
  }
  try {
    const stored = await AsyncStorage.getItem(CACHE_PREFIX + uri);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as ArtworkColor;
    if (!hexToRgb(parsed.color) || !hexToRgb(parsed.raw)) return null;
    const result = { color: parsed.color, raw: parsed.raw };
    ARTWORK_MEMORY_CACHE.set(uri, result);
    return result;
  } catch {
    return null;
  }
}

async function writeCache(uri: string, value: ArtworkColor): Promise<void> {
  ARTWORK_MEMORY_CACHE.set(uri, value);
  try {
    await AsyncStorage.setItem(CACHE_PREFIX + uri, JSON.stringify(value));
  } catch {
    /* A full disk should not stop a page from having a colour. */
  }
}
