import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Poster } from '@/components/ui/poster';
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  type AccordionSlot,
} from '@/components/ui/accordion';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  clearHiddenGames,
  loadHiddenGames,
  unhideGame,
  type HiddenGame,
} from '@/lib/surprise-hidden';
import { showAlert } from '@/components/ui/dialog';
import { toast } from '@/lib/toast';

/**
 * Small enough to be a row's leading mark, large enough to recognise.
 *
 * A fixed dp literal rather than a `Spacing` step, per the rule that artwork
 * does not ride the ladder — retuning the chrome must not resize the covers.
 */
const THUMB = 34;

export type SurpriseHiddenListProps = AccordionSlot & {
  userId: string;
  /** Its key in the `<Accordion>` it is a row of. */
  value: string;
};

/**
 * The games banished from Surprise Me, and the only way back.
 *
 * ## Why it is a disclosure and not a section
 *
 * The list is empty for almost everybody and hundreds of rows for the person who
 * uses the gesture — there is no size at which it is worth a permanently
 * expanded block. Collapsed it is one row stating a number, which is the whole
 * answer most of the time ("nothing"), and the expansion is only paid for by
 * somebody who has something to look at.
 *
 * ## Why unhiding is per-row and destructive-clear is not
 *
 * Taking one game back is exactly reversible — the cover is right there and the
 * gesture that hid it is two taps away — so it happens on press with no dialog.
 * "Clear all" throws away a list that may have taken months to build and cannot
 * be reconstructed from anything, so it confirms. That is the same line
 * `<GameActions>` draws between clearing a bare status and deleting a log with a
 * review in it.
 */
export function SurpriseHiddenList({ userId, value, ...slot }: SurpriseHiddenListProps) {
  const theme = useTheme();
  const queryClient = useQueryClient();

  /* The same key Surprise Me reads, so unhiding here is reflected on the next
     roll without either screen knowing the other exists. `staleTime: Infinity`
     because AsyncStorage is the only writer and both writers set the data
     directly. */
  const hidden = useQuery({
    queryKey: ['surprise-hidden', userId],
    queryFn: () => loadHiddenGames(userId),
    staleTime: Infinity,
  });

  const games = hidden.data ?? [];

  /* Both mutations return the whole new list, so the cache is *set* rather than
     invalidated — there is nothing to re-read, and a refetch would re-parse a
     value this device just wrote. */
  const unhide = useMutation({
    mutationFn: (gameId: string) => unhideGame(userId, gameId),
    onSuccess: (next: HiddenGame[]) => {
      toast.success('Back in Surprise Me');
      queryClient.setQueryData(['surprise-hidden', userId], next);
    },
  });

  const clear = useMutation({
    mutationFn: () => clearHiddenGames(userId),
    onSuccess: (next: HiddenGame[]) => {
      toast.success('Every hidden game is back');
      queryClient.setQueryData(['surprise-hidden', userId], next);
    },
  });

  function confirmClear() {
    showAlert(
      'Show all hidden games again?',
      `All ${games.length} of them go back into the Surprise Me pool. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Show all', style: 'destructive', onPress: () => clear.mutate() },
      ]
    );
  }

  return (
    <AccordionItem value={value} {...slot}>
      <AccordionTrigger
        icon="eye-off-outline"
        title="Hidden from Surprise Me"
        summary={
          hidden.isPending
            ? 'Checking…'
            : games.length === 0
              ? 'Nothing hidden yet'
              : `${games.length} ${games.length === 1 ? 'game' : 'games'} will never come up`
        }
        accessibilityLabel={
          games.length > 0
            ? `Hidden from Surprise Me, ${games.length} games`
            : 'Hidden from Surprise Me, none'
        }
      />
      <AccordionContent>
        <View style={styles.panel}>
          {games.length === 0 ? (
            /* Says how the list gets filled. This is the only place in the app
               that documents the gesture, and somebody who opened this row was
               looking for exactly that. */
            <Text variant="caption" color="textMuted" style={styles.hint}>
              Double tap a game’s cover in Surprise Me to hide it. Hidden games never come up again
              — until you bring them back here.
            </Text>
          ) : (
            <>
              {games.map((game) => (
                <View key={game.id} style={[styles.item, { borderTopColor: theme.border }]}>
                  <Poster
                    coverUrl={game.coverUrl}
                    title={game.title}
                    width={THUMB}
                    rounded="image"
                  />
                  <Text variant="bodySmall" numberOfLines={2} style={styles.itemTitle}>
                    {game.title}
                  </Text>
                  {/* `plain`: the row is already inside a bordered panel, and a
                      second outline around each glyph turns a tidy list into a
                      grid of boxes. See `<IconButton>`'s own note. */}
                  <IconButton
                    icon="arrow-undo-outline"
                    tone="plain"
                    size="small"
                    accessibilityLabel={`Show ${game.title} in Surprise Me again`}
                    disabled={unhide.isPending}
                    onPress={() => unhide.mutate(game.id)}
                  />
                </View>
              ))}

              <View style={styles.clear}>
                <Button
                  title="Show all again"
                  variant="danger"
                  size="small"
                  loading={clear.isPending}
                  onPress={confirmClear}
                />
              </View>
            </>
          )}
        </View>
      </AccordionContent>
    </AccordionItem>
  );
}

const styles = StyleSheet.create({
  panel: { paddingHorizontal: Spacing.x4 },
  hint: { paddingVertical: Spacing.x8 },
  /* A hairline between rows rather than a card each: a hundred cards is a
     hundred edges, and the panel is already a single object. */
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    paddingVertical: Spacing.x8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  itemTitle: { flex: 1 },
  clear: { alignItems: 'flex-start', paddingTop: Spacing.x12 },
});
