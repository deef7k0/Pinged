import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { FamiliarityLine } from '@/components/pings/familiarity-line';
import { StatusTag } from '@/components/pings/status-tag';
import { SuggestionGroupCard } from '@/components/pings/suggestion-group';
import { ReportFlag } from '@/components/report-flag';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { cardShape, CARD_GAP, CARD_INSET, useCardMaterial } from '@/components/ui/card-material';
import { FrostedTopBar, TopBarDisc } from '@/components/ui/frosted-top-bar';
import { PageScrollView } from '@/components/ui/page-scroll';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { SelectionCard } from '@/components/ui/selection-card';
import { SlideUpSheet } from '@/components/ui/slide-up-sheet';
import { Text } from '@/components/ui/text';
import { PosterAspectRatio, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  deletePing,
  getPing,
  getPingSuggestions,
  isPingsNotReady,
  markPingSeen,
  setPingStatus,
  type PingSuggestion,
} from '@/lib/api';
import type { PingFeedRow, PingStatus } from '@/lib/database.types';
import { displayNameFor, timeAgoLong } from '@/lib/format';
import { canSuggest, groupSuggestions, pingTags, suggestionCount } from '@/lib/pings';
import { useAuth } from '@/store/auth';
import { showAlert } from '@/components/ui/dialog';

/** A reference game's box on the request's own page. */
const REF_COVER = 92;

/**
 * One request, whole: what was asked, the games it is built on, and every
 * suggestion, grouped by game (`groupSuggestions`).
 *
 * The page answers one question for each person who opens it:
 *
 *  - **Somebody else's, open**: can I help? — the familiarity line says why
 *    they might be able to, and Suggest a game is the one filled action.
 *  - **Your own**: what did people say? — every new suggestion is marked seen
 *    as the page is in front (`mark_ping_seen`, the tab's dot), and the
 *    owner's controls are here: Mark as found (choosing the game that did
 *    it), Edit, Close or Reopen, Delete.
 *  - **Found**: what was it? — the answer leads the page, and its suggestions
 *    stay readable.
 *
 * Ping (the paper plane at the top) sends the request to a friend who might
 * know — a ping about a ping.
 */
export default function PingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;

  const ping = useQuery({
    queryKey: ['ping', id],
    queryFn: () => getPing(id!),
    enabled: !!id && !!viewerId,
  });
  const suggestions = useQuery({
    queryKey: ['ping-suggestions', id],
    queryFn: () => getPingSuggestions(id!),
    enabled: !!id && !!viewerId,
  });

  const data = ping.data ?? null;
  const mine = !!data && data.user_id === viewerId;

  /* Seen whenever the owner has it in front: the dot on My Pings and the
     "new" on its card come off together. */
  useFocusEffect(
    useCallback(() => {
      if (!mine || !id) return;
      void markPingSeen(id).then(() => {
        void queryClient.invalidateQueries({ queryKey: ['pings', 'unseen'] });
        void queryClient.invalidateQueries({ queryKey: ['pings', 'mine'] });
      });
    }, [mine, id, queryClient])
  );

  const pingTo = () =>
    data &&
    router.push({
      pathname: '/send-ping',
      params: {
        kind: 'request',
        target: data.id,
        title: data.description.slice(0, 200),
        subtitle: `${displayNameFor(data)}’s ping`,
        image: data.refs[0]?.cover_url ?? '',
      },
    });

  const bar = (
    <FrostedTopBar
      back
      title="Ping"
      right={
        data && data.status === 'open' ? (
          <TopBarDisc icon="paper-plane-outline" label="Ping someone about this" onPress={pingTo} />
        ) : undefined
      }
    />
  );

  if (ping.isPending || !viewerId) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={bar}>
        <LoadingState />
      </Screen>
    );
  }
  if (ping.isLoadingError) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={bar}>
        {isPingsNotReady(ping.error) ? (
          <EmptyState
            title="Pings are on their way"
            message="They arrive with the database’s next update."
          />
        ) : (
          <ErrorState error={ping.error} onRetry={() => void ping.refetch()} />
        )}
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={bar}>
        <EmptyState
          title="This ping is gone"
          message="Its owner deleted it, or it isn’t yours to see."
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']} insetHeader topBar={bar}>
      <PageScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={ping.isRefetching || suggestions.isRefetching}
            onRefresh={() => {
              void ping.refetch();
              void suggestions.refetch();
            }}
          />
        }>
        <Request ping={data} mine={mine} />
        {data.status === 'found' && data.resolved_game && <Answer ping={data} />}
        <Actions ping={data} mine={mine} viewerId={viewerId} suggestions={suggestions.data ?? []} />
        <Suggestions ping={data} mine={mine} query={suggestions} />
      </PageScrollView>
    </Screen>
  );
}

