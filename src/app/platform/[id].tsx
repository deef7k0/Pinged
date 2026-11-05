import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { GameListItem } from '@/components/game-list-item';
import { usePlatformDirectory } from '@/components/search/platform-directory';
import { CATALOGUE_SORT_OPTIONS } from '@/components/search/catalogue-results';
import { DropdownButton } from '@/components/ui/dropdown-button';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { LogoMark } from '@/components/ui/logo-mark';
import { PageFlatList } from '@/components/ui/page-scroll';
import { Pager } from '@/components/ui/pager';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useHeaderHeight } from '@/hooks/use-header-height';
import {
  getPlatformGameCount,
  getPlatformGamesPage,
  platformCountKey,
  type PlatformSort,
} from '@/lib/games/browse';
import { PAGE_SIZE, pageCountFor } from '@/lib/games/paging';
import type { GameSearchResult } from '@/lib/games';

/** The platform's logo beside its name. */
const LOGO = { width: 96, height: 60 };

/**
 * The orders a platform's games can be read in — the catalogue's own
 * (`CATALOGUE_SORT_OPTIONS`), shared with a facet's games in Search.
 *
 * Most popular first by default: with no search term there is no relevance to
 * lead with, and "the games people have actually played on this" is the page
 * somebody opening PlayStation 5 expects to land on. Some orders are also a
 * different *set* — "Top rated" needs a few ratings behind a score, "Upcoming"
 * is only what is not out — so the page count changes with them; see
 * `catalogueQuery`.
 */
const SORT_OPTIONS = CATALOGUE_SORT_OPTIONS;

/**
 * Every game on one platform, ten to a page.
 *
 * Opened from a tile in Search's Platforms.
 *
 * ## Pages, not a scroll
 *
 * The PC has a quarter of a million games in IGDB and the PlayStation 5 well
 * over ten thousand. An endless list of that reaches nothing — there is no way
 * to the middle of it — so the catalogue is paged: ten games at a time, with
 * the pager above them saying how many pages there are and taking you to the
 * next, the previous, or any one of them by number (`<Pager>`). A second, plain
 * pager closes the page so the next ten are one tap from the tenth game.
 *
 * ## Two requests, and the page does not wait for the second
 *
 * The ten games are one small IGDB query. How many games there are is another
 * (`getPlatformGameCount`), which is one request against a current `igdb`
 * function and a dozen small ones against one that predates `games/count` — so
 * it runs beside the page rather than in front of it, and the pager says
 * "Page 1 of …" until it lands. It is kept for a day, and shared by every
 * ordering that draws from the same set.
 *
 * Turning the page keeps the old ten on screen, dimmed, until the new ten
 * arrive: a list that blanks to a spinner on every press of Next makes forty
 * pages feel like forty loading screens.
 */
export default function PlatformScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const platformId = Number(id);
  const valid = Number.isFinite(platformId);

  const [sort, setSort] = useState<PlatformSort>('popular');
  const [page, setPage] = useState(1);
  const listRef = useRef<FlatList<GameSearchResult>>(null);
  const headerHeight = useHeaderHeight();

  /* Already in the cache when this was opened from the directory; a deep link
     fetches it once. It carries the logo and the facts under the name. */
  const directory = usePlatformDirectory();
  const platform = directory.data?.find((entry) => entry.id === platformId) ?? null;

  /* The heading comes from the tile that linked here, so it is on screen
     before any request answers. */
  const title = name?.trim() || platform?.name || 'Platform';

  const games = useQuery({
    queryKey: ['platform-games', platformId, sort, page],
    queryFn: ({ signal }) => getPlatformGamesPage(platformId, sort, page, signal),
    enabled: valid,
    placeholderData: keepPreviousData,
    staleTime: 30 * 60_000,
  });

  const count = useQuery({
    /* The clause, not the ordering: "Most popular" and "A–Z" are the same games
       and count once. */
    queryKey: ['platform-game-count', valid ? platformCountKey(platformId, sort) : null],
    queryFn: ({ signal }) => getPlatformGameCount(platformId, sort, signal),
    enabled: valid,
    staleTime: 24 * 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: false,
  });

  const total = count.data ?? null;
  const pageCount = total === null ? null : pageCountFor(total);
  const rows = games.data ?? [];
  /* While the count is unknown, a full page is the evidence of another. */
  const hasNext = rows.length === PAGE_SIZE;

  function turnTo(next: number) {
    setPage(next);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }

  function changeSort(next: PlatformSort) {
    setSort(next);
    /* A different order is a different list; page 37 of it is nowhere. */
    setPage(1);
  }

  const facts = [platform?.kind, platform?.generation ? `Generation ${platform.generation}` : null]
    .filter(Boolean)
    .join(' · ');

  const head = (
    <View style={styles.head}>
      <View style={styles.identity}>
        <LogoMark
          uri={platform?.logoUrl ?? null}
          name={title}
          width={LOGO.width}
          height={LOGO.height}
        />
        <View style={styles.identityText}>
          <Text variant="h1" accessibilityRole="header" numberOfLines={3}>
            {title}
          </Text>
          {!!facts && (
            <Text variant="bodySmall" color="textMuted">
              {facts}
            </Text>
          )}
        </View>
      </View>

      <DropdownButton label="Sort by" value={sort} options={SORT_OPTIONS} onChange={changeSort} />

      <Pager
        page={page}
        pageCount={pageCount}
        hasNext={hasNext}
        onChange={turnTo}
        summary={
          total === null ? null : `${total.toLocaleString()} ${total === 1 ? 'game' : 'games'}`
        }
      />
    </View>
  );

  if (!valid) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back title="Platform" />}>
        <EmptyState icon="search" title="Platform not found" />
      </Screen>
    );
  }

  return (
    <Screen
      edges={['bottom']}
      insetHeader
      /*
       * The artwork kind of bar, on a page that keeps the bar's row clear.
       *
       * This page opens on the platform's own mark and name, as an artist's
       * page opens on the artist — so the bar does not say the name over it.
       * It is the disc while the mark is in sight and comes in, carrying the
       * name, once the mark has gone under it.
       */
      topBar={
        <FrostedTopBar back variant="art" title={title} header={headerHeight + LOGO.height} />
      }>
      <PageFlatList
        ref={listRef}
        data={rows}
        keyExtractor={(game) => game.id}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        /* The previous page, dimmed, while the next one is on its way. */
        style={games.isPlaceholderData ? styles.turning : undefined}
        contentContainerStyle={styles.content}
        ListHeaderComponent={head}
        renderItem={({ item }) => <GameListItem game={item} />}
        ListEmptyComponent={
          games.isLoading ? (
            <LoadingState />
          ) : games.isLoadingError ? (
            <ErrorState error={games.error} onRetry={() => games.refetch()} />
          ) : (
            <EmptyState
              title={page > 1 ? 'Nothing on this page' : 'No games here'}
              message={
                page > 1
                  ? 'This is past the last page. Go back a page, or to page 1.'
                  : `IGDB lists no ${title} games in this order.`
              }
            />
          )
        }
        ListFooterComponent={
          rows.length > 0 ? (
            <View style={styles.foot}>
              <Pager
                page={page}
                pageCount={pageCount}
                hasNext={hasNext}
                onChange={turnTo}
                detail={false}
              />
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.x16,
    paddingBottom: Spacing.x48,
    flexGrow: 1,
  },
  head: { gap: Spacing.x16, paddingBottom: Spacing.x8 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  identityText: { flex: 1, gap: 2 },
  foot: { paddingTop: Spacing.x16 },
  turning: { opacity: 0.45 },
});
