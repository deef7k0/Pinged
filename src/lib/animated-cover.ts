/**
 * Animated covers — the rules, as data: which shapes there are, which file of
 * a SteamGridDB grid a phone can play, how a format is told from its address,
 * and which IGDB cover counts as which shape.
 *
 * The owner's request (2026-10-20): replace the static cover with an animated
 * one, where one exists, on Surprise Me (square), a review's page (square) and
 * the game page (portrait, once the cover is tapped and brought to the middle
 * of the screen). SteamGridDB first, IGDB second.
 *
 * Pure — no React Native, no network — so `npm test` covers it. The requests
 * are `lib/games/animated-covers.ts`; the cache and the hook are
 * `hooks/use-animated-cover.ts`; the drawing is `<AnimatedCoverImage>`.
 */

/** The two shapes a cover is asked for in, each looked up on its own. */
export type CoverAspect = 'square' | 'portrait';

/**
 * Where a lookup stands: not asked (nothing to ask, or Reduce Motion),
 * asking, an animated cover to show, or none.
 */
/** `unavailable`: the lookup failed this session (no network, a rate limit) — not remembered. */
export type CoverStatus = 'idle' | 'loading' | 'found' | 'not_found' | 'unavailable';

/**
 * How an animated file is drawn: an animated image (WebP, APNG, GIF) by
 * expo-image, which decodes all three on both platforms; a video (WebM, MP4)
 * by expo-video, looping and muted.
 */
export type AnimatedFormat = 'image' | 'video';

/**
 * Which file of an animation this is: the animation itself at its full size
 * (SteamGridDB's 600×900 or 1024×1024, IGDB's `t_720p`), or SteamGridDB's
 * small WebM preview of it — 267×400 for a portrait, checked live.
 */
export type AnimatedQuality = 'full' | 'preview';

/**
 * One animated cover, as it will be drawn — and what it costs.
 *
 * `bytes` is what the HEAD request said (null when the server did not say),
 * so a screen can decide what to fetch before fetching it: Surprise Me
 * prefetches a light animation with the next card's still and leaves a
 * heavy one until its card is in front (`lib/surprise-prefetch.ts`).
 * Optional, because an answer stored before this was recorded has none.
 */
export type AnimatedAsset = {
  url: string;
  format: AnimatedFormat;
  quality?: AnimatedQuality;
  bytes?: number | null;
  width?: number | null;
  height?: number | null;
};

/**
 * SteamGridDB's grid sizes for each shape. Portrait is its 2:3-ish trio —
 * 600×900, 660×930 and 342×482 all come back for animated grids (checked
 * live, 2026-10-20); square is the two sizes the static square already asks
 * for.
 */
export const SGDB_DIMENSIONS: Record<CoverAspect, string> = {
  square: '512x512,1024x1024',
  portrait: '600x900,660x930,342x482',
};

/**
 * Grids asked for at once. Ten, up from five, because some are now passed
 * over before anything is weighed — the humorous ones (`rankGrids`).
 */
export const SGDB_CANDIDATES = 10;

/**
 * How many playable files a game's answer keeps: the one to play, and the
 * ones to fall back on, in order, should it not play on this phone
 * (`pickPlayable`). Each costs a HEAD request when the game is looked up.
 */
export const MAX_ALTERNATES = 4;

/**
 * The most an animated file may weigh, in bytes.
 *
 * SteamGridDB's animated grid is the full animation as a WebP or an APNG, and
 * it is heavy: Hollow Knight's top portrait is **18.7 MB** — the same
 * animation as its WebM preview is 1.4 MB (checked live, 2026-10-20). A cover
 * is not worth eighteen megabytes on a phone's data, or the memory to decode
 * it, so a file over this is passed over for the next one.
 *
 * **Twelve, up from eight, because the full file is now the one wanted**
 * (2026-10-21, the owner: "make the animated artwork higher quality, like
 * 720p"). The first portrait of twenty well-known games, measured live: eight
 * under 8 MB, twelve under 12 — and walking a game's five grids for the first
 * that fits finds one for nineteen of the twenty. Every file is fetched once
 * and kept in the image cache, and only for the card or the cover in front.
 */
export const MAX_ANIMATED_BYTES = 12 * 1024 * 1024;

/** The fields of one SteamGridDB grid that this reads. */
export type SgdbGrid = {
  url?: string | null;
  /** A WebM of the animation, for an animated grid. */
  thumb?: string | null;
  mime?: string | null;
  width?: number;
  height?: number;
  nsfw?: boolean;
  /** Flashing that could set off a seizure: never shown. */
  epilepsy?: boolean;
  /** A joke version of the cover: never shown (the owner's, 2026-10-21). */
  humor?: boolean;
  upvotes?: number;
  downvotes?: number;
  score?: number;
};

/**
 * The grids worth showing, the most liked first.
 *
 * The owner (2026-10-21): "Remove humorous animated ones. Ones that are tagged
 * with humor, or maybe get the most liked one." Both: a grid flagged `humor`
 * is dropped (and asked away in the request too), as are NSFW and
 * epilepsy-flagged ones; the rest are ordered by their votes, upvotes less
 * downvotes, then SteamGridDB's own score, and its own order where those tie —
 * which, for most games, is every grid at nought.
 */
export function rankGrids(grids: readonly SgdbGrid[]): SgdbGrid[] {
  const liked = (grid: SgdbGrid) => (grid.upvotes ?? 0) - (grid.downvotes ?? 0);
  return grids
    .map((grid, index) => ({ grid, index }))
    .filter(({ grid }) => !grid.epilepsy && !grid.nsfw && !grid.humor)
    .sort(
      (a, b) =>
        liked(b.grid) - liked(a.grid) ||
        (b.grid.score ?? 0) - (a.grid.score ?? 0) ||
        a.index - b.index
    )
    .map(({ grid }) => grid);
}

