import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { decode } from 'jpeg-js';
import { useMemo } from 'react';

import { useGameColours } from '@/hooks/use-game-colours';
import { keyColorOf, keyPage, visibleRegion, type Anchor, type Size } from '@/lib/key-color';

/**
 * The file a hero's key colour is read from, or null when it cannot be read
 * for nothing.
 *
 * **IGDB's `t_cover_small` of the same picture.** IGDB names a size in the
 * path, and `cover_small` is a *fit* — the whole image scaled into 90 × 128,
 * never cropped — so a 16:9 key art comes back as 90 × 51, every edge intact,
 * in about 2 KB. Decoded in JavaScript that is about 15 ms on a phone's
 * interpreter. Never `t_thumb`, which is a centre crop: it cuts away the very
 * edges this reads.
 *
 * **Nothing else.** SteamGridDB's smallest square is 400 × 400, a second of
 * JavaScript decoding (measured, JIT off: 1.0 s on a desktop CPU), and a
 * Steam hero has no small copy at all; a collection drawing square art and a
 * legacy Steam game have no key colour, and their hero melts into the page's
 * own colour, as it did before. The edges of a *different* picture — the box
 * art standing in for the square — would be the colour of an edge nobody can
 * see, which is the one thing a key colour must never be.
 */
export function keyColorSource(uri: string | null | undefined): string | null {
  if (!uri || !/^https:\/\/images\.igdb\.com\//.test(uri)) return null;
  if (!/\/t_[a-z0-9_]+\//i.test(uri)) return null;
  /* JPEG whatever the slot draws: the decoder reads nothing else, and IGDB
     answers any extension. */
  return uri
    .replace(/\/t_[a-z0-9_]+\//i, '/t_cover_small/')
    .replace(/\.(png|webp)(\?.*)?$/i, '.jpg');
}

/** Cache version. Bump it when what is read, or how, changes. */
const CACHE_PREFIX = 'key-color:v1:';
/** Stored when the image decoded and had nothing to read. */
const NONE = 'none';
/** A `t_cover_small` is ~2 KB and 0.012 MP; these only stop a host that ignored the size. */
const MAX_BYTES = 40_000;
const MAX_MP = 0.03;

/** Synchronous in-memory cache so subsequent screen renders have 0ms disk delay. */
const MEMORY_CACHE = new Map<string, string | null>();

/**
 * The page's two tones, from its artwork's key colour: `bright` at rest and
 * `dark` once the artwork has gone (`keyPage`) — or null for both, which is
 * the answer while the colour is read, for art that cannot be read, and while
 * game colours are off. The page then keeps whatever colour it had.
 *
 * `frame` is the hero's size and `anchor` the image's `contentPosition`, so
 * the edges read are the edges on screen (`visibleRegion`). `ink` is the
 * quietest type the page carries; the bright tone holds AA against it.
 *
 * `resolved` is false only while a colour is being read for the first time —
 * on every later sighting the answer is in memory or on the device before the
 * first frame. The page draws whatever it has either way, and takes its colour
 * over 600 ms when the colour arrives.
 */
export function useKeyColor(
  uri: string | null | undefined,
  {
    frame,
    anchor,
    ink,
    enabled = true,
  }: { frame?: Size; anchor?: Anchor; ink?: string; enabled?: boolean }
): { bright: string | null; dark: string | null; resolved: boolean } {
  const colours = useGameColours();
  const source = colours.on && enabled ? keyColorSource(uri) : null;

  /* The crop is a property of the frame's shape, not its size: rounded, so a
     rotation or a keyboard does not ask again for a hair's difference. No
     frame is the whole picture (`0`): a page whose art is drawn whole, or
     cropped by a frame the page does not know. */
  const aspect = !frame
    ? 0
    : frame.height > 0
      ? Math.round((frame.width / frame.height) * 100) / 100
      : 1;
  const ax = Math.round((anchor?.x ?? 0.5) * 100) / 100;
  const ay = Math.round((anchor?.y ?? 0.5) * 100) / 100;

  const cacheKey = source ? `${CACHE_PREFIX}${source}:${aspect}:${ax}:${ay}` : null;
  const inMemory = cacheKey && MEMORY_CACHE.has(cacheKey) ? MEMORY_CACHE.get(cacheKey) : undefined;

  const key = useQuery({
    queryKey: ['key-color', source, aspect, ax, ay],
    queryFn: () => readKeyColor(source!, aspect, { x: ax, y: ay }),
    enabled: !!source,
    initialData: () => (inMemory !== undefined ? inMemory : undefined),
    /* A picture's edges do not change; the far cache is AsyncStorage. */
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  const raw = source ? (key.data ?? null) : null;
  const tones = useMemo(() => (raw ? keyPage(raw, { ink }) : null), [raw, ink]);
  return {
    bright: tones?.bright ?? null,
    dark: tones?.dark ?? null,
    resolved: !source || !key.isPending,
  };
}

async function readKeyColor(
  source: string,
  aspect: number,
  anchor: Anchor
): Promise<string | null> {
  const cacheKey = `${CACHE_PREFIX}${source}:${aspect}:${anchor.x}:${anchor.y}`;
  if (MEMORY_CACHE.has(cacheKey)) {
    return MEMORY_CACHE.get(cacheKey) ?? null;
  }

  try {
    const stored = await AsyncStorage.getItem(cacheKey);
    if (stored === NONE) {
      MEMORY_CACHE.set(cacheKey, null);
      return null;
    }
    if (stored && /^#[0-9a-f]{6}$/i.test(stored)) {
      MEMORY_CACHE.set(cacheKey, stored);
      return stored;
    }
  } catch {
    /* An unreadable cache is an empty one. */
  }

  let color: string | null = null;
  try {
    const response = await fetch(source);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) return null;
    /* `useTArray`: React Native has no Node `Buffer` for jpeg-js to reach for. */
    const image = decode(bytes, {
      useTArray: true,
      maxMemoryUsageInMB: 8,
      maxResolutionInMP: MAX_MP,
    });
    const frame: Size = { width: aspect, height: 1 };
    color =
      keyColorOf(image.data, image.width, image.height, {
        region: aspect > 0 ? visibleRegion(image, frame, anchor) : undefined,
      })?.color ?? null;
  } catch {
    /* A hero whose colour cannot be read melts into the page's own colour, and
       looks entirely normal; the next visit asks again. */
    return null;
  }

  MEMORY_CACHE.set(cacheKey, color);

  try {
    await AsyncStorage.setItem(cacheKey, color ?? NONE);
  } catch {
    /* A full disk should not stop a hero from having a ground. */
  }
  return color;
}

/** The ground a card stands on before its art's colour is read, or without one: the dark room's card. */
export const ART_GROUND_FALLBACK = '#1C1C1E';
/** The quietest ink set on an art ground: the dark room's `textSecondary`. */
const ART_GROUND_INK = '#A8A8A8';

/**
 * A card's ground, read from the landscape art at its top as the game page
 * reads its page (the owner's, 2026-11-06, after Apple News's cards): the
 * art's key colour, darkened until the card's quiet type holds AA on it, so
 * the card is one colour from the art's foot down and white type reads on
 * it. The dark room's card colour until it is read, for art that is not
 * IGDB's, and with game colours off.
 */
export function useArtGround(uri: string | null | undefined, frame: Size, anchor?: Anchor): string {
  const key = useKeyColor(uri, { frame, anchor, ink: ART_GROUND_INK });
  return key.bright ?? ART_GROUND_FALLBACK;
}
