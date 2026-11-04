import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, { css, cubicBezier, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface, useLiquidGlass } from '@/components/ui/liquid-glass';
import { PressableScale } from '@/components/ui/pressable-scale';
import { useSelectable } from '@/components/ui/selectable';
import { Text } from '@/components/ui/text';
import { ControlHeight, Elevation, Motion, Radius, Spacing, TapTarget } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import { filledRoles } from '@/lib/filled';

type IconName = keyof typeof Ionicons.glyphMap;

export type DropdownOption<T extends string> = {
  value: T;
  /** The full name, as the menu lists it — "PlayStation 5". */
  label: string;
  /** What the button shows once this is chosen — "PS5". The label when absent. */
  short?: string;
  icon?: IconName;
};

export type DropdownButtonProps<T extends string> = {
  /** What is being chosen, for a screen reader: "Platform". */
  label: string;
  value: T;
  options: readonly DropdownOption<T>[];
  onChange: (value: T) => void;
  /**
   * `small` is the chip's 32, for a control that sits at the far end of a
   * heading's line (a panel's period) and must not make that line taller than
   * its neighbours'. It centres itself in the row it is in.
   */
  size?: 'medium' | 'small';
  /**
   * Filled with the game's colour, its words, glyph and chevron in the fill's
   * own `onPrimary` (`filledRoles`) — the game page's platform pill, at the
   * owner's direction (2026-10-17), so it matches the review button. Every
   * other dropdown stays outlined: a choice is outlined (DESIGN.md § 9.4).
   */
  filled?: boolean;
};

/**
 * Drawn at the icon key's 40.
 *
 * The reference draws this control as a 56dp outlined text field
 * (`DropdownButton.kt`), alone on a row under the chart's heading. Here it sits
 * in a column beside a box, and at 56 it would outweigh the title above it.
 * 40 sits between the 32 chip and the 52 action — tall enough to read as the
 * one thing in its section you can press — and slop takes it to the floor.
 */
const BUTTON_HEIGHT = 40;

/** A menu row is the platform floor plus a breath, as the collection menu's are. */
const ROW_HEIGHT = TapTarget + Spacing.x4;
/** The menu's own inset around its rows, so their rounded ends show. */
const MENU_PAD = Spacing.x8;
/**
 * Wide enough for the longest name a row carries ("PlayStation Portable",
 * its glyph and the check) without truncating; never narrower than the
 * button. Material's own menus run 112–280.
 */
const MENU_WIDTH = 240;
/**
 * Six rows and half of a seventh before the menu scrolls. The half row is the
 * affordance: a list that ends flush on a row boundary looks complete.
 */
const VISIBLE_ROWS = 6.5;
/** Between the button and the menu that opens from it. */
const MENU_GAP = Spacing.x4;
/** The menu never comes closer than the page margin to a screen edge. */
const EDGE = Spacing.x16;
const HAIRLINE = StyleSheet.hairlineWidth;

const ENTER_MS = Motion.normal;
const EXIT_MS = 110;
/** Exponential ease-out: the menu is most of the way open before the eye arrives. */
const EASE_OUT = cubicBezier(0.16, 1, 0.3, 1);

/*
 * CSS keyframes rather than a shared value, so the resting pose is a plain
 * style React holds. An animated style keeps its *first* frame in React's
 * props and can lose its settled value to a stalled JS thread (CLAUDE.md §
 * Gotchas) — and a menu's first frame is invisible. These run *toward* the
 * base style, so whatever happens, what React re-renders is the open menu.
 */
