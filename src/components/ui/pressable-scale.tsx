import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type AnimatedStyle,
} from 'react-native-reanimated';

import { PressContext, type PressState } from '@/components/ui/press-state';
import { PRESS_MOTION } from '@/constants/press-motion';
import { Motion } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>> | StyleProp<ViewStyle> | any;
  /** How far to shrink while held. Lower = more pronounced. */
  scaleTo?: number;
  /**
   * The fill while held, eased in from the style's own `backgroundColor`.
   *
   * The press state the music-app controls ask for — a *deeper* surface, not
   * only a smaller one. It rides the same `progress` as the sink, on the UI
   * thread, so the two can never drift apart; and unlike the sink it is not
   * motion, so it runs unchanged under Reduce Motion.
   */
  pressedColor?: string;
  /**
   * Draw a focus ring in this colour while the control has keyboard focus —
   * `accent.ring`, as a rule.
   *
   * A 3dp outline outside the control's own edge, so it never changes the
   * control's size and never hides behind its border. Touch does not focus a
   * view on iOS or Android, so on a phone this appears only for a keyboard or
   * switch-access user, which is exactly who it is for.
   */
  focusRing?: string;
};

/** The focus ring's width, outside the control's edge. */
const RING_WIDTH = 3;

/**
 * How far the control dims while held, when it may not move.
 *
 * The reduced-motion substitute for the sink. Deep enough to be unmistakable on
 * a near-black page, shallow enough that a held button still reads as a button
 * rather than as a disabled one — several controls dim to around 0.45 when
 * disabled, so this deliberately stops short of that.
 */
const PRESSED_OPACITY = 0.62;

/**
 * A Pressable that sinks while held and springs back past where it was —
 * Convx's `bounceClick` (`constants/press-motion`, the owner's of
 * 2026-10-31: "on tap there is always responsiveness"). One spring both ways,
 * Compose's medium-bouncy at medium-low stiffness: it answers the instant a
 * finger lands — it used to ease in over 150ms — and it lands with a small
 * overshoot when the finger lifts. A disabled control does not move.
 *
 * It also tells the glyphs inside it that it is held (`PressContext`), so an
 * icon can wobble, pop or step (`<PressGlyph>`).
 *
 * Runs on the UI thread via Reanimated, so the animation stays smooth even
 * while the JS thread is busy rendering a list — which is exactly when a feed
 * would otherwise feel janky.
 *
 * ## Under Reduce Motion it dims instead of sinking
 *
 * This is the most-used animation in the app — every button, tab, chip, poster
 * and row goes through it — and it was the largest single gap in a claim
 * PRODUCT.md makes: *"motion respects the reduced-motion setting."*
 *
 * **It is not switched off, and that distinction is the whole point.** A scale
 * is spatial movement, which is what the setting asks to be spared; but the
 * press feedback it carries is the only confirmation that a tap registered at
 * all, and removing it would answer an accessibility preference by deleting an
 * accessibility affordance. So the *material* changes and the *meaning* stays:
 * opacity instead of translation, which is exactly the crossfade substitution
 * both platform references prescribe.
 */
export function PressableScale({
  children,
  style,
  scaleTo = Motion.pressScale,
  pressedColor,
  focusRing,
  onPressIn,
  onPressOut,
  onFocus,
  onBlur,
  ...rest
}: PressableScaleProps) {
  const reduceMotion = useReducedMotion();
  const [focused, setFocused] = useState(false);

  /* One value, two materials. `progress` is 0 at rest and 1 while held, so the
     press timing is identical whichever property expresses it — and switching
     between them cannot desynchronise, because there is only one thing moving. */
  const progress = useSharedValue(0);

  /* What the glyphs inside are told (`<PressGlyph>`). */
  const down = useSharedValue(0);
  const pressedAt = useRef(0);
  const press = useMemo<PressState>(() => ({ down, pressedAt }), [down]);

  /*
   * The caller's own opacity, composed rather than overwritten.
   *
   * `opacity` is not a free channel on this component: `<IconButton>` and a
   * dozen screen-local controls express *disabled* partly by flattening an
   * opacity into the style they hand down, and the game page's action row dims
   * the same way while a write is in flight. An animated `opacity` on the root wins over
   * every one of them, so writing a bare `1` here at rest would have made every
   * disabled control in the app look enabled — but only for the people who
   * asked for reduced motion, which is the worst possible audience for it.
   *
   * Flattened in JS, where the style prop actually is, and multiplied in the
   * worklet. A disabled control therefore rests at the caller's value and still
   * dims further if it is somehow pressed.
   */
  const flat = StyleSheet.flatten(style);
  const baseOpacity = flat?.opacity ?? 1;

  /* Same reasoning as the opacity above: the resting fill is the caller's, read
     from the style it passed, so the animated value starts exactly where the
     static one was. Only a plain colour string can be interpolated. */
  const restingColor = typeof flat?.backgroundColor === 'string' ? flat.backgroundColor : null;
  const fillFrom = pressedColor && restingColor ? restingColor : null;

  // `.get()`/`.set()` rather than `.value` — the React Compiler lint rules treat
  // assigning to `.value` as mutating a captured binding. Reanimated added these
  // accessors for exactly this reason; they behave identically.
  const animatedStyle = useAnimatedStyle(() => {
    const held = progress.get();
    const fill =
      fillFrom && pressedColor
        ? { backgroundColor: interpolateColor(held, [0, 1], [fillFrom, pressedColor]) }
        : null;
    return reduceMotion
      ? { ...fill, opacity: Number(baseOpacity) * (1 - held * (1 - PRESSED_OPACITY)) }
      : { ...fill, transform: [{ scale: 1 - held * (1 - scaleTo) }] };
  });

  return (
    <AnimatedPressable
      style={[
        style,
        focusRing && focused
          ? {
              outlineColor: focusRing,
              outlineWidth: RING_WIDTH,
              outlineStyle: 'solid',
              outlineOffset: 0,
            }
          : null,
        animatedStyle,
      ]}
      onPressIn={(event) => {
        progress.set(
          reduceMotion
            ? withTiming(1, { duration: Motion.fast })
            : withSpring(1, PRESS_MOTION.press)
        );
        down.set(1);
        pressedAt.current = Date.now();
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        progress.set(
          reduceMotion
            ? withTiming(0, { duration: Motion.normal })
            : withSpring(0, PRESS_MOTION.press)
        );
        down.set(0);
        onPressOut?.(event);
      }}
      onFocus={(event) => {
        if (focusRing) setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        if (focusRing) setFocused(false);
        onBlur?.(event);
      }}
      {...rest}>
      <PressContext.Provider value={press}>{children}</PressContext.Provider>
    </AnimatedPressable>
  );
}
