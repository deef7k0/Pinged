import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Row } from '@/components/ui/inset-group';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Tray } from '@/components/ui/tray';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const EARLIEST_YEAR = 1972;
const MONTHS = Array.from({ length: 12 }, (_, index) =>
  new Date(2000, index, 1).toLocaleDateString(undefined, { month: 'long' })
);
/** A column's row: iOS's picker line. */
const LINE = 44;

/** '2021-05' → "May 2021"; '2021' → "2021"; null → null. */
export function partialDateText(value: string | null): string | null {
  const match = /^(\d{4})(?:-(\d{2}))?/.exec(value ?? '');
  if (!match) return null;
  const month = match[2] ? MONTHS[Number(match[2]) - 1] : null;
  return month ? `${month} ${match[1]}` : match[1];
}

/**
 * A partial date — a year, or a month of one — as a row of an `<InsetGroup>`
 * (the Apple pass, 2026-11-05): its value at the far end, and a tray with a
 * column of years and a column of months under it, Clear and Done. It
 * replaces `<PartialDateField>`'s two select fields side by side.
 *
 * Stores what the field stored: '2021', '2021-05', or null; a day already in
 * a stored value is dropped only if the date is changed.
 */
export function PartialDateRow({
  title,
  value,
  onChange,
}: {
  title: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const match = /^(\d{4})(?:-(\d{2}))?/.exec(value ?? '');
  const year = match?.[1] ?? null;
  const month = match?.[2] ?? null;

  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: now - EARLIEST_YEAR + 1 }, (_, index) => String(now - index));
  }, []);

  return (
    <>
      <Row
        title={title}
        value={partialDateText(value) ?? 'Not set'}
        onPress={() => setOpen(true)}
      />
      <Tray visible={open} onClose={() => setOpen(false)}>
        <View style={styles.tray}>
          <Text variant="h4" accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <View style={styles.columns}>
            <Column
              label="Year"
              options={years.map((entry) => ({ value: entry, label: entry }))}
              value={year}
              onPick={(next) => onChange(month ? `${next}-${month}` : next)}
            />
            <Column
              label="Month"
              options={[
                { value: '', label: 'Any month' },
                ...MONTHS.map((name, index) => ({
                  value: String(index + 1).padStart(2, '0'),
                  label: name,
                })),
              ]}
              value={year ? (month ?? '') : null}
              disabled={!year}
              onPick={(next) => year && onChange(next ? `${year}-${next}` : year)}
            />
          </View>
          {!year && (
            <Text variant="bodySmall" color="textMuted" style={styles.note}>
              Pick a year first — a month on its own is not a date.
            </Text>
          )}
          <View style={styles.actions}>
            <View style={styles.flex}>
              <Button
                title="Clear"
                variant="secondary"
                fullWidth
                disabled={!value}
                onPress={() => {
                  onChange(null);
                  setOpen(false);
                }}
              />
            </View>
            <View style={styles.flex}>
              <Button title="Done" fullWidth onPress={() => setOpen(false)} />
            </View>
          </View>
        </View>
      </Tray>
    </>
  );
}

/** One column of choices, the chosen one on a grey capsule with a check. */
function Column({
  label,
  options,
  value,
  onPick,
  disabled = false,
}: {
  label: string;
  options: readonly { value: string; label: string }[];
  value: string | null;
  onPick: (value: string) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.column, disabled && styles.disabled]}>
      <Text variant="label" color="textSecondary" style={styles.columnLabel}>
        {label}
      </Text>
      <ScrollView
        style={styles.list}
        showsVerticalScrollIndicator={false}
        accessibilityRole="radiogroup"
        accessibilityLabel={label}>
        {options.map((option) => {
          const chosen = option.value === value;
          return (
            <PressableScale
              key={option.value || 'none'}
              accessibilityRole="radio"
              accessibilityState={{ selected: chosen, disabled }}
              accessibilityLabel={option.label}
              disabled={disabled}
              onPress={() => onPick(option.value)}
              scaleTo={0.98}
              pressedColor={theme.controlPressed}
              style={StyleSheet.flatten([
                styles.line,
                chosen && { backgroundColor: theme.controlFill },
              ])}>
              <Text variant="body" color={chosen ? 'text' : 'textSecondary'} numberOfLines={1}>
                {option.label}
              </Text>
              {chosen && <Ionicons name="checkmark" size={18} color={theme.text} />}
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tray: { padding: Spacing.x16, gap: Spacing.x12 },
  title: { textAlign: 'center' },
  columns: { flexDirection: 'row', gap: Spacing.x12 },
  column: { flex: 1, gap: Spacing.x8 },
  columnLabel: { paddingHorizontal: Spacing.x12 },
  disabled: { opacity: 0.4 },
  list: { height: LINE * 5.5 },
  line: {
    height: LINE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.x12,
    borderRadius: Radius.pill,
  },
  note: { textAlign: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.x12, paddingTop: Spacing.x4 },
});
