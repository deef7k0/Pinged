import MaskedView from '@react-native-masked-view/masked-view';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedCoverImage } from '@/components/ui/animated-cover-image';
import { ArtworkMeshPage } from '@/components/ui/artwork-mesh-page';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import {
  Palette,
  PosterAspectRatio,
  Radius,
  Spacing,
  TapTarget,
  withAlpha,
} from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useAnimatedCover } from '@/hooks/use-animated-cover';
import { useArtworkMesh } from '@/hooks/use-artwork-mesh';
import { useTheme } from '@/hooks/use-theme';
import { topWashAlpha } from '@/lib/artwork-mesh';
import { INK_ON_LIGHT } from '@/lib/color';
import { sharpCoverUrl } from '@/lib/games/sharp-cover';
import { smoothScrimStops } from '@/lib/scrim';

/** The zoom, both ways: the request's ~300ms, easing out. */
const ZOOM_MS = 300;

/**
 * How much of the cover's foot dissolves into the page: an eighth of it.
 *
 * The reference dissolves 42% of a square sleeve. A box's foot is where its
 * name is printed — Who's Lila?'s, Hollow Knight's — and a 42% dissolve would
 * take the name with it. It needs far less here, because the page's first row
 * *is* the cover's foot (`lib/artwork-mesh.ts`): there is no colour to hide
 * the change of, only the edge.
 */
const DISSOLVE_SHARE = 0.12;

/**
 * Kept under the cover however short the display: the two keys and the line
 * under them, with air. On a phone the cover is full width and leaves far
 * more — a 2:3 cover on a 360×780 display stands 540 tall and leaves 240 —
 * and only on a short one is the cover's height trimmed to keep this.
 */
const ROOM_BELOW = TapTarget * 2 + Spacing.x48 + Spacing.x24;

/** The 40dp close key, reached at the tap floor. */
const CLOSE_SLOP = Math.ceil(Math.max(0, TapTarget - 40) / 2);
const CLOSE_SIZE = 40;

/** The reference's top band: the status bar and 32dp under it, here as far as the close key's foot. */
const TOP_BAND_BELOW_KEY = Spacing.x16;

/** The keys' unchosen ink, and a choice that cannot be made. */
const UNCHOSEN = 0.5;
const UNAVAILABLE = 0.3;

/** A smoothstep ramp, flat at both ends: no corner for the eye to read as an edge. */
const SMOOTH = smoothScrimStops(12);
const SMOOTH_LOCATIONS = SMOOTH.locations as unknown as readonly [number, number, ...number[]];
/** The mask's ramp: only its alpha is read. */
const MASK_COLORS = SMOOTH.alphas.map((alpha) =>
  withAlpha(Palette.shadowInk, alpha)
) as unknown as readonly [string, string, ...string[]];

function washColors(strength: number) {
  return SMOOTH.alphas.map((alpha) =>
    withAlpha(Palette.shadowInk, strength * (1 - alpha))
  ) as unknown as readonly [string, string, ...string[]];
}

/** Where the cover was on the page, in the window's coordinates. */
export type CoverOrigin = { x: number; y: number; width: number; height: number };

export type CoverViewerProps = {
  game: { id: string; title: string; coverUrl: string | null; heroUrl: string | null };
  /** The masthead cover's place, measured when it was tapped. */
  origin: CoverOrigin;
  /** The cover is back in its place: unmount this. */
  onClosed: () => void;
};

type Shown = 'static' | 'animated';

