import type {
  DirectPingKind,
  PingAudience,
  PingEra,
  PingLength,
  PingPlayers,
  PingStatus,
} from './database.types';
import { PLATFORM_GROUPS } from './games/facets';

/**
 * Pings as rules: what a request and a ping to a person may hold, what the
 * words on them are, and the arithmetic the screens share. Pure — `npm test`
 * holds every vocabulary here to 0046's CHECKs, so the form can never offer a
 * value the database refuses.
 *
 * Two things are called a ping, on purpose (the owner's brief, 2026-10-31):
 *
 *   - a **ping to a person** — a game, a review, a collection, an event, a
 *     soundtrack or a request sent to somebody, with a line (`direct_pings`),
 *     read under the bell's Pings tab;
 *   - a **ping to the community** — a request for a game, answered with
 *     suggestions (`pings`), on the Pings tab. The screens call it a ping too;
 *     the code calls it a request where the two would otherwise be confused.
 */

/* -------------------------------------------------------------------------
 * Limits — each one is a CHECK or a trigger in 0046
 * ---------------------------------------------------------------------- */

/** A request's words. */
export const PING_DESCRIPTION_MAX = 500;
/** Why a suggested game fits. */
export const SUGGESTION_MESSAGE_MAX = 500;
/** The line on a ping to a person. */
export const DIRECT_PING_MESSAGE_MAX = 280;
/** Games a request is built on. */
export const PING_REFERENCE_MAX = 3;
/** Genres, or platforms, on one request. */
export const PING_FILTER_MAX = 5;
/** Suggestions one person may make on one request. */
export const SUGGESTIONS_PER_PERSON = 5;
/** A feed page. */
export const PING_PAGE_SIZE = 20;

/* -------------------------------------------------------------------------
 * Vocabularies
 * ---------------------------------------------------------------------- */

export type Option<T extends string> = { value: T; label: string; hint?: string };

export const PING_STATUSES: readonly PingStatus[] = ['open', 'found', 'closed'];

export const PING_STATUS_LABEL: Record<PingStatus, string> = {
  open: 'Open',
  found: 'Found',
  closed: 'Closed',
};

/** Said to the owner when choosing one. */
export const PING_STATUS_HINT: Record<PingStatus, string> = {
  open: 'Taking suggestions',
  found: 'You found something — it leaves the feed, its suggestions stay',
  closed: 'No more suggestions; it leaves the feed',
};

/**
 * Genres a request can ask for. Words a player uses, not IGDB's twenty-odd —
 * a request is read by people, and nobody asks for "Hack and slash/Beat 'em up".
 */
export const PING_GENRES: readonly Option<string>[] = [
  { value: 'rpg', label: 'RPG' },
  { value: 'action', label: 'Action' },
  { value: 'adventure', label: 'Adventure' },
  { value: 'horror', label: 'Horror' },
  { value: 'shooter', label: 'Shooter' },
  { value: 'strategy', label: 'Strategy' },
  { value: 'puzzle', label: 'Puzzle' },
  { value: 'platformer', label: 'Platformer' },
  { value: 'simulation', label: 'Simulation' },
  { value: 'narrative', label: 'Story-rich' },
  { value: 'cozy', label: 'Cozy' },
  { value: 'roguelike', label: 'Roguelike' },
  { value: 'racing', label: 'Racing' },
  { value: 'sports', label: 'Sports' },
  { value: 'fighting', label: 'Fighting' },
];

/** Platforms as a player names them — the platform menu's groups elsewhere. */
export const PING_PLATFORMS: readonly Option<string>[] = PLATFORM_GROUPS.map((group) => ({
  value: group.key,
  label: group.label,
}));

export const PING_LENGTHS: readonly Option<PingLength>[] = [
  { value: 'short', label: 'Short', hint: 'An evening or two' },
  { value: 'medium', label: 'Medium', hint: 'A few weekends' },
  { value: 'long', label: 'Long', hint: 'Something to live in' },
];

