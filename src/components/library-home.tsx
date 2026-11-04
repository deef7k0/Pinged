import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Link, useRouter, type Href } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { gridItemWidth } from '@/components/gaming/game-tile';
import { HomeSection } from '@/components/home-section';
import { PageScrollView } from '@/components/ui/page-scroll';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { STATUS_LABEL } from '@/constants/status';
import { Radius, Spacing, TapTarget, Type } from '@/constants/theme';
import { useSquareCover } from '@/hooks/use-square-cover';
import { useTheme } from '@/hooks/use-theme';
import { MAX_PINS, getLibraryPins, unpinGame } from '@/lib/api';
import type { CachedGame, LogWithRelations } from '@/lib/database.types';
import { showAlert } from '@/components/ui/dialog';
import { toast } from '@/lib/toast';

/** The library's lists, as the rows under the pinned games. */
export type LibraryRow = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  count: number | null;
  href: Href;
};

/** How many of the newest logs stand under "Recently added". */
const RECENT_SHOWN = 6;

/**
 * The head of a library, as Apple Music's Library (the owner's reference,
 * 2026-10-22): up to six pinned games three across, square, the name under
 * each; the lists as rows — a glyph in the accent, the name, a count and a
 * chevron, a hairline from the name to the edge; then the newest games, two
 * across.
 *
 * Pins are the owner's own choice (0043): a "+" in the grid while there are
 * fewer than six, and holding a pinned game unpins it. Somebody else's library
 * shows their pins and nothing to add.
 */
export function LibraryHome({
  userId,
  isSelf,
  rows,
  recent,
  recentLoading,
}: {
  userId: string;
  isSelf: boolean;
  rows: readonly LibraryRow[];
  recent: readonly LogWithRelations[];
  recentLoading: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();

  const pins = useQuery({
    queryKey: ['library-pins', userId],
    queryFn: () => getLibraryPins(userId),
  });

  const unpin = useMutation({
    mutationFn: (gameId: string) => unpinGame(userId, gameId),
    onSuccess: () => {
      toast.success('Unpinned');
      return queryClient.invalidateQueries({ queryKey: ['library-pins', userId] });
    },
    onError: (error) =>
      showAlert('Could not unpin', error instanceof Error ? error.message : undefined),
  });

  const pinned = pins.data ?? [];
  const canAdd = isSelf && !pins.isLoading && pinned.length < MAX_PINS;
  const pinSize = gridItemWidth(width, 3, Spacing.x16, Spacing.x12);
  const recentSize = gridItemWidth(width, 2, Spacing.x16, Spacing.x12);

  const confirmUnpin = (game: CachedGame) =>
    showAlert(`Unpin ${game.title}?`, 'It stays in your library.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unpin', style: 'destructive', onPress: () => unpin.mutate(game.id) },
    ]);

  const recentGames = recent.filter((log) => log.game).slice(0, RECENT_SHOWN);

  return (
    <PageScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      {(pins.isLoading || pinned.length > 0 || isSelf) && (
        <View style={styles.pins}>
          {pins.isLoading
            ? [0, 1, 2].map((index) => (
                <Skeleton key={index} width={pinSize} height={pinSize} radius={Radius.image} />
              ))
            : pinned.map(({ game }) => (
                <SquareTile
                  key={game.id}
                  game={game}
                  size={pinSize}
                  centred
                  onLongPress={isSelf ? () => confirmUnpin(game) : undefined}
                />
              ))}
          {canAdd && (
            <AddPinTile
              size={pinSize}
              first={pinned.length === 0}
              onPress={() => router.push('/pin-game')}
            />
          )}
        </View>
      )}

      <View style={styles.rows}>
        {rows.map((row) => (
          <LibraryRowLink key={row.key} row={row} />
        ))}
      </View>

      {(recentLoading || recentGames.length > 0) && (
        <HomeSection title="Recently added">
          <View style={styles.recent}>
            {recentLoading
              ? [0, 1].map((index) => (
                  <Skeleton
                    key={index}
                    width={recentSize}
                    height={recentSize}
                    radius={Radius.image}
                  />
                ))
              : recentGames.map((log) => (
                  <SquareTile
                    key={log.id}
                    game={log.game!}
                    size={recentSize}
                    line={log.game!.developer ?? STATUS_LABEL[log.status]}
                  />
                ))}
          </View>
        </HomeSection>
      )}
    </PageScrollView>
  );
}

