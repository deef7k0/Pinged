import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageScrollView } from '@/components/ui/page-scroll';
import { ScorePill } from '@/components/ui/score';
import { EmptyState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { STATUS_LABEL, statusColor } from '@/constants/status';
import { Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getMyLog, getOwnedGames, getProfile } from '@/lib/api';
import { displayNameFor } from '@/lib/format';
import { getGameById } from '@/lib/games';
import { formatPlaytime } from '@/lib/gaming';
import { normaliseQuote } from '@/lib/review-quote';
import { useAuth } from '@/store/auth';

/**
 * One person's record of one game: what they logged, and what Steam measured.
 *
 * ## Why this is keyed by (user, game) and not by log id
 *
 * A linked Steam account produces playtime for games that were never formally
 * logged, so there is frequently no log row to key on and the Steam half is the
 * only half there is. The pair is the only identity that covers both.
 *
 * ## What it used to be
 *
 * The second of two tabs on a `/diary/[user]/[game]` route. The diary — a running
 * log of short dated notes per game — has been removed from the app, and this
 * screen is what was underneath it: a real destination with two live entry
 * points, the library grid and the Steam rail on a profile, both of which open a
 * cover to ask "what is *their* record of this", not "what is this game".
 *
 * The route moved with it. A path still spelled `/diary/…` would be the last
 * mention of a feature that no longer exists, and the screen it addressed was
 * never the diary.
 *
 * ## Whose it is
 *
 * Anyone's — a profile is public and so is this. Nothing here is editable by
 * anybody, including its owner: a log is edited from `log/[id]` and Steam's
 * figures are measured rather than entered, so there was never an action for
 * this screen to offer.
 */
export default function GameStatsScreen() {
  const params = useLocalSearchParams<{ user: string; game: string }>();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;

  const userId = params.user;
  const gameId = params.game;

  const owner = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => getProfile(userId),
    enabled: !!userId,
  });

  const log = useQuery({
    queryKey: ['my-log', userId, gameId],
    queryFn: () => getMyLog(userId, gameId),
    enabled: !!userId && !!gameId,
  });

  /** Steam playtime and achievements for this title, when the account is linked. */
  const owned = useQuery({
    queryKey: ['gaming-owned-one', userId, gameId],
    queryFn: async () => {
      const games = await getOwnedGames(userId, { sort: 'most-played' });
      return games.find((entry) => entry.gameId === gameId) ?? null;
    },
    enabled: !!userId && !!gameId,
  });

  /* The game's art at the head (the Apple pass, 2026-11-05) — the page had
     none. Shares the game page's `['game', id]`. */
  const game = useQuery({
    queryKey: ['game', gameId],
    queryFn: ({ signal }) => getGameById(gameId, signal),
    enabled: !!gameId,
    staleTime: 30 * 60_000,
  });

  if (!userId || !gameId) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back title="Game record" />}>
        <EmptyState title="Nothing to show" />
      </Screen>
    );
  }

  const ownerName =
    viewerId === userId ? 'You' : owner.data ? displayNameFor(owner.data) : 'This player';

  return (
    <Screen
      edges={['bottom']}
      insetHeader
      topBar={
        <FrostedTopBar back title={ownerName === 'You' ? 'Your record' : `${ownerName}’s record`} />
      }>
      <Stats
        log={log.data ?? null}
        owned={owned.data ?? null}
        loading={log.isLoading}
        ownerName={ownerName}
        artUrl={game.data?.heroUrl ?? game.data?.coverUrl ?? null}
        title={game.data?.title ?? null}
      />
    </Screen>
  );
}

