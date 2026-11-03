import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { GameGridTile } from '@/components/game-grid-tile';
import { PORTRAIT_COLUMNS, gridItemWidth } from '@/components/gaming/game-tile';
import { MustPlayStar } from '@/components/must-play-badge';
import { Button } from '@/components/ui/button';
import { FrostedTopBar, TopBarDisc } from '@/components/ui/frosted-top-bar';
import { PageFlatList } from '@/components/ui/page-scroll';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import type { EditionKind } from '@/constants/game-editions';
import { GAME_LABEL_TEXT, type GameLabel } from '@/constants/game-labels';
import { CoverGridWindow } from '@/constants/list-window';
import { Spacing } from '@/constants/theme';
import { refreshGameLabel, setGameLabelLocally } from '@/hooks/use-game-labels';
import { useHeaderHeight } from '@/hooks/use-header-height';
import { getLabelledGames, isModerator, removeGameLabel, type LabelledGame } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { showAlert } from '@/components/ui/dialog';

const LABEL: GameLabel = 'must_play';

/** Between covers, across and down — the collection grid's. */
const GRID_GAP = Spacing.x12;

/** The star beside the screen's name — the mark alone, no wedge (2026-10-17). */
const HEAD_BADGE = 56;

/**
 * Every game a moderator has labelled Must Play (0034), newest pick first.
 *
 * Where the label leads: the badge's cell in a game page's stats strip opens
 * this, so tapping the mark on one game answers "what else has it".
 *
 * ## It is also where the list is kept
 *
 * A moderator sees two things nobody else does — a disc in the top corner that
 * opens the game picker (`/label-games`), and a long press on a cover that takes
 * the label off, after asking. The same toggle is on each game's own page.
 * Neither control is the permission: the table's policies refuse the write for
 * anybody who is not in `public.moderators`, so a hidden button is tidiness, not
 * security.
 *
 * Three across, the app's portrait size, with the title under each cover
 * (`<GameGridTile>`) — a list people read to find something to play, so the
 * names are worth their two lines. No badge on the covers: here it would be on
 * every one of them.
 */
export default function MustPlayScreen() {
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id);
  const { width } = useWindowDimensions();
  const tileWidth = gridItemWidth(width, PORTRAIT_COLUMNS, Spacing.x16, GRID_GAP);

  const games = useQuery({
    queryKey: ['labelled-games', LABEL],
    queryFn: () => getLabelledGames(LABEL),
  });

  /* The key Settings and the moderation queue already use. */
  const moderator = useQuery({
    queryKey: ['is-moderator', userId],
    queryFn: isModerator,
    enabled: !!userId,
  });
  const canEdit = moderator.data === true;

  const remove = useMutation({
    mutationFn: (gameId: string) => removeGameLabel(gameId, LABEL),
    onSuccess: (_result, gameId) => {
      setGameLabelLocally(gameId, LABEL, false);
      queryClient.invalidateQueries({ queryKey: ['labelled-games', LABEL] });
    },
    onError: (error) =>
      showAlert(
        'Could not remove the label',
        error instanceof Error ? error.message : 'Try again in a moment.'
      ),
  });

  function confirmRemove(entry: LabelledGame) {
    /* Two buttons: Android draws at most three and drops the rest. */
    showAlert(
      `Remove ${GAME_LABEL_TEXT[LABEL].title}?`,
      `${entry.game.title} loses the badge everywhere. You can label it again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(entry.game.id) },
      ]
    );
  }

  /*
   * The artwork kind of bar, on a page that keeps the bar's row clear: this
   * page opens on the badge and its name, so the bar does not say the name
   * over them. It is discs while they are in sight, and comes in carrying the
   * name once they have gone under it.
   */
  const topBar = (
    <FrostedTopBar
      back
      variant="art"
      title={GAME_LABEL_TEXT[LABEL].title}
      header={headerHeight + HEAD_BADGE}
      right={
        canEdit ? (
          <TopBarDisc
            icon="add"
            label="Label more games Must Play"
            onPress={() => router.push({ pathname: '/label-games', params: { label: LABEL } })}
          />
        ) : undefined
      }
    />
  );

  const count = games.data?.length ?? 0;

  const head = (
    <View style={styles.head}>
      <View style={styles.title}>
        <MustPlayStar size={HEAD_BADGE} labelled={false} />
        <View style={styles.titleText}>
          <Text variant="display" accessibilityRole="header">
            {GAME_LABEL_TEXT[LABEL].title}
          </Text>
          {games.data && (
            <Text variant="bodySmall" color="textMuted">
              {count} {count === 1 ? 'game' : 'games'}
            </Text>
          )}
        </View>
      </View>

      <Text variant="body" color="textSecondary">
        {GAME_LABEL_TEXT[LABEL].description}
      </Text>

      {canEdit && count > 0 && (
        <Text variant="caption" color="textMuted">
          Moderator: hold a cover to take its label off.
        </Text>
      )}
    </View>
  );

  if (games.isLoading) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={topBar}>
        <LoadingState />
      </Screen>
    );
  }

  if (games.isLoadingError) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={topBar}>
        <ErrorState error={games.error} onRetry={() => games.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']} insetHeader topBar={topBar}>
      <PageFlatList
        data={games.data ?? []}
        numColumns={PORTRAIT_COLUMNS}
        keyExtractor={(entry) => entry.game.id}
        {...CoverGridWindow}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshing={games.isRefetching}
        onRefresh={() => {
          games.refetch();
          refreshGameLabel(LABEL);
        }}
        ListHeaderComponent={head}
        renderItem={({ item }) => (
          <GameGridTile
            id={item.game.id}
            title={item.game.title}
            coverUrl={item.game.cover_url}
            heroUrl={item.game.hero_url}
            edition={(item.game.edition_kind as EditionKind | null) ?? null}
            caption={item.game.release_year}
            width={tileWidth}
            /* Every tile here has the label; the badge would be on all of them. */
            badge={false}
            onLongPress={canEdit ? () => confirmRemove(item) : undefined}
            longPressHint="Hold to remove the label"
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title="Nothing labelled yet"
            message={
              canEdit
                ? 'Pick the first one: search for a game and tap it.'
                : 'Pinged’s moderators have not picked any games yet.'
            }
            action={
              canEdit ? (
                <Button
                  title="Label a game"
                  variant="secondary"
                  onPress={() =>
                    router.push({ pathname: '/label-games', params: { label: LABEL } })
                  }
                />
              ) : undefined
            }
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  /* `flexGrow` so the empty state centres under the heading. */
  content: {
    paddingHorizontal: Spacing.x16,
    paddingBottom: Spacing.x48,
    gap: Spacing.x16,
    flexGrow: 1,
  },
  column: { gap: GRID_GAP },
  head: { gap: Spacing.x12, paddingTop: Spacing.x8, paddingBottom: Spacing.x8 },
  title: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  titleText: { flex: 1, gap: 2 },
});
