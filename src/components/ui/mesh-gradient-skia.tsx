import { Canvas, Fill, Shader, Skia, vec } from '@shopify/react-native-skia';
import { memo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';

import { MESH_SHADER } from '@/lib/mesh-gradient-shader';

const effect = Skia.RuntimeEffect.Make(MESH_SHADER);

/** reacticx's performance defaults: a third of the pixels, scaled back up. */
const UNDERSAMPLING = 0.3;

export type MeshColour = { r: number; g: number; b: number };

/**
 * reacticx's `AnimatedMeshGradient`, drawn: the shader on a canvas a third of
 * the display's size, scaled up (the blur hides it), its clock advanced by
 * the frame callback at `speed`. Imported through `React.lazy` only
 * (`<MeshBackdrop>`), behind `SKIA_AVAILABLE`.
 */
export default memo(function MeshGradientSkia({
  colours,
  speed,
  noise = 0.15,
  blur = 0.4,
  contrast = 1,
  running,
}: {
  colours: readonly [MeshColour, MeshColour, MeshColour, MeshColour];
  speed: number;
  noise?: number;
  blur?: number;
  contrast?: number;
  /** False holds it still, on its last frame. */
  running: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const time = useSharedValue(0);
  const w = Math.max(1, Math.round(width * UNDERSAMPLING));
  const h = Math.max(1, Math.round(height * UNDERSAMPLING));

  useFrameCallback((info) => {
    if (info.timeSincePreviousFrame === null) return;
    time.set(time.get() + (info.timeSincePreviousFrame / 1000) * speed);
  }, running);

  const [c1, c2, c3, c4] = colours;
  const uniforms = useDerivedValue(() => ({
    resolution: vec(w, h),
    time: time.get(),
    noise,
    blur,
    contrast,
    color1: [c1.r, c1.g, c1.b, 1],
    color2: [c2.r, c2.g, c2.b, 1],
    color3: [c3.r, c3.g, c3.b, 1],
    color4: [c4.r, c4.g, c4.b, 1],
  }));

  if (!effect) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: w,
          height: h,
          transform: [{ scale: 1 / UNDERSAMPLING }],
          transformOrigin: 'left top',
        }}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Fill>
            <Shader source={effect} uniforms={uniforms} />
          </Fill>
        </Canvas>
      </View>
    </View>
  );
});
