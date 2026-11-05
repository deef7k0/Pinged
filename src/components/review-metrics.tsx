import { useRef } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Checkbox } from '@/components/ui/selection-marks';
import { Text } from '@/components/ui/text';
import { MAX_SCORE, clampScore, scoreColor } from '@/constants/score';
import {
  REVIEW_METRICS,
  countMetrics,
  orderedMetrics,
  type ReviewMetricKey,
  type ReviewMetrics,
} from '@/constants/review-metrics';
import { Typeface, Radius, Spacing, TapTarget, Type, withAlpha } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';

/**
 * Shared id for the iOS "Done" bar above the number pad.
 *
 * `number-pad` has no return key on iOS, so the `returnKeyType="done"` these
 * inputs used to carry was a silent no-op and the only way out of the keyboard
 * was tapping dead space. One accessory view is shared by all fourteen rows —
 * iOS shows whichever belongs to the focused input, so there is no reason to
 * mount fourteen of them. Android's number pad has its own dismiss key.
 */
const METRIC_KEYBOARD_ACCESSORY = 'review-metric-done';

/**
 * Advanced review metrics — the editor and its read-only counterpart.
 *
 * The editor holds *text*, not numbers, because a partially typed score is a
 * legitimate intermediate state ("8" on the way to "85") that a numeric model
 * cannot represent. `metricsFromDraft` is the single point where text becomes
 * scores, so the parsing rule lives in exactly one place.
 */

/** What the inputs hold while the user is typing. */
export type ReviewMetricsDraft = Partial<Record<ReviewMetricKey, string>>;

export function draftFromMetrics(metrics: ReviewMetrics | null): ReviewMetricsDraft {
  if (!metrics) return {};
  const draft: ReviewMetricsDraft = {};
  for (const [key, score] of Object.entries(metrics)) {
    if (score !== undefined) draft[key as ReviewMetricKey] = String(score);
  }
  return draft;
}

/** Text → scores. A blank or unparseable box is simply not an activated metric. */
export function metricsFromDraft(draft: ReviewMetricsDraft): ReviewMetrics {
  const metrics: ReviewMetrics = {};
  for (const [key, text] of Object.entries(draft)) {
    if (!text) continue;
    const score = Number(text);
    if (!Number.isFinite(score)) continue;
    metrics[key as ReviewMetricKey] = clampScore(score);
  }
  return metrics;
}

/**
 * Keep the box in a state that is always a valid score-in-progress: digits only,
 * never above 100. Clamping as they type beats validating on save, because the
 * running average updates on every keystroke and a transient 250 would make it
 * lurch.
 */
function sanitise(text: string): string | undefined {
  const digits = text.replace(/[^0-9]/g, '').slice(0, 3);
  if (digits === '') return undefined;
  return String(Math.min(MAX_SCORE, Number(digits)));
}

export type ReviewMetricsEditorProps = {
  enabled: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  draft: ReviewMetricsDraft;
  onChangeDraft: (draft: ReviewMetricsDraft) => void;
};

