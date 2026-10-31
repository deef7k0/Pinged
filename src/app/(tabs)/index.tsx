import Ionicons from '@expo/vector-icons/Ionicons';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  StyleSheet,
  View,
  useWindowDimensions,
  type ScrollView,
} from 'react-native';

import { ActivityRail } from '@/components/activity-rail';
import { CoverRailSkeleton, GameCoverRail } from '@/components/game-rail';
import { BandError, INLINE_LINK_SLOP } from '@/components/home/band-error';
import { HOME_HEADER_ROW, HomeHeader } from '@/components/home/home-header';
import { HomeGlow } from '@/components/home/home-glow';
import { MoodBody, MoodLead, useMoodFeed } from '@/components/home/mood-feed';
import { MoodTiles } from '@/components/home/mood-tiles';
import { DiscoverCarousel, DiscoverCarouselSkeleton } from '@/components/home/discover-carousel';
import { HomeSection } from '@/components/home-section';
import { ArticleCard, PastEventCard } from '@/components/news-cards';
import { Arrive, stagger } from '@/components/ui/arrive';
import { SurpriseEntry } from '@/components/surprise-entry';
import { Button } from '@/components/ui/button';
import { PageScrollView } from '@/components/ui/page-scroll';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, Screen } from '@/components/ui/screen';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { useTabBarClearance } from '@/components/app-tab-bar';
import { footHeight } from '@/constants/cover-rail';
import { HeroAspectRatio, Spacing } from '@/constants/theme';
import { extractSeedColor } from '@/hooks/use-album-art-color';
import { useGameColours } from '@/hooks/use-game-colours';
import { useTopBarInset } from '@/hooks/use-header-height';
import { useTheme } from '@/hooks/use-theme';
import { getHomeActivity, getUserLogs } from '@/lib/api';
import { startNewRound, useAppRound } from '@/lib/app-round';
import { recommendFromLogs } from '@/lib/games/recommend';
import { loadRecommendHistory, recordRecommended } from '@/lib/games/recommend-history';
import { hashString, seededRandom } from '@/lib/games/recommend-rules';
import { getLatestEvents } from '@/lib/games/browse';
import { ALL, feedFor, sameView, type HomeView } from '@/lib/home-view';
import { GLOW_OVERFLOW, glowTone } from '@/lib/home-glow';
import { generateDynamicTheme } from '@/theme/dynamic-color';
import { getGamingNews, getNewReleases, getUpcomingReleases } from '@/lib/news';
import { displayNameFor } from '@/lib/format';
import { useAuth } from '@/store/auth';

/**
 * From the bar's foot to the first thing on the page: the reference's 8, and
 * more at the owner's direction (2026-10-22: "the sections must start a little
 * bit lower").
 */
const LEAD_GAP = Spacing.x24;

/** How many finished events Home shows: the owner's three. */
const LATEST_EVENTS = 3;

/** How many news items Home shows before "See all". Enough to be worth a look. */
const NEWS_PREVIEW = 3;
/** Covers in the row of people's activity. A few screenfuls sideways. */
const ACTIVITY_LIMIT = 20;
/** Games in the recommendation rail. Roughly five screenfuls of scrolling. */
const RECOMMENDED_LIMIT = 12;
/** Posters in the merged releases rail, split evenly between out-now and upcoming. */
const RELEASES_PER_HALF = 10;

/**
 * Roughly what an `<ArticleCard>` comes to, minus its image.
 *
 * Headline (2 lines of `h4`), outlet and timestamp, and the card's padding. The
 * image is the variable part and is measured from the viewport, so the skeleton
 * matches the real card at any width. See `newsCardHeight`.
 */
const ARTICLE_CHROME_HEIGHT = 140;

/**
 * A news skeleton the same height as the card that replaces it.
 *
 * It was a flat 96 against a real card of ~350, so the placeholder understated
 * what was coming by 3.6× and the band grew ~760dp *in place* as three of them
 * resolved — moving everything below it while someone was reading. A skeleton
 * that lies about its size is worse than no skeleton, because the page commits
 * to a layout it is about to abandon.
 */
