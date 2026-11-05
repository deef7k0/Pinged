import Ionicons from '@expo/vector-icons/Ionicons';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AnchoredMenu, AnchoredMenuItem, useAnchoredMenu } from '@/components/ui/anchored-menu';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Radius, SmallControlSlop, Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useHomeGenres } from '@/hooks/use-home-genres';
import { useTheme } from '@/hooks/use-theme';
import { MOODS, type MoodKey } from '@/lib/games/moods';
import { ALL, type HomeView } from '@/lib/home-view';

/** A chip: Apple Music's filter capsule, 32 tall. */
const CHIP = 32;
/** The row the chips stand in, scrolling with the page. */
export const HOME_CHIP_ROW = 44;

/**
 * Home's chips — **All**, **Mood** and **Genre** — as Apple Music's filter
 * capsules (the Apple pass, 2026-11-05): filled, no outline, 32 tall, the
 * chosen one white with dark words. Mood and Genre are pull-downs: a tap
 * drops a menu of the ten choices with a check on the one in force, and the
 * chip then reads the choice ("Relax ⌄").
 *
 * It replaces SimpMusic's `ExpandableChip` (2026-10-22): an outlined chip that
 * opened into its choices inside one growing pill and folded to "Mood |
 * Relax". The choices and what picking one does are the same; only how they
 * are offered changed.
 *
 * A row of its own under the large title, scrolling with the page — it was
 * pinned in the bar.
 */
export function HomeChips({
  view,
  onChange,
}: {
  view: HomeView;
  onChange: (view: HomeView) => void;
}) {
  const genres = useHomeGenres();
  const mood = view.kind === 'mood' ? MOODS.find((entry) => entry.key === view.mood) : null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroller}
      contentContainerStyle={styles.row}
      accessibilityRole="tablist"
      accessibilityLabel="What Home shows">
      <Chip label="All" selected={view.kind === 'all'} onPress={() => onChange(ALL)} />

      <PullDownChip
        label={mood?.label ?? 'Mood'}
        what="Mood"
        selected={view.kind === 'mood'}
        options={MOODS.map((entry) => ({ key: entry.key, label: entry.label }))}
        picked={view.kind === 'mood' ? view.mood : null}
        onPick={(key) => onChange({ kind: 'mood', mood: key as MoodKey })}
      />

      {genres.length > 0 && (
        <PullDownChip
          label={view.kind === 'genre' ? view.genre.label : 'Genre'}
          what="Genre"
          selected={view.kind === 'genre'}
          options={genres.map((genre) => ({ key: String(genre.id), label: genre.label }))}
          picked={view.kind === 'genre' ? String(view.genre.id) : null}
          onPick={(key) => {
            const genre = genres.find((entry) => String(entry.id) === key);
            if (genre) onChange({ kind: 'genre', genre: { id: genre.id, label: genre.label } });
          }}
        />
      )}
    </ScrollView>
  );
}

/** A capsule: white when chosen, the control grey when not. */
function Chip({
  label,
  selected,
  onPress,
  chevron = false,
  expanded,
  hint,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  chevron?: boolean;
  expanded?: boolean;
  hint?: string;
}) {
  const theme = useTheme();
  const accent = useAccent();
  const ink = selected ? theme.onPrimary : theme.text;

  return (
    <PressableScale
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ selected, expanded }}
      onPress={onPress}
      hitSlop={SmallControlSlop}
      scaleTo={0.95}
      focusRing={accent.ring}
      pressedColor={selected ? undefined : theme.controlPressed}
      style={StyleSheet.flatten([
        styles.chip,
        { backgroundColor: selected ? theme.text : theme.controlFill },
      ])}>
      <Text variant="h5" style={{ color: ink }} numberOfLines={1}>
        {label}
      </Text>
      {chevron && <Ionicons name="chevron-down" size={14} color={ink} />}
    </PressableScale>
  );
}

/** A chip that drops a menu of its choices, the one in force ticked. */
function PullDownChip({
  label,
  what,
  selected,
  options,
  picked,
  onPick,
}: {
  label: string;
  /** What the choices are — "Mood", "Genre" — for the menu's label. */
  what: string;
  selected: boolean;
  options: readonly { key: string; label: string }[];
  picked: string | null;
  onPick: (key: string) => void;
}) {
  const theme = useTheme();
  const [trigger, menu] = useAnchoredMenu();

  return (
    <>
      <View ref={trigger} collapsable={false}>
        <Chip
          label={label}
          selected={selected}
          chevron
          expanded={menu.isOpen}
          hint={`Choose a ${what.toLowerCase()}`}
          onPress={menu.open}
        />
      </View>
      <AnchoredMenu menu={menu} label={what} width={240}>
        {options.map((option) => (
          <AnchoredMenuItem
            key={option.key}
            title={option.label}
            trailing={
              option.key === picked ? (
                <Ionicons name="checkmark" size={20} color={theme.text} />
              ) : undefined
            }
            onPress={() => {
              menu.close();
              onPick(option.key);
            }}
          />
        ))}
      </AnchoredMenu>
    </>
  );
}

const styles = StyleSheet.create({
  scroller: { flexGrow: 0, height: HOME_CHIP_ROW },
  row: {
    alignItems: 'center',
    gap: Spacing.x8,
    paddingHorizontal: Spacing.x16,
    height: HOME_CHIP_ROW,
  },
  chip: {
    height: CHIP,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x4,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
  },
});
