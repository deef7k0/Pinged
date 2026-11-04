import Ionicons from '@expo/vector-icons/Ionicons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View, useWindowDimensions } from 'react-native';

import { useTabBarClearance } from '@/components/app-tab-bar';
import { PinYours } from '@/components/pings/pin-yours';
import { PingPlate } from '@/components/pings/ping-plate';
import { PingSpotlight } from '@/components/pings/ping-spotlight';
import { Button } from '@/components/ui/button';
import { DropdownButton, type DropdownOption } from '@/components/ui/dropdown-button';
import { HeaderFade } from '@/components/ui/frosted-top-bar';
import { PressGlyph } from '@/components/ui/press-glyph';
import { PageFlatList, PageScrollView } from '@/components/ui/page-scroll';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, Screen } from '@/components/ui/screen';
import { useSelectable } from '@/components/ui/selectable';
import { Skeleton } from '@/components/ui/surface';
import { TabBar } from '@/components/ui/tab-bar';
import { Text } from '@/components/ui/text';
import { ArtRowWindow } from '@/constants/list-window';
import { PosterAspectRatio, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  NO_PING_FILTERS,
  getPingFeed,
  getUnseenPingSuggestions,
  isPingsNotReady,
  type PingFeedMode,
  type PingFilters,
} from '@/lib/api';
import type { PingFeedRow } from '@/lib/database.types';
import {
  PING_GENRES,
  PING_PLATFORMS,
  flattenPages,
  nextCursor,
  type PingCursor,
} from '@/lib/pings';
import { useAuth } from '@/store/auth';
import { Loader } from '@/components/ui/loader';

const TABS: { key: PingFeedMode; label: string }[] = [
  { key: 'for_you', label: 'For You' },
  { key: 'latest', label: 'Latest' },
  { key: 'mine', label: 'Mine' },
];

const ANY = 'any';
const GENRE_OPTIONS: DropdownOption<string>[] = [
  { value: ANY, label: 'Any genre', short: 'Genre' },
  ...PING_GENRES,
];
const PLATFORM_OPTIONS: DropdownOption<string>[] = [
  { value: ANY, label: 'Any platform', short: 'Platform' },
  ...PING_PLATFORMS,
];

/** What the board's head says it is — its order, in one printed line. */
const BOARD_HEAD: Record<Exclude<PingFeedMode, 'for_you'>, string> = {
  latest: 'Every open ping · newest first',
  mine: 'Your pings · what people suggested',
};

/**
 * Pings — the tab where people ask each other what to play next.
 *
 * Three lists under one bar, two faces (the owner's hybrid of two of the five
 * concepts in `.impeccable/mocks/pings/`, 2026-11-01):
 *
 *   - **For You** is "The One You’re For": one request at a time, staged
 *     (`<PingSpotlight>`) — the best match in `ping_feed`'s For You order,
 *     and a swipe or Next brings the next one, from somebody else.
 *   - **Latest** (every open request, newest first) and **Mine** (your own,
 *     with a dot on the tab while anything on them is new) are "The Board":
 *     plates (`<PingPlate>`) — the games as one picture, the asker's face
 *     pressed onto it with their name beside it — under "Pin yours".
 *
 * Each is a `useInfiniteQuery` of twenty, keyed apart so going from one to
 * another and back is a redraw, not a fetch; pulled to refresh, and paged by
 * the last row's ranking fields — the stage asks for the next page as its
 * queue runs short.
 *
 * Filters are the brief's lightweight ones — a genre, a platform, and only
 * requests built on games — on the two community lists; Mine has none. On
 * For You they decide what "best match" is among.
 */
