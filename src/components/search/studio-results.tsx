import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { memo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';

import { PageFlatList } from '@/components/ui/page-scroll';

import { useTabBarClearance } from '@/components/app-tab-bar';
import { gridItemWidth } from '@/components/gaming/game-tile';
import { LogoTile } from '@/components/search/logo-tile';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/screen';
import { CoverGridWindow } from '@/constants/list-window';
import { Spacing } from '@/constants/theme';
import { searchStudios, type StudioResult } from '@/lib/games/browse';

/** Below this a name matches half of IGDB's companies; nothing is asked. */
const MIN_QUERY_LENGTH = 2;

/** Three across, as the platform directory beside it and every grid here is. */
const COLUMNS = 3;
const GAP = Spacing.x12;

/**
 * Studios by name — developers and publishers — each leading to its page.
 *
 * Nothing to browse before a name is typed, and the screen says so rather than
 * inventing a chart: IGDB has no measure of a studio's standing, and a list of
 * "popular studios" would be this app's guess presented as a fact. The prompt
 * is the honest empty state for a scope that is only ever a lookup.
 *
 * Ranked by how many games a studio made (see `searchStudios`), which is also
 * the one fact printed under its name: it is what tells Naughty Dog from the
 * seven other companies with "naughty" in theirs.
 *
 * A grid of `<LogoTile>`s — the logo on a square, the name, the count — as the
 * platform directory is and as the owner's reference lays out its library. It
 * was a list of rows with a small logo at the head of each.
 */
export function StudioResults({ query }: { query: string }) {
  const clearance = useTabBarClearance();
  const { width } = useWindowDimensions();
  const tileWidth = gridItemWidth(width, COLUMNS, Spacing.x16, GAP);
  const isQueryable = query.length >= MIN_QUERY_LENGTH;

  const studios = useQuery({
    queryKey: ['search', 'studios', query],
    queryFn: ({ signal }) => searchStudios(query, signal),
    enabled: isQueryable,
    /* Refine in place rather than wiping to a spinner on every pause. */
    placeholderData: keepPreviousData,
    staleTime: 10 * 60_000,
  });

  if (!isQueryable) {
    return (
      <EmptyState
        title="Find a studio"
        message="Type a developer or publisher’s name — Nintendo, FromSoftware, Team Cherry — to see everything it made."
      />
    );
  }

  if (studios.isLoading) return <LoadingState />;
  if (studios.isLoadingError) {
    return <ErrorState error={studios.error} onRetry={() => studios.refetch()} />;
  }

  return (
    <PageFlatList
      data={studios.data ?? []}
      numColumns={COLUMNS}
      keyExtractor={(studio) => String(studio.id)}
      {...CoverGridWindow}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      columnWrapperStyle={styles.column}
      contentContainerStyle={[styles.content, { paddingBottom: Spacing.x48 + clearance }]}
      renderItem={({ item }) => <StudioTile studio={item} width={tileWidth} />}
      ListEmptyComponent={
        <EmptyState
          icon="search"
          title="No studios found"
          message={`Nothing in IGDB’s companies matches “${query}”. Try the studio’s full name.`}
        />
      }
    />
  );
}

const StudioTile = memo(function StudioTile({
  studio,
  width,
}: {
  studio: StudioResult;
  width: number;
}) {
  const games = `${studio.gameCount.toLocaleString()} ${studio.gameCount === 1 ? 'game' : 'games'}`;

  return (
    <LogoTile
      href={{ pathname: '/studio/[id]', params: { id: String(studio.id), name: studio.name } }}
      logoUrl={studio.logoUrl}
      name={studio.name}
      detail={games}
      width={width}
      accessibilityLabel={`${studio.name}, ${games}. See their games.`}
    />
  );
});

const styles = StyleSheet.create({
  /* `flexGrow: 1` so the empty state centres rather than pinning to the top. */
  content: {
    paddingHorizontal: Spacing.x16,
    paddingTop: Spacing.x8,
    gap: Spacing.x16,
    flexGrow: 1,
  },
  column: { gap: GAP },
});
