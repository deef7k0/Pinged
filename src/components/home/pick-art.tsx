import { Canvas, LinearGradient, Path, Rect, Skia, vec } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import {
  Easing,
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import {
  DISCOVERY_ARROW,
  DISCOVERY_BOTTOM,
  DISCOVERY_GROUND,
  DISCOVERY_INNER,
  DISCOVERY_TOP,
  PERSONAL_GROUND,
  PERSONAL_LAYERS,
} from '@/constants/pick-art';

/*
 * BitChord's two "Made for You" station covers (`TopPicksShelf.kt`,
 * `PersonalStationArt` and `DiscoveryStationArt`), drawn as Skia paths whose
 * shapes are worked out on the UI thread from one 0→1 loop of nine seconds
 * — "slow on purpose: it is a cover, not a spinner". Loaded only through
 * `React.lazy` behind Skia's presence (`<PickCard>`).
 *
 * - `personal` — arrows nested inside one another on the left edge, pointing
 *   right, orange in the middle out to pink; their tips drift in and out of
 *   step so the stack folds and unfolds. Surprise Me's.
 * - `discovery` — a violet arrow across the card with a fan of blue, indigo
 *   and teal shards opening round its tip, sweeping to and fro. The Top
 *   1000's.
 */

export type PickArtKind = 'personal' | 'discovery';

/** One full breath of the motion, BitChord's `STATION_PERIOD_MS`. */
const PERIOD_MS = 9000;

/** Where each shard meets the edge, as a share of the width; the inner ones swing. */
const DISCOVERY_EDGES = [0, 0.24, 0.44, 0.62, 0.78, 0.91, 1.02] as const;

function wave(phase: number, offset: number): number {
  'worklet';
  return Math.sin(2 * Math.PI * (phase + offset));
}

/**
 * A closed triangle, through Skia's `PathBuilder` — `SkPath`'s own moveTo /
 * lineTo / close are deprecated (react-native-skia 2.x warns on each call).
 * Above every worklet that calls it (CLAUDE.md § Gotchas).
 */
function triangle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  'worklet';
  return Skia.PathBuilder.Make().moveTo(ax, ay).lineTo(bx, by).lineTo(cx, cy).close().detach();
}

export default function PickArt({
  kind,
  width,
  height,
  moving,
}: {
  kind: PickArtKind;
  width: number;
  height: number;
  /** False under Reduce Motion, off screen, or in the background: the art holds still. */
  moving: boolean;
}) {
  const phase = useSharedValue(0);

  useEffect(() => {
    if (!moving) {
      cancelAnimation(phase);
      return;
    }
    /* Carry on from where it held, so a pause does not jump back to the start. */
    const from = phase.get();
    phase.set(
      withRepeat(withTiming(from + 1, { duration: PERIOD_MS, easing: Easing.linear }), -1, false)
    );
    return () => cancelAnimation(phase);
  }, [moving, phase]);

  return kind === 'personal' ? (
    <PersonalArt phase={phase} width={width} height={height} />
  ) : (
    <DiscoveryArt phase={phase} width={width} height={height} />
  );
}

type Phase = ReturnType<typeof useSharedValue<number>>;
type ArtProps = { phase: Phase; width: number; height: number };

function PersonalArt({ phase, width: w, height: h }: ArtProps) {
  return (
    <Canvas style={{ width: w, height: h }}>
      <Rect x={0} y={0} width={w} height={h}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(w, 0)}
          positions={[0, 0.38, 0.75, 1]}
          colors={[...PERSONAL_GROUND]}
        />
      </Rect>
      {PERSONAL_LAYERS.map((_, index) => (
        <Fold key={index} index={index} phase={phase} width={w} height={h} />
      ))}
    </Canvas>
  );
}

/** One of the personal station's arrows; the outer one is pinned to the edge. */
function Fold({ index, phase, width: w, height: h }: ArtProps & { index: number }) {
  const layer = PERSONAL_LAYERS[index];
  const rest = layer.rest;
  const path = useDerivedValue(() => {
    const tip = index === 0 ? rest : rest + 0.07 * wave(phase.get(), index * 0.19);
    return triangle(0, 0, w * tip, h / 2, 0, h);
  });
  return (
    <Path path={path}>
      <LinearGradient start={vec(0, 0)} end={vec(w * rest, 0)} colors={[layer.deep, layer.light]} />
    </Path>
  );
}

function DiscoveryArt({ phase, width: w, height: h }: ArtProps) {
  const shards = Array.from({ length: DISCOVERY_EDGES.length - 1 }, (_, i) => i + 1);
  const arrow = triangle(0, 0, w, h / 2, 0, h);

  return (
    <Canvas style={{ width: w, height: h }}>
      <Rect x={0} y={0} width={w} height={h}>
        <LinearGradient start={vec(0, 0)} end={vec(w, h)} colors={[...DISCOVERY_GROUND]} />
      </Rect>
      {shards.map((i) => (
        <Shard key={`t${i}`} index={i} top phase={phase} width={w} height={h} />
      ))}
      {shards.map((i) => (
        <Shard key={`b${i}`} index={i} top={false} phase={phase} width={w} height={h} />
      ))}
      <Path path={arrow}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(w, 0)}
          positions={[0, 0.55, 1]}
          colors={[...DISCOVERY_ARROW]}
        />
      </Path>
      <InnerArrow phase={phase} width={w} height={h} />
    </Canvas>
  );
}

/**
 * One shard of the discovery fan, from the card's right-hand middle to a
 * stretch of its top or bottom edge. Each edge swings on its own offset, and
 * a shard's start is the edge before it — worked out here again rather than
 * shared, so every shard is a path of its own.
 */
function Shard({
  index,
  top,
  phase,
  width: w,
  height: h,
}: ArtProps & { index: number; top: boolean }) {
  const edgeY = top ? 0 : h;
  const offset = top ? 0 : 0.5;
  const last = DISCOVERY_EDGES.length - 1;
  const at = (i: number, p: number) => {
    'worklet';
    const rest = DISCOVERY_EDGES[i];
    return i === 0 || i === last ? rest : rest + 0.06 * wave(p, offset + i * 0.11);
  };
  const path = useDerivedValue(() => {
    const p = phase.get();
    return triangle(w, h / 2, w * at(index - 1, p), edgeY, w * at(index, p), edgeY);
  });
  const colours = top ? DISCOVERY_TOP : DISCOVERY_BOTTOM;
  const base = colours[(index - 1) % colours.length];
  const mid = (w * (DISCOVERY_EDGES[index - 1] + DISCOVERY_EDGES[index])) / 2;
  return (
    <Path path={path}>
      <LinearGradient start={vec(w, h / 2)} end={vec(mid, edgeY)} colors={[lighten(base), base]} />
    </Path>
  );
}

/** The darker arrow inside the discovery arrow, breathing. */
function InnerArrow({ phase, width: w, height: h }: ArtProps) {
  const path = useDerivedValue(() => {
    const t = 0.08 + 0.04 * wave(phase.get(), 0.25);
    return triangle(0, h * t, w * (0.9 - t), h / 2, 0, h * (1 - t));
  });
  return <Path path={path} color={DISCOVERY_INNER} />;
}

/** BitChord's `lerp(base, White, 0.10)`: a shard's lit end. */
function lighten(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * 0.1);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