export default function PingsScreen() {
  const router = useRouter();
  const clearance = useTabBarClearance();
  const { width: display } = useWindowDimensions();
  const contentWidth = display - Spacing.x16 * 2;
  const userId = useAuth((state) => state.session?.user.id) ?? null;
  const [tab, setTab] = useState<PingFeedMode>('for_you');
  const [filters, setFilters] = useState<PingFilters>(NO_PING_FILTERS);

  const unseen = useQuery({
    queryKey: ['pings', 'unseen', userId],
    queryFn: getUnseenPingSuggestions,
    enabled: !!userId,
    staleTime: 60_000,
  });

  const activeFilters = tab === 'mine' ? NO_PING_FILTERS : filters;
  const feed = useInfiniteQuery({
    queryKey: [
      'pings',
      tab,
      userId,
      activeFilters.genre,
      activeFilters.platform,
      activeFilters.withRefs,
    ],
    queryFn: ({ pageParam }) => getPingFeed(tab, activeFilters, pageParam),
    initialPageParam: null as PingCursor | null,
    getNextPageParam: (page) => nextCursor(page) ?? undefined,
    enabled: !!userId,
    /* For You moves when your library does; the log form invalidates it, so a
       longer freshness here costs nothing and saves a fetch per visit. */
    staleTime: tab === 'for_you' ? 5 * 60_000 : 60_000,
  });

  const rows = useMemo(() => flattenPages(feed.data?.pages ?? []), [feed.data]);
  const renderItem = useCallback(
    ({ item }: { item: PingFeedRow }) => (
      <PingPlate
        ping={item}
        viewerId={userId}
        showFamiliarity={tab !== 'mine'}
        width={contentWidth}
      />
    ),
    [tab, userId, contentWidth]
  );

  const filtered =
    tab !== 'mine' && (filters.genre !== null || filters.platform !== null || filters.withRefs);

  const tabs = TABS.map((item) =>
    item.key === 'mine' ? { ...item, alert: (unseen.data ?? 0) > 0 } : item
  );

  const theme = useTheme();
  const header =
    tab === 'for_you' ? (
      <View style={styles.header}>
        <Filters value={filters} onChange={setFilters} />
      </View>
    ) : (
      <View style={styles.header}>
        <View style={[styles.boardHead, { borderBottomColor: theme.border }]}>
          <Text variant="label" color="textMuted">
            {BOARD_HEAD[tab]}
          </Text>
        </View>
        <PinYours />
        {tab !== 'mine' && <Filters value={filters} onChange={setFilters} />}
      </View>
    );

  const refresh = () => {
    void feed.refetch();
    void unseen.refetch();
  };

  function body() {
    if (feed.isPending)
      return tab === 'for_you' ? (
        <StageSkeleton header={header} />
      ) : (
        <BoardSkeleton header={header} width={contentWidth} />
      );
    if (feed.isLoadingError) {
      if (isPingsNotReady(feed.error)) {
        return (
          <EmptyState
            title="Pings are on their way"
            message="Asking the community for games arrives with the database’s next update."
          />
        );
      }
      return <ErrorState error={feed.error} onRetry={() => void feed.refetch()} />;
    }

    if (tab === 'for_you' && rows.length > 0) {
      return (
        <PageScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Spacing.x48 + clearance }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={feed.isRefetching && !feed.isFetchingNextPage}
              onRefresh={refresh}
            />
          }>
          {header}
          <PingSpotlight
            /* A new set of filters is a new order: start at its best match. */
            key={`${filters.genre}|${filters.platform}|${filters.withRefs}`}
            rows={rows}
            viewerId={userId}
            width={contentWidth}
            hasMore={!!feed.hasNextPage}
            loadingMore={feed.isFetchingNextPage}
            onLoadMore={() => void feed.fetchNextPage()}
          />
        </PageScrollView>
      );
    }

    return (
      <PageFlatList
        /* A list per tab, so each mounts at its top and the bar learns it. */
        key={tab}
        data={rows}
        keyExtractor={keyOf}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Empty
            tab={tab}
            filtered={filtered}
            onClear={() => setFilters(NO_PING_FILTERS)}
            onAsk={() => router.push('/new-ping')}
          />
        }
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <Loader style={styles.more} />
          ) : feed.isFetchNextPageError ? (
            <View style={styles.more}>
              <Button
                title="Couldn’t load more — try again"
                variant="ghost"
                size="small"
                onPress={() => void feed.fetchNextPage()}
              />
            </View>
          ) : null
        }
        contentContainerStyle={[styles.content, { paddingBottom: Spacing.x48 + clearance }]}
        ItemSeparatorComponent={Gap}
        showsVerticalScrollIndicator={false}
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
        }}
        onEndReachedThreshold={1.5}
        refreshing={feed.isRefetching && !feed.isFetchingNextPage}
        onRefresh={refresh}
        {...ArtRowWindow}
      />
    );
  }

  return (
    /* The tab's name, large at the top left with + at the right — Apple
       TV's (the owner's references, 2026-11-03) — then the tabs, then the
       list, which dissolves into them as it scrolls (`<HeaderFade>`). */
    <Screen edges={['top']}>
      <View style={styles.titleRow}>
        <Text variant="largeTitle" accessibilityRole="header">
          Pings
        </Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="New ping"
          onPress={() => router.push('/new-ping')}
          scaleTo={0.92}
          pressedColor={theme.controlPressed}
          style={StyleSheet.flatten([styles.newKey, { backgroundColor: theme.controlFill }])}>
          <PressGlyph>
            <Ionicons name="add" size={24} color={theme.text} />
          </PressGlyph>
        </PressableScale>
      </View>
      <View style={styles.tabs}>
        <TabBar tabs={tabs} value={tab} onChange={setTab} label="Pings" />
      </View>
      <View style={styles.body}>
        {body()}
        <HeaderFade />
      </View>
    </Screen>
  );
}

