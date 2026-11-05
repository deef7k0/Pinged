import { StyleSheet, View } from 'react-native';

import { ScoreNumber } from '@/components/ui/score';
import { Text } from '@/components/ui/text';
import { labelFor, scoreColor } from '@/constants/score';
import { STATUS_VERB } from '@/constants/status';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { LogStatus } from '@/lib/database.types';

export type ReviewMetaProps = {
  /** 0-100, or null when the log carries no score. */
  score: number | null;
  gameTitle: string;
  /**
   * The log's status, or **`null` to hide the tag entirely**.
   *
   * Pass `null` whenever the log carries a written review. Logging a game as
   * played and reviewing it are two different acts: the status tag is what a
   * *log* has to say for itself, and once there is a review the writing says it
   * instead. "PLAYED" stamped on a review is a fact nobody needed — you are
   * reading their opinion of the game, so of course they played it.
   */
  status: LogStatus | null;
};

/**
 * The verdict line of a review: score, game, and — for a bare log — status.
 *
 * One row, no surface behind it. It used to be a filled block with an 80px
 * score badge, and both were wrong for the same reason — a card already *is* a
 * surface, so a second one inside it is a container inside a container, and the
 * badge made two digits the largest object on the card. Now it is a sentence
 * you read left to right: *82 · Halo Infinite · GREAT*.
 *
 * The status label takes the score's colour rather than the status colour. A
 * red 12 beside a green "DROPPED" would be two verdicts in one line; the row is
 * one opinion and reads as one only if it is one colour. With no score there is
 * no verdict, so it falls back to muted — correct, because "PLAYED" without a
 * rating is a fact rather than a judgement, and that is exactly the case where
 * the tag is still worth printing.
 */
export function ReviewMeta({ score, gameTitle, status }: ReviewMetaProps) {
  const theme = useTheme();
  const tint = score === null ? theme.textMuted : scoreColor(score, theme);

  return (
    <View style={styles.row}>
      {score !== null && <ScoreNumber score={score} size="inline" />}

      <Text variant="h5" numberOfLines={1} style={styles.game}>
        {gameTitle}
      </Text>

      <View style={styles.labels}>
        {status !== null && (
          <Text variant="label" style={{ color: tint }}>
            {STATUS_VERB[status]}
          </Text>
        )}
        {score !== null && (
          <Text variant="label" style={{ color: tint }}>
            {labelFor(score)}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8, flexWrap: 'wrap' },
  /* Shrinks before the labels do: a long game name should truncate rather than
     push the verdict off the row, which is the part that cannot be inferred. */
  game: { flexShrink: 1 },
  labels: { flexDirection: 'row', gap: Spacing.x8 },
});
