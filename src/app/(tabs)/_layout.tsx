import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

import { AppTabBar, TabBarClearanceProvider } from '@/components/app-tab-bar';

/**
 * Bottom navigation. Four tabs, a glyph over a word — drawn by `<AppTabBar>`,
 * expo-glass-tabs' floating glass bar (2026-11-02), over the page. Every tab
 * screen pads its scroll content by `useTabBarClearance()` so it ends above
 * the bar, and the bar minimizes as a tab's page is read downward.
 *
 * Labels are shown, not hidden — until the bar is minimized, when every glyph
 * stays and the words fold away. Five is the ceiling.
 *
 * The chosen tab is white under a sliding highlight, the package's own look;
 * it was the house blue while the bar was SimpMusic's capsule. **The bar
 * never takes a game's colour** — it is the one fixed thing you navigate by.
 *
 * Notifications used to live here; it now opens from an icon in Home's header
 * instead, freeing the slot for News — and News gave it to Pings
 * (2026-10-31), opening from Home's "Latest news" and "Latest events".
 *
 * **There is no composer route any more.** `create` was registered here with
 * `href: null` — in the group, off the bar — and it composed user posts and
 * articles, which the app no longer has. Nothing pushed to it even before that,
 * so the screen and its registration went together.
 */
export default function TabsLayout() {
  return (
    <TabBarClearanceProvider>
      <Tabs
        /*
         * The bar draws itself: the colours, the sizes and the system inset are
         * all `<AppTabBar>`'s, so nothing here styles React Navigation's own.
         */
        tabBar={(props) => <AppTabBar {...props} />}
        screenOptions={{
          // Every tab draws its own `<FrostedTopBar>` — see the root layout for
          // why no screen in this app uses a native header any more. Set once
          // here rather than per screen, which is how `create` ended up with a
          // stock grey bar nobody had asked for.
          headerShown: false,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarAccessibilityLabel: 'Home',
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
            ),
          }}
        />

        {/* What Search showed before anything was typed (the owner's,
            2026-11-03) — Apple TV's Store and Home under it. */}
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Explore',
            tabBarAccessibilityLabel: 'Explore',
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? 'compass' : 'compass-outline'} size={size} color={color} />
            ),
          }}
        />

        {/*
          Pings, where News was (the owner's, 2026-10-31): asking everybody
          what to play next, and answering. News and events open from Home's
          two sections now (`/news`). The glyph is a dot with waves either side
          of it — a ping going out.
        */}
        <Tabs.Screen
          name="pings"
          options={{
            title: 'Pings',
            tabBarAccessibilityLabel: 'Pings',
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? 'radio' : 'radio-outline'} size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarAccessibilityLabel: 'Profile',
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
            ),
          }}
        />

        {/* The field and its results. Not in the bar's pill: a round key of
            its own at the right, as Apple TV's (`<AppTabBar>`). Last, so it
            is last for a screen reader too. */}
        <Tabs.Screen
          name="search"
          options={{
            title: 'Search',
            tabBarAccessibilityLabel: 'Search',
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? 'search' : 'search-outline'} size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </TabBarClearanceProvider>
  );
}
