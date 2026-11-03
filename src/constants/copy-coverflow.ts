/**
 * The physical shelf as Cover Flow — rit3zh's `expo-coverflow-carousel` (MIT),
 * read from its source (`get-layout.ts`, `build-coverflow-styles.ts`,
 * `resolve-cover-flow-values.ts`, `use-pan-gesture.ts`), at the owner's
 * direction (2026-11-02): "Your physical games would appear there, in the form
 * of portrait obviously. Make it so you only see one each side, and bigger".
 *
 * The reference's cards are square at half the display. A box is 2:3, so at
 * the same width it would read smaller than the reference's albums; it is
 * drawn at 58% of the display instead (the reference's half), and only one
 * neighbour stands at each side — the next has faded out half a step past it.
 *
 * Pure, and under `npm test`. The pose functions are worklets.
 */

/** The reference's 64°: how far a side cover is turned away. */
export const COVERFLOW_ANGLE = 64;
/** The reference's perspective distance. */
export const COVERFLOW_PERSPECTIVE = 1000;
/** The reference's curve for the centre cover flattening out. */
export const COVERFLOW_HANDOFF_POWER = 1.29;

/** The box's width as a share of the display (the reference's square is 0.5). */
export const COVERFLOW_CARD_SHARE = 0.58;
/** And never wider than this, on a tablet. */
export const COVERFLOW_CARD_MAX = 300;

/** A box is 2:3, as every cover in the app is. */
const PORTRAIT = 3 / 2;

/**
 * Where a cover stops being drawn, in covers from the centre. One each side is
 * whole; the second has faded out by half a step past it.
 */
export const COVERFLOW_SHOWN = 1;
export const COVERFLOW_GONE = 1.5;

/** Covers kept mounted each side of the one in front; the rest are not drawn at all. */
export const COVERFLOW_MOUNTED = 3;

/** The reflection under each box, as a share of its height, and how strong it starts. */
export const REFLECTION_SHARE = 0.32;
export const REFLECTION_STRENGTH = 0.38;

/** The hand-off: the cover flying to where the copy's case stands. */
export const HANDOFF_MS = 560;
/** And back, once the copy is closed. */
export const RETURN_MS = 460;

export type CoverflowLayout = {
  card: number;
  cardHeight: number;
  reflection: number;
  /** How far the first neighbour's centre is from the middle. */
  centerPush: number;
  /** How far each cover past the first is from the one before it. */
  stackSpacing: number;
  /** How far a finger moves to bring the next cover to the middle. */
  itemStep: number;
};

export function coverflowLayout(windowWidth: number): CoverflowLayout {
  const card = Math.round(Math.min(windowWidth * COVERFLOW_CARD_SHARE, COVERFLOW_CARD_MAX));
  const cardHeight = Math.round(card * PORTRAIT);
  return {
    card,
    cardHeight,
    reflection: Math.round(cardHeight * REFLECTION_SHARE),
    /* The reference's 0.66: at 58% of the display it puts a neighbour's
       turned-away edge just inside the display's (tested). */
    centerPush: card * 0.66,
    stackSpacing: card * 0.2,
    itemStep: card * 0.62,
  };
}

/** The reference's ease: 1 − (1 − |d|)^power, for |d| ≤ 1, signed. */
export function easeOutPower(distance: number, power: number): number {
  'worklet';
  const abs = Math.min(Math.abs(distance), 1);
  const progress = 1 - Math.pow(1 - abs, power);
  return distance < 0 ? -progress : progress;
}

export type CoverflowPose = {
  translateX: number;
  rotateY: number;
  scale: number;
  opacity: number;
  zIndex: number;
};

/**
 * One cover's pose at `distance` covers from the middle (its index less the
 * offset): `build-coverflow-styles.ts`, with the window cut to one each side.
 */
export function coverflowPose(
  distance: number,
  centerPush: number,
  stackSpacing: number
): CoverflowPose {
  'worklet';
  const power = COVERFLOW_HANDOFF_POWER;
  const angle = COVERFLOW_ANGLE;
  const shown = COVERFLOW_SHOWN;
  const gone = COVERFLOW_GONE;
  const abs = Math.abs(distance);
  const clamped = Math.min(Math.max(distance, -1), 1);
  const eased = easeOutPower(distance, power);
  const opacity = abs <= shown ? 1 : abs >= gone ? 0 : 1 - (abs - shown) / (gone - shown);
  return {
    translateX: eased * centerPush + (distance - clamped) * stackSpacing,
    rotateY: -eased * angle,
    scale: 1 - Math.abs(eased) * 0.12,
    opacity,
    zIndex: Math.round(1000 - abs * 100),
  };
}

/**
 * Where a flick comes to rest: the reference's projection — the offset plus
 * 0.28 of what the velocity would carry in a second — rounded to a cover.
 */
export function coverflowSnap(
  offset: number,
  velocityX: number,
  itemStep: number,
  maxIndex: number
): number {
  'worklet';
  const projected = offset + (-velocityX / itemStep) * 0.28;
  return Math.min(Math.max(Math.round(projected), 0), maxIndex);
}

export type Rect = { x: number; y: number; width: number; height: number };

/**
 * What the flying cover does to reach `to` from `from`: a translation of its
 * centre and a scale on each axis, about its own centre (React Native's
 * default transform origin).
 */
export function flightTo(from: Rect, to: Rect): { dx: number; dy: number; sx: number; sy: number } {
  return {
    dx: to.x + to.width / 2 - (from.x + from.width / 2),
    dy: to.y + to.height / 2 - (from.y + from.height / 2),
    sx: to.width / from.width,
    sy: to.height / from.height,
  };
}
