import { useQuery } from '@tanstack/react-query';

import { igdbQuery } from '@/lib/games/igdb';
import { POSTER_ART_FIELDS, choosePosterArt, type PosterArt } from '@/lib/games/poster-art';
import { parseGameId } from '@/lib/games/types';

/**
 * A review's poster card's art and logo (`lib/games/poster-art`), for one
 * game — asked of IGDB **together with every other card on screen**: the
 * cards of a list mount in the same moment, and each one's request waits a
 * few milliseconds for the rest, so twenty reviews are one request, not
 * twenty against credentials every phone shares (four a second).
 *
 * `['poster-art', gameId]` is kept on the device like any query (plain JSON),
 * and fresh for a month: a game's artwork hardly changes, so a list seen once
 * opens on its art. A game that is not IGDB's has no answer (`null`), and the
 * card draws the logged art and the name in type.
 */
export function usePosterArt(gameId: string | null | undefined) {
  return useQuery({
    queryKey: ['poster-art', gameId],
    queryFn: () => batched(gameId!),
    enabled: !!gameId,
    staleTime: 30 * 24 * 60 * 60_000,
    gcTime: 60 * 60_000,
  });
}

/** How long a request waits for the rest of its screen, and the most in one. */
const GATHER_MS = 24;
const MAX_IDS = 50;

type Waiting = { resolve: (art: PosterArt | null) => void; reject: (error: unknown) => void };
const pending = new Map<string, Waiting[]>();
let timer: ReturnType<typeof setTimeout> | null = null;

function batched(gameId: string): Promise<PosterArt | null> {
  const parsed = parseGameId(gameId);
  if (!parsed || parsed.source !== 'igdb' || !/^\d+$/.test(parsed.sourceId)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve, reject) => {
    const list = pending.get(parsed.sourceId) ?? [];
    list.push({ resolve, reject });
    pending.set(parsed.sourceId, list);
    if (!timer) timer = setTimeout(flush, GATHER_MS);
  });
}

function flush() {
  timer = null;
  const all = [...pending.entries()];
  pending.clear();
  for (let start = 0; start < all.length; start += MAX_IDS) {
    const group = all.slice(start, start + MAX_IDS);
    void ask(group);
  }
}

type Raw = {
  id: number;
  artworks?: Parameters<typeof choosePosterArt>[0];
  screenshots?: Parameters<typeof choosePosterArt>[1];
};

async function ask(group: [string, Waiting[]][]) {
  try {
    const ids = group.map(([id]) => id);
    const rows = await igdbQuery<Raw[]>(
      'games',
      `fields ${POSTER_ART_FIELDS}; where id = (${ids.join(',')}); limit ${ids.length};`
    );
    const byId = new Map((rows ?? []).map((row) => [String(row.id), row]));
    for (const [id, waiting] of group) {
      const row = byId.get(id);
      const art = row ? choosePosterArt(row.artworks, row.screenshots) : null;
      for (const entry of waiting) entry.resolve(art);
    }
  } catch (error) {
    for (const [, waiting] of group) for (const entry of waiting) entry.reject(error);
  }
}
