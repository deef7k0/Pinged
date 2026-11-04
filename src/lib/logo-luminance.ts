import { decode as decodeJpeg } from 'jpeg-js';

import { inkBounds, logoInkOf, meanOpaqueLuminance, type LogoInk } from '@/lib/logo-ink';
import { decodePng, type DecodedImage } from '@/lib/png';
import { USER_AGENT } from '@/lib/wikidata/client';

/**
 * The width the logo is measured at, not drawn at.
 *
 * A mean is a mean: the ink of a 250px rendering of a logo is the ink of its
 * 960px one, give or take the anti-aliased edge. What the width does change is
 * the decode, which runs in JavaScript — ~20k pixels here against ~300k at the
 * drawn size, the difference between a few milliseconds and most of a second
 * on the JS thread. 250 is one of Commons' standard thumbnail widths, so it is
 * usually already rendered and cached at Wikimedia's edge.
 */
const MEASURE_WIDTH = 250;

/** A 250px logo is a few KB; this is a backstop, not a budget. */
const MAX_BYTES = 2_000_000;

/**
 * The largest image measured. It bounds the fallback, when the small thumbnail
 * cannot be had and the logo's own URL is read instead — a small original
 * passes, a 960px rendering does not, and is left unmeasured rather than
 * stalling the JS thread to decode it.
 */
const MAX_PIXELS = 120_000;

/** Pixels sampled per logo. ~20k at the measuring width; every one of them is fine. */
const TARGET_SAMPLES = 25_000;

/**
 * How light a logo's ink is: the mean luminance of its opaque pixels, or null
 * when it could not be read.
 *
 * The studio page draws a logo as it is when that ink holds 3:1 against the
 * page and as a light silhouette otherwise (`logoNeedsLightInk`) — which has to
 * be measured, because Commons' logos are drawn for white pages: FromSoftware's
 * is pure black and would vanish on the studio page's dark one.
 *
 * Decoded in JavaScript (`lib/png.ts`, and `jpeg-js` for the rare JPEG logo).
 * This was Skia's job, and the last one Skia had: a native library of 8–15 MB
 * per CPU architecture, in every APK, to read a few thousand pixels once per
 * studio. Measured once, when the logo is first resolved, and cached with it
 * for a month (`use-studio-logo`).
 *
 * ## A second, smaller download
 *
 * The page draws the 960px thumbnail; this reads the 250px one, which Commons
 * serves from the same path. That costs one extra request of ~3 KB per studio
 * per month, and saves decoding 300k pixels on the JS thread — it used to read
 * the drawn file out of expo-image's disk cache, which was right while Skia
 * decoded it natively and wrong once the decode is JavaScript.
 *
 * Every request carries the app's User-Agent: Wikimedia's media host refuses a
 * generic client with a 403.
 */
export async function measureLogoLuminance(url: string): Promise<number | null> {
  try {
    const small = measuringUrl(url);
    const image = (await fetchImage(small)) ?? (small !== url ? await fetchImage(url) : null);
    if (!image) return null;
    return meanOpaqueLuminance(
      image.data,
      Math.max(1, Math.floor((image.width * image.height) / TARGET_SAMPLES))
    );
  } catch {
    /* Unmeasured is an answer: the logo is drawn light, which is always legible. */
    return null;
  }
}

/**
 * The same file at `MEASURE_WIDTH`.
 *
 * A Commons thumbnail's last path segment is `<width>px-<name>`, and any
 * standard width can be asked for at the same path:
 * `…/thumb/0/0d/Nintendo.svg/960px-Nintendo.svg.png` →
 * `…/thumb/0/0d/Nintendo.svg/250px-Nintendo.svg.png` (verified live: 9.6 KB →
 * 3.1 KB). Anything else — an original rather than a thumbnail, or a thumbnail
 * already this small — is measured as it is.
 */
export function measuringUrl(url: string): string {
  return url.replace(
    /\/(\d+)px-([^/?#]+)((?:[?#].*)?)$/,
    (match, width: string, name: string, rest: string) =>
      Number(width) > MEASURE_WIDTH ? `/${MEASURE_WIDTH}px-${name}${rest}` : match
  );
}

/**
 * IGDB's smallest rendering that keeps a logo's own shape: fitted inside
 * 90×128, where `t_thumb` and `t_micro` are square crops that cut a wordmark's
 * ends off and with them its corners. Verified live: 1–3 KB, at most 8,100
 * pixels, a palette PNG with its transparency intact.
 */
const IGDB_MEASURE_SIZE = 't_cover_small';

const IGDB_IMAGE =
  /^(https:\/\/images\.igdb\.com\/igdb\/image\/upload\/)t_[a-z0-9_]+\/([^/.?#]+)\.[a-z]+$/;

/**
 * Where an IGDB logo is read from, and the id it is remembered under — or null
 * for an image from anywhere else, which is left unmeasured.
 *
 * As `.png`, whatever the drawn URL asks for: IGDB flattens transparency to
 * black in a JPEG, and the transparency is half of what is being measured.
 */
export function igdbLogoSource(url: string): { id: string; measureUrl: string } | null {
  const match = IGDB_IMAGE.exec(url);
  return match
    ? { id: match[2], measureUrl: `${match[1]}${IGDB_MEASURE_SIZE}/${match[2]}.png` }
    : null;
}

/**
 * What a platform's or a studio's IGDB logo is made of — how much of it is
 * cut out, how much of its ink is dark, what ground it brought — so it can be
 * drawn on the page without a plate (`logoTreatment`).
 *
 * Null when the file could not be read as a logo: nothing opaque in it, a
 * format the decoder does not take. **Throws when it could not be fetched**,
 * which is a different fact — the caller remembers the first for months and
 * the second not at all.
 */
export async function measureLogoInk(measureUrl: string): Promise<LogoInk | null> {
  const response = await fetch(measureUrl);
  if (!response.ok) throw new Error(`Logo request failed (${response.status})`);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_BYTES) return null;
  const image = decodeImage(new Uint8Array(buffer));
  if (!image) return null;
  const ink = logoInkOf(image);
  return ink ? { ...ink, bounds: inkBounds(image) } : null;
}

async function fetchImage(url: string): Promise<DecodedImage | null> {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) return null;
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_BYTES) return null;
  return decodeImage(new Uint8Array(buffer));
}

/** PNG or JPEG, by their signatures; anything else is unmeasured. */
function decodeImage(bytes: Uint8Array): DecodedImage | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return decodePng(bytes, { maxPixels: MAX_PIXELS });
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    /* `useTArray`: a Uint8Array, not the Node Buffer React Native lacks. A JPEG
       has no alpha, so every pixel counts — the background included, which is
       what a JPEG logo puts on the page anyway. */
    const image = decodeJpeg(bytes, {
      useTArray: true,
      maxMemoryUsageInMB: 16,
      maxResolutionInMP: MAX_PIXELS / 1_000_000,
    });
    return { width: image.width, height: image.height, data: image.data };
  }
  return null;
}
