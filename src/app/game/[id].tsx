import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { useIsFocused, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  BackHandler,
  Pressable,
  ScrollView as RNScrollView,
  Share,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutRectangle,
  type ScrollView,
} from 'react-native';
import Animated, { LinearTransition, useReducedMotion } from 'react-native-reanimated';

import { CommunitySimilarRail, CommunitySimilarSheet } from '@/components/community-similar';
import { CoverFront } from '@/components/cover-front';
import { useCriticSummary } from '@/components/critic-reviews';
import { ExternalLink } from '@/components/external-link';
import { GameAwards } from '@/components/game-awards';
import { GameDetailsCard } from '@/components/game-details-card';
import { GameHeaderWords } from '@/components/game-header';
import { GameInformation } from '@/components/game-information';
import { GameAudienceCard } from '@/components/game-insights';
import { GameEditions, OriginalGame } from '@/components/game-lineage';
import { GameListsSheet } from '@/components/game-lists-sheet';
import { GameModeratorCard } from '@/components/game-moderation';
import { PlayedByFaces, RatingsAndReviews } from '@/components/game-overview';
import { GamePlatforms } from '@/components/game-platforms';
import { CoverRailSkeleton, GameCoverRail } from '@/components/game-rail';
import { GameReviewsSheet } from '@/components/game-reviews-sheet';
import { GameScreenshots } from '@/components/game-screenshots';
import { PING_GLYPH, usePingTo } from '@/components/pings/use-ping-to';
import { ProgressSheet } from '@/components/progress-sheet';
import { SoundtrackSummary } from '@/components/soundtrack-section';
import { SteamEvents } from '@/components/steam-events';
import { StorePrices } from '@/components/store-prices';
import { TrailerBackdrop } from '@/components/trailer-backdrop';
import { AnimatedCoverImage } from '@/components/ui/animated-cover-image';
import { Button } from '@/components/ui/button';
import { CardlessContext } from '@/components/ui/card-material';
import { AnchoredMenu, AnchoredMenuItem, useAnchoredMenu } from '@/components/ui/anchored-menu';
import { FrostedTopBar, TopBarDisc } from '@/components/ui/frosted-top-bar';
import { heroHeightFor } from '@/components/ui/hero-art';
import { InfoCard, InfoCardButton } from '@/components/ui/info-card';
import { PageScrollView } from '@/components/ui/page-scroll';
import { PinnedTabBar } from '@/components/ui/pinned-tab-bar';
import {
  HERO_ANIMATES,
  MASTHEAD_FADE,
  PageFill,
  PinnedHero,
  TRAILER_FADE,
} from '@/components/ui/pinned-hero';
import { RevealScope } from '@/components/ui/reveal';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Section, SectionInsetProvider } from '@/components/ui/section';
import { SlideUpSheet } from '@/components/ui/slide-up-sheet';
import { TabBar } from '@/components/ui/tab-bar';
import { Text } from '@/components/ui/text';
import { editionLabel } from '@/constants/game-editions';
import { GAME_HEADER, TITLELESS_WORDS_KNEE, coverHeight, wordsTop } from '@/constants/game-header';
import { copyStateLine, releaseLine } from '@/constants/physical';
import { hasCase, platformKeysFor, type PlatformKey } from '@/constants/platform-cases';
import { platformKeyForStored } from '@/constants/platform-family';
import { TOP_BAR_ROW, handoffBand, revealOffset } from '@/constants/top-bar';
import { Spacing, withAlpha } from '@/constants/theme';
import { AccentProvider, useGameAccent } from '@/hooks/use-accent';
import { useAnimatedCover } from '@/hooks/use-animated-cover';
import { useArtworkMesh } from '@/hooks/use-artwork-mesh';
import { useGameTitle } from '@/hooks/use-game-title';
import { useGameStorefronts } from '@/hooks/use-game-prices';
import { useGameTrailer, useTrailerSetting } from '@/hooks/use-game-trailer';
import { useHeaderHeight, useTopBarInset } from '@/hooks/use-header-height';
import { getAchievementsForGame, getCopies, getMyLog } from '@/lib/api';
import type { GameLog } from '@/lib/database.types';
import { skiaAnimates } from '@/lib/animated-cover';
import { BAND } from '@/lib/progressive-blur';
import { getGameById, getSimilarTo, parseGameId, type Game } from '@/lib/games';
import { getCollectionGames, getFranchiseGames, getGameExtras } from '@/lib/games/igdb';
import { formatReleaseDate } from '@/lib/games/release';
import { recallGame } from '@/lib/games/seen-games';
import { sharpCoverUrl } from '@/lib/games/sharp-cover';
import { smoothScrimStops } from '@/lib/scrim';
import { toast } from '@/lib/toast';
import { useAuth } from '@/store/auth';

type GameTab = 'overview' | 'soundtrack' | 'similar';

/** The three tabs, back (the owner's, 2026-11-03). */
const TABS = [
  { key: 'overview' as const, label: 'Overview' },
  { key: 'soundtrack' as const, label: 'Soundtrack' },
  { key: 'similar' as const, label: 'Similar' },
];

