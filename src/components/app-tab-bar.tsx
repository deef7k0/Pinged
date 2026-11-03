import type { Tabs } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MINI_PLAYER_FOOTPRINT } from '@/constants/player';
import { FontFamily, MaxContentWidth, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMiniPlayerActive } from '@/store/player';

export type AppTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/*
 * expo-glass-tabs (davidmokos/expo-glass-tabs, MIT), measured from its
 * `glass-tab-bar.tsx`: a floating pill 12 from the sides, 58 tall with icons
 * and words, 44 and 34 further in at each side once minimized; a highlight
 * that slides between tabs; a 21dp glyph over a 9.5 word.
 */
const EXPANDED_HEIGHT = 58;
const MINIMIZED_HEIGHT = 44;
const MINIMIZED_INSET = 34;
const BAR_MARGIN = 12;
const ROW_PAD_H = 4;
const ICON_SIZE = 21;
const ITEM_GAP = 2;
const LABEL_HEIGHT = 13;
const LABEL_BLOCK = LABEL_HEIGHT + ITEM_GAP;
const ITEM_PAD_V = 7;
const HIGHLIGHT_EXPANDED = ICON_SIZE + LABEL_BLOCK + ITEM_PAD_V * 2;
const HIGHLIGHT_MINIMIZED = ICON_SIZE + ITEM_PAD_V * 2;
/** How far the fade under the bar reaches above it. */
const BLUR_BLEED = 44;
/** The highlight's slide: interruptible, a touch under-damped (transform only). */
const SLIDE_SPRING = { duration: 420, dampingRatio: 0.82 } as const;
/** Minimizing: critically damped, so a scroll that turns round never overshoots. */
const MINIMIZE_SPRING = { duration: 380, dampingRatio: 1 } as const;
/** The space between the bar's top and what rests over it. */
const ABOVE = 8;

/** Where the bar sits over the system inset: the package's `bottomOffset`. */
function barOffset(insetBottom: number): number {
  return Math.max(insetBottom - 16, 12);
}

type MinimizeState = { progress: SharedValue<number>; target: SharedValue<number> };

const MinimizeContext = createContext<MinimizeState | null>(null);
const TabBarClearanceContext = createContext(0);

/** Retarget the minimize spring, only when the target changes. Either thread. */
function setMinimized(state: MinimizeState, next: 0 | 1) {
  'worklet';
  if (state.target.get() !== next) {
    state.target.set(next);
    state.progress.set(withSpring(next, MINIMIZE_SPRING));
  }
}

/**
 * How much of the bottom of a tab's screen the floating bar covers: the bar,
 * where it floats over the system inset, and — while music is kept playing —
 * the mini player resting over it. A tab's scroll content ends by this. Zero
 * outside the tab navigator.
 */
export function useTabBarClearance(): number {
  return useContext(TabBarClearanceContext);
}

/**
 * How far the mini player rises, while a tab is in front, to rest over the
 * bar instead of on it — measured from where it rests on its own (the
 * system inset).
 */
export function useTabBarFootprint(): number {
  const insets = useSafeAreaInsets();
  return barOffset(insets.bottom) + EXPANDED_HEIGHT + ABOVE / 2 - insets.bottom;
}

/** Wraps the tab navigator: the clearance, and the bar's minimize state. */
export function TabBarClearanceProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const miniPlayer = useMiniPlayerActive() ? MINI_PLAYER_FOOTPRINT : 0;
  const progress = useSharedValue(0);
  const target = useSharedValue(0);
  const minimize = useMemo(() => ({ progress, target }), [progress, target]);
  return (
    <MinimizeContext.Provider value={minimize}>
      <TabBarClearanceContext.Provider
        value={barOffset(insets.bottom) + EXPANDED_HEIGHT + ABOVE + miniPlayer}>
        {children}
      </TabBarClearanceContext.Provider>
    </MinimizeContext.Provider>
  );
}

