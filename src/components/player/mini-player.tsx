import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, useSegments } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_BAR_FOOTPRINT, useKeyboardShown } from '@/components/app-tab-bar';
import { PlayerArtwork } from '@/components/player/player-bar';
import { PressGlyph } from '@/components/ui/press-glyph';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import {
  MINI_PLAYER_GAP,
  MINI_PLAYER_HEIGHT,
  MINI_PLAYER_MAX_WIDTH,
  MINI_PLAYER_MOVE_MS,
  MINI_PLAYER_SIDE,
} from '@/constants/player';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  hidesMiniPlayer,
  isTabRoute,
  nextPlayable,
  noticeText,
  progressOf,
} from '@/lib/player-queue';
import { player, useMiniPlayerActive, useNowPlaying, usePlayer } from '@/store/player';

const ARTWORK = 40;
const KEY = 40;

/**
 * The mini player: what is playing, as a bar at the foot of the app.
 *
 * The owner's words: music stops when the soundtrack screen is left, "but
 * there should be a button for playing in the background while in the app. A
 * mini player, like a bar, should be placed on the bottom of the screen." So
 * this is drawn only while **Keep playing** is on and something is loaded —
 * with the switch off there is nothing to show, because leaving stopped it.
 *
 * ## Where it is
 *
 * Mounted once, in the root layout, after the navigator: a sibling drawn over
 * every screen rather than a part of any. It is a capsule in the tab bar's
 * material, resting just above the system's inset — and, on the four tabs, a
 * tab bar's height further up, over the capsule that is already there. Moving
 * between the two is a CSS transition on a transform, so the place it rests
 * is a React prop and cannot be lost the way an animated style's can.
 *
 * Pages make room for it themselves: tab screens through the tab bar's
 * clearance, every other screen through `<Screen>`. Nothing it covers is out
 * of reach.
 *
 * ## Where it is not
 *
 * `hidesMiniPlayer` (`lib/player-queue.ts`) lists the routes: the soundtrack
 * screen, which has the whole player; Surprise Me and the scanner; and every
 * modal — a sheet the system draws over the whole app on iOS, this bar
 * included. The music does not stop there. The bar is back when the route is
 * left.
 *
 * ## What it carries
 *
 * The track and its uploader — the credit SoundCloud's terms ask for wherever
 * a track plays — then play, next, and a cross that stops the music and takes
 * the bar away. Pressing the bar itself opens the soundtrack it is playing
 * from, where SoundCloud's logo and the link to each track are.
 */
export function MiniPlayer() {
  const theme = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const keyboardShown = useKeyboardShown();

  const active = useMiniPlayerActive();
  const track = useNowPlaying();
  const phase = usePlayer((state) => state.phase);
  const notice = usePlayer((state) => state.notice);
  const gameId = usePlayer((state) => state.queue?.gameId ?? null);
  const gameTitle = usePlayer((state) => state.queue?.gameTitle ?? null);
  const hasNext = usePlayer(
    (state) => !!state.queue && nextPlayable(state.queue.tracks, state.index) !== -1
  );

  if (!active || !track || keyboardShown || hidesMiniPlayer(segments)) return null;

  const playing = phase === 'playing';
  const loading = phase === 'loading';
  const onTabs = isTabRoute(segments);

  function open() {
    if (!gameId) return;
    router.push({
      pathname: '/soundtrack/[id]',
      params: { id: gameId, title: gameTitle ?? '' },
    });
  }

  const words = (
    <>
      <PlayerArtwork uri={track.artworkUrl} size={ARTWORK} />
      <View style={styles.words}>
        <Text variant="itemTitle" numberOfLines={1}>
          {track.title}
        </Text>
        <Text variant="bodySmall" color="textMuted" numberOfLines={1}>
          {notice ? noticeText(notice) : track.uploader.name}
        </Text>
      </View>
    </>
  );

  return (
    <View
      pointerEvents="box-none"
      style={[styles.layer, { paddingBottom: insets.bottom + MINI_PLAYER_GAP }]}>
      <Animated.View
        style={[
          styles.capsule,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            transform: [{ translateY: onTabs ? -TAB_BAR_FOOTPRINT : 0 }],
            transitionDuration: reduceMotion ? 0 : MINI_PLAYER_MOVE_MS,
          },
        ]}>
        {gameId ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`${track.title} by ${track.uploader.name}. Open the soundtrack.`}
            onPress={open}
            scaleTo={0.99}
            style={styles.body}>
            {words}
          </PressableScale>
        ) : (
          <View style={styles.body}>{words}</View>
        )}

        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={playing || loading ? `Pause ${track.title}` : `Play ${track.title}`}
          onPress={player.toggle}
          pressedColor={theme.pressed}
          scaleTo={0.9}
          style={styles.key}>
          {loading ? (
            <ActivityIndicator size="small" color={theme.text} />
          ) : (
            <PressGlyph motion="play">
              <Ionicons
                name={playing ? 'pause' : 'play'}
                size={20}
                color={theme.text}
                style={playing ? undefined : styles.playNudge}
              />
            </PressGlyph>
          )}
        </PressableScale>

        {hasNext && (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Next track"
            onPress={player.next}
            pressedColor={theme.pressed}
            scaleTo={0.9}
            style={styles.key}>
            <PressGlyph motion="skip">
              <Ionicons name="play-skip-forward" size={18} color={theme.text} />
            </PressGlyph>
          </PressableScale>
        )}

        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Stop the music and close the player"
          onPress={player.stop}
          pressedColor={theme.pressed}
          scaleTo={0.9}
          style={styles.key}>
          <PressGlyph>
            <Ionicons name="close" size={20} color={theme.textSecondary} />
          </PressGlyph>
        </PressableScale>

        <Progress />
      </Animated.View>
    </View>
  );
}

/**
 * How far through, as a line along the capsule's foot.
 *
 * Its own component so the four-a-second position re-renders two views and
 * not the whole bar. It is a reading, not a control: scrubbing is the docked
 * bar's, on the soundtrack screen, where the line is a finger tall.
 */
function Progress() {
  const theme = useTheme();
  const fraction = usePlayer((state) => progressOf(state.position, state.duration));

  return (
    <View
      pointerEvents="none"
      style={[styles.progress, { backgroundColor: theme.surfaceSelected }]}>
      <View
        style={[
          styles.progressFill,
          { width: `${fraction * 100}%`, backgroundColor: theme.primaryText },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /* Over everything, at the foot, with nothing of its own drawn: the capsule
     is the only thing here and touches beside it reach the page. */
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: MINI_PLAYER_SIDE,
  },
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: MINI_PLAYER_MAX_WIDTH,
    height: MINI_PLAYER_HEIGHT,
    borderRadius: MINI_PLAYER_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
    /* 12, not 8: at 8 the artwork's top corner pokes through the capsule's curve. */
    paddingLeft: Spacing.x12,
    paddingRight: Spacing.x4,
    transitionProperty: 'transform',
    transitionTimingFunction: 'ease-out',
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    height: MINI_PLAYER_HEIGHT,
  },
  words: { flex: 1, gap: 1 },
  key: {
    width: KEY,
    height: MINI_PLAYER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: KEY / 2,
  },
  playNudge: { marginLeft: 2 },
  /* Inset by the capsule's own corner, so the line is never cut by the curve. */
  progress: {
    position: 'absolute',
    left: MINI_PLAYER_HEIGHT / 2,
    right: MINI_PLAYER_HEIGHT / 2,
    bottom: 0,
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: { height: 2 },
});