export const PING_PLAYERS: readonly Option<PingPlayers>[] = [
  { value: 'solo', label: 'Single-player' },
  { value: 'multi', label: 'Multiplayer' },
];

export const PING_ERAS: readonly Option<PingEra>[] = [
  { value: 'recent', label: 'New', hint: 'The last few years' },
  { value: 'modern', label: 'Modern', hint: 'Since the mid-2000s' },
  { value: 'retro', label: 'Retro', hint: 'Older than that' },
];

export const DIRECT_PING_KINDS: readonly DirectPingKind[] = [
  'game',
  'review',
  'collection',
  'event',
  'soundtrack',
  'request',
];

/** Who may ping you, in the order Settings offers it; the first is the default. */
export const PING_AUDIENCES: readonly Option<PingAudience>[] = [
  {
    value: 'followers',
    label: 'Anyone who follows you',
    hint: 'Follow you, and they can send you games, reviews and the rest.',
  },
  {
    value: 'mutuals',
    label: 'People you follow back',
    hint: 'Only people you follow who also follow you.',
  },
  {
    value: 'friends',
    label: 'Friends only',
    hint: 'Only people whose friend request you accepted, or who accepted yours.',
  },
];

export const DEFAULT_PING_AUDIENCE: PingAudience = 'followers';

/**
 * What the description field suggests while it is empty — the brief's own
 * examples, one at a time.
 */
export const PING_EXAMPLES: readonly string[] = [
  'Something with writing as good as Disco Elysium.',
  'A horror game that makes me genuinely uncomfortable.',
  'Obscure RPGs with interesting worldbuilding.',
  'Something short I can finish in one evening.',
  'Exploration like Outer Wilds, preferably without combat.',
  'A really satisfying progression system.',
];

/** The label of a value in one of the vocabularies above, or the value itself. */
export function labelIn<T extends string>(options: readonly Option<T>[], value: T): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

/** Every preference on a request, as the words its chips print, in a fixed order. */
export function pingTags(row: {
  genres: readonly string[];
  platforms: readonly string[];
  play_length: PingLength | null;
  player_mode: PingPlayers | null;
  release_era: PingEra | null;
}): string[] {
  return [
    ...row.genres.map((genre) => labelIn(PING_GENRES, genre)),
    ...row.platforms.map((platform) => labelIn(PING_PLATFORMS, platform)),
    ...(row.play_length ? [labelIn(PING_LENGTHS, row.play_length)] : []),
    ...(row.player_mode ? [labelIn(PING_PLAYERS, row.player_mode)] : []),
    ...(row.release_era ? [labelIn(PING_ERAS, row.release_era)] : []),
  ];
}

/* -------------------------------------------------------------------------
 * Familiarity: why a request is where it is in For You
 * ---------------------------------------------------------------------- */

export type Familiarity = {
  /** `strong`: two or more played; `some`: one; `none`: none of them. */
  tone: 'strong' | 'some' | 'none';
  text: string;
};

/**
 * The line a card says about the reader and the request's games — the
 * ranking's only input, said plainly, never as a score. Null when the request
 * names no games, because there is nothing to say.
 */
export function familiarity(row: {
  reference_count: number;
  matched_count: number;
  reviewed_count: number;
}): Familiarity | null {
  const refs = row.reference_count;
  const played = Math.min(row.matched_count, refs);
  const reviewed = Math.min(row.reviewed_count, played);
  if (refs <= 0) return null;
  if (played === 0) return { tone: 'none', text: 'No direct library matches' };

  const tone = played >= 2 ? 'strong' : 'some';
  if (refs === 1) {
    return {
      tone,
      text: reviewed > 0 ? 'You reviewed this reference game' : 'You’ve played this reference game',
    };
  }
  const base =
    played === refs
      ? `You’ve played all ${refs} reference games`
      : `You’ve played ${played} of the ${refs} reference games`;
  if (reviewed === 0) return { tone, text: base };
  return {
    tone,
    text: `${base} · reviewed ${reviewed === played && played > 1 ? 'them' : reviewed === 1 ? 'one' : reviewed}`,
  };
}