/** One list, as a row: glyph, name, count, chevron, and the hairline under it. */
function LibraryRowLink({ row }: { row: LibraryRow }) {
  const theme = useTheme();
  return (
    <Link href={row.href} asChild>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={row.count != null ? `${row.label}, ${row.count}` : row.label}
        scaleTo={0.98}
        style={StyleSheet.flatten(styles.row)}>
        <Ionicons name={row.icon} size={22} color={theme.primaryText} style={styles.rowIcon} />
        <View style={[styles.rowBody, { borderBottomColor: theme.border }]}>
          <Text style={styles.rowLabel} numberOfLines={1}>
            {row.label}
          </Text>
          {row.count != null && (
            <Text variant="body" color="textMuted">
              {row.count.toLocaleString()}
            </Text>
          )}
          <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
        </View>
      </PressableScale>
    </Link>
  );
}

/**
 * A game as a square — SteamGridDB's square where there is one, the box art
 * cropped where there is not — with its name under it.
 */
const SquareTile = memo(function SquareTile({
  game,
  size,
  line,
  centred = false,
  onLongPress,
}: {
  game: CachedGame;
  size: number;
  /** A second, quieter line under the name. */
  line?: string | null;
  centred?: boolean;
  onLongPress?: () => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const square = useSquareCover({ gameId: game.id, title: game.title });
  const uri = square.uri ?? game.cover_url ?? game.hero_url;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={game.title}
      accessibilityHint={onLongPress ? 'Hold to unpin' : undefined}
      onPress={() => router.push({ pathname: '/game/[id]', params: { id: game.id } })}
      onLongPress={onLongPress}
      scaleTo={0.96}
      style={StyleSheet.flatten([styles.tile, { width: size }])}>
      <View
        style={[styles.art, { width: size, height: size, backgroundColor: theme.surfaceElevated }]}>
        {square.resolved && uri && (
          <Image
            source={{ uri }}
            style={styles.image}
            contentFit="cover"
            contentPosition="top"
            transition={180}
            cachePolicy="memory-disk"
            recyclingKey={uri}
            accessibilityIgnoresInvertColors
          />
        )}
      </View>
      <Text variant="optionTitle" numberOfLines={1} style={centred ? styles.centred : undefined}>
        {game.title}
      </Text>
      {line ? (
        <Text variant="body" color="primaryText" numberOfLines={1}>
          {line}
        </Text>
      ) : null}
    </PressableScale>
  );
});

function AddPinTile({
  size,
  first,
  onPress,
}: {
  size: number;
  first: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Pin a game"
      onPress={onPress}
      scaleTo={0.96}
      style={StyleSheet.flatten([styles.tile, { width: size }])}>
      <View
        style={[
          styles.art,
          styles.addArt,
          { width: size, height: size, borderColor: theme.outline },
        ]}>
        <Ionicons name="add" size={28} color={theme.textSecondary} />
      </View>
      <Text variant="optionTitle" color="textSecondary" numberOfLines={1} style={styles.centred}>
        {first ? 'Pin a game' : 'Pin another'}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: Spacing.x8, paddingBottom: Spacing.x48, gap: Spacing.x24 },
  pins: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.x12,
    rowGap: Spacing.x16,
    paddingHorizontal: Spacing.x16,
  },
  tile: { gap: Spacing.x4 },
  art: { borderRadius: Radius.image, overflow: 'hidden' },
  addArt: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  image: { width: '100%', height: '100%' },
  centred: { textAlign: 'center' },
  rows: { paddingLeft: Spacing.x16 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: TapTarget + Spacing.x4 },
  rowIcon: { width: 32 },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    alignSelf: 'stretch',
    paddingRight: Spacing.x16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  /* The reference's rows are set larger than body and in the regular weight. */
  rowLabel: { ...Type.h3, fontFamily: Type.body.fontFamily, flex: 1 },
  recent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.x12,
    rowGap: Spacing.x16,
    paddingHorizontal: Spacing.x16,
  },
});
