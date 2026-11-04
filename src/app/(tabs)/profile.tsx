import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { ProfileActionRow, ProfileButton, ProfileKey } from '@/components/profile-actions';
import { ProfileView } from '@/components/profile-view';
import { GlassSurface, useLiquidGlass } from '@/components/ui/liquid-glass';
import { HeaderFade } from '@/components/ui/frosted-top-bar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { PROFILE_MARGIN } from '@/constants/profile-layout';
import { Elevation, Motion, Radius, Spacing, TapTarget, withAlpha } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import { getProfile } from '@/lib/api';
import { displayNameFor } from '@/lib/format';
import { useAuth } from '@/store/auth';
import type { QuickLogMode } from '@/app/quick-log';

/**
 * Your own profile: a top bar, then `<ProfileView>` — the profile, and under
 * its widgets the row of tabs and the tab they choose.
 *
 * ## The bar
 *
 * **+** on the left, your handle in the middle, **Settings** on the right. It
 * is the title bar of the owner's reference for this screen — a back chevron,
 * the name, a menu — with this app's two keys where those are: a root tab has
 * nothing to go back to. The + is the quickest way to put a game in your log —
 * it asks whether you are logging or reviewing, then opens the picker
 * (`quick-log`). Settings is about your account, and this is the screen that
 * is about you. Sign out is inside it.
 *
 * The bar is fixed rather than in the scroll: it holds the two things you
 * reach for on this screen, and they should not scroll away from you. The keys
 * are Home's masthead keys — round, the action grey, at the tap floor. The profile
 * starts directly under it and keeps this screen's margin (`PROFILE_MARGIN`,
 * ten). The tabs sat here for a few days, under the bar; the owner
 * had them put back under the profile's widgets (see `<ProfileView>`).
 */
