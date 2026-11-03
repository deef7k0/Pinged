import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Checkbox } from '@/components/ui/selection-marks';
import { Text } from '@/components/ui/text';
import { Tray } from '@/components/ui/tray';
import { TextField } from '@/components/ui/text-field';
import { Spacing, TapTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Lists longer than this get a field to find a name in. */
const SEARCHABLE = 10;

export type PickOption<K extends string | number> = { key: K; label: string };

/** Lower case, accents out — what a typed word is matched on. */
function fold(text: string): string {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Several of a list, chosen in a sheet that rises over the page: a tick box a
 * row, what is already chosen pinned at the top, a field to find a name in a
 * long list, and Clear and Done at the foot.
 *
 * Surprise Me's way to pick genres, themes, platforms and the rest, so each is
 * one row on the page saying what it holds instead of a wall of chips — the
 * owner's "make the options in the Surprise Me page more friendly to look at,
 * easier to arrange and pick" (2026-10-16). Changes apply as they are made;
 * Done only closes.
 *
 * A tray (`<Tray>`, reacticx's), as the filter bar's sheets are: the form it opens
 * from is inside a scroller, and a sheet drawn in place there would scroll with
 * it.
 */
export function MultiPickSheet<K extends string | number>({
  title,
  hint,
  visible,
  options,
  selected,
  onChange,
  onClose,
}: {
  title: string;
  /** One line under the title: what choosing several means. */
  hint?: string;
  visible: boolean;
  options: readonly PickOption<K>[];
  selected: readonly K[];
  onChange: (next: K[]) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [typed, setTyped] = useState('');

  /* What was chosen when the sheet opened leads, in the list's own order, so
     the rest do not jump about under the finger as boxes are ticked. */
  const [pinned, setPinned] = useState<readonly K[]>([]);
  const term = fold(typed.trim());
  const matching = term ? options.filter((option) => fold(option.label).includes(term)) : options;
  const ordered = [
    ...matching.filter((option) => pinned.includes(option.key)),
    ...matching.filter((option) => !pinned.includes(option.key)),
  ];

  function toggle(key: K) {
    onChange(
      selected.includes(key) ? selected.filter((entry) => entry !== key) : [...selected, key]
    );
  }

  return (
    <Tray
      visible={visible}
      onClose={onClose}
      onShow={() => {
        setTyped('');
        setPinned(selected);
      }}>
      <View style={styles.panel}>
        <View style={[styles.head, { borderBottomColor: theme.border }]}>
          <View style={styles.headText}>
            <Text variant="h3" accessibilityRole="header">
              {title}
            </Text>
            {!!hint && (
              <Text variant="bodySmall" color="textMuted">
                {hint}
              </Text>
            )}
          </View>
          <IconButton icon="close" accessibilityLabel="Close" size="small" onPress={onClose} />
        </View>

        {options.length > SEARCHABLE && (
          <View style={styles.search}>
            <TextField
              value={typed}
              onChangeText={setTyped}
              icon="search"
              variant="search"
              placeholder={`Find ${title.toLowerCase()}`}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={`Find ${title.toLowerCase()}`}
            />
          </View>
        )}

        <FlatList
          data={ordered}
          keyExtractor={(option) => String(option.key)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text variant="bodySmall" color="textMuted" style={styles.empty}>
              {`Nothing called “${typed.trim()}”.`}
            </Text>
          }
          renderItem={({ item }) => {
            const checked = selected.includes(item.key);
            return (
              <PressableScale
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                accessibilityLabel={item.label}
                onPress={() => toggle(item.key)}
                scaleTo={0.98}
                style={styles.row}>
                <Checkbox checked={checked} />
                <Text
                  variant="body"
                  color={checked ? 'text' : 'textSecondary'}
                  style={styles.label}>
                  {item.label}
                </Text>
              </PressableScale>
            );
          }}
        />

        <View style={[styles.foot, { borderTopColor: theme.border, paddingBottom: Spacing.x12 }]}>
          <View style={styles.footButton}>
            <Button
              title="Clear"
              variant="secondary"
              disabled={selected.length === 0}
              onPress={() => onChange([])}
              fullWidth
            />
          </View>
          <View style={styles.footButton}>
            <Button
              title={selected.length > 0 ? `Done · ${selected.length}` : 'Done'}
              variant="primary"
              onPress={onClose}
              fullWidth
            />
          </View>
        </View>
      </View>
    </Tray>
  );
}

const styles = StyleSheet.create({
  /* In a tray (`<Tray>`), which caps it at 80% of the display: a sheet that
     filled it would be a screen, and this is a disclosure. */
  panel: { flexShrink: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    padding: Spacing.x16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headText: { flex: 1, gap: 2 },
  search: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x12 },
  list: { paddingVertical: Spacing.x8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    minHeight: TapTarget,
    paddingHorizontal: Spacing.x16,
    paddingVertical: Spacing.x8,
  },
  label: { flex: 1 },
  empty: { padding: Spacing.x16 },
  foot: {
    flexDirection: 'row',
    gap: Spacing.x12,
    paddingHorizontal: Spacing.x16,
    paddingTop: Spacing.x12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footButton: { flex: 1 },
});
