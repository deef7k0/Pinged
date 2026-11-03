/**
 * What may be kept on the device between launches, and for how long.
 *
 * The pure half of `query-persist.ts` — which query, in what envelope, evicted
 * when — so `npm test` can hold it without AsyncStorage or React Native.
 *
 * ## The rule this implements
 *
 * A screen that has been seen once opens with what it showed last, and the
 * network overwrites it a moment later. That is SimpMusic's Home, read from its
 * source (`HomeRepositoryImpl.getMoodAndMomentsData`): "Serve the cached copy
 * first so the grid paints instantly; the network result is emitted right after
 * and overwrites it … a stale frame costs nothing while a spinner does."
 *
 * Here the cache is TanStack Query's, so the unit is a query: its key, its data
 * and when that data arrived. Everything else about a query — fetch status,
 * failure counts, an error — is this launch's business and is not written.
 */

/**
 * Bump when the shape of anything a query returns changes in a way an older
 * copy would break — a field renamed, an array that became an object.
 *
 * A row written under another version is dropped unread. Adding a field needs
 * no bump: every reader of server data already tolerates a missing one (see
 * CLAUDE.md, "The app can be a migration ahead of its database").
 *
 * 2: a game's `heroUrl` stopped being IGDB's first artwork, which was as often
 * an icon or a wordmark as key art (`lib/games/hero-art.ts`). Nothing about
 * the shape changed — but every saved game still named the old image, and its
 * page would have opened on a 128px icon blown up across the hero for the
 * second it takes the fresh record to arrive.
 *
 * 3: a collection's summary lost `mosaic` and gained `stack` — a field
 * renamed, which is the first case this note names — and the version was not
 * bumped with it. Every saved list of collections came back without the field
 * its tile maps over, so the first screen to draw one threw "cannot read
 * property 'map' of undefined" and landed on the error boundary; that emptied
 * the cache, which is why "Try again" worked. The owner met it on the first
 * launch after the change. **Adding a field needs no bump; renaming one is
 * removing one, and does.**
 *
 * 4: a game's GameLog score became the weighted community score (0041), and
 * `['rating-breakdown']`'s `average` stopped being a rounded plain mean. The
 * shape barely moved; what it means did — as with 2, every saved score would
 * have opened a game's page on the old number for the moment before the new
 * one arrived, beside a verdict and a breakdown already weighted.
 *
 * 5: every colour method but Material 3 was removed from the app (2026-10-28),
 * and with it the queries that kept their answers. Their saved rows would
 * have been restored into memory on every launch for nothing to read.
 */
export const CACHE_VERSION = 5;

/** A week, as SimpMusic keeps its own cached answers (`MOOD_ARTWORK_TTL_MILLIS`). */
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The largest single row, in characters of JSON.
 *
 * Android reads a row through a 2 MB cursor window, and one that does not fit
 * cannot be read back at all — it fails the whole `multiGet` it is part of. A
 * fifth of that is room for every query in the app but a pathological one,
 * which simply stays in memory.
 */
export const MAX_ROW_CHARS = 400_000;

/**
 * Everything this cache may hold, in characters and in rows.
 *
 * Two ceilings set it. AsyncStorage's database on Android is 6 MB **in
 * total**, shared with the session, the square-cover map, the logo
 * measurements and every other store the app keeps. And all of it is read and
 * parsed on the JS thread while the splash screen is up, then held in memory:
 * two megabytes is some tens of milliseconds of launch, and the four tabs plus
 * the last few dozen pages anyone opened fit in far less.
 */
export const MAX_TOTAL_CHARS = 2_000_000;
export const MAX_ROWS = 120;

/**
 * Query-key roots that are never written.
 *
 *  - **Answers to something typed.** A search is keyed on its term, so every
 *    pause mid-word is a key; none of them is a screen anyone returns to.
 *  - **What the device already keeps.** These queries *read* an AsyncStorage
 *    store of their own; a second copy could only ever disagree with it.
 *  - **What must be live.** A sync's progress is a statement about now.
 *
 * Anything whose root *starts with* `surprise` is excluded too
 * (`shouldPersistKey`): a dealt batch restored from disk would deal last
 * time's games again, and the surprise is the feature.
 */
const NEVER_PERSIST: ReadonlySet<string> = new Set([
  'search',
  'award-search',
  'barcode',

  'search-history',
  'log-draft',
  'reading-languages',
  'review-colour',
  'copy-mesh',
  'game-colours',
  'animated-artwork',
  'copy-stage-3d',
  'trailers',
  'album-art-color',
  'artwork-color',
  'studio-logo',
  'studio-banner',
  /* A mesh is a few kilobytes of data URI worked out from a 90×128 thumbnail:
     cheaper to rebuild than to keep a row of. */
  'artwork-mesh',

  'gaming-sync',
  'gaming-sync-state',

  /* Home's moods and genres: up to sixty whole games a feed, and Home always opens on
     All — rows that would push out the ones a cold start actually draws. */
  'home-feed',
  /* "Games for you" is a new round every time the app is opened, and the
     history it reads is a device store of its own. A restored round would be
     last time's games. */
  'recommended',
  'recommend-history',

  /* SoundCloud's. Its API terms forbid keeping titles, names or artwork past
     the session, and a query cache written to the device is exactly that.
     Surprise Me's `surprise-soundtrack` is covered by the prefix rule below. */
  'soundtrack',
  'soundcloud-track',
]);