type HeaderMode = 'portrait' | 'landscape';

/*
 * How wide the Platforms section draws its box — the page's choice, not the
 * case's own geometry, which is protected and untouched by this number.
 */
const CASE_WIDTH_RATIO = 0.33;
const CASE_MAX_WIDTH = 200;

/** How far the words rise into the trailer's foot — its last few dp, where it fades. */
const TRAILER_OVERLAP = 16;

/** "At the top": within this of it, the cover can be brought to the front. */
const TOP_SLACK = 4;

/** Between two of the Overview's sections, Apple TV's page's. */
const SECTION_GAP = 34;

/**
 * The lip of the page's solid part: how tall the soft edge is where it meets
 * the art the words float on.
 */
const LIP = 40;
const LIP_STOPS = smoothScrimStops();
function lipColours(page: string) {
  return LIP_STOPS.alphas.map((alpha) => withAlpha(page, alpha)) as unknown as readonly [
    string,
    string,
    ...string[],
  ];
}

/** The sheets this page raises. */
type SheetName = 'reviews' | 'similar' | 'lists' | 'progress' | 'about';

/**
 * Which sheet is open, held outside React state so that opening one re-renders
 * the sheets and not the page they rise over.
 */
type SheetStore = {
  get: () => SheetName | null;
  set: (sheet: SheetName | null) => void;
  subscribe: (listener: () => void) => () => void;
};

