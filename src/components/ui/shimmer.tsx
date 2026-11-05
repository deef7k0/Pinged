import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { css, useReducedMotion } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';
import { mix } from '@/lib/color';

/**
 * reacticx's shimmer (the owner's, 2026-11-03 — `molecules/Shimmer`, MIT):
 * the block in its flat fill, and a band of light **half the block's width**
 * crossing it left to right on a linear loop — a five-stop gradient, fill →
 * a step lighter → the line → a step lighter → fill, so the band has a soft
 * body and no edge. It enters from just off the left and leaves just off the
 * right, so there is no pause between passes, only the travel.
 *
 * It replaced SimpMusic's `Modifier.shimmer()` (a corner-to-corner sweep the
 * block's own width, a third of each pass off the block). Every placeholder
 * in the app is `<Skeleton>`, which is this, so all of them changed at once.
 *
 * ## Why it runs on the UI thread
 *
 * reacticx animates with React Native's `Animated` and the native driver.
 * This is a **Reanimated CSS animation** — `animationName` on a React prop —
 * declared once and run on the UI thread, so a scrolling or fetching screen
 * neither slows it nor is slowed by it, and it has no end value to lose
 * (§ Gotchas): it never ends, and the pose React holds is the plain fill. The
 * travel is dp from a measured width, for the reason a percentage transform
 * was refused before: a number is a number on both platforms.
 *
 * Still under Reduce Motion, where the block is the flat fill.
 */

/** reacticx's `duration` default. */
export const SHIMMER_MS = 1500;

/** The band's width, as a share of the block's (`waveWidth = width * 0.5`). */
export const SHIMMER_BAND = 0.5;

export type ShimmerProps = {
  /** Rounded with the block it stands in for. */
  radius?: number;
  /** The flat fill. `theme.skeleton` unless a caller is on another surface. */
  color?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * A block of shimmer, sized by its `style` or by the space it is given.
 *
 * `<Skeleton>` is the usual way in; this is for a placeholder that has to be
 * its own shape — a tile, a card, a row of them.
 */
export function Shimmer({ radius = 0, color, style }: ShimmerProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);

  const fill = color ?? theme.skeleton;
  const shoulder = mix(fill, theme.skeletonSweep, 0.45);
  const sweep = useMemo(() => (width > 0 ? travel(width) : null), [width]);

  const onLayout = (event: LayoutChangeEvent) => {
    const measured = Math.round(event.nativeEvent.layout.width);
    setWidth((was) => (was === measured ? was : measured));
  };

  return (
    <View
      /* Hidden from a screen reader: a placeholder has nothing to say, and
         announcing one per row turns a loading list into a wall of noise. */
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={reduceMotion ? undefined : onLayout}
      style={[
        {
          backgroundColor: fill,
          borderRadius: radius,
          borderCurve: 'continuous',
          overflow: 'hidden',
        },
        style,
      ]}>
      {sweep && !reduceMotion && (
        <Animated.View
          style={[
            styles.sweep,
            { width: width * SHIMMER_BAND },
            {
              animationName: sweep,
              animationDuration: SHIMMER_MS,
              animationIterationCount: 'infinite',
              animationTimingFunction: 'linear',
            },
          ]}>
          <LinearGradient
            /* reacticx's dark preset's shape — fill, a step up, the line, a
               step up, fill — in this app's two skeleton tones. The ends are
               the fill, so the band has no edge. */
            colors={[fill, shoulder, theme.skeletonSweep, shoulder, fill]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

/**
 * The sweep for a block this wide. Memoised by the caller, so a list of
 * equal-width placeholders declares one animation and not one each.
 */
function travel(width: number) {
  const band = width * SHIMMER_BAND;
  return css.keyframes({
    from: { transform: [{ translateX: -band }] },
    to: { transform: [{ translateX: width + band }] },
  });
}

const styles = StyleSheet.create({
  sweep: { position: 'absolute', top: 0, bottom: 0, left: 0 },
});