/** Who asked, what, like which games, and why this reader might know. */
function Request({ ping, mine }: { ping: PingFeedRow; mine: boolean }) {
  const theme = useTheme();
  const router = useRouter();
  const name = displayNameFor(ping);
  const tags = pingTags(ping);

  return (
    <View style={styles.request}>
      <View style={styles.author}>
        <PressableScale
          accessibilityRole="link"
          accessibilityLabel={`${name}’s profile`}
          onPress={() => router.push({ pathname: '/profile/[id]', params: { id: ping.user_id } })}
          scaleTo={0.97}
          style={StyleSheet.flatten(styles.who)}>
          <Avatar uri={ping.avatar_url} name={name} size={40} />
          <View style={styles.whoText}>
            <Text variant="h5" numberOfLines={1}>
              {mine ? 'You asked' : `${name} asks`}
            </Text>
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              {`@${ping.username} · ${timeAgoLong(ping.created_at)}`}
              {ping.updated_at > ping.created_at ? ' · edited' : ''}
            </Text>
          </View>
        </PressableScale>
        {ping.status !== 'open' && <StatusTag status={ping.status} />}
      </View>

      <Text variant="h2" accessibilityRole="header">
        {ping.description}
      </Text>

      {tags.length > 0 && (
        <View style={styles.tags}>
          {tags.map((tag) => (
            <View key={tag} style={[styles.tag, { backgroundColor: theme.surfaceSelected }]}>
              <Text variant="bodySmall" color="textSecondary">
                {tag}
              </Text>
            </View>
          ))}
        </View>
      )}

      {ping.refs.length > 0 && (
        <View style={styles.refsBlock}>
          <Text variant="label" color="textMuted">
            LIKE THESE
          </Text>
          <View style={styles.refs}>
            {ping.refs.map((ref) => (
              <PressableScale
                key={ref.game_id}
                accessibilityRole="link"
                accessibilityLabel={`${ref.title}${ref.played ? ', you’ve played it' : ''}`}
                onPress={() => router.push({ pathname: '/game/[id]', params: { id: ref.game_id } })}
                scaleTo={0.96}
                style={StyleSheet.flatten(styles.ref)}>
                <View
                  style={{ width: REF_COVER, height: Math.round(REF_COVER / PosterAspectRatio) }}>
                  <Poster coverUrl={ref.cover_url} title={ref.title} width={REF_COVER} elevated />
                </View>
                <Text variant="bodySmall" numberOfLines={2} style={styles.refTitle}>
                  {ref.title}
                </Text>
                {ref.played && (
                  <View style={styles.played}>
                    <Ionicons name="checkmark-circle" size={12} color={theme.primaryText} />
                    <Text variant="caption" style={{ color: theme.primaryText }}>
                      Played
                    </Text>
                  </View>
                )}
              </PressableScale>
            ))}
          </View>
        </View>
      )}

      {!mine && (
        <FamiliarityLine
          referenceCount={ping.reference_count}
          matchedCount={ping.matched_count}
          reviewedCount={ping.reviewed_count}
        />
      )}

      <View style={styles.reportRow}>
        <ReportFlag
          target={{ kind: 'ping', targetId: ping.id, authorId: ping.user_id }}
          authorId={ping.user_id}
          label={`Report ${name}’s ping`}
          withWord
        />
      </View>
    </View>
  );
}

/** The game that answered it, leading the page once it is Found. */
function Answer({ ping }: { ping: PingFeedRow }) {
  const router = useRouter();
  const theme = useTheme();
  const material = useCardMaterial();
  const game = ping.resolved_game!;
  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={`Found it: ${game.title}`}
      onPress={() => router.push({ pathname: '/game/[id]', params: { id: game.game_id } })}
      scaleTo={0.98}
      style={StyleSheet.flatten([
        cardShape,
        styles.answer,
        { backgroundColor: material.fill, borderColor: theme.primaryText },
      ])}>
      <Poster coverUrl={game.cover_url} title={game.title} width={48} />
      <View style={styles.answerText}>
        <View style={styles.played}>
          <Ionicons name="checkmark-circle" size={14} color={theme.primaryText} />
          <Text variant="caption" style={{ color: theme.primaryText }}>
            Found it
          </Text>
        </View>
        <Text variant="h4" numberOfLines={2}>
          {game.title}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
    </PressableScale>
  );
}

