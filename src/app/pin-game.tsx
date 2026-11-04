import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GameSearchResults } from '@/components/game-search-results';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { MAX_PINS, getLibraryPins, pinGame } from '@/lib/api';
import { getGameById, type GameSearchResult } from '@/lib/games';
import { useAuth } from '@/store/auth';
import { toast } from '@/lib/toast';

/**
 * Pick a game to pin to the head of your library (0043) — the library's "+".
 * One tap pins it and goes back, as the collection picker adds and goes back.
 */
export default function PinGameScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id) ?? null;

  const [input, setInput] = useState('');
  const query = useDebouncedValue(input.trim());

  const pins = useQuery({
    queryKey: ['library-pins', userId],
    queryFn: () => getLibraryPins(userId!),
    enabled: !!userId,
  });
  const pinned = new Set((pins.data ?? []).map((pin) => pin.game.id));
  const full = (pins.data?.length ?? 0) >= MAX_PINS;

  const pin = useMutation({
    mutationFn: async (result: GameSearchResult) => {
      const game = await getGameById(result.id);
      if (!game) throw new Error(`Could not load “${result.title}” from IGDB.`);
      await pinGame(
        userId!,
        game,
        (pins.data ?? []).map((row) => row.position)
      );
    },
    onSuccess: () => {
      toast.success('Pinned to your library');
      queryClient.invalidateQueries({ queryKey: ['library-pins', userId] });
      router.back();
    },
  });

  return (
    <Screen
      edges={['bottom']}
      insetHeader
      modal
      topBar={<FrostedTopBar dismiss title="Pin a game" />}>
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
        {full && (
          <Text variant="bodySmall" color="textMuted">
            {`All ${MAX_PINS} places are taken. Hold a pinned game in your library to unpin it.`}
          </Text>
        )}
        {pin.isError && (
          <Text variant="bodySmall" color="danger">
            {pin.error instanceof Error ? pin.error.message : 'Could not pin that game.'}
          </Text>
        )}
      </View>

      <GameSearchResults
        query={query}
        onSelect={(game) => pin.mutate(game)}
        badgeFor={(game) => (pinned.has(game.id) ? 'Pinned' : null)}
        isDisabled={(game) => pin.isPending || full || pinned.has(game.id)}
        prompt={{
          title: 'Pin a game',
          message: `Search IGDB, then tap a game to pin it to the top of your library. Up to ${MAX_PINS}.`,
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: Spacing.x16, gap: Spacing.x8 },
});
