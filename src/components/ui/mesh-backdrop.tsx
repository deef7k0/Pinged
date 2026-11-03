import { useIsFocused } from 'expo-router';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { hexToRgb } from '@/lib/color';
import { SKIA_AVAILABLE } from '@/lib/skia-available';

const MeshGradient = SKIA_AVAILABLE
  ? lazy(() => import('@/components/ui/mesh-gradient-skia'))
  : null;

/**
 * How slowly it drifts: a fifth of reacticx's default speed (the owner's
 * "with slow speed").
 */
export const MESH_SPEED = 0.2;

/**
 * reacticx's mesh gradient behind a page, in four of the page's colours (the
 * owner's, 2026-11-02, for a physical copy's page). Pass it to
 * `<Screen backdrop>`. Where the build has no Skia it draws nothing and the
 * page keeps its plain colour.
 *
 * It stops while nobody can see it — another screen in front, the app in the
 * background — and stands still under Reduce Motion.
 */
export function MeshBackdrop({
  colours,
  instant = false,
}: {
  colours: readonly [string, string, string, string];
  /** Already on screen behind the screen before this one — the Cover Flow's hand-off. No fade in. */
  instant?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => sub.remove();
  }, []);

  const [a, b, c, d] = colours;
  const rgb = useMemo(() => {
    const unit = (hex: string) => {
      const value = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
      return { r: value.r / 255, g: value.g / 255, b: value.b / 255 };
    };
    return [unit(a), unit(b), unit(c), unit(d)] as const;
  }, [a, b, c, d]);

  if (!MeshGradient) return null;

  return (
    <Animated.View
      entering={instant ? undefined : FadeIn.duration(600)}
      exiting={FadeOut.duration(300)}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      pointerEvents="none">
      <Suspense fallback={null}>
        <MeshGradient
          colours={rgb}
          speed={MESH_SPEED}
          running={!reduceMotion && focused && foreground}
        />
      </Suspense>
    </Animated.View>
  );
}
