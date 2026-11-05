import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui/text';
import { labelFor, scoreColor } from '@/constants/score';
import { Typeface, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { readableInk } from '@/lib/color';

export type ScoreTileSize = 'small' | 'medium' | 'large';

/**
 * The three sizes, and what the number does at each.
 *
 * `band` is whether the verdict word fits underneath. At 44dp it does not —
 * eight-point type under a 20px number in a 44dp square is two lines of nothing
 * — so the small tile carries the number alone and lets its neighbours say what
 * the number means.
 */
const SIZES: Record<ScoreTileSize, { box: number; number: number; band: boolean }> = {
  small: { box: 44, number: 19, band: false },
  medium: { box: 62, number: 26, band: true },
  /* A touch smaller than the first draw of the review page's verdict (84/38)
     — the owner's direction (2026-10-17): the square was crowding the quote
     beside it. The only caller is that page. */
  large: { box: 72, number: 32, band: true },
};

/** A tile's side, in dp — for whatever is laid out level with it. */
export function scoreTileBox(size: ScoreTileSize): number {
  return SIZES[size].box;
}

export type ScoreTileProps = {
  score: number;
  size?: ScoreTileSize;
  /**
   * The number's and the word's ink, when it is not `readableInk` of the
   * band. A review's own page sets it black (`shareInkDark`), at the
   * owner's direction (2026-10-17), whatever the band.
   */
  ink?: string;
  /**
   * False hides the verdict word, leaving the number alone. The podium share
   * card draws it this way at the owner's direction (2026-10-17) — a second
   * card already prints the verdict in its words, so the square need only
   * say the figure.
   */
  showLabel?: boolean;
  style?: ViewStyle;
};

/**
 * A score as a coloured square.
 *
 * **Square, with the corner just taken off.** It ran at `Radius.none` for a
 * while and at `Radius.image` (4dp) before that. 4 was the wrong number in the
 * other direction: at 44–84dp a 4dp corner does not read as "rounded", it reads
 * as one corner having gone soft while the rest look sharp. `Radius.lg` (8) is
 * the step where the softening is legible as a deliberate shape at every one of
 * the three sizes, and it is still far from `Radius.control` (6)… which is to
 * say it is *near* it, and that is the one thing to keep an eye on: the tile
 * must not start reading as a button. It does not, because it holds a numeral
 * rather than a word and never takes a press state.
 *
 * The shape is still doing work: it is the one element on these surfaces that is
 * not a fully rounded rectangle or a pill, which is what separates the score
 * from the controls around it without spending a second colour on the
 * distinction.
 *
 * ## The colour
 *
 * `scoreColor()` and nothing else. Score is one of the three sources CLAUDE.md
 * permits colour to come from, and this aliases onto the existing ramp rather
 * than inventing a hex — an 88 is the same green here, in a metadata row and on
 * a review page. The ink is `readableInk()`, so green and amber take the dark
 * number they need while red keeps a light one; a single fixed ink fails on at
 * least one band.
 *
 * ## Why the word is under the number
 *
 * The verdict is the second carrier. A band is a colour and a number, and
 * neither survives a protanopic reader alone — the word does, and `labelFor()`
 * is already the app's name for it.
 */
export function ScoreTile({
  score,
  size = 'medium',
  ink: inkOverride,
  showLabel = true,
  style,
}: ScoreTileProps) {
  const theme = useTheme();
  const { box, number, band } = SIZES[size];

  const tint = scoreColor(score, theme);
  const ink = inkOverride ?? readableInk(tint);

  return (
    <View
      style={[styles.tile, { width: box, height: box, backgroundColor: tint }, style]}
      accessible
      accessibilityLabel={`Rated ${score} out of 100, ${labelFor(score)}`}>
      <Text
        variant="display"
        style={[styles.number, { color: ink, fontSize: number, lineHeight: number + 2 }]}>
        {score}
      </Text>
      {band && showLabel && (
        <Text variant="caption" style={[styles.band, { color: ink }]} numberOfLines={1}>
          {labelFor(score).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  /*
   * A rectangle, and the corner is what keeps it one.
   *
   * `Radius.image` (4) rather than `Radius.lg` or the pill. A pill is this app's
   * shape for metadata you cannot press (`<Chip>`), and a run of them is exactly
   * what this sits in — so a pill here would disappear into the row it is meant
   * to lead. Four points of corner reads as a printed box score, which is what
   * it is.
   *
   * No fixed width: it is `just enough for the number and the word`, so the
   * padding sets it and "100 MASTERPIECE" grows while "7 AWFUL" does not.
   */
  chip: {
    flexDirection: 'row',
    /*
     * **Baselines, not boxes.** The figure is 12px on a 17dp line box and the
     * band is 9 or 10 on a 12–13dp one; centring those two boxes against each
     * other lines up their *middles*, which leaves the word's baseline about a
     * point above the number's and reads as the word floating. Two type sizes on
     * one line align on the line they are written on.
     */
    alignItems: 'baseline',
    alignSelf: 'flex-start',
    /*
     * 4 inside, 8 outside. They used to both be 6, which is the actual bug this
     * pass was called for: with the interval between the number and its word
     * equal to the interval between the word and the edge, the chip read as
     * three evenly-spaced columns instead of one object with air around it.
     * Tight within the pair, generous around it — the ordinary rule, applied at
     * chip scale.
     */
    gap: Spacing.x4,
    paddingHorizontal: Spacing.x12,
    paddingVertical: 3,
    borderRadius: Radius.image,
  },
  /*
   * Android adds the font's own ascent and descent padding on top of the line
   * box unless told not to, and it is asymmetric — which inside a 23dp filled
   * rectangle holding two different font sizes is exactly the "weird space"
   * nobody can point at. iOS ignores the property entirely, so this only ever
   * removes a discrepancy between the two platforms.
   */
  chipNumber: { includeFontPadding: false },
  /* Tighter side padding, because this variant shares a top bar with a username
     that would rather have the dp. */
  chipNarrow: { paddingHorizontal: Spacing.x8 },
  /* The band rides slightly darker than the number on the same fill — it is the
     gloss on the figure, not a second reading of it. `includeFontPadding` for
     the reason on `chipNumber`: the two have to lose it together or removing it
     from one would introduce the very offset it is there to prevent. */
  chipBand: { opacity: 0.82, includeFontPadding: false },
  /*
   * The size override is argued in the component's docblock: 9/12 is below the
   * 10px floor `Type` sets, and it is allowed here because this is an uppercase
   * word on a filled block acting as a third carrier, not running text. Tracking
   * drops with it — 0.8 was tuned on 10, and 0.45 is the same optical looseness
   * at 9.
   */
  chipBandNarrow: {
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0.45,
  },
  /* Tight leading and negative tracking: at display size in a square this small
     the default line box pushes the band label off the bottom. */
  number: { letterSpacing: -0.5 },
  /* Bold, and at the number's full strength — the owner's direction
     (2026-10-16). It was regular at 75%. The bold family: Android synthesises
     no weight for a custom font. */
  band: {
    fontSize: 8,
    letterSpacing: 0.4,
    fontFamily: Typeface.bold,
    paddingHorizontal: 2,
  },
});

/**
 * The score as a small filled **rectangle**: "61 FAIR", the number and its word
 * on one line.
 *
 * ## Why this is not `<ScoreTile>`
 *
 * `<ScoreTile>` is a square, and a square is what you draw where the score
 * stands in for artwork — a review row's leading slot, a review page's
 * masthead. This is the opposite situation: a fact on a metadata line, sharing a
 * row with a platform mark and a playtime. A square there is a tall object in a
 * line of short ones and it sets the row's height; a rectangle sits *in* the
 * line, which is what a run of facts needs.
 *
 * It is also not `<ScoreLine>` — bare coloured digits and a word, no fill. That
 * is right where the score is the only coloured thing around. Here it shares a
 * row with a platform's brand mark and a trophy, and a fill is what keeps the
 * verdict from reading as a third icon.
 *
 * ## The colour
 *
 * `scoreColor()` fills it and `readableInk()` writes on it — the same pair
 * `<ScoreTile>` uses, for the same reason: green and amber need a dark number
 * while red needs a light one, and a single fixed ink fails on at least one
 * band. Aliasing the existing ramp rather than inventing a hex is the house rule
 * for anything that is data.
 *
 * The word is inside the fill, not beside it. Colour is never the only carrier
 * here (CLAUDE.md), and "61" alone asks the reader to supply a scale.
 */
/**
 * `narrow` is the chip as it appears in a card's top bar, beside a username:
 * a 9/12 band against the token's 10/13, and tighter side padding.
 *
 * ## It prints the whole word
 *
 * It used to print an abbreviation — MASTER, OUTSTAND, EXCELL — through a
 * `shortLabelFor` that has since been deleted. That was the right call for the
 * layout it was written for, where the chip lived under the box art in a column
 * fixed at `BOX_ART_WIDTH`, 84dp, and "MASTERPIECE" did not fit. The relayout
 * that moved it into a top bar spanning the card removed the column and kept the
 * abbreviation, so for a long while the feed printed "EXCELL" in a row with
 * room to spare.
 *
 * The row is also what guarantees the room now. The chip's block is
 * `flexShrink: 0` and the author beside it is `flex: 1, minWidth: 0`, so on a
 * narrow screen a long display name truncates and the verdict never does — which
 * is the right way round: a name survives an ellipsis, "EXCELL…" does not.
 *
 * ## The 9px band is a deliberate exception to the 10px floor
 *
 * `Type`'s note is explicit that 10 is the floor and that `caption` and `label`
 * must not go below it. That rule is about *running text you have to read* — a
 * timestamp, a count, a chip in a metadata row. This is a two-to-eleven letter
 * uppercase word on a filled block at `readableInk` contrast, and it is the
 * **third** carrier on the object after the number and the colour. The chip is
 * the one member of a crowded row — avatar, name of unknown length, platform
 * mark, playtime — whose width it can choose, and the point it gives back is
 * the name's.
 *
 * The exception is local to this style — the token is untouched, so nothing else
 * in the app moves.
 */
export function ScoreChip({ score, narrow = false }: { score: number; narrow?: boolean }) {
  const theme = useTheme();

  const rounded = Math.round(score);
  const tint = scoreColor(score, theme);
  const ink = readableInk(tint);

  return (
    <View
      style={[styles.chip, narrow && styles.chipNarrow, { backgroundColor: tint }]}
      accessible
      accessibilityLabel={`Rated ${rounded} out of 100, ${labelFor(score)}`}>
      <Text variant="h5" style={[styles.chipNumber, { color: ink }]}>
        {rounded}
      </Text>
      <Text
        variant="badge"
        style={[styles.chipBand, narrow && styles.chipBandNarrow, { color: ink }]}
        numberOfLines={1}>
        {labelFor(score).toUpperCase()}
      </Text>
    </View>
  );
}
