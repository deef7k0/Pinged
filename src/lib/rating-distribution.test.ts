import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DISTRIBUTION_BANDS,
  barShare,
  distributionOf,
  shownBands,
  toneScore,
} from './rating-distribution.ts';

describe('the bands', () => {
  it('are the reference’s eleven rows, 100 at the top and 0–9 at the foot', () => {
    assert.deepEqual(
      DISTRIBUTION_BANDS.map((band) => band.label),
      [
        '100',
        '90–99',
        '80–89',
        '70–79',
        '60–69',
        '50–59',
        '40–49',
        '30–39',
        '20–29',
        '10–19',
        '0–9',
      ]
    );
  });

  it('cover every score once', () => {
    for (let score = 0; score <= 100; score += 1) {
      const holding = DISTRIBUTION_BANDS.filter((band) => score >= band.from && score <= band.to);
      assert.equal(holding.length, 1, `${score}`);
    }
  });

  it('are coloured by the score in their middle', () => {
    assert.deepEqual(
      DISTRIBUTION_BANDS.map(toneScore),
      [100, 95, 85, 75, 65, 55, 45, 35, 25, 15, 5]
    );
  });
});

describe('distributionOf', () => {
  it('counts each score in its row, a 100 apart from the 90s', () => {
    const counts = distributionOf([100, 99, 90, 89.6, 72, 0, 9]);
    assert.equal(counts[0], 1);
    assert.equal(counts[1], 3, '99, 90, and 89.6 rounded');
    assert.equal(counts[3], 1);
    assert.equal(counts[10], 2);
    assert.equal(
      counts.reduce((sum, n) => sum + n, 0),
      7
    );
  });

  it('holds a stray score to the scale and skips what is not one', () => {
    assert.deepEqual(distributionOf([140, -3, Number.NaN]), [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
  });
});

describe('barShare', () => {
  it('measures a row against the longest', () => {
    assert.equal(barShare(251, [50, 251, 146]), 1);
    assert.equal(barShare(0, [0, 0]), 0);
    assert.ok(Math.abs(barShare(50, [50, 251]) - 50 / 251) < 1e-12);
  });
});

describe('shownBands', () => {
  it('draws only the rows that hold a score, highest first', () => {
    const rows = shownBands(distributionOf([100, 95, 95, 41]));
    assert.deepEqual(
      rows.map((row) => [row.band.label, row.count]),
      [
        ['100', 1],
        ['90–99', 2],
        ['40–49', 1],
      ]
    );
  });

  it('draws nothing for no scores', () => {
    assert.deepEqual(shownBands(distributionOf([])), []);
  });
});
