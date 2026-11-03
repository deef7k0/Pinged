import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { CARD_INSET, cardShape } from '@/components/ui/card-material';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageFlatList } from '@/components/ui/page-scroll';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { CONTRIBUTION_STATUS_LABEL, releaseLine } from '@/constants/physical';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getMyContributions, type ContributionWithRelations } from '@/lib/api';
import { displayBarcode } from '@/lib/barcode';
import type { ContributionStatus } from '@/lib/database.types';
import { timeAgo } from '@/lib/format';
import { useAuth } from '@/store/auth';

/** The glyph beside each outcome. The word always rides with it. */
const STATUS_GLYPH: Record<ContributionStatus, keyof typeof Ionicons.glyphMap> = {
  pending: 'time-outline',
  approved: 'checkmark-circle-outline',
  rejected: 'close-circle-outline',
  superseded: 'git-merge-outline',
};

/**
 * Every barcode you have described, and what became of it.
 *
 * A contribution is a claim waiting on agreement (0024), and a claim somebody
 * made and can never see again is one they have no reason to make twice. So the
 * outcome is always visible — waiting, in, not accepted (with the moderator's
 * reason), or overtaken by another description — and a pending one can still be
 * edited or withdrawn.
 */
export default function SubmissionsScreen() {
  const router = useRouter();
  const userId = useAuth((state) => state.session?.user.id) ?? null;

  const submissions = useQuery({
    queryKey: ['my-contributions', userId],
    queryFn: () => getMyContributions(userId!),
    enabled: !!userId,
  });

  return (
    <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back title="Your submissions" />}>
      <PageFlatList
        data={submissions.data ?? []}
        keyExtractor={(entry) => entry.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.head}>
            <Text variant="bodySmall" color="textMuted">
              Barcodes you have described. A release goes in once someone else with the same box
              agrees, or a moderator approves it.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <SubmissionRow
            entry={item}
            onPress={
              item.status === 'pending'
                ? () => router.push({ pathname: '/add-release', params: { contribution: item.id } })
                : undefined
            }
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          !userId ? (
            <EmptyState title="Sign in to see your submissions" />
          ) : submissions.isLoading ? (
            <LoadingState />
          ) : submissions.isLoadingError ? (
            <ErrorState error={submissions.error} onRetry={() => void submissions.refetch()} />
          ) : (
            <EmptyState
              title="No submissions yet"
              message="When you scan a barcode Pinged does not know, you can describe the release — it shows up here."
            />
          )
        }
      />
    </Screen>
  );
}

function SubmissionRow({
  entry,
  onPress,
}: {
  entry: ContributionWithRelations;
  onPress?: () => void;
}) {
  const theme = useTheme();

  const body = (
    <View
      style={[
        cardShape,
        styles.row,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}>
      <Poster
        coverUrl={entry.game?.cover_url ?? null}
        heroUrl={entry.game?.hero_url ?? null}
        title={entry.game?.title ?? ''}
        width={48}
        rounded="image"
      />
      <View style={styles.rowText}>
        <Text variant="h5" numberOfLines={2}>
          {entry.game?.title ?? 'Unknown game'}
        </Text>
        <Text variant="bodySmall" color="textSecondary" numberOfLines={1}>
          {releaseLine(entry)} · {displayBarcode(entry.barcode)}
        </Text>
        <View style={styles.status}>
          <Ionicons name={STATUS_GLYPH[entry.status]} size={13} color={theme.textMuted} />
          <Text variant="caption" color="textMuted">
            {CONTRIBUTION_STATUS_LABEL[entry.status]} · {timeAgo(entry.created_at)}
          </Text>
        </View>
        {entry.status === 'rejected' && entry.review_note && (
          <Text variant="caption" color="textSecondary">
            “{entry.review_note}”
          </Text>
        )}
      </View>
      {onPress && <Ionicons name="create-outline" size={18} color={theme.textMuted} />}
    </View>
  );

  if (!onPress) {
    return (
      <View
        accessible
        accessibilityLabel={`${entry.game?.title ?? 'Unknown game'}, ${releaseLine(entry)}. ${CONTRIBUTION_STATUS_LABEL[entry.status]}.`}>
        {body}
      </View>
    );
  }

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${entry.game?.title ?? 'Unknown game'}, ${releaseLine(entry)}. ${CONTRIBUTION_STATUS_LABEL[entry.status]}. Edit it.`}
      onPress={onPress}
      scaleTo={0.98}>
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.x16, paddingBottom: Spacing.x48 },
  head: { gap: Spacing.x8, marginBottom: Spacing.x24 },
  separator: { height: Spacing.x8 },
  /* Every card's material (`card-material`). */
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12, padding: CARD_INSET },
  rowText: { flex: 1, gap: 2 },
  status: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
});
