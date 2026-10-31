import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { footFade, smoothScrimStops } from './scrim.ts';

describe('smoothScrimStops (artworkScrimBrush)', () => {
  it('runs from clear to opaque over 25 stops, eased at both ends', () => {
    const { locations, alphas } = smoothScrimStops();
    assert.equal(locations.length, 25);
    assert.equal(alphas[0], 0);
    assert.equal(alphas[24], 1);
    assert.equal(alphas[12], 0.5);
    /* Flat at the ends: the first and last steps move less than a straight line. */
    assert.ok(alphas[1] < 1 / 24);
    assert.ok(1 - alphas[23] < 1 / 24);
    for (let i = 1; i < alphas.length; i += 1) assert.ok(alphas[i] > alphas[i - 1]);
  });
});

describe('footFade', () => {
  it('is clear above the share it covers and the page at the foot', () => {
    const fade = footFade(0.7);
    assert.equal(fade.locations[0], 0);
    assert.equal(fade.alphas[0], 0);
    assert.ok(Math.abs(fade.locations[1] - 0.3) < 1e-9, 'starts 30% down');
    assert.equal(fade.alphas[fade.alphas.length - 1], 1);
    assert.equal(fade.locations[fade.locations.length - 1], 1);
  });
});
