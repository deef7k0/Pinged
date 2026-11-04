import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { useTabBarClearance } from '@/components/app-tab-bar';
import { PageFlatList } from '@/components/ui/page-scroll';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { FontFamily, MaxContentWidth, Palette, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getPopularGames } from '@/lib/news';

/** Two across, ten between, at the page's margin — the reference's grid. */
const COLUMNS = 2;
const GAP = 10;
const RADIUS = 10;
/** Apple TV's search tiles are a little taller than 16:9. */
const TILE_RATIO = 0.6;
const TRENDING = 24;

type Tile =
  | { kind: 'door'; key: string; title: string; icon: keyof typeof Ionicons.glyphMap; href: Href }
  | {
      kind: 'game';
      key: string;
      id: string;
      title: string;
      art: string | null;
    };

const DOORS: Tile[] = [
  { kind: 'door', key: 'top', title: 'Top 1000', icon: 'trophy', href: '/top-chart' },
  { kind: 'door', key: 'calendar', title: 'Release calendar', icon: 'calendar', href: '/calendar' },
];

const SCRIM = [withAlpha(Palette.shadowInk, 0), withAlpha(Palette.shadowInk, 0.7)] as const;
const SCRIM_STOPS = [0.4, 1] as const;

/**
 * The Search tab before anything is typed (the owner's reference,
 * 2026-11-03 — Apple TV's Search): under the field, a grid of landscape
 * tiles, two across. Its first two are doors, as Apple TV's channels are —
 * the Top 1000 and the release calendar — and the rest are the games
 * people are looking at this month, on their key art, each named at its foot
 * (there is no game logo to print, by the owner's earlier ruling). What
 * Search used to show here lives in Explore now.
 */
export const SearchBrowse = memo(function SearchBrowse() {
  const theme = useTheme();
  const clearance = useTabBarClearance();
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(windowWidth, MaxContentWidth);
  const tileWidth = Math.floor((width - Spacing.x16 * 2 - GAP * (COLUMNS - 1)) / COLUMNS);
  const tileHeight = Math.round(tileWidth * TILE_RATIO);

  const trending = useQuery({
    queryKey: ['popular-games', TRENDING],
    queryFn: ({ signal }) => getPopularGames(TRENDING, signal),
    staleTime: 30 * 60_000,
  });

  const games: Tile[] = (trending.data?.entries ?? []).map((entry) => ({
    kind: 'game',
    key: entry.gameId,
    id: entry.gameId,
    title: entry.title,
    art: entry.heroUrl ?? entry.coverUrl,
  }));
  const placeholders: Tile[] = trending.isPending
    ? Array.from({ length: 8 }, (_, index) => ({
        kind: 'game' as const,
        key: `placeholder-${index}`,
        id: '',
        title: '',
        art: null,
      }))
    : [];
  const tiles = [...DOORS, ...games, ...placeholders];

  return (
    <PageFlatList
      data={tiles}
      numColumns={COLUMNS}
      keyExtractor={(tile) => tile.key}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      columnWrapperStyle={styles.row}
      contentContainerStyle={[styles.grid, { paddingBottom: Spacing.x48 + clearance }]}
      initialNumToRender={12}
      windowSize={7}
      renderItem={({ item }) =>
        item.kind === 'door' ? (
          <Door tile={item} width={tileWidth} height={tileHeight} />
        ) : item.id === '' ? (
          <Skeleton width={tileWidth} height={tileHeight} radius={RADIUS} />
        ) : (
          <GameTile
            tile={item}
            width={tileWidth}
            height={tileHeight}
            ground={theme.surfaceElevated}
          />
        )
      }
    />
  );
});

function Door({
  tile,
  width,
  height,
}: {
  tile: Extract<Tile, { kind: 'door' }>;
  width: number;
  height: number;
}) {
  const router = useRouter();
  const theme = useTheme();
  const top = tile.key === 'top';

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={tile.title}
      onPress={() => router.push(tile.href)}
      scaleTo={0.96}>
      <View
        style={[
          styles.tile,
          styles.door,
          { width, height, backgroundColor: top ? theme.shadowInk : theme.surfaceSelected },
        ]}>
        {!top && (
          <LinearGradient
            colors={[withAlpha(theme.primary, 0.55), withAlpha(theme.primary, 0.05)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <Ionicons name={tile.icon} size={22} color={theme.white} />
        <Text numberOfLines={2} style={styles.doorTitle}>
          {tile.title}
        </Text>
      </View>
    </PressableScale>
  );
}

function GameTile({
  tile,
  width,
  height,
  ground,
}: {
  tile: Extract<Tile, { kind: 'game' }>;
  width: number;
  height: number;
  ground: string;
}) {
  const router = useRouter();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${tile.title}. Opens the game.`}
      onPress={() => router.push({ pathname: '/game/[id]', params: { id: tile.id } })}
      scaleTo={0.96}>
      <View style={[styles.tile, { width, height, backgroundColor: ground }]}>
        {tile.art && (
          <Image
            source={{ uri: tile.art }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            recyclingKey={tile.art}
            accessibilityIgnoresInvertColors
          />
        )}
        <LinearGradient colors={SCRIM} locations={SCRIM_STOPS} style={StyleSheet.absoluteFill} />
        <Text numberOfLines={1} style={styles.name}>
          {tile.title}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  grid: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x16, gap: GAP },
  row: { gap: GAP },
  tile: { borderRadius: RADIUS, overflow: 'hidden', justifyContent: 'flex-end' },
  door: { padding: Spacing.x12, justifyContent: 'space-between' },
  doorTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 17,
    lineHeight: 21,
    letterSpacing: -0.3,
    color: Palette.white,
  },
  name: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    lineHeight: 16,
    color: Palette.white,
    paddingHorizontal: Spacing.x8,
    paddingBottom: Spacing.x8 - 2,
  },
});
