/*
 * DIRECTION — the physical shelf (the owner's, 2026-11-02)
 *
 * THESIS: a shelf you flick through, box by box, and pick one off. Refused: a
 * grid of thumbnails, and the binder of discs this replaced.
 * REFERENCE: rit3zh/expo-coverflow-carousel (MIT) — iPod Cover Flow — read
 * from its source; the numbers are `constants/copy-coverflow.ts`.
 * STORY: flick; the box in front says what it is under it; tap it, and the
 * others fall away, the page turns into the copy's own moving colours, and
 * the box flies to where its case stands on the copy's stage — which then
 * fades in round it, to be turned and opened.
 */
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { copyStage } from '@/components/copy-showcase';
import { Button } from '@/components/ui/button';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { MeshBackdrop } from '@/components/ui/mesh-backdrop';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ErrorState, Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import {
  COVERFLOW_MOUNTED,
  COVERFLOW_PERSPECTIVE,
  HANDOFF_MS,
  REFLECTION_STRENGTH,
  RETURN_MS,
  coverflowLayout,
  coverflowPose,
  coverflowSnap,
  flightTo,
  type CoverflowLayout,
  type Rect,
} from '@/constants/copy-coverflow';
import { copyStateLine, releaseLine } from '@/constants/physical';
import { CASE_TEMPLATES, hasCase } from '@/constants/platform-cases';
import { Spacing, withAlpha } from '@/constants/theme';
import { useGameAccent } from '@/hooks/use-accent';
import { useCopyMesh } from '@/hooks/use-copy-mesh';
import { useStageRoom } from '@/hooks/use-copy-stage-room';
import { useDiscRoom } from '@/hooks/use-header-height';
import { usePulse } from '@/hooks/use-pulse';
import { useTheme } from '@/hooks/use-theme';
import type { CopyWithRelations } from '@/lib/api';
import { SKIA_AVAILABLE } from '@/lib/skia-available';
import { STAGE_CAMERA } from '@/lib/stage-geometry';

/** The gap between a box and its reflection: the reference's. */
const REFLECTION_GAP = 3;

type Flight = { dx: number; dy: number; sx: number; sy: number };
const NO_FLIGHT: Flight = { dx: 0, dy: 0, sx: 1, sy: 1 };

/**
 * Where a copy's cover will stand on `copy/[id]`'s stage, in window
 * coordinates, as it lands: the case square on, its front face (half the
 * case's depth toward the camera, so a little larger), and inside it the
 * window the box art shows through. The same arithmetic the copy screen and
 * `<CopyShowcase>` lay the stage out with — `copyStage`, `useStageRoom`, the
 * disc room the stage starts under — so the cover lands where the case is.
 */
function landingRect(
  copy: CopyWithRelations,
  width: number,
  height: number,
  room: number,
  discRoom: number
): Rect {
  const stage = copyStage(copy, width, height, room);
  const cx = width / 2;
  const cy = discRoom + stage.centreY;
  let x = cx - stage.caseWidth / 2;
  let y = cy - stage.caseHeight / 2;
  let w = stage.caseWidth;
  let h = stage.caseHeight;
  if (stage.cased && hasCase(stage.platform)) {
    const template = CASE_TEMPLATES[stage.platform];
    const scale = w / template.templateSize.width;
    x += template.coverArea.x * scale;
    y += template.coverArea.y * scale;
    w = template.coverArea.width * scale;
    h = template.coverArea.height * scale;
  }
  const k = STAGE_CAMERA / (STAGE_CAMERA - stage.depth / 2);
  return { x: cx + (x - cx) * k, y: cy + (y - cy) * k, width: w * k, height: h * k };
}

function describe(copy: CopyWithRelations): string {
  return [releaseLine(copy), copyStateLine(copy)].filter(Boolean).join(' · ');
}

