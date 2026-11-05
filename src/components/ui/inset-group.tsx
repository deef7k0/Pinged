import Ionicons from '@expo/vector-icons/Ionicons';
import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Spacing, TapTarget, readableInk } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type IconName = keyof typeof Ionicons.glyphMap;

/** iOS 26's grouped list: its corner, its inset, its rows' least height. */
export const INSET_GROUP = {
  radius: 26,
  /** From the group's edge to a row's words, and to the hairline under them. */
  inset: 16,
  /** A row's least height: past both platforms' floors. */
  rowHeight: Math.max(TapTarget, 48) + 4,
  /** A row's glyph tile (Settings'): 29 square, 7 round, its glyph 17. */
  tile: 29,
  tileRadius: 7,
  tileGlyph: 17,
  /** From the tile to the words. */
  tileGap: 12,
} as const;

/**
 * A group of rows, as iOS's Settings draws one (the Apple pass, 2026-11-04):
 * an optional heading over it in the quiet ink, the rows in one rounded
 * `surface` container with a hairline between them that starts where the
 * words do, and an optional footer under it that explains them — the place
 * a paragraph goes, instead of under every choice.
 */
export function InsetGroup({
  header,
  footer,
  children,
}: {
  header?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const theme = useTheme();
  const rows = Children.toArray(children).filter(isValidElement);

  return (
    <View style={styles.group}>
      {!!header && (
        <Text
          variant="label"
          color="textSecondary"
          accessibilityRole="header"
          style={styles.header}>
          {header}
        </Text>
      )}
      <View style={[styles.box, { backgroundColor: theme.surface }]}>
        {rows.map((row, index) => (
          <Fragment key={row.key ?? index}>
            {index > 0 && (
              <View
                style={[
                  styles.rule,
                  {
                    backgroundColor: theme.border,
                    marginLeft:
                      INSET_GROUP.inset +
                      ((row.props as RowProps).icon ? INSET_GROUP.tile + INSET_GROUP.tileGap : 0),
                  },
                ]}
              />
            )}
            {row}
          </Fragment>
        ))}
      </View>
      {typeof footer === 'string' ? (
        <Text variant="bodySmall" color="textSecondary" style={styles.footer}>
          {footer}
        </Text>
      ) : footer ? (
        <View style={styles.footer}>{footer}</View>
      ) : null}
    </View>
  );
}

export type RowProps = {
  title: string;
  /** A second line, quieter. Prefer the group's footer for an explanation. */
  subtitle?: string;
  /** A glyph in a tinted rounded square at the row's start, as Settings' are. */
  icon?: IconName;
  /** The tile's colour. The quiet grey when absent. */
  tint?: string;
  /** The current value, at the far end in the quiet ink — "In 3D", "3". */
  value?: string;
  /** Where the row leads: a chevron at the far end. */
  onPress?: () => void;
  /** `onPress` opens a pull-down, not a page: iOS's up-and-down chevron. */
  menu?: boolean;
  /** A switch at the far end, in place of a value and a chevron. */
  toggle?: { value: boolean; onValueChange: (next: boolean) => void; tint?: string };
  /** Anything else at the far end — a menu's trigger, a count. */
  trailing?: ReactNode;
  /** The words in red, as a destructive row's are; no chevron. */
  destructive?: boolean;
  /** Centre the words, as a group of one destructive row centres them. */
  centred?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
};

/** One row of an `<InsetGroup>`. */
export function Row({
  title,
  subtitle,
  icon,
  tint,
  value,
  onPress,
  menu = false,
  toggle,
  trailing,
  destructive = false,
  centred = false,
  disabled = false,
  accessibilityLabel,
}: RowProps) {
  const theme = useTheme();
  const tile = tint ?? theme.surfaceSelected;

  const body = (
    <>
      {icon && (
        <View style={[styles.tile, { backgroundColor: tile }]}>
          <Ionicons name={icon} size={INSET_GROUP.tileGlyph} color={readableInk(tile)} />
        </View>
      )}
      <View style={[styles.words, centred && styles.centredWords]}>
        <Text variant="body" color={destructive ? 'danger' : 'text'} numberOfLines={2}>
          {title}
        </Text>
        {!!subtitle && (
          <Text variant="bodySmall" color="textSecondary">
            {subtitle}
          </Text>
        )}
      </View>
      {!!value && (
        <Text variant="body" color="textSecondary" numberOfLines={1} style={styles.value}>
          {value}
        </Text>
      )}
      {trailing}
      {toggle && (
        <Switch
          value={toggle.value}
          onValueChange={toggle.onValueChange}
          label={title}
          tint={toggle.tint}
          disabled={disabled}
        />
      )}
      {onPress && !toggle && !destructive && (
        <Ionicons
          name={menu ? 'chevron-expand' : 'chevron-forward'}
          size={menu ? 16 : 17}
          color={theme.textMuted}
        />
      )}
    </>
  );

  if (onPress && !toggle) {
    return (
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? (value ? `${title}, ${value}` : title)}
        accessibilityState={menu ? { disabled, expanded: false } : { disabled }}
        disabled={disabled}
        onPress={onPress}
        scaleTo={1}
        pressedColor={theme.controlPressed}
        style={StyleSheet.flatten([styles.row, disabled && styles.disabled])}>
        {body}
      </PressableScale>
    );
  }
  return <View style={styles.row}>{body}</View>;
}

const styles = StyleSheet.create({
  group: { gap: Spacing.x8 },
  header: { paddingHorizontal: INSET_GROUP.inset },
  box: { borderRadius: INSET_GROUP.radius, borderCurve: 'continuous', overflow: 'hidden' },
  rule: { height: StyleSheet.hairlineWidth },
  footer: { paddingHorizontal: INSET_GROUP.inset },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    minHeight: INSET_GROUP.rowHeight,
    paddingHorizontal: INSET_GROUP.inset,
    paddingVertical: Spacing.x8,
  },
  disabled: { opacity: 0.35 },
  tile: {
    width: INSET_GROUP.tile,
    height: INSET_GROUP.tile,
    borderRadius: INSET_GROUP.tileRadius,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  words: { flex: 1, minWidth: 0, gap: 2 },
  centredWords: { alignItems: 'center' },
  value: { flexShrink: 1, textAlign: 'right' },
});
