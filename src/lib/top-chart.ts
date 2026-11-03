/**
 * Search's Top 1000 — the best-reviewed games, by GameLog's members or by the
 * critics — as rules: how long the chart is, how it is paged, and what each
 * ranking says about itself.
 *
 * The owner's request (2026-10-20): "Create a chart widget on the search home
 * screen and show a ranking of best reviewed games on gamelog and a toggle for
 * critic review sorting. Use pages and show 20 per page. It's a top 1000
 * games."
 *
 * Pure — no React Native, no network — so `npm test` covers it.
 */

/** The chart's length: a thousand games, never more. */
export const TOP_CHART_SIZE = 1000;

/** Games on one page of it. */
export const TOP_CHART_PAGE_SIZE = 20;

/** Whose reviews rank the chart. */
export type ChartBasis = 'gamelog' | 'critics';

/** One row of the Top 1000, by either ranking. */
export type ChartEntry = {
  /** 1-based, across the whole chart. */
  rank: number;
  id: string;
  title: string;
  coverUrl: string | null;
  heroUrl: string | null;
  /** The release type's key (`constants/game-editions`), or null for the game. */
  edition: string | null;
  developer: string | null;
  releaseYear: number | null;
  /** 0-100, unrounded. Round it where it is drawn. */
  score: number;
  /** How many ratings (GameLog) or critics' reviews (critics) it is from. */
  count: number;
};

/**
 * How many critics' scores a game needs to be ranked by them.
 *
 * Without a floor the top of the chart is games two outlets reviewed and
 * loved. Seven fills it with room to spare: 1,635 games had seven or more on
 * IGDB (checked live, 2026-10-20), against 832 with ten — too few for a top
 * thousand — and 2,771 with five.
 */
export const CRITIC_FLOOR = 7;

/**
 * What the toggle says, and the line under the heading.
 *
 * GameLog's ranking is the community score (0041's weighted average, or the
 * plain mean before it), ordered by a damped figure so one 100 does not top
 * thirty 94s (0037's rule, through `beloved_games`). The critics' is IGDB's
 * average of critics' scores — the same number the reviews sheet shows when
 * OpenCritic has nothing to quote.
 */
export const CHART_BASES: readonly { key: ChartBasis; label: string; note: string }[] = [
  {
    key: 'gamelog',
    label: 'Pinged',
    note: 'Ranked by the scores people gave them here.',
  },
  {
    key: 'critics',
    label: 'Critics',
    note: `Ranked by critics’ scores — games with at least ${CRITIC_FLOOR} reviews.`,
  },
];

/** The chart's length, given how many games could be on it. */
export function chartLength(available: number): number {
  return Math.max(0, Math.min(TOP_CHART_SIZE, Math.trunc(available)));
}

/**
 * The rows one page holds: its first rank's offset and how many — fewer on
 * the last page, and none past the end, so no page reaches rank 1,001.
 * `page` is 1-based.
 */
export function chartWindow(
  page: number,
  length: number = TOP_CHART_SIZE
): { offset: number; limit: number } {
  const end = chartLength(length);
  const offset = Math.max(0, Math.trunc(page) - 1) * TOP_CHART_PAGE_SIZE;
  return {
    offset: Math.min(offset, end),
    limit: Math.max(0, Math.min(TOP_CHART_PAGE_SIZE, end - offset)),
  };
}

/** "3 ratings", "27 critics": what a score is made of, as the row says it. */
export function countLine(basis: ChartBasis, count: number): string {
  const n = Math.max(0, Math.trunc(count));
  if (basis === 'critics') return `${n.toLocaleString('en')} ${n === 1 ? 'critic' : 'critics'}`;
  return `${n.toLocaleString('en')} ${n === 1 ? 'rating' : 'ratings'}`;
}
