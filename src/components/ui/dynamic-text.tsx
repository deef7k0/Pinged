import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeOutDown,
  FadeOutUp,
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/text';

/*
 * reacticx's dynamic text (`molecules/dynamic-text`, MIT — the owner's,
 * 2026-11-03, for a Top 10's "Number 1"), driven by its caller rather than
 * by its own clock: a new line rises in from below on a damped spring
 * (`FadeInDown…springify().damping(25)`) while the old one leaves upward
 * (`FadeOutUp`), 200ms — and the other way round when the value goes back,
 * so "Number 3 → Number 2" falls as it should. Its iOS blur flash is not
 * ported; Android had none either.
 */

const DURATION = 200;

export type DynamicTextProps = {
  /** What it says now; a change of `id` is what animates. */
  text: string;
  id: string | number;
  /** Where it stands in a sequence: going up rises, going down falls. */
  order: number;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  /** Its height: the words swap inside it, so nothing under it moves. */
  height: number;
};

export function DynamicText({ text, id, order, style, containerStyle, height }: DynamicTextProps) {
  const reduceMotion = useReducedMotion();
  /* Which way this change goes, kept beside the order it was worked out at
     (React's "adjusting state when a prop changes"). */
  const [seen, setSeen] = useState({ order, forward: true });
  if (seen.order !== order) setSeen({ order, forward: order > seen.order });
  const forward = seen.order !== order ? order > seen.order : seen.forward;

  const entering = reduceMotion
    ? undefined
    : (forward ? FadeInDown : FadeInUp).duration(DURATION).springify().damping(25);
  const exiting = reduceMotion ? undefined : (forward ? FadeOutUp : FadeOutDown).duration(DURATION);

  return (
    <View style={[styles.box, { height }, containerStyle]} accessibilityLiveRegion="polite">
      <Animated.View
        key={id}
        entering={entering}
        exiting={exiting}
        layout={LinearTransition}
        style={styles.line}>
        <Text style={style} numberOfLines={1}>
          {text}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  line: { position: 'absolute' },
});
