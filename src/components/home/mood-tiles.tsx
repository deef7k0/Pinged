import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { runOnJS, useAnimatedReaction, useSharedValue } from 'react-native-reanimated';

import { Arrive } from '@/components/ui/arrive';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { identityColorFor } from '@/constants/identity';
import {
  ART_OFFSET,
  ART_RADIUS,
  ART_SIZE,
  ART_TURN,
  GRADIENT_ANGLE,
  NAME_LINES,
  NAME_TYPE,
  TILE_GAP,
  TILE_INK,
  TILE_PAD,
  TILE_RADIUS,
  tileGradient,
  tileSize,
} from '@/constants/mood-tile';
import { Spacing } from '@/constants/theme';
import { useHomeGenres } from '@/hooks/use-home-genres';
import { useScreenChrome } from '@/hooks/use-screen-chrome';
import { useTheme } from '@/hooks/use-theme';
import { genreFeed } from '@/lib/games/genre-feed';
import { getFeedArtwork } from '@/lib/games/mood-feed';
import { MOODS, moodFor, type HomeFeed } from '@/lib/games/moods';
import { angledGradient } from '@/lib/home-glow';
import type { HomeView } from '@/lib/home-view';

/**
 * The foot of Home, whatever it is showing — SimpMusic's "Moods & Genres"
 * browse grid, at the owner's direction (2026-10-22): "Make mood and genre
 * buttons like the ones in simpmusic search screen, being blocks in a gradient
 * color with an image from a song."
 *
 * A line, then one block per section — the ten moods, then the ten genres —
 * each a 2:1 tile in its own hue as a gradient, with the name in white at the
 * top-left and **one game's cover tilted off the bottom-right corner**. Two to
 * a row, twelve apart, as the reference's `LazyVerticalGrid` lays them out on a
 * phone. `constants/mood-tile` holds every measurement, the gradient and the
 * ink, with the file each was read from, under `npm test`.
 *
 * A tile picks its mood or genre as the chips do — Home reloads in place with
 * that feed's shelves; a genre opened a page of its own until the owner had it
 * work as a mood does.
 *
 * It replaced the reference's *other* moods grid, `MoodMomentAndGenre` — small
 * striped cards, three rows deep, sliding sideways — which is what SimpMusic
 * puts at the foot of its own Home. The owner asked for the search screen's
 * blocks instead, and a 2:1 block in a three-row carousel would be a stamp.
 *
 * ## The covers arrive late, and only if you come this far
 *
 * The reference requests a category's artwork from inside the tile
 * (`LaunchedEffect(item.params) { loadMoodArtwork(…) }`), and says why: "a
 * category the user never scrolls to never costs a browse." That matters more
 * here than there — twenty tiles is twenty IGDB requests against credentials
 * every phone in the app shares — so the grid asks for nothing until it has
 * been scrolled to, and then its requests go through `mood-feed`'s own pacer,
 * behind whatever feed is on screen. They are kept on the device for a week.
 * A tile is finished without its cover and only ever gains one.
 */
export function MoodTiles({ onView }: { onView: (view: HomeView) => void }) {
  const genres = useHomeGenres();
  const { onLayout, seen } = useScrolledTo();

  const moodTiles: Tile[] = useMemo(
    () =>
      MOODS.map((mood) => ({
        key: `mood:${mood.key}`,
        title: mood.label,
        hueOf: (theme) => theme[mood.hue],
        label: `${mood.label} mood`,
        feed: () => moodFor(mood.key),
        view: { kind: 'mood', mood: mood.key },
      })),
    []
  );

  const genreTiles: Tile[] = useMemo(
    () =>
      genres.map(({ id, label, genre }) => ({
        key: `genre:${id}`,
        title: label,
        hueOf: (theme) => identityColorFor([genre.identity], theme),
        label: `${label} games`,
        feed: () => genreFeed({ id, label }),
        view: { kind: 'genre', genre: { id, label } },
      })),
    [genres]
  );

  return (
    <View style={styles.block} onLayout={onLayout}>
      <Text variant="body" color="textSecondary" style={styles.inset}>
        Let&apos;s pick a mood for you
      </Text>
      <TileGrid title="Moods & moments" tiles={moodTiles} seen={seen} onView={onView} />
      {genreTiles.length > 0 && (
        <TileGrid title="Genres" tiles={genreTiles} seen={seen} onView={onView} />
      )}
    </View>
  );
}

type Tile = {
  key: string;
  title: string;
  /** The tile's hue, read from the theme — a mood's own, or the genre's identity. */
  hueOf: (theme: ReturnType<typeof useTheme>) => string;
  label: string;
  /** The feed behind it, built only when its cover is asked for. */
  feed: () => HomeFeed;
  view: HomeView;
};

function TileGrid({
  title,
  tiles,
  seen,
  onView,
}: {
  title: string;
  tiles: readonly Tile[];
  seen: boolean;
  onView: (view: HomeView) => void;
}) {
  const { width: display } = useWindowDimensions();
  const size = useMemo(() => tileSize(display, Spacing.x16), [display]);

  /* Plain rows, not a nested list: twenty tiles is twenty, and a vertical
     `FlatList` inside Home's scroller would be a scroller inside a scroller. */
  const rows = useMemo(() => {
    const out: Tile[][] = [];
    for (let index = 0; index < tiles.length; index += 2) out.push(tiles.slice(index, index + 2));
    return out;
  }, [tiles]);

  return (
    <View style={styles.section}>
      <Text variant="h4" accessibilityRole="header" style={styles.inset}>
        {title}
      </Text>
      <View style={styles.grid}>
        {rows.map((row, index) => (
          <View key={row[0].key} style={styles.row}>
            {row.map((tile) => (
              <MoodTile
                key={tile.key}
                tile={tile}
                size={size}
                /* Only the rows above the fold of this block go first: the
                   pacer keeps the rest in order behind them anyway. */
                seen={seen}
                row={index}
                onView={onView}
              />
            ))}
            {row.length === 1 && <View style={{ width: size.width }} />}
          </View>
        ))}
      </View>
    </View>
  );
}

