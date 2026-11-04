import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ProfileView } from '@/components/profile-view';
import { reportHref } from '@/components/report-flag';
import { AnchoredMenu, AnchoredMenuItem, useAnchoredMenu } from '@/components/ui/anchored-menu';
import { Button } from '@/components/ui/button';
import { FrostedTopBar, TopBarDisc } from '@/components/ui/frosted-top-bar';
import { EmptyState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { blockUser, getProfile, isBlockedByMe, unblockUser } from '@/lib/api';
import { displayNameFor } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { showAlert } from '@/components/ui/dialog';
import { toast } from '@/lib/toast';

/**
 * Someone else's profile: the bar with their handle in it, then
 * `<ProfileView>`.
 *
 * ## The handle is the bar's title, and it is centred
 *
 * This screen was pushed, so it has the bar every pushed screen has — clear
 * over the top of the profile, frost once the profile has scrolled under it.
 * Its title is the person's handle, as your own profile's row is given to
 * yours, so the header under it can open on the name alone; and it is centred
 * on the screen as yours is, which is why this is the one bar that asks for
 * `centerTitle`.
 *
 * ## Report and block (0045)
 *
 * The disc at the right opens a menu: report the account, and block or
 * unblock it — what Play's user-generated content policy asks a social app to
 * offer for a *user*, not only for their words. A blocked person's page is a
 * sentence and the Unblock button, not their profile: the database already
 * hides their reviews, collections and posts from you, and a page of empty
 * sections would look broken rather than blocked.
 */
export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [trigger, menu] = useAnchoredMenu();

  /* The same key `<ProfileView>` reads, so this is the cache, not a request. */
  const profile = useQuery({
    queryKey: ['profile', id],
    queryFn: () => getProfile(id!),
    enabled: !!id,
  });
  const handle = profile.data?.username || (profile.data ? displayNameFor(profile.data) : '');
  const name = profile.data ? displayNameFor(profile.data) : 'them';

  const someoneElse = !!viewerId && !!id && viewerId !== id;
  const blocked = useQuery({
    queryKey: ['blocked', viewerId, id],
    queryFn: () => isBlockedByMe(viewerId!, id!),
    enabled: someoneElse,
  });

  const toggle = useMutation({
    mutationFn: (block: boolean) => (block ? blockUser(id!) : unblockUser(id!)),
    /* A block changes what nearly every list shows — reviews, comments,
       activity, follows — so everything is asked again. It is rare. */
    onSuccess: (_result, block) => {
      toast.success(block ? 'Blocked' : 'Unblocked');
      return queryClient.invalidateQueries();
    },
    onError: (error) =>
      showAlert('That didn’t work', error instanceof Error ? error.message : undefined),
  });

  function askBlock() {
    menu.close();
    showAlert(
      `Block ${name}?`,
      'Neither of you will see the other’s reviews, collections, comments or wall posts, or be able to follow, reply to or like each other. You will stop following each other. They are not told.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => toggle.mutate(true) },
      ]
    );
  }

  function report() {
    menu.close();
    router.push(reportHref({ kind: 'profile', targetId: id!, authorId: id! }));
  }

  const isBlocked = blocked.data === true;

  const right = someoneElse ? (
    <View ref={trigger} collapsable={false}>
      <TopBarDisc icon="ellipsis-horizontal" label={`More about ${name}`} onPress={menu.open} />
    </View>
  ) : undefined;

  return (
    <Screen
      edges={[]}
      insetHeader
      topBar={<FrostedTopBar back title={handle} centerTitle right={right} />}>
      {!id ? (
        <EmptyState title="Profile not found" />
      ) : isBlocked ? (
        <View style={styles.blocked}>
          <Text variant="h3" style={styles.centred} accessibilityRole="header">
            {`You blocked ${name}`}
          </Text>
          <Text variant="body" color="textSecondary" style={styles.centred}>
            You don’t see each other’s reviews, collections, comments or wall posts, and neither of
            you can follow or reply to the other.
          </Text>
          <Button
            title="Unblock"
            variant="secondary"
            loading={toggle.isPending}
            onPress={() => toggle.mutate(false)}
          />
        </View>
      ) : (
        <ProfileView profileId={id} />
      )}

      {someoneElse && (
        <AnchoredMenu menu={menu} label={`More about ${name}`} align="end">
          <AnchoredMenuItem
            icon="flag-outline"
            title="Report account"
            hint="Tell a moderator about this profile"
            onPress={report}
          />
          {isBlocked ? (
            <AnchoredMenuItem
              icon="person-add-outline"
              title={`Unblock ${name}`}
              onPress={() => {
                menu.close();
                toggle.mutate(false);
              }}
            />
          ) : (
            <AnchoredMenuItem
              icon="ban-outline"
              title={`Block ${name}`}
              hint="You stop seeing each other"
              onPress={askBlock}
            />
          )}
        </AnchoredMenu>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centred: { textAlign: 'center' },
  blocked: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x16,
    paddingHorizontal: Spacing.x32,
  },
});
