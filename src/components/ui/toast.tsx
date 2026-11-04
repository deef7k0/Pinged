import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { memo, useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { FontFamily, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  TOAST_LIFETIME,
  TOAST_VISIBLE,
  getToasts,
  newToastHostId,
  registerToastHost,
  removeToast,
  subscribeToastHosts,
  subscribeToasts,
  toast as say,
  topToastHost,
  type ToastKind,
  type ToastRecord,
} from '@/lib/toast';

/*
 * reacticx's `Toast` (`molecules/Toast`, MIT), restated in this app's tokens
 * (the owner's, 2026-11-03). Its numbers, kept: a 18dp corner, 14 × 16 in, a
 * 20dp glyph, a hairline edge and a long soft shadow; four seconds a toast;
 * three shown, the ones behind each 16 further out and 5% smaller; tapped,
 * the stack spreads 14 apart and stops counting down; swiped away past 45dp
 * (or flung), it leaves the way it was thrown. Its entrance is reacticx's
 * `glide` spring (32 / 170) from a toast's height and 16 beyond, growing
 * from 0.94; its exit, 200ms.
 *
 * One change: **it stands at the top**, under the status bar, where
 * reacticx's default is the foot — this app's foot is the floating tab bar,
 * the mini player and the docked reply field.
 */

const RADIUS = 18;
const GAP = 14;
const COLLAPSE_OFFSET = 16;
const COLLAPSE_SCALE_STEP = 0.05;
const VIEWPORT_OFFSET = 16;
const ICON = 20;
const SWIPE_THRESHOLD = 45;
const SWIPE_VELOCITY = 300;
const EXIT_MS = 200;
const GLIDE = { damping: 32, stiffness: 170, mass: 1 };

/**
 * Where the app's toasts are drawn. One in the root layout, and one inside
 * every sheet's window (`<Tray>`), because Android draws a sheet over
 * everything the root has: only the newest one mounted draws.
 */
export function Toaster() {
  const [id] = useState(newToastHostId);
  useEffect(() => registerToastHost(id), [id]);
  const top = useSyncExternalStore(subscribeToastHosts, topToastHost);
  if (top !== id) return null;
  return <ToastStack />;
}

function ToastStack() {
  const insets = useSafeAreaInsets();
  const toasts = useSyncExternalStore(subscribeToasts, getToasts);
  const [heights, setHeights] = useState<Record<number, number>>({});
  const [expanded, setExpanded] = useState(false);

  /* A stack that has emptied folds back. */
  if (expanded && toasts.length === 0) setExpanded(false);

  if (toasts.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.region, { top: insets.top + Spacing.x8 }]}
      accessibilityLiveRegion="polite">
      {toasts.map((record, index) => {
        let before = 0;
        for (let i = 0; i < index; i += 1) before += heights[toasts[i].id] ?? 0;
        return (
          <ToastRow
            key={record.id}
            record={record}
            index={index}
            count={toasts.length}
            expanded={expanded}
            spreadY={before + index * GAP}
            onHeight={(height) =>
              setHeights((was) =>
                was[record.id] === height ? was : { ...was, [record.id]: height }
              )
            }
            onPress={() => setExpanded((open) => !open)}
          />
        );
      })}
    </View>
  );
}

