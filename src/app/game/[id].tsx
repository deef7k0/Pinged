import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { Link, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { memo, useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { Share, StyleSheet, View, useWindowDimensions, type ScrollView } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { ExternalLink } from '@/components/external-link';
import { GameActions, formatReleaseDate } from '@/components/game-actions';
import { GameDetailsCard } from '@/components/game-details-card';
import { GameAwards } from '@/components/game-awards';
import { GameAudienceCard, PlayedBy, RatingsCard, TopReview } from '@/components/game-insights';
import { GameScreenshots } from '@/components/game-screenshots';
import { GameEditions, OriginalGame } from '@/components/game-lineage';
import { GameListItem } from '@/components/game-list-item';
import { GameListsSheet } from '@/components/game-lists-sheet';
import { GameModeratorCard } from '@/components/game-moderation';
import { GamePlatforms } from '@/components/game-platforms';
import { GameCoverRail } from '@/components/game-rail';
import { CommunitySimilarCard, CommunitySimilarSheet } from '@/components/community-similar';
import { CoverViewer, type CoverOrigin } from '@/components/cover-viewer';
import { GameStatsStrip } from '@/components/game-stats-strip';
import { ProgressSheet } from '@/components/progress-sheet';
import { SoundtrackSummary } from '@/components/soundtrack-section';
import { SteamEvents } from '@/components/steam-events';
import { StorePrices } from '@/components/store-prices';
import { useCriticSummary } from '@/components/critic-reviews';
import { GameReviewsSheet } from '@/components/game-reviews-sheet';
import { SlideUpSheet } from '@/components/ui/slide-up-sheet';
import { Button } from '@/components/ui/button';
import { CARD_INSET, cardMaterialFor, cardShape } from '@/components/ui/card-material';
import { CoverHalo } from '@/components/ui/cover-halo';
import { TrailerBackdrop } from '@/components/trailer-backdrop';
import { FrostedTopBar, TopBarDisc } from '@/components/ui/frosted-top-bar';
import { heroHeightFor } from '@/components/ui/hero-art';
import { HandoffTitle } from '@/components/ui/handoff-title';
import { MASTHEAD_FADE, PageFill, PinnedHero } from '@/components/ui/pinned-hero';
import { RevealScope } from '@/components/ui/reveal';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScorePill } from '@/components/ui/score';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { ExpandableText } from '@/components/ui/expandable-text';
import { InfoCard, InfoCardButton } from '@/components/ui/info-card';
import { PageScrollView } from '@/components/ui/page-scroll';
import { PinnedTabBar } from '@/components/ui/pinned-tab-bar';
import { Section, SectionInsetProvider, useSectionMetrics } from '@/components/ui/section';
import { TabBar } from '@/components/ui/tab-bar';
import { Text } from '@/components/ui/text';
import { editionLabel } from '@/constants/game-editions';
import {
  ABOUT_FADE,
  ABOUT_LINES,
  COVER_GUTTER,
  mastheadCoverWidth,
  mastheadOverlap,
} from '@/constants/game-masthead';
import { copyStateLine, releaseLine } from '@/constants/physical';
import { labelFor, scoreColor } from '@/constants/score';
import { hasCase, platformKeysFor, type PlatformKey } from '@/constants/platform-cases';
import { platformKeyForStored } from '@/constants/platform-family';
import { TOP_BAR_ROW, handoffBand, revealOffset } from '@/constants/top-bar';
import { FontFamily, PosterAspectRatio, Spacing, withAlpha } from '@/constants/theme';
import { AccentProvider, useGameAccent } from '@/hooks/use-accent';
import { useLandingArrival } from '@/hooks/use-arrival';
import { useHeaderHeight, useTopBarInset } from '@/hooks/use-header-height';
import { useGameStorefronts } from '@/hooks/use-game-prices';
import { useGameTrailer, useTrailerSetting } from '@/hooks/use-game-trailer';
import { useTheme } from '@/hooks/use-theme';
import { smoothScrimStops } from '@/lib/scrim';
import { getAchievementsForGame, getCopies, getMyLog, getRatingBreakdown } from '@/lib/api';
import type { GameLog } from '@/lib/database.types';
import { getGameById, getSimilarTo, parseGameId, type Game } from '@/lib/games';
import { recallGame } from '@/lib/games/seen-games';
import { hasWriting } from '@/lib/review-quote';
import {
  getCollectionGames,
  getFranchiseGames,
  getGameExtras,
  type GameCompany,
} from '@/lib/games/igdb';
import { useAuth } from '@/store/auth';

type GameTab = 'overview' | 'soundtrack' | 'similar';

/**
 * Three tabs, down from four.
 *
 * **Reviews left, and did not move to another tab — it became a sheet.** The
 * writing about a game was behind a control that also switched between a
 * synopsis and a rail of similar games, which put the one thing people come back
 * for at the same level as a marketing blurb. It opens over the page now, from
 * the card in Overview.
 */
const TABS = [
  { key: 'overview' as const, label: 'Overview' },
  { key: 'soundtrack' as const, label: 'Soundtrack' },
  { key: 'similar' as const, label: 'Similar' },
];

/*
 * How wide the Platforms section draws its box, and the ceiling on a wide
 * display.
 *
 * A third of the display. It was the masthead's cover too, until the masthead
 * took the reference's smaller one (`mastheadCoverWidth`, 100dp on a 360dp
 * phone). The box in Platforms kept its size: it is the case — the object this
 * page exists to show — and nothing about it was asked to change.
 *
 * These are the *page's* choice of how wide to draw the case, not the case's own
 * geometry: `<GameCase>` takes a width and its internal proportions, materials,
 * type and shadow are untouched by this number.
 */
const CASE_WIDTH_RATIO = 0.33;
const CASE_MAX_WIDTH = 200;

/**
 * Lifts "See your full review" to the platform floor.
 *
 * A 16px glyph beside one line of `bodySmall` is about 18dp, against 44 (iOS)
 * and 48 (Android). Slop rather than padding, so the sentence above it keeps
 * its spacing and the block does not grow a band of dead space.
 */
const REVIEW_LINK_SLOP = { top: 15, bottom: 15, left: 8, right: 8 };

/**
 * The lip of the page's solid part: how tall the soft edge is where it meets
 * the art the masthead floats on — under the synopsis's last line, which
 * fades into the page by its own veil, and the gap after it.
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

/**
 * How far a company's name in the header can be touched past its own line.
 *
 * The lines are four apart, so two links next to each other take two each and
 * their targets meet without overlapping. The first reaches up over the date,
 * which is not pressable, and the last down into the space under the block —
 * as far toward the tap floor as a stack of 19dp lines allows.
 */
const COMPANY_SLOP = { top: 2, bottom: 2, left: 8, right: 8 };

/**
 * Where the lines under the name start in the billing, before they are
 * measured: its twelve of padding, one 27dp line of name, and the twenty under
 * it (`styles.billing`, `billingTitle`, `billingLines`).
 */
const BILLING_LINES_ESTIMATE = Spacing.x12 + 27 + Spacing.x20;
/** One line of the name (`styles.billingTitle`), until it is measured. */
const BILLING_TITLE_LINE = 27;
const COMPANY_SLOP_FIRST = { ...COMPANY_SLOP, top: 12 };
const COMPANY_SLOP_LAST = { ...COMPANY_SLOP, bottom: 12 };

/**
 * The masthead's cover: the game's box art, landing as the page opens.
 *
 * A `<Poster>` — box art at its own 4dp corner, wearing the cover's edge — and
 * no longer the case feature's framed cover, which is what this slot drew
 * through `<GameCaseFlip>` while it stood in for a case with nothing to turn.
 * That one has a 12dp corner and a frame of its own, both protected; the owner
 * asked for the reference poster's corner and outline here, so the slot changed
 * hands and the protected components were left exactly as they are. They still
 * draw the box in Platforms.
 *
 * **It lands as it always has**: raised, a little small and turned, settling on
 * the arrival spring, with the action row following it in. The pose is
 * `<GameCaseFlip>`'s, term for term, so the masthead's one authored moment did
 * not change when the object under it did. `landed` adds the resting pose as a
 * plain style once the spring is over — see `useLandingArrival` for what is lost
 * without it.
 *
 * Memoised: its props are the game's own fields, so a query landing for another
 * section, or the synopsis opening, re-renders neither the cover nor its
 * animated transform.
 */
const MastheadCover = memo(function MastheadCover({
  coverUrl,
  heroUrl,
  title,
  width,
}: {
  coverUrl?: string | null;
  heroUrl?: string | null;
  title: string;
  width: number;
}) {
  const { progress, landed } = useLandingArrival();

  const pose = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { translateY: interpolate(progress.get(), [0, 1], [-14, 0]) },
      { scale: interpolate(progress.get(), [0, 1], [0.92, 1]) },
      { rotateY: `${interpolate(progress.get(), [0, 1], [14, 0])}deg` },
    ],
  }));

  return (
    <Animated.View style={[pose, landed && styles.coverLanded]}>
      {/* No `gameId` and no `edition`: the Must Play mark is a cell of the
          strip under this row, and the edition word is printed on the case in
          Platforms. This is the cover as the game is billed. */}
      <Poster coverUrl={coverUrl} heroUrl={heroUrl} title={title} width={width} />
    </Animated.View>
  );
});