function createSheetStore(): SheetStore {
  let open: SheetName | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => open,
    set: (sheet) => {
      open = sheet;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * A game's page.
 *
 * **The cover is pinned behind the page with everything it had** (the owner's,
 * 2026-11-03: "the apple music transition with the scroll blur needs to be in
 * the cover. The cover being pinned and everything we had before"):
 * `<PinnedHero>` with the box art in it — nearly still as the page slides
 * over, Convx's row-by-row blur climbing it, its mirrored tail and wash, and
 * the drain into the page's colour by the time the name is under the bar.
 * Moving, where it has an animated cover.
 *
 * **Apple TV's words lie on its foot** (`<GameHeaderWords>`): the name, the
 * genres, the white Log pill and ⋯, the synopsis with MORE, the facts, who
 * developed it — **the title standing exactly where the blur begins**
 * (`wordsTop`), and the blur reaching on under the words (the longer tail).
 *
 * **The trailer**: 4.5 seconds in, or from the play disc or its tile, the
 * pinned art fades, comes back as the landscape hero with the trailer behind
 * it — the page's old 38% hero — and the words rise to it; when the trailer
 * ends it fades back to the cover. **The trailer is never blurred**: a solid
 * fade into the page over its bottom part only (`TRAILER_FADE`, the owner's).
 *
 * **Three tabs** under the words — Overview, Soundtrack, Similar — and the
 * Overview in Apple TV's arrangement: trailers, events and platforms first,
 * then Ratings & Reviews (the score, its graph, a rail of reviews), the
 * people who played it as faces, and the rest without cards.
 */
export default function GameDetailScreen() {
  const router = useRouter();
  const { width, height: windowHeight } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuth((state) => state.session?.user.id);
  const focused = useIsFocused();
  const reduceMotion = useReducedMotion();
  const topInset = useTopBarInset();
  const headerHeight = useHeaderHeight();
  const scroller = useRef<ScrollView>(null);
  const [tab, setTab] = useState<GameTab>('overview');
  const [tabsY, setTabsY] = useState<number | null>(null);
  const [solidPartAt, setSolidPartAt] = useState<number | null>(null);

  const [sheets] = useState(createSheetStore);
  const openReviews = useCallback(() => sheets.set('reviews'), [sheets]);
  const openSimilar = useCallback(() => sheets.set('similar'), [sheets]);
  const openLists = useCallback(() => sheets.set('lists'), [sheets]);
  const openProgress = useCallback(() => sheets.set('progress'), [sheets]);
  const openAbout = useCallback(() => sheets.set('about'), [sheets]);

  const [platform, setPlatform] = useState<PlatformKey | null>(null);
  const caseWidth = Math.min(CASE_MAX_WIDTH, Math.round(width * CASE_WIDTH_RATIO));

  const game = useQuery({
    queryKey: ['game', id],
    queryFn: ({ signal }) => getGameById(id!, signal),
    enabled: !!id,
    staleTime: 30 * 60_000,
    initialData: () => recallGame(id)?.value,
    initialDataUpdatedAt: () => recallGame(id)?.at,
  });

  const myLog = useQuery({
    queryKey: ['my-log', userId, id],
    queryFn: () => getMyLog(userId!, id!),
    enabled: !!userId && !!id,
  });

  const similar = useQuery({
    queryKey: ['similar', id],
    queryFn: ({ signal }) => getSimilarTo(id!, signal),
    enabled: !!id && tab === 'similar',
    staleTime: 30 * 60_000,
  });

  const myCopies = useQuery({
    queryKey: ['copies', userId, id],
    queryFn: () => getCopies(userId!, id!),
    enabled: !!userId && !!id && !!game.data,
  });

  const achievements = useQuery({
    queryKey: ['game-achievements', id, userId],
    queryFn: () => getAchievementsForGame(id!, userId ?? null),
    enabled: !!id && tab === 'overview',
  });

  const parsedId = id ? parseGameId(id) : null;
  const igdbSourceId = parsedId?.source === 'igdb' ? parsedId.sourceId : null;

  const extras = useQuery({
    queryKey: ['game-extras', id],
    queryFn: ({ signal }) => getGameExtras(igdbSourceId!, signal),
    enabled: !!igdbSourceId && !!game.data,
    staleTime: 30 * 60_000,
  });

  const storefronts = useGameStorefronts(id ?? '');
  const pingTo = usePingTo();

  /* The Steam trailer, and the one switch for trailers playing by themselves. */
  const trailer = useGameTrailer(id ?? null);
  const trailers = useTrailerSetting();
  const trailerUrl = trailer?.url ?? null;

  /*
   * The header's shape — the cover, or the landscape hero with the trailer
   * behind it — changed under a fade: the pinned art fades out, the shape
   * swaps, the art fades back in. Every change goes through `changeMode`.
   */
  const [mode, setMode] = useState<HeaderMode>('portrait');
  const [swapping, setSwapping] = useState(false);
  const [autoplayed, setAutoplayed] = useState(false);
  /* The animated cover, by the bar's key — see `animatedCover` below. */
  const [coverMotion, setCoverMotion] = useState<'auto' | 'on' | 'off'>('auto');
  /* An animation Skia would not play in the hero: drawn over the art instead. */
  const [skiaRefused, setSkiaRefused] = useState<string | null>(null);
  const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const changeMode = useCallback((next: HeaderMode) => {
    if (swapTimer.current) clearTimeout(swapTimer.current);
    setSwapping(true);
    swapTimer.current = setTimeout(() => {
      swapTimer.current = null;
      setMode(next);
      setSwapping(false);
    }, GAME_HEADER.swapMs);
  }, []);
  useEffect(
    () => () => {
      if (swapTimer.current) clearTimeout(swapTimer.current);
    },
    []
  );
  const landscape = mode === 'landscape' && !!trailerUrl;

  const autoplay =
    coverMotion !== 'on' &&
    !!trailerUrl &&
    trailers.ready &&
    trailers.on &&
    !autoplayed &&
    mode === 'portrait' &&
    !reduceMotion &&
    focused;
  useEffect(() => {
    if (!autoplay) return;
    const timer = setTimeout(() => {
      setAutoplayed(true);
      changeMode('landscape');
    }, GAME_HEADER.autoplayMs);
    return () => clearTimeout(timer);
  }, [autoplay, changeMode]);

  const playTrailer = useCallback(() => {
    scroller.current?.scrollTo({ y: 0, animated: true });
    setAutoplayed(true);
    changeMode('landscape');
  }, [changeMode]);

  /*
   * The cover in front (the owner's, 2026-11-03: "the cover shouldn't zoom
   * in… the content below should fade out and the blur fades into screen
   * too, replacing the solid background. The user can't scroll"). Only from
   * the top of the page — `atTop` — where the whole cover is in view.
   */
  const [coverFront, setCoverFront] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const mesh = useArtworkMesh(game.data?.coverUrl ?? game.data?.heroUrl);
  /* Where the words' rows stand in them: the blur's band is set by them. */
  const [rows, setRows] = useState<{ genres?: number; keys?: number; about?: number }>({});
  const onRows = useCallback((row: 'genres' | 'keys' | 'about', y: number) => {
    setRows((was) => (was[row] === y ? was : { ...was, [row]: y }));
  }, []);
  /* Android's back puts the page back first. A listener, not a state sync. */
  useEffect(() => {
    if (!coverFront) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setCoverFront(false);
      return true;
    });
    return () => sub.remove();
  }, [coverFront]);

  /*
   * The cover moving, over the pinned still — while the header is the cover.
   * By itself where Settings → Animated artwork is on; and from the bar's key
   * on any game, whatever the setting (the owner's, 2026-11-03: "the animated
   * artwork can be played in the game page without zooming in"). `on` asks
   * for it by hand; `off` is the key pressed again, the still back.
   */
  /* Settings → Game title: the name at the head of the page and in the bar. */
  const gameTitle = useGameTitle();
  const animatedCover = useAnimatedCover({
    gameId: id,
    title: game.data?.title,
    aspect: 'portrait',
    enabled: mode === 'portrait' && coverMotion !== 'off',
    explicit: coverMotion === 'on',
  });

  /* Asked for by hand and none there: say so (a toast is not state). */
  const motionAnswer = coverMotion === 'on' ? animatedCover.status : null;
  useEffect(() => {
    if (motionAnswer === 'not_found') toast.info('This game has no animated cover');
    if (motionAnswer === 'unavailable') toast.error('Could not look for an animated cover');
  }, [motionAnswer]);

  const collectionId = extras.data?.collection?.id ?? null;
  const franchiseId = extras.data?.franchises[0]?.id ?? null;

  const franchiseGames = useQuery({
    queryKey: ['franchise-games', collectionId, franchiseId],
    queryFn: ({ signal }) =>
      collectionId
        ? getCollectionGames(collectionId, signal)
        : getFranchiseGames(franchiseId!, signal),
    enabled: !game.data?.edition && (collectionId !== null || franchiseId !== null),
    staleTime: 30 * 60_000,
  });

  /*
   * The game's colours, Material 3, seeded by the cover — the art the page
   * opens on and drains into now. With game colours off, the grey room.
   */
  const accent = useGameAccent(game.data?.coverUrl ?? game.data?.heroUrl, game.data?.genres);
  const page = accent.page;

  /*
   * The geometry: the art's height for the shape in force, the words placed
   * so the Log pill stands where its blur begins, and where the name leaves
   * for the bar — which is also where the art is solid page colour.
   */
  /* The cover at its own shape: IGDB's numbers, else the file's as it loads. */
  const [measured, setMeasured] = useState<{ id: string; aspect: number } | null>(null);
  const coverAspect =
    game.data?.coverAspect ?? (measured && measured.id === id ? measured.aspect : null);
  const artHeight = landscape
    ? heroHeightFor(width, windowHeight)
    : coverHeight(width, coverAspect);
  const [titleBox, setTitleBox] = useState<LayoutRectangle | null>(null);
  /* With the trailer playing the words start under the video, on its
     faded foot, not over it (the owner's, 2026-11-04: "the fade effects get
     in the way of the trailer… you can barely see it"). */
  const contentTop = landscape
    ? Math.round(artHeight - TRAILER_OVERLAP)
    : wordsTop(
        artHeight,
        titleBox?.y ?? 0,
        topInset + TOP_BAR_ROW,
        gameTitle.shown ? undefined : TITLELESS_WORDS_KNEE
      );
  const titleTop = contentTop + (titleBox?.y ?? 0);
  const titleFoot = titleTop + (titleBox?.height ?? 36);
  const handoff = handoffBand(titleTop, titleFoot, topInset + TOP_BAR_ROW);
  const solidAt = Math.max(1, revealOffset(titleFoot, topInset + TOP_BAR_ROW));
  /*
   * The band, in dp from the top of the display at rest: the blur from a
   * little above the first words — the title, or with it off the genres — to
   * where the page is solid: the Log pill's row (its own top margin in), or
   * with the title off the synopsis. Estimated until the rows are measured.
   */
  const KEYS_MARGIN = 12;
  const bandStart = (gameTitle.shown ? titleTop : contentTop + (rows.genres ?? 0)) - BAND.lead;
  const bandEnd = gameTitle.shown
    ? rows.keys !== undefined
      ? contentTop + rows.keys + KEYS_MARGIN
      : titleFoot + 40
    : rows.about !== undefined
      ? contentTop + rows.about
      : rows.keys !== undefined
        ? contentTop + rows.keys + 70
        : contentTop + 120;
  const blurBand = { from: bandStart, to: Math.max(bandStart + 40, bandEnd) };
  const tabsAt = solidPartAt !== null && tabsY !== null ? solidPartAt + tabsY : null;

  const availablePlatforms = platformKeysFor(game.data?.platforms);
  const playedOn = platformKeyForStored(myLog.data?.played_on);
  const defaultPlatform: PlatformKey | undefined =
    (playedOn && availablePlatforms.includes(playedOn) ? playedOn : undefined) ??
    availablePlatforms.find(hasCase) ??
    availablePlatforms[0];
  const activePlatform =
    platform && availablePlatforms.includes(platform) ? platform : defaultPlatform;

  if (game.isLoading) {
    return (
      <Screen edges={['top', 'bottom']} topBar={<FrostedTopBar back glass />}>
        <LoadingState />
      </Screen>
    );
  }

  if (game.isLoadingError) {
    return (
      <Screen edges={['top', 'bottom']} topBar={<FrostedTopBar back glass />}>
        <ErrorState
          error={game.error}
          action={<Button title="Retry" variant="secondary" onPress={() => game.refetch()} />}
        />
      </Screen>
    );
  }

  if (!game.data) {
    return (
      <Screen edges={['top', 'bottom']} topBar={<FrostedTopBar back glass />}>
        <EmptyState icon="search" title="Game not found" />
      </Screen>
    );
  }

  const data = game.data;
  const logged = myLog.data ?? null;
  const steamAppId = storefronts.steamAppId ?? data.steamAppId ?? null;
  const unlockedCount = (achievements.data ?? []).filter((entry) => entry.unlocked_at).length;
  const achievementTotal = achievements.data?.length ?? 0;
  const copies = myCopies.data ?? [];
  const coverUrl = sharpCoverUrl(data.coverUrl) ?? data.heroUrl;
  const screenshots = data.screenshots.slice(0, 10).map((url, index, shown) => ({
    url,
    label: `Screenshot ${index + 1} of ${shown.length} from ${data.title}`,
  }));
  const genresLine = [data.edition ? editionLabel(data.edition) : null, ...data.genres].filter(
    (entry): entry is string => !!entry
  );
  const animated =
    animatedCover.status === 'found' &&
    animatedCover.animatedUrl &&
    !landscape &&
    focused &&
    coverMotion !== 'off'
      ? animatedCover
      : null;

  /** The bar's key: the cover moving in place, or still again. */
  const toggleCoverMotion = () => {
    if (animated) {
      setCoverMotion('off');
      return;
    }
    if (landscape) changeMode('portrait');
    setAutoplayed(true);
    setCoverMotion('on');
    if (animatedCover.status === 'unavailable') {
      animatedCover.retry();
      toast('Looking for an animated cover…');
    } else if (animatedCover.status === 'not_found' && coverMotion === 'on') {
      toast.info('This game has no animated cover');
    } else if (animatedCover.status !== 'found' && animatedCover.status !== 'not_found') {
      toast('Looking for an animated cover…');
    }
  };

  /** The cover full size, from where it stands at the top of the display. */
  const openCover = () => {
    if (atTop && !landscape) setCoverFront(true);
  };
  /*
   * Played in the hero's one blur where Skia can draw it — an animated WebP
   * or GIF, or a video — so the blur moves with it, at rest and as the page
   * scrolls. An APNG, or a file Skia would not open, is played over the art
   * instead (expo-image, expo-video), with the still's blur under it.
   */
  const heroAnimation =
    animated &&
    HERO_ANIMATES &&
    skiaAnimates(animated.animatedUrl) &&
    animated.animatedUrl !== skiaRefused
      ? animated.animatedUrl
      : null;

  function renderTab() {
    switch (tab) {
      case 'soundtrack':
        return (
          <View style={styles.tabBody}>
            <SoundtrackSummary gameId={data.id} title={data.title} developer={data.developer} />
          </View>
        );

      case 'similar':
        /* Two rails of covers (the Apple pass, 2026-11-05): what people here
           say is like it, then IGDB's list. */
        return (
          <SectionInsetProvider inset={Spacing.x16}>
            <View style={styles.similarTab}>
              <CommunitySimilarRail gameId={data.id} gameTitle={data.title} onOpen={openSimilar} />
              <Section title="Similar, according to IGDB">
                {similar.isLoading ? (
                  <CoverRailSkeleton />
                ) : similar.isLoadingError ? (
                  <ErrorState
                    error={similar.error}
                    action={
                      <Button title="Retry" variant="secondary" onPress={() => similar.refetch()} />
                    }
                  />
                ) : (similar.data ?? []).length === 0 ? (
                  <Text variant="body" color="textSecondary" style={styles.similarNote}>
                    {data.source === 'igdb'
                      ? 'IGDB has no similar games listed for this title.'
                      : 'IGDB’s list is only available for IGDB titles. Try opening this game from a search result instead.'}
                  </Text>
                ) : (
                  <GameCoverRail games={similar.data ?? []} />
                )}
              </Section>
            </View>
          </SectionInsetProvider>
        );

      default:
        /*
          Apple TV's page: no cards (`CardlessContext`), bold headings with a
          chevron where they lead on. First, at the owner's word: what it
          looks like and what it is, then what is new with it, what it is on.
        */
        return (
          <CardlessContext.Provider value>
            <SectionInsetProvider inset={Spacing.x16}>
              <View style={styles.overview}>
                <GameScreenshots
                  shots={screenshots}
                  trailer={extras.data?.trailer ?? null}
                  headerTrailer={
                    trailerUrl
                      ? {
                          art: data.heroUrl,
                          name: trailer?.name || `${data.title} trailer`,
                          onPlay: playTrailer,
                        }
                      : null
                  }
                />
                {/* What it is, under what it looks like (the owner's, 2026-11-03). */}
                <GameInformation
                  title={data.title}
                  genres={genresLine}
                  description={data.description}
                />
                <GameDetailsCard
                  gameId={data.id}
                  title={data.title}
                  year={data.releaseYear}
                  released={data.releaseDate ? formatReleaseDate(data.releaseDate) : null}
                />
                <SteamEvents appId={steamAppId} title={data.title} />
                {activePlatform && (
                  <GamePlatforms
                    game={data}
                    log={logged}
                    platforms={availablePlatforms}
                    selected={activePlatform}
                    onSelect={setPlatform}
                    artWidth={caseWidth}
                  />
                )}

                {/* What the people here made of it, in Apple's own layouts. */}
                <RatingsAndReviews gameId={data.id} title={data.title} onOpen={openReviews} />
                <PlayedByFaces gameId={data.id} />
                <GameAudienceCard gameId={data.id} title={data.title} />

                <StorePrices gameId={data.id} title={data.title} />
                {copies.length > 0 && userId && (
                  <InfoCardButton
                    title={copies.length === 1 ? 'Your copy' : 'Your copies'}
                    accessibilityLabel={
                      copies.length === 1
                        ? `Your copy: ${releaseLine(copies[0]) || 'release not recorded'}. Open it.`
                        : `You own ${copies.length} copies. Open them.`
                    }
                    onPress={() =>
                      copies.length === 1
                        ? router.push({ pathname: '/copy/[id]', params: { id: copies[0].id } })
                        : router.push({
                            pathname: '/copies/[user]',
                            params: { user: userId, game: data.id },
                          })
                    }>
                    <View style={styles.lines}>
                      <Text variant="h4">{releaseLine(copies[0]) || 'Release not recorded'}</Text>
                      {copyStateLine(copies[0]) && (
                        <Text variant="body" color="textSecondary">
                          {copyStateLine(copies[0])}
                        </Text>
                      )}
                      {copies.length > 1 && (
                        <Text variant="caption" color="textMuted">
                          {`and ${copies.length - 1} more`}
                        </Text>
                      )}
                    </View>
                  </InfoCardButton>
                )}
                <GameAwards appId={steamAppId} title={data.title} />

                {achievements.isLoadingError ? (
                  <InfoCard title="Achievements">
                    <View style={styles.retry}>
                      <Text variant="body" color="textSecondary">
                        Achievements couldn’t be loaded.
                      </Text>
                      <Button
                        title="Try again"
                        size="small"
                        variant="secondary"
                        loading={achievements.isFetching}
                        onPress={() => void achievements.refetch()}
                      />
                    </View>
                  </InfoCard>
                ) : (
                  achievementTotal > 0 && (
                    <InfoCardButton
                      title="Achievements"
                      accessibilityLabel={`All ${achievementTotal} achievements`}
                      onPress={() =>
                        router.push({ pathname: '/achievements/[id]', params: { id: data.id } })
                      }>
                      <Text variant="body" color="textSecondary">
                        <Text variant="h4">
                          {unlockedCount}/{achievementTotal}
                        </Text>
                        {' unlocked'}
                      </Text>
                    </InfoCardButton>
                  )
                )}

                {data.edition && data.parentId ? (
                  <OriginalGame parentId={data.parentId} edition={data.edition} />
                ) : (
                  <GameEditions gameId={data.id} />
                )}
                {!data.edition && franchiseGames.data && franchiseGames.data.length > 1 && (
                  <Section title={extras.data?.collection?.name ?? 'Franchise'}>
                    <GameCoverRail
                      games={franchiseGames.data.filter((entry) => entry.id !== data.id)}
                      inset={Spacing.x16}
                    />
                  </Section>
                )}

                <GameModeratorCard game={data} />

                {data.storeUrl && (
                  <View style={styles.storeLink}>
                    <ExternalLink
                      href={data.storeUrl as Href & string}
                      label={`Open ${data.title} on ${data.source === 'steam' ? 'Steam' : data.source.toUpperCase()}`}>
                      <Text variant="h5" style={{ color: accent.onSurface }}>
                        Open on {data.source === 'steam' ? 'Steam' : data.source.toUpperCase()}
                      </Text>
                    </ExternalLink>
                  </View>
                )}
              </View>
            </SectionInsetProvider>
          </CardlessContext.Provider>
        );
    }
  }

  return (
    <AccentProvider artwork={data.coverUrl ?? data.heroUrl} genres={data.genres}>
      <>
        <Screen
          edges={[]}
          background={page}
          /* Behind the page, outside its inset: the page's colour, then the
             cover pinned at the top of the display. */
          backdrop={
            <>
              <PageFill color={page} />
              <PinnedHero
                key={landscape ? 'landscape' : 'portrait'}
                uri={landscape ? data.heroUrl : coverUrl}
                steamAppId={landscape ? data.steamAppId : null}
                height={artHeight}
                page={page}
                fade={landscape ? TRAILER_FADE : MASTHEAD_FADE}
                /* The trailer is drawn sharp, its foot fading into the page;
                   the cover keeps Convx's blur and its mirrored tail. */
                tail={!landscape}
                blur={!landscape}
                animation={landscape ? null : heroAnimation}
                onAnimationFail={() => setSkiaRefused(animated?.animatedUrl ?? null)}
                /* The blur as a band under the words (the owner's reference,
                   2026-11-04): from just above the title — or the genres,
                   with the title off — to the Log pill's row, or the
                   synopsis, where the page is its own colour. */
                band={landscape ? null : blurBand}
                /* The cover in front: its blur eases down to its edge. */
                lowered={coverFront}
                onLoad={
                  landscape || data.coverAspect
                    ? undefined
                    : ({ width: w, height: h }) => {
                        if (w > 0 && h > 0) setMeasured({ id: data.id, aspect: h / w });
                      }
                }
                solidAt={solidAt}
                /* Only the status bar's band darkened over the trailer. */
                scrim={landscape ? 0.18 : 0.4}
                ready={!swapping}
                media={(art) =>
                  landscape ? (
                    <TrailerBackdrop
                      url={trailerUrl}
                      height={artHeight}
                      until={solidAt}
                      loop={false}
                      onEnd={() => changeMode('portrait')}>
                      {art}
                    </TrailerBackdrop>
                  ) : (
                    <>
                      {art}
                      {animated && !heroAnimation && (
                        <AnimatedCoverImage
                          staticUrl={null}
                          animatedUrl={animated.animatedUrl}
                          format={animated.format}
                          status={animated.status}
                          aspect="portrait"
                          backdrop="transparent"
                          style={StyleSheet.absoluteFill}
                          onFailed={animated.reportFailure}
                        />
                      )}
                    </>
                  )
                }
              />
              {/* The cover in front: SimpMusic's blur of it in place of the
                  solid page, as it was. */}
              <CoverFront shown={coverFront} mesh={mesh} coverHeight={artHeight} page={page} />
            </>
          }
          topBar={
            /* The bar's keys leave with the words while the cover is in
               front, and come back with them; a tap or back returns. */
            <Animated.View
              pointerEvents={coverFront ? 'none' : 'box-none'}
              style={[
                StyleSheet.absoluteFill,
                {
                  opacity: coverFront ? 0 : 1,
                  transitionProperty: 'opacity',
                  transitionDuration: 360,
                },
              ]}>
              <FrostedTopBar
                back
                glass
                title={gameTitle.shown ? data.title : undefined}
                header={titleFoot}
                handoff={handoff}
                right={
                  <>
                    {/* Two keys at most (the Apple pass, 2026-11-05): ⋯ holds
                        the animated cover, the trailer and Ping; share stands
                        alone. They were four discs in the capsule. */}
                    <GameMoreKey
                      items={[
                        ...(!reduceMotion
                          ? [
                              {
                                icon: animated ? ('pause' as const) : ('sparkles-outline' as const),
                                title: animated
                                  ? 'Stop the animated cover'
                                  : 'Play the animated cover',
                                onPress: toggleCoverMotion,
                              },
                            ]
                          : []),
                        ...(trailerUrl
                          ? [
                              {
                                icon: landscape ? ('stop' as const) : ('play' as const),
                                title: landscape ? 'Stop the trailer' : 'Play the trailer',
                                onPress: () => {
                                  if (landscape) {
                                    trailers.setOn(false);
                                    changeMode('portrait');
                                  } else {
                                    trailers.setOn(true);
                                    playTrailer();
                                  }
                                },
                              },
                            ]
                          : []),
                        ...(pingTo
                          ? [
                              {
                                icon: PING_GLYPH,
                                title: 'Ping to someone',
                                onPress: () =>
                                  pingTo({
                                    kind: 'game',
                                    targetId: data.id,
                                    title: data.title,
                                    subtitle: [data.developer, data.releaseYear]
                                      .filter(Boolean)
                                      .join(' · '),
                                    imageUrl: data.coverUrl,
                                  }),
                              },
                            ]
                          : []),
                      ]}
                    />
                    <TopBarDisc
                      icon="share-outline"
                      label={`Share ${data.title}`}
                      onPress={() => shareGame(data)}
                    />
                  </>
                }
              />
            </Animated.View>
          }>
          <PageScrollView
            ref={scroller}
            settle={handoff}
            showsVerticalScrollIndicator={false}
            /* Still while the cover is in front. */
            scrollEnabled={!coverFront}
            onScroll={(event) => {
              const top = event.nativeEvent.contentOffset.y <= TOP_SLACK;
              if (top !== atTop) setAtTop(top);
            }}
            contentContainerStyle={styles.content}>
            {/* The page's words and all under them, fading out while the
                cover is in front, and back. */}
            <Animated.View
              pointerEvents={coverFront ? 'none' : 'auto'}
              style={{
                opacity: coverFront ? 0 : 1,
                transitionProperty: 'opacity',
                transitionDuration: 360,
              }}>
              {/*
              The masthead: transparent, so the pinned cover shows through,
              with the words on its foot. The room above the words is the
              art's own door — the cover full size.
            */}
              <View>
                <View pointerEvents="none" style={styles.lip}>
                  <LinearGradient
                    colors={lipColours(page)}
                    locations={
                      LIP_STOPS.locations as unknown as readonly [number, number, ...number[]]
                    }
                    style={styles.fill}
                  />
                </View>
                <Animated.View
                  layout={reduceMotion ? undefined : LinearTransition.duration(GAME_HEADER.swapMs)}
                  style={{ height: contentTop }}>
                  <Pressable
                    style={styles.fill}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={`${data.title}, cover art`}
                    accessibilityHint="Brings the cover to the front"
                    onPress={openCover}
                  />
                </Animated.View>
                <Animated.View
                  layout={reduceMotion ? undefined : LinearTransition.duration(GAME_HEADER.swapMs)}
                  style={styles.words}>
                  <GameHeaderWords
                    game={data}
                    log={logged}
                    companies={extras.data?.companies ?? []}
                    band={handoff}
                    onTitleBox={setTitleBox}
                    onRows={onRows}
                    showTitle={gameTitle.shown}
                    onOpenProgress={openProgress}
                    onOpenLists={openLists}
                    onReadMore={openAbout}
                  />
                </Animated.View>
              </View>

              {/* The page's solid part: the tabs and what they hold, opaque,
                rising over the pinned cover. */}
              <View
                onLayout={(event) => setSolidPartAt(event.nativeEvent.layout.y)}
                style={{ backgroundColor: page }}>
                <View onLayout={(event) => setTabsY(event.nativeEvent.layout.y)}>
                  <TabBar tabs={TABS} value={tab} onChange={setTab} align="spread" />
                </View>
                <RevealScope>{renderTab()}</RevealScope>
              </View>
            </Animated.View>
          </PageScrollView>
          {/* With the cover in front, a tap anywhere — or back — puts the
              page back. */}
          {coverFront && (
            <Pressable
              style={styles.fill}
              accessibilityRole="button"
              accessibilityLabel={`${data.title}, cover. Tap to return to the page.`}
              onPress={() => setCoverFront(false)}
            />
          )}
          <PinnedTabBar
            at={coverFront ? null : tabsAt}
            background={page}
            tabs={TABS}
            value={tab}
            onChange={(next) => {
              setTab(next);
              if (tabsAt !== null)
                scroller.current?.scrollTo({ y: tabsAt - headerHeight, animated: false });
            }}
            align="spread"
          />
        </Screen>

        <GameSheets store={sheets} game={data} log={logged} />
      </>
    </AccentProvider>
  );
}

/**
 * The sheets this page raises — subscribed to the page's store, so opening
 * one re-renders this and not the page under it.
 */
function GameSheets({ store, game, log }: { store: SheetStore; game: Game; log: GameLog | null }) {
  const router = useRouter();
  const open = useSyncExternalStore(store.subscribe, store.get);
  const close = useCallback(() => store.set(null), [store]);

  useCriticSummary({ gameId: game.id, title: game.title, releaseYear: game.releaseYear });

  return (
    <>
      <SlideUpSheet visible={open === 'reviews'} onClose={close} title={game.title}>
        <GameReviewsSheet
          gameId={game.id}
          gameTitle={game.title}
          releaseYear={game.releaseYear}
          criticScore={game.score}
        />
      </SlideUpSheet>

      <SlideUpSheet visible={open === 'similar'} onClose={close} title={game.title}>
        <CommunitySimilarSheet gameId={game.id} gameTitle={game.title} />
      </SlideUpSheet>

      <SlideUpSheet visible={open === 'lists'} onClose={close} title="In collections">
        <GameListsSheet gameId={game.id} gameTitle={game.title} />
      </SlideUpSheet>

      {/* The synopsis whole — the header's MORE. */}
      <SlideUpSheet
        visible={open === 'about'}
        onClose={close}
        title={game.title}
        maxHeightRatio={0.7}>
        <RNScrollView contentContainerStyle={styles.about}>
          <Text variant="prose" color="textSecondary">
            {game.description}
          </Text>
        </RNScrollView>
      </SlideUpSheet>

      <SlideUpSheet
        visible={open === 'progress'}
        onClose={close}
        title="Your progress"
        maxHeightRatio={0.85}>
        <ProgressSheet
          game={game}
          log={log}
          onClose={close}
          onOpenPlaythroughs={() => {
            close();
            router.push({ pathname: '/playthroughs/[game]', params: { game: game.id } });
          }}
        />
      </SlideUpSheet>
    </>
  );
}

/** The OS share sheet for a game: its name, its year, and a link into the app. */
function shareGame(game: Game) {
  const year = game.releaseDate ? ` (${new Date(game.releaseDate).getUTCFullYear()})` : '';
  const url = Linking.createURL(`/game/${game.id}`);
  Share.share({ message: `${game.title}${year} on Pinged\n${url}` }).catch(() => undefined);
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.x48 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  lip: { position: 'absolute', left: 0, right: 0, bottom: 0, height: LIP },
  words: { paddingBottom: Spacing.x24 },
  overview: { gap: SECTION_GAP, paddingTop: Spacing.x16, paddingBottom: Spacing.x16 },
  tabBody: { padding: Spacing.x16, gap: Spacing.x16 },
  similarTab: { gap: Spacing.x32, paddingTop: Spacing.x16, paddingBottom: Spacing.x24 },
  similarNote: { paddingHorizontal: Spacing.x16 },
  retry: { gap: Spacing.x12, alignItems: 'flex-start' },
  lines: { gap: 2 },
  storeLink: { paddingHorizontal: Spacing.x16 },
  about: { paddingHorizontal: Spacing.x16, paddingBottom: Spacing.x32 },
});

/** The ⋯ in a game page's bar: the actions that are not Share, as a menu. */
function GameMoreKey({
  items,
}: {
  items: {
    icon: React.ComponentProps<typeof TopBarDisc>['icon'];
    title: string;
    onPress: () => void;
  }[];
}) {
  const [trigger, menu] = useAnchoredMenu();
  if (items.length === 0) return null;
  return (
    <>
      <View ref={trigger} collapsable={false}>
        <TopBarDisc icon="ellipsis-horizontal" label="More" onPress={menu.open} />
      </View>
      <AnchoredMenu menu={menu} label="More" align="end">
        {items.map((item) => (
          <AnchoredMenuItem
            key={item.title}
            icon={item.icon}
            title={item.title}
            onPress={() => {
              menu.close();
              item.onPress();
            }}
          />
        ))}
      </AnchoredMenu>
    </>
  );
}
