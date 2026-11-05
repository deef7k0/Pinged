import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { AnchoredMenu, AnchoredMenuItem, useAnchoredMenu } from '@/components/ui/anchored-menu';
import { INSET_GROUP } from '@/components/ui/inset-group';
import { Loader } from '@/components/ui/loader';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type IconName = keyof typeof Ionicons.glyphMap;

export type ModerationAction = {
  label: string;
  icon: IconName;
  onPress: () => void;
  /** This verdict is being sent. */
  pending?: boolean;
};

/** How wide a revealed action is. */
const ACTION_WIDTH = 96;

/**
 * One entry of the moderation queue — Mail's row (the Apple pass,
 * 2026-11-05): the entry in an inset-group box with no edge; **swipe right**
 * for the verdict that keeps it (approve, dismiss the reports), **swipe left**
 * for the one that takes it down (reject, remove, hide), and a ⋯ at its top
 * right holding both and anything else (Read in full) — which is also how a
 * screen reader reaches them without a swipe. It replaced each card's row of
 * two buttons.
 */
export function ModerationRow({
  keep,
  remove,
  more = [],
  children,
}: {
  keep: ModerationAction;
  remove: ModerationAction;
  /** Further items for the ⋯ menu, after the two verdicts. */
  more?: ModerationAction[];
  children: ReactNode;
}) {
  const theme = useTheme();
  const swipe = useRef<SwipeableMethods>(null);
  const [trigger, menu] = useAnchoredMenu();
  const busy = !!keep.pending || !!remove.pending;

  function act(action: ModerationAction) {
    swipe.current?.close();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    action.onPress();
  }

  const panel = (action: ModerationAction, color: string) => (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={action.label}
      onPress={() => act(action)}
      scaleTo={0.97}
      style={StyleSheet.flatten([styles.action, { backgroundColor: color }])}>
      <Ionicons name={action.icon} size={22} color={theme.text} />
      <Text variant="caption" style={{ color: theme.text }} numberOfLines={2}>
        {action.label}
      </Text>
    </PressableScale>
  );

  return (
    <ReanimatedSwipeable
      ref={swipe}
      enabled={!busy}
      friction={1.6}
      overshootFriction={8}
      leftThreshold={ACTION_WIDTH / 2}
      rightThreshold={ACTION_WIDTH / 2}
      containerStyle={styles.container}
      renderLeftActions={() => panel(keep, theme.success)}
      renderRightActions={() => panel(remove, theme.danger)}>
      <View style={[styles.box, { backgroundColor: theme.surface }]}>
        <View ref={trigger} collapsable={false} style={styles.moreKey}>
          {busy ? (
            <Loader size="small" color={theme.textSecondary} />
          ) : (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Actions"
              accessibilityState={{ expanded: menu.isOpen }}
              onPress={menu.open}
              hitSlop={8}
              scaleTo={0.9}
              pressedColor={theme.controlPressed}
              style={styles.moreButton}>
              <Ionicons name="ellipsis-horizontal" size={18} color={theme.textSecondary} />
            </PressableScale>
          )}
        </View>
        {children}
      </View>
      <AnchoredMenu menu={menu} label="Actions" align="end">
        {[keep, remove, ...more].map((item) => (
          <AnchoredMenuItem
            key={item.label}
            icon={item.icon}
            iconColor={item === remove ? theme.danger : undefined}
            title={item.label}
            onPress={() => {
              menu.close();
              act(item);
            }}
          />
        ))}
      </AnchoredMenu>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: INSET_GROUP.radius, borderCurve: 'continuous' },
  box: {
    gap: Spacing.x12,
    padding: INSET_GROUP.inset,
    paddingTop: INSET_GROUP.inset,
    borderRadius: INSET_GROUP.radius,
    borderCurve: 'continuous',
  },
  moreKey: { position: 'absolute', top: Spacing.x8, right: Spacing.x8, zIndex: 1 },
  moreButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  action: {
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x4,
    paddingHorizontal: Spacing.x8,
  },
});
