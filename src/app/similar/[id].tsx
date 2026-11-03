import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ReportFlag, reportHref } from '@/components/report-flag';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ExpandableText } from '@/components/ui/expandable-text';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { IconButton } from '@/components/ui/icon-button';
import { PageFlatList } from '@/components/ui/page-scroll';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { useSelectable } from '@/components/ui/selectable';
import { SortBar, type SortOption } from '@/components/ui/sort-bar';
import { Card } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import type { EditionKind } from '@/constants/game-editions';
import { SIMILARITY_REASON_LABEL, agreementLine, topReasons } from '@/constants/similarity';
import { Radius, Spacing, TapTarget, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  castSimilarityVote,
  getSimilarPair,
  getSimilaritySuggestions,
  removeSimilarityVote,
  setSuggestionUpvote,
} from '@/lib/api';
import type { CommunitySimilarGame, SimilaritySuggestion } from '@/lib/database.types';
import { displayNameFor, timeAgo } from '@/lib/format';
import { getGameById } from '@/lib/games';
import { useAuth } from '@/store/auth';
import { showAlert } from '@/components/ui/dialog';

type SuggestionSort = 'upvoted' | 'newest' | 'oldest';

const SORTS: readonly SortOption<SuggestionSort>[] = [
  { key: 'upvoted', label: 'Most upvoted' },
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
];

/**
 * One community pick, and every suggestion behind it.
 *
 * Params: `id` is the pair; `game` is the game you came from, which decides which
 * side of the pair is "the other game" this screen is about.
 *
 * ## What a suggestion is
 *
 * Every person who agrees a pair belongs together is a vote (0025), and the ones
 * who said *why* — reasons, a line of text — are suggestions. Those are listed in
 * full, to be read and upvoted (0029). The ones who only agreed are counted in a
 * line at the foot rather than listed: a card with a name and nothing else on it
 * is a vote wearing a suggestion's clothes.
 *
 * ## Two kinds of vote, kept apart
 *
 * Agree / disagree is about the *pair* — is this game like that one. The upvote
 * on a suggestion is about the *reasoning* — was this a useful way to put it. You
 * can think two games are alike and still find one person's explanation the one
 * worth reading, so the two never share a control.
 *
 * ## Two kinds of report, kept apart the same way
 *
 * The flag beside Agree reports the *pick* — these games are not alike. The flag
 * on a suggestion reports *what that person wrote*. Each sits with the thing it
 * reports, and both open the one report screen.
 */
export default function SimilarPairScreen() {
  const params = useLocalSearchParams<{ id: string; game?: string }>();
  const id = params.id;
  const gameId = params.game ?? null;

  const pair = useQuery({
    queryKey: ['similar-pair', id, gameId],
    queryFn: () => getSimilarPair(gameId!, id!),
    enabled: !!id && !!gameId,
  });

  let body: React.ReactNode;
  if (!id || !gameId) body = <EmptyState title="Nothing to show" />;
  else if (pair.isLoading) body = <LoadingState />;
  else if (pair.isLoadingError)
    body = <ErrorState error={pair.error} onRetry={() => void pair.refetch()} />;
  else if (!pair.data)
    body = (
      <EmptyState
        title="This pick is gone"
        message="Everyone who suggested it has taken it back, or it is hidden while a moderator looks at reports."
      />
    );
  else body = <PairDetail pair={pair.data} gameId={gameId} />;

  return (
    <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back title="Similar game" />}>
      {body}
    </Screen>
  );
}

