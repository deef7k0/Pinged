import { useQuery } from '@tanstack/react-query';
import { FlatList, StyleSheet, View } from 'react-native';

import { CollectionSeparator, ListTile } from '@/components/list-tile';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TallCardWindow } from '@/constants/list-window';
import { Spacing } from '@/constants/theme';
import { getGameListCount, getGameLists } from '@/lib/api';

/**
 * How many collections the sheet lists.
 *
 * A cap rather than a page: a much-loved game sits on thousands of shelves, and
 * "the fifty most recent" answers what somebody opening this actually asked —
 * *who is putting this on a shelf lately* — where page 34 of 68 answers nothing.
 * The exact figure is printed under the last row, so the cap is stated rather
 * than hidden behind a list that simply stops.
 */
const LIMIT = 50;

export type GameListsSheetProps = {
  gameId: string;
  gameTitle: string;
};

/**
 * Every collection that holds one game.
 *
 * ## Why it is a sheet and not a route
 *
 * Same argument as the reviews sheet beside it: this is a lateral glance from the
 * game page, not a place you navigate to, and the page underneath stays mounted
 * so dismissing it is a reveal rather than a back-navigation that re-fetches a
 * masthead. It is raised by the strip's "COLLECTIONS" cell.
 *
 * ## Full height, not the picker's half
 *
 * The platform picker caps itself at half the display because its entire result
 * is the artwork behind it changing, so covering the page would hide the thing
 * being chosen. Nothing here is behind the sheet to watch, and a collection is
 * a card over two hundred dp tall — its title, a stack of covers, two lines of
 * the owner's argument and a byline — so at half height that is one card and a
 * scroll bar, for a list whose whole point is how many of them there are.
 *
 * ## The rows are `<ListTile>`, unmodified
 *
 * Deliberately the same object as the Collections tab and Discover, down to the
 * stack and the count. A second, smaller collection row for this one surface
 * is how the profile ended up with its own copy of the tab bar, and the two
 * drifted the moment one was restyled. The sheet's page is the app's
 * `background`, so the card's `surface` stands off it here as it does there.
 */
export function GameListsSheet({ gameId, gameTitle }: GameListsSheetProps) {
  const lists = useQuery({
    queryKey: ['game-lists', gameId],
    queryFn: () => getGameLists(gameId, LIMIT),
    enabled: !!gameId,
    staleTime: 5 * 60_000,
  });

  /* Already in cache — the strip that opened this sheet fetched it to print the
     number on the cell. Same key, so this costs nothing and is the only honest
     source for "and N more": `lists.data.length` is the cap, not the total. */
  const total = useQuery({
    queryKey: ['game-list-count', gameId],
    queryFn: () => getGameListCount(gameId),
    enabled: !!gameId,
    staleTime: 5 * 60_000,
  });

  if (lists.isLoading) return <LoadingState />;
  if (lists.isLoadingError) return <ErrorState error={lists.error} />;

  const data = lists.data ?? [];

  if (data.length === 0) {
    return (
      <EmptyState
        icon="albums-outline"
        title="Not in any collections"
        message={`Nobody has put ${gameTitle} on a shelf yet. Add it to one of yours from the game page.`}
      />
    );
  }

  const hidden = (total.data ?? 0) - data.length;

  return (
    <FlatList
      data={data}
      keyExtractor={(list) => list.id}
      contentContainerStyle={styles.body}
      showsVerticalScrollIndicator={false}
      {...TallCardWindow}
      renderItem={({ item }) => <ListTile list={item} />}
      ItemSeparatorComponent={CollectionSeparator}
      ListFooterComponent={
        /* Only when the cap actually bit. A footnote saying "and 0 more" is the
           kind of honesty that reads as a bug. */
        hidden > 0 ? (
          <View style={styles.footer}>
            <Text variant="bodySmall" color="textMuted">
              {`Showing the ${LIMIT} most recent of ${total.data}.`}
            </Text>
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  /* The sheet pads nothing — it owns the corner and the grabber and leaves the
     body to whatever fills it. */
  body: { paddingHorizontal: Spacing.x16, paddingBottom: Spacing.x48 },
  footer: { paddingTop: Spacing.x8, alignItems: 'center' },
});
