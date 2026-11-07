import { Image, type ImageContentPosition } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, TurboModuleRegistry, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  withTiming,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';

import { BLUR_RADIUS } from '@/components/ui/hero-art';
import { DISSOLVE_STOPS } from '@/constants/game-masthead';
import { Palette, withAlpha } from '@/constants/theme';
import { usePulse } from '@/hooks/use-pulse';
import { useScreenChrome } from '@/hooks/use-screen-chrome';
import { useSteamArtwork } from '@/hooks/use-steam-artwork';
import {
  COVER_FRONT_KNEE,
  PROGRESSIVE_BLUR,
  TAIL,
  bandWashStops,
  kneeDrop,
  washStops,
} from '@/lib/progressive-blur';
import {
  PINNED_HERO,
  pinnedBlur,
  pinnedDrain,
  pinnedDrift,
  pinnedStretch,
} from '@/lib/scroll-motion';
import { footFade, type FootFade } from '@/lib/scrim';

/*
 * Convx's row-by-row blur (`<ProgressiveBlur>`, `lib/progressive-blur`), where
 * the build has Skia. Asked of the module registry before anything is
 * imported: Skia's entry calls `getEnforcing('RNSkiaModule')` as it loads, so
 * a build made without it would throw on the import — there, and on the web,
 * the hero keeps its one blurred copy.
 */
const ProgressiveBlur = TurboModuleRegistry.get('RNSkiaModule')
  ? lazy(() => import('@/components/ui/progressive-blur'))
  : null;
/**
 * Whether this build can draw an animated cover into the hero's blur — and
 * so whether a caller should hand it `animation` rather than drawing the
 * animation itself over the art. An APNG is still the caller's to draw
 * (`skiaAnimates`).
 */
export const HERO_ANIMATES = !!ProgressiveBlur;

/** expo-image's `contentPosition`, as the 0–1 anchors the blur's canvas draws by. */
function anchorsOf(position: ImageContentPosition | undefined): { x: number; y: number } {
  const share = (value: unknown, fallback: number) =>
    typeof value === 'string' && value.endsWith('%') ? parseFloat(value) / 100 : fallback;
  if (!position || typeof position !== 'object') return { x: 0.5, y: 0.5 };
  const place = position as { top?: unknown; left?: unknown };
  return { x: share(place.left, 0.5), y: share(place.top, 0.5) };
}

/**
 * Convx's wash (`artistWashStops`), over the art and its mirrored tail: the
 * hero's foot fade wherever the row-by-row blur is drawn.
 */
const HERO_WASH: FootFade = washStops(PROGRESSIVE_BLUR.longWashFrom);

/** A gradient's colours and stops, which its types insist are at least two. */
type Colours = readonly [string, string, ...string[]];
type Stops = readonly [number, number, ...number[]];

const colours = (fade: FootFade, page: string) =>
  fade.alphas.map((alpha) => withAlpha(page, alpha)) as unknown as Colours;
const locations = (fade: FootFade) => fade.locations as unknown as Stops;

/**
 * The game page's own fade: the owner's soft dissolve (`dissolveAt`, measured
 * off their reference), turned round — what was the art's alpha going is the
 * page's alpha coming. Over a flat page the two are the same picture; as a fade
 * *to a colour* it needs no mask, which a video cannot be drawn inside.
 */
export const MASTHEAD_FADE: FootFade = {
  locations: DISSOLVE_STOPS.map((stop) => stop.at),
  alphas: DISSOLVE_STOPS.map((stop) => 1 - stop.alpha),
};

/**
 * The trailer's foot (`blur={false}`): the page's colour rising over the
 * bottom of the video only, so the video is seen whole above it.
 */
/* A tenth, down from 0.28 (2026-11-04: the fade hid the trailer): the
   video is seen whole, melting into the page only at its very foot, where
   the words begin. */
export const TRAILER_FADE: FootFade = footFade(0.1);

