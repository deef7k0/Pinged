import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DISCOVER, discoverGeometry } from './discover-carousel';

describe('discover carousel (BitChord’s lead shelf)', () => {
  it('is seventy per cent of a 360dp phone, a touch taller than wide', () => {
    const g = discoverGeometry(360);
    assert.equal(g.width, 252);
    assert.equal(g.height, 274);
    assert.ok(g.height > g.width);
  });

  it('never makes a card wider than 320', () => {
    assert.equal(discoverGeometry(800).width, 320);
    assert.equal(discoverGeometry(800).height, Math.round(320 / 0.92));
  });

  it('steps a card and its 14dp gap at a time', () => {
    const g = discoverGeometry(392);
    assert.equal(g.step, g.width + 14);
  });

  it('leaves the next card in view past the first', () => {
    const margin = 15;
    const g = discoverGeometry(360);
    const nextStarts = margin + g.width + DISCOVER.gap;
    assert.ok(nextStarts < 360 - 40, 'at least 40dp of the next card shows');
  });

  it('keeps BitChord’s card: 18 round, a 15% white edge, a 0.78 scrim', () => {
    assert.equal(DISCOVER.radius, 18);
    assert.equal(DISCOVER.edgeAlpha, 0.15);
    assert.equal(DISCOVER.scrimAlpha, 0.78);
  });
});
