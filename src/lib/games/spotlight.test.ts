import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  countdownLabel,
  countdownSpoken,
  freshFrom,
  monthEnd,
  monthLabel,
  pickAwaited,
  pickFresh,
  pickPortraits,
  PORTRAITS,
  releaseDaysOf,
  usableArt,
  type SpotlightCandidate,
} from './spotlight';

const utc = (year: number, month: number, day: number, hour = 0) =>
  Math.floor(Date.UTC(year, month - 1, day, hour) / 1000);

/** A Friday afternoon in the middle of a month. */
const NOW = utc(2026, 10, 9, 15);

function game(
  id: string,
  releasedAt: number,
  extra: Partial<SpotlightCandidate> = {}
): SpotlightCandidate {
  return { id, releasedAt, precision: 'day', hypes: 10, ratings: 0, artAspect: 16 / 9, ...extra };
}

describe('art that can fill a slide', () => {
  it('takes a widescreen frame and a 4:3 painting', () => {
    assert.equal(usableArt(16 / 9), true);
    assert.equal(usableArt(4 / 3), true);
    assert.equal(usableArt(21 / 9), true);
  });

  it('refuses a banner, a portrait, a wordmark and art of no known size', () => {
    assert.equal(usableArt(1920 / 620), false);
    assert.equal(usableArt(2 / 3), false);
    assert.equal(usableArt(1), false);
    assert.equal(usableArt(5981 / 920), false);
    assert.equal(usableArt(null), false);
  });
});

describe('the games that just came out', () => {
  it('are this month’s two biggest, by follows and ratings together', () => {
    const picked = pickFresh(
      [
        game('small', utc(2026, 10, 2), { hypes: 5 }),
        game('big', utc(2026, 10, 6), { hypes: 90 }),
        /* No follows to speak of, but people played it. */
        game('surprise', utc(2026, 10, 1), { hypes: 1, ratings: 60 }),
      ],
      NOW
    );
    assert.deepEqual(
      picked.map((entry) => entry.id),
      ['big', 'surprise']
    );
  });

  it('put a game from this month ahead of a bigger one from last month', () => {
    const picked = pickFresh(
      [
        game('september', utc(2026, 9, 25), { hypes: 400 }),
        game('october', utc(2026, 10, 3), { hypes: 20 }),
      ],
      NOW
    );
    assert.deepEqual(
      picked.map((entry) => entry.id),
      ['october', 'september']
    );
  });

  it('reach back thirty days on the first days of a month', () => {
    const second = utc(2026, 11, 2, 9);
    const picked = pickFresh(
      [
        game('yesterday', utc(2026, 11, 1), { hypes: 3 }),
        game('lastMonth', utc(2026, 10, 20), { hypes: 80 }),
        game('tooOld', utc(2026, 9, 30), { hypes: 900 }),
      ],
      second
    );
    assert.deepEqual(
      picked.map((entry) => entry.id),
      ['yesterday', 'lastMonth']
    );
  });

  it('leave out what is not out, what has no day and what has no picture', () => {
    const picked = pickFresh(
      [
        game('tomorrow', utc(2026, 10, 10)),
        /* "October", stored as the 31st — and on the 31st still not a day. */
        game('sometime', utc(2026, 10, 5), { precision: 'month' }),
        game('logo', utc(2026, 10, 4), { artAspect: 6.5 }),
        game('noArt', utc(2026, 10, 4), { artAspect: null }),
        game('out', utc(2026, 10, 8)),
      ],
      NOW
    );
    assert.deepEqual(
      picked.map((entry) => entry.id),
      ['out']
    );
  });

  it('count a game released earlier today as out', () => {
    assert.equal(pickFresh([game('today', utc(2026, 10, 9))], NOW).length, 1);
  });
});

describe('the window the request covers', () => {
  it('starts on the 1st once the month is thirty days old, and thirty days back before', () => {
    assert.equal(freshFrom(utc(2026, 10, 31, 12)), utc(2026, 10, 1));
    assert.equal(freshFrom(NOW), utc(2026, 9, 9));
    assert.equal(freshFrom(utc(2026, 11, 2, 9)), utc(2026, 10, 3));
  });

  it('ends with the month, across a year’s end too', () => {
    assert.equal(monthEnd(NOW), utc(2026, 11, 1));
    assert.equal(monthEnd(utc(2026, 12, 20)), utc(2027, 1, 1));
  });
});