export type PinnedHeroProps = {
  /** The art. IGDB's, unless a Steam hero takes its place (`steamAppId`). */
  uri?: string | null;
  /** A legacy row's Steam appid: its `library_hero` is drawn when it has one. */
  steamAppId?: string | null;
  /** How tall the art is at rest. Full width, always, from the top of the display. */
  height: number;
  /** The page's colour: what the art's foot fades into, and what it drains into. */
  page: string;
  /** How the art's foot gives way to the page — the sharp copy's and the blurred one's alike. */
  fade: FootFade;
  /**
   * How far the page has scrolled when the art is solid page colour: where
   * the top bar comes in. The blur and the drain are both shares of it.
   */
  solidAt: number;

  /** How much of the frame, from the top, is darkened for the status bar and the discs. */
  scrim?: number;
  /**
   * Whether the page's colour is known. Until it is the art waits, unseen, and
   * comes in over `PINNED_HERO.arriveMs` as the page takes its colour — so the
   * art's foot never fades into one colour over a page of another.
   */
  ready?: boolean;
  /** Wraps the art — the trailer under it (`<TrailerBackdrop>`), which drifts and blurs with it. */
  media?: (art: ReactNode) => ReactNode;
  /** Where the image sits in the frame: `contentPosition` (a collection anchors its box art). */
  contentPosition?: ImageContentPosition;
  /** Black over the art, 0–1: a studio's 5%, so a bright banner sits back behind the name. */
  veil?: number;
  /** The loaded image's size, for a caller that has to reject art it cannot use. */
  onLoad?: (size: { width: number; height: number }) => void;
  /**
   * The hero is drawn whole: the art has loaded and, where Convx's blur is
   * drawn, the blur has its picture too — or the art failed, and there is
   * nothing more to wait for. The game page holds itself back until then
   * (the owner's, 2026-11-05: "the game page screen doesnt load until the
   * blur loads").
   */
  onReady?: () => void;
  /**
   * Convx's foot (2026-10-31): the art running on into its own mirrored
   * reflection, and Convx's wash in place of `fade` — wherever the row-by-row
   * blur is drawn. **The game page's alone**, because only its masthead is
   * transparent below the art, which is where a tail is seen. A studio's and
   * a collection's solid part starts at the art's foot and would cover it,
   * and their names stand higher in the art than the game's title, where
   * Convx's wash has hardly begun: they would sit on 80–95% of the art, for
   * a tail nobody sees (measured: `scripts/progressive-blur-render.mjs`).
   */
  tail?: boolean;
  /**
   * Whether the art blurs at all. Off, it is drawn sharp, its foot simply
   * fading into the page by `fade` — the game page's trailer (the owner's,
   * 2026-11-03: "whenever it plays, remove the blur and simply add a solid
   * fade"), where a blur over the video's lower half hid half of it.
   */
  blur?: boolean;
  /**
   * The animated cover, played in the hero itself — sharp over the art and
   * moving under the blur too. An animated WebP or GIF, or a video
   * (`skiaAnimates`), and only where `HERO_ANIMATES`; null for the still.
   * **The blur is the same one either way**: switching between the still and
   * the animation changes what it draws, never the blur itself.
   */
  animation?: string | null;
  /** The animation would not play in the hero: the caller draws it over the art instead. */
  onAnimationFail?: (error?: unknown) => void;
  /**
   * Where the foot's blur begins at rest, in sides — higher than its own
   * knee never. The game page with Settings → Game title off stands it near
   * the cover's foot (`TITLELESS_KNEE`), so the logo on the box is seen.
   */
  knee?: number;
  /**
   * The cover in front (the game page's): the blur and the wash ease down to
   * the art's foot, so the picture is seen whole (`COVER_FRONT_KNEE`).
   */
  lowered?: boolean;
  /**
   * How many sides further than Convx's the tail and its wash run, so words
   * laid low on the art stand wholly on the blur (`heroExtension`) — the
   * game page with its title off.
   */
  extend?: number;
  /**
   * The game page's band, in dp from the art's top: a thin row of blur from
   * `from` that is heavy well before `to`, and the page's colour whole at
   * `to` (`BAND`, the owner's reference of 2026-11-04). In place of Convx's
   * foot, its tail running only as far as the band needs. Where Skia cannot
   * draw it, the page's own `fade`.
   */
  band?: { from: number; to: number } | null;
};

