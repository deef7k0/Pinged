import { createContext, useContext, useState, type ReactNode } from 'react';
import { View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cubicBezier,
  measure,
  runOnJS,
  runOnUI,
  useAnimatedReaction,
  useAnimatedRef,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';

import { useScreenChrome } from '@/hooks/use-screen-chrome';
import { SHELF_REVEAL, shelfArrived } from '@/lib/scroll-motion';

/** Whether shelves on this page arrive as they come into view. */
const Scope = createContext(false);
/** Whether this is already inside a shelf that arrives — a shelf arrives once, whole. */
const Inside = createContext(false);

const EASE = cubicBezier(...SHELF_REVEAL.easing);

/**
 * The pages whose shelves arrive as they scroll into view — Apple Music's
 * artist page: a game's Overview, a studio's rails. Everywhere else a shelf is
 * simply there, as it always was; a scope is how a page opts in, so no other
 * screen changes because a primitive it shares learned to do this.
 */
export function RevealScope({ children }: { children: ReactNode }) {
  return <Scope.Provider value>{children}</Scope.Provider>;
}

/** True where a `<Reveal>` would animate: inside a scope, and not inside another. */
export function useRevealing(): boolean {
  const scope = useContext(Scope);
  const inside = useContext(Inside);
  return scope && !inside;
}

/**
 * A shelf that rises into place the first time it scrolls into view: a fade
 * and a 16dp rise on a long, soft landing (`SHELF_REVEAL`).
 *
 * `<Section>`, `<HomeSection>` and `<Panel>` are built on it, so a page's
 * shelves do it without the page wrapping each one — which it could not do
 * without a box of its own round a section that renders nothing, and with it
 * a gap in the page's `gap`. Outside a `<RevealScope>` it is a plain `View`
 * with the same style, and nothing about the layout differs.
 *
 * ## What it never does
 *
 * - **Hide what is on screen.** A shelf is hidden only when its first layout
 *   finds it wholly below the display; one already in sight is simply there.
 *   So opening a page animates nothing, and a page restored half-scrolled
 *   shows what it showed.
 * - **Wait somewhere it has been moved into view.** It re-reads where it is on
 *   every scroll, on its own layout, and when the page reports content moving
 *   without a scroll (`ScreenChrome.layout`: a list growing, a synopsis
 *   closing) — events, never a timer, so a page at rest wakes nothing.
 * - **Lose its end.** The fade is a CSS transition on a React prop, so a
 *   dropped frame cannot leave it at its first value (CLAUDE.md § Gotchas).
 * - **Move under Reduce Motion**: there it is always simply there.
 *
 * A hidden shelf is still in the accessibility tree: a screen reader moving
 * onto it scrolls it into view, and that is a scroll.
 */
export function Reveal({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle> | any;
}) {
  const revealing = useRevealing();
  if (!revealing) return <Animated.View style={style}>{children}</Animated.View>;
  return <Arriving style={style}>{children}</Arriving>;
}

type Phase = 'rest' | 'waiting' | 'arrived';

function Arriving({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle> | any;
}) {
  const chrome = useScreenChrome();
  const reduceMotion = useReducedMotion();
  const { height: viewport } = useWindowDimensions();
  const ref = useAnimatedRef<Animated.View>();
  const [phase, setPhase] = useState<Phase>('rest');

  const waiting = useSharedValue(false);
  const looked = useSharedValue(false);
  const still = useSharedValue(0);
  const scrollY = chrome?.scrollY ?? still;
  const layout = chrome?.layout ?? still;
  const enabled = !!chrome && !reduceMotion;

  /* The page moved — by a thumb, or under one. */
  useAnimatedReaction(
    () => scrollY.get() + layout.get(),
    () => {
      if (!waiting.get()) return;
      const box = measure(ref);
      if (box && shelfArrived(box.pageY, viewport, SHELF_REVEAL.inset)) {
        waiting.set(false);
        runOnJS(setPhase)('arrived');
      }
    },
    [viewport]
  );

  function onLayout() {
    if (!enabled) return;
    runOnUI(() => {
      'worklet';
      const box = measure(ref);
      if (!box) return;
      /* The first look decides whether it waits at all: only wholly below
         the display. */
      if (!looked.get()) {
        looked.set(true);
        if (box.pageY >= viewport) {
          waiting.set(true);
          runOnJS(setPhase)('waiting');
        }
        return;
      }
      if (waiting.get() && shelfArrived(box.pageY, viewport, SHELF_REVEAL.inset)) {
        waiting.set(false);
        runOnJS(setPhase)('arrived');
      }
    })();
  }

  const shown = enabled ? phase : 'rest';
  const hidden = shown === 'waiting';

  return (
    <Animated.View
      ref={ref}
      collapsable={false}
      onLayout={onLayout}
      style={[
        style,
        shown !== 'rest' && {
          opacity: hidden ? 0 : 1,
          transform: [{ translateY: hidden ? SHELF_REVEAL.rise : 0 }],
          transitionProperty: ['opacity', 'transform'],
          /* Hidden at once — it is off the screen — and arriving over the
             reveal's own time. */
          transitionDuration: hidden ? 0 : SHELF_REVEAL.ms,
          transitionTimingFunction: EASE,
        },
      ]}>
      <Inside.Provider value>{children}</Inside.Provider>
    </Animated.View>
  );
}
