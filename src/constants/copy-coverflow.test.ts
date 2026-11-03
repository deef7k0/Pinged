import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  COVERFLOW_ANGLE,
  COVERFLOW_PERSPECTIVE,
  coverflowLayout,
  coverflowPose,
  coverflowSnap,
  easeOutPower,
  flightTo,
} from './copy-coverflow';

const DEG = Math.PI / 180;

/** How far from the middle a turned cover's outer edge lands, under the perspective. */
function outerEdge(distance: number, width: number) {
  const g = coverflowLayout(width);
  const pose = coverflowPose(distance, g.centerPush, g.stackSpacing);
  const half = (g.card / 2) * pose.scale;
  const theta = Math.abs(pose.rotateY) * DEG;
  /* A side cover faces the middle: its outer edge is the one turned away, and
     recedes. */
  const far =
    half *
    Math.cos(theta) *
    (COVERFLOW_PERSPECTIVE / (COVERFLOW_PERSPECTIVE + half * Math.sin(theta)));
  return Math.abs(pose.translateX) + far;
}

describe('physical shelf as Cover Flow', () => {
  it('draws a box at 58% of a 360dp phone, at 2:3', () => {
    const g = coverflowLayout(360);
    assert.equal(g.card, 209);
    assert.equal(g.cardHeight, Math.round(209 * 1.5));
  });

  it('is bigger than the reference’s square card at the same width', () => {
    assert.ok(coverflowLayout(393).card > 393 * 0.5);
  });

  it('never makes a box wider than 300', () => {
    assert.equal(coverflowLayout(1024).card, 300);
  });

  it('puts the centre cover square on, at full size', () => {
    const pose = coverflowPose(0, 100, 20);
    assert.equal(pose.translateX, 0);
    assert.equal(Math.abs(pose.rotateY), 0);
    assert.equal(pose.scale, 1);
    assert.equal(pose.opacity, 1);
  });

  it('turns a neighbour the reference’s 64° away, the right one to the left', () => {
    assert.equal(coverflowPose(1, 100, 20).rotateY, -COVERFLOW_ANGLE);
    assert.equal(coverflowPose(-1, 100, 20).rotateY, COVERFLOW_ANGLE);
  });

  it('shows exactly one cover at each side, and none past it', () => {
    assert.equal(coverflowPose(1, 100, 20).opacity, 1);
    assert.equal(coverflowPose(-1, 100, 20).opacity, 1);
    assert.equal(coverflowPose(1.5, 100, 20).opacity, 0);
    assert.equal(coverflowPose(2, 100, 20).opacity, 0);
    assert.ok(coverflowPose(1.25, 100, 20).opacity > 0);
  });

  it('keeps a neighbour on the display, its edge near the display’s', () => {
    for (const width of [320, 360, 393, 430]) {
      const edge = outerEdge(1, width);
      assert.ok(edge <= width / 2 + 4, `${width}: ${edge.toFixed(1)}`);
      assert.ok(edge >= width / 2 - 40, `${width}: ${edge.toFixed(1)}`);
    }
  });

  it('eases the centre cover out on the reference’s curve', () => {
    assert.equal(easeOutPower(0, 1.29), 0);
    assert.equal(easeOutPower(1, 1.29), 1);
    assert.equal(easeOutPower(-1, 1.29), -1);
    assert.ok(easeOutPower(0.5, 1.29) > 0.5);
  });

  it('draws nearer covers over further ones', () => {
    assert.ok(coverflowPose(0, 1, 1).zIndex > coverflowPose(1, 1, 1).zIndex);
    assert.ok(coverflowPose(0.4, 1, 1).zIndex > coverflowPose(-0.9, 1, 1).zIndex);
  });

  it('snaps a flick to a cover, within the shelf', () => {
    assert.equal(coverflowSnap(2.2, 0, 100, 9), 2);
    assert.equal(coverflowSnap(2.2, -1000, 100, 9), 5);
    assert.equal(coverflowSnap(0.2, 5000, 100, 9), 0);
    assert.equal(coverflowSnap(8.9, -5000, 100, 9), 9);
  });

  it('flies a cover centre to centre and scales it to the target', () => {
    const f = flightTo(
      { x: 0, y: 100, width: 200, height: 300 },
      { x: 50, y: 40, width: 100, height: 160 }
    );
    assert.equal(f.dx, 0);
    assert.equal(f.dy, 40 + 80 - 250);
    assert.equal(f.sx, 0.5);
    assert.ok(Math.abs(f.sy - 160 / 300) < 1e-9);
  });
});
