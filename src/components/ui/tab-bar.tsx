import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

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
   * draw the same thing — the bar always spans its row.
   */
  align?: 'start' | 'center' | 'spread';
  /**
   * How far in from the screen's edge the track starts and ends, when the
   * screen does not keep the app's 15 (the profile's `PROFILE_MARGIN`).
   */
  inset?: number;
};

type Box = { x: number; width: number };

/** reacticx's `PILL_SPRING`: the pill gliding to a tab. */
const PILL_SPRING = { damping: 30, stiffness: 150, mass: 0.5 } as const;
/** …and its press: the pill swelling by `PRESS_GROW` either side while held. */
const PRESS_SPRING = { damping: 20, stiffness: 150, mass: 1 } as const;
const PRESS_GROW = 4;
/** The pill following a finger that has it: reacticx's follow spring, 220 / 24. */
const FOLLOW_SPRING = { stiffness: 220, damping: 24, mass: 1 } as const;

/** Between the track's edge and the pill — reacticx's 5. */
const TRACK_PAD = 5;

/**
 * The app's tabs — reacticx's masked tab bar (the owner's, 2026-11-04:
 * "Replace the tabs in the app with this one", `organisms/masked-tab-bar`,
 * MIT, read from its source). One implementation: every in-page tab row is
 * this.
 *
 * **The row is drawn twice.** Once on the track, in the quiet ink; and again
 * inside the pill, in the pill's own ink, shifted back by exactly as far as
 * the pill has moved — so the pill is a window that shows the words in their
 * chosen colour wherever it is, and as it slides from one tab to the next
 * the words change colour *under its edge*, letter by letter, rather than all
 * at once. Both copies are laid out by the same row at the same width, so
 * they line up to the pixel.
 *
 * - **A tap** glides the pill to that tab (`PILL_SPRING`), and **a press
 *   swells it** a little either side while the finger is down.
 * - **Drag the pill** and it follows the finger on a spring, narrowing or
 *   widening to whichever tab it is over, and settles on the nearest when
 *   let go. Only along a row that fits: one wider than the phone scrolls,
 *   and a sideways drag is the scroll's.
 * - The pill is white with near-black words (`segmentPill`, the demo's), on
 *   the translucent track; on a game's page, its Material 3 `primary` and
 *   `onPrimary`, so the chosen tab is the game's colour.
 *
 * Two departures, as with the control before it: tabs are as wide as their
 * words, sharing the slack (Search's six scopes do not fit equal sixths), and
 * a vertical drag over the row is always the page's — the drag is horizontal
 * only (`activeOffsetX`, `failOffsetY`), where reacticx's starts on touch.
 *
 * It replaced reacticx's segmented control (2026-11-02 to 2026-11-04).
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
  const pill = tonal ? m3.primary : theme.segmentPill;
  const onInk = tonal ? m3.onPrimary : theme.segmentPillInk;
  const offInk = tonal ? m3.onSurfaceVariant : theme.textSecondary;

  const spread = align === 'spread' && !iconOnly;
  const margin = inset ?? Spacing.x16;
  const selected = Math.max(
    0,
    tabs.findIndex((tab) => tab.key === value)
  );

  /* Where each tab is in the row, measured — the pill goes to the chosen one. */
  const [boxes, setBoxes] = useState<Record<number, Box>>({});
  const [rowWidth, setRowWidth] = useState(0);
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);
  const overflows = content > viewport + 1;

  const boxesUi = useSharedValue<Box[]>([]);
  const rowWidthUi = useSharedValue(0);
  const pillX = useSharedValue(0);
  const pillW = useSharedValue(0);
  const press = useSharedValue(0);
  const grabbed = useSharedValue(false);
  const grabOffset = useSharedValue(0);
  const hovered = useSharedValue(-1);
  const placed = useSharedValue(false);

  const target = boxes[selected];

  useEffect(() => {
    if (!target) return;
    if (grabbed.get()) return;
    if (!placed.get() || reduceMotion) {
      pillX.set(target.x);
      pillW.set(target.width);
      placed.set(true);
    } else {
      pillX.set(withSpring(target.x, PILL_SPRING));
      pillW.set(withSpring(target.width, PILL_SPRING));
    }
    /* Keep the chosen tab in view on a row that scrolls. */
    if (overflows) {
      scroller.current?.scrollTo({ x: Math.max(0, target.x - margin), animated: !reduceMotion });
    }
  }, [target, reduceMotion, overflows, margin, placed, grabbed, pillX, pillW]);

  /* The window: the pill, swelling while pressed. */
  const clipStyle = useAnimatedStyle(() => {
    /* Read so a render re-applies the settled pose (`usePulse`). */
    pulse.get();
    const grow = press.get() * PRESS_GROW;
    return {
      opacity: placed.get() ? 1 : 0,
      width: pillW.get() + grow * 2,
      transform: [{ translateX: pillX.get() - grow }],
    };
  });
  /* The row inside it, shifted back so its words stand where the track's do. */
  const innerStyle = useAnimatedStyle(() => {
    pulse.get();
    const grow = press.get() * PRESS_GROW;
    return { transform: [{ translateX: -(pillX.get() - grow) }] };
  });

  /*
   * The measurements are kept in a ref as they arrive and copied into state
   * and the UI thread from the layout event itself. Never inside a `setState`
   * updater: React runs updaters while it renders, and writing a shared value
   * there is Reanimated's "Writing to `value` during component render".
   */
  const measured = useRef<Record<number, Box>>({});

  function measure(index: number, event: LayoutChangeEvent) {
    const { x, width } = event.nativeEvent.layout;
    const was = measured.current[index];
    if (was && Math.abs(was.x - x) < 0.5 && Math.abs(was.width - width) < 0.5) return;
    const next = { ...measured.current, [index]: { x, width } };
    measured.current = next;
    boxesUi.set(tabs.map((_, i) => next[i] ?? { x: 0, width: 0 }));
    setBoxes(next);
  }

  function measureRow(event: LayoutChangeEvent) {
    const width = event.nativeEvent.layout.width;
    rowWidthUi.set(width);
    setRowWidth(width);
  }

  function tick(style: Haptics.ImpactFeedbackStyle) {
    /* iOS only: Android's generic buzz reads as an error (the app's rule). */
    if (Platform.OS === 'ios') Haptics.impactAsync(style).catch(() => {});
  }

  function choose(index: number) {
    const tab = tabs[index];
    if (!tab) return;
    if (tab.key !== value) {
      onChange(tab.key);
      tick(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  /** Let go of a drag: the pill settles on the tab it is nearest. */
  function settle(index: number) {
    const box = boxes[index];
    if (box) {
      pillX.set(reduceMotion ? box.x : withSpring(box.x, PILL_SPRING));
      pillW.set(reduceMotion ? box.width : withSpring(box.width, PILL_SPRING));
    }
    choose(index);
  }

  /*
   * A tap: the pill swells while the finger is down, and glides to the tab
   * under it. `onBegin` swells it, so a press answers at once.
   */
  const tap = Gesture.Tap()
    .maxDistance(12)
    .onBegin(() => {
      'worklet';
      if (!reduceMotion) press.set(withSpring(1, PRESS_SPRING));
    })
    .onEnd((event) => {
      'worklet';
      const list = boxesUi.get();
      for (let i = 0; i < list.length; i++) {
        if (event.x >= list[i].x && event.x <= list[i].x + list[i].width) {
          runOnJS(choose)(i);
          break;
        }
      }
    })
    .onFinalize(() => {
      'worklet';
      press.set(withSpring(0, PRESS_SPRING));
    });

  /* A drag of the pill: horizontal only, so a drag down the page stays the page's. */
  const drag = Gesture.Pan()
    .enabled(!overflows && tabs.length > 1)
    .activeOffsetX([-8, 8])
    .failOffsetY([-10, 10])
    .onStart((event) => {
      'worklet';
      grabbed.set(true);
      hovered.set(-1);
      if (!reduceMotion) press.set(withSpring(1, PRESS_SPRING));
      /* Grabbed where the finger is: on the pill, by its own offset; off it,
         by its middle, so it jumps under the finger and carries on. */
      const x = event.x - event.translationX;
      const inside = x >= pillX.get() && x <= pillX.get() + pillW.get();
      grabOffset.set(inside ? pillX.get() - x : -pillW.get() / 2);
    })
    .onUpdate((event) => {
      'worklet';
      const list = boxesUi.get();
      const span = Math.max(0, rowWidthUi.get() - pillW.get());
      const to = Math.min(span, Math.max(0, event.x + grabOffset.get()));
      pillX.set(reduceMotion ? to : withSpring(to, FOLLOW_SPRING));
      /* Narrow or widen to whichever tab the pill's middle is over. */
      const middle = to + pillW.get() / 2;
      let nearest = -1;
      let best = Number.MAX_VALUE;
      for (let i = 0; i < list.length; i++) {
        const distance = Math.abs(list[i].x + list[i].width / 2 - middle);
        if (distance < best) {
          best = distance;
          nearest = i;
        }
      }
      if (nearest >= 0 && nearest !== hovered.get()) {
        hovered.set(nearest);
        pillW.set(
          reduceMotion ? list[nearest].width : withSpring(list[nearest].width, PILL_SPRING)
        );
      }
    })
    .onFinalize(() => {
      'worklet';
      press.set(withSpring(0, PRESS_SPRING));
      if (!grabbed.get()) return;
      grabbed.set(false);
      const list = boxesUi.get();
      const middle = pillX.get() + pillW.get() / 2;
      let nearest = -1;
      let best = Number.MAX_VALUE;
      for (let i = 0; i < list.length; i++) {
        const distance = Math.abs(list[i].x + list[i].width / 2 - middle);
        if (distance < best) {
          best = distance;
          nearest = i;
        }
      }
      if (nearest >= 0) runOnJS(settle)(nearest);
    });

  const gesture = Gesture.Race(drag, tap);

  /** One tab's words: the same in both copies, only the ink differs. */
  function cell(tab: TabItem<T>, ink: string): ReactNode {
    const showCount = tab.count != null && tab.count > 0;
    return (
      <>
        {tab.icon && <Ionicons name={tab.icon} size={iconOnly ? 22 : 15} color={ink} />}
        {!iconOnly && (
          <Text style={[Type.tab, spread && styles.labelSpread, { color: ink }]} numberOfLines={1}>
            {tab.label}
          </Text>
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
      </>
    );
  }

  const cellStyle = StyleSheet.flatten([
    styles.cell,
    spread && styles.cellSpread,
    iconOnly && styles.cellIcon,
  ]);

  /* The track's copy: measured, and what a screen reader reads. */
  const base = tabs.map((tab, index) => {
    const active = index === selected;
    const showCount = tab.count != null && tab.count > 0;
    return (
      <View
        key={tab.key}
        style={cellStyle}
        onLayout={(event) => measure(index, event)}
        accessible
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={showCount ? `${tab.label}, ${tab.count}` : tab.label}
        accessibilityHint={`${index + 1} of ${tabs.length}`}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={() => choose(index)}>
        {cell(tab, offInk)}
      </View>
    );
  });

  /* The pill's copy: the same row, in the chosen ink, never touched or read. */
  const lit = tabs.map((tab) => (
    <View key={tab.key} style={cellStyle}>
      {cell(tab, onInk)}
    </View>
  ));

  const radius = Radius.pill;

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
      <View
        style={[
          styles.track,
          { backgroundColor: track, borderRadius: radius, padding: TRACK_PAD },
        ]}>
        <GestureDetector gesture={gesture}>
          <View style={styles.list} onLayout={measureRow}>
            <View style={styles.row}>{base}</View>

            <Animated.View
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.clip, { backgroundColor: pill, borderRadius: radius }, clipStyle]}>
              <Animated.View style={[styles.row, { width: rowWidth }, innerStyle]}>
                {lit}
              </Animated.View>
            </Animated.View>
          </View>
        </GestureDetector>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroller: { flexGrow: 0 },
  /* At least the viewport, so a row that fits spans it and one that does not scrolls. */
  content: { flexGrow: 1, paddingVertical: Spacing.x8 },
  track: { flexGrow: 1, overflow: 'hidden' },
  list: { flexGrow: 1, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  /* The pill: as tall as the row, moved and sized on the UI thread. */
  clip: { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden' },
  /* Every tab grows by the same share of the slack, from its own words' width. */
  cell: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x8,
    paddingHorizontal: 14,
    minHeight: 34,
  },
  cellSpread: { minHeight: 38 },
  cellIcon: { minHeight: TapTarget - TRACK_PAD * 2, paddingHorizontal: Spacing.x8 },
  labelSpread: { fontSize: 15, lineHeight: 20 },
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
