/**
 * The top bar's measurements and the arithmetic of how it moves — SimpMusic's,
 * read from its source at the owner's direction ("look at how SimpMusic does
 * their top bar… the animation when it scrolls, the size, how it looks").
 *
 * Pure: no React, no React Native, nothing imported. `<FrostedTopBar>`, the
 * header-height hooks and `npm test` all read these, so the bar that is drawn,
 * the room a screen leaves for it and the numbers the tests hold cannot drift.
 *
 * ## What the reference does, and where each part was read
 *
 * Every bar in SimpMusic is Material 3's small `TopAppBar` with a transparent
 * container — a back arrow, a title in `titleMedium`, icon buttons at the far
 * end — and it is never a fixed opaque strip. It behaves one of three ways:
 *
 *  1. **A page that opens on a list or a form** (`NotificationScreen.kt`): the
 *     bar floats over the list, clear while the list is at its very top, and
 *     frosted the moment it is not. The two cross-fade over 300ms.
 *  2. **A page that opens on artwork** (`AlbumScreen.kt`, `ArtistScreen.kt`,
 *     `PlaylistScreen.kt`): no bar at all at rest — glass discs, 48 across and
 *     12 from the corner, that are part of the header and scroll away with it.
 *     Once the header has gone a frosted bar carrying the page's name comes in
 *     from above (`fadeIn() + slideInVertically()`).
 *  3. **Home** (`HomeScreen.kt`): the first kind, and its row also folds away
 *     while the page is being read downward and comes back on the way up
 *     (`isScrollingUp`), leaving the frost over the status bar.
 *
 * The functions here run on the UI thread, inside worklets. **A worklet's
 * parameter default cannot name a constant of this module** (CLAUDE.md
 * § Gotchas), so none of them has a default.
 */

/**
 * The bar's row, above the status bar's inset: M3's `TopAppBar` container
 * (`TopAppBarDefaults.TopAppBarExpandedHeight`, 64dp).
 *
 * It is also what `<Screen insetHeader>` reserves — see `useHeaderHeight()`.
 */
export const TOP_BAR_ROW = 64;

/** A control in the bar: M3's `IconButton`, 48 to touch… */
export const TOP_BAR_KEY = 48;
/** …around a 24dp glyph, with its state layer drawn as a 40dp circle. */
export const TOP_BAR_GLYPH = 24;
export const TOP_BAR_KEY_FILL = 40;

/** The row's padding at either end: M3's `TopAppBarHorizontalPadding`. */
export const TOP_BAR_SIDE = 4;

/** Between a control and the title: the title's own horizontal padding in M3. */
export const TOP_BAR_TITLE_GAP = 4;

/**
 * Where the title starts when nothing is in front of it: 16 from the edge
 * (M3's `TopAppBarTitleInset` plus the row's padding). Behind a back arrow it
 * starts at 4 + 48 + 4 = 56, which is `titleStart(true)`.
 */
export const TOP_BAR_TITLE_INSET = 16;

/** A glass disc over artwork: `LiquidGlassIconButton(…, Modifier.size(48.dp))`. */
export const TOP_BAR_DISC = 48;
/** How far a disc sits from its corner, on both axes: `padding(12.dp)`. */
export const TOP_BAR_EDGE = 12;

/**
 * What a page that opens on artwork keeps clear for its discs, above the
 * inset: 12 + 48. Not the bar's row — such a page has no bar at rest, and its
 * own layout (a review's art, a copy's stage) was measured against this.
 */
export const TOP_BAR_DISC_ROOM = TOP_BAR_EDGE + TOP_BAR_DISC;

/**
 * The frost: what is behind the bar, blurred, with the page's own colour
 * washed over it (`barBlurStyle` in `UIExt.kt`).
 */
