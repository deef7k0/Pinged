import {
  DynamicScheme,
  Hct,
  TonalPalette,
  Variant,
  argbFromHex,
  hexFromArgb,
} from '@material/material-color-utilities';

/**
 * Material 3 dynamic colour (Monet), generated from one seed.
 *
 * ## What this replaces
 *
 * The app's own five-tone ramp, which derived `page` / `card` / `elevated` /
 * `color` from a hue by restating it at fixed HSL saturation and lightness. That
 * worked, and it had two limits this does not: it produced exactly one accent
 * family (so there was no secondary or tertiary to reach for), and HSL lightness
 * is not perceptual — the same "L" reads as a different brightness at different
 * hues, which is why the old ramp needed per-role saturation tuning to look even
 * across the wheel. HCT is perceptually uniform, so tone 20 is *the same
 * lightness* whether the hue is yellow or indigo.
 *
 * ## Why the tones are read off the palettes rather than off the scheme
 *
 * `DynamicScheme` exposes every role as a getter (`scheme.surfaceContainer`),
 * and those getters implement whichever M3 spec version the library defaults to
 * — currently 2021, whose dark `surfaceContainer` is neutral tone **12**. The
 * table below asks for **20**. Rather than accept whatever the library's spec
 * revision happens to say this release, the scheme is built for its *palettes*
 * — which is where `TONAL_SPOT`'s chroma rules actually live — and every role
 * then reads an explicit tone off an explicit palette. That makes this file the
 * single statement of what the app's colours are, and makes the output stable
 * across library upgrades.
 *
 * ## Why TONAL_SPOT
 *
 * It is the Android system default and the least opinionated of the nine
 * variants: the primary palette keeps the seed's hue at a moderate chroma (36)
 * and the neutrals stay genuinely near-grey (chroma 6 / 8). `VIBRANT` and
 * `EXPRESSIVE` rotate the hue for secondary and tertiary, which is striking on a
 * launcher and wrong here — a game's page should be the colour of that game's
 * box art, not a harmony built around it.
 */

/** Every role the app can ask for, as hex. */
export type DynamicThemeColors = {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  outline: string;
  outlineVariant: string;
};

export type DynamicRole = keyof DynamicThemeColors;

/** Which of the five tonal palettes a role is drawn from. */
type PaletteName = 'primary' | 'secondary' | 'tertiary' | 'neutral' | 'neutralVariant';

/**
 * The role table: palette, plus the tone to take in each mode.
 *
 * Data rather than twenty-three lines of `hexFromArgb(...)`, so the mapping can
 * be read in one screenful, diffed against the M3 spec, and asserted over in a
 * test without restating it.
 *
 * The dark column is the one this app uses — `APP_SCHEME` is `'dark'` and a
 * light counterpart would be a second product (see CLAUDE.md). The light column
 * is filled in anyway because a half-built table invites somebody to guess the
 * other half later, and these values are not guesses: they are M3's.
 */
