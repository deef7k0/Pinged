/**
 * One normalized game shape, whatever platform it came from.
 *
 * Every provider maps its own response into this so the UI never branches on
 * platform. `id` is the app-wide identity and is always `${source}:${sourceId}`
 * — stable, human-readable, and safe to use as a React key or route param.
 */
import type { EditionKind } from '../../constants/game-editions';
import type { GameLogo } from './logo-art';

export type GameSource = 'igdb' | 'rawg' | 'steam' | 'itch';

/**
 * Search cards and the detail hero need different art:
 *  - `coverUrl` is portrait box art (2:3). The primary visual everywhere.
 *  - `heroUrl` is landscape key art, used behind the detail page header.
 *
 * Steam only publishes landscape headers, so its `coverUrl` is null and the UI
 * falls back to the hero. IGDB is the only source with true portrait covers,
 * which is why it is the preferred provider.
 */
export type Game = {
  /** `${source}:${sourceId}` — e.g. "igdb:1029" */
  id: string;
  source: GameSource;
  /** The provider's own id, as a string. */
  sourceId: string;
  title: string;
  /** Portrait box art (2:3), or null if this provider has none. */
  coverUrl: string | null;
  /** Landscape key art for hero headers. */
  heroUrl: string | null;
  /** Plain text — providers that return HTML are stripped before this point. */
  description: string | null;
  releaseDate: string | null;
  releaseYear: number | null;
  developer: string | null;
  publisher: string | null;
  genres: string[];
  /** Human-readable platform names: "PlayStation 5", "PC (Microsoft Windows)". */
  platforms: string[];
  /** Provider's own score, normalized to 0-100. */
  score: number | null;
  storeUrl: string | null;
  screenshots: string[];

  /**
   * What kind of release this is — remake, remaster, DLC, edition — or null
   * when it is simply the game. See `constants/game-editions.ts`.
   *
   * Null for every provider except IGDB. Steam, RAWG and itch.io model editions
   * as separate store pages with no relationship recorded between them, so
   * there is nothing to read; a legacy `steam:` row shows no badge rather than
   * a guessed one.
   */
  edition: EditionKind | null;
  /**
   * The repackage's marketing name — "Definitive Edition", "Game of the Year
   * Edition". Only ever set alongside `edition: 'edition'`.
   *
   * Kept apart from `title` because IGDB already puts it there: the row is
   * called "Mafia II: Director's Cut" *and* carries "Director's Cut" here. This
   * is for the places that need the suffix on its own.
   */
  editionTitle: string | null;
  /**
   * The game this descends from, as an app-wide id, or null for an original.
   *
   * One field for two IGDB relationships — `parent_game` for a remake or DLC,
   * `version_parent` for a repackage. A reader asking "what is this a version
   * of" does not care which of the two IGDB used, and `edition` still tells
   * them apart when it matters.
   */
  parentId: string | null;
  /**
   * Steam's appid for this game, or null when it is not sold on Steam.
   *
   * The key to Steam's CDN artwork — see `lib/games/steam-artwork.ts`. Only
   * IGDB fills this in, from `external_games`; a `steam:` row already *is* its
   * appid and sets this from its own `sourceId`.
   *
   * **Null is the common case for anything console-exclusive**, which is why
   * Steam artwork is a preference and never a replacement: IGDB stays the
   * fallback, or half the catalogue would lose its covers.
   */
  steamAppId: string | null;
  /**
   * The game's transparent logo from IGDB (`chooseLogo`), or null when it has
   * none. Optional: only IGDB fills it in, and a game kept on the device from
   * before it has no such field.
   */
  logo?: GameLogo | null;
  /**
   * The cover's height over its width, as IGDB has it (`cover.width`,
   * `cover.height`) — the game page draws the cover at exactly this shape,
   * uncropped. Optional: only IGDB fills it in, and a game kept on the device
   * from before it has none; the page then measures the file as it loads.
   */
  coverAspect?: number | null;
};

/**
 * The release-type fields, for a provider that records no relationships.
 *
 * Steam, RAWG and itch.io model an edition as an unrelated store page: there is
 * no field saying "this is a remaster of that", so there is nothing to map and
 * spreading this is the honest answer. Only IGDB fills these in.
 *
 * A shared constant rather than three copies of the same nulls, so adding a
 * field to the group is one edit and the compiler finds the rest.
 *
 * `steamAppId` rides along for itch and RAWG, which likewise have no idea what
 * a game's Steam listing is. Steam itself overrides it — a `steam:` row already
 * *is* its appid.
 */
export const NO_EDITION = {
  edition: null,
  editionTitle: null,
  parentId: null,
  steamAppId: null,
} as const;

/**
 * Search results carry enough for a rich card — poster, year, studio, platforms
 * and score — so the list does not need a follow-up request per row.
 */
export type GameSearchResult = Pick<
  Game,
  | 'id'
  | 'source'
  | 'sourceId'
  | 'title'
  | 'coverUrl'
  | 'heroUrl'
  // Both, not one: `releaseYear` is what a compact line wants, and the full
  // date is the only honest way to know a game has not come out yet — which is
  // what turns a price into a pre-order on `<GameListItem>`.
  | 'releaseDate'
  | 'releaseYear'
  | 'developer'
  | 'genres'
  | 'platforms'
  | 'score'
  // Carried into search results so a rail or grid can badge a remake without a
  // follow-up request per poster.
  | 'edition'
  | 'editionTitle'
  | 'parentId'
  // Carried so a grid of posters can build Steam CDN URLs with no extra request.
  | 'steamAppId'
>;

/** One achievement definition, shared across every user who owns the game. */
export type Achievement = {
  /** `${gameId}:${externalId}` */
  id: string;
  gameId: string;
  externalId: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  /** Percent of all players who unlocked it, when reported. */
  globalPercent: number | null;
  hidden: boolean;
};

export type GameProvider = {
  source: GameSource;
  /** Human label for UI ("IGDB", "RAWG"). */
  label: string;
  /**
   * Whether this provider can actually run right now. Providers needing an API
   * key report false when the key is missing, and the aggregator skips them
   * instead of failing the whole search.
   */
  isEnabled: () => boolean;
  search: (query: string, signal?: AbortSignal) => Promise<GameSearchResult[]>;
  getById: (sourceId: string, signal?: AbortSignal) => Promise<Game | null>;
  /** Optional: not every provider exposes achievements. */
  getAchievements?: (sourceId: string, signal?: AbortSignal) => Promise<Achievement[]>;
};

export function makeGameId(source: GameSource, sourceId: string | number): string {
  return `${source}:${sourceId}`;
}

/** Inverse of `makeGameId`. Returns null on anything malformed. */
export function parseGameId(id: string): { source: GameSource; sourceId: string } | null {
  const separator = id.indexOf(':');
  if (separator < 1) return null;

  const source = id.slice(0, separator);
  const sourceId = id.slice(separator + 1);
  if (!sourceId) return null;
  if (source !== 'igdb' && source !== 'rawg' && source !== 'steam' && source !== 'itch') {
    return null;
  }

  return { source, sourceId };
}

/** Pull a four-digit year out of the wildly inconsistent date strings providers return. */
export function yearFrom(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

/**
 * Providers return store descriptions as HTML. We render into <Text>, which has
 * no HTML parser, so flatten to something readable rather than showing raw tags.
 */
export function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;

  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text || null;
}