/**
 * The one thing to do here. A visitor: Suggest a game (or why not). The owner:
 * Mark as found, then Edit and More (close, reopen, delete) beside it.
 */
function Actions({
  ping,
  mine,
  viewerId,
  suggestions,
}: {
  ping: PingFeedRow;
  mine: boolean;
  viewerId: string;
  suggestions: PingSuggestion[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [finding, setFinding] = useState(false);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['ping', ping.id] });
    void queryClient.invalidateQueries({ queryKey: ['pings'] });
  };

  const status = useMutation({
    mutationFn: ({ next, game }: { next: PingStatus; game?: string | null }) =>
      setPingStatus(ping.id, next, game ?? null),
    onSuccess: () => {
      setFinding(false);
      refresh();
    },
  });

  const remove = useMutation({
    mutationFn: () => deletePing(ping.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pings'] });
      queryClient.removeQueries({ queryKey: ['ping', ping.id] });
      router.back();
    },
  });

  if (!mine) {
    if (canSuggest(ping, viewerId)) {
      return (
        <Button
          title={ping.my_suggestion_count > 0 ? 'Suggest another game' : 'Suggest a game'}
          icon="add"
          fullWidth
          onPress={() => router.push({ pathname: '/suggest-game/[id]', params: { id: ping.id } })}
        />
      );
    }
    return (
      <Text variant="bodySmall" color="textMuted" style={styles.closedNote}>
        {ping.status === 'found'
          ? 'They found what they were looking for, so this ping isn’t taking suggestions.'
          : 'This ping is closed to new suggestions.'}
      </Text>
    );
  }

  function more() {
    const options: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];
    if (ping.status === 'open') {
      options.push({ text: 'Close it', onPress: () => status.mutate({ next: 'closed' }) });
    } else {
      options.push({ text: 'Reopen it', onPress: () => status.mutate({ next: 'open' }) });
    }
    options.push({
      text: 'Delete',
      style: 'destructive',
      onPress: () =>
        showAlert('Delete this ping?', 'Its suggestions go with it. This can’t be undone.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => remove.mutate() },
        ]),
    });
    options.push({ text: 'Cancel', style: 'cancel' });
    showAlert('Your ping', undefined, options);
  }

  const busy = status.isPending || remove.isPending;
  const error = status.error ?? remove.error;

  return (
    <View style={styles.ownerActions}>
      <View style={styles.ownerRow}>
        {ping.status === 'open' ? (
          <View style={styles.grow}>
            <Button
              title="Mark as found"
              icon="checkmark-circle-outline"
              fullWidth
              loading={status.isPending && status.variables?.next === 'found'}
              disabled={busy}
              onPress={() => setFinding(true)}
            />
          </View>
        ) : (
          <View style={styles.grow}>
            <Button
              title="Reopen"
              icon="refresh"
              fullWidth
              loading={status.isPending}
              disabled={busy}
              onPress={() => status.mutate({ next: 'open' })}
            />
          </View>
        )}
        <Button
          title="Edit"
          variant="secondary"
          icon="create-outline"
          disabled={busy}
          onPress={() => router.push({ pathname: '/new-ping', params: { edit: ping.id } })}
        />
        <IconButton
          icon="ellipsis-horizontal"
          accessibilityLabel="More: close, reopen or delete"
          disabled={busy}
          onPress={more}
        />
      </View>
      {error && (
        <Text variant="bodySmall" color="danger">
          {error instanceof Error ? error.message : 'That didn’t work. Try again.'}
        </Text>
      )}
      <FoundSheet
        visible={finding}
        suggestions={suggestions}
        busy={status.isPending}
        onClose={() => setFinding(false)}
        onPick={(game) => status.mutate({ next: 'found', game })}
      />
    </View>
  );
}

