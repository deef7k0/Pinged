import { Platform } from 'react-native';

import {
  MAX_ALTERNATES,
  igdbAnimatedCoverUrl,
  lightEnough,
  matchesAspect,
  sgdbCandidates,
  type AnimatedAsset,
  type CoverAspect,
  type CoverPlatform,
} from '../animated-cover';
import { igdbQuery } from './igdb';
import { SgdbUnavailable, getAnimatedGrids } from './steamgriddb';
import { parseGameId } from './types';

/**
 * Finding a game's animated covers in one shape: SteamGridDB first, IGDB
 * second — the files light enough to show (`MAX_ANIMATED_BYTES`), in order:
 * every grid's full-size animation before any grid's small preview, the
 * most-liked grid first, never a joke one (`sgdbCandidates`, `rankGrids`).
 * Up to `MAX_ALTERNATES`: the first is played, the rest are what a phone
 * that cannot play it falls back on (`pickPlayable`) — with the first
 * preview always among them, where there is one, since it is a different
 * decoder. Each carries its weight in bytes, from the HEAD that checked it,
 * so a screen can plan what to download before it does.
 *
 * The rules are `lib/animated-cover.ts`; the cache in front of this, which is
 * what keeps a game known to have none from being asked again, is
 * `hooks/use-animated-cover.ts`.
 *
 * An empty list is the normal answer — very few games have one — and it is
 * remembered for a month. So **it means only "there is none"**: when
 * SteamGridDB or a file's server could not be asked (no key in the build, a
 * 429, no network) this throws `SgdbUnavailable` and nothing is remembered.
 * Until 2026-11-03 those were empty lists too, and a build made without the
 * key had every game the phone opened stored as having none.
 */

export type AnimatedCoverInput = {
  /** App-wide game id (`igdb:1234`): the IGDB id, and a legacy row's Steam appid. */
  gameId: string;
  /** For SteamGridDB, which does not index IGDB and is searched by title. */
  title: string | null;
  aspect: CoverAspect;
};

const PLATFORM: CoverPlatform =
  Platform.OS === 'ios' ? 'ios' : Platform.OS === 'web' ? 'web' : 'android';

/** One IGDB cover, as `covers` answers it. */
type IgdbCover = { image_id?: string; width?: number; height?: number; animated?: boolean };

export async function findAnimatedCovers(
  { gameId, title, aspect }: AnimatedCoverInput,
  signal?: AbortSignal
): Promise<AnimatedAsset[]> {
  const parsed = parseGameId(gameId);
  const steamAppId = parsed?.source === 'steam' ? Number(parsed.sourceId) || undefined : undefined;

  /* 1. SteamGridDB's animated grids: the files light enough, in order, and
     the first preview kept back as the last resort. */
  const grids = await getAnimatedGrids({ steamAppId, title: title ?? undefined }, aspect, signal);
  const candidates = sgdbCandidates(grids, PLATFORM);
  const firstPreview = candidates.find((candidate) => candidate.quality === 'preview');
  const found: AnimatedAsset[] = [];
  let unreachable = false;
  for (const candidate of candidates) {
    const room = MAX_ALTERNATES - (firstPreview && candidate !== firstPreview ? 1 : 0);
    if (found.length >= room && candidate !== firstPreview) continue;
    const weight = await weigh(candidate.url, signal);
    if (weight.unreachable) unreachable = true;
    if (weight.fits) found.push({ ...candidate, bytes: weight.bytes });
    if (found.length >= MAX_ALTERNATES) break;
  }
  if (found.length > 0) return found;
  /* Grids exist and none could be weighed: not evidence there is none. */
  if (unreachable) throw new SgdbUnavailable('Could not reach the animated files');

  /* 2. IGDB's own cover, when it is animated and the right shape. Only 51
     covers in the whole catalogue are (checked live, 2026-10-20), so this
     is a rare second chance, not a second source of many. */
  if (parsed?.source !== 'igdb') return [];
  try {
    const covers = await igdbQuery<IgdbCover[]>(
      'covers',
      `fields image_id, animated, width, height;
       where game = ${Number(parsed.sourceId)} & animated = true;
       limit 10;`,
      signal
    );
    const cover = (covers ?? []).find(
      (entry) =>
        entry.animated &&
        entry.image_id &&
        matchesAspect(entry.width ?? 0, entry.height ?? 0, aspect)
    );
    if (!cover?.image_id) return [];
    const url = igdbAnimatedCoverUrl(cover.image_id);
    const weight = await weigh(url, signal);
    if (weight.unreachable) throw new SgdbUnavailable("Could not reach IGDB's file");
    return weight.fits
      ? [
          {
            url,
            format: 'image',
            quality: 'full',
            bytes: weight.bytes,
            width: cover.width ?? null,
            height: cover.height ?? null,
          },
        ]
      : [];
  } catch (error) {
    /* IGDB not answering is not IGDB saying there is none. */
    if (error instanceof SgdbUnavailable) throw error;
    throw new SgdbUnavailable(String(error));
  }
}

/**
 * How heavy a file is, and whether that is light enough to show
 * (`MAX_ANIMATED_BYTES`), by a HEAD request: a few hundred bytes, against an
 * animated WebP that can weigh eighteen megabytes. A server that does not say
 * is believed (`bytes: null`); one that cannot be reached is not, and is
 * `unreachable` — a 404 is an answer, a 5xx, a 429 or no network is not.
 */
async function weigh(
  url: string,
  signal?: AbortSignal
): Promise<{ fits: boolean; bytes: number | null; unreachable: boolean }> {
  try {
    const response = await fetch(url, { method: 'HEAD', ...(signal ? { signal } : {}) });
    if (!response.ok) {
      const answered = response.status === 404 || response.status === 410;
      return { fits: false, bytes: null, unreachable: !answered };
    }
    const length = response.headers.get('content-length');
    const bytes = length === null ? null : Number(length);
    return {
      fits: lightEnough(bytes),
      bytes: Number.isFinite(bytes) ? bytes : null,
      unreachable: false,
    };
  } catch {
    return { fits: false, bytes: null, unreachable: true };
  }
}