const ToastRow = memo(function ToastRow({
  record,
  index,
  count,
  expanded,
  spreadY,
  onHeight,
  onPress,
}: {
  record: ToastRecord;
  index: number;
  count: number;
  expanded: boolean;
  spreadY: number;
  onHeight: (height: number) => void;
  onPress: () => void;
}) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [height, setHeight] = useState(0);

  const presence = useSharedValue(0);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const scale = useSharedValue(1);
  const shown = useSharedValue(1);

  /* Where it stands in the stack: spread, or tucked behind the one in front. */
  const targetY = expanded ? spreadY : index * COLLAPSE_OFFSET;
  const targetScale = expanded ? 1 : Math.max(0.8, 1 - index * COLLAPSE_SCALE_STEP);
  const targetShown = index < TOAST_VISIBLE ? 1 : 0;
  useEffect(() => {
    offsetY.set(reduceMotion ? targetY : withSpring(targetY, GLIDE));
    scale.set(reduceMotion ? targetScale : withSpring(targetScale, GLIDE));
    shown.set(withTiming(targetShown, { duration: 300 }));
  }, [targetY, targetScale, targetShown, reduceMotion, offsetY, scale, shown]);

  /* In once it knows its height, so it slides from exactly above itself. */
  const measured = height > 0;
  useEffect(() => {
    if (!measured || record.leaving) return;
    presence.set(reduceMotion ? 1 : withSpring(1, GLIDE));
  }, [measured, record.leaving, reduceMotion, presence]);

  /* Its lifetime — paused while the stack is spread out to be read. */
  const { id, leaving } = record;
  const duration = record.duration ?? TOAST_LIFETIME;
  useEffect(() => {
    if (expanded || leaving) return;
    const timer = setTimeout(() => say.dismiss(id), duration);
    return () => clearTimeout(timer);
  }, [expanded, leaving, id, duration]);

  /* Out: fade and shrink back the way it came, then gone. */
  useEffect(() => {
    if (!leaving) return;
    presence.set(
      withTiming(0, { duration: EXIT_MS }, (done) => {
        if (done) runOnJS(removeToast)(id);
      })
    );
  }, [leaving, id, presence]);

  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .activeOffsetY([-8, 8])
    .onUpdate((event) => {
      dragX.set(event.translationX);
      /* Upward freely, the way it came; downward only a little, resisting. */
      dragY.set(event.translationY < 0 ? event.translationY : event.translationY * 0.2);
    })
    .onEnd((event) => {
      const sideways =
        Math.abs(event.translationX) > SWIPE_THRESHOLD ||
        Math.abs(event.velocityX) > SWIPE_VELOCITY * 3;
      const upward = event.translationY < -SWIPE_THRESHOLD || event.velocityY < -SWIPE_VELOCITY * 3;
      if (sideways || upward) {
        if (sideways)
          dragX.set(withTiming(Math.sign(event.translationX || 1) * 480, { duration: 260 }));
        else dragY.set(withTiming(-240, { duration: 260 }));
        runOnJS(dismissBySwipe)(id);
        return;
      }
      dragX.set(withSpring(0, GLIDE));
      dragY.set(withSpring(0, GLIDE));
    });

  const style = useAnimatedStyle(() => {
    const p = presence.get();
    const travel = Math.abs(dragX.get()) + Math.abs(Math.min(0, dragY.get()));
    const enter = -(height + COLLAPSE_OFFSET) * (1 - p);
    return {
      opacity: shown.get() * p * (1 - Math.min(1, travel / 200)),
      transform: [
        { translateY: offsetY.get() + enter + dragY.get() },
        { translateX: dragX.get() },
        { scale: scale.get() * (0.94 + 0.06 * p) },
      ],
    };
  });

  const accent = kindColour(record.kind, theme);
  const glyph = record.icon ?? KIND_GLYPH[record.kind];

  return (
    <Animated.View
      pointerEvents={leaving ? 'none' : 'box-none'}
      onLayout={(event: LayoutChangeEvent) => {
        const next = Math.round(event.nativeEvent.layout.height);
        if (next !== height) setHeight(next);
        onHeight(next);
      }}
      style={[styles.row, { zIndex: count - index }, style]}>
      <GestureDetector gesture={pan}>
        <Pressable
          onPress={onPress}
          accessibilityRole="alert"
          accessibilityLabel={[record.title, record.description].filter(Boolean).join('. ')}
          accessibilityHint={count > 1 ? 'Shows every notice' : undefined}
          style={[
            styles.toast,
            {
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.border,
              boxShadow: `0 10px 20px ${withAlpha(theme.shadowInk, 0.45)}`,
            },
          ]}>
          {glyph && <Ionicons name={glyph} size={ICON} color={accent} />}
          <View style={styles.words}>
            <Text numberOfLines={2} style={[styles.title, { color: theme.text }]}>
              {record.title}
            </Text>
            {!!record.description && (
              <Text numberOfLines={3} style={[styles.description, { color: theme.textSecondary }]}>
                {record.description}
              </Text>
            )}
          </View>
          {record.action && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={record.action.label}
              onPress={() => {
                record.action?.onPress();
                say.dismiss(id);
              }}
              hitSlop={8}
              style={[styles.action, { backgroundColor: theme.text }]}>
              <Text style={[styles.actionLabel, { color: theme.surfaceElevated }]}>
                {record.action.label}
              </Text>
            </Pressable>
          )}
        </Pressable>
      </GestureDetector>
    </Animated.View>
  );
});

function dismissBySwipe(id: number) {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  say.dismiss(id);
}

const KIND_GLYPH: Record<ToastKind, keyof typeof Ionicons.glyphMap | null> = {
  default: null,
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
};

function kindColour(kind: ToastKind, theme: ReturnType<typeof useTheme>): string {
  switch (kind) {
    case 'success':
      return theme.success;
    case 'error':
      return theme.danger;
    case 'info':
      return theme.primaryText;
    default:
      return theme.text;
  }
}

const styles = StyleSheet.create({
  region: { position: 'absolute', left: VIEWPORT_OFFSET, right: VIEWPORT_OFFSET, zIndex: 1000 },
  row: { position: 'absolute', top: 0, left: 0, right: 0 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
  },
  words: { flex: 1, gap: 3 },
  title: { fontFamily: FontFamily.bold, fontSize: 14, lineHeight: 19 },
  description: { fontFamily: FontFamily.medium, fontSize: 13, lineHeight: 18 },
  action: { paddingVertical: 7, paddingHorizontal: 13, borderRadius: 10 },
  actionLabel: { fontFamily: FontFamily.bold, fontSize: 13, lineHeight: 17 },
});