describe('the most awaited game', () => {
  it('is the most followed one still to come, however far off', () => {
    const awaited = pickAwaited(
      [
        game('nextWeek', utc(2026, 10, 16), { hypes: 40 }),
        game('nextYear', utc(2027, 5, 26), { hypes: 900 }),
        game('out', utc(2026, 10, 1), { hypes: 5000 }),
      ],
      NOW
    );
    assert.equal(awaited?.id, 'nextYear');
  });

  it('is never a game already on a slide, or one with no picture', () => {
    const candidates = [
      game('taken', utc(2026, 12, 1), { hypes: 900 }),
      game('logo', utc(2026, 12, 1), { hypes: 800, artAspect: 7 }),
      game('next', utc(2026, 12, 1), { hypes: 100 }),
    ];
    assert.equal(pickAwaited(candidates, NOW, ['taken'])?.id, 'next');
    assert.equal(pickAwaited([], NOW), null);
  });
});

describe('a slide’s date', () => {
  it('counts days where IGDB knows the day', () => {
    assert.equal(countdownLabel(utc(2026, 11, 1), 'day', NOW), '23 days');
    assert.equal(countdownLabel(utc(2026, 10, 10), 'day', NOW), 'Tomorrow');
    assert.equal(countdownLabel(utc(2026, 10, 9), 'day', utc(2026, 10, 9, 1)), 'Today');
    assert.equal(countdownLabel(utc(2027, 5, 26), 'day', NOW), '229 days');
  });

  it('names the month or the year when that is all there is', () => {
    /* Stored as the last day of what is known; never counted down to. */
    assert.equal(countdownLabel(utc(2026, 11, 30), 'month', NOW), 'November');
    assert.equal(countdownLabel(utc(2027, 3, 31), 'month', NOW), 'March 2027');
    assert.equal(countdownLabel(utc(2027, 12, 31), 'year', NOW), '2027');
  });

  it('reads as a sentence', () => {
    assert.equal(countdownSpoken(utc(2026, 11, 1), 'day', NOW), 'out in 23 days');
    assert.equal(countdownSpoken(utc(2026, 10, 10), 'day', NOW), 'out tomorrow');
    assert.equal(countdownSpoken(utc(2027, 12, 31), 'year', NOW), 'out in 2027');
  });

  it('names this month for the calendar', () => {
    assert.equal(monthLabel(NOW), 'October 2026');
  });
});

describe('the days the calendar slide lights', () => {
  it('are this month’s day-precise releases, once each, in order', () => {
    const days = releaseDaysOf(
      [
        game('a', utc(2026, 10, 23)),
        game('b', utc(2026, 10, 6)),
        game('c', utc(2026, 10, 23)),
        game('month', utc(2026, 10, 31), { precision: 'month' }),
        game('september', utc(2026, 9, 30)),
        game('november', utc(2026, 11, 1)),
      ],
      NOW
    );
    assert.deepEqual(days, [6, 23]);
  });
});

describe('Explore’s portraits', () => {
  it('take the biggest just out, with or without landscape art, then the most awaited', () => {
    const window = [
      game('small', utc(2026, 10, 2), { hypes: 1, artAspect: null }),
      game('big', utc(2026, 10, 3), { hypes: 90, artAspect: 2 / 3 }),
      game('last-month', utc(2026, 9, 20), { hypes: 200 }),
      game('later-this-month', utc(2026, 10, 20), { hypes: 500 }),
    ];
    const ahead = [
      game('gta', utc(2026, 11, 19), { hypes: 900 }),
      game('later-this-month', utc(2026, 10, 20), { hypes: 500 }),
      game('quiet', utc(2027, 2, 1), { hypes: 2 }),
    ];
    const { fresh, awaited } = pickPortraits(window, ahead, NOW);
    assert.deepEqual(
      fresh.map((entry) => entry.id),
      ['big', 'small', 'last-month']
    );
    assert.deepEqual(
      awaited.map((entry) => entry.id),
      ['gta', 'later-this-month', 'quiet']
    );
  });

  it('never repeat a game, and stop at their counts', () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      game(`g${index}`, utc(2026, 10, 1 + (index % 8)), { hypes: index })
    );
    const ahead = Array.from({ length: 6 }, (_, index) =>
      game(`a${index}`, utc(2027, 1, 1 + index), { hypes: 100 - index })
    );
    const { fresh, awaited } = pickPortraits(many, ahead, NOW);
    assert.equal(fresh.length, PORTRAITS.fresh);
    assert.equal(awaited.length, PORTRAITS.awaited);
    const ids = [...fresh, ...awaited].map((entry) => entry.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('leave out a date known only to the month', () => {
    const { fresh } = pickPortraits(
      [game('vague', utc(2026, 10, 1), { precision: 'month' })],
      [],
      NOW
    );
    assert.equal(fresh.length, 0);
  });
});
