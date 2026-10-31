import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  HISTORY_LIMIT,
  appendHistory,
  eligibleSeeds,
  hashString,
  orderSeeds,
  pickRecommendations,
  seedWeight,
  seededRandom,
} from './recommend-rules.ts';

type Game = { id: string };
const games = (prefix: string, n: number): Game[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}` }));

const logs = [
  { game_id: 'g:a', rating: 95, game: { title: 'A' } },
  { game_id: 'g:b', rating: 40, game: { title: 'B' } },
  { game_id: 'g:c', rating: null, game: { title: 'C' } },
  { game_id: 'g:d', rating: 70, game: { title: 'D' } },
  { game_id: 'g:e', rating: 60, game: null },
];

describe('seeds', () => {
  it('leaves out logs scored under 60, keeps unrated ones', () => {
    assert.deepEqual(
      eligibleSeeds(logs).map((seed) => seed.gameId),
      ['g:a', 'g:c', 'g:d', 'g:e']
    );
    assert.equal(eligibleSeeds(logs)[3].title, 'a game you played');
  });

  it('weighs a better score more, an unrated log as a 60', () => {
    assert.equal(seedWeight(null), seedWeight(60));
    assert.ok(seedWeight(100) > seedWeight(90));
    assert.ok(seedWeight(90) > seedWeight(70));
    assert.equal(seedWeight(100) / seedWeight(60), 13);
  });

  it('without a generator, is the old order: rated first, highest first', () => {
    assert.deepEqual(
      orderSeeds(eligibleSeeds(logs)).map((seed) => seed.gameId),
      ['g:a', 'g:d', 'g:e', 'g:c']
    );
  });

  it('with one, every seed gets turns and the favourite most', () => {
    const seeds = eligibleSeeds(logs);
    const firsts = new Map<string, number>();
    for (let round = 0; round < 2000; round += 1) {
      const first = orderSeeds(seeds, seededRandom(hashString(`u:${round}`)))[0].gameId;
      firsts.set(first, (firsts.get(first) ?? 0) + 1);
    }
    for (const seed of seeds) assert.ok((firsts.get(seed.gameId) ?? 0) > 0, seed.gameId);
    const top = [...firsts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    assert.equal(top, 'g:a');
  });

  it('draws the same order for the same round', () => {
    const seeds = eligibleSeeds(logs);
    const once = orderSeeds(seeds, seededRandom(hashString('u:7')));
    const again = orderSeeds(seeds, seededRandom(hashString('u:7')));
    assert.deepEqual(once, again);
  });
});

describe('pickRecommendations', () => {
  const seeds = eligibleSeeds(logs).slice(0, 2);

  it('interleaves seeds, and skips logged games and duplicates', () => {
    const picked = pickRecommendations(
      [
        [{ id: 'x1' }, { id: 'g:d' }, { id: 'x2' }],
        [{ id: 'y1' }, { id: 'x1' }, { id: 'y2' }],
      ],
      seeds,
      { known: new Set(['g:d']), limit: 10 }
    );
    assert.deepEqual(
      picked.games.map((game) => game.id),
      ['x1', 'y1', 'x2', 'y2']
    );
    assert.equal(picked.because.y1, 'C');
    assert.equal(picked.because.x1, 'A');
  });

  it('puts what was shown last, the longest-unseen first', () => {
    const picked = pickRecommendations([games('a', 4), games('b', 4)], seeds, {
      known: new Set(),
      limit: 6,
      recent: ['b0', 'a0', 'a1', 'b1'],
    });
    const ids = picked.games.map((game) => game.id);
    assert.deepEqual(ids.slice(0, 4), ['a2', 'b2', 'a3', 'b3']);
    assert.deepEqual(ids.slice(4), ['b0', 'a0']);
    assert.equal(picked.fresh, 4);
  });

  it('never repeats a game across rounds while unseen ones last', () => {
    const results = [games('a', 10), games('b', 10), games('c', 10)];
    const three = eligibleSeeds(logs).slice(0, 3);
    let history: string[] = [];
    const shown = new Set<string>();
    for (let round = 0; round < 2; round += 1) {
      const picked = pickRecommendations(results, three, {
        known: new Set(),
        limit: 12,
        recent: history,
        random: seededRandom(hashString(`u:${round}`)),
      });
      for (const game of picked.games) {
        assert.ok(!shown.has(game.id), `${game.id} repeated in round ${round}`);
        shown.add(game.id);
      }
      history = appendHistory(
        history,
        picked.games.map((game) => game.id)
      );
    }
    assert.equal(shown.size, 24);
  });

  it('fills the band with repeats rather than shrinking it', () => {
    const picked = pickRecommendations([games('a', 5)], seeds, {
      known: new Set(),
      limit: 5,
      recent: ['a0', 'a1', 'a2', 'a3', 'a4'],
    });
    assert.equal(picked.games.length, 5);
    assert.equal(picked.fresh, 0);
  });
});

describe('appendHistory', () => {
  it('moves a game shown again to the end, and keeps the newest', () => {
    assert.deepEqual(appendHistory(['a', 'b', 'c'], ['b', 'd']), ['a', 'c', 'b', 'd']);
    const long = Array.from({ length: HISTORY_LIMIT }, (_, i) => `g${i}`);
    const next = appendHistory(long, ['new']);
    assert.equal(next.length, HISTORY_LIMIT);
    assert.equal(next[0], 'g1');
    assert.equal(next.at(-1), 'new');
  });
});
