import Ionicons from '@expo/vector-icons/Ionicons';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Poster } from '@/components/ui/poster';
import { Text } from '@/components/ui/text';
import { PosterAspectRatio, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { PingFeedRef } from '@/lib/database.types';

/** A card's covers: small, side by side, the box art as the label. */
export const CARD_COVER = 44;

/**
 * The games a request is built on, as covers, and their names beside them —
 * "Like Disco Elysium, Pentiment and Citizen Sleeper".
 *
 * A cover the reader has played wears a small tick on its corner: the one
 * place the familiarity line's count is shown as *which* games. The tick is
 * the house blue on a ring of the card's own colour, so it reads on any art.
 *
 * Fixed dp: artwork does not ride the ladder.
 */
export const ReferenceCovers = memo(function ReferenceCovers({
  refs,
  ringColor,
  width = CARD_COVER,
  showTitles = true,
}: {
  refs: readonly PingFeedRef[];
  /** The surface the covers stand on, for the tick's ring. */
  ringColor: string;
  width?: number;
  showTitles?: boolean;
}) {
  const theme = useTheme();
  if (refs.length === 0) return null;
  const height = Math.round(width / PosterAspectRatio);
  const names = refs.map((ref) => ref.title);

  return (
    <View style={styles.row}>
      <View style={styles.covers}>
        {refs.map((ref) => (
          <View key={ref.game_id} style={{ width, height }}>
            <Poster coverUrl={ref.cover_url} title={ref.title} width={width} rounded="sm" />
            {ref.played && (
              <View
                style={[styles.tick, { backgroundColor: theme.primary, borderColor: ringColor }]}
                accessibilityLabel={`You’ve played ${ref.title}`}>
                <Ionicons name="checkmark" size={10} color={theme.onPrimary} />
              </View>
            )}
          </View>
        ))}
      </View>
      {showTitles && (
        <View style={styles.names}>
          <Text variant="caption" color="textMuted">
            Like
          </Text>
          <Text variant="body" color="textSecondary" numberOfLines={2}>
            {joinNames(names)}
          </Text>
        </View>
      )}
    </View>
  );
});

/** "A", "A and B", "A, B and C". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const TICK = 18;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  covers: { flexDirection: 'row', gap: Spacing.x8 },
  names: { flex: 1, minWidth: 0, gap: 1 },
  tick: {
    position: 'absolute',
    right: -5,
    bottom: -5,
    width: TICK,
    height: TICK,
    borderRadius: Radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
