import { useQuery } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { Share, View } from 'react-native';

import { ProfileActionRow, ProfileButton, ProfileKey } from '@/components/profile-actions';
import { ProfileView } from '@/components/profile-view';
import { AnchoredMenu, AnchoredMenuItem, useAnchoredMenu } from '@/components/ui/anchored-menu';
import { FrostedTopBar, TopBarDisc } from '@/components/ui/frosted-top-bar';
import { EmptyState, Screen } from '@/components/ui/screen';
import { getProfile } from '@/lib/api';
import { displayNameFor } from '@/lib/format';
import { useAuth } from '@/store/auth';
import type { QuickLogMode } from '@/app/quick-log';

/**
 * Your own profile: the plain bar, then `<ProfileView>` — the profile, and
 * under its widgets the row of tabs and the tab they choose.
 *
 * ## The bar
 *
 * "Profile" large at the top of the page with your @handle under it, folding
 * into the bar as the page is read (the Apple pass, 2026-11-05) — it was a
 * fixed row with the title, the handle and the keys. At the right, one
 * capsule: **+** — the quickest way to put a game in your log; it asks
 * whether you are logging or reviewing, then opens the picker (`quick-log`) —
 * and **Settings**, which is about your account, on the screen that is about
 * you. Sign out is inside it.
 */
export default function MyProfileScreen() {
  const router = useRouter();
  const userId = useAuth((state) => state.session?.user.id);
  const [trigger, menu] = useAnchoredMenu();

  /* The same key `<ProfileView>` reads, so this is the cache, not a request. */
  const profile = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => getProfile(userId!),
    enabled: !!userId,
  });
  const handle = profile.data?.username
    ? `@${profile.data.username}`
    : profile.data
      ? displayNameFor(profile.data)
      : undefined;

  function startQuickLog(mode: QuickLogMode) {
    menu.close();
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
    /* The bottom is left to the floating tab bar — `<ProfileView>` pads its
       list by its clearance. */
    <Screen
      edges={[]}
      insetHeader
      topBar={
        <FrostedTopBar
          title="Profile"
          subtitle={handle}
          right={
            <>
              <View ref={trigger} collapsable={false}>
                <TopBarDisc icon="add" label="Log or review a game" onPress={menu.open} />
              </View>
              <TopBarDisc
                icon="settings-outline"
                label="Settings"
                onPress={() => router.push('/settings')}
              />
            </>
          }
        />
      }>
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

      {/* The + menu, dropped from the key — Home's Create is the same. */}
      <AnchoredMenu menu={menu} label="Log or review a game" align="end">
        <AnchoredMenuItem
          icon="checkmark-circle-outline"
          title="Log a game"
          hint="Say where you are with it"
          onPress={() => startQuickLog('log')}
        />
        <AnchoredMenuItem
          icon="create-outline"
          title="Review a game"
          hint="Write about it and score it"
          onPress={() => startQuickLog('review')}
        />
      </AnchoredMenu>
    </Screen>
  );
}
