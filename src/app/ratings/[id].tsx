import Ionicons from '@expo/vector-icons/Ionicons';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useLocalSearchParams } from 'expo-router';
import { memo, useRef, useState } from 'react';
import { StyleSheet, View, type FlatList } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { type DropdownOption } from '@/components/ui/dropdown-button';
import { SortBar } from '@/components/ui/sort-bar';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageFlatList } from '@/components/ui/page-scroll';
import { Pager } from '@/components/ui/pager';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { labelFor, scoreColor } from '@/constants/score';
import { STATUS_LABEL } from '@/constants/status';
import { Spacing, TapTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { RATERS_PAGE_SIZE, getGameRatersPage, type GameRater, type GameRaterSort } from '@/lib/api';
import { displayNameFor, timeAgoPosted } from '@/lib/format';
import { getGameById } from '@/lib/games';
import { pageCountFor } from '@/lib/games/paging';

const SORT_OPTIONS: readonly DropdownOption<GameRaterSort>[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'highest', label: 'Highest score' },
  { value: 'lowest', label: 'Lowest score' },
];

/** The rater's face: the row's own height, less its padding. */
const AVATAR = 40;

/**
 * Everybody who gave a game a score — with a review, or with a log and
 * nothing else — twenty to a page.
 *
 * The owner's request (2026-10-20): "a screen to see everyone who rated the
 * game either by written review or logging, page system". The reviews sheet
 * lists what was *written*; most scores have no words behind them, and this is
 * where those people are. Opened from the reviews sheet, under the GameLog
 * score it is the list behind.
 *
 * One row a person: their face and name, where they are with the game and
 * when they scored it, and the score as GameLog says one (`<ScoreLine>`, the
 * number and its word). A row with a review behind it says so, and opens the
 * review; one without opens that person's record of the game
 * (`game-stats/[user]/[game]`), as a face does in the Overview's Played by.
 *
 * Pages, as every long list of the app's is (`<Pager>`, a platform's games,
 * the reviews sheet): the count comes with the first page, so the pager
 * knows its end at once; the last page stays on screen, dimmed, while the
 * next one arrives. A new order starts again at page one.
 *
 * The scores are the ones people gave. The GameLog score over them is a
 * weighted average (0041) — this is the list of people, and nobody's row
 * says how much it counted.
 */
