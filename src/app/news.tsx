import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { ArticleCard } from '@/components/news-cards';
import { EventResults } from '@/components/search/event-results';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageFlatList } from '@/components/ui/page-scroll';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { TabBar } from '@/components/ui/tab-bar';
import { ArtRowWindow } from '@/constants/list-window';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getGamingNews, type Article } from '@/lib/news';

type NewsTab = 'news' | 'events';

const TABS: { key: NewsTab; label: string }[] = [
  { key: 'news', label: 'News' },
  { key: 'events', label: 'Events' },
];

/**
 * News and events — a page of its own, opened from Home's "Latest news" and
 * "Latest events" (`?tab=events`).
 *
 * It was a tab of the bottom bar until the owner gave the slot to Pings
 * (2026-10-31): "News and events will open from the home section, thus
 * removing the trailer section and such". So it has the two sections Home
 * leads to — the headlines from the RSS outlets, and the showcases and award
 * shows (`<EventResults>`: coming up, then recent) — and none of the others.
 * Trailers went with that ruling; Releases and Popular were already Home's
 * Releases band and Search's charts, a second door to each.
 */
export default function NewsScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<NewsTab>(params.tab === 'events' ? 'events' : 'news');

  const news = useQuery({
    queryKey: ['news', 'articles'],
    queryFn: ({ signal }) => getGamingNews(signal),
    enabled: tab === 'news',
    staleTime: 10 * 60_000,
  });

  function body() {
    if (tab === 'events') return <EventResults />;
    if (news.isLoading) return <LoadingState />;
    if (news.isLoadingError)
      return <ErrorState error={news.error} onRetry={() => void news.refetch()} />;
    const articles = news.data ?? [];
    return (
      <PageFlatList
        data={articles}
        keyExtractor={keyOf}
        renderItem={renderArticle}
        contentContainerStyle={articles.length === 0 ? styles.empty : styles.content}
        {...ArtRowWindow}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={news.isRefetching}
            onRefresh={news.refetch}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={<EmptyState title="Nothing here" message="No headlines right now." />}
      />
    );
  }

  return (
    <Screen
      edges={['bottom']}
      insetHeader
      topBar={<FrostedTopBar back title="News" largeTitle={false} />}>
      <View style={styles.tabs}>
        <TabBar tabs={TABS} value={tab} onChange={setTab} label="News sections" />
      </View>
      {body()}
    </Screen>
  );
}

const keyOf = (article: Article) => article.id;
const renderArticle = ({ item }: { item: Article }) => <ArticleCard article={item} />;

const styles = StyleSheet.create({
  tabs: { paddingTop: Spacing.x8 },
  content: { padding: Spacing.x16, gap: Spacing.x12, paddingBottom: Spacing.x48 },
  empty: { flexGrow: 1 },
});
