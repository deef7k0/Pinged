import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/ui/icon-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { useSelectable } from '@/components/ui/selectable';
import { SelectionCard } from '@/components/ui/selection-card';
import { SelectField } from '@/components/ui/select-field';
import { Text } from '@/components/ui/text';
import {
  COMPLETION_HINT,
  COMPLETION_LABEL,
  PROGRESS_CHOICES,
  progressChoiceFor,
  progressPatch,
  type ProgressChoice,
} from '@/constants/progress';
import { statusColor } from '@/constants/status';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import {
  deleteLog,
  getPlaythroughs,
  invalidateCommunityRatings,
  setProgress,
  updateLogDetails,
  type LogDetailPatch,
} from '@/lib/api';
import type { GameLog } from '@/lib/database.types';
import type { Game } from '@/lib/games';
import { platformOptionsFor } from '@/lib/platform-options';
import { useAuth } from '@/store/auth';
import { showAlert } from '@/components/ui/dialog';

/** How far one tap on the stepper moves the percentage. */
const PERCENT_STEP = 5;

/**
 * How long the stepper waits after the last tap before writing.
 *
 * Tapping from 40% to 70% is six taps, and six writes racing each other over a
 * phone connection can land out of order and leave 55% saved. One write, after
 * the taps stop, cannot.
 */
const PERCENT_SETTLE_MS = 600;

export type ProgressSheetProps = {
  game: Game;
  log: GameLog | null;
  /** Put the sheet away. Called after a choice is saved, and by "Remove". */
  onClose: () => void;
  /** Open the playthroughs screen. The page closes the sheet first. */
  onOpenPlaythroughs: () => void;
};

/**
 * Where you are with a game: one tap to say it, and the detail underneath for
 * whoever wants to give it.
 *
 * ## Two taps to "I finished this"
 *
 * The key on the game page opens this; one choice closes it with the answer
 * saved. That is the whole path for the common case, and it is why the choices
 * lead and everything else waits below them. Each choice is a status and a
 * completion level at once (`constants/progress.ts`), so "Completed" and "100%"
 * are single taps rather than a status plus a second control.
 *
 * ## The detail is progressive, and only where it applies
 *
 * Once a log exists the sheet grows what that log can use: how far past the
 * credits for a finished game, a percentage for one in progress, the platform,
 * and the runs. None of it is asked for before there is a log to attach it to —
 * a percentage on a game you have not started is a question with no answer.
 *
 * Every detail writes on its own, through `updateLogDetails`, which changes only
 * the column it is given. A choice writes through `setProgress`, which is the
 * one call allowed to create the log.
 */
