import {
  Canvas,
  Group,
  Paint,
  RuntimeShader,
  Skia,
  Text as SkiaText,
  useFont,
  type SkFont,
} from '@shopify/react-native-skia';
import { StyleSheet } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { LENS, lensShape, lensShader } from '@/lib/liquid-lens';

/* Compiled once, when the tab bar first draws its lens. */
const LENS_EFFECT = Skia.RuntimeEffect.Make(lensShader());

/* The glyphs and the words, drawn by Skia so the lens can bend them. */
const IONICONS = require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf');
const LABEL_FONT = require('@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf');

/** The bar's geometry, as `<AppTabBar>` lays it out. */
export type LensBarGeometry = {
  /** The pill's full width, and its height expanded and minimized. */
  width: number;
  expanded: number;
  minimized: number;
  /** How far each side comes in when minimized. */
  inset: number;
  /** The row's padding at each end. */
  rowPad: number;
  /** The highlight's height, expanded and minimized. */
  lensExpanded: number;
  lensMinimized: number;
  /** A tab's glyph, the gap under it, its word's line, and the padding over the glyph. */
  icon: number;
  gap: number;
  labelLine: number;
  labelSize: number;
  padTop: number;
};

export type LensTab = {
  /** The glyph's character in Ionicons' font, resting and chosen. */
  glyph: string;
  activeGlyph: string;
  label: string;
};

/**
 * The tab bar's glyphs and words with expo-liquid-lens's lens over them
 * (`lib/liquid-lens`), in place of the plain highlight — Settings → Liquid
 * glass, where the build has Skia. A canvas the size of the expanded pill,
 * centred on the bar so it needs no resizing as the bar minimizes; every
 * position is worked out from `progress` and `slide` on the UI thread.
 *
 * The lens follows the highlight's own spring (`slide`), and its speed is
 * read off it frame by frame for the stretch.
 */
export default function LiquidLens({
  geometry,
  tabs,
  focused,
  slide,
  progress,
  visible,
  press,
  active,
  inactive,
}: {
  geometry: LensBarGeometry;
  tabs: readonly LensTab[];
  /** The chosen tab's place: its glyph is drawn filled. */
  focused: number;
  /** Where the lens is, in tabs. */
  slide: SharedValue<number>;
  /** 0 expanded, 1 minimized. */
  progress: SharedValue<number>;
  /** 0 with Search in front (no tab chosen), 1 otherwise. */
  visible: SharedValue<number>;
  /** 0–1 while a finger is on the bar. */
  press: SharedValue<number>;
  active: string;
  inactive: string;
}) {
  const iconFont = useFont(IONICONS, geometry.icon);
  const activeRgb = rgbOf(active);
  const labelFont = useFont(LABEL_FONT, geometry.labelSize);
  const g = geometry;
  const count = Math.max(1, tabs.length);

  /* The lens's speed in dp/s, read off the slide each frame. */
  const lastX = useSharedValue(-1);
  const speed = useSharedValue(0);
  useFrameCallback((info) => {
    'worklet';
    const side = interpolate(progress.get(), [0, 1], [0, g.inset], Extrapolation.CLAMP);
    const item = (g.width - side * 2 - g.rowPad * 2) / count;
    const x = side + g.rowPad + item * (slide.get() + 0.5);
    const dt = Math.max(1, info.timeSincePreviousFrame ?? 16) / 1000;
    const raw = lastX.get() < 0 ? 0 : (x - lastX.get()) / dt;
    /* Smoothed a little, so one late frame does not twitch it. */
    speed.set(speed.get() * 0.6 + raw * 0.4);
    lastX.set(x);
  });

  const uniforms = useDerivedValue(() => {
    const p = progress.get();
    const side = interpolate(p, [0, 1], [0, g.inset], Extrapolation.CLAMP);
    const item = (g.width - side * 2 - g.rowPad * 2) / count;
    const height = interpolate(p, [0, 1], [g.lensExpanded, g.lensMinimized], Extrapolation.CLAMP);
    const shape = lensShape(item / 2, height / 2, speed.get(), press.get());
    return {
      center: [side + g.rowPad + item * (slide.get() + 0.5), g.expanded / 2],
      halfSize: [shape.halfWidth, shape.halfHeight],
      radius: shape.halfHeight,
      refraction: shape.refraction,
      depth: LENS.depth,
      tintWidth: item / 2,
      visibility: visible.get(),
      activeColor: activeRgb,
      pillColor: [1, 1, 1],
      pillOpacity: LENS.fillOpacity * 2.3,
    };
  });

  const frameStyle = useAnimatedStyle(() => {
    const barHeight = interpolate(
      progress.get(),
      [0, 1],
      [g.expanded, g.minimized],
      Extrapolation.CLAMP
    );
    const side = interpolate(progress.get(), [0, 1], [0, g.inset], Extrapolation.CLAMP);
    /* Centred on the bar, which shrinks about its own middle. */
    return { transform: [{ translateX: -side }, { translateY: -(g.expanded - barHeight) / 2 }] };
  });

  if (!LENS_EFFECT || !iconFont || !labelFont) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.frame, { width: g.width, height: g.expanded }, frameStyle]}>
      <Canvas style={{ width: g.width, height: g.expanded }}>
        <Group
          layer={
            <Paint>
              <RuntimeShader source={LENS_EFFECT} uniforms={uniforms} />
            </Paint>
          }>
          {tabs.map((tab, index) => (
            <LensTabMarks
              key={index}
              tab={tab}
              index={index}
              count={count}
              chosen={index === focused}
              geometry={g}
              iconFont={iconFont}
              labelFont={labelFont}
              slide={slide}
              progress={progress}
              visible={visible}
              inactive={inactive}
              active={active}
            />
          ))}
        </Group>
      </Canvas>
    </Animated.View>
  );
}

