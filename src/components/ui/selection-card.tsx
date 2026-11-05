import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Radius, Spacing, TapTarget, withAlpha } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';

export type SelectionCardProps = {
  title: string;
  /** A sentence under the title — what the choice means. */
  hint?: string | null;
  selected: boolean;
  onPress: () => void;
  /**
   * `radio` (the default) for one-of-many. `checkbox` for a card that toggles
   * on its own.
   */
  role?: 'radio' | 'checkbox';
  /** Something the title carries before it — a status glyph, a platform mark. */
  leading?: ReactNode;
  /** Something at the trailing edge — a "SAVED" tag, a count. */
  trailing?: ReactNode;
  /**
   * `card` (the default) is outlined at rest, as the reference's options are.
   * `row` is bare until chosen — for a long picker, where thirty outlined cards
   * stacked would be a wall of boxes around the words.
   */
  frame?: 'card' | 'row';
  /** A single line and a smaller circle, for a picker's rows. */
  compact?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

/**
 * One choice, as Apple draws a choice in a list (the Apple pass, 2026-11-04):
 * a filled row, the name and what it means on the left, and **a checkmark at
 * the trailing edge** once it is chosen — Settings' and a pull-down's. A
 * card that toggles on its own (`checkbox`) shows an empty circle that fills
 * with a check, as Reminders' does.
 *
 * It was SimpMusic's Server option: an outlined card with a 34dp radio on
 * the leading edge and the accent's wash inside when chosen.
 *
 * The one implementation for every single-choice list with words to it: a
 * report's reasons, a copy's condition, a collection's type, a release, a
 * select field's options. A new one uses this.
 */
export function SelectionCard({
  title,
  hint,
  selected,
  onPress,
  role = 'radio',
  leading,
  trailing,
  frame = 'card',
  compact = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
}: SelectionCardProps) {
  const theme = useTheme();
  const accent = useAccent();
  const mark = accent.tonal ? accent.onSurface : theme.text;

  return (
    <PressableScale
      accessibilityRole={role}
      accessibilityState={
        role === 'radio' ? { selected, disabled } : { checked: selected, disabled }
      }
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint ?? hint ?? undefined}
      disabled={disabled}
      onPress={onPress}
      scaleTo={1}
      pressedColor={theme.controlPressed}
      style={StyleSheet.flatten([
        styles.card,
        compact && styles.compact,
        { backgroundColor: frame === 'row' ? withAlpha(theme.text, 0) : theme.surface },
        disabled && styles.disabled,
      ])}>
      <View style={styles.text}>
        <View style={styles.titleRow}>
          {leading}
          <Text variant="body" numberOfLines={compact ? 1 : 2} style={styles.title}>
            {title}
          </Text>
        </View>
        {hint ? (
          <Text variant="bodySmall" color="textSecondary">
            {hint}
          </Text>
        ) : null}
      </View>

      {trailing}

      {role === 'checkbox' ? (
        <Ionicons
          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={selected ? mark : theme.textMuted}
        />
      ) : (
        <View style={styles.check}>
          {selected && <Ionicons name="checkmark" size={20} color={mark} />}
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    paddingVertical: Spacing.x12,
    paddingHorizontal: Spacing.x16,
    minHeight: TapTarget + Spacing.x8,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
  },
  /* The check's place is kept while nothing is chosen, so the words never move. */
  check: { width: 20, alignItems: 'center' },
  /* A picker row: a line of text, a smaller circle, still past the tap floor. */
  compact: {
    minHeight: TapTarget + Spacing.x8,
    paddingVertical: Spacing.x8,
    gap: Spacing.x12,
  },
  text: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  title: { flexShrink: 1 },
  disabled: { opacity: 0.45 },
});
