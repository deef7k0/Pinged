import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { memo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AddToCollection } from '@/components/add-to-collection';
import { ReportFlag } from '@/components/report-flag';
import { Avatar } from '@/components/ui/avatar';
import { cardShape, CARD_GAP, CARD_INSET, useCardMaterial } from '@/components/ui/card-material';
import { Poster } from '@/components/ui/poster';
import { PressGlyph } from '@/components/ui/press-glyph';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { KEY_GROUP_GAP, TonalKey, keyPosition } from '@/components/ui/tonal-key';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  getListMembership,
  setSuggestionInteresting,
  toggleSingletonMembership,
  withdrawSuggestion,
  type PingSuggestion,
} from '@/lib/api';
import { displayNameFor, timeAgoPosted } from '@/lib/format';
import { getGameById, type Game } from '@/lib/games';
import { suggestedBy, type SuggestionGroup } from '@/lib/pings';
import { useAuth } from '@/store/auth';
import { showAlert } from '@/components/ui/dialog';
import { listToastFor, toast } from '@/lib/toast';

/** The suggested game's box, at the head of its card. */
const COVER = 64;
/** A suggester's face beside their words. */
const FACE = 24;

/**
 * One suggested game and everybody who suggested it — the brief's grouping:
 * "multiple people may have good reasons to suggest the same title", so the
 * game is said once and each reason under it, oldest first.
 *
 * Under the reasons, the four things anybody does with a game they were just
 * told about, reusing the game page's own controls and writes: Wishlist and
 * Favourite (`toggleSingletonMembership`, the same list rows the game page's
 * keys write), Log (the log form) and Collect (`<AddToCollection>`). There is
 * no wishlist of Pings' own; a game wishlisted here is on the wishlist.
 *
 * The request's owner marks a reason "worth a look" (a star, theirs alone —
 * `set_ping_suggestion_interesting`); a suggester can take theirs back; and
 * anybody else can report one.
 */
