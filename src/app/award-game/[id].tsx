import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GameFilterBar } from '@/components/game-filter-bar';
import { GameListItem } from '@/components/game-list-item';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageFlatList } from '@/components/ui/page-scroll';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { getAwards, setAwardGame } from '@/lib/api';
import { getGameById, searchGamesFiltered, type GameFilters } from '@/lib/games';
import { toast } from '@/lib/toast';

/**
 * Pick the winner of one award.
 *
 * Takes an award slot's id, not a list's — the slot is the thing being filled,
 * and routing on it means the screen can title itself with the category and
 * write the result without the caller plumbing a value back through navigation.
 * That is the same shape as `add-to-list/[id]`, and for the same reason: Expo
 * Router modals have no return channel, so a picker that produced a value would
 * need the caller to poll for it.
 *
 * ## Filters first, search second
 *
 * Unlike the Search tab, the text field here is optional. "The best platformer
 * of 2003" is a query with no title in it, and `searchGamesFiltered` answers it
 * — see the note there on why the result ordering changes when the term goes
 * away. This is why the screen does not reuse `<GameSearchResults>`: that
 * component owns a sort row and a "type two characters" prompt, both of which
 * are wrong when the filters alone are a complete question.
 */
export default function AwardGamePickerScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id, list } = useLocalSearchParams<{ id: string; list?: string }>();

  const [input, setInput] = useState('');
  const [filters, setFilters] = useState<GameFilters>({});
  const term = useDebouncedValue(input.trim());

  /* The ballot, for the one thing this screen needs from it: the category's
     name, so the bar says which award is being decided. Read through the same
     query key the list screen uses, so it is already in cache. */
  const ballot = useQuery({
    queryKey: ['awards', list],
    queryFn: () => getAwards(list!),
    enabled: !!list,
  });

  const award = ballot.data?.awards.find((entry) => entry.id === id);

  const query = useMemo<GameFilters>(() => ({ ...filters, term }), [filters, term]);

  /* Runs on filters alone, so there is no minimum query length here. The one
     thing it will not do is fetch the entire catalogue: with nothing set at all
     the screen shows its prompt instead. */
  const hasQuery =
    term.length > 0 ||
    !!filters.genreId ||
    !!filters.platformId ||
    !!filters.studio?.trim() ||
    !!filters.fromYear ||
    !!filters.toYear;

  const results = useQuery({
    queryKey: ['award-search', query],
    queryFn: ({ signal }) => searchGamesFiltered(query, signal),
    enabled: hasQuery,
  });

  const choose = useMutation({
    mutationFn: async (gameId: string) => {
      /* The search result is a summary; `setAwardGame` caches the full row into
         Postgres, and `list_awards.game_id` has an FK to it. Re-fetching by id
         rather than casting the summary keeps the cached game complete —
         genres and platforms are what the game page and the accent read. */
      const game = await getGameById(gameId);
      if (!game) throw new Error('Could not load that game.');
      await setAwardGame(id!, game);
    },
    onSuccess: () => {
      toast.success('Winner chosen');
      queryClient.invalidateQueries({ queryKey: ['awards', list] });
      queryClient.invalidateQueries({ queryKey: ['list', list] });
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      router.back();
    },
  });

  function renderBody() {
    if (!hasQuery) {
      return (
        <EmptyState
          title="Find the winner"
          message="Search by name, or narrow the catalogue by genre, platform, studio or year."
        />
      );
    }
    if (results.isLoading) return <LoadingState />;
    if (results.isLoadingError) return <ErrorState error={results.error} />;

    return (
      <PageFlatList
        data={results.data ?? []}
        keyExtractor={(game) => game.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <GameListItem
            game={item}
            onPress={() => choose.mutate(item.id)}
            disabled={choose.isPending}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="search"
            title="Nothing matches"
            message="Try a wider year range, or clear a filter."
          />
        }
      />
    );
  }

  return (
    /* `modal`: an iOS sheet already begins below the status bar, so the bar must
       not inset itself again — see `useTopBarInset`. */
    <Screen
      edges={['bottom']}
      insetHeader
      modal
      /* Which award this pick is for. */
      topBar={<FrostedTopBar dismiss title={award?.label ?? 'Pick the winner'} />}>
      <View style={styles.head}>
        <TextField
          value={input}
          onChangeText={setInput}
          icon="search"
          variant="search"
          placeholder="Search games…"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />

        {choose.isError && (
          <Text variant="bodySmall" color="danger">
            {choose.error instanceof Error ? choose.error.message : 'Could not set that winner.'}
          </Text>
        )}
      </View>

      <GameFilterBar value={filters} onChange={setFilters} />

      {renderBody()}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: Spacing.x16, gap: Spacing.x8 },
  list: { padding: Spacing.x16, paddingBottom: Spacing.x48, gap: Spacing.x8 },
});
