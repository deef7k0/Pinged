import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { HomeChips, type OpenChip } from '@/components/home/home-chips';
import { GlassSurface, useLiquidGlass } from '@/components/ui/liquid-glass';
import { AnchoredMenu, AnchoredMenuItem, useAnchoredMenu } from '@/components/ui/anchored-menu';
import { FoldingTopBar } from '@/components/ui/frosted-top-bar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import { getUnreadCount, getUnreadPingCount } from '@/lib/api';
import type { HomeView } from '@/lib/home-view';
import { useAuth } from '@/store/auth';

/**
 * The header's row. SimpMusic's is 56; the owner had it thicker (2026-10-22:
 * "make the top bar thicker, it cuts too early") — the page's colour behind it
 * reached only just past the chips once the page was under it.
 */
export const HOME_HEADER_ROW = 112;

/*
 * The tab's name, large at the top left with the keys at the right — Apple
 * TV's (the owner's references, 2026-11-03: "display the name of every tab
 * like that, with a big bold text at the top left corner") — and the chips on
 * a row of their own under it. The bar was the chips' row alone, 72 tall.
 */
const TITLE_ROW = 52;
const CHIP_ROW = HOME_HEADER_ROW - TITLE_ROW;

/** The two keys at the end of the row, in one capsule 48 tall. */
const KEY = 48;

/**
 * Home's top bar — SimpMusic's, read from `HomeScreen.kt` (the header block)
 * and `CreateSheet.kt` (`CreateActions`): the chips and Create on one row, and
 * no app bar.
 *
 * - **Fixed over the page.** At the very top of the page there is nothing
 *   behind it but the page's glow; once the page is under it the page's own
 *   colour fades in behind it (`<FoldingTopBar>` — the reference blurs, and
 *   the owner had blur taken off every bar here).
 * - **The chips** — All, Mood and Genre (`<HomeChips>`) — **stop at the
 *   keys.** The reference's avatar was here and its chips scrolled across the
 *   whole row, over the avatar and over Create; the owner had the avatar moved
 *   back onto the page (the "Welcome back" row) and the chips kept off the
 *   keys and inside the screen (2026-10-22). So the chips are a scroller of
 *   their own between the margin and the keys, clipped at its edges, and an
 *   open chip that is wider than that scrolls.
 * - **Create** (+, the reference's grey disc with a rim) drops a menu — log a
 *   game, review one, start a collection — and **the bell** is the plain glyph
 *   beside it, in the reference's Settings place. Settings is the profile
 *   tab's alone. The reference's Create is a bottom sheet; here a sheet would be
 *   under the floating tab bar, so it is the anchored menu the profile's +
 *   already is.
 */
export function HomeHeader({
  view,
  onViewChange,
}: {
  view: HomeView;
  onViewChange: (view: HomeView) => void;
}) {
  const theme = useTheme();
  const liquid = useLiquidGlass();
  const [open, setOpen] = useState<OpenChip>(null);

  return (
    <FoldingTopBar height={HOME_HEADER_ROW}>
      <View style={styles.stack} pointerEvents="box-none">
        <View style={styles.titleRow} pointerEvents="box-none">
          <Text variant="largeTitle" accessibilityRole="header" style={styles.title}>
            Home
          </Text>
          {/* One capsule for both keys — a connected bar, as every page's
              right-hand controls are (the owner's, 2026-11-03). */}
          <View style={[styles.keys, { backgroundColor: liquid ? undefined : theme.controlFill }]}>
            {liquid && <GlassSurface radius={KEY / 2} />}
            <CreateKey />
            <NotificationsKey />
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={styles.chips}
          contentContainerStyle={styles.chipsContent}>
          <HomeChips view={view} open={open} onOpenChange={setOpen} onChange={onViewChange} />
        </ScrollView>
      </View>
    </FoldingTopBar>
  );
}