export function ProgressSheet({ game, log, onClose, onOpenPlaythroughs }: ProgressSheetProps) {
  const theme = useTheme();
  const accent = useAccent();
  const selectable = useSelectable();
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id) ?? null;
  const current = progressChoiceFor(log);

  const playthroughs = useQuery({
    queryKey: ['playthroughs', userId, game.id],
    queryFn: () => getPlaythroughs(userId!, game.id),
    enabled: !!userId && !!log,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['my-log', userId, game.id] });
    queryClient.invalidateQueries({ queryKey: ['feed'] });
    queryClient.invalidateQueries({ queryKey: ['user-logs', userId] });
    // A status changed what you have played: For You's tiers with it (0046).
    queryClient.invalidateQueries({ queryKey: ['pings', 'for_you'] });
    queryClient.invalidateQueries({ queryKey: ['profile-stats', userId] });
    queryClient.invalidateQueries({ queryKey: ['achievement-stats', userId] });
    queryClient.invalidateQueries({ queryKey: ['completions', userId] });
    // How far a reviewer got is what the reviews sheet filters and tallies by.
    queryClient.invalidateQueries({ queryKey: ['game-review-list', game.id] });
    queryClient.invalidateQueries({ queryKey: ['review-stats', game.id] });
    // The library's head: logged, reviewed, averages, best and worst.
    queryClient.invalidateQueries({ queryKey: ['user-game-stats', userId] });
    // The game page's "On GameLog": how many are playing it and have played it.
    queryClient.invalidateQueries({ queryKey: ['game-audience', game.id] });
  }

  const choose = useMutation({
    mutationFn: async (choice: ProgressChoice) => {
      if (!userId) throw new Error('Sign in to track your progress.');
      await setProgress(userId, game, progressPatch(choice, log));
    },
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });

  const details = useMutation({
    mutationFn: async (patch: LogDetailPatch) => {
      if (!userId) throw new Error('Sign in to track your progress.');
      await updateLogDetails(userId, game.id, patch);
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('You must be signed in.');
      await deleteLog(userId, game.id);
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['playthroughs', userId, game.id] });
      /* Removing the log removes its score, which moves this game's
         community score and can move every other one its rater scored
         (0041). The progress choices above never touch a score. */
      if (log?.rating != null) invalidateCommunityRatings(queryClient);
      onClose();
    },
  });

  const runs = playthroughs.data?.length ?? 0;

  /*
   * Whether removing the log would destroy something the person wrote or
   * recorded, rather than just a status.
   *
   * `logs.status` is NOT NULL, so there is no "logged, but no status" row to
   * fall back to — clearing progress means removing the log, and with it the
   * review, the score and (by the 0023 cascade) every playthrough. That is fine
   * when the log *is* the status, and data loss when it is not.
   */
  const hasContent = Boolean(
    log &&
    (log.rating !== null ||
      log.review ||
      log.review_title ||
      log.hours_played !== null ||
      log.platinum ||
      runs > 0)
  );

  function confirmRemove() {
    if (!hasContent) {
      remove.mutate();
      return;
    }
    showAlert(
      'Remove from your games?',
      `Your score, review and playthroughs for ${game.title} are deleted along with it. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => remove.mutate() },
      ]
    );
  }

  const platformOptions = useMemo(
    () => platformOptionsFor(game.platforms, log?.played_on, theme.textSecondary),
    [game.platforms, log?.played_on, theme.textSecondary]
  );

  const error = choose.error ?? details.error ?? remove.error;
  const inProgress = current === 'playing' || current === 'paused' || current === 'dropped';

  return (
    <ScrollView
      contentContainerStyle={styles.body}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled">
      <View style={styles.choices} accessibilityRole="radiogroup">
        {PROGRESS_CHOICES.map((choice) => {
          const selected = current === choice.key;
          const tint = statusColor(choice.status, theme);
          return (
            <SelectionCard
              key={choice.key}
              title={choice.label}
              hint={choice.hint}
              selected={selected}
              disabled={choose.isPending}
              onPress={() => (selected ? onClose() : choose.mutate(choice.key))}
              /* Glyph and word as well as hue: three of the seven share the
                 "played" blue, and hue alone is never the carrier here. The
                 glyph rides with the name; the circle before it says which
                 one is chosen. */
              leading={
                <Ionicons name={selected ? choice.icon : choice.outline} size={17} color={tint} />
              }
            />
          );
        })}
      </View>

      {log && (
        <View style={[styles.details, { borderTopColor: theme.border }]}>
          {/* How far past the credits, for a finished game. 100% is its own
              choice above; this only tells the story apart from the story and
              the rest, which is the distinction "Completed" alone cannot make. */}
          {current === 'completed' && (
            <View style={styles.detail}>
              <Text variant="label" color="textMuted" accessibilityRole="header">
                How far
              </Text>
              <View style={styles.segments} accessibilityRole="radiogroup">
                {(['story', 'main'] as const).map((level) => {
                  const selected = log.completion === level;
                  const look = selectable(selected);
                  return (
                    <PressableScale
                      key={level}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityHint={COMPLETION_HINT[level]}
                      onPress={() => details.mutate({ completion: level })}
                      scaleTo={0.97}
                      pressedColor={look.pressedColor}
                      focusRing={look.focusRing}
                      style={StyleSheet.flatten([styles.segment, look.style])}>
                      <Text variant="bodySmall" color={look.label}>
                        {COMPLETION_LABEL[level]}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            </View>
          )}

          {inProgress && (
            <PercentStepper
              /* Keyed on the saved value, so a refetch that disagrees with what
                 the stepper is showing resets it instead of being ignored. */
              key={`${log.id}:${log.completion_percent ?? 'none'}`}
              initial={log.completion_percent}
              onSettle={(value) => details.mutate({ completion_percent: value })}
            />
          )}

          <SelectField
            label="Platform"
            sheetTitle="Played on"
            value={log.played_on ?? ''}
            options={platformOptions}
            onChange={(value) => details.mutate({ played_on: value || null })}
            placeholder="Not set"
          />

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={
              runs > 0
                ? `${runs} ${runs === 1 ? 'playthrough' : 'playthroughs'}. Open them.`
                : 'Add a playthrough'
            }
            onPress={onOpenPlaythroughs}
            scaleTo={0.98}
            pressedColor={theme.controlPressed}
            focusRing={accent.ring}
            /* An action, so the action fill — grey, no edge — not a choice's
               outline. */
            style={StyleSheet.flatten([
              styles.linkRow,
              { backgroundColor: theme.controlFill, borderColor: 'transparent' },
            ])}>
            <Ionicons name="repeat" size={18} color={theme.textSecondary} />
            <View style={styles.choiceText}>
              <Text variant="itemTitle">Playthroughs</Text>
              <Text variant="caption" color="textSecondary">
                {runs > 0
                  ? `${runs} ${runs === 1 ? 'run' : 'runs'} — platform, dates, how far`
                  : 'Played it more than once? Log each run.'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </PressableScale>

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Remove ${game.title} from your games`}
            onPress={confirmRemove}
            disabled={remove.isPending}
            scaleTo={0.98}
            style={styles.remove}>
            <Text variant="bodySmall" color="danger">
              Remove from your games
            </Text>
          </PressableScale>
        </View>
      )}

      {error && (
        <Text variant="bodySmall" color="danger" accessibilityLiveRegion="polite">
          {error instanceof Error ? error.message : 'Could not save your progress.'}
        </Text>
      )}
    </ScrollView>
  );
}