function PairDetail({ pair, gameId }: { pair: CommunitySimilarGame; gameId: string }) {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id) ?? null;
  const [sort, setSort] = useState<SuggestionSort>('upvoted');

  const source = useQuery({
    queryKey: ['game', gameId],
    queryFn: ({ signal }) => getGameById(gameId, signal),
    staleTime: 30 * 60_000,
  });

  const suggestionsKey = ['similar-suggestions', pair.similarity_id];
  const suggestions = useQuery({
    queryKey: suggestionsKey,
    queryFn: () => getSimilaritySuggestions(pair.similarity_id),
  });

  /* Said something vs only agreed (see the screen's docblock), and yours apart:
     it is pinned at the top, so it is not in the list a second time. */
  const { said, bare, mine } = useMemo(() => {
    const all = suggestions.data ?? [];
    const saysWhy = (entry: SimilaritySuggestion) =>
      entry.reasons.length > 0 || !!entry.comment?.trim();
    const withWords = all.filter(saysWhy);
    const own = all.find((entry) => entry.author_id === userId) ?? null;
    return {
      said: sortSuggestions(
        withWords.filter((entry) => entry.author_id !== userId),
        sort
      ),
      bare: all.length - withWords.length,
      mine: own && saysWhy(own) ? own : null,
    };
  }, [suggestions.data, sort, userId]);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['similar-pair', pair.similarity_id] });
    queryClient.invalidateQueries({ queryKey: suggestionsKey });
    queryClient.invalidateQueries({ queryKey: ['community-similar'] });
  }

  const vote = useMutation({
    mutationFn: async (next: -1 | 1) => {
      if (!userId) throw new Error('Sign in to vote.');
      /* Pressing the vote you already cast takes it back. */
      if (pair.viewer_vote === next) await removeSimilarityVote(userId, pair.similarity_id);
      else await castSimilarityVote(userId, pair.similarity_id, next);
    },
    onSuccess: refresh,
  });

  /* Optimistic: an upvote is a small, frequent, reversible act, and waiting a
     round trip to see your own tap land makes the list feel broken. */
  const upvote = useMutation({
    mutationFn: (entry: SimilaritySuggestion) =>
      setSuggestionUpvote(userId!, pair.similarity_id, entry.author_id, !entry.viewer_upvoted),
    onMutate: async (entry) => {
      await queryClient.cancelQueries({ queryKey: suggestionsKey });
      const previous = queryClient.getQueryData<SimilaritySuggestion[]>(suggestionsKey);
      queryClient.setQueryData<SimilaritySuggestion[]>(suggestionsKey, (current) =>
        (current ?? []).map((row) =>
          row.author_id === entry.author_id
            ? {
                ...row,
                viewer_upvoted: !row.viewer_upvoted,
                upvotes: row.upvotes + (row.viewer_upvoted ? -1 : 1),
              }
            : row
        )
      );
      return { previous };
    },
    onError: (_error, _entry, context) => {
      if (context?.previous) queryClient.setQueryData(suggestionsKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: suggestionsKey }),
  });

  /* Deleting your suggestion takes back the vote it is: your reasons, your
     agreement and the upvotes others gave it. Agree is one tap away if you only
     meant to drop the words. */
  const remove = useMutation({
    mutationFn: () => removeSimilarityVote(userId!, pair.similarity_id),
    onSuccess: refresh,
  });

  function askRemove() {
    if (!mine) return;
    showAlert(
      'Delete your suggestion?',
      `Your reasons${mine.upvotes > 0 ? ` and its ${mine.upvotes} ${mine.upvotes === 1 ? 'upvote' : 'upvotes'}` : ''} go, and you no longer count as agreeing. You can agree again any time.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => remove.mutate() },
      ]
    );
  }

  const editReasons = () =>
    router.push({
      pathname: '/suggest-similar/[id]',
      params: { id: gameId, other: pair.game_id },
    });

  const reasons = topReasons(pair.reasons, 12);
  const share = pair.votes > 0 ? pair.up / pair.votes : 1;
  const mutationError = vote.error ?? upvote.error ?? remove.error;

  const header = (
    <View style={styles.header}>
      {/*
        The pick: its cover, and beside it everything about it — what it is,
        what it was suggested as, how many agree — ending in your say on it.

        Agree and Disagree sat in a full-width row under the cover, apart from
        the agreement line they change. In the column, the verdict and your
        vote on it are one block, read top to bottom, and the header is as tall
        as the cover rather than the cover plus a row.
      */}
      <View style={styles.pairHead}>
        <Link href={{ pathname: '/game/[id]', params: { id: pair.game_id } }} asChild>
          <PressableScale
            accessibilityRole="link"
            accessibilityLabel={`Open ${pair.title}`}
            scaleTo={0.96}>
            <Poster
              coverUrl={pair.cover_url}
              heroUrl={pair.hero_url}
              title={pair.title}
              edition={(pair.edition_kind as EditionKind | null) ?? null}
              gameId={pair.game_id}
              width={88}
              rounded="image"
            />
          </PressableScale>
        </Link>
        <View style={styles.pairText}>
          <Text variant="h1" numberOfLines={3}>
            {pair.title}
          </Text>
          <Text variant="bodySmall" color="textMuted" numberOfLines={2}>
            Suggested as like {source.data?.title ?? 'the game you came from'}
          </Text>
          <View style={styles.agreement}>
            <View style={[styles.track, { backgroundColor: withAlpha(theme.text, 0.08) }]}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.round(share * 100)}%`, backgroundColor: theme.primary },
                ]}
              />
            </View>
            <Text variant="caption" color="textSecondary">
              {agreementLine(pair)}
            </Text>
          </View>

          {userId && (
            <View style={styles.votes}>
              <VoteButton
                icon="thumbs-up"
                label="Agree"
                active={pair.viewer_vote === 1}
                disabled={vote.isPending}
                onPress={() => vote.mutate(1)}
              />
              <VoteButton
                icon="thumbs-down"
                label="Disagree"
                active={pair.viewer_vote === -1}
                disabled={vote.isPending}
                onPress={() => vote.mutate(-1)}
              />
              {/* Reports the pick, so it sits with the pick's other controls;
                  each suggestion below carries its own. */}
              <IconButton
                icon="flag-outline"
                accessibilityLabel={`Report the pick of ${pair.title}`}
                size="small"
                tone="plain"
                onPress={() =>
                  router.push(reportHref({ kind: 'pick', pairId: pair.similarity_id }, gameId))
                }
              />
            </View>
          )}
        </View>
      </View>

      {reasons.length > 0 && (
        <View style={styles.tags} accessibilityLabel="Reasons given">
          {reasons.map((reason) => (
            <Tag
              key={reason}
              label={`${SIMILARITY_REASON_LABEL[reason]} ${pair.reasons[reason] ?? ''}`.trim()}
            />
          ))}
        </View>
      )}

      {mutationError && (
        <Text variant="bodySmall" color="danger">
          {mutationError instanceof Error ? mutationError.message : 'That did not go through.'}
        </Text>
      )}

      {/* Yours, pinned: the one suggestion here you can change. */}
      {mine && (
        <View style={[styles.pinned, { borderTopColor: theme.border }]}>
          <Text variant="h3" accessibilityRole="header">
            Your suggestion
          </Text>
          <SuggestionCard
            pairId={pair.similarity_id}
            entry={mine}
            own
            canUpvote={false}
            onUpvote={() => {}}
            onEdit={editReasons}
            onDelete={askRemove}
            deleting={remove.isPending}
          />
        </View>
      )}

      <View style={[styles.sectionHead, { borderTopColor: theme.border }]}>
        <Text variant="h3" accessibilityRole="header">
          Why players say so
        </Text>
        {said.length > 1 && (
          <SortBar
            options={SORTS}
            value={sort}
            onChange={setSort}
            accessibilityLabel="Sort suggestions"
          />
        )}
      </View>
    </View>
  );

  const footer = (
    <View style={styles.footer}>
      {bare > 0 && (
        <Text variant="caption" color="textMuted" style={styles.centred}>
          {said.length > 0 ? 'Plus ' : ''}
          {bare} {bare === 1 ? 'player' : 'players'} agreed without saying why.
        </Text>
      )}
      {userId && (
        <Button
          title={mine ? 'Edit your reasons' : 'Add your reasons'}
          icon={mine ? 'create-outline' : 'add'}
          variant="secondary"
          fullWidth
          onPress={editReasons}
        />
      )}
    </View>
  );

  return (
    <PageFlatList
      data={said}
      keyExtractor={(entry) => entry.author_id}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => (
        <View style={styles.cardWrap}>
          <SuggestionCard
            pairId={pair.similarity_id}
            entry={item}
            own={false}
            canUpvote={!!userId}
            onUpvote={() => upvote.mutate(item)}
          />
        </View>
      )}
      ListEmptyComponent={
        suggestions.isPending ? (
          <LoadingState label="Loading suggestions…" />
        ) : suggestions.isLoadingError ? (
          <ErrorState error={suggestions.error} onRetry={() => void suggestions.refetch()} />
        ) : (
          <Text variant="body" color="textSecondary" style={styles.none}>
            {mine ? 'Nobody else has said why yet.' : 'Nobody has said why yet.'}
          </Text>
        )
      }
    />
  );
}

