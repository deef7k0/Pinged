import { contrast, fromOklab, linearToOklab, towardBlack, type Oklab } from './color';

/**
 * Apple's key colour — `keyColor` on an Apple Music artist, the iTunes 11
 * background behind an open album — ported for the hero of a game, a studio
 * and a collection.
 *
 * ## What it is for
 *
 * A key colour is not the colour of the picture. It is the colour the picture
 * *ends in*: read off the edge where the artwork meets the page, so that when
 * the page is filled with it the art has no border — the image does not sit
 * on the page, it runs out into it. That is the whole effect, and it is why
 * the colour is sampled at the edges and nowhere else. iTunes 11 put the
 * album art at the right of a panel and the colour to its left, and sampled
 * the left edge; a hero here melts into the page at its *foot*, so the foot
 * is what counts most (`HERO_EDGES`).
 *
 * ## The algorithm, as reverse-engineered from iTunes 11
 *
 *  1. **Crop the outer border** (`border`), so a thin frame, a JPEG's ringing
 *     at the image edge, or a one-pixel letterbox line is never the answer.
 *  2. **Sample the edges** — a band of each (`band`), weighted per edge.
 *  3. **Cluster** what was sampled by colour distance. iTunes compared sRGB
 *     channels at about a tenth of their range; this clusters in **Oklab**,
 *     where a distance is the same visible difference everywhere — in sRGB a
 *     tenth is a shade apart in the darks and invisible in the lights, which
 *     is exactly where an edge of key art tends to sit. `radius` is about four
 *     just-noticeable differences: "the same colour", allowing for grain.
 *  4. **The largest cluster is the key colour** — except that near-black and
 *     near-white yield to a real colour that is at least 30% as large, which
 *     is iTunes' own rule (`SLColorArt`'s `_findEdgeColor`): a black edge is
 *     more often a vignette or a letterbox than the picture's colour.
 *
 * The clustering is deterministic: pixels are counted into a 5-bit histogram
 * first, and clusters are seeded from the most populous bins down, so the
 * answer never depends on the order the pixels were read in.
 *
 * ## What it is measured on
 *
 * **Only the part of the image that is on screen** (`visibleRegion`). A 16:9
 * key art drawn into a square banner shows its middle; its left and right
 * edges are cropped away, and a colour read off them would be the colour of
 * something nobody can see. The hook passes the frame and the image's anchor,
 * and the edges sampled are the edges of the crop.
 *
 * ## What it is not
 *
 * Not `immersiveBackground` (`lib/immersive-color.ts`): that is Palette's
 * *dominant* colour of the whole picture. The key colour is **the page's own
 * colour** on the three pages that draw an Apple Music hero — one colour from
 * the top of the page to its foot, which darkens as the page is read
 * (`keyPage`) — toned for this app's dark room first, because Apple's own can
 * be white.
 *
 * Pure: no React Native and no `@/`, so `npm test` loads it.
 */

export type Size = { width: number; height: number };

/** A point in an image, as fractions of its width and height — an anchor. */
export type Anchor = { x: number; y: number };

/** A region of an image, as fractions of its width and height. */
export type Region = { left: number; top: number; right: number; bottom: number };

/** How much each edge counts toward the key colour. Zero leaves it out. */
export type EdgeWeights = { top: number; right: number; bottom: number; left: number };

export const KEY_COLOR = {
  /** How much of each side is cropped away first: a thin frame, ringing, a stray line. */
  border: 0.03,
  /** How deep a band of each edge is sampled, as a share of that side. */
  band: 0.12,
  /** The cluster radius, in Oklab: about four just-noticeable differences. */
  radius: 0.08,
  /** A colour beats black or white when it is at least this much of their size. */
  colourOverExtreme: 0.3,
  /** iTunes' `pc_isBlackOrWhite`: every sRGB channel under 0.09, or every one over 0.91. */
  black: 0.09,
  white: 0.91,
} as const;

