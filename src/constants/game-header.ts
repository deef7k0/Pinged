import { PROGRESSIVE_BLUR, blurStart } from '../lib/progressive-blur';

/**
 * The game page's header, Apple TV's words over the pinned cover (the
 * owner's, 2026-11-03): the cover pinned behind the page with everything it
 * had — the drift, Convx's row-by-row blur, the mirrored tail and the drain
 * into the page's colour (`<PinnedHero>`) — and the words laid on its foot,
 * the title's top exactly where the blur begins (the owner's, 2026-11-03).
 * Pure, so `npm test` holds it.
 *
 * **The cover is drawn at its own shape, uncropped** (the owner's,
 * 2026-11-04: "They must not be cropped or resized, they must have the
 * original ratio and fit perfectly to the sides of the screen. If doing this
 * means making the header smaller or bigger… its fine"). It was 2:3 and at
 * most 74% of the display, and IGDB's covers are mostly 3:4 — so every one
 * was zoomed in and its sides cut.
 */
export const GAME_HEADER = {
  /**
   * The cover's height over its width when its own shape is not yet known:
   * IGDB's commonest, 3:4 (`t_cover_big` is 264×352 for most uploads).
   */
  portraitRatio: 4 / 3,
  /**
   * A shape outside these is not a box (a strip, a banner uploaded as a
   * cover) and is drawn at the nearer bound. Every real cover is inside.
   */
  minRatio: 1,
  maxRatio: 2,
  /** The header changes shape — cover ↔ trailer — under a fade this long each way. */
  swapMs: 400,
  /** How long the page rests on the cover before the trailer plays by itself. */
  autoplayMs: 4500,
} as const;

/**
 * How tall the cover is drawn on a display `width` wide: the display's whole
 * width, and the cover's own height for it — `aspect` is its height over its
 * width (IGDB's numbers, or the loaded file's).
 */
export function coverHeight(width: number, aspect?: number | null): number {
  const ratio =
    aspect && Number.isFinite(aspect) && aspect > 0
      ? Math.min(GAME_HEADER.maxRatio, Math.max(GAME_HEADER.minRatio, aspect))
      : GAME_HEADER.portraitRatio;
  return Math.round(width * ratio);
}

/**
 * Where the words start, so the title's top (`titleY` into the words — 0, or
 * under a "Coming" badge) is where the art's blur begins, and never under
 * the top bar's discs. `knee` is where the blur begins, in sides: Convx's,
 * or lower for a page with no title (`TITLELESS_KNEE`).
 */
export function wordsTop(
  artHeight: number,
  titleY: number,
  topRoom: number,
  knee: number = PROGRESSIVE_BLUR.knee
): number {
  return Math.max(topRoom, Math.round(blurStart(artHeight, knee)) - titleY);
}

/**
 * Where the words start on a page with no title (Settings → Game title off),
 * in sides: a little above the cover's foot (405/393 of a side), on the
 * blur, which there begins at `TITLELESS_KNEE`. It was 1.10, wholly under
 * the cover; the owner had it raised "just a little bit" (2026-11-04).
 */
export const TITLELESS_WORDS_KNEE = 0.98;
