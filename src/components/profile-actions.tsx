import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { ACTIONS } from '@/constants/profile-layout';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Loader } from '@/components/ui/loader';

/**
 * The profile's actions, centred under its counts: one big button, then up to
 * two glyph keys — the owner's reference (2026-10-17), whose row is "Follow"
 * beside an info and a share glyph.
 *
 * Someone else's profile: Follow, the friend key, share. Your own: Edit
 * profile, share. The same object either way, so the head is the same shape
 * whoever is looking.
 */
export function ProfileActionRow({ button, keys }: { button: ReactNode; keys?: ReactNode }) {
  return (
    <View style={styles.row}>
      {button}
      {!!keys && <View style={styles.keys}>{keys}</View>}
    </View>
  );
}

/**
 * The big button: white, filled, a full pill — the owner's "big white filled
 * rounded button for follow". `filled={false}` is the same pill in the action
 * grey, for a state that has already been chosen ("Following"): a button that
 * stayed white after it was pressed would say nothing had happened.
 */
export function ProfileButton({
  title,
  icon,
  onPress,
  filled = true,
  loading = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
}: {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  filled?: boolean;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const theme = useTheme();
  const fill = filled ? theme.white : theme.controlFill;
  /* The page's own near-black on the white: the button reads as cut out of it. */
  const ink = filled ? theme.background : theme.text;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onPress={onPress}
      disabled={disabled || loading}
      scaleTo={0.97}
      pressedColor={filled ? theme.controlInk : theme.controlPressed}
      style={StyleSheet.flatten([
        styles.button,
        { backgroundColor: fill },
        disabled && !loading && styles.disabled,
      ])}>
      {loading ? (
        <Loader color={ink} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={17} color={ink} />}
          <Text variant="button" numberOfLines={1} style={{ color: ink }}>
            {title}
          </Text>
        </>
      )}
    </PressableScale>
  );
}

/**
 * A glyph beside the button — the reference's info and share marks: no disc
 * and no fill, a grey glyph on the page, the tap floor round it. `alert` puts
 * a dot on it, for something waiting on the reader (a friend request).
 */
export function ProfileKey({
  icon,
  label,
  hint,
  onPress,
  loading = false,
  disabled = false,
  alert = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  alert?: boolean;
}) {
  const theme = useTheme();

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onPress={onPress}
      disabled={disabled || loading}
      scaleTo={0.88}
      style={StyleSheet.flatten([styles.key, disabled && !loading && styles.disabled])}>
      {loading ? (
        <Loader size="small" color={theme.textSecondary} />
      ) : (
        <Ionicons
          name={icon}
          size={ACTIONS.glyph}
          color={alert ? theme.text : theme.textSecondary}
        />
      )}
      {alert && !loading && (
        <View
          style={[styles.dot, { backgroundColor: theme.danger, borderColor: theme.background }]}
        />
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', maxWidth: '100%' },
  button: {
    width: ACTIONS.button,
    flexShrink: 1,
    height: ACTIONS.height,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x8,
    paddingHorizontal: Spacing.x16,
  },
  keys: { flexDirection: 'row', marginLeft: ACTIONS.gap },
  key: {
    width: ACTIONS.key,
    height: ACTIONS.key,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1.5,
  },
  disabled: { opacity: 0.45 },
});