/**
 * A hero's edges: the foot first — it is where the art melts into the page —
 * the sides half as much, because they meet the display's edge and not the
 * page, and the top hardly at all, under the status bar's scrim.
 */
export const HERO_EDGES: EdgeWeights = { top: 0.15, right: 0.5, bottom: 1, left: 0.5 };

const CENTRE: Anchor = { x: 0.5, y: 0.5 };
const WHOLE: Region = { left: 0, top: 0, right: 1, bottom: 1 };

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * The part of an image `contentFit: 'cover'` shows in a frame, with the
 * image's own point `anchor` laid on the frame's — `contentPosition`, which is
 * CSS's `object-position`: `{ x: 0.5, y: 0.22 }` is `left: 50%, top: 22%`.
 */
export function visibleRegion(image: Size, frame: Size, anchor: Anchor = CENTRE): Region {
  const valid = [image.width, image.height, frame.width, frame.height].every(
    (side) => Number.isFinite(side) && side > 0
  );
  if (!valid) return WHOLE;

  const imageAspect = image.width / image.height;
  const frameAspect = frame.width / frame.height;

  if (imageAspect > frameAspect) {
    /* Wider than the frame: the full height is shown and the sides are cut. */
    const shown = frameAspect / imageAspect;
    const left = (1 - shown) * clamp01(anchor.x);
    return { left, top: 0, right: left + shown, bottom: 1 };
  }
  const shown = imageAspect / frameAspect;
  const top = (1 - shown) * clamp01(anchor.y);
  return { left: 0, top, right: 1, bottom: top + shown };
}

export type KeyColorOptions = {
  /** The part of the image on screen. The whole of it by default. */
  region?: Region;
  /** Which edges count, and how much. A hero's by default (`HERO_EDGES`). */
  edges?: EdgeWeights;
  border?: number;
  band?: number;
  radius?: number;
};

export type KeyColor = {
  /** The key colour, as it is in the art. */
  color: string;
  /** How much of what was sampled it covers, 0–1: its confidence. */
  share: number;
};

type Cluster = {
  weight: number;
  /** Weighted sums, for the centroid. */
  l: number;
  a: number;
  b: number;
  r: number;
  g: number;
  bl: number;
};

/** sRGB 0–255 → linear light, once per value. */
const LINEAR = Array.from({ length: 256 }, (_, value) => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});

/**
 * The key colour of an RGBA image, or null when there is nothing to read
 * (a region a pixel wide, or nothing opaque in it).
 */