/**
 * The game page's hero, pinned behind the page — the owner's brief of
 * 2026-10-27, after Apple Music's artist page (`lib/scroll-motion`,
 * `PINNED_HERO`, says it in numbers).
 *
 * **It is the page's backdrop, not part of the page** (`<Screen backdrop>`):
 * the art stays at the top of the display, drifting up only a fifth as fast as
 * the page, and the page slides over it — the masthead first, which is
 * transparent so the title, the cover and the synopsis float on the art, then
 * the page's solid part, which rises and swallows it. So nothing here clips to
 * the page, and the screen's own fill under it is the page's colour.
 *
 * ```
 *   the page's fill   — `<Screen>`'s, behind all of this
 *   drift             the art, the trailer, the blurred copy and the foot
 *                     fade, moving up together, slowly
 *   scrim             the top darkened for the status bar and the discs
 *   drain             the page's colour over all of it, once it is blurred
 * ```
 *
 * **The blur is Convx's, row by row** (`<ProgressiveBlur>`, the owner's of
 * 2026-10-31): a Skia shader whose radius follows the row — sharp at the top
 * and soft toward the foot at rest, the softness climbing to the top as the
 * page scrolls (`lib/progressive-blur`). Its climb is the same `pinnedBlur`
 * the old copy's opacity was. It lies over the art and over a trailer —
 * though it blurs the *still*, so at rest a playing trailer's foot is the
 * still's, softened, under the page's own fade.
 *
 * **Where Skia is not in the build** (an APK from before it, the web), or its
 * picture will not load, the blur is what it was: a blurred copy whose
 * opacity moves — a radius that moved would be a new bitmap a frame. It is
 * the full-size file, mounted once the sharp
 * copy has loaded so Android decodes it from the cache that load filled. **Not
 * a small copy**: expo-image's Android blur shrinks the bitmap to a quarter
 * before blurring it (`BlurTransformation(min(radius, 25), 4)`), so a 180-wide
 * copy became a 45-pixel smear — a flat grey, "no blur at all" on the owner's
 * phone (2026-10-27). It lies over the art, so it softens a trailer too. It
 * comes in after a little scroll, gently, over most of the way; the art then
 * drains into the page's colour over the last quarter, solid at `solidAt` —
 * where the top bar comes in.
 *
 * **One foot fade, over both copies.** The sharp art and the blurred one
 * dissolve into the page by exactly the same curve, so the art is seamless
 * with the page at every point of the crossfade. For one build the blurred
 * copy carried a shorter fade of its own, and as it came in the art stopped
 * dissolving and read "as if it was pasted onto the page raw" (the owner,
 * 2026-10-27).
 *
 * **Nothing has an edge at the art's foot.** The blurred copy is drawn at the
 * art's own size — it was 10% oversize and clipped, and the clip's edge let a
 * sliver of it through at fractional scroll positions: a line under the art
 * that moved at the art's speed, "some kind of z fighting" (the owner,
 * 2026-10-27) — and a strip of page colour hangs under the art on the box that
 * drifts with it (`footHold`), so the foot is page colour on both sides.
 *
 * Every scroll-driven style reads `pulse` and carries a transform: a render
 * re-applies them all (`usePulse`, CLAUDE.md § Gotchas, the lost end value).
 */
