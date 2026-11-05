import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { css, cubicBezier, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface, useLiquidGlass } from '@/components/ui/liquid-glass';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Elevation, Motion, Radius, Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';

type IconName = keyof typeof Ionicons.glyphMap;
type Rect = { x: number; y: number; width: number; height: number };
type Phase = 'closed' | 'open' | 'closing';

const ENTER_MS = Motion.normal;
const EXIT_MS = 110;
const EASE_OUT = cubicBezier(0.16, 1, 0.3, 1);
/** From the trigger to the menu, and from the menu to the screen's edge. */
const GAP = Spacing.x4;
const EDGE = Spacing.x8;

/* Keyframes that run toward the base style, as `<DropdownButton>`'s do: what
   React holds is the open menu, whatever a stalled frame drops. */
const GROW = css.keyframes({
  from: { opacity: 0, transform: [{ translateY: -6 }, { scale: 0.92 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
});
const SHRINK = css.keyframes({
  from: { opacity: 1, transform: [{ scale: 1 }] },
  to: { opacity: 0, transform: [{ scale: 0.96 }] },
});
const FADE_IN = css.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
const FADE_OUT = css.keyframes({ from: { opacity: 1 }, to: { opacity: 0 } });

/**
 * A menu's trigger and its state, as a pair: put the ref on a plain `<View
 * collapsable={false}>` round the control that opens it — Android drops a
 * layout-only view it is not told to keep, and `PressableScale` forwards no
 * ref. Two values, not one object: an object holding a ref is a ref to the
 * React Compiler, and nothing in it could then be read while rendering.
 */
export function useAnchoredMenu() {
  const ref = useRef<View>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [phase, setPhase] = useState<Phase>('closed');
  const [anchor, setAnchor] = useState<Rect | null>(null);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    []
  );

  function open() {
    if (phase !== 'closed') return;
    /* Measured as it opens: the trigger is wherever the page has put it now. */
    ref.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setPhase('open');
    });
  }

  function close() {
    if (phase !== 'open') return;
    setPhase('closing');
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      setPhase('closed');
      setAnchor(null);
    }, EXIT_MS);
  }

  return [ref, { phase, anchor, isOpen: phase === 'open', open, close }] as const;
}

export type AnchoredMenuState = ReturnType<typeof useAnchoredMenu>[1];

/**
 * A menu dropped from the control that opened it — SimpMusic's `DropdownMenu`
 * on Home's avatar: 280 wide at most, a 16 corner, `surfaceContainerHigh`.
 *
 * In a `Modal` so it is over everything, the tab bar included — which is why
 * Home's Create is this and not a sheet: the floating bar sits on the foot of
 * a tab screen, and a sheet drawn in the page would be under it. A tap
 * anywhere else, or Back, closes it.
 */
export function AnchoredMenu({
  menu,
  label,
  align = 'start',
  width = 280,
  children,
}: {
  menu: AnchoredMenuState;
  /** What the menu is, for a screen reader. */
  label: string;
  /** Which edge of the trigger the menu lines up with. */
  align?: 'start' | 'end';
  width?: number;
  children: ReactNode;
}) {
  const accent = useAccent();
  const liquid = useLiquidGlass();
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { anchor, phase } = menu;

  if (phase === 'closed' || !anchor) return null;

  const menuWidth = Math.min(width, windowWidth - EDGE * 2);
  const wanted = align === 'start' ? anchor.x : anchor.x + anchor.width - menuWidth;
  const left = Math.max(EDGE, Math.min(wanted, windowWidth - EDGE - menuWidth));
  const top = Math.max(insets.top, anchor.y + anchor.height + GAP);
  /* A long menu (Home's ten moods) scrolls inside the display, never past it. */
  const maxHeight = Math.max(160, windowHeight - top - insets.bottom - EDGE);

  const motion =
    phase === 'closing'
      ? {
          animationName: reduceMotion ? FADE_OUT : SHRINK,
          animationDuration: EXIT_MS,
          animationFillMode: 'forwards' as const,
        }
      : {
          animationName: reduceMotion ? FADE_IN : GROW,
          animationDuration: ENTER_MS,
          animationTimingFunction: EASE_OUT,
        };

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={menu.close}>
      <Pressable
        style={StyleSheet.absoluteFill}
        accessibilityRole="button"
        accessibilityLabel="Close menu"
        onPress={menu.close}
      />
      <Animated.View
        accessibilityViewIsModal
        accessibilityLabel={label}
        pointerEvents={phase === 'open' ? 'auto' : 'none'}
        style={[
          styles.menu,
          Elevation.overlay,
          {
            top,
            left,
            width: menuWidth,
            backgroundColor: liquid ? 'transparent' : accent.m3.surfaceContainerHigh,
            borderColor: liquid ? 'transparent' : accent.m3.outlineVariant,
            /* Grows out of the trigger's middle, on the edge it meets. */
            transformOrigin: [anchor.x + anchor.width / 2 - left, 0, 0],
          },
          motion,
        ]}>
        {/* Settings → Liquid glass: the menu is glass. */}
        {liquid && <GlassSurface radius={16} />}
        <ScrollView
          style={[styles.clip, { maxHeight }]}
          contentContainerStyle={styles.list}
          bounces={false}
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

/**
 * A row of the menu: Material's `DropdownMenuItem` — a 24 glyph, the words,
 * 48 high — with a quieter line under the words where there is one, and
 * something at the far end (a count).
 */
export function AnchoredMenuItem({
  icon,
  iconColor,
  checked,
  title,
  hint,
  trailing,
  onPress,
}: {
  /** A glyph before the words; a list of plain choices has none. */
  icon?: IconName;
  /** The glyph's colour when it carries meaning (a status's hue). */
  iconColor?: string;
  title: string;
  hint?: string;
  trailing?: ReactNode;
  /** The row is the one in force — a screen reader hears it as checked. */
  checked?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const accent = useAccent();

  return (
    <PressableScale
      accessibilityRole="menuitem"
      accessibilityLabel={title}
      accessibilityState={checked === undefined ? undefined : { checked }}
      accessibilityHint={hint}
      onPress={onPress}
      scaleTo={0.98}
      pressedColor={theme.controlPressed}
      style={StyleSheet.flatten([styles.item, hint ? styles.itemTall : null])}>
      {icon && <Ionicons name={icon} size={24} color={iconColor ?? accent.quietInk} />}
      <View style={styles.itemText}>
        <Text variant="optionTitle" numberOfLines={1}>
          {title}
        </Text>
        {hint && (
          <Text variant="bodySmall" color="textMuted" numberOfLines={1}>
            {hint}
          </Text>
        )}
      </View>
      {trailing}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  /* `RoundedCornerShape(16.dp)`, the reference menu's. */
  menu: { position: 'absolute', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  clip: { flexGrow: 0, borderRadius: 16, overflow: 'hidden' },
  list: { paddingVertical: Spacing.x8 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    minHeight: 48,
    paddingHorizontal: Spacing.x16,
    borderRadius: Radius.none,
  },
  itemTall: { minHeight: 56 },
  itemText: { flex: 1, gap: 1 },
});
