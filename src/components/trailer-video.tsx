import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';

export type TrailerVideoProps = {
  /** The video-only media playlist (`lib/games/steam-trailer.ts`). */
  url: string;
  /** On screen and in front: play. Anything else: pause where it is. */
  playing: boolean;
  /** The first frame is drawn — the artwork over it may fade now. */
  onFirstFrame: () => void;
  /**
   * Round and round, as behind a studio's banner (the default) — or once,
   * for the game page's header, which goes back to the cover when the
   * trailer is over (`onEnd`).
   */
  loop?: boolean;
  onEnd?: () => void;
};

/**
 * Forward buffer, in seconds: what the player fetches ahead of the frame on
 * screen. Android's default is 20; at 720p that is 3 MB already downloaded
 * for a banner somebody may scroll past in a second. Six is two of Steam's
 * three-second segments ahead — enough to loop without a stall.
 */
const FORWARD_BUFFER_S = 6;

/**
 * A game's trailer, looping silently behind its artwork — SimpMusic's
 * `MediaPlayerView(cropToBounds = true)` behind its artist header. Drawn by
 * `<TrailerBackdrop>`, on the game page's hero and the studio page's banner.
 *
 * **Imported only through `React.lazy`** (`<TrailerBackdrop>`). expo-video
 * calls `requireNativeModule('ExpoVideo')` the moment it is imported, so a
 * static import would take the page down on any build made before the module
 * was added; loaded lazily, such a build draws the still artwork.
 *
 * What keeps it cheap, each from SimpMusic or from this app's own rules:
 *
 * - **No sound, by construction.** The url is the video's own playlist; the
 *   audio rendition is never fetched (`chooseRendition`). It is muted as
 *   well, and mixes with others so it can never pause the app's music or
 *   anybody else's.
 * - **It exists only while its page is in front.** `<TrailerBackdrop>`
 *   unmounts it when the page is covered, which releases the player, its
 *   decoder and its buffer — a stack of game pages, each opened from the
 *   last, holds one player, not one each. Phones have a handful of hardware
 *   decoders, and a pause keeps its decoder.
 * - **It plays only while it can be seen**: `playing` is false once the
 *   artwork scrolls away; it stops by itself when the app is left
 *   (`staysActiveInBackground` is false); under Reduce Motion it is never
 *   mounted.
 * - **A short buffer** (`FORWARD_BUFFER_S`), and no lock-screen controls, no
 *   picture in picture, no fullscreen, no Live Text analysis.
 * - **Nothing covers the artwork until there is a frame.** The artwork is
 *   drawn over this and fades out only on `onFirstFrame`, so a slow stream or
 *   a failed one leaves the picture where it was — never a black square.
 */
export function TrailerVideo({
  url,
  playing,
  onFirstFrame,
  loop = true,
  onEnd,
}: TrailerVideoProps) {
  const player = useVideoPlayer({ uri: url, contentType: 'hls' }, (created) => {
    created.muted = true;
    created.loop = loop;
    created.audioMixingMode = 'mixWithOthers';
    created.staysActiveInBackground = false;
    created.showNowPlayingNotification = false;
    created.keepScreenOnWhilePlaying = false;
    created.bufferOptions = { preferredForwardBufferDuration: FORWARD_BUFFER_S };
  });

  /* A command to the native player, not React state. */
  useEventListener(player, 'playToEnd', () => onEnd?.());

  useEffect(() => {
    if (playing) player.play();
    else player.pause();
  }, [player, playing]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      /* Android: drawn inside the page, not through a hole in it. The default
         `surfaceView` is composited in its own layer behind the window, so
         when the page stretches at the end of a scroll (Android 12's
         overscroll) the video and the hole drift apart from the UI over them
         — the owner saw the video flicker over the page and parts of the page
         vanish. A `textureView` stretches, clips and scrolls with everything
         else, for a little more GPU work. iOS ignores this. */
      surfaceType="textureView"
      nativeControls={false}
      allowsPictureInPicture={false}
      allowsVideoFrameAnalysis={false}
      fullscreenOptions={{ enable: false }}
      onFirstFrameRender={onFirstFrame}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    />
  );
}
