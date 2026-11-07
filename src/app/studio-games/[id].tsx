import { useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { PORTRAIT_COLUMNS, gridItemWidth } from '@/components/gaming/game-tile';
import { StudioGridItem } from '@/components/studio-grid-item';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageFlatList } from '@/components/ui/page-scroll';
import { EmptyState, ErrorState, Screen } from '@/components/ui/screen';
import { SortBar } from '@/components/ui/sort-bar';
import { Skeleton } from '@/components/ui/surface';
import { CoverGridWindow } from '@/constants/list-window';
import { Radius, Spacing } from '@/constants/theme';
import { useStudioCatalogue } from '@/hooks/use-studio-catalogue';
import { gameSortOptions, sortGames, type GameSort } from '@/lib/games';
import type { StudioGame } from '@/lib/games/igdb';
import { DarkRoom } from '@/hooks/use-accent';

const GAP = Spacing.x8;
/** No "Default": IGDB answers a studio's games newest first, which is "Newest". */
const SORTS = gameSortOptions(['newest', 'oldest', 'rating', 'title']);

/**
 * Every game a studio made, three across — Apple Music's "All Albums ›" on an
 * artist's page (the Apple pass, 2026-11-05). It was the foot of the studio's
 * own page, under its rails; there it is a rail of the newest now, whose
 * heading leads here.
 *
 * The catalogue is the studio page's own query (`useStudioCatalogue`), so
 * this opens on what that page already loaded.
 */
function StudioGamesScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const companyId = Number(id);
  const { width } = useWindowDimensions();
  const [sort, setSort] = useState<GameSort>('newest');
  const games = useStudioCatalogue(companyId);

  /* The studio page's "All games": everything but a second box of the same
     game (an edition, a bundle — those are its Special editions rail). */
  const catalogue = useMemo(
    () =>
      (games.data ?? []).filter((game) => game.edition !== 'edition' && game.edition !== 'bundle'),
    [games.data]
  );
  const ordered = useMemo(() => sortGames(catalogue, sort), [catalogue, sort]);
  const tileWidth = gridItemWidth(width, PORTRAIT_COLUMNS, Spacing.x16, GAP);

  const keyExtractor = useCallback((game: StudioGame) => game.id, []);
  const renderItem = useCallback(
    ({ item }: { item: StudioGame }) => <StudioGridItem item={item} tileWidth={tileWidth} />,
    [tileWidth]
  );

  return (
    <Screen
      edges={['bottom']}
      insetHeader
      topBar={<FrostedTopBar back title="All games" subtitle={name || undefined} />}>
      <PageFlatList
        data={ordered}
        numColumns={PORTRAIT_COLUMNS}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        {...CoverGridWindow}
        ListHeaderComponent={
          ordered.length > 1 ? (
            <View style={styles.sort}>
              <SortBar
                options={SORTS}
                value={sort}
                onChange={setSort}
                accessibilityLabel="Sort this studio's games"
              />
            </View>
          ) : null
        }
        ListEmptyComponent={
          games.isLoading ? (
            <View style={styles.skeleton}>
              {Array.from({ length: 12 }).map((_, index) => (
                <Skeleton
                  key={index}
                  width={tileWidth}
                  height={tileWidth * 1.5}
                  radius={Radius.image}
                />
              ))}
            </View>
          ) : games.isLoadingError ? (
            <ErrorState error={games.error} onRetry={() => void games.refetch()} />
          ) : (
            <EmptyState
              icon="search"
              title="No games found"
              message="IGDB has no catalogue for this studio."
            />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.x16, paddingBottom: Spacing.x48, gap: GAP, flexGrow: 1 },
  row: { gap: GAP },
  sort: { paddingBottom: Spacing.x12 },
  skeleton: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
});

/** A game's room: dark in either setting (Settings → Appearance). */
export default function StudioGamesScreenRoute() {
  return (
    <DarkRoom>
      <StudioGamesScreen />
    </DarkRoom>
  );
}
