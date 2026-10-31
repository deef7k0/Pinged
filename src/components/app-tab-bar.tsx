import type { Tabs } from 'expo-router';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { Keyboard, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressGlyph } from '@/components/ui/press-glyph';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { MINI_PLAYER_FOOTPRINT } from '@/constants/player';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMiniPlayerActive } from '@/store/player';

export type AppTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/*
 * SimpMusic's bottom bar, measured from `AppBottomNavigationBar.kt`. Fixed dp,
 * not the spacing ladder: the bar is the same object on every screen.
 */
/** The capsule's height. */
const BAR_HEIGHT = 64;
/** The sliding indicator's height. */
const INDICATOR_HEIGHT = 56;
/** Between the capsule's edge and its first and last tab. */
const CAPSULE_INSET = 6;
/** No tab is wider than this, so a wide display never stretches them into slabs. */
const MAX_TAB_WIDTH = 96;
/** How long the indicator takes to slide to a newly chosen tab. */
const INDICATOR_MS = 260;
/** The bar's own margins: 16 at the sides, 4 above, 8 above the system inset. */
const SIDE = 16;
const TOP = 4;
const BOTTOM = 8;

/**
 * How much of the display's foot the bar takes above the system's own inset.
 * The mini player rests this far up while a tab is in front, so it sits over
 * the capsule rather than on it.
 */
export const TAB_BAR_FOOTPRINT = TOP + BAR_HEIGHT + BOTTOM;

/**
 * How much of the bottom of a tab's screen the floating bar covers: its own
 * height plus the system navigation area under it — and, while music is being
 * kept playing, the mini player resting over it (`<MiniPlayer>`).
 *
 * The bar is drawn over the page, so a tab's scroll content runs underneath it
 * and needs this much padding at its foot to end above it. Zero anywhere
 * outside the tab navigator — a stack screen pushed over the tabs has no bar —
 * so a shared list (`<GameSearchResults>`, `<ProfileView>`) can read it
 * unconditionally.
 */
const TabBarClearanceContext = createContext(0);

export function useTabBarClearance(): number {
  return useContext(TabBarClearanceContext);
}

/** Wraps the tab navigator, so every tab screen can read `useTabBarClearance`. */
export function TabBarClearanceProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  /* A second floating thing over the foot of every tab: the same padding,
     taller. Tab screens already end their content by this number, so none of
     them learns that a mini player exists. */
  const miniPlayer = useMiniPlayerActive() ? MINI_PLAYER_FOOTPRINT : 0;
  return (
    <TabBarClearanceContext.Provider value={TAB_BAR_FOOTPRINT + insets.bottom + miniPlayer}>
      {children}
    </TabBarClearanceContext.Provider>
  );
}

/**
 * Whether the software keyboard is up, on Android only.
 *
 * Android resizes the window for the keyboard (`softwareKeyboardLayoutMode:
 * 'resize'`), so a bar pinned to the bottom of it would ride up and sit on the
 * keyboard, over the results you are typing for. iOS draws the keyboard over
 * the window, which covers the bar by itself.
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
 * The bottom navigation: a floating capsule of tabs — the owner's reference,
 * SimpMusic, at its dimensions.
 *
 * The capsule is 64 tall and 6 in from its ends; the tab you are on sits in a
 * 56dp indicator one surface step up, which slides to the tab you pick. Each
 * tab is a glyph over its word, as wide as the capsule allows up to 96. The
 * order is the app's own — Home, Search, News, Profile. SimpMusic gives Search
 * a circle of its own beside the capsule; that was tried and taken back, so
 * the four destinations stay one set.
 *
 * ## It floats
 *
 * Positioned over the page rather than below it, with nothing behind the
 * capsule. A tab's content scrolls under the bar and under the system's own
 * navigation keys, so the app runs to the bottom of the display instead of
 * ending in a band of page colour. Tab screens pad their scroll content by
 * `useTabBarClearance()` so the last row still ends above the capsule.
 *
 * The selection colour is the house blue's type twin, never a game's colour, on
 * the glyph and the word.
 */
export function AppTabBar({ state, descriptors, navigation }: AppTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const keyboardShown = useKeyboardShown();

  const routes = state.routes;
  const available = Math.min(windowWidth, MaxContentWidth) - SIDE * 2 - CAPSULE_INSET * 2;
  const tabWidth = Math.min(MAX_TAB_WIDTH, available / Math.max(1, routes.length));

  if (keyboardShown) return null;

  return (
    <View
      accessibilityRole="tablist"
      pointerEvents="box-none"
      style={[styles.bar, { paddingBottom: BOTTOM + insets.bottom }]}>
      <View style={[styles.capsule, { backgroundColor: theme.surface }]}>
        {/*
          The indicator slides by a CSS transition, not a shared value: its
          position is a React prop, so the tab it rests on is always the one
          React thinks is selected. An animated style keeps only its first
          render in React's props and can lose its settled value to a stalled
          JS thread — the game page's buttons did exactly that.
        */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            {
              width: tabWidth,
              backgroundColor: theme.surfaceSelected,
              transform: [{ translateX: state.index * tabWidth }],
              transitionDuration: reduceMotion ? 0 : INDICATOR_MS,
            },
          ]}
        />

        {routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = index === state.index;
          const color = focused ? theme.primaryText : theme.textMuted;
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : (options.title ?? route.name);

          return (
            <PressableScale
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              }}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              scaleTo={0.94}
              style={StyleSheet.flatten([styles.tab, { width: tabWidth }])}>
              {/* The icon wobbles under the finger — Convx's navigation icons
                  (`pressWobble`) — and pops as its tab is chosen. */}
              <PressGlyph pop={focused}>
                {options.tabBarIcon?.({ focused, color, size: 24 })}
              </PressGlyph>
              <Text variant="bodySmall" numberOfLines={1} style={{ color }}>
                {label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* Over the page, at its foot, with no fill of its own: the capsule is the
     only thing drawn, and the page shows around it and under the system keys. */
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: SIDE,
    paddingTop: TOP,
  },
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    paddingHorizontal: CAPSULE_INSET,
  },
  indicator: {
    position: 'absolute',
    left: CAPSULE_INSET,
    top: (BAR_HEIGHT - INDICATOR_HEIGHT) / 2,
    height: INDICATOR_HEIGHT,
    borderRadius: INDICATOR_HEIGHT / 2,
    transitionProperty: 'transform',
    transitionTimingFunction: 'ease-out',
  },
  tab: {
    height: INDICATOR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x4 / 2,
    borderRadius: INDICATOR_HEIGHT / 2,
  },
});
