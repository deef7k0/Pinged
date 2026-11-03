/**
 * The loader's frames: a sequence of shapes, morphed one into the next and
 * sampled as the same number of points every frame, so the drawing only ever
 * interpolates two arrays.
 *
 * reacticx's `MorphLoader` (`organisms/morph-loader`, MIT) builds the same
 * frames, but samples each morph through Skia (`Path.MakeFromSVGString` and a
 * contour measure). Here the cubics are sampled by arc length directly, so the
 * frames are pure — built without a canvas, and under `npm test`. The shapes
 * and the morph are reacticx's ports of Android's `graphics-shapes`
 * (`polygon.ts`, `morph.ts`, `material-shapes.ts`), copied unchanged.
 *
 * No imports from React Native: `npm test` loads it.
 */

import type { Cubic } from './cubic';
import { Morph } from './morph';
import { getShape, type ShapeName } from './shape-registry';

/** The drawing's coordinate box; reacticx's `VIEWBOX`. */
export const MORPH_VIEWBOX = 100;
/** Frames between one shape and the next (reacticx's `STEPS_PER_SEGMENT`). */
export const MORPH_STEPS = 18;
/** Points every frame is sampled to (reacticx's `POINTS_PER_FRAME`). */
export const MORPH_POINTS = 96;
/** Samples taken along each cubic to measure it. */
const SAMPLES_PER_CUBIC = 24;

export type MorphFrames = {
  /** `frameCount × MORPH_POINTS` points, x then y, in the 0–100 box. */
  readonly flat: number[];
  readonly frameCount: number;
};

/**
 * Material's emphasized curve, `cubic-bezier(0.2, 0, 0, 1)` — reacticx's
 * default — solved for x by Newton's method, then bisection.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const a = (p1: number, p2: number) => 1 - 3 * p2 + 3 * p1;
  const b = (p1: number, p2: number) => 3 * p2 - 6 * p1;
  const c = (p1: number) => 3 * p1;
  const at = (t: number, p1: number, p2: number) => ((a(p1, p2) * t + b(p1, p2)) * t + c(p1)) * t;
  const slope = (t: number, p1: number, p2: number) =>
    3 * a(p1, p2) * t * t + 2 * b(p1, p2) * t + c(p1);

  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const s = slope(t, x1, x2);
      if (Math.abs(s) < 1e-6) break;
      t -= (at(t, x1, x2) - x) / s;
    }
    if (t < 0 || t > 1 || Math.abs(at(t, x1, x2) - x) > 1e-5) {
      let lo = 0;
      let hi = 1;
      t = x;
      for (let i = 0; i < 40; i++) {
        const v = at(t, x1, x2);
        if (Math.abs(v - x) < 1e-7) break;
        if (v < x) lo = t;
        else hi = t;
        t = (lo + hi) / 2;
      }
    }
    return at(t, y1, y2);
  };
}

export const EMPHASIZED = cubicBezier(0.2, 0, 0, 1);

/** A closed run of cubics as `count` points equally spaced along its length. */
export function sampleOutline(cubics: readonly Cubic[], count: number, scale: number): number[] {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const cubic of cubics) {
    for (let i = 0; i < SAMPLES_PER_CUBIC; i++) {
      const p = cubic.pointOnCurve(i / SAMPLES_PER_CUBIC);
      xs.push(p.x * scale);
      ys.push(p.y * scale);
    }
  }
  const n = xs.length;
  if (n === 0) return new Array(count * 2).fill(scale / 2);

  /* Cumulative length round the closed outline. */
  const length = new Array<number>(n + 1);
  length[0] = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    length[i + 1] = length[i] + Math.hypot(xs[j] - xs[i], ys[j] - ys[i]);
  }
  const total = length[n] || 1;

  const out = new Array<number>(count * 2);
  let seg = 0;
  for (let k = 0; k < count; k++) {
    const target = (k / count) * total;
    while (seg < n - 1 && length[seg + 1] < target) seg++;
    const span = length[seg + 1] - length[seg] || 1;
    const t = (target - length[seg]) / span;
    const j = (seg + 1) % n;
    out[k * 2] = xs[seg] + (xs[j] - xs[seg]) * t;
    out[k * 2 + 1] = ys[seg] + (ys[j] - ys[seg]) * t;
  }
  return out;
}

/** Rotates a point list so its first point is the one straight above its centre (reacticx's `reAnchorToTop`). */
export function anchorToTop(points: number[], count: number): number[] {
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < count; i++) {
    cx += points[i * 2];
    cy += points[i * 2 + 1];
  }
  cx /= count;
  cy /= count;
  const top = -Math.PI / 2;
  let best = 0;
  let bestDelta = Infinity;
  for (let i = 0; i < count; i++) {
    let delta = Math.abs(Math.atan2(points[i * 2 + 1] - cy, points[i * 2] - cx) - top);
    if (delta > Math.PI) delta = 2 * Math.PI - delta;
    if (delta < bestDelta) {
      bestDelta = delta;
      best = i;
    }
  }
  if (best === 0) return points;
  const out = new Array<number>(count * 2);
  for (let i = 0; i < count; i++) {
    const j = (best + i) % count;
    out[i * 2] = points[j * 2];
    out[i * 2 + 1] = points[j * 2 + 1];
  }
  return out;
}

/** Every frame of a loop through `sequence`, the last shape morphing back to the first. */
export function buildMorphFrames(
  sequence: readonly ShapeName[],
  easing: (t: number) => number = EMPHASIZED
): MorphFrames {
  const n = sequence.length;
  if (n < 2) throw new Error('A morph needs at least two shapes');
  const frameCount = n * MORPH_STEPS;
  const flat = new Array<number>(frameCount * MORPH_POINTS * 2);
  let frame = 0;
  for (let s = 0; s < n; s++) {
    const morph = new Morph(getShape(sequence[s]), getShape(sequence[(s + 1) % n]));
    for (let step = 0; step < MORPH_STEPS; step++) {
      const points = anchorToTop(
        sampleOutline(morph.asCubics(easing(step / MORPH_STEPS)), MORPH_POINTS, MORPH_VIEWBOX),
        MORPH_POINTS
      );
      const base = frame * MORPH_POINTS * 2;
      for (let i = 0; i < points.length; i++) flat[base + i] = points[i];
      frame++;
    }
  }
  return { flat, frameCount };
}
