import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { StyleSheet, View, type SectionListData } from 'react-native';

import { PageFlatList, PageSectionList } from '@/components/ui/page-scroll';

import { useTabBarClearance } from '@/components/app-tab-bar';
import { LogCard } from '@/components/log-card';
import { ReadingNote } from '@/components/reading-note';
import { ReviewChartHead } from '@/components/review-chart-head';
import {
  CardGap,
  SeeAll,
  SectionEmpty,
  SectionFailed,
  SectionHead,
  SectionLoading,
} from '@/components/search/discover-sections';
import { CHART_PREVIEW } from '@/components/search/search-scopes';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useReadingLanguages } from '@/hooks/use-reading-languages';
import { useReviewChart } from '@/hooks/use-review-chart';
import { LATEST_PAGE, getLatestReviews, searchReviews } from '@/lib/api';
import type { LogWithRelations } from '@/lib/database.types';
import { DEFAULT_CHART_PERIOD, PERIOD_WORDS, readingKey, type ChartPeriod } from '@/lib/discovery';

const MIN_QUERY_LENGTH = 2;

/**
 * Reviews: what is popular and what is newest before a word is typed, and a
 * search after.
 *
 * Reviews were a tab here once and were taken out, for a reason that still
 * stands: a popularity chart is not a search scope, and the field could not
 * filter it. This is the scope that answers that — typed, the field finds
 * reviews by the game they are about, by their headline, or by something they
 * say (`searchReviews`).
 *
 * **Untyped it is two sections** (the owner's request, 2026-10-20: "Latest
 * reviews on review tab"):
 *
 *  1. **Popular reviews** — the chart, which is Letterboxd's (`useReviewChart`,
 *     migration 0038): the reviews people liked and replied to in a period,
 *     every author's best before anybody's second, in the languages the reader
 *     reads, with the period at the far end of its heading. Its first
 *     `CHART_PREVIEW` cards, and the rest behind "See all" (`/reviews`, the
 *     same chart under the same key, opened on the same period) — the whole
 *     chart here would bury the second section under twenty cards.
 *  2. **Latest reviews** — everything written, newest first, a page at a time
 *     as the list is scrolled (`getLatestReviews`). Chosen by the app, so in
 *     the reader's languages too, and its heading says so.
 *
 * **Typed, nothing is left out for its language.** A search is somebody asking
 * for a thing by name; a list is the app choosing for them. Only the second
 * may choose by language.
 *
 * The row is `<LogCard>`, the review card everywhere else: the game's title is
 * on it, which a list of reviews about many games needs.
 */
export function ReviewResults({ query }: { query: string }) {
  return query.length >= MIN_QUERY_LENGTH ? <ReviewSearch query={query} /> : <ReviewsDiscover />;
}

function ReviewSearch({ query }: { query: string }) {
  const clearance = useTabBarClearance();

  const found = useQuery({
    queryKey: ['search', 'reviews', query],
    queryFn: ({ signal }) => searchReviews(query, signal),
    /* Refine in place rather than wiping to a spinner on every pause. */
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  if (found.isPending) return <LoadingState />;
  if (found.isLoadingError)
    return <ErrorState error={found.error} onRetry={() => found.refetch()} />;

  return (
    <PageFlatList
      data={found.data ?? []}
      keyExtractor={(log) => log.id}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingBottom: Spacing.x48 + clearance }]}
      ItemSeparatorComponent={CardGap}
      renderItem={renderReview}
      /* `<LogCard>` is a tall row; a screenful, and a few either side. */
      initialNumToRender={6}
      maxToRenderPerBatch={6}
      windowSize={7}
      ListEmptyComponent={
        <EmptyState
          icon="search"
          title="No reviews found"
          message={`Nothing written here mentions “${query}”. Try the game’s title.`}
        />
      }
    />
  );
}

type ReviewSection = { key: 'popular' | 'latest'; data: LogWithRelations[] };
type Section = SectionListData<LogWithRelations, ReviewSection>;

