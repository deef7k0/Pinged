/**
 * The head of Search's Discover: this month's biggest releases, the most
 * awaited game and the calendar, as Home's carousel with reacticx's parallax.
 *
 * Pure — no React Native — so `npm test` covers it.
 *
 * ## Home's cards, reacticx's motion
 *
 * The owner's direction (2026-11-02): the slider's games "will go like the
 * home carousel. They will scroll automatically with this kind of animation"
 * — reacticx's `ParallaxCarousel` (`molecules/parallax-carousel`, MIT). So a
 * card is Home's "Games for you" card (`constants/discover-carousel`:
 * seventy per cent of the row, 0.92 wide to tall, 18 round, snapping), and
 * inside it the art moves at a different speed from the row: reacticx's
 * `translateX = interpolate(scrollX, [offset − step, offset, offset + step],
 * [−w·k, 0, w·k])`, clamped.
 *
 * **The art is wider than its card, by `k` at each side.** reacticx's cards
 * are a page wide, so its neighbours are off screen by the time their art has
 * moved; Home's peek in at 70%, and an image the card's own width shifted by
 * a third would show the card's empty fill beside it. Drawn `1 + 2k` wide and
 * centred, it covers the card at every offset (`parallaxShift` never exceeds
 * `k`), and landscape key art fits that wide box better than the card itself.
 *
 * It replaced, on 2026-11-02, a full-bleed 3:2 slider after Letterboxd's hero
 * (four segments along its foot as the timer). There is still no glow on
 * Search (the owner's of 2026-10-09).
 */

export const SPOTLIGHT = {
  /**
   * reacticx's `parallaxIntensity`, as a share of the card's width the art
   * moves over one card of scroll. Its default is 0.7 over full-page cards;
   * 0.35 over cards that peek is the same travel on screen.
   */
  parallax: 0.35,
  /** How long a card stands before the row moves on by itself. */
  interval: 6000,
  /** The row's glide to the next card when it moves by itself. */
  glideMs: 900,
  /** The badge, in from the card's top and right edge. */
  badgeInset: 12,
} as const;

/** The art's width for a card `cardWidth` wide: wider by the parallax at each side. */
export function parallaxArtWidth(cardWidth: number): number {
  return Math.round(cardWidth * (1 + 2 * SPOTLIGHT.parallax));
}

/**
 * How far the art inside card `index` is shifted when the row has scrolled
 * `scrollX`, cards `step` apart: reacticx's interpolation, clamped to one card
 * either side. Positive is toward the right — the art lags behind the card.
 */
export function parallaxShift(
  scrollX: number,
  index: number,
  step: number,
  cardWidth: number
): number {
  'worklet';
  const distance = (scrollX - index * step) / Math.max(1, step);
  const clamped = Math.max(-1, Math.min(1, distance));
  return clamped * cardWidth * SPOTLIGHT.parallax;
}

/** Where the row moves next by itself: the next card, and the first after the last. */
export function nextCard(current: number, count: number): number {
  return count <= 1 ? 0 : (current + 1) % count;
}
