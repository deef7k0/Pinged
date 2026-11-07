import Ionicons from '@expo/vector-icons/Ionicons';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { CriticReviews } from '@/components/critic-reviews';
import { MemberReviewCard } from '@/components/member-review-card';
import { ReviewBreakdown } from '@/components/review-breakdown';
import { ScoreMethodNote } from '@/components/score-method-note';
import { ScoreSummary } from '@/components/score-summary';
import { Button } from '@/components/ui/button';
import { Pager } from '@/components/ui/pager';
import { InsetGroup } from '@/components/ui/inset-group';
import { PullDownRow } from '@/components/ui/pull-down-row';
import { Tray } from '@/components/ui/tray';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/screen';
import { SortBar, type SortOption } from '@/components/ui/sort-bar';
import { Text } from '@/components/ui/text';
import { PLATFORM_FAMILIES, familyForStored } from '@/constants/platform-family';
import { ArtRowWindow } from '@/constants/list-window';
import { SmallControlSlop, Spacing, TapTarget, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  REVIEW_PAGE_SIZE,
  getGameReviewPage,
  getGameReviewRanking,
  getRatingBreakdown,
  getReviewLanguages,
  getReviewStats,
  type ReviewListItem,
  type ReviewSort,
} from '@/lib/api';
import { languageFacets } from '@/lib/discovery';
import { displayNameFor } from '@/lib/format';
import { clampPage, pageCountFor } from '@/lib/games/paging';
import {
  PLAY_FILTERS,
  PROGRESS_FILTERS,
  platformFacets,
  reviewBreakdown,
  type ReviewFilters,
  type ReviewPlayFilter,
  type ReviewProgressFilter,
} from '@/lib/review-facets';
import { useAuth } from '@/store/auth';

/**
 * How much of a review the list prints.
 *
 * Ten, against the five a card in the Overview's rail shows and the five in the
 * feed, and the difference is deliberate: those are samples offered to somebody
 * reading about a game or scrolling past one, and this is the screen they opened
 * *because* they want the reviews. Ten lines is most of a short review and enough
 * of a long one to tell whether the writer has a point — and it is a clamp rather
 * than a target, so the row stays a fixed, scannable height.
 *
 * None of the three expand in place. A clamp that can be opened makes a row in a
 * scrolling list change height under the thumb; the review's own page is the
 * screen with no clamp at all.
 */
const REVIEW_LINES = 10;

