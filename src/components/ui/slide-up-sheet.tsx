import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

import { IconButton } from '@/components/ui/icon-button';
import { Text } from '@/components/ui/text';
import { Spacing, TapTarget, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/*
 * reacticx's tray (`organisms/tray`, MIT), read from its source: a card that
 * floats 10 in from the sides and above the system inset, 38 round, rising
 * from below as it grows from 0.9 to full size on a spring of 280 / 30, its
 * handle 38 × 5. A drag projects the release a third of a second ahead, as
 * iOS does, so a flick and a long drag decide alike; past the top it
 * rubber-bands. The backdrop is black at 55%, and thins as the card is
 * dragged away.
 */
const PRESENT_SPRING = { damping: 30, stiffness: 280, mass: 0.9 } as const;
const RETURN_SPRING = { damping: 26, stiffness: 300, mass: 0.9 } as const;
/** Dismissal is faster than arrival, as an exit always should be. */
const FALL_MS = 220;
/** How far past its rest a release has to land, projected, to dismiss. */
const DISMISS_AT = 96;
/** A flick dismisses from anywhere. dp per second. */
const DISMISS_VELOCITY = 900;
/** How far ahead a release is projected, in seconds (`flickProjection`). */
const PROJECTION = 0.35;
/** The tray's corner, and its distance from the sides and the foot. */
const TRAY_RADIUS = 38;
const TRAY_SIDE = 10;
const TRAY_FOOT = 12;
/** The tray grows from this as it rises. */
const START_SCALE = 0.9;
/** reacticx's `rubberBand`, for a drag past the top. */
function rubberBand(distance: number, dimension: number, factor = 0.55): number {
  'worklet';
  const d = Math.max(dimension, 1);
  return (1 - 1 / ((distance * factor) / d + 1)) * d;
}

export type SlideUpSheetProps = {
  /** Mount and raise it. The caller keeps this in state. */
  visible: boolean;
  onClose: () => void;
  /** Shown in the grabber row, beside the close control. */
  title?: string;
  /**
   * Cap the sheet at a fraction of the display instead of filling it.
   *
   * Omit for the full-screen behaviour every existing caller relies on. Pass
   * `0.5` for a sheet that is a *picker* rather than a screen — a short list of
   * choices does not need the whole display, and covering the page for four
   * buttons hides the thing those buttons re-draw.
   *
   * The travel distance stays the window height either way, so a dismissed sheet
   * is still fully off-screen and the drag still feels the same; only the
   * resting height changes.
   */
  maxHeightRatio?: number;
  /**
   * A surface of the sheet's own: a ramp from its top colour to its foot's,
   * in place of the page's. For a sheet that belongs to one thing — the share
   * sheet is tinted from the game, as SimpMusic tints its lyrics sheet from the
   * song. Both stops must be dark: the handle, the title and the close key are
   * the app's light ink.
   */
  surface?: readonly [string, string];
  children: ReactNode;
};

/**
 * A screen that rises over the one beneath it.
 *
 * The music-player pattern: it comes up from the bottom, settles full-screen,
 * and is pulled back down by its own top edge. The page underneath never
 * unmounts, so dismissing it is a reveal rather than a navigation — which is the
 * entire reason this is a sheet and not a route.
 *
 * ## What the gesture is attached to
 *
 * The grabber, not the whole sheet. The body scrolls, and a pan on the container
 * would have to negotiate with that scroll on every drag — the well-known
 * failure where a sheet dismisses when you meant to scroll its content. Giving
 * the drag its own 44dp handle at the top removes the negotiation entirely: the
 * two gestures never occupy the same pixels.
 *
 * ## Reduce Motion
 *
 * The slide becomes a crossfade and the drag still works. Movement is what the
 * setting asks to be spared, not control — a sheet you cannot pull down because
 * you asked for less animation would be answering an accessibility preference by
 * removing an affordance.
 *
 * ## Open is a React fact, not only an animated one
 *
 * The sheet is mounted fresh each time it opens (`<OpenSheet>`), so its first
 * render is always off-screen — and Reanimated keeps an animated style's first
 * render as the view's React props. Once the rise settles, `settled` adds the
 * resting pose as a plain style. Without it, a JS stall as the sheet settled
 * could drop the animated end value and the next re-render would put the sheet
 * back off-screen: the quick-log sheet "closed itself" a second after opening,
 * exactly when its game and your log arrived and re-rendered it. See
 * `useLandingArrival` for the mechanism.
 */
export function SlideUpSheet(props: SlideUpSheetProps) {
  if (!props.visible) return null;
  return <OpenSheet {...props} />;
}

function OpenSheet({ onClose, title, maxHeightRatio, surface, children }: SlideUpSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  /** Distance below its resting place, in dp. `height` is fully dismissed. */
  const offset = useSharedValue(reduceMotion ? 0 : height);
  /** The rise is over and the sheet is at rest — see the note above. */
  const [settled, setSettled] = useState(reduceMotion);

  /* Rises on mount, and again if the window changes height while open (a
     keyboard on Android resizes it). */
  useEffect(() => {
    if (reduceMotion) {
      offset.set(0);
      return;
    }
    offset.set(
      withSpring(0, PRESENT_SPRING, (finished) => {
        if (finished) runOnJS(setSettled)(true);
      })
    );
  }, [height, offset, reduceMotion]);

  /* `settled` is left as it is: the fall animates over it, and the sheet
     unmounts the moment it lands. */
  function dismiss() {
    if (reduceMotion) {
      offset.set(height);
      onClose();
      return;
    }
    offset.set(
      withTiming(height, { duration: FALL_MS, easing: Easing.in(Easing.cubic) }, (finished) => {
        'worklet';
        if (finished) runOnJS(onClose)();
      })
    );
  }

  const drag = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onUpdate((event) => {
      'worklet';
      /* Down follows the finger exactly; up rubber-bands, because there is
         nothing above the tray to reveal. */
      offset.set(
        event.translationY > 0 ? event.translationY : -rubberBand(-event.translationY, height)
      );
    })
    .onEnd((event) => {
      'worklet';
      const projected = event.translationY + event.velocityY * PROJECTION;
      const flicked = event.velocityY > DISMISS_VELOCITY && event.translationY > 0;

      if (projected > DISMISS_AT || flicked) {
        runOnJS(dismiss)();
        return;
      }
      offset.set(withSpring(0, { ...RETURN_SPRING, velocity: event.velocityY }));
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: offset.get() },
      {
        scale: reduceMotion ? 1 : interpolate(offset.get(), [0, height], [1, START_SCALE], 'clamp'),
      },
    ],
    /* Under Reduce Motion the sheet does not travel, so opacity is the only
       thing left to carry the transition. */
    opacity: reduceMotion ? interpolate(offset.get(), [0, height], [1, 0], 'clamp') : 1,
  }));

  /* The page beneath darkens as the sheet rises and comes back as it falls, so
     the two read as one surface moving rather than two crossfading. */
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(offset.get(), [0, height], [1, 0], 'clamp'),
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: withAlpha(theme.shadowInk, 0.55) },
          scrimStyle,
          settled && styles.scrimSettled,
        ]}
        pointerEvents="none"
      />

      <Animated.View
        style={[
          styles.sheet,
          /* Capped: `top: 'auto'` releases the top offset so `height` governs,
             and the safe-area inset is dropped — a sheet that stops short of the
             status bar has no reason to pad for it. */
          { bottom: Math.max(insets.bottom, TRAY_FOOT) },
          maxHeightRatio
            ? { height: height * maxHeightRatio, top: 'auto' as const }
            : { top: insets.top + TRAY_SIDE },
          { backgroundColor: surface?.[1] ?? theme.background, borderColor: theme.border },
          sheetStyle,
          settled && styles.sheetSettled,
        ]}>
        {surface && (
          <LinearGradient
            colors={[surface[0], surface[1]]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        )}
        <GestureDetector gesture={drag}>
          <View style={styles.grabRow}>
            {/* The handle. Centred and the full width of the row, so the drag
                target is the whole top edge rather than the 36dp bar drawn in
                it — the bar is the *sign*, not the hit area. */}
            <View style={[styles.grabber, { backgroundColor: theme.borderStrong }]} />

            {title && (
              <Text variant="h5" numberOfLines={1} style={styles.grabTitle}>
                {title}
              </Text>
            )}

            {/* A round key, like every other close in the app. The box around it
                keeps the old 44/48 footprint at the row's edge. */}
            <View style={styles.close}>
              <IconButton
                icon="chevron-down"
                accessibilityLabel="Close"
                size="small"
                onPress={dismiss}
              />
            </View>
          </View>
        </GestureDetector>

        <View style={styles.body}>{children}</View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* The tray: a card floating over the page on every side — reacticx's
     10 from the sides, 38 round, a hairline all round. `top` and `bottom`
     are set inline (the status bar's inset, the system's). */
  sheet: {
    position: 'absolute',
    left: TRAY_SIDE,
    right: TRAY_SIDE,
    borderRadius: TRAY_RADIUS,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  grabRow: {
    height: TapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.x16,
  },
  /* reacticx's handle: 38 × 5, 10 from the top. */
  grabber: { position: 'absolute', top: 10, width: 38, height: 5, borderRadius: 3 },
  grabTitle: { marginTop: Spacing.x8 },
  close: {
    position: 'absolute',
    right: Spacing.x8,
    height: TapTarget,
    width: TapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  /* The animated styles at offset 0: the sheet at rest, the scrim at full. */
  sheetSettled: { transform: [{ translateY: 0 }], opacity: 1 },
  scrimSettled: { opacity: 1 },
});