/**
 * The game page's cover, full size — and its animated version, when asked for.
 *
 * The owner's redesign (2026-10-21) of the zoom they asked for the day before:
 * "the artwork must be full-size zoomed in to the edges of the screen… The
 * space left below should be filled with the same effect that SimpMusic uses
 * for their Apple Music Now Playing screen style, with the blur from the
 * image, fading/blending into the artwork above. In that space, you should
 * add a button for 'static' or 'animated'. Only fetch animated when the user
 * taps on the animated button, and show if it has one. The buttons should be
 * text alone, in bold. Not inside a pill or a container. Static above and
 * Animated below." For one day (2026-10-28) BitChord's mesh of blobs stood
 * in for it; the owner had it taken back out: "Bring back simpmusic's apple
 * music now playing blur on the zoomed in version and remove the mesh blob."
 *
 * - **The cover runs edge to edge from the top of the display**, under the
 *   status bar, at 2:3. A display too short to leave `ROOM_BELOW` under it
 *   trims the cover's height, never its width.
 * - **Under it is SimpMusic's Apple Music page** (`<ArtworkMeshPage>`, a port
 *   of `AppleMusicMeshBackdrop.kt`): the cover's colours as a blurred mesh
 *   hung from its foot, the first row of which is the foot itself. The page
 *   is drawn again over the cover's last eighth inside a mask
 *   (`DISSOLVE_SHARE`), so the cover dissolves into it — the reference's own
 *   method for a clip it cannot mask, and the only one that works over
 *   Android's video surface. The mesh is read from the still cover; with the
 *   animation on, the page keeps the box art's colours.
 * - **Static and Animated** are bold words on that page, one over the other,
 *   no pill. Nothing is looked up until Animated is pressed
 *   (`useAnimatedCover`, `enabled` from then, `explicit` so the Animated
 *   artwork setting does not stand in the way of somebody asking). It then
 *   crossfades in, or the line under it says the game has none — which a
 *   known answer says before anybody presses. Reduce Motion: the word is
 *   there, unavailable, and says why.
 * - **A copy of the cover, not the cover**: drawn in a modal, laid out at its
 *   full size and transformed down onto the masthead cover's measured place,
 *   then transitioned to rest, its corner going from the masthead's to none.
 *   CSS transitions on React props (Reanimated 4), so the pose cannot be lost
 *   to a stalled frame (CLAUDE.md, the lost end value).
 * - **The cover is sharp at full size**: the 1080p cover (`sharpCoverUrl`),
 *   the page's own `t_cover_big` drawn while it loads.
 * - The close key, the system's back and a tap anywhere but the two words
 *   reverse the zoom.
 */
