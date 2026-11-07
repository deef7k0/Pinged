import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { AppState, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import type { PickArtKind } from '@/components/home/pick-art';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { PICK_EYEBROW, PICK_STILL } from '@/constants/pick-art';
import { MaxContentWidth, Palette, Spacing, Typeface, withAlpha } from '@/constants/theme';
import { SKIA_AVAILABLE } from '@/lib/skia-available';

/** The drawing, only where the build has Skia — asked before it is imported. */
const PickArt = SKIA_AVAILABLE ? lazy(() => import('@/components/home/pick-art')) : null;

/** BitChord's Top Picks card: 3:4, a 12 corner, 1dp of white at 15%. */
const RATIO = 3 / 4;
const RADIUS = 12;
const GAP = Spacing.x12;

type Pick = {
  kind: PickArtKind;
  icon: keyof typeof Ionicons.glyphMap;
  eyebrow: string;
  /** BitChord's eyebrow colours: a pale tone of the card's own. */
  eyebrowColor: string;
  title: string;
  subtitle: string;
  href: '/surprise' | '/top-chart';
};

const PICKS: readonly Pick[] = [
  {
    kind: 'personal',
    icon: 'shuffle',
    eyebrow: 'Made for you',
    eyebrowColor: PICK_EYEBROW.personal,
    title: 'Surprise Me',
    subtitle: 'One game, dealt at random, with a song from it',
    href: '/surprise',
  },
  {
    kind: 'discovery',
    icon: 'trophy',
    eyebrow: 'The charts',
    eyebrowColor: PICK_EYEBROW.discovery,
    title: 'Top 1000',
    subtitle: 'The best-rated games on Pinged, and the critics’',
    href: '/top-chart',
  },
];

/**
 * Surprise Me and the Top 1000 as two of BitChord's "Top Picks for You"
 * cards (the owner's, 2026-11-05, after `TopPicksShelf.kt`): tall cards
 * side by side, each its station's moving art — the personal station's
 * folding arrows for Surprise Me, the discovery station's fan of shards for
 * the Top 1000 (`pick-art`) — with BitChord's caption at the foot: a pale
 * eyebrow, the title, a line under it. They replace Surprise Me's fanned
 * deck on Home and the Top 1000's button on Explore.
 *
 * The art moves only while Home is in front, the app is open and Reduce
 * Motion is off — BitChord's rule that an endless animation does not redraw
 * a page nobody can see.
 */
export function PickCards() {
  const { width: windowWidth } = useWindowDimensions();
  const page = Math.min(windowWidth, MaxContentWidth);
  const cardWidth = Math.floor((page - Spacing.x16 * 2 - GAP) / 2);
  const cardHeight = Math.round(cardWidth / RATIO);
  const reduceMotion = useReducedMotion();

  const [focused, setFocused] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => sub.remove();
  }, []);
  const moving = focused && foreground && !reduceMotion;

  return (
    <View style={styles.row}>
      {PICKS.map((pick) => (
        <PickCard
          key={pick.kind}
          pick={pick}
          width={cardWidth}
          height={cardHeight}
          moving={moving}
        />
      ))}
    </View>
  );
}

function PickCard({
  pick,
  width,
  height,
  moving,
}: {
  pick: Pick;
  width: number;
  height: number;
  moving: boolean;
}) {
  const router = useRouter();
  const still = (
    <LinearGradient
      colors={[...PICK_STILL[pick.kind]] as [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  );

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${pick.title}. ${pick.subtitle}`}
      onPress={() => router.push(pick.href)}
      scaleTo={0.97}
      style={StyleSheet.flatten([
        styles.card,
        { width, height, borderColor: withAlpha(Palette.white, 0.15) },
      ])}>
      {still}
      {PickArt && (
        <Suspense fallback={null}>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <PickArt kind={pick.kind} width={width} height={height} moving={moving} />
          </View>
        </Suspense>
      )}

      <View style={styles.mark} pointerEvents="none">
        <Ionicons name={pick.icon} size={16} color={Palette.white} />
      </View>

      <View style={styles.caption} pointerEvents="none">
        <Text numberOfLines={1} style={[styles.eyebrow, { color: pick.eyebrowColor }]}>
          {pick.eyebrow}
        </Text>
        <Text numberOfLines={2} style={styles.title}>
          {pick.title}
        </Text>
        <Text numberOfLines={2} style={styles.subtitle}>
          {pick.subtitle}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: GAP, paddingHorizontal: Spacing.x16 },
  card: {
    borderRadius: RADIUS,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  mark: { position: 'absolute', top: Spacing.x12, right: Spacing.x12 },
  caption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.x16,
    paddingBottom: Spacing.x16,
  },
  eyebrow: { fontFamily: Typeface.medium, fontSize: 13, lineHeight: 16 },
  title: { fontFamily: Typeface.semibold, fontSize: 17, lineHeight: 21, color: Palette.white },
  subtitle: {
    fontFamily: Typeface.regular,
    fontSize: 13,
    lineHeight: 16,
    color: withAlpha(Palette.white, 0.86),
  },
});
