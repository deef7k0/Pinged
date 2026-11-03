import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SoundCloudMark } from '@/components/player/soundcloud-mark';
import { PressGlyph } from '@/components/ui/press-glyph';
import { PressableScale } from '@/components/ui/pressable-scale';
import { useSelectable } from '@/components/ui/selectable';
import { Text } from '@/components/ui/text';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import { clockOf, firstPlayable, nextPlayable, noticeText, progressOf } from '@/lib/player-queue';
import { player, useNowPlaying, usePlayer, type PlayerQueue } from '@/store/player';
import { Loader } from '@/components/ui/loader';

/** The artwork beside the title. */
const ARTWORK = 44;
/** The play key. Larger than its neighbours: it is the bar's one primary action. */
const PLAY_KEY = 52;
/** How tall the scrub line is to a finger; the line drawn in it is 4. */
const SCRUB_TOUCH = 28;
const SCRUB_LINE = 4;
const SCRUB_THUMB = 12;

export type PlayerBarProps = {
  /**
   * The soundtrack on the screen this bar is docked to. With nothing loaded,
   * the bar shows its first playable track and the play key starts it.
   */
  queue: PlayerQueue | null;
};

/**
 * The player, docked at the foot of the soundtrack screen.
 *
 * What is playing and who uploaded it; a line to scrub along; previous, play
 * and next; and the owner's switch, **Keep playing**. It shows the app's one
 * player, whatever started it — a song Surprise Me began is still playing when
 * its soundtrack is opened, and this is where it is paused.
 *
 * ## Keep playing
 *
 * Music stops when this screen is left. That is the default and the owner's
 * rule. The switch turns it into the other thing they asked for: the music
 * carries on while the rest of the app is used, under a bar at the foot of the
 * display (`<MiniPlayer>`). The line beside the switch says which of the two
 * is in force, because a switch whose effect is only seen after leaving has to
 * say what it will do before then.
 *
 * It is a choice, so it is outlined and takes the accent's wash when on
 * (`useSelectable`); the transport keys are actions, so they are not.
 *
 * ## The scrub line is the responder system, not a gesture worklet
 *
 * A finger's `locationX` over the line's own width is the whole calculation,
 * and it runs a few times a second on a view this small. The children are
 * `pointerEvents="none"` so the touch always lands on the line itself —
 * `locationX` is measured from whichever view was touched, and from the fill
 * it would be a fraction of the fill.
 */
