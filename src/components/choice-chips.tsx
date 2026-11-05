import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { AnchoredMenu, AnchoredMenuItem, useAnchoredMenu } from '@/components/ui/anchored-menu';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Segmented } from '@/components/ui/segmented';
import { useSelectable } from '@/components/ui/selectable';
import { SelectionCard } from '@/components/ui/selection-card';
import { Text } from '@/components/ui/text';
import {
  ControlHeight,
  Radius,
  SmallControlRowGap,
  SmallControlSlop,
  Spacing,
} from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';

export type Choice<T extends string> = {
  value: T;
  label: string;
  /** Read out after the label; shown under it when `withHints` is set. */
  hint?: string;
};

export type ChoiceChipsProps<T extends string> = {
  label: string;
  choices: readonly Choice<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  /** Tapping the chosen one clears it. On by default: these are optional facts. */
  clearable?: boolean;
  /**
   * Print each hint under its label — for scales whose words need defining.
   *
   * The choices become **selection cards** (`<SelectionCard>`), one per row:
   * the circle on the leading edge, the name, the hint under it. A report
   * reason or a copy's condition is a decision with a sentence behind it, and
   * a card gives the sentence room to be read before the tap rather than after.
   */
  withHints?: boolean;
};

/**
 * One choice from a short, fixed vocabulary, every choice visible at once.
 *
 * For the forms that describe a copy or a release — completeness, condition,
 * region, photo kind — and for a report's reason, where a `<SelectField>` sheet
 * would hide the options behind a tap.
 *
 * **Two shapes.** Bare choices are pills in a wrapping row, the filter shape;
 * choices with hints are full-width selection cards. Both are outlined at rest
 * and select the same way, which is the app's one selected state
 * (`useSelectable`): an accent wash inside, the accent's edge around, and the
 * label up to full strength — three carriers, only one of them a hue, so the
 * choice survives colour blindness. The cards add a fourth, the checked circle.
 */