export const SuggestionGroupCard = memo(function SuggestionGroupCard({
  group,
  isOwner,
  pingId,
}: {
  group: SuggestionGroup<PingSuggestion>;
  /** The viewer asked: they may star reasons. */
  isOwner: boolean;
  pingId: string;
}) {
  const theme = useTheme();
  const router = useRouter();
  const material = useCardMaterial();
  const game = group.suggestions[0].game;
  const title = game?.title ?? 'A game';
  const names = group.suggestions.map((suggestion) => displayNameFor(suggestion.profile));
  const meta = [game?.developer, game?.release_year].filter(Boolean).join(' · ');
  const openGame = () => router.push({ pathname: '/game/[id]', params: { id: group.gameId } });

  return (
    <View
      style={[
        cardShape,
        styles.card,
        { backgroundColor: material.fill, borderColor: material.edge },
      ]}>
      <View style={styles.head}>
        <PressableScale
          accessibilityRole="link"
          accessibilityLabel={`Open ${title}`}
          onPress={openGame}
          scaleTo={0.96}>
          <Poster coverUrl={game?.cover_url} heroUrl={game?.hero_url} title={title} width={COVER} />
        </PressableScale>
        <View style={styles.billing}>
          {(group.solved || group.interesting) && (
            <View style={styles.badges}>
              {group.solved && (
                <Badge icon="checkmark-circle" label="Found it" tint={theme.primaryText} />
              )}
              {!group.solved && group.interesting && (
                <Badge icon="star" label="Worth a look" tint={theme.scoreMid} />
              )}
            </View>
          )}
          <PressableScale accessibilityRole="link" onPress={openGame} scaleTo={0.98}>
            <Text variant="h4" numberOfLines={2}>
              {title}
            </Text>
          </PressableScale>
          {meta ? (
            <Text variant="bodySmall" color="textSecondary" numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
          <Text variant="caption" color="textMuted" numberOfLines={2}>
            {suggestedBy(names)}
          </Text>
        </View>
      </View>

      <View style={styles.reasons}>
        {group.suggestions.map((suggestion) => (
          <Reason key={suggestion.id} suggestion={suggestion} isOwner={isOwner} pingId={pingId} />
        ))}
      </View>

      <GameActions gameId={group.gameId} title={title} />
    </View>
  );
});

function Badge({
  icon,
  label,
  tint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tint: string;
}) {
  return (
    <View style={styles.badge}>
      <Ionicons name={icon} size={12} color={tint} />
      <Text variant="caption" style={{ color: tint }}>
        {label}
      </Text>
    </View>
  );
}

/** One person's reason, with the controls that are theirs or the owner's. */
function Reason({
  suggestion,
  isOwner,
  pingId,
}: {
  suggestion: PingSuggestion;
  isOwner: boolean;
  pingId: string;
}) {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;
  const name = displayNameFor(suggestion.profile);
  const mine = suggestion.user_id === viewerId;
  const message = suggestion.message?.trim();

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['ping-suggestions', pingId] });
    void queryClient.invalidateQueries({ queryKey: ['ping', pingId] });
    void queryClient.invalidateQueries({ queryKey: ['pings'] });
  };

  const star = useMutation({
    mutationFn: (next: boolean) => setSuggestionInteresting(suggestion.id, next),
    onMutate: (next) => {
      queryClient.setQueryData<PingSuggestion[]>(['ping-suggestions', pingId], (rows) =>
        rows?.map((row) => (row.id === suggestion.id ? { ...row, interesting: next } : row))
      );
    },
    onError: refresh,
  });

  const withdraw = useMutation({
    mutationFn: () => withdrawSuggestion(suggestion.id),
    onSuccess: () => {
      toast.success('Suggestion withdrawn');
      return refresh();
    },
  });

  function askWithdraw() {
    showAlert(
      'Take back your suggestion?',
      `${suggestion.game?.title ?? 'It'} comes off this ping.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take back', style: 'destructive', onPress: () => withdraw.mutate() },
      ]
    );
  }

  return (
    <View style={[styles.reason, { borderTopColor: theme.border }]}>
      <View style={styles.reasonHead}>
        <PressableScale
          accessibilityRole="link"
          accessibilityLabel={`${name}’s profile`}
          onPress={() =>
            router.push({ pathname: '/profile/[id]', params: { id: suggestion.user_id } })
          }
          hitSlop={8}
          scaleTo={0.96}
          style={StyleSheet.flatten(styles.who)}>
          <Avatar uri={suggestion.profile?.avatar_url} name={name} size={FACE} />
          <Text variant="itemTitle" numberOfLines={1} style={styles.name}>
            {mine ? 'You' : name}
          </Text>
        </PressableScale>
        <Text variant="caption" color="textMuted">
          {timeAgoPosted(suggestion.created_at)}
        </Text>
        <View style={styles.spacer} />

        {isOwner && (
          <PressableScale
            accessibilityRole="switch"
            accessibilityState={{ checked: suggestion.interesting }}
            accessibilityLabel={`Mark ${name}’s suggestion as worth a look`}
            onPress={() => star.mutate(!suggestion.interesting)}
            hitSlop={12}
            scaleTo={0.9}>
            <PressGlyph pop={suggestion.interesting}>
              <Ionicons
                name={suggestion.interesting ? 'star' : 'star-outline'}
                size={18}
                color={suggestion.interesting ? theme.scoreMid : theme.textMuted}
              />
            </PressGlyph>
          </PressableScale>
        )}
        {mine && (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Take back your suggestion"
            onPress={askWithdraw}
            disabled={withdraw.isPending}
            hitSlop={12}
            scaleTo={0.9}>
            <PressGlyph>
              <Ionicons name="trash-outline" size={16} color={theme.textMuted} />
            </PressGlyph>
          </PressableScale>
        )}
        <ReportFlag
          target={{
            kind: 'ping_suggestion',
            targetId: suggestion.id,
            authorId: suggestion.user_id,
          }}
          authorId={suggestion.user_id}
          label={`Report ${name}’s suggestion`}
        />
      </View>
      {message ? (
        <Text variant="prose" color="proseInk">
          {message}
        </Text>
      ) : (
        <Text variant="bodySmall" color="textMuted">
          No reason given.
        </Text>
      )}
      {withdraw.isError && (
        <Text variant="bodySmall" color="danger">
          {withdraw.error instanceof Error ? withdraw.error.message : 'Could not take it back.'}
        </Text>
      )}
    </View>
  );
}

/**
 * Wishlist · Favourite · Log · Collect — the game page's connected keys, for a
 * game the reader was just told about. The full game is fetched only when a
 * key needs it (`['game', id]`, the game page's own key, so a game already
 * opened costs nothing).
 */
function GameActions({ gameId, title }: { gameId: string; title: string }) {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id) ?? null;
  const [collecting, setCollecting] = useState<Game | null>(null);

  const membership = useQuery({
    queryKey: ['list-membership', userId, gameId],
    queryFn: () => getListMembership(userId!, gameId),
    enabled: !!userId,
  });

  const loadGame = async (): Promise<Game> => {
    const game = await queryClient.fetchQuery({
      queryKey: ['game', gameId],
      queryFn: ({ signal }) => getGameById(gameId, signal),
      staleTime: 30 * 60_000,
    });
    if (!game) throw new Error(`Could not load ${title}.`);
    return game;
  };

  const toggle = useMutation({
    mutationFn: async ({ kind, next }: { kind: 'favorites' | 'wishlist'; next: boolean }) => {
      if (!userId) throw new Error('You must be signed in.');
      await toggleSingletonMembership(userId, kind, await loadGame(), next);
    },
    onSuccess: (_result, { kind, next }) => {
      toast.success(listToastFor(kind, next));
      void queryClient.invalidateQueries({ queryKey: ['list-membership', userId, gameId] });
      void queryClient.invalidateQueries({ queryKey: ['favorites', userId] });
      void queryClient.invalidateQueries({ queryKey: ['lists', userId] });
      void queryClient.invalidateQueries({ queryKey: ['game-audience', gameId] });
    },
  });

  const collect = useMutation({
    mutationFn: loadGame,
    onSuccess: (game) => setCollecting(game),
  });

  if (!userId) return null;
  const busyKind = toggle.isPending ? toggle.variables?.kind : undefined;
  const wishlisted = membership.data?.wishlisted ?? false;
  const favorited = membership.data?.favorited ?? false;

  const keys = [
    {
      icon: 'bookmark' as const,
      outline: 'bookmark-outline' as const,
      label: 'Wishlist',
      active: wishlisted,
      busy: busyKind === 'wishlist' || membership.isLoading,
      onPress: () => toggle.mutate({ kind: 'wishlist', next: !wishlisted }),
    },
    {
      icon: 'star' as const,
      outline: 'star-outline' as const,
      label: 'Favourite',
      active: favorited,
      busy: busyKind === 'favorites' || membership.isLoading,
      onPress: () => toggle.mutate({ kind: 'favorites', next: !favorited }),
    },
    {
      icon: 'checkmark-circle' as const,
      outline: 'checkmark-circle-outline' as const,
      label: 'Log',
      active: undefined,
      busy: false,
      onPress: () => router.push({ pathname: '/log/[id]', params: { id: gameId } }),
    },
    {
      icon: 'albums' as const,
      outline: 'albums-outline' as const,
      label: 'Add to a collection',
      active: undefined,
      busy: collect.isPending,
      onPress: () => collect.mutate(),
    },
  ];

  const error = toggle.error ?? collect.error;

  return (
    <View style={styles.actions}>
      <View style={styles.keys}>
        {keys.map((key, index) => (
          <View key={key.label} style={styles.key}>
            <TonalKey
              icon={key.icon}
              outline={key.outline}
              active={key.active}
              busy={key.busy}
              label={`${key.label}: ${title}`}
              caption={key.label === 'Log' ? 'Log' : undefined}
              onPress={key.onPress}
              position={keyPosition(index, keys.length)}
            />
          </View>
        ))}
      </View>
      {error && (
        <Text variant="bodySmall" style={{ color: theme.danger }}>
          {error instanceof Error ? error.message : 'That didn’t work. Try again.'}
        </Text>
      )}
      {collecting && (
        <AddToCollection game={collecting} visible onClose={() => setCollecting(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: CARD_INSET, gap: CARD_GAP },
  head: { flexDirection: 'row', gap: Spacing.x12, alignItems: 'flex-start' },
  billing: { flex: 1, minWidth: 0, gap: 3 },
  badges: { flexDirection: 'row', gap: Spacing.x8, marginBottom: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reasons: { gap: 0 },
  reason: {
    gap: Spacing.x8,
    paddingVertical: Spacing.x12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  reasonHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8, minHeight: 28 },
  who: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8, flexShrink: 1, minWidth: 0 },
  name: { flexShrink: 1 },
  spacer: { flex: 1 },
  actions: { gap: Spacing.x8 },
  keys: { flexDirection: 'row', gap: KEY_GROUP_GAP, borderRadius: Radius.pill },
  key: { flex: 1 },
});
