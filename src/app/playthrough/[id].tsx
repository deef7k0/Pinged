import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { useBarConfirm } from '@/hooks/use-bar-confirm';
import { Button } from '@/components/ui/button';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageScrollView } from '@/components/ui/page-scroll';
import { InsetGroup } from '@/components/ui/inset-group';
import { PartialDateRow } from '@/components/ui/partial-date-row';
import { PullDownRow } from '@/components/ui/pull-down-row';
import { Segmented } from '@/components/ui/segmented';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { COMPLETION_HINT, COMPLETION_LABEL, COMPLETION_LEVELS } from '@/constants/progress';
import { Spacing } from '@/constants/theme';
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
    body = <EmptyState icon="search" title="Game not found" />;
  } else if (!isNew && !run) {
    body = (
      <EmptyState
        icon="timer-outline"
        title="That playthrough is gone"
        message="It may have been deleted."
      />
    );
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

  useBarConfirm({
    label: run ? 'Save playthrough' : 'Add playthrough',
    onPress: () => save.mutate(),
    loading: save.isPending,
    disabled: !!percentError || !!hoursError || remove.isPending,
  });

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

        {/*
          Every field a row (the Apple pass, 2026-11-05): the platform a
          pull-down, the dates rows opening a tray, how far a segmented
          control, the numbers and notes rows. They were labelled wells and
          a wrapping row of pills.

          How far this run got: "Not finished" is a real answer — a run in
          progress, or one that ended before the credits — and it is the
          default, because a new run has not finished yet.
        */}
        <InsetGroup>
          <PullDownRow
            title="Platform"
            choices={platformOptions}
            value={platform || null}
            onChange={(next) => setPlatform(next ?? '')}
            anyLabel="Not set"
          />
          <PartialDateRow title="Started" value={startedOn} onChange={setStartedOn} />
          <PartialDateRow title="Finished" value={finishedOn} onChange={setFinishedOn} />
        </InsetGroup>

        <InsetGroup
          header="How far"
          footer={completion ? COMPLETION_HINT[completion] : 'Still going, or stopped short.'}>
          <View style={styles.segments}>
            <Segmented
              label="How far"
              value={completion ?? NOT_FINISHED}
              onChange={(next) => setCompletion(next === NOT_FINISHED ? null : next)}
              options={[
                { value: NOT_FINISHED, label: 'Not finished' },
                ...COMPLETION_LEVELS.map((level) => ({
                  value: level,
                  label: COMPLETION_LABEL[level],
                })),
              ]}
            />
          </View>
          {/* A percentage is only a question for a run that is not 100% — at
              100% the answer is already given. */}
          {completion !== 'full' ? (
            <TextField
              variant="row"
              label="Progress %"
              value={percent}
              onChangeText={setPercent}
              keyboardType="numeric"
              placeholder="—"
              error={percentError}
            />
          ) : null}
          <TextField
            variant="row"
            label="Hours"
            value={hours}
            onChangeText={setHours}
            keyboardType="numeric"
            placeholder="0"
            error={hoursError}
          />
        </InsetGroup>

        <InsetGroup>
          <TextField
            variant="row"
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={MAX_NOTES}
            accessibilityLabel="Notes"
            placeholder="Notes — difficulty, mods, who you played it with…"
            hint={notes.length > 0 ? `${notes.length}/${MAX_NOTES}` : undefined}
          />
        </InsetGroup>

        {error && (
          <Text variant="bodySmall" color="danger">
            {error instanceof Error ? error.message : 'Could not save this playthrough.'}
          </Text>
        )}
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

/** "Not finished" — no completion — as a segment's value. */
const NOT_FINISHED = 'none';

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: Spacing.x24, paddingTop: Spacing.x16, paddingBottom: Spacing.x48 },
  head: { gap: Spacing.x4 },
  segments: { padding: Spacing.x12 },
});
