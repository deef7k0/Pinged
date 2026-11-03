/**
 * The app's mascot as the loader draws him: a blob with two rounded-rectangle
 * eyes, who turns into plain shapes and back while something loads — the
 * owner's (2026-11-02), on reacticx's morph loader.
 *
 * Pure, so `npm test` holds the sequence and the eyes.
 */

import { buildMorphFrames, type MorphFrames } from './frames';
import type { ShapeName } from './shape-registry';

/**
 * He starts as himself — Material's `ghostish`, a round top over a soft wavy
 * foot — and becomes the basic shapes in turn, then himself again.
 */
export const MASCOT_SEQUENCE: readonly ShapeName[] = [
  'ghostish',
  'circle',
  'square',
  'triangle',
  'diamond',
  'pentagon',
  'pill',
];

/**
 * His eyes, in the 0–100 box: two upright rounded rectangles a little above
 * the middle, drawn over every shape. They never turn with the body.
 */
export const MASCOT_EYES = {
  width: 10,
  height: 17,
  radius: 5,
  /** The two centres' distance from the middle, left and right. */
  apart: 9.5,
  /** The centres' height. */
  y: 44,
  /** A blink closes them to this share of their height. */
  blinkTo: 0.12,
} as const;

/**
 * How long one shape takes to become the next, and how long he holds as
 * himself before he starts again (ms).
 */
export const MASCOT_TIMING = { morph: 650, rest: 900 } as const;

let cached: MorphFrames | null = null;

/** Every frame of his loop, built once. */
export function mascotFrames(): MorphFrames {
  if (!cached) cached = buildMorphFrames(MASCOT_SEQUENCE);
  return cached;
}

export type MascotPose = {
  /** Where in the frames he is: a frame index with a fraction. */
  phase: number;
  /** The body's turn, degrees. */
  turn: number;
  /** How open the eyes are, 1 open. */
  eyes: number;
};

/**
 * His pose `ms` into the loop. Each loop he rests as himself for
 * `MASCOT_TIMING.rest` — blinking once halfway through — then morphs through
 * the shapes, turning one full circle as he goes, so he is upright whenever
 * he is a blob. `frameCount` and `steps` are the frames' own counts.
 */
export function mascotPose(
  ms: number,
  frameCount: number,
  steps: number,
  shapes: number
): MascotPose {
  'worklet';
  const morphing = shapes * MASCOT_TIMING.morph;
  const loop = MASCOT_TIMING.rest + morphing;
  const t = ((ms % loop) + loop) % loop;
  if (t < MASCOT_TIMING.rest) {
    const blink = Math.abs(t - MASCOT_TIMING.rest / 2) / 70;
    const eyes = blink >= 1 ? 1 : MASCOT_EYES.blinkTo + (1 - MASCOT_EYES.blinkTo) * blink;
    return { phase: 0, turn: 0, eyes };
  }
  const into = t - MASCOT_TIMING.rest;
  const phase = Math.min(frameCount - 1e-6, (into / MASCOT_TIMING.morph) * steps);
  return { phase, turn: (into / morphing) * 360, eyes: 1 };
}
