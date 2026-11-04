import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import { useAnimatedArtwork } from '@/hooks/use-animated-artwork';
import type {
  AnimatedAsset,
  AnimatedFormat,
  AnimatedQuality,
  CoverAspect,
  CoverStatus,
} from '@/lib/animated-cover';
import { pickPlayable } from '@/lib/animated-cover';
import { findAnimatedCovers } from '@/lib/games/animated-covers';

/**
 * A game's animated cover in one shape — `status`, the file, and `retry` —
 * remembered on the device, **"there is none" included**.
 *
 * The owner's request (2026-10-20), and its one rule about asking: "If the
 * user has already seen that no animated cover exists for this game (cached),
 * the animated query is not done every time." Very few games have one, so the
 * common answer is "none", and it costs as much to find out as a hit — a
 * SteamGridDB search, a grids request, an IGDB request. So every answer is
 * kept for a month (`TTL_MS`), per game and shape: a square and a portrait are
 * looked up and remembered independently.
 *
 * A module store read through `useSyncExternalStore`, as `use-square-cover`
 * is and for its reasons: one map for every screen, read on the first render,
 * so a game whose answer is known draws it without a request or a frame of
 * "loading". Not TanStack Query: a query cache entry is a request per screen,
 * this is a cache with subscribers.
 *
 * Four things keep a lookup from happening at all:
 *
 * - **Reduce Motion.** Never an animated cover, so never a request: `idle`.
 * - **Animated artwork off** (Settings, onboarding — `useAnimatedArtwork`):
 *   `idle` too, unless the cover was asked for by hand (`explicit`, the game
 *   page's Animated button).
 * - **`enabled: false`** — the game page asks only once its Animated button
 *   is pressed; Surprise Me only for the cards either side of the one in
 *   front. A known answer is still read while it is false, so a button can
 *   say "none" before anybody presses it.
 * - **A known answer**, on disk from any earlier visit.
 *
 * **A file that fails to play gives way to the next** (`reportFailure`,
 * `pickPlayable`): an answer is a short list — the file to play and what to
 * fall back on, a small preview last — and a failure passes over that file,
 * and every full-size one at least as heavy, for the rest of the session, then
 * plays the next. Only when none is left is it "none". Logged, never written
 * to disk: a dropped connection is not evidence the game has no animated
 * cover.
 */

const TTL_MS = 30 * 24 * 60 * 60 * 1000;

/* 2: answers stored before 2026-10-21 named SteamGridDB's 267×400 WebM
   preview where the full animation is now preferred (`sgdbCandidates`), and
   none carried its weight. 3: an answer is a list to fall back through, with
   joke grids left out (`rankGrids`). 4: a failed lookup — and every lookup
   on the 21 October APK, built without the SteamGridDB key — had been stored
   as "none" for a month; failures are never stored now. Every game is asked
   again, once. */
const CACHE_VERSION = 4;
const CACHE_KEY = `animated-cover:v${CACHE_VERSION}`;

/** `assets: []` is a real, cached answer: no animated cover in this shape. */
type Entry = { assets: AnimatedAsset[]; storedAt: number };

const memory = new Map<string, Entry>();
/** Files that would not play on this phone this session; never persisted. */
const failedUrls = new Set<string>();
/**
 * The lightest full-size animation that would not play this session: every
 * one at least as heavy is passed over too (`pickPlayable`).
 */
let failedAtBytes = Number.POSITIVE_INFINITY;

/**
 * Lookups that failed this session — no key, no network, a rate limit —
 * which are not answers and are never written to disk. Asked again on the
 * next launch, or by `retry`.
 */
const unavailable = new Set<string>();

const inflight = new Set<string>();
const subscribers = new Set<() => void>();

let hydration: Promise<void> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function notify(): void {
  for (const callback of subscribers) callback();
}

function hydrate(): Promise<void> {
  hydration ??= readCache();
  return hydration;
}

async function readCache(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, Entry>;
    const now = Date.now();
    for (const [key, entry] of Object.entries(parsed)) {
      if (!entry || !Array.isArray(entry.assets) || now - entry.storedAt > TTL_MS) continue;
      memory.set(key, entry);
    }
  } catch {
    /* Every entry is one lookup to rebuild. */
  } finally {
    notify();
  }
}

