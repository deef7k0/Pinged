import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlayerArtwork } from '@/components/player/player-bar';
import { SoundCloudMark } from '@/components/player/soundcloud-mark';
import { Loader } from '@/components/ui/loader';
import { PressGlyph } from '@/components/ui/press-glyph';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Palette, Radius, Spacing, Typeface, withAlpha } from '@/constants/theme';
import { clockOf, nextPlayable, noticeText, progressOf } from '@/lib/player-queue';
import { player, useNowPlaying, usePlayer } from '@/store/player';

/** The art's margin from the display's sides, Apple Music's. */
const ART_SIDE = 32;
/** The scrubber's line at rest and under a finger, and its touch band. */
const LINE_REST = 6;
const LINE_HELD = 14;
const SCRUB_TOUCH = 36;
/** Every ink on the page: white over the darkened blur, whatever the cover. */
const INK = Palette.white;
const QUIET = withAlpha(Palette.white, 0.6);

/**
 * Now Playing, full screen — Apple Music's (the Apple pass, 2026-11-05),
 * opened by tapping the mini player: the track's artwork blurred over the
 * whole display and darkened, the artwork large, the title and uploader with
 * SoundCloud's mark and link (the credit its terms ask for wherever a track
 * is played), a scrubber that swells under the finger, and the transport as
 * bare glyphs — no circles.
 *
 * It plays nothing itself: everything goes through `player`, so closing it
 * leaves the music as it was, and the mini player comes back under it. The
 * artwork is SoundCloud's, so it is held in memory only (`cachePolicy`),
 * as every SoundCloud image in the app is (§ Soundtracks).
 *
 * When the music stops while it is open — the queue ended, or Stop from
 * elsewhere — it closes itself.
 */
export default function NowPlayingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const track = useNowPlaying();
  const phase = usePlayer((state) => state.phase);
  const notice = usePlayer((state) => state.notice);
  const preview = usePlayer((state) => state.preview);
  const keepPlaying = usePlayer((state) => state.keepPlaying);
  const gameId = usePlayer((state) => state.queue?.gameId ?? null);
  const gameTitle = usePlayer((state) => state.queue?.gameTitle ?? null);
  const hasNext = usePlayer(
    (state) => !!state.queue && nextPlayable(state.queue.tracks, state.index) !== -1
  );

  const gone = !track;
  useEffect(() => {
    if (gone && router.canGoBack()) router.back();
  }, [gone, router]);

  if (!track) return <View style={styles.page} />;

  const playing = phase === 'playing';
  const loading = phase === 'loading';
  /* As large as the width allows, and never so tall the controls go under the fold. */
  const art = Math.max(160, Math.min(width - ART_SIDE * 2, height * 0.46));
  const under = notice
    ? noticeText(notice)
    : [track.uploader.name, preview ? 'Preview' : null].filter(Boolean).join(' · ');

  return (
    <View style={styles.page}>
      {/* The cover, blurred over the display and darkened so white reads on it. */}
      {track.artworkUrl && (
        <Image
          source={{ uri: track.artworkUrl }}
          cachePolicy="memory"
          blurRadius={60}
          contentFit="cover"
          style={StyleSheet.absoluteFill}
          accessible={false}
        />
      )}
      <View style={[StyleSheet.absoluteFill, styles.veil]} />

      <View
        style={[
          styles.body,
          { paddingTop: insets.top + Spacing.x8, paddingBottom: insets.bottom + Spacing.x24 },
        ]}>
        <View style={styles.top}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Close Now Playing"
            onPress={() => router.back()}
            hitSlop={8}
            scaleTo={0.9}
            style={styles.close}>
            <PressGlyph>
              <Ionicons name="chevron-down" size={28} color={INK} />
            </PressGlyph>
          </PressableScale>
          {!!gameTitle && (
            <Text numberOfLines={1} style={styles.from}>
              {gameTitle}
            </Text>
          )}
          {/* The soundtrack it came from, where the rest of it is. */}
          {gameId ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Open the whole soundtrack"
              onPress={() => {
                router.back();
                router.push({
                  pathname: '/soundtrack/[id]',
                  params: { id: gameId, title: gameTitle ?? '' },
                });
              }}
              hitSlop={8}
              scaleTo={0.9}
              style={styles.close}>
              <PressGlyph>
                <Ionicons name="list" size={24} color={INK} />
              </PressGlyph>
            </PressableScale>
          ) : (
            <View style={styles.close} />
          )}
        </View>

        <View style={styles.artBox}>
          <View style={[styles.art, { width: art, height: art }]}>
            <PlayerArtwork uri={track.artworkUrl} size={art} />
          </View>
        </View>

        <View style={styles.controls}>
          <View style={styles.titleRow}>
            <View style={styles.words}>
              <Text numberOfLines={1} style={styles.title}>
                {track.title}
              </Text>
              <Text numberOfLines={2} style={styles.uploader}>
                {under}
              </Text>
            </View>
            {/* The track's own page: with the uploader's name, the credit. */}
            <SoundCloudMark url={track.permalinkUrl} label={`Open ${track.title} on SoundCloud`} />
          </View>

          <Scrubber enabled={!notice} listedMs={track.durationMs} />

          <View style={styles.transport}>
            <Glyph
              icon="play-back"
              size={36}
              label="Previous track"
              onPress={player.previous}
              motion="skip"
              direction={-1}
            />
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={
                playing || loading ? `Pause ${track.title}` : `Play ${track.title}`
              }
              onPress={player.toggle}
              scaleTo={0.9}
              style={styles.playKey}>
              {loading ? (
                <Loader color={INK} />
              ) : (
                <PressGlyph motion="play">
                  <Ionicons name={playing ? 'pause' : 'play'} size={56} color={INK} />
                </PressGlyph>
              )}
            </PressableScale>
            <Glyph
              icon="play-forward"
              size={36}
              label="Next track"
              onPress={player.next}
              disabled={!hasNext}
              motion="skip"
              direction={1}
            />
          </View>

          <View style={styles.keep}>
            <View style={styles.words}>
              <Text style={styles.keepTitle}>Keep playing</Text>
              <Text style={styles.uploader}>
                {keepPlaying
                  ? 'Music carries on while you use the app.'
                  : 'Music stops when you leave its screen.'}
              </Text>
            </View>
            <Switch
              value={keepPlaying}
              onValueChange={(value) => player.setKeepPlaying(value)}
              label="Keep playing"
              tint={Palette.white}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

