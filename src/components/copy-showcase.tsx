import * as Haptics from 'expo-haptics';
import { Suspense, lazy, memo, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  interpolate,
  runOnJS,
  runOnUI,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type DerivedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { CdDisc } from '@/components/cd-disc';
import { CdDiscUnderside } from '@/components/cd-disc-underside';
import { CopyCaseBack } from '@/components/copy-case-back';
import { CopyCaseLip, CopyCaseSpine } from '@/components/copy-case-edge';
import { CopyCaseFront } from '@/components/copy-case-front';
import { CopyCaseLeaf, CopyCaseTray, caseContents } from '@/components/copy-case-inside';
import { StageFace, StageLight } from '@/components/copy-stage-face';
import { CopyStageFloor } from '@/components/copy-stage-floor';
import { CopyStageSheet, type StageSnapshots } from '@/components/copy-stage-sheet';
import { StageTilt } from '@/components/copy-stage-tilt';
import { caseHeightFor } from '@/components/game-case';
import {
  DRIFT_HALF_MS,
  DRIFT_HALVES,
  DRIFT_LINGER,
  DRIFT_RESUME_MS,
  DRIFT_START_MS,
  OPEN_ANGLE,
  OPEN_SCALE,
  OPEN_SHIFT,
  OPEN_TURN,
  PEEK_LIMIT,
  TILT_LEAN,
  TRAY_RECESS,
  TURN_PER_WIDTH,
  caseDepth,
  discDiameter,
  opensToDisc,
  stageMetrics,
  type StageMetrics,
} from '@/constants/copy-stage';
import { CONDITION_LABEL, completenessLabel, mediumFor, releaseLine } from '@/constants/physical';
import { PLATFORMS, hasCase, type PlatformKey } from '@/constants/platform-cases';
import { platformKeyForStored } from '@/constants/platform-family';
import { formatPartialDate } from '@/constants/progress';
import { PosterAspectRatio } from '@/constants/theme';
import { ARRIVAL_OBJECT, useLandingArrival } from '@/hooks/use-arrival';
import { useCopyStage3d } from '@/hooks/use-copy-stage-3d';
import type { CopyWithRelations } from '@/lib/api';
import { NO_COPY_ART, type CopyArt } from '@/lib/api/copy-art';
import type { ScenePose } from '@/lib/copy-scene/scene';
import { STAGE_3D_AVAILABLE } from '@/lib/copy-stage-3d';
import {
  HIDDEN_FACE,
  STAGE_CAMERA,
  driftProgress,
  lampGlint,
  lampShade,
  nearestFace,
  nearestFront,
  restAfter,
  rubberBand,
  showsFront,
  smoothstep,
  solveFace,
  solvePlaced,
  turnX,
  turnZ,
} from '@/lib/stage-geometry';

const RAD = Math.PI / 180;

const CopyStageGL = lazy(() => import('@/components/copy-stage-gl'));

/** The flat stage and the 3D one crossing over, once the 3D one has drawn. */
const STAGE_CROSSFADE_MS = 320;

/*
 * How each movement weighs.
 *
 * `SETTLE` is a turn coming to rest on a face: soft enough to carry a flick's
 * momentum round, damped enough to arrive without wobbling. `HINGE` is the
 * cover swinging — a lid, lighter than the box. `EXCHANGE` is the case and the
 * disc changing places, which is the spring this screen has always used for
 * that. `FLIP` is the keyed half-turn: the turn-over's own spring, copied from
 * `<GameCaseFlip>` so both cases in the app weigh the same in the hand.
 */
const SETTLE = { damping: 19, stiffness: 78, mass: 1 } as const;
const HINGE = { damping: 20, stiffness: 110, mass: 0.9 } as const;
const EXCHANGE = { damping: 20, stiffness: 150, mass: 0.9 } as const;
const FLIP = { damping: 18, stiffness: 140, mass: 0.8 } as const;

/** The case arrives turned this far, and comes square as it lands. */
const ARRIVE_TURN = -20;
/** And this far above where it will stand. */
const ARRIVE_DROP = -26;

/**
 * The disc leaving its tray, on `out`'s 0–1.
 *
 * One number for the whole exchange, as before. Up to `HANDOFF` a finger can be
 * driving it: the disc is coming up off its hub and toward the reader. Past it
 * nobody is holding anything — the cover swings shut, the case leaves to the
 * left, and the disc comes to stand alone where the case stood.
 */
const HANDOFF = 0.5;
const COMMIT = 0.45;
/**
 * Under this the disc counts as in its tray, and is drawn there.
 *
 * Not zero: a spring's tail takes most of a second to reach it, and for that
 * long the travelling disc — which is drawn over everything — would sit on top
 * of a cover already closing over it. It has not started to move below this,
 * so the two drawings are in the same place when they change over.
 */
const SEATED = 0.02;
/** How far toward the reader the disc comes as it is lifted, in dp. */
const LIFT = 64;
/** Let go of the disc faster than this and it comes out, however far it was pulled. */
const FLING_VELOCITY = 550;
/** Flick the standing disc left faster than this and it goes back in its case. */
const FLICK_BACK = 900;

/** Which object is on the stage, and whether the case is open. */
export type CopyStageMode = 'closed' | 'open' | 'disc';

/** The side of it that is toward the reader, for the caption under the stage. */
export type CopySide = 'cover' | 'back' | 'inside' | 'disc' | 'underside';

const SIDES: readonly CopySide[] = ['cover', 'back', 'inside', 'disc', 'underside'];

/** The platform a copy is shown as: its own, or bare art when none was recorded. */
export function copyPlatform(copy: CopyWithRelations): PlatformKey {
  /* A copy with no platform recorded is shown as bare art: drawing a PS5 case
     round a box whose platform nobody wrote down would be inventing it. */
  return platformKeyForStored(copy.platform) ?? 'other';
}

export type CopyStage = StageMetrics & {
  platform: PlatformKey;
  /** Whether the platform has a case at all, or is shown as bare box art. */
  cased: boolean;
  /** How deep the case is. */
  depth: number;
  /** The disc's diameter, true to its case. */
  disc: number;
  /** Whether the case opens like a book, to the disc in its tray. Only then is there a disc to take out. */
  opens: boolean;
  /** Factory sealed: it has a disc in it, and it is not coming out. */
  sealed: boolean;
};

/**
 * Everything about a copy's stage that is decided before anything moves: how
 * large the case stands in the room it has, and what this copy can do.
 *
 * Exported because the screen needs the same answers — it reserves the stage's
 * height, and offers a key only for what the copy can do.
 */
export function copyStage(
  copy: CopyWithRelations,
  windowWidth: number,
  windowHeight: number,
  room: number
): CopyStage {
  const platform = copyPlatform(copy);
  const cased = hasCase(platform);
  /* A case's own shape, from its template; bare box art is 2:3. */
  const heightPerWidth = cased ? caseHeightFor(1000, platform) / 1000 : 1 / PosterAspectRatio;
  const metrics = stageMetrics(windowWidth, windowHeight, room, heightPerWidth);
  const opens = opensToDisc(platform, cased);

  return {
    ...metrics,
    platform,
    cased,
    depth: caseDepth(platform, cased, metrics.caseWidth, metrics.caseHeight),
    disc: discDiameter(platform, metrics.caseWidth, metrics.caseHeight),
    opens,
    sealed: copy.completeness === 'sealed',
  };
}

export type CopyShowcaseProps = {
  copy: CopyWithRelations;
  /**
   * The real back cover and disc label, when found (`useCopyArt`, 2026-10-22):
   * the back face shows the scan, the disc its label. The front stays the
   * app's own. A cartridge's label is not drawn — the stage draws no cartridge.
   */
  art?: CopyArt;
  /** The display's width: the stage runs edge to edge. */
  width: number;
  stage: CopyStage;
  /** The page colour, which is what shows through a disc's centre hole. */
  pageColor: string;
  /** What is on the stage. The screen owns it: its keys change it too. */
  mode: CopyStageMode;
  onModeChange: (mode: CopyStageMode) => void;
  /** Raise it by one to turn over whatever is on the stage. The screen's "Turn over". */
  turnRequest: number;
  /** Which side is toward the reader, as it changes. */
  onSideChange: (side: CopySide) => void;
  /** A sealed copy was asked to open, and did not. */
  onRefuse: () => void;
  /**
   * Whether the stage should be alive: in front, on screen, nobody typing.
   * When it is not, the idle turn stops on a face and the phone's sensor is
   * let go — a screen left open in a pocket should not be working.
   */
  active: boolean;
  /**
   * The physical shelf's Cover Flow has already flown the cover to where the
   * case stands: no landing (no drop, no turn to come square) — the case is
   * there, square on, and starts to drift.
   */
  handedOver?: boolean;
};

/**
 * One physical copy, turning on its stage: its case, and the disc inside it.
 *
 * ## What it does
 *
 * Left alone, the copy **drifts round** — about a lap every twenty-four
 * seconds, slowing on the cover and on the back. A touch stops it.
 *
 *  - **Drag sideways** and it turns with the finger, to any angle; let go and
 *    it carries on with the flick and comes to rest square on a face.
 *  - **Tap the cover** and the case opens: the cover swings about its spine and
 *    the disc is there in its tray. Tap anywhere but the disc to shut it.
 *  - **Tap the disc, or drag it**, and it comes up off its hub; the case shuts
 *    and leaves, and the disc stands alone where the case stood, and turns as
 *    the case did — label one way, mirror the other. Flick it left to put it
 *    back.
 *  - **Tilt the phone** and the lamp moves: its reflection slides across the
 *    plastic, the pool on the floor and the shadow shift, and the object leans
 *    a few degrees to follow.
 *
 * A vertical drag is none of these; it scrolls the page.
 *
 * It was two gestures on a flat case — a tap turned it over, a drag to the
 * right drew the disc out from behind it. The owner asked for a screen to stay
 * on and handle the thing, and chose these.
 *
 * ## What is true of the copy stays true
 *
 * A **sealed** copy does not open: it answers a tap with a short shake. A copy
 * on a **cartridge or a card** has nothing drawn to take out yet, so it turns
 * and catches the light and no more — and a tap turns it over, as a tap always
 * did. What is **inside** an open case is what its owner recorded
 * (`caseContents`). And the copy's edition is still printed on the back of the
 * case and nowhere else.
 *
 * ## The case is this screen's own
 *
 * The protected `<GameCase>` is a face with a shadow. This is a box: six
 * surfaces in one space, turned by hand. The owner lifted the case's protection
 * for this screen alone so that it could be; nothing here touches `<GameCase>`,
 * `<GameCaseDisplay>`, `<GameCaseFlip>` or `<GameCaseBack>`, and the cover is
 * drawn from the same templates by the same arithmetic (`<CopyCaseFront>`).
 *
 * Each surface is a `<StageFace>`, placed every frame by `lib/stage-geometry`,
 * which is where to read why a box cannot simply be six rotated views.
 *
 * ## Everything that moves is one of a few numbers, on the UI thread
 *
 * `turn` and `discTurn` are how far round the case and the disc are; `open` is
 * the cover's swing and `out` the disc's exchange with its case, each 0–1;
 * `tiltX` / `tiltY` the phone. Every face's place, the light on it and the
 * shadow under it are derived from those in worklets. React hears about two
 * things only: which object is on the stage (`mode`), and which side of it is
 * showing (`onSideChange`) — neither more than a few times a minute.
 *
 * ## A re-render nudges the stage
 *
 * Reanimated can lose the last value of an animated style when the JS thread
 * stalls while it settles, and the next render then shows the view's first
 * frame (CLAUDE.md § Gotchas). The usual answer is to restate the resting pose
 * as a plain style, which works for a pose React can name. A case left turned
 * a quarter of the way round has no such name, so instead every render bumps
 * `pulse`, which every face's place depends on: they are all re-solved and
 * re-applied the frame after, whatever was lost. The arrival, whose end React
 * does know, is restated the usual way.
 */
export const CopyShowcase = memo(function CopyShowcase({
  copy,
  art = NO_COPY_ART,
  width,
  stage,
  pageColor,
  mode,
  onModeChange,
  turnRequest,
  onSideChange,
  onRefuse,
  active,
  handedOver = false,
}: CopyShowcaseProps) {
  const reduceMotion = useReducedMotion();
  const { progress: arrival, landed: arrived } = useLandingArrival();
  const settled = arrived || handedOver;
  /* Read by everything that lands; whole at once when the cover was flown in. */
  const landed = useDerivedValue(() => (handedOver ? 1 : arrival.get()));

  /* Somebody listening to the screen has no use for a case that turns round by
     itself, and is told about each side it shows: it stands still for them. */
  const [screenReader, setScreenReader] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      if (alive) setScreenReader(on);
    });
    const listener = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => {
      alive = false;
      listener.remove();
    };
  }, []);

  const still = reduceMotion || screenReader;

  /* The 3D stage: loading behind the flat one, drawn over it, or not at all
     — not in this build, switched off in Settings (off by default on a
     32-bit phone), or it could not be drawn. The flat faces are unmounted
     once the crossfade is over. */
  const copyStage3d = useCopyStage3d();
  const want3d = STAGE_3D_AVAILABLE && copyStage3d.ready && copyStage3d.on;
  const [depth3d, setDepth3d] = useState<'loading' | 'ready' | 'off'>(want3d ? 'loading' : 'off');
  const [flatGone, setFlatGone] = useState(false);
  const [snapshots, setSnapshots] = useState<StageSnapshots | null>(null);
  /* The switch flipped (or the stored choice arrived): start over from the
     flat stage — loading afresh if it is now on. Adjusted while rendering,
     as React has it for state that follows a value, not in an effect. */
  const [wanted, setWanted] = useState(want3d);
  if (wanted !== want3d) {
    setWanted(want3d);
    setDepth3d(want3d ? 'loading' : 'off');
    setFlatGone(false);
  }
  const stageReady = () => {
    setDepth3d('ready');
    setTimeout(() => setFlatGone(true), STAGE_CROSSFADE_MS + 80);
  };
  /* A stage switched off before its crossfade ended must not hide the flat one. */
  const flatHidden = flatGone && depth3d === 'ready';
  const stageFailed = () => {
    setDepth3d('off');
    setFlatGone(false);
  };

  const { platform, opens, sealed } = stage;
  const { caseWidth, caseHeight, depth, disc, centreY } = stage;
  const centreX = width / 2;
  const half = caseWidth / 2;
  const deep = depth / 2;
  const trayZ = deep - depth * TRAY_RECESS;
  const discRadius = disc / 2;
  /* Far enough that the case is off the display, whatever it is turned to. */
  const exit = width / 2 + caseWidth;
  const degreesPerDp = TURN_PER_WIDTH / caseWidth;
  /* A disc standing alone rests on the floor, not in the air where its case was. */
  const standDrop = (caseHeight - disc) / 2 - 4;

  const turn = useSharedValue(still || handedOver ? 0 : ARRIVE_TURN);
  const discTurn = useSharedValue(0);
  const open = useSharedValue(mode === 'closed' ? 0 : 1);
  const out = useSharedValue(mode === 'disc' ? 1 : 0);
  /* A drag on the open case: how far it has been turned to look round the cover. */
  const peek = useSharedValue(0);
  /* The sealed copy's refusal. */
  const shake = useSharedValue(0);
  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);
  const pulse = useSharedValue(0);

  /* The same things React knows, where a worklet can read them. */
  const modeNow = useSharedValue(mode === 'closed' ? 0 : mode === 'open' ? 1 : 2);
  const alive = useSharedValue(active && !still);
  /* Left on its back by hand: it stays there to be read until somebody moves it. */
  const hold = useSharedValue(false);
  /* What a drag took hold of, and where the thing was when it did. */
  const grab = useSharedValue(0);
  const from = useSharedValue(0);
  const panning = useSharedValue(false);

  useEffect(() => {
    pulse.set(pulse.get() + 1);
  });

  // -------------------------------------------------------------------------
  // The idle turn
  // -------------------------------------------------------------------------

  /** Set whatever is on the stage drifting, after `wait`. One long animation; see `driftProgress`. */
  const drift = (value: SharedValue<number>, wait: number) => {
    'worklet';
    if (!alive.get() || hold.get() || modeNow.get() === 1) return;
    const start = nearestFace(value.get());
    value.set(
      withDelay(
        wait,
        withTiming(start + 180 * DRIFT_HALVES, {
          duration: DRIFT_HALF_MS * DRIFT_HALVES,
          easing: (t: number) => {
            'worklet';
            return driftProgress(t, DRIFT_HALVES, DRIFT_LINGER);
          },
        })
      )
    );
  };

  /**
   * Bring a turn to rest on the face its momentum is carrying it to, and let it
   * drift again a while after. `byHand` is a person choosing where it stops:
   * stopped on its back by hand, it is left there.
   */
  const rest = (value: SharedValue<number>, velocity: number, byHand: boolean) => {
    'worklet';
    const target = restAfter(value.get(), velocity);
    if (byHand) hold.set(!showsFront(target));
    if (reduceMotion) {
      value.set(withTiming(target, { duration: 180 }));
      return;
    }
    value.set(
      withSpring(target, { ...SETTLE, velocity }, (finished) => {
        'worklet';
        if (finished) drift(value, DRIFT_RESUME_MS);
      })
    );
  };

  /** Turn whatever is on the stage over, to stay. */
  const turnOver = (value: SharedValue<number>) => {
    'worklet';
    cancelAnimation(value);
    const target = nearestFace(value.get()) + 180;
    hold.set(!showsFront(target));
    if (reduceMotion) {
      value.set(withTiming(target, { duration: 160 }));
      return;
    }
    value.set(
      withSpring(target, FLIP, (finished) => {
        'worklet';
        if (finished) drift(value, DRIFT_RESUME_MS);
      })
    );
  };

  /* The landing: the case comes square as it drops, then starts to drift. */
  useEffect(() => {
    if (still) return;
    if (handedOver) {
      runOnUI(() => {
        'worklet';
        drift(turn, DRIFT_START_MS);
      })();
      return;
    }
    turn.set(
      withSpring(0, ARRIVAL_OBJECT, (finished) => {
        'worklet';
        if (finished) drift(turn, DRIFT_START_MS);
      })
    );
    /* Once, on arrival. `drift` is a new function each render and must not
       restart this. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Alive or not: park on a face while it is not, and pick the drift back up. */
  const wasAlive = useRef(active && !still);
  useEffect(() => {
    const now = active && !still;
    alive.set(now);
    if (now === wasAlive.current) return;
    wasAlive.current = now;
    runOnUI(() => {
      'worklet';
      const value = modeNow.get() === 2 ? discTurn : turn;
      if (now) {
        drift(value, DRIFT_START_MS);
      } else if (modeNow.get() !== 1) {
        cancelAnimation(value);
        value.set(withTiming(nearestFace(value.get()), { duration: 260 }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, still]);

  // -------------------------------------------------------------------------
  // What is on the stage
  // -------------------------------------------------------------------------

  const before = useRef(mode);
  useEffect(() => {
    const was = before.current;
    before.current = mode;
    modeNow.set(mode === 'closed' ? 0 : mode === 'open' ? 1 : 2);
    if (was === mode) return;

    const swing = (to: number, wait = 0, then?: SharedValue<number>) =>
      withDelay(
        wait,
        reduceMotion
          ? withTiming(to, { duration: 160 })
          : withSpring(to, HINGE, (finished) => {
              'worklet';
              if (finished && then) drift(then, DRIFT_START_MS);
            })
      );
    const exchange = (to: number, wait = 0, then?: SharedValue<number>) =>
      withDelay(
        wait,
        reduceMotion
          ? withTiming(to, { duration: 180 })
          : withSpring(to, EXCHANGE, (finished) => {
              'worklet';
              if (finished && then) drift(then, DRIFT_START_MS);
            })
      );
    const square = (value: SharedValue<number>, to: number) =>
      value.set(reduceMotion ? withTiming(to, { duration: 160 }) : withSpring(to, SETTLE));

    hold.set(false);

    if (mode === 'open') {
      /* A case is opened from the front. */
      cancelAnimation(turn);
      square(turn, nearestFront(turn.get()));
      open.set(swing(1));
      out.set(exchange(0));
    } else if (mode === 'disc') {
      cancelAnimation(turn);
      square(turn, nearestFront(turn.get()));
      cancelAnimation(discTurn);
      discTurn.set(0);
      open.set(swing(1));
      /* From shut, the cover has to be out of the way before the disc moves. */
      out.set(exchange(1, was === 'closed' ? 360 : 0, discTurn));
    } else {
      peek.set(withTiming(0, { duration: 200 }));
      if (was === 'disc') {
        /* Whichever way round the disc was left, it goes back label up — the
           short way, not unwinding every lap it has drifted. */
        cancelAnimation(discTurn);
        const angle = discTurn.get();
        discTurn.set(angle - nearestFront(angle));
        square(discTurn, 0);
        out.set(exchange(0));
        open.set(swing(0, 520, turn));
      } else {
        open.set(swing(0, 0, turn));
      }
    }

    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    AccessibilityInfo.announceForAccessibility(
      mode === 'disc'
        ? 'The disc is out of its case'
        : mode === 'open'
          ? 'The case is open'
          : was === 'disc'
            ? 'The disc is back in its case'
            : 'The case is shut'
    );
    /* Driven by `mode` alone; the helpers above are rebuilt every render. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  /* The screen's "Turn over". */
  const asked = useRef(turnRequest);
  useEffect(() => {
    if (asked.current === turnRequest) return;
    asked.current = turnRequest;
    if (mode === 'open') return;
    runOnUI(() => {
      'worklet';
      turnOver(modeNow.get() === 2 ? discTurn : turn);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnRequest]);

  const refuse = () => {
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
    AccessibilityInfo.announceForAccessibility('This copy is sealed. It has never been opened.');
    onRefuse();
  };

  // -------------------------------------------------------------------------
  // Where everything is
  // -------------------------------------------------------------------------

  /** The case as a whole: how far round, how large, where, and how far its cover is swung. */
  const frame = useDerivedValue(() => {
    pulse.get();
    const opened = open.get();
    const gone = out.get();
    const turned = turn.get();
    const lean = peek.get() + OPEN_TURN * opened + TILT_LEAN * tiltX.get();
    return {
      theta: turned + shake.get() + lean,
      /* The same angle with its whole laps taken off: what the disc lifts away
         from, so that it does not unwind them on its way out. */
      local: turned - nearestFront(turned) + lean,
      scale: 1 - (1 - OPEN_SCALE) * opened,
      shift: OPEN_SHIFT * caseWidth * opened - exit * smoothstep(HANDOFF, 1, gone),
      aside: OPEN_SHIFT * caseWidth * opened,
      swing: OPEN_ANGLE * opened * (1 - smoothstep(0.3, 0.72, gone)),
      here: gone < 0.999,
    };
  });

  const coverPose = useDerivedValue(() => {
    const f = frame.get();
    if (!f.here) return HIDDEN_FACE;
    const swung = f.swing * RAD;
    return solvePlaced(
      -half,
      deep,
      -half + caseWidth * Math.cos(swung),
      deep + caseWidth * Math.sin(swung),
      caseWidth,
      f.theta,
      f.scale,
      f.shift
    );
  });

  /* The inside of the cover: the same rectangle, read from its other side. */
  const leafPose = useDerivedValue(() => {
    const f = frame.get();
    if (!f.here || f.swing < 1) return HIDDEN_FACE;
    const swung = f.swing * RAD;
    return solvePlaced(
      -half + caseWidth * Math.cos(swung),
      deep + caseWidth * Math.sin(swung),
      -half,
      deep,
      caseWidth,
      f.theta,
      f.scale,
      f.shift
    );
  });

  const trayPose = useDerivedValue(() => {
    const f = frame.get();
    if (!f.here || f.swing < 1) return HIDDEN_FACE;
    return solvePlaced(-half, trayZ, half, trayZ, caseWidth, f.theta, f.scale, f.shift);
  });

  const backPose = useDerivedValue(() => {
    const f = frame.get();
    if (!f.here) return HIDDEN_FACE;
    return solvePlaced(half, -deep, -half, -deep, caseWidth, f.theta, f.scale, f.shift);
  });

  const spinePose = useDerivedValue(() => {
    const f = frame.get();
    if (!f.here) return HIDDEN_FACE;
    return solvePlaced(-half, -deep, -half, deep, depth, f.theta, f.scale, f.shift);
  });

  const lipPose = useDerivedValue(() => {
    const f = frame.get();
    if (!f.here) return HIDDEN_FACE;
    return solvePlaced(half, deep, half, -deep, depth, f.theta, f.scale, f.shift);
  });

  /**
   * The disc on its way between its tray and the floor.
   *
   * Seated, it is on the tray's own plane, wherever the open case has put that;
   * standing, it is at the middle of the stage, turned by `discTurn`. Between
   * the two it comes forward off the hub and across in one arc.
   */
  const discFrame = useDerivedValue(() => {
    const f = frame.get();
    const gone = out.get();
    const free = smoothstep(SEATED, 0.66, gone);
    const scale = f.scale + (1 - f.scale) * free;
    const seatX = f.scale * turnX(0, trayZ, f.local) + f.aside;
    const seatZ = f.scale * turnZ(0, trayZ, f.local);
    return {
      shown: gone > SEATED,
      x: seatX * (1 - free),
      z: seatZ * (1 - free) + LIFT * Math.sin(Math.PI * free),
      angle: f.local * (1 - free) + (discTurn.get() + TILT_LEAN * tiltX.get()) * free,
      scale,
      free,
    };
  });

  const labelPose = useDerivedValue(() => {
    const d = discFrame.get();
    if (!d.shown) return HIDDEN_FACE;
    const across = discRadius * d.scale * Math.cos(d.angle * RAD);
    const deepness = discRadius * d.scale * Math.sin(d.angle * RAD);
    return solveFace(d.x - across, d.z + deepness, d.x + across, d.z - deepness, disc, d.scale);
  });

  const mirrorPose = useDerivedValue(() => {
    const d = discFrame.get();
    if (!d.shown) return HIDDEN_FACE;
    const across = discRadius * d.scale * Math.cos(d.angle * RAD);
    const deepness = discRadius * d.scale * Math.sin(d.angle * RAD);
    return solveFace(d.x + across, d.z - deepness, d.x - across, d.z + deepness, disc, d.scale);
  });

  /* An open case steps back, and a thing that steps back from this camera
     rises off the floor: this stands it back down. */
  const caseDrop = useDerivedValue(() => ((1 - frame.get().scale) * caseHeight) / 2);

  /* The disc leaves from its tray — which has dropped with the case — and
     comes to stand on the floor. */
  const discDrop = useDerivedValue(() => {
    const free = discFrame.get().free;
    return (1 - free) * caseDrop.get() + free * standDrop;
  });

  /* One disc, drawn in two places: in its tray while it is seated, and as a
     face of its own from the moment it starts to lift. They are in the same
     place when they change over. */
  const seat = useAnimatedStyle(() => ({ opacity: out.get() > SEATED ? 0 : 1 }));

  /* The same numbers for the 3D stage, in one small object a frame: where the
     case and the disc are, as the flat faces are placed from them. */
  const scenePose = useDerivedValue<ScenePose>(() => {
    const f = frame.get();
    const d = discFrame.get();
    return {
      theta: f.theta,
      scale: f.scale,
      shift: f.shift,
      drop: caseDrop.get(),
      swing: f.swing,
      here: f.here,
      discShown: d.shown,
      discX: d.x,
      discZ: d.z,
      discAngle: d.angle,
      discScale: d.scale,
      discDrop: discDrop.get(),
      tiltX: tiltX.get(),
      tiltY: tiltY.get(),
    };
  });

  // -------------------------------------------------------------------------
  // The light on each face
  // -------------------------------------------------------------------------

  const coverLight = useFaceLight(frame, 0, 1, tiltX, tiltY);
  const leafLight = useFaceLight(frame, 180, 1, tiltX, tiltY);
  const trayLight = useFaceLight(frame, 0, 0, tiltX, tiltY);
  const backLight = useFaceLight(frame, 180, 0, tiltX, tiltY);
  const spineLight = useFaceLight(frame, -90, 0, tiltX, tiltY);
  const lipLight = useFaceLight(frame, 90, 0, tiltX, tiltY);

  const labelShade = useDerivedValue(() => lampShade(discFrame.get().angle, tiltX.get()));
  const labelGlint = useDerivedValue(() =>
    lampGlint(discFrame.get().angle, tiltX.get(), tiltY.get())
  );
  const mirrorShade = useDerivedValue(() => lampShade(discFrame.get().angle + 180, tiltX.get()));
  /* The rainbow swings round the disc as it turns and as the phone does. */
  const mirrorLight = useDerivedValue(
    () => 32 + discFrame.get().angle * 1.6 + tiltX.get() * 64 + tiltY.get() * 40
  );

  // -------------------------------------------------------------------------
  // The floor
  // -------------------------------------------------------------------------

  /** How wide the object stands to the camera, for the shadow under it. */
  const spread = useDerivedValue(() => {
    const f = frame.get();
    const d = discFrame.get();
    const box =
      ((Math.abs(Math.cos(f.theta * RAD)) * caseWidth + Math.abs(Math.sin(f.theta * RAD)) * depth) *
        f.scale) /
      caseWidth;
    const coin = (Math.abs(Math.cos(d.angle * RAD)) * disc + 8) / caseWidth;
    const standing = smoothstep(HANDOFF, 0.9, out.get());
    return box * (1 - standing) + coin * standing;
  });

  // -------------------------------------------------------------------------
  // Which side is showing
  // -------------------------------------------------------------------------

  const report = (index: number) => onSideChange(SIDES[index]);
  useAnimatedReaction(
    () => {
      const now = modeNow.get();
      if (now === 1) return 2;
      if (now === 2) return showsFront(discTurn.get()) ? 3 : 4;
      return showsFront(turn.get()) ? 0 : 1;
    },
    (now, was) => {
      if (now !== was) runOnJS(report)(now);
    }
  );

  // -------------------------------------------------------------------------
  // Hands
  // -------------------------------------------------------------------------

  /** Whether a touch on the open case is on the disc in its tray. */
  const onDisc = (x: number, y: number) => {
    'worklet';
    const f = frame.get();
    const seatX = f.scale * turnX(0, trayZ, f.local) + f.aside;
    const seatZ = f.scale * turnZ(0, trayZ, f.local);
    const near = STAGE_CAMERA / (STAGE_CAMERA - seatZ);
    return (
      Math.hypot(x - (centreX + seatX * near), y - (centreY + caseDrop.get())) <
      discRadius * f.scale * near
    );
  };

  /** Whether a touch on the shut case is on the case, and not on the floor beside it. */
  const onCase = (x: number, y: number) => {
    'worklet';
    return Math.abs(x - centreX) < half * 1.08 && Math.abs(y - centreY) < (caseHeight / 2) * 1.08;
  };

  const tap = Gesture.Tap()
    .onBegin(() => {
      /* A finger on it: the drift stops there and then, before anything is
         known about what the finger will do. */
      const now = modeNow.get();
      if (now !== 1) cancelAnimation(now === 2 ? discTurn : turn);
    })
    .onEnd((event, success) => {
      if (!success) return;
      const now = modeNow.get();
      if (now === 1) {
        runOnJS(onModeChange)(onDisc(event.x, event.y) ? 'disc' : 'closed');
        return;
      }
      if (now === 2) {
        /* A tap on the standing disc does nothing but stop it: the way back is
           the flick, or the screen's key. */
        rest(discTurn, 0, true);
        return;
      }
      if (!onCase(event.x, event.y)) {
        /* The floor is not a button. The touch stopped the drift, as any
           touch does; nothing else happens. */
        rest(turn, 0, false);
        return;
      }
      if (!opens) {
        /* Nothing to open: a tap turns it over, as a tap on this case always did. */
        turnOver(turn);
        return;
      }
      if (!showsFront(turn.get())) {
        /* Its back is for reading. A tap holds it there. */
        rest(turn, 0, true);
        return;
      }
      if (sealed) {
        rest(turn, 0, true);
        shake.set(
          withSequence(
            withTiming(-4, { duration: 55 }),
            withTiming(4, { duration: 80 }),
            withTiming(-2, { duration: 70 }),
            withTiming(0, { duration: 70 })
          )
        );
        runOnJS(refuse)();
        return;
      }
      runOnJS(onModeChange)('open');
    })
    .onFinalize((_event, success) => {
      /* The touch became something else — a scroll, or the drag below. If it
         was a scroll, the object was stopped mid-turn by `onBegin` and nothing
         else will square it up. */
      if (success || panning.get()) return;
      const now = modeNow.get();
      if (now !== 1) rest(now === 2 ? discTurn : turn, 0, false);
    });

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-14, 14])
    .onStart((event) => {
      panning.set(true);
      const now = modeNow.get();
      if (now === 1) {
        /* On the open case a drag either lifts the disc or looks round the cover. */
        grab.set(onDisc(event.x, event.y) ? 2 : 1);
        from.set(peek.get());
        return;
      }
      const value = now === 2 ? discTurn : turn;
      cancelAnimation(value);
      grab.set(0);
      from.set(value.get());
    })
    .onUpdate((event) => {
      const held = grab.get();
      if (held === 0) {
        (modeNow.get() === 2 ? discTurn : turn).set(from.get() + event.translationX * degreesPerDp);
      } else if (held === 1) {
        peek.set(rubberBand(from.get() + event.translationX * degreesPerDp * 0.6, PEEK_LIMIT));
      } else {
        const pulled = Math.hypot(event.translationX, event.translationY) / (caseWidth * 0.42);
        out.set(Math.min(1, pulled) * HANDOFF);
      }
    })
    .onEnd((event) => {
      const held = grab.get();
      if (held === 0) {
        const now = modeNow.get();
        if (now === 2 && event.velocityX < -FLICK_BACK && event.translationX < -24) {
          runOnJS(onModeChange)('closed');
          return;
        }
        rest(now === 2 ? discTurn : turn, event.velocityX * degreesPerDp, true);
      } else if (held === 1) {
        peek.set(reduceMotion ? withTiming(0, { duration: 160 }) : withSpring(0, SETTLE));
      } else {
        const pulled = Math.hypot(event.translationX, event.translationY) / (caseWidth * 0.42);
        const commit =
          pulled > COMMIT || Math.hypot(event.velocityX, event.velocityY) > FLING_VELOCITY;
        /* Started here, on the UI thread, so the disc never waits on React to
           be told which way to go; the screen's state follows and asks for the
           same thing again. */
        const target = commit ? 1 : 0;
        out.set(
          reduceMotion ? withTiming(target, { duration: 180 }) : withSpring(target, EXCHANGE)
        );
        if (commit) runOnJS(onModeChange)('disc');
      }
    })
    .onFinalize(() => {
      panning.set(false);
    });

  const gesture = Gesture.Exclusive(pan, tap);

  // -------------------------------------------------------------------------
  // The stage
  // -------------------------------------------------------------------------

  /* The landing: a drop and a little growth, on everything that stands on the
     floor. The turn it arrives with is in `turn` itself. */
  const arriving = useAnimatedStyle(() => {
    const at = landed.get();
    return {
      transform: [
        { translateY: interpolate(at, [0, 1], [ARRIVE_DROP, 0]) },
        { scale: interpolate(at, [0, 1], [0.94, 1]) },
      ],
    };
  });

  const title = copy.game?.title ?? 'A copy';
  const coverUrl = copy.game?.cover_url;
  const heroUrl = copy.game?.hero_url;
  /* A disc's real label; a cartridge's is never drawn on a disc. */
  const discLabel = mediumFor(platform) === 'disc' ? (art.disc?.url ?? null) : null;
  const contents = caseContents(copy.completeness);
  const edition = copy.edition?.trim() && copy.edition.trim() !== 'Standard' ? copy.edition : null;
  /* A sealed copy's film is glossier than the plastic under it. */
  const gloss = sealed ? 1.5 : 1;
  const face = { centreX, centreY };
  const stood = { ...face, drop: caseDrop };
  /* What the printed faces' pictures were taken of: retaken when it changes. */
  const barcode = copy.release?.barcodes[0]?.barcode ?? copy.contribution?.barcode ?? null;
  const snapshotKey = [
    copy.id,
    title,
    edition,
    copy.region,
    copy.edition,
    copy.completeness,
    copy.condition,
    copy.acquired_on,
    copy.notes,
    barcode,
    platform,
    caseWidth,
    caseHeight,
    depth,
    art.back ? 'scan' : 'printed',
  ].join('|');
  const crossfade = {
    transitionProperty: 'opacity',
    transitionDuration: reduceMotion ? 0 : STAGE_CROSSFADE_MS,
    transitionTimingFunction: 'ease-in-out',
  } as const;
  /* The 3D stage is alive exactly when the idle turn is: otherwise it draws
     only when something is moved by hand. */
  const alive3d = active && !still;

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={describe(copy, platform, mode)}
        accessibilityActions={[
          {
            name: 'activate',
            label:
              mode === 'disc'
                ? 'Put the disc back'
                : mode === 'open'
                  ? 'Shut the case'
                  : opens && !sealed
                    ? 'Open the case'
                    : 'Turn it over',
          },
        ]}
        onAccessibilityAction={() => {
          if (mode !== 'closed') onModeChange('closed');
          else if (opens && !sealed) onModeChange('open');
          else runOnUI(turnOver)(turn);
        }}
        collapsable={false}
        style={{ width, height: stage.stageHeight }}>
        {/* Everything under here is one picture to a screen reader, described above. */}
        <View
          style={StyleSheet.absoluteFill}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          {depth3d !== 'off' && snapshots?.key !== snapshotKey && (
            <CopyStageSheet
              copy={copy}
              platform={platform}
              caseWidth={caseWidth}
              caseHeight={caseHeight}
              depth={depth}
              title={title}
              edition={edition}
              printedBack={!art.back}
              left={centreX - half}
              top={centreY - caseHeight / 2}
              pageColor={pageColor}
              snapshotKey={snapshotKey}
              onCaptured={setSnapshots}
              onFail={stageFailed}
            />
          )}

          <CopyStageFloor
            centreX={centreX}
            centreY={centreY}
            floorY={stage.floorY}
            footprint={caseWidth}
            spread={spread}
            tiltX={tiltX}
            tiltY={tiltY}
            landed={landed}
            settled={settled}
          />

          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, arriving, settled && styles.landed]}>
            {!flatHidden && (
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  crossfade,
                  { opacity: depth3d === 'ready' ? 0 : 1 },
                ]}>
                {/* Back to front. The faces of a shut box never overlap, so their
                order among themselves is free; what matters is that the cover
                is over the tray it shuts on, and the disc over all of it once
                it is out. */}
                <StageFace pose={backPose} width={caseWidth} height={caseHeight} {...stood}>
                  <CopyCaseBack
                    copy={copy}
                    platform={platform}
                    width={caseWidth}
                    height={caseHeight}
                    scan={art.back}
                  />
                  <StageLight
                    width={caseWidth}
                    height={caseHeight}
                    gloss={gloss}
                    shade={backLight.shade}
                    glint={backLight.glint}
                  />
                </StageFace>

                <StageFace pose={spinePose} width={depth} height={caseHeight} {...stood}>
                  <CopyCaseSpine
                    platform={platform}
                    depth={depth}
                    height={caseHeight}
                    caseWidth={caseWidth}
                    title={title}
                  />
                  <StageLight width={depth} height={caseHeight} shade={spineLight.shade} />
                </StageFace>

                <StageFace pose={lipPose} width={depth} height={caseHeight} {...stood}>
                  <CopyCaseLip
                    platform={platform}
                    depth={depth}
                    height={caseHeight}
                    caseWidth={caseWidth}
                  />
                  <StageLight width={depth} height={caseHeight} shade={lipLight.shade} />
                </StageFace>

                {opens && (
                  <StageFace pose={trayPose} width={caseWidth} height={caseHeight} {...stood}>
                    <CopyCaseTray
                      coverUrl={coverUrl}
                      heroUrl={heroUrl}
                      title={title}
                      platform={platform}
                      width={caseWidth}
                      height={caseHeight}
                      disc={disc}
                      discLabelUrl={discLabel}
                      seatStyle={seat}
                    />
                    <StageLight
                      width={caseWidth}
                      height={caseHeight}
                      shade={trayLight.shade}
                      glint={trayLight.glint}
                    />
                  </StageFace>
                )}

                {opens && (
                  <StageFace pose={leafPose} width={caseWidth} height={caseHeight} {...stood}>
                    <CopyCaseLeaf
                      coverUrl={coverUrl}
                      heroUrl={heroUrl}
                      width={caseWidth}
                      height={caseHeight}
                      manual={contents.manual}
                      inserts={contents.inserts}
                    />
                    <StageLight width={caseWidth} height={caseHeight} shade={leafLight.shade} />
                  </StageFace>
                )}

                <StageFace pose={coverPose} width={caseWidth} height={caseHeight} {...stood}>
                  <CopyCaseFront
                    coverUrl={coverUrl}
                    heroUrl={heroUrl}
                    title={title}
                    edition={edition}
                    platform={platform}
                    width={caseWidth}
                    height={caseHeight}
                  />
                  <StageLight
                    width={caseWidth}
                    height={caseHeight}
                    gloss={gloss}
                    shade={coverLight.shade}
                    glint={coverLight.glint}
                  />
                </StageFace>

                {opens && (
                  <>
                    <StageFace
                      pose={mirrorPose}
                      width={disc}
                      height={disc}
                      drop={discDrop}
                      {...face}>
                      <CdDiscUnderside size={disc} holeColor={pageColor} light={mirrorLight} />
                      <View style={[StyleSheet.absoluteFill, styles.round]}>
                        <StageLight width={disc} height={disc} shade={mirrorShade} depth={0.35} />
                      </View>
                    </StageFace>

                    <StageFace
                      pose={labelPose}
                      width={disc}
                      height={disc}
                      drop={discDrop}
                      {...face}>
                      <CdDisc
                        coverUrl={coverUrl}
                        heroUrl={heroUrl}
                        title={title}
                        platform={platform}
                        size={disc}
                        holeColor={pageColor}
                        labelUrl={discLabel}
                      />
                      <View style={[StyleSheet.absoluteFill, styles.round]}>
                        <StageLight
                          width={disc}
                          height={disc}
                          shade={labelShade}
                          glint={labelGlint}
                          depth={0.35}
                        />
                      </View>
                    </StageFace>
                  </>
                )}
              </Animated.View>
            )}

            {/* The 3D stage, over the flat one: nothing drawn until it is
                built, then fading in as the flat faces fade out. Never fully
                transparent while it loads — a canvas that is never drawn on
                Android may never be given its surface. */}
            {depth3d !== 'off' && (
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  crossfade,
                  { opacity: depth3d === 'ready' ? 1 : 0.02 },
                ]}>
                <Suspense fallback={null}>
                  <CopyStageGL
                    platform={platform}
                    coverUrl={coverUrl}
                    heroUrl={heroUrl}
                    art={art}
                    width={width}
                    height={stage.stageHeight}
                    centreY={centreY}
                    caseWidth={caseWidth}
                    caseHeight={caseHeight}
                    depth={depth}
                    disc={disc}
                    cased={stage.cased}
                    opens={opens}
                    sealed={sealed}
                    completeness={copy.completeness}
                    snapshots={snapshots}
                    pose={scenePose}
                    active={alive3d}
                    rocking={alive3d}
                    onReady={stageReady}
                    onFail={stageFailed}
                  />
                </Suspense>
              </Animated.View>
            )}
          </Animated.View>
        </View>

        {active && !still && Platform.OS !== 'web' && <StageTilt tiltX={tiltX} tiltY={tiltY} />}
      </View>
    </GestureDetector>
  );
});

