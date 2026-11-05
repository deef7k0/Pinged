import Ionicons from '@expo/vector-icons/Ionicons';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { memo, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { HomeSection } from '@/components/home-section';
import { SectionFailed } from '@/components/search/discover-sections';
import { INSET_GROUP } from '@/components/ui/inset-group';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { SortBar } from '@/components/ui/sort-bar';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import type { EditionKind } from '@/constants/game-editions';
import { clampScore, labelFor, scoreColor } from '@/constants/score';
import { Typeface, PosterAspectRatio, Radius, Spacing, TapTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getGameLogChartPage, getGameLogRanking } from '@/lib/api';
import { getCriticChartLength, getCriticChartPage } from '@/lib/games/browse';
import { pageCountFor } from '@/lib/games/paging';
import {
  CHART_BASES,
  TOP_CHART_PAGE_SIZE,
  TOP_CHART_SIZE,
  chartLength,
  chartWindow,
  countLine,
  type ChartBasis,
  type ChartEntry,
} from '@/lib/top-chart';

/** A row's box art: as tall as a two-line title and its credit line. */
const ART_WIDTH = 44;
const ART_HEIGHT = Math.round(ART_WIDTH / PosterAspectRatio);

/** The rank's column: wide enough for "1000" in the bold figure. */
const RANK_WIDTH = 36;

/** Rows drawn while the first page is on its way. */
const SKELETON_ROWS = 5;

/**
 * The Top 1000 on Search's Discover: the best-reviewed games, ranked by the
 * people here or — at the toggle — by the critics, twenty to a page.
 *
 * The owner's request (2026-10-20): "a chart widget on the search home screen
 * and show a ranking of best reviewed games on gamelog and a toggle for critic
 * review sorting. Use pages and show 20 per page. It's a top 1000 games."
 *
 * ```text
 *   Top 1000
 *   Ranked by the scores people gave them here.
 *   ( GameLog )( Critics )
 *    1  ▯  The Legend of Zelda: Breath of the Wild        98
 *          Nintendo · 2017                          27 critics
 *    2  ▯  …
 *   ‹  1 2 3 … 50  ›
 *   Page 1 of 50 · 1,000 games                    Go to [page]
 * ```
 *
 * - **GameLog** is "Beloved by the community" over all time
 *   (`getGameLogRanking`): the community score, ordered by a damped figure so
 *   one 100 does not top thirty 94s. As long as there are rated games, up to
 *   a thousand — the live project's is fifty-five.
 * - **Critics** is IGDB's average of critics' scores, for games with at least
 *   `CRITIC_FLOOR` of them, best first (`getCriticChartPage`).
 *
 * **Its own screen since 2026-10-21** (`app/top-chart.tsx`, `standalone`):
 * the owner, "Move the top games chart into its own screen. Make a widget,
 * like a button for opening the chart" — Discover shows `<TopChartEntry>`,
 * the top three fanned as Surprise Me's cards are, and the chart is a tap
 * away.
 *
 * **A heading on the page and its rows under it — not a card.** Discover's rows stand on the page by the owner's ruling;
 * a ranked list is drawn as a list, rows divided by hairlines, as Search's
 * results are. The pager is the app's one (`<Pager>`), under the rows, and
 * turning a page brings the chart's heading back to the top of the screen
 * (`onTurn`) — a page turned from the pager at its foot would otherwise open
 * on its twentieth row. Each ranking keeps its own page.
 */
export function TopChart({
  onTurn,
  standalone = false,
}: {
  onTurn: () => void;
  /**
   * On its own screen (`top-chart`), whose top bar carries the name: no
   * heading of its own, the line under it standing first.
   */
  standalone?: boolean;
}) {
  const [basis, setBasis] = useState<ChartBasis>('gamelog');
  const [pages, setPages] = useState<Record<ChartBasis, number>>({ gamelog: 1, critics: 1 });
  const page = pages[basis];

  /* GameLog's: one ranking of ids, and a page of boxes for its slice. */
  const ranking = useQuery({
    queryKey: ['top-chart', 'gamelog'],
    queryFn: () => getGameLogRanking(TOP_CHART_SIZE),
    enabled: basis === 'gamelog',
    staleTime: 5 * 60_000,
    retry: false,
  });
  const gamelogLength = ranking.data ? chartLength(ranking.data.length) : null;
  const slice = useMemo(() => {
    if (!ranking.data) return null;
    const { offset, limit } = chartWindow(page, ranking.data.length);
    return { rows: ranking.data.slice(offset, offset + limit), firstRank: offset + 1 };
  }, [ranking.data, page]);

  const gamelogPage = useQuery({
    queryKey: ['top-chart', 'gamelog', 'page', page, slice?.rows.map((row) => row.gameId) ?? []],
    queryFn: () => getGameLogChartPage(slice?.rows ?? [], slice?.firstRank ?? 1),
    enabled: basis === 'gamelog' && slice !== null,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

  /* The critics': a page from IGDB, and the chart's length counted once a day. */
  const criticPage = useQuery({
    queryKey: ['critic-chart', page],
    queryFn: ({ signal }) => getCriticChartPage(page, signal),
    enabled: basis === 'critics',
    staleTime: 6 * 60 * 60_000,
    placeholderData: keepPreviousData,
  });
  const criticLength = useQuery({
    queryKey: ['critic-chart', 'length'],
    queryFn: ({ signal }) => getCriticChartLength(signal),
    enabled: basis === 'critics',
    staleTime: 24 * 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: false,
  });

  const shown = basis === 'gamelog' ? gamelogPage : criticPage;
  const length = basis === 'gamelog' ? gamelogLength : (criticLength.data ?? null);
  const pageCount = length === null ? null : pageCountFor(length, TOP_CHART_PAGE_SIZE);
  const rows = shown.data ?? [];
  /* While the critics' chart is still being counted, a full page is the
     evidence of another — as a platform's pager has it. */
  const hasNext =
    rows.length === TOP_CHART_PAGE_SIZE && page * TOP_CHART_PAGE_SIZE < TOP_CHART_SIZE;
  const note = CHART_BASES.find((entry) => entry.key === basis)?.note;

  const loading =
    basis === 'gamelog'
      ? ranking.isPending || (slice !== null && gamelogPage.isPending)
      : criticPage.isPending;
  const failed =
    basis === 'gamelog'
      ? ranking.isLoadingError || gamelogPage.isLoadingError
      : criticPage.isLoadingError;
  /* `null` from the ranking: a database without 0037 has no GameLog chart. */
  const unavailable = basis === 'gamelog' && ranking.data === null;
  const empty = basis === 'gamelog' && ranking.data !== undefined && gamelogLength === 0;

  function turnTo(next: number) {
    setPages((current) => ({ ...current, [basis]: next }));
    onTurn();
  }

  function retry() {
    if (basis === 'critics') void criticPage.refetch();
    else if (ranking.isLoadingError) void ranking.refetch();
    else void gamelogPage.refetch();
  }

  const theme = useTheme();
  const body = (
    <>
      <View style={styles.toggle}>
        <SortBar
          options={CHART_BASES}
          value={basis}
          onChange={setBasis}
          accessibilityLabel="Rank the Top 1000 by"
          kind="choice"
        />
      </View>

      {loading ? (
        <ChartSkeleton />
      ) : failed ? (
        <View style={styles.inset}>
          <SectionFailed what="the Top 1000" onRetry={retry} />
        </View>
      ) : unavailable ? (
        <Text variant="body" color="textSecondary" style={styles.inset}>
          Pinged’s chart arrives with the database’s next update.
        </Text>
      ) : empty ? (
        <Text variant="body" color="textSecondary" style={styles.inset}>
          Nobody has scored a game on Pinged yet.
        </Text>
      ) : (
        <>
          {/* An inset group of rows (the Apple pass, 2026-11-05), hairlines
              from where the words start. */}
          <View
            style={[
              styles.rows,
              { backgroundColor: theme.surface },
              shown.isPlaceholderData && styles.turning,
            ]}>
            {rows.map((entry, index) => (
              <ChartRow key={entry.id} entry={entry} basis={basis} divided={index > 0} />
            ))}
          </View>

          {/* The pages at the foot as "‹ Page 3 of 50 ›" — the pager kept, its
              look Apple's (the owner keeps pages of a list). */}
          {(pageCount === null ? hasNext || page > 1 : pageCount > 1) && (
            <PageStepper
              page={page}
              pageCount={pageCount}
              hasNext={pageCount === null ? hasNext : page < pageCount}
              onChange={turnTo}
              summary={length === null ? null : `${length.toLocaleString()} games`}
            />
          )}
        </>
      )}
    </>
  );

  return standalone ? (
    <View style={styles.standalone}>
      <Text variant="body" color="textSecondary" style={styles.inset}>
        {note}
      </Text>
      {body}
    </View>
  ) : (
    <HomeSection title="Top 1000" subtitle={note}>
      {body}
    </HomeSection>
  );
}

/**
 * One place in the chart: the rank, the box, the game and its credit, and the
 * score at the far end with what it is made of under it.
 *
 * The score is the figure in the score ramp's colour and the bold family, as
 * Beloved's are: good, mixed and bad are read before the digits are.
 */
const ChartRow = memo(function ChartRow({
  entry,
  basis,
  divided,
}: {
  entry: ChartEntry;
  basis: ChartBasis;
  divided: boolean;
}) {
  const theme = useTheme();
  const score = clampScore(entry.score);
  const credit = [entry.developer, entry.releaseYear].filter(Boolean).join(' · ');
  const made = countLine(basis, entry.count);
  const whose = basis === 'critics' ? 'by the critics' : 'on Pinged';

  return (
    <Link href={{ pathname: '/game/[id]', params: { id: entry.id } }} asChild>
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={`Number ${entry.rank}: ${entry.title}. Scored ${score} out of 100 ${whose}, ${labelFor(score)}, from ${made}.`}
        scaleTo={0.98}
        style={styles.row}>
        {divided && <View style={[styles.rule, { backgroundColor: theme.border }]} />}
        <Text variant="h4" color="textSecondary" style={styles.rank}>
          {entry.rank}
        </Text>
        {/* No `gameId`: a 44dp box has no room for the Must Play badge. */}
        <Poster
          coverUrl={entry.coverUrl}
          heroUrl={entry.heroUrl}
          title={entry.title}
          edition={(entry.edition as EditionKind | null) ?? null}
          width={ART_WIDTH}
          rounded="image"
        />
        <View style={styles.billing}>
          <Text variant="itemTitle" numberOfLines={2}>
            {entry.title}
          </Text>
          {credit !== '' && (
            <Text variant="bodySmall" color="textSecondary" numberOfLines={1}>
              {credit}
            </Text>
          )}
        </View>
        <View style={styles.score}>
          <Text variant="h4" style={[styles.figure, { color: scoreColor(score, theme) }]}>
            {score}
          </Text>
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {made}
          </Text>
        </View>
      </PressableScale>
    </Link>
  );
});

/** "‹ Page 3 of 50 ›": the chart's pages, a step at a time. */
function PageStepper({
  page,
  pageCount,
  hasNext,
  onChange,
  summary,
}: {
  page: number;
  pageCount: number | null;
  hasNext: boolean;
  onChange: (page: number) => void;
  summary: string | null;
}) {
  const theme = useTheme();
  const key = (
    icon: 'chevron-back' | 'chevron-forward',
    label: string,
    to: number,
    on: boolean
  ) => (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !on }}
      disabled={!on}
      onPress={() => onChange(to)}
      scaleTo={0.9}
      pressedColor={theme.controlPressed}
      style={StyleSheet.flatten([
        styles.stepKey,
        { backgroundColor: theme.controlFill, opacity: on ? 1 : 0.35 },
      ])}>
      <Ionicons name={icon} size={20} color={theme.text} />
    </PressableScale>
  );
  return (
    <View style={styles.stepper}>
      <View style={styles.stepRow}>
        {key('chevron-back', 'Previous page', page - 1, page > 1)}
        <Text variant="h5" accessibilityLiveRegion="polite">
          {pageCount === null ? `Page ${page}` : `Page ${page} of ${pageCount}`}
        </Text>
        {key('chevron-forward', 'Next page', page + 1, hasNext)}
      </View>
      {summary ? (
        <Text variant="caption" color="textMuted">
          {summary}
        </Text>
      ) : null}
    </View>
  );
}

/** The first page's shape while it is on its way. */
function ChartSkeleton() {
  return (
    <View style={styles.rows} accessibilityLabel="Loading the Top 1000">
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <View key={index} style={styles.row}>
          <View style={styles.rank} />
          <Skeleton width={ART_WIDTH} height={ART_HEIGHT} radius={Radius.image} />
          <View style={styles.billing}>
            <Skeleton width="70%" height={13} radius={Radius.sm} />
            <Skeleton width="45%" height={11} radius={Radius.sm} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: { paddingHorizontal: Spacing.x16 },
  standalone: { gap: Spacing.x16 },
  inset: { paddingHorizontal: Spacing.x16 },
  rows: {
    marginHorizontal: Spacing.x16,
    paddingHorizontal: Spacing.x16,
    borderRadius: INSET_GROUP.radius,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  rule: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: RANK_WIDTH + Spacing.x12,
    height: StyleSheet.hairlineWidth,
  },
  stepper: { alignItems: 'center', gap: Spacing.x4 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x16 },
  stepKey: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* The last page, while the next one is on its way. */
  turning: { opacity: 0.45 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    minHeight: TapTarget,
    paddingVertical: Spacing.x8,
  },
  /* Tabular, so 9 and 10 sit in one column. */
  rank: { width: RANK_WIDTH, textAlign: 'center', fontVariant: ['tabular-nums'] },
  /* `minWidth: 0` so a long title wraps inside the row instead of pushing the
     score off it. */
  billing: { flex: 1, minWidth: 0, gap: 2 },
  score: { alignItems: 'flex-end', gap: 1 },
  /* The bold family: Android synthesises no weight for a custom font. */
  figure: { fontFamily: Typeface.bold, fontVariant: ['tabular-nums'] },
});
