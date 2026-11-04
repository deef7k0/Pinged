/**
 * How somebody else's logo — a platform's, a studio's — can be drawn straight
 * on this app's dark page, read from its pixels.
 *
 * Pure: no React Native and no network, so `npm test` covers it. The pixels
 * come from `measureLogoInk` (`lib/logo-luminance.ts`), which decodes a small
 * rendering of the logo in JavaScript.
 *
 * ## Why it is measured
 *
 * IGDB's logos are whatever was uploaded. Checked against the live catalogue:
 * PlayStation 4's is black ink cut out of nothing, which on a near-black page
 * is a hole; Windows' is blue on nothing and reads as it is; PlayStation 5's
 * is a white wordmark on an opaque black rectangle, which a silhouette would
 * turn into a blank block; the Switch 2's sits on opaque grey. IGDB's own
 * `alpha_channel` flag does not tell them apart — it says "no alpha" of
 * Windows' and Linux's, which are both cut out. So the pixels decide.
 */

/** RGBA pixels, as `decodePng` returns them. */
export type LogoPixels = {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
};

/** What a logo's pixels say about how it can be drawn. */
export type LogoInk = {
  /** How much of the image is opaque, 0–1. A logo cut out of its ground is well under 1. */
  coverage: number;
  /** How much of the opaque part is too dark to be seen on the page, 0–1. */
  dark: number;
  /**
   * The colour at the image's corners, `#RRGGBB`, when all four are opaque:
   * the ground a logo brought with it. Null for a cut-out.
   */
  ground: string | null;
  /**
   * Where the drawing is inside the file, as shares of its width and height
   * (`inkBounds`) — a logo uploaded on a canvas larger than itself is cropped
   * to this on the game page. Absent on a measurement from before it existed.
   */
  bounds?: InkBounds | null;
};

/** A box inside an image, each side a share of the image, 0–1. */
export type InkBounds = { x: number; y: number; width: number; height: number };

/** How a logo is drawn. */
export type LogoTreatment =
  /** As its owner drew it, on the page. */
  | { kind: 'asis' }
  /** As a light silhouette: its ink would not be seen. */
  | { kind: 'silhouette' }
  /** On a plate of this colour — its own ground, or the app's light plate. */
  | { kind: 'plate'; color: string | null };

/** A pixel counts as part of the logo at half opacity or more. */
const OPAQUE_ALPHA = 128;

/**
 * The luminance under which ink is lost on the page.
 *
 * 0.1 is about 2.8:1 against the app's near-black (`#0B0A0D`), a shade under
 * the 3:1 a graphic owes — Xbox's green (0.15) reads, the Series X's charcoal
 * (0.04) does not. A constant and not a parameter because every surface these
 * logos sit on is the app's own page.
 */
const DARK_LUMINANCE = 0.1;

/** At this much coverage the image has no cut-out: it is a picture with a ground. */
const OPAQUE_COVERAGE = 0.98;

/** A logo this dark all over shows nothing as it is, whatever its shape. */
const ALL_DARK = 0.9;

/**
 * Past this coverage a logo is a filled badge rather than a wordmark — a
 * rounded square, a roundel — and its dark parts are a ground for something
 * lighter inside. A silhouette would flatten that into a blank shape.
 */
const BADGE_COVERAGE = 0.6;

/**
 * A cut-out with this share of dark ink is drawn light. Low on purpose: a
 * fifth of a logo being its wordmark, set in black, is the common case, and a
 * lost word is a worse failure than a lost colour.
 */
const DARK_SHARE = 0.2;

