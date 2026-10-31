import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageScrollView } from '@/components/ui/page-scroll';
import { EmptyState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
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
  const [typed, setTyped] = useState('');

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

  const confirmed =
    !!username && typed.trim().replace(/^@/, '').toLowerCase() === username.toLowerCase();

  return (
    <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back title="Delete account" />}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
        <PageScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text variant="h3">This deletes your account for good</Text>
          <View style={styles.block}>
            <Text variant="h5">What goes, at once</Text>
            <Text variant="body" color="textSecondary">
              Your profile and pictures, your logs, scores, reviews, collections, comments, wall
              posts, likes, follows, friendships, physical copies, linked gaming accounts, reports,
              blocks and rating statistics — and other people’s likes and comments on your writing.
            </Text>
          </View>
          <View style={styles.block}>
            <Text variant="h5">What stays, without your name</Text>
            <Text variant="body" color="textSecondary">
              Releases you added to the barcode catalogue and the box photos you sent for them. Game
              averages are worked out again without your ratings.
            </Text>
          </View>
          <Link href={{ pathname: '/legal/[doc]', params: { doc: 'privacy' } }}>
            <Text variant="bodySmall" color="primaryText">
              Read the privacy policy
            </Text>
          </Link>

          <TextField
            label={username ? `Type your username, ${username}, to confirm` : 'Type your username'}
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Your username, to confirm"
          />

          {remove.isError && (
            <Text variant="bodySmall" color="danger">
              {remove.error instanceof Error ? remove.error.message : 'That did not work.'}
            </Text>
          )}

          <Button
            title="Delete my account"
            variant="danger"
            fullWidth
            disabled={!confirmed}
            loading={remove.isPending}
            onPress={() => remove.mutate()}
          />
          <Text variant="caption" color="textMuted" style={styles.centred}>
            This cannot be undone. You can make a new account later, but nothing of this one comes
            back.
          </Text>
        </PageScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centred: { textAlign: 'center' },
  content: {
    paddingHorizontal: Spacing.x24,
    paddingTop: Spacing.x16,
    paddingBottom: Spacing.x48,
    gap: Spacing.x24,
  },
  block: { gap: Spacing.x4 },
});
