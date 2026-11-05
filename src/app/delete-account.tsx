import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { showPrompt } from '@/components/ui/dialog';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { InsetGroup, Row } from '@/components/ui/inset-group';
import { PageScrollView } from '@/components/ui/page-scroll';
import { EmptyState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { deleteMyAccount } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/auth';

/**
 * Deleting your account — Google Play requires it in the app for any app
 * where an account can be made. From Settings → Account.
 *
 * Says what goes and what stays (the same words as the privacy policy), asks
 * for the username typed out — a stronger stop than an alert's second tap for
 * something that cannot be undone — then deletes the uploads and the account
 * (`lib/api/account.ts`, 0045's `delete_my_account`), forgets this phone's
 * stores for the account, and signs out locally: the server has nothing left
 * to sign out of. The root layout's guard then shows the welcome screen.
 */
export default function DeleteAccountScreen() {
  const userId = useAuth((state) => state.session?.user.id) ?? null;
  const username = useAuth((state) => state.profile?.username) ?? null;

  const remove = useMutation({
    mutationFn: async () => {
      await deleteMyAccount(userId!);
      /* What this phone kept for the account: drafts, search history,
         settings, the saved screens — every key that names it. */
      try {
        const keys = await AsyncStorage.getAllKeys();
        await AsyncStorage.multiRemove(keys.filter((key) => key.includes(userId!)));
      } catch {
        /* The account is gone either way; these are only this phone's. */
      }
      queryClient.clear();
      await supabase.auth.signOut({ scope: 'local' });
      useAuth.setState({ session: null, profile: null });
    },
  });

  if (!userId) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back title="Delete account" />}>
        <EmptyState title="Signed out" message="Sign in to delete your account." />
      </Screen>
    );
  }

  const matches = (typed: string) =>
    !!username && typed.trim().replace(/^@/, '').toLowerCase() === username.toLowerCase();

  /* The username is typed into an Apple alert (the Apple pass, 2026-11-05)
     — a stronger stop than a second tap for something that cannot be undone.
     It was a field on the page over a red button. */
  function confirm() {
    showPrompt(
      'Delete your account?',
      username
        ? `This cannot be undone. Type your username, ${username}, to confirm.`
        : 'This cannot be undone. Type your username to confirm.',
      {
        placeholder: username ?? 'Username',
        confirm: { text: 'Delete', style: 'destructive' },
        accepts: matches,
        onSubmit: () => remove.mutate(),
      }
    );
  }

  return (
    <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back title="Delete account" />}>
      <PageScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="body" color="textSecondary" style={styles.lead}>
          This deletes your account for good. You can make a new account later, but nothing of this
          one comes back.
        </Text>

        <InsetGroup header="What’s deleted, at once">
          <Row
            title="Your profile and everything you made"
            subtitle="Pictures, logs, scores, reviews, collections, comments, wall posts, likes, follows, friendships, physical copies, linked gaming accounts, reports, blocks and rating statistics — and other people’s likes and comments on your writing."
          />
        </InsetGroup>

        <InsetGroup
          header="What stays, without your name"
          footer={
            <Link href={{ pathname: '/legal/[doc]', params: { doc: 'privacy' } }}>
              <Text variant="bodySmall" color="primaryText">
                Read the privacy policy
              </Text>
            </Link>
          }>
          <Row
            title="The barcode catalogue"
            subtitle="Releases you added and the box photos you sent for them. Game averages are worked out again without your ratings."
          />
        </InsetGroup>

        {remove.isError && (
          <Text variant="bodySmall" color="danger" style={styles.lead}>
            {remove.error instanceof Error ? remove.error.message : 'That did not work.'}
          </Text>
        )}

        <InsetGroup>
          <Row
            title={remove.isPending ? 'Deleting…' : 'Delete my account'}
            destructive
            centred
            disabled={remove.isPending || !username}
            onPress={confirm}
          />
        </InsetGroup>
      </PageScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.x16,
    paddingTop: Spacing.x8,
    paddingBottom: Spacing.x48,
    gap: Spacing.x24,
  },
  lead: { paddingHorizontal: Spacing.x16 },
});
