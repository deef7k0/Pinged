import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Radius, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const HEIGHT = 56;
const MARK = 9;

/**
 * Asking, on the board: your own blank plate, pinned at the head of the list —
 * a dashed outline with the board's registration marks, "Pin yours" and what
 * it does. Opens the same sheet as the bar's +.
 */
export function PinYours() {
  const theme = useTheme();
  const router = useRouter();
  const ink = withAlpha(theme.primaryText, 0.55);

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="New ping. Ask everyone what to play next"
      onPress={() => router.push('/new-ping')}
      scaleTo={0.98}
      pressedColor={theme.controlPressed}
      style={StyleSheet.flatten([styles.pin, { borderColor: theme.outline }])}>
      {CORNERS.map((corner) => (
        <View key={corner.key} pointerEvents="none" style={[styles.mark, corner.style]}>
          <View style={[styles.markH, { backgroundColor: ink }]} />
          <View style={[styles.markV, { backgroundColor: ink }]} />
        </View>
      ))}
      <Text variant="itemTitle" color="primaryText">
        Pin yours
      </Text>
      <Text variant="caption" color="textMuted">
        ask everyone what to play next
      </Text>
    </PressableScale>
  );
}

const INSET = 5 - MARK / 2;
const CORNERS = [
  { key: 'tl', style: { top: INSET, left: INSET } },
  { key: 'tr', style: { top: INSET, right: INSET } },
  { key: 'bl', style: { bottom: INSET, left: INSET } },
  { key: 'br', style: { bottom: INSET, right: INSET } },
] as const;

const styles = StyleSheet.create({
  pin: {
    height: HEIGHT,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  mark: { position: 'absolute', width: MARK, height: MARK },
  markH: { position: 'absolute', left: 0, right: 0, top: (MARK - 0.75) / 2, height: 0.75 },
  markV: { position: 'absolute', top: 0, bottom: 0, left: (MARK - 0.75) / 2, width: 0.75 },
});