function ReviewsDiscover() {
  const clearance = useTabBarClearance();
  const [period, setPeriod] = useState<ChartPeriod>(DEFAULT_CHART_PERIOD);
  const { chart, reading } = useReviewChart(period);
  const { ready } = useReadingLanguages();

  const latest = useInfiniteQuery({
    queryKey: ['latest-reviews', readingKey(reading)],
    queryFn: ({ pageParam }) => getLatestReviews({ before: pageParam, reading }),
    initialPageParam: null as string | null,
    /* A short page is the last one; otherwise the next starts before this
       one's oldest card. */
    getNextPageParam: (page) =>
      page.length < LATEST_PAGE ? undefined : page[page.length - 1].created_at,
    /* In the right languages, never a moment early (see `useReviewChart`). */
    enabled: ready,
    staleTime: 60_000,
  });

  const popular = chart.data?.reviews ?? [];
  /* True until the first answer says otherwise, so the heading does not draw
     as the old list's and then change its mind. */
  const windowed = chart.data?.windowed ?? true;

  const newest = useMemo(() => {
    /* A review written between two pages can repeat one; the first copy stands. */
    const seen = new Set<string>();
    return (latest.data?.pages ?? []).flat().filter((log) => {
      if (seen.has(log.id)) return false;
      seen.add(log.id);
      return true;
    });
  }, [latest.data]);

  /* `isPending`, not `isLoading`: both wait for the reader's languages, and a
     query that is waiting is not yet fetching — it is still not empty. */
  if (chart.isPending && latest.isPending) return <LoadingState />;
  if (chart.isLoadingError && latest.isLoadingError) {
    return (
      <ErrorState
        error={chart.error}
        onRetry={() => {
          void chart.refetch();
          void latest.refetch();
        }}
      />
    );
  }

  const sections: ReviewSection[] = [
    { key: 'popular', data: popular.slice(0, CHART_PREVIEW) },
    { key: 'latest', data: newest },
  ];

  const renderHeader = ({ section }: { section: Section }) =>
    section.key === 'popular' ? (
      <ReviewChartHead period={period} onPeriod={setPeriod} windowed={windowed} reading={reading} />
    ) : (
      <SectionHead
        title="Latest reviews"
        note={reading ? <ReadingNote reading={reading} of="reviews" /> : null}
      />
    );

  const renderFooter = ({ section }: { section: Section }) => {
    if (section.key === 'popular') {
      if (chart.isPending) return <SectionLoading />;
      if (chart.isLoadingError)
        return <SectionFailed what="the popular reviews" onRetry={() => void chart.refetch()} />;
      if (popular.length === 0) {
        return (
          <SectionEmpty>
            {period === 'all' || !windowed
              ? 'Nobody has written a review yet.'
              : `Nobody wrote a review or responded to one ${PERIOD_WORDS[period]}. Try a longer period.`}
          </SectionEmpty>
        );
      }
      return popular.length > CHART_PREVIEW ? (
        <SeeAll
          href={windowed ? `/reviews?period=${period}` : '/reviews'}
          label="See all popular reviews"
        />
      ) : null;
    }

    if (latest.isPending || latest.isFetchingNextPage) return <SectionLoading />;
    if (latest.isLoadingError || latest.isFetchNextPageError) {
      return (
        <SectionFailed
          what="the latest reviews"
          onRetry={() => void (latest.isLoadingError ? latest.refetch() : latest.fetchNextPage())}
        />
      );
    }
    if (newest.length === 0) {
      return (
        <SectionEmpty>
          Write a review with a score and some words, and it will be the first here.
        </SectionEmpty>
      );
    }
    return null;
  };

  return (
    <PageSectionList
      sections={sections}
      keyExtractor={(log) => log.id}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={[styles.content, { paddingBottom: Spacing.x48 + clearance }]}
      ItemSeparatorComponent={CardGap}
      renderSectionHeader={renderHeader}
      renderSectionFooter={renderFooter}
      /* The last period's cards stand, dimmed, while the chosen one is on its
         way — the cards, not the heading that holds the control being used. */
      renderItem={chart.isPlaceholderData ? renderSettlingPopular : renderReview}
      onEndReached={() => {
        if (latest.hasNextPage && !latest.isFetchingNextPage) void latest.fetchNextPage();
      }}
      onEndReachedThreshold={1.5}
      refreshing={chart.isRefetching && !chart.isPlaceholderData}
      onRefresh={() => {
        void chart.refetch();
        void latest.refetch();
      }}
      initialNumToRender={6}
      maxToRenderPerBatch={6}
      windowSize={7}
    />
  );
}

/* Module scope: an inline `renderItem` is a new function per render, and the
   list re-draws every row it holds for it. */
const renderReview = ({ item }: { item: LogWithRelations }) => <LogCard log={item} />;
const renderSettlingPopular = ({ item, section }: { item: LogWithRelations; section: Section }) =>
  section.key === 'popular' ? (
    <View style={styles.settling}>
      <LogCard log={item} />
    </View>
  ) : (
    <LogCard log={item} />
  );

const styles = StyleSheet.create({
  /* `flexGrow: 1` so an empty state centres rather than pinning to the top. */
  content: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x8, flexGrow: 1 },
  settling: { opacity: 0.5 },
});