/** One tab's glyph and word, placed on the UI thread as the bar minimizes. */
function LensTabMarks({
  tab,
  index,
  count,
  chosen,
  geometry: g,
  iconFont,
  labelFont,
  slide,
  progress,
  visible,
  inactive,
  active,
}: {
  tab: LensTab;
  index: number;
  count: number;
  chosen: boolean;
  geometry: LensBarGeometry;
  iconFont: SkFont;
  labelFont: SkFont;
  slide: SharedValue<number>;
  progress: SharedValue<number>;
  visible: SharedValue<number>;
  inactive: string;
  active: string;
}) {
  const glyph = chosen ? tab.activeGlyph : tab.glyph;
  const glyphBox = iconFont.measureText(glyph);
  const labelWidth = labelFont.getTextWidth(tab.label);
  const metrics = labelFont.getMetrics();

  const centreX = useDerivedValue(() => {
    const side = interpolate(progress.get(), [0, 1], [0, g.inset], Extrapolation.CLAMP);
    const item = (g.width - side * 2 - g.rowPad * 2) / count;
    return side + g.rowPad + item * (index + 0.5);
  });
  /* The glyph's box top, as the row centres the highlight's box in the bar. */
  const boxTop = useDerivedValue(() => {
    const lens = interpolate(
      progress.get(),
      [0, 1],
      [g.lensExpanded, g.lensMinimized],
      Extrapolation.CLAMP
    );
    return g.expanded / 2 - lens / 2 + g.padTop;
  });
  const glyphX = useDerivedValue(() => centreX.get() - glyphBox.width / 2 - glyphBox.x);
  const glyphY = useDerivedValue(
    () => boxTop.get() + g.icon / 2 - (glyphBox.y + glyphBox.height / 2)
  );
  const labelX = useDerivedValue(() => centreX.get() - labelWidth / 2);
  const labelY = useDerivedValue(() => {
    const top = boxTop.get() + g.icon + g.gap;
    return top + (g.labelLine - (metrics.descent - metrics.ascent)) / 2 - metrics.ascent;
  });
  const labelOpacity = useDerivedValue(() =>
    interpolate(progress.get(), [0, 0.4], [1, 0], Extrapolation.CLAMP)
  );
  /* The tab under the lens is white before the lens even tints it. */
  const lit = useDerivedValue(
    () => Math.max(0, 1 - Math.min(Math.abs(slide.get() - index), 1)) * visible.get()
  );
  const dim = useDerivedValue(() => 1 - lit.get());

  return (
    <>
      <SkiaText text={glyph} font={iconFont} x={glyphX} y={glyphY} color={inactive} opacity={dim} />
      <SkiaText text={glyph} font={iconFont} x={glyphX} y={glyphY} color={active} opacity={lit} />
      <Group opacity={labelOpacity}>
        <SkiaText text={tab.label} font={labelFont} x={labelX} y={labelY} color={inactive} />
      </Group>
    </>
  );
}

/** A colour as the shader's 0–1 triple. */
function rgbOf(hex: string): [number, number, number] {
  const match = /^#?([0-9a-f]{6})/i.exec(hex);
  if (!match) return [1, 1, 1];
  const value = parseInt(match[1], 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

const styles = StyleSheet.create({
  frame: { position: 'absolute', left: 0, top: 0 },
});