export const FROST = {
  /** `fadeIn(tween(300))` / `fadeOut(tween(300))`. */
  ms: 300,
  /** Compose's default tween easing, `FastOutSlowInEasing`. */
  easing: [0.4, 0, 0.2, 1] as const,
  /**
   * expo-blur's strength, 1–100, on iOS and the web. The reference blurs by
   * 24dp — three times its glass disc's 8 — and the disc here is drawn at 60.
   */
  intensity: 85,
  /**
   * The same blur on Android, which has to be asked for another way.
   *
   * There, expo-blur divides the strength by `blurReductionFactor` to get the
   * blur's radius — **and paints a grey of its own over the blur, as opaque as
   * the strength is high** (55% of it, for the thinnest dark material; it is
   * re-applied after every change of props, so it follows an animated
   * strength). At 85 that is #252525 at 47% over every bar: a lid, lighter
   * than the page, where the reference has only the page's own colour.
   *
   * So the radius is asked for at a strength of 4 — the grey is then 2%, which
   * is nothing — through a reduction factor small enough to make it the same
   * radius: 21, in the blur library's units (four px each), which is the
   * 80-over-4 this app's full-width bar used to be drawn at.
   */
  androidIntensity: 4,
  androidRadius: 21,
  /**
   * How much of its strength the blur keeps when the frost is fully away.
   *
   * **Never nothing.** Android's blur is set up the moment it is told which
   * view to blur, at whatever strength it has then, and at a radius of exactly
   * zero the platform's blur effect cannot be made at all — "nativePtr is
   * null", which is what a bar that mounted clear used to log on every screen.
   * The frost is hidden by its own opacity while it is away, so this sliver is
   * never seen; it only has to be more than zero.
   */
  floor: 0.02,
  /**
   * The wash over a list or a form: the page's colour at 30%. The reference
   * thinned it from its stock material — "ultraThin's built-in tint stacked on
   * this page's dark ground read as a solid lid" (`SettingScreen.kt`).
   */
  pageTint: 0.3,
  /**
   * The wash on a page that opens on artwork: 85% of the page's own colour.
   *
   * It was 55%, the reference's. Over a game's page that let the masthead
   * scrolling under the bar — a white title, the last of the key art, the
   * cover — through as a light haze, and the bar read white against the dark
   * page. The owner's direction (2026-10-14): "make the header with the blur
   * the same color as the background… the same blur but with the color of the
   * home background page". So it is the page's colour, as Home's bar is, with
   * the blur still under it — what is behind shows as movement, not as light.
   */
  artTint: 0.85,
  /**
   * The wash on the glass bar of a page that opens on artwork the Apple Music
   * way — a game, a studio, a collection (`<FrostedTopBar glass>`): the page's
   * own colour at 60% over the blur.
   *
   * Apple's bar is black at 40% over a blur that also lifts saturation; this
   * app's room is the page's colour, and that bar comes in only once the hero
   * has drained to it (`lib/scroll-motion`), so the wash is that colour. At
   * 60% what passes under it shows as soft movement, not as light: the 55% the
   * owner found too pale (2026-10-14) was over a masthead still bright with
   * art, which this bar never is. iOS draws it on its own nav-bar material.
   */
  glassTint: 0.6,
} as const;

/**
 * How the pinned bar arrives and leaves: Compose's default spring for
 * `fadeIn()` and `slideInVertically()` — stiffness 400 (`StiffnessMediumLow`),
 * critically damped, so it never passes its mark.
 */
export const BAR_SPRING = { mass: 1, stiffness: 400, damping: 40 } as const;

/** `slideInVertically()` starts half the bar's own height above where it ends. */
export const BAR_SLIDE = 0.5;

/** Home's bar. */
export const HOME_BAR = {
  /**
   * How far the page scrolls before the row may fold away.
   *
   * The reference keeps it open for as long as the list's first item is on
   * screen (`firstVisibleItemIndex > 0`), and the first item is its first
   * shelf — "300 is the height of this shelf ON A PHONE" (`HomeScreen.kt`).
   * This page is one scroller with no items to count, so it is that height.
   */
  hold: 300,
  /**
   * How far the page has to travel one way before the row answers.
   *
   * The reference has none: it compares one frame's offset to the last. A
   * list item's offset is whole pixels; a scroll event's is not, and a thumb
   * resting on the glass would fold and unfold the row on its own tremor.
   */
  slop: 6,
} as const;