export function keyColorOf(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  {
    region = WHOLE,
    edges = HERO_EDGES,
    border = KEY_COLOR.border,
    band = KEY_COLOR.band,
    radius = KEY_COLOR.radius,
  }: KeyColorOptions = {}
): KeyColor | null {
  if (width <= 0 || height <= 0 || data.length < width * height * 4) return null;

  /* The region in pixels, then the border cropped off it. */
  const x0 = Math.max(0, Math.floor(clamp01(region.left) * width));
  const x1 = Math.min(width, Math.ceil(clamp01(region.right) * width));
  const y0 = Math.max(0, Math.floor(clamp01(region.top) * height));
  const y1 = Math.min(height, Math.ceil(clamp01(region.bottom) * height));
  const cropX = borderOf(x1 - x0, border);
  const cropY = borderOf(y1 - y0, border);
  const left = x0 + cropX;
  const right = x1 - cropX;
  const top = y0 + cropY;
  const bottom = y1 - cropY;
  if (right - left < 2 || bottom - top < 2) return null;

  const bandX = Math.max(1, Math.round((right - left) * band));
  const bandY = Math.max(1, Math.round((bottom - top) * band));

  /* 1–2. Every sampled pixel into a 5-bit histogram, with its edge's weight. */
  const bins = new Map<number, { weight: number; r: number; g: number; b: number }>();
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const weight = Math.max(
        y < top + bandY ? edges.top : 0,
        y >= bottom - bandY ? edges.bottom : 0,
        x < left + bandX ? edges.left : 0,
        x >= right - bandX ? edges.right : 0
      );
      if (weight <= 0) continue;

      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      const bin = bins.get(key);
      if (bin) {
        bin.weight += weight;
        bin.r += r * weight;
        bin.g += g * weight;
        bin.b += b * weight;
      } else {
        bins.set(key, { weight, r: r * weight, g: g * weight, b: b * weight });
      }
    }
  }
  if (bins.size === 0) return null;

  /* 3. Clusters, seeded from the most populous bins down — ties by bin, so
     the order the pixels were read in never matters. */
  const seeds = [...bins.entries()].sort((p, q) => q[1].weight - p[1].weight || p[0] - q[0]);
  const clusters: Cluster[] = [];
  let total = 0;

  for (const [, bin] of seeds) {
    const r = bin.r / bin.weight;
    const g = bin.g / bin.weight;
    const b = bin.b / bin.weight;
    const lab = oklabOf(r, g, b);
    total += bin.weight;

    let nearest: Cluster | null = null;
    let nearestDistance = radius;
    for (const cluster of clusters) {
      const distance = Math.hypot(
        lab[0] - cluster.l / cluster.weight,
        lab[1] - cluster.a / cluster.weight,
        lab[2] - cluster.b / cluster.weight
      );
      if (distance <= nearestDistance) {
        nearest = cluster;
        nearestDistance = distance;
      }
    }

    const target = nearest ?? { weight: 0, l: 0, a: 0, b: 0, r: 0, g: 0, bl: 0 };
    target.weight += bin.weight;
    target.l += lab[0] * bin.weight;
    target.a += lab[1] * bin.weight;
    target.b += lab[2] * bin.weight;
    target.r += r * bin.weight;
    target.g += g * bin.weight;
    target.bl += b * bin.weight;
    if (!nearest) clusters.push(target);
  }

  /* Stable: a tie keeps the cluster that was seeded first. */
  const ranked = clusters
    .map((cluster, index) => ({ cluster, index }))
    .sort((p, q) => q.cluster.weight - p.cluster.weight || p.index - q.index)
    .map((entry) => entry.cluster);

  /* 4. The largest — unless it is black or white and a colour is close behind. */
  let chosen = ranked[0];
  if (isExtreme(chosen)) {
    for (const next of ranked.slice(1)) {
      if (next.weight / chosen.weight < KEY_COLOR.colourOverExtreme) break;
      if (!isExtreme(next)) {
        chosen = next;
        break;
      }
    }
  }

  return {
    color: fromOklab([
      chosen.l / chosen.weight,
      chosen.a / chosen.weight,
      chosen.b / chosen.weight,
    ]),
    share: chosen.weight / total,
  };
}

/** How many pixels of a side the border crop takes: at least one, once there is room for it. */
function borderOf(side: number, fraction: number): number {
  if (side < 16) return 0;
  return Math.max(1, Math.round(side * fraction));
}

function oklabOf(r: number, g: number, b: number): Oklab {
  /* A bin's mean is not a whole number; interpolating the table is exact enough
     for a colour that is about to be clustered at four JNDs. */
  return linearToOklab(linearOf(r), linearOf(g), linearOf(b));
}

function linearOf(value: number): number {
  const v = Math.min(255, Math.max(0, value));
  const low = Math.floor(v);
  const high = Math.min(255, low + 1);
  return LINEAR[low] + (LINEAR[high] - LINEAR[low]) * (v - low);
}

/** iTunes' `pc_isBlackOrWhite`, on a cluster's mean sRGB. */
function isExtreme(cluster: Cluster): boolean {
  const r = cluster.r / cluster.weight / 255;
  const g = cluster.g / cluster.weight / 255;
  const b = cluster.bl / cluster.weight / 255;
  const white = r > KEY_COLOR.white && g > KEY_COLOR.white && b > KEY_COLOR.white;
  const black = r < KEY_COLOR.black && g < KEY_COLOR.black && b < KEY_COLOR.black;
  return white || black;
}

