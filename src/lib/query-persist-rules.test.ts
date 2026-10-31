import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CACHE_VERSION,
  MAX_AGE_MS,
  MAX_ROW_CHARS,
  decodeRow,
  encodeRow,
  isPlainJson,
  pickEvictions,
  shouldPersistKey,
  type RowInfo,
} from './query-persist-rules.ts';

const NOW = 1_800_000_000_000;

describe('shouldPersistKey', () => {
  it('keeps what a screen paints from', () => {
    assert.equal(shouldPersistKey(['feed']), true);
    assert.equal(shouldPersistKey(['game', 'igdb:1942']), true);
    assert.equal(shouldPersistKey(['user-logs', 'abc']), true);
    assert.equal(shouldPersistKey(['news', 'articles']), true);
    assert.equal(shouldPersistKey(['discover', 'collections']), true);
  });

  it('never keeps the answer to something typed', () => {
    assert.equal(shouldPersistKey(['search', 'games', 'eld']), false);
    assert.equal(shouldPersistKey(['award-search', 'hades']), false);
    assert.equal(shouldPersistKey(['barcode', '00711719541028']), false);
  });

  it('never keeps a second copy of a store the device already has', () => {
    assert.equal(shouldPersistKey(['search-history', 'abc']), false);
    assert.equal(shouldPersistKey(['log-draft', 'abc', 'igdb:1']), false);
    assert.equal(shouldPersistKey(['album-art-color', 'https://x/y.jpg']), false);
    assert.equal(shouldPersistKey(['game-colours', 'abc']), false);
    assert.equal(shouldPersistKey(['animated-artwork', 'abc']), false);
    assert.equal(shouldPersistKey(['copy-stage-3d', 'abc']), false);
  });

  it('never keeps what SoundCloud sent, which its terms forbid storing', () => {
    assert.equal(shouldPersistKey(['soundtrack', 'igdb:113112']), false);
    assert.equal(shouldPersistKey(['soundcloud-track', 'soundcloud:tracks:1']), false);
    assert.equal(shouldPersistKey(['surprise-soundtrack', 'igdb:113112', 0]), false);
    /* The star itself is this app's: an id and the game it came from. */
    assert.equal(shouldPersistKey(['starred-song', 'abc']), true);
  });

  it('never keeps anything of Surprise Me — a restored deal is not a surprise', () => {
    assert.equal(shouldPersistKey(['surprise-batch', 'abc', 'popular']), false);
    assert.equal(shouldPersistKey(['surprise-hidden', 'abc']), false);
    assert.equal(shouldPersistKey(['surprise-review', 'igdb:1', 'abc']), false);
  });

  it('never keeps anything of onboarding, which happens once', () => {
    assert.equal(shouldPersistKey(['onboarding-grid']), false);
    assert.equal(shouldPersistKey(['onboarding-picks', 'abc']), false);
  });

  it('refuses a key with no name to judge it by', () => {
    assert.equal(shouldPersistKey([]), false);
    assert.equal(shouldPersistKey([42]), false);
    assert.equal(shouldPersistKey(['']), false);
  });
});

describe('isPlainJson', () => {
  it('accepts what JSON gives back unchanged', () => {
    assert.equal(isPlainJson(null), true);
    assert.equal(isPlainJson([]), true);
    assert.equal(isPlainJson({ a: 1, b: 'two', c: [true, null, { d: 0.5 }] }), true);
    assert.equal(isPlainJson(Object.create(null)), true);
  });

  it('accepts a missing property, which is missing again on the way back', () => {
    assert.equal(isPlainJson({ a: undefined, b: 1 }), true);
  });

  it('refuses what would come back as something else', () => {
    assert.equal(isPlainJson({ at: new Date(NOW) }), false);
    assert.equal(isPlainJson({ ids: new Set([1]) }), false);
    assert.equal(isPlainJson(new Map()), false);
    assert.equal(isPlainJson({ score: Number.NaN }), false);
    assert.equal(isPlainJson({ score: Infinity }), false);
    assert.equal(isPlainJson([1, undefined, 3]), false);
    assert.equal(isPlainJson({ run: () => 1 }), false);
    assert.equal(isPlainJson({ big: 10n }), false);
    assert.equal(isPlainJson(new (class Game {})()), false);
  });

  it('refuses data too large to walk inside its budget', () => {
    assert.equal(isPlainJson([1, 2, 3, 4, 5], 3), false);
    assert.equal(isPlainJson([1, 2], 3), true);
  });
});

