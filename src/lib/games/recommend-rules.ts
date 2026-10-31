/**
 * "Games for you" as rules: which of somebody's logs seed it, and which of the
 * games those seeds lead to are shown this time. Pure — `npm test` covers it;
 * `recommend.ts` asks IGDB and hands the answers here.
 *
 * ## A new round every time the app is opened, and no repeats
 *
 * The owner's request (2026-10-29): the band "should update every time the
 * user opens the app, giving new recommendations that don't repeat, based on
 * the games they logged". It used to be the same three seeds — the three
 * best-rated logs — every time, so it was the same twelve games for weeks.
 *
 * - **The seeds are drawn, not ranked.** Every log rated 60 or more, or not
 *   rated, can seed a round; a better score makes a game likelier to be drawn
 *   (`seedWeight`), never certain. A 95 comes up most rounds and a 65 now and
 *   then, so the band still leans on what somebody loved and still moves.
 * - **What was shown is remembered** (`lib/games/recommend-history.ts`, on the
 *   device, per account) and the next round leads with games not in it. Only
 *   when the seeds run out of unseen games are seen ones used to fill the
 *   band, the longest-unseen first — the band is never shorter for having
 *   been opened before.
 * - **A round is one random number generator**, seeded by the round's id. A
 *   refetch inside the round (a log saved, a refetch on focus) draws the same
 *   seeds and the same order, so the band does not reshuffle under somebody
 *   who is looking at it.
 */

/** How many seeds a round draws first. One IGDB request each. */
export const SEED_COUNT = 4;

/**
 * How many more a round may draw when the first ones have too little unseen.
 * A second wave, not a bigger first one: most rounds are filled by four.
 */
export const EXTRA_SEEDS = 4;

/** Logs below this score are not an endorsement worth extending. */
export const MIN_SEED_RATING = 60;

/**
 * How many shown games are remembered. Twenty rounds of twelve: long enough
 * that a game does not come back for weeks of opening the app, short enough
 * that somebody with three logs is not left with nothing but repeats.
 */
export const HISTORY_LIMIT = 240;

export type LogSeed = {
  gameId: string;
  title: string;
  rating: number | null;
};

type SeedableLog = {
  game_id: string;
  rating: number | null;
  game?: { title?: string } | null;
};

/** A seeded random number generator in [0, 1): mulberry32. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** A string to a 32-bit number (FNV-1a), for seeding the generator. */
export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Every log that may seed a round, in the order given (newest first). */
export function eligibleSeeds(logs: readonly SeedableLog[]): LogSeed[] {
  const seen = new Set<string>();
  const seeds: LogSeed[] = [];
  for (const log of logs) {
    if (log.rating !== null && log.rating < MIN_SEED_RATING) continue;
    if (seen.has(log.game_id)) continue;
    seen.add(log.game_id);
    seeds.push({
      gameId: log.game_id,
      title: log.game?.title ?? 'a game you played',
      rating: log.rating,
    });
  }
  return seeds;
}

/**
 * How likely a log is to be drawn. A played game with no score counts as a
 * 60; above that the weight grows with the square of the margin over 50: a 60
 * weighs 2, a 70 5, a 90 17 and a 100 26 — a 100 is thirteen times as likely
 * as a 60 to be drawn first.
 */
export function seedWeight(rating: number | null): number {
  const score = rating ?? MIN_SEED_RATING;
  const margin = (Math.max(score, MIN_SEED_RATING) - 50) / 10;
  return 1 + margin * margin;
}

/**
 * The seeds in the order a round uses them.
 *
 * Without `random`, the old order — rated first and highest first, unrated
 * ones behind in their incoming order. Surprise Me's "Based on my games" asks
 * that way. With it, a weighted draw without replacement (Efraimidis–Spirakis:
 * each seed's key is u^(1/w), highest first), so every seed has a turn and the
 * favourites have more of them.
 */
export function orderSeeds(seeds: readonly LogSeed[], random?: () => number): LogSeed[] {
  if (!random) {
    return seeds
      .map((seed, index) => ({ seed, index }))
      .sort((a, b) => (b.seed.rating ?? -1) - (a.seed.rating ?? -1) || a.index - b.index)
      .map(({ seed }) => seed);
  }
  return seeds
    .map((seed) => ({ seed, key: Math.pow(random(), 1 / seedWeight(seed.rating)) }))
    .sort((a, b) => b.key - a.key)
    .map(({ seed }) => seed);
}

/** Fisher–Yates, on a copy. */
function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export type Picked<G> = { games: G[]; because: Record<string, string>; fresh: number };

/**
 * The band, from what each seed led to.
 *
 * Interleaved across seeds, so the first screen spans somebody's taste rather
 * than opening on eight games like one thing. Games already logged, and a game
 * two seeds both led to, are taken once at most. Games in `recent` (oldest
 * first) go last, the longest-unseen first; `fresh` says how many were not.
 *
 * With `random`, each seed's list is shuffled first: IGDB's `similar_games`
 * is not ranked, and a seed drawn again a week later should not lead with
 * the same three games.
 */
export function pickRecommendations<G extends { id: string }>(
  results: readonly (readonly G[])[],
  seeds: readonly LogSeed[],
  options: {
    known: ReadonlySet<string>;
    limit: number;
    recent?: readonly string[];
    random?: () => number;
  }
): Picked<G> {
  const { known, limit, random } = options;
  const lastShown = new Map<string, number>();
  (options.recent ?? []).forEach((id, index) => lastShown.set(id, index));

  const lists = results.map((list) => (random ? shuffled(list, random) : list.slice()));
  const fresh: { game: G; seed: number }[] = [];
  const stale: { game: G; seed: number }[] = [];
  const taken = new Set<string>();

  const longest = Math.max(0, ...lists.map((list) => list.length));
  for (let rank = 0; rank < longest; rank += 1) {
    lists.forEach((list, seed) => {
      const game = list[rank];
      if (!game || known.has(game.id) || taken.has(game.id)) return;
      taken.add(game.id);
      (lastShown.has(game.id) ? stale : fresh).push({ game, seed });
    });
  }

  /* Shown longest ago first. The sort is stable, so equals keep the
     interleaved order. */
  stale.sort((a, b) => lastShown.get(a.game.id)! - lastShown.get(b.game.id)!);

  const chosen = [...fresh, ...stale].slice(0, limit);
  const because: Record<string, string> = {};
  for (const { game, seed } of chosen) because[game.id] = seeds[seed].title;
  return {
    games: chosen.map(({ game }) => game),
    because,
    fresh: Math.min(fresh.length, limit),
  };
}

/**
 * The history after a round: the round's games moved to the end (newest), the
 * oldest dropped past `HISTORY_LIMIT`.
 */
export function appendHistory(
  history: readonly string[],
  shown: readonly string[],
  limit = HISTORY_LIMIT
): string[] {
  const now = new Set(shown);
  const next = [...history.filter((id) => !now.has(id)), ...now];
  return next.slice(Math.max(0, next.length - limit));
}
