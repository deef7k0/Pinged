import { igdbQuery } from '../games/igdb';
import { editionKindFor } from '../../constants/game-editions';
import { makeGameId, type GameSearchResult } from '../games';
import type { ChartEntry, GameEvent, PopularChart } from './types';

/**
 * Everything on the News tab that is *about games* rather than about articles:
 * trailers, release calendars, the popularity chart, industry events and
 * discovery.
 *
 * Every game here comes from IGDB, through the Edge Function, same as search.
 */

/** Unix seconds, for IGDB's date filters. */
function unixDaysFromNow(days: number): number {
  return Math.floor((Date.now() + days * 86_400_000) / 1000);
}

function igdbImage(imageId: string | undefined, size: string): string | null {
  return imageId ? `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg` : null;
}

export type IgdbGameLite = {
  id: number;
  name?: string;
  first_release_date?: number;
  total_rating?: number;
  external_games?: { category?: number; uid?: string }[];
  game_type?: number;
  parent_game?: number;
  version_parent?: number;
  version_title?: string;
  cover?: { image_id?: string };
  artworks?: { image_id?: string }[];
  screenshots?: { image_id?: string }[];
  videos?: { video_id?: string; name?: string }[];
  genres?: { name?: string }[];
  platforms?: { name?: string }[];
  involved_companies?: { developer?: boolean; company?: { name?: string } }[];
};

/** First credited developer, matching `companyNamed` on the search path. */
function developerOf(raw: IgdbGameLite): string | null {
  return (
    (raw.involved_companies ?? []).find((entry) => entry.developer)?.company?.name?.trim() || null
  );
}

export function toSearchResult(raw: IgdbGameLite): GameSearchResult {
  return {
    id: makeGameId('igdb', raw.id),
    source: 'igdb',
    sourceId: String(raw.id),
    title: raw.name ?? 'Untitled',
    coverUrl: igdbImage(raw.cover?.image_id, 'cover_big'),
    heroUrl:
      igdbImage(raw.artworks?.[0]?.image_id, '1080p') ??
      igdbImage(raw.screenshots?.[0]?.image_id, '1080p'),
    /* The News tab is mostly unreleased games, so this is the one producer
       where the full date is load-bearing rather than decorative: it is what
       lets a row say "Pre-order" instead of quoting a price for something
       nobody can play yet. */
    releaseDate: raw.first_release_date
      ? new Date(raw.first_release_date * 1000).toISOString().slice(0, 10)
      : null,
    releaseYear: raw.first_release_date
      ? new Date(raw.first_release_date * 1000).getFullYear()
      : null,
    /*
     * These three were hard-coded to `null` / `[]` and that was the whole bug.
     *
     * `<GameListItem>` renders each of its metadata lines conditionally, so a
     * row with no developer, no genres and no platforms silently collapses to a
     * title, a year and a score. The component was never the problem — every
     * list in the app has always used the same one — but everything produced by
     * *this* file arrived pre-emptied, which is why Highly rated, Upcoming and
     * the release rails looked like an older, thinner design than the search
     * results one tap away.
     *
     * Genres matter twice over: they are also what `identityColorFor` reads, so
     * until now every game reached through News or Discover had no identity hue
     * either and fell back to the house blue.
     */
    developer: developerOf(raw),
    genres: (raw.genres ?? []).map((genre) => genre.name).filter((name): name is string => !!name),
    platforms: (raw.platforms ?? [])
      .map((platform) => platform.name)
      .filter((name): name is string => !!name),
    score: typeof raw.total_rating === 'number' ? Math.round(raw.total_rating) : null,
    /* The charts badge a remaster the same way search does — the News tab is
       full of them, and "Silent Hill 2" appearing twice with no way to tell the
       1999 game from the 2024 remake is the exact confusion this fixes. */
    edition: editionKindFor({
      gameType: raw.game_type ?? null,
      versionParent: raw.version_parent ?? null,
    }),
    editionTitle: raw.version_title ?? null,
    // Category 1 is Steam. Same read as `steamAppIdOf` in games/igdb.ts.
    steamAppId: (raw.external_games ?? []).find((e) => e.category === 1 && e.uid)?.uid ?? null,
    parentId:
      (raw.version_parent ?? raw.parent_game)
        ? makeGameId('igdb', (raw.version_parent ?? raw.parent_game)!)
        : null,
  };
}

