import { getSimilarTo } from '@/lib/games';
import {
  EXTRA_SEEDS,
  SEED_COUNT,
  eligibleSeeds,
  orderSeeds,
  pickRecommendations,
  type LogSeed,
} from '@/lib/games/recommend-rules';
import type { GameSearchResult } from '@/lib/games/types';

/**
 * "Games for you" — recommendations seeded from what the viewer actually played.
 *
 * There is no recommender service and there is not going to be one, so this is
 * built from the two things the app genuinely has: the viewer's own logs, and
 * IGDB's `similar_games` edge. Take the games they rated highest, ask IGDB what
 * each one is like, and drop anything they have already logged.
 *
 * That makes the band honest about itself. It is not "games we think you'll
 * like" in the machine-learning sense; it is "more like the ones you rated
 * well", which is a claim the data actually supports. `seeds` comes back with
 * the result so the UI can say so.
 *
 * ## Why seeds lean on score and not on recency
 *
 * The most recent thing someone logged is often the thing they bounced off. A
 * 90 is a much stronger signal than a Tuesday. Unrated logs are still eligible
 * but count for less — a played game with no score says something, just less.
 *
 * ## Cost
 *
 * One IGDB request per seed. Surprise Me asks three; Home's rotation four, and
 * four more only when those lead mostly to games it has shown before.
 *
 * Home's band changes every time the app is opened and does not repeat what it
 * showed — `recommend-rules.ts` says how.
 */

/** Seeds for a call with no round: the old, fixed answer. */
const LEGACY_SEED_COUNT = 3;

export type { LogSeed } from '@/lib/games/recommend-rules';

export type Recommendations = {
  games: GameSearchResult[];
  /** The games these were derived from, in the order used. Empty when nothing seeded. */
  seeds: LogSeed[];
  /**
   * Which seed's title each game came from, by game id — Home's cards say
   * "Similar to Hades". Optional: a cached answer from before it existed has none.
   */
  because?: Record<string, string>;
};

const EMPTY: Recommendations = { games: [], seeds: [], because: {} };

export type RoundOptions = {
  /** The round's generator: seeds are drawn and lists shuffled with it. */
  random: () => number;
  /** Games shown in earlier rounds, oldest first; they go last. */
  recent: readonly string[];
};

/**
 * Recommend games from a viewer's logs.
 *
 * Returns `EMPTY` rather than throwing when there is nothing to work from: a
 * new account with no logs, or a library of games that IGDB has no similarity
 * data for. Home renders the band only when `games` is non-empty, so an account
 * that cannot be recommended to simply does not see the section — which is the
 * right answer, and better than a rail of "popular" games pretending to be
 * personal.
 *
 * Without `round`, the seeds are the three best-rated logs and the answer is
 * the same every time (Surprise Me's "Based on my games"). With it, Home's
 * rotation: `SEED_COUNT` drawn seeds, up to `EXTRA_SEEDS` more when they lead
 * to too few unseen games, and what was shown before at the back
 * (`recommend-rules.ts`).
 *
 * @param logs   The viewer's logs, any order.
 * @param limit  Maximum games to return.
 */
export async function recommendFromLogs(
  logs: readonly { game_id: string; rating: number | null; game?: { title?: string } | null }[],
  limit = 12,
  signal?: AbortSignal,
  round?: RoundOptions
): Promise<Recommendations> {
  if (logs.length === 0) return EMPTY;

  /*
   * Everything the viewer has already logged, including the low-rated ones.
   * Recommending back a game someone has played is the fastest way to make a
   * band like this look broken, and it happens constantly without this — a
   * sequel is "similar to" its predecessor in both directions.
   */
  const known = new Set(logs.map((log) => log.game_id));
  const ordered = orderSeeds(eligibleSeeds(logs), round?.random);
  if (ordered.length === 0) return EMPTY;

  /*
   * In parallel. These are independent reads and the band is already the
   * slowest thing on Home; sequential round trips to an Edge Function that
   * proxies IGDB are most of a second for no reason.
   */
  const firstCount = round ? SEED_COUNT : LEGACY_SEED_COUNT;
  let seeds = ordered.slice(0, firstCount);
  let results = await Promise.all(seeds.map((seed) => getSimilarTo(seed.gameId, signal)));
  const pick = () =>
    pickRecommendations(results, seeds, {
      known,
      limit,
      recent: round?.recent,
      random: round?.random,
    });
  let picked = pick();

  /* A second wave only when the first leaves the band leaning on repeats. */
  const extra = ordered.slice(firstCount, firstCount + EXTRA_SEEDS);
  if (round && picked.fresh < limit && extra.length > 0) {
    const more = await Promise.all(extra.map((seed) => getSimilarTo(seed.gameId, signal)));
    seeds = [...seeds, ...extra];
    results = [...results, ...more];
    picked = pick();
  }

  return { games: picked.games, seeds, because: picked.because };
}