export function CoverViewer({ game, origin, onClosed }: CoverViewerProps) {
  const theme = useTheme();
  /* The game page's colour — the page's provider is round this too: what the
     viewer stands on until the mesh is read. */
  const page = useAccent().page;
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const duration = reduceMotion ? 0 : ZOOM_MS;

  /* The modal's own size: the cover is laid out in what is really there. */
  const [room, setRoom] = useState<{ width: number; height: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [settled, setSettled] = useState(false);
  const [asked, setAsked] = useState<Shown>('static');
  /* The animation's first frame is on screen — until then it is downloading. */
  const [drawn, setDrawn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const animated = useAnimatedCover({
    gameId: game.id,
    title: game.title,
    aspect: 'portrait',
    enabled: settled && asked === 'animated',
    explicit: true,
  });
  const mesh = useArtworkMesh(game.coverUrl ?? game.heroUrl);

  function measureRoom(event: LayoutChangeEvent) {
    if (room) return;
    const { width, height } = event.nativeEvent.layout;
    setRoom({ width, height });
  }

  /* The cover has been drawn once where it started: now it may set off. */
  function setOff() {
    if (open || timer.current) return;
    setOpen(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setSettled(true);
    }, duration);
  }

  function close() {
    if (!open) return;
    setOpen(false);
    setSettled(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(onClosed, duration);
  }

  /* Always the display's full width (the owner, 2026-10-21: covers were
     leaving "small gaps at the edges, left and right"). The cover's own 2:3,
     never the masthead's measured box: that is measured mid-press or
     mid-landing, scaled and turned, and a ratio read off it a hair too tall
     took width off the cover. A display too short to keep `ROOM_BELOW` under
     a whole 2:3 trims the cover's height instead — `cover` crops it — so the
     sides are never given up. */
  const target = room
    ? (() => {
        const width = room.width;
        const height = Math.min(
          width / PosterAspectRatio,
          room.height - insets.bottom - ROOM_BELOW
        );
        return { width, height, left: 0, top: 0 };
      })()
    : null;

  /* Where the copy starts: laid out at full size, moved and scaled onto the
     masthead's cover — each side by its own factor, since a trimmed cover is
     not quite the masthead's shape. */
  const from = target
    ? {
        x: origin.x + origin.width / 2 - (target.left + target.width / 2),
        y: origin.y + origin.height / 2 - (target.top + target.height / 2),
        scaleX: origin.width / target.width,
        scaleY: origin.height / target.height,
      }
    : null;

  const zoom = {
    transitionProperty: ['transform', 'borderRadius'],
    transitionDuration: duration,
    transitionTimingFunction: 'ease-out' as const,
  };
  const fade = {
    transitionProperty: 'opacity',
    transitionDuration: duration,
    transitionTimingFunction: 'ease-out',
  } as const;

  const staticUrl = sharpCoverUrl(game.coverUrl) ?? game.heroUrl;

  /* What the words say. A known "none" is said before anybody asks. */
  const none = animated.status === 'not_found';
  const looking = asked === 'animated' && (animated.status === 'loading' || !settled);
  const shown: Shown = asked === 'animated' && !none ? 'animated' : 'static';
  const note = reduceMotion
    ? 'Off while Reduce Motion is on'
    : none
      ? 'This game has no animated cover'
      : looking
        ? 'Looking for one…'
        : shown === 'animated' && !drawn
          ? 'Loading the animation…'
          : null;

  const ink = mesh && !mesh.whiteHolds ? INK_ON_LIGHT : theme.white;
  const seam = target ? target.top + target.height : 0;
  const fadeTop = target ? seam - target.height * DISSOLVE_SHARE : 0;
  const topBand = insets.top + Spacing.x12 + CLOSE_SIZE + TOP_BAND_BELOW_KEY;
  const wash = topWashAlpha(mesh?.topLuminance ?? 1);

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={close}>
      <View style={styles.root} onLayout={measureRoom} accessibilityViewIsModal>
        {/* The page — SimpMusic's Apple Music page, hung from the cover's foot —
            fading in; a tap on it closes. */}
        <Animated.View style={[StyleSheet.absoluteFill, fade, { opacity: open ? 1 : 0 }]}>
          <ArtworkMeshPage mesh={mesh} seam={seam} fallback={page} />
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessible={false} />
        </Animated.View>

        {target && from && (
          <Animated.View
            pointerEvents="none"
            onLayout={setOff}
            style={[
              styles.cover,
              zoom,
              {
                left: target.left,
                top: target.top,
                width: target.width,
                height: target.height,
                /* The masthead's corner where it starts — in proportion, at
                   the size the copy is drawn — and none edge to edge. */
                borderRadius: open ? 0 : Radius.image / from.scaleX,
                backgroundColor: theme.surfaceElevated,
                transform: open
                  ? [{ translateX: 0 }, { translateY: 0 }, { scaleX: 1 }, { scaleY: 1 }]
                  : [
                      { translateX: from.x },
                      { translateY: from.y },
                      { scaleX: from.scaleX },
                      { scaleY: from.scaleY },
                    ],
              },
            ]}>
            <AnimatedCoverImage
              staticUrl={staticUrl}
              placeholderUrl={game.coverUrl}
              animatedUrl={asked === 'animated' ? animated.animatedUrl : null}
              format={animated.format}
              status={asked === 'animated' ? animated.status : 'idle'}
              onFailed={animated.reportFailure}
              onAnimationShown={() => setDrawn(true)}
              aspect="portrait"
              /* The box's size, not the shape's 2:3: a trimmed cover is shorter. */
              style={[StyleSheet.absoluteFill, { aspectRatio: undefined }]}
              contentFit="cover"
              accessibilityLabel={
                shown === 'animated'
                  ? `${game.title}, animated cover art`
                  : `${game.title}, cover art`
              }
            />
          </Animated.View>
        )}

        {/* The page laid back over the cover's foot, faded in over its last
            eighth: the cover dissolves into the page, whatever is playing in
            it. Shown once the cover is at rest, so the band does not cross the
            cover on its way up. */}
        {target && (
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: open && settled ? 1 : 0,
                transitionProperty: 'opacity',
                transitionDuration: reduceMotion ? 0 : 160,
              },
            ]}>
            <MaskedView
              style={StyleSheet.absoluteFill}
              maskElement={
                <View style={StyleSheet.absoluteFill}>
                  <LinearGradient
                    colors={MASK_COLORS}
                    locations={SMOOTH_LOCATIONS}
                    style={[styles.band, { top: fadeTop, height: seam - fadeTop }]}
                  />
                  <View style={[styles.below, { top: seam, backgroundColor: Palette.shadowInk }]} />
                </View>
              }>
              <ArtworkMeshPage mesh={mesh} seam={seam} fallback={page} />
            </MaskedView>
          </Animated.View>
        )}

        {/* The status bar and the close key over a bright cover: a wash as dark
            as the cover's top is bright (the reference's 16–65%). */}
        <Animated.View
          pointerEvents="none"
          style={[styles.topBand, fade, { height: topBand, opacity: open ? 1 : 0 }]}>
          <LinearGradient
            colors={washColors(wash)}
            locations={SMOOTH_LOCATIONS}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.closeRow,
            fade,
            { top: insets.top + Spacing.x12, right: Spacing.x16, opacity: open ? 1 : 0 },
          ]}
          pointerEvents={open ? 'box-none' : 'none'}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Close the cover"
            onPress={close}
            hitSlop={CLOSE_SLOP}
            scaleTo={0.9}
            style={StyleSheet.flatten([
              styles.close,
              { backgroundColor: withAlpha(theme.white, 0.14) },
            ])}>
            <Ionicons name="close" size={22} color={theme.white} />
          </PressableScale>
        </Animated.View>

        {/* Static over Animated, bold words on the page and nothing round them,
            centred in the room under the cover. */}
        {target && (
          <Animated.View
            pointerEvents={open ? 'box-none' : 'none'}
            style={[
              styles.choices,
              fade,
              { top: seam, bottom: insets.bottom, opacity: open ? 1 : 0 },
            ]}>
            <View accessibilityRole="radiogroup" style={styles.choiceColumn}>
              <ChoiceWord
                label="Static"
                chosen={shown === 'static'}
                ink={ink}
                onPress={() => {
                  setAsked('static');
                  setDrawn(false);
                }}
              />
              <ChoiceWord
                label="Animated"
                chosen={shown === 'animated'}
                ink={ink}
                unavailable={reduceMotion || none}
                onPress={() => setAsked('animated')}
              />
              <Text
                variant="caption"
                style={[styles.note, { color: withAlpha(ink, 0.7) }]}
                accessibilityLiveRegion="polite">
                {note ?? ' '}
              </Text>
            </View>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

/** One of the two words: bold, on the page, the chosen one at full ink. */
function ChoiceWord({
  label,
  chosen,
  ink,
  unavailable = false,
  onPress,
}: {
  label: string;
  chosen: boolean;
  ink: string;
  unavailable?: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityState={{ selected: chosen, disabled: unavailable }}
      accessibilityLabel={label}
      disabled={unavailable}
      onPress={onPress}
      scaleTo={0.95}
      style={styles.word}>
      <Text
        variant="h2"
        style={{
          color: withAlpha(ink, unavailable ? UNAVAILABLE : chosen ? 1 : UNCHOSEN),
        }}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  cover: { position: 'absolute', overflow: 'hidden' },
  band: { position: 'absolute', left: 0, right: 0 },
  below: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  topBand: { position: 'absolute', top: 0, left: 0, right: 0 },
  closeRow: { position: 'absolute' },
  /* The screenshot viewer's close key: a 40dp disc, touched at the floor. */
  close: {
    width: CLOSE_SIZE,
    height: CLOSE_SIZE,
    borderRadius: CLOSE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choices: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceColumn: { alignItems: 'center' },
  word: {
    minHeight: TapTarget,
    minWidth: TapTarget * 2,
    paddingHorizontal: Spacing.x16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: { marginTop: Spacing.x4, textAlign: 'center' },
});