/**
 * The bar's minimize-on-scroll, fed by a page's scroll offset — `<Screen>`
 * calls it with its `scrollY`, so every tab page that scrolls drives it and
 * none of them knows. Down minimizes, up (or near the top) expands; offsets
 * past the end are ignored, so an overscroll cannot flicker it. Nothing
 * outside the tab navigator.
 */
export function useMinimizeOnScroll(scrollY: SharedValue<number>) {
  const state = useContext(MinimizeContext);
  useAnimatedReaction(
    () => scrollY.get(),
    (y, previous) => {
      if (!state) return;
      const before = previous ?? y;
      const dy = y - before;
      if (y < 24) setMinimized(state, 0);
      else if (dy > 3) setMinimized(state, 1);
      else if (dy < -3) setMinimized(state, 0);
    },
    [state]
  );
}

/**
 * Whether the software keyboard is up, on Android only. Android resizes the
 * window for it, so a bar pinned to the bottom would ride up onto it.
 */
export function useKeyboardShown(): boolean {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', () => setShown(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setShown(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return shown;
}

/**
 * The bottom navigation: expo-glass-tabs' floating glass bar (the owner's,
 * 2026-11-02: "Make the navigation bar like this", Revolut's bar as the
 * package rebuilds it).
 *
 * - **A pill floating over the page**, 12 from the sides, with a fade rising
 *   from the foot of the screen behind it (blurred too, on iOS).
 * - **A highlight that slides** between the tabs on an interruptible spring;
 *   the glyph under it lights, crossfading to its filled form.
 * - **Minimized by scrolling down** — the pill shrinks in both dimensions and
 *   the words fold away, every glyph still there — and back by scrolling up
 *   or touching it.
 * - **Drag along it to scrub**: the highlight follows the finger, a tick at
 *   each tab, and the tab is opened on release, so the screen never jumps
 *   under the finger.
 *
 * Its glass is the package's solid fallback — what it draws on Android and
 * before iOS 26: `UIGlassEffect` is iOS 26's alone, and `expo-glass-effect`
 * is a native module this build does not link. The words and glyph are white
 * when chosen, as the package draws them; the house blue had been the bar's
 * selection colour since it was a capsule.
 */
