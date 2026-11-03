import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useScreenChrome } from '@/hooks/use-screen-chrome';

/** How far past the top a pull goes before it focuses the field (reacticx's `pullThreshold`). */
const PULL = 80;

/** Within this of the top, the field is always out. */
const REVEAL_TOP = 12;

/**
 * How far the page must travel one way before the field changes its mind —
 * a deliberate scroll, not a settling list or a resting thumb (it was 24).
 */
const TRAVEL = 56;

/**
 * The fold, each way: eased in and out over 450ms — the owner's "smooth, not
 * instant, not fast, not super slow" (2026-11-02). It was 240ms out, which
 * read as a snap.
 */
const FOLD_MS = 450;
const FOLD_EASING = Easing.inOut(Easing.cubic);

/**
 * Search's field, folding away as the page is read and coming back on the way
 * up — the owner's direction (2026-10-15): "make it so the search bar is hidden
 * when the user scrolls and only the tabs are visible. Simpmusic does this very
 * same thing for their home screen topbar."
 *
 * Read from SimpMusic's `HomeScreen.kt`: its top bar sits in an
 * `AnimatedVisibility(visible = isScrollingUp)` with `expandVertically` /
 * `shrinkVertically`, over the chip row, which never moves. So here: reading
 * down folds the field's height to nothing (the tabs rise into its place and
 * stay), and scrolling back up — or reaching the top — unfolds it. The page
 * has to travel `TRAVEL` one way before the field changes its mind, so a finger
 * resting on the glass does not make it flicker.
 *
 * **Where the offset comes from.** Every list Search can show is the page's
 * scroller (`ui/page-scroll`), which writes its offset to the `scrollY`
 * `<Screen>` publishes; this reads it on the UI thread, so the fold never waits
 * on JavaScript. A list that mounts — another tab, a new query — says it is at
 * its top, which brings the field back.
 *
 * `pinned` holds it out: while the field has the focus there is a keyboard
 * under the reader's thumbs and nothing to hide it for. Under Reduce Motion
 * it folds and unfolds at once. Must be drawn inside `<Screen>`.
 */
export function CollapsingField({
  pinned,
  onPull,
  children,
}: {
  pinned: boolean;
  /**
   * reacticx's scrollable search: pulling the page down past `PULL` focuses
   * the field, which swells a little as it is pulled (1.05 at 120dp). Only
   * where a scroll can go past its top — iOS's bounce; Android's scroller
   * stops at zero, and its pull is the page's refresh.
   */
  onPull?: () => void;
  children: ReactNode;
}) {
  const chrome = useScreenChrome();
  const scrollY = chrome?.scrollY;
  const dragging = chrome?.dragging;
  const reduceMotion = useReducedMotion();
  const duration = reduceMotion ? 0 : FOLD_MS;

  const height = useSharedValue(0);
  const shown = useSharedValue(1);
  const progress = useSharedValue(1);
  const anchor = useSharedValue(0);
  const held = useSharedValue(pinned);

  useEffect(() => {
    held.set(pinned);
    if (pinned && shown.get() === 0) {
      shown.set(1);
      progress.set(withTiming(1, { duration, easing: FOLD_EASING }));
    }
  }, [pinned, held, shown, progress, duration]);

  /*
   * **Nothing changes while a finger is on the page.** The fold moves the
   * list's frame; under a held finger the list reads that as the finger
   * moving, scrolls the other way, and the fold flips back — over and over,
   * from nothing more than a thumb's pulse (the owner's report, 2026-11-02).
   * So the field decides only once the finger is up: on release, and through
   * a fling's coast. The anchor stays where the drag began, so the whole
   * drag's travel counts at release.
   */
  useAnimatedReaction(
    () => ({ y: scrollY?.get() ?? 0, held: (dragging?.get() ?? 0) === 1 }),
    ({ y, held: touching }) => {
      const show = (next: number) => {
        if (shown.get() === next) return;
        shown.set(next);
        progress.set(withTiming(next, { duration, easing: FOLD_EASING }));
      };

      if (held.get()) {
        anchor.set(y);
        show(1);
        return;
      }
      if (touching) return;

      if (y <= REVEAL_TOP) {
        anchor.set(y);
        show(1);
        return;
      }

      const travel = y - anchor.get();
      if (travel > TRAVEL) {
        anchor.set(y);
        show(0);
      } else if (travel < -TRAVEL) {
        anchor.set(y);
        show(1);
      } else if ((shown.get() === 0 && travel > 0) || (shown.get() === 1 && travel < 0)) {
        /* Still going the way it already went: the anchor follows, so turning
           round is measured from where the turn happened. */
        anchor.set(y);
      }
    },
    [duration]
  );

  const pulled = useSharedValue(false);
  useAnimatedReaction(
    () => scrollY?.get() ?? 0,
    (y) => {
      if (!onPull) return;
      if (y < -PULL && !pulled.get()) {
        pulled.set(true);
        runOnJS(onPull)();
      } else if (y >= 0 && pulled.get()) {
        pulled.set(false);
      }
    },
    [onPull]
  );

  /* Bumped every render and read by the style, so a re-render re-sends it —
     the top bar's remedy (`usePulse` in ui/frosted-top-bar). The transform is
     what makes each send differ from the last. */
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.set(pulse.get() + 1);
  });

  const fold = useAnimatedStyle(() => {
    const full = height.get();
    const amount = progress.get();
    const nudge = pulse.get() % 2 === 0 ? 0 : 0.001;
    /* Unmeasured, it is simply as tall as it is. */
    return full > 0
      ? { height: full * amount, opacity: amount, transform: [{ translateY: nudge }] }
      : { opacity: amount, transform: [{ translateY: nudge }] };
  });

  const swell = useAnimatedStyle(() => {
    const pull = Math.max(0, -(scrollY?.get() ?? 0));
    return {
      transform: [{ scale: interpolate(pull, [0, 60, 120], [1, 1.02, 1.05], Extrapolation.CLAMP) }],
    };
  });

  return (
    <Animated.View style={[styles.clip, fold]}>
      {/*
        The field's full height, measured once it is laid out — and only ever
        raised. It used to take every measurement, and one taken while the
        clip was closing (a child giving up height to the shrinking box)
        recorded a few dp as "full": the field then unfolded to those few dp
        and never came back — the likeliest reading of what the owner saw (not
        seen on a device). The content cannot
        shrink (`flexShrink: 0`), and a smaller reading is ignored.
      */}
      <View
        style={styles.content}
        onLayout={(event) => {
          const measured = event.nativeEvent.layout.height;
          if (measured > height.get()) height.set(measured);
        }}>
        <Animated.View style={swell}>{children}</Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  content: { flexShrink: 0 },
});
