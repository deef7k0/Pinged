import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { ScoreReadout } from '@/components/ui/score-meter';
import { SeekBar } from '@/components/ui/seek-bar';
import { Text } from '@/components/ui/text';
import { MAX_SCORE, MIN_SCORE, clampScore, scoreColor } from '@/constants/score';
import { Radius, Spacing, TapTarget, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const DEFAULT_SCORE = 75;

/**
 * The bar at rest: 10, and three and a half times that while held — the
 * seek bar's own ratio. Thicker than reacticx's 8, at the owner's earlier
 * word (2026-10-15: "I also want the review score bar to be thicker").
 */
const TRACK_HEIGHT = 10;

export type ScoreInputProps = {
  /** 0-100, or null when unrated. */
  value: number | null;
  onChange: (value: number | null) => void;
  /**
   * Read-only: the score is derived from something else (advanced metrics), so
   * the track, the nudges and the clear button all go away. The readout stays at
   * full strength — it is still the headline number, just no longer editable.
   */
  disabled?: boolean;
  /** Replaces "out of 100" beside the verdict. */
  hint?: string;
};

/**
 * Score picker: a big number, its verdict, reacticx's seek bar, and ±1 nudges.
 *
 * The number and the verdict are `<ScoreReadout>`, as the review page reads a
 * score. The bar is `<SeekBar>` (2026-11-03), where it was the review page's
 * `<ScoreBar>` under a raw responder.
 *
 * The ± buttons are not redundant with the drag: hitting exactly 87 by dragging
 * on a phone-width track is impossible, and precise scores are the entire point
 * of a 100-point scale.
 */
export function ScoreInput({ value, onChange, disabled = false, hint }: ScoreInputProps) {
  const theme = useTheme();

  const score = value ?? DEFAULT_SCORE;

  function nudge(delta: number) {
    onChange(clampScore(score + delta));
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.readoutRow}>
        <View style={styles.readout}>
          <ScoreReadout
            score={value}
            /* The nudges start from `DEFAULT_SCORE`, so an unscored readout that
               said only "tap the bar" left −1 producing an unexplained 74. */
            hint={
              hint ?? (value === null ? `Tap the bar, or nudge from ${DEFAULT_SCORE}` : undefined)
            }
          />
        </View>

        {value !== null && !disabled && (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Clear score"
            onPress={() => onChange(null)}
            /* A 22dp glyph in a tight row: hitSlop rather than padding, so the
               touch area reaches the floor without moving the readout. */
            hitSlop={(TapTarget - 22) / 2}
            scaleTo={0.85}>
            <Ionicons name="close-circle" size={22} color={theme.textMuted} />
          </PressableScale>
        )}
      </View>

      {/* reacticx's seek bar (the owner's, 2026-11-03): drag or tap along it,
          and it swells under the finger. Filled in the score's own colour, so
          the bar says good, mixed or bad before the number is read. */}
      <View
        style={[styles.trackHit, disabled && styles.dim]}
        accessibilityRole={disabled ? 'progressbar' : 'adjustable'}
        accessibilityLabel="Score"
        accessibilityValue={{ min: MIN_SCORE, max: MAX_SCORE, now: value ?? undefined }}
        /*
         * `adjustable` promises the increment/decrement gesture; without these it
         * announces itself as adjustable and then does nothing when swiped. The
         * drag is a pan gesture, which offers assistive tech nothing at all, so
         * these actions are the *only* way to score a game with a screen reader.
         */
        {...(disabled
          ? null
          : {
              accessibilityActions: [
                { name: 'increment' as const },
                { name: 'decrement' as const },
              ],
              onAccessibilityAction: (event) => {
                if (event.nativeEvent.actionName === 'increment') nudge(1);
                if (event.nativeEvent.actionName === 'decrement') nudge(-1);
              },
            })}>
        <SeekBar
          value={(value ?? 0) / MAX_SCORE}
          onValueChange={(share) => onChange(clampScore(share * MAX_SCORE))}
          activeColor={value === null ? theme.textMuted : scoreColor(value, theme)}
          inactiveColor={withAlpha(theme.text, 0.12)}
          height={TRACK_HEIGHT}
          disabled={disabled}
        />
      </View>

      {!disabled && (
        <View style={styles.nudges}>
          <Nudge label="−10" onPress={() => nudge(-10)} />
          <Nudge label="−1" onPress={() => nudge(-1)} />
          <View style={styles.spacer} />
          <Nudge label="+1" onPress={() => nudge(1)} />
          <Nudge label="+10" onPress={() => nudge(10)} />
        </View>
      )}
    </View>
  );
}

function Nudge({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Adjust score by ${label}`}
      onPress={onPress}
      scaleTo={0.9}
      style={StyleSheet.flatten([styles.nudge, { borderColor: theme.border }])}>
      <Text variant="bodySmall" color="textSecondary">
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  /* The track's own padding is inside `trackHit`, so the gaps here are measured
     against the bar rather than against its touch area. */
  wrapper: { gap: Spacing.x4 },
  /* The readout takes the row; the clear button keeps its own width at the end.
     `center` here, `baseline` inside the readout: the button is a glyph, not a
     line of type, and a glyph has no baseline to share. */
  readoutRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x16 },
  readout: { flex: 1, minWidth: 0 },
  trackHit: { justifyContent: 'center' },
  dim: { opacity: 0.5 },
  nudges: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  spacer: { flex: 1 },
  nudge: {
    paddingVertical: Spacing.x8,
    paddingHorizontal: Spacing.x12,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 50,
    /* The floor, reached by height rather than by padding: growing the padding
       instead would have made a 50dp-wide pill nearly square. */
    minHeight: TapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