export const PinnedHero = memo(function PinnedHero({
  uri,
  steamAppId = null,
  height,
  page,
  fade,
  solidAt,
  scrim = 0,
  ready = true,
  media,
  contentPosition,
  veil = 0,
  onLoad,
  onReady,
  tail: withTail = false,
  blur = true,
  animation = null,
  onAnimationFail,
  knee,
  lowered = false,
  extend = 0,
  band = null,
}: PinnedHeroProps) {
  const chrome = useScreenChrome();
  const still = useSharedValue(0);
  const scrollY = chrome?.scrollY ?? still;
  const pulse = usePulse();

  /* Steam's hero, then IGDB's — `<HeroArt>`'s ladder. */
  const steam = useSteamArtwork(steamAppId);
  const [steamFailed, setSteamFailed] = useState(false);
  const steamSource = steam && !steamFailed ? steam.hero : null;
  const source = steamSource ?? uri ?? null;
  const [loaded, setLoaded] = useState<string | null>(null);
  const blurReady = !!source && loaded === source;

  /* Convx's blur when Skia can draw it; the one blurred copy when it cannot. */
  const { width } = useWindowDimensions();
  const [skiaFailed, setSkiaFailed] = useState(false);
  const progressive = blur && !!ProgressiveBlur && !skiaFailed;

  /*
   * On the game page, with Convx's blur, Convx's foot: the art runs on into
   * its own reflection (a fifth of its height) and Convx's wash takes it to
   * the page's colour over the art and the tail together — in place of the
   * page's own `fade`. A studio, a collection and a build without Skia keep
   * their `fade`, over the art alone, exactly as before. One fade either way,
   * over every copy.
   */
  const tailed = withTail && progressive && !!source;
  /* A side, Convx's unit, in dp of this art. */
  const sideDp = height / PROGRESSIVE_BLUR.artworkExtent;
  /* The band, in sides; the hero runs on only as far as the band needs. */
  const bandSides = tailed && band ? { from: band.from / sideDp, to: band.to / sideDp } : null;
  const bandReach = band ? Math.max(height, Math.round(band.to + BAND_FOOT)) : 0;
  const reach0 = bandSides
    ? bandReach / sideDp - PROGRESSIVE_BLUR.heroExtent
    : tailed
      ? Math.max(0, extend)
      : 0;
  const tail = bandSides
    ? bandReach - height
    : tailed
      ? Math.round(height * (TAIL + reach0 / PROGRESSIVE_BLUR.artworkExtent))
      : 0;
  const reach = height + tail;
  const onSkiaFailed = useCallback(() => setSkiaFailed(true), []);

  /* Whole: the art in (or failed), and the blur drawn where there is one. */
  const [blurDrawn, setBlurDrawn] = useState<string | null>(null);
  const [artFailed, setArtFailed] = useState<string | null>(null);
  const onBlurDrawn = useCallback(() => setBlurDrawn(source), [source]);
  const whole =
    !source ||
    artFailed === source ||
    (loaded === source && (!progressive || blurDrawn === source));
  useEffect(() => {
    if (whole) onReady?.();
  }, [whole, onReady]);
  const anchors = anchorsOf(contentPosition);
  /* How far the blur has climbed: the old copy's opacity, as the climb's progress. */
  const climb = useDerivedValue(() =>
    pinnedBlur(scrollY.get(), solidAt, PINNED_HERO.blurFrom, PINNED_HERO.blurUntil)
  );

  /*
   * Where the blur begins, two ways, and each moves eased (a shared value
   * written in an effect is not a state sync, CLAUDE.md):
   *
   * - **At rest**, its own knee or a lower one the page chose (`knee` — the
   *   game page with its title off). The curve is squeezed into what is left
   *   above the art's foot (`drop`, `droppedRow`), and the wash with it, so
   *   the foot and the tail are as heavy as ever.
   * - **The cover in front** slides the whole blur and wash down to the
   *   cover's edge (`slide`) — the clear view, as it always was.
   */
  const ownKnee = withTail ? PROGRESSIVE_BLUR.longKnee : PROGRESSIVE_BLUR.knee;
  const restKnee = Math.max(ownKnee, knee ?? ownKnee);
  const targetDrop = kneeDrop(ownKnee, restKnee);
  const targetSlide = lowered
    ? kneeDrop(bandSides ? bandSides.from : restKnee, COVER_FRONT_KNEE)
    : 0;
  const drop = useSharedValue(targetDrop);
  const slide = useSharedValue(targetSlide);
  useEffect(() => {
    const motion = { duration: LOWER_MS, easing: Easing.inOut(Easing.cubic) };
    /* At once: the wash is drawn for it, and a setting changing is not a motion. */
    drop.set(targetDrop);
    slide.set(withTiming(targetSlide, motion));
  }, [targetDrop, targetSlide, drop, slide]);
  /* Convx's wash over the art and its tail: from where the (squeezed) blur
     begins to just short of the tail's foot, however far the tail runs. */
  const bandFromS = bandSides?.from ?? 0;
  const bandToS = bandSides?.to ?? 0;
  const hasBand = !!bandSides;
  const foot = useMemo(
    () =>
      hasBand
        ? bandWashStops(bandFromS, bandToS, reach / sideDp)
        : tail > 0
          ? targetDrop === 0 && reach0 === 0
            ? HERO_WASH
            : washStops(PROGRESSIVE_BLUR.longWashFrom + targetDrop, reach0)
          : fade,
    [hasBand, bandFromS, bandToS, reach, sideDp, tail, targetDrop, reach0, fade]
  );
  const footColours = useMemo(() => colours(foot, page), [foot, page]);
  const washStyle = useAnimatedStyle(() => {
    pulse.get();
    return {
      transform: [{ translateY: (slide.get() * height) / PROGRESSIVE_BLUR.artworkExtent }],
    };
  });

  const frameStyle = useAnimatedStyle(() => {
    pulse.get();
    const stretch = pinnedStretch(scrollY.get(), height);
    return { transform: [{ translateY: stretch.translateY }, { scale: stretch.scale }] };
  });
  const driftStyle = useAnimatedStyle(() => {
    pulse.get();
    return { transform: [{ translateY: pinnedDrift(scrollY.get(), PINNED_HERO.drift, height) }] };
  });
  const blurStyle = useAnimatedStyle(() => {
    pulse.get();
    return {
      opacity: pinnedBlur(scrollY.get(), solidAt, PINNED_HERO.blurFrom, PINNED_HERO.blurUntil),
      /* Not overscaled: the copy ends exactly where the art does, so nothing
         of it can show past the art's foot. Both platforms' blurs extend an
         image's edge rather than darkening it. */
      transform: [{ translateY: 0 }],
    };
  });
  const drainStyle = useAnimatedStyle(() => {
    pulse.get();
    return {
      opacity: pinnedDrain(scrollY.get(), solidAt, PINNED_HERO.drainFrom),
      transform: [{ translateY: 0 }],
    };
  });

  const art = source ? (
    <Image
      source={{ uri: source }}
      recyclingKey={steamAppId ?? uri ?? undefined}
      style={styles.fill}
      cachePolicy="memory-disk"
      contentFit="cover"
      contentPosition={contentPosition}
      transition={280}
      /* The largest thing on the screen: ahead of every cover beside it. */
      priority="high"
      onLoad={(event) => {
        setLoaded(source);
        onLoad?.({ width: event.source.width, height: event.source.height });
      }}
      onError={() => {
        if (!steamSource) {
          setArtFailed(source);
          return;
        }
        steam?.onFailed();
        setSteamFailed(true);
      }}
      accessibilityIgnoresInvertColors
    />
  ) : null;

  return (
    /* The arrival: a CSS transition on a React prop, which cannot lose its
       end value (CLAUDE.md, the lost end value). Hidden from a screen reader —
       the page's name is its heading, and this is its backdrop. */
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.layer,
        {
          height: reach + PINNED_HERO.footHold,
          opacity: ready ? 1 : 0,
          transitionProperty: 'opacity',
          transitionDuration: PINNED_HERO.arriveMs,
        },
      ]}>
      <Animated.View style={[styles.fill, frameStyle]}>
        {/* The box that drifts: the art, its blurred copy — and its mirrored
            tail, under Convx's blur — and its fade, then a strip of the page's
            own colour under them (`footHold`), so the foot is inside page
            colour on both sides. */}
        <Animated.View style={[styles.fill, driftStyle]}>
          <View style={[styles.art, { height }]}>
            {media ? media(art) : art}

            {/* The art softening: over the art, and over a trailer — row by row
                (Convx's), sharp at the top and soft at the foot at rest, the
                softness climbing to the top as the page scrolls. It fetches its
                own small copy of the art, so it is mounted at once and shown
                once the sharp art is in. */}
            {progressive && ProgressiveBlur && source && (
              <Animated.View
                style={[
                  styles.art,
                  {
                    /* Past the art's foot: the tail is the blur's alone. */
                    height: reach,
                    opacity: blurReady ? 1 : 0,
                    transitionProperty: 'opacity',
                    transitionDuration: 280,
                  },
                ]}>
                <Suspense fallback={null}>
                  {/* One blur, always: the still and the animation are what
                      it draws, never two components swapped. */}
                  <ProgressiveBlur
                    uri={source}
                    width={width}
                    height={height}
                    anchorX={anchors.x}
                    anchorY={anchors.y}
                    progress={climb}
                    onFail={onSkiaFailed}
                    onReady={onBlurDrawn}
                    animatedUri={animation}
                    onAnimationFail={onAnimationFail}
                    long={withTail}
                    drop={drop}
                    slide={slide}
                    extend={reach0}
                    band={bandSides}
                  />
                </Suspense>
              </Animated.View>
            )}
            {/* Where it cannot: one blurred copy, its opacity following the scroll. */}
            {blur && !progressive && blurReady && (
              <Animated.View style={[styles.fill, blurStyle]}>
                <Image
                  source={{ uri: source }}
                  style={styles.fill}
                  contentFit="cover"
                  contentPosition={contentPosition}
                  blurRadius={BLUR_RADIUS}
                  cachePolicy="memory-disk"
                  accessibilityIgnoresInvertColors
                />
              </Animated.View>
            )}

            {/* The art's foot giving way to the page — over both copies, so the
              art dissolves by the same curve sharp or blurred, and on the art,
              so it drifts with it and the art never shows an edge of its own.
              Over the tail too: it is part of the picture. */}
            {veil > 0 && (
              <View
                style={[
                  styles.art,
                  { height: reach, backgroundColor: withAlpha(Palette.shadowInk, veil) },
                ]}
              />
            )}
            <Animated.View style={[styles.art, { height: reach }, washStyle]}>
              <LinearGradient
                colors={footColours}
                locations={locations(foot)}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
          <View
            style={[
              styles.hold,
              { top: reach, height: PINNED_HERO.footHold, backgroundColor: page },
            ]}
          />
        </Animated.View>

        {scrim > 0 && (
          <LinearGradient
            colors={[withAlpha(Palette.shadowInk, 0.5), withAlpha(Palette.shadowInk, 0)]}
            style={[styles.scrim, { height: `${scrim * 100}%` }]}
          />
        )}

        <Animated.View style={[styles.fill, { backgroundColor: page }, drainStyle]} />
      </Animated.View>
    </Animated.View>
  );
});

/** How far under the band's end the hero runs, so its foot is page colour already. */
const BAND_FOOT = 24;

/** How long the blur takes to settle at the cover's edge, and to come back. */
const LOWER_MS = 650;

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, right: 0 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  /* The art at its own height, inside the taller box that drifts. */
  art: { position: 'absolute', top: 0, left: 0, right: 0 },
  hold: { position: 'absolute', left: 0, right: 0 },
  scrim: { position: 'absolute', left: 0, right: 0, top: 0 },
});

/**
 * The page's own colour under everything — `<Screen backdrop>`'s first layer
 * on the game page — taken over `PINNED_HERO.arriveMs` when it is first
 * known, as a CSS transition on a React prop. `<Screen>`'s fill is under this
 * and changes at once; this is what is seen.
 */
export function PageFill({ color }: { color: string }) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.fill,
        {
          backgroundColor: color,
          transitionProperty: 'backgroundColor',
          transitionDuration: PINNED_HERO.arriveMs,
        },
      ]}
    />
  );
}
