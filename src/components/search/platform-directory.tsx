import { useQuery } from '@tanstack/react-query';
import { memo, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { PageFlatList } from '@/components/ui/page-scroll';

import { useTabBarClearance } from '@/components/app-tab-bar';
import { gridItemWidth } from '@/components/gaming/game-tile';
import { LogoTile } from '@/components/search/logo-tile';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { CoverGridWindow } from '@/constants/list-window';
import { Spacing } from '@/constants/theme';
import {
  FEATURED_PLATFORM_IDS,
  getPlatformDirectory,
  type PlatformEntry,
} from '@/lib/games/browse';

/** Three across, as every grid of things to open in this app is. */
const COLUMNS = 3;
const GAP = Spacing.x12;

/** One query for the directory, shared with the platform's own page. */
export const PLATFORM_DIRECTORY_KEY = ['platform-directory'] as const;

export function usePlatformDirectory() {
  return useQuery({
    queryKey: PLATFORM_DIRECTORY_KEY,
    queryFn: ({ signal }) => getPlatformDirectory(signal),
    /* IGDB adds a platform every year or two. Once a session is plenty. */
    staleTime: 24 * 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
  });
}

/**
 * Every platform IGDB lists, with its logo — and each one a door to its games.
 *
 * ## The search is a filter
 *
 * The whole directory is about 220 names and arrives in one request, so typing
 * narrows it in memory, on the keystroke, with no request and no debounce.
 * That is why this takes the field's text as it stands rather than the settled
 * query the other scopes wait for.
 *
 * ## What leads
 *
 * Untyped, the consoles and computers most people are looking for come first,
 * under their own heading, and then everything A to Z. IGDB has no popularity
 * figure for a platform and `generation` cannot stand in for one — it would
 * open on the Playdate and never reach the PC, which has no generation — so the
 * head of the list is chosen by hand (`FEATURED_PLATFORM_IDS`).
 *
 * ## A square, a name, a year
 *
 * Each platform is a `<LogoTile>`: its logo on a square, its name, and the year
 * it came out — the owner's reference, SimpMusic's library grid. The year and
 * not a count of its games, which would be a request per platform
 * (`getPlatformDirectory` says why); a platform IGDB has no date for shows what
 * kind of machine it is instead. The logos are drawn for white pages, so each
 * is measured once and lightened where its ink would be lost (`<LogoMark>`).
 */
export function PlatformDirectory({ filter }: { filter: string }) {
  const clearance = useTabBarClearance();
  const { width } = useWindowDimensions();
  const tileWidth = gridItemWidth(width, COLUMNS, Spacing.x16, GAP);
  const directory = usePlatformDirectory();

  const needle = filter.trim().toLowerCase();

  const matches = useMemo(() => {
    const all = directory.data ?? [];
    if (!needle) return all;
    return all.filter(
      (platform) =>
        platform.name.toLowerCase().includes(needle) ||
        platform.abbreviation?.toLowerCase().includes(needle) ||
        platform.family?.toLowerCase().includes(needle)
    );
  }, [directory.data, needle]);

  const featured = useMemo(() => {
    const byId = new Map((directory.data ?? []).map((platform) => [platform.id, platform]));
    return FEATURED_PLATFORM_IDS.map((id) => byId.get(id)).filter(
      (platform): platform is PlatformEntry => !!platform
    );
  }, [directory.data]);

  if (directory.isLoading) return <LoadingState />;
  if (directory.isLoadingError) {
    return <ErrorState error={directory.error} onRetry={() => directory.refetch()} />;
  }

  return (
    <PageFlatList
      data={matches}
      numColumns={COLUMNS}
      keyExtractor={(platform) => String(platform.id)}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      columnWrapperStyle={styles.column}
      contentContainerStyle={[styles.content, { paddingBottom: Spacing.x48 + clearance }]}
      /* In rows of three. It asked for fifteen rows up front — forty-five
         logos before the first frame. */
      {...CoverGridWindow}
      ListHeaderComponent={
        needle ? null : (
          <View style={styles.head}>
            {featured.length > 0 && (
              <>
                <Text variant="h4" accessibilityRole="header">
                  Popular
                </Text>
                <View style={styles.featured}>
                  {featured.map((platform) => (
                    <PlatformTile key={platform.id} platform={platform} width={tileWidth} />
                  ))}
                </View>
              </>
            )}
            <View style={styles.allHead}>
              <Text variant="h4" accessibilityRole="header">
                All platforms
              </Text>
              <Text variant="bodySmall" color="textMuted">
                {matches.length}
              </Text>
            </View>
          </View>
        )
      }
      renderItem={({ item }) => <PlatformTile platform={item} width={tileWidth} low />}
      ListEmptyComponent={
        <EmptyState
          icon="search"
          title="No platforms found"
          message={`IGDB lists no platform called anything like “${filter.trim()}”.`}
        />
      }
    />
  );
}

const PlatformTile = memo(function PlatformTile({
  platform,
  width,
  low = false,
}: {
  platform: PlatformEntry;
  width: number;
  /** Behind the featured row in the download queue. */
  low?: boolean;
}) {
  const detail = platform.year ? String(platform.year) : platform.kind;

  return (
    <LogoTile
      href={{
        pathname: '/platform/[id]',
        params: { id: String(platform.id), name: platform.name },
      }}
      logoUrl={platform.logoUrl}
      name={platform.name}
      detail={detail}
      width={width}
      accessibilityLabel={[platform.name, detail, 'See its games.'].filter(Boolean).join('. ')}
      low={low}
    />
  );
});

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.x16,
    paddingTop: Spacing.x8,
    gap: Spacing.x16,
    flexGrow: 1,
  },
  column: { gap: GAP },
  head: { gap: Spacing.x12 },
  featured: { flexDirection: 'row', flexWrap: 'wrap', columnGap: GAP, rowGap: Spacing.x16 },
  allHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingTop: Spacing.x16,
  },
});