const ROLES: Record<DynamicRole, { palette: PaletteName; light: number; dark: number }> = {
  /*
   * **Primary is tone 60 in dark, not M3's 80, and that is the single most
   * visible decision in this file.**
   *
   * At tone 80 a red seed resolves to `#ffb3ae` — which reads as pink. Raising
   * the chroma does not fix it: measured across chroma 36/48/64/80, tone 80
   * lands on `#ffb3ae` *every time*, because a colour that light is outside the
   * sRGB gamut at any real chroma and HCT clamps it back. Tone is what makes a
   * fill pastel, and chroma cannot argue with it.
   *
   * Tone 60 at the chroma below gives `#ec6661` for Red Dead's red, `#bc8711`
   * for a warm cover, `#4f94dd` for Celeste — recognisably *the colour*, and
   * still comfortably short of a fill nobody can look at. `onPrimary` drops to
   * tone 10 to keep 5.4:1 on it; at M3's tone 20 the pair measures 4.78:1, which
   * passes and leaves nothing in hand.
   */
  primary: { palette: 'primary', light: 40, dark: 60 },
  onPrimary: { palette: 'primary', light: 100, dark: 10 },
  primaryContainer: { palette: 'primary', light: 90, dark: 32 },
  onPrimaryContainer: { palette: 'primary', light: 10, dark: 92 },

  secondary: { palette: 'secondary', light: 40, dark: 70 },
  onSecondary: { palette: 'secondary', light: 100, dark: 15 },
  secondaryContainer: { palette: 'secondary', light: 90, dark: 32 },
  onSecondaryContainer: { palette: 'secondary', light: 10, dark: 92 },

  tertiary: { palette: 'tertiary', light: 40, dark: 70 },
  onTertiary: { palette: 'tertiary', light: 100, dark: 15 },
  tertiaryContainer: { palette: 'tertiary', light: 90, dark: 32 },
  onTertiaryContainer: { palette: 'tertiary', light: 10, dark: 92 },

  /* The page and its steps sit a little further apart than M3's defaults
     (10 / 12 / 17 / 22) so a card is legible against the page at the raised
     neutral chroma without being a highlight. */
  background: { palette: 'neutral', light: 98, dark: 10 },
  onBackground: { palette: 'neutral', light: 10, dark: 92 },
  surface: { palette: 'neutral', light: 98, dark: 10 },
  onSurface: { palette: 'neutral', light: 10, dark: 92 },

  surfaceVariant: { palette: 'neutralVariant', light: 90, dark: 30 },
  onSurfaceVariant: { palette: 'neutralVariant', light: 30, dark: 82 },

  surfaceContainer: { palette: 'neutral', light: 92, dark: 18 },
  surfaceContainerHigh: { palette: 'neutral', light: 90, dark: 22 },
  surfaceContainerHighest: { palette: 'neutral', light: 87, dark: 26 },

  outline: { palette: 'neutralVariant', light: 50, dark: 60 },
  outlineVariant: { palette: 'neutralVariant', light: 80, dark: 30 },
};

/**
 * How much colour each palette carries, overriding `TONAL_SPOT`'s defaults.
 *
 * `TONAL_SPOT` is built for a launcher, where the wallpaper is behind everything
 * and the UI must not fight it: primary chroma 36, neutrals 6 and 8. Here the
 * artwork is *one object on the page* and the palette is the only thing carrying
 * the game's identity, so every one of those is too quiet — the result reads as
 * a grey app with a pastel button.
 *
 * **Primary tracks the seed's own chroma between a floor and a ceiling.** A
 * clamp rather than a constant, because the seeds are real measurements and they
 * differ enormously: Red Dead's red arrives at chroma 62, DOOM's at 80, a muted
 * warm cover at 30, a near-grey cover at 13. A constant would either wash out
 * the vivid ones or invent colour the muted ones never had. The floor (48) is
 * what stops a grey cover producing a grey button; the ceiling (72) is what
 * stops a neon one producing a fill that hurts.
 *
 * The neutrals roughly double, which is what tints the page and the cards toward
 * the game without making them coloured surfaces — `#291716` for Red Dead's red
 * rather than M3's near-grey `#231919`.
 */
const CHROMA = {
  primaryFloor: 48,
  primaryCeiling: 72,
  secondary: 28,
  tertiary: 36,
  neutral: 12,
  neutralVariant: 18,
} as const;

/** Every role name, for callers that need to iterate — the test, mainly. */
export const DYNAMIC_ROLES = Object.keys(ROLES) as DynamicRole[];

/**
 * The seed used when there is no artwork to read.
 *
 * M3's own baseline purple. Deliberately *not* the app's house blue: this is the
 * "we could not tell" colour, and it should be recognisably a default rather
 * than something a reader might take for a real extraction.
 */
export const FALLBACK_SEED = '#6750A4';

/** The seed for artwork that exists but yields nothing — a grey cover, a 404. */
export const NEUTRAL_SEED = '#79747E';

function paletteFor(scheme: DynamicScheme, name: PaletteName): TonalPalette {
  switch (name) {
    case 'primary':
      return scheme.primaryPalette;
    case 'secondary':
      return scheme.secondaryPalette;
    case 'tertiary':
      return scheme.tertiaryPalette;
    case 'neutral':
      return scheme.neutralPalette;
    case 'neutralVariant':
      return scheme.neutralVariantPalette;
  }
}

/**
 * A full M3 role set from one seed colour.
 *
 * Pure: same input, same output, no React, no platform calls, no I/O. That is
 * what makes it testable — see `dynamic-color.test.ts` — and it is also why the
 * *extraction* lives in a hook and not in here.
 *
 * An unparseable seed falls back rather than throwing. This runs on whatever
 * `react-native-image-colors` or the JPEG decoder handed back, and a malformed
 * hex reaching it should cost the page its colour, not its render.
 */
