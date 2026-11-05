import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** iOS's segmented control: 32 tall, a 2dp inset thumb. */
const HEIGHT = 32;
const PAD = 2;
const MS = 250;
const EASE = cubicBezier(0.3, 0.9, 0.35, 1);

export type SegmentedOption<T extends string> = { value: T; label: string };

/**
 * A choice of two to four, as iOS's segmented control (the Apple pass,
 * 2026-11-05): a grey capsule of equal segments with a white thumb under the
 * chosen one, gliding to the next. For a choice of more than four, a
 * pull-down row instead.
 *
 * The thumb's place is a CSS transition on a React prop, so it always rests on
 * what was last rendered (§ Gotchas, the lost end value).
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly SegmentedOption<T>[];
  /** `null`: nothing chosen yet — no thumb. */
  value: T | null;
  onChange: (value: T) => void;
  /** What the choice is, for a screen reader. */
  label: string;
}) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const segment = options.length > 0 ? (width - PAD * 2) / options.length : 0;
  const index = options.findIndex((option) => option.value === value);

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.track, { backgroundColor: theme.controlFill }]}>
      {width > 0 && index >= 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              width: segment,
              backgroundColor: theme.text,
              transform: [{ translateX: index * segment }],
              transitionProperty: 'transform',
              transitionDuration: reduceMotion ? 0 : MS,
              transitionTimingFunction: EASE,
            },
          ]}
        />
      )}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <PressableScale
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            scaleTo={0.97}
            hitSlop={{ top: 8, bottom: 8 }}
            style={styles.segment}>
            <Text
              variant="h5"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={{ color: selected ? theme.onPrimary : theme.text }}>
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: HEIGHT,
    flexDirection: 'row',
    padding: PAD,
    borderRadius: Radius.pill,
  },
  thumb: {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: Radius.pill,
  },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
