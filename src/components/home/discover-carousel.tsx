import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { DISCOVER, discoverGeometry, type DiscoverGeometry } from '@/constants/discover-carousel';
import { MaxContentWidth, Palette, Spacing, withAlpha } from '@/constants/theme';
import { useSquareCover } from '@/hooks/use-square-cover';
import { useTheme } from '@/hooks/use-theme';
import type { GameSearchResult } from '@/lib/games/types';
import { smoothScrimStops } from '@/lib/scrim';

/*
 * The caption's scrim, clear to black at 78% over the caption's own box.
 * BitChord's is a two-stop ramp; this is the same two ends on smoothstep
 * (`lib/scrim`), so the ramp has no corner where it leaves clear.
 */
const SCRIM = smoothScrimStops();
const SCRIM_COLOURS = SCRIM.alphas.map((alpha) =>
  withAlpha(Palette.shadowInk, alpha * DISCOVER.scrimAlpha)
) as [string, string, ...string[]];
const SCRIM_LOCATIONS = SCRIM.locations as [number, number, ...number[]];

/**
 * Home's "Games for you" as BitChord's lead shelf (the owner's, 2026-10-28:
 * "like the one in bitchord in the albums & singles section at the top") —
 * `HeroShelf` / `HeroCard` in its `HomeScreen.kt`. A row of big cards from
 * the page's margin, each seventy per cent of the row so the next one peeks
 * in, a touch taller than wide, 18 round with a faint white edge; the game's
 * name and why it is here at the card's foot over a scrim. The row snaps to
 * each card's leading edge, as BitChord's `ShelfRow` does, so a fling never
 * settles with a card cut in half. A card opens its game.
 *
 * The geometry is `constants/discover-carousel` (pure, tested).
 *
 * The art is the game's square (SteamGridDB) where there is one — BitChord's
 * are square album covers, cropped to the card — else its box art, cropped.
 */
export function DiscoverCarousel({
  games,
  because,
}: {
  games: readonly GameSearchResult[];
  because?: Record<string, string>;
}) {
  const { width: screen } = useWindowDimensions();
  const geometry = useMemo(() => discoverGeometry(Math.min(screen, MaxContentWidth)), [screen]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={geometry.step}
      snapToAlignment="start"
      decelerationRate="fast"
      style={styles.scroller}
      contentContainerStyle={styles.row}>
      {games.map((game) => (
        <DiscoverCard key={game.id} game={game} line={lineFor(game, because)} geometry={geometry} />
      ))}
    </ScrollView>
  );
}

/** The row while the games are on their way: the first card and the edge of the next. */
export function DiscoverCarouselSkeleton() {
  const { width: screen } = useWindowDimensions();
  const g = discoverGeometry(Math.min(screen, MaxContentWidth));
  return (
    <View style={[styles.row, styles.skeleton, { height: g.height }]}>
      <Skeleton width={g.width} height={g.height} radius={DISCOVER.radius} />
      <Skeleton width={g.width} height={g.height} radius={DISCOVER.radius} />
    </View>
  );
}

function lineFor(game: GameSearchResult, because?: Record<string, string>): string | null {
  const seed = because?.[game.id];
  return seed ? `Similar to ${seed}` : (game.developer ?? null);
}

function DiscoverCard({
  game,
  line,
  geometry,
}: {
  game: GameSearchResult;
  line: string | null;
  geometry: DiscoverGeometry;
}) {
  const theme = useTheme();
  const router = useRouter();
  const square = useSquareCover({ gameId: game.id, title: game.title });
  const art = square.resolved ? (square.uri ?? game.coverUrl ?? game.heroUrl) : null;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={line ? `${game.title}. ${line}.` : game.title}
      accessibilityHint="Opens the game"
      onPress={() => router.push({ pathname: '/game/[id]', params: { id: game.id } })}
      scaleTo={0.98}>
      <View
        style={[
          styles.card,
          {
            width: geometry.width,
            height: geometry.height,
            backgroundColor: theme.surfaceElevated,
            borderColor: withAlpha(theme.white, DISCOVER.edgeAlpha),
          },
        ]}>
        {art && (
          <Image
            source={{ uri: art }}
            style={styles.fill}
            contentFit="cover"
            transition={550}
            cachePolicy="memory-disk"
            recyclingKey={art}
            accessibilityIgnoresInvertColors
          />
        )}
        <View style={styles.caption} pointerEvents="none">
          <LinearGradient colors={SCRIM_COLOURS} locations={SCRIM_LOCATIONS} style={styles.fill} />
          <Text variant="h2" numberOfLines={1} style={{ color: theme.white }}>
            {game.title}
          </Text>
          {line && (
            <Text
              variant="body"
              numberOfLines={2}
              style={{ color: withAlpha(theme.white, DISCOVER.subtitleAlpha) }}>
              {line}
            </Text>
          )}
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  /* A horizontal scroller grows unless told not to (CLAUDE.md, gotchas). */
  scroller: { flexGrow: 0 },
  /* From the page's margin, so the first card stands under the heading. */
  row: { paddingHorizontal: Spacing.x16, gap: DISCOVER.gap },
  card: {
    borderRadius: DISCOVER.radius,
    borderWidth: DISCOVER.edgeWidth,
    overflow: 'hidden',
  },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  caption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: DISCOVER.captionSide,
    paddingTop: DISCOVER.captionTop,
    paddingBottom: DISCOVER.captionBottom,
  },
  skeleton: { flexDirection: 'row', overflow: 'hidden' },
});
