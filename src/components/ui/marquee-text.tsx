import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/text';

/**
 * How long the title holds still at each end of its travel, in ms.
 *
 * A marquee that turns round the instant it arrives is unreadable at exactly the
 * moment it matters — the end of the title is the part you could not see. It
 * rests there for as long as it rested at the start.
 */
const MARQUEE_HOLD = 1400;

/** Scroll speed, in ms per dp. Slow enough to read a proper noun at a glance. */
const MARQUEE_MS_PER_DP = 22;

/** How fast it returns. A snap back, not a second read of the same words. */
const MARQUEE_RETURN_MS = 420;

/**
 * A single line of text that scrolls to reveal its end, then loops.
 *
 * For the one string beside a pair of round actions whose length is not ours: a
 * game's title. "The Legend of Zelda: Tears of the Kingdom" does not fit beside
 * two round buttons at any type size the block can afford, and the alternatives
 * are both worse — wrapping to two lines moves everything under it by a line
 * depending on the game, and truncating loses the half of a subtitle that
 * distinguishes one edition from another.
 *
 * ## How it measures
 *
 * A second, off-screen copy at `left: -9999` inside a 9999dp box, where nothing
 * constrains it, reports its natural width; the visible window reports the space
 * available. The difference is the travel. This is two `onLayout` callbacks
 * rather than an effect — a layout event is an event, so the state it sets is
 * not the setState-in-an-effect the React Compiler rules forbid.
 *
 * ## When it does nothing
 *
 * A title that fits is not animated at all, which is the overwhelming majority
 * of them. Neither is any title under Reduce Motion: a looping horizontal
 * crawl is precisely the vestibular trigger that setting exists for, and the
 * fallback is an ellipsis.
 *
 * Moved out of Surprise Me when the review page took the same title row.
 */
export function MarqueeText({
  text,
  variant,
  accessibilityRole,
  align = 'start',
}: {
  text: string;
  variant: 'h3' | 'h4';
  accessibilityRole?: 'header';
  /**
   * Where a title that fits sits in its window: at the start, or centred —
   * an Apple bar's title, between its controls. One that scrolls always
   * starts at the start, where it begins to read.
   */
  align?: 'start' | 'center';
}) {
  const reduceMotion = useReducedMotion();
  const [boxWidth, setBoxWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);

  const overflow = boxWidth > 0 && textWidth > boxWidth ? Math.ceil(textWidth - boxWidth) : 0;
  const scrolling = overflow > 0 && !reduceMotion;

  const offset = useSharedValue(0);

  useEffect(() => {
    if (!scrolling) {
      offset.set(0);
      return;
    }

    offset.set(0);
    offset.set(
      withRepeat(
        withSequence(
          withDelay(
            MARQUEE_HOLD,
            withTiming(-overflow, {
              duration: overflow * MARQUEE_MS_PER_DP,
              easing: Easing.inOut(Easing.quad),
            })
          ),
          withDelay(
            MARQUEE_HOLD,
            withTiming(0, { duration: MARQUEE_RETURN_MS, easing: Easing.out(Easing.quad) })
          )
        ),
        -1,
        false
      )
    );

    return () => {
      offset.set(0);
    };
  }, [scrolling, overflow, offset]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));

  return (
    <View
      style={styles.marquee}
      onLayout={(event) => setBoxWidth(event.nativeEvent.layout.width)}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={text}>
      {/* The probe. Never seen, never read aloud, never part of the layout. */}
      <View style={styles.probe} pointerEvents="none" accessibilityElementsHidden>
        <Text
          variant={variant}
          numberOfLines={1}
          style={styles.probeText}
          onLayout={(event) => setTextWidth(event.nativeEvent.layout.width)}>
          {text}
        </Text>
      </View>

      <Animated.View style={style}>
        {/* An explicit width when it is scrolling, so the line is laid out at its
            natural size and the window does the cutting. Without it the Text
            truncates itself to the window and there is nothing left to reveal. */}
        <Text
          variant={variant}
          numberOfLines={1}
          style={scrolling ? { width: textWidth } : align === 'center' ? styles.centred : undefined}
          importantForAccessibility="no">
          {text}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* The window the title scrolls inside. `hidden` is the whole mechanism. */
  marquee: { alignSelf: 'stretch', overflow: 'hidden' },
  /* Off-screen twin, measured at its natural width so the marquee knows how far
     it has to travel. `left: -9999` rather than `opacity: 0` — an invisible copy
     still occupies its own line and would double the block's height. */
  probe: { position: 'absolute', left: -9999, top: 0, width: 9999 },
  probeText: { alignSelf: 'flex-start' },
  centred: { textAlign: 'center' },
});
