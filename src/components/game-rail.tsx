import { useRouter } from 'expo-router';
import { memo, useCallback, useMemo, type ReactNode } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { useSectionInset } from '@/components/ui/section';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { RAIL_FOOT, railLayout, type RailLayout } from '@/constants/cover-rail';
import { PosterAspectRatio, Radius } from '@/constants/theme';
import { useRailDrift } from '@/hooks/use-rail-drift';
import type { GameSearchResult } from '@/lib/games';

/** What a cover rail needs of a game — a search result, a full record, a chart row. */
export type CoverRailGame = Pick<
  GameSearchResult,
  'id' | 'title' | 'coverUrl' | 'heroUrl' | 'edition' | 'releaseYear'
> & {
  /** Steam's own capsule, where there is one; IGDB's cover otherwise. */
  steamAppId?: string | null;
};

/** A row's covers for this window. See `constants/cover-rail`. */
export function useRailLayout(): RailLayout {
  const { width } = useWindowDimensions();
  return useMemo(() => railLayout(width), [width]);
}

export type CoverRailProps<T> = {
  data: readonly T[];
  keyOf: (item: T) => string;
  /** The game whose box an item draws. */
  gameOf: (item: T) => CoverRailGame;
  /** What stands under a cover, when something does. Its height is the caller's to keep equal. */
  footOf?: (item: T, width: number) => ReactNode;
  /** What a screen reader says for an item. The game's title, when absent. */
  labelOf?: (item: T) => string;
  /** Drawn on the cover itself, over its foot, clipped to its corner (Home's "New from friends"). */
  overlayOf?: (item: T, width: number) => ReactNode;
  onPressItem: (item: T) => void;
  /**
   * Let a cover wear the game's label (Must Play). Off for a row that is about
   * people rather than the catalogue — CLAUDE.md § Labels.
   */
  labelled?: boolean;
  /** Where the first cover starts, when it is not the inset in force. */
  inset?: number;
  /**
   * The art slides behind its frame as the rail moves — Home's rails, which
   * always have. Off elsewhere, and under a reduced-motion preference.
   */
  parallax?: boolean;
};

/**
 * Covers in a row: the one shape a row of games takes in the app.
 *
 * The owner's reference is Letterboxd's home (`constants/cover-rail` has the
 * numbers): small box art, a little over three in view, and **nothing printed
 * under a cover** — the box is the label. A row prints under its covers only
 * what the box cannot say, through `footOf`: whose activity it is, what the
 * people here scored it, where it stands in a chart.
 *
 * A title that is not drawn is still spoken: each cover is one button, named
 * for its game.
 *
 * It stands on the page under its section's heading — never in a card: the
 * first build put every row in a panel, and the owner had the panels removed.
 * `inset` is where its first cover starts (the page's margin, or the section
 * inset on a game's page), and it runs off the far edge. Windowed like every
 * rail in the app: a screenful and a little more up front, one screen either
 * side.
 */
export function CoverRail<T>({
  data,
  keyOf,
  gameOf,
  footOf,
  labelOf,
  overlayOf,
  onPressItem,
  labelled = true,
  inset: insetProp,
  parallax = false,
}: CoverRailProps<T>) {
  const layout = useRailLayout();
  const contextInset = useSectionInset();
  const inset = insetProp ?? contextInset;
  const reduceMotion = useReducedMotion();
  const { width } = layout.cover;
  const itemStride = width + layout.gap;

  /* Written and read on the UI thread, so a drag never enters JS. */
  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.set(event.contentOffset.x);
  });
  const driver = parallax && !reduceMotion ? scrollX : null;

  const getItemLayout = useCallback(
    (_data: unknown, index: number) => ({
      length: itemStride,
      offset: itemStride * index,
      index,
    }),
    [itemStride]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: T; index: number }) => (
      <RailItem
        item={item}
        index={index}
        width={width}
        gap={layout.gap}
        inset={inset}
        labelled={labelled}
        driver={driver}
        gameOf={gameOf}
        labelOf={labelOf}
        footOf={footOf}
        overlayOf={overlayOf}
        onPressItem={onPressItem}
      />
    ),
    [width, layout.gap, inset, labelled, driver, gameOf, labelOf, footOf, overlayOf, onPressItem]
  );

  return (
    <Animated.FlatList
      data={data}
      horizontal
      keyExtractor={keyOf}
      showsHorizontalScrollIndicator={false}
      initialNumToRender={5}
      maxToRenderPerBatch={5}
      windowSize={3}
      getItemLayout={getItemLayout}
      removeClippedSubviews={Platform.OS === 'android'}
      onScroll={driver ? onScroll : undefined}
      scrollEventThrottle={16}
      contentContainerStyle={{ paddingHorizontal: inset, gap: layout.gap }}
      renderItem={renderItem}
    />
  );
}

