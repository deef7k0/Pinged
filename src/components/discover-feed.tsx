import Ionicons from '@expo/vector-icons/Ionicons';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Fragment, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabBarClearance } from '@/components/app-tab-bar';
import { FeatureCards, type FeatureCardGame } from '@/components/explore/feature-cards';
import { CoverRailSkeleton, GameCoverRail, useRailLayout } from '@/components/game-rail';
import { HomeSection } from '@/components/home-section';
import { CollectionSeparator, ListTile } from '@/components/list-tile';
import { LogCard } from '@/components/log-card';
import { SpotlightSlider } from '@/components/search/spotlight-slider';
import { TopChartEntry } from '@/components/search/top-chart-entry';
import { GlassSurface, useLiquidGlass } from '@/components/ui/liquid-glass';
import { PressGlyph } from '@/components/ui/press-glyph';
import { PressableScale } from '@/components/ui/pressable-scale';
import { DropdownButton, type DropdownOption } from '@/components/ui/dropdown-button';
import { PageScrollView } from '@/components/ui/page-scroll';
import { Text } from '@/components/ui/text';
import { footHeight } from '@/constants/cover-rail';
import type { EditionKind } from '@/constants/game-editions';
import { discoverGeometry } from '@/constants/discover-carousel';
import { clampScore, scoreColor } from '@/constants/score';
import { FontFamily, MaxContentWidth, Spacing } from '@/constants/theme';
import { useReviewChart } from '@/hooks/use-review-chart';
import { useTheme } from '@/hooks/use-theme';
import { getBelovedGames, getPopularCollections, getUserLogs, type BelovedPeriod } from '@/lib/api';
import { getSimilarTo } from '@/lib/games';
import { getSpotlight } from '@/lib/games/igdb';
import { getDiscoverGames, getPopularGames } from '@/lib/news';
import { recommendationSeed } from '@/lib/news/recommendations';
import { useAuth } from '@/store/auth';

const RAIL_GAMES = 20;
const RECOMMENDED_GAMES = 12;
/** How many reviews and collections Explore shows of each chart: a taste, then "See all". */
const PREVIEW = 3;
/** The slider has left the screen once this much of it has scrolled away. */
const SLIDER_GONE = 0.8;

const PERIODS: readonly DropdownOption<BelovedPeriod>[] = [
  { value: 'week', label: 'This week', short: 'Week' },
  { value: 'month', label: 'This month', short: 'Month' },
  { value: 'year', label: 'This year', short: 'Year' },
];

const PERIOD_WORDS: Record<BelovedPeriod, string> = {
  week: 'this week',
  month: 'this month',
  year: 'this year',
};

/**
 * The Explore tab (the owner's, 2026-11-03): what Search showed before
 * anything was typed — "This explore tab does not have any searchable stuff.
 * It shows things on the app" — under Apple TV's own arrangement.
 *
 * Top to bottom, in the owner's order: the tab's name, then the games out
 * now and coming soon as the square parallax slider Search used to lead with
 * (`<SpotlightSlider>` — the portrait hero was tried and taken back the same
 * day); Highly rated; Popular this month as Apple TV Home's big cards (`<FeatureCards>`);
 * then the rest of what Discover was — Similar to the game you reviewed last,
 * Beloved by the community, the Top 1000 — and the two charts the Reviews and
 * Collections tabs led with untyped, three of each and "See all".
 */
