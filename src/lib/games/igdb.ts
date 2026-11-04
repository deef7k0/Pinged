import { matchValues, tallyValues, type FacetKind, type FacetValue } from './facets';
import { pickStorefronts, type IgdbStoreFields, type StoreLink } from './storefronts';
import { pickTrailer, type GameTrailer } from './trailer';
import { editionKindFor, editionRank } from '../../constants/game-editions';
import { supabase } from '../supabase';
import { precisionOf, type DatePrecision } from './calendar';
import { chooseHero } from './hero-art';
import { chooseLogo } from './logo-art';
import { rememberGame } from './seen-games';
import {
  freshFrom,
  monthEnd,
  pickAwaited,
  pickFresh,
  pickPortraits,
  releaseDaysOf,
  type SpotlightCandidate,
} from './spotlight';
import { makeGameId, yearFrom, type Game, type GameProvider, type GameSearchResult } from './types';

/**
 * IGDB provider.
 *
 * IGDB is the only source with true portrait box art, which the poster-led UI is
 * built around — so this is the preferred provider.
 *
 * Requests do not go to IGDB directly. Its auth needs a Twitch `client_secret`,
 * which cannot ship in an app bundle, so everything is relayed through the
 * `igdb` Supabase Edge Function (see supabase/functions/igdb/index.ts). That
 * also means IGDB is only available to signed-in users, which is fine — every
 * screen that searches is already behind the auth guard.
 *
 * Queries use APIcalypse, IGDB's own query language:
 *   https://api-docs.igdb.com/#apicalypse
 */

/**
 * `width`, `height` and `artwork_type` only where a query asks for them:
 * `GAME_FIELDS` asks for all three (they are how the hero is chosen — see
 * `hero-art.ts`), the studio catalogue for its artworks' sizes.
 */
type IgdbImage = { image_id?: string; width?: number; height?: number; artwork_type?: number };

type IgdbGame = {
  id: number;
  name?: string;
  summary?: string;
  storyline?: string;
  cover?: IgdbImage;
  artworks?: IgdbImage[];
  screenshots?: IgdbImage[];
  /** Unix seconds. */
  first_release_date?: number;
  genres?: { name?: string }[];
  platforms?: { name?: string; abbreviation?: string }[];
  involved_companies?: {
    developer?: boolean;
    publisher?: boolean;
    company?: { name?: string };
  }[];
  /** 0-100 already. */
  total_rating?: number;
  /** How many ratings `total_rating` is made of — the studio page's "Most popular". */
  total_rating_count?: number;
  /** Asked only by `STUDIO_FIELDS`. */
  franchises?: { id: number; name?: string }[];
  url?: string;

  /*
   * What kind of release this is. See `constants/game-editions.ts`.
   *
   * `game_type` is the current field; `category` is the deprecated one it
   * replaced, and the two carry the same numbers. Only `game_type` is
   * *requested* — asking for a field IGDB does not have fails the whole query,
   * and `GAME_FIELDS` is shared by every screen — but both are read, so a
   * response from an older deployment still resolves.
   */
  game_type?: number;
  /** @deprecated IGDB's own name for `game_type` before 2024. Read, never asked for. */
  category?: number;

  /** The base game, for a DLC, expansion, remake, remaster or port. */
  parent_game?: number;
  /**
   * The game this repackages, for a "Game of the Year Edition" and friends.
   *
   * Distinct from `parent_game`: a version is the *same game* in a different
   * box, where a remake is a different game. Every catalogue query in this app
   * filters on `version_parent = null`, so these surface only on the parent's
   * own page.
   */
  version_parent?: number;
  /** The marketing name of that repackage — "Definitive Edition". */
  version_title?: string;

  /**
   * Storefront listings. Only `category = 1` (Steam) is read here, for its
   * appid — see `steamAppIdOf`.
   */
  external_games?: { category?: number; uid?: string }[];
};

/** IGDB's `external_games.category` for Steam. */
const STEAM_EXTERNAL_CATEGORY = 1;

/**
 * The game's Steam appid, when it has a Steam listing.
 *
 * Read from the shared field list rather than through `getGameExtras()`, which
 * is one request per game. A poster grid asks for artwork for fifty games at
 * once; fifty extra IGDB round trips to learn fifty appids would cost more than
 * the artwork is worth. The nested array is a few dozen bytes per row.
 *
 * Null for the many games that are not on Steam at all — every console
 * exclusive, and everything on itch.io. Those keep IGDB's own cover art.
 *
 * **Null on every IGDB game today**: IGDB renamed `category` to
 * `external_game_source`, so this never matches (CLAUDE.md, § Steam CDN
 * artwork — fixing it changes covers app-wide, so it is its own decision). The
 * game page does not depend on it: `getGameExtras` reads the renamed field for
 * its stores, prices, awards and news (`storefronts.ts`).
 */
function steamAppIdOf(raw: IgdbGame): string | null {
  const listing = (raw.external_games ?? []).find(
    (entry) => entry.category === STEAM_EXTERNAL_CATEGORY && entry.uid
  );
  return listing?.uid ?? null;
}

/**
 * IGDB returns image ids, not URLs; you pick a size when building the URL.
 * t_cover_big       = 264x374 portrait
 * t_screenshot_big  = 889x500 (the Overview's screenshot rail)
 * t_1080p           = 1920x1080 (the game page's full-bleed hero)
 *
 * Pick the size the slot draws at, not the largest there is: every byte is
 * downloaded, decoded, then downsampled, and lands in an image cache that grows
 * to 250 MB on Android.
 */
function imageUrl(image: IgdbImage | undefined, size: string): string | null {
  if (!image?.image_id) return null;
  /* `t_` is added here, so callers pass a bare size — 'cover_big', not
     't_cover_big'. Passing the prefixed form builds `.../upload/t_t_cover_big/`,
     which IGDB 404s, and a 404 on an `<Image>` is a silent blank rather than an
     error. Stripping a leading `t_` costs nothing and removes the trap. */
  const bare = size.startsWith('t_') ? size.slice(2) : size;
  return `https://images.igdb.com/igdb/image/upload/t_${bare}/${image.image_id}.jpg`;
}

/**
 * Common field list so search and detail return the same shape.
 *
 * Every artwork's size and kind, and every screenshot's size, ride along:
 * they are what `chooseHero` picks the page's key art by. `artwork_type` is
 * the bare id, not its expanded name — a third of the bytes on ten artworks a
 * game. Measured on the fifty most-rated games, the heaviest page there is:
 * 297 KB to 354 KB, 74 KB to 79 KB as it travels.
 */
const GAME_FIELDS = `
  fields name, summary, storyline, url, total_rating, first_release_date,
         cover.image_id, cover.width, cover.height,
         artworks.image_id, screenshots.image_id,
         artworks.width, artworks.height, artworks.artwork_type,
         screenshots.width, screenshots.height,
         genres.name, platforms.name, platforms.abbreviation,
         involved_companies.developer, involved_companies.publisher,
         involved_companies.company.name,
         game_type, parent_game, version_parent, version_title,
         external_games.category, external_games.uid;
`;

/**
 * Every query is relayed through the Edge Function, which attaches the real
 * IGDB credentials. `supabase.functions.invoke` adds the caller's session JWT.
 */
export async function igdbQuery<T>(
  endpoint: string,
  body: string,
  signal?: AbortSignal
): Promise<T> {
  const { data, error } = await supabase.functions.invoke('igdb', {
    body: { endpoint, query: body },
    ...(signal ? { signal } : {}),
  });

  if (error) {
    throw new Error(`IGDB request failed: ${error.message}`);
  }
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(String((data as { error: unknown }).error));
  }
  return data as T;
}

function companyNamed(raw: IgdbGame, role: 'developer' | 'publisher'): string | null {
  const match = raw.involved_companies?.find((entry) => entry[role]);
  return match?.company?.name ?? null;
}

/** A cover's height over its width, as uploaded — what the game page draws it at. */
function aspectOf(image: IgdbImage | undefined): number | null {
  const width = image?.width;
  const height = image?.height;
  return width && height && width > 0 && height > 0 ? height / width : null;
}