const keyOf = (ping: PingFeedRow) => ping.id;

function Gap() {
  return <View style={styles.gap} />;
}

/**
 * The brief's lightweight filters: a genre, a platform, and only requests
 * built on games. Two menus and one toggle, in a row that scrolls with the
 * list — they narrow it, they are not a second navigation.
 */
function Filters({
  value,
  onChange,
}: {
  value: PingFilters;
  onChange: (next: PingFilters) => void;
}) {
  const theme = useTheme();
  const selectable = useSelectable();
  const look = selectable(value.withRefs);

  return (
    <View style={styles.filters}>
      <DropdownButton
        label="Genre"
        size="small"
        value={value.genre ?? ANY}
        options={GENRE_OPTIONS}
        onChange={(genre) => onChange({ ...value, genre: genre === ANY ? null : genre })}
      />
      <DropdownButton
        label="Platform"
        size="small"
        value={value.platform ?? ANY}
        options={PLATFORM_OPTIONS}
        onChange={(platform) =>
          onChange({ ...value, platform: platform === ANY ? null : platform })
        }
      />
      <PressableScale
        accessibilityRole="switch"
        accessibilityState={{ checked: value.withRefs }}
        accessibilityLabel="Only pings built on games"
        onPress={() => onChange({ ...value, withRefs: !value.withRefs })}
        scaleTo={0.95}
        pressedColor={look.pressedColor}
        focusRing={look.focusRing}
        hitSlop={{ top: 8, bottom: 8 }}
        style={StyleSheet.flatten([styles.toggle, look.style])}>
        <Ionicons
          name={value.withRefs ? 'checkmark' : 'albums-outline'}
          size={14}
          color={theme[look.label]}
        />
        <Text variant="bodySmall" color={look.label}>
          With games
        </Text>
      </PressableScale>
    </View>
  );
}

function Empty({
  tab,
  filtered,
  onClear,
  onAsk,
}: {
  tab: PingFeedMode;
  filtered: boolean;
  onClear: () => void;
  onAsk: () => void;
}) {
  if (filtered) {
    return (
      <EmptyState
        title="Nothing matches"
        message="No open pings with those filters right now."
        action={<Button title="Clear filters" variant="secondary" onPress={onClear} />}
      />
    );
  }
  if (tab === 'mine') {
    return (
      <EmptyState
        title="Ask, and people answer"
        message="Say what you’re in the mood for and add a game or two it should be like. People who played them see it first."
        action={<Button title="New ping" icon="paper-plane-outline" onPress={onAsk} />}
      />
    );
  }
  return (
    <EmptyState
      title="No open pings yet"
      message="Be the first to ask — what should you play next?"
      action={<Button title="New ping" icon="paper-plane-outline" onPress={onAsk} />}
    />
  );
}

/** The stage's shapes: a fan, the claim, two lines, the action. */
function StageSkeleton({ header }: { header: React.ReactElement }) {
  return (
    <View style={styles.content}>
      {header}
      <View style={styles.stageSkeleton}>
        <Skeleton width={100} height={Math.round(100 / PosterAspectRatio)} />
        <Skeleton width="70%" height={22} />
        <Skeleton width="40%" height={14} />
        <Skeleton width="85%" height={38} />
        <Skeleton width="100%" height={52} radius={Radius.pill} />
      </View>
    </View>
  );
}

/** Two plates' worth of shimmer, the height of the plates that replace them. */
function BoardSkeleton({ header, width }: { header: React.ReactElement; width: number }) {
  return (
    <View style={styles.content}>
      {header}
      {[0, 1].map((index) => (
        <View key={index} style={styles.plateSkeleton}>
          <Skeleton width={width} height={96} radius={0} />
          <Skeleton width="45%" height={14} />
          <Skeleton width="100%" height={42} />
          <Skeleton width="100%" height={13} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.x16,
    paddingTop: Spacing.x8,
  },
  newKey: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  tabs: { paddingTop: Spacing.x8 },
  content: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x12, flexGrow: 1, gap: 0 },
  header: { gap: Spacing.x12, marginBottom: Spacing.x20 },
  boardHead: { paddingBottom: Spacing.x8, borderBottomWidth: StyleSheet.hairlineWidth },
  filters: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.x8 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x4,
    height: 32,
    paddingHorizontal: Spacing.x12,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  gap: { height: Spacing.x32 },
  more: { paddingVertical: Spacing.x24, alignItems: 'center' },
  stageSkeleton: { alignItems: 'center', gap: Spacing.x16, paddingTop: Spacing.x12 },
  plateSkeleton: { gap: Spacing.x12, marginBottom: Spacing.x32 },
});
