import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useBarConfirm } from '@/hooks/use-bar-confirm';
import { copyArtQuery, prefetchCopyArt } from '@/hooks/use-copy-art';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { GamePicker } from '@/components/game-picker';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageScrollView } from '@/components/ui/page-scroll';
import { InsetGroup, Row } from '@/components/ui/inset-group';
import { PartialDateRow } from '@/components/ui/partial-date-row';
import { PullDownRow } from '@/components/ui/pull-down-row';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import {
  COMPLETENESS_HINT,
  CONDITION_HINT,
  CONDITION_LABEL,
  CONDITIONS,
  REGION_HINT,
  REGION_LABEL,
  REGIONS,
  completenessChoices,
  completenessLabel,
  mediumFor,
  releaseLine,
} from '@/constants/physical';
import { platformKeyForStored } from '@/constants/platform-family';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  addCopy,
  getContribution,
  getCopy,
  getGameReleases,
  updateCopy,
  type ContributionWithRelations,
  type CopyWithRelations,
} from '@/lib/api';
import type {
  CopyCompleteness,
  CopyCondition,
  GameReleaseRow,
  ReleaseRegion,
} from '@/lib/database.types';
import { getGameById, type Game } from '@/lib/games';
import { platformOptionsFor } from '@/lib/platform-options';
import { useAuth } from '@/store/auth';
import { toast } from '@/lib/toast';

const MAX_NOTES = 500;

/**
 * Add a physical copy you own, or edit one.
 *
 * Params, all optional:
 *   game          the game, when the flow starts from one (its page, a scan)
 *   release       a known release to preselect (a barcode that resolved)
 *   contribution  a pending barcode claim this copy should wait on
 *   copy          an existing copy to edit
 *
 * ## Three entry points, one form
 *
 * From a game page ("I own a copy" in the Collect sheet), from a resolved scan
 * (the release is already known), and from an unknown barcode after its release
 * was submitted (the release does not exist yet). The third is the one that
 * matters: the copy is saved *now*, pointing at the pending claim, and the
 * database attaches the release to it the moment the claim is approved — so
 * nobody has to come back and add the copy a second time.
 *
 * Game, then release, then the copy itself. A game is picked by search when
 * none was passed in.
 */
export default function AddCopyScreen() {
  const params = useLocalSearchParams<{
    game?: string;
    release?: string;
    contribution?: string;
    copy?: string;
    /** A platform's short form to start from — a ScanDex match knows it. */
    platform?: string;
  }>();
  const userId = useAuth((state) => state.session?.user.id) ?? null;
  const [pickedGameId, setPickedGameId] = useState<string | null>(null);

  const existing = useQuery({
    queryKey: ['copy', params.copy],
    queryFn: () => getCopy(params.copy!),
    enabled: !!params.copy,
  });

  const contribution = useQuery({
    queryKey: ['contribution', params.contribution],
    queryFn: () => getContribution(params.contribution!),
    enabled: !!params.contribution,
  });

  const gameId = params.game ?? existing.data?.game_id ?? pickedGameId;

  const game = useQuery({
    queryKey: ['game', gameId],
    queryFn: ({ signal }) => getGameById(gameId!, signal),
    enabled: !!gameId,
    staleTime: 30 * 60_000,
  });

  const releases = useQuery({
    queryKey: ['game-releases', gameId],
    queryFn: () => getGameReleases(gameId!),
    enabled: !!gameId,
    staleTime: 5 * 60_000,
  });

  let body: React.ReactNode;
  if (!userId) {
    body = <EmptyState icon="disc-outline" title="Sign in to add your copies" />;
  } else if (params.copy && existing.isLoading) {
    body = <LoadingState />;
  } else if (params.copy && !existing.data) {
    body = existing.isLoadingError ? (
      <ErrorState error={existing.error} onRetry={() => void existing.refetch()} />
    ) : (
      <EmptyState
        icon="disc-outline"
        title="That copy is gone"
        message="It may have been deleted."
      />
    );
  } else if (!gameId) {
    body = (
      <GamePicker
        heading="Add a copy"
        prompt={{ title: 'Which game?', message: 'Search, then tap the game you own a copy of.' }}
        onPick={setPickedGameId}
      />
    );
  } else if (game.isLoading || releases.isLoading || contribution.isLoading) {
    body = <LoadingState />;
  } else if (game.isLoadingError || releases.isLoadingError) {
    body = (
      <ErrorState
        error={game.error ?? releases.error}
        onRetry={() => {
          void game.refetch();
          void releases.refetch();
        }}
      />
    );
  } else if (!game.data) {
    body = <EmptyState icon="search" title="Game not found" />;
  } else {
    body = (
      <CopyForm
        key={`${game.data.id}:${existing.data?.id ?? 'new'}`}
        userId={userId}
        game={game.data}
        releases={releases.data ?? []}
        existing={existing.data ?? null}
        preselectedRelease={params.release ?? null}
        contribution={contribution.data ?? null}
        suggestedPlatform={params.platform ?? null}
      />
    );
  }

  return (
    <Screen
      edges={['bottom']}
      insetHeader
      modal
      topBar={<FrostedTopBar dismiss title={existing.data ? 'Edit copy' : 'Add a copy'} />}>
      {body}
    </Screen>
  );
}

