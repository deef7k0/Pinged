import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

/*
 * reacticx's seek bar (`molecules/seek-bar`, MIT — the owner's, 2026-11-03,
 * for scoring a review), as its own demo sets it: no thumb, a track 8 high
 * that swells to three and a half times that while it is held and widens by
 * 5%, a rigid tap of haptics as it is grabbed and let go, and a tap anywhere
 * along it to jump there. Its width is the space it is given, measured,
 * where the reference takes a fixed 300.
 *
 * `.get()` / `.set()` rather than `.value` (CLAUDE.md, the React Compiler's
 * rules), and `runOnJS` where it has `scheduleOnRN`.
 */

const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
export const SEEK_BAR = { height: 8, trackScale: 3.5, containerScale: 1.05 } as const;

export type SeekBarProps = {
  /** 0–1. */
  value: number;
  onValueChange: (value: number) => void;
  /** The filled part. */
  activeColor: string;
  /** The rest of the track. */
  inactiveColor: string;
  height?: number;
  disabled?: boolean;
};

export function SeekBar({
  value,
  onValueChange,
  activeColor,
  inactiveColor,
  height = SEEK_BAR.height,
  disabled = false,
}: SeekBarProps) {
  const [width, setWidth] = useState(0);
  const clamped = Math.max(0, Math.min(1, value));
  const progress = useSharedValue(clamped);
  const active = useSharedValue(false);
  const trackHeight = useSharedValue(height);
  const stretch = useSharedValue(1);

  /* Following the value from outside — a nudge, a clear — unless a finger is on it. */
  useEffect(() => {
    if (!active.get()) progress.set(withTiming(clamped, { duration: 300, easing: EASE }));
  }, [clamped, active, progress]);

  const grow = height * SEEK_BAR.trackScale;
  const at = (x: number) => {
    'worklet';
    return width > 0 ? Math.max(0, Math.min(1, x / width)) : 0;
  };

  const pan = Gesture.Pan()
    .enabled(!disabled && width > 0)
    .minDistance(0)
    .onStart((event) => {
      runOnJS(rigid)();
      active.set(true);
      const next = at(event.x);
      progress.set(next);
      runOnJS(onValueChange)(next);
      trackHeight.set(withSpring(grow));
      stretch.set(withSpring(SEEK_BAR.containerScale));
    })
    .onUpdate((event) => {
      const next = at(event.x);
      progress.set(next);
      runOnJS(onValueChange)(next);
    })
    .onFinalize(() => {
      active.set(false);
      trackHeight.set(withSpring(height));
      stretch.set(withSpring(1));
      runOnJS(rigid)();
    });

  const containerStyle = useAnimatedStyle(() => ({
    height: trackHeight.get(),
    transform: [{ scaleX: stretch.get() }],
  }));
  const fillStyle = useAnimatedStyle(() => ({
    width: Math.max(0, Math.min(width, progress.get() * width)),
  }));

  return (
    <View
      style={[styles.wrapper, { height: grow }]}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}>
      <GestureDetector gesture={pan}>
        <Animated.View style={styles.hit}>
          <Animated.View style={[styles.track, { backgroundColor: inactiveColor }, containerStyle]}>
            <Animated.View style={[styles.fill, { backgroundColor: activeColor }, fillStyle]} />
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function rigid() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => undefined);
}

const styles = StyleSheet.create({
  wrapper: { width: '100%', justifyContent: 'center' },
  hit: { width: '100%', height: '100%', justifyContent: 'center' },
  track: { width: '100%', borderRadius: 2000, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 2000 },
});
