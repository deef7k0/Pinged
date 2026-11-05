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
import { getNewReleases } from '@/lib/news';

const COLUMNS = 3;
const GAP = Spacing.x12;

/**
 * Everything out in the last 45 days.
 *
 * Three across rather than the Top 10's two: this is a catalogue you scan for a
 * cover you recognise, not a ranked list you read. The tile carries a title and
 * a year and nothing else — no score, no rank — because a game that came out
 * last week has no meaningful community score yet, and printing one would be
 * inventing a consensus that does not exist.
 */
export default function ReleasesScreen() {
  const { width } = useWindowDimensions();
  const tileWidth = gridItemWidth(width, COLUMNS, Spacing.x16, GAP);

  const releases = useQuery({
    queryKey: ['news', 'new-releases'],
    queryFn: ({ signal }) => getNewReleases(signal),
    staleTime: 60 * 60_000,
  });

  return (
    <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back title="Releases" />}>
      <PageFlatList
        data={releases.data ?? []}
        key={`grid-${COLUMNS}`}
        numColumns={COLUMNS}
        keyExtractor={(game) => game.id}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshing={releases.isRefetching}
        onRefresh={() => releases.refetch()}
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
          releases.isLoading ? (
            <View style={styles.skeleton}>
              {Array.from({ length: 9 }).map((_, index) => (
                <View key={index} style={styles.skeletonTile}>
                  <Skeleton width={tileWidth} height={tileWidth / PosterAspectRatio} />
                  <Skeleton width={tileWidth * 0.8} height={Type.itemTitle.lineHeight - 4} />
                  <Skeleton width={tileWidth * 0.5} height={Type.bodySmall.lineHeight - 4} />
                </View>
              ))}
            </View>
          ) : releases.isLoadingError ? (
            <ErrorState error={releases.error} />
          ) : (
            <EmptyState title="Nothing new" message="IGDB has no recent releases listed." />
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
