/**
 * The Explore tab's piece of Apple TV (the owner's references, 2026-11-03):
 * the Home screen's big "Severance" card, for Popular this month. (Its other
 * piece, the Store screen's portrait hero, was taken back the same day for
 * the square parallax slider.) Pure, so `npm test` holds the arithmetic.
 */

export const EXPLORE = {
  /** The Severance card: as wide as most of the display, a little wider than tall. */
  cardShare: 0.86,
  cardMaxWidth: 360,
  cardAspect: 1.07,
  cardGap: 10,
  cardRadius: 12,
} as const;

/** The Severance card's size, and the step a rail of them snaps by. */
export function featureCard(displayWidth: number): {
  width: number;
  height: number;
  step: number;
} {
  const width = Math.round(Math.min(displayWidth * EXPLORE.cardShare, EXPLORE.cardMaxWidth));
  return {
    width,
    height: Math.round(width / EXPLORE.cardAspect),
    step: width + EXPLORE.cardGap,
  };
}