export function PlayerBar({ queue }: PlayerBarProps) {
  const theme = useTheme();
  const accent = useAccent();
  const insets = useSafeAreaInsets();
  const select = useSelectable();

  const nowPlaying = useNowPlaying();
  const phase = usePlayer((state) => state.phase);
  const notice = usePlayer((state) => state.notice);
  const preview = usePlayer((state) => state.preview);
  const keepPlaying = usePlayer((state) => state.keepPlaying);
  const hasNext = usePlayer(
    (state) => !!state.queue && nextPlayable(state.queue.tracks, state.index) !== -1
  );

  const first = queue ? firstPlayable(queue.tracks) : -1;
  const track = nowPlaying ?? (queue && first !== -1 ? queue.tracks[first] : null);

  /* A soundtrack with nothing this app may play has no player to dock. */
  if (!track) return null;

  const loaded = !!nowPlaying;
  const playing = loaded && phase === 'playing';
  const loading = loaded && phase === 'loading';

  function onPlay() {
    if (loaded) player.toggle();
    else if (queue && first !== -1) player.play(queue, first);
  }

  const under =
    notice && loaded
      ? noticeText(notice)
      : [track.uploader.name, preview && loaded ? 'Preview' : null].filter(Boolean).join(' · ');

  const keep = select(keepPlaying);

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: accent.card,
          borderTopColor: theme.border,
          paddingBottom: insets.bottom + Spacing.x12,
        },
      ]}>
      <View style={styles.now}>
        <PlayerArtwork uri={track.artworkUrl} size={ARTWORK} />

        <View style={styles.words}>
          <Text variant="itemTitle" numberOfLines={1}>
            {track.title}
          </Text>
          <Text
            variant="bodySmall"
            color={notice && loaded ? 'textSecondary' : 'textMuted'}
            numberOfLines={notice && loaded ? 2 : 1}>
            {under}
          </Text>
        </View>

        {/* The track's own page. With the uploader's name beside it, this is
            the credit SoundCloud asks for wherever a track is played. */}
        <SoundCloudMark url={track.permalinkUrl} label={`Open ${track.title} on SoundCloud`} />
      </View>

      <Scrubber enabled={loaded && !notice} listedMs={track.durationMs} />

      <View style={styles.controls}>
        <PressableScale
          accessibilityRole="switch"
          accessibilityState={{ checked: keepPlaying }}
          accessibilityLabel="Keep playing"
          accessibilityHint={
            keepPlaying
              ? 'On. Music carries on when you leave this screen.'
              : 'Off. Music stops when you leave this screen.'
          }
          onPress={() => player.setKeepPlaying(!keepPlaying)}
          pressedColor={keep.pressedColor}
          focusRing={keep.focusRing}
          scaleTo={0.97}
          style={StyleSheet.flatten([styles.keep, keep.style])}>
          <PressGlyph pop={keepPlaying}>
            <Ionicons
              name={keepPlaying ? 'checkmark-circle' : 'ellipse-outline'}
              size={16}
              color={keepPlaying ? accent.onSurface : theme.textSecondary}
            />
          </PressGlyph>
          <Text variant="button" color={keep.label}>
            Keep playing
          </Text>
        </PressableScale>

        <View style={styles.transport}>
          <TransportKey
            icon="play-skip-back"
            label="Previous track"
            disabled={!loaded}
            onPress={player.previous}
          />

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={playing || loading ? `Pause ${track.title}` : `Play ${track.title}`}
            onPress={onPlay}
            pressedColor={accent.pressed}
            focusRing={accent.ring}
            scaleTo={0.94}
            style={StyleSheet.flatten([styles.play, { backgroundColor: accent.color }])}>
            {loading ? (
              <Loader color={accent.ink} />
            ) : (
              /* Shrinks toward nothing under the finger and springs back as
                 the other glyph (Convx's `playGlyphPress`). */
              <PressGlyph motion="play">
                <Ionicons
                  name={playing ? 'pause' : 'play'}
                  size={24}
                  color={accent.ink}
                  /* A play triangle is optically left-heavy in a circle. */
                  style={playing ? undefined : styles.playNudge}
                />
              </PressGlyph>
            )}
          </PressableScale>

          <TransportKey
            icon="play-skip-forward"
            label="Next track"
            disabled={!loaded || !hasNext}
            onPress={player.next}
          />
        </View>
      </View>

      <Text variant="caption" color="textMuted">
        {keepPlaying
          ? 'Music carries on while you use the app.'
          : 'Music stops when you leave this screen.'}
      </Text>
    </View>
  );
}

/**
 * A track's artwork, or a note where it has none.
 *
 * `cachePolicy="memory"`, and that is a rule, not a tuning: expo-image writes
 * to disk by default, and SoundCloud's terms forbid an app to store a track's
 * artwork past the session. Every image of SoundCloud's in the app is drawn
 * through this for that reason.
 */
export function PlayerArtwork({ uri, size }: { uri: string | null; size: number }) {
  const theme = useTheme();
  const box = { width: size, height: size, borderRadius: Radius.image };

  if (!uri) {
    return (
      <View style={[styles.blank, box, { backgroundColor: theme.surfaceElevated }]}>
        <Ionicons name="musical-notes" size={Math.round(size * 0.42)} color={theme.textMuted} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      recyclingKey={uri}
      cachePolicy="memory"
      style={[box, { backgroundColor: theme.surfaceElevated }]}
      contentFit="cover"
      transition={200}
      accessibilityIgnoresInvertColors
    />
  );
}

type TransportKeyProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  disabled?: boolean;
  onPress: () => void;
};

/** Previous and next: a bare glyph at a finger's size. Dimmed in place when it cannot act. */
export function TransportKey({ icon, label, disabled = false, onPress }: TransportKeyProps) {
  const theme = useTheme();

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      pressedColor={theme.pressed}
      scaleTo={0.9}
      style={StyleSheet.flatten([styles.key, disabled && styles.dimmed])}>
      {/* Dips under the finger and, let go, steps the way it skips
          (Convx's `skipGlyphPress`). */}
      <PressGlyph motion="skip" direction={icon.includes('back') ? -1 : 1}>
        <Ionicons name={icon} size={22} color={theme.text} />
      </PressGlyph>
    </PressableScale>
  );
}

