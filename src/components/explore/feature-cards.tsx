import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { memo } from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { EXPLORE, featureCard } from '@/constants/explore';
import { Typeface, MaxContentWidth, Palette, Spacing, withAlpha } from '@/constants/theme';

export type FeatureCardGame = {
  id: string;
  title: string;
  heroUrl: string | null;
  coverUrl: string | null;
  /** The small line over the name: "No. 1 this month". */
  strapline: string;
  /** The quiet line under it. */
  line: string | null;
};

const SCRIM = [
  withAlpha(Palette.shadowInk, 0),
  withAlpha(Palette.shadowInk, 0.35),
  withAlpha(Palette.shadowInk, 0.82),
] as const;
const SCRIM_STOPS = [0.3, 0.6, 1] as const;

/**
 * Apple TV Home's big card (the owner's reference, 2026-11-03 — the
 * "Severance" block): a card most of the display wide and a little wider than
 * tall, the art filling it, a small line over the name, the name large and
 * bold at its foot, one quiet line under it; the next card peeking in at the
 * right. Explore's Popular this month, under Highly rated, at the owner's
 * word. The art is the game's landscape hero, cropped — the slot is near
 * square, and a cover would be cut through its logo.
 */
export const FeatureCards = memo(function FeatureCards({
  games,
  loading,
}: {
  games: readonly FeatureCardGame[];
  loading: boolean;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const card = featureCard(Math.min(windowWidth, MaxContentWidth));

  if (loading && games.length === 0) {
    return (
      <View style={styles.skeleton}>
        <Skeleton width={card.width} height={card.height} radius={EXPLORE.cardRadius} />
      </View>
    );
  }

  return (
    <FlatList
      data={games}
      horizontal
      keyExtractor={(game) => game.id}
      showsHorizontalScrollIndicator={false}
      snapToInterval={card.step}
      snapToAlignment="start"
      decelerationRate="fast"
      initialNumToRender={3}
      windowSize={3}
      contentContainerStyle={styles.row}
      renderItem={({ item }) => <Card game={item} width={card.width} height={card.height} />}
    />
  );
});

function Card({ game, width, height }: { game: FeatureCardGame; width: number; height: number }) {
  const router = useRouter();
  const art = game.heroUrl ?? game.coverUrl;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${game.strapline}: ${game.title}. Opens the game.`}
      onPress={() => router.push({ pathname: '/game/[id]', params: { id: game.id } })}
      scaleTo={0.97}>
      <View style={[styles.card, { width, height }]}>
        {art && (
          <Image
            source={{ uri: art }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={220}
            cachePolicy="memory-disk"
            recyclingKey={art}
            accessibilityIgnoresInvertColors
          />
        )}
        <LinearGradient colors={SCRIM} locations={SCRIM_STOPS} style={StyleSheet.absoluteFill} />
        <View style={styles.words}>
          <Text numberOfLines={1} style={styles.strap}>
            {game.strapline}
          </Text>
          <Text numberOfLines={2} style={styles.name}>
            {game.title}
          </Text>
          {!!game.line && (
            <Text numberOfLines={1} style={styles.line}>
              {game.line}
            </Text>
          )}
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: Spacing.x16, gap: EXPLORE.cardGap },
  skeleton: { paddingHorizontal: Spacing.x16 },
  card: {
    borderRadius: EXPLORE.cardRadius,
    overflow: 'hidden',
    backgroundColor: withAlpha(Palette.white, 0.06),
  },
  words: {
    position: 'absolute',
    left: Spacing.x16,
    right: Spacing.x16,
    bottom: Spacing.x16,
    gap: 2,
  },
  strap: {
    fontFamily: Typeface.semibold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.5,
    color: withAlpha(Palette.white, 0.8),
  },
  name: {
    fontFamily: Typeface.extraBold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.5,
    color: Palette.white,
  },
  line: {
    fontFamily: Typeface.regular,
    fontSize: 13,
    lineHeight: 18,
    color: withAlpha(Palette.white, 0.75),
  },
});