function toGame(raw: IgdbGame): Game {
  const releaseDate = raw.first_release_date
    ? new Date(raw.first_release_date * 1000).toISOString().slice(0, 10)
    : null;

  /* The game's key art — chosen, not `artworks[0]`, which is as often an icon
     or a wordmark as it is art. See `hero-art.ts`. */
  const hero = chooseHero(raw.artworks, raw.screenshots);

  return {
    id: makeGameId('igdb', raw.id),
    source: 'igdb',
    sourceId: String(raw.id),
    title: raw.name ?? 'Untitled',
    coverUrl: imageUrl(raw.cover, 'cover_big'),
    coverAspect: aspectOf(raw.cover),
    heroUrl: imageUrl(hero?.image, '1080p'),
    description: raw.summary ?? raw.storyline ?? null,
    releaseDate,
    releaseYear: yearFrom(releaseDate),
    developer: companyNamed(raw, 'developer'),
    publisher: companyNamed(raw, 'publisher'),
    genres: (raw.genres ?? []).map((genre) => genre.name).filter((name): name is string => !!name),
    platforms: (raw.platforms ?? [])
      .map((platform) => platform.name)
      .filter((name): name is string => !!name),
    score: typeof raw.total_rating === 'number' ? Math.round(raw.total_rating) : null,
    storeUrl: raw.url ?? null,
    /* `screenshot_big`, 889×500 — the rail draws one ~325dp wide, 855px on a
       1080p phone, so `screenshot_huge` (1280×720) was twice the pixels and
       ~1.6× the bytes for nothing visible: ten per game page, decoded and
       downsampled, and most of what one visit put in the image cache. */
    screenshots: (raw.screenshots ?? [])
      .map((shot) => imageUrl(shot, 'screenshot_big'))
      .filter((url): url is string => !!url),
    ...editionOf(raw),
    steamAppId: steamAppIdOf(raw),
    /* The logo the page sets where the name was — in the artworks already
       asked for. See `logo-art.ts`. */
    logo: chooseLogo(raw.artworks),
  };
}

/**
 * The release-type half of a `Game`: what kind of release it is, and what it
 * descends from.
 *
 * `parent_game` and `version_parent` are different relationships (see the field
 * notes above) but they answer the same question for a reader — *which game is
 * this a version of* — so they collapse into one `parentId`. The kind is what
 * keeps them distinguishable where it matters.
 */
function editionOf(raw: IgdbGame): Pick<Game, 'edition' | 'editionTitle' | 'parentId'> {
  const parent = raw.version_parent ?? raw.parent_game ?? null;

  return {
    edition: editionKindFor({
      // `category` is the pre-2024 name and is only read, never requested.
      gameType: raw.game_type ?? raw.category ?? null,
      versionParent: raw.version_parent ?? null,
    }),
    editionTitle: raw.version_title ?? null,
    parentId: parent === null ? null : makeGameId('igdb', parent),
  };
}

function toSearchResult(game: Game): GameSearchResult {
  return {
    id: game.id,
    source: game.source,
    sourceId: game.sourceId,
    title: game.title,
    coverUrl: game.coverUrl,
    heroUrl: game.heroUrl,
    releaseDate: game.releaseDate,
    releaseYear: game.releaseYear,
    developer: game.developer,
    genres: game.genres,
    platforms: game.platforms,
    score: game.score,
    edition: game.edition,
    editionTitle: game.editionTitle,
    parentId: game.parentId,
    steamAppId: game.steamAppId,
  };
}

/**
 * `toGame` for a row fetched with **the whole of `GAME_FIELDS`** — and so a
 * complete record, which is kept for the game page (`seen-games.ts`).
 *
 * Every list below builds the complete game and then cuts it down to a row.
 * Remembering it on the way past is what lets the game page open from a list
 * without asking IGDB for the record a second time.
 *
 * Never use this on a row fetched with fewer fields (`STUDIO_FIELDS`, the
 * `similar_games` expansion): a partial record would be handed to the game
 * page as if it were the game.
 */
function toFullGame(raw: IgdbGame): Game {
  const game = toGame(raw);
  rememberGame(game);
  return game;
}

