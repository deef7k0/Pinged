import { useRouter } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/ui/icon-button';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { useSelectable } from '@/components/ui/selectable';
import { Checkbox } from '@/components/ui/selection-marks';
import { Text } from '@/components/ui/text';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import type { ListItem } from '@/lib/api';

/**
 * Cover width in the row layout, in dp.
 *
 * Fixed, like every other artwork size in the app, so retuning the spacing
 * ladder moves the interface and leaves the art alone. 44 is the smallest a
 * cover can be and still be *recognised* — below that a reader is navigating by
 * the title, at which point the artwork is decoration and should be dropped
 * rather than shrunk.
 */
const COVER = 44;

/**
 * Width reserved for the rank, in dp.
 *
 * Fixed rather than hugging the number, so every title in a ranked list starts
 * at the same x. A column that grows from "9" to "10" shifts a hundred rows by
 * three points, which reads as the list flinching.
 */
const RANK_WIDTH = 26;

export type CollectionRowProps = {
  item: ListItem;
  /** 1-based position in the owner's stored order. Null on unranked collections. */
  rank: number | null;
  /**
   * The owner is choosing games to remove. Every row then shows a box, a tap
   * ticks it instead of opening the game, and the row's own cross is withheld:
   * one way to remove at a time.
   */
  selecting?: boolean;
  /** This row is one of the chosen. */
  selected?: boolean;
  /** Tick or untick this row, by its game. Called by a tap while `selecting`. */
  onToggle?: (gameId: string) => void;
  /** Start choosing, with this row — the owner's long press. Omitted for a visitor. */
  onStartSelecting?: (gameId: string) => void;
  /** Take this one game out. Given it, the row ends in a cross. */
  onRemove?: (gameId: string) => void;
};

/**
 * One game as a row: cover, title, and who made it and when.
 *
 * The alternative to the grid, and it exists because the two answer different
 * questions. A wall of covers is for *recognising* — you are looking for the box
 * you remember, and the artwork is the whole content. A list is for *reading* —
 * ninety games deep, a title and a studio scan far faster than ninety pieces of
 * box art, and the year is a fact the grid cannot show at all without a caption
 * under every tile.
 *
 * Two lines, not three. Title, then studio and year joined on one muted line —
 * they are one fact about provenance, and giving each its own line makes a row
 * of ninety twice as tall for no gain.
 *
 * ## Choosing rows to remove
 *
 * A long press on the owner's own row starts a selection (`onStartSelecting`),
 * and from then on the row is a checkbox rather than a link: it takes the app's
 * one selected state (`useSelectable`) and a `<Checkbox>` where the eye already
 * is. The screen holds the set and draws the button that acts on it.
 *
 * ## Handlers take the game's id
 *
 * So the screen can hand every row the same three functions. They used to be
 * closures made per row — and the cross a JSX element made per row — which
 * meant no two renders gave a row the same props, the `memo` below never held,
 * and ticking one game re-drew all ninety.
 */
export const CollectionRow = memo(function CollectionRow({
  item,
  rank,
  selecting = false,
  selected = false,
  onToggle,
  onStartSelecting,
  onRemove,
}: CollectionRowProps) {
  const router = useRouter();
  const look = useSelectable()(selecting && selected);
  const game = item.game;
  const gameId = item.game_id;
  const title = game?.title ?? 'Unknown game';
  const meta = [game?.developer, game?.release_year].filter(Boolean).join(' · ');
  const spoken = rank
    ? `${rank}. ${title}${meta ? `, ${meta}` : ''}`
    : `${title}${meta ? `, ${meta}` : ''}`;

  return (
    <View style={styles.row}>
      <PressableScale
        accessibilityRole={selecting ? 'checkbox' : 'link'}
        accessibilityState={selecting ? { checked: selected } : undefined}
        accessibilityLabel={spoken}
        accessibilityHint={
          !selecting && onStartSelecting ? 'Hold to choose games to remove' : undefined
        }
        scaleTo={0.99}
        pressedColor={selecting ? look.pressedColor : undefined}
        onPress={
          selecting
            ? () => onToggle?.(gameId)
            : () => router.push({ pathname: '/game/[id]', params: { id: gameId } })
        }
        onLongPress={!selecting && onStartSelecting ? () => onStartSelecting(gameId) : undefined}
        style={StyleSheet.flatten([
          styles.press,
          selecting && styles.choice,
          /* Bare until ticked, as a `<SelectionCard frame="row">` is: ninety
             outlined rows would be a wall of boxes around the words. */
          selecting && (selected ? look.style : styles.bare),
        ])}>
        {selecting && <Checkbox checked={selected} />}

        {/* The rank comes before the artwork, exactly as a track number does:
            it is the row's identity in the list, and putting it after the
            cover would make it a property of the game instead. */}
        {rank !== null && (
          <Text variant="h5" color="textMuted" style={styles.rank}>
            {rank}
          </Text>
        )}

        {/* No `gameId`: a cover in a collection never wears the Must Play
            badge. */}
        <Poster
          coverUrl={game?.cover_url}
          heroUrl={game?.hero_url}
          title={game?.title}
          width={COVER}
          rounded="image"
          zoomable={!onStartSelecting && !selecting}
        />

        <View style={styles.text}>
          <Text variant="h5" numberOfLines={1}>
            {title}
          </Text>
          {!!meta && (
            <Text variant="bodySmall" color="textMuted" numberOfLines={1}>
              {meta}
            </Text>
          )}
        </View>
      </PressableScale>

      {onRemove && !selecting && (
        <IconButton
          icon="close"
          accessibilityLabel={`Remove ${title}`}
          size="small"
          tone="plain"
          onPress={() => onRemove(gameId)}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  /* The pressable takes the whole row's width so the tap target is the row
     rather than the cover — `flex: 1` here is what pushes the cross right. */
  press: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    minHeight: TapTarget,
    paddingVertical: Spacing.x4,
  },
  /* A choice while choosing: the selected state needs an edge to light and a
     little room inside it. */
  choice: {
    paddingHorizontal: Spacing.x8,
    borderRadius: Radius.card,
    borderWidth: 1,
  },
  bare: { backgroundColor: 'transparent', borderColor: 'transparent' },
  rank: { width: RANK_WIDTH, textAlign: 'center' },
  /* Shrinks rather than pushing the row wide: a long title truncates instead of
     shoving the owner's controls off the right edge. */
  text: { flex: 1, gap: 2 },
});