function schedulePersist(): void {
  if (persistTimer !== null) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void AsyncStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(memory))).catch(() => {
      /* The memory map still answers for this session. */
    });
  }, 400);
}

function keyOf(gameId: string, aspect: CoverAspect): string {
  return `${gameId}:${aspect}`;
}

/** Look one game and shape up, unless it is known or already being asked. */
function ensure(key: string, gameId: string, title: string | null, aspect: CoverAspect): void {
  if (memory.has(key) || inflight.has(key) || unavailable.has(key)) return;
  inflight.add(key);
  notify();

  void (async () => {
    try {
      await hydrate();
      if (memory.has(key)) return;
      const assets = await findAnimatedCovers({ gameId, title, aspect });
      memory.set(key, { assets, storedAt: Date.now() });
      schedulePersist();
    } catch (error) {
      unavailable.add(key);
      console.warn(`[animated-cover] ${key} could not be looked up; not remembered.`, error);
    } finally {
      inflight.delete(key);
      notify();
    }
  })();
}

function subscribe(callback: () => void): () => void {
  subscribers.add(callback);
  void hydrate();
  return () => {
    subscribers.delete(callback);
  };
}

export type AnimatedCoverArgs = {
  /** App-wide game id (`igdb:1234`). Null for nothing to look up. */
  gameId: string | null | undefined;
  /** The game's title: SteamGridDB is searched by it. */
  title: string | null | undefined;
  aspect: CoverAspect;
  /**
   * False to hold the lookup — until the slot is ready to show one. A known
   * answer is still returned; an unknown one is `idle`, not `loading`.
   */
  enabled?: boolean;
  /**
   * Somebody asked for this animation by hand — the game page's Animated
   * button — so the Animated artwork setting does not hold it back. Reduce
   * Motion still does.
   */
  explicit?: boolean;
};

export type AnimatedCover = {
  status: CoverStatus;
  /** The file to play, while `status` is `found`. */
  animatedUrl: string | null;
  format: AnimatedFormat | null;
  /** What it weighs, when the server said — `null` otherwise. */
  bytes: number | null;
  /** The animation at its own size, or SteamGridDB's small preview of it. */
  quality: AnimatedQuality | null;
  /** Forget this game's answer in this shape, and ask again. */
  retry: () => void;
  /**
   * The file would not play: "none" for the rest of the session, and logged.
   * Not written to disk — see the note at the top.
   */
  reportFailure: (error?: unknown) => void;
};

const IDLE: Omit<AnimatedCover, 'retry' | 'reportFailure'> = {
  status: 'idle',
  animatedUrl: null,
  format: null,
  bytes: null,
  quality: null,
};

export function useAnimatedCover({
  gameId,
  title,
  aspect,
  enabled = true,
  explicit = false,
}: AnimatedCoverArgs): AnimatedCover {
  const reduceMotion = useReducedMotion();
  const artwork = useAnimatedArtwork();
  /* The setting is read before anything is asked: a cover that is switched
     off must not start a lookup in the frame before the switch is known. */
  const allowed = explicit || (artwork.ready && artwork.on);
  const key = gameId && allowed && !reduceMotion ? keyOf(gameId, aspect) : null;

  /* The file to play, `NONE`, or null for not known — each a stable value,
     as `useSyncExternalStore` needs: an asset is an element of its stored
     list, so it is the same object until a failure moves the pick on. */
  const picked = useSyncExternalStore(
    subscribe,
    () => (key ? snapshotFor(key) : null),
    () => null
  );

  /* The request writes to the module map and notifies the store; no state is
     set here (CLAUDE.md, "No setState in effects"). */
  useEffect(() => {
    if (!key || !gameId || !enabled) return;
    ensure(key, gameId, title ?? null, aspect);
  }, [key, gameId, title, aspect, enabled]);

  const retry = () => {
    if (!key || !gameId) return;
    const entry = memory.get(key);
    for (const asset of entry?.assets ?? []) failedUrls.delete(asset.url);
    memory.delete(key);
    unavailable.delete(key);
    schedulePersist();
    ensure(key, gameId, title ?? null, aspect);
  };

  const reportFailure = (error?: unknown) => {
    if (!picked || picked === NONE || picked === UNAVAILABLE || failedUrls.has(picked.url)) return;
    failedUrls.add(picked.url);
    if (picked.quality === 'full' && typeof picked.bytes === 'number') {
      failedAtBytes = Math.min(failedAtBytes, picked.bytes);
    }
    const next = key ? pickedFor(key) : null;
    console.warn(
      `[animated-cover] ${key} would not play ${picked.url}` +
        (typeof picked.bytes === 'number' ? ` (${(picked.bytes / 1e6).toFixed(1)} MB)` : '') +
        (next && next !== NONE ? `; trying ${next.url}` : '; showing the still cover') +
        '.',
      error
    );
    notify();
  };

  if (!key) return { ...IDLE, retry, reportFailure };
  if (picked === UNAVAILABLE) return { ...IDLE, status: 'unavailable', retry, reportFailure };
  if (!picked) {
    return { ...IDLE, status: enabled ? 'loading' : 'idle', retry, reportFailure };
  }
  if (picked === NONE) return { ...IDLE, status: 'not_found', retry, reportFailure };

  return {
    status: 'found',
    animatedUrl: picked.url,
    format: picked.format,
    bytes: picked.bytes ?? null,
    quality: picked.quality ?? null,
    retry,
    reportFailure,
  };
}