/**
 * The masthead's cover as a button: tapped, it is measured where it stands
 * and `<CoverViewer>` brings a copy of it to the top of the screen, edge to
 * edge, over a mesh of the game's colours — where its animated portrait is one
 * press away.
 *
 * Its own component, holding the viewer's state, so opening and closing the
 * viewer re-renders this and not the page (CLAUDE.md, performance traps).
 */
const MastheadCoverButton = memo(function MastheadCoverButton({
  gameId,
  title,
  coverUrl,
  heroUrl,
  width,
  label,
}: {
  gameId: string;
  title: string;
  coverUrl: string | null;
  heroUrl: string | null;
  width: number;
  label: string;
}) {
  const box = useRef<View>(null);
  const [origin, setOrigin] = useState<CoverOrigin | null>(null);

  function openViewer() {
    box.current?.measureInWindow((x, y, measuredWidth, measuredHeight) => {
      if (measuredWidth > 0) setOrigin({ x, y, width: measuredWidth, height: measuredHeight });
    });
  }

  return (
    <>
      <PressableScale
        accessibilityRole="imagebutton"
        accessibilityLabel={label}
        accessibilityHint="Shows the cover full size, with its animated version a tap away"
        onPress={openViewer}
        scaleTo={0.97}>
        <View
          ref={box}
          collapsable={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <MastheadCover coverUrl={coverUrl} heroUrl={heroUrl} title={title} width={width} />
        </View>
      </PressableScale>

      {origin && (
        <CoverViewer
          game={{ id: gameId, title, coverUrl, heroUrl }}
          origin={origin}
          onClosed={() => setOrigin(null)}
        />
      )}
    </>
  );
});

/** The four sheets this page raises. */
type SheetName = 'reviews' | 'similar' | 'lists' | 'progress';

/**
 * Which sheet is open, held outside React state so that opening one re-renders
 * the sheets and not the page they rise over. `<GameSheets>` subscribes; the page
 * only ever calls `set`.
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
 * A game's dedicated page.
 *
 * The masthead — hero art, physical case, score, actions — stays fixed while
 * the tabs below swap content. Only the active tab's query runs, so opening the
 * page does not fetch reviews, soundtracks and recommendations it may never
 * show.
 */
export default function GameDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { width, height: windowHeight } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuth((state) => state.session?.user.id);
  const [tab, setTab] = useState<GameTab>('overview');
  /* Where the tabs sit in the page, for their pinned copy; and the page's
     scroller, which a tab chosen there scrolls back to them. */
  const [tabsY, setTabsY] = useState<number | null>(null);
  const scroller = useRef<ScrollView>(null);
  const headerHeight = useHeaderHeight();
  /*
   * The sheets keep their own open / closed state, in `<GameSheets>`.
   *
   * It used to be five `useState`s on this component, so raising the reviews
   * sheet — or the progress sheet, or the platform picker it once had — re-rendered this
   * entire page, masthead and tab included, just to flip one flag; and it did it
   * again on the way down. Held in a small store the sheets subscribe to,
   * opening one renders the sheet and nothing else. The openers below are
   * stable, so the memoised children they are handed stay memoised.
   */
  const [sheets] = useState(createSheetStore);
  const openReviews = useCallback(() => sheets.set('reviews'), [sheets]);
  const openSimilar = useCallback(() => sheets.set('similar'), [sheets]);
  const openLists = useCallback(() => sheets.set('lists'), [sheets]);
  const openProgress = useCallback(() => sheets.set('progress'), [sheets]);

  /*
   * One platform selection for the whole page.
   *
   * The Platforms section's box and its price are two views of the same
   * choice, so the choice lives here rather than inside either. `null` means
   * "not chosen yet" and defers to `defaultPlatform` below, which cannot be
   * computed until the detail query resolves.
   */
  const [platform, setPlatform] = useState<PlatformKey | null>(null);

  /* The Overview's sections, sized as SimpMusic's artist page is on this
     display — see `useSectionMetrics`. */
  const sections = useSectionMetrics();

  const caseWidth = Math.min(CASE_MAX_WIDTH, Math.round(width * CASE_WIDTH_RATIO));
  const heroHeight = heroHeightFor(width, windowHeight);
  /* The masthead's measurements, each a proportion of this display: the cover
     the reference's 100dp on 360, and how far the row rises into the hero so
     its top lands on the last tenth of the fade. `constants/game-masthead`. */
  const coverWidth = mastheadCoverWidth(width);
  const coverHeight = Math.round(coverWidth / PosterAspectRatio);
  const overlap = mastheadOverlap(heroHeight);

  const game = useQuery({
    queryKey: ['game', id],
    queryFn: ({ signal }) => getGameById(id!, signal),
    enabled: !!id,
    // Store metadata is effectively static; do not refetch during a session.
    staleTime: 30 * 60_000,
    /*
     * Start from the record the list already downloaded.
     *
     * A game opened from search, a franchise rail, a platform's page or
     * Surprise Me was fetched in full to draw its cover (`seen-games.ts`), so
     * the page is on screen in the frame it opens instead of behind a spinner
     * for a second request for the same thing. The time it was seen rides
     * along: older than `staleTime`, it still paints at once and is refreshed
     * behind. Ignored when the cache already holds this game — an earlier
     * visit, or one restored from the last launch.
     */
    initialData: () => recallGame(id)?.value,
    initialDataUpdatedAt: () => recallGame(id)?.at,
  });

  const myLog = useQuery({
    queryKey: ['my-log', userId, id],
    queryFn: () => getMyLog(userId!, id!),
    enabled: !!userId && !!id,
  });

  /*
   * Whether anybody here has scored this game — the stats strip's own query,
   * under its own key and arguments, so the two share one request. It decides
   * whether the masthead prints IGDB's score; see the billing below.
   */
  const appRatings = useQuery({
    queryKey: ['rating-breakdown', id],
    queryFn: () => getRatingBreakdown(id!),
    enabled: !!id && !!game.data,
  });

  const similar = useQuery({
    queryKey: ['similar', id],
    queryFn: ({ signal }) => getSimilarTo(id!, signal),
    enabled: !!id && tab === 'similar',
    staleTime: 30 * 60_000,
  });

  const similarGames = similar.data ?? [];

  /*
   * The copies you own of this game (0024).
   *
   * Fetched with the page rather than on the Overview tab alone, because the
   * answer decides whether a card exists at all — and it is one indexed query
   * returning, for nearly everybody, nothing.
   */
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

  /*
   * Franchise and studio are IGDB-only: they key on IGDB ids that Steam, RAWG
   * and itch.io have no equivalent for. Gating on the source rather than letting
   * the queries fail keeps guaranteed-empty requests off the wire every time a
   * Steam game is opened.
   */
  const parsedId = id ? parseGameId(id) : null;
  const igdbSourceId = parsedId?.source === 'igdb' ? parsedId.sourceId : null;

  const extras = useQuery({
    queryKey: ['game-extras', id],
    queryFn: ({ signal }) => getGameExtras(igdbSourceId!, signal),
    /* On every tab, not the Overview alone: the header's company names are
       links, and the ids they lead to come from here. */
    enabled: !!igdbSourceId && !!game.data,
    staleTime: 30 * 60_000,
  });

  /*
   * The game's official stores and its Steam appid, read from the same record
   * as `extras` above — the same key, so the same request. The appid is what
   * Where to buy prices by and what the Awards card and the events rail ask
   * Steam about.
   */
  const storefronts = useGameStorefronts(id ?? '');

  /* The trailer behind the hero, from the game's Steam listing — the studio
     page's banner, here too (the owner's, 2026-10-17). It rides on the same
     record as the storefronts, so it costs the page two small Steam requests
     a day and nothing from IGDB. One switch for both pages. */
  const trailer = useGameTrailer(id ?? null);
  const trailers = useTrailerSetting();
  const playingTrailer = trailers.ready && trailers.on ? (trailer?.url ?? null) : null;

  const collectionId = extras.data?.collection?.id ?? null;
  const franchiseId = extras.data?.franchises[0]?.id ?? null;

  const franchiseGames = useQuery({
    queryKey: ['franchise-games', collectionId, franchiseId],
    queryFn: ({ signal }) =>
      collectionId
        ? getCollectionGames(collectionId, signal)
        : getFranchiseGames(franchiseId!, signal),
    /* Not fetched at all on a remake or an edition: that page shows its
       original instead of the series, so the rail would be a request whose
       result never renders. */
    enabled: !game.data?.edition && (collectionId !== null || franchiseId !== null),
    staleTime: 30 * 60_000,
  });

  /*
   * The game's own colours, for the parts of this screen the screen itself
   * draws — Material 3, seeded by its **hero art** (`useGameAccent`,
   * `theme/dynamic-color`), the box art only where there is no hero: the
   * owner's (2026-10-31), "make it so that the m3 grabs the color from the
   * artwork hero instead of the portrait art". The page's colour is what the
   * hero dissolves into, so it is now the hero's own. The log form, the
   * achievements and the soundtrack are seeded the same way, so the colour
   * does not change on the way into them. The page is the scheme's background, the cards
   * its `primaryContainer` at half brightness, the quiet type its
   * `onSurfaceVariant`.
   *
   * Read directly rather than through `useAccent()` because the provider that
   * carries it to the children below is rendered *by* this component, and a
   * component cannot consume a context it is itself the parent of. Everything
   * inside `<AccentProvider>` — the tab bar, the buttons, the chips, the
   * cards — reads it the ordinary way.
   *
   * Resolves to the genre's hue while the art is read, so the page never
   * opens colourless; with game colours off (Settings) it is the owner's grey
   * room.
   */
  const accent = useGameAccent(game.data?.heroUrl ?? game.data?.coverUrl, game.data?.genres);
  const page = accent.page;
  /* Every card's material, in this game's tone — for the log block below,
     which this component draws itself. */
  const cardMaterial = cardMaterialFor(accent, theme);

  /*
   * Where the pinned hero is solid page colour, in how far the page has
   * scrolled: once the page is **past the title and onto the developer
   * lines** — the owner's (2026-10-27), "by the time it gets past the title
   * and onto the developer section of the masthead it should already be
   * solid" — which is also **where the top bar comes in**: "at the same level
   * where the top bar comes into screen". So one point in the masthead is
   * the bar's `header` and, through `revealOffset`, the art's `solidAt`: the
   * top of the lines under the name (the date, then the companies), reaching
   * the foot of the bar. Measured, since the name can run to four lines; an
   * estimate of a one-line name until it is. The blur and the drain are
   * shares of it (`PINNED_HERO`).
   */
  const topInset = useTopBarInset();
  const [linesY, setLinesY] = useState<number | null>(null);
  const barHeader = heroHeight - overlap + (linesY ?? BILLING_LINES_ESTIMATE);
  const solidAt = Math.max(1, revealOffset(barHeader, topInset + TOP_BAR_ROW));
  /*
   * The handoff to the glass bar: from the name's top reaching the bar's foot
   * to the lines under it reaching it — `solidAt`, where it always ended. The
   * name fades over its first half and the bar's name comes in over the
   * second, and the page never rests inside it (`HANDOFF`). Measured, since
   * the name can run to four lines; one line until it is.
   */
  const [titleHeight, setTitleHeight] = useState<number | null>(null);
  const handoff = handoffBand(
    barHeader - Spacing.x20 - (titleHeight ?? BILLING_TITLE_LINE),
    barHeader,
    topInset + TOP_BAR_ROW
  );
  /* Where the page's solid part starts: the tabs are inside it, so their
     place in the page is its place plus theirs in it. */
  const [solidPartAt, setSolidPartAt] = useState<number | null>(null);
  const tabsAt = solidPartAt !== null && tabsY !== null ? solidPartAt + tabsY : null;

  /*
   * Which platform's box the Platforms section shows, and prices.
   *
   * The artwork does **not** change with this selection. A SteamGridDB lookup
   * for per-platform box fronts lived here and has been removed: SteamGridDB's
   * `/grids/{platform}/{id}` slugs are *stores* — steam, gog, egs, eshop — not
   * console families, so `playstation` and `xbox` were never going to resolve
   * and the query spent a request per tap to fall back to the cover it already
   * had. The switcher re-draws the case and the price, which is what it was
   * always for.
   *
   * **It opens on a case, not on PC.** `platformKeysFor` returns the game's
   * platforms in `PLATFORM_PRIORITY` order, PC first — right for a list, wrong
   * for a default here: the section's box would be the same plain cover the
   * masthead already shows, and the one thing the section is for would be one
   * tap away. So: the platform you logged it on, else the first that comes in a
   * case (PS5, Xbox, Switch, PS4), else the first there is.
   */
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
      <Screen
        /* `edges={[]}` belongs to the success branch, whose artwork bleeds under
           the bar on purpose. There is no artwork here — just a spinner or a
           sentence centred in the frame — so without the inset it centres
           itself in a rectangle that includes the status bar and the Dynamic
           Island. Nothing is drawn under the notch that wants to be there. */
        edges={['top', 'bottom']}
        topBar={<FrostedTopBar back glass />}>
        <LoadingState />
      </Screen>
    );
  }

  if (game.isLoadingError) {
    return (
      <Screen
        /* `edges={[]}` belongs to the success branch, whose artwork bleeds under
           the bar on purpose. There is no artwork here — just a spinner or a
           sentence centred in the frame — so without the inset it centres
           itself in a rectangle that includes the status bar and the Dynamic
           Island. Nothing is drawn under the notch that wants to be there. */
        edges={['top', 'bottom']}
        topBar={<FrostedTopBar back glass />}>
        <ErrorState
          error={game.error}
          action={<Button title="Retry" variant="secondary" onPress={() => game.refetch()} />}
        />
      </Screen>
    );
  }

  if (!game.data) {
    return (
      <Screen
        /* `edges={[]}` belongs to the success branch, whose artwork bleeds under
           the bar on purpose. There is no artwork here — just a spinner or a
           sentence centred in the frame — so without the inset it centres
           itself in a rectangle that includes the status bar and the Dynamic
           Island. Nothing is drawn under the notch that wants to be there. */
        edges={['top', 'bottom']}
        topBar={<FrostedTopBar back glass />}>
        <EmptyState title="Game not found" />
      </Screen>
    );
  }

  const data = game.data;
  const logged = myLog.data;
  /* A legacy row may carry its appid on the record itself. */
  const steamAppId = storefronts.steamAppId ?? data.steamAppId ?? null;

  const unlockedCount = (achievements.data ?? []).filter((entry) => entry.unlocked_at).length;
  const achievementTotal = achievements.data?.length ?? 0;

  /* Ten at most, each announced as "Screenshot 3 of 8" rather than as eight
     unlabelled images in a row. */
  const screenshots = data.screenshots.slice(0, 10).map((url, index, shown) => ({
    url,
    label: `Screenshot ${index + 1} of ${shown.length} from ${data.title}`,
  }));

  /*
   * Whose score the masthead prints, by the owner's rule.
   *
   * **The app's own score, when it has one, is the score** — and it is in the
   * stats strip directly under this row, with how many ratings are behind it.
   * IGDB's aggregate beside the cover said a second, different number about the
   * same game, a line above the first. So it is printed only for a game nobody
   * here has rated, where it is the only verdict there is.
   *
   * Nothing is printed while that is still being asked: a number that appears
   * and is then taken away is worse than one that arrives a moment late. A
   * failed request counts as "no ratings" — IGDB's score is better than none.
   */
  const showCommunityScore = data.score !== null && !appRatings.isPending && !appRatings.data;

  /* The companies behind it, as the header's links: who made it, then who
     only published it. `getGameExtras` files a company that did both under
     developer, so nobody is on both lines. */
  const companies = extras.data?.companies ?? [];
  const developers = companies.filter((company) => company.role === 'developer');
  const publishers = companies.filter((company) => company.role === 'publisher');

  /* Whether the billing has anything under the name. A boolean, not the
     `a || b` itself: a year of 0 or an empty name would be drawn as text. */
  const hasBillingLines = Boolean(
    data.releaseDate || data.releaseYear || data.developer || data.publisher
  );

  /**
   * The masthead, above every tab: the room the pinned hero shows through,
   * then what the game is — the row of name and cover, and the synopsis —
   * floating on the art once the page has scrolled.
   */
  const masthead = (
    <View>
      {/*
        The page's solid part rising, in its last few dp: a lip of the page's
        colour from nothing to all of it, under the synopsis's last line and
        the gap after it — so the art the masthead floats on gives way to the
        solid part softly, and never at an edge. First, so it is under the
        masthead's type. At rest it lies on the page's own colour and is not
        there to see.
      */}
      <View pointerEvents="none" style={styles.lip}>
        <LinearGradient
          colors={lipColours(page)}
          locations={LIP_STOPS.locations as unknown as readonly [number, number, ...number[]]}
          style={styles.fill}
        />
      </View>

      {/* Twenty under the row with no synopsis, thirteen under the synopsis:
          the gap before the rule, which is the solid part's top edge. */}
      <View style={[styles.header, { paddingBottom: data.description ? 13 : Spacing.x20 }]}>
        {/*
        Where the hero shows through. The hero is not in the page any more: it
        is pinned behind it (`<PinnedHero>`, the screen's backdrop), and this
        is the room the page leaves it at rest — the app's backdrop hero, 38%
        of the display, the owner's soft dissolve at its foot, the row set into
        its last tenth as it always was. As the page scrolls the art stays
        where it is, nearly; this masthead slides up over it and floats on it,
        and the solid part under the synopsis rises and swallows it.
      */}
        <View style={{ height: heroHeight }} />

        {/*
        Group 1 — identity, as one row set into the foot of the art: the
        billing from the page's margin, the cover against the far one.

        The arrangement, and every size and interval in it, is the owner's
        reference — a film's page in Letterboxd — measured off a screenshot and
        written down in `constants/game-masthead`. Three things about it are
        the owner's rulings, and each replaced one:

        **It is in the fade.** "Not below it, not above it, right into it": the
        row rises into the hero until the top of the cover is on the last tenth
        of the art, and the art has gone by the title a few lines down. It sat
        twelve under the hero's edge before this, on the rule that nothing is
        laid on the art — and before that the cover rose half its height into
        the picture, "a boxed copy propped against a poster". What is under the
        row now is the art's last trace, which is neither.

        **The cover is on the right.** The billing starts at the margin and is
        set left, as it always was; the cover changed sides, so the name is the
        first thing on the row and the box closes it.

        **It is smaller.** The cover is 28% of the display (it was a third) and
        the type came down with it — see the billing.

        Top-aligned, the billing twelve under the top of the cover: that puts
        the name's capitals eighteen under it, where the reference's title is,
        and keeps them there whatever the billing's length — so the name is in
        the last of the fade on every game. Centred against the cover, a game
        with one line under its name dropped out of the fade altogether; any
        slack falls under the billing instead, beside the foot of the cover.
      */}
        <View style={[styles.identity, { marginTop: -overlap }]}>
          {/* First, so it is under the cover and under the billing both — see
            `<CoverHalo>`. */}
          <CoverHalo width={coverWidth} height={coverHeight} />

          {/*
          The billing: the name, then what the game is in three quiet lines.

          Sizes are the reference's, matched by capital height (to Inter, since
          replaced by Poppins app-wide): 22 for
          the name (its own step, `styles.billingTitle` — `Type` has nothing
          between 20 and 23) and `body` for the rest. It was 28 / 18 / 15, a size
          above the interface, on the argument that the cover beside it does not
          ride the type scale; the owner had "everything in the top sized down"
          and the cover with it, so the two still agree.

          Inks are the reference's too, by lightness: its title is pure white
          and everything under it a mid blue-grey at L* 76–81, on a page at L*
          10. A game's page is M3's tone 10 and `accent.quietInk` its tone 82 —
          the same ladder, carrying this game's trace instead of Letterboxd's.

          The lines are the three this row always had, at the owner's choice: no
          "developed by" label and no capitals. Nothing was bold but the name
          until the developers' names took the Developers card's place here —
          see the lines themselves.

          Four lines for the name, not three: a long title — "The Legend of
          Zelda: Breath of the Wild" — runs to three at this measure, and a
          game's name is the one thing on its own page that must not end in an
          ellipsis.
        */}
          <View style={styles.billing}>
            {/* Pure white (`white`). `text` is a step under it, and the
              reference's title is not. */}
            {/* The page's heading for a screen reader: the bar's title is not
              there until it comes in. */}
            {/* It hands over to the bar's name as it goes under the bar. */}
            <HandoffTitle band={handoff} onHeight={setTitleHeight}>
              <Text
                variant="display"
                accessibilityRole="header"
                numberOfLines={4}
                style={[styles.billingTitle, { color: theme.white }]}>
                {data.title}
              </Text>
            </HandoffTitle>

            {hasBillingLines && (
              /* Measured: its top is where the art is solid and the bar comes
                 in (`solidAt`). */
              <View
                style={styles.billingLines}
                onLayout={(event) => setLinesY(event.nativeEvent.layout.y)}>
                {data.releaseDate ? (
                  <Text variant="body" style={{ color: accent.quietInk }}>
                    {formatReleaseDate(data.releaseDate)}
                  </Text>
                ) : data.releaseYear ? (
                  <Text variant="body" style={{ color: accent.quietInk }}>
                    {data.releaseYear}
                  </Text>
                ) : null}

                {/*
                Who made it, then who published it: a line each, and each a way
                to that company's games.

                The owner's direction (2026-10-09): the Overview's "Developers"
                card is gone and its names are here — "clickable from the
                header", the developers' "in bold to make them stand out". Then
                (2026-10-15) "all the studios… should be in bold": a publisher
                was drawn in the quiet ink at regular weight, so a game with
                both had one name bold and one not. Every company line is bold
                in the full ink now, and each is a link.

                The ids a name leads to are IGDB's and arrive with `extras`.
                Until they do — and for a game that is not IGDB's — the lines
                are the record's own two names, set the same way and not
                pressable.
              */}
                {developers.length > 0
                  ? developers.map((company, index) => (
                      <CompanyLink
                        key={company.id}
                        company={company}
                        /* The slop reaches up into the date's line and stops
                         short of the next link, so two of them never overlap. */
                        slop={index === 0 ? COMPANY_SLOP_FIRST : COMPANY_SLOP}
                      />
                    ))
                  : data.developer && (
                      <Text variant="body" style={styles.developer} numberOfLines={2}>
                        {data.developer}
                      </Text>
                    )}
                {publishers.length > 0
                  ? publishers.map((company, index) => (
                      <CompanyLink
                        key={company.id}
                        company={company}
                        slop={index === publishers.length - 1 ? COMPANY_SLOP_LAST : COMPANY_SLOP}
                      />
                    ))
                  : !extras.data &&
                    data.publisher &&
                    data.publisher !== data.developer && (
                      <Text variant="body" style={styles.developer} numberOfLines={2}>
                        {data.publisher}
                      </Text>
                    )}
              </View>
            )}

            {/* IGDB's score, and only for a game nobody here has rated — see
              `showCommunityScore`. The figure is the score ramp's colour and
              says its verdict to a screen reader, as `<ScoreBadge>` does; it is
              drawn here because that badge stops at 14. On the baseline of its
              label, not centred on it: the two are different sizes. */}
            {showCommunityScore && data.score !== null && (
              <View style={styles.scoreRow}>
                <Text
                  variant="h4"
                  accessibilityLabel={`IGDB: ${Math.round(data.score)} out of 100 — ${labelFor(Math.round(data.score))}`}
                  style={{ color: scoreColor(data.score, theme) }}>
                  {Math.round(data.score)}
                </Text>
                {/* A quiet sentence-case label beside a bold figure — the owner's
                  reference sets numbers that way, and keeps caps for nothing.
                  Named for whose number it is: "Community" read as GameLog's
                  own, one line above the strip saying nobody here has rated
                  it (critique, 2026-10-21). */}
                <Text variant="body" style={{ color: accent.quietInk }}>
                  IGDB
                </Text>
              </View>
            )}
          </View>

          {/*
          The cover: still on the page, and a door to itself, larger.

          The case is in the Overview's Platforms section, with the platform
          button beside it and the turn-over that shows your record on its back.
          The masthead says *which game*; the section says *which box*.

          Tapping it brings it full size to the top of the screen, with the
          animated portrait a press away (2026-10-21, `<CoverViewer>`).

          One label for the whole thing, set here: the poster inside is hidden
          from assistive tech so the art is read once, with the edition the case
          would have printed.
        */}
          <MastheadCoverButton
            gameId={data.id}
            title={data.title}
            coverUrl={data.coverUrl}
            heroUrl={data.heroUrl}
            width={coverWidth}
            label={[data.title, data.edition ? editionLabel(data.edition) : null, 'cover art']
              .filter(Boolean)
              .join(', ')}
          />
        </View>

        {/*
        Group 2 — what the game is, in its own words: the synopsis, standing on
        the page under the row.

        It was the About card at the top of the Overview tab, five lines and a
        More. The owner moved it here and took the card away: "not a card, it is
        standalone text in the header". Three lines, the last of them fading
        into the page as the reference's does; tapping the text opens it in
        place with the card's own motion — the window's height, 250ms — and
        tapping again closes it (`<ExpandableText fade>`).

        A game with no synopsis has no block: there is no card left to say "No
        description" in, and a sentence about an absence does not belong in a
        masthead. The full IGDB record this used to lead to is a card of its own
        in the Overview now, where About was.
      */}
        {data.description ? (
          <View style={styles.about}>
            <ExpandableText
              lines={ABOUT_LINES}
              style={[styles.aboutText, { color: accent.quietInk }]}
              fade={{ to: page, ...ABOUT_FADE }}
              subject="the description">
              {data.description}
            </ExpandableText>
          </View>
        ) : null}
      </View>
    </View>
  );

  /**
   * The masthead's foot: the first of the page's solid part, under the
   * synopsis — the numbers, the actions, your own record.
   */
  const mastheadFoot = (
    <View style={styles.mastheadFoot}>
      {/* The reference's rule: one hairline, edge to edge, between what the
          thing is and its numbers. It is what the fading text stands on, and
          the top edge of the page's solid part — and the only rule in the
          masthead, which is why it may run the full width where the strip's
          own stop short. */}
      <View style={[styles.rule, { backgroundColor: accent.m3.outlineVariant }]} />

      {/*
        Group 3 — the numbers, between the identity block and the actions.

        Above the actions rather than below the whole masthead, which is where
        this sat when it replaced the platform buttons. The order is the order
        the questions get asked: *what is this* (the billing, the cover, the
        synopsis), *should I bother* (four numbers), *then* the row of things to
        do about it. With the strip underneath, every reader met the primary
        button before the one piece of evidence that would tell them whether to
        press it.

        It is also what the Play Store does, for the same reason — rating,
        downloads and content rating sit directly above Install.
      */}
      <GameStatsStrip gameId={data.id} onOpenReviews={openReviews} onOpenLists={openLists} />

      {/* The actions, at the header's full width rather than squeezed into the
          billing's column: they act on the game, not on its metadata. */}
      <View style={styles.actions}>
        <GameActions game={data} log={logged ?? null} onOpenProgress={openProgress} />
      </View>

      {/*
        Group 4 — your own record, last in the masthead.

        It sat directly above the actions, where it was the third thing on the
        page claiming the same fact: the action row's Played key is lit, the back
        of the case prints the status and the score, and this said it again in a
        sentence. Below the actions it reads as what it actually is — the
        *consequence* of having used them, and the way back into what you wrote.

        Last also means it is the block that disappears cleanly. Nobody who has
        not logged this game sees anything here, and the tabs simply move up by
        its height rather than a gap opening mid-masthead.
      */}
      {/*
        Your own log, on a surface carrying this game's hue.

        It sat bare for a while, and the argument was good: a filled
        `tone="selected"` block made the one thing on this page that is
        *yours* look like a notice the app was showing you. That argument was
        made against a flat `#121212` page, and the ambient gradient invalidated
        it — the block now sits on the brightest part of a lit gradient, where
        `statusPlayed` measures **2.02:1**, `statusDropped` 2.07:1 and a low
        `ScoreBadge` 1.95:1.

        These are the one kind of colour that cannot be lifted to suit a
        backdrop: they are *data*, tuned as a ramp, and forcing `statusPlayed`
        to AA on the gradient moves it 165 RGB units to a pale #C0DFF8 that no
        longer belongs to the set. So the surface comes back, and since
        2026-10-20 it is a card like every other: the review card's material
        (`cardMaterialFor`) in the game's own dark tone — or `surface`, with
        game colours off.
      */}
      {/*
        Rendered only when there is something in it to read.

        It used to be `logged &&` alone, which was safe while the status word
        was the fallback — every log has a status, so the block always had a
        line. With the word gone a log that is *only* a status (tap Played, do
        nothing else — by far the most common log there is) would leave an
        empty tinted rectangle above the actions.
      */}
      {logged && (hasWriting(logged) || logged.rating !== null || logged.platinum) && (
        <View
          style={[
            cardShape,
            styles.myLog,
            { backgroundColor: cardMaterial.fill, borderColor: cardMaterial.edge },
          ]}>
          {hasWriting(logged) ? (
            /*
             * You wrote about this — so the block says so in a sentence and
             * then gets out of the way.
             *
             * It used to restate the log as three stacked facts: the status
             * word, a large score pill, and the review's headline. All three
             * are already on this page — the status and score are printed on
             * the back of the case a few hundred pixels above, and the
             * headline is the first thing on the review itself. Repeating
             * them here made the block a summary of a summary, and the one
             * thing it never did was offer a way to *read the thing*.
             *
             * The date is the fact that is genuinely only here: nothing else
             * on this page says when you wrote it.
             */
            <>
              <Text variant="body" color="textSecondary">
                {`You reviewed this game on ${formatReleaseDate(logged.created_at)}`}
                {logged.rating !== null ? ' and gave it a ' : '.'}
                {logged.rating !== null && (
                  <Text variant="h4" style={{ color: scoreColor(logged.rating, theme) }}>
                    {`${Math.round(logged.rating)}.`}
                  </Text>
                )}
              </Text>

              <Link href={{ pathname: '/review/[id]', params: { id: logged.id } }} asChild>
                <PressableScale
                  accessibilityRole="link"
                  accessibilityLabel="See your full review"
                  hitSlop={REVIEW_LINK_SLOP}
                  style={styles.reviewLink}
                  scaleTo={0.98}>
                  <Ionicons name="eye-outline" size={16} color={theme.primaryText} />
                  <Text variant="bodySmall" style={{ color: theme.primaryText }}>
                    See your full review
                  </Text>
                </PressableScale>
              </Link>
            </>
          ) : (
            /*
             * No writing — so there is no review to link to, and the block
             * falls back to stating the record it does have.
             *
             * **Which no longer includes the status word.** "Played" with its
             * tick used to head this block, and it was the third place on one
             * screen saying the same thing: the action row's Played key is lit
             * and solid, and the back of the case prints the status too. A
             * label restating the state of a control 200dp above it is not a
             * fact the block contributes — the score and the platinum are.
             */
            <>
              {logged.platinum && (
                <View style={styles.myLogHead}>
                  <Ionicons name="trophy" size={16} color={theme.platinum} />
                </View>
              )}
              {logged.rating !== null && <ScorePill score={logged.rating} size="large" showLabel />}
            </>
          )}
        </View>
      )}
    </View>
  );

  function renderTab() {
    switch (tab) {
      case 'soundtrack':
        return (
          <View style={styles.tabBody}>
            <SoundtrackSummary gameId={data.id} title={data.title} developer={data.developer} />
          </View>
        );

      case 'similar':
        /*
          Two lists, and the community's leads.

          IGDB's similar games are an algorithm's answer, with no reasons and no
          way to disagree; the community's are players naming a game and saying
          *why* (0025). Different claims, so each has its own heading and its own
          loading, error and empty states — a failed IGDB request used to blank
          the whole tab, which would now also hide what players said. The
          community's comes first because it is the answer only this app has.
        */
        return (
          <View style={styles.tabBody}>
            <CommunitySimilarCard gameId={data.id} gameTitle={data.title} onOpen={openSimilar} />

            <View style={styles.similarSection}>
              <View style={styles.similarHead}>
                <Text variant="h3" accessibilityRole="header">
                  Similar, according to IGDB
                </Text>
              </View>

              {similar.isLoading ? (
                <LoadingState />
              ) : similar.isLoadingError ? (
                /* `getSimilarTo` used to swallow every failure into an empty
                   array, so a dropped connection rendered as a statement about
                   IGDB's catalogue. It throws now; this tells the two apart. */
                <ErrorState
                  error={similar.error}
                  action={
                    <Button title="Retry" variant="secondary" onPress={() => similar.refetch()} />
                  }
                />
              ) : (similar.data ?? []).length === 0 ? (
                <Text variant="body" color="textSecondary">
                  {data.source === 'igdb'
                    ? 'IGDB has no similar games listed for this title.'
                    : 'IGDB’s list is only available for IGDB titles. Try opening this game from a search result instead.'}
                </Text>
              ) : (
                similarGames.map((entry) => (
                  <View key={entry.id} style={styles.reviewRow}>
                    <GameListItem game={entry} />
                  </View>
                ))
              )}
            </View>
          </View>
        );

      default:
        /*
          SimpMusic's artist page, section for section (see `<InfoCard>`): every
          heading stands on the page, a section that is pictures is a rail of
          them under its heading, and a section that is words sits in a card
          under its heading. Sizes are the reference's, as fractions of the
          display (`useSectionMetrics`), and nothing here pads itself sideways —
          the inset is handed down, so the rails can run edge to edge and still
          start in line with the headings.
        */
        return (
          <SectionInsetProvider inset={sections.inset}>
            <View style={[styles.overview, { gap: sections.sectionGap }]}>
              {/*
                Screenshots first: somebody arriving on a page they have not
                played is asking what it looks like before they ask what anybody
                thought. At the reference's video size, which is the size of the
                pictures on its artist page that are not album art.

                The ratings, the players and the review led the tab for one
                build, as they do on the reference's film page; the owner had
                the screenshots moved "back to the top of the page".
              */}
              <GameScreenshots shots={screenshots} trailer={extras.data?.trailer ?? null} />

              {/*
                Then what the people here made of it — the three things a
                film's page in Letterboxd carries, at the owner's direction
                (2026-10-09): how they scored it, who played it, and the
                review they liked most. Each is absent when it has nothing to
                show.

                The ratings are the reviews sheet's own summary, and the card
                is a door to that sheet.
              */}
              <RatingsCard gameId={data.id} title={data.title} onOpen={openReviews} />

              {/* How many people here want it, are playing it, have played
                  it — the owner's request (2026-10-16). Under the ratings:
                  what the room thought, then how many are in it. */}
              <GameAudienceCard gameId={data.id} title={data.title} />

              {/* Anybody, and the people you follow: two faces each. */}
              <PlayedBy gameId={data.id} />

              {/* The most liked review, in the card the sheet's rows are
                  drawn in. The heading's More is the way to all of them. */}
              <TopReview gameId={data.id} title={data.title} onSeeAll={openReviews} />

              {/*
                Details: the full IGDB record — genres, modes, engines, age
                ratings, languages — behind a card that is its door.

                Where About was. The synopsis is in the masthead now, standing
                on the page, and this was its heading's way onward; with the
                heading gone the record keeps the place and takes a card of its
                own, so nothing that could be reached from here was lost in the
                move. Absent for a game that is not IGDB's, which has no record.
              */}
              <GameDetailsCard gameId={data.id} title={data.title} year={data.releaseYear} />

              {/* What the critics and the shows gave it, as the publisher
                  shows it on Steam — the graphic from the store page's Awards
                  section, and the Steam Awards it won. Under the details, at the
                  owner's direction (2026-10-16). */}
              <GameAwards appId={steamAppId} title={data.title} />

              {/*
                Platforms: which machines it is on, and the box on each — the
                case, its turn-over and its price, beside the platform button
                that changes all three. After the record, because what the game
                is comes before which box to get; before Where to buy, because
                which box comes before which shop. On the page and not in a
                card: it is the one section here whose subject is an object.
              */}
              {activePlatform && (
                <GamePlatforms
                  game={data}
                  log={logged ?? null}
                  platforms={availablePlatforms}
                  selected={activePlatform}
                  onSelect={setPlatform}
                  artWidth={caseWidth}
                />
              )}

              {/* Under the box, not above it: the price is the next question
                  for a reader who has decided which one. */}
              <StorePrices gameId={data.id} title={data.title} />

              {/*
                Your copy, directly under where to buy one — the two answers to
                "how do I get this" and "I already have it". Only when you own
                one; the way in otherwise is "I own a copy" on the Collect key.
              */}
              {(myCopies.data?.length ?? 0) > 0 && userId && (
                <InfoCardButton
                  title={myCopies.data!.length === 1 ? 'Your copy' : 'Your copies'}
                  accessibilityLabel={
                    myCopies.data!.length === 1
                      ? `Your copy: ${releaseLine(myCopies.data![0]) || 'release not recorded'}. Open it.`
                      : `You own ${myCopies.data!.length} copies. Open them.`
                  }
                  onPress={() =>
                    myCopies.data!.length === 1
                      ? router.push({
                          pathname: '/copy/[id]',
                          params: { id: myCopies.data![0].id },
                        })
                      : router.push({
                          pathname: '/copies/[user]',
                          params: { user: userId, game: data.id },
                        })
                  }>
                  <View style={styles.copyLines}>
                    <Text variant="h4">
                      {releaseLine(myCopies.data![0]) || 'Release not recorded'}
                    </Text>
                    {copyStateLine(myCopies.data![0]) && (
                      <Text variant="body" color="textSecondary">
                        {copyStateLine(myCopies.data![0])}
                      </Text>
                    )}
                    {myCopies.data!.length > 1 && (
                      <Text variant="caption" color="textMuted">
                        {`and ${myCopies.data!.length - 1} more`}
                      </Text>
                    )}
                  </View>
                </InfoCardButton>
              )}

              {/* What is new with it: the store page's recent events and
                  announcements — patches, in-game events, DLC, news — opened
                  on Steam. After how to get it, before the series. */}
              <SteamEvents appId={steamAppId} title={data.title} />

              {/* "Featured in" — the showcases a game appeared at — followed
                  this, and the owner had it taken off the page; and so did the
                  Time to beat card (2026-10-15). The stats strip still says how
                  long a game is. */}

              {/*
                Series and lineage, and which one you get depends on what this
                game *is*. A remake, remaster, DLC or edition shows the game it
                came from and no franchise rail; an original shows its series —
                originals only, see `ORIGINALS_ONLY` — and its own versions.
              */}
              {data.edition && data.parentId ? (
                <OriginalGame parentId={data.parentId} edition={data.edition} />
              ) : (
                <GameEditions gameId={data.id} />
              )}

              {/* Franchise. IGDB models a numbered series as `collection` and the
                  wider brand as `franchises`; the collection is the more useful
                  of the two, so it wins when both exist. Hidden on a derivative —
                  the section above already places it. */}
              {!data.edition && franchiseGames.data && franchiseGames.data.length > 1 && (
                <Section title={extras.data?.collection?.name ?? 'Franchise'}>
                  <GameCoverRail
                    games={franchiseGames.data.filter((entry) => entry.id !== data.id)}
                  />
                </Section>
              )}

              {/* A failed fetch used to leave `achievementTotal` at 0 and take the
                  whole section with it — silently, and identically to a game that
                  genuinely tracks none. The count is the section's own claim, so
                  it cannot be rendered from a number the app never received. */}
              {achievements.isLoadingError ? (
                <InfoCard title="Achievements">
                  {/* The page has no pull-to-refresh; this said there was. */}
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
                      {' unlocked. Tap to see every one.'}
                    </Text>
                  </InfoCardButton>
                )
              )}

              {/* A moderator's controls — the Must Play label. Draws nothing
                  for anybody who is not one. */}
              <GameModeratorCard game={data} />

              {data.storeUrl && (
                <View style={{ paddingHorizontal: sections.inset }}>
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
        );
    }
  }

  return (
    /* Everything below here runs on this game's colour rather than the app's.
       The provider is what makes that a one-line change instead of a prop on
       every control: the tab bar, the log button, the chips and the action
       keys all read the accent from context. Seeded by the box art — the
       image the player pictures when they think of the game — and, until that
       is read or where the art has none, by the genre's hue. */
    <AccentProvider artwork={data.heroUrl ?? data.coverUrl} genres={data.genres}>
      <>
        <Screen
          edges={[]}
          /* One colour, the game's, from the top of the page to its foot — and
             it does not change as the page is read (the owner's, 2026-10-27).
             What the scroll moves is the art behind the page. */
          background={page}
          /*
            Behind the page, outside its inset: the page's colour, then the
            hero pinned at the top of the display (`<PinnedHero>`).
          */
          backdrop={
            <>
              <PageFill color={page} />
              <PinnedHero
                uri={data.heroUrl}
                steamAppId={data.steamAppId}
                height={heroHeight}
                page={page}
                fade={MASTHEAD_FADE}
                /* Convx's mirrored tail and wash: the art melts on past its foot,
                   behind the transparent masthead. */
                tail
                solidAt={solidAt}
                scrim={0.4}
                media={(art) => (
                  <TrailerBackdrop url={playingTrailer} height={heroHeight} until={solidAt}>
                    {art}
                  </TrailerBackdrop>
                )}
              />
            </>
          }
          /* Over the hero there is no bar, only the glass discs, and they stay
               where they are — Apple's bar (`glass`): there is always a way back.
               The bar's glass fades in under them, with the game's name centred,
               once the name has gone under it — the lines under the name
               reaching the bar's foot (`barHeader`). At that same scroll the
               art has finished draining: it is solid page colour as the bar
               arrives (`solidAt`). */
          topBar={
            <FrostedTopBar
              back
              glass
              title={data.title}
              header={barHeader}
              handoff={handoff}
              /* The trailer on and off, opposite the back disc — the studio
                   page's key — shown only when there is a trailer to switch. */
              right={
                <>
                  {trailer && (
                    <TopBarDisc
                      icon={trailers.on ? 'videocam-off-outline' : 'videocam-outline'}
                      label={trailers.on ? 'Stop the trailer' : 'Play the trailer'}
                      onPress={() => trailers.setOn(!trailers.on)}
                    />
                  )}
                  {/* Share, at the top right as on every other page that has
                        it — the action row gave its slot to Collect, and the
                        page had none until the owner put it here (2026-10-21). */}
                  <TopBarDisc
                    icon="share-outline"
                    label={`Share ${data.title}`}
                    onPress={() => shareGame(data)}
                  />
                </>
              }
            />
          }>
          {/*
            A ScrollView, not a one-item FlatList.

            The page was a FlatList whose single cell was the whole active tab,
            so that the tab bar could scroll away with the masthead. It bought
            nothing a ScrollView does not — one cell is never windowed — and it
            cost: `renderItem` was a fresh function on every render, so the list
            re-rendered its page-sized cell every time anything on the page
            changed, and reported it ("a large list that is slow to update").
            Nothing inside the tabs is a vertical list; the rails are horizontal,
            which nests inside a ScrollView without complaint.
          */}
          <PageScrollView
            ref={scroller}
            settle={handoff}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}>
            {masthead}
            {/*
              The page's solid part: everything from the rule under the
              synopsis to the foot, on the page's colour, opaque. It is what
              rises over the pinned hero and swallows it. Its colour comes in
              over 400ms the first time it is read, with the page's own.
              Measured, so the hero knows when it is covered.
            */}
            <View
              onLayout={(event) => setSolidPartAt(event.nativeEvent.layout.y)}
              style={{ backgroundColor: page }}>
              {mastheadFoot}
              {/* `spread`: three equal tabs across the column, barely touching
                  — the owner's, over two passes (see `TabBarProps.align`).
                  Measured, so the pinned copy below knows where it takes over. */}
              <View onLayout={(event) => setTabsY(event.nativeEvent.layout.y)}>
                <TabBar tabs={TABS} value={tab} onChange={setTab} align="spread" />
              </View>
              {/* The Overview's shelves rise into place as they scroll into view. */}
              <RevealScope>{renderTab()}</RevealScope>
            </View>
          </PageScrollView>
          {/* The same tabs, held under the bar once the page has scrolled them
              up to it (critique, 2026-10-21). Switching there starts the new
              tab at its top, under the tabs, rather than mid-way down it. */}
          <PinnedTabBar
            at={tabsAt}
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

        {/* A sibling of `<Screen>`, not a child: the floating back disc is
            rendered by the screen *after* its content, so a sheet mounted inside
            would have the page's own back arrow floating over the top of it. */}
        <GameSheets store={sheets} game={data} log={logged ?? null} />
      </>
    </AccentProvider>
  );
}

