import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageScrollView } from '@/components/ui/page-scroll';
import { PartialDateField } from '@/components/ui/partial-date-field';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { useSelectable } from '@/components/ui/selectable';
import { SelectField } from '@/components/ui/select-field';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { COMPLETION_HINT, COMPLETION_LABEL, COMPLETION_LEVELS } from '@/constants/progress';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  addPlaythrough,
  deletePlaythrough,
  getPlaythroughs,
  updatePlaythrough,
  type PlaythroughInput,
} from '@/lib/api';
import type { CompletionLevel, PlaythroughRow } from '@/lib/database.types';
import { getGameById, type Game } from '@/lib/games';
import { platformOptionsFor } from '@/lib/platform-options';
import { useAuth } from '@/store/auth';
import { showAlert } from '@/components/ui/dialog';
import { toast } from '@/lib/toast';

const MAX_NOTES = 500;

/**
 * Add or edit one playthrough. `id` is `new` or the row's uuid; `game` is always
 * passed, because a run is looked up within its game's list.
 */
export default function PlaythroughEditScreen() {
  const { id, game: gameId } = useLocalSearchParams<{ id: string; game: string }>();
  const userId = useAuth((state) => state.session?.user.id) ?? null;
  const isNew = id === 'new';

  const game = useQuery({
    queryKey: ['game', gameId],
    queryFn: ({ signal }) => getGameById(gameId!, signal),
    enabled: !!gameId,
    staleTime: 30 * 60_000,
  });

  const runs = useQuery({
    queryKey: ['playthroughs', userId, gameId],
    queryFn: () => getPlaythroughs(userId!, gameId!),
    enabled: !!userId && !!gameId,
  });

  const run = runs.data?.find((entry) => entry.id === id) ?? null;
  const number = run ? (runs.data ?? []).indexOf(run) + 1 : (runs.data?.length ?? 0) + 1;

  let body: React.ReactNode;
  if (!userId || !gameId) {
    body = <EmptyState title="Nothing to edit" />;
  } else if (game.isLoading || runs.isLoading) {
    body = <LoadingState />;
  } else if (game.isLoadingError || runs.isLoadingError) {
    body = <ErrorState error={game.error ?? runs.error} onRetry={() => void runs.refetch()} />;
  } else if (!game.data) {
    body = <EmptyState title="Game not found" />;
  } else if (!isNew && !run) {
    body = <EmptyState title="That playthrough is gone" message="It may have been deleted." />;
  } else {
    /* Seeded from the loaded row by keying the form on it — the pattern
       `log/[id]` uses, and the only one the React Compiler rules allow. */
    body = (
      <PlaythroughForm
        key={run?.id ?? 'new'}
        userId={userId}
        game={game.data}
        run={run}
        number={number}
      />
    );
  }

  return (
    <Screen
      edges={['bottom']}
      padded
      insetHeader
      modal
      topBar={<FrostedTopBar dismiss title={run ? `Playthrough #${number}` : 'New playthrough'} />}>
      {body}
    </Screen>
  );
}

