import {
  Canvas,
  Group,
  Image,
  Paint,
  RuntimeShader,
  Skia,
  rect,
  useImage,
  type SkAnimatedImage,
  type SkData,
  type SkImage,
  type SkSurface,
  type Video,
} from '@shopify/react-native-skia';
import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import {
  runOnJS,
  runOnUI,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { createWorkletRuntime, runOnRuntimeAsync } from 'react-native-worklets';

import { animatedFormatOf } from '@/lib/animated-cover';
import { isApng, splitApng } from '@/lib/apng';
import {
  PROGRESSIVE_BLUR,
  bandShader,
  blurShader,
  blurSourceUri,
  coverRect,
} from '@/lib/progressive-blur';

/* Compiled once, when this module is first loaded — which is when a page
   first draws its hero (`React.lazy`, `<PinnedHero>`). */
const SHORT = {
  horizontal: Skia.RuntimeEffect.Make(blurShader('horizontal')),
  vertical: Skia.RuntimeEffect.Make(blurShader('vertical')),
};
/* The long hero's: the blur from higher up, under the title (`longKnee`). */
const LONG = {
  horizontal: Skia.RuntimeEffect.Make(blurShader('horizontal', PROGRESSIVE_BLUR.longKnee)),
  vertical: Skia.RuntimeEffect.Make(blurShader('vertical', PROGRESSIVE_BLUR.longKnee)),
};

/** How much of the art, from its foot, the band's tail is stretched from. */
const TAIL_STRIP = 0.03;

/* The game page's band (`bandShader`): a thin row of blur under its words. */
const BAND_PASSES = {
  horizontal: Skia.RuntimeEffect.Make(bandShader('horizontal')),
  vertical: Skia.RuntimeEffect.Make(bandShader('vertical')),
};

export type ProgressiveBlurProps = {
  /** The art, as the sharp copy draws it. A smaller copy of it is fetched (`blurSourceUri`). */
  uri: string;
  /**
   * The art's box, in dp. The canvas is taller: it runs on past the art's foot
   * by `TAIL` of its height, for the reflection (`tailHeight`).
   */
  width: number;
  height: number;
  /** Where the art is anchored in its box, 0–1 on each axis, as expo-image's `contentPosition`. */
  anchorX: number;
  anchorY: number;
  /** How far the climb has come: 0 at rest (the foot alone), 1 when the whole picture is soft. */
  progress: SharedValue<number>;
  /** It cannot draw — no shader, no picture: the caller falls back to its old blurred copy. */
  onFail: () => void;
  /** The long hero's blur, from higher up (`longKnee`) — the game page's and a studio's. */
  long?: boolean;
  /**
   * The animated cover — an animated WebP or GIF (`skiaAnimates`) — decoded
   * here and drawn twice: sharp over the art's box, and into the blur's
   * picture, so the blurred foot and the tail move with it. Null for the
   * still. **Changing it never remounts the blur**: the same canvas draws
   * the still, then the frames, then the still again.
   */
  animatedUri?: string | null;
  /** The animation could not be decoded or does not move here: the caller draws it another way. */
  onAnimationFail?: (error?: unknown) => void;
  /** The blur has its picture and is drawn: the caller can let go of its solid fade. */
  onReady?: () => void;
  /** How far the blur has moved down, in sides — the cover in front, a page with no title. */
  drop?: SharedValue<number>;
  /** How far the whole blur slides down, in sides — the cover in front. */
  slide?: SharedValue<number>;
  /** How many sides longer than Convx's the tail runs (`heroExtension`); may be less than nothing. */
  extend?: number;
  /**
   * The band, in sides of the art: the blur comes in from `from` and is
   * heavy well before `to` (`bandShader`) — the game page's, in place of
   * Convx's foot. Fixed for the life of the component.
   */
  band?: { from: number; to: number } | null;
};

/**
 * The pinned hero's blur, row by row — Convx's (`lib/progressive-blur` says it
 * all in numbers): sharp at the top, softening toward the foot at rest, and a
 * second ramp climbing to the top as the page scrolls.
 *
 * A Skia canvas a quarter of the size of the art **and its tail**, scaled back
 * up to cover them: the art drawn into it, and under it the art again, turned
 * over in its own foot — Convx's mirrored tail — then two runtime-shader image
 * filters over the lot, the horizontal pass inside, the vertical outside,
 * composed by nesting. What it draws is transparent where the radius is
 * nothing, so it lies over the sharp art and over a trailer, and below the
 * art's foot it is the only thing there.
 *
 * Each copy is clipped to its own band, so a picture taller than its box (a
 * cover standing in for key art) does not spill into the other's.
 *
 * `progress` is read on the UI thread and handed to the shaders as a uniform;
 * nothing here renders as the page scrolls. Lazily imported: Skia is a native
 * module, and a build without it must still draw a page.
 */
export default function ProgressiveBlur({
  uri,
  width,
  height,
  anchorX,
  anchorY,
  progress,
  onFail,
  long = false,
  animatedUri = null,
  onAnimationFail,
  onReady,
  drop,
  slide,
  extend = 0,
  band = null,
}: ProgressiveBlurProps) {
  const banded = !!band;
  const passes = banded ? BAND_PASSES : long ? LONG : SHORT;
  const HORIZONTAL = passes.horizontal;
  const VERTICAL = passes.vertical;
  const bandFrom = band?.from ?? 0;
  const bandTo = band?.to ?? 0;
  const image = useImage(blurSourceUri(uri), onFail);
  const failed = !HORIZONTAL || !VERTICAL;
  const frame = useAnimationFrames(animatedUri, onAnimationFail);

  useEffect(() => {
    if (failed) onFail();
  }, [failed, onFail]);

  const drawn = !failed && !!image;
  useEffect(() => {
    if (drawn) onReady?.();
  }, [drawn, onReady]);

  /* The whole box, the art and its tail, and where the art ends in it — kept
     as exact shares of the canvas, so the art's foot lands where Convx's
     square's does whatever the rounding. */
  const extent = PROGRESSIVE_BLUR.heroExtent + extend;
  const box = (height * extent) / PROGRESSIVE_BLUR.artworkExtent;
  const w = Math.max(1, Math.ceil(width / PROGRESSIVE_BLUR.downscale));
  const h = Math.max(1, Math.ceil(box / PROGRESSIVE_BLUR.downscale));
  const foot = (h * PROGRESSIVE_BLUR.artworkExtent) / extent;
  const side = h / extent;
  /* The band's tail: the art's last `TAIL_STRIP` stretched from its foot to
     the canvas's — y → foot + (y − (foot − strip)) · K. */
  const strip = Math.max(1, foot * TAIL_STRIP);
  const stretchK = Math.max(1, (h - foot) / strip);
  const stretchY = foot - stretchK * (foot - strip);

  /* Each shader is handed exactly its own uniforms. */
  const uniforms = useDerivedValue((): Record<string, number | number[]> =>
    banded
      ? {
          size: [w, h],
          side,
          pxPerPt: w / PROGRESSIVE_BLUR.reference,
          progress: progress.get(),
          from: bandFrom,
          to: bandTo,
          slide: slide ? slide.get() : 0,
        }
      : {
          size: [w, h],
          side,
          pxPerPt: w / PROGRESSIVE_BLUR.reference,
          progress: progress.get(),
          drop: drop ? drop.get() : 0,
          slide: slide ? slide.get() : 0,
        }
  );

  if (failed || !HORIZONTAL || !VERTICAL || !image) return null;

  const art = coverRect(
    { width: image.width(), height: image.height() },
    { width: w, height: foot },
    anchorX,
    anchorY
  );
  const picture = (
    <>
      <Image image={image} x={art.x} y={art.y} width={art.width} height={art.height} fit="fill" />
      <FrameImage frame={frame} width={w} height={foot} anchorX={anchorX} anchorY={anchorY} />
    </>
  );

  return (
    <View pointerEvents="none" style={[styles.box, { height: box }]}>
      {/* The animation sharp, over the art's box: nothing until a frame, and
          nothing at all for the still — the same canvas either way. */}
      <Canvas pointerEvents="none" style={[styles.sharp, { width, height }]}>
        <FrameImage
          frame={frame}
          width={width}
          height={height}
          anchorX={anchorX}
          anchorY={anchorY}
        />
      </Canvas>
      <Canvas
        style={{
          position: 'absolute',
          width: w,
          height: h,
          /* Scaled about its centre to cover the art and its tail exactly. */
          left: (width - w) / 2,
          top: (box - h) / 2,
          transform: [{ scaleX: width / w }, { scaleY: box / h }],
        }}>
        <Group
          layer={
            <Paint>
              <RuntimeShader source={VERTICAL} uniforms={uniforms}>
                <RuntimeShader source={HORIZONTAL} uniforms={uniforms} />
              </RuntimeShader>
            </Paint>
          }>
          <Group clip={rect(0, 0, w, foot)}>{picture}</Group>
          {/* The tail. Convx's: the art turned over in its own foot,
              y → 2·foot − y. The band's: the art's last rows stretched down
              over it, so under the blur it is the cover's own colours fading
              out — never a reflection (the owner's, 2026-11-04: "the blur is
              kinda back to looking like a reflection rather than a fade"). */}
          <Group clip={rect(0, foot, w, h - foot)}>
            {banded ? (
              <Group transform={[{ translateY: stretchY }, { scaleY: stretchK }]}>{picture}</Group>
            ) : (
              <Group transform={[{ translateY: 2 * foot }, { scaleY: -1 }]}>{picture}</Group>
            )}
          </Group>
        </Group>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  sharp: { position: 'absolute', top: 0, left: 0 },
  /* From the art's top, as tall as the art and its tail (set where drawn). */
  box: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
});

/**
 * An animated cover's frame, covering a box `width` × `height` as the still
 * does — worked out on the UI thread from the frame's own size.
 */
function FrameImage({
  frame,
  width,
  height,
  anchorX,
  anchorY,
}: {
  frame: SharedValue<SkImage | null>;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
}) {
  const place = useDerivedValue(() => {
    const image = frame.get();
    return coverRect(
      image ? { width: image.width(), height: image.height() } : { width: 0, height: 0 },
      { width, height },
      anchorX,
      anchorY
    );
  });
  const x = useDerivedValue(() => place.get().x);
  const y = useDerivedValue(() => place.get().y);
  const w = useDerivedValue(() => place.get().width);
  const h = useDerivedValue(() => place.get().height);
  return <Image image={frame} x={x} y={y} width={w} height={h} fit="fill" />;
}

/**
 * An animated cover's frames, decoded in Skia and handed out one at a time
 * on the UI thread — an animated WebP or GIF, or a video (WebM, MP4) — so
 * the one blur draws the animation's own moment, at rest and as the page
 * scrolls. Skia's `useAnimatedImageValue` and `useVideo`, rewritten, because
 * each had what the owner saw as covers that crash or sit still (2026-11-04:
 * "Some animated artworks don't play and are paused, and some other crash
 * the app. Like death stranding"):
 *
 * - **`useAnimatedImageValue` throws on a file it cannot decode**, times
 *   every frame by the first one's duration, and stops on the last frame of
 *   a file that says to play once. Here a failure is `onFail`, each frame
 *   waits its own duration, and a finished animation starts again from its
 *   bytes.
 * - **`useVideo` disposes Android's frame in the same breath it hands it
 *   over** (`copyFrameOnAndroid`), so the next draw reads a disposed image —
 *   "Attempted to access a disposed object", thrown on the UI thread, which
 *   closes the app. Here the frame shown is kept and the one before it
 *   disposed. Its Android decoder also takes a frame on every display frame
 *   (twice a 30fps file's speed) and never loops: here it is asked at the
 *   file's own frame rate, and rewound at its end.
 * - **Skia has no APNG decoder**, and many SteamGridDB grids are APNGs: the
 *   file is split into one plain PNG a frame (`lib/apng`) and each is drawn,
 *   as the format says — where it goes, replacing or over what is there,
 *   cleared or put back after — onto a canvas of the file's size in memory
 *   (a CPU surface, so the frame it gives is safe to draw anywhere), one
 *   decode a frame. Before, an APNG was expo-image's, over the art, and the
 *   blur under it was the still's.
 *
 * A video that gives no frame within `VIDEO_FIRST_FRAME_MS` is a failure
 * too. Everything that touches a frame runs on the UI thread, the disposing
 * included, so a frame is never drawn after it is gone; a video is opened on
 * a runtime of its own, since opening one reads the network.
 */
function useAnimationFrames(
  uri: string | null,
  onFail?: (error?: unknown) => void
): SharedValue<SkImage | null> {
  const kind = uri ? (animatedFormatOf(uri) ?? 'image') : null;
  const frame = useSharedValue<SkImage | null>(null);
  const current = useSharedValue<SkAnimatedImage | null>(null);
  const bytes = useSharedValue<SkData | null>(null);
  const video = useSharedValue<Video | null>(null);
  /* An APNG: its frames, the canvas they are drawn on, what to undo next. */
  const apng = useSharedValue<ApngPlayback | null>(null);
  const videoEnd = useSharedValue(0);
  const shown = useSharedValue(0);
  const started = useSharedValue(-1);
  const last = useSharedValue(-1);
  const due = useSharedValue(DEFAULT_FRAME_MS);
  const failRef = useRef(onFail);
  useEffect(() => {
    failRef.current = onFail;
  });
  const fail = (error?: unknown) => failRef.current?.(error);

  /* An animated image: its bytes, decoded once. */
  useEffect(() => {
    if (!uri || kind !== 'image') return;
    let cancelled = false;
    fetch(uri)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.arrayBuffer();
      })
      .then((buffer) => {
        if (cancelled) return;
        const raw = new Uint8Array(buffer);
        if (isApng(raw)) {
          const split = splitApng(raw);
          const surface = split ? Skia.Surface.Make(split.width, split.height) : null;
          if (!split || !surface) {
            failRef.current?.(new Error('Could not read the APNG'));
            return;
          }
          const playback: ApngPlayback = {
            surface,
            frames: split.frames.map((frame) => ({
              data: Skia.Data.fromBytes(frame.png),
              x: frame.x,
              y: frame.y,
              width: frame.width,
              height: frame.height,
              delay: Math.max(MIN_FRAME_MS, frame.delay || DEFAULT_FRAME_MS),
              dispose: frame.dispose,
              blend: frame.blend,
            })),
            index: -1,
            undo: null,
            saved: null,
          };
          runOnUI((next: ApngPlayback) => {
            'worklet';
            apng.set(next);
            due.set(0);
            last.set(-1);
          })(playback);
          return;
        }
        const data = Skia.Data.fromBytes(raw);
        let animation: SkAnimatedImage | null = null;
        try {
          animation = Skia.AnimatedImage.MakeAnimatedImageFromEncoded(data);
        } catch (error) {
          failRef.current?.(error);
          return;
        }
        if (!animation || animation.getFrameCount() < 2) {
          animation?.dispose();
          failRef.current?.(new Error('Not an animation Skia can play'));
          return;
        }
        const first = Math.max(MIN_FRAME_MS, animation.currentFrameDuration() || DEFAULT_FRAME_MS);
        runOnUI((next: SkAnimatedImage, encoded: SkData, wait: number) => {
          'worklet';
          current.set(next);
          bytes.set(encoded);
          due.set(wait);
          last.set(-1);
        })(animation, data, first);
      })
      .catch((error: unknown) => {
        if (!cancelled) failRef.current?.(error);
      });
    return () => {
      cancelled = true;
      runOnUI(() => {
        'worklet';
        const gone = current.get();
        const was = frame.get();
        const played = apng.get();
        current.set(null);
        bytes.set(null);
        apng.set(null);
        frame.set(null);
        was?.dispose();
        gone?.dispose();
        played?.saved?.dispose();
      })();
    };
  }, [uri, kind, current, bytes, frame, due, last, apng]);

  /* A video: opened off the JS thread, muted, then read on the UI thread. */
  useEffect(() => {
    if (!uri || kind !== 'video') return;
    let cancelled = false;
    runOnRuntimeAsync(
      videoRuntime,
      (source: string) => {
        'worklet';
        try {
          return Skia.Video(source) as Video;
        } catch {
          return null;
        }
      },
      uri
    )
      .then((opened) => {
        if (cancelled) {
          if (opened)
            runOnUI((gone: Video) => {
              'worklet';
              gone.dispose();
            })(opened);
          return;
        }
        if (!opened) {
          failRef.current?.(new Error('Skia could not open the video'));
          return;
        }
        runOnUI((next: Video) => {
          'worklet';
          try {
            next.setVolume(0);
            next.setLooping(true);
            next.play();
            const fps = next.framerate();
            due.set(fps > 1 && fps < 121 ? 1000 / fps : 1000 / 30);
            videoEnd.set(next.duration());
          } catch {
            due.set(1000 / 30);
          }
          shown.set(0);
          started.set(-1);
          last.set(-1);
          video.set(next);
        })(opened);
      })
      .catch((error: unknown) => {
        if (!cancelled) failRef.current?.(error);
      });
    return () => {
      cancelled = true;
      runOnUI(() => {
        'worklet';
        const gone = video.get();
        const was = frame.get();
        video.set(null);
        frame.set(null);
        was?.dispose();
        if (gone) {
          try {
            gone.pause();
          } catch {
            /* Already stopped. */
          }
          gone.dispose();
        }
      })();
    };
  }, [uri, kind, video, frame, due, last, videoEnd, shown, started]);

  const loop = useFrameCallback((info) => {
    'worklet';
    const player = video.get();
    if (player) {
      if (started.get() < 0) started.set(info.timestamp);
      if (last.get() >= 0 && info.timestamp - last.get() < due.get()) return;
      last.set(info.timestamp);
      let image: SkImage | null = null;
      try {
        image = player.nextImage();
      } catch {
        image = null;
      }
      if (image) {
        const was = frame.get();
        frame.set(image);
        was?.dispose();
        shown.set(shown.get() + 1);
        /* Android's decoder does not loop by itself: rewind at the end. */
        if (IS_ANDROID && videoEnd.get() > 0 && shown.get() * due.get() >= videoEnd.get()) {
          shown.set(0);
          try {
            player.seek(0);
          } catch {
            /* It plays on from where it is. */
          }
        }
      } else if (!frame.get() && info.timestamp - started.get() > VIDEO_FIRST_FRAME_MS) {
        /* Nothing to show: give it back, once. */
        started.set(Number.MAX_VALUE);
        runOnJS(fail)(new Error('The video gave no frame'));
      }
      return;
    }

    const played = apng.get();
    if (played) {
      if (last.get() >= 0 && info.timestamp - last.get() < due.get()) return;
      const image = nextApngFrame(played);
      if (image) {
        const was = frame.get();
        frame.set(image);
        was?.dispose();
      }
      due.set(played.frames[played.index]?.delay ?? DEFAULT_FRAME_MS);
      last.set(info.timestamp);
      return;
    }

    const animation = current.get();
    if (!animation) return;
    if (last.get() >= 0 && info.timestamp - last.get() < due.get()) return;
    let next = animation;
    if (last.get() >= 0) {
      if (animation.decodeNextFrame() < 0) {
        /* Finished: start it again from its bytes. */
        const encoded = bytes.get();
        const fresh = encoded ? Skia.AnimatedImage.MakeAnimatedImageFromEncoded(encoded) : null;
        if (!fresh) {
          last.set(info.timestamp);
          return;
        }
        current.set(fresh);
        animation.dispose();
        next = fresh;
      }
    }
    const image = next.getCurrentFrame();
    if (!image) return;
    const was = frame.get();
    frame.set(image);
    was?.dispose();
    due.set(Math.max(MIN_FRAME_MS, next.currentFrameDuration() || DEFAULT_FRAME_MS));
    last.set(info.timestamp);
  }, false);
  /* Only while there is something to play: a still hero runs no loop. */
  useEffect(() => {
    loop.setActive(!!uri);
  }, [loop, uri]);

  return frame;
}