function newsCardHeight(width: number): number {
  return Math.round((width - Spacing.x16 * 2) / HeroAspectRatio + ARTICLE_CHROME_HEIGHT);
}

/**
 * Home.
 *
 * Not a feed. A feed answers "what did the people I follow post"; Home answers
 * "what should I look at now", and those are different questions with different
 * ingredients.
 *
 * **SimpMusic's Home, around this app's bands** — the owner's direction
 * (2026-10-22): its glow "with the same effect and size", "their exact top
 * bar", and its tabs with moods. Read from its source, not its screens:
 *
 * - **The top bar is `<HomeHeader>`**: All, Mood and Genre, Create and
 *   the bell on one row, fixed over the page, clear at the top and the
 *   page's colour once the page is under it. The reference puts the avatar
 *   there too; the owner had it brought back onto the page (2026-10-22) as
 *   the "Welcome back" row it was — on All — so the chips have the row to
 *   themselves. The bell was beside the name until the owner had it moved
 *   into the bar, in Settings' place (2026-10-28); Settings is the profile
 *   tab's alone.
 * - **The glow is `<HomeGlow>`**: the background of the page's first block —
 *   the bar's room and the first section — and 140dp past it, scrolling with
 *   the page. Its colour is the Material 3 primary of the first game in the
 *   first section — "Games for you", or a mood's or a genre's first shelf —
 *   times 0.45, `AmbientThemeGlow`'s, as the reference takes its tint from its
 *   first shelf's first song (`lib/home-glow`).
 *   It replaced the soft light in the top-left corner (`<AmbientLight>`).
 *   **Its length is the first block's**, which on All is the greeting and
 *   Surprise Me and stops there — see `leadHeight`.
 * - **Mood and Genre swap the page.** All is this page's own bands, below; a
 *   mood or a genre is its feed (`<MoodLead>`, `<MoodBody>`, `lib/games/moods`
 *   and `genre-feed` — what the reference asks YouTube for, written as IGDB
 *   clauses). Every view ends on "Let's pick a mood for you" (`<MoodTiles>`),
 *   the reference's moods-and-genres grid — its *search* screen's blocks, at
 *   the owner's direction (2026-10-22) — before the footer.
 *
 * **All is four bands, and the order is the argument.** The page opens on *you*
 * and widens outward — what you might play, what people played, what came out,
 * what happened. Every band is a different question; none of them is a second
 * helping of the one above it.
 *
 *   Games for you     — from your own logs, via IGDB similarity
 *   New from friends  — what your circle scored and wrote about   (Postgres)
 *   Releases          — just out, and what is next                (IGDB)
 *   Latest news       — what happened                             (RSS)
 *   Latest events     — the last three showcases that finished    (IGDB)
 *
 * **The first three are rows of games**: a one-line heading on the page over
 * small covers — the shape of the sections on Letterboxd's home, the owner's
 * reference (2026-10-09), without the cards the reference draws them in (the
 * owner had those removed). The news stands under its own heading the same way.
 *
 * **"New from friends" is where the review cards were.** The band was a stack
 * of `<LogCard>`s — your circle's, then everyone's under a rule. The owner
 * replaced it with the reference's row of that name: covers, and under each a
 * face, a name and a score. When the people you follow have logged nothing —
 * or you follow nobody — the same row is headed "New on GameLog" and shows
 * everyone's; it is never both, and never blended (`getHomeActivity`). The
 * review card is still every *list* of reviews in the app; Home no longer has
 * one.
 *
 * It used to be seven. Two pairs of those were the same band twice: "Latest
 * releases" and "Coming soon" were both 92dp poster rails with an inverted date
 * predicate, rendered back to back; "From people you follow" and "Latest
 * reviews" were the same component from the same query, separated by ~2,900dp
 * of other content, and `newest` is *defined* as the residue after `followed`
 * is removed. Both pairs are now single bands.
 *
 * **"Fresh collections" was cut rather than merged.** It had no sibling to
 * merge with and it was the most expensive band on the page — a plain
 * horizontal `ScrollView`, so six tiles × four mosaic covers meant 24 images
 * fetched unconditionally with no windowing, most of them never seen.
 * Collections are still reachable from Search and from any profile. If it comes
 * back it should come back as a `FlatList`.
 *
 * **The month's chart is deliberately not here.** It led the page for a while
 * and it was the least personal thing on it — a chart is the same for everyone,
 * which makes it the wrong thing to open a signed-in home screen with. It still
 * leads the Search tab, where browsing is the point, and `/top-games` is still
 * a route.
 *
 * Every band fails independently and says so where it happens — one dead RSS
 * feed removes one band's contents and leaves the rest of the page working,
 * which is why nothing here gates on a shared loading state.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const clearance = useTabBarClearance();
  const router = useRouter();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const userId = useAuth((state) => state.session?.user.id);
  const profile = useAuth((state) => state.profile);
  const name = displayNameFor(profile);
  const colours = useGameColours();

  /*
   * Tapping the active tab returns to the top.
   *
   * The platform convention on every tab bar, and this page needs it more than
   * most: it is long, and the chips that change it are at the top.
   */
  const scroller = useRef<ScrollView>(null);
  /* The bar's room at the top of the page: the status bar and the row. */
  const barHeight = useTopBarInset() + HOME_HEADER_ROW;

  useEffect(() => {
    const unsubscribe = navigation.addListener(
      // @ts-expect-error — `tabPress` is contributed by the Tabs navigator and
      // is not in the generic navigation event map this hook is typed against.
      'tabPress',
      () => scroller.current?.scrollTo({ y: 0, animated: true })
    );
    return unsubscribe;
  }, [navigation, scroller]);

  /*
   * All, a mood or a genre — the reference's `params`, which reloads its Home
   * with that feed. Session state, as the reference's view model holds it:
   * Home opens on All.
   */
  const [view, setView] = useState<HomeView>(ALL);
  const spec = useMemo(() => feedFor(view), [view]);
  const feed = useMoodFeed(spec);
  const inFeed = spec !== null;

  function changeView(next: HomeView) {
    if (sameView(next, view)) return;
    setView(next);
    /* A new feed starts at its top, under the chips that asked for it. */
    scroller.current?.scrollTo({ y: 0, animated: false });
  }

  /*
   * The viewer's own logs, which do three jobs on this screen: they seed the
   * recommendation rail, their *count* is what decides whether this is a
   * first run, and a mood's Quick picks leave out the games in them. Cheap
   * enough to be worth it — one indexed query capped at 100 rows — and it is
   * the only data on the page genuinely about this account.
   */
  const logs = useQuery({
    queryKey: ['user-logs', userId],
    queryFn: () => getUserLogs(userId!),
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
  const logged = useMemo(() => new Set((logs.data ?? []).map((log) => log.game_id)), [logs.data]);

  /*
   * Keyed on what the seeds *are*, not how many there are.
   *
   * The key used to be `logs.data?.length`, which is a proxy that happens to
   * work until someone edits a rating without adding a log — then the rail
   * stays stale for the full 30 minutes while the input to it has changed. It
   * also made `refreshAll` fetch twice: the manual refetch ran against the old
   * logs, then the count changed and the new key ran again.
   */
  const seedKey = (logs.data ?? [])
    .slice(0, 20)
    .map((log) => `${log.game_id}:${log.rating ?? ''}`)
    .join(',');

  /*
   * A new round every time the app is opened (`useAppRound`), and no game the
   * band has shown before until the unseen ones run out
   * (`lib/games/recommend-rules`). The history is read once a round, so a
   * refetch inside it — a log saved — excludes the same games and draws the
   * same seeds rather than reshuffling the band under somebody looking at it.
   * Neither query is written to the device: a restored round is last time's.
   */
  const appRound = useAppRound();
  const shownBefore = useQuery({
    queryKey: ['recommend-history', userId, appRound],
    queryFn: () => loadRecommendHistory(userId!),
    enabled: !!userId,
    staleTime: Infinity,
  });
  const recommended = useQuery({
    queryKey: ['recommended', userId, seedKey, appRound],
    queryFn: async ({ signal }) => {
      const answer = await recommendFromLogs(logs.data ?? [], RECOMMENDED_LIMIT, signal, {
        random: seededRandom(hashString(`${userId}:${appRound}`)),
        recent: shownBefore.data ?? [],
      });
      void recordRecommended(
        userId!,
        answer.games.map((game) => game.id)
      );
      return answer;
    },
    // Only once the seeds are in hand: running this on an empty array would
    // cache an empty result under a key that never re-runs.
    enabled: (logs.data?.length ?? 0) > 0 && shownBefore.isSuccess,
    staleTime: 30 * 60_000,
  });

  const activity = useQuery({
    queryKey: ['home-activity', userId],
    queryFn: () => getHomeActivity(userId!, ACTIVITY_LIMIT),
    enabled: !!userId,
    staleTime: 2 * 60_000,
  });

  const news = useQuery({
    queryKey: ['news', 'articles'],
    queryFn: ({ signal }) => getGamingNews(signal),
    staleTime: 15 * 60_000,
  });

  const releases = useQuery({
    queryKey: ['news', 'new-releases'],
    queryFn: ({ signal }) => getNewReleases(signal),
    staleTime: 60 * 60_000,
  });

  const upcoming = useQuery({
    queryKey: ['news', 'upcoming'],
    queryFn: ({ signal }) => getUpcomingReleases(signal),
    staleTime: 60 * 60_000,
  });

  /* The last three showcases that have finished — the owner's direction
     (2026-10-15): "only display the last 3 events. Not upcoming". The clock is
     read when the query runs, never during a render. */
  const latestEvents = useQuery({
    queryKey: ['home-latest-events'],
    queryFn: ({ signal }) => getLatestEvents(Date.now(), LATEST_EVENTS, signal),
    staleTime: 30 * 60_000,
  });

  /* Watches every band the pull actually refetches, so the spinner stops when
     the page is done rather than when the first four queries are. A mood's
     pull is its own three. */
  const refreshing = inFeed
    ? feed.shelves.isRefetching || feed.quickPicks.isRefetching || feed.studio.isRefetching
    : logs.isRefetching ||
      recommended.isRefetching ||
      activity.isRefetching ||
      news.isRefetching ||
      releases.isRefetching ||
      upcoming.isRefetching ||
      latestEvents.isRefetching;

  function refreshAll() {
    if (inFeed) {
      feed.shelves.refetch();
      feed.quickPicks.refetch();
      feed.studio.refetch();
      return;
    }
    logs.refetch();
    /* A pull is a new round of "Games for you", not the same one again. */
    startNewRound();
    activity.refetch();
    news.refetch();
    releases.refetch();
    upcoming.refetch();
    latestEvents.refetch();
  }

  const recommendedGames = recommended.data?.games ?? [];

  /*
   * A first run is "no logs", and it is only knowable once the query resolves.
   *
   * `logs.isSuccess` rather than `!logs.isLoading`: an errored logs query is
   * not an empty account, and showing someone a "log your first game" block
   * because their connection dropped would be the app telling them their own
   * library is gone.
   */
  const isFirstRun = logs.isSuccess && (logs.data?.length ?? 0) === 0;
  /* `isPending`, not `isLoading`: the band's query waits on the history read,
     and a query that is waiting is not fetching — but is not empty either. */
  const seedsPending = logs.isLoading || (logs.isSuccess && !isFirstRun && recommended.isPending);

  /* Just out, then what is next — one continuous timeline rather than two rails
     of near-identical posters with a 48dp gap and a 19px heading between them.
     The year under each poster is what separates the halves. */
  const releaseRail = [
    ...(releases.data ?? []).slice(0, RELEASES_PER_HALF),
    ...(upcoming.data ?? []).slice(0, RELEASES_PER_HALF),
  ];

  /*
   * The two covers behind Surprise Me's face-down card.
   *
   * Borrowed from bands this page has already fetched, so the deck is real box
   * art for the price of a slice — a query of its own would spend a request to
   * decorate a link. Recommendations first because they are this account's own
   * games; releases are the fallback for a first run, where there are no
   * recommendations and the deck would otherwise show two blanks.
   *
   * Keyed on the query data rather than on `recommendedGames`/`releaseRail`,
   * which are fresh arrays every render and would defeat the memo — and with it
   * `<SurpriseEntry>`'s own, which is the point of memoising here at all.
   */
  const deckCovers = useMemo(() => {
    const pool = recommended.data?.games?.length ? recommended.data.games : (releases.data ?? []);
    return pool
      .filter((game) => game.coverUrl)
      .slice(0, 2)
      .map((game) => ({ coverUrl: game.coverUrl, heroUrl: game.heroUrl }));
  }, [recommended.data, releases.data]);

  const activityLogs = activity.data?.logs ?? [];
  /* The heading is the row's claim about whose games these are. While the
     first answer is on its way it is the row's own name. */
  const activityTitle = activity.data?.scope === 'everyone' ? 'New on GameLog' : 'New from friends';
  const personFoot = footHeight('person');
  const lineFoot = footHeight('line');

  /*
   * The glow's colour: the first game of the page's first section — "the
   * first song that appears in the first section", the reference's
   * `mainHomeThumbnail`. On All that is "Games for you" (Releases on a first
   * run, where there is none); in a mood, its first shelf.
   *
   * Its Material 3 primary: the seed the same query, key and extractor give
   * that game's own page (`useAlbumArtColor`), so a cover is read once for
   * both. The last colour holds while the next is worked out, as the
   * reference's animated colour does — a mood's feed loading does not drop
   * the glow to nothing.
   */
  /* Nothing while the round is on its way: the band is no longer restored
     from the device, and Releases' colour would show and then be replaced. */
  const seedCover = inFeed
    ? (feed.shelves.data?.[feed.leadIndex]?.[0]?.coverUrl ?? null)
    : seedsPending
      ? null
      : ((recommendedGames[0] ?? releaseRail[0])?.coverUrl ?? null);
  const seed = useQuery({
    queryKey: ['album-art-color', seedCover],
    queryFn: () => extractSeedColor(seedCover!),
    enabled: !!seedCover && colours.on,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    placeholderData: keepPreviousData,
  });
  const tone = glowTone(seed.data ? generateDynamicTheme(seed.data, true).primary : null, {
    gameColours: colours.on,
    primary: theme.primary,
  });

  /*
   * The first block's height — the bar's room and the one block of content
   * under it — which the glow covers and runs 140 past. Measured, so it is
   * the real block's on any phone: "300 is the height of this shelf ON A
   * PHONE".
   *
   * **What is inside that block is the glow's length**, and on All it used to
   * be four bands: the greeting, Surprise Me, the first-run ask and "Games
   * for you" — about 850dp of it, against a mood's ~240. The owner
   * (2026-10-22): "the glow in the home screen for the primary page is too
   * long. it should be the same as the ones in the other tabs." So the block
   * ends after Surprise Me, which puts the two within a few dozen dp of each
   * other, and everything that is a band of games paints over the plain page.
   * Nothing moved: the bands are in the same order, only the measured view
   * closes earlier.
   */
  const [leadHeight, setLeadHeight] = useState(0);

  return (
    <Screen
      edges={[]}
      /* Home's own floor, separate from the app's `background` while the
         owner tries colours on it. See `homeBackground`. */
      background={theme.homeBackground}
      /* Fixed over the page; the page keeps its room clear at the top of the
         first block. A slot, not a child — see `<Screen topBar>`. */
      topBar={<HomeHeader view={view} onViewChange={changeView} />}>
      <PageScrollView
        ref={scroller}
        /*
         * Bands resolve at different times and some of them are over a thousand
         * dp tall. Without this, a band landing above the viewport teleports
         * whoever is reading below it — and the person this app is built for is
         * one-handed, interrupted, and on whatever connection the sofa gets.
         * `minIndexForVisible: 1` anchors to the first child rather than the
         * scroll origin, so a pull-to-refresh still behaves.
         */
        maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: Spacing.x48 + clearance }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshAll}
            tintColor={theme.primary}
            /* Otherwise the spinner drops out of the very top of the display,
               behind the bar, and a pull-to-refresh looks like it did nothing. */
            progressViewOffset={barHeight}
          />
        }>
        {/*
          The first block: the bar's room, then the first section — the
          reference's first list item, whose background the glow is. It is
          measured, and the glow is its first child so everything paints over
          it; it runs 140 past the block's foot, under whatever comes next.
          The room is the bar's, and `LEAD_GAP` more.
        */}
        <View
          style={[styles.lead, { paddingTop: barHeight + LEAD_GAP }]}
          onLayout={(event) => {
            const height = Math.round(event.nativeEvent.layout.height);
            setLeadHeight((was) => (was === height ? was : height));
          }}>
          <HomeGlow tone={tone} height={leadHeight > 0 ? leadHeight + GLOW_OVERFLOW : 0} />

          {inFeed ? (
            <MoodLead feed={feed} />
          ) : (
            <>
              {/*
                Who you are and a way into your profile — the row the
                reference's avatar replaced, brought back by the owner
                (2026-10-22) to give the chips the bar. The bell that ended
                it is in the bar now, where Settings was (2026-10-28). On All only: a mood or a
                genre is a page about games, and opens on its strapline. Two
                lines rather than one because "Welcome back, Ada" buries the
                name inside a sentence.
              */}
              {profile && (
                <View style={styles.welcome}>
                  <Text variant="h4" color="textSecondary">
                    Welcome back,
                  </Text>
                  <View style={styles.welcomeUser}>
                    <Link href="/(tabs)/profile" asChild>
                      <PressableScale
                        accessibilityRole="link"
                        accessibilityLabel={`Signed in as ${name}. Open your profile.`}
                        scaleTo={0.98}
                        style={styles.welcomeLink}>
                        <Avatar uri={profile.avatar_url} name={name} size={40} />
                        <Text variant="h1" numberOfLines={1} style={styles.welcomeName}>
                          {name}
                        </Text>
                      </PressableScale>
                    </Link>
                  </View>
                </View>
              )}

              {/*
                The one way into the app that asks for nothing.

                Above every band, because it is the answer for the person who
                opened the app without a game in mind — and every band below
                this one needs you to already be somewhere. It works on a
                brand-new account too, which none of the personal bands do.
              */}
              <SurpriseEntry covers={deckCovers} />
            </>
          )}
        </View>

        {inFeed ? (
          <MoodBody feed={feed} logged={logged} />
        ) : (
          <>
            {/*
             * Band 1 — on a first run, the ask.
             *
             * This slot used to render its heading and five skeleton cards for a
             * brand-new account and then **delete itself** once `logs` resolved
             * empty, because the guard included `logs.isLoading`. The first thing a
             * new user saw was a promise being withdrawn — and the three social
             * bands below it were all gated on data that account cannot have, so
             * Home showed three of seven bands, none of which mentioned the one
             * thing this product exists for.
             *
             * PRODUCT.md's success metric is someone coming back to write about a
             * *second* game. Nothing on this page moved anyone toward the first.
             */}
            {isFirstRun && (
              <View style={styles.firstRun}>
                <EmptyState
                  title="Start your shelf"
                  message="Log the last game you finished — a status, a score, and as much or as little as you want to say about it."
                  action={
                    <Button
                      title="Find a game"
                      onPress={() => router.push('/(tabs)/search')}
                      icon="search"
                    />
                  }
                />
              </View>
            )}

            {/*
             * What you might play. From your own logs — not "rated highest":
             * `recommendFromLogs` seeds from logs with a null rating too.
             * BitChord's lead shelf of big cards (`<DiscoverCarousel>`, the
             * owner's, 2026-10-28; it was SimpMusic's "Your daily discover").
             * Its first cover is the glow's colour.
             */}
            {!isFirstRun && (recommendedGames.length > 0 || seedsPending) && (
              <HomeSection title="Games for you">
                {seedsPending ? (
                  <DiscoverCarouselSkeleton />
                ) : (
                  <Arrive>
                    <DiscoverCarousel
                      games={recommendedGames}
                      because={recommended.data?.because}
                    />
                  </Arrive>
                )}
              </HomeSection>
            )}

            {/*
             * What people played: your circle's, or — when they have been quiet,
             * or there is nobody in it — everyone's, under the heading that says
             * which. Absent only when nobody on GameLog has scored or written
             * about anything at all.
             */}
            {activity.isLoading ? (
              <HomeSection title={activityTitle}>
                <CoverRailSkeleton foot={personFoot} inset={Spacing.x16} />
              </HomeSection>
            ) : activity.isLoadingError ? (
              <HomeSection title={activityTitle}>
                <View style={styles.inset}>
                  <BandError
                    label="What people are playing could not load."
                    onRetry={() => activity.refetch()}
                  />
                </View>
              </HomeSection>
            ) : activityLogs.length > 0 ? (
              <HomeSection title={activityTitle}>
                <Arrive of={activity.data?.scope}>
                  <ActivityRail logs={activityLogs} inset={Spacing.x16} />
                </Arrive>
              </HomeSection>
            ) : null}

            {/*
             * The catalogue. Out now and coming next, as one timeline — two rails
             * with an inverted date predicate are one rail cut in half. The date
             * under each cover is what separates the halves, and is the one thing
             * here its box does not say.
             */}
            <HomeSection title="Releases" seeAll="/releases">
              {releases.isLoading || upcoming.isLoading ? (
                <CoverRailSkeleton foot={lineFoot} inset={Spacing.x16} />
              ) : releases.isLoadingError && upcoming.isLoadingError ? (
                <View style={styles.inset}>
                  <BandError
                    label="Releases could not load."
                    onRetry={() => {
                      releases.refetch();
                      upcoming.refetch();
                    }}
                  />
                </View>
              ) : (
                <Arrive>
                  <GameCoverRail
                    games={releaseRail}
                    inset={Spacing.x16}
                    lineOf={(game) => releaseLabel(game.releaseDate, game.releaseYear)}
                    labelOf={(game) =>
                      [game.title, releaseLabel(game.releaseDate, game.releaseYear)]
                        .filter(Boolean)
                        .join(', ')
                    }
                    parallax
                  />
                </Arrive>
              )}
            </HomeSection>

            {/* Band 4 — what happened. */}
            <HomeSection title="Latest news" seeAll="/news">
              <View style={styles.stack}>
                {news.isLoading ? (
                  Array.from({ length: NEWS_PREVIEW }).map((_, index) => (
                    <Skeleton key={index} width="100%" height={newsCardHeight(width)} />
                  ))
                ) : news.isLoadingError ? (
                  <BandError label="News could not load." onRetry={() => news.refetch()} />
                ) : (
                  (news.data ?? []).slice(0, NEWS_PREVIEW).map((article, index) => (
                    /* Staggered, so three cards of the same shape fill the
                       band from the top rather than appearing as one slab. */
                    <Arrive key={article.id} delay={stagger(index)}>
                      <ArticleCard article={article} />
                    </Arrive>
                  ))
                )}
              </View>
            </HomeSection>

            {/* Band 5 — the showcases that just happened, as stories. Absent when
            IGDB has none to give; a failure says so, as every band does. */}
            {latestEvents.isLoadingError ? (
              <HomeSection title="Latest events">
                <BandError label="Events could not load." onRetry={() => latestEvents.refetch()} />
              </HomeSection>
            ) : latestEvents.isPending || (latestEvents.data ?? []).length > 0 ? (
              <HomeSection title="Latest events">
                <View style={styles.stack}>
                  {latestEvents.isPending
                    ? Array.from({ length: LATEST_EVENTS }).map((_, index) => (
                        <Skeleton key={index} width="100%" height={newsCardHeight(width)} />
                      ))
                    : latestEvents.data!.map((event, index) => (
                        <Arrive key={event.id} delay={stagger(index)}>
                          <PastEventCard event={event} />
                        </Arrive>
                      ))}
                </View>
              </HomeSection>
            ) : null}
          </>
        )}

        {/* The reference's search screen's "Moods & Genres": each a block in
            its own hue with a game's cover tilted into the corner — under All
            and under every mood and genre. */}
        <MoodTiles onView={changeView} />

        <Link href="/(tabs)/search" asChild>
          <PressableScale
            accessibilityRole="link"
            accessibilityLabel="Search every game on IGDB"
            hitSlop={INLINE_LINK_SLOP}
            scaleTo={0.98}
            style={styles.footer}>
            <Text variant="bodySmall" style={{ color: theme.primaryText }}>
              Search every game on IGDB
            </Text>
            <Ionicons name="chevron-forward" size={14} color={theme.primaryText} />
          </PressableScale>
        </Link>
      </PageScrollView>
    </Screen>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * A release date as the line under a cover: "3 Oct", and the year with it when
 * that year is not this one. Read in UTC, as IGDB stores it — local time moves
 * every game west of Greenwich back a day.
 */
