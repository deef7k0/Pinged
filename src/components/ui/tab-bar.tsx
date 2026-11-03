import type Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { PaintGlyph, inkTransition } from '@/components/ui/paint-fill';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Radius, Spacing, TapTarget, Type, withAlpha } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { usePulse } from '@/hooks/use-pulse';
import { useTheme } from '@/hooks/use-theme';
import { readableInk } from '@/lib/color';

export type TabItem<T extends string> = {
  key: T;
  label: string;
  /** Optional leading glyph. */
  icon?: keyof typeof Ionicons.glyphMap;
  /**
   * Optional trailing count, set inline after the label.
   *
   * Neutral, not a badge: "ALL GAMES 135" is a *size*, and the overwhelming
   * majority of counts on a tab are. A red badge means "there is something here
   * you have not seen", which is a different claim — pass `alert` for that.
   */
  count?: number | null;
  /** Render the count as an unread badge instead of an inline number. */
  alert?: boolean;
};

export type TabBarProps<T extends string> = {
  tabs: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /**
   * What this set of tabs is choosing between — "What to search", "Library view".
   * Read out before the tabs themselves.
   */
  label?: string;
  /**
   * Draw the glyph and drop the printed word. Every tab must still carry an
   * `icon` and a `label`: the label becomes the accessible name. Use it where
   * the set is small, stable and iconic (the profile's four).
   */
  iconOnly?: boolean;
  /**
   * `spread` is the game page's: a taller track (its tabs are the page's main
   * control, 15 type). `start` and `center` are kept for their callers and
   * draw the same thing — a segmented control always spans its row.
   */
  align?: 'start' | 'center' | 'spread';
  /**
   * How far in from the screen's edge the track starts and ends, when the
   * screen does not keep the app's 15 (the profile's `PROFILE_MARGIN`).
   */
  inset?: number;
};

type Segment = { x: number; width: number };

/**
 * reacticx's spring for the thumb: heavily overdamped, so it glides and lands
 * without a bounce (`organisms/segmented-control`, MIT).
 */
const THUMB_SPRING = { stiffness: 80, damping: 90, mass: 1 } as const;

/** A tap: the thumb swells to 1.3 over 350ms and wobbles back (reacticx's `triggerTapScale`). */
const POP_SCALE = 1.3;
const POP_MS = 350;
const POP_RETURN = { stiffness: 10, damping: 5, mass: 0.8 } as const;
/** Held for a scrub: 1.2, and back on release. */
const SCRUB_SCALE = 1.2;

/** Between the track's edge and the thumb (reacticx's 2dp margin). */
const TRACK_PAD = 2;

/**
 * The app's tabs — reacticx's segmented control (the owner's, 2026-11-02:
 * "Make the tabs in the app look like this", `organisms/segmented-control`,
 * read from its source). One implementation: every in-page tab row is this.
 *
 * - **A pill track with a thumb that slides along it.** The track is
 *   translucent (`segmentTrack`), the thumb solid (`segmentThumb`) with the
 *   reference's small shadow; on a game's page both come from its M3 scheme.
 *   The chosen label is the bright ink, the others the quiet one, so the
 *   choice survives without colour.
 * - **The thumb springs** on reacticx's overdamped spring to the chosen
 *   segment, and **a tap swells it** to 1.3 and lets it wobble back.
 * - **Drag along it to scrub** — the thumb grows, and the tab under the
 *   finger is chosen as it passes. Only when the row fits: a row that
 *   scrolls gives a sideways drag to the scroll.
 * - **Hairlines between segments**, faded out beside the thumb.
 *
 * Two departures, each forced by this app rather than chosen:
 *
 * - **Segments are as wide as their words, sharing the slack.** reacticx's
 *   are equal, which needs every label to fit a sixth of a phone; Search has
 *   six scopes and "Collections" does not. When the row is wider than the
 *   screen it scrolls, the track with it, and the chosen tab is kept in view.
 * - **No blur flash on a tap.** reacticx sweeps an `expo-blur` view over the
 *   control; on Android a blur needs the page as its target, which a control
 *   inside the page cannot have (CLAUDE.md, gotchas), and would be a grey slab.
 *
 * It replaced SimpMusic's outlined chips with a poured `primary` fill
 * (2026-10-15 to 2026-11-02), so `<TabBar>` no longer pours (`<PaintFill>`).
 */
