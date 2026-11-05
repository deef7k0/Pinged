import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { StyleSheet, type SectionListData } from 'react-native';

import { PageFlatList, PageSectionList } from '@/components/ui/page-scroll';

import { useTabBarClearance } from '@/components/app-tab-bar';
import { CollectionSeparator, ListTile } from '@/components/list-tile';
import {
  SeeAll,
  SectionEmpty,
  SectionFailed,
  SectionHead,
  SectionLoading,
} from '@/components/search/discover-sections';
import { CHART_PREVIEW } from '@/components/search/search-scopes';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/screen';
import { TallCardWindow } from '@/constants/list-window';
import { Spacing } from '@/constants/theme';
import {
  getLatestCollections,
  getPopularCollections,
  searchLists,
  type ListSummary,
} from '@/lib/api';

const MIN_QUERY_LENGTH = 2;

/** One page of "Latest collections". */
const LATEST_COLLECTIONS_PAGE = 20;

/**
 * Collections: the most popular and the newest before a word is typed, and a
 * title search after.
 *
 * **Untyped it is two sections** (the owner's request, 2026-10-20: "most
 * popular collections + latest collections"):
 *
 *  1. **Most popular** — the most-liked collections, the chart behind
 *     `/collections`, under the same key, so it is usually already in the
 *     cache. Its first `CHART_PREVIEW`, and the rest behind "See all".
 *  2. **Latest collections** — the newest authored ones with a game in them,
 *     a page at a time as the list is scrolled (`getLatestCollections`).
 *     Keyed under `['lists', …]` on purpose: every place a collection is
 *     created, renamed, filled or deleted already invalidates `['lists']`, so
 *     a new one is here the next time the tab is looked at, without eight
 *     screens learning that this list exists.
 *
 * Typed, it is a title search across everybody's authored collections
 * (`searchLists`). The row is `<ListTile>`, as everywhere else: a mosaic of
 * four covers and the name, one to a row, hairlines between.
 */
export function CollectionResults({ query }: { query: string }) {
  return query.length >= MIN_QUERY_LENGTH ? (
    <CollectionSearch query={query} />
  ) : (
    <CollectionsDiscover />
  );
}

function CollectionSearch({ query }: { query: string }) {
  const clearance = useTabBarClearance();

  const found = useQuery({
    queryKey: ['search', 'collections', query],
    queryFn: ({ signal }) => searchLists(query, signal),
    placeholderData: keepPreviousData,
  });

  if (found.isLoading) return <LoadingState />;
  if (found.isLoadingError)
    return <ErrorState error={found.error} onRetry={() => found.refetch()} />;

  return (
    <PageFlatList
      data={found.data ?? []}
      keyExtractor={(list) => list.id}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingBottom: Spacing.x48 + clearance }]}
      ItemSeparatorComponent={CollectionSeparator}
      {...TallCardWindow}
      renderItem={renderTile}
      ListEmptyComponent={
        <EmptyState
          icon="search"
          title="No collections found"
          message={`No collection is called anything like “${query}”. Try one word of its title.`}
        />
      }
    />
  );
}

type CollectionSection = { key: 'popular' | 'latest'; data: ListSummary[] };
type Section = SectionListData<ListSummary, CollectionSection>;

function CollectionsDiscover() {
  const clearance = useTabBarClearance();

  const popular = useQuery({
    queryKey: ['discover', 'collections'],
    queryFn: () => getPopularCollections(),
    staleTime: 5 * 60_000,
  });

  const latest = useInfiniteQuery({
    queryKey: ['lists', 'latest'],
    queryFn: ({ pageParam }) =>
      getLatestCollections({ before: pageParam, limit: LATEST_COLLECTIONS_PAGE }),
    initialPageParam: null as string | null,
    getNextPageParam: (page) =>
      page.length < LATEST_COLLECTIONS_PAGE ? undefined : page[page.length - 1].created_at,
    staleTime: 60_000,
  });

  const liked = popular.data ?? [];
  const newest = useMemo(() => {
    const seen = new Set<string>();
    return (latest.data?.pages ?? []).flat().filter((list) => {
      if (seen.has(list.id)) return false;
      seen.add(list.id);
      return true;
    });
  }, [latest.data]);

  if (popular.isPending && latest.isPending) return <LoadingState />;
  if (popular.isLoadingError && latest.isLoadingError) {
    return (
      <ErrorState
        error={popular.error}
        onRetry={() => {
          void popular.refetch();
          void latest.refetch();
        }}
      />
    );
  }
  /* Nothing anywhere is not two empty sections: it is an app with no
     collections yet, and says so once. */
  if (popular.isSuccess && latest.isSuccess && liked.length === 0 && newest.length === 0) {
    return (
      <EmptyState
        icon="albums-outline"
        title="No collections yet"
        message="Build one from your profile and it can be found here."
      />
    );
  }

  const sections: CollectionSection[] = [
    { key: 'popular', data: liked.slice(0, CHART_PREVIEW) },
    { key: 'latest', data: newest },
  ];

  const renderHeader = ({ section }: { section: Section }) =>
    section.key === 'popular' ? (
      <SectionHead title="Most popular" first />
    ) : (
      <SectionHead title="Latest collections" />
    );

  const renderFooter = ({ section }: { section: Section }) => {
    if (section.key === 'popular') {
      if (popular.isPending) return <SectionLoading />;
      if (popular.isLoadingError)
        return (
          <SectionFailed what="the popular collections" onRetry={() => void popular.refetch()} />
        );
      if (liked.length === 0)
        return <SectionEmpty>Nobody has liked a collection yet.</SectionEmpty>;
      return liked.length > CHART_PREVIEW ? (
        <SeeAll href="/collections" label="See all popular collections" />
      ) : null;
    }

    if (latest.isPending || latest.isFetchingNextPage) return <SectionLoading />;
    if (latest.isLoadingError || latest.isFetchNextPageError) {
      return (
        <SectionFailed
          what="the latest collections"
          onRetry={() => void (latest.isLoadingError ? latest.refetch() : latest.fetchNextPage())}
        />
      );
    }
    if (newest.length === 0) {
      return (
        <SectionEmpty>Build one from your profile and it will be the first here.</SectionEmpty>
      );
    }
    return null;
  };

  return (
    <PageSectionList
      sections={sections}
      keyExtractor={(list) => list.id}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={[styles.content, { paddingBottom: Spacing.x48 + clearance }]}
      ItemSeparatorComponent={CollectionSeparator}
      renderSectionHeader={renderHeader}
      renderSectionFooter={renderFooter}
      renderItem={renderTile}
      onEndReached={() => {
        if (latest.hasNextPage && !latest.isFetchingNextPage) void latest.fetchNextPage();
      }}
      onEndReachedThreshold={1.5}
      refreshing={popular.isRefetching || (latest.isRefetching && !latest.isFetchingNextPage)}
      onRefresh={() => {
        void popular.refetch();
        void latest.refetch();
      }}
      {...TallCardWindow}
    />
  );
}

/** Module scope, so the list's props are stable rather than new per render. */
function renderTile({ item }: { item: ListSummary }) {
  return <ListTile list={item} />;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x8, flexGrow: 1 },
});