/**
 * The sheets this page raises, and whether each is open.
 *
 * Subscribed to the page's sheet store, so that opening one re-renders this and
 * not the page under it. See the note where the page creates the store.
 */
/**
 * A company's name in the header, as the way to its games.
 *
 * Bold and in the full ink, developer and publisher alike — the owner's
 * direction (2026-10-15: "all the studios… should be in bold"), so the
 * companies stand out of the quiet lines round them. Both are links: the
 * Overview's "Developers" card, which listed these same companies as rows, was
 * removed in favour of this.
 */
function CompanyLink({
  company,
  slop,
}: {
  company: GameCompany;
  slop: { top: number; bottom: number; left: number; right: number };
}) {
  const router = useRouter();
  const developer = company.role === 'developer';

  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={`${company.name}, ${developer ? 'developer' : 'publisher'}. See their games.`}
      hitSlop={slop}
      scaleTo={0.98}
      onPress={() =>
        router.push({
          pathname: '/studio/[id]',
          params: { id: String(company.id), name: company.name },
        })
      }
      style={StyleSheet.flatten(styles.company)}>
      <Text variant="body" numberOfLines={2} style={styles.developer}>
        {company.name}
      </Text>
    </PressableScale>
  );
}

function GameSheets({ store, game, log }: { store: SheetStore; game: Game; log: GameLog | null }) {
  const router = useRouter();
  const open = useSyncExternalStore(store.subscribe, store.get);
  const close = useCallback(() => store.set(null), [store]);

  /* Asked for as the page opens, not when the sheet does: the critics' section
     heads the reviews sheet, and an answer that arrived after the sheet was up
     would push every review under it down the screen. The Overview used to ask
     for the same thing for its own rail, so this is not a new request. */
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

      {/* The community's similar games, from the Similar tab's card — the same
          sheet the reviews open in, full height, sortable. A pick opens its own
          screen on top and coming back lands here again. */}
      <SlideUpSheet visible={open === 'similar'} onClose={close} title={game.title}>
        <CommunitySimilarSheet gameId={game.id} gameTitle={game.title} />
      </SlideUpSheet>

      {/* Which collections hold this game, from the strip's second cell. Full
          height: there is nothing behind it to watch while it is open, and a
          collection is a card over two hundred dp tall. */}
      <SlideUpSheet visible={open === 'lists'} onClose={close} title="In collections">
        <GameListsSheet gameId={game.id} gameTitle={game.title} />
      </SlideUpSheet>

      {/* Your progress, from the action row's progress key. Most of the display
          but not all of it — the key you pressed and the case's printed back
          both change when you choose, and are worth keeping in sight. */}
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
  Share.share({ message: `${game.title}${year} on GameLog\n${url}` }).catch(() => undefined);
}