export function TabBar<T extends string>({
  tabs,
  value,
  onChange,
  label,
  iconOnly = false,
  align = 'start',
  inset,
}: TabBarProps<T>) {
  const theme = useTheme();
  const accent = useAccent();
  const reduceMotion = useReducedMotion();
  const pulse = usePulse();
  const scroller = useRef<ScrollView>(null);

  const { m3, tonal } = accent;
  const track = tonal ? withAlpha(m3.onSurface, 0.08) : theme.segmentTrack;
  const thumb = tonal ? m3.secondaryContainer : theme.segmentThumb;
  const onInk = tonal ? m3.onSecondaryContainer : theme.text;
  const offInk = tonal ? m3.onSurfaceVariant : theme.textSecondary;

  const spread = align === 'spread' && !iconOnly;
  const margin = inset ?? Spacing.x16;
  const selected = Math.max(
    0,
    tabs.findIndex((tab) => tab.key === value)
  );

  /* Where each segment is, measured — the thumb goes to the chosen one. */
  const [segments, setSegments] = useState<Record<number, Segment>>({});
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);
  const overflows = content > viewport + 1;

  const segmentsUi = useSharedValue<Segment[]>([]);
  const thumbX = useSharedValue(0);
  const thumbW = useSharedValue(0);
  const thumbScale = useSharedValue(1);
  const placed = useSharedValue(false);
  const scrubbing = useSharedValue(false);

  const target = segments[selected];

  useEffect(() => {
    if (!target) return;
    if (!placed.get() || reduceMotion) {
      thumbX.set(target.x);
      thumbW.set(target.width);
      placed.set(true);
    } else {
      thumbX.set(withSpring(target.x, THUMB_SPRING));
      thumbW.set(withSpring(target.width, THUMB_SPRING));
    }
    /* Keep the chosen tab in view on a row that scrolls. */
    if (overflows) {
      scroller.current?.scrollTo({ x: Math.max(0, target.x - margin), animated: !reduceMotion });
    }
  }, [target, reduceMotion, overflows, margin, placed, thumbX, thumbW]);

  const thumbStyle = useAnimatedStyle(() => {
    /* Read so a render re-applies the settled pose (`usePulse`). */
    pulse.get();
    return {
      opacity: placed.get() ? 1 : 0,
      width: thumbW.get(),
      transform: [{ translateX: thumbX.get() }, { scale: thumbScale.get() }],
    };
  });

  /*
   * The measurements are kept in a ref as they arrive and copied into state
   * and the UI thread from the layout event itself. Never inside a `setState`
   * updater: React runs updaters while it renders, and writing a shared value
   * there is Reanimated's "Writing to `value` during component render" — what
   * the first build logged on every tab press.
   */
  const measured = useRef<Record<number, Segment>>({});

  function measure(index: number, event: LayoutChangeEvent) {
    const { x, width } = event.nativeEvent.layout;
    const was = measured.current[index];
    if (was && was.x === x && was.width === width) return;
    const next = { ...measured.current, [index]: { x, width } };
    measured.current = next;
    segmentsUi.set(tabs.map((_, i) => next[i] ?? { x: 0, width: 0 }));
    setSegments(next);
  }

  function tick(style: Haptics.ImpactFeedbackStyle) {
    /* iOS only: Android's generic buzz reads as an error (the app's rule). */
    if (Platform.OS === 'ios') Haptics.impactAsync(style).catch(() => {});
  }

  function press(index: number) {
    const tab = tabs[index];
    if (!tab) return;
    if (tab.key !== value) onChange(tab.key);
    if (!reduceMotion) {
      thumbScale.set(
        withSequence(withTiming(POP_SCALE, { duration: POP_MS }), withSpring(1, POP_RETURN))
      );
    }
    tick(Haptics.ImpactFeedbackStyle.Medium);
  }

  function scrubTo(index: number) {
    const tab = tabs[index];
    if (!tab || tab.key === value) return;
    onChange(tab.key);
    tick(Haptics.ImpactFeedbackStyle.Rigid);
  }

  /*
   * reacticx's scrub. Horizontal only (`activeOffsetX` and `failOffsetY`, not
   * its `minDistance`): the row usually sits in a page that scrolls
   * vertically, and a drag down the page must stay the page's.
   */
  const scrub = Gesture.Pan()
    .enabled(!overflows && tabs.length > 1)
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onStart(() => {
      'worklet';
      scrubbing.set(true);
      if (!reduceMotion) thumbScale.set(withSpring(SCRUB_SCALE, { stiffness: 300, damping: 15 }));
    })
    .onUpdate((event) => {
      'worklet';
      const list = segmentsUi.get();
      /* Segments are measured in the track's own box, as the finger is. */
      const x = event.x;
      let index = list.length - 1;
      for (let i = 0; i < list.length; i++) {
        if (x < list[i].x + list[i].width) {
          index = i;
          break;
        }
      }
      if (index !== selected) runOnJS(scrubTo)(Math.max(0, index));
    })
    .onFinalize(() => {
      'worklet';
      scrubbing.set(false);
      thumbScale.set(withSpring(1, { stiffness: 200, damping: 20 }));
    });

  const items = tabs.map((tab, index) => {
    const active = index === selected;
    const showCount = tab.count != null && tab.count > 0;
    const ink = active ? onInk : offInk;
    /* A hairline after this segment, gone beside the thumb (reacticx's `AnimatedDivider`). */
    const divider = index < tabs.length - 1;
    const dividerOn = index !== selected && index !== selected - 1;

    return (
      <View key={tab.key} style={styles.cell} onLayout={(event) => measure(index, event)}>
        <PressableScale
          accessibilityRole="tab"
          accessibilityState={{ selected: active }}
          accessibilityLabel={showCount ? `${tab.label}, ${tab.count}` : tab.label}
          accessibilityHint={`${index + 1} of ${tabs.length}`}
          onPress={() => press(index)}
          scaleTo={0.96}
          focusRing={accent.ring}
          style={StyleSheet.flatten([
            styles.segment,
            spread && styles.segmentSpread,
            iconOnly && styles.segmentIcon,
          ])}>
          {tab.icon && <PaintGlyph name={tab.icon} size={iconOnly ? 22 : 15} color={ink} />}

          {!iconOnly && (
            <Animated.Text
              style={[
                Type.tab,
                spread && styles.labelSpread,
                { color: ink },
                inkTransition(reduceMotion),
              ]}
              numberOfLines={1}>
              {tab.label}
            </Animated.Text>
          )}

          {!iconOnly &&
            showCount &&
            (tab.alert ? (
              <View style={[styles.badge, { backgroundColor: theme.danger }]}>
                {/* Dark on the red, 5.74:1; white is 3.36:1. */}
                <Text variant="caption" style={{ color: readableInk(theme.danger) }}>
                  {tab.count! > 99 ? '99+' : tab.count}
                </Text>
              </View>
            ) : (
              <Text variant="caption" style={[styles.count, { color: withAlpha(ink, 0.72) }]}>
                {tab.count}
              </Text>
            ))}
        </PressableScale>
        {divider && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.divider,
              {
                backgroundColor: withAlpha(offInk, 0.28),
                opacity: dividerOn ? 1 : 0,
                transitionProperty: 'opacity',
                transitionDuration: reduceMotion ? 0 : 200,
              },
            ]}
          />
        )}
      </View>
    );
  });

  return (
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      scrollEnabled={overflows}
      /* **Never let this grow** — a horizontal `ScrollView` is `flexGrow: 1`
         and in a column took half the screen (CLAUDE.md § Gotchas). */
      style={styles.scroller}
      /* A tab is tapped with a keyboard up on Search. */
      keyboardShouldPersistTaps="handled"
      accessibilityRole="tablist"
      accessibilityLabel={label}
      onLayout={(event) => setViewport(event.nativeEvent.layout.width)}
      onContentSizeChange={(width) => setContent(width)}
      contentContainerStyle={[styles.content, { paddingHorizontal: margin }]}>
      <GestureDetector gesture={scrub}>
        <View
          style={[
            styles.track,
            { backgroundColor: track, borderRadius: Radius.pill, padding: TRACK_PAD },
          ]}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.thumb,
              {
                top: TRACK_PAD,
                bottom: TRACK_PAD,
                /* A segment's x is measured from the track's edge, padding included. */
                left: 0,
                backgroundColor: thumb,
                borderRadius: Radius.pill,
              },
              thumbStyle,
            ]}
          />
          {items}
        </View>
      </GestureDetector>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroller: { flexGrow: 0 },
  /* At least the viewport, so a row that fits spans it and one that does not scrolls. */
  content: { flexGrow: 1, paddingVertical: Spacing.x8 },
  track: { flexGrow: 1, flexDirection: 'row', alignItems: 'stretch' },
  /* reacticx's `SHADOW` (0 2 2.62, black 23%) as a box shadow: elevation would
     lift the thumb over the labels on Android. */
  thumb: {
    position: 'absolute',
    boxShadow: '0px 2px 2.62px rgba(0, 0, 0, 0.23)',
  },
  /* Every cell grows by the same share of the slack, from its own word's width. */
  cell: { flexGrow: 1, justifyContent: 'center' },
  segment: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x8,
    /* reacticx's demo: 8.5 above and below, 5 at the sides — wider here,
       because these segments are as wide as their words. */
    paddingVertical: 8.5,
    paddingHorizontal: Spacing.x12,
    minHeight: 36,
  },
  segmentSpread: { minHeight: 40, paddingVertical: Spacing.x8 },
  segmentIcon: { minHeight: TapTarget - TRACK_PAD * 2, paddingHorizontal: Spacing.x8 },
  labelSpread: { fontSize: 15, lineHeight: 20 },
  /* On the cell's trailing edge, out of the layout, so a cell is its segment. */
  divider: {
    position: 'absolute',
    right: 0,
    top: '25%',
    bottom: '25%',
    width: StyleSheet.hairlineWidth * 2,
  },
  count: { letterSpacing: 0.3 },
  badge: {
    minWidth: 18,
    paddingHorizontal: Spacing.x4,
    paddingVertical: 1,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