function Stats({
  log,
  owned,
  loading,
  ownerName,
  artUrl,
  title,
}: {
  log: Awaited<ReturnType<typeof getMyLog>>;
  owned: Awaited<ReturnType<typeof getOwnedGames>>[number] | null;
  loading: boolean;
  ownerName: string;
  artUrl: string | null;
  title: string | null;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();

  if (loading) return <LoadingState />;

  if (!log && !owned) {
    return (
      <EmptyState
        title="Nothing logged"
        message={`${ownerName === 'You' ? 'You have' : `${ownerName} has`} not logged this game.`}
      />
    );
  }

  return (
    <PageScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {artUrl ? (
        <View style={[styles.art, { height: Math.round(width * 0.42) }]}>
          <Image
            source={{ uri: artUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            accessibilityIgnoresInvertColors
          />
          <LinearGradient
            pointerEvents="none"
            colors={[
              withAlpha(theme.background, 0.1),
              withAlpha(theme.background, 0.55),
              theme.background,
            ]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}
      {title ? (
        <Text variant="h2" style={styles.gameTitle}>
          {title}
        </Text>
      ) : null}
      <View style={styles.stats}>
        {log && (
          <View style={[styles.statCard, { borderTopColor: theme.border }]}>
            <View style={styles.statHead}>
              <Text variant="h5" style={{ color: statusColor(log.status, theme) }}>
                {STATUS_LABEL[log.status]}
              </Text>
              {log.platinum && <Ionicons name="trophy" size={16} color={theme.platinum} />}
            </View>

            {log.rating !== null && <ScorePill score={log.rating} size="large" showLabel />}

            <View style={styles.statGrid}>
              {log.hours_played !== null && <Stat label="Hours" value={`${log.hours_played}`} />}
              {log.completion_percent !== null && (
                <Stat label="Completion" value={`${log.completion_percent}%`} />
              )}
              {log.played_on && <Stat label="Played on" value={log.played_on} />}
            </View>

            {/* The review in one sentence (0040; it was a headline). */}
            {!!normaliseQuote(log.review_title) && (
              <Text variant="h5" numberOfLines={3}>
                {`“${normaliseQuote(log.review_title)}”`}
              </Text>
            )}
          </View>
        )}

        {/* Steam figures, when the account is linked. Shown separately from the
            hand-entered log so it is obvious which numbers are measured and
            which are self-reported. */}
        {owned && (
          <View style={[styles.statCard, { borderTopColor: theme.border }]}>
            <View style={styles.statHead}>
              <Ionicons name="logo-steam" size={15} color={theme.textSecondary} />
              <Text variant="h5" color="textSecondary">
                From Steam
              </Text>
            </View>

            <View style={styles.statGrid}>
              <Stat label="Playtime" value={formatPlaytime(owned.playtimeMinutes)} />
              {owned.playtimeRecentMinutes > 0 && (
                <Stat label="Last 2 weeks" value={formatPlaytime(owned.playtimeRecentMinutes)} />
              )}
              {owned.achievementsTotal !== null && owned.achievementsTotal > 0 && (
                <Stat
                  label="Achievements"
                  value={`${owned.achievementsUnlocked ?? 0}/${owned.achievementsTotal}`}
                />
              )}
            </View>

            {owned.lastPlayedAt && (
              <Text variant="caption" color="textMuted">
                Last played {new Date(owned.lastPlayedAt).toLocaleDateString()}
              </Text>
            )}
          </View>
        )}
      </View>
    </PageScrollView>
  );
}

/** A figure in a rounded tile — Fitness' (the Apple pass, 2026-11-05). */
function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={[styles.stat, { backgroundColor: withAlpha(theme.text, 0.07) }]}>
      <Text variant="h3" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.x16, paddingBottom: Spacing.x32 },
  art: { marginHorizontal: -Spacing.x16, overflow: 'hidden' },
  gameTitle: { marginTop: -Spacing.x24, marginBottom: Spacing.x8 },
  stats: { gap: Spacing.x12 },
  statCard: {
    paddingVertical: Spacing.x16,
    gap: Spacing.x12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.x8 },
  stat: {
    flexGrow: 1,
    flexBasis: '30%',
    gap: 2,
    alignItems: 'center',
    paddingVertical: Spacing.x12,
    paddingHorizontal: Spacing.x8,
    borderRadius: 16,
    borderCurve: 'continuous',
  },
});