/**
 * WCAG relative luminance formula as used in Apple Music iOS adaptive design.
 *
 * @param hex - Hexadecimal color string (#rrggbb or #rgb)
 */
export function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '').trim();
  let r = 0;
  let g = 0;
  let b = 0;
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16) || 0;
    g = parseInt(clean[1] + clean[1], 16) || 0;
    b = parseInt(clean[2] + clean[2], 16) || 0;
  } else {
    r = parseInt(clean.substring(0, 2), 16) || 0;
    g = parseInt(clean.substring(2, 4), 16) || 0;
    b = parseInt(clean.substring(4, 6), 16) || 0;
  }
  const toLinear = (c: number) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Text Color: Luminance Threshold.
 * Apple computes the relative luminance of the keyColor and picks text color based on a ~0.5 threshold.
 */
export function getTextColor(keyColor: string): string {
  const L = relativeLuminance(keyColor);
  return L > 0.5 ? '#1c1c1e' : '#ffffff';
}

/**
 * Secondary text color matching Apple Music adaptive secondary label.
 */
export function getSecondaryTextColor(keyColor: string): string {
  const L = relativeLuminance(keyColor);
  return L > 0.5 ? 'rgba(60, 60, 67, 0.6)' : 'rgba(235, 235, 245, 0.6)';
}

/**
 * Maximum relative luminance allowed for the bright tone (ceiling at rest).
 * Prevents hyper-saturated hues like Red Dead Redemption 2's red from burning
 * neon in the dark room, pulling them down to a rich, cinematic tone.
 */
export const MAX_BRIGHT_LUMINANCE = 0.12;

/**
 * The key colour as a page colour in this app's dark room: the same hue, taken
 * toward black in Oklab — where black is the origin, so the hue and the
 * colour's character survive — in tenths, until `ink` holds `minContrast` on
 * it, and capped at `MAX_BRIGHT_LUMINANCE` so bright neon art settles
 * down.
 */
export function keyGround(
  key: string,
  { ink, minContrast = 4.5 }: { ink?: string; minContrast?: number } = {}
): string {
  let ground = key;
  if (ink) {
    for (let step = 0; step < 20 && contrast(ink, ground) < minContrast; step += 1) {
      ground = towardBlack(ground, 0.1);
    }
  }
  for (let step = 0; step < 20 && relativeLuminance(ground) > MAX_BRIGHT_LUMINANCE; step += 1) {
    ground = towardBlack(ground, 0.05);
  }
  return ground;
}

/**
 * How much darker the page is once its artwork has gone.
 *
 * Apple Music's page is the key colour and turns darker as it is read. The
 * darker tone is the same colour pulled toward black in Oklab, so a page is one
 * hue at both ends and the transition between them passes through nothing else.
 */
export const KEY_PAGE_DARKEN = 0.5;

/**
 * A page's two tones: **one colour**, at rest and once its artwork has gone.
 *
 * The page is `bright` from its top to its foot — there is no second colour
 * anywhere on it and no gradient where the masthead ends — and it crosses to
 * `dark` as the page is read (`lib/scroll-motion`, `<Screen tone>`).
 *
 * `bright` is the key colour, darkened only as far as the quietest type on the
 * page needs (`keyGround`) and capped at cinematic luminance. `dark` is that tone
 * again, pulled toward black.
 */
export function keyPage(
  key: string,
  { ink, minContrast = 4.5 }: { ink?: string; minContrast?: number } = {}
): { bright: string; dark: string } {
  const bright = keyGround(key, { ink, minContrast });
  return { bright, dark: towardBlack(bright, KEY_PAGE_DARKEN) };
}
