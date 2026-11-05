import { StyleSheet, View } from 'react-native';

import { ScoreFigure } from '@/components/ui/score-figure';
import { Text } from '@/components/ui/text';
import { MAX_SCORE, MIN_SCORE, clampScore, labelFor, scoreColor } from '@/constants/score';
import { SHOW_SCORE_FIGURES } from '@/constants/score-figure';
import { Typeface, Radius, Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';

/**
 * The number's size **and its line box**, and the second one is the fix.
 *
 * The readout used to set `fontSize` and nothing else, on a `<Text>` whose
 * variant defaults to `body` — so a 35px number sat in body copy's 18px line.
 * Android clips glyphs to their line box, and what showed was the middle band of
 * each digit with its top and bottom cut away. Any `fontSize` set outside `Type`
 * brings its own `lineHeight`, or it inherits one written for 12px type.
 */
const NUMBER_SIZE = 46;
const NUMBER_LINE = 54;

/**
 * The same readout on a review card, at the foot of the text beside the box
 * art: 21 over 25, measured from the card's design — "84" set a little larger
 * than the card's title, its verdict at the type floor beside it. Exported
 * because the card stands the number's baseline on the art's bottom edge and
 * has to know how far below the baseline this line box runs.
 */
export const COMPACT_NUMBER_SIZE = 21;
export const COMPACT_NUMBER_LINE = 25;

/**
 * Room for "100" at `NUMBER_SIZE`, when the readout is ranged left beside a
 * control. Tabular figures make every score the same width per digit, and this
 * floor makes 7 and 100 the same width too, so the verdict beside it does not
 * move as a score is dragged across a digit boundary.
 */
const NUMBER_FLOOR = 92;

/** The bar's thickness. A thumb's target is the input's job, not the bar's. */
export const SCORE_TRACK_HEIGHT = 14;

export type ScoreReadoutProps = {
  /** 0-100, or null when unscored. */
  score: number | null;
  /**
   * Replaces "out of 100" — the log form's "averaged from 3 metrics", or the
   * instruction it gives before anything is scored.
   */
  hint?: string;
  /**
   * `center` on a review, where the score is the verdict on the art above it and
   * sits on its axis; `start` in the form, beside the clear button.
   */
  align?: 'start' | 'center';
  /**
   * `large` on the review page and in the log form. `compact` on a review card:
   * the number at 25 and the verdict beside it on one baseline, with no "out of
   * 100" and no width floor under the number — nothing on a card drags a score
   * through a digit boundary, and 92dp of reserved width is a third of the
   * column. `align` does not apply to it; a `hint` stacks under the verdict.
   */
  size?: 'large' | 'compact';
};

/**
 * The score as one line: the number, its verdict, and "out of 100" beside the
 * verdict — `87  AMAZING out of 100`.
 *
 * "out of 100" used to sit on a second line *under* the verdict, which made the
 * readout a two-line block beside a one-line number and set the phrase apart
 * from the word it qualifies. On the verdict's own line it reads as what it is:
 * the scale the number is on.
 *
 * The verdict and its qualifier are one `<Text>` with a nested span, so a long
 * hint wraps after the verdict instead of pushing it off the row, and the two
 * share a baseline without a layout pass. The number sits on the same baseline
 * as both — `alignItems: 'baseline'` on the row.
 *
 * Shared by the review page and the log form, so a score you set is drawn the
 * way it will be read.
 */
export function ScoreReadout({ score, hint, align = 'start', size = 'large' }: ScoreReadoutProps) {
  const theme = useTheme();
  const accent = useAccent();

  const scored = score !== null;
  const compact = size === 'compact';
  const tint = scored ? scoreColor(score, theme) : accent.quietInk;
  const verdict = scored ? labelFor(score) : 'Not scored';
  const aside = hint ?? (scored && !compact ? 'out of 100' : null);
  /* The spoken label keeps the scale in every size: it costs a sighted reader
     nothing, and a listener has no other way to learn it. */
  const label = [scored ? `Scored ${score} out of 100 — ${verdict}` : verdict, hint]
    .filter(Boolean)
    .join('. ');

  /*
   * Compact drops the scale, against the note above.
   *
   * On a card the readout shares one line with the playthrough strip, inside a
   * ~256dp column beside the box art. Inline at the 10dp floor, "95 OUTSTANDING
   * out of 100" is 170dp and the strip no longer fits beside it. The scale was
   * stacked under the verdict for a while; on a card it is gone, by the owner's
   * call — every score in the app is out of 100, and the card is an index entry
   * that opens the page where the scale is printed. "95 OUTSTANDING" is ~100dp
   * on one baseline, as the review page's readout reads, and a "100
   * MASTERPIECE" still leaves the strip its room. A hint, which is an
   * instruction rather than the scale, still stacks under the verdict.
   */
  if (compact) {
    const verdictText = (
      <Text variant="h6" numberOfLines={1} style={[styles.verdict, { color: tint }]}>
        {verdict.toUpperCase()}
      </Text>
    );

    return (
      <View
        style={[styles.compactReadout, !aside && styles.compactOneLine]}
        accessible
        accessibilityLabel={label}>
        <Text style={[styles.numberCompact, { color: tint }]}>{scored ? score : '—'}</Text>
        {aside ? (
          <View style={styles.compactVerdict}>
            {verdictText}
            <Text variant="caption" numberOfLines={1} style={{ color: accent.quietInk }}>
              {aside}
            </Text>
          </View>
        ) : (
          verdictText
        )}
      </View>
    );
  }

  return (
    <View
      style={[styles.readout, align === 'center' && styles.centred]}
      accessible
      accessibilityLabel={label}>
      <Text style={[styles.number, align === 'start' && styles.numberFloor, { color: tint }]}>
        {scored ? score : '—'}
      </Text>
      <Text variant="h2" style={[styles.verdict, { color: tint }]}>
        {/* Uppercased in the string, not by `textTransform`: the span below
            inherits every text style from this one, and "OUT OF 100" is not
            what it says. */}
        {verdict.toUpperCase()}
        {aside && (
          <Text variant="body" style={[styles.aside, { color: accent.quietInk }]}>
            {`  ${aside}`}
          </Text>
        )}
      </Text>
    </View>
  );
}

/**
 * The score as a length: a pill track, filled as far as the score reaches, in
 * the score's own colour.
 *
 * The fill is the ramp colour, not the accent. The number and the verdict above
 * it are drawn in the ramp, and a green 92 over a bar in the game's blue would be
 * two colours making one claim — `constants/score.ts` is the one place a score's
 * colour comes from. The *track* is the accent's: `accent.elevated`, the same
 * M3 container every control on a game's screens sits in.
 */
export function ScoreBar({
  score,
  dim = false,
  height = SCORE_TRACK_HEIGHT,
}: {
  score: number | null;
  dim?: boolean;
  /** The log form's is thicker than the review page's: it is held, not read. */
  height?: number;
}) {
  const theme = useTheme();
  const accent = useAccent();

  const fraction = score === null ? 0 : (clampScore(score) - MIN_SCORE) / (MAX_SCORE - MIN_SCORE);
  const tint = score === null ? accent.quietInk : scoreColor(score, theme);

  return (
    <View
      style={[styles.track, { height, backgroundColor: accent.elevated, opacity: dim ? 0.55 : 1 }]}
      pointerEvents="none">
      <View style={[styles.fill, { width: `${fraction * 100}%`, backgroundColor: tint }]} />
    </View>
  );
}

/** The score's drawing over the meter: large enough to be looked at. */
const METER_FIGURE = 76;

/**
 * A score to read rather than set: its drawing, then the readout, centred,
 * over its bar.
 *
 * The drawing is the owner's (`<ScoreFigure>`): on a review's own page a
 * rating is "the symbol + the number". It stands over the readout rather than
 * beside it — beside it, "87 AMAZING out of 100" no longer fits the column on
 * one line, and the readout's one line is the point of it.
 *
 * The review page's. The log form composes the readout and the bar around its
 * own touch handling in `<ScoreInput>`, and has no drawing: the owner named
 * the places it goes, and a form is not one.
 */
export function ScoreMeter({ score }: { score: number }) {
  return (
    <View style={styles.meter}>
      {/* The readout under it says the score to a screen reader. */}
      {/* Off for now (`SHOW_SCORE_FIGURES`): the readout is then the top of
          the meter, and the meter's gap closes round it. */}
      {SHOW_SCORE_FIGURES && (
        <ScoreFigure score={score} size={METER_FIGURE} labelled={false} style={styles.figure} />
      )}
      <ScoreReadout score={score} align="center" />
      {/* Hidden from assistive tech: the readout already said the number, and
          a bar reads out as nothing more than a second copy of it. */}
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <ScoreBar score={score} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.x12 },
  centred: { justifyContent: 'center' },
  number: {
    fontFamily: Typeface.bold,
    fontSize: NUMBER_SIZE,
    lineHeight: NUMBER_LINE,
    letterSpacing: -1,
    /* Every digit the same width, so the verdict does not shuffle sideways as a
       score is dragged from 79 to 81. */
    fontVariant: ['tabular-nums'],
  },
  numberFloor: { minWidth: NUMBER_FLOOR },
  /* `compact`: the number, and beside it the verdict — on the number's baseline
     when it is alone, as the large readout sets it, and centred on the number
     when a hint stacks under it, since two lines cannot share one baseline with
     a single figure. */
  compactReadout: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  compactOneLine: { alignItems: 'baseline' },
  compactVerdict: { flexShrink: 1 },
  numberCompact: {
    fontFamily: Typeface.bold,
    fontSize: COMPACT_NUMBER_SIZE,
    lineHeight: COMPACT_NUMBER_LINE,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  /* Shrinks and wraps rather than overflowing: an instruction in place of
     "out of 100" can run longer than the line. */
  verdict: { flexShrink: 1, letterSpacing: 0.4 },
  aside: { letterSpacing: 0 },
  track: {
    height: SCORE_TRACK_HEIGHT,
    borderRadius: Radius.pill,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: { height: '100%', borderRadius: Radius.pill },
  meter: { gap: Spacing.x12 },
  figure: { alignSelf: 'center' },
});