function sortSuggestions(
  entries: SimilaritySuggestion[],
  sort: SuggestionSort
): SimilaritySuggestion[] {
  const byNewest = (a: SimilaritySuggestion, b: SimilaritySuggestion) =>
    b.updated_at.localeCompare(a.updated_at);
  switch (sort) {
    case 'newest':
      return [...entries].sort(byNewest);
    case 'oldest':
      return [...entries].sort((a, b) => a.created_at.localeCompare(b.created_at));
    default:
      return [...entries].sort((a, b) => b.upvotes - a.upvotes || byNewest(a, b));
  }
}

/**
 * Agree or disagree — on/off in the app's selected state, and by glyph: the
 * thumb fills when it is yours, which is the carrier that is not a colour.
 */
function VoteButton({
  icon,
  label,
  active,
  disabled,
  onPress,
}: {
  icon: 'thumbs-up' | 'thumbs-down';
  label: string;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const look = useSelectable()(active);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      accessibilityLabel={active ? `Take back: ${label.toLowerCase()}` : label}
      disabled={disabled}
      onPress={onPress}
      scaleTo={0.95}
      pressedColor={look.pressedColor}
      focusRing={look.focusRing}
      style={StyleSheet.flatten([styles.voteButton, look.style])}>
      <Ionicons
        name={active ? icon : `${icon}-outline`}
        size={16}
        color={active ? theme.text : theme.textSecondary}
      />
      <Text variant="bodySmall" color={look.label}>
        {label}
      </Text>
    </PressableScale>
  );
}

