import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { AnchoredMenu, AnchoredMenuItem, useAnchoredMenu } from '@/components/ui/anchored-menu';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { GameSort } from '@/lib/games';

/** How a collection's games are laid out. */
export type CollectionLayout = 'grid' | 'rows';

/**
 * The sorts a collection offers, each with the glyph that says what it does.
 *
 * A glyph rather than a word, and the row is the reason: five sort options as
 * text pills is most of a phone's width, so the row either wraps or scrolls and
 * the layout toggle gets pushed off the end. `text` / `swap-vertical` /
 * `star` are conventional enough to read at a glance, and every one of them
 * carries an `accessibilityLabel` with the full name — the glyph is a shorthand
 * for sighted users, never the only carrier.
 *
 * `default` leads because it is the collection's *own* order: the sequence the
 * owner arranged, or the ranking if it is a ranked list. Everything else is a
 * temporary way of reading the same shelf and none of it is written back.
 */
export type ToolbarSort = { value: GameSort; icon: keyof typeof Ionicons.glyphMap; label: string };

const SORTS: readonly ToolbarSort[] = [
  { value: 'default', icon: 'reorder-three', label: 'List order' },
  { value: 'title', icon: 'text', label: 'A to Z' },
  { value: 'newest', icon: 'arrow-down', label: 'Newest first' },
  { value: 'oldest', icon: 'arrow-up', label: 'Oldest first' },
  { value: 'rating', icon: 'star', label: 'Highest rated' },
];

export type CollectionToolbarProps = {
  sort: GameSort;
  onSort: (sort: GameSort) => void;
  layout: CollectionLayout;
  onLayout: (layout: CollectionLayout) => void;
  /** Hidden on the shapes where re-ordering would destroy the only structure. */
  showSort?: boolean;
  /**
   * The sorts on offer, when they are not a collection's — search results lead
   * with IGDB's relevance rather than a list's own order.
   */
  sorts?: readonly ToolbarSort[];
};

/**
 * The row above a collection's games — Apple Music's playlist (the Apple
 * pass, 2026-11-05): **Surprise me** and **Shuffle** as two equal grey
 * capsules, and a ⋯ at the end holding the sorts (the one in force ticked)
 * and the layout. It was five round sort glyphs and a layout key; a caller
 * with neither Surprise nor Shuffle (search results) gets the ⋯ alone.
 */
export function CollectionToolbar({
  sort,
  onSort,
  layout,
  onLayout,
  showSort = true,
  sorts = SORTS,
  onSurprise,
  onShuffle,
  shuffled = false,
}: CollectionToolbarProps & {
  /** Opens one of the games at random. */
  onSurprise?: () => void;
  /** Puts the games in a random order (a sort, not written back). */
  onShuffle?: () => void;
  /** The order on screen is a shuffle — no sort is ticked. */
  shuffled?: boolean;
}) {
  const theme = useTheme();
  const [trigger, menu] = useAnchoredMenu();
  const tick = <Ionicons name="checkmark" size={20} color={theme.text} />;

  return (
    <View style={styles.bar}>
      {onSurprise && <Capsule icon="dice-outline" label="Surprise me" onPress={onSurprise} />}
      {onShuffle && (
        <Capsule icon="shuffle" label="Shuffle" onPress={onShuffle} active={shuffled} />
      )}
      {!onSurprise && !onShuffle && <View style={styles.spacer} />}

      <View ref={trigger} collapsable={false}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Sort and layout"
          accessibilityState={{ expanded: menu.isOpen }}
          onPress={menu.open}
          scaleTo={0.92}
          pressedColor={theme.controlPressed}
          style={StyleSheet.flatten([styles.more, { backgroundColor: theme.controlFill }])}>
          <Ionicons name="ellipsis-horizontal" size={20} color={theme.text} />
        </PressableScale>
      </View>

      <AnchoredMenu menu={menu} label="Sort and layout" align="end">
        {showSort &&
          sorts.map((option) => (
            <AnchoredMenuItem
              key={option.value}
              icon={option.icon}
              title={option.label}
              checked={!shuffled && option.value === sort}
              trailing={!shuffled && option.value === sort ? tick : undefined}
              onPress={() => {
                menu.close();
                onSort(option.value);
              }}
            />
          ))}
        <AnchoredMenuItem
          icon="grid-outline"
          title="As a grid"
          checked={layout === 'grid'}
          trailing={layout === 'grid' ? tick : undefined}
          onPress={() => {
            menu.close();
            onLayout('grid');
          }}
        />
        <AnchoredMenuItem
          icon="list-outline"
          title="As a list"
          checked={layout === 'rows'}
          trailing={layout === 'rows' ? tick : undefined}
          onPress={() => {
            menu.close();
            onLayout('rows');
          }}
        />
      </AnchoredMenu>
    </View>
  );
}

/** One of the two capsules: its glyph and word, grey; white while in force. */
function Capsule({
  icon,
  label,
  onPress,
  active = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  const theme = useTheme();
  const ink = active ? theme.onPrimary : theme.text;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={0.96}
      pressedColor={active ? undefined : theme.controlPressed}
      style={StyleSheet.flatten([
        styles.capsule,
        { backgroundColor: active ? theme.text : theme.controlFill },
      ])}>
      <Ionicons name={icon} size={18} color={ink} />
      <Text variant="h5" style={{ color: ink }}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    minHeight: TapTarget,
  },
  spacer: { flex: 1 },
  capsule: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x8,
    height: 44,
    borderRadius: Radius.pill,
  },
  more: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