/**
 * Somebody's physical games as Cover Flow — the Physical row of a library.
 *
 * One box in front, square on, and one at each side turned toward it; a
 * sideways drag or a flick moves along the shelf, a tap on a side box brings
 * it to the front. Under the shelf: what the box in front is.
 *
 * **Tapping the box in front picks it up.** The others fade, the page fades
 * into the copy's own moving colours (the copy screen's mesh, or its plain
 * page where that is off or the build has no Skia), and the box flies to the
 * place `copy/[id]` stands its case — then that screen is pushed with a fade
 * (`handover=1`, the root layout), its case appears round the cover already
 * square on, and drifts. Coming back, the box flies home and the colours go.
 * Under Reduce Motion it is a plain push.
 *
 * The whole screen, not a body: the colours are `<Screen backdrop>`.
 */
export function PhysicalShelf({
  copies,
  loading,
  error,
  onRetry,
  isSelf,
  ownerId,
}: {
  copies: CopyWithRelations[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  isSelf: boolean;
  ownerId: string;
}) {
  const theme = useTheme();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const layout = useMemo(() => coverflowLayout(width), [width]);
  const room = useStageRoom();
  const discRoom = useDiscRoom();

  const count = copies.length;
  const offset = useSharedValue(0);
  const [active, setActive] = useState(0);
  const current = copies[Math.min(active, Math.max(0, count - 1))];

  /* The copy's own colours, as its screen will wear them. Asked for the box
     in front, so they are known before it is tapped. */
  const accent = useGameAccent(
    current?.game?.cover_url ?? current?.game?.hero_url,
    current?.game?.genres
  );
  const backdropChoice = useCopyMesh();
  const meshOn = backdropChoice.mesh && SKIA_AVAILABLE;

  /* The hand-off: which box is flying (-1 none), how far, and to where. */
  const picked = useSharedValue(-1);
  const fly = useSharedValue(0);
  const flight = useSharedValue<Flight>(NO_FLIGHT);
  const [lifted, setLifted] = useState(false);
  const busy = useRef(false);
  const track = useRef<View>(null);

  const open = useCallback(
    (copy: CopyWithRelations) => {
      busy.current = false;
      router.push({ pathname: '/copy/[id]', params: { id: copy.id, handover: '1' } });
    },
    [router]
  );

  const pick = useCallback(
    (index: number) => {
      const copy = copies[index];
      if (!copy || busy.current) return;
      if (reduceMotion) {
        router.push({ pathname: '/copy/[id]', params: { id: copy.id } });
        return;
      }
      busy.current = true;
      track.current?.measureInWindow((x, y) => {
        const from: Rect = {
          x: x + width / 2 - layout.card / 2,
          y,
          width: layout.card,
          height: layout.cardHeight,
        };
        flight.set(flightTo(from, landingRect(copy, width, height, room, discRoom)));
        picked.set(index);
        setLifted(true);
        fly.set(
          withTiming(
            1,
            { duration: HANDOFF_MS, easing: Easing.inOut(Easing.cubic) },
            (finished) => {
              'worklet';
              if (finished) runOnJS(open)(copy);
            }
          )
        );
      });
    },
    [copies, reduceMotion, router, width, height, layout, room, discRoom, flight, picked, fly, open]
  );

  /* Back from the copy: the box flies home and the colours go. */
  useFocusEffect(
    useCallback(() => {
      if (fly.get() === 0) return;
      busy.current = false;
      const done = () => setLifted(false);
      fly.set(
        withTiming(0, { duration: RETURN_MS, easing: Easing.inOut(Easing.cubic) }, (finished) => {
          'worklet';
          if (finished) {
            picked.set(-1);
            runOnJS(done)();
          }
        })
      );
    }, [fly, picked])
  );

  const onTap = useCallback(
    (index: number) => {
      if (busy.current) return;
      if (Math.abs(offset.get() - index) < 0.05) pick(index);
      else offset.set(withTiming(index, { duration: 500, easing: Easing.out(Easing.cubic) }));
    },
    [offset, pick]
  );

  const tick = useCallback((index: number) => {
    setActive(index);
    void Haptics.selectionAsync().catch(() => {});
  }, []);

  const maxIndex = Math.max(0, count - 1);
  useAnimatedReaction(
    () => Math.round(offset.get()),
    (now, was) => {
      if (was !== null && now !== was && now >= 0 && now <= maxIndex) runOnJS(tick)(now);
    }
  );

  const start = useSharedValue(0);
  const pan = Gesture.Pan()
    .enabled(!lifted && count > 1)
    .activeOffsetX([-8, 8])
    .failOffsetY([-14, 14])
    .onBegin(() => {
      start.set(offset.get());
    })
    .onUpdate((event) => {
      const next = start.get() - event.translationX / layout.itemStep;
      offset.set(Math.min(Math.max(next, 0), maxIndex));
    })
    .onEnd((event) => {
      const target = coverflowSnap(offset.get(), event.velocityX, layout.itemStep, maxIndex);
      offset.set(withTiming(target, { duration: 900, easing: Easing.out(Easing.exp) }));
    });

  const pulse = usePulse();
  const away = useAnimatedStyle(() => {
    pulse.get();
    return { opacity: 1 - Math.min(1, fly.get() * 2), transform: [{ translateY: fly.get() * 12 }] };
  });
  const colours = useAnimatedStyle(() => {
    pulse.get();
    return { opacity: fly.get(), transform: [{ translateY: 0 }] };
  });

  const topBar = <FrostedTopBar back title="Physical" largeTitle={false} />;

  if (loading) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={topBar}>
        <View style={styles.centre}>
          <Skeleton width={layout.card} height={layout.cardHeight} />
        </View>
      </Screen>
    );
  }
  if (error) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={topBar}>
        <ErrorState error={error} onRetry={onRetry} />
      </Screen>
    );
  }

  const actions = isSelf && (
    <View style={styles.actions}>
      <Button title="Scan a game" icon="scan-outline" onPress={() => router.push('/scan')} />
      <Button title="Add by hand" variant="secondary" onPress={() => router.push('/add-copy')} />
    </View>
  );

  if (count === 0) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={topBar}>
        <View style={styles.centre}>
          <Text variant="h3">No physical games yet</Text>
          <Text variant="bodySmall" color="textMuted" style={styles.centred}>
            {isSelf
              ? 'Scan the barcode on a box, or add one by hand, and it goes on this shelf.'
              : 'Nothing on this shelf yet.'}
          </Text>
          {actions}
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      edges={['bottom']}
      insetHeader
      topBar={topBar}
      backdrop={
        lifted ? (
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: accent.page }, colours]}>
            {meshOn && (
              <MeshBackdrop
                colours={[
                  accent.m3.primaryContainer,
                  accent.m3.tertiaryContainer,
                  accent.m3.secondaryContainer,
                  accent.page,
                ]}
              />
            )}
          </Animated.View>
        ) : undefined
      }>
      <View style={styles.body}>
        <GestureDetector gesture={pan}>
          <View style={styles.trackArea}>
            <View
              ref={track}
              collapsable={false}
              style={{ width, height: layout.cardHeight + REFLECTION_GAP + layout.reflection }}>
              {copies.map((copy, index) =>
                Math.abs(index - active) <= COVERFLOW_MOUNTED ? (
                  <ShelfBox
                    key={copy.id}
                    copy={copy}
                    index={index}
                    layout={layout}
                    offset={offset}
                    picked={picked}
                    fly={fly}
                    flight={flight}
                    page={theme.background}
                    onTap={onTap}
                  />
                ) : null
              )}
            </View>
          </View>
        </GestureDetector>

        <Animated.View style={[styles.caption, away]}>
          <Text variant="h2" numberOfLines={1} style={styles.centred}>
            {current?.game?.title ?? 'Unknown game'}
          </Text>
          {!!current && !!describe(current) && (
            <Text variant="body" color="textSecondary" numberOfLines={1} style={styles.centred}>
              {describe(current)}
            </Text>
          )}
          <Text variant="caption" color="textMuted" style={styles.position}>
            {`${active + 1} of ${count}`}
          </Text>
        </Animated.View>

        <Animated.View style={[styles.foot, away]} pointerEvents={lifted ? 'none' : 'auto'}>
          {actions}
          <Link href={{ pathname: '/copies/[user]', params: { user: ownerId } }} asChild>
            <PressableScale accessibilityRole="link" scaleTo={0.96} hitSlop={12}>
              <Text variant="caption" color="primaryText">
                See them as a list
              </Text>
            </PressableScale>
          </Link>
        </Animated.View>
      </View>
    </Screen>
  );
}