/**
 * The blur's strength for a frost this far in (`progress`, 0 to 1), out of
 * `max` — and never zero; see `FROST.floor`.
 */
export function frostStrength(progress: number, max: number, floor: number): number {
  'worklet';
  const p = Math.min(1, Math.max(0, progress));
  return max * (floor + (1 - floor) * p);
}

/** Whether a page has left its very top — "transparent only while pixel-0 is on screen". */
export function isScrolled(offset: number): boolean {
  'worklet';
  /* Half a dp: a scroller at rest reports 0, and an iOS bounce settles through
     fractions of a point on its way back to it. */
  return offset > 0.5;
}

/** Where the title's text starts, from the bar's leading edge. */
export function titleStart(hasLeading: boolean): number {
  return hasLeading ? TOP_BAR_SIDE + TOP_BAR_KEY + TOP_BAR_TITLE_GAP : TOP_BAR_TITLE_INSET;
}

/**
 * How far a page that opens on artwork scrolls before its bar comes in: until
 * the foot of the header is at the foot of the bar, so the bar never arrives
 * over the artwork it would have covered.
 *
 * `CollapsingToolbar.kt`'s `headerHeightPx - toolbarHeightPx`; the album's
 * screen says the same thing as "the first item is no longer visible".
 *
 * @param header the header's height, from the top of the page
 * @param bar the bar's whole height, inset included
 */
export function revealOffset(header: number, bar: number): number {
  return Math.max(0, header - bar);
}

/**
 * How far the glass discs have moved for a page scrolled this far. They are
 * part of the header in the reference, so they go exactly as far as the page
 * does — up as it is read, and down with an overscroll — and stop once they
 * are off the display, where moving them further is work nobody sees.
 *
 * @param limit the discs' own extent from the top of the display, inset included
 */
export function discShift(offset: number, limit: number): number {
  'worklet';
  /* `+ 0`: a page at rest is 0, and its negation is -0. */
  return Math.min(Math.max(-offset, -limit), limit) + 0;
}

/**
 * Whether Home's row is open, given where the page was when the row last
 * answered (`anchor`) and where it is now.
 *
 * Open near the top, whatever the direction; past that, open on the way up
 * and folded on the way down. Returns the state unchanged while the page has
 * moved less than `slop` from the anchor — and the caller moves the anchor
 * only when `homeBarMoved` says so, which is what makes it hysteresis.
 */
export function homeBarOpen(
  open: boolean,
  anchor: number,
  offset: number,
  hold: number,
  slop: number
): boolean {
  'worklet';
  if (offset <= hold) return true;
  if (offset - anchor > slop) return false;
  if (anchor - offset > slop) return true;
  return open;
}

/** Whether the page has travelled far enough from `anchor` to take a new one. */
export function homeBarMoved(anchor: number, offset: number, slop: number): boolean {
  'worklet';
  return Math.abs(offset - anchor) > slop;
}

/**
 * The handoff on a page with Apple's glass bar (`<FrostedTopBar glass>`): the
 * page's own name gives way to the bar's as it goes under the bar.
 *
 * Read from FancyScrollView's `HeaderScrollView` (nerdsupremacist), which is
 * Apple Music's large-title bar written out in SwiftUI, and from eleev's
 * `DrawerView`, a scrubbed, interruptible transition:
 *
 *  - **It is scrubbed by the scroll, never timed.** The bar's glass, its name
 *    and the page's name all follow one number, `handoffWeight`: 1 before the
 *    band, 0 after it, the page's offset between. Scrolling halfway leaves
 *    everything halfway; scrolling back runs it backwards. (The bar was a
 *    300ms fade set off as the page crossed one line: a slow scroll had the
 *    page's name lying in the bar's row, under the 60% glass, while the bar's
 *    own name faded in over it. Two names, one on top of the other.)
 *  - **The two names are never seen together.** FancyScrollView's
 *    `HeaderScrollViewTitle`: the large title fades out over the first half of
 *    the band, the small one in over the second, each on a square root, so it
 *    leaves fast and arrives fast and neither is ever a ghost.
 *  - **The glass is `1 − √w`**: there as soon as the band begins, whole at
 *    its end — FancyScrollView's blur against its header's `√w`.
 *  - **The band is the page's name crossing the bar's foot**: from its top
 *    reaching it to its foot reaching it (`handoffBand`). FancyScrollView's is
 *    one navigation-bar height before the collapse; here the name is measured,
 *    because a game's name runs to four lines.
 *  - **It does not rest in between** (`settleOffset`): DrawerView's `.ended`
 *    — a release mid-way finishes the way the finger was going, or back to the
 *    nearer end when it was not going anywhere.
 *
 * The band ends where it always did: the lines under the name at the bar's
 * foot, which is where the pinned hero is solid (`solidAt`).
 */
