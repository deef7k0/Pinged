/**
 * Which of a game's images is its logo — the transparent wordmark the game
 * page sets where the name was (the owner's, 2026-11-03: "We used to have a
 * way to fetch the png title of a game… I want that back, to try and see how
 * it looks on the game page").
 *
 * Pure, and under `npm test`.
 *
 * ## Where it comes from: IGDB, at no cost
 *
 * The first version (removed 2026-10-22, never committed) looked a logo up on
 * Wikimedia Commons by the game's Wikidata item, then on SteamGridDB — two
 * services and a title match. IGDB has its own: an artwork's `artwork_type`
 * says "Game logo (white)", "(black)" or "(color)", and `GAME_FIELDS` already
 * asks for every artwork's type and size, so the logo rides in the record the
 * page has already downloaded. Of the forty most-rated games (checked live,
 * 2026-11-03) thirty-seven have one; nearly all are cut out (alpha).
 *
 * ## Which one
 *
 * The page under the words is dark — the cover's blurred foot washing into
 * the game's darkest tone — so **the white logo first**: it is the one the
 * publisher drew for a dark ground. Then **the colour one**, which the page
 * measures before drawing (`useLogoInk`) and draws as a white silhouette only
 * when it is dark nearly all over (`gameLogoLook`). Then **the black one, drawn white** (`tint`), which
 * is the same shapes. A historical logo only when there is nothing else.
 * Within a kind, the widest file.
 */

import type { LogoInk } from '../logo-ink';

/** As much of an IGDB artwork as choosing needs. */
export type LogoCandidate = {
  image_id?: string;
  width?: number;
  height?: number;
  artwork_type?: number | null;
};

/** A game's logo, as the page draws it. Plain JSON: it is kept with the game. */
export type GameLogo = {
  /** A PNG, so its transparency survives (IGDB flattens a JPEG's to black). */
  url: string;
  width: number;
  height: number;
  /** A black logo: drawn white on the page. */
  tint: boolean;
};

/** IGDB's `artwork_types` that are logos, best first (see `hero-art.ts`). */
const LOGO_RANK: Record<number, { rank: number; tint: boolean }> = {
  5: { rank: 0, tint: false }, // Game logo (white)
  7: { rank: 1, tint: false }, // Game logo (color)
  6: { rank: 2, tint: true }, // Game logo (black)
  13: { rank: 3, tint: false }, // Historical logo
};

/** Narrower than this, a logo is a thumbnail somebody uploaded, not a file to draw. */
const MIN_WIDTH = 200;
/**
 * Taller than this over its width, it is a badge or an emblem with no
 * wordmark in it — nothing that stands where a name stands.
 */
const MAX_TALL = 1.25;
/** At or under this width IGDB's original is drawn; above it, its 1280px rendition. */
const ORIGINAL_UNDER = 1280;

const IGDB_UPLOAD = 'https://images.igdb.com/igdb/image/upload';

/** The game's logo, or null when IGDB has none that will do. */
export function chooseLogo(artworks: readonly LogoCandidate[] | null | undefined): GameLogo | null {
  let best: { image: LogoCandidate; rank: number; tint: boolean } | null = null;

  for (const image of artworks ?? []) {
    const kind = typeof image.artwork_type === 'number' ? LOGO_RANK[image.artwork_type] : null;
    if (!kind || !image.image_id) continue;
    const { width, height } = image;
    if (!width || !height || width < MIN_WIDTH || height / width > MAX_TALL) continue;
    if (
      !best ||
      kind.rank < best.rank ||
      (kind.rank === best.rank && width > (best.image.width ?? 0))
    ) {
      best = { image, rank: kind.rank, tint: kind.tint };
    }
  }

  if (!best) return null;
  const { image_id, width = 0, height = 0 } = best.image;
  /* `t_720p` fits 1280×720 — and enlarges what is smaller, so a small file
     is drawn from its original instead. */
  const size = width <= ORIGINAL_UNDER ? 't_original' : 't_720p';
  return { url: `${IGDB_UPLOAD}/${size}/${image_id}.png`, width, height, tint: best.tint };
}

/**
 * How much page a logo takes, in dp²: Red Dead Redemption 2's at the size the
 * owner called "decent" (2026-11-03), about 265 × 98. Every logo is drawn at
 * this area rather than at one width — sized by width, a 6:1 wordmark came out
 * a sixth as tall as it was wide and read as tiny next to a stacked one
 * (Phantom Blade Zero, Elden Ring), so a wide logo grows wider and a stacked
 * one taller until each covers the same ground.
 */
export const LOGO_AREA = 26000;
/** …but no taller than this. */
export const LOGO_MAX_HEIGHT = 120;

/**
 * How large the logo stands: `aspect` is the drawing's own (cropped to its
 * ink, `inkBounds`), at `LOGO_AREA`, no wider than `maxWidth` and no taller
 * than `maxHeight`.
 */
export function logoBox(
  aspect: number,
  maxWidth: number,
  maxHeight: number = LOGO_MAX_HEIGHT,
  /** The area every logo is drawn at — the game page's, unless a smaller card asks. */
  area: number = LOGO_AREA
): { width: number; height: number } {
  const shape = Math.max(0.01, aspect);
  let height = Math.sqrt(area / shape);
  height = Math.min(height, maxHeight, maxWidth / shape);
  return { width: Math.round(height * shape), height: Math.round(height) };
}

/**
 * How a game's colour logo is drawn, from what its pixels said:
 *
 *  - **its name in type** (`'name'`) when it is not cut out — a picture with
 *    its own ground to the corners, a rectangle on the art;
 *  - **a white silhouette** only when it is dark nearly all over;
 *  - **as it is** otherwise — a game's logo is drawn to stand on its own art,
 *    and a black band or outline is part of it. (A platform's logo is
 *    silhouetted when a fifth of it is dark, `logoTreatment`; on a game's
 *    logo that rule turned Disco Elysium's black band and its words into one
 *    white shape.)
 */
export function gameLogoLook(
  ink: Pick<LogoInk, 'coverage' | 'dark' | 'ground'> | null
): 'asis' | 'white' | 'name' {
  if (!ink) return 'asis';
  if (ink.ground && ink.coverage >= NOT_CUT_OUT) return 'name';
  if (ink.dark >= ALL_DARK) return 'white';
  return 'asis';
}

/** At this much coverage the image has no cut-out (`logo-ink.ts`'s). */
const NOT_CUT_OUT = 0.98;
/** This dark all over, as it is it would not be seen (`logo-ink.ts`'s). */
const ALL_DARK = 0.9;