/** Which platform is drawing: iOS's AVPlayer cannot open a WebM. */
export type CoverPlatform = 'ios' | 'android' | 'web';

/** A file's format, from its address — its extension, query and fragment aside. */
export function animatedFormatOf(url: string): AnimatedFormat | null {
  const path = url.split(/[?#]/)[0].toLowerCase();
  const extension = path.slice(path.lastIndexOf('.') + 1);
  if (extension === 'webm' || extension === 'mp4' || extension === 'm4v') return 'video';
  if (extension === 'webp' || extension === 'png' || extension === 'apng' || extension === 'gif') {
    return 'image';
  }
  return null;
}

/**
 * Whether Skia can play this file in the game page's hero, under its one
 * blur: an animated **WebP or GIF**, or a **video** (WebM, MP4), each read
 * frame by frame (`useAnimationFrames`). Never an **APNG**: Skia has no APNG
 * decoder, so one is its first frame there, still forever — what the owner
 * saw as covers "paused" (2026-11-04). An APNG is expo-image's, over the art.
 */
export function skiaAnimates(url: string | null | undefined): boolean {
  if (!url) return false;
  const path = url.split(/[?#]/)[0].toLowerCase();
  return /\.(webp|gif|webm|mp4|m4v)$/.test(path);
}

/**
 * The files of these grids a phone can play, best first: **every grid's full
 * animation, then every grid's preview**, each in SteamGridDB's order (by
 * score).
 *
 * - **Never** a grid flagged for epilepsy or as NSFW — both are also asked
 *   away in the request, and checked again here in case the filter is ignored.
 * - **The full animation first** — the WebP or APNG, 600×900 for a portrait,
 *   which expo-image animates on both platforms. Until 2026-10-21 Android and
 *   the web played the WebM instead, a tenth of the weight; it is SteamGridDB's
 *   *preview*, 267×400 (checked live), and drawn 360dp wide it was the
 *   "low quality" the owner saw. The caller walks this list for the first file
 *   under `MAX_ANIMATED_BYTES`, so a heavy first grid gives way to a lighter
 *   second one before anything is drawn small.
 * - **The preview last**, where nothing full-size is light enough — moving
 *   and soft is still better than nothing at all. Never on iOS, whose
 *   AVPlayer has no WebM.
 */
export function sgdbCandidates(
  grids: readonly SgdbGrid[],
  platform: CoverPlatform
): AnimatedAsset[] {
  const safe = rankGrids(grids);
  const full = safe.flatMap((grid): AnimatedAsset[] =>
    grid.url && animatedFormatOf(grid.url) === 'image'
      ? [
          {
            url: grid.url,
            format: 'image',
            quality: 'full',
            width: grid.width ?? null,
            height: grid.height ?? null,
          },
        ]
      : []
  );
  if (platform === 'ios') return full;
  const previews = safe.flatMap((grid): AnimatedAsset[] =>
    grid.thumb && animatedFormatOf(grid.thumb) === 'video'
      ? [{ url: grid.thumb, format: 'video', quality: 'preview' }]
      : []
  );
  return [...full, ...previews];
}

/**
 * Which of a game's playable files to show, given what has failed on this
 * phone this session — or null when none is left.
 *
 * A file that would not play is passed over, and so is **every full-size
 * animation at least as heavy as one that failed**: an animated image that
 * will not decode here (Red Dead Redemption 2's 8 MB WebP gave Glide's
 * "Failed to load resource", 2026-10-21) is likelier to be the phone's limit
 * than the file's, and each attempt is a whole download. The previews are
 * never skipped for it — they are a different decoder (a video) and small.
 */
export function pickPlayable(
  assets: readonly AnimatedAsset[],
  failedUrls: ReadonlySet<string>,
  failedAtBytes: number
): AnimatedAsset | null {
  return (
    assets.find(
      (asset) =>
        !failedUrls.has(asset.url) &&
        !(
          asset.quality === 'full' &&
          typeof asset.bytes === 'number' &&
          asset.bytes >= failedAtBytes
        )
    ) ?? null
  );
}

/** Whether an IGDB cover of this size is the shape asked for. */
export function matchesAspect(width: number, height: number, aspect: CoverAspect): boolean {
  if (!(width > 0 && height > 0)) return false;
  if (aspect === 'portrait') return height > width;
  /* Square to within a pixel in a hundred, so a 600×601 upload still counts. */
  return Math.abs(width - height) <= Math.max(1, Math.round(width / 100));
}

/**
 * An IGDB cover's animated file. **WebP, not PNG**: IGDB serves an animated
 * cover's `.png` as its first frame only, and the `.webp` and `.gif` as the
 * animation — the WebP is the smaller. `t_720p`, because every slot that
 * shows one is about 300dp wide: it stays animated at that size (`co4a6r`,
 * 540×720, 674 KB, where `t_cover_big` is 264 wide; checked live,
 * 2026-10-20).
 */
export function igdbAnimatedCoverUrl(imageId: string): string {
  return `https://images.igdb.com/igdb/image/upload/t_720p/${imageId}.webp`;
}

/** Whether a file of this many bytes is light enough to show. Unknown is allowed. */
export function lightEnough(bytes: number | null): boolean {
  return bytes === null || (Number.isFinite(bytes) && bytes <= MAX_ANIMATED_BYTES);
}
