import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';

import {
  AchievementHead,
  AchievementMedallion,
  MEDALLION_COLUMNS,
  MEDALLION_GAP,
  useMedallionWidth,
} from '@/components/achievement-parts';
import { Button } from '@/components/ui/button';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageFlatList } from '@/components/ui/page-scroll';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { AccentProvider, useGameAccent } from '@/hooks/use-accent';
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
  const medallion = useMedallionWidth();

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
          numColumns={MEDALLION_COLUMNS}
          columnWrapperStyle={styles.column}
          contentContainerStyle={list.length === 0 ? styles.emptyContent : styles.content}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            list.length > 0 ? (
              <AchievementHead
                artUrl={game.data?.heroUrl ?? game.data?.coverUrl}
                unlocked={unlocked}
                total={list.length}
                color={accent.color}
                background={accent.page}
                figures={[
                  { label: 'unlocked', value: String(unlocked) },
                  { label: 'to go', value: String(list.length - unlocked) },
                  {
                    label: 'complete',
                    value: `${list.length ? Math.round((unlocked / list.length) * 100) : 0}%`,
                  },
                ]}>
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
              </AchievementHead>
            ) : null
          }
          renderItem={({ item }) => {
            const isUnlocked = !!item.unlocked_at;
            return (
              <AchievementMedallion
                name={item.name}
                description={item.description}
                iconUrl={item.icon_url}
                unlocked={isUnlocked}
                percent={item.global_percent}
                width={medallion}
                accent={accent.color}
                disabled={!userId || toggle.isPending}
                onPress={() => toggle.mutate({ achievementId: item.id, unlocked: !isUnlocked })}
              />
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="trophy-outline"
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
  content: { paddingHorizontal: Spacing.x16, paddingBottom: Spacing.x48 },
  emptyContent: { flexGrow: 1 },
  column: { gap: MEDALLION_GAP },
});