export const HANDOFF = {
  /** The band is never thinner than this, whatever the name measured: a hair-trigger is a flicker. */
  minBand: 16,
  /** How far a release has to have travelled one way for the settle to follow it, in dp. */
  intent: 8,
} as const;

/**
 * The handoff's band, in page offsets: where the name's top reaches the bar's
 * foot, and where its foot does.
 *
 * @param titleTop the name's top, from the top of the page
 * @param titleFoot its foot — the top of whatever is under it
 * @param bar the bar's whole height, inset included
 */
export function handoffBand(
  titleTop: number,
  titleFoot: number,
  bar: number
): { from: number; to: number } {
  const to = Math.max(1, revealOffset(titleFoot, bar));
  const from = Math.max(0, Math.min(revealOffset(titleTop, bar), to - HANDOFF.minBand));
  return { from, to };
}

/** How much of the handoff is still to come: 1 before the band, 0 after, linear between. */
export function handoffWeight(offset: number, from: number, to: number): number {
  'worklet';
  if (to <= from) return offset >= to ? 0 : 1;
  return Math.min(1, Math.max(0, (to - offset) / (to - from)));
}

/** The page's own name: whole until the band is half done, gone by then (`√`). */
export function pageTitleOpacity(weight: number): number {
  'worklet';
  return Math.sqrt((Math.max(weight, 0.5) - 0.5) * 2);
}

/** The bar's name: nothing until the band is half done, whole at its end (`√`). */
export function barTitleOpacity(weight: number): number {
  'worklet';
  return Math.sqrt(1 - Math.min(weight, 0.5) * 2);
}

/** The bar's glass: as soon as the band begins, whole at its end. */
export function glassIn(weight: number): number {
  'worklet';
  return 1 - Math.sqrt(Math.min(1, Math.max(0, weight)));
}

/**
 * Where a page that has stopped inside the band should go: the end the finger
 * was going toward (`moved`, the gesture's travel, + down the page), or the
 * nearer one if it was hardly going anywhere. `null` outside the band, and at
 * either end of it — nothing to do.
 */
export function settleOffset(
  offset: number,
  from: number,
  to: number,
  moved: number,
  intent: number
): number | null {
  if (!(offset > from + 0.5 && offset < to - 0.5)) return null;
  if (moved > intent) return to;
  if (moved < -intent) return from;
  return offset - from < to - offset ? from : to;
}

/**
 * reacticx's animated header scroll view (`organisms/animated-header-scrollview`,
 * MIT; the owner's, 2026-11-02: "Implement this header scroll view across the
 * app"). The bar's ground is a fade, not a band: the page's colour at 85%,
 * then 80% halfway, then nothing, reaching `tail` past the bar's foot, and it
 * fades in over the first `reach` dp of scroll. Home's bar is that fade with
 * its keys (the owner: "the black topbar is this fade and the buttons remain
 * there"). A page's name is large at the top of its content (`largeTitle`,
 * Type's 32) and gone by `titleOut`; the bar's own small name fades and rises
 * in between `smallFrom` and `smallTo`, over `smallMs`.
 */
export const HEADER_FADE = {
  reach: 80,
  tail: 50,
  alphas: [0.85, 0.8, 0] as const,
  titleOut: 60,
  smallFrom: 40,
  smallTo: 80,
  smallMs: 600,
  smallRise: 20,
} as const;