export function ReviewMetricsEditor({
  enabled,
  onToggleEnabled,
  draft,
  onChangeDraft,
}: ReviewMetricsEditorProps) {
  const theme = useTheme();
  const scored = countMetrics(metricsFromDraft(draft));

  function setMetric(key: ReviewMetricKey, text: string) {
    const value = sanitise(text);
    const next = { ...draft };
    if (value === undefined) {
      delete next[key];
    } else {
      next[key] = value;
    }
    onChangeDraft(next);
  }

  return (
    <View style={styles.editor}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: enabled }}
        accessibilityLabel="Advanced review metrics"
        onPress={() => onToggleEnabled(!enabled)}
        style={styles.tickRow}>
        {/* The shared box, so it takes the screen's accent — on the log form
            that is the game's colour, where a hard-coded house fill was the
            one control on the page in a different hue. */}
        <View style={styles.tick}>
          <Checkbox checked={enabled} />
        </View>

        <View style={styles.tickText}>
          <Text variant="body">Advanced review metrics</Text>
          <Text variant="caption" color="textMuted">
            Score categories instead of the bar. The overall score becomes their average.
          </Text>
        </View>
      </Pressable>

      {enabled && (
        <View style={[styles.panel, { borderTopColor: theme.border }]}>
          <View style={styles.panelHead}>
            <Text variant="caption" color="textMuted" style={styles.panelHint}>
              Score each out of 100 — how well the game does it, not how much of it there is. Leave
              a box blank to exclude it.
            </Text>

            {scored > 0 && (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Clear all metrics"
                onPress={() => onChangeDraft({})}
                /* A single line of `caption` is 13dp tall. The label cannot grow
                   without shouting over the hint beside it, so the touch area
                   grows instead — 13 + 36 clears Android's 48, not just iOS's
                   44, which is the number this has to be measured against. */
                hitSlop={{ top: 18, bottom: 18, left: 12, right: 12 }}
                scaleTo={0.94}>
                <Text variant="caption" color="primaryText">
                  Clear all
                </Text>
              </PressableScale>
            )}
          </View>

          <View>
            {REVIEW_METRICS.map((metric, index) => (
              <MetricRow
                key={metric.key}
                label={metric.label}
                value={draft[metric.key] ?? ''}
                onChangeText={(text) => setMetric(metric.key, text)}
                divider={index < REVIEW_METRICS.length - 1}
              />
            ))}
          </View>

          <Text variant="caption" color="textMuted">
            {scored === 0
              ? 'No metrics scored yet — the review has no score.'
              : `Averaging ${scored} of ${REVIEW_METRICS.length} metrics.`}
          </Text>
        </View>
      )}

      {enabled && Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={METRIC_KEYBOARD_ACCESSORY}>
          <View style={[styles.accessory, { backgroundColor: theme.surfaceElevated }]}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Dismiss the keyboard"
              onPress={() => Keyboard.dismiss()}
              scaleTo={0.94}
              style={StyleSheet.flatten(styles.accessoryButton)}>
              <Text variant="button" color="primaryText">
                Done
              </Text>
            </PressableScale>
          </View>
        </InputAccessoryView>
      )}
    </View>
  );
}

function MetricRow({
  label,
  value,
  onChangeText,
  divider,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  divider: boolean;
}) {
  const theme = useTheme();
  const input = useRef<TextInput>(null);

  const filled = value !== '';
  const tint = filled ? scoreColor(Number(value), theme) : theme.textMuted;

  return (
    // Tapping the label focuses the box, so the whole row is the target rather
    // than a 62pt box the user has to hit precisely.
    //
    // `accessible={false}` rather than `accessibilityRole="none"`: the row is a
    // convenience for a finger, not a control in its own right, and the role
    // declared it non-interactive while it still grabbed focus as one. Opting
    // the wrapper out entirely leaves the input as the single announced target,
    // which is what it actually is.
    <Pressable
      accessible={false}
      onPress={() => input.current?.focus()}
      style={[
        styles.row,
        divider && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
      ]}>
      <Text variant="body" style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>

      <TextInput
        ref={input}
        value={value}
        onChangeText={onChangeText}
        keyboardType="number-pad"
        inputAccessoryViewID={Platform.OS === 'ios' ? METRIC_KEYBOARD_ACCESSORY : undefined}
        maxLength={3}
        placeholder="—"
        placeholderTextColor={theme.textMuted}
        selectTextOnFocus
        accessibilityLabel={`${label} score out of 100`}
        style={[
          styles.box,
          {
            backgroundColor: filled ? withAlpha(tint, 0.1) : theme.input,
            borderColor: filled ? tint : theme.border,
            color: tint,
          },
        ]}
      />
    </Pressable>
  );
}

