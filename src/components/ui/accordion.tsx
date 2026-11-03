import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { usePulse } from '@/hooks/use-pulse';
import { useTheme } from '@/hooks/use-theme';

/*
 * reacticx's bouncy accordion (`molecules/bouncy-accordion`, MIT), its springs
 * as it states them: the rows' corners and the gap that opens round an open
 * row bounce (550ms at 0.62); the content opens nearly critically (520 at
 * 0.9) and closes without undershoot (440 at 1), because a height that
 * overshoots reads as a blank flash; the chevron flips at 420 / 0.72; the
 * words fade in 180ms.
 */
const ROW_SPRING = { duration: 550, dampingRatio: 0.62 } as const;
const OPEN_SPRING = { duration: 520, dampingRatio: 0.9 } as const;
const CLOSE_SPRING = { duration: 440, dampingRatio: 1 } as const;
const CHEVRON_SPRING = { duration: 420, dampingRatio: 0.72 } as const;
const FADE_MS = 180;
/** A pressed trigger swells, reacticx's 1.0221. */
const PRESS_SCALE = 1.0221;
const DEFAULT_GAP = 12;
const DEFAULT_RADIUS = 28;

type RootContext = {
  active: string | null;
  setActive: (value: string | null) => void;
  gap: number;
  radius: number;
};

const Root = createContext<RootContext | null>(null);
const Item = createContext<{ open: boolean; toggle: () => void } | null>(null);

/** What the root hands each item about its place in the group. */
export type AccordionSlot = {
  open?: boolean;
  startsGroup?: boolean;
  endsGroup?: boolean;
  separatedFromPrevious?: boolean;
};

/**
 * A group of rows that open one at a time — reacticx's bouncy accordion (the
 * owner's, 2026-11-02: "Wherever it fits, make the accordions in the app like
 * this"). Closed, the rows are one rounded block; the open row parts from the
 * rows either side and takes its own rounded corners, with a bounce.
 *
 * Each child must be an `<AccordionItem>`, or a component that forwards the
 * `AccordionSlot` props it is given to one (Settings' review languages do).
 */
export function Accordion({
  children,
  defaultValue = null,
  gap = DEFAULT_GAP,
  radius = DEFAULT_RADIUS,
}: {
  children: ReactNode;
  defaultValue?: string | null;
  gap?: number;
  radius?: number;
}) {
  const [active, setActive] = useState<string | null>(defaultValue);
  const context = useMemo(() => ({ active, setActive, gap, radius }), [active, gap, radius]);

  const items = Children.toArray(children).filter(isValidElement) as ReactElement<
    { value: string } & AccordionSlot
  >[];
  const activeIndex = items.findIndex((item) => item.props.value === active);

  return (
    <Root.Provider value={context}>
      <View>
        {items.map((item, index) => {
          const open = index === activeIndex;
          const previousOpen = activeIndex === index - 1;
          const nextOpen = activeIndex === index + 1;
          return cloneElement(item, {
            open,
            startsGroup: open || index === 0 || previousOpen,
            endsGroup: open || index === items.length - 1 || nextOpen,
            separatedFromPrevious: index > 0 && (open || previousOpen),
          });
        })}
      </View>
    </Root.Provider>
  );
}

/** One row of an `<Accordion>`: its trigger and its content. */
export function AccordionItem({
  value,
  children,
  open = false,
  startsGroup = true,
  endsGroup = true,
  separatedFromPrevious = false,
}: { value: string; children: ReactNode } & AccordionSlot) {
  const root = useContext(Root);
  const theme = useTheme();
  const pulse = usePulse();
  const radius = root?.radius ?? DEFAULT_RADIUS;
  const gap = root?.gap ?? DEFAULT_GAP;

  const top = useSharedValue(startsGroup ? radius : 0);
  const bottom = useSharedValue(endsGroup ? radius : 0);
  const margin = useSharedValue(separatedFromPrevious ? gap : 0);

  useEffect(() => {
    top.set(withSpring(startsGroup ? radius : 0, ROW_SPRING));
    bottom.set(withSpring(endsGroup ? radius : 0, ROW_SPRING));
  }, [startsGroup, endsGroup, radius, top, bottom]);

  useEffect(() => {
    margin.set(withSpring(separatedFromPrevious ? gap : 0, ROW_SPRING));
  }, [separatedFromPrevious, gap, margin]);

  /* Every style reads `pulse` and carries a transform (`usePulse`): a
     settled radius is not a pose React can restate. */
  const wrapStyle = useAnimatedStyle(() => {
    pulse.get();
    return { marginTop: Math.max(0, margin.get()), transform: [{ translateY: 0 }] };
  });
  const cardStyle = useAnimatedStyle(() => {
    pulse.get();
    const t = Math.max(0, top.get());
    const b = Math.max(0, bottom.get());
    return {
      borderTopLeftRadius: t,
      borderTopRightRadius: t,
      borderBottomLeftRadius: b,
      borderBottomRightRadius: b,
      transform: [{ translateY: 0 }],
    };
  });

  const toggle = useCallback(() => {
    if (!root) return;
    root.setActive(root.active === value ? null : value);
  }, [root, value]);

  const item = useMemo(() => ({ open, toggle }), [open, toggle]);

  return (
    <Item.Provider value={item}>
      <Animated.View style={wrapStyle}>
        <Animated.View style={[styles.card, { backgroundColor: theme.surface }, cardStyle]}>
          {/* Rows in one block are told apart by a hairline, which the
              reference's white rows on white do not need. */}
          {!startsGroup && (
            <View style={[styles.seam, { backgroundColor: theme.border }]} pointerEvents="none" />
          )}
          {children}
        </Animated.View>
      </Animated.View>
    </Item.Provider>
  );
}