/**
 * The lamp on one face of the case.
 *
 * `turned` is where the face points when the case is square on — 0 the cover,
 * 180 the back, ∓90 the spine and the opening edge — and `swings` is 1 for the
 * two sides of the cover, which turn with its hinge as well as with the case.
 */
function useFaceLight<Frame extends { theta: number; swing: number }>(
  frame: DerivedValue<Frame>,
  turned: number,
  swings: 0 | 1,
  tiltX: SharedValue<number>,
  tiltY: SharedValue<number>
) {
  const shade = useDerivedValue(() => {
    const f = frame.get();
    return lampShade(f.theta + turned - swings * f.swing, tiltX.get());
  });
  const glint = useDerivedValue(() => {
    const f = frame.get();
    return lampGlint(f.theta + turned - swings * f.swing, tiltX.get(), tiltY.get());
  });
  return { shade, glint };
}

/** One sentence carrying every face, since a screen reader never sees the turn. */
function describe(copy: CopyWithRelations, platform: PlatformKey, mode: CopyStageMode): string {
  const parts = [
    copy.game?.title ?? 'A copy',
    mode === 'disc' ? 'The disc, out of its case' : mode === 'open' ? 'The case, open' : null,
    releaseLine(copy) || PLATFORMS[platform].label,
    copy.completeness ? completenessLabel(copy.completeness, mediumFor(platform)) : null,
    copy.condition ? CONDITION_LABEL[copy.condition] : null,
    copy.acquired_on ? `Got it ${formatPartialDate(copy.acquired_on) ?? copy.acquired_on}` : null,
  ].filter(Boolean);
  return parts.join('. ');
}

const styles = StyleSheet.create({
  /* The landed pose, restated as a plain style — see `useLandingArrival`. */
  landed: { transform: [{ translateY: 0 }, { scale: 1 }] },
  round: { borderRadius: 9999, overflow: 'hidden' },
});
