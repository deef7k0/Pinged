/**
 * How the app answers a finger — Convx's (`cosmictaserdev-creator/Convx`),
 * read from its source at the owner's direction (2026-10-31): "Look at how
 * Convx animates their icons and buttons in the app. On tap there is always
 * responsiveness and even the icons have animations. Replicate something
 * similar for gamelog across the app."
 *
 * Read from `ui/utils/ModifierExt.kt` (`bounceClick`, `pressWobble`),
 * `ui/player/Player_v2.kt` (`playGlyphPress`, `skipGlyphPress`, `likePop`,
 * `transportPressDisc`) and `backdrop/catalog/utils/InteractiveHighlight.kt`
 * (the glass controls' sheen). Five things, each a number here:
 *
 *  1. **Everything pressable sinks and springs back past where it was**
 *     (`bounceClick`, on 110 of Convx's controls): Compose's
 *     `DampingRatioMediumBouncy` (0.5) at `StiffnessMediumLow` (400), both
 *     ways — so it answers the instant a finger lands, and lands with a
 *     small overshoot when it lifts. `<PressableScale>`, which every control
 *     here is built on.
 *  2. **An icon wobbles** (`pressWobble`, on its navigation icons): the glyph
 *     shrinks to 0.86 and comes back on a very loose spring (0.38 at 1500).
 *     `<PressGlyph>`.
 *  3. **A state that turns on or off pops** (`likePop`, Apple Music's
 *     favourite, keyframed off a 60fps capture): 0.88 → 1.08 in 100ms, swells
 *     to 1.56 by 283, holds to 517, settles by 700 — and the glyph blinks out
 *     and back in its first 110ms, which is what hides the outline turning
 *     into the filled one. Played when somebody presses it, never when data
 *     arrives.
 *  4. **Play and skip are not wobbled, they act**: play shrinks toward 0.2
 *     while held and springs back (0.6 at 420); skip dips to 0.88 and, let go,
 *     steps 8dp the way it skips and back (340ms).
 *  5. **Glass lights where it is touched**: a white wash at 8% and a soft spot
 *     at 15% under the finger, 1.5× the control's size, in on a 0.5 / 300
 *     spring.
 *
 * Pure, nothing imported: `npm test` holds the springs to Convx's ratios.
 * React Native's springs are physical, so each Compose spring — a damping
 * *ratio* at a stiffness — is turned into the damping that gives that ratio
 * (`damping`).
 */

/** Reanimated's physical damping for a Compose spring: `2ζ√(k·m)`. */
export function damping(ratio: number, stiffness: number, mass: number): number {
  return 2 * ratio * Math.sqrt(stiffness * mass);
}

type Spring = { mass: number; stiffness: number; damping: number };
const spring = (ratio: number, stiffness: number): Spring => ({
  mass: 1,
  stiffness,
  damping: damping(ratio, stiffness, 1),
});

export const PRESS_MOTION = {
  /** `bounceClick`: in and out, overshooting a little on the way back. */
  press: spring(0.5, 400),
  /** `pressWobble`: the glyph while held. */
  wobble: { scale: 0.86, ...spring(0.38, 1500) },
  /** `likePop`'s scale, as [scale, at ms] — and the blink as [opacity, at ms]. */
  pop: {
    scale: [
      [0.88, 0],
      [1.08, 100],
      [1.56, 283],
      [1.56, 517],
      [1, 700],
    ] as const,
    blink: [
      [1, 0],
      [0.08, 60],
      [1, 110],
    ] as const,
    /** A change of state counts as somebody's only this soon after their press. */
    window: 1500,
  },
  /** `playGlyphPress`. */
  play: { scale: 0.2, inMs: 220, ...spring(0.6, 420) },
  /** `skipGlyphPress`. */
  skip: { scale: 0.88, ...spring(1, 900), nudge: 8, peakMs: 130, ms: 340 },
  /** `InteractiveHighlight`. */
  sheen: { wash: 0.08, spot: 0.15, radius: 1.5, ...spring(0.5, 300) },
} as const;

/** The pop's keyframes as Reanimated `withTiming` steps: each target and how long it takes to reach. */
export function keyframeSteps(
  frames: readonly (readonly [number, number])[]
): { to: number; ms: number }[] {
  return frames.slice(1).map(([to, at], i) => ({ to, ms: at - frames[i][1] }));
}
