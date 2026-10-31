import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { handoffWeight, pageTitleOpacity } from '@/constants/top-bar';
import { usePulse } from '@/hooks/use-pulse';
import { useScreenChrome } from '@/hooks/use-screen-chrome';

/**
 * A page's own name, on a page with Apple's glass bar: it fades out over the
 * first half of the band where it goes under the bar, and the bar's name comes
 * in over the second (`HANDOFF` in `constants/top-bar`, after FancyScrollView's
 * `HeaderScrollViewTitle`). Pass the band the bar was given.
 *
 * Only the opacity moves — the name still slides with the page, as it always
 * did. It stays the page's heading for a screen reader; the bar's name is
 * hidden from one until it is in.
 *
 * Must be drawn under the page's `<Screen>`, whose scroll it reads. Its style
 * reads `pulse` and carries a transform, so a render re-applies it
 * (CLAUDE.md § Gotchas, the lost end value).
 */
export function HandoffTitle({
  band,
  onHeight,
  style,
  children,
}: {
  band: { from: number; to: number };
  /** The name's measured height — what the page builds the band from. */
  onHeight?: (height: number) => void;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const chrome = useScreenChrome();
  const still = useSharedValue(0);
  const scrollY = chrome?.scrollY ?? still;
  const pulse = usePulse();
  const { from, to } = band;

  const fade = useAnimatedStyle(() => {
    pulse.get();
    return {
      opacity: pageTitleOpacity(handoffWeight(scrollY.get(), from, to)),
      transform: [{ translateY: 0 }],
    };
  });

  return (
    <Animated.View
      style={[style, fade]}
      onLayout={
        onHeight ? (event) => onHeight(Math.round(event.nativeEvent.layout.height)) : undefined
      }>
      {children}
    </Animated.View>
  );
}
