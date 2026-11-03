import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  AppState,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { DiscoverCarouselSkeleton } from '@/components/home/discover-carousel';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { DISCOVER, discoverGeometry, type DiscoverGeometry } from '@/constants/discover-carousel';
import { SPOTLIGHT, nextCard, parallaxArtWidth, parallaxShift } from '@/constants/search-spotlight';
import { MaxContentWidth, Palette, Radius, Spacing, withAlpha } from '@/constants/theme';
import { usePulse } from '@/hooks/use-pulse';
import { useTheme } from '@/hooks/use-theme';
import { MONTH_COLUMNS, monthRows } from '@/lib/games/calendar';
import type { Spotlight, SpotlightGame } from '@/lib/games/igdb';
import { countdownLabel, countdownSpoken, monthLabel } from '@/lib/games/spotlight';
import { smoothScrimStops } from '@/lib/scrim';

/** One card, as the row draws it: what it shows and where a tap goes. */
type Slide =
  | {
      kind: 'game';
      key: string;
      game: SpotlightGame;
      badge: string;
      /** The whole card as a sentence, for a screen reader. */
      spoken: string;
    }
  | { kind: 'calendar'; key: string; badge: string; spoken: string };

export type SpotlightSliderProps = {
  /** Null while the games are on their way: the row holds its shape. */
  spotlight: Spotlight | null;
  loading: boolean;
  /** Unix seconds: the "now" the spotlight was asked for, so a countdown and its game agree. */
  now: number;
  /** The row has been scrolled out of view — it stops moving by itself. */
  away: boolean;
};

/* Home's caption scrim (`<DiscoverCarousel>`), clear to black at 78%. */
const SCRIM = smoothScrimStops();
const SCRIM_LOCATIONS = SCRIM.locations as [number, number, ...number[]];
function scrimColours(colour: string, peak: number) {
  return SCRIM.alphas.map((alpha) => withAlpha(colour, alpha * peak)) as [
    string,
    string,
    ...string[],
  ];
}
const SHADOW_SCRIM = scrimColours(Palette.shadowInk, DISCOVER.scrimAlpha);

/**
 * The head of Search: this month's two biggest releases, the most awaited game
 * as a countdown, and the release calendar — as Home's "Games for you" cards,
 * moving by themselves with reacticx's parallax (the owner's, 2026-11-02;
 * `constants/search-spotlight` has the numbers and why the art is wider than
 * its card). Which games they are is `getSpotlight`; this draws them.
 *
 * ## The calendar card is always there
 *
 * It needs nothing from IGDB to exist, so the row is never empty.
 *
 * ## It moves by itself, until it is touched
 *
 * Every six seconds the row glides to the next card — a Reanimated `scrollTo`
 * driven by a timing on the UI thread, so the art's parallax runs during it
 * exactly as under a finger — and from the last back to the first. **One drag
 * stops it** for as long as the screen stays up. It also stands still under
 * Reduce Motion, for a screen reader, and whenever nobody can see it: another
 * tab, the app in the background, or the page scrolled past it (`away`).
 *
 * ## The badge is near-black, like the word on a cover
 *
 * Colour on artwork belongs to the game here, which is why an edition badge is
 * black at 82% with white type; this is that badge.
 */