/** A known answer with nothing playable left in it. */
const NONE = 'none';

/** A lookup that failed this session: not an answer (`unavailable`). */
const UNAVAILABLE = 'unavailable';

/** What the hook's store reads: the pick, or that the lookup failed. */
function snapshotFor(key: string): AnimatedAsset | typeof NONE | typeof UNAVAILABLE | null {
  if (!memory.has(key) && unavailable.has(key)) return UNAVAILABLE;
  return pickedFor(key);
}

/** What a stored answer says to play now, after this session's failures. */
function pickedFor(key: string): AnimatedAsset | typeof NONE | null {
  const entry = memory.get(key);
  if (!entry) return null;
  return pickPlayable(entry.assets, failedUrls, failedAtBytes) ?? NONE;
}

/**
 * Look a game's animated cover up ahead of its card — Surprise Me's next
 * cards (`lib/surprise-prefetch.ts`). Only the answer: the lookup and the
 * HEAD that weighs the file, never the file. The caller checks Reduce Motion
 * and the Animated artwork setting first; this is a plain function.
 */
export function prefetchAnimatedCover(gameId: string, title: string, aspect: CoverAspect): void {
  ensure(keyOf(gameId, aspect), gameId, title, aspect);
}

/**
 * What is known of a game's animated cover in one shape, without asking:
 * the asset, `null` for none, or `undefined` when nobody has looked yet.
 */
export function peekAnimatedCover(
  gameId: string,
  aspect: CoverAspect
): AnimatedAsset | null | undefined {
  const picked = pickedFor(keyOf(gameId, aspect));
  return picked === null ? undefined : picked === NONE ? null : picked;
}

// ---------------------------------------------------------------------------
// One animated cover playing at a time
// ---------------------------------------------------------------------------

/**
 * Who may play: the newest cover that wants to, and when it lets go, the one
 * before it. "Only one animated asset should be playing at a time" — the
 * request's rule — so a cover that is covered by another (the game page's
 * viewer over Surprise Me's card, say) pauses until it is in front again.
 */
const claimants: object[] = [];
const playbackSubscribers = new Set<() => void>();

function current(): object | null {
  return claimants[claimants.length - 1] ?? null;
}

function subscribePlayback(callback: () => void): () => void {
  playbackSubscribers.add(callback);
  return () => {
    playbackSubscribers.delete(callback);
  };
}

function notifyPlayback(): void {
  for (const callback of playbackSubscribers) callback();
}

/** Whether this cover is the one playing, given that it wants to. */
export function useCoverPlayback(wants: boolean): boolean {
  const [token] = useState(() => ({}));
  const owner = useSyncExternalStore(subscribePlayback, current, () => null);

  useEffect(() => {
    if (!wants) return;
    claimants.push(token);
    notifyPlayback();
    return () => {
      const index = claimants.indexOf(token);
      if (index >= 0) claimants.splice(index, 1);
      notifyPlayback();
    };
  }, [wants, token]);

  return wants && owner === token;
}
