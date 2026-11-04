import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { AwardSlotRow } from '@/components/award-slot';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ErrorState, LoadingState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deleteAward, getAwards, reorderAwards, swapAwards, type AwardSlot } from '@/lib/api';
import { showAlert } from '@/components/ui/dialog';
import { toast } from '@/lib/toast';

export type AwardShowProps = {
  listId: string;
  isOwner: boolean;
  /** The collection header, rendered above the ballot. */
  header: ReactNode;
};

/**
 * An award show: a ballot of categories, each naming a game and saying why.
 *
 * The third shape a collection can take, after the poster grid and the tier
 * list, and the only one whose rows exist before there is a game in them — a new
 * show is eight empty categories. That is what makes it a separate component
 * rather than a third branch inside `list/[id]`: the others render `list_items`,
 * and this renders `list_awards`, which is a different table answering a
 * different question.
 *
 * ## Ordering
 *
 * Arrow buttons, not drag-and-drop, matching the ranked collection above it. A
 * gesture reorder inside a scrolling list needs a dedicated library, and the
 * arrows are reachable by a screen reader — which matters more here than on a
 * shelf, because the order of an award show is part of what it says.
 *
 * Every move rewrites the whole ballot's positions rather than swapping two.
 * `position` has no unique constraint, so a partial write that collides is legal
 * and silently falls back to `created_at` ordering; a dense rewrite cannot.
 */
export function AwardShow({ listId, isOwner, header }: AwardShowProps) {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const ballot = useQuery({
    queryKey: ['awards', listId],
    queryFn: () => getAwards(listId),
  });

  const awards = ballot.data?.awards ?? [];

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['awards', listId] });
    /* The collection's own caches: a winner is mirrored into `list_items` by a
       trigger, so the tile's stack and the item count change under them. */
    queryClient.invalidateQueries({ queryKey: ['list', listId] });
    queryClient.invalidateQueries({ queryKey: ['lists'] });
  }

  const move = useMutation({
    mutationFn: ({ index, delta }: { index: number; delta: -1 | 1 }) =>
      reorderAwards(listId, swapAwards(awards, index, delta)),
    onSuccess: invalidate,
  });

  const destroy = useMutation({
    mutationFn: (awardId: string) => deleteAward(awardId),
    onSuccess: () => {
      toast.success('Award deleted');
      return invalidate();
    },
  });

  function confirmDelete(award: AwardSlot) {
    showAlert(
      `Delete ${award.label}?`,
      award.note
        ? 'The category and what you wrote about it are removed. The game stays in your library.'
        : 'The category is removed from this show.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => destroy.mutate(award.id) },
      ]
    );
  }

  if (ballot.isLoading) return <LoadingState />;
  if (ballot.isLoadingError) return <ErrorState error={ballot.error} />;

  return (
    <FlatList
      data={awards}
      keyExtractor={(award) => award.id}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={<>{header}</>}
      ItemSeparatorComponent={Separator}
      renderItem={({ item, index }) => (
        <View style={styles.row}>
          <AwardSlotRow
            award={item}
            editable={isOwner}
            index={index}
            count={awards.length}
            onPickGame={() =>
              router.push({
                pathname: '/award-game/[id]',
                params: { id: item.id, list: listId },
              })
            }
            onEditNote={() =>
              router.push({
                pathname: '/award-edit/[id]',
                params: { id: item.id, list: listId, field: 'note' },
              })
            }
            onRename={() =>
              router.push({
                pathname: '/award-edit/[id]',
                params: { id: item.id, list: listId },
              })
            }
            onMove={(delta) => move.mutate({ index, delta })}
            onDelete={() => confirmDelete(item)}
          />
        </View>
      )}
      ListFooterComponent={
        isOwner ? (
          /* The one control that adds to the show, and it lives at the bottom
             because that is where the new category lands. A `+` in the header
             would put the action at the opposite end of the screen from its
             result. */
          <View style={styles.row}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Add an award category"
              onPress={() =>
                router.push({ pathname: '/award-edit/[id]', params: { id: 'new', list: listId } })
              }
              scaleTo={0.98}
              style={StyleSheet.flatten([
                styles.add,
                { borderColor: theme.borderStrong, backgroundColor: theme.surface },
              ])}>
              <Ionicons name="add" size={24} color={theme.textSecondary} />
              <Text variant="h5" color="textSecondary">
                Add an award
              </Text>
            </PressableScale>
          </View>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.row}>
          <Text variant="body" color="textMuted">
            {isOwner
              ? 'Every category was deleted. Add one to start the show again.'
              : 'This show has no categories yet.'}
          </Text>
        </View>
      }
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.x48 },
  row: { paddingHorizontal: Spacing.x16 },
  separator: { height: Spacing.x12 },
  /* Dashed and unfilled, the same language as the empty poster well inside a
     category: this is a space waiting for something, not a button that does
     something. */
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x8,
    marginTop: Spacing.x12,
    paddingVertical: Spacing.x24,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
});