export default function MyProfileScreen() {
  const router = useRouter();
  const theme = useTheme();
  const liquid = useLiquidGlass();
  const accent = useAccent();
  const reduceMotion = useReducedMotion();
  const userId = useAuth((state) => state.session?.user.id);

  const [menuOpen, setMenuOpen] = useState(false);
  /** Where the bar ends, so the + menu can drop from it. */
  const [barBottom, setBarBottom] = useState(0);

  /* The same key `<ProfileView>` reads, so this is the cache, not a request. */
  const profile = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => getProfile(userId!),
    enabled: !!userId,
  });
  const handle = profile.data?.username || (profile.data ? displayNameFor(profile.data) : '');

  function startQuickLog(mode: QuickLogMode) {
    setMenuOpen(false);
    router.push({ pathname: '/quick-log', params: { mode } });
  }

  function share() {
    if (!userId) return;
    const name = profile.data ? displayNameFor(profile.data) : 'me';
    const url = Linking.createURL(`/profile/${userId}`);
    Share.share({ message: `${name} on Pinged\n${url}` }).catch(() => undefined);
  }

  if (!userId) {
    // Should be unreachable behind the auth guard, but avoids rendering a
    // profile for `undefined` if the session ever drops mid-render.
    return (
      <Screen edges={['top']}>
        <EmptyState title="Not signed in" />
      </Screen>
    );
  }

  return (
    /*
     * `edges={['top']}`: on a real build the window is edge-to-edge, so without
     * the inset the bar would sit under the clock. The bottom is left to the
     * floating tab bar — `<ProfileView>` pads its list by its clearance.
     */
    <Screen edges={['top']}>
      <View
        style={styles.bar}
        onLayout={(event) =>
          setBarBottom(event.nativeEvent.layout.y + event.nativeEvent.layout.height)
        }>
        {/* The tab's name, large at the top left — Apple TV's (the owner's
            references, 2026-11-03) — with your handle under it, where the
            bar carried it, so the head below gives its line to your name
            alone. The keys at the right: + and Settings. */}
        <View style={styles.title}>
          <Text variant="largeTitle" accessibilityRole="header">
            Profile
          </Text>
          {!!handle && (
            <Text variant="body" color="textSecondary" numberOfLines={1}>
              {profile.data?.username ? `@${handle}` : handle}
            </Text>
          )}
        </View>
        {/* + and Settings in one capsule — a connected bar, as every page's
            right-hand controls are (the owner's, 2026-11-03). */}
        <View style={[styles.keys, { backgroundColor: liquid ? undefined : theme.controlFill }]}>
          {liquid && <GlassSurface radius={TapTarget / 2 + 2} />}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Log or review a game"
            accessibilityState={{ expanded: menuOpen }}
            onPress={() => setMenuOpen((open) => !open)}
            scaleTo={0.92}
            pressedColor={theme.controlPressed}
            focusRing={accent.ring}
            style={StyleSheet.flatten([
              styles.key,
              { backgroundColor: menuOpen ? theme.controlPressed : withAlpha(theme.text, 0) },
            ])}>
            <Ionicons name="add" size={24} color={theme.text} />
          </PressableScale>

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => router.push('/settings')}
            scaleTo={0.92}
            pressedColor={theme.controlPressed}
            focusRing={accent.ring}
            style={StyleSheet.flatten([styles.key, { backgroundColor: withAlpha(theme.text, 0) }])}>
            <Ionicons name="settings-outline" size={20} color={theme.text} />
          </PressableScale>
        </View>
      </View>

      {/* The profile under its row, dissolving into it as it scrolls —
          reacticx's header fade (`<HeaderFade>`). */}
      <View style={styles.body}>
        <ProfileView
          profileId={userId}
          headerAction={
            /*
             * The head's action row (`<ProfileActionRow>`): the big pill and a
             * share glyph beside it, as someone else's profile has Follow. In
             * the action grey, not white: white is the call to act on someone
             * else's page, and editing your own is not that.
             */
            <ProfileActionRow
              button={
                <ProfileButton
                  title="Edit profile"
                  icon="create-outline"
                  filled={false}
                  onPress={() => router.push('/edit-profile')}
                />
              }
              keys={<ProfileKey icon="share-outline" label="Share your profile" onPress={share} />}
            />
          }
        />
        <HeaderFade />
      </View>

      {/*
        The + menu: two choices dropped from the key, over the page.

        Not a bottom sheet — the tab bar floats over the foot of this screen
        and would sit on top of one. It drops from where you tapped, and a tap
        anywhere else puts it away.
      */}
      {menuOpen && (
        <>
          <Pressable
            accessibilityLabel="Close menu"
            onPress={() => setMenuOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View
            entering={reduceMotion ? undefined : FadeIn.duration(Motion.fast)}
            exiting={reduceMotion ? undefined : FadeOut.duration(Motion.fast)}
            style={[
              styles.menu,
              Elevation.overlay,
              { top: barBottom + Spacing.x4, backgroundColor: theme.surfaceElevated },
              { borderColor: theme.border },
            ]}>
            <MenuRow
              icon="checkmark-circle-outline"
              title="Log a game"
              hint="Say where you are with it"
              onPress={() => startQuickLog('log')}
            />
            <MenuRow
              icon="create-outline"
              title="Review a game"
              hint="Write about it and score it"
              onPress={() => startQuickLog('review')}
            />
          </Animated.View>
        </>
      )}
    </Screen>
  );
}

function MenuRow({
  icon,
  title,
  hint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={hint}
      onPress={onPress}
      scaleTo={0.98}
      pressedColor={theme.controlPressed}
      style={styles.menuRow}>
      <Ionicons name={icon} size={22} color={theme.text} />
      <View style={styles.menuText}>
        <Text variant="itemTitle">{title}</Text>
        <Text variant="bodySmall" color="textMuted">
          {hint}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  /* Home's masthead row at this screen's own margin: a little air above, keys
     at the floor. */
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    paddingHorizontal: PROFILE_MARGIN,
    paddingTop: Spacing.x8,
  },
  keys: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 2,
    borderRadius: TapTarget / 2 + 2,
  },
  key: {
    width: TapTarget,
    height: TapTarget,
    borderRadius: TapTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1 },
  menu: {
    position: 'absolute',
    right: PROFILE_MARGIN,
    minWidth: 240,
    paddingVertical: Spacing.x8,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    minHeight: TapTarget + Spacing.x8,
    paddingHorizontal: Spacing.x16,
  },
  menuText: { flex: 1, gap: 1 },
});
