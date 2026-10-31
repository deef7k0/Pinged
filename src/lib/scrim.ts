/**
 * SimpMusic's `artworkScrimBrush` (`UIExt.kt`), as numbers: how artwork melts
 * into the page under it. Geometry only — a ramp of alphas the caller lays over
 * whatever colour the page is. Pure, so `npm test` holds it.
 */

/** SimpMusic's stop count: enough that 8-bit banding never shows on a dark page. */
export const SCRIM_STEPS = 24;

/**
 * The stops of SimpMusic's `artworkScrimBrush`: a ramp from the page colour at
 * 0 alpha to the page colour, eased by smoothstep so it is flat at *both*
 * ends. A linear ramp has a corner where it leaves 0, and the eye tracks the
 * derivative of brightness — that corner is the edge people see.
 *
 * Returned as locations and alphas; the component applies them to the colour
 * with `withAlpha`, never to `'transparent'`, which is black at 0 alpha and
 * drags the middle of the ramp through grey.
 */
export function smoothScrimStops(steps = SCRIM_STEPS): { locations: number[]; alphas: number[] } {
  const locations: number[] = [];
  const alphas: number[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    locations.push(t);
    alphas.push(t * t * (3 - 2 * t));
  }
  return { locations, alphas };
}

/**
 * How the foot of a piece of art gives way to the page: the page colour's alpha
 * down the frame, top to bottom. Only the alpha is read; the colour is the
 * page's.
 */
export type FootFade = { locations: readonly number[]; alphas: readonly number[] };

/**
 * A smoothstep from nothing to the page over the bottom `share` of the frame —
 * SimpMusic's `artworkScrimBrush`, which a collection and a studio lay over
 * their bottom 70%.
 */
export function footFade(share: number): FootFade {
  const stops = smoothScrimStops();
  const start = 1 - share;
  return {
    locations: [0, ...stops.locations.map((at) => start + at * share)],
    alphas: [0, ...stops.alphas],
  };
}
