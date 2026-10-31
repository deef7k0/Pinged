import { LinearGradient } from 'expo-linear-gradient';
import { Link, useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

import { PORTRAIT_COLUMNS, gridItemWidth } from '@/components/gaming/game-tile';
import { GameCoverRail } from '@/components/game-rail';
import { HomeSection } from '@/components/home-section';
import { LOGO_WIDTH_RATIO, StudioIdentity } from '@/components/studio-identity';
import { TrailerBackdrop } from '@/components/trailer-backdrop';
import { FrostedTopBar, TopBarDisc } from '@/components/ui/frosted-top-bar';
import { HandoffTitle } from '@/components/ui/handoff-title';
import { PageFill, PinnedHero } from '@/components/ui/pinned-hero';
import { PageFlatList } from '@/components/ui/page-scroll';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { RevealScope } from '@/components/ui/reveal';
import { EmptyState, ErrorState, Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/surface';
import { SortBar } from '@/components/ui/sort-bar';
import { Text } from '@/components/ui/text';
import { scoreColor } from '@/constants/score';
import { Radius, Spacing, Type, withAlpha } from '@/constants/theme';
import { useStudioBanner } from '@/hooks/use-studio-banner';
import { BANNER_MAX_ASPECT, useStudioCatalogue } from '@/hooks/use-studio-catalogue';
import { useStudioLogo } from '@/hooks/use-studio-logo';
import { useGameTrailer, useTrailerSetting } from '@/hooks/use-game-trailer';
import { useTheme } from '@/hooks/use-theme';
import { AccentProvider, useGameAccent } from '@/hooks/use-accent';
import { useTopBarInset } from '@/hooks/use-header-height';
import { TOP_BAR_ROW, handoffBand, revealOffset } from '@/constants/top-bar';
import { footFade, smoothScrimStops } from '@/lib/scrim';
import { gameSortOptions, sortGames, type GameSearchResult, type GameSort } from '@/lib/games';
import type { StudioGame } from '@/lib/games/igdb';

/** Three across, the app's portrait size (`PORTRAIT_COLUMNS`). */
const COLUMNS = PORTRAIT_COLUMNS;
const GAP = Spacing.x8;
const RAIL_INSET = Spacing.x16 * 2;

/**
 * How much of the grid exists at once, in multiples of 3 columns.
 * 12 items = 4 full rows up front, rendered cleanly without micro-batches.
 */
const GRID_INITIAL_ITEMS = 12;
const GRID_BATCH_ITEMS = 12;
const GRID_WINDOW = 5;

/** Memoized grid item to eliminate VirtualizedList slow update bottlenecks. */
const StudioGridItem = memo(function StudioGridItem({
  item,
  tileWidth,
}: {
  item: StudioGame;
  tileWidth: number;
}) {
  return (
    <Link href={{ pathname: '/game/[id]', params: { id: item.id } }} asChild>
      <PressableScale accessibilityRole="button" accessibilityLabel={item.title} scaleTo={0.95}>
        <View style={{ width: tileWidth }}>
          <Poster
            coverUrl={item.coverUrl}
            heroUrl={item.heroUrl}
            title={item.title}
            edition={item.edition}
            gameId={item.id}
            width={tileWidth}
            rounded="image"
            priority="low"
          />
        </View>
      </PressableScale>
    </Link>
  );
});

/**
 * How a catalogue can be ordered.
 *
 * No "Default": IGDB returns a studio's games newest-first and there is no
 * separate relevance ranking to preserve, so an extra pill would sit there
 * meaning the same thing as "Newest".
 */
const SORTS = gameSortOptions(['newest', 'oldest', 'rating', 'title']);

/**
 * The banner is square — SimpMusic's artist header on a phone (`aspectRatio(1f)`
 * in `ArtistScreen.kt`) — but never taller than half the display, which is what
 * stops a tablet or a landscape window drawing a screenful of it.
 */
const FRAME_MAX_RATIO = 0.5;

/**
 * How much of the banner gives way to the page, from the bottom: the
 * reference's `fillMaxHeight(0.7f)` (`artworkScrimBrush`).
 */
const BANNER_FADE = footFade(0.7);

/** The reference's 5% black over the artwork, so a bright image sits back behind the name. */
const VEIL = 0.05;

/** The line under the name, and the four above it: where the name ends, for the bar. */
const META_LINE = (Type.body.lineHeight ?? 19) + Spacing.x4;
/** The name's height until it is measured: a line of the display step. */
const NAME_ESTIMATE = Type.display.lineHeight ?? 34;

/** The solid part's soft top edge, and its stops: the page's colour from nothing to all of it. */
const LIP = 40;
const LIP_STOPS = smoothScrimStops();
function lipColours(page: string) {
  return LIP_STOPS.alphas.map((alpha) => withAlpha(page, alpha)) as unknown as readonly [
    string,
    string,
    ...string[],
  ];
}

/** The line under the name — "128 games · 1998–2024" — at the reference's 77% white. */
const META_ALPHA = 0.77;

/**
 * How many rated originals a studio needs before "Best rated" means
 * anything, and how many it then shows.
 *
 * Six, because a rail drawn from three games is not a selection — it is the
 * catalogue with two covers hidden, and the heading would be claiming a judgement
 * the data cannot support. Studios under the floor keep the grid, where every
 * game is visible and the sort row offers "Top rated" for anybody who wants the
 * same ordering honestly labelled.
 */
const BEST_FLOOR = 4;
const BEST_SHOWN = 10;

/** How many games a rail of the newest, the most rated or a franchise shows. */
const RAIL_SHOWN = 12;

/** A franchise is a rail of its own from three games, and the page shows three. */
const FRANCHISE_FLOOR = 3;
const FRANCHISES_SHOWN = 3;

/**
 * A rail needs two posters.
 *
 * One remaster is a fact about a game, not a section about a studio, and a
 * horizontally scrolling strip holding a single item reads as a loading state
 * that never finished. Below the floor the game is still in the grid with its
 * "Remaster" badge on it, which is where a single one belongs.
 */
const RAIL_FLOOR = 2;

/** The three kinds that are another go at a game that already exists. */
const REDONE: readonly (GameSearchResult['edition'] & string)[] = ['remake', 'remaster', 'port'];

/** The two kinds that are the same game in a different box. */
const REPACKAGED: readonly (GameSearchResult['edition'] & string)[] = ['edition', 'bundle'];

/**
 * How a studio's catalogue divides.
 *
 * ## The one true partition, and two views
 *
 * `catalogue` and `repackaged` are a genuine split: a "Definitive Edition" is the
 * same game as its parent, so leaving it in the grid puts three near-identical
 * covers in a row — the exact problem the catalogue query used to solve by never
 * fetching them. They come out of the grid and into their own rail.
 *
 * `best` and `redone` are *views* into the catalogue, not removals from it. A
 * studio's best game is still one of its games and still belongs in a complete
 * list; a remake is a release in its own right with its own page. Rails that
 * duplicate what the grid holds are how every browsing surface works — the rail
 * is an argument about where to start, the grid is the record.
 *
 * ## Why `best` is originals only
 *
 * A remaster inherits its parent's reception and frequently scores a point or two
 * higher for it. Left in, "Best rated" fills up with the same games'
 * remasters, and the rail stops answering "what should I play" and starts
 * answering "which re-release reviewed best".
 */
function shelves(games: readonly StudioGame[], now: number) {
  const repackaged = games.filter((game) => game.edition && REPACKAGED.includes(game.edition));
  const catalogue = games.filter((game) => !game.edition || !REPACKAGED.includes(game.edition));

  const originals = catalogue.filter((game) => game.edition === null);
  const rated = originals.filter((game) => game.score !== null);
  const redone = catalogue.filter((game) => game.edition && REDONE.includes(game.edition));

  const best = sortGames(rated, 'rating');

  /* Out, newest first; and still to come, soonest first. A date is the only
     honest test for either — a game with none is neither. */
  const released = catalogue.filter(
    (game) => game.releaseDate && Date.parse(game.releaseDate) <= now
  );
  const latest = sortGames(released, 'newest').slice(0, RAIL_SHOWN);
  const upcoming = sortGames(
    catalogue.filter((game) => game.releaseDate && Date.parse(game.releaseDate) > now),
    'oldest'
  ).slice(0, RAIL_SHOWN);

  /* The most rated originals: what people have actually played of theirs. */
  const popular = originals
    .filter((game) => (game.ratingCount ?? 0) > 0)
    .sort((a, b) => (b.ratingCount ?? 0) - (a.ratingCount ?? 0))
    .slice(0, RAIL_SHOWN);

  /* Each franchise the studio has three or more games in, the largest first,
     its games in release order. */
  const byFranchise = new Map<number, { name: string; games: StudioGame[] }>();
  for (const game of catalogue) {
    for (const franchise of game.franchises ?? []) {
      const entry = byFranchise.get(franchise.id) ?? { name: franchise.name, games: [] };
      entry.games.push(game);
      byFranchise.set(franchise.id, entry);
    }
  }
  const franchises = [...byFranchise.entries()]
    .filter(([, entry]) => entry.games.length >= FRANCHISE_FLOOR)
    .sort((a, b) => b[1].games.length - a[1].games.length)
    .slice(0, FRANCHISES_SHOWN)
    .map(([id, entry]) => ({
      id,
      name: entry.name,
      games: sortGames(entry.games, 'oldest').slice(0, RAIL_SHOWN),
    }));

  return {
    latest,
    upcoming,
    popular,
    franchises,
    catalogue,
    repackaged,
    redone,
    /* Empty below the floor rather than short — the screen tests `length` and a
       partially-filled rail is the thing the floor exists to prevent. */
    best: rated.length >= BEST_FLOOR ? best.slice(0, BEST_SHOWN) : [],
    /* The banner is the studio's best-reviewed game, and it is deliberately
       uncredited: it is also the first poster in the rail directly below, so the
       association is made by adjacency. A caption naming it would be a line of
       type explaining a picture the reader is about to see again.

       A list, in that order, of the games that have art at all — the screen
       takes the first whose art it can use (see `BANNER_MAX_ASPECT`). */
    bannerCandidates: [...new Set([...best, ...catalogue])].filter((game) => !!game.heroUrl),
    span: yearsOf(catalogue),
    /* Over the same rated originals and behind the same floor as the "Best"
       rail: an average of two scores is two games, not a studio's standing. */
    average:
      rated.length >= BEST_FLOOR
        ? Math.round(rated.reduce((sum, game) => sum + (game.score ?? 0), 0) / rated.length)
        : null,
  };
}

/** The catalogue's first and last release years, when both are known. */
function yearsOf(games: readonly GameSearchResult[]): string | null {
  const years = games
    .map((game) => game.releaseYear)
    .filter((year): year is number => year !== null);

  if (years.length === 0) return null;

  const first = Math.min(...years);
  const last = Math.max(...years);
  // A studio with one release year says the year, not a range of it to itself.
  return first === last ? String(first) : `${first}–${last}`;
}

/**
 * A studio's catalogue.
 *
 * ## What this stopped being
 *
 * A count and a hundred-cover grid, which is the right page for a reader who
 * already knows the studio and is checking what they shipped last year, and the
 * wrong one for everybody else: a publisher's page opened from a game they liked
 * answered "here is everything, in release order" when the question was "what
 * else of theirs is good". Four hundred covers deep, release order is close to
 * random.
 *
 * So the grid stays — it is the record, and the sort row is what makes it usable
 * — and bands go above it, each answering a question release order cannot:
 * what is newest, what is best rated, what people played most, what is coming,
 * each of its big franchises (the owner's, 2026-10-22), what it has gone back
 * and redone, and which of its games exist in more than one box. Every one
 * comes out of the list already fetched; see `shelves`.
 *
 * ## The page and its controls are the banner's Material 3
 *
 * The header is SimpMusic's artist page, read from `ArtistScreen.kt`: the
 * artwork square and full width, pinned behind the page (`<PinnedHero>`) and
 * melting into the banner game's Material 3 page — the owner's, 2026-10-22 —
 * with the studio's name set over the bottom: as its logo, when Wikimedia
 * Commons has a public-domain one (`useStudioLogo`, `<StudioIdentity>`), else
 * as type in the same scheme's ink.
 *
 * The controls wear the same scheme (`<AccentProvider>`), as a game's page's
 * do — the owner's (2026-10-27): "integrate all of this into the other pages
 * that had the same thing, studio and collection screen".
 *
 * ## What arrives, and when
 *
 * The name is on screen from the route. Everything else is two IGDB requests
 * away — the company, then its games (`useStudioCatalogue`) — and then the
 * banner and its colour, read from a 3 KB thumbnail of the banner art while the
 * art itself downloads, so the colour lands first and the art on it. The
 * banner downloads ahead of every cover (`priority`), and the grid exists only
 * a screen either side of the scroll, so two hundred covers do not race it.
 *
 * A studio opened before skips the wait for the two that matter most: its
 * banner is remembered (`useStudioBanner`), so the art comes from the disk
 * cache and the colour from the colour store before IGDB has answered. The
 * logo, when there is one, is a month-long answer on the device and costs no
 * IGDB request of its own (`useStudioLogo`).
 *
 * IGDB-only. Company ids come from `getGameExtras` and nothing else in the app
 * has an equivalent, so studio names are only tappable on IGDB titles.
 */
export default function StudioScreen() {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const companyId = Number(id);
  const [sort, setSort] = useState<GameSort>('newest');

  const games = useStudioCatalogue(companyId);

  /* Banner games whose art loaded as a strip the square cannot show. Set from
     the image's own load event, so it only ever grows by one per bad strip. */
  const [strips, setStrips] = useState<readonly string[]>([]);

  /* The day the page opened, to the minute: what "out" means for its rails. */
  const [now] = useState(() => Date.now());
  const {
    catalogue,
    repackaged,
    redone,
    best,
    latest,
    upcoming,
    popular,
    franchises,
    bannerCandidates,
    span,
    average,
  } = useMemo(() => shelves(games.data ?? [], now), [games.data, now]);

  const ordered = useMemo(() => sortGames(catalogue, sort), [catalogue, sort]);

  const banner = bannerCandidates.find((game) => !strips.includes(game.id)) ?? null;

  /* The art on screen: the catalogue's banner, and while the catalogue is
     still on its way, the one this device showed last time — so a studio
     opened before is never waiting on IGDB for its banner or its colour. */
  const bannerUrl = useStudioBanner(companyId, games.data ? (banner?.heroUrl ?? null) : undefined);

  /* The trailer behind the banner: the banner game's own, so the video is of
     the picture it replaces — and only once that picture is the catalogue's
     choice, never the art remembered from last time. */
  const trailer = useGameTrailer(banner && banner.heroUrl === bannerUrl ? banner.id : null);
  const trailers = useTrailerSetting();

  const tileWidth = gridItemWidth(width, COLUMNS, Spacing.x16, GAP);
  const bannerHeight = Math.round(Math.min(width, height * FRAME_MAX_RATIO));

  /*
   * The page's colour: the banner game's Material 3 page, as its own game
   * page has — the owner's (2026-10-22): "make the background color for that
   * page back to normal m3, don't darken it" — and its controls the same
   * scheme's, through the provider below. The app's own page until there is a
   * banner, and with game colours off. A trailer's letterbox bars show
   * against the page.
   */
  const accent = useGameAccent(bannerUrl, banner?.genres ?? null);
  const pageColor = bannerUrl && accent.tonal ? accent.page : null;
  const page = pageColor ?? theme.background;
  const nameColor = pageColor ? accent.onSurface : undefined;
  const playingTrailer = trailers.ready && trailers.on ? (trailer?.url ?? null) : null;

  /* Solid page colour, and the top bar in, once the name has gone under the
     bar — the line under it reaching the bar's foot — as on the game page. */
  const topInset = useTopBarInset();
  const barHeader = bannerHeight - Spacing.x24 - (games.data ? META_LINE : 0);
  const solidAt = Math.max(1, revealOffset(barHeader, topInset + TOP_BAR_ROW));
  /* The handoff to the glass bar: from the name's (or the logo's) top
     reaching the bar's foot to its foot reaching it, as on the game page. */
  const [nameHeight, setNameHeight] = useState<number | null>(null);
  const handoff = handoffBand(
    barHeader - (nameHeight ?? NAME_ESTIMATE),
    barHeader,
    topInset + TOP_BAR_ROW
  );

  /* The logo, when Commons has a free one. The name is on screen from the
     route in the meantime, and stays whenever there is none. */
  const logo = useStudioLogo(companyId, name);

  const keyExtractor = useCallback((game: StudioGame) => game.id, []);
  const renderItem = useCallback(
    ({ item }: { item: StudioGame }) => <StudioGridItem item={item} tileWidth={tileWidth} />,
    [tileWidth]
  );

  if (!Number.isFinite(companyId)) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back title="Studio" />}>
        <EmptyState title="Studio not found" />
      </Screen>
    );
  }

  return (
    <AccentProvider artwork={bannerUrl} genres={banner?.genres ?? null}>
      {/* No `insetHeader`: the banner runs under the glass discs, which stay
            put (`glass`, Apple's bar); the bar fades in under them with the
            studio's name once the name has gone under it, by when the banner
            is solid page colour. */}
      <Screen
        edges={['bottom']}
        background={page}
        /* Behind the page: its colour, then the banner pinned at the top of
             the display (`<PinnedHero>`) — the game page's, here too. */
        backdrop={
          <>
            <PageFill color={page} />
            <PinnedHero
              uri={bannerUrl}
              height={bannerHeight}
              page={page}
              fade={BANNER_FADE}
              solidAt={solidAt}
              scrim={0.4}
              veil={VEIL}
              onLoad={({ width: artWidth, height: artHeight }) => {
                if (
                  banner &&
                  banner.heroUrl === bannerUrl &&
                  artHeight > 0 &&
                  artWidth / artHeight > BANNER_MAX_ASPECT
                ) {
                  setStrips((previous) => [...previous, banner.id]);
                }
              }}
              media={(art) => (
                <TrailerBackdrop url={playingTrailer} height={bannerHeight} until={solidAt}>
                  {art}
                </TrailerBackdrop>
              )}
            />
          </>
        }
        topBar={
          <FrostedTopBar
            back
            glass
            title={name}
            header={barHeader}
            handoff={handoff}
            /* The trailer on and off — SimpMusic's video ⇄ picture key,
                 opposite the back disc — shown only when there is one. */
            right={
              trailer ? (
                <TopBarDisc
                  icon={trailers.on ? 'videocam-off-outline' : 'videocam-outline'}
                  label={trailers.on ? 'Stop the trailer' : 'Play the trailer'}
                  onPress={() => trailers.setOn(!trailers.on)}
                />
              ) : undefined
            }
          />
        }>
        <PageFlatList
          settle={handoff}
          data={ordered}
          key={`grid-${COLUMNS}`}
          numColumns={COLUMNS}
          keyExtractor={keyExtractor}
          /* Opaque, edge to edge, and spaced by their own padding rather than
               the list's gap, which would leave slits of the art between rows. */
          columnWrapperStyle={[styles.column, { backgroundColor: page }]}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          initialNumToRender={GRID_INITIAL_ITEMS}
          maxToRenderPerBatch={GRID_BATCH_ITEMS}
          windowSize={GRID_WINDOW}
          renderItem={renderItem}
          removeClippedSubviews={Platform.OS === 'android'}
          ListHeaderComponent={
            <View>
              {/* The solid part's soft top edge, under the name block: the art
                    the name floats on gives way to the page here. */}
              <View pointerEvents="none" style={[styles.lip, { top: bannerHeight - LIP }]}>
                <LinearGradient
                  colors={lipColours(page)}
                  locations={
                    LIP_STOPS.locations as unknown as readonly [number, number, ...number[]]
                  }
                  style={styles.fill}
                />
              </View>

              {/* Where the banner shows through, with the studio's name over its
                    foot — in the page, so it floats up over the art as the page
                    scrolls. Out of flow, so a logo replacing the name moves
                    nothing below. */}
              <View style={{ height: bannerHeight }}>
                <View style={styles.identity}>
                  <HandoffTitle band={handoff} onHeight={setNameHeight}>
                    <StudioIdentity
                      name={name}
                      logo={logo.data}
                      pageColor={page}
                      maxWidth={Math.round(width * LOGO_WIDTH_RATIO)}
                      nameColor={nameColor}
                    />
                  </HandoffTitle>
                  {games.data && (
                    <Text
                      variant="body"
                      style={[styles.meta, { color: withAlpha(theme.text, META_ALPHA) }]}>
                      {`${catalogue.length} ${catalogue.length === 1 ? 'game' : 'games'}`}
                      {span ? ` · ${span}` : ''}
                      {average !== null && (
                        <>
                          {' · Average rating '}
                          {/* The score's own ramp, never the accent: a blue 55
                                would read as endorsed (CLAUDE.md, "One score ramp"). */}
                          <Text variant="h5" style={{ color: scoreColor(average, theme) }}>
                            {average}
                          </Text>
                        </>
                      )}
                    </Text>
                  )}
                </View>
              </View>

              {/* The page's solid part: the rails, opaque, rising over the art. */}
              <View style={[styles.solid, { backgroundColor: page }]}>
                {/* The rails rise into place as they scroll into view. */}
                <RevealScope>
                  <StudioShelves
                    latest={latest}
                    best={best}
                    popular={popular}
                    upcoming={upcoming}
                    franchises={franchises}
                    redone={redone}
                    repackaged={repackaged}
                    count={catalogue.length}
                    sort={sort}
                    onSort={setSort}
                  />
                </RevealScope>
              </View>
            </View>
          }
          ListEmptyComponent={
            games.isLoading ? (
              <View style={styles.skeletonGrid}>
                {Array.from({ length: 12 }).map((_, index) => (
                  <Skeleton
                    key={index}
                    width={tileWidth}
                    height={tileWidth / (2 / 3)}
                    radius={Radius.image}
                  />
                ))}
              </View>
            ) : games.isLoadingError ? (
              <ErrorState error={games.error} />
            ) : (
              <EmptyState title="No games found" message="IGDB has no catalogue for this studio." />
            )
          }
        />
      </Screen>
    </AccentProvider>
  );
}

