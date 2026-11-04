import { Image } from 'expo-image';
import { memo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { MustPlayCorner } from '@/components/must-play-badge';
import { openCoverZoom, useCoverZoomed } from '@/components/ui/cover-zoom';
import { Text } from '@/components/ui/text';
import { editionLabel, type EditionKind } from '@/constants/game-editions';
import { Elevation, PosterAspectRatio, Radius, Spacing, withAlpha } from '@/constants/theme';
import { useGameLabel } from '@/hooks/use-game-labels';
import { useSteamArtwork } from '@/hooks/use-steam-artwork';
import { useTheme } from '@/hooks/use-theme';

/**
 * Below this width the badge is dropped.
 *
 * A 44dp poster in a comment row cannot carry a word — "Remaster" at 10px is
 * most of its width, and shrinking the type further puts it under the 10px
 * floor the type scale sets. Small posters show the art and nothing else; the
 * label is still on the game's own page and on every poster large enough to
 * read it.
 */
const BADGE_MIN_WIDTH = 72;

/**
 * The Must Play wedge: below this width a cover goes without it, and the
 * length of its two short sides otherwise.
 *
 * A mark, not a word, so it survives further down than the edition badge does
 * — to the 56dp covers in a row, where it is 20dp a side with an 8dp star.
 * It grows with the cover to three tenths of its width and stops at 44: on a
 * 180dp rail cover a larger wedge starts to eat the box's own logo, which is
 * usually in the same corner.
 */
const MUST_PLAY_MIN_WIDTH = 56;
const MUST_PLAY_RATIO = 0.3;
const MUST_PLAY_MIN = 20;
const MUST_PLAY_MAX = 44;

/**
 * How far the artwork may slide inside its frame, as a fraction of the width.
 *
 * The frame is a window and the art is behind it, so the art has to be bigger
 * than the opening or a slide would drag the frame's own fill into view. The
 * layer is overscanned by this much on each side and travels exactly that far,
 * which covers the opening at both extremes with nothing to spare.
 *
 * **The cost is a centre crop on every cover, in both dimensions.**
 * `contentFit="cover"` scales a 2:3 source to fill the widened layer, so the
 * clip then shows the middle `1 / (1 + 2f)` of it — the ratio cancels, and the
 * loss is `f / (1 + 2f)` off all four edges, not off the top and bottom only.
 * That is the number this constant is actually chosen against:
 *
 *   f      lost per edge   cover area kept   travel on a 132dp card
 *   0.05      4.5%              83%            ±7dp
 *   0.07      6.1%              77%            ±9dp
 *   0.11      9.0%              67%            ±15dp
 *
 * 0.07 is where the two curves cross. PRODUCT.md calls cover art the primary
 * content of nearly every screen, so spending a third of it on an effect is not
 * a trade this app can make; an eighth is. It still yields 18dp of differential
 * motion across a card's sweep of the display, which is well past the point
 * where the eye reads depth rather than a rendering wobble.
 */
const PARALLAX_OVERSCAN = 0.07;

export type PosterProps = {
  /** Portrait box art. Falls back to `heroUrl`, then to a lettered placeholder. */
  coverUrl?: string | null;
  /** Landscape art, used when there is no portrait cover (Steam, RAWG, itch). */
  heroUrl?: string | null;
  title?: string | null;
  width: number;
  /** Posters in a scrolling row do not need shadows; detail heroes do. */
  elevated?: boolean;
  /**
   * The corner. `image` — the default, and box art's own — also carries the
   * cover's edge (see `styles.edge`). Any other corner belongs to another
   * object: the game case's window (`caseImage`), which has a frame of its own,
   * or a banner that fills its container (`none`). Those are drawn bare.
   */
  rounded?: keyof typeof Radius;
  /**
   * Fill the parent's height instead of deriving it from `width`.
   *
   * For a poster set beside a column of text that has to line up with it top
   * and bottom — the review card. A fixed 2:3 height cannot do that: the text
   * is however tall the text is, and the two only agree by accident. Filling
   * lets the *text* set the height and crops the artwork to suit, which is what
   * `contentFit="cover"` already does everywhere else in the app.
   *
   * The parent must give this a height to fill — a flex row leaves
   * `alignItems` at `stretch` by default, which is exactly that.
   */
  fillHeight?: boolean;
  /**
   * Mark this as a remake, remaster, DLC, edition and so on.
   *
   * Null — the common case — draws nothing. See `constants/game-editions.ts`
   * for where the value comes from and why the vocabulary is only six words.
   */
  edition?: EditionKind | null;
  /**
   * The game's app-wide id (`igdb:1234`), for the Must Play badge.
   *
   * Given one, a game a moderator has labelled (0034) wears the badge in the
   * top corner opposite the edition word. **Omitted, the cover never wears
   * it** — which is how a surface opts out, and two do by the owner's rule:
   * collections, where the cover is one tile of somebody's own arrangement, and
   * reviews, where the art sits beside a writer's score and a second verdict on
   * it would read as theirs.
   */
  gameId?: string | null;
  /**
   * Steam appid, when the game has a Steam listing.
   *
   * Given one, the poster shows Steam's official `library_600x900` capsule
   * instead of `coverUrl` — publisher store art at exactly this component's 2:3,
   * rather than whatever IGDB was able to scrape. **IGDB is still the fallback**:
   * an appid with no capsule, or no appid at all (every console exclusive),
   * falls straight back to `coverUrl` and then to the lettered placeholder. See
   * `lib/games/steam-artwork.ts`.
   */
  steamAppId?: string | null;
  /**
   * This card's distance from the middle of the display, -1 … 1, from
   * `useRailDrift`. Given one, the artwork sits *behind* the frame and slides
   * within it as the rail moves; the frame, its corner and its badge do not
   * move at all.
   *
   * **Null is the default and costs nothing.** No shared value, no animated
   * style, no extra view — the plain `<Image>` renders exactly as it always
   * has. That matters because this component is on nearly every screen in the
   * app, and an animated node per poster on a wall of fifty would be a real
   * price for an effect only three rails use.
   */
  parallax?: SharedValue<number> | null;
  /**
   * Where this cover's download stands in the queue, expo-image's `priority`.
   * `low` for a wall of covers under something that should arrive first — the
   * studio grid, below its banner. Omitted, it is expo-image's own `normal`.
   */
  priority?: 'low' | 'normal' | 'high';
  /**
   * Whether holding the cover lifts it to the middle of the screen
   * (`<CoverZoomHost>`, reacticx's matched geometry — the owner's,
   * 2026-11-04). On by default: every cover in the app. Off where a hold
   * already means something else — choosing games to remove from a
   * collection, taking a Must Play label off.
   */
  zoomable?: boolean;
};

/** How long a cover is held before it lifts — under a Pressable's own 500. */
const LIFT_HOLD_MS = 380;

/**
 * Portrait game artwork at a fixed 2:3 ratio.
 *
 * Providers are inconsistent about what art they have — IGDB and Steam publish
 * true box art, RAWG and itch.io only landscape key art. Rather than stretching
 * a landscape image into a portrait slot, we crop it with `contentFit="cover"`,
 * which reads acceptably, and fall back to an initial when there is no art at
 * all.
 */
/**
 * Memoised, and this is the one that pays for the pattern.
 *
 * `<Poster>` is on nearly every screen and there are dozens of it on the busy
 * ones — a four-across collection grid, a franchise rail, a search result list.
 * Every prop it takes is a primitive except `parallax`, which is a `SharedValue`
 * and therefore a stable reference, so the comparison is cheap and almost always
 * says "no change". Without it, any state that moves in a parent — a tab
 * switching, a query settling, a sort changing — re-runs `useSteamArtwork` and
 * rebuilds the whole subtree for every cover on screen.
 */
export const Poster = memo(function Poster({
  coverUrl,
  heroUrl,
  title,
  width,
  elevated = false,
  rounded = 'image',
  fillHeight = false,
  edition = null,
  gameId = null,
  steamAppId = null,
  parallax = null,
  priority,
  zoomable = true,
}: PosterProps) {
  const theme = useTheme();
  /* The frame, held in state rather than a ref: the hold's gesture is built
     while rendering, and the React Compiler refuses a ref read there. */
  const [frame, setFrame] = useState<View | null>(null);
  const [token] = useState(() => ({}));
  const lifted = useCoverZoomed(token);
  const steam = useSteamArtwork(steamAppId);
  const mustPlay = useGameLabel(gameId, 'must_play') && width >= MUST_PLAY_MIN_WIDTH;
  const [steamFailed, setSteamFailed] = useState(false);
  const height = width / PosterAspectRatio;
  const radius = Radius[rounded];
  const badge = width >= BADGE_MIN_WIDTH ? editionLabel(edition) : null;
  /* Rounded, because a fractional inset on one side and its rounding on the
     other would leave a sub-pixel gap at the extreme of the travel — which is
     exactly where the frame's fill would show through. */
  const overscan = Math.round(width * PARALLAX_OVERSCAN);

  /*
   * Steam first, IGDB second, placeholder last.
   *
   * `steamFailed` is the *second* failure — the hook already retries once
   * through the hashed-path lookup, and this is what gives up on Steam
   * entirely and hands the slot back to IGDB. Without it a game whose appid
   * has no capsule at all would sit on a broken image forever rather than
   * showing the perfectly good cover we already had.
   */
  const steamSource = steam && !steamFailed ? steam.library : null;
  const source = steamSource ?? coverUrl ?? heroUrl ?? null;
  const cacheKey = `poster-${steamAppId ?? title ?? source}`;

  /* Held, the cover lifts out of its place (`<CoverZoomHost>`): measured in
     the window, and hidden here until it lands back. A hold that lifts it
     cancels the press of whatever it is in, so it does not also open. */
  const lift = () => {
    if (!source) return;
    frame?.measureInWindow((x, y, w, h) => {
      if (!(w > 0 && h > 0)) return;
      openCoverZoom({ token, uri: source, cacheKey, x, y, width: w, height: h, radius, title });
    });
  };
  const hold = Gesture.LongPress()
    .enabled(zoomable && !!source)
    .minDuration(LIFT_HOLD_MS)
    .onStart(() => {
      'worklet';
      runOnJS(lift)();
    });

  const art = source ? (
    <Image
      /* `cacheKey` keeps the disk entry keyed by *what* this is rather
         than by a URL that changes when Steam re-cuts its art or the
         game falls back to IGDB — otherwise every swap is a cache miss.
         `recyclingKey` tells expo-image to drop the previous bitmap when
         a recycled row shows a different game, which is what stops the
         wrong cover flashing in a fast scroll. */
      source={{ uri: source, cacheKey }}
      recyclingKey={steamAppId ?? coverUrl ?? title ?? undefined}
      style={styles.image}
      cachePolicy="memory-disk"
      contentFit="cover"
      transition={220}
      priority={priority}
      onError={() => {
        if (!steamSource) return;
        // First failure asks for the hashed path; if that one fails too
        // this runs again and drops to IGDB.
        if (steam) steam.onFailed();
        setSteamFailed(true);
      }}
      accessibilityIgnoresInvertColors
    />
  ) : (
    <View style={styles.placeholder}>
      <Text variant="h1" color="textMuted">
        {(title ?? '?').trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );

  /*
   * Outer view carries the fill and the shadow; inner view does the clipping.
   * Android's `elevation` is clipped away by `overflow: 'hidden'`, so the two
   * cannot live on the same view — artwork always needs the clip to round its
   * corners, which is why every poster in the app was shadowless on Android
   * before. See DESIGN.md § 6.3.
   *
   * Every poster now sits on `Elevation.card`; `elevated` promotes it to
   * `raised` for a detail hero, where the artwork is the subject rather than
   * one tile in a rail.
   */
  return (
    <GestureDetector gesture={hold}>
      <View
        ref={setFrame}
        collapsable={false}
        style={[
          { width, borderRadius: radius, backgroundColor: theme.surfaceElevated },
          // `flex: 1` rather than a computed height — the parent row's stretch
          // supplies it. See `fillHeight`.
          fillHeight ? styles.fill : { height },
          elevated ? Elevation.raised : Elevation.card,
          /* Lifted: its copy is in the middle of the screen. */
          lifted && styles.lifted,
        ]}>
        <View style={[styles.clip, { borderRadius: radius }]}>
          {/* The badge below is a *sibling* of this, not a child, which is the
            whole reason the parallax lives here rather than on the frame: the
            artwork slides and the label pinned to the corner does not. Move
            the badge inside and it drifts off the corner it is anchored to. */}
          {parallax && source ? (
            <DriftingArtwork drift={parallax} overscan={overscan}>
              {art}
            </DriftingArtwork>
          ) : (
            /* `source &&`, because the fallback is a centred letter on a flat
             fill: there is nothing behind the window to see a different part
             of, and sliding it would read as a layout bug rather than depth. */
            art
          )}

          {/*
          Inside the clip, so the badge's corner follows the artwork's.

          Near-black at 82%, with white type — not a hue. Two rules meet here
          and agree: colour on this page belongs to the *game*, read out of its
          own box art, and nothing coloured goes on top of artwork (which is why
          `<Poster>` has no coloured-shadow prop either). A ramp of seven
          release types in seven colours would also be seven things to learn,
          where the word is already the answer. Ink this dark reads over a white
          cover and a black one alike, which no tint does.
        */}
          {badge && (
            <View
              style={[styles.badge, { backgroundColor: withAlpha(theme.shadowInk, 0.82) }]}
              pointerEvents="none">
              <Text variant="label" style={{ color: theme.white }} numberOfLines={1}>
                {badge}
              </Text>
            </View>
          )}

          {/*
          The Must Play wedge, filling the corner the edition word is not in.

          A sibling of the artwork like the word above, so it stays put while a
          parallax slides the art behind it, and inside the clip, so it takes
          the cover's rounded corner. It is the one coloured thing this
          component puts on a cover — the owner's call, and a narrow one: a
          moderator's label is data about the game, drawn as a mark in a corner
          rather than as a tint on the art.
        */}
          {mustPlay && (
            <View style={styles.mustPlay} pointerEvents="none">
              <MustPlayCorner
                size={Math.round(
                  Math.min(MUST_PLAY_MAX, Math.max(MUST_PLAY_MIN, width * MUST_PLAY_RATIO))
                )}
              />
            </View>
          )}

          {/* No edge over the art. Every portrait wore a hairline of cool white
            inside its corner for a while (`coverEdge`); the owner had it
            removed (2026-10-14). Do not draw one again, here or round a
            `<Poster>`. */}
        </View>
      </View>
    </GestureDetector>
  );
});

/**
 * The artwork, one layer back.
 *
 * A separate component rather than a branch inside `<Poster>` so the hook is
 * only ever mounted when the effect is actually wanted — `useAnimatedStyle`
 * costs a worklet and a subscription per instance, and `<Poster>` renders on
 * nearly every screen in the app.
 *
 * ## The sign, which is easy to get backwards
 *
 * The art is a *further away* layer, so in screen space it moves less than its
 * frame does — which is the same as saying it is pulled toward the vanishing
 * point, and the vanishing point is the middle of the display. A card sitting
 * on the right of the screen therefore shows its art displaced to the *left*
 * inside the opening, the displacement passes through zero as the card crosses
 * the centre, and it reverses as the card exits to the left. Hence the negated
 * drift. Flip the sign and the art appears to be *in front* of the frame, which
 * reads as a printing error rather than as depth.
 */
function DriftingArtwork({
  drift,
  overscan,
  children,
}: {
  drift: SharedValue<number>;
  overscan: number;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -drift.get() * overscan }],
  }));

  return (
    <Animated.View
      style={[styles.artLayer, { left: -overscan, right: -overscan }, style]}
      pointerEvents="none">
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  lifted: { opacity: 0 },
  /* Absolute rather than laid out, so widening it by the overscan cannot push
     the badge or change the frame's own size — the frame's dimensions are set
     by `width` and the aspect ratio, and this hangs off both edges of it. */
  artLayer: { position: 'absolute', top: 0, bottom: 0 },
  /* Top-left, inset by a hair so it reads as sitting *on* the art rather than
     bleeding off it. `Radius.image` matches the artwork's own corner, which is
     what keeps it a rounded square and not a pill — a pill here would read as a
     chip, and chips in this app are metadata you can tap. */
  /* `start`, not `left`: React Native auto-flips `flexDirection: 'row'` under
     `I18nManager.isRTL`, so a badge pinned to the physical left ends up on the
     opposite corner from every row that flipped around it. The radius is
     uniform, so it has no side to get wrong. */
  badge: {
    position: 'absolute',
    top: Spacing.x4,
    start: Spacing.x4,
    paddingHorizontal: Spacing.x8,
    paddingVertical: 2,
    borderRadius: Radius.image,
  },
  /* Flush in the corner, so the wedge's two short sides are the cover's own
     edges. `right`, not `end`: the wedge is drawn for the top-right corner,
     and a mirrored corner would need a mirrored triangle. */
  mustPlay: { position: 'absolute', top: 0, right: 0 },
  clip: { width: '100%', height: '100%', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
