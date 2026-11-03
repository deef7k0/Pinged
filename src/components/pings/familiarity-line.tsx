import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { familiarity } from '@/lib/pings';

/**
 * Why a request is where it is: "You’ve played 2 of the 3 reference games".
 *
 * The For You ranking said out loud, in the one place it applies — what the
 * reader has played, never a score. A match is the house accent's legible
 * blue with a tick (colour is never the only carrier: the words and the glyph
 * say it too); no match is the quiet ink with an open circle, there so the
 * absence is an answer rather than a gap.
 *
 * Draws nothing for a request built on no games.
 */
export function FamiliarityLine({
  referenceCount,
  matchedCount,
  reviewedCount,
}: {
  referenceCount: number;
  matchedCount: number;
  reviewedCount: number;
}) {
  const theme = useTheme();
  const line = familiarity({
    reference_count: referenceCount,
    matched_count: matchedCount,
    reviewed_count: reviewedCount,
  });
  if (!line) return null;

  const matched = line.tone !== 'none';
  const ink = matched ? theme.primaryText : theme.textMuted;

  return (
    <View style={styles.row} accessibilityRole="text">
      <Ionicons
        name={line.tone === 'strong' ? 'checkmark-done' : matched ? 'checkmark' : 'ellipse-outline'}
        size={matched ? 15 : 11}
        color={ink}
      />
      <Text variant="caption" style={[styles.text, { color: ink }]} numberOfLines={1}>
        {line.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 + 2, minHeight: 16 },
  text: { flexShrink: 1 },
});