/** The line, the time each side of it, and a finger's worth of room to drag in. */
function Scrubber({ enabled, listedMs }: { enabled: boolean; listedMs: number | null }) {
  const theme = useTheme();
  const accent = useAccent();
  const position = usePlayer((state) => state.position);
  const playing = usePlayer((state) => state.duration);
  /* With nothing loaded the player has no length to report; the track waiting
     under the play key still has the one SoundCloud lists for it. */
  const duration = enabled || !listedMs ? playing : listedMs / 1000;

  const [width, setWidth] = useState(0);
  /* Where the finger is, while it is down. The player is told once, on release:
     a seek per frame of a drag is a hundred requests for audio nobody hears. */
  const [drag, setDrag] = useState<number | null>(null);

  const fraction = drag ?? (enabled ? progressOf(position, duration) : 0);

  const at = (event: GestureResponderEvent) =>
    width > 0 ? Math.min(1, Math.max(0, event.nativeEvent.locationX / width)) : 0;

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  return (
    <View style={styles.scrub}>
      <Text variant="caption" color="textMuted" style={styles.clock}>
        {clockOf(drag !== null ? drag * duration : enabled ? position : 0)}
      </Text>

      <View
        style={styles.scrubTouch}
        onLayout={onLayout}
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
        /* Once it has the finger it keeps it: a scroll view taking the touch
           back mid-drag would leave the thumb wherever it happened to be. */
        onResponderTerminationRequest={() => false}
        onResponderGrant={(event) => setDrag(at(event))}
        onResponderMove={(event) => setDrag(at(event))}
        onResponderRelease={(event) => {
          player.seek(at(event));
          setDrag(null);
        }}
        onResponderTerminate={() => setDrag(null)}>
        <View pointerEvents="none" style={[styles.scrubLine, { backgroundColor: accent.elevated }]}>
          <View
            style={[
              styles.scrubFill,
              { width: `${fraction * 100}%`, backgroundColor: accent.color },
            ]}
          />
        </View>

        {enabled && (
          <View
            pointerEvents="none"
            style={[styles.scrubThumb, { left: `${fraction * 100}%`, backgroundColor: theme.text }]}
          />
        )}
      </View>

      <Text variant="caption" color="textMuted" style={[styles.clock, styles.clockEnd]}>
        {duration > 0 ? clockOf(duration) : '--:--'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  /* Docked, so its fill runs to the bottom of the display and it pads the
     system's inset itself — the screen it sits on takes no bottom edge. */
  bar: {
    paddingHorizontal: Spacing.x16,
    paddingTop: Spacing.x12,
    gap: Spacing.x8,
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  now: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  words: { flex: 1, gap: 2 },
  blank: { alignItems: 'center', justifyContent: 'center' },

  scrub: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  /* Wide enough for "61:15" at the caption's size, so the line does not change
     length as the minutes gain a digit. */
  clock: { width: 34, fontVariant: ['tabular-nums'] },
  clockEnd: { textAlign: 'right' },
  scrubTouch: { flex: 1, height: SCRUB_TOUCH, justifyContent: 'center' },
  scrubLine: { height: SCRUB_LINE, borderRadius: Radius.pill, overflow: 'hidden' },
  scrubFill: { height: SCRUB_LINE, borderRadius: Radius.pill },
  scrubThumb: {
    position: 'absolute',
    top: (SCRUB_TOUCH - SCRUB_THUMB) / 2,
    width: SCRUB_THUMB,
    height: SCRUB_THUMB,
    marginLeft: -SCRUB_THUMB / 2,
    borderRadius: SCRUB_THUMB / 2,
  },

  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  keep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    height: 40,
    paddingHorizontal: Spacing.x12,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  transport: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
  key: {
    width: TapTarget,
    height: TapTarget,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  play: {
    width: PLAY_KEY,
    height: PLAY_KEY,
    borderRadius: PLAY_KEY / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playNudge: { marginLeft: 3 },
  dimmed: { opacity: 0.35 },
});