/**
 * What every News and Discover query asks IGDB for.
 *
 * "Lite" relative to `GAME_FIELDS` on the search path — it still omits
 * `summary`, `storyline`, `url` and the full screenshot set, which are a game
 * *page's* needs and would be several kilobytes per row across a forty-row
 * chart nobody has opened a game from yet.
 *
 * It is **not** lite on the things a list row renders. Genres, platforms and the
 * developer credit were left out of this list, so every row produced here was
 * missing exactly the three facts `<GameListItem>` shows below the title. Three
 * nested expansions is the honest cost of a row that says what it is; the
 * saving before this was measured in bytes and paid for in the app looking like
 * two different apps.
 */
export const LITE_FIELDS = `
  fields name, first_release_date, total_rating,
         game_type, parent_game, version_parent, version_title,
         external_games.category, external_games.uid,
         genres.name, platforms.name,
         involved_companies.developer, involved_companies.company.name,
         cover.image_id, artworks.image_id, screenshots.image_id;
`;

// ---------------------------------------------------------------------------
// Releases and discovery
// ---------------------------------------------------------------------------

/** Games out in the last 45 days. */
export async function getNewReleases(signal?: AbortSignal): Promise<GameSearchResult[]> {
  const raw = await igdbQuery<IgdbGameLite[]>(
    'games',
    `${LITE_FIELDS}
     where first_release_date > ${unixDaysFromNow(-45)}
       & first_release_date < ${unixDaysFromNow(0)}
       & cover != null
       & version_parent = null;
     sort first_release_date desc;
     limit 40;`,
    signal
  );
  return (raw ?? []).map(toSearchResult);
}

/** Games due in the next 120 days. */
export async function getUpcomingReleases(signal?: AbortSignal): Promise<GameSearchResult[]> {
  const raw = await igdbQuery<IgdbGameLite[]>(
    'games',
    `${LITE_FIELDS}
     where first_release_date > ${unixDaysFromNow(0)}
       & first_release_date < ${unixDaysFromNow(120)}
       & cover != null
       & version_parent = null;
     sort first_release_date asc;
     limit 40;`,
    signal
  );
  return (raw ?? []).map(toSearchResult);
}

/**
 * Highly-rated games from the past couple of years — the Discover feed.
 *
 * `total_rating_count > 40` filters out titles whose 95% came from a handful of
 * votes, which otherwise dominate a naive sort by rating.
 */
export async function getDiscoverGames(signal?: AbortSignal): Promise<GameSearchResult[]> {
  const raw = await igdbQuery<IgdbGameLite[]>(
    'games',
    `${LITE_FIELDS}
     where first_release_date > ${unixDaysFromNow(-730)}
       & total_rating != null
       & total_rating_count > 40
       & cover != null
       & version_parent = null;
     sort total_rating desc;
     limit 40;`,
    signal
  );
  return (raw ?? []).map(toSearchResult);
}

// ---------------------------------------------------------------------------
// Popularity chart
// ---------------------------------------------------------------------------

/**
 * IGDB popularity type 1 — "Visits".
 *
 * Chosen over the Steam-derived types (24hr peak players, top sellers) because
 * those measure one storefront's PC audience and would put the chart back in
 * exactly the position it was in before: a PC-only ranking presented as a
 * ranking of games. Visits is IGDB's own cross-platform interest signal.
 */
const POPULARITY_VISITS = 1;

type IgdbPopularity = { game_id?: number; value?: number };

function toChartEntry(raw: IgdbGameLite, rank: number): ChartEntry {
  const game = toSearchResult(raw);
  return {
    rank,
    gameId: game.id,
    title: game.title,
    coverUrl: game.coverUrl,
    heroUrl: game.heroUrl,
    releaseYear: game.releaseYear,
    edition: game.edition,
    steamAppId: game.steamAppId,
    platforms: game.platforms,
  };
}

/**
 * The most popular games right now, by IGDB's own interest signal.
 *
 * Two calls, not one: `popularity_primitives` returns game ids and scores with
 * no metadata at all, so the ids are resolved against `games` in a second
 * query. Ranking order comes from the first call and is preserved by walking
 * the id list rather than the response, which IGDB returns in its own order.
 *
 * Over-fetches ids because entries without cover art are dropped — a chart of
 * lettered placeholders is not a chart worth showing.
 */
