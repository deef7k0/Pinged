import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Palette, withAlpha } from '@/constants/theme';
import { sharpCoverUrl } from '@/lib/games/sharp-cover';

/**
 * A cover held — reacticx's matched geometry (`organisms/matched-geometry`,
 * MIT, read from its source), at the owner's direction (2026-11-04: "On long
 * press over any game cover, add this feature… except for headers"): the
 * cover lifts out of its place and grows to the middle of the screen over a
 * blurred page; a tap, back, or a drag of more than `DISMISS` puts it back
 * where it came from, and the page's own cover reappears only when it lands.
 *
 * Its numbers are reacticx's: 500ms on `bezier(0.33, 0.01, 0, 1)` both ways,
 * the cover as large as 80% of the display's width or 60% of its height
 * allows, the backdrop fading with the distance a drag has taken it (to 0.3
 * at 300dp), and 100dp to let go.
 *
 * One host for the app (`<CoverZoomHost>`, in the root layout); `<Poster>`
 * opens it (`openCoverZoom`), measuring itself in the window. A Modal, so it
 * is over every sheet too, and see-through to the status and navigation bars
 * so its coordinates are the window's. On Android a blur needs the page as
 * its target, which a Modal cannot have (CLAUDE.md, gotchas): the backdrop
 * there is the page darkened instead.
 */

export type CoverZoomRequest = {
  /** Who asked: their cover is hidden while it is lifted. */
  token: object;
  uri: string;
  /** The cache key the cover was drawn under, so the copy is drawn from memory. */
  cacheKey?: string;
  /** Where the cover is in the window. */
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  title?: string | null;
};

const DISMISS = 100;
const DRAG_FADE = 300;
const MOTION = { duration: 500, easing: Easing.bezier(0.33, 0.01, 0, 1) };

let current: CoverZoomRequest | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Lift a cover. Ignored while another is lifted. */
export function openCoverZoom(request: CoverZoomRequest): void {
  if (current) return;
  current = request;
  notify();
}

function closeCoverZoom(): void {
  current = null;
  notify();
}

/** Whether this cover is the one lifted — so it hides in its place. */
export function useCoverZoomed(token: object): boolean {
  return useSyncExternalStore(
    subscribe,
    () => current?.token === token,
    () => false
  );
}

export function CoverZoomHost() {
  const request = useSyncExternalStore(
    subscribe,
    () => current,
    () => null
  );
  if (!request) return null;
  /* Keyed by the request, so each lift starts from its own place. */
  return <Lifted key={`${request.x},${request.y},${request.uri}`} request={request} />;
}

function Lifted({ request }: { request: CoverZoomRequest }) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [sharpLoaded, setSharpLoaded] = useState(false);

  /* reacticx's `animateToCenter`: from the cover's centre to the screen's. */
  const dx = screenWidth / 2 - (request.x + request.width / 2);
  const dy = screenHeight / 2 - (request.y + request.height / 2);
  const grow = Math.min((screenWidth * 0.8) / request.width, (screenHeight * 0.6) / request.height);

  const lift = useSharedValue(0);
  const shade = useSharedValue(0);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const closing = useSharedValue(false);

  useEffect(() => {
    if (Platform.OS === 'ios')
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const motion = reduceMotion ? { duration: 0 } : MOTION;
    lift.set(withTiming(1, motion));
    shade.set(withTiming(1, motion));
  }, [lift, shade, reduceMotion]);

  const close = () => {
    if (closing.get()) return;
    closing.set(true);
    const motion = reduceMotion ? { duration: 0 } : MOTION;
    dragX.set(withTiming(0, motion));
    dragY.set(withTiming(0, motion));
    shade.set(withTiming(0, motion));
    lift.set(
      withTiming(0, motion, (finished) => {
        'worklet';
        if (finished) runOnJS(closeCoverZoom)();
      })
    );
  };

  const drag = Gesture.Pan()
    .onUpdate((event) => {
      'worklet';
      if (closing.get()) return;
      dragX.set(event.translationX);
      dragY.set(event.translationY);
      const distance = Math.hypot(event.translationX, event.translationY);
      shade.set(Math.max(0.3, 1 - distance / DRAG_FADE));
    })
    .onEnd((event) => {
      'worklet';
      if (closing.get()) return;
      if (Math.hypot(event.translationX, event.translationY) > DISMISS) {
        runOnJS(close)();
      } else {
        dragX.set(withTiming(0, MOTION));
        dragY.set(withTiming(0, MOTION));
        shade.set(withTiming(1, MOTION));
      }
    });

  const coverStyle = useAnimatedStyle(() => {
    const t = lift.get();
    return {
      transform: [
        { translateX: dx * t + dragX.get() },
        { translateY: dy * t + dragY.get() },
        { scale: 1 + (grow - 1) * t },
      ],
    };
  });
  const shadeStyle = useAnimatedStyle(() => ({ opacity: shade.get() }));

  const sharp = sharpCoverUrl(request.uri);

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={close}>
      {/* A Modal is a window of its own on Android: the app's gesture root
          does not reach it. */}
      <GestureHandlerRootView style={styles.fill}>
        <GestureDetector gesture={drag}>
          <View style={styles.fill}>
            <Animated.View style={[styles.fill, shadeStyle]}>
              <Pressable
                style={styles.fill}
                accessibilityRole="button"
                accessibilityLabel={
                  request.title ? `${request.title}, cover. Tap to put it back.` : 'Put it back'
                }
                onPress={close}>
                {Platform.OS === 'ios' ? (
                  <BlurView intensity={50} tint="dark" style={styles.fill} />
                ) : (
                  <View
                    style={[styles.fill, { backgroundColor: withAlpha(Palette.shadowInk, 0.78) }]}
                  />
                )}
              </Pressable>
            </Animated.View>

            <Animated.View
              pointerEvents="none"
              style={[
                styles.cover,
                {
                  left: request.x,
                  top: request.y,
                  width: request.width,
                  height: request.height,
                  borderRadius: request.radius,
                },
                coverStyle,
              ]}>
              <Image
                source={{ uri: request.uri, cacheKey: request.cacheKey }}
                style={styles.fill}
                contentFit="cover"
                cachePolicy="memory-disk"
                accessibilityIgnoresInvertColors
              />
              {/* The cover at 1080p over it once in: it is drawn several
                  times larger than its slot. */}
              {sharp && sharp !== request.uri && (
                <Image
                  source={{ uri: sharp }}
                  style={[styles.fill, { opacity: sharpLoaded ? 1 : 0 }]}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={200}
                  onLoad={() => setSharpLoaded(true)}
                  accessibilityIgnoresInvertColors
                />
              )}
            </Animated.View>
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  cover: { position: 'absolute', overflow: 'hidden' },
});