/**
 * One box on the shelf, and its reflection on the floor under it.
 *
 * Its pose is the offset's alone, on the UI thread; it re-renders only when it
 * is mounted or unmounted at the edge of the window. The box being picked up
 * blends from its pose on the shelf to its flight; every other one fades.
 */
const ShelfBox = memo(function ShelfBox({
  copy,
  index,
  layout,
  offset,
  picked,
  fly,
  flight,
  page,
  onTap,
}: {
  copy: CopyWithRelations;
  index: number;
  layout: CoverflowLayout;
  offset: SharedValue<number>;
  picked: SharedValue<number>;
  fly: SharedValue<number>;
  flight: SharedValue<Flight>;
  page: string;
  onTap: (index: number) => void;
}) {
  const { card, cardHeight, reflection, centerPush, stackSpacing } = layout;
  const pulse = usePulse();

  const pose = useAnimatedStyle(() => {
    pulse.get();
    const p = coverflowPose(index - offset.get(), centerPush, stackSpacing);
    const t = fly.get();
    const mine = picked.get() === index;
    const f = mine ? flight.get() : null;
    const along = (from: number, to: number) => from + (to - from) * t;
    return {
      opacity: mine ? p.opacity : p.opacity * (1 - Math.min(1, t * 1.8)),
      zIndex: mine ? 2000 : p.zIndex,
      transform: [
        { perspective: COVERFLOW_PERSPECTIVE },
        { translateX: f ? along(p.translateX, f.dx) : p.translateX },
        { translateY: f ? f.dy * t : 0 },
        { rotateY: `${f ? p.rotateY * (1 - t) : p.rotateY}deg` },
        { scaleX: f ? along(p.scale, f.sx) : p.scale },
        { scaleY: f ? along(p.scale, f.sy) : p.scale },
      ],
    };
  });

  /* The box in flight leaves its reflection on the floor, fading. */
  const mirror = useAnimatedStyle(() => {
    pulse.get();
    return {
      opacity: picked.get() === index ? 1 - Math.min(1, fly.get() * 3) : 1,
      transform: [{ translateY: 0 }],
    };
  });

  const tap = Gesture.Tap()
    .maxDistance(12)
    .onEnd(() => {
      runOnJS(onTap)(index);
    });

  const title = copy.game?.title ?? 'A copy';

  return (
    <GestureDetector gesture={tap}>
      <Animated.View
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${describe(copy)}. Pick it up.`}
        style={[styles.box, { width: card, height: cardHeight, marginLeft: -card / 2 }, pose]}>
        <Poster
          coverUrl={copy.game?.cover_url ?? null}
          heroUrl={copy.game?.hero_url ?? null}
          title={title}
          width={card}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.reflection,
            { top: cardHeight + REFLECTION_GAP, width: card, height: reflection },
            mirror,
          ]}>
          <View style={styles.flipped}>
            <Poster
              coverUrl={copy.game?.cover_url ?? null}
              heroUrl={copy.game?.hero_url ?? null}
              title={title}
              width={card}
            />
          </View>
          <LinearGradient
            colors={[withAlpha(page, 1 - REFLECTION_STRENGTH), page]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center' },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x12,
    paddingHorizontal: Spacing.x16,
  },
  centred: { textAlign: 'center' },
  trackArea: { alignItems: 'center' },
  box: { position: 'absolute', left: '50%', top: 0 },
  reflection: { position: 'absolute', left: 0, overflow: 'hidden' },
  flipped: { transform: [{ scaleY: -1 }] },
  caption: { alignItems: 'center', gap: Spacing.x4, paddingHorizontal: Spacing.x16 },
  position: { marginTop: Spacing.x4 },
  foot: {
    alignItems: 'center',
    gap: Spacing.x16,
    paddingTop: Spacing.x32,
    paddingHorizontal: Spacing.x16,
  },
  actions: { flexDirection: 'row', gap: Spacing.x12, justifyContent: 'center' },
});
