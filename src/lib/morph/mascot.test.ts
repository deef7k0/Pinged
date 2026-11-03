import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EMPHASIZED, MORPH_POINTS, MORPH_STEPS, MORPH_VIEWBOX, sampleOutline } from './frames';
import { MASCOT_EYES, MASCOT_SEQUENCE, MASCOT_TIMING, mascotFrames, mascotPose } from './mascot';
import { getShape } from './shape-registry';

function frame(index: number): number[] {
  const { flat } = mascotFrames();
  return flat.slice(index * MORPH_POINTS * 2, (index + 1) * MORPH_POINTS * 2);
}

/** Even–odd ray cast. */
function inside(points: number[], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = MORPH_POINTS - 1; i < MORPH_POINTS; j = i++) {
    const [xi, yi, xj, yj] = [points[i * 2], points[i * 2 + 1], points[j * 2], points[j * 2 + 1]];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

describe('the mascot’s frames', () => {
  it('has a frame for every step of every shape, and every point is in the box', () => {
    const { flat, frameCount } = mascotFrames();
    assert.equal(frameCount, MASCOT_SEQUENCE.length * MORPH_STEPS);
    assert.equal(flat.length, frameCount * MORPH_POINTS * 2);
    for (const v of flat) {
      assert.ok(Number.isFinite(v) && v >= -0.5 && v <= MORPH_VIEWBOX + 0.5, `point ${v}`);
    }
  });

  it('starts as himself: the first frame is the blob', () => {
    const blob = sampleOutline(getShape('ghostish').cubics, MORPH_POINTS, MORPH_VIEWBOX);
    const first = frame(0);
    const centre = (pts: number[]) => {
      let x = 0;
      let y = 0;
      for (let i = 0; i < MORPH_POINTS; i++) {
        x += pts[i * 2];
        y += pts[i * 2 + 1];
      }
      return [x / MORPH_POINTS, y / MORPH_POINTS];
    };
    const [ax, ay] = centre(blob);
    const [bx, by] = centre(first);
    assert.ok(Math.abs(ax - bx) < 1 && Math.abs(ay - by) < 1);
  });

  it('keeps both eyes inside every shape he becomes', () => {
    for (let s = 0; s < MASCOT_SEQUENCE.length; s++) {
      const pts = frame(s * MORPH_STEPS);
      for (const side of [-1, 1]) {
        const cx = 50 + side * MASCOT_EYES.apart;
        for (const [dx, dy] of [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ]) {
          const x = cx + (dx * MASCOT_EYES.width) / 2;
          const y = MASCOT_EYES.y + (dy * MASCOT_EYES.height) / 2;
          assert.ok(inside(pts, x, y), `${MASCOT_SEQUENCE[s]}: eye corner ${x}, ${y}`);
        }
      }
    }
  });
});

describe('the mascot’s pose', () => {
  const { frameCount } = mascotFrames();
  const pose = (ms: number) => mascotPose(ms, frameCount, MORPH_STEPS, MASCOT_SEQUENCE.length);

  it('rests as himself, upright, at the start of each loop', () => {
    assert.deepEqual(pose(0), { phase: 0, turn: 0, eyes: 1 });
  });

  it('blinks once while he rests', () => {
    assert.ok(pose(MASCOT_TIMING.rest / 2).eyes <= MASCOT_EYES.blinkTo + 1e-9);
    assert.equal(pose(MASCOT_TIMING.rest / 2 + 200).eyes, 1);
  });

  it('turns one full circle while he morphs, and is himself again after it', () => {
    const loop = MASCOT_TIMING.rest + MASCOT_SEQUENCE.length * MASCOT_TIMING.morph;
    const late = pose(loop - 1);
    assert.ok(late.turn > 359 && late.turn < 360);
    assert.ok(late.phase > frameCount - 1);
    assert.deepEqual(pose(loop), pose(0));
  });

  it('eases each morph on Material’s emphasized curve', () => {
    assert.equal(EMPHASIZED(0), 0);
    assert.equal(EMPHASIZED(1), 1);
    assert.ok(EMPHASIZED(0.25) > 0.6, 'emphasized is fast early');
  });
});