async function search(term: string, signal?: AbortSignal): Promise<GameSearchResult[]> {
  const trimmed = term.trim();
  if (!trimmed) return [];

  // Escaping quotes keeps a title like `Marathon "Durandal"` from breaking the
  // APIcalypse string literal.
  const escaped = trimmed.replace(/"/g, '\\"');

  const raw = await igdbQuery<IgdbGame[]>(
    'games',
    `search "${escaped}"; ${GAME_FIELDS} where version_parent = null; limit 30;`,
    signal
  );

  return (raw ?? []).map(toFullGame).map(toSearchResult);
}

async function getById(sourceId: string, signal?: AbortSignal): Promise<Game | null> {
  const numeric = Number(sourceId);
  if (!Number.isFinite(numeric)) return null;

  const raw = await igdbQuery<IgdbGame[]>(
    'games',
    `${GAME_FIELDS} where id = ${numeric}; limit 1;`,
    signal
  );

  const first = raw?.[0];
  return first ? toFullGame(first) : null;
}

// ---------------------------------------------------------------------------
// The spotlight: what Search's slider opens on
// ---------------------------------------------------------------------------

/**
 * `GAME_FIELDS` and the three things choosing a slide needs on top of it: how
 * followed a game is, how many have rated it, and how exactly its date is
 * known. The whole record rides along on purpose — a slide opens the game's
 * page, and a complete record is what lets it open without a second request.
 */
const SPOTLIGHT_FIELDS = GAME_FIELDS.trim().replace(
  /;$/,
  `, hypes, total_rating_count, release_dates.date, release_dates.date_format;`
);

type IgdbSpotlightGame = IgdbGame & {
  hypes?: number;
  total_rating_count?: number;
  release_dates?: { date?: number; date_format?: number }[];
};

/** How many of the window's most-followed games are weighed for the two "new" slides. */
const SPOTLIGHT_WINDOW = 40;
/** How many of the most-followed games still to come are looked at for one with usable art. */
const SPOTLIGHT_AWAITED = 8;

/** One game on the slider: the row a tap opens, its landscape art, and its date. */
export type SpotlightGame = {
  game: GameSearchResult;
  /** Landscape key art at the slide's own size. */
  art: string;
  /** Unix seconds, midnight UTC of the release day. */
  releasedAt: number;
  precision: DatePrecision;
};

export type Spotlight = {
  /** The biggest games that have just come out — at most two. */
  fresh: SpotlightGame[];
  /**
   * Explore's carousel, on portrait art: the biggest just out, then the most
   * awaited (`pickPortraits`). `art` is the landscape art where there is any,
   * else empty — the carousel draws the cover. Optional: a spotlight kept on
   * the device from before it has none.
   */
  portraits?: SpotlightGame[];
  /** The most followed game still to come. */
  awaited: SpotlightGame | null;
  /** The days of this month a notable game releases on, for the calendar slide. */
  releaseDays: number[];
};

/**
 * The games Search's slider opens on: the two biggest releases of the month,
 * and the most awaited game still to come.
 *
 * Two requests, in parallel. The first is the forty most-followed games from
 * the start of the window to the end of this month — the releases to rank
 * (`pickFresh`), and the days the calendar slide lights. The second is the
 * eight most-followed games with a date still ahead, because the most awaited
 * game is rarely due this month. Which rows become slides is decided in
 * `spotlight.ts`, which is pure and tested.
 *
 * Art is `t_720p`: the slide is the display's width by two thirds of it, 1080
 * by 720 pixels on a 3x phone, which 1280x720 fills at its own height. The
 * hero's 1080p would be twice the bytes for nothing the slot can show.
 */
export async function getSpotlight(now: number, signal?: AbortSignal): Promise<Spotlight> {
  const filter = 'hypes != null & cover != null & version_parent = null';

  const [recent, upcoming] = await Promise.all([
    igdbQuery<IgdbSpotlightGame[]>(
      'games',
      `${SPOTLIGHT_FIELDS}
       where first_release_date >= ${freshFrom(now)}
         & first_release_date < ${monthEnd(now)} & ${filter};
       sort hypes desc; limit ${SPOTLIGHT_WINDOW};`,
      signal
    ),
    igdbQuery<IgdbSpotlightGame[]>(
      'games',
      `${SPOTLIGHT_FIELDS}
       where first_release_date > ${now} & ${filter};
       sort hypes desc; limit ${SPOTLIGHT_AWAITED};`,
      signal
    ),
  ]);

  type Row = SpotlightCandidate & { slide: SpotlightGame | null; card: SpotlightGame };

  const describe = (raw: IgdbSpotlightGame): Row | null => {
    if (!raw.first_release_date) return null;
    const hero = chooseHero(raw.artworks, raw.screenshots);
    const art = imageUrl(hero?.image, '720p');
    const precision = precisionOf(raw.first_release_date, raw.release_dates);

    return {
      id: makeGameId('igdb', raw.id),
      releasedAt: raw.first_release_date,
      precision,
      hypes: raw.hypes ?? 0,
      ratings: raw.total_rating_count ?? 0,
      artAspect: art ? (hero?.aspect ?? null) : null,
      slide: art
        ? {
            game: toSearchResult(toFullGame(raw)),
            art,
            releasedAt: raw.first_release_date,
            precision,
          }
        : null,
      card: {
        game: toSearchResult(toFullGame(raw)),
        art: art ?? '',
        releasedAt: raw.first_release_date,
        precision,
      },
    };
  };

  const present = (row: Row | null): row is Row => row !== null;
  const window = (recent ?? []).map(describe).filter(present);
  const ahead = (upcoming ?? []).map(describe).filter(present);

  const fresh = pickFresh(window, now);
  const awaited = pickAwaited(
    [...ahead, ...window],
    now,
    fresh.map((row) => row.id)
  );

  const slideOf = (row: Row) => row.slide;
  const portraits = pickPortraits(window, ahead, now);
  return {
    fresh: fresh.map(slideOf).filter((slide): slide is SpotlightGame => slide !== null),
    portraits: [...portraits.fresh, ...portraits.awaited].map((row) => row.card),
    awaited: awaited?.slide ?? null,
    releaseDays: releaseDaysOf(window, now),
  };
}

/**
 * IGDB's own "you might also like" list for a game.
 *
 * `similar_games` is a field on `games`, not a separate endpoint, so this needs
 * no change to the Edge Function allowlist. Only meaningful for IGDB-sourced
 * games — Steam, RAWG and itch.io ids have no equivalent, and the aggregator in
 * index.ts returns an empty list for them rather than guessing.
 */
export async function getSimilarGames(
  sourceId: string,
  signal?: AbortSignal
): Promise<GameSearchResult[]> {
  const numeric = Number(sourceId);
  if (!Number.isFinite(numeric)) return [];

  const raw = await igdbQuery<{ similar_games?: IgdbGame[] }[]>(
    'games',
    `fields similar_games.name, similar_games.total_rating,
            similar_games.first_release_date, similar_games.cover.image_id,
            similar_games.artworks.image_id, similar_games.screenshots.image_id;
     where id = ${numeric};
     limit 1;`,
    signal
  );

  const similar = raw?.[0]?.similar_games ?? [];
  return similar.map((game) => toSearchResult(toGame(game)));
}

// ---------------------------------------------------------------------------
// Onboarding: whole games, for a flow that saves what it shows
// ---------------------------------------------------------------------------

/**
 * A title search that answers whole games, not rows.
 *
 * Onboarding's favourites step writes what is picked straight into a list,
 * and `addToList` caches the game first — which needs a `Game`. The ordinary
 * search cuts each one down to a row; this keeps them whole (and remembers
 * them for the game page, as every full-field list does). Covers only: a
 * favourite is shown as its box.
 */
export async function searchWholeGames(term: string, signal?: AbortSignal): Promise<Game[]> {
  const trimmed = term.trim();
  if (!trimmed) return [];

  const raw = await igdbQuery<IgdbGame[]>(
    'games',
    `search "${quote(trimmed)}"; ${GAME_FIELDS} where version_parent = null & cover != null; limit 24;`,
    signal
  );
  return (raw ?? []).map(toFullGame);
}

/**
 * Whole games matching a `where` clause, the most-rated first — or in `sort`'s
 * order (Home's Quick picks ask for the best-scored).
 *
 * The clause is built by a pure, tested module — `lib/onboarding.ts`
 * (`picksClause`, `pickingGridClause`), `lib/games/moods.ts` — and this only
 * sends it.
 */
export async function getGamesWhere(
  where: string,
  limit: number,
  signal?: AbortSignal,
  sort = 'total_rating_count desc'
): Promise<Game[]> {
  const raw = await igdbQuery<IgdbGame[]>(
    'games',
    `${GAME_FIELDS} where ${where}; sort ${sort}; limit ${limit};`,
    signal
  );
  return (raw ?? []).map(toFullGame);
}

/**
 * The IGDB ids of the games IGDB calls similar to each of these, in one
 * request — one list per game, in IGDB's order, so a caller can interleave.
 */
export async function getSimilarIds(ids: readonly number[], signal?: AbortSignal) {
  if (ids.length === 0) return [];
  const raw = await igdbQuery<{ id: number; similar_games?: number[] }[]>(
    'games',
    `fields similar_games; where id = (${ids.join(',')}); limit ${ids.length};`,
    signal
  );
  return ids.map((id) => raw?.find((row) => row.id === id)?.similar_games ?? []);
}

// ---------------------------------------------------------------------------
// Franchise, studio and cast
// ---------------------------------------------------------------------------

export type GameCompany = { id: number; name: string; role: 'developer' | 'publisher' };

/** A game's series, its franchises, and the companies behind it. */
export type GameExtras = {
  /** IGDB's `collection` — the numbered series, e.g. "Grand Theft Auto". */
  collection: { id: number; name: string } | null;
  /** Broader franchises the game belongs to. A game can be in several. */
  franchises: { id: number; name: string }[];
  companies: GameCompany[];
  /** The game's trailer on YouTube, when IGDB lists one (`pickTrailer`). */
  trailer: GameTrailer | null;
  /**
   * The official stores IGDB links the game to, one a store, in the order
   * "Where to buy" draws them (`pickStorefronts`).
   *
   * Optional because a row saved on the device before this field existed
   * comes back without it (CLAUDE.md, § Loading) until it is refetched.
   */
  stores?: StoreLink[];
  /** The Steam appid, when IGDB lists the game on Steam. */
  steamAppId?: string | null;
};

type IgdbExtras = {
  collection?: { id: number; name?: string };
  franchises?: { id: number; name?: string }[];
  involved_companies?: {
    developer?: boolean;
    publisher?: boolean;
    company?: { id: number; name?: string };
  }[];
  videos?: { video_id?: string; name?: string }[];
} & IgdbStoreFields;

/**
 * The identifiers the Overview tab needs to make its sections navigable.
 *
 * Kept separate from `getById` because `Game` is the shared cross-provider shape
 * and only IGDB has these — putting nullable IGDB ids on every Steam and RAWG
 * game to serve one screen would be the wrong trade.
 */
export async function getGameExtras(
  sourceId: string,
  signal?: AbortSignal
): Promise<GameExtras | null> {
  const numeric = Number(sourceId);
  if (!Number.isFinite(numeric)) return null;

  const raw = await igdbQuery<IgdbExtras[]>(
    'games',
    `fields collection.id, collection.name, franchises.id, franchises.name,
            involved_companies.developer, involved_companies.publisher,
            involved_companies.company.id, involved_companies.company.name,
            videos.video_id, videos.name,
            websites.type, websites.url,
            external_games.external_game_source, external_games.uid, external_games.url;
     where id = ${numeric};
     limit 1;`,
    signal
  );

  const first = raw?.[0];
  if (!first) return null;

  const companies: GameCompany[] = [];
  for (const entry of first.involved_companies ?? []) {
    if (!entry.company?.id || !entry.company.name) continue;
    // A company can be both; the developer credit is the more interesting one.
    const role = entry.developer ? 'developer' : entry.publisher ? 'publisher' : null;
    if (!role) continue;
    if (companies.some((existing) => existing.id === entry.company!.id)) continue;
    companies.push({ id: entry.company.id, name: entry.company.name, role });
  }

  return {
    collection:
      first.collection?.id && first.collection.name
        ? { id: first.collection.id, name: first.collection.name }
        : null,
    franchises: (first.franchises ?? [])
      .filter((entry): entry is { id: number; name: string } => !!entry.id && !!entry.name)
      .map((entry) => ({ id: entry.id, name: entry.name })),
    companies,
    trailer: pickTrailer(first.videos),
    ...pickStorefronts(first),
  };
}

/**
 * Every game in a series, oldest first.
 *
 * Ordered by release rather than rating because a franchise list is read as a
 * chronology — "what came before this one" — not as a leaderboard.
 */
/**
 * The clause that keeps a series rail to the games themselves.
 *
 * `version_parent = null` was already dropping repackages — "Game of the Year
 * Edition" and friends. `game_type = 0` additionally drops remakes, remasters,
 * ports, DLC, expansions and bundles, which were filling a franchise rail with
 * things that are not entries in the series: Mafia's rail listed Mafia, Mafia
 * II, Mafia III *and* three Definitive Editions, so the same games appeared
 * twice and the chronology stopped being one.
 *
 * They have not gone anywhere — the parent game's own page lists them under
 * "Editions & extras", which is the question they actually answer.
 */
const ORIGINALS_ONLY = 'version_parent = null & game_type = 0';

export async function getCollectionGames(
  collectionId: number,
  signal?: AbortSignal
): Promise<GameSearchResult[]> {
  const raw = await igdbQuery<IgdbGame[]>(
    'games',
    `${GAME_FIELDS}
     where collection = ${collectionId} & ${ORIGINALS_ONLY};
     sort first_release_date asc;
     limit 50;`,
    signal
  );
  return (raw ?? []).map(toFullGame).map(toSearchResult);
}

export async function getFranchiseGames(
  franchiseId: number,
  signal?: AbortSignal
): Promise<GameSearchResult[]> {
  const raw = await igdbQuery<IgdbGame[]>(
    'games',
    `${GAME_FIELDS}
     where franchises = (${franchiseId}) & ${ORIGINALS_ONLY};
     sort first_release_date asc;
     limit 50;`,
    signal
  );
  return (raw ?? []).map(toFullGame).map(toSearchResult);
}

/**
 * Everything that descends from one game: its remakes, remasters, ports, DLC,
 * expansions, bundles and repackaged editions.
 *
 * One query, not eight. IGDB exposes this as reverse relations on the parent
 * (`remakes`, `dlcs`, `expansions`, …) and the obvious implementation reads
 * those arrays and then fetches each id — nine round trips to fill one rail.
 * Asking the *children* which parent they point at is the same answer in a
 * single request, and it catches both relationships at once: `parent_game` for
 * a remake or a DLC, `version_parent` for a repackage.
 *
 * Sorted here rather than by IGDB, because the useful order mixes two fields —
 * kind first (see `editionRank`: other versions of the game before add-ons to
 * it), release date second — and APIcalypse cannot express that.
 */
export async function getGameEditions(
  sourceId: string,
  signal?: AbortSignal
): Promise<GameSearchResult[]> {
  const numeric = Number(sourceId);
  if (!Number.isFinite(numeric)) return [];

  const raw = await igdbQuery<IgdbGame[]>(
    'games',
    `${GAME_FIELDS}
     where parent_game = ${numeric} | version_parent = ${numeric};
     limit 50;`,
    signal
  );

  return (raw ?? [])
    .map(toFullGame)
    .map(toSearchResult)
    .sort(
      (a, b) =>
        editionRank(a.edition) - editionRank(b.edition) ||
        (a.releaseYear ?? 0) - (b.releaseYear ?? 0)
    );
}

/** A studio as IGDB names it: the identity a logo lookup starts from. */
export type CompanyIdentity = { id: number; name: string; slug: string | null };

/** A company's identity, and the ids of every game it developed or published. */
export type StudioCompany = { identity: CompanyIdentity | null; gameIds: number[] };

/**
 * The first half of a studio's catalogue: who the company is, and which games.
 *
 * One small request to `companies`, whose `developed` and `published` lists are
 * the company's games already resolved — the fast question. Asking `games` for
 * `involved_companies.company = X` instead makes IGDB work out that join itself,
 * and it is slow in a way the payload does not explain: measured through the
 * deployed function, FromSoftware took 5.2–5.5s, Rockstar Games 4.5s and Naughty
 * Dog 3.1–3.3s, where this and `getStudioGames` together take 1.7–2.1s for every
 * studio tried, Nintendo's 2,953 ids included.
 *
 * The same response carries the name and slug — the slug is the exact key
 * Wikidata files IGDB companies under (P9650), which is how the studio page
 * finds a studio's logo without matching on a name — so the logo lookup reads
 * them from here rather than asking IGDB a second time.
 *
 * Developed and published only: a company credited just for porting or support
 * work on a game is not listed for it. Against the involvement query that cost
 * one game in each of Capcom's and Electronic Arts' newest 200 (a licensed
 * Evercade cabinet, and a mobile spin-off) and none anywhere else tried. A
 * company with no games of its own at all is the case that would be wrong, so
 * `getStudioGames` asks by involvement for exactly that one.
 */
export async function getStudioCompany(
  companyId: number,
  signal?: AbortSignal
): Promise<StudioCompany> {
  const raw = await igdbQuery<
    { id: number; name?: string; slug?: string; developed?: number[]; published?: number[] }[]
  >(
    'companies',
    `fields name, slug, developed, published; where id = ${companyId}; limit 1;`,
    signal
  );
  const first = raw?.[0];
  return {
    identity: first?.name ? { id: first.id, name: first.name, slug: first.slug ?? null } : null,
    gameIds: [...new Set([...(first?.developed ?? []), ...(first?.published ?? [])])],
  };
}

/**
 * Only what the studio page draws: a title, a cover, one piece of key art, a
 * year, a score and an edition.
 *
 * `GAME_FIELDS` also carries every game's summary, storyline, genres,
 * platforms, companies and storefronts — 406 KB for Capcom's 200 games and
 * 379 KB for FromSoftware's 155, all of it parsed on the JS thread and none of
 * it on screen. This is a third of that. Screenshots stay, as the banner's
 * fallback for a game with no key art; artworks bring their size, so a banner
 * that is a wordmark strip is passed over before anything downloads it.
 */
const STUDIO_FIELDS = `
  fields name, total_rating, total_rating_count, first_release_date, cover.image_id,
         artworks.image_id, artworks.width, artworks.height, screenshots.image_id,
         game_type, parent_game, version_parent, version_title,
         franchises.id, franchises.name, genres.name;
`;

/**
 * A game on the studio page: a search result, and what its sections are drawn
 * from — how many ratings it has ("Most popular") and its franchises (a rail
 * each). Optional, because a catalogue saved on the device before they were
 * asked for has neither.
 */
export type StudioGame = GameSearchResult & {
  ratingCount?: number | null;
  franchises?: { id: number; name: string }[];
};

/**
 * Past this many ids the query is asked by involvement instead. Nintendo's
 * 2,953 went through by id in under a second, so this is a guard against a
 * request body nobody has measured, not a tuned number.
 */
const MAX_ID_FILTER = 5000;

/**
 * A studio's catalogue, repackages included: its 200 newest games with covers,
 * from the ids `getStudioCompany` found.
 *
 * ## Repackages are not filtered out here
 *
 * "Game of the Year Edition" rows are repackages of a game already in the list,
 * and left in a flat grid they fill a prolific publisher's page with the same
 * three covers in a row — which is why a `version_parent = null` filter still
 * guards every *search* path in this file. The studio screen does not render one
 * flat grid: it partitions this list, `edition` and `bundle` into a rail of their
 * own and everything else into the catalogue, so the duplicates are the contents
 * of a section that says what they are. The caller must keep partitioning. Drop
 * that and this returns straight to the shape the filter was written against.
 *
 * 200 rather than 100 because repackages compete for the same budget; IGDB's own
 * ceiling is 500.
 *
 * ## The hero is the first art that can be a banner
 *
 * `maxHeroAspect` is the widest artwork the caller can crop. Elden Ring's first
 * "artwork" is a 1920×295 wordmark strip; with sizes in hand its key art is
 * chosen instead, rather than the strip being downloaded at 1080p, rejected on
 * load and the banner moving on to another game. Artwork IGDB sent without a
 * size is taken on trust — the screen still checks what actually loads.
 */
export async function getStudioGames(
  companyId: number,
  gameIds: readonly number[],
  { maxHeroAspect }: { maxHeroAspect: number },
  signal?: AbortSignal
): Promise<StudioGame[]> {
  const byId = gameIds.length > 0 && gameIds.length <= MAX_ID_FILTER;
  const raw = await igdbQuery<IgdbGame[]>(
    'games',
    `${STUDIO_FIELDS}
     where ${byId ? `id = (${gameIds.join(',')})` : `involved_companies.company = ${companyId}`}
       & cover != null;
     sort first_release_date desc;
     limit 200;`,
    signal
  );
  return (raw ?? []).map((game) => ({
    ...toSearchResult({ ...toGame(game), heroUrl: bannerArtOf(game, maxHeroAspect) }),
    ratingCount: game.total_rating_count ?? null,
    franchises: (game.franchises ?? [])
      .filter((franchise): franchise is { id: number; name: string } => !!franchise.name)
      .map((franchise) => ({ id: franchise.id, name: franchise.name })),
  }));
}

/** The first artwork no wider than `maxAspect`, else the first screenshot, at 1080p. */
function bannerArtOf(raw: IgdbGame, maxAspect: number): string | null {
  const artwork = raw.artworks?.find(
    (image) => !image.width || !image.height || image.width / image.height <= maxAspect
  );
  return imageUrl(artwork, '1080p') ?? imageUrl(raw.screenshots?.[0], '1080p');
}

/* -------------------------------------------------------------------------
 * Filtered search
 *
 * The plain `search` above is the one every browse screen uses: a title, ranked
 * by IGDB's relevance, and nothing else. Award shows need the other question —
 * "what came out in 2019 that was a Nintendo Switch platformer" — where the term
 * is optional and the filters are the query.
 * ---------------------------------------------------------------------------- */

/** One entry from IGDB's `genres` or `platforms` reference tables. */
export type IgdbTag = { id: number; name: string };

/**
 * Every filter the award picker can apply. All optional; all combinable.
 *
 * Ids rather than names for genre and platform because IGDB indexes those and
 * matching on the nested name is both slower and ambiguous ("Adventure" also
 * matches "Point-and-click Adventure"). Studio is a name, because there is no
 * company picker to choose an id from — see `studio` below.
 */
export type GameFilters = {
  /** Free text. Optional: filters alone are a valid query. */
  term?: string;
  genreId?: number | null;
  platformId?: number | null;
  /** Developer or publisher name, matched case-insensitively as a substring. */
  studio?: string | null;
  /** Inclusive release year range. Either end may stand alone. */
  fromYear?: number | null;
  toYear?: number | null;
};

/** IGDB's earliest dated release is 1958 (Tennis for Two). */
export const EARLIEST_IGDB_YEAR = 1958;

/** Unix seconds for 1 January of `year`, which is how IGDB stores release dates. */
function yearStart(year: number): number {
  return Math.floor(Date.UTC(year, 0, 1) / 1000);
}

/** Escapes a value for an APIcalypse string literal. See `search`. */
function quote(value: string): string {
  return value.trim().replace(/"/g, '\\"');
}

/**
 * Search the catalogue with any combination of term, genre, platform, studio
 * and release-year range.
 *
 * ## Why the sort is conditional
 *
 * IGDB rejects `sort` on a `search` query — search results *are* an ordering, by
 * relevance, and asking for a second one is an error rather than a tiebreak. So
 * a query with a term keeps relevance order, and a query without one is sorted
 * newest-first, which is the only useful default when the filters are doing all
 * the work. Callers that want another order re-sort in memory with `sortGames`.
 *
 * ## Why `total_rating_count` on the filters-only path
 *
 * "Everything on Switch" is forty thousand rows and the first page of them by
 * date is shovelware. Requiring a handful of ratings is the cheapest available
 * proxy for "a real release", and it is only applied when there is no term —
 * with a term the user has already said what they want and filtering it out
 * because nobody rated it would be wrong.
 */
export async function searchGamesFiltered(
  filters: GameFilters,
  signal?: AbortSignal
): Promise<GameSearchResult[]> {
  const term = filters.term?.trim() ?? '';
  const where: string[] = ['version_parent = null'];

  if (filters.genreId) where.push(`genres = (${filters.genreId})`);
  if (filters.platformId) where.push(`platforms = (${filters.platformId})`);
  if (filters.studio?.trim()) {
    where.push(`involved_companies.company.name ~ *"${quote(filters.studio)}"*`);
  }
  if (filters.fromYear) where.push(`first_release_date >= ${yearStart(filters.fromYear)}`);
  // Exclusive upper bound on 1 Jan of the *next* year, so `toYear` is inclusive.
  if (filters.toYear) where.push(`first_release_date < ${yearStart(filters.toYear + 1)}`);

  if (!term) where.push('total_rating_count >= 5');

  const clause = `where ${where.join(' & ')};`;
  const body = term
    ? `search "${quote(term)}"; ${GAME_FIELDS} ${clause} limit 40;`
    : `${GAME_FIELDS} ${clause} sort first_release_date desc; limit 40;`;

  const raw = await igdbQuery<IgdbGame[]>('games', body, signal);
  return (raw ?? []).map(toFullGame).map(toSearchResult);
}

/* -------------------------------------------------------------------------
 * Facets — a game's genres, themes, engine… as ways to more games
 * ---------------------------------------------------------------------- */

/**
 * Engines, series or franchises whose names match what was typed, best first.
 *
 * - **Series and franchises** have their own endpoints, both allowed; `search`
 *   is refused on them, as on companies (§ Search), so they are matched with
 *   `name ~ *"…"*` and ranked here (`matchValues`).
 * - **Engines** have one too, `game_engines`, and it is *not* allowed — so the
 *   question goes through `games`: the most-rated games whose engine's name
 *   matches, every engine on them counted (`tallyValues`), the ones whose name
 *   matches kept. The engine most games use leads a tie. Verified live:
 *   "unreal" finds Unreal Engine 1 through 5.
 */
export async function searchFacetValues(
  kind: FacetKind,
  term: string,
  signal?: AbortSignal
): Promise<FacetValue[]> {
  const typed = term.trim();
  if (!typed) return [];
  const like = `name ~ *"${quote(typed)}"*`;

  if (kind === 'series' || kind === 'franchise') {
    const raw = await igdbQuery<IgdbNamed[]>(
      kind === 'series' ? 'collections' : 'franchises',
      `fields name; where ${like}; limit 50;`,
      signal
    );
    return matchValues(tagsOf(raw), typed).slice(0, 30);
  }

  if (kind === 'engine') {
    const raw = await igdbQuery<{ game_engines?: IgdbNamed[] }[]>(
      'games',
      `fields game_engines.name; where game_engines.${like}; sort total_rating_count desc; limit 500;`,
      signal
    );
    const tallied = tallyValues((raw ?? []).map((game) => tagsOf(game.game_engines)));
    return matchValues(tallied, typed).slice(0, 30);
  }

  return [];
}

/* -------------------------------------------------------------------------
 * Surprise Me — one batch of candidate games
 * ---------------------------------------------------------------------- */

/** Which slice of the catalogue a roll draws from. */
export type SurprisePool = 'random' | 'popular' | 'hidden';

/**
 * The narrowing a roll may carry on top of its pool.
 *
 * Separate from `SurprisePool` because the two answer different questions. The
 * pool is *which slice of the catalogue* — famous, obscure, anything — and is
 * one of three. These are *what the game has to be*, and every one of them is
 * optional, combinable and orthogonal to the pool: "a hidden gem, isometric,
 * rated 80 or better" is a coherent request and needs no fourth pool.
 *
 * Every field is a list or a bound rather than a single value, so an empty list
 * and a null bound mean "no constraint" and nothing has to encode "all".
 */
export type SurprisePoolFilters = {
  /**
   * IGDB genre ids, **matched as "any of"**.
   *
   * `(a,b,c)` in APIcalypse, not `{a,b,c}`. Picking three genres means "I would
   * take any of these", which is what a person choosing *more* boxes expects
   * from a discovery feature — and "all of" is the reading that quietly returns
   * nothing, since a game tagged Platformer **and** Horror **and** Racing
   * roughly does not exist. Widening as you select is the only behaviour here
   * that cannot dead-end.
   */
  genreIds?: readonly number[];
  /** IGDB player-perspective ids, matched the same way. See `constants/player-perspectives.ts`. */
  perspectiveIds?: readonly number[];
  /**
   * A floor on IGDB's own aggregate, 0-100, or null for none.
   *
   * IGDB's number, not the app's: this filters the *catalogue*, and `logs.rating`
   * only exists for games somebody here has already logged — which is almost
   * none of the pool a roll draws from. The masthead already labels the same
   * figure `COMMUNITY`, so the two agree about whose score it is.
   */
  minRating?: number | null;
  /** IGDB theme ids, "any of". See `lib/games/facets.ts`. */
  themeIds?: readonly number[];
  /** IGDB game-mode ids, "any of". */
  modeIds?: readonly number[];
  /**
   * Platform families, each its machines' IGDB ids. A game is on a family when
   * it is on any of its machines; combined, it must be on every family chosen.
   */
  platformGroups?: readonly (readonly number[])[];
  /**
   * How the picks combine — the owner's selection mode (2026-10-16). `any`, a
   * game with at least one pick in each list; `all`, "Combined", a game with
   * every pick — every genre, every theme, every family…
   */
  match?: 'all' | 'any';
  /** IGDB language ids: a game with any support in any of them. */
  languageIds?: readonly number[];
  /**
   * RAWG tag ids. Not a clause of IGDB's: with any set, the batch is drawn
   * from RAWG's games with them and this query's clause narrows those
   * (`getSurpriseBatch` → `getTagSurprisePool`).
   */
  tagIds?: readonly number[];
  /** Released in or after this year, in or before that one. Null for no bound. */
  fromYear?: number | null;
  toYear?: number | null;
};

/**
 * How many games one request brings back.
 *
 * This is the number that decides the feature's API cost. The screen keeps the
 * batch and walks a cursor through it, so "Another game" is fifty presses of
 * free before a second request is needed. IGDB's own ceiling is 500, but a
 * larger batch is dead weight — nobody rerolls fifty times, and the unused rows
 * are paid for in latency on the roll that matters, the first one.
 */
const SURPRISE_BATCH = 50;

/**
 * The furthest into a sorted result set a roll will reach.
 *
 * `offset` is not used anywhere else in this codebase and IGDB's own behaviour
 * at large offsets is documented only as "degrades", so this stays well short
 * of anywhere interesting happens. `SURPRISE_BATCH` is subtracted so
 * `offset + limit` never crosses 5000.
 */
const MAX_OFFSET = 5000 - SURPRISE_BATCH;

/**
 * The same ceiling, for a roll that carries filters.
 *
 * An unfiltered pool is tens of thousands of rows deep and a random offset
 * anywhere in the first 5,000 lands on something. One genre plus a rating floor
 * can be a few hundred rows in total, and at that size the *usual* outcome of a
 * 5,000-deep offset is an empty page — the retry at `offset 0` then serves the
 * top of the list, so "completely random with two boxes ticked" would quietly
 * become "the same forty games, every time".
 *
 * 450 keeps the offset inside the range a narrow filter plausibly has, and a
 * pool smaller than that still falls back to its own first page, which for a
 * pool that small genuinely is a fine answer.
 */
const FILTERED_MAX_OFFSET = 450;

/**
 * Orderings for the `random` pool.
 *
 * A single fixed sort plus a capped offset can only ever reach the first
 * `MAX_OFFSET` games of one ordering — the same ~5,000 rows, roll after roll,
 * which would make "Completely random" a claim the code does not honour.
 * Choosing the ordering at random too multiplies the reachable window by eight
 * for the cost of an array. `id` is included because it is effectively catalogue
 * insertion order, which correlates with nothing a player would notice — the
 * most genuinely arbitrary axis available.
 */
const RANDOM_SORTS = [
  'id asc',
  'id desc',
  'first_release_date asc',
  'first_release_date desc',
  'total_rating_count asc',
  'total_rating_count desc',
  'total_rating asc',
  'total_rating desc',
] as const;

function randomInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

function pickOne<T>(values: readonly T[]): T {
  return values[randomInt(values.length)];
}

/**
 * A batch of candidate games for one Surprise Me roll.
 *
 * ## Why three pools rather than one query with knobs
 *
 * "Popular", "hidden gem" and "random" are not three intensities of the same
 * filter — they are three different questions, and each one needs a different
 * `sort` as well as a different `where`. Hidden gems in particular cannot be
 * expressed as "popular, but less": the defining trait is a *high rating from
 * few raters*, which is a ratio, and reversing the popular sort just returns
 * the games nobody rated because they are bad.
 *
 * ## The shared floor
 *
 * Every pool requires `cover != null` (the whole interface is box art, and a
 * lettered placeholder is not a discovery) and `version_parent = null`, so a
 * roll lands on Dark Souls rather than on Dark Souls: Prepare to Die Edition.
 * `searchGamesFiltered` applies the same two for the same reasons.
 *
 * ## Randomness
 *
 * IGDB has no `sort random`, so the randomness is a random `offset` into a
 * sorted set — plus, for the `random` pool, a random ordering to sort by. An
 * empty response means the offset landed past the end of that pool; the one
 * retry at `offset 0` is there because a pool small enough for that to happen
 * is small enough that the first page is a fine answer.
 *
 * ## Filters sit on top of the pool, not beside it
 *
 * `filters` adds `where` clauses and changes nothing else — not the sort, not
 * the batch size, not the retry. A pool is a slice of the catalogue and a filter
 * is a property of a game, so they compose: "hidden gem" keeps its rating
 * ceiling and its rating-descending sort whether or not a genre is also named.
 * The one thing they do change is how deep the random offset may reach; see
 * `FILTERED_MAX_OFFSET`.
 */
/**
 * The `where` and `sort` one pool resolves to, built once and read twice.
 *
 * Extracted so `getSurprisePoolSize` below asks IGDB about **the same set of
 * games** the roll will draw from. A count built from a second, hand-copied
 * clause is worse than no count at all: it would confidently report a number for
 * a query nobody runs, and the two would drift the first time either changed.
 */
export function surprisePoolQuery(
  pool: SurprisePool,
  filters: SurprisePoolFilters
): { clause: string; sort: string; filtered: boolean } {
  const where = ['cover != null', 'version_parent = null'];
  let sort: string;

  if (pool === 'popular') {
    // Two hundred ratings is roughly "a game people have heard of". Sorting by
    // the count rather than the score is deliberate: this pool answers "famous",
    // and the best-*reviewed* games are a different, much narrower list.
    where.push('total_rating_count >= 200');
    sort = 'total_rating_count desc';
  } else if (pool === 'hidden') {
    // Well liked, by few. The upper bound is what makes it a hidden gem rather
    // than a good game; the lower bound is what keeps it from being an accident
    // of three friends rating their mate's jam entry.
    where.push('total_rating >= 75', 'total_rating_count >= 8', 'total_rating_count <= 60');
    sort = 'total_rating desc';
  } else {
    // The same shovelware floor `searchGamesFiltered` uses on its filters-only
    // path. Without it "random" mostly returns store listings nobody has played.
    where.push('total_rating_count >= 5');
    sort = pickOne(RANDOM_SORTS);
  }

  /*
   * `(…)` is "has any of these", which is the reading that widens as you tick
   * more boxes. See `SurprisePoolFilters.genreIds` for why the alternative is
   * a dead end rather than a preference.
   */
  const genreIds = filters.genreIds ?? [];
  const perspectiveIds = filters.perspectiveIds ?? [];
  /* `(a,b)` is any of them; `[a,b]` all of them — combined. Checked live:
     `genres = [12,31]` is a game that is both. */
  const combined = filters.match === 'all';
  const list = (ids: readonly number[]) => (combined ? `[${ids.join(',')}]` : `(${ids.join(',')})`);
  if (genreIds.length > 0) where.push(`genres = ${list(genreIds)}`);
  if (perspectiveIds.length > 0) {
    where.push(`player_perspectives = ${list(perspectiveIds)}`);
  }
  /*
   * `> 0` rather than `!= null`: zero is the "no minimum" value the picker
   * writes, and a `total_rating >= 0` clause is not harmless — it silently drops
   * every unrated game, which is most of the catalogue and exactly what the
   * "Any" option promises to keep.
   */
  if (filters.minRating != null && filters.minRating > 0) {
    where.push(`total_rating >= ${Math.round(filters.minRating)}`);
  }

  /* The rest, each "any of" as genres are, and each only when set. */
  const anyOf = (field: string, ids: readonly number[] | undefined) => {
    const whole = (ids ?? []).filter((id) => Number.isInteger(id) && id > 0);
    if (whole.length > 0) where.push(`${field} = ${list(whole)}`);
    return whole.length > 0;
  };
  /* A family is any of its machines either way; what combining changes is
     whether a game must be on one family or on every one. */
  const families = (filters.platformGroups ?? [])
    .map((ids) => ids.filter((id) => Number.isInteger(id) && id > 0))
    .filter((ids) => ids.length > 0);
  if (families.length > 0) {
    if (combined) for (const ids of families) where.push(`platforms = (${ids.join(',')})`);
    else where.push(`platforms = (${[...new Set(families.flat())].join(',')})`);
  }
  const more =
    [
      anyOf('themes', filters.themeIds),
      anyOf('game_modes', filters.modeIds),
      anyOf('language_supports.language', filters.languageIds),
    ].some(Boolean) || families.length > 0;
  if (filters.fromYear) where.push(`first_release_date >= ${yearStart(filters.fromYear)}`);
  if (filters.toYear) where.push(`first_release_date < ${yearStart(filters.toYear + 1)}`);

  const filtered =
    genreIds.length > 0 ||
    perspectiveIds.length > 0 ||
    !!filters.minRating ||
    more ||
    !!filters.fromYear ||
    !!filters.toYear;
  return { clause: `where ${where.join(' & ')};`, sort, filtered };
}

export async function getSurprisePool(
  pool: SurprisePool,
  filters: SurprisePoolFilters = {},
  signal?: AbortSignal
): Promise<GameSearchResult[]> {
  const { clause, sort, filtered } = surprisePoolQuery(pool, filters);

  async function fetchAt(offset: number): Promise<GameSearchResult[]> {
    const body = `${GAME_FIELDS} ${clause} sort ${sort}; limit ${SURPRISE_BATCH}; offset ${offset};`;
    const raw = await igdbQuery<IgdbGame[]>('games', body, signal);
    return (raw ?? []).map(toFullGame).map(toSearchResult);
  }

  const offset = randomInt(filtered ? FILTERED_MAX_OFFSET : MAX_OFFSET);
  const games = await fetchAt(offset);
  if (games.length > 0 || offset === 0) return games;

  return fetchAt(0);
}

/** IGDB's hard ceiling on `limit`, and therefore the largest number we can count to. */
const POOL_SIZE_LIMIT = 500;

/** What `getSurprisePoolSize` reports: a count, and whether it hit the ceiling. */
export type SurprisePoolSize = { count: number; atLeast: boolean };

/**
 * How many games the current settings actually match.
 *
 * ## Why this is a `games` query and not `games/count`
 *
 * IGDB publishes `/games/count`, which is the obviously right endpoint: one
 * integer, exact, no ceiling. It is **not on the Edge Function's allowlist**, and
 * `ALLOWED_ENDPOINTS` is matched on the whole path — `games` does not admit
 * `games/count`. Adding it there does nothing until somebody runs
 * `supabase functions deploy igdb`, so a client built on it would report nothing
 * for every user on the currently deployed build, with no error and nothing to
 * fix client-side. That is the trap `player-perspectives.ts` documents and the
 * one the Top 10 is still sitting in.
 *
 * So this counts through `games`, which is already allowed and therefore works
 * today: `fields id;` — the smallest row IGDB will return — at `limit 500`, and
 * the answer is the length of the array. Five hundred ids is roughly 5 KB.
 *
 * ## Why a ceiling is honest here
 *
 * 500 is IGDB's maximum `limit`, so this cannot distinguish 500 from 40,000 and
 * reports `atLeast: true` when it lands on the ceiling. That asymmetry matches
 * the question: the reader is narrowing, and the whole value of a count is at the
 * *low* end, where it separates "six games" from "nothing at all" before a roll
 * is spent. At the top end "plenty" is the entire useful content of the number.
 *
 * **No offset and no sort.** Both are irrelevant to a count and a sort would make
 * IGDB order 500 rows for nothing.
 */
export async function getSurprisePoolSize(
  pool: SurprisePool,
  filters: SurprisePoolFilters = {},
  signal?: AbortSignal
): Promise<SurprisePoolSize> {
  const { clause } = surprisePoolQuery(pool, filters);
  const raw = await igdbQuery<{ id: number }[]>(
    'games',
    `fields id; ${clause} limit ${POOL_SIZE_LIMIT};`,
    signal
  );
  const count = (raw ?? []).length;
  return { count, atLeast: count >= POOL_SIZE_LIMIT };
}

/**
 * IGDB's genre and platform vocabularies, for the filter pickers.
 *
 * Both endpoints are already on the Edge Function allowlist. The lists are
 * static in practice — IGDB adds a platform every few years — so callers should
 * cache them for the session rather than refetching per keystroke.
 *
 * Platforms are capped and sorted by `generation` descending so the console
 * someone is likely to mean is near the top; IGDB lists ~220 platforms
 * including arcade boards and calculators, and an unsorted picker of those is
 * unusable.
 *
 * **`platform_type`, not `category`.** IGDB renamed the field (the numbers are
 * the same: 1 console, 5 handheld, 6 computer) and a `where` on the old name
 * does not fail — it matches nothing, so this returned an empty list and the
 * award picker's platform filter had no platforms in it. The same rename that
 * took `external_games.category`; see CLAUDE.md § Steam CDN artwork.
 */
export async function getGenres(signal?: AbortSignal): Promise<IgdbTag[]> {
  const raw = await igdbQuery<IgdbTag[]>(
    'genres',
    'fields name; sort name asc; limit 100;',
    signal
  );
  return (raw ?? []).filter((entry) => entry.name);
}

export async function getPlatforms(signal?: AbortSignal): Promise<IgdbTag[]> {
  const raw = await igdbQuery<(IgdbTag & { generation?: number })[]>(
    'platforms',
    'fields name, generation; where platform_type = (1,5,6); sort generation desc; limit 100;',
    signal
  );
  return (raw ?? []).filter((entry) => entry.name).map(({ id, name }) => ({ id, name }));
}

export const igdbProvider: GameProvider = {
  source: 'igdb',
  label: 'IGDB',
  // Enabled whenever Supabase is reachable — the Edge Function holds the keys,
  // so there is nothing for the client to configure.
  isEnabled: () => process.env.EXPO_PUBLIC_IGDB_ENABLED !== 'false',
  search,
  getById,
};

// ---------------------------------------------------------------------------
// Time to beat
// ---------------------------------------------------------------------------

/**
 * How long a game takes, in seconds, from IGDB's own aggregation.
 *
 * Three lengths and the number of submissions behind them. `count` is not
 * decoration: a "55 hours to complete" drawn from two people is a different
 * claim from one drawn from four hundred, and the widget prints it for exactly
 * that reason.
 */
export type TimeToBeat = {
  /** Straight through, skipping what can be skipped. */
  hastily: number | null;
  /** The way most people play it. */
  normally: number | null;
  /** Everything. */
  completely: number | null;
  /** How many players submitted times. */
  count: number;
};

type IgdbTimeToBeat = {
  game_id?: number;
  hastily?: number;
  normally?: number;
  completely?: number;
  count?: number;
};

/**
 * IGDB's `game_time_to_beats` endpoint — **plural**.
 *
 * A separate endpoint keyed by `game_id`, not a field on `games` — it cannot be
 * folded into `GAME_FIELDS` and has to be its own request.
 *
 * The path was spelled `game_time_to_beat` for this feature's entire life, and
 * IGDB answers that with a 404 — `Endpoint POST /game_time_to_beat not found`.
 * Every IGDB path is the plural of its record (`games`, `events`,
 * `popularity_primitives`); the singular here was the odd one out, and the
 * widget's `retry: false` turned the 404 into a section that simply never
 * appeared. Checked against IGDB's own schema (`api.igdb.com/v4/igdbapi.proto`,
 * `GameTimeToBeatResult.gametimetobeats`) rather than guessed a second time; the
 * field names below come from the same message and were right all along.
 *
 * **Seconds, not hours.** The API returns raw seconds and the widget divides;
 * treating them as minutes (the obvious guess) puts every game at sixty times
 * its real length, which reads as plausible for a long RPG and is the kind of
 * wrong that ships.
 *
 * Returns null rather than zeroes when IGDB has nothing, so the caller can drop
 * the section instead of drawing "0 H" three times.
 */
export async function getTimeToBeat(
  sourceId: string,
  signal?: AbortSignal
): Promise<TimeToBeat | null> {
  const numeric = Number(sourceId);
  if (!Number.isFinite(numeric)) return null;

  const raw = await igdbQuery<IgdbTimeToBeat[]>(
    'game_time_to_beats',
    `fields hastily, normally, completely, count;
     where game_id = ${numeric};
     limit 1;`,
    signal
  );

  const first = raw?.[0];
  if (!first) return null;

  const value = {
    hastily: first.hastily ?? null,
    normally: first.normally ?? null,
    completely: first.completely ?? null,
    count: first.count ?? 0,
  };

  // Every length missing is the same as no record at all.
  if (value.hastily === null && value.normally === null && value.completely === null) return null;
  return value;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/*
 * The events themselves — the directory, one event and its games — are
 * `browse.ts`'s. What was here beside this helper was the game page's
 * "Featured in" rail: every event one game appeared at, asked of `events`
 * filtered on its own `games` array (IGDB exposes that join in one direction
 * only; there is no `game.events`). The owner took the rail off the page and the
 * query went with it.
 */

/**
 * A YouTube thumbnail for a watch/live/short URL, or null.
 *
 * The second rung of an event's picture, after IGDB's `event_logo`
 * (`browse.ts`). Every event that streamed has a URL, and in practice that URL
 * is YouTube. `img.youtube.com/vi/<id>/hqdefault.jpg` is a static path with no
 * API, no key and no quota, and it exists for every public video — so the
 * stream link the event already carries is also a picture of it.
 *
 * `hqdefault` rather than `maxresdefault`: the latter 404s for any video not
 * uploaded at 1080p or above, which includes most streams from before ~2016,
 * and a 404 here would put us back at a blank card. 480×360 is more than a card
 * this size needs.
 */
export function youtubeThumbnail(url: string | null | undefined): string | null {
  if (!url) return null;

  // youtu.be/<id>, /watch?v=<id>, /live/<id>, /embed/<id>, /shorts/<id>
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|live\/|embed\/|shorts\/))([\w-]{11})/
  );
  if (!match) return null;
  return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
}

