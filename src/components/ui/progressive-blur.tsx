import {
  Canvas,
  Group,
  Image,
  Paint,
  RuntimeShader,
  Skia,
  rect,
  useImage,
} from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import {
  PROGRESSIVE_BLUR,
  TAIL,
  blurShader,
  blurSourceUri,
  coverRect,
} from '@/lib/progressive-blur';

/* Compiled once, when this module is first loaded — which is when a page
   first draws its hero (`React.lazy`, `<PinnedHero>`). */
const HORIZONTAL = Skia.RuntimeEffect.Make(blurShader('horizontal'));
const VERTICAL = Skia.RuntimeEffect.Make(blurShader('vertical'));

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
}: ProgressiveBlurProps) {
  const image = useImage(blurSourceUri(uri), onFail);
  const failed = !HORIZONTAL || !VERTICAL;

  useEffect(() => {
    if (failed) onFail();
  }, [failed, onFail]);

  /* The whole box, the art and its tail, and where the art ends in it — kept
     as exact shares of the canvas, so the art's foot lands where Convx's
     square's does whatever the rounding. */
  const box = height * (1 + TAIL);
  const w = Math.max(1, Math.ceil(width / PROGRESSIVE_BLUR.downscale));
  const h = Math.max(1, Math.ceil(box / PROGRESSIVE_BLUR.downscale));
  const foot = (h * PROGRESSIVE_BLUR.artworkExtent) / PROGRESSIVE_BLUR.heroExtent;
  const side = h / PROGRESSIVE_BLUR.heroExtent;

  const uniforms = useDerivedValue(() => ({
    size: [w, h],
    side,
    pxPerPt: w / PROGRESSIVE_BLUR.reference,
    progress: progress.get(),
  }));

  if (failed || !HORIZONTAL || !VERTICAL || !image) return null;

  const art = coverRect(
    { width: image.width(), height: image.height() },
    { width: w, height: foot },
    anchorX,
    anchorY
  );
  const picture = (
    <Image image={image} x={art.x} y={art.y} width={art.width} height={art.height} fit="fill" />
  );

  return (
    <View pointerEvents="none" style={[styles.box, { height: box }]}>
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
          {/* The tail: the art turned over in its own foot, y → 2·foot − y. */}
          <Group clip={rect(0, foot, w, h - foot)}>
            <Group transform={[{ translateY: 2 * foot }, { scaleY: -1 }]}>{picture}</Group>
          </Group>
        </Group>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  /* From the art's top, as tall as the art and its tail (set where drawn). */
  box: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
});