export function DiscoverFeed() {
  const theme = useTheme();
  const liquid = useLiquidGlass();
  const router = useRouter();
  const clearance = useTabBarClearance();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const rail = useRailLayout();

  /* One "now" for every date on the page; the spotlight's key is the day, so
     tomorrow asks again. */
  const [now] = useState(() => Math.floor(Date.now() / 1000));
  const [period, setPeriod] = useState<BelovedPeriod>('month');
  const [sliderAway, setSliderAway] = useState(false);
  const [sliderTop, setSliderTop] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const queryClient = useQueryClient();

  const spotlight = useQuery({
    queryKey: ['spotlight', Math.floor(now / 86_400)],
    queryFn: ({ signal }) => getSpotlight(now, signal),
    staleTime: 60 * 60_000,
    retry: false,
  });

  const topTen = useQuery({
    queryKey: ['popular-games', 10],
    queryFn: ({ signal }) => getPopularGames(10, signal),
    staleTime: 30 * 60_000,
  });

  const logs = useQuery({
    queryKey: ['user-logs', viewerId],
    queryFn: () => getUserLogs(viewerId!),
    enabled: !!viewerId,
  });
  const seed = useMemo(() => recommendationSeed(logs.data ?? []), [logs.data]);

  const similar = useQuery({
    queryKey: ['similar', seed?.gameId],
    queryFn: ({ signal }) => getSimilarTo(seed!.gameId, signal),
    enabled: !!seed,
    staleTime: 30 * 60_000,
  });

  const beloved = useQuery({
    queryKey: ['beloved-games', period],
    queryFn: () => getBelovedGames(period, RAIL_GAMES),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    retry: false,
  });

  const discover = useQuery({
    queryKey: ['news', 'discover'],
    queryFn: ({ signal }) => getDiscoverGames(signal),
    staleTime: 60 * 60_000,
  });

  /* Search's Reviews and Collections charts, untyped — the same queries, so
     their own screens open on what this showed. */
  const { chart: reviewChart } = useReviewChart('month');
  const collections = useQuery({
    queryKey: ['discover', 'collections'],
    queryFn: () => getPopularCollections(),
    staleTime: 5 * 60_000,
  });

  const popular = useMemo<FeatureCardGame[]>(
    () =>
      (topTen.data?.entries ?? []).map((entry) => ({
        id: entry.gameId,
        title: entry.title,
        heroUrl: entry.heroUrl,
        coverUrl: entry.coverUrl,
        strapline: `No. ${entry.rank} this month`.toUpperCase(),
        line: entry.releaseYear ? String(entry.releaseYear) : null,
      })),
    [topTen.data]
  );

  const loved = useMemo(
    () =>
      (beloved.data ?? []).map((game) => ({
        id: game.id,
        title: game.title,
        coverUrl: game.cover_url,
        heroUrl: game.hero_url,
        edition: (game.edition_kind as EditionKind | null) ?? null,
        releaseYear: game.release_year,
        average: clampScore(game.average),
        ratings: game.ratings,
      })),
    [beloved.data]
  );

  const recommended = (similar.data ?? []).slice(0, RECOMMENDED_GAMES);
  const highlyRated = (discover.data ?? []).slice(0, RAIL_GAMES);
  const reviews = (reviewChart.data?.reviews ?? []).slice(0, PREVIEW);
  const lists = (collections.data ?? []).slice(0, PREVIEW);

  const lineFoot = footHeight('line');
  const linedRailHeight = rail.cover.height + lineFoot;
  const sliderHeight = discoverGeometry(Math.min(width, MaxContentWidth)).height;

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const away = event.nativeEvent.contentOffset.y > sliderTop + sliderHeight * SLIDER_GONE;
    if (away !== sliderAway) setSliderAway(away);
  }

  return (
    <PageScrollView
      ref={scrollRef}
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      contentContainerStyle={{ paddingBottom: Spacing.x48 + clearance }}
      refreshControl={
        <RefreshControl
          refreshing={
            discover.isRefetching ||
            topTen.isRefetching ||
            similar.isRefetching ||
            spotlight.isRefetching
          }
          onRefresh={() => {
            spotlight.refetch();
            discover.refetch();
            topTen.refetch();
            beloved.refetch();
            void reviewChart.refetch();
            void collections.refetch();
            if (seed) similar.refetch();
            void queryClient.invalidateQueries({ queryKey: ['top-chart'] });
            void queryClient.invalidateQueries({ queryKey: ['critic-chart'] });
          }}
          tintColor={theme.primary}
        />
      }>
      {/* The tab's name, large at the top left, and the calendar beside it. */}
      <View style={[styles.head, { paddingTop: insets.top + Spacing.x8 }]}>
        <Text variant="largeTitle" accessibilityRole="header">
          Explore
        </Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Release calendar"
          onPress={() => router.push('/calendar')}
          scaleTo={0.94}
          style={StyleSheet.flatten([
            styles.key,
            { backgroundColor: liquid ? undefined : theme.controlFill },
          ])}>
          {liquid && <GlassSurface radius={22} />}
          <PressGlyph>
            <Ionicons name="calendar-outline" size={21} color={theme.text} />
          </PressGlyph>
        </PressableScale>
      </View>

      <View style={styles.sections}>
        {/* The month's biggest releases, the most awaited game and the
            calendar, as Home's carousel moving by itself — the square
            parallax slider Search led with (the owner's, 2026-11-03: "go
            back to the square parallax games"). */}
        <View onLayout={(event) => setSliderTop(event.nativeEvent.layout.y)}>
          <HomeSection title="Out now and coming soon">
            <SpotlightSlider
              spotlight={spotlight.data ?? null}
              loading={spotlight.isPending}
              now={now}
              away={sliderAway}
            />
          </HomeSection>
        </View>

        <HomeSection title="Highly rated">
          {discover.isLoading ? (
            <CoverRailSkeleton inset={Spacing.x16} />
          ) : (
            <GameCoverRail games={highlyRated} inset={Spacing.x16} />
          )}
        </HomeSection>

        <HomeSection title="Popular this month" seeAll="/top-games">
          <FeatureCards games={popular} loading={topTen.isLoading} />
        </HomeSection>

        {seed && (similar.isLoading || recommended.length > 0) && (
          <HomeSection lead="Similar to" title={seed.title}>
            {similar.isLoading ? (
              <CoverRailSkeleton inset={Spacing.x16} />
            ) : (
              <GameCoverRail games={recommended} inset={Spacing.x16} />
            )}
          </HomeSection>
        )}

        {/* Absent — not empty — on a database that has not run 0037 (`null`). */}
        {beloved.data !== null && !beloved.isLoadingError && (
          <HomeSection
            title="Beloved by the community"
            trailing={
              <DropdownButton
                label="Period"
                size="small"
                value={period}
                options={PERIODS}
                onChange={setPeriod}
              />
            }>
            {beloved.isPending ? (
              <CoverRailSkeleton foot={lineFoot} inset={Spacing.x16} />
            ) : loved.length > 0 ? (
              <View style={beloved.isPlaceholderData && styles.settling}>
                <GameCoverRail
                  games={loved}
                  inset={Spacing.x16}
                  footOf={(game) => (
                    <Text
                      variant="bodySmall"
                      numberOfLines={1}
                      style={[styles.score, { color: scoreColor(game.average, theme) }]}>
                      {game.average}
                    </Text>
                  )}
                  labelOf={(game) =>
                    `${game.title}, rated ${game.average} on Pinged from ${game.ratings} ${
                      game.ratings === 1 ? 'score' : 'scores'
                    }`
                  }
                />
              </View>
            ) : (
              <View style={[styles.note, { height: linedRailHeight }]}>
                <Text variant="body" color="textSecondary">
                  {`Nobody has scored a game ${PERIOD_WORDS[period]}.`}
                </Text>
              </View>
            )}
          </HomeSection>
        )}

        <TopChartEntry />

        {reviews.length > 0 && (
          <HomeSection title="Popular reviews" seeAll="/reviews?period=month">
            <View style={styles.cards}>
              {reviews.map((log) => (
                <LogCard key={log.id} log={log} />
              ))}
            </View>
          </HomeSection>
        )}

        {lists.length > 0 && (
          <HomeSection title="Popular collections" seeAll="/collections">
            <View style={styles.tiles}>
              {lists.map((list, index) => (
                <Fragment key={list.id}>
                  {index > 0 && <CollectionSeparator />}
                  <ListTile list={list} />
                </Fragment>
              ))}
            </View>
          </HomeSection>
        )}
      </View>
    </PageScrollView>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.x16,
  },
  key: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sections: { gap: Spacing.x32, paddingTop: Spacing.x16 },
  score: { fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
  settling: { opacity: 0.5 },
  note: { justifyContent: 'center', paddingHorizontal: Spacing.x16 },
  cards: { paddingHorizontal: Spacing.x16, gap: Spacing.x12 },
  tiles: { paddingHorizontal: Spacing.x16 },
});
