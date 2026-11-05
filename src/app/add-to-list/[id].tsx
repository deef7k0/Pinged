import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GameSearchResults } from '@/components/game-search-results';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { EmptyState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { addToList, appendToList, getList, removeFromList } from '@/lib/api';
import { getGameById, type GameSearchResult } from '@/lib/games';
import { toast } from '@/lib/toast';

/**
 * Pick a game to add to a collection.
 *
 * Its own screen rather than a trip to the Search tab. "Add games" used to push
 * `/search`, which dropped you into the general search with no memory of where
 * you came from: tapping a result opened the game page, and the collection was
 * never touched. Search there is for browsing; this is a picker, and a picker
 * has to return something.
 *
 * So one tap does the whole job — resolve the game, write the row, invalidate
 * the collection, and go back to it. No confirmation step: adding is one row in
 * a list the owner can remove from, which is not worth an "are you sure".
 *
 * ## Replacing one game with another
 *
 * `?position=` puts the game at that position instead of the end, and
 * `?replace=` removes that game once the new one is in — the favourites
 * widget's Replace, which keeps a ranked top four in its order. Written in that
 * order, so a failed add never loses the game it was replacing. A game already
 * in the list moves to the position rather than being added twice.
 */
export default function AddToListScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id, position, replace } = useLocalSearchParams<{
    id: string;
    position?: string;
    replace?: string;
  }>();
  const at = position !== undefined && position !== '' ? Number(position) : null;

  const [input, setInput] = useState('');
  const query = useDebouncedValue(input.trim());

  const list = useQuery({
    queryKey: ['list', id],
    queryFn: () => getList(id!),
    enabled: !!id,
  });

  // Already in the collection. Used to mark those rows rather than to block
  // them: `appendToList` upserts, so a double tap is harmless either way.
  const existing = new Set((list.data?.items ?? []).map((item) => item.game_id));

  const add = useMutation({
    mutationFn: async (result: GameSearchResult) => {
      /*
       * Search returns a `GameSearchResult`, which is the subset of a game a
       * result row needs. `list_items` has a foreign key to `games`, and that
       * cache row wants the description, screenshots and store URL too — so the
       * full record is fetched before the write rather than caching a thin row
       * that every later screen would have to top up.
       */
      const game = await getGameById(result.id);
      if (!game) throw new Error(`Could not load “${result.title}” from IGDB.`);

      if (at !== null && Number.isFinite(at)) await addToList(id!, game, { position: at });
      else await appendToList(id!, game);

      if (replace && replace !== game.id) await removeFromList(id!, replace);
    },
    onSuccess: () => {
      toast.success('Added to the collection');
      // The same three keys the collection screen invalidates after an edit —
      // the list itself, the profile's list rail, and favourites, which is just
      // a collection with a fixed kind and can be the target here too.
      queryClient.invalidateQueries({ queryKey: ['list', id] });
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      // The game page's star reads this, for both the game in and the game out.
      queryClient.invalidateQueries({ queryKey: ['list-membership'] });
      // Straight back to the collection, which refetches with the new game in
      // it — the point of the flow is seeing the shelf you just changed.
      router.back();
    },
  });

  if (!id) {
    return (
      <Screen
        edges={['bottom']}
        padded
        insetHeader
        modal
        topBar={<FrostedTopBar dismiss title="Add games" />}>
        <EmptyState icon="search" title="Collection not found" />
      </Screen>
    );
  }

  return (
    /* `modal`: an iOS sheet already begins below the status bar, so the bar must
       not inset itself again — see `useTopBarInset`. `dismiss` for the same
       reason the chevron is wrong here: a sheet closes, it does not go back. */
    <Screen
      edges={['bottom']}
      insetHeader
      modal
      topBar={<FrostedTopBar dismiss title="Add games" />}>
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
            {add.error instanceof Error ? add.error.message : 'Could not add that game.'}
          </Text>
        )}
      </View>

      <GameSearchResults
        query={query}
        onSelect={(game) => add.mutate(game)}
        badgeFor={(game) => (existing.has(game.id) ? 'Already in this collection' : null)}
        // Everything locks while a write is in flight: the rows are one tap
        // each and the screen closes on success, so a second tap during the
        // round trip would queue an add the user never sees the result of.
        isDisabled={() => add.isPending}
        prompt={
          replace
            ? {
                title: 'Replace a game',
                message: 'Search IGDB, then tap the game to put in its place.',
              }
            : {
                title: 'Add a game',
                message: 'Search IGDB, then tap a game to add it to this collection.',
              }
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: Spacing.x16, gap: Spacing.x8 },
});