export function AppTabBar({ state, descriptors, navigation }: AppTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const keyboardShown = useKeyboardShown();
  const minimize = useContext(MinimizeContext);
  const fallbackProgress = useSharedValue(0);
  const progress = minimize?.progress ?? fallbackProgress;

  const routes = state.routes;
  const tabCount = Math.max(routes.length, 1);
  const width = Math.min(windowWidth, MaxContentWidth);
  const slideIndex = useSharedValue(state.index);
  const isDragging = useSharedValue(false);
  const lastTicked = useSharedValue(-1);

  const tints = useMemo(
    () => ({
      active: theme.white,
      inactive: theme.textSecondary,
      highlight: withAlpha(theme.white, 0.14),
      glass: withAlpha(theme.surface, 0.94),
    }),
    [theme]
  );

  /* The tab in front moved — a tap, a back gesture, a deep link: the
     highlight follows and the bar opens. Never while a finger is scrubbing. */
  useEffect(() => {
    if (!isDragging.get()) slideIndex.set(withSpring(state.index, SLIDE_SPRING));
    if (minimize) setMinimized(minimize, 0);
  }, [state.index, slideIndex, isDragging, minimize]);

  const select = useCallback(
    (index: number) => {
      const route = routes[index];
      if (!route) return;
      const focused = index === state.index;
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
      if (focused) slideIndex.set(withSpring(index, SLIDE_SPRING));
    },
    [routes, state.index, navigation, slideIndex]
  );

  const tick = useCallback(() => {
    if (Platform.OS === 'ios') Haptics.selectionAsync().catch(() => {});
  }, []);

  const indexAtX = (x: number, minimized: number) => {
    'worklet';
    const side = interpolate(minimized, [0, 1], [0, MINIMIZED_INSET], Extrapolation.CLAMP);
    const barWidth = width - BAR_MARGIN * 2 - side * 2;
    const itemWidth = (barWidth - ROW_PAD_H * 2) / tabCount;
    const raw = (x - ROW_PAD_H) / itemWidth - 0.5;
    return Math.min(Math.max(raw, 0), tabCount - 1);
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .failOffsetY([-14, 14])
    .onStart(() => {
      'worklet';
      isDragging.set(true);
      lastTicked.set(Math.round(slideIndex.get()));
      if (minimize) setMinimized(minimize, 0);
    })
    .onUpdate((event) => {
      'worklet';
      const index = indexAtX(event.x, progress.get());
      slideIndex.set(index);
      const rounded = Math.round(index);
      if (rounded !== lastTicked.get()) {
        lastTicked.set(rounded);
        runOnJS(tick)();
      }
    })
    .onFinalize(() => {
      'worklet';
      if (!isDragging.get()) return;
      const rounded = Math.round(slideIndex.get());
      slideIndex.set(withSpring(rounded, SLIDE_SPRING));
      isDragging.set(false);
      runOnJS(select)(rounded);
    });

  const tap = Gesture.Tap()
    .maxDistance(16)
    .maxDuration(400)
    .onEnd((event, success) => {
      'worklet';
      if (!success) return;
      const index = Math.round(indexAtX(event.x, progress.get()));
      slideIndex.set(withSpring(index, SLIDE_SPRING));
      if (minimize) setMinimized(minimize, 0);
      runOnJS(select)(index);
    });

  const gesture = Gesture.Race(pan, tap);

  const barStyle = useAnimatedStyle(() => ({
    height: interpolate(
      progress.get(),
      [0, 1],
      [EXPANDED_HEIGHT, MINIMIZED_HEIGHT],
      Extrapolation.CLAMP
    ),
    marginHorizontal: interpolate(
      progress.get(),
      [0, 1],
      [0, MINIMIZED_INSET],
      Extrapolation.CLAMP
    ),
  }));

  const shapeStyle = useAnimatedStyle(() => ({
    borderRadius:
      interpolate(
        progress.get(),
        [0, 1],
        [EXPANDED_HEIGHT, MINIMIZED_HEIGHT],
        Extrapolation.CLAMP
      ) / 2,
  }));

  const highlightStyle = useAnimatedStyle(() => {
    const barHeight = interpolate(
      progress.get(),
      [0, 1],
      [EXPANDED_HEIGHT, MINIMIZED_HEIGHT],
      Extrapolation.CLAMP
    );
    const height = interpolate(
      progress.get(),
      [0, 1],
      [HIGHLIGHT_EXPANDED, HIGHLIGHT_MINIMIZED],
      Extrapolation.CLAMP
    );
    const side = interpolate(progress.get(), [0, 1], [0, MINIMIZED_INSET], Extrapolation.CLAMP);
    const barWidth = width - BAR_MARGIN * 2 - side * 2;
    const itemWidth = (barWidth - ROW_PAD_H * 2) / tabCount;
    return {
      height,
      width: itemWidth,
      borderRadius: height / 2,
      top: (barHeight - height) / 2,
      transform: [{ translateX: ROW_PAD_H + itemWidth * slideIndex.get() }],
    };
  });

  if (keyboardShown) return null;

  const bottom = barOffset(insets.bottom);

  return (
    <View pointerEvents="box-none" style={styles.layer} accessibilityRole="tablist">
      {/* The page dissolving under the bar: the package's progressive blur
          (stacked thin blurs) on iOS, and its soft black ramp everywhere. */}
      <View
        pointerEvents="none"
        style={[styles.fade, { height: bottom + EXPANDED_HEIGHT + BLUR_BLEED }]}>
        {Platform.OS === 'ios' &&
          FADE_LAYERS.map((height, index) => (
            <BlurView
              key={index}
              tint="dark"
              intensity={5}
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height }}
            />
          ))}
        <View style={[StyleSheet.absoluteFill, { experimental_backgroundImage: FADE_RAMP }]} />
      </View>

      <View
        pointerEvents="box-none"
        style={{
          marginHorizontal: BAR_MARGIN,
          marginBottom: bottom,
          alignSelf: 'center',
          width: width - BAR_MARGIN * 2,
        }}>
        <GestureDetector gesture={gesture}>
          <Animated.View style={barStyle}>
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: tints.glass,
                  borderColor: withAlpha(theme.white, 0.08),
                  borderWidth: StyleSheet.hairlineWidth,
                  borderCurve: 'continuous',
                },
                shapeStyle,
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.highlight,
                { backgroundColor: tints.highlight, borderCurve: 'continuous' },
                highlightStyle,
              ]}
            />
            <View style={styles.row}>
              {routes.map((route, index) => {
                const { options } = descriptors[route.key];
                const label =
                  typeof options.tabBarLabel === 'string'
                    ? options.tabBarLabel
                    : (options.title ?? route.name);
                return (
                  <GlassTab
                    key={route.key}
                    index={index}
                    focused={index === state.index}
                    label={label}
                    accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                    renderIcon={(focused, color) =>
                      options.tabBarIcon?.({ focused, color, size: ICON_SIZE })
                    }
                    slideIndex={slideIndex}
                    progress={progress}
                    tints={tints}
                    onPress={() => {
                      if (minimize) setMinimized(minimize, 0);
                      select(index);
                    }}
                  />
                );
              })}
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
}