/** The row's face: a glyph, its name, a line saying what is set, the chevron. */
export function AccordionTrigger({
  icon,
  title,
  summary,
  accessibilityLabel,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  summary?: string;
  accessibilityLabel?: string;
}) {
  const item = useContext(Item);
  const theme = useTheme();
  const open = item?.open ?? false;
  const turn = useSharedValue(open ? 1 : 0);
  const pressed = useSharedValue(0);

  useEffect(() => {
    turn.set(withSpring(open ? 1 : 0, CHEVRON_SPRING));
  }, [open, turn]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(turn.get(), [0, 1], [0, 180])}deg` }],
  }));
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.get(), [0, 1], [1, PRESS_SCALE]) }],
  }));

  return (
    <Pressable
      onPress={item?.toggle}
      onPressIn={() => pressed.set(withTiming(1))}
      onPressOut={() => pressed.set(withSpring(0))}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={accessibilityLabel ?? (summary ? `${title}, ${summary}` : title)}>
      <Animated.View style={[styles.trigger, pressStyle]}>
        {icon && (
          <View style={styles.icon}>
            <Ionicons name={icon} size={20} color={theme.textSecondary} />
          </View>
        )}
        <View style={styles.titleWrap}>
          <Text variant="h5" numberOfLines={1}>
            {title}
          </Text>
          {!!summary && (
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              {summary}
            </Text>
          )}
        </View>
        <Animated.View style={[styles.chevron, chevronStyle]}>
          <Ionicons name="chevron-down" size={18} color={theme.textMuted} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

/**
 * What opens. Measured where it cannot be seen, then its window's height
 * springs between nothing and that — reacticx's method, so the content
 * itself never reflows while it opens.
 */
export function AccordionContent({ children }: { children: ReactNode }) {
  const item = useContext(Item);
  const open = item?.open ?? false;
  const reduceMotion = useReducedMotion();
  const pulse = usePulse();
  const height = useSharedValue(0);
  const opacity = useSharedValue(open ? 1 : 0);
  const [natural, setNatural] = useState(0);
  const settled = useRef(false);
  const wasOpen = useRef(open);

  const onMeasure = useCallback((event: LayoutChangeEvent) => {
    const h = event.nativeEvent.layout.height;
    if (h > 0) setNatural((before) => (Math.abs(before - h) > 0.5 ? h : before));
  }, []);

  useEffect(() => {
    if (natural <= 0) return;
    const target = open ? natural : 0;
    if (!settled.current || reduceMotion) {
      settled.current = true;
      wasOpen.current = open;
      height.set(target);
      opacity.set(open ? 1 : 0);
      return;
    }
    if (wasOpen.current !== open) {
      wasOpen.current = open;
      height.set(withSpring(target, open ? OPEN_SPRING : CLOSE_SPRING));
      opacity.set(withTiming(open ? 1 : 0, { duration: FADE_MS }));
    } else if (open) {
      height.set(target);
    }
  }, [open, natural, reduceMotion, height, opacity]);

  const windowStyle = useAnimatedStyle(() => {
    pulse.get();
    return { height: Math.max(0, height.get()), transform: [{ translateY: 0 }] };
  });
  const bodyStyle = useAnimatedStyle(() => {
    pulse.get();
    return { opacity: opacity.get(), transform: [{ translateY: 0 }] };
  });

  return (
    <Animated.View
      style={[styles.window, windowStyle]}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View style={[styles.measured, bodyStyle]} onLayout={onMeasure}>
        <View style={styles.inner}>{children}</View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  seam: {
    position: 'absolute',
    top: 0,
    left: Spacing.x20,
    right: Spacing.x20,
    height: StyleSheet.hairlineWidth,
  },
  /* reacticx's trigger: 54 tall at least, 20 at the sides, 16 between. */
  trigger: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x16,
    paddingHorizontal: Spacing.x20,
    paddingVertical: Spacing.x12,
  },
  icon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { flex: 1, minWidth: 0, gap: 2 },
  chevron: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  window: { overflow: 'hidden' },
  measured: { position: 'absolute', left: 0, right: 0, top: 0 },
  inner: { paddingHorizontal: Spacing.x20, paddingBottom: Spacing.x20 },
});
