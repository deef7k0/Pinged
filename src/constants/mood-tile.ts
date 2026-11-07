import { atLuminance, contrast, fromHsl, INK_ON_DARK, mix, saturate, toHsl } from '../lib/color';

/**
 * A mood's or a genre's tile at the foot of Home — SimpMusic's "Moods &
 * Genres" browse card, read from its source (`MoodCategoryCard.kt`,
 * `PlaylistThumbnail.kt`'s `playlistTitleGradient`, `UIExt.kt`'s
 * `angledGradientBackground`, and the grid in `SearchScreen.kt` that lays them
 * out two to a row). The owner's direction (2026-10-22): "blocks in a gradient
 * color with an image from a song".
 *
 * Pure — no React Native, no network — so `npm test` holds every number to the
 * reference and every ink to AA. `components/home/mood-tiles` draws it.
 *
 * ## What the reference is, in one breath
 *
 * A 2:1 block with a 10dp corner, filled with a two-colour gradient at 45°,
 * the name in the top-left in white over two lines at most, and **one cover
 * tilted 25° off the bottom-right corner** — offset 8 right and 12 down
 * *before* it is rotated, so the tile's own clip cuts it into a diagonal
 * instead of pasting a square inside the card. Two to a row, twelve apart. The
 * cover is fetched per tile and arrives late; the tile is built to look
 * finished without it.
 *
 * ## The two departures, and why
 *
 * 1. **The gradient is the item's own hue, not a hash of its name.** The
 *    reference derives two unrelated hues from `title.hashCode()` — a
 *    deterministic colour that means nothing. This app already has a colour
 *    that means something for exactly these items: a genre's identity hue
 *    (`constants/identity`, the colour that genre's games' pages are lit in)
 *    and a mood's own `hue`. Inventing a hex is against the colour rule
 *    (CLAUDE.md § Conventions: "Add a meaning by aliasing, never by inventing
 *    a hex"), so a tile is **its own hue twice**: deep at the corner the name
 *    starts in, rich at the corner the cover sits in, the second stop turned
 *    `GRADIENT_TURN` along the ramp so the block reads as two colours rather
 *    than one dimmed.
 *
 * 2. **Both stops are anchored by measured luminance, so the name is white on
 *    every tile.** The reference fills from a bright `HSV(h, 0.7, 0.9)` and
 *    sets the title in `Color.White` whatever that lands on — on its yellows
 *    that is about 1.5:1. Here the name's box is most of a 2:1 tile, so there
 *    is no band to keep clear: white has to hold *everywhere* on the
 *    gradient. Fixing the two stops at a **lightness** cannot do that (yellow
 *    and blue are nowhere near each other in luminance at one lightness), so
 *    each stop is placed at a luminance instead — `atLuminance` keeps the hue
 *    and the saturation and finds the rest — which is what makes every tile as
 *    vivid as its own hue allows while measuring the same against white. A
 *    blue tile comes out darker than its number asks for because a saturated
 *    blue cannot be that bright; that is the hue, not a mistake.
 *
 * **No badge.** The reference stamps each tile with a white disc carrying
 * SimpMusic's monochrome mark at 20% — the same badge its artwork-less
 * playlist thumbnails wear, which are surfaces people screenshot and share.
 * There is no GameLog logo (§ A review in one sentence: the share card's
 * controller is a stand-in), and twenty stand-in brand dots inside the app
 * would be twenty pieces of clutter telling somebody which app they are
 * already in. The name's right-hand padding stays regardless, because the
 * reference's own comment says what it is for: the tilted cover's bounding
 * box, not the badge.
 */

/** `aspectRatio(2f)`. */
export const TILE_ASPECT = 2;

/** `RoundedCornerShape(10.dp)`. */
export const TILE_RADIUS = 10;

/** `GridCells.Fixed(2)` on a portrait phone (`moodGridColumns`). */
export const TILE_COLUMNS = 2;

/** `Arrangement.spacedBy(12.dp)`, both ways. */
export const TILE_GAP = 12;

/** The cover, `size(64.dp)`, its corner `RoundedCornerShape(2.dp)`. */
export const ART_SIZE = 64;
export const ART_RADIUS = 2;

/**
 * The cover's height: a portrait at IGDB's 3:4, not the reference's square
 * (the owner's, 2026-11-06: square covers cut the box art off). Its width is
 * the reference's 64 and it hangs from the same corner, so it only grows
 * upward, under the tile's clip; its left edge stays clear of the name
 * (checked: at the name's second line it is 12dp past `TILE_PAD.end`).
 */
export const ART_HEIGHT = Math.round((ART_SIZE * 4) / 3);

/** `rotate(25f)`, and the `offset(x = 8.dp, y = 12.dp)` applied before it. */
export const ART_TURN = 25;
export const ART_OFFSET = { x: 8, y: 12 } as const;

