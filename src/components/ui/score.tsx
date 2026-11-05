import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { labelFor, scoreColor } from '@/constants/score';
import { Typeface, ScoreSizes, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ScoreSize = keyof typeof ScoreSizes;

/**
 * The 0-100 score is a **coloured numeral and nothing else**.
 *
 * No box, no outline, no fill. Digits wrapped in a bordered capsule read as a
 * button you could press, and at the sizes a feed needs, the container was
 * consistently larger than the number inside it — a two-character fact wearing
 * an 80px badge. The verdict colour does everything the box was doing: good,
 * mixed or bad is legible before the digits are.
 *
 * The three ramp colours are the one exception to the app's single-accent rule,
 * and they earn it by being *data*. They appear on numerals and their labels,
 * never on a control, a fill or an edge.
 */
const SIZES = ScoreSizes;

export type ScoreNumberProps = {
  score: number;
  size?: ScoreSize;
};

/** The `body` line box every size up to this one fits inside. */
const LINE_FLOOR = ScoreSizes.medium;

/** Just the number, in its verdict colour. */
export function ScoreNumber({ score, size = 'inline' }: ScoreNumberProps) {
  const theme = useTheme();
  const fontSize = SIZES[size];

  return (
    <Text
      accessibilityLabel={`Scored ${Math.round(score)} out of 100 — ${labelFor(score)}`}
      style={[
        styles.number,
        { fontSize, color: scoreColor(score, theme) },
        /* Its own line box once it outgrows body copy's. `<Text>` defaults to the
           `body` variant, whose 18px line is fine for the inline and medium
           sizes and clips anything larger: Android cuts a glyph to its line, so
           a 25px number showed only its middle band. */
        fontSize > LINE_FLOOR && { lineHeight: Math.round(fontSize * 1.2) },
      ]}>
      {Math.round(score)}
    </Text>
  );
}

export type ScorePillProps = {
  score: number;
  size?: ScoreSize;
  /** Show the verdict word beside the number ("Excellent"). */
  showLabel?: boolean;
};

/**
 * The number with its verdict word beside it, for a masthead or a stat block.
 *
 * Keeps the old name because it is still "the score, presented large" — it
 * simply no longer draws a pill. Callers wanting only digits use `ScoreNumber`.
 */
export function ScorePill({ score, size = 'medium', showLabel = false }: ScorePillProps) {
  const theme = useTheme();
  const tint = scoreColor(score, theme);

  if (!showLabel) return <ScoreNumber score={score} size={size} />;

  return (
    <View style={styles.withLabel}>
      <ScoreNumber score={score} size={size} />
      <View style={styles.labelBlock}>
        <Text variant="h5" style={{ color: tint }}>
          {labelFor(score)}
        </Text>
        <Text variant="bodySmall" color="textMuted">
          out of 100
        </Text>
      </View>
    </View>
  );
}

/**
 * The score as a phrase: the number, then the word for it. "82 VERY GOOD".
 *
 * Both halves carry the verdict colour, so the line is parseable at a glance
 * the way five green stars are — but a 100-point scale has fifteen verdicts,
 * and the word is what stops 82 and 88 reading as the same opinion.
 */
export function ScoreLine({ score, size = 'inline' }: { score: number; size?: ScoreSize }) {
  const theme = useTheme();
  const tint = scoreColor(score, theme);

  return (
    <View
      style={styles.line}
      accessibilityLabel={`Rated ${Math.round(score)} out of 100 — ${labelFor(score)}`}>
      <ScoreNumber score={score} size={size} />
      <Text variant="label" style={{ color: tint }}>
        {labelFor(score)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  /* Bold, and the only place bold appears below display size: a score has to be
     readable at arm's length and it no longer has a box helping it. */
  number: { fontFamily: Typeface.bold },
  withLabel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  labelBlock: { gap: 1 },
  /* `baseline` rather than `center`: the number is larger than the word, and
     centring them makes the word look like it is floating. */
  line: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.x8 },
});
