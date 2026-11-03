import { Canvas, Group, Path, RoundedRect, Skia, type SkPath } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { View } from 'react-native';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';

import { MORPH_POINTS, MORPH_STEPS, MORPH_VIEWBOX } from '@/lib/morph/frames';
import { MASCOT_EYES, MASCOT_SEQUENCE, mascotFrames, mascotPose } from '@/lib/morph/mascot';

/**
 * The mascot loader, drawn: reacticx's `MorphLoader` (`organisms/morph-loader`,
 * MIT) — one path, interpolated between precomputed frames on the UI thread
 * every frame — with his eyes over it. Imported through `React.lazy` only
 * (`<Loader>`), behind `SKIA_AVAILABLE`.
 *
 * The canvas is the loader's size × √2, as reacticx's is, so a square turned
 * 45° is never clipped.
 */
export default memo(function MascotLoaderSkia({
  size,
  color,
  eyeColor,
}: {
  size: number;
  color: string;
  eyeColor: string;
}) {
  const { flat, frameCount } = useMemo(() => mascotFrames(), []);
  const ms = useSharedValue(0);

  const canvas = size * Math.SQRT2;
  const scale = size / MORPH_VIEWBOX;
  const offset = (canvas - size) / 2;
  const origin = useMemo(() => ({ x: canvas / 2, y: canvas / 2 }), [canvas]);

  useFrameCallback((info) => {
    ms.set(ms.get() + (info.timeSincePreviousFrame ?? 16.67));
  });

  const pose = useDerivedValue(() =>
    mascotPose(ms.get(), frameCount, MORPH_STEPS, MASCOT_SEQUENCE.length)
  );

  const path = useDerivedValue<SkPath>(() => {
    const v = pose.get().phase;
    const i = Math.floor(v);
    const t = v - i;
    const a = i * MORPH_POINTS * 2;
    const b = ((i + 1) % frameCount) * MORPH_POINTS * 2;
    /* A builder, then the path: Skia 2.6 deprecates drawing into an SkPath. */
    const p = Skia.PathBuilder.Make();
    for (let k = 0; k < MORPH_POINTS; k++) {
      const x = (flat[a + k * 2] + (flat[b + k * 2] - flat[a + k * 2]) * t) * scale + offset;
      const y =
        (flat[a + k * 2 + 1] + (flat[b + k * 2 + 1] - flat[a + k * 2 + 1]) * t) * scale + offset;
      if (k === 0) p.moveTo(x, y);
      else p.lineTo(x, y);
    }
    p.close();
    return p.detach();
  });

  const bodyTransform = useDerivedValue(() => [{ rotate: (pose.get().turn * Math.PI) / 180 }]);

  const eyeW = MASCOT_EYES.width * scale;
  const eyeR = MASCOT_EYES.radius * scale;
  const eyeY = MASCOT_EYES.y * scale + offset;
  const fullH = MASCOT_EYES.height * scale;
  const eyeH = useDerivedValue(() => Math.max(eyeW * 0.4, fullH * pose.get().eyes));
  const eyeTop = useDerivedValue(() => eyeY - eyeH.get() / 2);
  const leftX = canvas / 2 - MASCOT_EYES.apart * scale - eyeW / 2;
  const rightX = canvas / 2 + MASCOT_EYES.apart * scale - eyeW / 2;

  return (
    <View style={{ width: size, height: size }}>
      <Canvas
        style={{
          position: 'absolute',
          width: canvas,
          height: canvas,
          left: -offset,
          top: -offset,
        }}>
        <Group origin={origin} transform={bodyTransform}>
          <Path path={path} color={color} />
        </Group>
        <RoundedRect x={leftX} y={eyeTop} width={eyeW} height={eyeH} r={eyeR} color={eyeColor} />
        <RoundedRect x={rightX} y={eyeTop} width={eyeW} height={eyeH} r={eyeR} color={eyeColor} />
      </Canvas>
    </View>
  );
});
