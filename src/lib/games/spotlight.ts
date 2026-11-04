/**
 * Which games Search opens on — the slider at the head of Discover — and what
 * each slide says about its date.
 *
 * Pure: no React Native and no network, so `npm test` covers it. The request
 * is `getSpotlight` in `igdb.ts`; this is everything it decides afterwards.
 *
 * ## The four slides, and whose words they are
 *
 * The owner's (2026-10-09): "2 of the most popular games released this month",
 * then "the most anticipated game coming soon" as a countdown, then a door to
 * the release calendar. Each of the first three is a piece of landscape art
 * with the game's name and one developer.
 *
 * ## Ranked as the calendar ranks
 *
 * `calendarWeight` — follows before release plus ratings after — is already
 * the app's one statement of "the big games of the month", and the calendar is
 * where the fourth slide leads. Two rankings would let the slider open on a
 * game the calendar it points at does not think is notable.
 *
 * ## A month is thin on its first days
 *
 * On the 2nd nothing has "released this month" but whatever came out
 * yesterday. So the window reaches back thirty days, and a game from this
 * month always goes ahead of one from the tail of the last: the slide is "new",
 * which both are, and never claims a month it cannot fill.
 */

import { calendarWeight, monthStart, type DatePrecision } from './calendar';
import { heroShape } from './hero-art';

const DAY = 86_400;

export const SPOTLIGHT = {
  /** How many just-released games lead the slider. */
  fresh: 2,
  /** How far behind today "new" reaches when the month has not filled. */
  lookbackDays: 30,
} as const;

/** As much of a game as choosing its slide needs. */
export type SpotlightCandidate = {
  id: string;
  /** Unix seconds, midnight UTC of the release day. */
  releasedAt: number;
  precision: DatePrecision;
  hypes: number;
  ratings: number;
  /** Width over height of the art chosen for it, or null when it has none that can be measured. */
  artAspect: number | null;
};

/** 00:00 UTC of the day `seconds` falls on. */
function dayStart(seconds: number): number {
  return Math.floor(seconds / DAY) * DAY;
}

/**
 * Can this art fill a slide?
 *
 * The slide is 3:2. A widescreen frame or a 4:3 painting fills it with a
 * little off its sides; a 3.1:1 banner would be cut to its middle half and
 * enlarged to do it, and a portrait piece or a wordmark is not a picture of
 * the game at this shape at all. Those games give the slide to the next one —
 * the slider never stretches a cover.
 */
export function usableArt(aspect: number | null): boolean {
  const shape = heroShape(aspect);
  return shape === 0 || shape === 1;
}

/** The first second the "new" window covers: the start of this month, or thirty days back, whichever is earlier. */
export function freshFrom(now: number): number {
  const today = new Date(now * 1000);
  const month = monthStart(today.getUTCFullYear(), today.getUTCMonth());
  return Math.min(month, dayStart(now) - SPOTLIGHT.lookbackDays * DAY);
}

/** The first second of next month — where the request's window ends, so the calendar slide knows the month's days still to come. */
export function monthEnd(now: number): number {
  const today = new Date(now * 1000);
  return monthStart(today.getUTCFullYear(), today.getUTCMonth() + 1);
}

const byWeight = <T extends SpotlightCandidate>(a: T, b: T) =>
  calendarWeight(b) - calendarWeight(a) || a.releasedAt - b.releasedAt;

/**
 * The games that have just come out, biggest first: this month's before the
 * last thirty days'.
 *
 * Day-precise releases only — a game IGDB knows as "October" is stored as the
 * 31st and has not necessarily come out on it.
 */
export function pickFresh<T extends SpotlightCandidate>(
  candidates: readonly T[],
  now: number,
  count: number = SPOTLIGHT.fresh
): T[] {
  const today = new Date(now * 1000);
  const month = monthStart(today.getUTCFullYear(), today.getUTCMonth());
  const from = freshFrom(now);

  const out = candidates.filter(
    (game) =>
      game.precision === 'day' &&
      game.releasedAt <= now &&
      game.releasedAt >= from &&
      usableArt(game.artAspect)
  );

  const thisMonth = out.filter((game) => game.releasedAt >= month).sort(byWeight);
  const before = out.filter((game) => game.releasedAt < month).sort(byWeight);
  return [...thisMonth, ...before].slice(0, count);
}

