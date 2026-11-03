import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from 'react-native';

import { useTabBarClearance } from '@/components/app-tab-bar';
import { CoverRailSkeleton, GameCoverRail, useRailLayout } from '@/components/game-rail';
import { HomeSection } from '@/components/home-section';
import { SpotlightSlider } from '@/components/search/spotlight-slider';
import { TopChartEntry } from '@/components/search/top-chart-entry';
import { DropdownButton, type DropdownOption } from '@/components/ui/dropdown-button';
import { PageScrollView } from '@/components/ui/page-scroll';
import { Text } from '@/components/ui/text';
import { footHeight } from '@/constants/cover-rail';
import type { EditionKind } from '@/constants/game-editions';
import { clampScore, scoreColor } from '@/constants/score';
import { discoverGeometry } from '@/constants/discover-carousel';
import { FontFamily, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getBelovedGames, getUserLogs, type BelovedPeriod } from '@/lib/api';
import { getSimilarTo } from '@/lib/games';
import { getSpotlight } from '@/lib/games/igdb';
import { getDiscoverGames, getPopularGames } from '@/lib/news';
import { recommendationSeed } from '@/lib/news/recommendations';
import { useAuth } from '@/store/auth';

/** Games in each catalogue rail: a screenful and a long scroll, not the whole list. */
const RAIL_GAMES = 20;

/** Games in the "Similar to…" rail. */
const RECOMMENDED_GAMES = 12;

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
 * Discover, before anything is typed: the answer to "what should I play".
 *
 * The owner's reference for it (2026-10-09) is Letterboxd's home, and this is
 * that page in the app's materials:
 *
 * ```text
 *   ░░░░ the slider: two new, one awaited, the calendar ░░░░
 *   Popular this month                        ›
 *   ▯▯▯ ▯▯▯ ▯▯▯ ▯▯
 *   Similar to Hades
 *   ▯▯▯ ▯▯▯ ▯▯▯ ▯▯
 *   Beloved by the community           Month ▾
 *   ▯▯▯ ▯▯▯ ▯▯▯ ▯▯
 *   Highly rated
 *   ▯▯▯ ▯▯▯ ▯▯▯ ▯▯
 *   ▯▯▯  Top 1000 — the top three, fanned; a button
 *   Browse by genre
 * ```
 *
 * ## The Top 1000
 *
 * The owner's request (2026-10-20): a ranking of the best-reviewed games on
 * GameLog, a toggle to rank them by the critics instead, twenty to a page
 * (`<TopChart>`). It stood here, after the rows of covers, until the owner
 * moved it to a screen of its own (2026-10-21, `app/top-chart.tsx`): what is
 * here is its button (`<TopChartEntry>`), the top three fanned as Surprise
 * Me's cards are.
 *
 * ## The slider leads
 *
 * `<SpotlightSlider>` took the place of the Calendar button — the calendar is
 * its last slide. A light lay under it for three builds; the owner had it
 * removed ("Remove the glow from the search screen").
 *
 * ## No collections here
 *
 * A band of the most-liked collections closed this page. The owner had it
 * taken out of the Games tab: collections have a tab of their own two pills
 * along, which shows the same list before anything is typed.
 *
 * ## Every row of games stands on the page
 *
 * A one-line heading (`<HomeSection>`), a chevron where there is somewhere to
 * go, and under it small covers with nothing printed under them
 * (`<GameCoverRail>`). A row prints a line under its covers only for what the
 * box cannot say — a chart's rank, what the people here scored it.
 *
 * **Not in cards.** The first build drew each row inside a rounded panel, as
 * the reference does; the owner saw it on a phone and had the cards removed.
 *
 * ## "Beloved by the community" is where the Reviews band was
 *
 * The most-liked writing was a band of three review cards here; it is still
 * what the Reviews tab shows before anything is typed. In its place: the games
 * GameLog's own scores rank highest (`getBelovedGames`, migration 0037), with
 * the period — week, month, year — as a small dropdown at the far end of the
 * heading. A database that has not run 0037 has no such row; a period nobody
 * scored anything in says so, and keeps the control that leads back out of it.
 *
 * ## One "Similar to…" rail, not a "For you"
 *
 * Home already has "Games for you", built from every log. This is the other
 * thing: one seed — the game reviewed last (`recommendationSeed`) — named in
 * the heading, so the row says why it is what it is. Two rows with one name
 * and different games would look broken.
 *
 * A `ScrollView`: nothing here is a long vertical list — the rails are
 * horizontal and windowed.
 */