export function generateDynamicTheme(seedColor: string, isDark: boolean): DynamicThemeColors {
  const key = `${isDark ? 'dark' : 'light'}:${seedColor}`;
  const cached = schemes.get(key);
  if (cached) return cached;

  const colors = buildScheme(seedColor, isDark);
  /* Oldest first out: a Map iterates in insertion order. */
  if (schemes.size >= SCHEME_CACHE_SIZE) schemes.delete(schemes.keys().next().value as string);
  schemes.set(key, colors);
  return colors;
}

/**
 * Every scheme built this session, by seed and mode.
 *
 * **This cache is the difference between a screen that opens and one that
 * stutters.** Building a scheme is HCT maths over five tonal palettes and
 * twenty-three roles: 6 ms a call on a warm V8, several times that under
 * Hermes, which has no JIT. And it is asked for constantly with the same few
 * seeds — `accentRoles()` builds one for the house blue, and `useAccent()` used
 * to call that in every button, chip, tab and field on mount, so a screen of
 * twenty controls built the same scheme twenty times on the JS thread while its
 * push animation ran. The answer is a pure function of its two arguments, so it
 * is computed once. The results are shared, so they must never be mutated.
 *
 * Bounded, because seeds come from box art: a session that opens two hundred
 * game pages would otherwise keep two hundred schemes it will not see again.
 */
const schemes = new Map<string, DynamicThemeColors>();
const SCHEME_CACHE_SIZE = 64;

function buildScheme(seedColor: string, isDark: boolean): DynamicThemeColors {
  const source = Hct.fromInt(argbOf(seedColor));

  /*
   * `TONAL_SPOT`'s structure, this app's chroma.
   *
   * `DynamicScheme` takes palette overrides precisely so a caller can keep a
   * variant's behaviour and retune one axis of it. The variant still decides the
   * *hues* — primary and secondary on the seed's own, tertiary rotated 60° — and
   * everything else about how the scheme is put together; only how much colour
   * each palette carries is ours. That is a smaller and much more reviewable
   * change than switching to `VIBRANT` or `FIDELITY`, both of which alter hue
   * relationships as well as chroma.
   */
  const hue = source.hue;
  const primaryChroma = Math.min(
    CHROMA.primaryCeiling,
    Math.max(CHROMA.primaryFloor, source.chroma)
  );

  const scheme = new DynamicScheme({
    sourceColorHct: source,
    variant: Variant.TONAL_SPOT,
    primaryPalette: TonalPalette.fromHueAndChroma(hue, primaryChroma),
    secondaryPalette: TonalPalette.fromHueAndChroma(hue, CHROMA.secondary),
    /* +60°, which is the rotation `TONAL_SPOT` applies to tertiary itself. Stated
       here because overriding the palette means the variant no longer gets to. */
    tertiaryPalette: TonalPalette.fromHueAndChroma(hue + 60, CHROMA.tertiary),
    neutralPalette: TonalPalette.fromHueAndChroma(hue, CHROMA.neutral),
    neutralVariantPalette: TonalPalette.fromHueAndChroma(hue, CHROMA.neutralVariant),
    /* 0 is the M3 default. Raising it re-derives every role for a higher
       contrast ratio, which is a user *accessibility preference* rather than a
       design choice — wire it to the OS setting if that is ever surfaced, and
       do not hard-code a non-zero value here. */
    contrastLevel: 0,
    isDark,
  });

  const out = {} as DynamicThemeColors;
  for (const role of DYNAMIC_ROLES) {
    const { palette, light, dark } = ROLES[role];
    out[role] = hexFromArgb(paletteFor(scheme, palette).tone(isDark ? dark : light));
  }
  return out;
}

/**
 * `#RRGGBB`, and nothing else.
 *
 * **`argbFromHex` does not reject bad input, which is the trap here.** It strips
 * non-hex characters and parses whatever is left, so `"nonsense"` becomes a
 * perfectly valid green (`e`, `e` and the rest survive the strip) and `"#12"`
 * becomes something else again. A caller handing this a broken seed would get a
 * confident, wrong, *stable* palette rather than the documented fallback — the
 * worst of the three outcomes, because nothing anywhere would look broken.
 *
 * Verified against the library rather than assumed: the first version of this
 * file used a `try`/`catch` and the test caught that it never fires.
 */
const SEED = /^#[0-9a-f]{6}$/i;

function argbOf(seed: string): number {
  return argbFromHex(SEED.test(seed) ? seed : FALLBACK_SEED);
}
