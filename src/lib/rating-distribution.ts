/**
 * How a set of scores divides, as the owner's reference draws it (2026-10-21):
 * a row for 100, then one for each ten below it — 90–99 down to 0–9 — each a
 * bar as long as its count against the longest, the count beside it.
 *
 * ```text
 *    100    50  ▇▇▇
 *  90–99   139  ▇▇▇▇▇▇▇▇▇
 *  80-89   176  ▇▇▇▇▇▇▇▇▇▇▇▇
 *    …
 *    0-9    59  ▇▇▇▇
 * ```
 *
 * Drawn for a game — its Ratings card and its reviews sheet — and for a
 * person, on their profile. The reference paints each row its own colour; the
 * owner kept the app's three ("the colors remain the same, red yellow and
 * green"): a row is the colour of the score in its middle (`toneScore`), so
 * 70 and up is green, 45 to 69 amber, the rest red — the score ramp's own
 * edges, with 40–49 amber because its middle is.
 *
 * Counts are people's ratings, one each — a game's from every rating of it,
 * a person's from every game they rated. Pure; `npm test` covers it.
 */

export type DistributionBand = {
  key: string;
  /** As the reference prints it: "100", "90 - 99". */
  label: string;
  /** Said aloud: "90 to 99". */
  spoken: string;
  from: number;
  to: number;
};

/** Highest first, as the reference reads, top to bottom. */
export const DISTRIBUTION_BANDS: readonly DistributionBand[] = [
  { key: '100', label: '100', spoken: '100', from: 100, to: 100 },
  ...Array.from({ length: 10 }, (_, index) => {
    const from = 90 - index * 10;
    const to = from + 9;
    return { key: String(from), label: `${from}–${to}`, spoken: `${from} to ${to}`, from, to };
  }),
];

/** The score a band is coloured as: its middle — and 100 for the row of 100s. */
export function toneScore(band: DistributionBand): number {
  return band.from === band.to ? band.from : band.from + 5;
}

/** Each band's count, in `DISTRIBUTION_BANDS`' order. A score is rounded and held to 0–100 first. */
export function distributionOf(ratings: readonly number[]): number[] {
  const counts = DISTRIBUTION_BANDS.map(() => 0);
  for (const rating of ratings) {
    if (!Number.isFinite(rating)) continue;
    const score = Math.max(0, Math.min(100, Math.round(rating)));
    const index = DISTRIBUTION_BANDS.findIndex((band) => score >= band.from && score <= band.to);
    if (index >= 0) counts[index] += 1;
  }
  return counts;
}

/** A bar's length, 0–1: its count against the longest row's. */
export function barShare(count: number, counts: readonly number[]): number {
  const most = Math.max(0, ...counts);
  return most > 0 ? count / most : 0;
}

/**
 * The rows that are drawn: only the bands that hold a score, highest first,
 * with their counts. The owner's (2026-10-28): "only the bars that have
 * ratings should be displayed. So if there is no rating with a 0-9, dont
 * display it."
 */
export function shownBands(counts: readonly number[]): { band: DistributionBand; count: number }[] {
  return DISTRIBUTION_BANDS.map((band, index) => ({ band, count: counts[index] ?? 0 })).filter(
    (row) => row.count > 0
  );
}