/**
 * The scorecard as readers see it, on the review page.
 *
 * Bars are proportional to the score so the shape of an opinion is legible at a
 * glance — where a reviewer was generous and where they were not.
 *
 * On the accent's surfaces, like the score bar directly above it: the review
 * page runs on the game's colour, where the fixed grey ladder is not used.
 */
export function ReviewMetricsBreakdown({ metrics }: { metrics: ReviewMetrics }) {
  const theme = useTheme();
  const accent = useAccent();
  const rows = orderedMetrics(metrics);
  if (rows.length === 0) return null;

  return (
    <View style={[styles.breakdown, { borderTopColor: accent.m3.outlineVariant }]}>
      {/* `label`, not `caption` + hand-typed capitals: the token already carries
          the uppercase transform and its tracking was chosen for it. */}
      <Text variant="label" color="textMuted">
        Score breakdown · {rows.length} {rows.length === 1 ? 'metric' : 'metrics'}
      </Text>

      <View style={styles.breakdownRows}>
        {rows.map(({ metric, score }) => {
          const tint = scoreColor(score, theme);
          return (
            <View key={metric.key} style={styles.breakdownRow}>
              <Text variant="bodySmall" style={styles.breakdownLabel} numberOfLines={1}>
                {metric.label}
              </Text>

              <View style={[styles.breakdownTrack, { backgroundColor: accent.elevated }]}>
                <View
                  style={[styles.breakdownFill, { width: `${score}%`, backgroundColor: tint }]}
                />
              </View>

              <Text variant="h5" style={[styles.breakdownScore, { color: tint }]}>
                {score}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  editor: { gap: Spacing.x12 },
  /* Two lines of text put the row at ~36dp on its own. `minHeight` takes it to
     the floor without adding a gap the tick box would then float inside. */
  tickRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.x12,
    paddingVertical: Spacing.x4,
    minHeight: TapTarget,
  },
  /* Nudged onto the first line's optical centre. */
  tick: { marginTop: 1 },
  tickText: { flex: 1, gap: Spacing.x4 },

  panel: { paddingTop: Spacing.x16, gap: Spacing.x12, borderTopWidth: StyleSheet.hairlineWidth },
  panelHead: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.x12 },
  panelHint: { flex: 1 },

  accessory: { alignItems: 'flex-end', paddingHorizontal: Spacing.x16 },
  accessoryButton: {
    minHeight: TapTarget,
    paddingHorizontal: Spacing.x8,
    justifyContent: 'center',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    paddingVertical: Spacing.x8,
  },
  rowLabel: { flex: 1 },
  /* A field, so a field's corner and 1px edge — the score's own colour takes
     the edge once it holds a number, because the number is data. */
  box: {
    width: 62,
    height: 42,
    borderRadius: Radius.input,
    borderWidth: 1,
    textAlign: 'center',
    /* `h2`'s size, not a loose 17: this is the one number on the row and it has
       to out-weigh the label beside it. No `lineHeight` — on Android that clips
       descenders inside a fixed-height input. */
    fontSize: Type.h2.fontSize,
    fontFamily: Typeface.semibold,
    // Android centres text differently in a fixed-height input.
    paddingVertical: 0,
  },

  /* No horizontal margin of its own: the caller owns the inset.
     It carried `marginHorizontal: Spacing.x16` while its one caller was already
     padding to `Spacing.x24`, so the bars rendered 30dp from the edge against
     18dp for the prose and the score above them — the reviewer's own scorecard
     was the one block on the page that did not line up with their writing. */
  breakdown: {
    marginTop: Spacing.x4,
    paddingTop: Spacing.x16,
    gap: Spacing.x12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  breakdownRows: { gap: Spacing.x8 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  breakdownLabel: { width: 132 },
  breakdownTrack: { flex: 1, height: 6, borderRadius: Radius.pill, overflow: 'hidden' },
  breakdownFill: { height: '100%', borderRadius: Radius.pill },
  breakdownScore: { width: 30, textAlign: 'right' },
});