/**
 * `padding(start = 12, top = 12, bottom = 12, end = 72)` round the name.
 *
 * The 72 is the reference's own arithmetic: a 64dp square turned 25° has a
 * bounding box of `64 × (cos 25° + sin 25°) ≈ 85dp`, so it spills about 10dp
 * past each side, and it is already pushed 8dp past the tile's edge — leaving
 * roughly 66dp of it inside. The name stops clear of the *left edge of the
 * tilted cover*, not merely clear of the corner.
 *
 * It is a constant, as the reference's is, so it is measured for the ~158dp
 * tile a 360dp phone gives: from 360 up every mood's and every genre's name
 * fits (`mood-tile.test.ts` checks each against Poppins' own advance widths),
 * and on a 320dp display the longest ellipsize — which is what the reference
 * does there too.
 */
export const TILE_PAD = { start: 12, top: 12, bottom: 12, end: 72 } as const;

/** `maxLines = 2`, `TextOverflow.Ellipsis`. */
export const NAME_LINES = 2;

/**
 * The name's size: 14 on 19, semibold — a step under the app's row title
 * (15), because the longest one-word names ("Platformer", "Adventure") have
 * 75dp beside the turned cover on a 360dp phone and Inter at 15 takes 76.
 */
export const NAME_TYPE = { fontSize: 14, lineHeight: 19 } as const;

/** `angledGradientBackground(…, degrees = 45f)`. */
export const GRADIENT_ANGLE = 45;

/**
 * How far round the hue circle the rich stop is turned.
 *
 * The identity ramp's own neighbours sit a median of 31° apart (measured:
 * 354, 25, 42, 84, 149, 177, 208, 232, 263, 323), so half a step reads as
 * "this colour, turned and lifted" rather than as the hue of the tile beside
 * it borrowed.
 */
export const GRADIENT_TURN = 16;

/**
 * Where the two stops sit, as **relative luminance** — the deep corner the
 * name starts in, and the rich corner the cover sits in.
 *
 * `to` is the brightest at which white still clears `INK_RATIO` on all ten
 * hues, which is what makes it this number and not a rounder one; `from` is
 * dark enough that the name is comfortable where it is densest. Raise either
 * and `mood-tile.test.ts` fails by hue.
 */
export const LUMINANCE = { from: 0.045, to: 0.175 } as const;

/**
 * The floor the hue's saturation is lifted to before its luminance is set.
 *
 * Four of the ten (lime, jade, aqua, and nothing else) are drawn at 0.65 for
 * a *label* on a dark page; at that saturation a whole block of them reads
 * grey-green. The six already above this keep what they have — `saturate`
 * is a floor, not a setting.
 */
export const SATURATION_FLOOR = 0.75;

/** The name's ink: the reference's white, on every tile. */
export const TILE_INK = INK_ON_DARK;

/** AA for the name, which is 13sp semibold — body text, so 4.5:1. */
export const INK_RATIO = 4.5;

/**
 * A tile's gradient for the hue it stands for: `[deep, rich]` — the first at
 * the corner the name starts in, the second at the corner the cover sits in.
 *
 * A colour that cannot be read (never, for a token) comes back twice, which
 * draws a flat block rather than nothing.
 */
export function tileGradient(hue: string): [string, string] {
  const hsl = toHsl(saturate(hue, SATURATION_FLOOR));
  if (!hsl) return [hue, hue];
  /* Set the lightness mid-scale first: `atLuminance` moves lightness, and
     starting from the token's own (0.54–0.77) would leave a near-white hue
     with no room to go up and a dark one with none to come down. */
  const at = (h: number, target: number) =>
    atLuminance(fromHsl({ h: ((h % 360) + 360) % 360, s: hsl.s, l: 0.5 }), target);
  return [at(hsl.h, LUMINANCE.from), at(hsl.h + GRADIENT_TURN, LUMINANCE.to)];
}

/**
 * The worst contrast the name's ink has anywhere on a tile of this hue — what
 * the test measures, and what a new hue would have to clear.
 *
 * Sampled rather than solved: the ramp is a mix of two sRGB hexes and its
 * worst point is not always an end.
 */
export function inkContrast(hue: string, samples = 20): number {
  const [from, to] = tileGradient(hue);
  let worst = Infinity;
  for (let i = 0; i <= samples; i += 1) {
    worst = Math.min(worst, contrast(TILE_INK, mix(from, to, i / samples)));
  }
  return worst;
}

/** A tile's width for a display at a margin, and the height 2:1 gives it. */
export function tileSize(
  display: number,
  margin: number,
  columns = TILE_COLUMNS
): { width: number; height: number } {
  const room = display - margin * 2 - TILE_GAP * (columns - 1);
  const width = Math.floor(room / columns);
  return { width, height: Math.round(width / TILE_ASPECT) };
}