/** How many lines of a suggestion show before it is tapped open. */
const CLAMP = 5;

/**
 * The upvote's reach, short on the right: the report flag is its neighbour
 * there, and the two touch areas must not overlap.
 */
const UPVOTE_SLOP = { top: 12, bottom: 12, left: 8, right: 4 };

/**
 * One person's suggestion: who and when, what they wrote, then the reasons they
 * ticked, its upvotes and a flag to report it.
 *
 * The text stops at five lines, with More under it; tapping the card opens it
 * in place — the card growing, the way SimpMusic's description card does (see
 * `<ExpandableText>`) — and tapping again closes it. In place rather than on
 * another screen, because a suggestion is a paragraph, not an article — and
 * only when there is more to show, so a short one is not a button that does
 * nothing.
 */
function SuggestionCard({
  pairId,
  entry,
  own,
  canUpvote,
  onUpvote,
  onEdit,
  onDelete,
  deleting = false,
}: {
  pairId: string;
  entry: SimilaritySuggestion;
  own: boolean;
  canUpvote: boolean;
  onUpvote: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  const theme = useTheme();
  const name = displayNameFor(entry);
  const text = entry.comment?.trim() ?? '';
  const [expanded, setExpanded] = useState(false);
  /* Known once the text has been laid out — the whole of it, so both
     platforms report every line. */
  const [clamped, setClamped] = useState(false);

  /* The padding and the rhythm on a view inside the card, not on the card:
     `<Card>`'s `style` lands on its outer view, where `gap` spaced one child —
     so the byline, the text and the foot sat flush against each other. */
  const body = (
    <Card padded={false}>
      <View style={styles.card}>
        <View style={styles.who}>
          <Link href={{ pathname: '/profile/[id]', params: { id: entry.author_id } }} asChild>
            <PressableScale
              accessibilityRole="link"
              accessibilityLabel={`${name}'s profile`}
              scaleTo={0.97}
              style={StyleSheet.flatten(styles.person)}>
              <Avatar uri={entry.avatar_url} name={name} size={26} />
              <Text variant="h5" numberOfLines={1} style={styles.shrink}>
                {name}
              </Text>
            </PressableScale>
          </Link>
          <Text variant="caption" color="textMuted">
            {timeAgo(entry.updated_at)}
          </Text>
        </View>

        {!!text && (
          <ExpandableText lines={CLAMP} expanded={expanded} onOverflowChange={setClamped}>
            {text}
          </ExpandableText>
        )}

        <View style={styles.cardFoot}>
          <View style={[styles.tags, styles.flex]}>
            {entry.reasons.map((reason) => (
              <Tag key={reason} label={SIMILARITY_REASON_LABEL[reason]} />
            ))}
          </View>

          {own ? (
            <View style={styles.ownActions}>
              <Text variant="caption" color="textMuted">
                {entry.upvotes} {entry.upvotes === 1 ? 'upvote' : 'upvotes'}
              </Text>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Edit your suggestion"
                onPress={onEdit}
                hitSlop={12}
                scaleTo={0.95}>
                <Text variant="caption" color="primaryText">
                  Edit
                </Text>
              </PressableScale>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Delete your suggestion"
                accessibilityState={{ disabled: deleting }}
                disabled={deleting}
                onPress={onDelete}
                hitSlop={12}
                scaleTo={0.95}>
                <Text variant="caption" color="danger">
                  Delete
                </Text>
              </PressableScale>
            </View>
          ) : (
            <>
              <PressableScale
                accessibilityRole="button"
                accessibilityState={{ selected: entry.viewer_upvoted, disabled: !canUpvote }}
                accessibilityLabel={
                  entry.viewer_upvoted
                    ? `Take back your upvote on ${name}'s suggestion, ${entry.upvotes} upvotes`
                    : `Upvote ${name}'s suggestion, ${entry.upvotes} upvotes`
                }
                disabled={!canUpvote}
                onPress={onUpvote}
                hitSlop={UPVOTE_SLOP}
                scaleTo={0.92}
                style={StyleSheet.flatten(styles.upvote)}>
                <Ionicons
                  name={entry.viewer_upvoted ? 'arrow-up-circle' : 'arrow-up-circle-outline'}
                  size={19}
                  color={entry.viewer_upvoted ? theme.text : theme.textMuted}
                />
                <Text variant="caption" color={entry.viewer_upvoted ? 'text' : 'textMuted'}>
                  {entry.upvotes > 0 ? entry.upvotes : 'Upvote'}
                </Text>
              </PressableScale>

              {/* At the far end of the row the upvote is on, as a review's flag
                is at the far end of the heart's. Set apart so the two touch
                areas never meet: a tap meant for the upvote must not land on
                the report. */}
              <View style={styles.report}>
                <ReportFlag
                  target={{ kind: 'suggestion', pairId, authorId: entry.author_id }}
                  authorId={entry.author_id}
                  label={`Report ${name}'s suggestion`}
                />
              </View>
            </>
          )}
        </View>
      </View>
    </Card>
  );

  if (!clamped) return body;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`${name}'s suggestion`}
      accessibilityHint={expanded ? 'Shows less' : 'Shows all of it'}
      onPress={() => setExpanded((open) => !open)}
      scaleTo={0.99}>
      {body}
    </PressableScale>
  );
}

