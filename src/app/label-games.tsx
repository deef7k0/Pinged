import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GameSearchResults } from '@/components/game-search-results';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { EmptyState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { GAME_LABEL_TEXT, isGameLabel, type GameLabel } from '@/constants/game-labels';
import { Spacing } from '@/constants/theme';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { setGameLabelLocally } from '@/hooks/use-game-labels';
import { getLabelledGameIds, isModerator, setGameLabel } from '@/lib/api';
import { getGameById, type GameSearchResult } from '@/lib/games';
import { useAuth } from '@/store/auth';

/**
 * Put a label on games, one tap each. Moderators only (0034).
 *
 * The picker behind the Must Play list's "+": search the catalogue, tap a game,
 * and it carries the label. Unlike the collection picker this **stays open** —
 * labelling is something a moderator does several of in a sitting, and going
 * back to the list after each one would be a search retyped every time. A game
 * that already has the label says so on its row and cannot be tapped again;
 * taking a label off is done where the label is shown, not here.
 *
 * The screen checks who is asking only to say so plainly. The refusal that
 * matters is the table's: its insert policy admits `public.moderators` and
 * nobody else.
 */
export default function LabelGamesScreen() {
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id);
  const params = useLocalSearchParams<{ label?: string }>();
  const label: GameLabel = isGameLabel(params.label) ? params.label : 'must_play';
  const words = GAME_LABEL_TEXT[label];

  const [input, setInput] = useState('');
  const query = useDebouncedValue(input.trim());

  const moderator = useQuery({
    queryKey: ['is-moderator', userId],
    queryFn: isModerator,
    enabled: !!userId,
  });

  const labelled = useQuery({
    queryKey: ['labelled-game-ids', label],
    queryFn: () => getLabelledGameIds(label),
  });
  const existing = new Set(labelled.data ?? []);

  const add = useMutation({
    mutationFn: async (result: GameSearchResult) => {
      /* A search result is the subset of a game a row needs; the label's
         foreign key wants the game in the shared cache, which wants the full
         record. Same step the collection picker takes. */
      const game = await getGameById(result.id);
      if (!game) throw new Error(`Could not load “${result.title}” from IGDB.`);
      await setGameLabel(userId!, game, label, true);
      return game.id;
    },
    onSuccess: (gameId) => {
      setGameLabelLocally(gameId, label, true);
      queryClient.setQueryData<string[]>(['labelled-game-ids', label], (ids) => [
        ...(ids ?? []),
        gameId,
      ]);
      queryClient.invalidateQueries({ queryKey: ['labelled-games', label] });
    },
  });

  if (moderator.data === false) {
    return (
      <Screen
        edges={['bottom']}
        padded
        insetHeader
        modal
        topBar={<FrostedTopBar dismiss title={`Label games ${words.title}`} />}>
        <EmptyState
          title="Moderators only"
          message={`${words.title} is set by Pinged’s moderators.`}
        />
      </Screen>
    );
  }

  return (
    <Screen
      edges={['bottom']}
      insetHeader
      modal
      topBar={<FrostedTopBar dismiss title={`Label games ${words.title}`} />}>
      <View style={styles.header}>
        <TextField
          value={input}
          onChangeText={setInput}
          icon="search"
          variant="search"
          placeholder="Search games…"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          returnKeyType="search"
          clearButtonMode="while-editing"
        />

        {add.isError && (
          <Text variant="bodySmall" color="danger">
            {add.error instanceof Error ? add.error.message : 'Could not label that game.'}
          </Text>
        )}
      </View>

      <GameSearchResults
        query={query}
        onSelect={(game) => add.mutate(game)}
        badgeFor={(game) => (existing.has(game.id) ? words.title : null)}
        /* Locked while a write is in flight, and for a game that already has
           the label — a second tap would be a second request for nothing. */
        isDisabled={(game) => add.isPending || existing.has(game.id)}
        prompt={{
          title: `Pick a ${words.title} game`,
          message: 'Search IGDB, then tap a game to give it the label.',
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Spacing.x16, paddingBottom: Spacing.x8, gap: Spacing.x12 },
});