const GROW = css.keyframes({
  from: { opacity: 0, transform: [{ translateY: -6 }, { scale: 0.92 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
});
const GROW_UP = css.keyframes({
  from: { opacity: 0, transform: [{ translateY: 6 }, { scale: 0.92 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
});
const SHRINK = css.keyframes({
  from: { opacity: 1, transform: [{ scale: 1 }] },
  to: { opacity: 0, transform: [{ scale: 0.96 }] },
});
/* Reduce Motion: the same open and close, without the movement. */
const FADE_IN = css.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
const FADE_OUT = css.keyframes({ from: { opacity: 1 }, to: { opacity: 0 } });

type Rect = { x: number; y: number; width: number; height: number };
type Phase = 'closed' | 'open' | 'closing';

/**
 * One choice from a short list, shown as the choice itself — SimpMusic's
 * `DropdownButton`, which its Home screen uses to pick a chart's country.
 *
 * **The button is a choice, so it is outlined** (DESIGN.md § 9.4): no fill, a
 * 1px `outline`, and the current value in full ink with its glyph — the
 * reference's own reading, which draws its dropdown as an outlined field with a
 * transparent container. The chevron turns over while the menu is open, as the
 * reference's `TrailingIcon` does, and the edge lights in the accent, as a field
 * does while it has focus.
 *
 * **The menu opens from the button**, not from the bottom of the screen: it is
 * anchored to the button's left edge, at least as wide, below it — or above
 * when the screen has more room there — and grows out of the button's centre.
 * Rows carry the full name ("PlayStation 5") where the button carries the short
 * one; the current row takes the app's selected state and a check. Choosing
 * closes it. So does a tap anywhere else, or Back.
 *
 * **One option is a fact, not a control.** With nothing to switch to, the
 * value is drawn as a metadata chip — grey, no edge, no chevron — because an
 * outlined pill that opens a one-row menu promises a choice that is not there.
 */
export function DropdownButton<T extends string>({
  label,
  value,
  options,
  onChange,
  size = 'medium',
  filled = false,
}: DropdownButtonProps<T>) {
  const theme = useTheme();
  const liquid = useLiquidGlass();
  const accent = useAccent();
  const selectable = useSelectable();
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const triggerRef = useRef<View>(null);
  const listRef = useRef<ScrollView>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [phase, setPhase] = useState<Phase>('closed');
  /** Where the button is on screen, taken when the menu opens. */
  const [anchor, setAnchor] = useState<Rect | null>(null);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    []
  );

  const current = options.find((option) => option.value === value) ?? options[0];
  if (!current) return null;

  if (options.length < 2) {
    return (
      <View
        accessible
        accessibilityLabel={`${label}: ${current.label}`}
        style={[styles.fact, { backgroundColor: accent.elevated }]}>
        {current.icon && <Ionicons name={current.icon} size={14} color={accent.quietInk} />}
        <Text variant="bodySmall" numberOfLines={1} style={{ color: accent.quietInk }}>
          {current.short ?? current.label}
        </Text>
      </View>
    );
  }

  const open = phase === 'open';
  const small = size === 'small';
  const fill = filled ? filledRoles(accent) : null;
  const ink = fill ? fill.ink : theme.text;
  const reach = Math.max(0, (TapTarget - (small ? ControlHeight.small : BUTTON_HEIGHT)) / 2);

  function openMenu() {
    if (phase !== 'closed') return;
    /* Measured at the moment of opening, not on layout: the button lives in a
       scrolling page, so where it was when it mounted is not where it is now. */
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setPhase('open');
    });
  }

  function closeMenu() {
    if (phase !== 'open') return;
    setPhase('closing');
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      setPhase('closed');
      setAnchor(null);
    }, EXIT_MS);
  }

  function choose(next: T) {
    if (next !== value) onChange(next);
    closeMenu();
  }

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );

  /*
   * The menu's whole geometry, computed rather than measured: every row is
   * `ROW_HEIGHT` and the width is fixed, so there is no unseen first pass to
   * lay it out and no frame where it sits in the wrong place.
   */
  let menu: {
    top: number;
    left: number;
    width: number;
    listHeight: number;
    above: boolean;
  } | null = null;
  if (anchor) {
    const roomBelow = windowHeight - insets.bottom - EDGE - (anchor.y + anchor.height + MENU_GAP);
    const roomAbove = anchor.y - MENU_GAP - insets.top - EDGE;
    const full = options.length * ROW_HEIGHT + MENU_PAD * 2;
    const capped = Math.min(full, ROW_HEIGHT * VISIBLE_ROWS + MENU_PAD * 2);
    /* Below, unless it does not fit there and the room above is larger. */
    const above = capped > roomBelow && roomAbove > roomBelow;
    const room = above ? roomAbove : roomBelow;
    const listHeight = Math.max(ROW_HEIGHT + MENU_PAD * 2, Math.min(capped, room));
    const height = listHeight + HAIRLINE * 2;
    const width = Math.min(windowWidth - EDGE * 2, Math.max(anchor.width, MENU_WIDTH));
    menu = {
      above,
      listHeight,
      width,
      top: above ? anchor.y - MENU_GAP - height : anchor.y + anchor.height + MENU_GAP,
      left: Math.max(EDGE, Math.min(anchor.x, windowWidth - EDGE - width)),
    };
  }

  /* A long list opens on the current row, not on the first. */
  function onListLayout(event: LayoutChangeEvent) {
    const visible = event.nativeEvent.layout.height;
    const rowTop = MENU_PAD + selectedIndex * ROW_HEIGHT;
    if (rowTop + ROW_HEIGHT > visible) {
      listRef.current?.scrollTo({ y: rowTop - (visible - ROW_HEIGHT) / 2, animated: false });
    }
  }

  const motion =
    phase === 'closing'
      ? {
          animationName: reduceMotion ? FADE_OUT : SHRINK,
          animationDuration: EXIT_MS,
          animationFillMode: 'forwards' as const,
        }
      : {
          animationName: reduceMotion ? FADE_IN : menu?.above ? GROW_UP : GROW,
          animationDuration: ENTER_MS,
          animationTimingFunction: EASE_OUT,
        };

  return (
    <>
      {/* A plain view to measure: `PressableScale` does not forward a ref, and
          Android drops a layout-only view unless it is told not to. */}
      <View ref={triggerRef} collapsable={false} style={small ? styles.anchorSmall : styles.anchor}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${current.label}`}
          accessibilityHint={`Opens a list of ${options.length} choices`}
          accessibilityState={{ expanded: open }}
          hitSlop={{ top: reach, bottom: reach }}
          onPress={openMenu}
          scaleTo={0.97}
          pressedColor={fill ? fill.pressed : selectable(false).pressedColor}
          focusRing={accent.ring}
          style={StyleSheet.flatten([
            styles.button,
            small && styles.buttonSmall,
            liquid
              ? { borderColor: 'transparent' }
              : fill
                ? { backgroundColor: fill.fill, borderColor: fill.fill }
                : { borderColor: open ? accent.edge : theme.outline },
          ])}>
          {liquid && <GlassSurface radius={Radius.pill} flat />}
          {current.icon && <Ionicons name={current.icon} size={16} color={ink} />}
          <Text variant="button" numberOfLines={1} style={{ color: ink }}>
            {current.short ?? current.label}
          </Text>
          {/* A CSS transition, whose target is a React prop: the chevron can
              never be left pointing the wrong way by a dropped frame. */}
          <Animated.View
            style={[
              styles.chevron,
              {
                transform: [{ rotate: open ? '180deg' : '0deg' }],
                transitionDuration: reduceMotion ? 0 : Motion.fast,
              },
            ]}>
            <Ionicons name="chevron-down" size={16} color={fill ? fill.ink : accent.quietInk} />
          </Animated.View>
        </PressableScale>
      </View>

      <Modal
        visible={phase !== 'closed'}
        transparent
        animationType="none"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={closeMenu}>
        {/* No scrim: a menu does not dim the page it belongs to. The empty
            screen around it still catches the tap that closes it. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
          onPress={closeMenu}
        />

        {anchor && menu && (
          <Animated.View
            accessibilityViewIsModal
            pointerEvents={open ? 'auto' : 'none'}
            style={[
              styles.menu,
              Elevation.overlay,
              {
                top: menu.top,
                left: menu.left,
                width: menu.width,
                backgroundColor: liquid ? 'transparent' : accent.m3.surfaceContainerHigh,
                borderColor: liquid ? 'transparent' : accent.m3.outlineVariant,
                /* Grow out of the button: its centre, on the edge the menu
                   meets it at. */
                transformOrigin: [
                  anchor.x + anchor.width / 2 - menu.left,
                  menu.above ? menu.listHeight : 0,
                  0,
                ],
              },
              motion,
            ]}>
            {liquid && <GlassSurface radius={Radius.sheet} />}
            {/* The clip is a child, not the menu itself: on iOS a view that
                clips its children also clips its own shadow. */}
            <View style={styles.clip}>
              <ScrollView
                ref={listRef}
                style={{ height: menu.listHeight }}
                contentContainerStyle={styles.list}
                onLayout={onListLayout}
                showsVerticalScrollIndicator={options.length > VISIBLE_ROWS}
                bounces={false}>
                {options.map((option) => {
                  const chosen = option.value === value;
                  const look = selectable(chosen);
                  return (
                    <PressableScale
                      key={option.value}
                      accessibilityRole="menuitem"
                      accessibilityLabel={option.label}
                      accessibilityState={{ selected: chosen }}
                      onPress={() => choose(option.value)}
                      scaleTo={0.98}
                      pressedColor={look.pressedColor}
                      style={StyleSheet.flatten([
                        styles.row,
                        /* The selected state is the hook's — wash and edge —
                           and a resting row is flat: a menu of outlined rows
                           reads as a stack of buttons. */
                        chosen ? look.style : styles.rowRest,
                      ])}>
                      {option.icon && (
                        <Ionicons
                          name={option.icon}
                          size={18}
                          color={chosen ? theme.text : accent.quietInk}
                        />
                      )}
                      <Text
                        variant="optionTitle"
                        numberOfLines={1}
                        style={[styles.rowLabel, { color: chosen ? theme.text : accent.quietInk }]}>
                        {option.label}
                      </Text>
                      {chosen && <Ionicons name="checkmark" size={18} color={accent.onSurface} />}
                    </PressableScale>
                  );
                })}
              </ScrollView>
            </View>
          </Animated.View>
        )}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  /* The button is as wide as what it says, as the reference's
     `wrapContentWidth` is — never the column's width. */
  anchor: { alignSelf: 'flex-start' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    height: BUTTON_HEIGHT,
    paddingLeft: Spacing.x16,
    paddingRight: Spacing.x12,
    borderRadius: Radius.pill,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  /* In a heading's row: on the row's midline, and the chip's height and sides. */
  anchorSmall: { alignSelf: 'center' },
  buttonSmall: {
    height: ControlHeight.small,
    paddingLeft: Spacing.x12,
    paddingRight: Spacing.x8,
    gap: Spacing.x4,
  },
  chevron: { transitionProperty: 'transform', transitionTimingFunction: 'ease-out' },
  /* The metadata chip, at the chip's size: a fact cannot be pressed, so it
     has no edge (DESIGN.md § 12). */
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.x8,
    height: ControlHeight.small,
    paddingHorizontal: Spacing.x12,
    borderRadius: Radius.pill,
  },
  /* `Radius.sheet`, the menu corner (DESIGN.md § 9.5): the rows' 16 plus the
     8 they are inset by, so the two curves run parallel. */
  menu: {
    position: 'absolute',
    borderRadius: Radius.sheet,
    borderWidth: HAIRLINE,
  },
  clip: { borderRadius: Radius.sheet, overflow: 'hidden' },
  list: { padding: MENU_PAD },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    height: ROW_HEIGHT,
    paddingHorizontal: Spacing.x12,
    borderRadius: Radius.card,
    borderWidth: 1,
  },
  rowRest: { backgroundColor: 'transparent', borderColor: 'transparent' },
  rowLabel: { flexShrink: 1 },
});
