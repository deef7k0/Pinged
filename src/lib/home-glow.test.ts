import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { hexToRgb } from './color.ts';
import {
  GLOW_ANGLE,
  GLOW_THEME_FACTOR,
  GLOW_OVERFLOW,
  GLOW_SCRIM_SHARE,
  GLOW_STEPS,
  angledGradient,
  easedStops,
  glowTone,
  rgbFactor,
} from './home-glow.ts';

describe('the reference’s numbers', () => {
  it('is SimpMusic’s Home glow — 25°, 140dp past the first item, a 60% scrim — at AmbientThemeGlow’s × 0.45', () => {
    assert.equal(GLOW_ANGLE, 25);
    assert.equal(GLOW_OVERFLOW, 140);
    assert.equal(GLOW_SCRIM_SHARE, 0.6);
    assert.equal(GLOW_THEME_FACTOR, 0.45);
    assert.equal(GLOW_STEPS, 24);
  });
});

describe('rgbFactor', () => {
  it('scales each channel in sRGB, as Color.rgbFactor does', () => {
    assert.equal(rgbFactor('#C86432', 0.3), '#3C1E0F');
    assert.equal(rgbFactor('#FFFFFF', 0.3), '#4D4D4D');
    assert.equal(rgbFactor('#000000', 0.3), '#000000');
  });

  it('leaves a value it cannot read alone', () => {
    assert.equal(rgbFactor('red', 0.3), 'red');
  });
});

describe('angledGradient', () => {
  /** Compose's own construction, restated: the end points in dp. */
  function composeEnds(width: number, height: number, degrees: number) {
    const ends = angledGradient(width, height, degrees)!;
    return {
      start: { x: ends.start.x * width, y: ends.start.y * height },
      end: { x: ends.end.x * width, y: ends.end.y * height },
    };
  }

  it('runs edge to edge on a tall box at 25°: L = w / cos α through the centre', () => {
    /* A phone's first item and its overflow: 360 × 560. */
    const { start, end } = composeEnds(360, 560, 25);
    assert.ok(Math.abs(start.x) < 1e-9, 'starts on the left edge');
    assert.ok(Math.abs(end.x - 360) < 1e-9, 'ends on the right edge');
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    assert.ok(Math.abs(length - 360 / Math.cos((25 * Math.PI) / 180)) < 1e-9);
    assert.ok(start.y < 280 && end.y > 280, 'falls from upper left to lower right');
    assert.ok(Math.abs((start.y + end.y) / 2 - 280) < 1e-9, 'through the centre');
  });

  it('uses the height once the angle is steeper than the diagonal', () => {
    /* A wide, short box: 25° is steeper than its diagonal (atan(100/600) ≈ 9.5°). */
    const { start, end } = composeEnds(600, 100, 25);
    assert.ok(Math.abs(start.y) < 1e-9, 'starts on the top edge');
    assert.ok(Math.abs(end.y - 100) < 1e-9, 'ends on the bottom edge');
  });

  it('keeps the angle it was given', () => {
    const { start, end } = composeEnds(360, 560, 25);
    const angle = (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;
    assert.ok(Math.abs(angle - 25) < 1e-9);
  });

  it('draws nothing for a box with no area', () => {
    assert.equal(angledGradient(0, 560), null);
    assert.equal(angledGradient(360, 0), null);
  });
});

describe('easedStops', () => {
  const { colors, locations } = easedStops('#3C1E0F', '#14171C');

  it('is the tone at one end and the page at the other', () => {
    assert.equal(colors[0].toUpperCase(), '#3C1E0F');
    assert.equal(colors.at(-1)!.toUpperCase(), '#14171C');
    assert.equal(colors.length, GLOW_STEPS + 1);
    assert.deepEqual([locations[0], locations.at(-1)], [0, 1]);
  });

  it('is flat at both ends — smoothstep — where a straight ramp has a corner', () => {
    const red = colors.map((color) => hexToRgb(color)!.r);
    const firstStep = Math.abs(red[1] - red[0]);
    const middleStep = Math.abs(red[13] - red[12]);
    const lastStep = Math.abs(red.at(-1)! - red.at(-2)!);
    assert.ok(firstStep < middleStep, `first ${firstStep} < middle ${middleStep}`);
    assert.ok(lastStep < middleStep, `last ${lastStep} < middle ${middleStep}`);
  });

  it('only ever moves one way', () => {
    const red = colors.map((color) => hexToRgb(color)!.r);
    for (let i = 1; i < red.length; i += 1) assert.ok(red[i] <= red[i - 1]);
  });
});

describe('glowTone', () => {
  it('is the first game’s Material 3 primary at 0.45 while game colours are on', () => {
    assert.equal(
      glowTone('#C86432', { gameColours: true, primary: '#0070CC' }),
      rgbFactor('#C86432', 0.45)
    );
  });

  it('is no glow at all while the colour is unknown — not a stand-in', () => {
    assert.equal(glowTone(null, { gameColours: true, primary: '#0070CC' }), null);
  });

  it('is the house primary at 0.45 with game colours off, whatever the art', () => {
    const tone = glowTone('#C86432', { gameColours: false, primary: '#0070CC' });
    assert.equal(tone, rgbFactor('#0070CC', 0.45));
  });
});