/** A reason, small: it qualifies the writing above it rather than leading it. */
function Tag({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View
      style={[styles.tag, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centred: { textAlign: 'center' },
  content: { paddingBottom: Spacing.x48 },
  header: { padding: Spacing.x16, gap: Spacing.x16 },
  pairHead: { flexDirection: 'row', gap: Spacing.x16, alignItems: 'flex-start' },
  pairText: { flex: 1, gap: Spacing.x4 },
  agreement: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8, marginTop: Spacing.x4 },
  track: { width: 64, height: 4, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
  /* In the column beside the cover now. Wraps rather than squeezing — at a large
     system font the flag drops to its own line before either label truncates. */
  votes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.x8,
    marginTop: Spacing.x8,
  },
  /* `flexGrow` from the label's own width, so the pair fills the column's
     measure together without ever being narrower than its word. */
  voteButton: {
    flexDirection: 'row',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x8,
    minHeight: TapTarget,
    paddingHorizontal: Spacing.x12,
    borderRadius: Radius.control,
    borderWidth: 1,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.x4 },
  tag: {
    paddingHorizontal: Spacing.x8,
    paddingVertical: 1,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pinned: { gap: Spacing.x12, paddingTop: Spacing.x16, borderTopWidth: StyleSheet.hairlineWidth },
  sectionHead: {
    gap: Spacing.x12,
    paddingTop: Spacing.x16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  none: { paddingHorizontal: Spacing.x16 },
  cardWrap: { paddingHorizontal: Spacing.x16, paddingBottom: Spacing.x12 },
  card: { padding: Spacing.x12, gap: Spacing.x8 },
  who: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  /* Name and avatar are one link; the date sits after them, not pushed away. */
  person: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8, flexShrink: 1 },
  shrink: { flexShrink: 1 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  ownActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  upvote: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
  /* With the row's own gap, 14dp between the upvote and the flag — more than
     the upvote's 4 and the flag's 8 of slop reaching into it. */
  report: { marginLeft: Spacing.x12 },
  footer: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x8, gap: Spacing.x12 },
});