export function DiscoverFeed() {
  const theme = useTheme();
  const clearance = useTabBarClearance();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;
  const { width } = useWindowDimensions();
  const rail = useRailLayout();

  /* Read once, when Discover mounts: a countdown and the game it counts down
     to must come from the same "now". The key is the day, so tomorrow asks
     again. */
  const [now] = useState(() => Math.floor(Date.now() / 1000));
  const [period, setPeriod] = useState<BelovedPeriod>('month');
  const [sliderAway, setSliderAway] = useState(false);
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

  /* The key Home, the profile and the log form already share, so the seed is
     usually in the cache and moves the moment a review is saved. */
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
    /* The last period's covers stand while the next arrive, so choosing one
       does not empty the row and fill it again. */
    placeholderData: keepPreviousData,
    retry: false,
  });

  const discover = useQuery({
    queryKey: ['news', 'discover'],
    queryFn: ({ signal }) => getDiscoverGames(signal),
    staleTime: 60 * 60_000,
  });

  const chart = useMemo(
    () =>
      (topTen.data?.entries ?? []).map((entry) => ({
        id: entry.gameId,
        title: entry.title,
        coverUrl: entry.coverUrl,
        heroUrl: entry.heroUrl,
        edition: entry.edition,
        releaseYear: entry.releaseYear,
        steamAppId: entry.steamAppId,
        rank: entry.rank,
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
        /* Rounded where it is drawn: the period's weighted average keeps its
           decimals until here (0041). */
        average: clampScore(game.average),
        ratings: game.ratings,
      })),
    [beloved.data]
  );

  const recommended = (similar.data ?? []).slice(0, RECOMMENDED_GAMES);
  const highlyRated = (discover.data ?? []).slice(0, RAIL_GAMES);

  const lineFoot = footHeight('line');
  /* What a rail with a line under its covers stands in, so a note in its
     place — "nobody scored a game this week" — is the same height. */
  const linedRailHeight = rail.cover.height + lineFoot;

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const away =
      event.nativeEvent.contentOffset.y >
      discoverGeometry(Math.min(width, MaxContentWidth)).height * SLIDER_GONE;
    if (away !== sliderAway) setSliderAway(away);
  }

  return (
    /* The page's scroller, so Search's field folds away as it is read
       (`<CollapsingField>`); one event a frame for the same reason. */
    <PageScrollView
      ref={scrollRef}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      onScroll={onScroll}
      contentContainerStyle={[styles.content, { paddingBottom: Spacing.x48 + clearance }]}
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
            if (seed) similar.refetch();
            void queryClient.invalidateQueries({ queryKey: ['top-chart'] });
            void queryClient.invalidateQueries({ queryKey: ['critic-chart'] });
          }}
          tintColor={theme.primary}
        />
      }>
      {/* The month's biggest releases, the most awaited game and the
          calendar, as Home's carousel moving by itself (2026-11-02). The
          heading is the reference's "You might like it", stating what the
          row is. */}
      <HomeSection title="Out now and coming soon">
        <SpotlightSlider
          spotlight={spotlight.data ?? null}
          loading={spotlight.isPending}
          now={now}
          away={sliderAway}
        />
      </HomeSection>

      <HomeSection title="Popular this month" seeAll="/top-games">
        {topTen.isLoading ? (
          <CoverRailSkeleton foot={lineFoot} inset={Spacing.x16} />
        ) : (
          <GameCoverRail
            games={chart}
            lineOf={(game) => `No. ${game.rank}`}
            labelOf={(game) => `Number ${game.rank} this month: ${game.title}`}
            inset={Spacing.x16}
          />
        )}
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

      {/* Absent — not empty — on a database that has not run 0037 (`null`),
            and after a request that failed with nothing to show. `null` is
            kept with the rest of the query cache, so a database without the
            function draws this row's skeleton once, on the first visit, and
            never again. */}
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
                  /* The score ramp's own colour and the bold family: a score
                       is the one thing under a cover here that is a figure,
                       and good, mixed and bad are read before the digits are. */
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

      {/* Critically acclaimed titles, so Discover is never an empty screen
            for somebody with nothing logged yet. */}
      <HomeSection title="Highly rated">
        {discover.isLoading ? (
          <CoverRailSkeleton inset={Spacing.x16} />
        ) : (
          <GameCoverRail games={highlyRated} inset={Spacing.x16} />
        )}
      </HomeSection>

      {/* The Top 1000 is a screen of its own now (2026-10-21); this is the
          way in — its top three, fanned as Surprise Me's cards are. */}
      <TopChartEntry />

      {/* "Browse by genre" ended the page until 2026-10-22: the owner moved
          genres onto Home, where choosing one reloads Home with that genre's
          shelves, as a mood does. Do not bring the grid back here. */}
    </PageScrollView>
  );
}

const styles = StyleSheet.create({
  /* `x32` between bands, matching Home. The first heading stands a little
     under the tab row. */
  content: { gap: Spacing.x32, paddingTop: Spacing.x12, paddingBottom: Spacing.x48 },
  /* The bold family: Android synthesises no weight for a custom font. */
  score: { fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
  /* The last period's covers, while the chosen one is on its way. */
  settling: { opacity: 0.5 },
  note: { justifyContent: 'center', paddingHorizontal: Spacing.x16 },
});