/** Whether a query with this key is one the device may keep. */
export function shouldPersistKey(queryKey: readonly unknown[]): boolean {
  const root = queryKey[0];
  if (typeof root !== 'string' || root.length === 0) return false;
  if (root.startsWith('surprise')) return false;
  /* Onboarding happens once; nothing it asked for is worth a row on disk. */
  if (root.startsWith('onboarding')) return false;
  return !NEVER_PERSIST.has(root);
}

/**
 * Whether a value survives `JSON.stringify` → `JSON.parse` unchanged in kind.
 *
 * The check that makes writing *every* query safe rather than an allowlist of
 * the ones somebody remembered to vet. A `Date` comes back a string, a `Map` an
 * empty object, an `undefined` in an array a `null` — and the screen that reads
 * the restored copy calls `.getTime()` or `.get()` on it and dies, at launch,
 * every launch. A query holding any of those is left in memory only.
 *
 * An `undefined` *property* is fine: it is dropped, and reading a dropped
 * property is `undefined` again.
 *
 * `budget` bounds the walk: data too large to check in one go is too large to
 * write on the JS thread anyway.
 */
export function isPlainJson(value: unknown, budget = 60_000): boolean {
  let remaining = budget;

  const walk = (node: unknown, inArray: boolean): boolean => {
    if (--remaining < 0) return false;

    if (node === null) return true;
    switch (typeof node) {
      case 'string':
      case 'boolean':
        return true;
      case 'number':
        return Number.isFinite(node);
      case 'undefined':
        return !inArray;
      case 'object':
        break;
      default:
        return false;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        if (!walk(item, true)) return false;
      }
      return true;
    }

    const prototype = Object.getPrototypeOf(node);
    if (prototype !== Object.prototype && prototype !== null) return false;

    for (const key in node as Record<string, unknown>) {
      if (!walk((node as Record<string, unknown>)[key], false)) return false;
    }
    return true;
  };

  return walk(value, false);
}

/** One query as it is written: its key, its data, and when the data arrived. */
export type PersistedQuery = {
  queryKey: readonly unknown[];
  data: unknown;
  /** Epoch ms the data was fetched — restored as the query's `dataUpdatedAt`. */
  updatedAt: number;
};

/**
 * Serialise one query, or `null` when it must not be written: an excluded key,
 * data that would not come back as it went in, or a row too large to read.
 */
export function encodeRow(query: PersistedQuery): string | null {
  if (!shouldPersistKey(query.queryKey)) return null;
  if (query.data === undefined) return null;
  if (!isPlainJson(query.queryKey) || !isPlainJson(query.data)) return null;

  const row = JSON.stringify({
    v: CACHE_VERSION,
    k: query.queryKey,
    t: query.updatedAt,
    d: query.data,
  });
  return row.length <= MAX_ROW_CHARS ? row : null;
}

/**
 * Read one row back, or `null` for anything that should be thrown away: not
 * JSON, another version, older than `MAX_AGE_MS`, or a key that has since been
 * excluded.
 */
export function decodeRow(raw: string | null | undefined, now: number): PersistedQuery | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const row = parsed as { v?: unknown; k?: unknown; t?: unknown; d?: unknown };

  if (row.v !== CACHE_VERSION) return null;
  if (!Array.isArray(row.k) || !shouldPersistKey(row.k)) return null;
  if (typeof row.t !== 'number' || !Number.isFinite(row.t)) return null;
  /* A clock set back makes a row look newer than now; that is not a reason to
     keep it for ever, and it is not one to drop it either. */
  if (now - row.t > MAX_AGE_MS) return null;
  if (row.d === undefined) return null;

  return { queryKey: row.k, data: row.d, updatedAt: row.t };
}

/** What the cache knows about one row without reading it. */
export type RowInfo = { chars: number; updatedAt: number };

/**
 * Which rows to delete so the cache fits its limits — oldest data first.
 *
 * Oldest by when the data was *fetched*, which is also least recently looked
 * at: a query somebody is looking at is refetched, and a refetch rewrites its
 * row. So the pages nobody has opened in a week go, and the four tabs — read
 * and rewritten on every launch — never do.
 */
export function pickEvictions(
  index: ReadonlyMap<string, RowInfo>,
  limits: { maxRows: number; maxChars: number } = { maxRows: MAX_ROWS, maxChars: MAX_TOTAL_CHARS }
): string[] {
  let rows = index.size;
  let chars = 0;
  for (const info of index.values()) chars += info.chars;

  if (rows <= limits.maxRows && chars <= limits.maxChars) return [];

  const oldestFirst = [...index.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt);
  const evicted: string[] = [];

  for (const [hash, info] of oldestFirst) {
    if (rows <= limits.maxRows && chars <= limits.maxChars) break;
    evicted.push(hash);
    rows -= 1;
    chars -= info.chars;
  }
  return evicted;
}
