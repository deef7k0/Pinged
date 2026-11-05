import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { AnchoredMenu, AnchoredMenuItem, useAnchoredMenu } from '@/components/ui/anchored-menu';
import { FrostedTopBar, TopBarDisc } from '@/components/ui/frosted-top-bar';
import { PageFlatList } from '@/components/ui/page-scroll';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { copyStateLine, releaseLine } from '@/constants/physical';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCopies, getProfile, type CopyWithRelations } from '@/lib/api';
import { displayNameFor } from '@/lib/format';
import { useAuth } from '@/store/auth';

/** Between the two columns of covers. */
const GRID_GAP = Spacing.x12;

/**
 * Someone's physical collection: every copy they own, newest first.
 *
 * `game` narrows it to one game's copies — "your copies of Resident Evil 2" —
 * which is where a game page's "Your copies" lands when there is more than one.
 *
 * Every row is the quick view, and only the quick view: the game, the release in
 * one line, the state in another. The detail — the barcode, the notes, what
 * "very good" means — is a tap away on the copy itself, so a shelf of two hundred
 * games stays a list you can scan.
 */
export default function CopiesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, game } = useLocalSearchParams<{ user: string; game?: string }>();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;
  const isSelf = viewerId === user;

  const owner = useQuery({
    queryKey: ['profile', user],
    queryFn: () => getProfile(user!),
    enabled: !!user,
  });

  const copies = useQuery({
    queryKey: ['copies', user, game ?? 'all'],
    queryFn: () => getCopies(user!, game),
    enabled: !!user,
  });

  const count = copies.data?.length ?? 0;
  const [trigger, menu] = useAnchoredMenu();
  const { width } = useWindowDimensions();
  const tile = Math.floor((Math.min(width, MaxContentWidth) - Spacing.x16 * 2 - GRID_GAP) / 2);
  const gameTitle = game ? copies.data?.[0]?.game?.title : null;
  const ownerName = isSelf ? 'You' : displayNameFor(owner.data ?? null);

  return (
    <Screen
      edges={['bottom']}
      insetHeader
      topBar={
        <FrostedTopBar
          back
          title={gameTitle ? `Copies of ${gameTitle}` : 'Physical collection'}
          right={
            isSelf ? (
              /* Scan and Add are the + in the bar (the Apple pass,
                 2026-11-05); they were two buttons at the head. */
              <View ref={trigger} collapsable={false}>
                <TopBarDisc icon="add" label="Add a copy" onPress={menu.open} />
              </View>
            ) : undefined
          }
        />
      }>
      <AnchoredMenu menu={menu} label="Add a copy" align="end">
        <AnchoredMenuItem
          icon="barcode-outline"
          title="Scan a barcode"
          onPress={() => {
            menu.close();
            router.push('/scan');
          }}
        />
        <AnchoredMenuItem
          icon="create-outline"
          title="Add by hand"
          onPress={() => {
            menu.close();
            router.push(game ? { pathname: '/add-copy', params: { game } } : '/add-copy');
          }}
        />
      </AnchoredMenu>
      <PageFlatList
        data={copies.data ?? []}
        keyExtractor={(copy) => copy.id}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.head}>
            {copies.data && (
              <Text variant="body" color="textSecondary">
                {`${ownerName === 'You' ? 'Your' : `${ownerName}’s`} ${count} ${
                  count === 1 ? 'copy' : 'copies'
                }`}
              </Text>
            )}

            {isSelf && (
              <Link href="/submissions" asChild>
                <PressableScale
                  accessibilityRole="link"
                  accessibilityLabel="Your barcode submissions"
                  hitSlop={Spacing.x8}
                  scaleTo={0.98}
                  style={styles.submissions}>
                  <Ionicons name="barcode-outline" size={14} color={theme.textSecondary} />
                  <Text variant="bodySmall" color="textSecondary">
                    Your barcode submissions
                  </Text>
                </PressableScale>
              </Link>
            )}
          </View>
        }
        renderItem={({ item }) => <CopyTile copy={item} width={tile} />}
        ListEmptyComponent={
          copies.isLoading ? (
            <LoadingState />
          ) : copies.isLoadingError ? (
            <ErrorState error={copies.error} onRetry={() => void copies.refetch()} />
          ) : (
            <EmptyState
              title={isSelf ? 'Nothing on your shelf yet' : 'No physical copies yet'}
              message={
                isSelf
                  ? 'Scan the barcode on a box, or add a copy by hand — the release, what came with it and its condition.'
                  : `${ownerName} has not added any physical copies.`
              }
            />
          )
        }
      />
    </Screen>
  );
}

/**
 * One copy as a cover in a two-across grid (the Apple pass, 2026-11-05) —
 * the box, the game's name, and its release and state in a quiet line. It was
 * a card per copy with a small box beside the words.
 *
 * Memoised: this renders once per tile of a grid that can be a whole shelf.
 */
const CopyTile = memo(function CopyTile({
  copy,
  width,
}: {
  copy: CopyWithRelations;
  width: number;
}) {
  const theme = useTheme();
  const release = releaseLine(copy);
  const state = copyStateLine(copy);
  const waiting = !copy.release_id && copy.contribution?.status === 'pending';

  return (
    <Link href={{ pathname: '/copy/[id]', params: { id: copy.id } }} asChild>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={[
          copy.game?.title,
          release,
          state,
          waiting ? 'release pending review' : null,
        ]
          .filter(Boolean)
          .join(', ')}
        scaleTo={0.97}
        style={StyleSheet.flatten([styles.tile, { width }])}>
        <Poster
          coverUrl={copy.game?.cover_url ?? null}
          heroUrl={copy.game?.hero_url ?? null}
          title={copy.game?.title ?? ''}
          width={width}
          rounded="image"
          zoomable={false}
        />
        <Text variant="bodySmall" numberOfLines={1}>
          {copy.game?.title ?? 'Unknown game'}
        </Text>
        {(release || state) && (
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {[release, state].filter(Boolean).join(' · ')}
          </Text>
        )}
        {waiting && (
          <View style={styles.pending}>
            <Ionicons name="time-outline" size={12} color={theme.textMuted} />
            <Text variant="caption" color="textMuted">
              Pending review
            </Text>
          </View>
        )}
      </PressableScale>
    </Link>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.x16, paddingBottom: Spacing.x48 },
  head: { gap: Spacing.x8, marginBottom: Spacing.x24 },
  column: { gap: GRID_GAP, marginBottom: Spacing.x20 },
  tile: { gap: 2 },
  submissions: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.x4,
  },
  pending: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
});