/** A tile's cover is kept for a week: the most-rated game of a mood barely moves. */
const ART_STALE_MS = 7 * 24 * 60 * 60_000;

const MoodTile = memo(function MoodTile({
  tile,
  size,
  seen,
  row,
  onView,
}: {
  tile: Tile;
  size: { width: number; height: number };
  seen: boolean;
  row: number;
  onView: (view: HomeView) => void;
}) {
  const theme = useTheme();
  const hue = tile.hueOf(theme);

  const gradient = useMemo(() => {
    const ends = angledGradient(size.width, size.height, GRADIENT_ANGLE);
    const [from, to] = tileGradient(hue);
    return { stops: [from, to] as [string, string], ends };
  }, [hue, size.height, size.width]);

  const art = useQuery({
    queryKey: ['mood-art', tile.key],
    queryFn: ({ signal }) => getFeedArtwork(tile.feed(), signal),
    enabled: seen,
    staleTime: ART_STALE_MS,
    /* One miss is not worth asking IGDB twice for a decoration. */
    retry: false,
  });

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={tile.label}
      onPress={() => onView(tile.view)}
      scaleTo={0.97}
      style={StyleSheet.flatten([styles.tile, size])}>
      {gradient.ends ? (
        <LinearGradient
          colors={gradient.stops}
          start={gradient.ends.start}
          end={gradient.ends.end}
          /* A two-stop ramp of saturated colour over 160dp is where banding
             shows; there is no Skia to dither it, and this prop is the
             platform's own. */
          dither
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: gradient.stops[0] }]} />
      )}

      {/* The cover: offset past the corner *first*, then turned — the tile's
          own clip is what cuts it into a diagonal instead of a square pasted
          inside the block (the reference's comment, and its order). */}
      {art.data && (
        <Arrive of={art.data} delay={row * 40} style={styles.artSlot}>
          <Image
            source={{ uri: art.data }}
            recyclingKey={art.data}
            cachePolicy="memory-disk"
            contentFit="cover"
            /* The still fades up as every piece of artwork in the app does. */
            transition={220}
            style={styles.art}
            accessibilityIgnoresInvertColors
          />
        </Arrive>
      )}

      <Text
        variant="h5"
        numberOfLines={NAME_LINES}
        style={[styles.name, NAME_TYPE, { color: TILE_INK }]}>
        {tile.title}
      </Text>
    </PressableScale>
  );
});

/**
 * Whether the page has been scrolled far enough that this block is within a
 * screen of the viewport — the gate on twenty IGDB requests.
 *
 * `onLayout`'s `y` is the offset inside the scroller's content, because the
 * block is a direct child of it; `scrollY` is the page's offset on the UI
 * thread (`use-screen-chrome`). The reaction is one for the whole grid, it
 * only ever turns true, and it stops reacting the moment it has.
 *
 * With no scroller to read — a screen that draws this outside a
 * `<PageScrollView>` — it answers true at once rather than never asking.
 */
function useScrolledTo(): { onLayout: (event: LayoutChangeEvent) => void; seen: boolean } {
  const { height: display } = useWindowDimensions();
  const scrollY = useScreenChrome()?.scrollY;
  const [top, setTop] = useState<number | null>(null);
  const [seen, setSeen] = useState(false);
  /* The guard lives on the UI thread, because `seen` is stale there until
     React has re-rendered — without it the reaction would ask for the same
     state change on every frame of the scroll that crossed the line. */
  const asked = useSharedValue(false);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const y = Math.round(event.nativeEvent.layout.y);
    setTop((was) => (was === y ? was : y));
  }, []);

  useAnimatedReaction(
    () => (scrollY ? scrollY.get() : 0),
    (offset) => {
      if (asked.get() || top === null) return;
      if (offset + display >= top) {
        asked.set(true);
        runOnJS(setSeen)(true);
      }
    },
    [asked, display, top]
  );

  return { onLayout, seen: seen || (!scrollY && top !== null) };
}

const styles = StyleSheet.create({
  block: { gap: Spacing.x12 },
  section: { gap: Spacing.x8 },
  inset: { paddingHorizontal: Spacing.x16 },
  grid: { paddingHorizontal: Spacing.x16, gap: TILE_GAP },
  row: { flexDirection: 'row', gap: TILE_GAP },
  tile: { borderRadius: TILE_RADIUS, overflow: 'hidden' },
  /* The cover's box sits past the tile's bottom-right corner before it turns,
     so what shows is the corner of a diamond. */
  artSlot: {
    position: 'absolute',
    right: -ART_OFFSET.x,
    bottom: -ART_OFFSET.y,
    width: ART_SIZE,
    height: ART_SIZE,
    transform: [{ rotate: `${ART_TURN}deg` }],
  },
  art: { width: '100%', height: '100%', borderRadius: ART_RADIUS },
  name: {
    position: 'absolute',
    left: TILE_PAD.start,
    top: TILE_PAD.top,
    right: TILE_PAD.end,
  },
});