const styles = StyleSheet.create({
  /* The achievements card's failure: the sentence, then its way out. */
  retry: { gap: Spacing.x12, alignItems: 'flex-start' },
  content: { paddingBottom: Spacing.x48 },
  /* A list inside one card, so the interval is a list's rather than a card's. */
  /*
   * No one gap: every interval in the masthead is its own, and each is the
   * reference's.
   *
   * The intervals were read off the screenshot as the distance from one line's
   * baseline to the next one's capitals, then turned into the space between two
   * of this app's line boxes — which is why they look uneven written down (20,
   * 4, 15, 13) and even on the page. One repeated gap is the failure where the
   * hero, the billing, the synopsis and the actions all get equal weight; this
   * is tight inside a group and open between them, to the reference's measure.
   */
  header: { paddingHorizontal: Spacing.x16 },
  /* Under the rule: the numbers, the actions, your log — then the tabs. */
  mastheadFoot: { paddingHorizontal: Spacing.x16, marginBottom: Spacing.x20 },
  lip: { position: 'absolute', left: 0, right: 0, bottom: 0, height: LIP },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  /* Top-aligned, so the cover is held at the top of the row whatever the
     billing's length, and the billing starts a fixed step under that top — the
     reference's: its title's capitals are eighteen under its poster's top
     edge, which is twelve to this line box. The row's pull into the hero is
     set inline — it is a share of the hero's height. */
  identity: { flexDirection: 'row', alignItems: 'flex-start', gap: COVER_GUTTER },
  billing: { flex: 1, paddingTop: Spacing.x12 },
  /* The name's own size — see the note on the billing. It states its line
     height: a `fontSize` alone would keep the variant's, and Android clips a
     glyph to its line box. */
  billingTitle: { fontSize: 22, lineHeight: 27, letterSpacing: -0.45 },
  /* Twenty under the name — the reference's 28dp from its baseline to the next
     line's capitals — and the three lines a paragraph's distance apart. */
  billingLines: { marginTop: Spacing.x20, gap: Spacing.x4 },
  /* A developer's name: the bold family — Android synthesises no weight for a
     custom font — in the full ink `<Text>` sets by default. */
  developer: { fontFamily: FontFamily.bold },
  /* As wide as the name, not the column: the target is the words. */
  company: { alignSelf: 'flex-start' },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.x8,
    marginTop: Spacing.x16,
  },
  /* `landed = 1`, term for term with the cover's animated pose. */
  coverLanded: {
    transform: [{ perspective: 900 }, { translateY: 0 }, { scale: 1 }, { rotateY: '0deg' }],
  },
  /* Fifteen under the row puts the synopsis's first capitals twenty under the
     cover, where the reference's first line under its poster is. */
  about: { marginTop: Spacing.x16 },
  /* The reference's measure: 13 on a 20dp line, one more than `body`'s. */
  aboutText: { lineHeight: 20 },
  /* Edge to edge: the header's own margin, undone. Thirteen under the synopsis
     (the masthead's own foot) is eighteen under its last baseline, and the two
     under it stand the strip's figures nineteen below — both the reference's.
     With no synopsis it follows the row, a step further off: twenty. */
  rule: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: -Spacing.x16,
    marginBottom: 2,
  },
  /* The strip pads its own cells by twelve, so this is twenty-four from its
     labels to the buttons. */
  actions: { marginTop: Spacing.x12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 + 2 },
  /* Every card's material (`card-material`): the review card's corner, edge
     and inset, in the game's dark tone. */
  myLog: {
    gap: Spacing.x8,
    padding: CARD_INSET,
    marginTop: Spacing.x20,
  },
  /* `flex-end`, not `space-between`. The row held the status word on the left
     and the platinum trophy on the right; with the word gone `space-between`
     would park a lone trophy at the left margin, which reads as a bullet. */
  myLogHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  /* `flex-start` so the target is the width of its label, not of the block —
     a full-width row here would read as a button, and this is a link. */
  reviewLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.x8,
  },
  tabBody: { padding: Spacing.x16, gap: Spacing.x16 },
  /* No sideways padding: every section takes the inset it is handed, so a
     rail can run edge to edge. The gap between sections is set inline. */
  overview: { paddingTop: Spacing.x8, paddingBottom: Spacing.x16 },
  copyLines: { gap: 2 },
  /* A step more than the tab's own rhythm between the community's list and
     IGDB's, so they read as two sections rather than one list with a break. */
  similarSection: { gap: Spacing.x12, marginTop: Spacing.x24 },
  similarHead: { gap: 2 },
  reviewRow: { marginBottom: Spacing.x12 },
  /* The size comes from the rail; the corner is the app's box-art corner. */
});
