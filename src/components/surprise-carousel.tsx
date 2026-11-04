import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View, type ListRenderItem } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { AnimatedCoverImage } from '@/components/ui/animated-cover-image';
import { GlassSurface } from '@/components/ui/liquid-glass';
import { PressGlyph } from '@/components/ui/press-glyph';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { clampScore, labelFor, scoreColor } from '@/constants/score';
import { FontFamily, Palette, Spacing, withAlpha } from '@/constants/theme';
import { useAnimatedCover } from '@/hooks/use-animated-cover';
import { useTheme } from '@/hooks/use-theme';
import { getRatingBreakdown } from '@/lib/api';
import { getGameById } from '@/lib/games';
import { sharpCoverUrl } from '@/lib/games/sharp-cover';
import type { GameSearchResult } from '@/lib/games/types';
import { smoothScrimStops } from '@/lib/scrim';

/*
 * Surprise Me as reacticx's vertical page carousel (`molecules/
 * vertical-page-carousel`, MIT — the owner's, 2026-11-03), at its demo's
 * numbers: a card 65% of the screen tall (here: as tall as a 2:3 cover the
 * width allows, within that), 14 from the sides, 6 apart, paging one at a
 * time; the cards either side at 0.88 and 60%, growing and lighting as they
 * come in; a firm haptic each time the list comes to rest.
 *
 * Each card is the game's **portrait cover** — moving, on the card in front,
 * where it has an animated one and Settings → Animated artwork is on — with
 * its name, developer and year at its foot over a short fade, as the
 * carousels on Home and Search set theirs. The card opens the game; the
 * glass key in its corner turns it over in place to what the game is.
 */

export const SURPRISE_CAROUSEL = {
  heightShare: 0.65,
  margin: 14,
  spacing: 6,
  radius: 24,
  scale: [0.88, 1, 0.88] as [number, number, number],
  opacity: [0.6, 1, 0.6] as [number, number, number],
  /** The foot's fade: over its bottom 38%, to black at 85%. */
  footShare: 0.38,
  footPeak: 0.85,
} as const;

const FOOT = smoothScrimStops();

/** A card's size in a carousel `width` wide and `height` tall. */
export function surpriseCard(width: number, height: number): { width: number; height: number } {
  const cardWidth = width - SURPRISE_CAROUSEL.margin * 2;
  const tall = Math.min(
    cardWidth * 1.5,
    height * 0.86,
    height * SURPRISE_CAROUSEL.heightShare + 120
  );
  return { width: cardWidth, height: Math.round(tall) };
}

type Entry = { kind: 'game'; game: GameSearchResult } | { kind: 'more' };

export type SurpriseCarouselProps = {
  games: readonly GameSearchResult[];
  /** The card in front, for the page's colour and what is looked up. */
  index: number;
  onIndexChange: (index: number) => void;
  /** The list has come to rest on `index`. */
  settled: boolean;
  /** Whether a card in front may play its animated cover. */
  animated: boolean;
  onOpenGame: (game: GameSearchResult) => void;
  /** The last card: a fresh deal. */
  onMore: () => void;
  /** What the turned-over card shows under the game's own facts. */
  details: (game: GameSearchResult) => ReactNode;
  /** The carousel's own size: the room it is given. */
  width: number;
  height: number;
};

export function SurpriseCarousel({
  games,
  index,
  onIndexChange,
  settled,
  animated,
  onOpenGame,
  onMore,
  details,
  width,
  height,
}: SurpriseCarouselProps) {
  const card = surpriseCard(width, height);
  const step = card.height + SURPRISE_CAROUSEL.spacing;
  const scrollY = useSharedValue(0);
  const [turned, setTurned] = useState<string | null>(null);

  const data: Entry[] = [
    ...games.map((game) => ({ kind: 'game' as const, game })),
    { kind: 'more' },
  ];

  const landed = (offset: number) => {
    const next = Math.max(0, Math.min(data.length - 1, Math.round(offset / step)));
    if (next !== index) {
      setTurned(null);
      onIndexChange(next);
    }
    if (Platform.OS === 'android') {
      void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm).catch(
        () => undefined
      );
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    }
  };

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.set(event.contentOffset.y / step);
    },
    onMomentumEnd: (event) => {
      runOnJS(landed)(event.contentOffset.y);
    },
  });

  const renderItem: ListRenderItem<Entry> = ({ item, index: position }) => (
    <Page position={position} scrollY={scrollY} card={card}>
      {item.kind === 'game' ? (
        <GameCard
          game={item.game}
          card={card}
          front={position === index}
          playing={animated && settled && position === index}
          turned={turned === item.game.id}
          onTurn={() => setTurned((was) => (was === item.game.id ? null : item.game.id))}
          onOpen={() => onOpenGame(item.game)}
          details={details}
        />
      ) : (
        <MoreCard onMore={onMore} />
      )}
    </Page>
  );

  return (
    <Animated.FlatList
      data={data}
      keyExtractor={(item) => (item.kind === 'game' ? item.game.id : 'more')}
      renderItem={renderItem}
      extraData={`${index}:${turned}:${settled}:${animated}`}
      onScroll={onScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      snapToInterval={step}
      decelerationRate="fast"
      disableIntervalMomentum
      initialNumToRender={3}
      windowSize={5}
      getItemLayout={(_, position) => ({ length: step, offset: step * position, index: position })}
      contentContainerStyle={{
        paddingVertical: Math.max(0, (height - card.height) / 2 - SURPRISE_CAROUSEL.spacing / 2),
      }}
    />
  );
}

