import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SPOTLIGHT, nextCard, parallaxArtWidth, parallaxShift } from './search-spotlight';

const WIDTH = 252;
const STEP = WIDTH + 14;

describe('the spotlight’s parallax', () => {
  it('holds the art still on the card at rest', () => {
    assert.equal(parallaxShift(2 * STEP, 2, STEP, WIDTH), 0);
  });

  it('moves the art a parallax’s share of the card over one card of scroll, lagging', () => {
    assert.equal(parallaxShift(3 * STEP, 2, STEP, WIDTH), WIDTH * SPOTLIGHT.parallax);
    assert.equal(parallaxShift(1 * STEP, 2, STEP, WIDTH), -WIDTH * SPOTLIGHT.parallax);
  });

  it('clamps past one card either side, as reacticx does', () => {
    assert.equal(parallaxShift(9 * STEP, 2, STEP, WIDTH), WIDTH * SPOTLIGHT.parallax);
    assert.equal(parallaxShift(-9 * STEP, 2, STEP, WIDTH), -WIDTH * SPOTLIGHT.parallax);
  });

  it('always covers the card: the art reaches past both edges at every offset', () => {
    const art = parallaxArtWidth(WIDTH);
    const left = -(art - WIDTH) / 2;
    for (let scroll = 0; scroll <= 4 * STEP; scroll += 7) {
      for (let index = 0; index < 4; index++) {
        const shift = parallaxShift(scroll, index, STEP, WIDTH);
        assert.ok(left + shift <= 0.5, `left edge inside the card at ${scroll}, ${index}`);
        assert.ok(left + shift + art >= WIDTH - 0.5, `right edge inside the card at ${scroll}`);
      }
    }
  });
});

describe('the spotlight moving by itself', () => {
  it('goes to the next card, and back to the first after the last', () => {
    assert.equal(nextCard(0, 4), 1);
    assert.equal(nextCard(3, 4), 0);
    assert.equal(nextCard(0, 1), 0);
  });
});
