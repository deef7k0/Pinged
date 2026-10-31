import { useEffect, useRef, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { usePressState } from '@/components/ui/press-state';
import { PRESS_MOTION, keyframeSteps } from '@/constants/press-motion';

/** What the glyph does while its control is held. */
export type GlyphMotion = 'wobble' | 'play' | 'skip';

const POP_SCALE = keyframeSteps(PRESS_MOTION.pop.scale);
const POP_BLINK = keyframeSteps(PRESS_MOTION.pop.blink);
/* `likePop`'s curves, step by step: linear, a fast-out swell, a hold, then
   Compose's FastOutSlowIn back. */
const POP_EASINGS = [
  Easing.linear,
  Easing.bezier(0.2, 0.8, 0.3, 1),
  Easing.linear,
  Easing.bezier(0.4, 0, 0.2, 1),
];

/**
 * An icon that answers the control it is in — Convx's (`constants/press-motion`):
 *
 *  - **`wobble`** (the default, `pressWobble`): shrinks to 0.86 while held,
 *    and wobbles back on a loose spring.
 *  - **`play`** (`playGlyphPress`): shrinks toward 0.2 while held, springs back.
 *  - **`skip`** (`skipGlyphPress`): dips while held and, let go, steps 8dp
 *    `direction`-ward and back.
 *  - **`pop`**: a value — on or off — that pops the glyph when it changes
 *    *because the control was pressed* (`likePop`): a change that arrives
 *    with no press behind it (a list loading, another screen's write) is not
 *    somebody's, and does nothing.
 *
 * Wrap the glyph only, inside a `<PressableScale>`; outside one it is a plain
 * view. Under Reduce Motion it never moves — the control still dims.
 *
 * Every animation ends where it began (1, 0, 1), which is also its first
 * render's value: a lost end value (CLAUDE.md § Gotchas) shows the right pose.
 */
export function PressGlyph({
  children,
  motion = 'wobble',
  direction = 1,
  pop,
  style,
}: {
  children: ReactNode;
  motion?: GlyphMotion;
  direction?: 1 | -1;
  pop?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const press = usePressState();
  const reduceMotion = useReducedMotion();
  const still = useSharedValue(0);
  const down = press?.down ?? still;

  const held = useSharedValue(1);
  const step = useSharedValue(0);
  const swell = useSharedValue(1);
  const blink = useSharedValue(1);

  useAnimatedReaction(
    () => down.get(),
    (now, was) => {
      if (reduceMotion || was === null || now === was) return;
      const ease = Easing.bezier(0.4, 0, 0.2, 1);
      if (motion === 'play') {
        const play = PRESS_MOTION.play;
        const spring = { mass: play.mass, stiffness: play.stiffness, damping: play.damping };
        held.set(
          now
            ? withTiming(play.scale, { duration: play.inMs, easing: ease })
            : withSpring(1, spring)
        );
      } else if (motion === 'skip') {
        const skip = PRESS_MOTION.skip;
        const spring = { mass: skip.mass, stiffness: skip.stiffness, damping: skip.damping };
        held.set(withSpring(now ? skip.scale : 1, spring));
        if (!now) {
          step.set(
            withSequence(
              withTiming(1, { duration: skip.peakMs, easing: ease }),
              withTiming(0, { duration: skip.ms - skip.peakMs, easing: ease })
            )
          );
        }
      } else {
        const wobble = PRESS_MOTION.wobble;
        const spring = { mass: wobble.mass, stiffness: wobble.stiffness, damping: wobble.damping };
        held.set(withSpring(now ? wobble.scale : 1, spring));
      }
    },
    [motion, reduceMotion]
  );

  /* The pop, on a change of state somebody pressed for. */
  const previous = useRef(pop);
  useEffect(() => {
    const was = previous.current;
    previous.current = pop;
    if (pop === undefined || was === undefined || was === pop || reduceMotion || !press) return;
    if (Date.now() - press.pressedAt.current > PRESS_MOTION.pop.window) return;
    swell.set(
      withSequence(
        withTiming(PRESS_MOTION.pop.scale[0][0], { duration: 0 }),
        ...POP_SCALE.map((s, i) => withTiming(s.to, { duration: s.ms, easing: POP_EASINGS[i] }))
      )
    );
    blink.set(
      withSequence(
        ...POP_BLINK.map((s) => withTiming(s.to, { duration: s.ms, easing: Easing.linear }))
      )
    );
  }, [pop, reduceMotion, press, swell, blink]);

  const animated = useAnimatedStyle(() => ({
    opacity: blink.get(),
    transform: [
      { translateX: step.get() * PRESS_MOTION.skip.nudge * direction },
      { scale: held.get() * swell.get() },
    ],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
