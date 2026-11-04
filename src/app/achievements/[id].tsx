import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageFlatList } from '@/components/ui/page-scroll';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Card } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { rarityFor } from '@/constants/rarity';
import { Radius, Spacing, withAlpha } from '@/constants/theme';
import { AccentProvider, useGameAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import {
  cacheGameAchievements,
  getAchievementsForGame,
  setAchievementUnlocked,
  syncSteamAchievements,
} from '@/lib/api';
import { getGameById, isSteamAchievementSyncAvailable, parseGameId } from '@/lib/games';
import { useAuth } from '@/store/auth';
import { toast } from '@/lib/toast';

export default function AchievementsScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuth((state) => state.session?.user.id);
  const steamId = useAuth((state) => state.profile?.steam_id);

  const game = useQuery({
    queryKey: ['game', id],
    queryFn: ({ signal }) => getGameById(id!, signal),
    enabled: !!id,
    staleTime: 30 * 60_000,
  });

  const achievements = useQuery({
    queryKey: ['game-achievements', id, userId],
    queryFn: () => getAchievementsForGame(id!, userId ?? null),
    enabled: !!id,
  });

  const accent = useGameAccent(game.data?.heroUrl ?? game.data?.coverUrl, game.data?.genres);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['game-achievements', id] });
    queryClient.invalidateQueries({ queryKey: ['achievement-stats', userId] });
  }

  /** Fetch the catalogue from the provider the first time anyone opens this game. */
  const load = useMutation({
    mutationFn: async () => {
      if (!game.data) throw new Error('Game details are still loading.');
      return cacheGameAchievements(game.data);
    },
    onSuccess: invalidate,
  });

  const toggle = useMutation({
    mutationFn: async ({
      achievementId,
      unlocked,
    }: {
      achievementId: string;
      unlocked: boolean;
    }) => {
      if (!userId) throw new Error('You must be signed in.');
      await setAchievementUnlocked(userId, achievementId, unlocked);
    },
    onSuccess: invalidate,
  });

  const sync = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('You must be signed in.');
      if (!steamId) throw new Error('Link your SteamID64 on your profile first.');
      if (!game.data) throw new Error('Game details are still loading.');
      return syncSteamAchievements(userId, steamId, game.data);
    },
    onSuccess: () => {
      toast.success('Achievements synced');
      return invalidate();
    },
  });

  if (game.isLoading || achievements.isLoading) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back title="Achievements" />}>
        <LoadingState />
      </Screen>
    );
  }

  if (achievements.isLoadingError) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back title="Achievements" />}>
        <ErrorState error={achievements.error} />
      </Screen>
    );
  }

  const list = achievements.data ?? [];
  const unlocked = list.filter((entry) => entry.unlocked_at).length;
  const isSteamGame = parseGameId(id ?? '')?.source === 'steam';
  const canSync = isSteamGame && isSteamAchievementSyncAvailable();
  const error = load.error ?? sync.error ?? toggle.error;

  return (
    <AccentProvider artwork={game.data?.heroUrl ?? game.data?.coverUrl} genres={game.data?.genres}>
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back title="Achievements" />}>
        <PageFlatList
          data={list}
          keyExtractor={(entry) => entry.id}
          contentContainerStyle={list.length === 0 ? styles.emptyContent : styles.content}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            list.length > 0 ? (
              <View style={styles.header}>
                <Card>
                  <View style={styles.progressRow}>
                    <View style={styles.progressText}>
                      <Text variant="h3">
                        {unlocked} / {list.length}
                      </Text>
                      <Text variant="bodySmall" color="textMuted">
                        {list.length > 0 ? Math.round((unlocked / list.length) * 100) : 0}% complete
                      </Text>
                    </View>
                    {unlocked === list.length && list.length > 0 && (
                      <Ionicons name="trophy" size={28} color={theme.platinum} />
                    )}
                  </View>

                  {/* The bar fills in the game's own colour rather than a
                    generic green. Completion is not a pass/fail result — it is
                    progress through *this* game, and the page it lives on is
                    already that colour. */}
                  <View style={[styles.track, { backgroundColor: theme.surfaceElevated }]}>
                    <View
                      style={[
                        styles.fill,
                        {
                          backgroundColor: accent.color,
                          width: `${list.length ? (unlocked / list.length) * 100 : 0}%`,
                        },
                      ]}
                    />
                  </View>
                </Card>

                {canSync && (
                  <Button
                    title={steamId ? 'Sync from Steam' : 'Link SteamID to sync'}
                    variant="secondary"
                    onPress={() => sync.mutate()}
                    loading={sync.isPending}
                    disabled={!steamId}
                    fullWidth
                  />
                )}

                {sync.isSuccess && (
                  <Text variant="bodySmall" color="success">
                    Synced {sync.data.unlocked} of {sync.data.total} achievements from Steam.
                  </Text>
                )}

                {error && (
                  <Text variant="bodySmall" color="danger">
                    {error instanceof Error ? error.message : 'Something went wrong.'}
                  </Text>
                )}
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const isUnlocked = !!item.unlocked_at;
            return (
              <PressableScale
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isUnlocked }}
                disabled={!userId || toggle.isPending}
                onPress={() => toggle.mutate({ achievementId: item.id, unlocked: !isUnlocked })}
                scaleTo={0.99}
                style={[
                  styles.row,
                  { borderTopColor: isUnlocked ? withAlpha(accent.color, 0.24) : theme.border },
                ]}>
                {item.icon_url ? (
                  <Image
                    source={{ uri: item.icon_url }}
                    recyclingKey={item.id}
                    cachePolicy="memory-disk"
                    style={[
                      styles.icon,
                      { backgroundColor: theme.surfaceElevated, opacity: isUnlocked ? 1 : 0.35 },
                    ]}
                    contentFit="cover"
                    transition={150}
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <View style={[styles.icon, { backgroundColor: theme.surfaceElevated }]}>
                    <Ionicons
                      name="medal-outline"
                      size={20}
                      color={isUnlocked ? accent.onSurface : theme.textMuted}
                    />
                  </View>
                )}

                <View style={styles.rowBody}>
                  <Text variant="h5" color={isUnlocked ? 'text' : 'textSecondary'}>
                    {item.name}
                  </Text>
                  {item.description && (
                    <Text variant="bodySmall" color="textMuted" numberOfLines={2}>
                      {item.description}
                    </Text>
                  )}
                  {/* Rarity, not just a percentage. "0.4% of players" is a fact
                    the reader has to rank against every other number on the
                    screen; "Legendary" is the ranking. The word ships beside
                    the colour so the band survives without it. */}
                  {item.global_percent !== null &&
                    (() => {
                      const band = rarityFor(item.global_percent);
                      return (
                        <View style={styles.rarityRow}>
                          {band && (
                            <Text variant="label" style={{ color: theme[band.token] }}>
                              {band.label}
                            </Text>
                          )}
                          <Text variant="caption" color="textMuted">
                            {item.global_percent.toFixed(1)}% of players
                          </Text>
                        </View>
                      );
                    })()}
                </View>

                <Ionicons
                  name={isUnlocked ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={isUnlocked ? accent.onSurface : theme.borderStrong}
                />
              </PressableScale>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              title="No achievements loaded"
              message={
                isSteamGame
                  ? 'Fetch this game’s achievement list from Steam, then tick off the ones you have earned.'
                  : 'This provider does not publish achievement data. IGDB games have none; try the Steam or RAWG version of this game.'
              }
              action={
                <Button
                  title="Load achievements"
                  onPress={() => load.mutate()}
                  loading={load.isPending}
                />
              }
            />
          }
        />
      </Screen>
    </AccentProvider>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.x16, paddingBottom: Spacing.x48 },
  emptyContent: { flexGrow: 1 },
  header: { gap: Spacing.x12, marginBottom: Spacing.x16 },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressText: { gap: Spacing.x4 },
  track: { height: 6, borderRadius: Radius.pill, marginTop: Spacing.x12, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    paddingVertical: Spacing.x12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: Radius.image,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: Spacing.x4 },
  rarityRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
});
