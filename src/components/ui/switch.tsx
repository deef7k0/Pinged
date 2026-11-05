import { StyleSheet } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

import { PressableScale } from '@/components/ui/pressable-scale';
import { withAlpha } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';

/** iOS's switch: a 51×31 track and a 27 knob, two in from its edge. */
const TRACK = { width: 51, height: 31 } as const;
const KNOB = 27;
const INSET = (TRACK.height - KNOB) / 2;
const TRAVEL = TRACK.width - KNOB - INSET * 2;
const MS = 240;
/* iOS's own switch settles with a little give; this is its ease, not a spring. */
const EASE = cubicBezier(0.3, 0.9, 0.35, 1);

export type SwitchProps = {
  value: boolean;
  onValueChange: (next: boolean) => void;
  /** What it switches, for a screen reader — "Platinum". */
  label: string;
  disabled?: boolean;
  /**
   * The track's colour when on. Apple's green on the app's own pages; a game's
   * screens pass nothing and get the game's own primary. A meaning colour
   * (platinum, a spoiler's red) may be passed where the colour is the datum.
   */
  tint?: string;
};

/**
 * Apple's switch (the Apple pass, 2026-11-04): a capsule track that fills
 * when on and a white knob that slides across it. There was no switch in the
 * app before — every on/off was two radio cards or a pill that poured.
 *
 * The knob's place and the track's colour are **CSS transitions on React
 * props**, so the switch always rests on what was last rendered and cannot
 * lose its end value (§ Gotchas).
 */
export function Switch({ value, onValueChange, label, disabled = false, tint }: SwitchProps) {
  const theme = useTheme();
  const accent = useAccent();
  const reduceMotion = useReducedMotion();
  const on = tint ?? (accent.tonal ? accent.color : theme.success);
  const duration = reduceMotion ? 0 : MS;

  return (
    <PressableScale
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      scaleTo={0.96}
      hitSlop={8}
      style={StyleSheet.flatten([styles.hit, disabled && styles.disabled])}>
      <Animated.View
        style={[
          styles.track,
          {
            backgroundColor: value ? on : withAlpha(theme.text, 0.16),
            transitionProperty: 'backgroundColor',
            transitionDuration: duration,
            transitionTimingFunction: EASE,
          },
        ]}>
        <Animated.View
          style={[
            styles.knob,
            {
              backgroundColor: theme.white,
              transform: [{ translateX: value ? TRAVEL : 0 }],
              transitionProperty: 'transform',
              transitionDuration: duration,
              transitionTimingFunction: EASE,
            },
          ]}
        />
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  hit: { justifyContent: 'center' },
  disabled: { opacity: 0.35 },
  track: {
    width: TRACK.width,
    height: TRACK.height,
    borderRadius: TRACK.height / 2,
    padding: INSET,
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    boxShadow: '0px 3px 8px rgba(0, 0, 0, 0.15), 0px 1px 1px rgba(0, 0, 0, 0.16)',
  },
});
