import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/*
 * reacticx's tray (`organisms/tray`, MIT): its springs, sizes and drag rules,
 * restated here and in `<SlideUpSheet>` (which is the same object for a
 * screen-sized sheet).
 */
const PRESENT_SPRING = { damping: 30, stiffness: 280, mass: 0.9 } as const;
const RETURN_SPRING = { damping: 26, stiffness: 300, mass: 0.9 } as const;
const FALL_MS = 220;
const DISMISS_AT = 96;
const DISMISS_VELOCITY = 900;
const PROJECTION = 0.35;
const RADIUS = 38;
const SIDE = 10;
const FOOT = 12;
const START_SCALE = 0.9;
/** How far below its rest the tray starts, past its own height (`travelPadding`). */
const TRAVEL_PADDING = 56;
/** The backdrop thins to this share as the tray is dragged away. */
const BACKDROP_FALLOFF = 0.45;

function rubberBand(distance: number, dimension: number, factor = 0.55): number {
  'worklet';
  const d = Math.max(dimension, 1);
  return (1 - 1 / ((distance * factor) / d + 1)) * d;
}

export type TrayProps = {
  visible: boolean;
  onClose: () => void;
  /** Runs each time it opens, as `Modal`'s `onShow` did. */
  onShow?: () => void;
  /** The tallest it may be, as a share of the display. 0.8 by default. */
  maxHeightRatio?: number;
  children: ReactNode;
};

/**
 * A small sheet over the page: reacticx's tray (the owner's, 2026-11-02:
 * "Make the trays/sheets in the app like this"). A card floating 10 in from
 * the sides and above the system inset, 38 round, as tall as what is in it;
 * it rises from below and grows from 0.9, and is dragged away by its handle,
 * a flick and a long drag deciding alike (the release is projected a third
 * of a second ahead). Past the top it rubber-bands.
 *
 * The drag is on the handle, not the card: a tray holds lists, and a pan on
 * the whole card would argue with their scroll (`<SlideUpSheet>`'s reason).
 * The caller draws everything inside, its own heading and close key included.
 */
export function Tray({ visible, onClose, onShow, maxHeightRatio = 0.8, children }: TrayProps) {
  const [mounted, setMounted] = useState(visible);
  /* Stable, so the open/close effect below runs on `visible` alone. */
  const gone = useCallback(() => setMounted(false), []);
  /* Mount when asked to open; stay mounted while it falls. */
  if (visible && !mounted) setMounted(true);
  if (!mounted) return null;
  return (
    <OpenTray
      visible={visible}
      onClose={onClose}
      onShow={onShow}
      onGone={gone}
      maxHeightRatio={maxHeightRatio}>
      {children}
    </OpenTray>
  );
}

function OpenTray({
  visible,
  onClose,
  onShow,
  onGone,
  maxHeightRatio,
  children,
}: TrayProps & { onGone: () => void; maxHeightRatio: number }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screen } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const travel = screen * maxHeightRatio + TRAVEL_PADDING;
  /** Distance below its rest, in dp. `travel` is gone. */
  const offset = useSharedValue(reduceMotion ? 0 : travel);

  useEffect(() => {
    if (visible) {
      offset.set(reduceMotion ? 0 : withSpring(0, PRESENT_SPRING));
      return;
    }
    if (reduceMotion) {
      offset.set(travel);
      onGone();
      return;
    }
    offset.set(
      withTiming(travel, { duration: FALL_MS, easing: Easing.in(Easing.cubic) }, (done) => {
        'worklet';
        if (done) runOnJS(onGone)();
      })
    );
  }, [visible, offset, reduceMotion, travel, onGone]);

  const drag = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .failOffsetX([-14, 14])
    .onUpdate((event) => {
      'worklet';
      offset.set(
        event.translationY > 0 ? event.translationY : -rubberBand(-event.translationY, travel)
      );
    })
    .onEnd((event) => {
      'worklet';
      const projected = event.translationY + event.velocityY * PROJECTION;
      if (
        projected > DISMISS_AT ||
        (event.velocityY > DISMISS_VELOCITY && event.translationY > 0)
      ) {
        runOnJS(onClose)();
        return;
      }
      offset.set(withSpring(0, { ...RETURN_SPRING, velocity: event.velocityY }));
    });

  const trayStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: offset.get() },
      {
        scale: reduceMotion ? 1 : interpolate(offset.get(), [0, travel], [1, START_SCALE], 'clamp'),
      },
    ],
    opacity: reduceMotion ? interpolate(offset.get(), [0, travel], [1, 0], 'clamp') : 1,
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity:
      interpolate(offset.get(), [0, travel], [1, 0], 'clamp') *
      interpolate(offset.get(), [0, travel], [1, BACKDROP_FALLOFF], 'clamp'),
  }));

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onShow={onShow}
      onRequestClose={onClose}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: withAlpha(theme.shadowInk, 0.55) },
          backdropStyle,
        ]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.tray,
          {
            bottom: Math.max(insets.bottom, FOOT),
            maxHeight: screen * maxHeightRatio,
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
          trayStyle,
        ]}>
        <GestureDetector gesture={drag}>
          <View style={styles.handleArea} accessibilityElementsHidden>
            <View style={[styles.handle, { backgroundColor: theme.borderStrong }]} />
          </View>
        </GestureDetector>
        {children}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tray: {
    position: 'absolute',
    left: SIDE,
    right: SIDE,
    borderRadius: RADIUS,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    boxShadow: '0px 6px 12px rgba(0, 0, 0, 0.18)',
  },
  /* reacticx's handle: 38 × 5, 10 from the top and 2 under. Tall enough to
     take a thumb. */
  handleArea: { alignItems: 'center', paddingTop: 10, paddingBottom: 8 },
  handle: { width: 38, height: 5, borderRadius: 3 },
});
