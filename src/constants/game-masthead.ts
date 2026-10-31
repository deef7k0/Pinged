/**
 * The game page's masthead, in numbers.
 *
 * Every one of these was read off the owner's reference — a film's page in
 * Letterboxd, a screenshot of a 360dp display at 3× (its histogram's bars are
 * exactly 26dp with 1dp between them, which is what fixes the scale) — and
 * `game-masthead.test.ts` holds each to the relation it was measured for. Type
 * is matched by capital height, because the reference is set in Graphik and
 * this app in Inter: 22 for the name, 13 for everything under it.
 *
 * Pure, with no imports, so `npm test` loads it: the hero's dissolve
 * (`<HeroArt fade="mask">`), the cover's halo (`<CoverHalo>`) and the page's own
 * layout all read these, and none of them may drift from the others.
 */

// ---------------------------------------------------------------------------
// The cover
// ---------------------------------------------------------------------------

/**
 * How wide the cover is, as a fraction of the display: the reference's poster
 * is 100dp on 360. It was a third (119dp), and the owner asked for it a little
 * smaller; the reference's own proportion is the answer to how much.
 */
export const COVER_WIDTH_RATIO = 100 / 360;

/** The ceiling on a display wider than any phone this ships to. */
export const COVER_MAX_WIDTH = 148;

export function mastheadCoverWidth(displayWidth: number): number {
  return Math.min(COVER_MAX_WIDTH, Math.round(displayWidth * COVER_WIDTH_RATIO));
}

/** At least this much between the end of a line of billing and the cover. */
export const COVER_GUTTER = 16;

// ---------------------------------------------------------------------------
// The hero's dissolve
// ---------------------------------------------------------------------------

/**
 * Where the art starts to go, as a fraction of the hero's height from its top.
 *
 * Shrunk down to 0.60 so the top 60% of the artwork remains completely crisp,
 * sharp, and visible, while the bottom 40% dissolves into the page's colour.
 */
export const DISSOLVE_STARTS_AT = 0.6;

/** The curve's two exponents: how gently it leaves, and how long it trails. */
const LEAVE = 2.4;
const TRAIL = 2;

/**
 * How much of the art is showing at `t`, 0 at the hero's top and 1 at its
 * bottom edge.
 *
 * `(1 − uᵖ)²`: flat where it leaves full strength and flat where it lands on
 * nothing, so neither end has an edge, and weighted so the picture holds through
 * the middle and then trails off for a long way. Fitted to the three points the
 * reference's backdrop could be measured at — about three tenths showing 34dp
 * above its poster, under a tenth at the poster's top edge, a fiftieth 14dp
 * further down.
 */
export function dissolveAt(t: number): number {
  if (t <= DISSOLVE_STARTS_AT) return 1;
  if (t >= 1) return 0;
  const u = (t - DISSOLVE_STARTS_AT) / (1 - DISSOLVE_STARTS_AT);
  return (1 - u ** LEAVE) ** TRAIL;
}

/** Segments the curve is drawn in. Twelve keeps every bend under a hundredth. */
const DISSOLVE_SEGMENTS = 12;

/**
 * The curve as gradient stops — a mask's alpha down the hero.
 *
 * The first holds the art at full strength from the very top; the rest sample
 * the curve evenly. A gradient is straight between its stops, so this is twelve
 * short chords of the curve.
 */
export const DISSOLVE_STOPS: readonly { at: number; alpha: number }[] = [
  { at: 0, alpha: 1 },
  ...Array.from({ length: DISSOLVE_SEGMENTS + 1 }, (_, index) => {
    const at = DISSOLVE_STARTS_AT + ((1 - DISSOLVE_STARTS_AT) * index) / DISSOLVE_SEGMENTS;
    return { at: round(at, 4), alpha: round(dissolveAt(at), 4) };
  }),
];

/**
 * Where the top of the cover sits, as a fraction of the hero's height.
 *
 * The owner's instruction, and the reference's arrangement: the title and the
 * cover go *into* the fade — "not below it, not above it" — so the row starts
 * where a last tenth of the art is still showing and the art is gone before the
 * title, a few lines further down. Below the hero's edge (where it was) the
 * picture ends and then the page begins; over visible art (where it was before
 * that) the cover reads as propped against a poster.
 */
export const ROW_ENTERS_AT = 0.885;

/** How far the row rises into the hero, in dp, for a hero this tall. */
export function mastheadOverlap(heroHeight: number): number {
  return Math.round(heroHeight * (1 - ROW_ENTERS_AT));
}

// ---------------------------------------------------------------------------
// The halo
// ---------------------------------------------------------------------------

/**
 * How far the shadow reaches past the cover, as fractions of the cover's own
 * width and height: about 40dp at the sides of a 100dp cover and 51 above and
 * below it. The reference's is gone 35–40dp out.
 *
 * An ellipse that follows the cover rather than a true circle. A circle wide
 * enough to show above and below a 2:3 cover spills 65dp sideways, under the
 * billing; one narrow enough not to is hidden behind the cover top and bottom.
 */
export const HALO_REACH = { x: 0.4, y: 0.34 } as const;

/**
 * Black at the centre of the halo, behind the cover where nobody sees it.
 *
 * What is seen is the edge: three tenths at the middle of the cover's sides.
 * The reference's is two — its owner's words for it are "if you look really
 * closely" — and this one was asked to be seen.
 */
export const HALO_CORE = 0.62;

/** The halo's radii for a cover this size. */
export function haloRadii(coverWidth: number, coverHeight: number): { rx: number; ry: number } {
  return {
    rx: Math.round(coverWidth * (0.5 + HALO_REACH.x)),
    ry: Math.round(coverHeight * (0.5 + HALO_REACH.y)),
  };
}

/**
 * How dark the halo is at `rho`, 0 at its centre and 1 at its rim.
 *
 * `(1 − ρ²)²`, a bell: flat at the rim, so the shadow has no edge of its own.
 */
export function haloAt(rho: number): number {
  if (rho >= 1) return 0;
  return HALO_CORE * (1 - Math.max(0, rho) ** 2) ** 2;
}

/** The bell as stops, bunched where it bends. */
export const HALO_STOPS: readonly { at: number; alpha: number }[] = [
  0, 0.2, 0.35, 0.5, 0.6, 0.7, 0.8, 0.9, 1,
].map((at) => ({ at, alpha: round(haloAt(at), 4) }));

// ---------------------------------------------------------------------------
// About
// ---------------------------------------------------------------------------

/** Lines of the synopsis shown before it is opened: the reference's three. */
export const ABOUT_LINES = 3;

/**
 * The fade over the closed synopsis: how many lines of it, from the bottom, and
 * how far it goes.
 *
 * Measured line by line. The reference's fade starts in the middle of the
 * second line and runs to the foot of the third, which is left a little more
 * than half showing at its top and about an eighth at its bottom — still words,
 * which is what says there are more of them.
 */
export const ABOUT_FADE = { lines: 1.25, depth: 0.88 } as const;

function round(value: number, places: number): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}
