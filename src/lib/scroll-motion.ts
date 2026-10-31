/**
 * How a page that opens on artwork answers its own scroll — Apple Music's
 * artist page, in numbers: the game page, a studio and a collection.
 *
 * ## The pinned hero
 *
 * The art is the page's backdrop, pinned at the top of the display, and the
 * page slides over it (`PINNED_HERO`): the art drifts up at a fifth of the
 * page's speed, a blurred copy fades in over it, and it drains into the
 * page's colour — solid at one offset (`solidAt`), which is also where the
 * top bar comes in. Pulled past its top on iOS, the art stretches
 * (`pinnedStretch`): its top stays at the top of the display and its foot goes
 * down with the page. Android does not report a negative offset — its own
 * stretch does the same job to the whole page.
 *
 * ## Shelves
 *
 * Every shelf under the hero rises into place once it scrolls into view
 * (`SHELF_REVEAL`): a fade and a short rise, once, on an ease that lands
 * softly. A shelf already on screen when the page opens is simply there.
 *
 * Pure, with nothing imported, so `npm test` loads it. The functions run on
 * the UI thread inside worklets, and **a worklet's parameter default cannot
 * name a constant** (CLAUDE.md § Gotchas), so none of them has one.
 */

/**
 * The game page's hero, pinned behind the page — the owner's brief of
 * 2026-10-27, with frames of Apple Music's artist page scrolling: "The hero
 * stays pinned behind the game page… it's the game page that moves up making
 * the hero be swallowed… It's not completely still." And: "When the game
 * title reaches the top of the screen, the blur should already be at the
 * strongest and transition into solid background color."
 *
 * So, in screen space: the art drifts up at a fifth of the page's speed
 * (`drift`; in the owner's frames a point on the art moved at about a third,
 * and their words were "mostly still"); the masthead slides over it; a
 * blurred copy fades in after a little scroll, gently, over most of the way
 * (`pinnedBlur`); and the art drains into the page's colour from a third of
 * the way, slowly (`pinnedDrain`),
 * solid once the page is past the title and onto the developer lines, which
 * is where the top bar comes in — the owner's (2026-10-27): "it goes blurrier
 * quicker, by the time it gets past the title and onto the developer section
 * of the masthead it should already be solid", and "at the same level where
 * the top bar comes into screen". One offset runs the bar, the blur and the
 * drain: `solidAt`.
 * No zoom: "the hero never moves".
 */
export const PINNED_HERO = {
  /** How fast the art moves up the display, as a share of the page's speed. */
  drift: 0.2,
  /**
   * Where the blur begins and where it is whole, as shares of the way to
   * solid. It begins after a little scroll, where it always did — "I don't
   * want it to start sooner" — and takes most of the way to come in: "the
   * blur strength transition is slower, not as harsh" (2026-10-27). It was
   * 0.15 → 0.45 for one build.
   */
  blurFrom: 0.15,
  blurUntil: 0.75,
  /**
   * Where the drain into the page's colour begins, as a share of the way to
   * solid: early, and slowly — a long ramp that begins gently while the blur
   * is still coming in. The owner's (2026-10-27): "I want it to start slower,
   * not faster" — it had been made the last quarter, which started late and
   * went fast.
   */
  drainFrom: 0.35,
  /**
   * How far a strip of the page's own colour hangs under the art, on the box
   * that drifts with it — so the art's foot is inside page colour on both
   * sides and no layer's edge lands on it. Without it the foot was a line
   * that moved at the art's speed and not the page's ("some kind of z
   * fighting", the owner, 2026-10-27).
   */
  footHold: 32,
  /** How long the art, and the page's colour, take to come in when first known. */
  arriveMs: 400,
} as const;

/*
 * `smoothstep` is first, and that is load-bearing.
 *
 * The worklets plugin rewrites each of these declarations into a **`const`**,
 * which is not hoisted, and builds every worklet's closure eagerly where the
 * worklet itself is written. So a worklet that calls another one defined
 * *later* in the file captures `undefined` and dies on the UI thread with
 * "undefined is not a function" — while Node, where a function declaration is
 * hoisted like any other, runs the same code and every test passes. That is
 * exactly what `pinnedBlur` did on the owner's phone (2026-10-27).
 *
 * So: **a worklet that calls another must come after it.** Everything here
 * calls `smoothstep` and nothing else, so `smoothstep` goes at the top and the
 * rule is kept by `scroll-motion.test.ts`, which reads this file and checks it.
 */
/** `smoothstep`: 0 before `from`, 1 after `to`, and flat at both ends between. */
export function smoothstep(from: number, to: number, value: number): number {
  'worklet';
  if (to <= from) return value < from ? 0 : 1;
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/** How far up the display the pinned art has drifted, in dp (never past its own height). */
export function pinnedDrift(offset: number, factor: number, height: number): number {
  'worklet';
  if (offset <= 0) return 0;
  return -Math.min(offset * factor, height);
}

/**
 * The pinned art pulled past the top of the page (iOS's bounce): drawn larger
 * about its centre and moved down by half the pull, so its top stays at the
 * top of the display and its foot follows the page. Nothing at rest or
 * scrolled.
 */
export function pinnedStretch(
  offset: number,
  height: number
): { scale: number; translateY: number } {
  'worklet';
  if (offset >= 0 || height <= 0) return { scale: 1, translateY: 0 };
  return { scale: (height - offset) / height, translateY: -offset / 2 };
}

/** How much of the blurred copy shows: from `from` of the way to `solidAt`, whole at `until`. */
export function pinnedBlur(offset: number, solidAt: number, from: number, until: number): number {
  'worklet';
  return smoothstep(solidAt * from, solidAt * until, offset);
}

/** How far the art has drained into the page's colour: from `from` of the way, solid at `solidAt`. */
export function pinnedDrain(offset: number, solidAt: number, from: number): number {
  'worklet';
  return smoothstep(solidAt * from, solidAt, offset);
}

export const SHELF_REVEAL = {
  /** How far a shelf rises as it arrives, in dp. Enough to read as arriving, not as moving. */
  rise: 16,
  /** How long it takes. */
  ms: 560,
  /**
   * The ease: fast away and a long, soft landing (`cubic-bezier(0.16, 1, 0.3,
   * 1)`), the curve the app's dropdown lands on. A shelf that decelerates
   * into place looks set down; one that eases in and out looks animated.
   */
  easing: [0.16, 1, 0.3, 1] as const,
  /** How far into the screen a shelf's top has to come before it arrives. */
  inset: 40,
  /**
   * How often a shelf still waiting checks where it is when the page has not
   * moved — content above it can grow or shrink without a scroll — in frames.
   */
  everyFrames: 12,
} as const;

/**
 * Whether a shelf whose top is at `top` on the display (Reanimated's
 * `measure().pageY`) has come far enough into a viewport `viewport` high.
 */
export function shelfArrived(top: number, viewport: number, inset: number): boolean {
  'worklet';
  return top < viewport - inset;
}