/* -------------------------------------------------------------------------
 * The Pings tab's two faces: the stage and the board (2026-11-01)
 * ---------------------------------------------------------------------- */

const COUNT_WORDS = ['none', 'one', 'two', 'three'];

/**
 * What For You's stage says over one request, in its largest type — the
 * reason this request is the one in front of you: "You’ve played both of
 * these". Always true of the reader and never a score; a request on no games
 * says who can answer it, which is anybody.
 */
export function spotlightClaim(row: { reference_count: number; matched_count: number }): string {
  const refs = Math.max(0, row.reference_count);
  const played = Math.min(Math.max(0, row.matched_count), refs);
  if (refs === 0) return 'Anyone can answer this one';
  if (played === 0) return refs === 1 ? 'New to you' : 'New to you, all of them';
  if (played === refs) {
    if (refs === 1) return 'You’ve played this one';
    if (refs === 2) return 'You’ve played both of these';
    return `You’ve played all ${COUNT_WORDS[refs] ?? refs} of these`;
  }
  return `You’ve played ${COUNT_WORDS[played] ?? played} of these`;
}

/** "2/3": a request in the stage's queue, as its index prints it. */
export function playedFraction(row: { reference_count: number; matched_count: number }): string {
  const refs = Math.max(0, row.reference_count);
  return `${Math.min(Math.max(0, row.matched_count), refs)}/${refs}`;
}

/**
 * The foot of a plate on the board — the two words under the rule. Left: how
 * many of its games the reader has played ("2 of 3 played"), or on your own
 * request what is new; right: the answers, or the state it ended in. `struck`
 * is a request that is no longer open: the foot is drawn through, a state as
 * a printed mark and never only a brightness.
 */
export type PlateFoot = { left: string; leftLit: boolean; right: string; struck: boolean };

export function plateFoot(
  row: {
    status: PingStatus;
    reference_count: number;
    matched_count: number;
    suggestion_count: number;
    unseen_count: number;
  },
  mine: boolean
): PlateFoot {
  const refs = Math.max(0, row.reference_count);
  const played = Math.min(Math.max(0, row.matched_count), refs);
  const struck = row.status !== 'open';
  const right =
    row.status === 'found'
      ? 'Found it'
      : row.status === 'closed'
        ? 'Closed'
        : suggestionCount(row.suggestion_count);
  if (mine) {
    const fresh = row.unseen_count > 0;
    return {
      left: fresh
        ? `${row.unseen_count} new`
        : struck
          ? suggestionCount(row.suggestion_count)
          : 'Yours',
      leftLit: fresh && !struck,
      right,
      struck,
    };
  }
  return {
    left: refs === 0 ? 'No games named' : `${played} of ${refs} played`,
    leftLit: played > 0 && !struck,
    right,
    struck,
  };
}

/**
 * Where the stage goes on Next: the following request, or back to the first
 * once the end of everything loaded is reached and nothing more is coming.
 * Null while the next page is still on its way.
 */
export function nextStageIndex(index: number, length: number, more: boolean): number | null {
  if (length === 0) return null;
  if (index + 1 < length) return index + 1;
  return more ? null : 0;
}

/* -------------------------------------------------------------------------
 * The feed's cursor
 * ---------------------------------------------------------------------- */

export type PingCursor = { tier: number; created_at: string; id: string };

/** The cursor after a page: its last row's ranking fields, or null at the end. */
export function nextCursor(
  page: readonly { tier: number; created_at: string; id: string }[],
  pageSize: number = PING_PAGE_SIZE
): PingCursor | null {
  if (page.length < pageSize) return null;
  const last = page[page.length - 1];
  return { tier: last.tier, created_at: last.created_at, id: last.id };
}

/**
 * Pages concatenated with any id seen twice dropped — a request that moved
 * between two fetches (a new suggestion does not move one, but an edit to
 * the feed's order could) is drawn once.
 */
export function flattenPages<T extends { id: string }>(pages: readonly (readonly T[])[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const page of pages) {
    for (const row of page) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      out.push(row);
    }
  }
  return out;
}

