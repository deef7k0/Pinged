/**
 * Colour maths.
 *
 * Deliberately dependency-free — `constants/theme.ts` imports from here to
 * derive tokens, so anything this file imported would be pulled into the theme
 * and from there into every screen.
 *
 * Everything here works on the `#RRGGBB` literals the palette is written in.
 * Nothing parses `rgba()` strings: the palette's translucent entries are already
 * composited by the renderer and there is no meaningful "mix" of two alphas over
 * an unknown backdrop. Where a computed value has to be translucent, start from
 * a hex and end with `withAlpha`.
 */

export type Rgb = { r: number; g: number; b: number };

const HEX = /^#[0-9a-f]{6}$/i;

export function isHex(color: string): boolean {
  return HEX.test(color);
}

export function hexToRgb(color: string): Rgb | null {
  if (!HEX.test(color)) return null;
  const value = parseInt(color.slice(1), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const byte = (channel: number) =>
    Math.max(0, Math.min(255, Math.round(channel)))
      .toString(16)
      .padStart(2, '0');
  return `#${byte(r)}${byte(g)}${byte(b)}`.toUpperCase();
}

/**
 * A palette colour at a given opacity.
 *
 * Exists for gradients. `expo-linear-gradient` interpolates in premultiplied
 * space on Android, so fading a colour to the keyword `transparent` fades it
 * through black and leaves a grey bruise across the middle of the ramp. Fading
 * to the *same* colour at zero alpha has no such midpoint. Every gradient stop
 * in the app should therefore end on `withAlpha(colour, 0)`, never
 * `'transparent'`.
 *
 * Only handles the `#RRGGBB` literals in `Colors`; anything else is returned
 * unchanged rather than silently producing `rgba(NaN, …)`.
 */
export function withAlpha(color: string, alpha: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/**
 * Blend two colours, `amount` of the way from `from` to `to`.
 *
 * Mixes in **sRGB**, deliberately, even though linear light is the physically
 * correct model for mixing light. Two reasons, and both are about this app
 * rather than about colour science:
 *
 * 1. It has to agree with `withAlpha`. A tinted surface can be reached either by
 *    computing a hex here or by laying a translucent hue over the surface, and
 *    the renderer composites that overlay in gamma space. Mixing linearly here
 *    would make the two routes to the same colour disagree visibly.
 * 2. At the near-black end linear mixing is violent. `#1C1C1C` with 6% of
 *    `#FF9142` resolves to `#4B2F20` in linear light — a brown surface, not a
 *    trace of warmth in a dark one. In sRGB the same 6% is the whisper the
 *    surface steps were asking for.
 *
 * Returns `from` unchanged if either side is not a hex literal, so a translucent
 * token passed here degrades to "no mix" rather than to `#NaNNaNNaN`.
 */
export function mix(from: string, to: string, amount: number): string {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  if (!a || !b) return from;

  const t = Math.max(0, Math.min(1, amount));
  const blend = (left: number, right: number) => left * (1 - t) + right * t;

  return rgbToHex({ r: blend(a.r, b.r), g: blend(a.g, b.g), b: blend(a.b, b.b) });
}

/**
 * WCAG relative luminance, 0 (black) to 1 (white).
 *
 * Not the same thing as "how light does this look" — the green coefficient is
 * ten times the blue one, which is why `#0070CC` and `#4ADE80` sit at wildly
 * different contrast against the same page despite reading as similarly vivid.
 * That gap is the whole reason this function exists rather than an eyeball.
 */
export function luminance(color: string): number {
  const rgb = hexToRgb(color);
  if (!rgb) return 0;
  return (
    0.2126 * toLinear(rgb.r / 255) + 0.7152 * toLinear(rgb.g / 255) + 0.0722 * toLinear(rgb.b / 255)
  );
}

/** WCAG contrast ratio, 1:1 to 21:1. Order-independent. */
export function contrast(a: string, b: string): number {
  const light = Math.max(luminance(a), luminance(b));
  const dark = Math.min(luminance(a), luminance(b));
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Near-black or white, whichever is legible on `background`.
 *
 * For a fill whose colour is not known until runtime — the identity hue on a
 * primary button, a tier row header. The app's white is `#FFFFFF` and its ink is
 * a very dark grey rather than `#000`, matching how the rest of the palette
 * avoids true black.
 */
export const INK_ON_LIGHT = '#0E0E0E';
export const INK_ON_DARK = '#FFFFFF';

export function readableInk(background: string): string {
  return contrast(background, INK_ON_LIGHT) >= contrast(background, INK_ON_DARK)
    ? INK_ON_LIGHT
    : INK_ON_DARK;
}

/**
 * Lift a hue until it clears `ratio` against `on`, or give up at white.
 *
 * The identity ramp is hand-tuned against `#121212` and needs none of this. It
 * exists for the values that are *not* ours — a platform's brand colour, a
 * provider's tag — where the alternative is shipping `#107C10` Xbox green as
 * 2.2:1 body text because it is the official one.
 */
export function ensureContrast(color: string, on: string, ratio: number): string {
  if (!isHex(color) || !isHex(on)) return color;
  if (contrast(color, on) >= ratio) return color;

  const target = luminance(on) > 0.5 ? INK_ON_LIGHT : INK_ON_DARK;
  // 20 steps is finer than the 8-bit channels can express, so this converges on
  // the first value that passes rather than approximating it.
  for (let step = 1; step <= 20; step += 1) {
    const candidate = mix(color, target, step / 20);
    if (contrast(candidate, on) >= ratio) return candidate;
  }
  return target;
}

/**
 * Push `color` to an exact relative luminance, keeping its hue.
 *
 * Luminance is a *linear* function of the linear-light channels, so the scale
 * factor is simply `target / current` — no search, no approximation. Scaling all
 * three channels equally is what keeps the hue: it moves the colour along a ray
 * from black, which changes how bright it is and nothing else.
 *
 * Clamps rather than clips per channel, because a factor above 1 on an already
 * bright colour would blow one channel to 255 before the others and turn a tint
 * into a different hue.
 */
export function atLuminance(color: string, target: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;

  const current = luminance(color);
  if (current <= 0) return color;

  const scale = Math.min(
    target / current,
    1 / Math.max(toLinear(rgb.r / 255), toLinear(rgb.g / 255), toLinear(rgb.b / 255), 1e-6)
  );

  return rgbToHex({
    r: toByte(toLinear(rgb.r / 255) * scale),
    g: toByte(toLinear(rgb.g / 255) * scale),
    b: toByte(toLinear(rgb.b / 255) * scale),
  });
}

/**
 * Raise a colour's saturation to a floor, keeping its hue and lightness.
 *
 * For colours read out of artwork rather than chosen. Averaging real pixels
 * always lands somewhere muted — Watch Dogs 2's blue comes back as `#6B7984`,
 * which is recognisably the right hue and looks like a mistake on a button.
 * Raising only the floor leaves an already-vivid extraction untouched, so a
 * DOOM red stays a DOOM red.
 */
export function saturate(color: string, floor: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;

  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return color; // A true grey has no hue to preserve.

  const sat = delta / (1 - Math.abs(2 * light - 1));
  if (sat >= floor) return color;

  // Push each channel away from the colour's own lightness. Equivalent to
  // rebuilding it in HSL at the higher saturation, without the round trip.
  const scale = floor / sat;
  const push = (channel: number) => (channel - light) * scale + light;
  return rgbToHex({ r: push(r) * 255, g: push(g) * 255, b: push(b) * 255 });
}

export type Hsl = { h: number; s: number; l: number };

/** sRGB hex → HSL, with `h` in degrees and `s`/`l` in 0–1. */
export function toHsl(color: string): Hsl | null {
  const rgb = hexToRgb(color);
  if (!rgb) return null;

  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) return { h: 0, s: 0, l };

  const s = delta / (1 - Math.abs(2 * l - 1));
  const h =
    max === r
      ? 60 * (((g - b) / delta + 6) % 6)
      : max === g
        ? 60 * ((b - r) / delta + 2)
        : 60 * ((r - g) / delta + 4);

  return { h, s, l };
}

/** HSL → sRGB hex. The inverse of `toHsl`. */
export function fromHsl({ h, s, l }: Hsl): string {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const hue = (((h % 360) + 360) % 360) / 60;
  const second = chroma * (1 - Math.abs((hue % 2) - 1));
  const match = l - chroma / 2;

  const [r, g, b] =
    hue < 1
      ? [chroma, second, 0]
      : hue < 2
        ? [second, chroma, 0]
        : hue < 3
          ? [0, chroma, second]
          : hue < 4
            ? [0, second, chroma]
            : hue < 5
              ? [second, 0, chroma]
              : [chroma, 0, second];

  return rgbToHex({ r: (r + match) * 255, g: (g + match) * 255, b: (b + match) * 255 });
}

/**
 * Restate a hue at a given saturation and lightness.
 *
 * **The one primitive behind a game's whole palette.** Everything else in this
 * file adjusts a colour you already have — lift its contrast, raise its
 * saturation floor, mix a hue into a fixed grey while holding its luminance.
 * This does the opposite: it throws away everything about the input except *which
 * colour it is* and rebuilds it at a stated tone.
 *
 * That is what a tonal ramp needs. A hue read out of box art arrives at whatever
 * lightness the artwork happened to average to — `#b69254` for a warm cover, but
 * it could as easily have been `#4a3a1f` or `#e8d0a0` for artwork that reads
 * identically to a person. Deriving a page background by *darkening* that
 * measurement propagates the accident; deriving it by restating the hue at a
 * fixed 6% lightness does not. Two games with the same colour and different
 * exposure then get the same page, which is the whole point.
 *
 * Hue is preserved exactly. `s` and `l` are clamped to 0–1.
 */
export function atTone(color: string, s: number, l: number): string {
  const hsl = toHsl(color);
  if (!hsl) return color;

  return fromHsl({
    h: hsl.h,
    s: Math.max(0, Math.min(1, s)),
    l: Math.max(0, Math.min(1, l)),
  });
}

/**
 * Tint a surface with a hue **without changing how light it is**.
 *
 * The naive version — mix the surface toward the hue — does not work on a
 * near-black palette. Every hue in the ramp is far brighter than `#1C1C1C`, so
 * even a 7% mix lifts `#1C1C1C` to `#2C241F`: lighter than `surfaceElevated`,
 * which silently reorders the surface steps that carry all of this app's depth,
 * and drops `textMuted` on it from 4.32:1 to 3.86:1.
 *
 * Mixing and then restoring the original luminance gives a surface that is
 * unmistakably warm or cool and measures *identically* to the grey it replaced.
 * Every text token keeps the contrast ratio it was chosen for, which is what
 * makes tinted surfaces safe to use anywhere a plain one was — no per-hue
 * exceptions, no "don't put a caption on this one".
 */
export function tint(base: string, hue: string, amount: number): string {
  if (!isHex(base) || !isHex(hue)) return base;
  return atLuminance(mix(base, hue, amount), luminance(base));
}

/**
 * sRGB channel → linear light.
 *
 * Only `luminance` and the luminance-preserving tint need this: contrast is
 * defined on linear light even though every mix in this file deliberately is
 * not. See the note on `mix`.
 */
function toLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** Linear light → sRGB channel byte. */
function toByte(channel: number): number {
  const clamped = Math.max(0, Math.min(1, channel));
  const srgb = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055;
  return srgb * 255;
}

/**
 * `lerp(from, to, fraction)` between two colours, as Compose computes it: in
 * Oklab, where a step is the same visible difference in the darks as in the
 * lights. Home's glow eases its tone into the page this way (`lib/home-glow`);
 * `mix` above is the sRGB blend, and the two disagree most toward black.
 */
export function mixOklab(from: string, to: string, fraction: number): string {
  const a = toOklab(from);
  const b = toOklab(to);
  if (!a || !b) return fraction < 0.5 ? from : to;
  const t = Math.min(1, Math.max(0, fraction));
  return fromOklab([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
}

type Oklab = [l: number, a: number, b: number];

function toOklab(hex: string): Oklab | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = toLinear(rgb.r / 255);
  const g = toLinear(rgb.g / 255);
  const b = toLinear(rgb.b / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([L, A, B]: Oklab): string {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return rgbToHex({
    r: toByte(Math.max(0, 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    g: toByte(Math.max(0, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    b: toByte(Math.max(0, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
  });
}