/** An APNG playing: its frames as PNG bytes, the canvas, and what to undo before the next. */
type ApngPlayback = {
  surface: SkSurface;
  frames: {
    data: SkData;
    x: number;
    y: number;
    width: number;
    height: number;
    delay: number;
    dispose: 0 | 1 | 2;
    blend: 0 | 1;
  }[];
  /** The frame on the canvas now. */
  index: number;
  /** What to do to its region before the next is drawn. */
  undo: { dispose: 0 | 1 | 2; x: number; y: number; width: number; height: number } | null;
  /** The canvas before the frame on it, for a frame that puts it back. */
  saved: SkImage | null;
};

/** Skia's `ClipOp.Intersect`, as the number a worklet can hold. */
const CLIP_INTERSECT = 1;

/**
 * The next frame of an APNG drawn onto its canvas, and the canvas as an
 * image — the format's compositing (W3C PNG § 11.3.3): the last frame's
 * region cleared or put back as it asked, this one drawn replacing its region
 * or over it. From the first frame again, on a clear canvas, after the last.
 * The UI thread's, called by the frame loop.
 */
function nextApngFrame(played: ApngPlayback): SkImage | null {
  'worklet';
  const canvas = played.surface.getCanvas();
  const index = played.index + 1 >= played.frames.length ? 0 : played.index + 1;
  if (index === 0) {
    canvas.clear(Skia.Color('transparent'));
    played.saved?.dispose();
    played.saved = null;
    played.undo = null;
  }
  const undo = played.undo;
  if (undo && undo.dispose !== 0) {
    canvas.save();
    canvas.clipRect(Skia.XYWHRect(undo.x, undo.y, undo.width, undo.height), CLIP_INTERSECT, false);
    canvas.clear(Skia.Color('transparent'));
    if (undo.dispose === 2 && played.saved) canvas.drawImage(played.saved, 0, 0);
    canvas.restore();
  }
  const frame = played.frames[index];
  if (frame.dispose === 2) {
    played.saved?.dispose();
    played.saved = played.surface.makeImageSnapshot();
  }
  const image = Skia.Image.MakeImageFromEncoded(frame.data);
  if (image) {
    if (frame.blend === 0) {
      canvas.save();
      canvas.clipRect(
        Skia.XYWHRect(frame.x, frame.y, frame.width, frame.height),
        CLIP_INTERSECT,
        false
      );
      canvas.clear(Skia.Color('transparent'));
      canvas.restore();
    }
    canvas.drawImage(image, frame.x, frame.y);
    image.dispose();
  }
  played.index = index;
  played.undo = {
    dispose: frame.dispose,
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
  };
  return played.surface.makeImageSnapshot();
}

/** Videos are opened here, off the JS and UI threads. */
const videoRuntime = createWorkletRuntime({ name: 'cover-video' });
const IS_ANDROID = Platform.OS === 'android';
/** A video that has shown nothing in this long is given back to expo-video. */
const VIDEO_FIRST_FRAME_MS = 6000;

/** A frame with no duration of its own is shown this long — Skia's default. */
const DEFAULT_FRAME_MS = 60;
/** …and none shorter than this, as browsers clamp a GIF's 0ms frames. */
const MIN_FRAME_MS = 20;
