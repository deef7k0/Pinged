import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

import type { LogoInk } from '@/lib/logo-ink';
import { igdbLogoSource, measureLogoInk } from '@/lib/logo-luminance';

/**
 * What a platform's or studio's logo is made of, remembered across launches,
 * so it can be drawn straight on the page (`<LogoMark>`).
 *
 * The same shape as `use-square-cover`, for the same reason: the answer has to
 * be known *before the first paint*. A logo drawn on a plate and then moved off
 * it a beat later — or drawn dark and then lightened — is a flash on every
 * tile of a directory of two hundred, every time it mounts. So this is a
 * module store persisted to AsyncStorage and read through
 * `useSyncExternalStore`:
 *
 *  - The first time the app ever sees a logo, `resolved` is false and the
 *    caller draws nothing in its frame.
 *  - The measurement — **including "could not be read"** — goes to disk.
 *  - Every sighting after that resolves on the first render: no request, no
 *    decode, no change of treatment.
 *
 * A measurement is one ~2 KB request and a decode of at most 8,100 pixels in
 * JavaScript, a few milliseconds, once per logo.
 */

/**
 * Cache lifetime. A logo's pixels change when somebody re-uploads it, which is
 * to say almost never; the expiry exists so one that does change is picked up
 * eventually.
 */
const TTL_MS = 60 * 24 * 60 * 60 * 1000;

/* 2: measurements carry `bounds` (where the drawing is in its file). */
const CACHE_VERSION = 2;
const CACHE_KEY = `logo-ink:v${CACHE_VERSION}`;

/**
 * How many logos are fetched and decoded at once. The decode is on the JS
 * thread; four at a time keeps a directory's first screenful from arriving as
 * one long task.
 */
const MAX_CONCURRENT = 4;

/** `ink: null` is a real, cached answer — "this file could not be read as a logo". */
type Entry = { ink: LogoInk | null; storedAt: number };

const memory = new Map<string, Entry>();
/**
 * Logos whose request failed this session. Resolved — the tile falls back to
 * its plate rather than staying empty — but not written to disk, so the next
 * launch asks again. Offline is not a property of the logo.
 */
const unreachable = new Set<string>();
const inflight = new Set<string>();
const subscribers = new Set<() => void>();

/** The hydration itself, not a flag: every caller awaits the same disk read. */
let hydration: Promise<void> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

let active = 0;
const queue: (() => void)[] = [];

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
      if (!entry || now - entry.storedAt > TTL_MS) continue;
      memory.set(key, entry);
    }
  } catch {
    /* A corrupt cache is not worth surfacing: every entry is one small
       request away. */
  } finally {
    /* Unconditional: tiles hold their empty frame until told otherwise, and on
       an empty cache this is the only thing that tells them. */
    notify();
  }
}

function schedulePersist(): void {
  if (persistTimer !== null) return;

  persistTimer = setTimeout(() => {
    persistTimer = null;
    void AsyncStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(memory))).catch(() => {
      /* Out of disk, or storage unavailable. The in-memory map still serves
         this session. */
    });
  }, 400);
}

/** Waits for a slot, runs `task`, then hands the slot on. */
async function limited<T>(task: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => queue.push(resolve));
  }
  active += 1;
  try {
    return await task();
  } finally {
    active -= 1;
    queue.shift()?.();
  }
}

/** Measure one logo, unless it is already known or already being measured. */
function ensure(key: string, measureUrl: string): void {
  if (memory.has(key) || unreachable.has(key) || inflight.has(key)) return;
  inflight.add(key);

  void (async () => {
    try {
      await hydrate();
      if (memory.has(key)) return;

      const ink = await limited(() => measureLogoInk(measureUrl));
      memory.set(key, { ink, storedAt: Date.now() });
      schedulePersist();
    } catch {
      unreachable.add(key);
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

export type MeasuredLogo = {
  /** What the logo is made of, or null when it could not be measured. Meaningless until `resolved`. */
  ink: LogoInk | null;
  /**
   * Whether the answer is known. **Draw nothing until it is**: the treatment
   * is chosen from `ink`, and a logo drawn one way and then another is the
   * flash this hook exists to prevent. False only on a logo's first sighting.
   */
  resolved: boolean;
};

/** Resolved and unmeasured — for a frame with no logo, or one from elsewhere. */
const UNMEASURED: MeasuredLogo = { ink: null, resolved: true };
const PENDING: MeasuredLogo = { ink: null, resolved: false };

/** The snapshot for a logo whose request failed this session. */
const UNREACHABLE = 'unreachable';

export function useLogoInk(uri: string | null | undefined): MeasuredLogo {
  const source = uri ? igdbLogoSource(uri) : null;
  const key = source?.id ?? null;
  const measureUrl = source?.measureUrl ?? null;

  /* The stored entry itself, or a constant: the same reference until the
     answer changes, which is what `useSyncExternalStore` asks of a snapshot. */
  const entry = useSyncExternalStore(
    subscribe,
    () => (key ? (memory.get(key) ?? (unreachable.has(key) ? UNREACHABLE : null)) : null),
    () => null
  );

  /* Fired from an effect and setting no state: `ensure` writes to the module
     map and the re-render comes through the store. */
  useEffect(() => {
    if (key && measureUrl) ensure(key, measureUrl);
  }, [key, measureUrl]);

  if (!key || entry === UNREACHABLE) return UNMEASURED;
  if (!entry) return PENDING;
  return { ink: entry.ink, resolved: true };
}
