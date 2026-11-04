import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EXPLORE, featureCard } from './explore';

describe('the Severance card', () => {
  it('is most of the display, a little wider than tall, and the next one peeks in', () => {
    const card = featureCard(360);
    assert.equal(card.width, 310);
    assert.ok(card.width > card.height);
    assert.ok(card.step < 360 - 15);
    assert.equal(featureCard(1000).width, EXPLORE.cardMaxWidth);
  });
});
