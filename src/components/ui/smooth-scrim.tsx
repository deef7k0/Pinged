import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { withAlpha } from '@/constants/theme';
import { smoothScrimStops } from '@/lib/scrim';

const STOPS = smoothScrimStops();
const LOCATIONS = STOPS.locations as unknown as readonly [number, number, ...number[]];

/**
 * Artwork melting into the page: SimpMusic's `artworkScrimBrush`.
 *
 * A vertical ramp from `color` at no opacity to `color`, eased by smoothstep
 * over 25 stops so it is flat at both ends — the collection header and the
 * studio banner lay it over the bottom 70% of their artwork, where the page
 * colour takes over. Every stop is the page colour at an explicit alpha, never
 * `'transparent'`, which Android's gradient fades through black.
 *
 * Positioned by the caller (`style`); draws nothing it can be touched through.
 */
export function SmoothScrim({ color, style }: { color: string; style?: StyleProp<ViewStyle> }) {
  const colors = useMemo(
    () =>
      STOPS.alphas.map((alpha) => withAlpha(color, alpha)) as unknown as readonly [
        string,
        string,
        ...string[],
      ],
    [color]
  );

  return (
    <LinearGradient colors={colors} locations={LOCATIONS} style={style} pointerEvents="none" />
  );
}
