import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AnchoredMenu, AnchoredMenuItem, useAnchoredMenu } from '@/components/ui/anchored-menu';
import { Avatar } from '@/components/ui/avatar';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import { getUnreadCount, getUnreadPingCount } from '@/lib/api';
import { displayNameFor } from '@/lib/format';
import { useAuth } from '@/store/auth';

/** A key in the bar's capsule — the capsule's height less its padding. */
const KEY = 44;
/** The face in the capsule, iOS's account button. */
const FACE = 32;

/**
 * Home's top bar — the plain bar every list page has (the Apple pass,
 * 2026-11-05): clear at the top, the page's colour fading in once the page is
 * under it, and "Home" centred in it once the page's own large title has gone
 * up under it. At its right, one capsule: **your face** (to your profile),
 * **Create** and **the bell**.
 *
 * It was a fixed 112dp header — the large title, its keys, and the chips on a
 * row of their own (SimpMusic's, 2026-10-22; Apple TV's title, 2026-11-03) —
 * which never moved. Now the title and the chips are the page's
 * (`<PageLargeTitle>`, `<HomeChips>`), and fold up under this bar as the page
 * is read. The "Welcome back," row that held the face is gone; the face is
 * here, where iOS keeps the account.
 */
export function HomeHeader() {
  return (
    <FrostedTopBar
      variant="bar"
      title="Home"
      right={
        <>
          <ProfileKey />
          <CreateKey />
          <NotificationsKey />
        </>
      }
    />
  );
}

/** Your face: the way to your profile, iOS's account button. */
function ProfileKey() {
  const theme = useTheme();
  const router = useRouter();
  const profile = useAuth((state) => state.profile);
  if (!profile) return null;
  const name = displayNameFor(profile);

  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={`Signed in as ${name}. Open your profile.`}
      onPress={() => router.navigate('/(tabs)/profile')}
      scaleTo={0.92}
      pressedColor={theme.controlPressed}
      style={StyleSheet.flatten([styles.key, styles.round])}>
      <Avatar uri={profile.avatar_url} name={name} size={FACE} />
    </PressableScale>
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
          style={[styles.badge, { backgroundColor: theme.danger, borderColor: theme.controlFill }]}>
          <Text variant="caption" style={[styles.badgeText, { color: theme.text }]}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  key: { width: KEY, height: KEY, alignItems: 'center', justifyContent: 'center' },
  round: { borderRadius: KEY / 2 },
  /* On the bell's upper-right shoulder, inside the key. */
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 3,
    borderRadius: Radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, lineHeight: 13 },
});
