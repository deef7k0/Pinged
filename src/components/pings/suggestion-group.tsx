import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { memo, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { PORTRAIT_COLUMNS, gridItemWidth } from '@/components/gaming/game-tile';
import { ReportFlag } from '@/components/report-flag';
import { Avatar } from '@/components/ui/avatar';
import { showAlert } from '@/components/ui/dialog';
import { Poster } from '@/components/ui/poster';
import { PressGlyph } from '@/components/ui/press-glyph';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Tray } from '@/components/ui/tray';
import { Spacing, Typeface } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { setSuggestionInteresting, withdrawSuggestion, type PingSuggestion } from '@/lib/api';
import { displayNameFor, timeAgoPosted } from '@/lib/format';
import { suggestedBy, type SuggestionGroup } from '@/lib/pings';
import { toast } from '@/lib/toast';
import { useAuth } from '@/store/auth';

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
/**
 * A ping's suggestions as a grid of covers, three across — a collection's
 * (the owner's, 2026-11-05): the answer and the owner's starred ones wear a
 * mark in the corner, and a game suggested by several people says how many.
 * A cover opens a small sheet (`<SuggestionSheet>`): the cover, the game's
 * details beside it, and under them each person who suggested it and why.
 * The game page's Wishlist · Favourite · Log · Collect keys that were under
 * each card are gone — "those are from the old app style".
 */
export function SuggestionGrid({
  groups,
  isOwner,
  pingId,
}: {
  groups: readonly SuggestionGroup<PingSuggestion>[];
  isOwner: boolean;
  pingId: string;
}) {
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState<string | null>(null);
  /* The page pads itself by the app's margin; three across inside it. */
  const tile = gridItemWidth(width, PORTRAIT_COLUMNS, Spacing.x16, GRID_GAP);
  const current = groups.find((group) => group.gameId === open) ?? null;

  return (
    <>
      <View style={styles.grid}>
        {groups.map((group) => (
          <SuggestionTile
            key={group.gameId}
            group={group}
            width={tile}
            onOpen={() => setOpen(group.gameId)}
          />
        ))}
      </View>
      <Tray visible={current !== null} onClose={() => setOpen(null)}>
        {current && (
          <SuggestionSheet
            group={current}
            isOwner={isOwner}
            pingId={pingId}
            onLeave={() => setOpen(null)}
          />
        )}
      </Tray>
    </>
  );
}

const GRID_GAP = Spacing.x8;

const SuggestionTile = memo(function SuggestionTile({
  group,
  width,
  onOpen,
}: {
  group: SuggestionGroup<PingSuggestion>;
  width: number;
  onOpen: () => void;
}) {
  const theme = useTheme();
  const game = group.suggestions[0].game;
  const title = game?.title ?? 'A game';
  const count = group.suggestions.length;
  const names = group.suggestions.map((suggestion) => displayNameFor(suggestion.profile));

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={[
        title,
        group.solved ? 'the answer' : group.interesting ? 'worth a look' : null,
        suggestedBy(names),
      ]
        .filter(Boolean)
        .join('. ')}
      accessibilityHint="Shows who suggested it and why"
      onPress={onOpen}
      scaleTo={0.95}>
      <Poster
        coverUrl={game?.cover_url}
        heroUrl={game?.hero_url}
        title={title}
        width={width}
        rounded="image"
        zoomable={false}
      />
      {(group.solved || group.interesting) && (
        <View style={[styles.corner, styles.cornerStart, { backgroundColor: theme.background }]}>
          <Ionicons
            name={group.solved ? 'checkmark-circle' : 'star'}
            size={16}
            color={group.solved ? theme.primaryText : theme.scoreMid}
          />
        </View>
      )}
      {count > 1 && (
        <View style={[styles.corner, styles.cornerEnd, { backgroundColor: theme.background }]}>
          <Text variant="caption" style={styles.countText}>
            ×{count}
          </Text>
        </View>
      )}
    </PressableScale>
  );
});

/**
 * One suggested game, small: its cover with what it is beside it — the
 * answer or worth a look, the name, who made it and when — and a way to its
 * page; under them, everybody who suggested it, with their reason.
 */
function SuggestionSheet({
  group,
  isOwner,
  pingId,
  onLeave,
}: {
  group: SuggestionGroup<PingSuggestion>;
  isOwner: boolean;
  pingId: string;
  onLeave: () => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const game = group.suggestions[0].game;
  const title = game?.title ?? 'A game';
  const meta = [game?.developer, game?.release_year].filter(Boolean).join(' · ');
  const names = group.suggestions.map((suggestion) => displayNameFor(suggestion.profile));
  const openGame = () => {
    onLeave();
    router.push({ pathname: '/game/[id]', params: { id: group.gameId } });
  };

  return (
    <ScrollView contentContainerStyle={styles.sheet} showsVerticalScrollIndicator={false}>
      <View style={styles.head}>
        <PressableScale
          accessibilityRole="link"
          accessibilityLabel={`Open ${title}`}
          onPress={openGame}
          scaleTo={0.96}>
          <Poster
            coverUrl={game?.cover_url}
            heroUrl={game?.hero_url}
            title={title}
            width={SHEET_COVER}
            rounded="image"
            zoomable={false}
          />
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
          <Text variant="h3" numberOfLines={3}>
            {title}
          </Text>
          {meta ? (
            <Text variant="bodySmall" color="textSecondary" numberOfLines={2}>
              {meta}
            </Text>
          ) : null}
          <Text variant="caption" color="textMuted" numberOfLines={2}>
            {suggestedBy(names)}
          </Text>
          <PressableScale
            accessibilityRole="link"
            onPress={openGame}
            scaleTo={0.97}
            style={StyleSheet.flatten(styles.openGame)}>
            <Text variant="h5" style={{ color: theme.primaryText }}>
              Open the game
            </Text>
            <Ionicons name="chevron-forward" size={14} color={theme.primaryText} />
          </PressableScale>
        </View>
      </View>

      <View style={styles.reasons}>
        {group.suggestions.map((suggestion) => (
          <Reason
            key={suggestion.id}
            suggestion={suggestion}
            isOwner={isOwner}
            pingId={pingId}
            onLeave={onLeave}
          />
        ))}
      </View>
    </ScrollView>
  );
}

/** The sheet's cover: a third of a phone, beside the game's details. */
const SHEET_COVER = 112;

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
  onLeave,
}: {
  suggestion: PingSuggestion;
  isOwner: boolean;
  pingId: string;
  /** The sheet it is in closing, before a screen or a dialog opens over it. */
  onLeave?: () => void;
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
    onLeave?.();
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
          onPress={() => {
            onLeave?.();
            router.push({ pathname: '/profile/[id]', params: { id: suggestion.user_id } });
          }}
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
          onBeforeOpen={onLeave}
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

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  corner: {
    position: 'absolute',
    top: 6,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerStart: { left: 6 },
  cornerEnd: { right: 6 },
  countText: { fontFamily: Typeface.semibold },
  sheet: { padding: Spacing.x16, gap: Spacing.x16 },
  openGame: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: Spacing.x8 },
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
});
