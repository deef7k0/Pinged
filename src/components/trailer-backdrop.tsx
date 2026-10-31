import { useIsFocused } from 'expo-router';
import { Suspense, lazy, useState, type ComponentType, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';

import type { TrailerVideoProps } from '@/components/trailer-video';
import { useScreenChrome } from '@/hooks/use-screen-chrome';

/** How long the artwork takes to fade off the trailer: the reference's `tween(500)`. */
const ART_FADE_MS = 500;

/**
 * The player, loaded only when there is a trailer to play — see
 * `<TrailerVideo>` for why it is never imported directly. A build without the
 * native module gets nothing in its place, and keeps the still artwork.
 */
const TrailerVideo = lazy<ComponentType<TrailerVideoProps>>(() =>
  import('@/components/trailer-video')
    .then((module) => ({ default: module.TrailerVideo }))
    .catch(() => ({ default: NoTrailer }))
);

function NoTrailer(_: TrailerVideoProps) {
  return null;
}

export type TrailerBackdropProps = {
  /** The trailer to play, or null for the artwork alone (none, or switched off). */
  url: string | null;
  /** The artwork's height: once the page has scrolled this far, the video pauses. */
  height: number;
  /**
   * How far the page scrolls before the artwork is out of sight, when that is
   * not its height — the game page's hero is pinned behind the page and seen
   * until the page has covered it (`<PinnedHero coverAt>`).
   */
  until?: number;
  /** The artwork, drawn over the video until the video's first frame. */
  children: ReactNode;
};

/**
 * Artwork with its game's trailer under it — SimpMusic's artist header
 * (`ArtistScreen.kt`): the media layer is the video with the artwork on top,
 * and the artwork fades out over `ART_FADE_MS` once the video has drawn its
 * first frame. Until then — and for good, if the stream never starts — the
 * picture is what is seen; the video is never a black square. The game page's
 * hero and the studio page's banner.
 *
 * The artwork stays mounted under the faded layer: a page colour may be read
 * from it, and switching the trailer off brings it straight back.
 *
 * **The player exists only while this page is in front.** A covered page
 * unmounts it, which releases the decoder and the buffer; coming back mounts
 * a fresh one behind the picture, which fades again at its first frame. A
 * pause would keep the decoder, and a stack of game pages — each opened from
 * the last — would hold one each until playback failed on the next.
 *
 * **It plays only while it can be seen**: once the page has scrolled the
 * artwork away (read off the page's own scroll position on the UI thread,
 * crossing to React only when it changes) it pauses where it is. Under Reduce
 * Motion it is never mounted.
 *
 * **The caller covers the video's foot.** A video surface does not render
 * inside a mask on Android, so it cannot dissolve by its own alpha; both
 * pages that use this lay their hero's foot fade over it, into the page's
 * Material 3 colour (`<PinnedHero>`), and the blur and the drain go over it
 * too.
 */
export function TrailerBackdrop({ url, height, until, children }: TrailerBackdropProps) {
  const chrome = useScreenChrome();
  const resting = useSharedValue(0);
  const scrollY = chrome?.scrollY ?? resting;
  const focused = useIsFocused();
  const reduceMotion = useReducedMotion();

  const [inView, setInView] = useState(true);
  /* The url whose first frame is up — so a new trailer, or the same one
     mounted again on return, starts behind the picture. */
  const [drawn, setDrawn] = useState<string | null>(null);

  const visibleFor = until ?? height;
  useAnimatedReaction(
    () => scrollY.get() < visibleFor,
    (now, was) => {
      if (now !== was) runOnJS(setInView)(now);
    }
  );

  const playable = url && !reduceMotion && focused ? url : null;
  const shown = playable !== null && drawn === playable;

  return (
    <View style={{ height }}>
      {playable && (
        <Suspense fallback={null}>
          <TrailerVideo url={playable} playing={inView} onFirstFrame={() => setDrawn(playable)} />
        </Suspense>
      )}
      {/* A CSS transition on a React prop: the fade cannot lose its end
          value to a dropped frame (CLAUDE.md, the lost end value). */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: shown ? 0 : 1,
            transitionProperty: 'opacity',
            transitionDuration: ART_FADE_MS,
          },
        ]}>
        {children}
      </Animated.View>
    </View>
  );
}
