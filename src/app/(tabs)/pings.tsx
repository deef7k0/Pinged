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
import { type DropdownOption } from '@/components/ui/dropdown-button';
import { InsetGroup, Row } from '@/components/ui/inset-group';
import { PullDownRow } from '@/components/ui/pull-down-row';
import { Tray } from '@/components/ui/tray';
import { FrostedTopBar, TopBarDisc } from '@/components/ui/frosted-top-bar';
import { PageFlatList, PageScrollView, PageWithHeader } from '@/components/ui/page-scroll';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, Screen } from '@/components/ui/screen';
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
  /* The tabs head the list, under the large title (the Apple pass,
     2026-11-05) — they were a fixed row between the title and the list. */
  const tabRow = <TabBar tabs={tabs} value={tab} onChange={setTab} label="Pings" inset={0} />;
  const header =
    tab === 'for_you' ? (
      <View style={styles.header}>
        {tabRow}
        <Filters value={filters} onChange={setFilters} />
      </View>
    ) : (
      <View style={styles.header}>
        {tabRow}
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
          <PageWithHeader header={header} contentContainerStyle={styles.content}>
            <EmptyState
              icon="paper-plane-outline"
              title="Pings are on their way"
              message="Asking the community for games arrives with the database’s next update."
            />
          </PageWithHeader>
        );
      }
      return (
        <PageWithHeader header={header} contentContainerStyle={styles.content}>
          <ErrorState error={feed.error} onRetry={() => void feed.refetch()} />
        </PageWithHeader>
      );
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
    /* The tab's name, large at the top of the page and folding into the bar
       as it is read; + in the bar's capsule (the Apple pass, 2026-11-05). It
       was a fixed row — the title, +, then the tabs — over the list. */
    <Screen
      edges={[]}
      insetHeader
      topBar={
        <FrostedTopBar
          title="Pings"
          right={
            <TopBarDisc icon="add" label="New ping" onPress={() => router.push('/new-ping')} />
          }
        />
      }>
      {body()}
    </Screen>
  );
}

const keyOf = (ping: PingFeedRow) => ping.id;

function Gap() {
  return <View style={styles.gap} />;
}

/**
 * The brief's lightweight filters — a genre, a platform, and only requests
 * built on games — behind one key that opens a tray of rows (the Apple pass,
 * 2026-11-05). The key is white with the count while any is on, and says what
 * the list is narrowed to beside it. They were two dropdowns and a toggle in
 * a wrapping row.
 */
function Filters({
  value,
  onChange,
}: {
  value: PingFilters;
  onChange: (next: PingFilters) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const count = (value.genre ? 1 : 0) + (value.platform ? 1 : 0) + (value.withRefs ? 1 : 0);
  const narrowed = [
    value.genre ? GENRE_OPTIONS.find((option) => option.value === value.genre)?.label : null,
    value.platform
      ? PLATFORM_OPTIONS.find((option) => option.value === value.platform)?.label
      : null,
    value.withRefs ? 'With games' : null,
  ].filter(Boolean);

  return (
    <View style={styles.filters}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={count > 0 ? `Filters, ${count} on` : 'Filters'}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        scaleTo={0.92}
        pressedColor={count > 0 ? undefined : theme.controlPressed}
        style={StyleSheet.flatten([
          styles.filterKey,
          { backgroundColor: count > 0 ? theme.text : theme.controlFill },
        ])}>
        <Ionicons
          name="options-outline"
          size={18}
          color={count > 0 ? theme.onPrimary : theme.text}
        />
        {count > 0 && (
          <Text variant="h5" style={{ color: theme.onPrimary }}>
            {count}
          </Text>
        )}
      </PressableScale>
      <Text variant="bodySmall" color="textSecondary" numberOfLines={1} style={styles.flex}>
        {narrowed.length > 0 ? narrowed.join(' · ') : 'Every genre and platform'}
      </Text>

      <Tray visible={open} onClose={() => setOpen(false)}>
        <View style={styles.tray}>
          <Text variant="h4" accessibilityRole="header" style={styles.trayTitle}>
            Filter pings
          </Text>
          <InsetGroup>
            <PullDownRow
              title="Genre"
              choices={PING_GENRES}
              value={value.genre}
              onChange={(genre) => onChange({ ...value, genre })}
              anyLabel="Any genre"
            />
            <PullDownRow
              title="Platform"
              choices={PING_PLATFORMS}
              value={value.platform}
              onChange={(platform) => onChange({ ...value, platform })}
              anyLabel="Any platform"
            />
            <Row
              title="Only pings with games"
              toggle={{
                value: value.withRefs,
                onValueChange: (withRefs) => onChange({ ...value, withRefs }),
              }}
            />
          </InsetGroup>
          <View style={styles.trayActions}>
            <View style={styles.flex}>
              <Button
                title="Clear"
                variant="secondary"
                fullWidth
                disabled={count === 0}
                onPress={() => onChange(NO_PING_FILTERS)}
              />
            </View>
            <View style={styles.flex}>
              <Button title="Done" fullWidth onPress={() => setOpen(false)} />
            </View>
          </View>
        </View>
      </Tray>
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
        icon="search"
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
    <PageWithHeader header={header} contentContainerStyle={styles.content}>
      <View style={styles.stageSkeleton}>
        <Skeleton width={100} height={Math.round(100 / PosterAspectRatio)} />
        <Skeleton width="70%" height={22} />
        <Skeleton width="40%" height={14} />
        <Skeleton width="85%" height={38} />
        <Skeleton width="100%" height={52} radius={Radius.pill} />
      </View>
    </PageWithHeader>
  );
}

/** Two plates' worth of shimmer, the height of the plates that replace them. */
function BoardSkeleton({ header, width }: { header: React.ReactElement; width: number }) {
  return (
    <PageWithHeader header={header} contentContainerStyle={styles.content}>
      {[0, 1].map((index) => (
        <View key={index} style={styles.plateSkeleton}>
          <Skeleton width={width} height={96} radius={0} />
          <Skeleton width="45%" height={14} />
          <Skeleton width="100%" height={42} />
          <Skeleton width="100%" height={13} />
        </View>
      ))}
    </PageWithHeader>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.x16, flexGrow: 1, gap: 0 },
  header: { gap: Spacing.x12, marginBottom: Spacing.x20 },
  boardHead: { paddingBottom: Spacing.x8, borderBottomWidth: StyleSheet.hairlineWidth },
  filters: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  filterKey: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x4,
    minWidth: 40,
    height: 40,
    paddingHorizontal: Spacing.x8,
    borderRadius: 20,
  },
  flex: { flex: 1 },
  tray: { padding: Spacing.x16, gap: Spacing.x16 },
  trayTitle: { textAlign: 'center' },
  trayActions: { flexDirection: 'row', gap: Spacing.x12 },
  gap: { height: Spacing.x32 },
  more: { paddingVertical: Spacing.x24, alignItems: 'center' },
  stageSkeleton: { alignItems: 'center', gap: Spacing.x16, paddingTop: Spacing.x12 },
  plateSkeleton: { gap: Spacing.x12, marginBottom: Spacing.x32 },
});