export function ChoiceChips<T extends string>({
  label,
  choices,
  value,
  onChange,
  clearable = true,
  withHints = false,
}: ChoiceChipsProps<T>) {
  const selectable = useSelectable();

  /*
   * Bare choices are iOS's (the Apple pass, 2026-11-05): up to four, a
   * segmented control; more, a pull-down. They were a wrapping row of
   * outlined pills. Choices with hints stay a checklist.
   */
  if (!withHints) {
    const pick = (next: T) => onChange(next === value && clearable ? null : next);
    return (
      <View style={styles.field}>
        <Text variant="fieldLabel" accessibilityRole="header">
          {label}
        </Text>
        {choices.length <= 4 ? (
          <Segmented
            label={label}
            value={value}
            onChange={pick}
            options={choices.map((choice) => ({ value: choice.value, label: choice.label }))}
          />
        ) : (
          <ChoicePullDown label={label} choices={choices} value={value} onPick={pick} />
        )}
      </View>
    );
  }

  return (
    <View style={styles.field}>
      <Text variant="fieldLabel" accessibilityRole="header">
        {label}
      </Text>
      <View style={withHints ? styles.cards : styles.row} accessibilityRole="radiogroup">
        {choices.map((choice) => {
          const selected = value === choice.value;
          const choose = () => onChange(selected && clearable ? null : choice.value);

          if (withHints) {
            return (
              <SelectionCard
                key={choice.value}
                title={choice.label}
                hint={choice.hint}
                selected={selected}
                onPress={choose}
              />
            );
          }

          const look = selectable(selected);
          return (
            <PressableScale
              key={choice.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={choice.label}
              accessibilityHint={choice.hint}
              onPress={choose}
              scaleTo={0.96}
              hitSlop={SmallControlSlop}
              pressedColor={look.pressedColor}
              focusRing={look.focusRing}
              style={StyleSheet.flatten([styles.chip, look.style])}>
              <Text variant="body" color={look.label}>
                {choice.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

/** A grey capsule holding the choice (or "Choose"), dropping the rest as a menu. */
function ChoicePullDown<T extends string>({
  label,
  choices,
  value,
  onPick,
}: {
  label: string;
  choices: readonly Choice<T>[];
  value: T | null;
  onPick: (value: T) => void;
}) {
  const theme = useTheme();
  const [trigger, menu] = useAnchoredMenu();
  const current = choices.find((choice) => choice.value === value) ?? null;

  return (
    <>
      <View ref={trigger} collapsable={false} style={styles.pullAnchor}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${current?.label ?? 'not chosen'}`}
          accessibilityState={{ expanded: menu.isOpen }}
          onPress={menu.open}
          scaleTo={0.97}
          hitSlop={SmallControlSlop}
          pressedColor={theme.controlPressed}
          style={StyleSheet.flatten([styles.pull, { backgroundColor: theme.controlFill }])}>
          <Text variant="h5" color={current ? 'text' : 'textMuted'} numberOfLines={1}>
            {current?.label ?? 'Choose'}
          </Text>
          <Ionicons name="chevron-expand" size={14} color={theme.textMuted} />
        </PressableScale>
      </View>
      <AnchoredMenu menu={menu} label={label} width={260}>
        {choices.map((choice) => (
          <AnchoredMenuItem
            key={choice.value}
            title={choice.label}
            hint={choice.hint}
            checked={choice.value === value}
            trailing={
              choice.value === value ? (
                <Ionicons name="checkmark" size={20} color={theme.text} />
              ) : undefined
            }
            onPress={() => {
              menu.close();
              onPick(choice.value);
            }}
          />
        ))}
      </AnchoredMenu>
    </>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.x12 },
  pullAnchor: { alignSelf: 'flex-start' },
  pull: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    height: ControlHeight.small,
    paddingHorizontal: Spacing.x16,
    borderRadius: Radius.pill,
  },
  /* Columns `x8` (8), Material's floor between touch targets. Rows exactly the
     two slops that meet across the gap, so wrapped rows' touch boxes tile
     without overlapping — see `SmallControlRowGap`. */
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.x8,
    rowGap: SmallControlRowGap,
  },
  /* The reference's 14 between options (`x16`, 15). */
  cards: { gap: Spacing.x16 },
  /* The reference's chip: 32 drawn, 16 at the sides, touched at the floor
     through `SmallControlSlop`. */
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x8,
    minHeight: ControlHeight.small,
    paddingHorizontal: Spacing.x16,
    paddingVertical: Spacing.x4,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  unavailable: { opacity: 0.45 },
});

export type MultiChoiceChipsProps<T extends string> = {
  label: string;
  choices: readonly Choice<T>[];
  value: readonly T[];
  onChange: (value: T[]) => void;
  /** The most that can be on at once. Further taps do nothing until one is off. */
  max: number;
};

/**
 * Several choices from a fixed vocabulary, up to a limit — the same pills as
 * `<ChoiceChips>`, as checkboxes rather than a radio group. A ticked pill carries
 * a check before its word, so "on" is a glyph as well as a tint.
 *
 * The limit is stated in the label ("2 of 4") rather than discovered by a tap
 * that silently does nothing: once the fourth is on, the rest dim and announce
 * themselves as unavailable, which is the whole explanation a reader needs.
 */
export function MultiChoiceChips<T extends string>({
  label,
  choices,
  value,
  onChange,
  max,
}: MultiChoiceChipsProps<T>) {
  const accent = useAccent();
  const selectable = useSelectable();
  const full = value.length >= max;

  return (
    <View style={styles.field}>
      <Text variant="fieldLabel" accessibilityRole="header">
        {`${label} · ${value.length} of ${max}`}
      </Text>
      <View style={styles.row}>
        {choices.map((choice) => {
          const selected = value.includes(choice.value);
          const unavailable = full && !selected;
          const look = selectable(selected);
          return (
            <PressableScale
              key={choice.value}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected, disabled: unavailable }}
              accessibilityLabel={choice.label}
              accessibilityHint={unavailable ? `Up to ${max}. Untick one first.` : choice.hint}
              disabled={unavailable}
              onPress={() =>
                onChange(
                  selected
                    ? value.filter((entry) => entry !== choice.value)
                    : [...value, choice.value]
                )
              }
              scaleTo={0.96}
              hitSlop={SmallControlSlop}
              pressedColor={look.pressedColor}
              focusRing={look.focusRing}
              style={StyleSheet.flatten([
                styles.chip,
                unavailable && styles.unavailable,
                look.style,
              ])}>
              {selected && <Ionicons name="checkmark" size={14} color={accent.onSurface} />}
              <Text variant="body" color={look.label}>
                {choice.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}
