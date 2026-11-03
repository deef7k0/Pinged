import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Spacing, TapTarget, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * One quiet line under GameLog's own summary — "How the GameLog score works"
 * — and the way to the page that says (`how-ratings-work`).
 *
 * The score is a weighted average (0041). A number whose method is not
 * stated anywhere it is shown is a second black box; this is where the
 * statement is reached from. As `<ReadingNote>` is for a chart's languages:
 * the same register, the same size, the same kind of link.
 */
export function ScoreMethodNote() {
  const theme = useTheme();

  return (
    <Link href="/how-ratings-work" asChild>
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel="How the Pinged score works"
        accessibilityHint="Opens a page explaining how ratings are weighted"
        hitSlop={SLOP}
        scaleTo={0.98}
        style={StyleSheet.flatten(styles.note)}>
        <Text variant="bodySmall" color="textMuted">
          How the Pinged score works
        </Text>
        <Ionicons name="chevron-forward" size={12} color={theme.textMuted} />
      </PressableScale>
    </Link>
  );
}

/** One line of `bodySmall`, reached at the tap floor through slop. */
const SLOP = {
  top: Math.ceil(Math.max(0, TapTarget - Type.bodySmall.lineHeight) / 2),
  bottom: Math.ceil(Math.max(0, TapTarget - Type.bodySmall.lineHeight) / 2),
  left: Spacing.x8,
  right: Spacing.x8,
};

const styles = StyleSheet.create({
  /* As wide as its words, so the sheet beside it is not a target. */
  note: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: Spacing.x4 },
});