/* -------------------------------------------------------------------------
 * Suggestions, by game
 * ---------------------------------------------------------------------- */

export type SuggestionLike = {
  id: string;
  game_id: string;
  user_id: string;
  created_at: string;
  interesting: boolean;
};

export type SuggestionGroup<S extends SuggestionLike> = {
  gameId: string;
  /** Oldest first: the first person to suggest it leads. */
  suggestions: S[];
  interesting: boolean;
  solved: boolean;
};

/**
 * One group per game, however many people suggested it. The game that
 * answered the request first, then the ones its owner marked, then the most
 * suggested, then the earliest.
 */
export function groupSuggestions<S extends SuggestionLike>(
  suggestions: readonly S[],
  resolvedGameId: string | null = null
): SuggestionGroup<S>[] {
  const groups = new Map<string, SuggestionGroup<S>>();
  for (const suggestion of suggestions) {
    let group = groups.get(suggestion.game_id);
    if (!group) {
      group = {
        gameId: suggestion.game_id,
        suggestions: [],
        interesting: false,
        solved: suggestion.game_id === resolvedGameId,
      };
      groups.set(suggestion.game_id, group);
    }
    group.suggestions.push(suggestion);
    if (suggestion.interesting) group.interesting = true;
  }
  const first = (group: SuggestionGroup<S>) => group.suggestions[0].created_at;
  for (const group of groups.values()) {
    group.suggestions.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  return [...groups.values()].sort(
    (a, b) =>
      Number(b.solved) - Number(a.solved) ||
      Number(b.interesting) - Number(a.interesting) ||
      b.suggestions.length - a.suggestions.length ||
      first(a).localeCompare(first(b))
  );
}

/** "Suggested by Ada", "by Ada and Ben", "by Ada and 2 others". */
export function suggestedBy(names: readonly string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return `Suggested by ${names[0]}`;
  if (names.length === 2) return `Suggested by ${names[0]} and ${names[1]}`;
  const rest = names.length - 1;
  return `Suggested by ${names[0]} and ${rest} others`;
}

/** "No suggestions yet", "1 suggestion", "12 suggestions". */
export function suggestionCount(count: number): string {
  if (count <= 0) return 'No suggestions yet';
  return count === 1 ? '1 suggestion' : `${count} suggestions`;
}

/** Whether this reader may answer this request. */
export function canSuggest(
  ping: { status: PingStatus; user_id: string },
  userId: string | null | undefined
): boolean {
  return !!userId && ping.status === 'open' && ping.user_id !== userId;
}

/* -------------------------------------------------------------------------
 * Pings to people
 * ---------------------------------------------------------------------- */

/** What the inbox says somebody did: "pinged you a game". */
export const DIRECT_PING_VERB: Record<DirectPingKind, string> = {
  game: 'pinged you a game',
  review: 'pinged you a review',
  collection: 'pinged you a collection',
  event: 'pinged you an event',
  soundtrack: 'pinged you a soundtrack',
  request: 'wants your help with a ping',
};

/** The noun a send sheet uses: "Ping this game to…". */
export const DIRECT_PING_NOUN: Record<DirectPingKind, string> = {
  game: 'game',
  review: 'review',
  collection: 'collection',
  event: 'event',
  soundtrack: 'soundtrack',
  request: 'ping',
};

/** Where a ping opens. Plain route data, so the inbox and its test agree. */
export function directPingRoute(
  kind: DirectPingKind,
  targetId: string
): { pathname: string; params: { id: string } } {
  const pathname = {
    game: '/game/[id]',
    review: '/review/[id]',
    collection: '/list/[id]',
    event: '/event/[id]',
    soundtrack: '/soundtrack/[id]',
    request: '/ping/[id]',
  }[kind];
  return { pathname, params: { id: targetId } };
}

/** "Ping 1 person", "Ping 3 people", "Ping" with nobody chosen. */
export function sendLabel(count: number): string {
  if (count <= 0) return 'Ping';
  return count === 1 ? 'Ping 1 person' : `Ping ${count} people`;
}