function toLinear(channel: number): number {
  return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

/** Read a logo's pixels. Null for an image with nothing opaque in it. */
export function logoInkOf(image: LogoPixels): LogoInk | null {
  const { data, width, height } = image;
  const total = width * height;
  if (total <= 0 || data.length < total * 4) return null;

  let opaque = 0;
  let dark = 0;
  for (let i = 0; i < total * 4; i += 4) {
    if (data[i + 3] < OPAQUE_ALPHA) continue;
    opaque += 1;
    const luminance =
      0.2126 * toLinear(data[i] / 255) +
      0.7152 * toLinear(data[i + 1] / 255) +
      0.0722 * toLinear(data[i + 2] / 255);
    if (luminance < DARK_LUMINANCE) dark += 1;
  }
  if (opaque === 0) return null;

  return {
    coverage: opaque / total,
    dark: dark / opaque,
    ground: cornerColor(image),
  };
}

/** The mean of the four corner pixels, or null when any of them is cut out. */
function cornerColor({ data, width, height }: LogoPixels): string | null {
  const corners = [0, width - 1, (height - 1) * width, height * width - 1];
  let r = 0;
  let g = 0;
  let b = 0;
  for (const pixel of corners) {
    const i = pixel * 4;
    if (data[i + 3] < OPAQUE_ALPHA) return null;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  const hex = (sum: number) =>
    Math.round(sum / corners.length)
      .toString(16)
      .padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase();
}

/**
 * How to draw a logo, given what its pixels said.
 *
 * In order:
 *
 *  1. **Unmeasured** (null) — on the app's light plate, which is legible
 *     whatever the logo turns out to be. `color: null` means that plate.
 *  2. **No cut-out** — a picture that fills its frame to the corners, so it
 *     gets a plate of its own ground: PlayStation 5's black rectangle becomes a
 *     black plate that all but vanishes into the page, a logo scanned on white
 *     keeps a white one. This is the one case that cannot be made transparent.
 *  3. **Dark all over** — a light silhouette; as it is, nothing would show.
 *  4. **A filled badge** — as it is: its dark parts hold something lighter.
 *  5. **A cut-out with a dark part** — a light silhouette, so the wordmark in
 *     black is not lost.
 *  6. Otherwise as it is.
 */
export function logoTreatment(ink: LogoInk | null): LogoTreatment {
  if (!ink) return { kind: 'plate', color: null };
  /* A ground is four opaque corners: a rounded badge that fills its frame is
     still a shape, and falls through to the rules for one. */
  if (ink.ground && ink.coverage >= OPAQUE_COVERAGE) return { kind: 'plate', color: ink.ground };
  if (ink.dark >= ALL_DARK) return { kind: 'silhouette' };
  if (ink.coverage >= BADGE_COVERAGE) return { kind: 'asis' };
  if (ink.dark >= DARK_SHARE) return { kind: 'silhouette' };
  return { kind: 'asis' };
}

/**
 * The mean WCAG relative luminance of a logo's opaque pixels (alpha ≥ 50%), or
 * null when it has none. `stride` samples every nth pixel of a large image.
 */
export function meanOpaqueLuminance(
  data: Uint8Array | Uint8ClampedArray,
  stride = 1
): number | null {
  let sum = 0;
  let count = 0;
  const step = Math.max(1, Math.floor(stride)) * 4;
  for (let i = 0; i + 3 < data.length; i += step) {
    if (data[i + 3] < 128) continue;
    sum +=
      0.2126 * toLinear(data[i] / 255) +
      0.7152 * toLinear(data[i + 1] / 255) +
      0.0722 * toLinear(data[i + 2] / 255);
    count += 1;
  }
  return count > 0 ? sum / count : null;
}

/**
 * Whether a studio's Commons logo has to be drawn as a light silhouette to be
 * seen on `page`.
 *
 * A logo is drawn as it is when its own ink holds 3:1 against the page — the
 * WCAG floor for a graphic — and as a light silhouette otherwise. Measured, not
 * assumed: of the first public-domain studio logos tried, FromSoftware's is
 * pure black and would vanish on a dark page, while Mojang's is white type on a
 * red block, which a silhouette would turn into a blank rectangle. One rule for
 * both is only possible because it reads the pixels.
 *
 * An unmeasured logo (null) is drawn light: unreadable is the worse failure.
 */
export function logoNeedsLightInk(logoLuminance: number | null, page: string): boolean {
  if (logoLuminance === null) return true;
  const hex = /^#[0-9a-f]{6}$/i.test(page) ? parseInt(page.slice(1), 16) : null;
  if (hex === null) return true;
  const pageLuminance =
    0.2126 * toLinear(((hex >> 16) & 255) / 255) +
    0.7152 * toLinear(((hex >> 8) & 255) / 255) +
    0.0722 * toLinear((hex & 255) / 255);
  const light = Math.max(logoLuminance, pageLuminance);
  const dark = Math.min(logoLuminance, pageLuminance);
  return (light + 0.05) / (dark + 0.05) < 3;
}

/**
 * Any visible pixel, for `inkBounds`: far fainter than `OPAQUE_ALPHA`, because
 * a thin wordmark read off a 90px thumbnail is mostly half-covered pixels.
 */
const VISIBLE_ALPHA = 24;

/**
 * The box round everything visible in an image, as shares of it, one pixel
 * wider each side than it reads (the thumbnail it is read from is coarse, and
 * cutting the end off a letter is worse than a sliver of air). Null for an
 * image with nothing visible in it.
 */
export function inkBounds({ data, width, height }: LogoPixels): InkBounds | null {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] < VISIBLE_ALPHA) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < 0) return null;
  left = Math.max(0, left - 1);
  top = Math.max(0, top - 1);
  right = Math.min(width - 1, right + 1);
  bottom = Math.min(height - 1, bottom + 1);
  return {
    x: left / width,
    y: top / height,
    width: (right - left + 1) / width,
    height: (bottom - top + 1) / height,
  };
}