/**
 * The studio's rails and the grid's heading — in their own memoised component
 * so that nothing but the catalogue (and the sort) redraws them.
 *
 * They were the list's header inline, so every render of the screen — the
 * catalogue landing, then the banner, its colour, the logo, the trailer and
 * its setting, each a render of its own — redrew seven rails of a dozen
 * covers. On Sony's page that was three seconds of a blocked JS thread
 * ("VirtualizedList: You have a large list that is slow to update", `dt`
 * 3,023 ms, the owner's log, 2026-10-27). The shelves are `useMemo`'d off the
 * catalogue and `setSort` is stable, so this renders when they change and not
 * otherwise.
 */
const StudioShelves = memo(function StudioShelves({
  latest,
  best,
  popular,
  upcoming,
  franchises,
  redone,
  repackaged,
  count,
  sort,
  onSort,
}: {
  latest: StudioGame[];
  best: StudioGame[];
  popular: StudioGame[];
  upcoming: StudioGame[];
  franchises: { id: number; name: string; games: StudioGame[] }[];
  redone: StudioGame[];
  repackaged: StudioGame[];
  count: number;
  sort: GameSort;
  onSort: (sort: GameSort) => void;
}) {
  return (
    <View style={styles.header}>
      {/* The bands, in the order the questions get asked: what is new, what is
          worth playing, what people played, what is coming, its franchises,
          what has been redone, what exists twice. Each renders nothing at all
          below its floor — see `BEST_FLOOR`, `RAIL_FLOOR` and
          `FRANCHISE_FLOOR` — because a heading is a claim. Rows of games, as
          every one in the app is: a heading on the page and small covers under
          it, the rail edge to edge (`railBleed`). */}
      {latest.length >= RAIL_FLOOR && (
        <HomeSection title="Latest releases">
          <View style={styles.railBleed}>
            <GameCoverRail games={latest} inset={RAIL_INSET} />
          </View>
        </HomeSection>
      )}

      {best.length > 0 && (
        <HomeSection title="Best rated">
          <View style={styles.railBleed}>
            <GameCoverRail games={best} inset={RAIL_INSET} />
          </View>
        </HomeSection>
      )}

      {popular.length >= BEST_FLOOR && (
        <HomeSection title="Most popular">
          <View style={styles.railBleed}>
            <GameCoverRail games={popular} inset={RAIL_INSET} />
          </View>
        </HomeSection>
      )}

      {upcoming.length > 0 && (
        <HomeSection title="Coming soon">
          <View style={styles.railBleed}>
            <GameCoverRail games={upcoming} inset={RAIL_INSET} />
          </View>
        </HomeSection>
      )}

      {franchises.map((franchise) => (
        <HomeSection key={franchise.id} strapline="Franchise" title={franchise.name}>
          <View style={styles.railBleed}>
            <GameCoverRail games={franchise.games} inset={RAIL_INSET} />
          </View>
        </HomeSection>
      ))}

      {redone.length >= RAIL_FLOOR && (
        <HomeSection title="Remakes & remasters">
          <View style={styles.railBleed}>
            <GameCoverRail games={redone} inset={RAIL_INSET} />
          </View>
        </HomeSection>
      )}

      {repackaged.length >= RAIL_FLOOR && (
        <HomeSection title="Special editions">
          <View style={styles.railBleed}>
            <GameCoverRail games={repackaged} inset={RAIL_INSET} />
          </View>
        </HomeSection>
      )}

      {/* The heading the grid needs now that it is no longer the whole page:
          with rails above it, an unlabelled grid reads as a rail that failed
          to lay out. The sort row only once there is a catalogue to reorder. */}
      {count > 0 && (
        <HomeSection title="All games">
          {count > 1 && (
            <View style={styles.sort}>
              <SortBar
                options={SORTS}
                value={sort}
                onChange={onSort}
                accessibilityLabel="Sort this studio's games"
              />
            </View>
          )}
        </HomeSection>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  grid: { paddingHorizontal: Spacing.x16, paddingBottom: Spacing.x48 },
  /* A row of the grid: edge to edge (the list's padding undone and put back
     inside), and its gap below it rather than the list's between rows. */
  column: {
    gap: GAP,
    marginHorizontal: -Spacing.x16,
    paddingHorizontal: Spacing.x16,
    paddingBottom: GAP,
  },
  /* The page's solid part: edge to edge, and the list's gap before the grid. */
  solid: {
    marginHorizontal: -Spacing.x16,
    paddingHorizontal: Spacing.x16,
    paddingBottom: GAP,
  },
  lip: { position: 'absolute', left: -Spacing.x16, right: -Spacing.x16, height: LIP },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  /* `x32` between the bands — the reference's 32 between sections, Home's
     interval too — and tighter inside the header's own blocks: the rails are
     separate subjects and the identity block is one. */
  header: { gap: Spacing.x32, paddingBottom: Spacing.x16 },
  /* The reference's name block: centred, 20 in from each side, 16 up from the
     edge (`x24`, the ladder's 15), and 4 between the name and the line under it. */
  identity: {
    position: 'absolute',
    left: Spacing.x32,
    right: Spacing.x32,
    bottom: Spacing.x24,
    alignItems: 'center',
    gap: Spacing.x4,
  },
  meta: { textAlign: 'center' },
  /* `<HomeSection>` insets its own heading but leaves its children to bleed, for
     the rails. The sort row is not a rail and needs the inset back. */
  sort: { paddingHorizontal: Spacing.x16 },
  /* Cancels the list's horizontal padding so a rail reaches both edges. */
  railBleed: { marginHorizontal: -Spacing.x16 },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
});
