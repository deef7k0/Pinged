/**
 * The art for a review's poster card (the owner's experiment, 2026-11-05,
 * after IGN's review cards): one landscape picture of the game cropped
 * square, and the game's logo drawn over its foot. Pure, under `npm test`.
 *
 * Both come from the game's IGDB artworks, in one request for a whole list
 * (`use-poster-art`). Which picture:
 *
 * - **Key art without its logo first, when there is a logo to draw.** IGDB's
 *   type 3 (key art *with* logo) would put the name on the card twice — the
 *   art's and ours — so it is left out while a logo will be drawn, and kept
 *   when there is none (its printed name is then the only one).
 * - Otherwise the game page's own rule (`chooseHero`): landscape, sharp,
 *   never a logo, a cover or an icon.
 * - `t_1080p`: the card is the list's width — about 1,000px on a phone — and
 *   a square cut from a 16:9 picture uses only its height.
 */

import { chooseHero, type HeroCandidate } from './hero-art';
import { chooseLogo, type GameLogo, type LogoCandidate } from './logo-art';

/** IGDB's "Key art with logo". */
const KEY_ART_WITH_LOGO = 3;

export type PosterArt = {
  /** The square's picture, or null when IGDB has none that will do. */
  artUrl: string | null;
  logo: GameLogo | null;
};

type Image = HeroCandidate & LogoCandidate;

function igdbUrl(imageId: string, size: string): string {
  return `https://images.igdb.com/igdb/image/upload/${size}/${imageId}.jpg`;
}

export function choosePosterArt(
  artworks: readonly Image[] | null | undefined,
  screenshots: readonly Image[] | null | undefined
): PosterArt {
  const logo = chooseLogo(artworks);
  const usable = logo
    ? (artworks ?? []).filter((image) => image.artwork_type !== KEY_ART_WITH_LOGO)
    : (artworks ?? []);
  const hero = chooseHero(usable, screenshots) ?? (logo ? chooseHero(artworks, screenshots) : null);
  return {
    artUrl: hero?.image.image_id ? igdbUrl(hero.image.image_id, 't_1080p') : null,
    logo,
  };
}

/** The fields `choosePosterArt` reads, as an IGDB `fields` clause. */
export const POSTER_ART_FIELDS =
  'artworks.image_id, artworks.width, artworks.height, artworks.artwork_type, ' +
  'screenshots.image_id, screenshots.width, screenshots.height';