/** A transport glyph with no circle round it, Apple Music's. */
function Glyph({
  icon,
  size,
  label,
  onPress,
  disabled = false,
  motion,
  direction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  size: number;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  motion?: 'skip';
  direction?: 1 | -1;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      scaleTo={0.88}
      style={StyleSheet.flatten([styles.glyph, disabled && styles.dimmed])}>
      <PressGlyph motion={motion} direction={direction}>
        <Ionicons name={icon} size={size} color={INK} />
      </PressGlyph>
    </PressableScale>
  );
}

/**
 * The position in the track: a line that swells while it is held, the two
 * clocks under it. A drag moves a preview of the position and seeks once on
 * release — a seek per frame would be a request per frame.
 */
function Scrubber({ enabled, listedMs }: { enabled: boolean; listedMs: number | null }) {
  const reduceMotion = useReducedMotion();
  const position = usePlayer((state) => state.position);
  const playing = usePlayer((state) => state.duration);
  const duration = enabled || !listedMs ? playing : listedMs / 1000;
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);

  const fraction = drag ?? (enabled ? progressOf(position, duration) : 0);
  const at = (event: GestureResponderEvent) =>
    width > 0 ? Math.min(1, Math.max(0, event.nativeEvent.locationX / width)) : 0;
  const held = drag !== null;
  const line = held ? LINE_HELD : LINE_REST;

  return (
    <View style={styles.scrub}>
      <View
        style={styles.scrubTouch}
        onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Position in the track"
        accessibilityState={{ disabled: !enabled }}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          if (!enabled) return;
          const step = event.nativeEvent.actionName === 'increment' ? 0.05 : -0.05;
          player.seek(progressOf(position, duration) + step);
        }}
        onStartShouldSetResponder={() => enabled}
        onMoveShouldSetResponder={() => enabled}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(event) => setDrag(at(event))}
        onResponderMove={(event) => setDrag(at(event))}
        onResponderRelease={(event) => {
          player.seek(at(event));
          setDrag(null);
        }}
        onResponderTerminate={() => setDrag(null)}>
        <View
          pointerEvents="none"
          style={[
            styles.line,
            {
              height: line,
              borderRadius: line / 2,
              transitionProperty: 'height',
              transitionDuration: reduceMotion ? 0 : 180,
            },
          ]}>
          <View style={[styles.fill, { width: `${fraction * 100}%` }]} />
        </View>
      </View>
      <View style={styles.clocks}>
        <Text style={styles.clock}>{clockOf(held ? drag * duration : enabled ? position : 0)}</Text>
        <Text style={styles.clock}>
          {duration > 0
            ? `-${clockOf(Math.max(0, duration - (held ? drag * duration : position)))}`
            : '--:--'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Palette.background },
  veil: { backgroundColor: withAlpha(Palette.shadowInk, 0.45) },
  body: { flex: 1, paddingHorizontal: ART_SIDE - Spacing.x8 },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  from: {
    flex: 1,
    textAlign: 'center',
    fontFamily: Typeface.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: QUIET,
  },
  artBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  art: {
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
    boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
  },
  controls: { gap: Spacing.x16, paddingHorizontal: Spacing.x8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  words: { flex: 1, gap: 2 },
  title: { fontFamily: Typeface.semibold, fontSize: 22, lineHeight: 28, color: INK },
  uploader: { fontFamily: Typeface.regular, fontSize: 15, lineHeight: 20, color: QUIET },
  scrub: { gap: Spacing.x4 },
  scrubTouch: { height: SCRUB_TOUCH, justifyContent: 'center' },
  line: { overflow: 'hidden', backgroundColor: withAlpha(Palette.white, 0.25) },
  fill: { height: '100%', backgroundColor: withAlpha(Palette.white, 0.85) },
  clocks: { flexDirection: 'row', justifyContent: 'space-between' },
  clock: {
    fontFamily: Typeface.medium,
    fontSize: 12,
    lineHeight: 16,
    color: QUIET,
    fontVariant: ['tabular-nums'],
  },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: Spacing.x8,
  },
  glyph: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  playKey: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  dimmed: { opacity: 0.35 },
  keep: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  keepTitle: { fontFamily: Typeface.semibold, fontSize: 15, lineHeight: 20, color: INK },
});
