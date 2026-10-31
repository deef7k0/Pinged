/**
 * Home's "Games for you" as BitChord's lead shelf — the row of big cards at
 * the top of its Home, where YouTube Music's first shelf ("Albums & singles")
 * lands. The owner's direction (2026-10-28): "Make the games for you carousel
 * like the one in bitchord in the albums & singles section at the top."
 *
 * Read from BitChord's source, not its screens: `HeroShelf` and `HeroCard` in
 * `sharedUi/…/ui/screens/HomeScreen.kt`, `heroCardWidth`, `HERO_CARD_RATIO`
 * and `PAGE_GUTTER` in `ui/components/Common.kt`, `ShelfRow` (a `LazyRow`
 * that snaps to each card) and `thumbnailBorder` in `SongText.kt`.
 *
 * It replaced SimpMusic's "Your daily discover" (Material 3's centred hero
 * carousel, the cards morphing between two widths), which this was for a week.
 *
 * No imports: `npm test` loads it.
 */

export const DISCOVER = {
  /** `HERO_CARD_FRACTION = 0.70f`: the next card peeks in past this one. */
  fraction: 0.7,
  /** `HERO_CARD_MAX_WIDTH = 320.dp`: a tablet is held to a phone's card. */
  maxWidth: 320,
  /** `HERO_CARD_RATIO = 0.92f`, width over height: a touch taller than wide. */
  ratio: 0.92,
  /** `RoundedCornerShape(18.dp)`. */
  radius: 18,
  /** `thumbnailBorder`: 1dp of white at 15% in a dark theme. */
  edgeWidth: 1,
  edgeAlpha: 0.15,
  /** `Arrangement.spacedBy(14.dp)`. */
  gap: 14,
  /** The caption: `padding(start = 16, end = 16, top = 34, bottom = 14)`. */
  captionSide: 16,
  captionTop: 34,
  captionBottom: 14,
  /** The caption's scrim: `verticalGradient(Transparent, Black × 0.78)`, behind the caption only. */
  scrimAlpha: 0.78,
  /** The subtitle: `Color.White.copy(alpha = 0.72f)`, two lines at most. */
  subtitleAlpha: 0.72,
} as const;

export type DiscoverGeometry = {
  /** A card's width. */
  width: number;
  /** A card's height. */
  height: number;
  /** How far the row moves from one card's leading edge to the next's. */
  step: number;
};

/**
 * A card in a row `available` wide — BitChord's `heroCardWidth`: seventy per
 * cent of the row, never past 320, the height following from the ratio. The
 * skeleton reads the same numbers, so nothing moves when the games land.
 */
export function discoverGeometry(available: number): DiscoverGeometry {
  const width = Math.round(Math.min(available * DISCOVER.fraction, DISCOVER.maxWidth));
  const height = Math.round(width / DISCOVER.ratio);
  return { width, height, step: width + DISCOVER.gap };
}