export const SpotlightSlider = memo(function SpotlightSlider({
  spotlight,
  loading,
  now,
  away,
}: SpotlightSliderProps) {
  const { width: windowWidth } = useWindowDimensions();
  const geometry = useMemo(
    () => discoverGeometry(Math.min(windowWidth, MaxContentWidth)),
    [windowWidth]
  );
  const reduceMotion = useReducedMotion();

  const slides = useMemo<Slide[]>(() => {
    const games: Slide[] = [];

    for (const game of spotlight?.fresh ?? []) {
      games.push({
        kind: 'game',
        key: game.game.id,
        game,
        badge: 'New',
        spoken: `New: ${game.game.title}${game.game.developer ? `, by ${game.game.developer}` : ''}`,
      });
    }

    const awaited = spotlight?.awaited;
    if (awaited) {
      games.push({
        kind: 'game',
        key: awaited.game.id,
        game: awaited,
        badge: countdownLabel(awaited.releasedAt, awaited.precision, now),
        spoken: `Coming soon: ${awaited.game.title}${
          awaited.game.developer ? `, by ${awaited.game.developer}` : ''
        }, ${countdownSpoken(awaited.releasedAt, awaited.precision, now)}`,
      });
    }

    return [
      ...games,
      {
        kind: 'calendar',
        key: 'calendar',
        badge: 'Calendar',
        spoken: `Release calendar, ${monthLabel(now)}`,
      },
    ];
  }, [spotlight, now]);

  const count = slides.length;
  const [index, setIndex] = useState(0);
  /** Off for good once somebody drags the row themselves. */
  const [handsOff, setHandsOff] = useState(true);

  const [focused, setFocused] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [screenReader, setScreenReader] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );

  useEffect(() => {
    const appState = AppState.addEventListener('change', (state) =>
      setForeground(state === 'active')
    );
    let alive = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      if (alive) setScreenReader(on);
    });
    const reader = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => {
      alive = false;
      appState.remove();
      reader.remove();
    };
  }, []);

  const current = Math.min(index, count - 1);

  const moving =
    handsOff &&
    count > 1 &&
    !loading &&
    !reduceMotion &&
    !screenReader &&
    focused &&
    foreground &&
    !away;

  const list = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  /** Where the row is gliding to by itself; −1 when it is not. */
  const glide = useSharedValue(-1);

  useAnimatedReaction(
    () => glide.get(),
    (x) => {
      if (x >= 0) scrollTo(list, x, 0, false);
    }
  );

  useEffect(() => {
    if (!moving) return;
    const timer = setTimeout(() => {
      const next = nextCard(current, count);
      glide.set(scrollX.get());
      glide.set(
        withTiming(
          next * geometry.step,
          { duration: SPOTLIGHT.glideMs, easing: Easing.inOut(Easing.cubic) },
          () => {
            'worklet';
            glide.set(-1);
          }
        )
      );
      setIndex(next);
    }, SPOTLIGHT.interval);
    return () => clearTimeout(timer);
  }, [moving, current, count, geometry.step, glide, scrollX]);

  const takeOver = useCallback(() => {
    setHandsOff(false);
  }, []);

  const settle = useCallback(
    (x: number) => {
      const card = Math.round(x / Math.max(1, geometry.step));
      setIndex(Math.max(0, Math.min(count - 1, card)));
    },
    [geometry.step, count]
  );

  const tick = useCallback(() => {
    /* reacticx's rigid tick on letting go. iOS only — the app's rule. */
    if (Platform.OS === 'ios')
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {});
  }, []);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.set(event.contentOffset.x);
    },
    onBeginDrag: () => {
      cancelAnimation(glide);
      glide.set(-1);
      runOnJS(takeOver)();
    },
    onEndDrag: () => {
      runOnJS(tick)();
    },
    onMomentumEnd: (event) => {
      runOnJS(settle)(event.contentOffset.x);
    },
  });

  if (loading && !spotlight) {
    return (
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <DiscoverCarouselSkeleton />
      </View>
    );
  }

  return (
    <Animated.ScrollView
      ref={list}
      horizontal
      showsHorizontalScrollIndicator={false}
      /* Its own gesture: a sideways drag moves the row, a vertical one is the page's. */
      nestedScrollEnabled
      snapToInterval={geometry.step}
      snapToAlignment="start"
      decelerationRate="fast"
      disableIntervalMomentum
      scrollEventThrottle={16}
      overScrollMode="never"
      onScroll={onScroll}
      /* A horizontal scroller grows unless told not to (CLAUDE.md, gotchas). */
      style={styles.scroller}
      contentContainerStyle={styles.row}>
      {slides.map((slide, position) =>
        slide.kind === 'game' ? (
          <GameCard
            key={slide.key}
            slide={slide}
            geometry={geometry}
            position={position}
            count={count}
            scrollX={scrollX}
          />
        ) : (
          <CalendarCard
            key={slide.key}
            slide={slide}
            geometry={geometry}
            position={position}
            count={count}
            now={now}
            releaseDays={spotlight?.releaseDays ?? EMPTY_DAYS}
          />
        )
      )}
    </Animated.ScrollView>
  );
});

