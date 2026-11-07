import { useMemo } from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';

import { ReviewLandscapeCard } from '@/components/review-landscape-card';
import { Skeleton } from '@/components/ui/surface';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import type { CachedGame, LogWithRelations } from '@/lib/database.types';

type Entry = LogWithRelations & { game: CachedGame };

/** A card on the rail: three quarters of the display, so the next one peeks in. */
export const ACTIVITY_CARD_SHARE = 0.74;

/**
 * Home's "New from friends" (or "New on Pinged"): what people scored and
 * wrote, as Explore's Popular reviews are drawn (the owner's, 2026-11-05) —
 * `<ReviewLandscapeCard>`s in a row: the game's landscape art and logo, then
 * three lines, the score and the writer. It was a row of portrait covers
 * with the writer on each cover's foot, and before that under it.
 *
 * Your own logs are never in it (`getHomeActivity`).
 */
export function ActivityRail({ logs }: { logs: readonly LogWithRelations[]; inset?: number }) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.round(Math.min(width, MaxContentWidth) * ACTIVITY_CARD_SHARE);
  const entries = useMemo(() => logs.filter((log): log is Entry => log.game !== null), [logs]);

  return (
    <FlatList
      horizontal
      data={entries}
      keyExtractor={(log) => log.id}
      showsHorizontalScrollIndicator={false}
      nestedScrollEnabled
      snapToInterval={cardWidth + Spacing.x12}
      snapToAlignment="start"
      decelerationRate="fast"
      initialNumToRender={3}
      windowSize={3}
      /* A horizontal scroller grows unless told not to (CLAUDE.md, gotchas). */
      style={styles.rail}
      contentContainerStyle={styles.row}
      renderItem={({ item }) => <ReviewLandscapeCard log={item} width={cardWidth} />}
    />
  );
}

/** The rail while it loads: two cards' shapes. */
export function ActivityRailSkeleton() {
  const { width } = useWindowDimensions();
  const cardWidth = Math.round(Math.min(width, MaxContentWidth) * ACTIVITY_CARD_SHARE);
  return (
    <View style={[styles.row, styles.skeleton]}>
      {[0, 1].map((index) => (
        <Skeleton
          key={index}
          width={cardWidth}
          height={Math.round(cardWidth / (16 / 9)) + 110}
          radius={Radius.card}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { flexGrow: 0 },
  row: { paddingHorizontal: Spacing.x16, gap: Spacing.x12 },
  skeleton: { flexDirection: 'row', overflow: 'hidden' },
});