/**
 * The most awaited game still to come: the most followed, whatever its date.
 *
 * Follows alone, not the calendar's weight — nothing unreleased has ratings.
 * A game due later today is still to come; one already on a slide is skipped.
 */
export function pickAwaited<T extends SpotlightCandidate>(
  candidates: readonly T[],
  now: number,
  taken: readonly string[] = []
): T | null {
  const waiting = candidates
    .filter(
      (game) => game.releasedAt > now && usableArt(game.artAspect) && !taken.includes(game.id)
    )
    .sort((a, b) => b.hypes - a.hypes || a.releasedAt - b.releasedAt);
  return waiting[0] ?? null;
}

/**
 * Explore's carousel (the owner's, 2026-11-03): the games "out now and coming
 * soon" on their *portrait* art, so the landscape rule does not apply — every
 * spotlight candidate has a cover (`cover != null` in its request). The
 * biggest just out first, as `pickFresh` ranks them, then the most followed
 * still to come.
 */
export const PORTRAITS = { fresh: 5, awaited: 3 } as const;

export function pickPortraits<T extends SpotlightCandidate>(
  window: readonly T[],
  ahead: readonly T[],
  now: number
): { fresh: T[]; awaited: T[] } {
  const today = new Date(now * 1000);
  const month = monthStart(today.getUTCFullYear(), today.getUTCMonth());
  const from = freshFrom(now);

  const out = window.filter(
    (game) => game.precision === 'day' && game.releasedAt <= now && game.releasedAt >= from
  );
  const thisMonth = out.filter((game) => game.releasedAt >= month).sort(byWeight);
  const before = out.filter((game) => game.releasedAt < month).sort(byWeight);
  const fresh = [...thisMonth, ...before].slice(0, PORTRAITS.fresh);

  const taken = new Set(fresh.map((game) => game.id));
  const awaited: T[] = [];
  for (const game of [...ahead, ...window]
    .filter((candidate) => candidate.releasedAt > now)
    .sort((a, b) => b.hypes - a.hypes || a.releasedAt - b.releasedAt)) {
    if (awaited.length >= PORTRAITS.awaited) break;
    if (taken.has(game.id)) continue;
    taken.add(game.id);
    awaited.push(game);
  }
  return { fresh, awaited };
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** "October 2026" — the calendar slide's line. */
export function monthLabel(now: number): string {
  const today = new Date(now * 1000);
  return `${MONTHS[today.getUTCMonth()]} ${today.getUTCFullYear()}`;
}

/**
 * How long until a game is out, as its slide's badge.
 *
 * A countdown only where IGDB knows the day. A game announced for a month is
 * that month; one announced for a year is that year — a number of days to the
 * 31st of December would be a date nobody gave. All in UTC, as the calendar is.
 */
export function countdownLabel(releasedAt: number, precision: DatePrecision, now: number): string {
  const release = new Date(releasedAt * 1000);
  const thisYear = new Date(now * 1000).getUTCFullYear();

  if (precision === 'year') return String(release.getUTCFullYear());

  if (precision === 'month') {
    const month = MONTHS[release.getUTCMonth()];
    return release.getUTCFullYear() === thisYear ? month : `${month} ${release.getUTCFullYear()}`;
  }

  const days = Math.round((dayStart(releasedAt) - dayStart(now)) / DAY);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `${days} days`;
}

/** The same, said to a screen reader as part of a sentence. */
export function countdownSpoken(releasedAt: number, precision: DatePrecision, now: number): string {
  const label = countdownLabel(releasedAt, precision, now);
  if (precision !== 'day') return `out in ${label}`;
  if (label === 'Today') return 'out today';
  if (label === 'Tomorrow') return 'out tomorrow';
  return `out in ${label}`;
}

/**
 * The days of this month that a notable game releases on, in order — what the
 * calendar slide lights. Day-precise releases only.
 */
export function releaseDaysOf(
  candidates: readonly Pick<SpotlightCandidate, 'releasedAt' | 'precision'>[],
  now: number
): number[] {
  const today = new Date(now * 1000);
  const from = monthStart(today.getUTCFullYear(), today.getUTCMonth());
  const to = monthEnd(now);

  const days = new Set<number>();
  for (const game of candidates) {
    if (game.precision !== 'day' || game.releasedAt < from || game.releasedAt >= to) continue;
    days.add(new Date(game.releasedAt * 1000).getUTCDate());
  }
  return [...days].sort((a, b) => a - b);
}