type RailItemProps<T> = {
  item: T;
  index: number;
  width: number;
  gap: number;
  inset: number;
  labelled: boolean;
  driver: SharedValue<number> | null;
  gameOf: (item: T) => CoverRailGame;
  labelOf?: (item: T) => string;
  footOf?: (item: T, width: number) => ReactNode;
  overlayOf?: (item: T, width: number) => ReactNode;
  onPressItem: (item: T) => void;
};

const RailItem = memo(function RailItem<T>({
  item,
  index,
  width,
  gap,
  inset,
  labelled,
  driver,
  gameOf,
  labelOf,
  footOf,
  overlayOf,
  onPressItem,
}: RailItemProps<T>) {
  const game = gameOf(item);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={labelOf?.(item) ?? game.title}
      onPress={() => onPressItem(item)}
      scaleTo={0.96}>
      <View style={{ width }}>
        <RailCover
          game={game}
          width={width}
          index={index}
          scrollX={driver}
          leading={inset}
          gap={gap}
          labelled={labelled}
        />
        {overlayOf && (
          <View
            pointerEvents="none"
            style={[styles.overlay, { width, height: Math.round(width / PosterAspectRatio) }]}>
            {overlayOf(item, width)}
          </View>
        )}
        {footOf && <View style={styles.foot}>{footOf(item, width)}</View>}
      </View>
    </PressableScale>
  );
}) as <T>(props: RailItemProps<T>) => ReactNode;

/**
 * A row of games, each opening its page.
 *
 * `lineOf` is the one quiet line a cover may carry — a rank, a date — and
 * there is none unless a caller gives one: the game's name and year are on
 * its box and its page. `footOf` is for a row whose line is not plain text
 * (a score in the score's own colour).
 */
export function GameCoverRail<T extends CoverRailGame>({
  games,
  lineOf,
  footOf,
  labelOf,
  inset,
  parallax = false,
}: {
  games: readonly T[];
  lineOf?: (game: T) => string | null;
  footOf?: (game: T, width: number) => ReactNode;
  /** What a screen reader says for a cover, when its title alone is not enough. */
  labelOf?: (game: T) => string;
  inset?: number;
  parallax?: boolean;
}) {
  const router = useRouter();

  const foot =
    footOf ??
    (lineOf
      ? (game: T) => (
          /* `textSecondary`, not `textMuted`: a panel is see-through and the
             light behind Home and Search passes under these lines, where the
             muted grey falls under AA. */
          <Text variant="bodySmall" color="textSecondary" numberOfLines={1} style={styles.line}>
            {lineOf(game) ?? ''}
          </Text>
        )
      : undefined);

  return (
    <CoverRail
      data={games}
      keyOf={(game) => game.id}
      gameOf={(game) => game}
      footOf={foot}
      labelOf={labelOf}
      inset={inset}
      parallax={parallax}
      onPressItem={(game) => router.push({ pathname: '/game/[id]', params: { id: game.id } })}
    />
  );
}

/** One cover, lifted out of the rail's render so it can hold `useRailDrift`. */
function RailCover({
  game,
  width,
  index,
  scrollX,
  leading,
  gap,
  labelled,
}: {
  game: CoverRailGame;
  width: number;
  index: number;
  scrollX: SharedValue<number> | null;
  leading: number;
  gap: number;
  labelled: boolean;
}) {
  const drift = useRailDrift(scrollX, index, { pitch: width + gap, leading, itemWidth: width });

  return (
    <Poster
      coverUrl={game.coverUrl}
      heroUrl={game.heroUrl}
      title={game.title}
      edition={game.edition}
      gameId={labelled ? game.id : undefined}
      steamAppId={game.steamAppId}
      width={width}
      rounded="image"
      parallax={drift}
    />
  );
}

/**
 * The rail's shape while its games load: the same covers, and the same room
 * under them when the real row will have a foot, so nothing moves when it
 * arrives.
 */
export function CoverRailSkeleton({
  count = 5,
  foot = 0,
  inset,
}: {
  count?: number;
  /** The height of what the real row prints under a cover (`footHeight`). */
  foot?: number;
  inset?: number;
}) {
  const layout = useRailLayout();
  const contextInset = useSectionInset();
  const { width, height } = layout.cover;

  return (
    <View
      style={[styles.skeleton, { paddingLeft: inset ?? contextInset, gap: layout.gap }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={{ width, paddingBottom: foot }}>
          <Skeleton width={width} height={height} radius={Radius.image} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  foot: { paddingTop: RAIL_FOOT.top },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: Radius.image,
    borderCurve: 'continuous',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  /* Held at one line whatever it says, so a row is one height. */
  line: { height: RAIL_FOOT.line },
  /* Clipped rather than scrolled: the covers run off the trailing edge as the
     real rail's do. */
  skeleton: { flexDirection: 'row', overflow: 'hidden' },
});