/** "Which one did it?" — the suggested games, or none of them. */
function FoundSheet({
  visible,
  suggestions,
  busy,
  onClose,
  onPick,
}: {
  visible: boolean;
  suggestions: PingSuggestion[];
  busy: boolean;
  onClose: () => void;
  onPick: (gameId: string | null) => void;
}) {
  const games = useMemo(() => {
    const seen = new Map<string, PingSuggestion>();
    for (const suggestion of suggestions)
      if (!seen.has(suggestion.game_id)) seen.set(suggestion.game_id, suggestion);
    return [...seen.values()];
  }, [suggestions]);
  const [chosen, setChosen] = useState<string | null>(null);

  return (
    <SlideUpSheet visible={visible} onClose={onClose} title="Found it?">
      <PageScrollView contentContainerStyle={styles.sheet} showsVerticalScrollIndicator={false}>
        <Text variant="body" color="textSecondary">
          It leaves the feed and stops taking suggestions; everything suggested stays here. Which
          game did it?
        </Text>
        <View style={styles.choices} accessibilityRole="radiogroup">
          {games.map((suggestion) => (
            <SelectionCard
              key={suggestion.game_id}
              title={suggestion.game?.title ?? 'A game'}
              hint={`Suggested by ${displayNameFor(suggestion.profile)}`}
              selected={chosen === suggestion.game_id}
              onPress={() => setChosen(suggestion.game_id)}
              leading={
                <Poster
                  coverUrl={suggestion.game?.cover_url}
                  title={suggestion.game?.title}
                  width={32}
                />
              }
            />
          ))}
          <SelectionCard
            title={games.length > 0 ? 'Something else' : 'I found something'}
            hint="Not one of these, or you’d rather not say"
            selected={chosen === null}
            onPress={() => setChosen(null)}
          />
        </View>
        <Button title="Mark as found" fullWidth loading={busy} onPress={() => onPick(chosen)} />
      </PageScrollView>
    </SlideUpSheet>
  );
}

function Suggestions({
  ping,
  mine,
  query,
}: {
  ping: PingFeedRow;
  mine: boolean;
  query: UseQueryResult<PingSuggestion[]>;
}) {
  const groups = useMemo(
    () => groupSuggestions(query.data ?? [], ping.resolved_game?.game_id ?? null),
    [query.data, ping.resolved_game]
  );

  return (
    <View style={styles.suggestions}>
      <View style={styles.sectionHead}>
        <Text variant="h3" accessibilityRole="header">
          Suggestions
        </Text>
        <Text variant="body" color="textMuted">
          {suggestionCount(query.data?.length ?? ping.suggestion_count)}
        </Text>
      </View>

      {query.isPending ? (
        <LoadingState />
      ) : query.isLoadingError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : groups.length === 0 ? (
        <Text variant="body" color="textMuted" style={styles.none}>
          {mine
            ? 'Nobody has suggested anything yet. People who played the games you named see your ping first.'
            : ping.status === 'open'
              ? 'Nothing yet. Be the first to suggest a game.'
              : 'Nobody suggested anything.'}
        </Text>
      ) : (
        groups.map((group) => (
          <SuggestionGroupCard key={group.gameId} group={group} isOwner={mine} pingId={ping.id} />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.x16, paddingBottom: Spacing.x48, gap: Spacing.x24 },
  request: { gap: Spacing.x16 },
  author: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  who: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  whoText: { flex: 1, minWidth: 0, gap: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.x8 },
  tag: { paddingHorizontal: Spacing.x12, paddingVertical: 5, borderRadius: 999 },
  refsBlock: { gap: Spacing.x8 },
  refs: { flexDirection: 'row', gap: Spacing.x16 },
  ref: { width: REF_COVER, gap: Spacing.x8 },
  refTitle: { marginTop: 2 },
  played: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reportRow: { flexDirection: 'row' },
  answer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    padding: CARD_INSET,
  },
  answerText: { flex: 1, minWidth: 0, gap: 2 },
  closedNote: { textAlign: 'center' },
  ownerActions: { gap: Spacing.x8 },
  ownerRow: { flexDirection: 'row', gap: Spacing.x8, alignItems: 'center' },
  grow: { flex: 1 },
  sheet: { padding: Spacing.x16, gap: Spacing.x16, paddingBottom: Spacing.x40 },
  choices: { gap: Spacing.x8 },
  suggestions: { gap: CARD_GAP },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.x8,
    marginBottom: Spacing.x4,
  },
  none: { paddingVertical: Spacing.x8 },
});
