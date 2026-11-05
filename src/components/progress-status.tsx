import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { AnchoredMenu, AnchoredMenuItem, useAnchoredMenu } from '@/components/ui/anchored-menu';
import { useCardMaterial } from '@/components/ui/card-material';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import {
  COMPLETION_LABEL,
  PROGRESS_META,
  PROGRESS_POSTER,
  PROGRESS_ROWS,
  type ProgressChoice,
} from '@/constants/progress';
import { Radius, Spacing, TapTarget, ensureContrast } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';

export type ProgressStatusProps = {
  value: ProgressChoice | null;
  onChange: (next: ProgressChoice | null) => void;
  /** For "Completed": how far past the credits. */
  level: 'story' | 'main';
  onLevelChange: (level: 'story' | 'main') => void;
};

/** The seven, in the order the grid had them: not started, in it, finished, stopped. */
const ORDER = PROGRESS_ROWS.flat();

/**
 * The log form's progress — the Apple pass (2026-11-05): one row, **Status**,
 * whose value at the far end opens a pull-down of the seven choices
 * (`constants/progress`), each with its glyph in its poster hue and a check on
 * the one in force. "Completed" adds a second row, **How far**, a two-segment
 * control: Story, or Main + extras.
 *
 * It replaced the seven poured pills (`progress-pills`, the owner's reference
 * of 2026-10-15): a grid of outlines in the poster palette, the chosen one
 * pouring solid. The vocabulary, the colours and the rule are the same — a
 * new log starts with nothing chosen, and the form will not save without a
 * choice — only the control changed.
 *
 * Colour is still never the only signal: the row says the choice in words,
 * the menu ticks it, and a screen reader hears it as checked.
 */
export function ProgressStatus({ value, onChange, level, onLevelChange }: ProgressStatusProps) {
  const theme = useTheme();
  const accent = useAccent();
  const material = useCardMaterial();
  const [trigger, menu] = useAnchoredMenu();
  const meta = value ? PROGRESS_META[value] : null;
  const menuGround = accent.m3.surfaceContainerHigh;

  return (
    <View style={[styles.card, { backgroundColor: material.fill, borderColor: material.edge }]}>
      <View ref={trigger} collapsable={false}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={meta ? `Status, ${meta.label}` : 'Status, not chosen'}
          accessibilityHint="Opens the choices"
          accessibilityState={{ expanded: menu.isOpen }}
          onPress={menu.open}
          scaleTo={0.99}
          pressedColor={theme.controlPressed}
          style={styles.row}>
          <Text variant="body" style={styles.flex}>
            Status
          </Text>
          {value && meta ? (
            <View style={styles.value}>
              <Ionicons
                name={meta.icon}
                size={17}
                color={ensureContrast(theme[PROGRESS_POSTER[value]], material.fill, 3)}
              />
              <Text variant="body" color="textSecondary" numberOfLines={1}>
                {meta.label}
              </Text>
            </View>
          ) : (
            <Text variant="body" color="textMuted">
              Choose
            </Text>
          )}
          <Ionicons name="chevron-expand" size={16} color={theme.textMuted} />
        </PressableScale>
      </View>

      {value === 'completed' && (
        <View style={[styles.row, styles.ruled, { borderTopColor: theme.border }]}>
          <Text variant="body" style={styles.flex}>
            How far
          </Text>
          <View style={styles.segments}>
            <Segmented
              label="How far you got"
              value={level}
              onChange={onLevelChange}
              options={[
                { value: 'story', label: COMPLETION_LABEL.story },
                { value: 'main', label: COMPLETION_LABEL.main },
              ]}
            />
          </View>
        </View>
      )}

      <AnchoredMenu menu={menu} label="Status" align="end">
        {ORDER.map((choice) => {
          const item = PROGRESS_META[choice];
          return (
            <AnchoredMenuItem
              key={choice}
              icon={item.icon}
              iconColor={ensureContrast(theme[PROGRESS_POSTER[choice]], menuGround, 3)}
              title={item.label}
              hint={item.hint}
              checked={choice === value}
              trailing={
                choice === value ? (
                  <Ionicons name="checkmark" size={20} color={theme.text} />
                ) : undefined
              }
              onPress={() => {
                menu.close();
                onChange(choice);
              }}
            />
          );
        })}
      </AnchoredMenu>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.review, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    minHeight: TapTarget + Spacing.x8,
    paddingHorizontal: Spacing.x16,
    paddingVertical: Spacing.x8,
  },
  ruled: { borderTopWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1 },
  value: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8, flexShrink: 1 },
  segments: { width: 210 },
});