function PlaythroughForm({
  userId,
  game,
  run,
  number,
}: {
  userId: string;
  game: Game;
  run: PlaythroughRow | null;
  number: number;
}) {
  const theme = useTheme();
  const selectable = useSelectable();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [platform, setPlatform] = useState(run?.platform ?? '');
  const [startedOn, setStartedOn] = useState<string | null>(run?.started_on ?? null);
  const [finishedOn, setFinishedOn] = useState<string | null>(run?.finished_on ?? null);
  const [completion, setCompletion] = useState<CompletionLevel | null>(run?.completion ?? null);
  const [percent, setPercent] = useState(
    run?.completion_percent != null ? String(Math.round(Number(run.completion_percent))) : ''
  );
  const [hours, setHours] = useState(run?.hours != null ? String(Number(run.hours)) : '');
  const [notes, setNotes] = useState(run?.notes ?? '');

  const platformOptions = useMemo(
    () => platformOptionsFor(game.platforms, run?.platform, theme.textSecondary),
    [game.platforms, run?.platform, theme.textSecondary]
  );

  /* Resolved during render, so each message sits under the field it is about
     rather than above a button once the field has scrolled away. */
  const parsedPercent = percent.trim() ? Number(percent.trim()) : null;
  const percentError =
    parsedPercent !== null &&
    (!Number.isFinite(parsedPercent) || parsedPercent < 0 || parsedPercent > 100)
      ? 'A percentage from 0 to 100.'
      : null;
  const parsedHours = hours.trim() ? Number(hours.trim()) : null;
  const hoursError =
    parsedHours !== null && (!Number.isFinite(parsedHours) || parsedHours < 0)
      ? 'Enter a number of hours — 40, or 12.5.'
      : null;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['playthroughs', userId, game.id] });
    /* A run that got further raises the log's completion in the database, so the
       log — and everything that prints it — has to be read again. */
    queryClient.invalidateQueries({ queryKey: ['my-log', userId, game.id] });
    queryClient.invalidateQueries({ queryKey: ['feed'] });
    queryClient.invalidateQueries({ queryKey: ['user-logs', userId] });
    queryClient.invalidateQueries({ queryKey: ['game-review-list', game.id] });
    queryClient.invalidateQueries({ queryKey: ['review-stats', game.id] });
  }

  const save = useMutation({
    mutationFn: async () => {
      if (percentError ?? hoursError) throw new Error(percentError ?? hoursError!);
      const input: PlaythroughInput = {
        platform: platform || null,
        startedOn,
        finishedOn,
        completion,
        completionPercent: completion === 'full' ? 100 : parsedPercent,
        hours: parsedHours,
        notes,
      };
      if (run) await updatePlaythrough(run.id, input);
      else await addPlaythrough(userId, game.id, input);
    },
    onSuccess: () => {
      toast.success('Playthrough saved');
      invalidate();
      router.back();
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (run) await deletePlaythrough(run.id);
    },
    onSuccess: () => {
      toast.success('Playthrough deleted');
      invalidate();
      router.back();
    },
  });

  function confirmRemove() {
    showAlert(
      `Delete playthrough #${number}?`,
      'Your log of the game stays as it is — this removes only this run.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => remove.mutate() },
      ]
    );
  }

  const error = save.error ?? remove.error;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
      <PageScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* The bar says which run; the page says of which game. */}
        <View style={styles.head}>
          <Text variant="h2" numberOfLines={2}>
            {game.title}
          </Text>
        </View>

        <SelectField
          label="Platform"
          sheetTitle="Played on"
          value={platform}
          options={platformOptions}
          onChange={setPlatform}
          placeholder="Not set"
        />

        <PartialDateField label="Started" value={startedOn} onChange={setStartedOn} />
        <PartialDateField label="Finished" value={finishedOn} onChange={setFinishedOn} />

        {/*
          How far this run got. "Not finished" is a real answer — a run in
          progress, or one that ended before the credits — and it is the
          default, because a new run has not finished yet.
        */}
        <View style={styles.field}>
          <Text variant="fieldLabel" accessibilityRole="header">
            How far
          </Text>
          <View style={styles.levels} accessibilityRole="radiogroup">
            {([null, ...COMPLETION_LEVELS] as const).map((level) => {
              const selected = completion === level;
              const look = selectable(selected);
              return (
                <PressableScale
                  key={level ?? 'none'}
                  onPress={() => setCompletion(level)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityHint={
                    level ? COMPLETION_HINT[level] : 'Still going, or stopped short'
                  }
                  scaleTo={0.97}
                  pressedColor={look.pressedColor}
                  focusRing={look.focusRing}
                  style={StyleSheet.flatten([styles.level, look.style])}>
                  <Text variant="bodySmall" color={look.label}>
                    {level ? COMPLETION_LABEL[level] : 'Not finished'}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        </View>

        <View style={styles.row}>
          {/* A percentage is only a question for a run that is not 100% — at
              100% the answer is already given. */}
          {completion !== 'full' && (
            <View style={styles.flex}>
              <TextField
                label="Progress %"
                value={percent}
                onChangeText={setPercent}
                keyboardType="numeric"
                placeholder="—"
                error={percentError}
              />
            </View>
          )}
          <View style={styles.flex}>
            <TextField
              label="Hours"
              value={hours}
              onChangeText={setHours}
              keyboardType="numeric"
              placeholder="0"
              error={hoursError}
            />
          </View>
        </View>

        <TextField
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          multiline
          maxLength={MAX_NOTES}
          placeholder="Difficulty, mods, who you played it with…"
          hint={`${notes.length}/${MAX_NOTES}`}
        />

        {error && (
          <Text variant="bodySmall" color="danger">
            {error instanceof Error ? error.message : 'Could not save this playthrough.'}
          </Text>
        )}

        <Button
          title={run ? 'Save playthrough' : 'Add playthrough'}
          fullWidth
          loading={save.isPending}
          disabled={!!percentError || !!hoursError || remove.isPending}
          onPress={() => save.mutate()}
        />

        {run && (
          <Button
            title="Delete playthrough"
            variant="danger"
            fullWidth
            loading={remove.isPending}
            disabled={save.isPending}
            onPress={confirmRemove}
          />
        )}
      </PageScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: Spacing.x24, paddingTop: Spacing.x16, paddingBottom: Spacing.x48 },
  head: { gap: Spacing.x4 },
  field: { gap: Spacing.x8 },
  row: { flexDirection: 'row', gap: Spacing.x12 },
  levels: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.x8 },
  level: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TapTarget,
    paddingHorizontal: Spacing.x12,
    borderRadius: Radius.control,
    borderWidth: 1,
  },
});