const EMPTY_DAYS: readonly number[] = [];

/** The near-black badge in a card's top right. */
function CardBadge({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View
      style={[styles.badge, { backgroundColor: withAlpha(theme.shadowInk, 0.82) }]}
      pointerEvents="none">
      <Text variant="h6" style={{ color: theme.white }}>
        {label}
      </Text>
    </View>
  );
}

/** Home's caption: the name on one line and a quiet line under it, over a scrim. */
function CardCaption({
  title,
  line,
  scrim,
}: {
  title: string;
  line: string | null;
  scrim: [string, string, ...string[]];
}) {
  const theme = useTheme();
  return (
    <View style={styles.caption} pointerEvents="none">
      <LinearGradient colors={scrim} locations={SCRIM_LOCATIONS} style={styles.fill} />
      <Text variant="h2" numberOfLines={1} style={{ color: theme.white }}>
        {title}
      </Text>
      {!!line && (
        <Text
          variant="body"
          numberOfLines={2}
          style={{ color: withAlpha(theme.white, DISCOVER.subtitleAlpha) }}>
          {line}
        </Text>
      )}
    </View>
  );
}

/** A card's frame: Home's size, corner and faint white edge, clipping what is inside. */
function CardFrame({
  geometry,
  background,
  label,
  onPress,
  children,
}: {
  geometry: DiscoverGeometry;
  background: string;
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={0.98}>
      <View
        style={[
          styles.card,
          {
            width: geometry.width,
            height: geometry.height,
            backgroundColor: background,
            borderColor: withAlpha(theme.white, DISCOVER.edgeAlpha),
          },
        ]}>
        {children}
      </View>
    </PressableScale>
  );
}

function GameCard({
  slide,
  geometry,
  position,
  count,
  scrollX,
}: {
  slide: Extract<Slide, { kind: 'game' }>;
  geometry: DiscoverGeometry;
  position: number;
  count: number;
  scrollX: SharedValue<number>;
}) {
  const router = useRouter();
  const theme = useTheme();
  const pulse = usePulse();
  const { game, art } = slide.game;
  const artWidth = parallaxArtWidth(geometry.width);

  /* reacticx's parallax: the art lags behind its card as the row moves. */
  const artStyle = useAnimatedStyle(() => {
    pulse.get();
    return {
      transform: [
        { translateX: parallaxShift(scrollX.get(), position, geometry.step, geometry.width) },
      ],
    };
  });

  return (
    <CardFrame
      geometry={geometry}
      background={theme.surfaceElevated}
      label={`${slide.spoken}. Card ${position + 1} of ${count}. Opens the game.`}
      onPress={() => router.push({ pathname: '/game/[id]', params: { id: game.id } })}>
      <Animated.View
        style={[styles.art, { width: artWidth, left: -(artWidth - geometry.width) / 2 }, artStyle]}>
        <Image
          source={{ uri: art }}
          style={styles.fill}
          contentFit="cover"
          /* Key art is composed for its upper middle. */
          contentPosition={{ top: '30%', left: '50%' }}
          transition={220}
          cachePolicy="memory-disk"
          recyclingKey={art}
          accessibilityIgnoresInvertColors
        />
      </Animated.View>
      <CardBadge label={slide.badge} />
      <CardCaption title={game.title} line={game.developer} scrim={SHADOW_SCRIM} />
    </CardFrame>
  );
}

/**
 * The last card: the month, as the calendar screen draws one — five rows of
 * numbered days — with the days a notable game is out on lit, and today
 * ringed. Drawn, not a picture, and still: a grid that drifted inside its
 * card would read as broken, not as depth.
 */
