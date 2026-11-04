import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageFlatList } from '@/components/ui/page-scroll';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getBlockedProfiles, unblockUser, type BlockedProfile } from '@/lib/api';
import { displayNameFor, timeAgo } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { toast } from '@/lib/toast';

/**
 * The people you blocked (0045), from Settings, each with Unblock. Blocking
 * itself is on the person's profile; this is the way back to anybody whose
 * profile you can no longer find.
 */
export default function BlockedScreen() {
  const userId = useAuth((state) => state.session?.user.id) ?? null;
  const blocked = useQuery({
    queryKey: ['blocked-profiles', userId],
    queryFn: () => getBlockedProfiles(userId!),
    enabled: !!userId,
  });

  return (
    <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back title="Blocked accounts" />}>
      <PageFlatList
        data={blocked.data ?? []}
        keyExtractor={(row) => row.id}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => <BlockedRow person={item} />}
        ListHeaderComponent={
          <Text variant="bodySmall" color="textMuted" style={styles.note}>
            You and the people here don’t see each other’s reviews, collections, comments or wall
            posts, and can’t follow, reply to or like each other. They are not told.
          </Text>
        }
        ListEmptyComponent={
          blocked.isLoading ? (
            <LoadingState />
          ) : blocked.isLoadingError ? (
            <ErrorState error={blocked.error} onRetry={() => void blocked.refetch()} />
          ) : (
            <EmptyState
              title="Nobody blocked"
              message="To block someone, open their profile and use the menu at the top."
            />
          )
        }
      />
    </Screen>
  );
}

function BlockedRow({ person }: { person: BlockedProfile }) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const name = displayNameFor(person);
  const unblock = useMutation({
    mutationFn: () => unblockUser(person.id),
    onSuccess: () => {
      toast.success('Unblocked');
      return queryClient.invalidateQueries();
    },
  });

  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <Link href={{ pathname: '/profile/[id]', params: { id: person.id } }} asChild>
        <PressableScale accessibilityRole="link" scaleTo={0.98} style={styles.person}>
          <Avatar uri={person.avatar_url} name={name} size={40} />
          <View style={styles.text}>
            <Text variant="itemTitle" numberOfLines={1}>
              {name}
            </Text>
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              {`@${person.username} · blocked ${timeAgo(person.blocked_at)}`}
            </Text>
          </View>
        </PressableScale>
      </Link>
      <Button
        title="Unblock"
        size="small"
        variant="secondary"
        loading={unblock.isPending}
        onPress={() => unblock.mutate()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.x16, paddingBottom: Spacing.x48 },
  note: { paddingVertical: Spacing.x12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    paddingVertical: Spacing.x12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  text: { flex: 1, gap: 2 },
});