function releaseLabel(releaseDate: string | null, releaseYear: number | null): string | null {
  if (!releaseDate) return releaseYear === null ? null : String(releaseYear);

  const date = new Date(`${releaseDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return releaseYear === null ? null : String(releaseYear);

  const day = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
  return date.getUTCFullYear() === new Date().getUTCFullYear()
    ? day
    : `${day} ${date.getUTCFullYear()}`;
}

const styles = StyleSheet.create({
  /* `x32` (32) between bands — SimpMusic's interval between sections — against
     15 from a heading to its own rail.

     The page's only structural rhythm, and the reason a stack of unrelated
     sections still reads as one document rather than one long scroll. When the
     two gaps were close, the headings read as captions floating in a
     continuous column. The interval separating sections has to be unmistakably
     bigger than any interval inside one. */
  content: { paddingBottom: Spacing.x48, gap: Spacing.x32 },
  /* The first block keeps the page's rhythm inside it: the greeting and
     Surprise Me are thirty-two apart, as every band is — and so is the first
     band under the block, because the scroller's own content gap is the same
     thirty-two. */
  lead: { gap: Spacing.x32 },
  welcome: { paddingHorizontal: Spacing.x16, gap: Spacing.x8 },
  welcomeUser: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  /* Shrinks rather than pushing the row wide — a long display name truncates. */
  welcomeLink: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  welcomeName: { flex: 1 },
  /* `EmptyState` centres on `flex: 1`, which resolves to nothing inside a
     content-driven scroll container. The explicit height is what gives it space
     to centre in. */
  firstRun: { minHeight: 260, justifyContent: 'center' },
  stack: { paddingHorizontal: Spacing.x16, gap: Spacing.x12 },
  inset: { paddingHorizontal: Spacing.x16 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.x4,
    paddingHorizontal: Spacing.x16,
    paddingTop: Spacing.x8,
  },
});
