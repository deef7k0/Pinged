import { useQuery } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';

import { Card, Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { scoreColor } from '@/constants/score';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getRatingDistribution } from '@/lib/api';
import { DISTRIBUTION_BANDS, barShare, shownBands, toneScore } from '@/lib/rating-distribution';

/** The label column: as wide as "90–99" in `caption`, as How ratings work's. */
const LABEL_WIDTH = 48;
/** The count column: four digits. */
const COUNT_WIDTH = 28;
/** A bar's thickness: How ratings work's thin pill. */
const BAR_HEIGHT = 6;

/** Whose scores: a game's, or a person's. */
export type DistributionScope = { gameId: string } | { userId: string };

/** The graph's query: one key family, refreshed with every rating write. */
export function useRatingDistribution(scope: DistributionScope | null) {
  const key = scope
    ? 'gameId' in scope
      ? ['rating-distribution', 'game', scope.gameId]
      : ['rating-distribution', 'user', scope.userId]
    : ['rating-distribution', 'none'];
  return useQuery({
    queryKey: key,
    queryFn: () => getRatingDistribution(scope!),
    enabled: !!scope,
    staleTime: 60_000,
  });
}

/**
 * How a set of scores divides — the owner's reference, a music site's rating
 * distribution (2026-10-21): a row for 100 and one for each ten below it,
 * highest first. Each bar is the score ramp's colour for its band — green,
 * amber, red: "the colors remain the same" (`lib/rating-distribution`).
 *
 * Drawn as How ratings work draws a person's own spread (its `<Spread>`), at
 * the owner's direction (2026-10-21: "inside a card… exactly like the one
 * that appears in the how ratings work screen"): in a card, the band in quiet
 * type, a thin pill track the length of the row, the bar in it as long as its
 * count against the longest, and the count at the far end.
 *
 * ```text
 *   ╭──────────────────────────────╮
 *   │  100   ━━━━━───────────    4 │
 *   │ 90–99  ━━━━━━━━━━━━━━━━   21 │
 *   │  …                           │
 *   ╰──────────────────────────────╯
 * ```
 *
 * `card={false}` where it already stands in one — the Ratings card on a
 * game's Overview — so it is never a card inside a card.
 *
 * The same graph on a person's profile, a game's Ratings card and the head
 * of its reviews sheet. **Only a band that holds a score is drawn** — the
 * owner's (2026-10-28): "if there is no rating with a 0-9, dont display it".
 * The rows keep their order, so a gap in the labels is where nobody scored.
 */
export function RatingDistributionGraph({
  counts,
  card = true,
}: {
  counts: readonly number[];
  card?: boolean;
}) {
  const theme = useTheme();
  const total = counts.reduce((sum, count) => sum + count, 0);
  const rows = shownBands(counts);

  const graph = (
    <View
      style={styles.graph}
      accessible
      accessibilityLabel={`How ${total.toLocaleString()} ${total === 1 ? 'score divides' : 'scores divide'}: ${rows
        .map(({ band, count }) => `${band.spoken}, ${count}`)
        .join('; ')}.`}>
      {rows.map(({ band, count }) => (
        <View key={band.key} style={styles.row}>
          <Text variant="caption" color="textMuted" numberOfLines={1} style={styles.label}>
            {band.label}
          </Text>
          <View style={[styles.track, { backgroundColor: theme.surfaceElevated }]}>
            <View
              style={[
                styles.bar,
                {
                  width: `${barShare(count, counts) * 100}%`,
                  backgroundColor: scoreColor(toneScore(band), theme),
                },
              ]}
            />
          </View>
          <Text variant="caption" color="textSecondary" numberOfLines={1} style={styles.count}>
            {count.toLocaleString()}
          </Text>
        </View>
      ))}
    </View>
  );

  return card ? <Card>{graph}</Card> : graph;
}

/**
 * How many rows the skeleton draws. The graph draws only the bands that hold
 * a score, so it is anywhere from one row to eleven; five is the middle, and
 * the card moves least on the way to either.
 */
const SKELETON_ROWS = 5;

/** The graph's shape while its scores are on their way. */
export function RatingDistributionSkeleton({ card = true }: { card?: boolean }) {
  const graph = (
    <View style={styles.graph}>
      {DISTRIBUTION_BANDS.slice(0, SKELETON_ROWS).map((band, index) => (
        <View key={band.key} style={styles.row}>
          <View style={styles.label} />
          <View style={styles.trackBare}>
            <Skeleton
              width={`${30 + ((index * 37) % 60)}%`}
              height={BAR_HEIGHT}
              radius={Radius.pill}
            />
          </View>
          <View style={styles.count} />
        </View>
      ))}
    </View>
  );
  return card ? <Card>{graph}</Card> : graph;
}

/**
 * A game's or a person's graph, fetched: the skeleton while it loads, nothing
 * at all when there are no scores to draw or they would not load — a graph
 * of eleven zeros claims a distribution that does not exist.
 */
export function RatingDistribution({
  scope,
  card = true,
}: {
  scope: DistributionScope;
  card?: boolean;
}) {
  const query = useRatingDistribution(scope);
  if (query.isPending) return <RatingDistributionSkeleton card={card} />;
  const counts = query.data ?? [];
  if (counts.every((count) => count === 0)) return null;
  return <RatingDistributionGraph counts={counts} card={card} />;
}

const styles = StyleSheet.create({
  /* How ratings work's spread, row for row: four apart, eight between parts. */
  graph: { gap: Spacing.x4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  label: { width: LABEL_WIDTH, fontVariant: ['tabular-nums'] },
  track: { flex: 1, height: BAR_HEIGHT, borderRadius: Radius.pill, overflow: 'hidden' },
  trackBare: { flex: 1 },
  bar: { height: '100%', borderRadius: Radius.pill },
  count: { width: COUNT_WIDTH, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