/**
 * A percentage you nudge rather than type: − 70% +.
 *
 * Two taps a step, no keyboard over the sheet, and no field to clear before you
 * can type a new number. The write waits for the taps to stop (see
 * `PERCENT_SETTLE_MS`) and is made through a plain timer rather than a
 * mutation, so closing the sheet mid-nudge still saves where you stopped.
 */
function PercentStepper({
  initial,
  onSettle,
}: {
  initial: number | null;
  onSettle: (value: number | null) => void;
}) {
  const [value, setValue] = useState<number | null>(
    initial === null ? null : Math.round(Number(initial))
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function nudge(delta: number) {
    const next = Math.max(0, Math.min(100, (value ?? 0) + delta));
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onSettle(next), PERCENT_SETTLE_MS);
  }

  return (
    <View style={styles.detail}>
      <Text variant="label" color="textMuted" accessibilityRole="header">
        Progress
      </Text>
      <View
        style={styles.stepper}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Progress"
        accessibilityValue={
          value === null ? { text: 'Not recorded' } : { min: 0, max: 100, now: value }
        }
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) =>
          nudge(event.nativeEvent.actionName === 'increment' ? PERCENT_STEP : -PERCENT_STEP)
        }>
        <IconButton
          icon="remove"
          accessibilityLabel={`Down ${PERCENT_STEP} percent`}
          size="small"
          disabled={value === null || value <= 0}
          onPress={() => nudge(-PERCENT_STEP)}
        />
        <Text variant="h3" style={styles.percent}>
          {value === null ? '—' : `${value}%`}
        </Text>
        <IconButton
          icon="add"
          accessibilityLabel={`Up ${PERCENT_STEP} percent`}
          size="small"
          disabled={value !== null && value >= 100}
          onPress={() => nudge(PERCENT_STEP)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: Spacing.x16, paddingBottom: Spacing.x48, gap: Spacing.x16 },
  /* The reference's rhythm between options. */
  choices: { gap: Spacing.x12 },
  choiceText: { flex: 1, gap: 1 },
  details: { gap: Spacing.x16, paddingTop: Spacing.x16, borderTopWidth: StyleSheet.hairlineWidth },
  detail: { gap: Spacing.x8 },
  segments: { flexDirection: 'row', gap: Spacing.x8 },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TapTarget,
    borderRadius: Radius.control,
    borderWidth: 1,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x16 },
  percent: { minWidth: 64, textAlign: 'center' },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    minHeight: TapTarget + Spacing.x8,
    paddingHorizontal: Spacing.x16,
    borderRadius: Radius.card,
    borderWidth: 1,
  },
  remove: { alignSelf: 'flex-start', minHeight: TapTarget, justifyContent: 'center' },
});