/** The package's progressive blur: ten thin layers, each a little shorter. */
const FADE_LAYERS = [
  '100%',
  '88%',
  '76%',
  '64%',
  '54%',
  '44%',
  '36%',
  '28%',
  '22%',
  '16%',
] as const;
const FADE_RAMP =
  'linear-gradient(to top, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0.32) 42%, rgba(0,0,0,0.08) 68%, rgba(0,0,0,0) 88%)';

/** One tab: its glyph (lit as the highlight passes over it) and its word, which folds away when minimized. */
function GlassTab({
  index,
  focused,
  label,
  accessibilityLabel,
  renderIcon,
  slideIndex,
  progress,
  tints,
  onPress,
}: {
  index: number;
  focused: boolean;
  label: string;
  accessibilityLabel: string;
  renderIcon: (focused: boolean, color: string) => ReactNode;
  slideIndex: SharedValue<number>;
  progress: SharedValue<number>;
  tints: { active: string; inactive: string };
  onPress: () => void;
}) {
  /* What the highlight is over lights up — live while scrubbing, travelling on a tap. */
  const activeStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(Math.abs(slideIndex.get() - index), 1),
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 0.4], [1, 0], Extrapolation.CLAMP),
    color: interpolateColor(
      Math.min(Math.abs(slideIndex.get() - index), 1),
      [0, 1],
      [tints.active, tints.inactive]
    ),
  }));

  /* The box's height animated explicitly, so the glyph stays centred every frame. */
  const boxStyle = useAnimatedStyle(() => ({
    height: interpolate(
      progress.get(),
      [0, 1],
      [HIGHLIGHT_EXPANDED, HIGHLIGHT_MINIMIZED],
      Extrapolation.CLAMP
    ),
  }));

  return (
    /* The bar's gesture takes the touches; this still answers a screen
       reader's activation and a keyboard. */
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={styles.tab}>
      <Animated.View style={[styles.box, boxStyle]}>
        <View>
          {renderIcon(false, tints.inactive)}
          <Animated.View style={[styles.activeGlyph, activeStyle]}>
            {renderIcon(true, tints.active)}
          </Animated.View>
        </View>
        <Animated.Text numberOfLines={1} style={[styles.label, labelStyle]}>
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  highlight: { position: 'absolute', left: 0 },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: ROW_PAD_H },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  box: { alignSelf: 'stretch', alignItems: 'center', paddingTop: ITEM_PAD_V, overflow: 'hidden' },
  activeGlyph: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 9.5,
    lineHeight: LABEL_HEIGHT,
    fontFamily: FontFamily.semibold,
    marginTop: ITEM_GAP,
  },
});