/** One page: the card at its scale and light for where the list stands. */
function Page({
  position,
  scrollY,
  card,
  children,
}: {
  position: number;
  scrollY: SharedValue<number>;
  card: { width: number; height: number };
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const range = [position - 1, position, position + 1];
    return {
      opacity: interpolate(scrollY.get(), range, SURPRISE_CAROUSEL.opacity, Extrapolation.CLAMP),
      transform: [
        { scale: interpolate(scrollY.get(), range, SURPRISE_CAROUSEL.scale, Extrapolation.CLAMP) },
      ],
    };
  });
  return (
    <View
      style={[
        styles.page,
        {
          height: card.height + SURPRISE_CAROUSEL.spacing,
          paddingHorizontal: SURPRISE_CAROUSEL.margin,
        },
      ]}>
      <Animated.View style={[{ width: card.width, height: card.height }, style]}>
        {children}
      </Animated.View>
    </View>
  );
}

const GameCard = memo(function GameCard({
  game,
  card,
  front,
  playing,
  turned,
  onTurn,
  onOpen,
  details,
}: {
  game: GameSearchResult;
  card: { width: number; height: number };
  front: boolean;
  playing: boolean;
  turned: boolean;
  onTurn: () => void;
  onOpen: () => void;
  details: (game: GameSearchResult) => ReactNode;
}) {
  const theme = useTheme();
  const motion = useAnimatedCover({
    gameId: game.id,
    title: game.title,
    aspect: 'portrait',
    enabled: front,
  });
  const cover = sharpCoverUrl(game.coverUrl) ?? game.heroUrl;
  const credit = [game.developer, game.releaseYear].filter(Boolean).join(' · ');

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${game.title}${credit ? `, ${credit}` : ''}. Opens the game.`}
        onPress={onOpen}
        scaleTo={0.98}
        style={StyleSheet.flatten(styles.fill)}>
        {cover && (
          <Image
            source={{ uri: cover }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            recyclingKey={game.id}
            accessibilityIgnoresInvertColors
          />
        )}
        {front && motion.status === 'found' && motion.animatedUrl && (
          <AnimatedCoverImage
            staticUrl={null}
            animatedUrl={motion.animatedUrl}
            format={motion.format}
            status={motion.status}
            aspect="portrait"
            backdrop="transparent"
            load={playing}
            style={StyleSheet.absoluteFill}
            onFailed={motion.reportFailure}
          />
        )}

        {/* The foot: a short fade, and the game's name over it. */}
        <LinearGradient
          pointerEvents="none"
          colors={
            FOOT.alphas.map((alpha) =>
              withAlpha(Palette.shadowInk, alpha * SURPRISE_CAROUSEL.footPeak)
            ) as unknown as readonly [string, string, ...string[]]
          }
          locations={FOOT.locations as unknown as readonly [number, number, ...number[]]}
          style={[styles.foot, { height: card.height * SURPRISE_CAROUSEL.footShare }]}
        />
        <View style={styles.words} pointerEvents="none">
          <Text numberOfLines={2} style={styles.title}>
            {game.title}
          </Text>
          {!!credit && (
            <Text numberOfLines={1} style={styles.credit}>
              {credit}
            </Text>
          )}
        </View>
      </PressableScale>

      {turned && (
        <Details game={game} onClose={onTurn}>
          {details(game)}
        </Details>
      )}

      {/* The glass key: the card turned over to what the game is, and back. */}
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={turned ? 'Back to the cover' : `About ${game.title}`}
        onPress={onTurn}
        scaleTo={0.92}
        hitSlop={8}
        style={StyleSheet.flatten(styles.info)}>
        <GlassSurface radius={INFO / 2} />
        <PressGlyph>
          <Ionicons name={turned ? 'close' : 'information'} size={22} color={Palette.white} />
        </PressGlyph>
      </PressableScale>
    </View>
  );
});

const INFO = 44;

/**
 * The card turned over: the game's facts, the score here, its genres and
 * platforms, its synopsis — the record the game page opens on, asked for
 * under the page's own key so opening it after costs nothing — then the
 * screen's own (its review, its song, Backlog, Hide).
 */
function Details({
  game,
  onClose,
  children,
}: {
  game: GameSearchResult;
  onClose: () => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  const full = useQuery({
    queryKey: ['game', game.id],
    queryFn: ({ signal }) => getGameById(game.id, signal),
    staleTime: 30 * 60_000,
  });
  const gameId = game.id;
  const breakdown = useQuery({
    queryKey: ['rating-breakdown', gameId],
    queryFn: () => getRatingBreakdown(gameId),
  });
  const ours = breakdown.data ? clampScore(breakdown.data.average) : null;
  const score = ours ?? game.score;
  const description = full.data?.description ?? null;

  return (
    <View
      style={[styles.fill, styles.back, { backgroundColor: withAlpha(theme.background, 0.94) }]}>
      <ScrollView contentContainerStyle={styles.backBody} showsVerticalScrollIndicator={false}>
        <Text variant="h2" style={styles.backTitle}>
          {game.title}
        </Text>
        {score !== null && (
          <View style={styles.scoreRow}>
            <Text style={[styles.score, { color: scoreColor(score, theme) }]}>{score}</Text>
            <View>
              <Text variant="itemTitle" style={{ color: scoreColor(score, theme) }}>
                {labelFor(score)}
              </Text>
              <Text variant="bodySmall" color="textSecondary">
                {ours !== null
                  ? `Pinged · ${breakdown.data!.total} ${breakdown.data!.total === 1 ? 'rating' : 'ratings'}`
                  : 'IGDB'}
              </Text>
            </View>
          </View>
        )}
        {game.genres.length > 0 && <Fact label="Genres" value={game.genres.join(', ')} />}
        {game.platforms.length > 0 && (
          <Fact label="Platforms" value={game.platforms.slice(0, 6).join(', ')} />
        )}
        {!!description && (
          <Text variant="body" color="textSecondary" numberOfLines={8}>
            {description}
          </Text>
        )}
        {children}
        <Button title="Back to the cover" variant="ghost" onPress={onClose} />
      </ScrollView>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text variant="bodySmall" color="textMuted">
        {label}
      </Text>
      <Text variant="body">{value}</Text>
    </View>
  );
}

function MoreCard({ onMore }: { onMore: () => void }) {
  const theme = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Deal more surprises"
      onPress={onMore}
      scaleTo={0.98}
      style={StyleSheet.flatten([styles.card, styles.more, { backgroundColor: theme.surface }])}>
      <Ionicons name="shuffle" size={44} color={theme.text} />
      <Text variant="h2">Deal more</Text>
      <Text variant="body" color="textSecondary" style={styles.moreLine}>
        A fresh hand of games under the same settings.
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', justifyContent: 'center', alignItems: 'center' },
  card: { flex: 1, borderRadius: SURPRISE_CAROUSEL.radius, overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  foot: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  words: {
    position: 'absolute',
    left: Spacing.x20,
    right: Spacing.x20,
    bottom: Spacing.x20,
    gap: 2,
  },
  title: {
    fontFamily: FontFamily.extraBold,
    fontSize: 24,
    lineHeight: 29,
    color: Palette.white,
  },
  credit: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 19,
    color: withAlpha(Palette.white, 0.75),
  },
  info: {
    position: 'absolute',
    top: Spacing.x12,
    right: Spacing.x12,
    width: INFO,
    height: INFO,
    borderRadius: INFO / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: { paddingTop: INFO + Spacing.x16 },
  backBody: { paddingHorizontal: Spacing.x20, paddingBottom: Spacing.x24, gap: Spacing.x16 },
  backTitle: { paddingRight: INFO },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  score: { fontFamily: FontFamily.extraBold, fontSize: 40, lineHeight: 46 },
  fact: { gap: 2 },
  more: { alignItems: 'center', justifyContent: 'center', gap: Spacing.x12, padding: Spacing.x32 },
  moreLine: { textAlign: 'center' },
});