/** + : the ways to add something, dropped from the key. */
function CreateKey() {
  const theme = useTheme();
  const accent = useAccent();
  const router = useRouter();
  const [trigger, menu] = useAnchoredMenu();

  function quickLog(mode: 'log' | 'review') {
    menu.close();
    router.push({ pathname: '/quick-log', params: { mode } });
  }

  return (
    <>
      <View ref={trigger} collapsable={false}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Create"
          accessibilityHint="Log or review a game, or start a collection"
          accessibilityState={{ expanded: menu.isOpen }}
          onPress={menu.open}
          scaleTo={0.92}
          focusRing={accent.ring}
          pressedColor={theme.controlPressed}
          style={StyleSheet.flatten([styles.key, styles.round])}>
          <Ionicons name="add" size={24} color={theme.text} />
        </PressableScale>
      </View>

      <AnchoredMenu menu={menu} label="Create" align="end">
        <AnchoredMenuItem
          icon="checkmark-circle-outline"
          title="Log a game"
          hint="Say where you are with it"
          onPress={() => quickLog('log')}
        />
        <AnchoredMenuItem
          icon="create-outline"
          title="Review a game"
          hint="Write about it and score it"
          onPress={() => quickLog('review')}
        />
        <AnchoredMenuItem
          icon="albums-outline"
          title="New collection"
          hint="Put games together under a name"
          onPress={() => {
            menu.close();
            router.push('/new-list');
          }}
        />
      </AnchoredMenu>
    </>
  );
}

/**
 * The bell, where Settings was (2026-10-28, the owner: "Place the notification
 * button where the settings icon is, and remove the settings icon from the
 * home section, it will only be in the profile tab"). It opens the inbox —
 * your pings first, your notifications a tab away (2026-10-31) — and its count
 * is both tabs' unread together. The bare glyph,
 * Material's `IconButton` — 48 to touch, nothing drawn round it — with the
 * unread count on its shoulder, ringed in the page's colour.
 */
function NotificationsKey() {
  const theme = useTheme();
  const accent = useAccent();
  const router = useRouter();
  const userId = useAuth((state) => state.session?.user.id);
  /* Both tabs of the inbox: pings and notifications, one number. */
  const unread = useQuery({
    queryKey: ['inbox', 'unread', userId],
    queryFn: async () => {
      const [notifications, pings] = await Promise.all([
        getUnreadCount(userId!),
        getUnreadPingCount(userId!),
      ]);
      return notifications + pings;
    },
    enabled: !!userId,
    refetchInterval: 60_000,
  });
  const count = unread.data ?? 0;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={
        count > 0 ? `Pings and notifications, ${count} unread` : 'Pings and notifications'
      }
      onPress={() => router.push('/notifications')}
      scaleTo={0.92}
      pressedColor={theme.controlPressed}
      focusRing={accent.ring}
      style={StyleSheet.flatten([styles.key, styles.round])}>
      <Ionicons name="notifications-outline" size={24} color={theme.text} />
      {count > 0 && (
        <View
          style={[
            styles.badge,
            { backgroundColor: theme.primary, borderColor: theme.homeBackground },
          ]}>
          <Text variant="caption" style={{ color: theme.onPrimary }}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  stack: { flex: 1 },
  titleRow: {
    height: TITLE_ROW,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.x16,
  },
  title: { flex: 1 },
  /* Between the margin and the keys, and clipped there: a chip never passes
     over a key, nor off the screen. `flex: 1` is the room; the scroller does
     not grow past it. */
  chips: { flexGrow: 0, height: CHIP_ROW },
  chipsContent: {
    paddingLeft: Spacing.x16,
    paddingRight: Spacing.x8,
    alignItems: 'center',
    /* Room for the chips' slop to reach the tap floor inside the row. */
    height: CHIP_ROW,
  },
  keys: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Spacing.x12,
    paddingHorizontal: 2,
    borderRadius: KEY / 2,
  },
  key: { width: KEY - 4, height: KEY - 4, alignItems: 'center', justifyContent: 'center' },
  round: { borderRadius: KEY / 2 },
  /* On the bell's upper-right shoulder, inside the 48 key. */
  badge: {
    position: 'absolute',
    top: Spacing.x4,
    right: Spacing.x4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: Spacing.x4,
    borderRadius: Radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
