import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { SelectionCard } from '@/components/ui/selection-card';
import { Text } from '@/components/ui/text';
import { Tray } from '@/components/ui/tray';
import { ControlHeight, Radius, Spacing, Type } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';

export type SelectOption = {
  value: string;
  label: string;
  /** Optional leading glyph, drawn at the option's own tint. */
  icon?: keyof typeof Ionicons.glyphMap;
  tint?: string;
  /** Marks a value that is not in the canonical set — see `<SelectField>`. */
  foreign?: boolean;
};

export type SelectFieldProps = {
  label?: string;
  /** The current value, or empty for none. */
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** Shown when nothing is chosen. */
  placeholder?: string;
  /** Title of the sheet. Defaults to `label`. */
  sheetTitle?: string;
  hint?: string;
  /** Offer a "Clear" row. On by default — most fields of this kind are optional. */
  clearable?: boolean;
};

/**
 * A field you choose from, not one you type into.
 *
 * Built because free text was letting a record say anything: "Played on" was a
 * `<TextField>`, so a log could claim a platform the game never shipped on, or a
 * word that is not a platform at all. Those strings are read back on the case's
 * printed back and in every feed row, where a typo is indistinguishable from a
 * fact.
 *
 * A sheet rather than the app's usual row of pills for one reason: this control
 * lives in a two-column row beside "Hours played", where a wrapping pill row
 * would blow the column apart, and it has to hold up to seven platforms plus a
 * legacy value.
 *
 * The field is a `<TextField>`'s twin — same label, same recessed well, same
 * edge and corner — with a chevron where the typing would be, so a form reads
 * as one set of fields whichever kind each one is. The sheet is the app's menu
 * surface: rounded top, hairline edge, rows that light in the accent (wash,
 * edge and a check) when chosen.
 */
export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select',
  sheetTitle,
  hint,
  clearable = true,
}: SelectFieldProps) {
  const theme = useTheme();
  const accent = useAccent();
  const [open, setOpen] = useState(false);

  const selected = options.find((option) => option.value === value) ?? null;

  function choose(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <View style={styles.wrapper}>
      {label && <Text variant="fieldLabel">{label}</Text>}

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${label ?? 'Select'}. ${selected?.label ?? 'Not set'}`}
        accessibilityHint="Opens a list of choices"
        onPress={() => setOpen(true)}
        scaleTo={0.98}
        pressedColor={theme.controlFill}
        focusRing={accent.ring}
        style={StyleSheet.flatten([
          styles.shell,
          /* The sheet is this field's focus: while it is open, the field wears
             the accent's edge, as a text field does while you type in it. */
          { backgroundColor: theme.input, borderColor: open ? accent.onSurface : 'transparent' },
        ])}>
        {selected?.icon && (
          <Ionicons name={selected.icon} size={16} color={selected.tint ?? theme.textSecondary} />
        )}
        <Text
          variant="fieldText"
          numberOfLines={1}
          style={[styles.value, { color: selected ? theme.text : theme.textMuted }]}>
          {selected?.label ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={theme.textSecondary} />
      </PressableScale>

      {hint && (
        <Text variant="bodySmall" color="textMuted">
          {hint}
        </Text>
      )}

      <Tray visible={open} onClose={() => setOpen(false)} maxHeightRatio={0.55}>
        <View style={styles.sheet}>
          <Text variant="h4" style={styles.sheetTitle}>
            {sheetTitle ?? label ?? 'Select'}
          </Text>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}>
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <SelectionCard
                  key={option.value}
                  title={option.label}
                  selected={isSelected}
                  compact
                  onPress={() => choose(option.value)}
                  leading={
                    option.icon ? (
                      <Ionicons
                        name={option.icon}
                        size={16}
                        color={option.tint ?? (isSelected ? theme.text : theme.textSecondary)}
                      />
                    ) : undefined
                  }
                  trailing={
                    /* A value carried in from an older, unconstrained record.
                       Kept and marked rather than dropped: silently deleting
                       what someone typed is the one outcome worse than a typo. */
                    option.foreign ? (
                      <Text variant="caption" color="textSecondary">
                        SAVED
                      </Text>
                    ) : undefined
                  }
                />
              );
            })}

            {/* An action, not one of the choices, so it is drawn as one. */}
            {clearable && value !== '' && (
              <Button
                title="Clear"
                icon="close"
                variant="secondary"
                fullWidth
                onPress={() => choose('')}
              />
            )}
          </ScrollView>
        </View>
      </Tray>
    </View>
  );
}

const styles = StyleSheet.create({
  /* The same rhythm as `<TextField>`, so the two sit in one row without their
     labels or their wells disagreeing by a pixel. */
  wrapper: { gap: Spacing.x8 },
  /* The text field's well exactly: 54 tall, 18 round, no resting border —
     the 1.5 edge is always there and only its colour changes. */
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    minHeight: ControlHeight.field,
    paddingHorizontal: Spacing.x16,
    paddingVertical: Spacing.x8,
    borderRadius: Radius.input,
    borderWidth: 1.5,
  },
  value: { flex: 1 },

  /* In a tray (`<Tray>`), never taller than about half the screen: this is
     a short list attached to one field, and a sheet that fills the display
     reads as a new screen. The tray draws the handle. */
  sheet: {
    flexShrink: 1,
    paddingHorizontal: Spacing.x16,
    paddingBottom: Spacing.x16,
    gap: Spacing.x12,
  },
  sheetTitle: { ...Type.h4 },
  list: { flexGrow: 0 },
  listContent: { gap: Spacing.x12, paddingBottom: Spacing.x8 },
});
