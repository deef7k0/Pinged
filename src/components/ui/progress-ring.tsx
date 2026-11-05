import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { withAlpha } from '@/constants/theme';

/**
 * A ring that fills clockwise from the top — the Games app's and Fitness'
 * (the Apple pass, 2026-11-05), at 88 by default, with whatever the caller
 * puts in its middle.
 *
 * Drawn with plain views, because the app has no SVG renderer and Skia is
 * reached only lazily: each half of the fill is a semicircular arc (a
 * bordered circle clipped to one half) turned inside a clip of the other
 * half, so it shows from the top to the angle and no further. Exact at every
 * angle; the ends are square, not round.
 */
export function ProgressRing({
  progress,
  size = 88,
  stroke = 9,
  color,
  children,
  accessibilityLabel,
}: {
  /** 0 to 1. */
  progress: number;
  size?: number;
  stroke?: number;
  /** The fill. The accent's colour, usually. */
  color: string;
  children?: ReactNode;
  accessibilityLabel?: string;
}) {
  const half = size / 2;
  const angle = Math.max(0, Math.min(1, progress)) * 360;
  const first = Math.min(angle, 180);
  const second = Math.max(0, angle - 180);
  const ring = { width: size, height: size, borderRadius: half, borderWidth: stroke };

  /* A semicircle of the fill: the circle's `side` half. */
  const arc = (side: 'left' | 'right') => (
    <View style={[styles.clip, { width: half, height: size, left: side === 'left' ? 0 : half }]}>
      <View
        style={[ring, styles.fill, { borderColor: color, left: side === 'left' ? 0 : -half }]}
      />
    </View>
  );

  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      style={{ width: size, height: size }}>
      <View style={[ring, styles.fill, { borderColor: withAlpha(color, 0.22) }]} />
      {first > 0 && (
        /* The right half shows the left arc turned by `first`: top to `first`. */
        <View style={[styles.clip, { width: half, height: size, left: half }]}>
          <View
            style={[
              styles.turn,
              { width: size, height: size, left: -half, transform: [{ rotate: `${first}deg` }] },
            ]}>
            {arc('left')}
          </View>
        </View>
      )}
      {second > 0 && (
        /* The left half shows the right arc turned by `second`: 180 to 180 + it. */
        <View style={[styles.clip, { width: half, height: size, left: 0 }]}>
          <View
            style={[
              styles.turn,
              { width: size, height: size, left: 0, transform: [{ rotate: `${second}deg` }] },
            ]}>
            {arc('right')}
          </View>
        </View>
      )}
      <View style={[styles.fill, styles.centre]} pointerEvents="none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0 },
  clip: { position: 'absolute', top: 0, overflow: 'hidden' },
  turn: { position: 'absolute', top: 0 },
  centre: { right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
