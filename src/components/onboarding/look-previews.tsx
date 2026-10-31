import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { usePoster } from '@/components/onboarding/poster-kit';
import type { RevealLayout } from '@/components/surprise-reveal';
import { SurpriseCardArt } from '@/components/surprise-card-art';
import { useCardMaterial } from '@/components/ui/card-material';
import { Poster } from '@/components/ui/poster';
import { ScoreLine } from '@/components/ui/score';
import { SmoothScrim } from '@/components/ui/smooth-scrim';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { PosterAspectRatio, Radius, Spacing, withAlpha } from '@/constants/theme';
import { AccentProvider, useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import type { Game } from '@/lib/games';

/** A phone's screen, drawn small: its corner and how tall it is for its width. */
const FRAME_RADIUS = 22;
const FRAME_RATIO = 1.12;

/**
 * Examples, a page each, swiped between — with a dot for each under them.
 * Tells `render` which page is in view, so only that one need move.
 */
export function ExamplePager({
  games,
  width,
  loading,
  render,
}: {
  games: readonly Game[];
  width: number;
  loading: boolean;
  render: (game: Game, inView: boolean) => ReactNode;
}) {
  const { ink } = usePoster();
  const [page, setPage] = useState(0);

  function settle(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / Math.max(1, width));
    if (next !== page) setPage(next);
  }

  if (loading) {
    return (
      <View style={styles.pager}>
        <Skeleton width={width} height={Math.round(width * FRAME_RATIO)} radius={FRAME_RADIUS} />
      </View>
    );
  }
  /* IGDB did not answer: the question stands without its examples. */
  if (games.length === 0) return null;

  return (
    <View style={styles.pager}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={settle}
        style={{ width }}
        accessibilityLabel={`${games.length} examples. Swipe for the next.`}>
        {games.map((game, index) => (
          <View key={game.id} style={{ width }}>
            {render(game, index === page)}
          </View>
        ))}
      </ScrollView>
      <View style={styles.dots} importantForAccessibility="no-hide-descendants">
        {games.map((game, index) => (
          <View
            key={game.id}
            style={[styles.dot, { backgroundColor: withAlpha(ink, index === page ? 1 : 0.3) }]}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * A game's page, drawn small: its art fading into the page, its name and its
 * box, the review button and the keys beside it, the tabs, a card — every
 * part in the roles the real page uses (`useAccent`, `useCardMaterial`), under
 * the game's own `<AccentProvider>`. So it is the game's colours while Game
 * colours is on and the app's own grey room while it is off, and it changes
 * the moment the switch is flipped — the owner's "a button to switch on/off in
 * real time" (2026-10-21).
 */
export function GamePagePreview({ game, width }: { game: Game; width: number }) {
  return (
    <AccentProvider artwork={game.heroUrl ?? game.coverUrl} genres={game.genres}>
      <GamePageSketch game={game} width={width} />
    </AccentProvider>
  );
}

function GamePageSketch({ game, width }: { game: Game; width: number }) {
  const theme = useTheme();
  const accent = useAccent();
  const card = useCardMaterial();
  const height = Math.round(width * FRAME_RATIO);
  const heroHeight = Math.round(height * 0.36);
  const coverWidth = Math.round(width * 0.2);
  const m3 = accent.m3;

  return (
    <View
      style={[
        styles.frame,
        { width, height, backgroundColor: accent.page, borderColor: theme.border },
      ]}
      accessible
      accessibilityLabel={`${game.title}'s page, as an example`}>
      <View style={{ height: heroHeight }}>
        {(game.heroUrl ?? game.coverUrl) && (
          <Image
            source={{ uri: game.heroUrl ?? game.coverUrl ?? undefined }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            accessible={false}
          />
        )}
        <SmoothScrim color={accent.page} style={styles.heroFade} />
      </View>

      <View style={[styles.billing, { marginTop: -Math.round(heroHeight * 0.3) }]}>
        <View style={styles.billingText}>
          <Text variant="h4" numberOfLines={2} style={{ color: theme.text }}>
            {game.title}
          </Text>
          <Text variant="caption" numberOfLines={1} style={{ color: accent.quietInk }}>
            {[game.releaseYear, game.developer].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Poster
          coverUrl={game.coverUrl}
          heroUrl={game.heroUrl}
          title={game.title}
          width={coverWidth}
        />
      </View>

      <View style={styles.actions}>
        <View style={[styles.review, { backgroundColor: accent.color }]}>
          <Text variant="button" style={{ color: accent.ink }}>
            Review
          </Text>
        </View>
        {(['heart-outline', 'bookmark-outline', 'add'] as const).map((glyph) => (
          <View key={glyph} style={[styles.key, { backgroundColor: m3.surfaceContainerHigh }]}>
            <Ionicons name={glyph} size={16} color={m3.onSurfaceVariant} />
          </View>
        ))}
      </View>

      <View style={styles.tabs}>
        {['Overview', 'Reviews', 'Similar'].map((label, index) => (
          <View
            key={label}
            style={[
              styles.tab,
              index === 0
                ? { backgroundColor: m3.primary, borderColor: m3.primary }
                : { borderColor: m3.outlineVariant },
            ]}>
            <Text
              variant="caption"
              style={{ color: index === 0 ? m3.onPrimary : m3.onSurfaceVariant }}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.card, { backgroundColor: card.fill, borderColor: card.edge }]}>
        <Text variant="h5">Ratings</Text>
        {game.score !== null ? (
          <ScoreLine score={game.score} />
        ) : (
          <Text variant="caption" style={{ color: accent.quietInk }}>
            Not rated yet
          </Text>
        )}
      </View>
    </View>
  );
}

/**
 * Surprise Me, drawn small: the room in the game's colour, the dealt card —
 * its real art (`<SurpriseCardArt>`), animated where SteamGridDB has an
 * animation and Animated artwork is on — and the game's name under it. Only
 * the example in view plays (`inView`), so the others download nothing.
 */
export function SurprisePreview({
  game,
  width,
  inView,
}: {
  game: Game;
  width: number;
  inView: boolean;
}) {
  return (
    <AccentProvider artwork={game.coverUrl ?? game.heroUrl} genres={game.genres}>
      <SurpriseSketch game={game} width={width} inView={inView} />
    </AccentProvider>
  );
}

function SurpriseSketch({ game, width, inView }: { game: Game; width: number; inView: boolean }) {
  const theme = useTheme();
  const accent = useAccent();
  const height = Math.round(width * FRAME_RATIO);
  const squareWidth = Math.round(width * 0.66);
  const layout: RevealLayout = {
    squareWidth,
    artWidth: Math.round(squareWidth * PosterAspectRatio),
    commitAt: 0,
    exitDistance: 0,
    compact: true,
  };

  return (
    <View
      style={[
        styles.frame,
        styles.surprise,
        { width, height, backgroundColor: accent.page, borderColor: theme.border },
      ]}
      accessible
      accessibilityLabel={`${game.title}, dealt in Surprise Me, as an example`}>
      <Text variant="h5" style={{ color: theme.text }}>
        Surprise Me
      </Text>
      <SurpriseCardArt game={game} layout={layout} load={inView} paused={false} />
      <View style={[styles.surpriseMeta, { width: squareWidth }]}>
        <Text variant="h4" numberOfLines={1} style={{ color: theme.text }}>
          {game.title}
        </Text>
        <Text variant="caption" numberOfLines={1} style={{ color: accent.quietInk }}>
          {[game.releaseYear, game.developer].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pager: { marginTop: 22, alignItems: 'center', gap: Spacing.x12 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  frame: {
    borderRadius: FRAME_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  heroFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '70%' },
  billing: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.x12,
    paddingHorizontal: 14,
  },
  billingText: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, marginTop: 14 },
  review: {
    flex: 1,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  key: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, marginTop: 14 },
  tab: {
    flex: 1,
    height: 26,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    marginHorizontal: 14,
    marginTop: 14,
    padding: 12,
    gap: 4,
    borderRadius: Radius.review,
    borderWidth: 1,
  },
  surprise: { alignItems: 'center', justifyContent: 'center', gap: Spacing.x16 },
  surpriseMeta: { gap: 2 },
});
