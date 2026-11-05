import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { scopeInfo } from '@/components/search/search-scopes';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { SearchHistoryEntry } from '@/lib/search-history';

const ICON_DISC = 40;

export type SearchHistoryProps = {
  entries: readonly SearchHistoryEntry[];
  /** Run this search again — restores the term *and* the scope it was made in. */
  onSelect: (entry: SearchHistoryEntry) => void;
  /** Put the term in the field without running it, for editing. */
  onFill: (entry: SearchHistoryEntry) => void;
  onRemove: (entry: SearchHistoryEntry) => void;
  onClear: () => void;
};

/**
 * Recent searches, shown while the field has focus and nothing to search on.
 *
 * ## Two actions on one row, and they are different
 *
 * Tapping the row **runs** that search again. Tapping the arrow **fills** it
 * into the field so it can be edited — which is what someone wants when the
 * stored term is nearly right ("hollow" → "hollow knight silksong"). Collapsing
 * the two would cost whichever is not chosen: run-only means retyping a long
 * term to change one word, fill-only means every repeat search needs a second
 * tap on a keyboard that is already up.
 *
 * The arrow points up-and-left because that is where it sends the text — at the
 * field above. It is `arrow-up` rotated rather than a separate glyph, so it
 * carries the same stroke weight as every other icon in the app.
 *
 * ## Why it replaces the browse content rather than sitting above it
 *
 * Focusing the field is a statement of intent: the reader has stopped browsing.
 * Pushing the genre grid and the rails down by the height of this list would
 * leave them half-visible under a keyboard, which is the worst of both — and
 * blurring the field brings them straight back.
 */
export function SearchHistory({
  entries,
  onSelect,
  onFill,
  onRemove,
  onClear,
}: SearchHistoryProps) {
  const theme = useTheme();

  if (entries.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text variant="h5" color="textSecondary" accessibilityRole="header">
          Recent searches
        </Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Clear all recent searches"
          onPress={onClear}
          hitSlop={{ top: 16, bottom: 16, left: 12, right: 12 }}
          scaleTo={0.94}>
          <Text variant="bodySmall" color="primaryText">
            Clear
          </Text>
        </PressableScale>
      </View>

      {entries.map((entry) => (
        <View key={`${entry.scope}:${entry.term}`} style={styles.row}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Search ${scopeInfo(entry.scope).label.toLowerCase()} for ${entry.term} again`}
            onPress={() => onSelect(entry)}
            scaleTo={0.99}
            style={StyleSheet.flatten([styles.main])}>
            <View style={[styles.disc, { backgroundColor: theme.surfaceElevated }]}>
              <Ionicons name="time-outline" size={20} color={theme.textSecondary} />
            </View>

            <View style={styles.text}>
              <Text variant="body" numberOfLines={1}>
                {entry.term}
              </Text>
              {/* The scope only earns a line when it is not the default one.
                  "Games" under every row would be noise; "in Studios" is a fact
                  the reader needs to understand why tapping it changes what is
                  being searched. */}
              {entry.scope !== 'games' && entry.scope !== 'top' && (
                <Text variant="caption" color="textMuted">
                  in {scopeInfo(entry.scope).label}
                </Text>
              )}
            </View>
          </PressableScale>

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Edit the search ${entry.term}`}
            onPress={() => onFill(entry)}
            scaleTo={0.85}
            style={StyleSheet.flatten([styles.trailing])}>
            <Ionicons name="arrow-up" size={18} color={theme.textMuted} style={styles.fillArrow} />
          </PressableScale>

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Forget the search ${entry.term}`}
            onPress={() => onRemove(entry)}
            scaleTo={0.85}
            style={StyleSheet.flatten([styles.trailing])}>
            <Ionicons name="close" size={18} color={theme.textMuted} />
          </PressableScale>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x16 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.x8,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  /* `flex: 1` so the term column takes everything the two trailing controls do
     not, and `minWidth: 0` so a long term truncates instead of pushing them off
     the row — see the same note in `person-row.tsx`. */
  main: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    minHeight: TapTarget,
    paddingVertical: Spacing.x8,
  },
  disc: {
    width: ICON_DISC,
    height: ICON_DISC,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, minWidth: 0, gap: 1 },
  trailing: {
    width: TapTarget,
    minHeight: TapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Up-and-left: the direction the term travels when this is pressed. */
  fillArrow: { transform: [{ rotate: '-45deg' }] },
});