function CalendarCard({
  slide,
  geometry,
  position,
  count,
  now,
  releaseDays,
}: {
  slide: Extract<Slide, { kind: 'calendar' }>;
  geometry: DiscoverGeometry;
  position: number;
  count: number;
  now: number;
  releaseDays: readonly number[];
}) {
  const router = useRouter();
  const theme = useTheme();

  const today = new Date(now * 1000);
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const date = today.getUTCDate();
  const rows = useMemo(() => monthRows(year, month), [year, month]);
  const lit = useMemo(() => new Set(releaseDays), [releaseDays]);
  const scrim = useMemo(() => scrimColours(theme.surface, 1), [theme.surface]);

  const cell = (geometry.width - DAY_SIDE * 2 - DAY_GAP * (MONTH_COLUMNS - 1)) / MONTH_COLUMNS;
  const cellHeight = (geometry.height - DAY_SIDE * 2 - DAY_GAP * (rows.length - 1)) / rows.length;

  return (
    <CardFrame
      geometry={geometry}
      background={theme.surface}
      label={`${slide.spoken}${
        releaseDays.length > 0
          ? `, ${releaseDays.length} ${releaseDays.length === 1 ? 'day' : 'days'} with a notable release`
          : ''
      }. Card ${position + 1} of ${count}. Opens the calendar.`}
      onPress={() => router.push('/calendar')}>
      <View style={styles.month} pointerEvents="none">
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.week}>
            {row.map((day, column) => {
              if (day === null) {
                return <View key={column} style={{ width: cell, height: cellHeight }} />;
              }
              const release = lit.has(day);
              return (
                <View
                  key={column}
                  style={[
                    styles.day,
                    {
                      width: cell,
                      height: cellHeight,
                      backgroundColor: withAlpha(theme.text, release ? DAY_LIT : DAY_REST),
                      borderColor: day === date ? theme.primaryText : withAlpha(theme.text, 0),
                    },
                  ]}>
                  <Text
                    variant="caption"
                    style={[
                      styles.dayNumber,
                      { color: release || day === date ? theme.text : theme.textMuted },
                    ]}>
                    {day}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>
      <CardBadge label={slide.badge} />
      <CardCaption title="Release calendar" line={monthLabel(now)} scrim={scrim} />
    </CardFrame>
  );
}

/** Between two days, and from the card's edges to the month. */
const DAY_GAP = 4;
const DAY_SIDE = 12;
/** A day's square: the ink at 5%, and at 18% when a notable game is out on it. */
const DAY_REST = 0.05;
const DAY_LIT = 0.18;

const styles = StyleSheet.create({
  scroller: { flexGrow: 0 },
  /* From the page's margin, so the first card stands under the heading. */
  row: { paddingHorizontal: Spacing.x16, gap: DISCOVER.gap },
  card: {
    borderRadius: DISCOVER.radius,
    borderWidth: DISCOVER.edgeWidth,
    overflow: 'hidden',
  },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  art: { position: 'absolute', top: 0, bottom: 0 },
  caption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: DISCOVER.captionSide,
    paddingTop: DISCOVER.captionTop,
    paddingBottom: DISCOVER.captionBottom,
  },
  badge: {
    position: 'absolute',
    top: SPOTLIGHT.badgeInset,
    end: SPOTLIGHT.badgeInset,
    paddingHorizontal: Spacing.x8,
    paddingVertical: Spacing.x4,
    borderRadius: Radius.image,
  },
  month: {
    position: 'absolute',
    top: DAY_SIDE,
    left: DAY_SIDE,
    right: DAY_SIDE,
    gap: DAY_GAP,
  },
  week: { flexDirection: 'row', gap: DAY_GAP },
  day: {
    borderRadius: Radius.image,
    borderWidth: 1.5,
    paddingTop: 2,
    paddingLeft: 4,
  },
  dayNumber: { fontVariant: ['tabular-nums'] },
});