async function popularByVisits(limit: number, signal?: AbortSignal): Promise<ChartEntry[]> {
  let primitives: IgdbPopularity[] | null = null;
  try {
    primitives = await igdbQuery<IgdbPopularity[]>(
      'popularity_primitives',
      `fields game_id, value;
       where popularity_type = ${POPULARITY_VISITS};
       sort value desc;
       limit ${limit * 3};`,
      signal
    );
  } catch {
    // `popularity_primitives` has to be in the Edge Function's allowlist and the
    // function redeployed. Until then this returns nothing and the caller falls
    // back rather than showing an error.
    return [];
  }

  const ids = [...new Set((primitives ?? []).map((row) => row.game_id).filter(Boolean))];
  if (ids.length === 0) return [];

  const games = await igdbQuery<IgdbGameLite[]>(
    'games',
    `${LITE_FIELDS}
     where id = (${ids.join(',')}) & cover != null & version_parent = null;
     limit ${ids.length};`,
    signal
  );

  const byId = new Map((games ?? []).map((game) => [game.id, game]));
  const entries: ChartEntry[] = [];

  for (const id of ids) {
    const game = byId.get(id as number);
    if (!game) continue;
    entries.push(toChartEntry(game, entries.length + 1));
    if (entries.length === limit) break;
  }
  return entries;
}

/**
 * Fallback ranking: the most-rated releases of the past year.
 *
 * Rating *count*, not rating value — the question is which games people are
 * engaging with, and a 98% from eleven votes is not that. Deliberately a wide
 * window: thirty days of releases is a new-releases list wearing a chart's
 * name, and would rank a quiet month's handful of titles as "the most popular".
 */
async function popularByRatings(limit: number, signal?: AbortSignal): Promise<ChartEntry[]> {
  const raw = await igdbQuery<IgdbGameLite[]>(
    'games',
    `${LITE_FIELDS}
     where first_release_date > ${unixDaysFromNow(-365)}
       & first_release_date < ${unixDaysFromNow(0)}
       & total_rating_count != null
       & cover != null
       & version_parent = null;
     sort total_rating_count desc;
     limit ${limit};`,
    signal
  );
  return (raw ?? []).map((game, index) => toChartEntry(game, index + 1));
}

/**
 * The month's most popular games.
 *
 * Returns the basis alongside the rows so the screen can footnote what it
 * actually measured — the two paths rank on genuinely different things and the
 * caller must not have to guess which one it got.
 */
export async function getPopularGames(limit = 10, signal?: AbortSignal): Promise<PopularChart> {
  const byVisits = await popularByVisits(limit, signal);
  if (byVisits.length > 0) {
    return { basis: 'igdb-popularity', entries: byVisits };
  }
  return { basis: 'community-ratings', entries: await popularByRatings(limit, signal) };
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

type IgdbEvent = {
  id: number;
  name?: string;
  description?: string;
  start_time?: number;
  live_stream_url?: string;
};

/**
 * Upcoming industry events — showcases, awards shows.
 *
 * Returns an empty list rather than throwing when the Edge Function rejects the
 * `events` endpoint, which it will until the function is redeployed with
 * 'events' in its allowlist. That keeps the rest of the News tab working.
 */
export async function getGameEvents(signal?: AbortSignal): Promise<GameEvent[]> {
  try {
    const raw = await igdbQuery<IgdbEvent[]>(
      'events',
      `fields name, description, start_time, live_stream_url;
       where start_time > ${unixDaysFromNow(-7)};
       sort start_time asc;
       limit 25;`,
      signal
    );

    const now = Date.now();

    return (raw ?? []).map((event) => {
      const startsAtMs = event.start_time ? event.start_time * 1000 : null;
      return {
        id: String(event.id),
        name: event.name ?? 'Untitled event',
        description: event.description ?? null,
        startsAt: startsAtMs ? new Date(startsAtMs).toISOString() : null,
        liveStreamUrl: event.live_stream_url ?? null,
        isUpcoming: startsAtMs !== null && startsAtMs > now,
      };
    });
  } catch {
    return [];
  }
}