// ---------------------------------------------------------------------------
// The full detail sheet
// ---------------------------------------------------------------------------

/** One age rating, already resolved to a readable organisation and grade. */
export type AgeRating = {
  /** "ESRB", "PEGI", "USK"… */
  organization: string;
  /** "M", "18", "Teen"… */
  rating: string;
};

/**
 * Everything the "More information" sheet prints.
 *
 * All of it is IGDB-only and none of it belongs on the shared `Game` shape —
 * `Game` is the cross-provider contract and hanging fifteen nullable IGDB fields
 * off it to serve one sheet would make every Steam and RAWG row carry them too.
 */
export type GameDetails = {
  developers: string[];
  publishers: string[];
  genres: string[];
  themes: string[];
  gameModes: string[];
  playerPerspectives: string[];
  /** IGDB's `collection` — the numbered series. */
  series: string | null;
  franchises: string[];
  engines: string[];
  ageRatings: AgeRating[];
  /** Languages with any support at all, deduped and sorted. */
  languages: string[];
  /**
   * The same values with their IGDB ids, by kind — what makes each one in the
   * details card a way to its games (`lib/games/facets.ts`).
   *
   * Optional: a record saved on the device before this existed has none, and
   * the card asks for a fresh one when it meets it.
   */
  tags?: Partial<Record<FacetKind, FacetValue[]>>;
};

