import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useAccountLink, useGamingSyncState, useLinkedAccount } from '@/hooks/use-gaming';
import { useTheme } from '@/hooks/use-theme';
import { getGamingStats } from '@/lib/api';
import { USERNAME_FORM, requireProvider, type UsernameProviderId } from '@/lib/gaming';
import { showAlert } from '@/components/ui/dialog';

const ICONS: Record<UsernameProviderId, keyof typeof Ionicons.glyphMap> = {
  playstation: 'logo-playstation',
  xbox: 'logo-xbox',
  gog: 'game-controller',
};

/**
 * One service linked by username, RAWG's way (`username-provider.ts`): the
 * public name, Connect, and what came of it — the games imported, or that the
 * profile is private and what to make public, in RAWG's own words.
 *
 * Unlinked: the field and the privacy note under it, so the person knows
 * before pressing what has to be public. Linked: the name, the count, Import
 * again and Disconnect. A failed import keeps the field and says why.
 */
export function UsernameAccount({
  userId,
  provider,
}: {
  userId: string;
  provider: UsernameProviderId;
}) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const form = USERNAME_FORM[provider];
  const instance = requireProvider(provider);

  const account = useLinkedAccount(userId, provider);
  const syncState = useGamingSyncState(userId, provider);
  const stats = useQuery({
    queryKey: ['gaming-stats', provider, userId],
    queryFn: () => getGamingStats(userId, provider),
    enabled: !!account.data,
  });
  const { link, unlink } = useAccountLink(userId, provider);

  const resync = useMutation({
    mutationFn: () => instance.sync({ userId, section: 'library' }),
    onSuccess: () => {
      for (const key of ['gaming-account', 'gaming-stats', 'gaming-library', 'gaming-sync-state']) {
        queryClient.invalidateQueries({ queryKey: [key, provider, userId] });
      }
    },
  });

  const [handle, setHandle] = useState('');
  const library = syncState.data?.find((state) => state.section === 'library');
  const linked = !!account.data;
  const privateNow = library?.status === 'private';

  return (
    <View style={[styles.block, { borderTopColor: theme.border }]}>
      <View style={styles.head}>
        <Ionicons name={ICONS[provider]} size={20} color={theme.text} />
        <Text variant="h5" style={styles.headText}>
          {instance.label}
        </Text>
      </View>

      {linked ? (
        <>
          <Text variant="body" color="textSecondary">
            {`Linked as ${account.data?.handle ?? account.data?.externalId}`}
            {stats.data ? ` · ${stats.data.gamesOwned.toLocaleString()} games` : ''}
          </Text>
          {(privateNow || library?.status === 'error') && (
            <Text variant="bodySmall" color="danger">
              {privateNow
                ? `Your ${instance.label} profile or games seem to be private now. ${form.privacy}`
                : 'The last import did not finish. Try again in a while.'}
            </Text>
          )}
          {resync.data?.message && resync.data.status !== 'ok' && (
            <Text variant="bodySmall" color="danger">
              {resync.data.message}
            </Text>
          )}
          <View style={styles.actions}>
            <Button
              title="Import again"
              variant="secondary"
              size="small"
              loading={resync.isPending}
              onPress={() => resync.mutate()}
            />
            <Button
              title="Disconnect"
              variant="ghost"
              size="small"
              loading={unlink.isPending}
              onPress={() =>
                showAlert(
                  `Disconnect ${instance.label}?`,
                  'The games imported from it are removed from your library. You can connect again at any time.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Disconnect',
                      style: 'destructive',
                      onPress: () => unlink.mutate(),
                    },
                  ]
                )
              }
            />
          </View>
          <Text variant="caption" color="textMuted">
            Linked by username: Pinged reads what your public profile shows and never signs in to
            your account.
          </Text>
        </>
      ) : (
        <>
          <TextField
            label={form.field}
            value={handle}
            onChangeText={(value) => {
              setHandle(value);
              link.reset();
            }}
            placeholder={form.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={() => handle.trim() && link.mutate(handle)}
            error={link.error instanceof Error ? link.error.message : null}
            hint={form.hint}
          />
          <Text variant="bodySmall" color="textMuted">
            {form.privacy}
          </Text>
          <Button
            title={`Connect ${instance.label}`}
            variant="secondary"
            size="small"
            disabled={!handle.trim()}
            loading={link.isPending}
            onPress={() => link.mutate(handle)}
            fullWidth
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: Spacing.x8,
    paddingTop: Spacing.x16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  headText: { flex: 1 },
  actions: { flexDirection: 'row', gap: Spacing.x8 },
});