export default function GameRatersScreen() {
  const { id: gameId, title: titleParam } = useLocalSearchParams<{ id: string; title?: string }>();
  const [sort, setSort] = useState<GameRaterSort>('newest');
  const [page, setPage] = useState(1);
  const listRef = useRef<FlatList<GameRater>>(null);

  /* The heading comes from whoever opened this, so it is there at once; the
     game is asked for only when it did not (a deep link). */
  const game = useQuery({
    queryKey: ['game', gameId],
    queryFn: ({ signal }) => getGameById(gameId!, signal),
    enabled: !!gameId && !titleParam,
    staleTime: 30 * 60_000,
  });
  const title = titleParam?.trim() || game.data?.title || '';

  const raters = useQuery({
    queryKey: ['game-ratings', gameId, sort, page],
    queryFn: () => getGameRatersPage(gameId!, sort, page),
    enabled: !!gameId,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const total = raters.data?.total ?? null;
  const pageCount = total === null ? null : pageCountFor(total, RATERS_PAGE_SIZE);
  const rows = raters.data?.raters ?? [];
  const summary =
    total === null ? null : `${total.toLocaleString()} ${total === 1 ? 'rating' : 'ratings'}`;

  function turnTo(next: number) {
    setPage(next);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }

  function changeSort(next: GameRaterSort) {
    setSort(next);
    /* A different order is a different list; page 7 of it is nowhere. */
    setPage(1);
  }

  const head = (
    <View style={styles.head}>
      {/* "Ratings" is the large title; the game is named in the line under
          it (the Apple pass, 2026-11-05 — it was an h1 over it), and the
          pager is at the foot only. */}
      <Text variant="body" color="textSecondary">
        {title
          ? `Everyone who scored ${title} on Pinged — with a review, or with a log alone.`
          : 'Everyone who scored it on Pinged — with a review, or with a log alone.'}
      </Text>

      <SortBar
        accessibilityLabel="Sort ratings"
        value={sort}
        options={SORT_OPTIONS.map((option) => ({ key: option.value, label: option.label }))}
        onChange={changeSort}
      />

      {!!summary && (
        <Text variant="bodySmall" color="textSecondary">
          {summary}
        </Text>
      )}
    </View>
  );

  return (
    <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back title="Ratings" />}>
      <PageFlatList
        ref={listRef}
        data={rows}
        keyExtractor={(rater) => rater.logId}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        /* The previous page, dimmed, while the next one is on its way. */
        style={raters.isPlaceholderData ? styles.turning : undefined}
        contentContainerStyle={styles.content}
        ListHeaderComponent={head}
        renderItem={({ item, index }) => (
          <RaterRow rater={item} gameId={gameId!} divided={index > 0} />
        )}
        ListEmptyComponent={
          raters.isLoading ? (
            <LoadingState label="Loading ratings" />
          ) : raters.isLoadingError ? (
            <ErrorState error={raters.error} onRetry={() => void raters.refetch()} />
          ) : (
            <EmptyState
              title={page > 1 ? 'Nothing on this page' : 'No ratings yet'}
              message={
                page > 1
                  ? 'This is past the last page. Go back a page, or to page 1.'
                  : 'Nobody here has scored this game yet.'
              }
            />
          )
        }
        ListFooterComponent={
          rows.length > 0 && pageCount !== null && pageCount > 1 ? (
            <View style={styles.foot}>
              <Pager page={page} pageCount={pageCount} onChange={turnTo} detail={false} />
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

/**
 * One person's score: their face and name, where they are with the game and
 * when, and the score at the far end.
 *
 *   (av) Ada                                 84 GREAT
 *        Review · Played · 3d ago
 *
 * Memoised, and handed nothing built per render: a page is twenty of these.
 */
const RaterRow = memo(function RaterRow({
  rater,
  gameId,
  divided,
}: {
  rater: GameRater;
  gameId: string;
  divided: boolean;
}) {
  const theme = useTheme();
  const name = displayNameFor(rater.profile);
  const when = timeAgoPosted(rater.ratedAt);
  const meta = [STATUS_LABEL[rater.status], when].filter(Boolean).join(' · ');
  const rounded = Math.round(rater.rating);

  /* Their words when there are some; their record of the game when there are
     not. A row with no profile (a deleted account) has nowhere to go but the
     review itself. */
  const href = rater.wrote
    ? { pathname: '/review/[id]' as const, params: { id: rater.logId } }
    : rater.profile
      ? {
          pathname: '/game-stats/[user]/[game]' as const,
          params: { user: rater.profile.id, game: gameId },
        }
      : null;

  const body = (
    <>
      <Avatar uri={rater.profile?.avatar_url ?? null} name={name} size={AVATAR} />
      <View style={styles.text}>
        <Text variant="body" numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.meta}>
          {rater.wrote && (
            <>
              <Ionicons name="document-text-outline" size={12} color={theme.textSecondary} />
              <Text variant="bodySmall" color="textSecondary">
                Review
              </Text>
              <Text variant="bodySmall" color="textMuted">
                ·
              </Text>
            </>
          )}
          <Text variant="bodySmall" color="textMuted" numberOfLines={1} style={styles.metaText}>
            {meta}
          </Text>
        </View>
      </View>
      {/* The score, Apple's trailing value: the number alone, in its ramp. */}
      <Text variant="h4" style={{ color: scoreColor(rounded, theme) }}>
        {rounded}
      </Text>
    </>
  );

  const label = `${name}, rated ${rounded} out of 100, ${labelFor(rounded)}. ${STATUS_LABEL[rater.status]}${
    when ? `, ${when}` : ''
  }. ${rater.wrote ? 'Read their review.' : 'Their record of the game.'}`;

  return (
    <View
      style={[
        divided && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
      ]}>
      {href ? (
        <Link href={href} asChild>
          <PressableScale
            accessibilityRole="link"
            accessibilityLabel={label}
            scaleTo={0.98}
            style={StyleSheet.flatten(styles.row)}>
            {body}
          </PressableScale>
        </Link>
      ) : (
        <View style={styles.row} accessible accessibilityLabel={label}>
          {body}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.x16, paddingBottom: Spacing.x48, flexGrow: 1 },
  head: { gap: Spacing.x16, paddingBottom: Spacing.x8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    minHeight: TapTarget,
    paddingVertical: Spacing.x12,
  },
  /* `minWidth: 0` so a long name truncates instead of pushing the score off. */
  text: { flex: 1, minWidth: 0, gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
  metaText: { flexShrink: 1 },
  foot: { paddingTop: Spacing.x16 },
  turning: { opacity: 0.45 },
});