type IgdbNamed = { id?: number; name?: string };

/** Unique values with an id and a name, in the order IGDB returned them. */
function tagsOf(list: (IgdbNamed | undefined)[] | undefined): FacetValue[] {
  const out: FacetValue[] = [];
  for (const entry of list ?? []) {
    const name = entry?.name?.trim();
    const id = entry?.id;
    if (!name || typeof id !== 'number' || out.some((tag) => tag.id === id)) continue;
    out.push({ id, name });
  }
  return out;
}

type IgdbDetails = {
  involved_companies?: { developer?: boolean; publisher?: boolean; company?: IgdbNamed }[];
  genres?: IgdbNamed[];
  themes?: IgdbNamed[];
  game_modes?: IgdbNamed[];
  player_perspectives?: IgdbNamed[];
  /* `collections`, plural: IGDB no longer answers the singular `collection`. */
  collections?: IgdbNamed[];
  franchises?: IgdbNamed[];
  game_engines?: IgdbNamed[];
  age_ratings?: {
    organization?: { name?: string };
    rating_category?: { id?: number; rating?: string };
  }[];
  language_supports?: { language?: { id?: number; name?: string } }[];
};

/** Unique, non-empty names, in the order IGDB returned them. */
function namesOf(list: IgdbNamed[] | undefined): string[] {
  const out: string[] = [];
  for (const entry of list ?? []) {
    const name = entry.name?.trim();
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

/**
 * One request for everything the detail sheet shows.
 *
 * Deliberately one query rather than six: these are all fields on `games`, and
 * the sheet opens as a unit, so splitting them would be six round trips to fill
 * one panel.
 *
 * **`age_ratings` and `language_supports` are the two that changed shape.** IGDB
 * moved both from integer enums to referenced rows — `rating_category.rating`
 * and `organization.name` replace the old numeric `category`/`rating` pair, and
 * a client still mapping those integers gets nothing back rather than an error.
 * Expanding the references is what makes them readable without a lookup table
 * this app would then have to keep in sync.
 */
export async function getGameDetails(
  sourceId: string,
  signal?: AbortSignal
): Promise<GameDetails | null> {
  const numeric = Number(sourceId);
  if (!Number.isFinite(numeric)) return null;

  const raw = await igdbQuery<IgdbDetails[]>(
    'games',
    `fields involved_companies.developer, involved_companies.publisher,
            involved_companies.company.name,
            genres.name, themes.name, game_modes.name, player_perspectives.name,
            collections.name, franchises.name, game_engines.name,
            age_ratings.organization.name, age_ratings.rating_category.rating,
            language_supports.language.name;
     where id = ${numeric};
     limit 1;`,
    signal
  );

  const first = raw?.[0];
  if (!first) return null;

  const developers: string[] = [];
  const publishers: string[] = [];
  for (const entry of first.involved_companies ?? []) {
    const name = entry.company?.name?.trim();
    if (!name) continue;
    // A company can be both, and both credits are worth printing.
    if (entry.developer && !developers.includes(name)) developers.push(name);
    if (entry.publisher && !publishers.includes(name)) publishers.push(name);
  }

  const ageRatings: AgeRating[] = [];
  for (const entry of first.age_ratings ?? []) {
    const organization = entry.organization?.name?.trim();
    const rating = entry.rating_category?.rating?.trim();
    if (!organization || !rating) continue;
    if (ageRatings.some((existing) => existing.organization === organization)) continue;
    ageRatings.push({ organization, rating });
  }

  const languages: string[] = [];
  for (const entry of first.language_supports ?? []) {
    const name = entry.language?.name?.trim();
    // One row per language *per support type* — audio, subtitles, interface —
    // so the same language arrives up to three times.
    if (name && !languages.includes(name)) languages.push(name);
  }
  languages.sort((a, b) => a.localeCompare(b));

  /* An age rating is reached by its rating category — "PEGI 18" is one id,
     whichever games carry it. */
  const ratingTags: FacetValue[] = [];
  for (const entry of first.age_ratings ?? []) {
    const organization = entry.organization?.name?.trim();
    const rating = entry.rating_category?.rating?.trim();
    const id = entry.rating_category?.id;
    if (!organization || !rating || typeof id !== 'number') continue;
    if (ratingTags.some((tag) => tag.id === id)) continue;
    ratingTags.push({ id, name: `${organization} ${rating}` });
  }

  const languageTags = tagsOf((first.language_supports ?? []).map((entry) => entry.language)).sort(
    (a, b) => a.name.localeCompare(b.name)
  );

  return {
    tags: {
      genre: tagsOf(first.genres),
      theme: tagsOf(first.themes),
      mode: tagsOf(first.game_modes),
      perspective: tagsOf(first.player_perspectives),
      series: tagsOf(first.collections),
      franchise: tagsOf(first.franchises),
      engine: tagsOf(first.game_engines),
      language: languageTags,
      rating: ratingTags,
    },
    developers,
    publishers,
    genres: namesOf(first.genres),
    themes: namesOf(first.themes),
    gameModes: namesOf(first.game_modes),
    playerPerspectives: namesOf(first.player_perspectives),
    series: first.collections?.[0]?.name?.trim() ?? null,
    franchises: namesOf(first.franchises),
    engines: namesOf(first.game_engines),
    ageRatings,
    languages,
  };
}
