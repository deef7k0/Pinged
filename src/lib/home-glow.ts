import { hexToRgb, mixOklab, rgbToHex } from './color';

/**
 * Home's glow, as SimpMusic draws it — read from its source, not its screens:
 * `HomeScreen.kt` (the first item's background, `HomeGlowOverflow`, the tint
 * from `mainHomeThumbnail`), `HomeViewModel.kt` (which thumbnail that is),
 * `AmbientThemeGlow.kt` (the same glow for a page with no artwork) and
 * `UIExt.kt` (`angledGradientBackground`, `easedColorStops`, `rgbFactor`,
 * `artworkScrimBrush`). Pure, so `npm test` holds the numbers to it.
 *
 * In one breath: the Material 3 primary of **the first item of the first
 * shelf**'s artwork — the scheme its box art seeds, as that game's own page is
 * coloured (`useAlbumArtColor`, `generateDynamicTheme`) — its red, green and
 * blue each multiplied by 0.45, fills the first item of the page — and 140dp
 * past its foot — as a gradient at 25° from that tone into the page, eased by
 * smoothstep; the bottom 60% of the same box is the page colour rising from
 * nothing to solid over it. A new tone breathes in over 500ms.
 *
 * **The tone is `AmbientThemeGlow`'s**: a theme's primary at 0.45. SimpMusic's
 * Home itself tints from the thumbnail's Palette swatch; this app has one
 * colour method, Material 3's (the owner's, 2026-10-28), so Home's glow is the
 * reference's themed glow, with the theme the first game's.
 */

/** `angledGradientBackground(…, 25f)`: 0° runs left to right, and y grows downward. */
export const GLOW_ANGLE = 25;

/** `HomeGlowOverflow`: how far past the first item's foot the glow runs. */
export const GLOW_OVERFLOW = 140;

/** `.fillMaxHeight(0.6f)`: the share of the glow, from its foot, the scrim covers. */
export const GLOW_SCRIM_SHARE = 0.6;

/**
 * `AmbientThemeGlow`'s `tint.rgbFactor(0.45f)`: a theme's primary, scaled
 * toward black — the first game's Material 3 primary, or the house primary
 * while Settings → Game colours is off. "0.45, not Home's 0.3… a pastel
 * primary handed in here at 0.3 read as near-black."
 */
export const GLOW_THEME_FACTOR = 0.45;

/** `animateColorAsState(topHeaderColor, tween(500))`. */
export const GLOW_FADE_MS = 500;

/** `easedColorStops`' `stepsPerSegment`: enough that the eased ramp shows no corners. */
export const GLOW_STEPS = 24;

/**
 * `Color.rgbFactor`: each channel multiplied by `factor`. Plainly, in sRGB — no
 * gamma, no colour space — because that is what the reference does.
 */
export function rgbFactor(color: string, factor: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  const scale = (channel: number) => Math.round(Math.min(255, Math.max(0, channel * factor)));
  return rgbToHex({ r: scale(rgb.r), g: scale(rgb.g), b: scale(rgb.b) });
}

export type Point = { x: number; y: number };

/**
 * Where an angled gradient starts and ends in a `width` × `height` box, as
 * fractions of it — `LinearGradient`'s `start` and `end`.
 *
 * `angledGradientBackground`'s own arithmetic, which is not CSS's: the line
 * runs through the centre at `degrees`, and its length is where that ray
 * leaves the box — `width / cos α` while the angle is shallower than the
 * box's diagonal — so the first colour holds over the corner behind the start
 * and the last over the corner past the end. On a phone the glow is taller
 * than wide, the angle 25° is shallower than its diagonal, and the line runs
 * from the left edge, a third of the way down, to the right edge, two thirds
 * of the way down.
 *
 * Null for a box with no area, where the reference draws nothing either.
 */
export function angledGradient(
  width: number,
  height: number,
  degrees = GLOW_ANGLE
): { start: Point; end: Point } | null {
  if (!(width > 0) || !(height > 0)) return null;

  const gamma = Math.atan2(height, width);
  const normalised = ((degrees % 360) + 360) % 360;
  const alpha = (normalised * Math.PI) / 180;

  let length: number;
  if (alpha <= gamma || alpha >= 2 * Math.PI - gamma) length = width / Math.cos(alpha);
  else if (alpha <= Math.PI - gamma) length = height / Math.sin(alpha);
  else if (alpha <= Math.PI + gamma) length = width / -Math.cos(alpha);
  else length = height / -Math.sin(alpha);

  const dx = (Math.cos(alpha) * length) / 2;
  const dy = (Math.sin(alpha) * length) / 2;
  return {
    start: { x: 0.5 - dx / width, y: 0.5 - dy / height },
    end: { x: 0.5 + dx / width, y: 0.5 + dy / height },
  };
}

/**
 * `easedColorStops(listOf(from, to))`: `steps + 1` stops, each the two colours
 * mixed in Oklab (Compose's `lerp`) by smoothstep of how far along it is — so
 * the ramp is flat where it leaves the tone and flat where it reaches the page.
 * Two stops would be a straight line with a corner at each end, and "those
 * corners read as creases across the glow".
 */
export function easedStops(
  from: string,
  to: string,
  steps = GLOW_STEPS
): { colors: string[]; locations: number[] } {
  const colors: string[] = [];
  const locations: number[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    colors.push(mixOklab(from, to, t * t * (3 - 2 * t)));
    locations.push(t);
  }
  return { colors, locations };
}

/**
 * The glow's tone, from the first game's Material 3 primary, or from none.
 *
 * With game colours on: that primary at 0.45, and null while there is none —
 * "deliberately not a theme-colour fallback, so a silent app shows a plain
 * page rather than a stand-in glow". With them off: the house primary at the
 * same 0.45, `AmbientThemeGlow`'s glow for a page with no artwork.
 */
export function glowTone(
  gamePrimary: string | null,
  { gameColours, primary }: { gameColours: boolean; primary: string }
): string | null {
  if (!gameColours) return rgbFactor(primary, GLOW_THEME_FACTOR);
  return gamePrimary ? rgbFactor(gamePrimary, GLOW_THEME_FACTOR) : null;
}
