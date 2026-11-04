import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { memo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { cardShape } from '@/components/ui/card-material';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { setItemCaption, type ListItem } from '@/lib/api';
import { toast } from '@/lib/toast';

/**
 * Three across, and it is a rule rather than a fitting.
 *
 * The format this kind of list exists for is a shareable board — nine games,
 * three by three, each answering the same prompt in a different way. Two columns
 * would make it a feed and four would put the captions under 80dp of artwork,
 * where a phrase like "Have cooked longer" cannot be read. Three is the widest
 * grid where the caption is still a *heading* rather than a footnote.
 */
const COLUMNS = 3;

/** Captions longer than this are truncated in the tile. */
const CAPTION_LINES = 2;

export type CaptionedGridProps = {
  listId: string;
  items: ListItem[];
  isOwner: boolean;
  /** Width available for the whole grid, in dp. */
  width: number;
};

/**
 * A collection where every game carries a line of the owner's own text.
 *
 * ## What this is for
 *
 * "Games that should… get a remake / be a TV show / have been GOTY". The list's
 * title asks a question and each tile answers it, which is a different object
 * from every other kind here: a plain collection is a set, a ranked list is an
 * order, a tier list is a grading, an award show is a ballot. This one is a
 * *board* — the caption is the content and the game is the illustration.
 *
 * ## Why the caption is inside the tile
 *
 * Because the pairing is the whole point. A row of covers with a separate row of
 * labels under it reads as a grid with a legend, and the reader has to do the
 * matching; a bordered container holding one cover and one phrase reads as one
 * statement. That container is also what lets the board survive being
 * screenshotted, which is what this format is actually for.
 *
 * ## Captions are the owner's, and only the owner's
 *
 * Tapping a tile opens the game, exactly as it does everywhere else. The owner
 * gets a second affordance — a pencil on the caption — rather than having the
 * tile's primary tap stolen for editing, because a board is read far more often
 * than it is written.
 */
/* Memoised: it is the single cell of the board's list, whose `renderItem` is
   rebuilt on every render of that screen. Its props — the list id, the sorted
   items (memoised upstream), ownership and width — are stable, so a scroll-driven
   or comment-driven render of the page no longer re-renders the whole grid. */
export const CaptionedGrid = memo(function CaptionedGrid({
  listId,
  items,
  isOwner,
  width,
}: CaptionedGridProps) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ListItem | null>(null);

  /*
   * The gutters belong to the grid, not to the page, so the tile is the
   * remaining space divided evenly — floored, because a fractional width leaves
   * a sub-pixel seam on the right-hand column of every row.
   *
   * **The extra 1dp is not superstition.** When the division comes out exact —
   * 360dp phone, 336 available, three 108s and two 6s summing to precisely 336 —
   * the row has *zero* slack, and any rounding in the layout pass tips the last
   * tile onto a second line. That failure is silent and total: you get two
   * columns instead of three and nothing reports why. One point of headroom is
   * invisible and makes the wrap impossible.
   */
  const gap = Spacing.x8;
  const tileWidth = Math.floor((width - gap * (COLUMNS - 1) - 1) / COLUMNS);

  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <CaptionedTile
          key={item.game_id}
          item={item}
          width={tileWidth}
          isOwner={isOwner}
          onEdit={() => setEditing(item)}
        />
      ))}

      {editing && (
        <CaptionEditor
          listId={listId}
          item={editing}
          onDone={() => {
            setEditing(null);
            queryClient.invalidateQueries({ queryKey: ['list', listId] });
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      {items.length === 0 && (
        <Text variant="bodySmall" color="textMuted" style={{ color: theme.textMuted }}>
          Add games, then give each one its own line.
        </Text>
      )}
    </View>
  );
});

function CaptionedTile({
  item,
  width,
  isOwner,
  onEdit,
}: {
  item: ListItem;
  width: number;
  isOwner: boolean;
  onEdit: () => void;
}) {
  const theme = useTheme();
  const caption = item.note?.trim();

  return (
    <View
      style={[
        cardShape,
        styles.tile,
        { width, backgroundColor: theme.surface, borderColor: theme.border },
      ]}>
      <Link href={{ pathname: '/game/[id]', params: { id: item.game_id } }} asChild>
        <PressableScale
          accessibilityRole="link"
          accessibilityLabel={
            caption ? `${item.game?.title ?? 'Game'}: ${caption}` : (item.game?.title ?? 'Game')
          }
          scaleTo={0.97}>
          {/* The artwork is inset by the tile's own padding, so the container
              reads as a frame around the pairing rather than as a card the
              cover happens to be bleeding out of. */}
          <Poster
            coverUrl={item.game?.cover_url}
            heroUrl={item.game?.hero_url}
            title={item.game?.title}
            width={width - Spacing.x8 * 2}
            rounded="image"
          />
        </PressableScale>
      </Link>

      {/*
        The caption, at `h5` and never `caption`.

        It is the heading of the tile — the thing the board is *about* — and the
        cover is its illustration. Setting it at the type scale's floor, which is
        what a label under artwork usually gets, would invert that.
      */}
      {isOwner ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={caption ? `Edit caption: ${caption}` : 'Add a caption'}
          onPress={onEdit}
          scaleTo={0.97}
          hitSlop={Spacing.x4}
          style={StyleSheet.flatten(styles.captionRow)}>
          {caption ? (
            <Text variant="h5" numberOfLines={CAPTION_LINES} style={styles.caption}>
              {caption}
            </Text>
          ) : (
            <Text variant="h5" color="textMuted" numberOfLines={1} style={styles.caption}>
              Add a line
            </Text>
          )}
          <Ionicons name="pencil" size={11} color={theme.textMuted} />
        </PressableScale>
      ) : (
        <View style={styles.captionRow}>
          <Text variant="h5" numberOfLines={CAPTION_LINES} style={styles.caption}>
            {/* A reader sees nothing rather than "Add a line": that prompt is an
                instruction to somebody who cannot act on it. */}
            {caption ?? ' '}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * One caption, in a sheet.
 *
 * A modal rather than an inline field, because the tile is a third of a phone
 * wide and a text input in it would be four characters across. Seeded through
 * component state on mount — the editor is remounted per item by the `editing`
 * key above, so there is no stale-value problem and no `useEffect` to sync it.
 */
function CaptionEditor({
  listId,
  item,
  onDone,
  onCancel,
}: {
  listId: string;
  item: ListItem;
  onDone: () => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const [value, setValue] = useState(item.note ?? '');

  const save = useMutation({
    mutationFn: () => setItemCaption(listId, item.game_id, value),
    onSuccess: () => {
      toast.success('Caption saved');
      return onDone();
    },
  });

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={[styles.editor, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text variant="h2">Caption</Text>
        <Text variant="bodySmall" color="textMuted" numberOfLines={1}>
          {item.game?.title ?? 'This game'}
        </Text>

        <TextField
          value={value}
          onChangeText={setValue}
          placeholder="Get a remake"
          autoFocus
          /* 300 is the column's own limit, and a caption that long would not fit
             the tile anyway — the field says so by refusing rather than by
             letting somebody write a paragraph the grid then truncates. */
          maxLength={300}
          hint="One line. It sits under the cover on the board."
        />

        {save.isError && (
          <Text variant="bodySmall" color="danger">
            {save.error instanceof Error ? save.error.message : 'Could not save that.'}
          </Text>
        )}

        <View style={styles.editorActions}>
          <Button title="Cancel" variant="ghost" onPress={onCancel} />
          <Button title="Save" loading={save.isPending} onPress={() => save.mutate()} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.x8 },
  /* A hairline *and* a card shadow. On a wall of nine, the shadow alone left
     adjacent tiles merging into one block — the edge is what makes each one a
     separate statement, which is the whole reason the container exists. */
  tile: { padding: Spacing.x8, gap: Spacing.x8 },
  /* `minHeight` so a one-line caption and a two-line caption produce tiles of
     the same height — a ragged bottom edge across a three-column board reads as
     a layout fault rather than as varying content. */
  captionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.x4,
    minHeight: 36,
  },
  caption: { flex: 1 },

  editor: { flex: 1, padding: Spacing.x24, gap: Spacing.x12 },
  editorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.x8,
    marginTop: Spacing.x8,
  },
});
