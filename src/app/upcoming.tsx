import { useQuery } from '@tanstack/react-query';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { GameGridTile } from '@/components/game-grid-tile';
import { gridItemWidth } from '@/components/gaming/game-tile';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageFlatList } from '@/components/ui/page-scroll';
import { EmptyState, ErrorState, Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/surface';
import { PosterAspectRatio, Spacing, Type } from '@/constants/theme';
import { formatShortReleaseDate } from '@/lib/games/release';
import { getUpcomingReleases } from '@/lib/news';

const COLUMNS = 3;
const GAP = Spacing.x12;

/**
 * Everything with a date in the next 120 days.
 *
 * Same grid as Latest releases, sorted the other way — soonest first, because
 * the useful question here is "what is nearly out", not "what is furthest
 * away". Undated games are absent by construction: IGDB's `first_release_date`
 * filter excludes them, and a wishlist of TBA titles is a different feature.
 */
export default function UpcomingScreen() {
  const { width } = useWindowDimensions();
  const tileWidth = gridItemWidth(width, COLUMNS, Spacing.x16, GAP);

  const upcoming = useQuery({
    queryKey: ['news', 'upcoming'],
    queryFn: ({ signal }) => getUpcomingReleases(signal),
    staleTime: 60 * 60_000,
  });

  return (
    <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back title="Upcoming" />}>
      <PageFlatList
        data={upcoming.data ?? []}
        key={`grid-${COLUMNS}`}
        numColumns={COLUMNS}
        keyExtractor={(game) => game.id}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshing={upcoming.isRefetching}
        onRefresh={() => upcoming.refetch()}
        renderItem={({ item }) => (
          <GameGridTile
            id={item.id}
            title={item.title}
            coverUrl={item.coverUrl}
            heroUrl={item.heroUrl}
            edition={item.edition ?? null}
            steamAppId={item.steamAppId ?? null}
            caption={item.releaseDate ? formatShortReleaseDate(item.releaseDate) : item.releaseYear}
            width={tileWidth}
          />
        )}
        ListEmptyComponent={
          upcoming.isLoading ? (
            <View style={styles.skeleton}>
              {Array.from({ length: 9 }).map((_, index) => (
                <View key={index} style={styles.skeletonTile}>
                  <Skeleton width={tileWidth} height={tileWidth / PosterAspectRatio} />
                  <Skeleton width={tileWidth * 0.8} height={Type.itemTitle.lineHeight - 4} />
                  <Skeleton width={tileWidth * 0.5} height={Type.bodySmall.lineHeight - 4} />
                </View>
              ))}
            </View>
          ) : upcoming.isLoadingError ? (
            <ErrorState error={upcoming.error} />
          ) : (
            <EmptyState title="Nothing announced" message="IGDB has no dated releases coming up." />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.x16, paddingBottom: Spacing.x48, gap: GAP },
  column: { gap: GAP },
  skeleton: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  skeletonTile: { gap: Spacing.x8 },
});