const SORTS: readonly SortOption<ReviewSort>[] = [
  { key: 'popular', label: 'Most liked' },
  { key: 'newest', label: 'Newest' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
];

/**
 * Score filters, as decades.
 *
 * Bounds rather than bands: "80+" is what somebody scanning for a good game
 * actually asks, and it composes — 70+ includes the 90s. The one exception is
 * the last entry, which is the only *upper* bound and the only way to find the
 * reviews that disliked it.
 */
const SCORES: readonly { key: string; label: string; min: number | null; max: number | null }[] = [
  { key: 'any', label: 'Any score', min: null, max: null },
  { key: '90', label: '90+', min: 90, max: null },
  { key: '80', label: '80+', min: 80, max: null },
  { key: '70', label: '70+', min: 70, max: null },
  { key: '60', label: '60+', min: 60, max: null },
  { key: 'low', label: 'Below 60', min: null, max: 59 },
];

const ANY = { key: 'any', label: 'Any' } as const;

/** Between the two quiet links under the score. */
const LINKS_GAP = Spacing.x24;

/**
 * A line of `bodySmall` as a link, reached at the tap floor through slop —
 * except underneath, where it stops at the note's own slop
 * (`<ScoreMethodNote>`'s), so the two touch boxes meet and do not overlap.
 */
const LINK_REACH = Math.ceil(Math.max(0, TapTarget - Type.bodySmall.lineHeight) / 2);
const RATERS_SLOP = {
  top: LINK_REACH,
  bottom: Math.max(0, LINKS_GAP - LINK_REACH),
  left: Spacing.x8,
  right: Spacing.x8,
};

const PROGRESS_OPTIONS: readonly SortOption<ReviewProgressFilter | 'any'>[] = [
  ANY,
  ...PROGRESS_FILTERS,
];

const PLAY_OPTIONS: readonly SortOption<ReviewPlayFilter | 'any'>[] = [ANY, ...PLAY_FILTERS];

/** A stored platform → its family's key: the resolver `review-facets` folds by. */
const familyKeyOf = (stored: string) => familyForStored(stored)?.key ?? null;

export type GameReviewsSheetProps = {
  gameId: string;
  gameTitle: string;
  /** For matching the game on OpenCritic, which goes by title and year. */
  releaseYear: number | null;
  /** IGDB's aggregate of critics' scores: the critics' section, when OpenCritic has no quotes. */
  criticScore: number | null;
};

/**
 * Everything written about one game: what the critics made of it, then every
 * review the people here wrote, sorted, filtered and in pages of fifteen.
 *
 * **Pages, like the rest of the app's long lists** — the owner's direction
 * (2026-10-20): "The review sheet should have the reviews be categorized in
 * pages, like the other search stuff in the app. Show 15 reviews per page."
 * The same `<Pager>` as a platform's games and a facet's: the numbers around
 * the page you are on, the arrows, a field for any page — over the list and,
 * plainly, under it. Sorting or filtering starts again at page one: page 5 of
 * a different list is nowhere. The pages are slices of one ranking of ids
 * (`getGameReviewRanking`), so the count is exact and a page turn fetches
 * fifteen reviews and nothing else; the last fifteen stay on screen, dimmed,
 * while the next arrive.
 *
 * **Critics first, members under them** — the owner's direction (2026-10-09).
 * The critics' quotes were a rail on the game page's Overview; they are the
 * section at the head of this sheet now (`<CriticReviews>`), and under it,
 * headed as its own section, is the app's: GameLog's verdict, how it divides
 * by how people played, and the list.
 *
 * Lives inside `<SlideUpSheet>` rather than on a route, which is what lets the
 * game page stay mounted underneath and be revealed by a drag rather than by a
 * navigation. It replaced the game page's Reviews tab: a tab put the writing
 * behind a control that also switched between a synopsis and a similar-games
 * rail, and reviews are the one thing on that page somebody comes back for.
 */
export function GameReviewsSheet({
  gameId,
  gameTitle,
  releaseYear,
  criticScore,
}: GameReviewsSheetProps) {
  const theme = useTheme();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;

  const [sort, setSort] = useState<ReviewSort>('popular');
  const [score, setScore] = useState('any');
  /** A platform family's key — "playstation" — or "other". */
  const [family, setFamily] = useState<string | null>(null);
  const [progress, setProgress] = useState<ReviewProgressFilter | null>(null);
  const [play, setPlay] = useState<ReviewPlayFilter | null>(null);
  /** One `logs.review_lang` code — "es" — or null for every language. */
  const [language, setLanguage] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  /* The page, tagged with the list it is a page of — so a new sort or filter
     is page one without an effect resetting it. */
  const [paging, setPaging] = useState<{ list: string; page: number }>({ list: '', page: 1 });
  const listRef = useRef<FlatList<ReviewListItem>>(null);
  /* Where the pager over the list starts, inside the sheet's scroll: the
     members' block's place in the header, and the pager's in that block. */
  const [membersY, setMembersY] = useState(0);
  const [pagerY, setPagerY] = useState(0);

  /* Gamelog's own numbers for this game (0026), and the platforms the list can
     be narrowed to. Independent of the filters, like the histogram below: the
     breakdown is what the game scored, and re-drawing it for "Co-op" would
     print one row and call it the verdict. */
  const stats = useQuery({
    queryKey: ['review-stats', gameId],
    queryFn: () => getReviewStats(gameId),
    staleTime: 60_000,
  });

  const facets = useMemo(
    () => platformFacets(stats.data?.written_platforms ?? [], PLATFORM_FAMILIES, familyKeyOf),
    [stats.data]
  );
  const sections = useMemo(
    () => (stats.data ? reviewBreakdown(stats.data, PLATFORM_FAMILIES, familyKeyOf) : []),
    [stats.data]
  );

  /*
   * The languages this game's reviews are written in (0038), for the fifth
   * filter. Offered only when there are two — a filter with one choice filters
   * nothing — and never applied by itself: this is a game's own page, where
   * every review is shown until the reader narrows it. (A chart chooses by
   * language; a game's reviews do not. See `lib/language`.)
   */
  const written = useQuery({
    queryKey: ['review-languages', gameId],
    queryFn: () => getReviewLanguages(gameId),
    staleTime: 5 * 60_000,
  });
  const languages = useMemo(() => languageFacets(written.data ?? []), [written.data]);
  const languageOptions = useMemo(
    () => [ANY, ...languages.map(({ code, label }) => ({ key: code, label }))],
    [languages]
  );

  const band = SCORES.find((entry) => entry.key === score) ?? SCORES[0];
  const filters: ReviewFilters = useMemo(
    () => ({
      /* Every spelling the family was recorded under. A family that has since
         lost its last review sends an empty list, which finds nothing — rather
         than quietly widening to every platform under a pill that says one. */
      platforms: family ? (facets.find((facet) => facet.key === family)?.values ?? []) : null,
      minScore: band.min,
      maxScore: band.max,
      progress,
      play,
      language,
    }),
    [family, facets, band.min, band.max, progress, play, language]
  );

  const activeFilters =
    (family ? 1 : 0) +
    (score !== 'any' ? 1 : 0) +
    (progress ? 1 : 0) +
    (play ? 1 : 0) +
    (language ? 1 : 0);

  /* What the list is narrowed to, in words — said under the Filters button
     whether the panel is open or not, so a narrowed list never looks like
     the whole of it. */
  const narrowedTo = [
    score !== 'any' ? `scored ${band.label}` : null,
    family ? `on ${facets.find((facet) => facet.key === family)?.label ?? family}` : null,
    progress ? PROGRESS_OPTIONS.find((option) => option.key === progress)?.label : null,
    play ? PLAY_OPTIONS.find((option) => option.key === play)?.label : null,
    language
      ? `in ${languageOptions.find((option) => option.key === language)?.label ?? language}`
      : null,
  ].filter((part): part is string => !!part);

  function clearFilters() {
    setFamily(null);
    setScore('any');
    setProgress(null);
    setPlay(null);
    setLanguage(null);
  }

  /* Every review the sort and filters admit, as ids, in order. Under the key
     the log form, the progress sheet and a moderator's removal invalidate. */
  const ranking = useQuery({
    queryKey: ['game-review-list', gameId, sort, filters],
    queryFn: () => getGameReviewRanking(gameId, sort, filters),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const list = JSON.stringify([sort, filters]);
  const ids = ranking.data ?? null;
  const total = ids?.length ?? null;
  const pageCount = total === null ? null : pageCountFor(total, REVIEW_PAGE_SIZE);
  const page = clampPage(paging.list === list ? paging.page : 1, pageCount ?? 1);
  const pageIds = useMemo(
    () => ids?.slice((page - 1) * REVIEW_PAGE_SIZE, page * REVIEW_PAGE_SIZE) ?? null,
    [ids, page]
  );

  const reviews = useQuery({
    queryKey: ['game-review-list', gameId, 'page', pageIds, viewerId],
    queryFn: () => getGameReviewPage(pageIds ?? [], viewerId),
    enabled: pageIds !== null,
    staleTime: 60_000,
    /* The last fifteen stand, dimmed, while the next arrive. */
    placeholderData: keepPreviousData,
  });

  function turnTo(next: number) {
    setPaging({ list, page: next });
    /* Back to the head of the list — the pager over it — not of the sheet. */
    listRef.current?.scrollToOffset({ offset: membersY + pagerY, animated: false });
  }

  const turning = ranking.isPlaceholderData || reviews.isPlaceholderData;
  const summary =
    total === null ? null : `${total.toLocaleString()} ${total === 1 ? 'review' : 'reviews'}`;

  /* The distribution is every rated log, not just the written ones, and it is
     deliberately independent of the filters above — the graph is what the game
     scored, and re-drawing it for "90+" would show one green bar and claim it
     was the verdict. */
  const breakdown = useQuery({
    queryKey: ['rating-breakdown', gameId],
    queryFn: () => getRatingBreakdown(gameId),
    staleTime: 60_000,
  });

  const header = (
    <View>
      {/* App Store's "Ratings & Reviews" (the Apple pass, 2026-11-05): the
          sheet opened from the game's page, so it does not repeat the game's
          name, nor print "REVIEWS" under it. */}
      <View style={styles.title}>
        <Text variant="h2" accessibilityRole="header">
          Ratings & Reviews
        </Text>
      </View>

      {/* What the critics wrote, or — when OpenCritic has nothing to quote —
          IGDB's average of their scores. Nothing at all when there is neither.
          Outside the padded block below: its rail runs to the sheet's edges. */}
      <CriticReviews
        gameId={gameId}
        title={gameTitle}
        releaseYear={releaseYear}
        igdbScore={criticScore}
      />

      <View
        style={styles.header}
        onLayout={(event: LayoutChangeEvent) => setMembersY(event.nativeEvent.layout.y)}>
        {/* The app's own, headed as a section so it reads as the second of
            two — and so a sheet with no critics still says whose these are. */}
        <Text variant="h4" accessibilityRole="header" style={styles.members}>
          Pinged reviews
        </Text>

        {/* The same summary the Ratings card on the Overview draws
            (`<ScoreSummary>`). No "GAMELOG" label over it: the heading says it. */}
        <ScoreSummary
          gameId={gameId}
          breakdown={breakdown.data ?? null}
          loading={breakdown.isPending}
        />
        {/* Everybody the score is made of, written or not — and the score's
            method, one tap away wherever the score itself is explained. */}
        {breakdown.data && (
          <View style={styles.links}>
            <Link
              href={{ pathname: '/ratings/[id]', params: { id: gameId, title: gameTitle } }}
              asChild>
              <PressableScale
                accessibilityRole="link"
                accessibilityLabel={`Everyone who rated ${gameTitle}: ${breakdown.data.total.toLocaleString()} ${
                  breakdown.data.total === 1 ? 'rating' : 'ratings'
                }`}
                hitSlop={RATERS_SLOP}
                scaleTo={0.98}
                style={StyleSheet.flatten(styles.raters)}>
                <Ionicons name="people-outline" size={14} color={theme.textSecondary} />
                <Text variant="bodySmall" color="textSecondary">
                  {`Everyone who rated it · ${breakdown.data.total.toLocaleString()}`}
                </Text>
                <Ionicons name="chevron-forward" size={12} color={theme.textMuted} />
              </PressableScale>
            </Link>
            <ScoreMethodNote />
          </View>
        )}

        <ReviewBreakdown
          sections={sections}
          failed={stats.isLoadingError}
          onRetry={() => void stats.refetch()}
        />

        <View style={styles.controls}>
          <SortBar
            options={SORTS}
            value={sort}
            onChange={setSort}
            accessibilityLabel="Sort reviews"
          />

          {/* One key for the filters, which open as a tray of menus (the
              Apple pass, 2026-11-05) — it was a pill unfolding a card of five
              questions in the list. Lit, with the count, while any is on. */}
          <PressableScale
            accessibilityRole="button"
            accessibilityState={{ expanded: filtersOpen }}
            accessibilityLabel={activeFilters > 0 ? `Filters, ${activeFilters} on` : 'Filters'}
            onPress={() => setFiltersOpen(true)}
            scaleTo={0.92}
            hitSlop={SmallControlSlop}
            pressedColor={theme.controlPressed}
            style={StyleSheet.flatten([
              styles.filterKey,
              { backgroundColor: activeFilters > 0 ? theme.text : theme.controlFill },
            ])}>
            <Ionicons
              name="options-outline"
              size={18}
              color={activeFilters > 0 ? theme.onPrimary : theme.text}
            />
            {activeFilters > 0 && (
              <Text variant="h5" style={{ color: theme.onPrimary }}>
                {activeFilters}
              </Text>
            )}
          </PressableScale>
        </View>

        {narrowedTo.length > 0 && (
          <Text variant="bodySmall" color="textSecondary" accessibilityLiveRegion="polite">
            {`Showing reviews ${narrowedTo.join(' · ')}`}
          </Text>
        )}

        {/* Five questions, each one choice, and they compose: PC + Finished +
          Co-op is three clauses on one request (`lib/review-facets.ts`). The
          platforms offered are only the families somebody has reviewed this
          game on, and the languages only the ones somebody reviewed it in;
          the other three are fixed vocabularies, and one that finds nothing
          says so in the list below. */}
        <Tray visible={filtersOpen} onClose={() => setFiltersOpen(false)}>
          <View style={styles.tray}>
            <Text variant="h4" accessibilityRole="header" style={styles.trayTitle}>
              Filter reviews
            </Text>
            <InsetGroup>
              <PullDownRow
                title="Score"
                choices={SCORES.filter((entry) => entry.key !== 'any').map(({ key, label }) => ({
                  value: key,
                  label,
                }))}
                value={score === 'any' ? null : score}
                onChange={(next) => setScore(next ?? 'any')}
                anyLabel="Any score"
              />
              {facets.length > 0 ? (
                <PullDownRow
                  title="Played on"
                  choices={facets.map(({ key, label }) => ({ value: key, label }))}
                  value={family}
                  onChange={setFamily}
                  anyLabel="Any"
                />
              ) : null}
              <PullDownRow
                title="How far they got"
                choices={PROGRESS_FILTERS.map(({ key, label }) => ({ value: key, label }))}
                value={progress}
                onChange={setProgress}
                anyLabel="Any"
              />
              <PullDownRow
                title="Solo or co-op"
                choices={PLAY_FILTERS.map(({ key, label }) => ({ value: key, label }))}
                value={play}
                onChange={setPlay}
                anyLabel="Any"
              />
              {languages.length > 0 ? (
                <PullDownRow
                  title="Written in"
                  choices={languages.map(({ code, label }) => ({ value: code, label }))}
                  value={language}
                  onChange={setLanguage}
                  anyLabel="Any"
                />
              ) : null}
            </InsetGroup>
            <View style={styles.trayActions}>
              <View style={styles.flex}>
                <Button
                  title="Clear"
                  variant="secondary"
                  fullWidth
                  disabled={activeFilters === 0}
                  onPress={clearFilters}
                />
              </View>
              <View style={styles.flex}>
                <Button title="Done" fullWidth onPress={() => setFiltersOpen(false)} />
              </View>
            </View>
          </View>
        </Tray>

        {/* The pages, once there is more than one. */}
        {/* How many, and the pages at the foot only (the Apple pass). The
            line is where a page turn returns the list to. */}
        {!!summary && (
          <View
            style={styles.pager}
            onLayout={(event: LayoutChangeEvent) => setPagerY(event.nativeEvent.layout.y)}>
            <Text variant="bodySmall" color="textSecondary">
              {pageCount !== null && pageCount > 1
                ? `${summary} · page ${page} of ${pageCount}`
                : summary}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <FlatList
      ref={listRef}
      data={reviews.data ?? []}
      keyExtractor={(item) => item.log.id}
      {...ArtRowWindow}
      ListHeaderComponent={header}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      renderItem={renderReviewRow}
      /* Only the rows dim while a page turns: the header holds the controls. */
      CellRendererComponent={turning ? DimmedCell : undefined}
      ListFooterComponent={
        pageCount !== null && pageCount > 1 && (reviews.data?.length ?? 0) > 0 ? (
          <View style={styles.foot}>
            <Pager page={page} pageCount={pageCount} onChange={turnTo} detail={false} />
          </View>
        ) : null
      }
      ListEmptyComponent={
        ranking.isPending || (ids !== null && ids.length > 0 && reviews.isPending) ? (
          <LoadingState label="Loading reviews…" />
        ) : ranking.isLoadingError || reviews.isLoadingError ? (
          <ErrorState
            error={ranking.error ?? reviews.error}
            onRetry={() => void (ranking.isLoadingError ? ranking.refetch() : reviews.refetch())}
          />
        ) : (
          <EmptyState
            title={activeFilters > 0 ? 'Nothing matches those filters' : 'No reviews yet'}
            message={
              activeFilters > 0
                ? 'Loosen one of them, or clear them to see everything written about this game.'
                : 'Nobody here has written about this one.'
            }
            action={
              activeFilters > 0 ? (
                <Button title="Clear filters" variant="secondary" onPress={clearFilters} />
              ) : undefined
            }
          />
        )
      }
    />
  );
}

/**
 * One review, as the owner's reference draws one (2026-10-20): the words
 * first, a rule under them, and the writer along the foot — face, name, and
 * the score as GameLog says it, with the likes at the far end.
 *
 *     the first line of the review…
 *     the second line…
 *     ──────────────────────────────
 *     ◍  username   84 GREAT   ♥ 12
 *
 * The card is `<MemberReviewCard>` — the one the game page's Overview shows
 * the most liked review in, so a row here and that card are the same object
 * (the owner's direction, 2026-10-09). The likes it prints are
 * already in this list's query; nothing more is asked for.
 *
 * **Neutral, not the game's colour.** On the game page the card takes the
 * game's dark tone; this sheet is raised over that page and keeps the app's
 * own surface, as its rows always have, so the list reads as the sheet's
 * rather than as more of the page under it.
 *
 * How much of the review it prints is `REVIEW_LINES`, which says why.
 */
/* Memoised, and it opens its own review: the row used to be handed a fresh
   `onPress` closure by an inline `renderItem`, so every one of up to a hundred
   rows re-rendered whenever the sheet did — a sort, a filter pill, a query
   landing — to draw exactly what it already showed. */
const ReviewRow = memo(function ReviewRow({ item }: { item: ReviewListItem }) {
  const router = useRouter();
  const theme = useTheme();
  const { log } = item;
  const onPress = useCallback(
    () => router.push({ pathname: '/review/[id]', params: { id: log.id } }),
    [router, log.id]
  );

  const name = displayNameFor(log.profile);
  const headline = log.review_title?.trim();

  return (
    <View style={styles.rowWrap}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={[
          headline ? `${name}’s review, “${headline}”` : `${name}’s review`,
          log.rating !== null ? `scored ${Math.round(log.rating)}` : null,
          log.spoilers ? 'Contains spoilers' : null,
          item.likes > 0 ? `${item.likes} ${item.likes === 1 ? 'like' : 'likes'}` : null,
          'Read all of it.',
        ]
          .filter(Boolean)
          .join('. ')}
        onPress={onPress}
        scaleTo={0.99}>
        <MemberReviewCard
          name={name}
          avatarUrl={log.profile?.avatar_url ?? null}
          text={log.review ?? ''}
          quote={log.review_title}
          display={log.review_display}
          score={log.rating}
          likes={item.likes}
          likedByViewer={item.likedByViewer}
          lines={REVIEW_LINES}
          spoiler={!!log.spoilers}
          fill={theme.surface}
        />
      </PressableScale>
    </View>
  );
});

const renderReviewRow = ({ item }: { item: ReviewListItem }) => <ReviewRow item={item} />;

/**
 * A row of the last page, while the next is on its way. Only what a cell
 * needs is passed on: the list hands its cells its item and keys as well,
 * which a native view has no use for.
 */
function DimmedCell({
  style,
  onLayout,
  children,
}: Pick<React.ComponentProps<typeof View>, 'style' | 'onLayout' | 'children'>) {
  return (
    <View style={[style, styles.turning]} onLayout={onLayout}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.x48 },
  title: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x12, gap: Spacing.x8 },
  /* `x24` over each section's heading — the critics' has its own row's height
     above it, this one a margin: the two sections start the same distance
     under whatever is over them. */
  header: { paddingHorizontal: Spacing.x16, gap: Spacing.x8 },
  members: { marginTop: Spacing.x24, marginBottom: Spacing.x4 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.x8,
    marginTop: Spacing.x16,
  },
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
  /* A filter pill like the sort pills above it, drawn at 32 and touched at
     the floor. */
  /* The panel: one card — the sheet's own surface — holding the questions. */
  rowWrap: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x12 },
  pager: { marginTop: Spacing.x16 },
  /* Two quiet links, their touch boxes meeting and not overlapping. */
  links: { gap: LINKS_GAP, marginTop: Spacing.x4 },
  /* As wide as its words, so the sheet beside it is not a target. */
  raters: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: Spacing.x4 },
  foot: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x24 },
  turning: { opacity: 0.45 },
});
