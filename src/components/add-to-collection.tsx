import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { LoadingState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Tray } from '@/components/ui/tray';
import { Radius, Spacing, withAlpha } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import { appendToList, getLists } from '@/lib/api';
import type { Game } from '@/lib/games';
import { useAuth } from '@/store/auth';

/**
 * The art beside each row: a slot this size, and the collection's one cover in
 * it. Fixed dp — artwork does not ride the ladder.
 *
 * It was a 48dp mosaic of the collection's first four covers until the mosaic
 * was removed from the app. The cover is box art at its own 2:3, as tall as the
 * slot, so the slot — and the column of titles that starts after it — is where
 * it was.
 */
const ROW_ART = 48;
const ROW_COVER = Math.round(ROW_ART * (2 / 3));

export type AddToCollectionProps = {
  game: Game;
  visible: boolean;
  onClose: () => void;
};

/**
 * Pick which collection a game goes into.
 *
 * ## Why a sheet and not the `add-to-list` route
 *
 * That route is the mirror of this one and answers the opposite question: it
 * starts from a *collection* and picks a game. This starts from a game and picks
 * a collection, so the list it shows is the viewer's own collections rather than
 * the catalogue, and the thing being chosen is already known. Sending a game
 * page to `/add-to-list` would arrive with nothing selected and a search field —
 * the exact "picking is not browsing" mistake CLAUDE.md records.
 *
 * ## What is offered, and what is not
 *
 * Favourites and wishlists are excluded. They are singletons with their own
 * controls in the same action row two buttons to the left, and offering them
 * here would give one fact two switches that disagree — press Favourite, then
 * add to "Favourites" from this sheet, and the star does not light.
 *
 * Tier lists and award shows *are* offered. A tier list holds the game
 * untiered until its owner sorts it, and an award show's trigger mirrors
 * `list_items` from the ballot — so adding a game directly to one is honest in
 * both cases, and refusing would mean explaining a schema detail to somebody who
 * only wants a game on a shelf.
 *
 * ## Adding twice is not an error
 *
 * `appendToList` upserts on `(list_id, game_id)`, so tapping a collection the game
 * is already in is a no-op rather than a duplicate row. The sheet therefore does
 * not mark those rows: knowing which of your collections already hold this game
 * would cost a second query per open, to prevent an action that is already
 * harmless.
 */
