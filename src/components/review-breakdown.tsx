import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { clampScore, labelFor, scoreColor } from '@/constants/score';
import { Typeface, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { BreakdownSection } from '@/lib/review-facets';

/** The group's column: "PlayStation" and its count, before the bar. */
const LABEL_WIDTH = 104;
/** The score's column: "100" in the bold figure. */
const SCORE_WIDTH = 30;
const BAR_HEIGHT = 8;

export type ReviewBreakdownProps = {
  sections: BreakdownSection[];
  /** The stats request failed — say so rather than leave a gap. */
  failed: boolean;
  onRetry: () => void;
};

/**
 * Gamelog's own average, split by how people played: how far they got, on what,
 * and alone or together — "Finished 87 · Dropped 64".
 *
 * ## Why it sits under the graph and not behind a control
 *
 * The one average above it cannot say the most useful thing a ratings database
 * knows: whether the people who stuck with a game liked it more than the people
 * who did not. That is a reason to open the sheet, so it is on the sheet, at a
 * glance.
 *
 * ## The shape — made to be read (2026-10-21)
 *
 * The owner: "make the filters and information of specific review things better
 * to read". It was two columns of an 11sp label, a 10sp count and a small score
 * badge under an upper-case tag. Now each group is a row on its own:
 *
 * ```text
 *   How far they got
 *   Finished     ▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇░░░   87
 *   12 people
 *   Dropped      ▇▇▇▇▇▇▇▇▇▇▇▇░░░░░░░░░░   64
 *   3 people
 * ```
 *
 * The heading in sentence case and the body's size; the group in the page's
 * ink with how many people under it — an average of one rating is a different
 * claim from one of forty; and the average as a bar as long as the score out
 * of 100, in the score ramp's colour, with the figure at its end. The bars
 * share one scale, so groups are compared by eye before the numbers are read.
 *
 * Every number is Gamelog's own. Nothing here is a third party's score.
 */
export function ReviewBreakdown({ sections, failed, onRetry }: ReviewBreakdownProps) {
  const theme = useTheme();

  if (failed) {
    return (
      <View style={styles.failed}>
        <Text variant="bodySmall" color="textMuted">
          The breakdown didn’t load.
        </Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Try loading the breakdown again"
          onPress={onRetry}
          hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
          scaleTo={0.94}>
          <Text variant="bodySmall" color="primaryText">
            Try again
          </Text>
        </PressableScale>
      </View>
    );
  }

  if (sections.length === 0) return null;

  return (
    <View style={styles.block}>
      {sections.map((section) => (
        <View key={section.key} style={styles.section}>
          <Text variant="h5" accessibilityRole="header">
            {section.title}
          </Text>
          {section.rows.map((row) => {
            const score = clampScore(row.average);
            const ink = scoreColor(score, theme);
            const people = `${row.count.toLocaleString()} ${row.count === 1 ? 'person' : 'people'}`;
            return (
              <View
                key={row.key}
                style={styles.row}
                accessible
                accessibilityLabel={`${row.label}: ${score}, ${labelFor(score)}, from ${people}`}>
                <View style={styles.label}>
                  <Text variant="body" numberOfLines={1}>
                    {row.label}
                  </Text>
                  <Text variant="caption" color="textMuted" numberOfLines={1}>
                    {people}
                  </Text>
                </View>
                <View style={[styles.track, { backgroundColor: theme.surfaceElevated }]}>
                  <View
                    style={[styles.fill, { width: `${Math.max(2, score)}%`, backgroundColor: ink }]}
                  />
                </View>
                <Text variant="h5" style={[styles.score, { color: ink }]}>
                  {score}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: Spacing.x20, marginTop: Spacing.x16 },
  section: { gap: Spacing.x12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  label: { width: LABEL_WIDTH },
  track: { flex: 1, height: BAR_HEIGHT, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: BAR_HEIGHT, borderRadius: Radius.pill },
  /* The bold family, tabular: Android synthesises no weight for a custom font. */
  score: {
    width: SCORE_WIDTH,
    textAlign: 'right',
    fontFamily: Typeface.bold,
    fontVariant: ['tabular-nums'],
  },
  failed: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8, marginTop: Spacing.x8 },
});