/** "A release from the database" or "describe it yourself". */
type ReleaseChoice = { kind: 'release'; id: string } | { kind: 'describe' };

function CopyForm({
  userId,
  game,
  releases,
  existing,
  preselectedRelease,
  contribution,
  suggestedPlatform,
}: {
  userId: string;
  game: Game;
  releases: GameReleaseRow[];
  existing: CopyWithRelations | null;
  preselectedRelease: string | null;
  contribution: ContributionWithRelations | null;
  suggestedPlatform: string | null;
}) {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  /* A pending claim describes the box already; start from what it says. */
  const seed = existing ?? contribution;
  const startRelease = existing?.release_id ?? preselectedRelease;

  const [choice, setChoice] = useState<ReleaseChoice>(
    startRelease && releases.some((release) => release.id === startRelease)
      ? { kind: 'release', id: startRelease }
      : { kind: 'describe' }
  );
  const [platform, setPlatform] = useState(seed?.platform ?? suggestedPlatform ?? '');
  const [region, setRegion] = useState<ReleaseRegion | null>(seed?.region ?? null);
  const [edition, setEdition] = useState(seed?.edition ?? '');
  const [completeness, setCompleteness] = useState<CopyCompleteness | null>(
    existing?.completeness ?? null
  );
  const [condition, setCondition] = useState<CopyCondition | null>(existing?.condition ?? null);
  const [acquiredOn, setAcquiredOn] = useState<string | null>(existing?.acquired_on ?? null);
  const [notes, setNotes] = useState(existing?.notes ?? '');

  const chosenRelease =
    choice.kind === 'release'
      ? (releases.find((release) => release.id === choice.id) ?? null)
      : null;

  /* The platform the copy is on, whichever way it was given, decides what
     "loose" is called and whether "game + manual" is offered at all. */
  const platformKey = platformKeyForStored(chosenRelease?.platform ?? platform);
  const medium = mediumFor(platformKey);

  const platformOptions = useMemo(
    () =>
      platformOptionsFor(game.platforms, seed?.platform, theme.textSecondary, {
        physicalOnly: true,
      }),
    [game.platforms, seed?.platform, theme.textSecondary]
  );

  /* A copy waiting on a claim keeps waiting unless a real release is chosen. */
  const waitingOn =
    choice.kind === 'describe' ? (existing?.contribution_id ?? contribution?.id ?? null) : null;

  const describeMissing = choice.kind === 'describe' && !platform;

  function invalidate(copyId?: string) {
    queryClient.invalidateQueries({ queryKey: ['copies', userId] });
    queryClient.invalidateQueries({ queryKey: ['user-game-stats', userId] });
    if (copyId) queryClient.invalidateQueries({ queryKey: ['copy', copyId] });
  }

  const save = useMutation({
    mutationFn: async () => {
      const input = {
        releaseId: chosenRelease?.id ?? null,
        contributionId: waitingOn,
        platform: chosenRelease ? null : platform || null,
        region: chosenRelease ? null : region,
        edition: chosenRelease ? null : edition,
        completeness,
        condition,
        notes,
        acquiredOn,
      };
      if (existing) {
        await updateCopy(existing.id, input);
        return existing.id;
      }
      return addCopy(userId, game, input);
    },
    onSuccess: (copyId) => {
      toast.success('Saved to your physical collection');
      invalidate(copyId);
      /* Its back cover and disc label, looked up as it is added (the owner's,
         2026-10-22) — from the release's platform and region when one was
         chosen, else what was typed. */
      prefetchCopyArt(
        queryClient,
        copyArtQuery({
          game: { title: game.title } as CopyWithRelations['game'],
          platform: chosenRelease?.platform ?? platform ?? null,
          region: (chosenRelease?.region ?? region ?? null) as CopyWithRelations['region'],
        })
      );
      /* A new copy lands on its own page, which is the confirmation; an edit
         goes back to the page it came from, which already shows it. */
      if (existing) router.back();
      else router.replace({ pathname: '/copy/[id]', params: { id: copyId } });
    },
  });

  useBarConfirm({
    label: existing ? 'Save copy' : 'Add to my copies',
    onPress: () => save.mutate(),
    loading: save.isPending,
    disabled: describeMissing,
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
        <View style={styles.head}>
          <Text variant="h2" numberOfLines={2}>
            {game.title}
          </Text>
        </View>

        {/*
          Every field a row (the Apple pass, 2026-11-05): the release as a
          checklist of one, the facts as pull-downs, the date a row opening a
          tray, the notes a row that grows. It was selection cards, chips and
          labelled wells.
        */}
        {releases.length > 0 ? (
          <InsetGroup header="Which release">
            {releases.map((release) => (
              <ReleaseRow
                key={release.id}
                title={releaseLine(release)}
                subtitle={release.publisher ?? null}
                selected={choice.kind === 'release' && choice.id === release.id}
                onPress={() => setChoice({ kind: 'release', id: release.id })}
              />
            ))}
            <ReleaseRow
              title="Not listed"
              subtitle="Describe it yourself"
              selected={choice.kind === 'describe'}
              onPress={() => setChoice({ kind: 'describe' })}
            />
          </InsetGroup>
        ) : (
          <Text variant="bodySmall" color="textMuted" style={styles.note}>
            No releases of this game are in the database yet. Describe yours below — or scan its
            barcode, and the next person with the same box will find it.
          </Text>
        )}

        {waitingOn && (
          <View style={[styles.notice, { borderColor: theme.border }]}>
            <Ionicons name="time-outline" size={16} color={theme.textSecondary} />
            <Text variant="bodySmall" color="textSecondary" style={styles.flex}>
              Waiting on your barcode submission. This copy links to the release by itself once it
              is approved.
            </Text>
          </View>
        )}

        {choice.kind === 'describe' && (
          <InsetGroup
            header="Your release"
            footer={describeMissing ? 'Choose the platform your copy is for.' : undefined}>
            <PullDownRow
              title="Platform"
              choices={platformOptions}
              value={platform || null}
              onChange={(next) => setPlatform(next ?? '')}
            />
            <PullDownRow
              title="Region"
              choices={REGIONS.map((value) => ({
                value,
                label: REGION_LABEL[value],
                hint: REGION_HINT[value],
              }))}
              value={region}
              onChange={setRegion}
              anyLabel="Not sure"
            />
            <TextField
              variant="row"
              label="Edition"
              value={edition}
              onChangeText={setEdition}
              placeholder="Standard"
              maxLength={80}
            />
          </InsetGroup>
        )}

        {/* What came with it and its condition are independent, on purpose:
            complete-in-box and battered is not loose and mint. */}
        <InsetGroup header="This copy">
          <PullDownRow
            title="What came with it"
            choices={completenessChoices(platformKey).map((value) => ({
              value,
              label: completenessLabel(value, medium),
              hint: COMPLETENESS_HINT[value],
            }))}
            value={completeness}
            onChange={setCompleteness}
            anyLabel="Not sure"
          />
          <PullDownRow
            title="Condition"
            choices={CONDITIONS.map((value) => ({
              value,
              label: CONDITION_LABEL[value],
              hint: CONDITION_HINT[value],
            }))}
            value={condition}
            onChange={setCondition}
            anyLabel="Not sure"
          />
          <PartialDateRow title="Got it" value={acquiredOn} onChange={setAcquiredOn} />
        </InsetGroup>

        <InsetGroup>
          <TextField
            variant="row"
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={MAX_NOTES}
            accessibilityLabel="Notes"
            placeholder="Notes — original case, tiny crack on the front…"
            hint={notes.length > 0 ? `${notes.length}/${MAX_NOTES}` : undefined}
          />
        </InsetGroup>

        {save.isError && (
          <Text variant="bodySmall" color="danger">
            {save.error instanceof Error ? save.error.message : 'Could not save this copy.'}
          </Text>
        )}
      </PageScrollView>
    </KeyboardAvoidingView>
  );
}

/** One row of the release checklist: its line, the publisher, a check when chosen. */
function ReleaseRow({
  title,
  subtitle,
  selected,
  onPress,
}: {
  title: string;
  subtitle: string | null;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Row
      title={title}
      subtitle={subtitle ?? undefined}
      onPress={onPress}
      accessibilityLabel={`${subtitle ? `${title}, ${subtitle}` : title}${selected ? ', chosen' : ''}`}
      trailing={selected ? <Ionicons name="checkmark" size={20} color={theme.text} /> : undefined}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.x16, gap: Spacing.x24, paddingBottom: Spacing.x48 },
  head: { gap: Spacing.x4 },
  note: { paddingHorizontal: Spacing.x16 },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.x8,
    padding: Spacing.x12,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  centred: { textAlign: 'center' },
});