export function AddToCollection({ game, visible, onClose }: AddToCollectionProps) {
  const theme = useTheme();
  const accent = useAccent();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id) ?? null;

  const lists = useQuery({
    queryKey: ['lists', userId],
    queryFn: () => getLists(userId!),
    enabled: !!userId && visible,
  });

  /* Singletons out — see the docblock. Everything else the viewer owns is a
     shelf they built on purpose and can put this on. */
  const collections = (lists.data ?? []).filter(
    (list) => list.kind !== 'favorites' && list.kind !== 'wishlist'
  );

  const add = useMutation({
    /* `appendToList`, not `addToList`. The latter defaults `position` to 0, which
       is right for a wishlist toggle and wrong here: every game added that way
       lands in the same slot, so a ranked collection's numbering becomes
       whatever Postgres felt like. This counts first and puts the game at the
       end, which is where somebody adding to a shelf expects it. */
    mutationFn: async (listId: string) => {
      await appendToList(listId, game);
    },
    onSuccess: (_result, listId) => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      queryClient.invalidateQueries({ queryKey: ['list', listId] });
      queryClient.invalidateQueries({ queryKey: ['list-membership'] });
      /* The game page's stats strip claims a number of collections and its sheet
         lists them. Neither shares a key prefix with anything above — they are
         keyed by *game*, where every other list query is keyed by list or by
         owner — so they have to be named here or the strip keeps printing the
         count from before this add. */
      queryClient.invalidateQueries({ queryKey: ['game-list-count', game.id] });
      queryClient.invalidateQueries({ queryKey: ['game-lists', game.id] });
      onClose();
    },
  });

  return (
    <Tray visible={visible} onClose={onClose} maxHeightRatio={0.9}>
      <View style={styles.sheet}>
        <View style={styles.head}>
          <View style={styles.headText}>
            <Text variant="h2">Add to collection</Text>
            <Text variant="bodySmall" color="textMuted" numberOfLines={1}>
              {game.title}
            </Text>
          </View>

          <IconButton icon="close" accessibilityLabel="Close" onPress={onClose} />
        </View>

        {/*
          Owning the game, above the lists.

          "Collect" is where the intent to *have* a game already lives, so this is
          where a physical copy is added from — rather than a card on every game
          page, which for anybody who does not collect boxes would be a permanent
          invitation to do something they never do. It is a different thing from
          the rows below (a copy is yours, with a condition; a collection is a
          curated list), so it is set apart and worded as ownership, not as a
          list called "Physical".
        */}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`I own a physical copy of ${game.title}. Add it.`}
          onPress={() => {
            onClose();
            router.push({ pathname: '/add-copy', params: { game: game.id } });
          }}
          scaleTo={0.98}
          pressedColor={theme.controlPressed}
          focusRing={accent.ring}
          style={StyleSheet.flatten([
            styles.row,
            styles.ownRow,
            { backgroundColor: theme.controlFill },
          ])}>
          <View style={[styles.copyGlyph, { backgroundColor: theme.surfaceSelected }]}>
            <Ionicons name="disc-outline" size={22} color={theme.text} />
          </View>
          <View style={styles.rowText}>
            <Text variant="h5">I own a copy</Text>
            <Text variant="bodySmall" color="textMuted">
              Add it with its release and condition
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
        </PressableScale>

        {add.isError && (
          <Text variant="bodySmall" color="danger" style={styles.gutter}>
            {add.error instanceof Error ? add.error.message : 'Could not add that.'}
          </Text>
        )}

        {lists.isLoading ? (
          <LoadingState />
        ) : collections.length === 0 ? (
          /* No collections yet, so the sheet offers the thing that would make it
             useful rather than an apology. `replace` is wrong here — the game
             page should still be behind the new-collection modal. */
          <View style={styles.empty}>
            <Text variant="h4">No collections yet</Text>
            <Text variant="body" color="textSecondary" style={styles.emptyText}>
              Make one and this game can be its first entry.
            </Text>
            <Button
              title="New collection"
              icon="add"
              onPress={() => {
                onClose();
                router.push('/new-list');
              }}
            />
          </View>
        ) : (
          <View style={styles.rows}>
            {collections.map((list) => (
              <PressableScale
                key={list.id}
                accessibilityRole="button"
                accessibilityLabel={`Add ${game.title} to ${list.title}`}
                disabled={add.isPending}
                onPress={() => add.mutate(list.id)}
                scaleTo={0.98}
                pressedColor={theme.controlPressed}
                focusRing={accent.ring}
                style={StyleSheet.flatten([styles.row, { backgroundColor: theme.controlFill }])}>
                {/* The game that represents the collection — its chosen
                    cover, or its first. One with no games yet draws its initial
                    on the app's well, which `<Poster>` does with no art. */}
                <View style={styles.rowArt}>
                  <Poster
                    coverUrl={list.preview?.cover_url}
                    heroUrl={list.preview?.hero_url}
                    title={list.preview?.title ?? list.title}
                    width={ROW_COVER}
                  />
                </View>

                <View style={styles.rowText}>
                  <Text variant="h5" numberOfLines={1}>
                    {list.title}
                  </Text>
                  <Text variant="bodySmall" color="textMuted">
                    {list.itemCount} {list.itemCount === 1 ? 'game' : 'games'}
                  </Text>
                </View>

                <Ionicons name="add-circle-outline" size={22} color={withAlpha(theme.text, 0.7)} />
              </PressableScale>
            ))}
          </View>
        )}
      </View>
    </Tray>
  );
}

const styles = StyleSheet.create({
  /* In a tray (`<Tray>`): as tall as its lists, up to 90% of the display. */
  sheet: { flexShrink: 1, paddingBottom: Spacing.x16, gap: Spacing.x16 },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.x12,
    paddingHorizontal: Spacing.x16,
  },
  headText: { flex: 1, gap: 2 },
  gutter: { paddingHorizontal: Spacing.x16 },

  rows: { paddingHorizontal: Spacing.x16, gap: Spacing.x8 },
  /* Rows that act — add this game to that list — so the action grey and no
     edge, the same object as every button. */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    padding: Spacing.x12,
    borderRadius: Radius.card,
  },
  rowText: { flex: 1, gap: 1 },
  /* Margin, not the `gutter` padding: the row is a surface, and it has to line
     up with the list rows below, which sit inside `rows`' own inset. */
  ownRow: { marginHorizontal: Spacing.x16 },
  /* The slot a row's cover stands in, centred. */
  rowArt: { width: ROW_ART, height: ROW_ART, alignItems: 'center', justifyContent: 'center' },
  /* The same footprint as a list row's art, so the column of titles starts at
     one x for every row in the sheet. */
  copyGlyph: {
    width: ROW_ART,
    height: ROW_ART,
    borderRadius: Radius.image,
    alignItems: 'center',
    justifyContent: 'center',
  },

  empty: { alignItems: 'center', gap: Spacing.x12, padding: Spacing.x24 },
  emptyText: { textAlign: 'center' },
});