describe('encodeRow / decodeRow', () => {
  const query = {
    queryKey: ['game', 'igdb:1942'],
    data: { id: 'igdb:1942', title: 'The Witcher 3', genres: ['RPG'] },
    updatedAt: NOW - 60_000,
  };

  it('round-trips a query', () => {
    const row = encodeRow(query);
    assert.ok(row);
    assert.deepEqual(decodeRow(row, NOW), query);
  });

  it('keeps an empty answer — nothing found is still an answer', () => {
    const row = encodeRow({ queryKey: ['copies', 'abc', 'igdb:1'], data: [], updatedAt: NOW });
    assert.deepEqual(decodeRow(row, NOW)?.data, []);
    const none = encodeRow({ queryKey: ['my-log', 'abc', 'igdb:1'], data: null, updatedAt: NOW });
    assert.equal(decodeRow(none, NOW)?.data, null);
  });

  it('does not write an excluded key, undefined data, or data that would change', () => {
    assert.equal(encodeRow({ ...query, queryKey: ['search', 'games', 'wit'] }), null);
    assert.equal(encodeRow({ ...query, data: undefined }), null);
    assert.equal(encodeRow({ ...query, data: { at: new Date(NOW) } }), null);
  });

  it('does not write a row too large to read back', () => {
    const big = { text: 'x'.repeat(MAX_ROW_CHARS) };
    assert.equal(encodeRow({ ...query, data: big }), null);
  });

  it('drops what it cannot trust', () => {
    assert.equal(decodeRow(null, NOW), null);
    assert.equal(decodeRow('', NOW), null);
    assert.equal(decodeRow('{not json', NOW), null);
    assert.equal(decodeRow('[]', NOW), null);
    assert.equal(decodeRow('"a string"', NOW), null);
    assert.equal(
      decodeRow(JSON.stringify({ v: CACHE_VERSION, k: 'feed', t: NOW, d: 1 }), NOW),
      null
    );
    assert.equal(
      decodeRow(JSON.stringify({ v: CACHE_VERSION, k: ['feed'], t: 'now', d: 1 }), NOW),
      null
    );
    assert.equal(decodeRow(JSON.stringify({ v: CACHE_VERSION, k: ['feed'], t: NOW }), NOW), null);
  });

  it('drops a row from another version', () => {
    const row = JSON.stringify({ v: CACHE_VERSION + 1, k: ['feed'], t: NOW, d: [] });
    assert.equal(decodeRow(row, NOW), null);
  });

  it('drops a row from the version before — what a renamed field leaves on the device', () => {
    /* A collection's summary as it was saved while it still had a `mosaic`:
       restored, its tile mapped over a `stack` that was not there. */
    const row = JSON.stringify({
      v: CACHE_VERSION - 1,
      k: ['lists', 'user-1'],
      t: NOW,
      d: [{ id: 'list-1', title: 'Horror', mosaic: [] }],
    });
    assert.equal(decodeRow(row, NOW), null);
  });

  it('drops a row older than a week, and keeps one a minute younger', () => {
    const at = (age: number) =>
      JSON.stringify({ v: CACHE_VERSION, k: ['feed'], t: NOW - age, d: [] });
    assert.equal(decodeRow(at(MAX_AGE_MS + 1), NOW), null);
    assert.ok(decodeRow(at(MAX_AGE_MS - 60_000), NOW));
  });

  it('drops a row whose key has since been excluded', () => {
    const row = JSON.stringify({ v: CACHE_VERSION, k: ['search', 'games', 'x'], t: NOW, d: [] });
    assert.equal(decodeRow(row, NOW), null);
  });
});

describe('pickEvictions', () => {
  const index = (rows: [string, number, number][]) =>
    new Map<string, RowInfo>(rows.map(([hash, chars, updatedAt]) => [hash, { chars, updatedAt }]));

  it('evicts nothing while the cache fits', () => {
    const rows = index([
      ['a', 100, 1],
      ['b', 100, 2],
    ]);
    assert.deepEqual(pickEvictions(rows, { maxRows: 2, maxChars: 200 }), []);
  });

  it('evicts the oldest data first when there are too many rows', () => {
    const rows = index([
      ['new', 10, 30],
      ['old', 10, 10],
      ['mid', 10, 20],
    ]);
    assert.deepEqual(pickEvictions(rows, { maxRows: 1, maxChars: 1000 }), ['old', 'mid']);
  });

  it('evicts until the size fits, and no further', () => {
    const rows = index([
      ['a', 400, 1],
      ['b', 400, 2],
      ['c', 400, 3],
    ]);
    assert.deepEqual(pickEvictions(rows, { maxRows: 10, maxChars: 800 }), ['a']);
    assert.deepEqual(pickEvictions(rows, { maxRows: 10, maxChars: 500 }), ['a', 'b']);
  });
});
