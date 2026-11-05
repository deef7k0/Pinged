/**
 * Whether a game is out yet, and its date as words.
 *
 * Pure, so a route, a picker and the game page's dock can all ask the same
 * question without importing a component to do it. They lived in
 * `components/game-actions.tsx` while the action row was the only thing that
 * asked; an unreleased game is now kept away from every way of starting a
 * review — the game page, Surprise Me, the profile's quick log and the log
 * form itself — and those are four places, not one.
 */

/**
 * Whether a game is still in the future.
 *
 * Derived at render from `releaseDate` rather than stored, which is what makes
 * the page "update itself": the game query has a 30-minute `staleTime`, so the
 * first visit after launch day refetches, the date is no longer ahead of now,
 * and every hidden control reappears. No release-tracking service, no webhook,
 * no polling — the answer was always in the data IGDB already returns.
 *
 * A missing date means *unknown*, not unreleased. A game with no announced date
 * keeps its actions rather than being locked out on a technicality.
 */
export function isUnreleased(game: { releaseDate?: string | null }): boolean {
  if (!game.releaseDate) return false;
  const released = Date.parse(game.releaseDate);
  return Number.isFinite(released) && released > Date.now();
}

/** "14 March 2027", or the year alone when IGDB only has that much. */
export function formatReleaseDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** "14 Mar 2027" — the same date, short enough for the line under a grid's cover. */
export function formatShortReleaseDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
