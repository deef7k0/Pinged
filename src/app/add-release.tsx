import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { ChoiceChips } from '@/components/choice-chips';
import { GamePicker } from '@/components/game-picker';
import { Button } from '@/components/ui/button';
import { CARD_INSET, cardShape } from '@/components/ui/card-material';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { IconButton } from '@/components/ui/icon-button';
import { PageScrollView } from '@/components/ui/page-scroll';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { SelectField } from '@/components/ui/select-field';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import {
  CONTRIBUTION_STATUS_LABEL,
  PHOTO_KINDS,
  PHOTO_KIND_LABEL,
  REGION_HINT,
  REGION_LABEL,
  REGIONS,
  releaseLine,
} from '@/constants/physical';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  getContribution,
  getRelease,
  submitReleaseContribution,
  updateReleaseContribution,
  withdrawReleaseContribution,
  type ContributionPhoto,
  type ContributionWithRelations,
} from '@/lib/api';
import { displayBarcode, normalizeBarcode } from '@/lib/barcode';
import type { ContributionResult, ReleasePhotoKind, ReleaseRegion } from '@/lib/database.types';
import { getGameById, type Game } from '@/lib/games';
import { platformOptionsFor } from '@/lib/platform-options';
import { useAuth } from '@/store/auth';
import { showAlert } from '@/components/ui/dialog';
import { toast } from '@/lib/toast';

/** The database accepts eight per submission (0024); so does the form. */
const MAX_PHOTOS = 8;

/**
 * Photos are evidence, not artwork: enough resolution to read an edition marking
 * or a catalogue number, and small enough that eight of them upload over a phone
 * connection before the reader gives up.
 */
const PHOTO_QUALITY = 0.6;

/**
 * Tell Gamelog what an unknown barcode is — or edit what you already told it.
 *
 * Params: `barcode` (required for a new submission), `game` to preselect, and
 * `contribution` to edit your own pending one.
 *
 * ## What happens to it
 *
 * Nothing you type here is published as fact. It becomes a *contribution*
 * (0024): pending until a second person holding the same box describes it the
 * same way, or a moderator approves it. Only then does the barcode resolve for
 * everybody. Every outcome the database can return is answered here — see
 * `ResultView` — and each one offers the next thing to do, so an unknown barcode
 * never ends a session with nothing to show for it: the copy can be added right
 * away, pointing at the pending claim, and it gains its release the moment the
 * claim is approved.
 *
 * ## Only what is needed
 *
 * Game, platform, region and edition — the four things that make a release a
 * release. Publisher, date, catalogue number, notes and photos are all optional
 * and folded away, because a form that demands a catalogue number from someone
 * holding a box they bought second-hand is a form nobody finishes.
 */
export default function AddReleaseScreen() {
  const params = useLocalSearchParams<{
    barcode?: string;
    game?: string;
    contribution?: string;
    /** A platform's short form to start from — a ScanDex match knows it. */
    platform?: string;
  }>();
  const userId = useAuth((state) => state.session?.user.id) ?? null;
  const [pickedGameId, setPickedGameId] = useState<string | null>(null);
  const [changingGame, setChangingGame] = useState(false);

  const existing = useQuery({
    queryKey: ['contribution', params.contribution],
    queryFn: () => getContribution(params.contribution!),
    enabled: !!params.contribution,
  });

  const code = existing.data?.barcode ?? normalizeBarcode(params.barcode ?? '');
  const gameId = pickedGameId ?? existing.data?.game_id ?? params.game ?? null;

  const game = useQuery({
    queryKey: ['game', gameId],
    queryFn: ({ signal }) => getGameById(gameId!, signal),
    enabled: !!gameId,
    staleTime: 30 * 60_000,
  });

  let body: React.ReactNode;
  if (!userId) {
    body = <EmptyState title="Sign in to add a release" />;
  } else if (params.contribution && existing.isLoading) {
    body = <LoadingState />;
  } else if (params.contribution && !existing.data) {
    body = existing.isLoadingError ? (
      <ErrorState error={existing.error} onRetry={() => void existing.refetch()} />
    ) : (
      <EmptyState title="That submission is gone" message="It may have been withdrawn." />
    );
  } else if (existing.data && existing.data.status !== 'pending') {
    /* Only a pending claim can change. Once decided it is part of the record,
       and the reader is told how it was decided rather than handed a form that
       would be refused. */
    body = (
      <EmptyState
        title={CONTRIBUTION_STATUS_LABEL[existing.data.status]}
        message={
          existing.data.review_note ??
          'This submission has been decided, so it can no longer be edited.'
        }
      />
    );
  } else if (!code) {
    body = (
      <EmptyState
        title="No barcode"
        message="Scan the barcode on the box first — a release is added for a barcode."
      />
    );
  } else if (!gameId || changingGame) {
    body = (
      <GamePicker
        heading="Which game is this?"
        prompt={{
          title: `Barcode ${displayBarcode(code)}`,
          message: 'Search for the game in the box, then tap it.',
        }}
        onPick={(id) => {
          setPickedGameId(id);
          setChangingGame(false);
        }}
      />
    );
  } else if (game.isLoading) {
    body = <LoadingState />;
  } else if (game.isLoadingError || !game.data) {
    body = game.isLoadingError ? (
      <ErrorState error={game.error} onRetry={() => void game.refetch()} />
    ) : (
      <EmptyState title="Game not found" />
    );
  } else {
    body = (
      <ReleaseForm
        key={`${game.data.id}:${existing.data?.id ?? 'new'}`}
        userId={userId}
        code={code}
        game={game.data}
        existing={existing.data ?? null}
        suggestedPlatform={params.platform ?? null}
        onChangeGame={() => setChangingGame(true)}
      />
    );
  }

  return (
    <Screen
      edges={['bottom']}
      insetHeader
      modal
      topBar={
        <FrostedTopBar
          dismiss
          title={existing.data ? 'Edit your submission' : 'Add this release'}
        />
      }>
      {body}
    </Screen>
  );
}

function ReleaseForm({
  userId,
  code,
  game,
  existing,
  suggestedPlatform,
  onChangeGame,
}: {
  userId: string;
  code: string;
  game: Game;
  existing: ContributionWithRelations | null;
  suggestedPlatform: string | null;
  onChangeGame: () => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [platform, setPlatform] = useState(existing?.platform ?? suggestedPlatform ?? '');
  const [region, setRegion] = useState<ReleaseRegion | null>(existing?.region ?? null);
  const [edition, setEdition] = useState(existing?.edition ?? 'Standard');
  const [more, setMore] = useState(
    !!(existing?.publisher || existing?.release_date || existing?.catalog_number || existing?.notes)
  );
  const [publisher, setPublisher] = useState(existing?.publisher ?? '');
  const [releaseDate, setReleaseDate] = useState(existing?.release_date ?? '');
  const [catalog, setCatalog] = useState(existing?.catalog_number ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [photos, setPhotos] = useState<ContributionPhoto[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [result, setResult] = useState<ContributionResult | null>(null);

  const platformOptions = useMemo(
    () =>
      platformOptionsFor(game.platforms, existing?.platform, theme.textSecondary, {
        physicalOnly: true,
      }),
    [game.platforms, existing?.platform, theme.textSecondary]
  );

  const dateError =
    releaseDate.trim() && !isIsoDate(releaseDate.trim())
      ? 'Use the form 2019-01-25, or leave it empty.'
      : null;
  const missing = !platform ? 'Choose the platform.' : !region ? 'Choose the region.' : null;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['barcode', code] });
    queryClient.invalidateQueries({ queryKey: ['my-contributions', userId] });
    queryClient.invalidateQueries({ queryKey: ['moderation-queue'] });
    queryClient.invalidateQueries({ queryKey: ['game-releases', game.id] });
    if (existing) queryClient.invalidateQueries({ queryKey: ['contribution', existing.id] });
  }

  const submit = useMutation({
    mutationFn: async () => {
      if (missing ?? dateError) throw new Error(missing ?? dateError!);
      const input = {
        game,
        platform,
        region: region!,
        edition: edition.trim() || 'Standard',
        publisher: publisher.trim() || null,
        releaseDate: releaseDate.trim() || null,
        catalogNumber: catalog.trim() || null,
        notes: notes.trim() || null,
      };
      return existing
        ? updateReleaseContribution(existing.id, input)
        : submitReleaseContribution(userId, { ...input, barcode: code }, photos);
    },
    onSuccess: (outcome) => {
      toast.success('Release submitted');
      invalidate();
      setResult(outcome);
    },
  });

  const withdraw = useMutation({
    mutationFn: () => withdrawReleaseContribution(existing!.id),
    onSuccess: () => {
      toast.success('Claim withdrawn');
      invalidate();
      router.back();
    },
  });

  async function addPhoto(source: 'camera' | 'library') {
    setPhotoError(null);
    if (photos.length >= MAX_PHOTOS) return;

    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setPhotoError(
          'Camera access is needed to take a photo. You can choose one from your library instead.'
        );
        return;
      }
    }

    const picked =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: PHOTO_QUALITY })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: PHOTO_QUALITY,
          });
    if (picked.canceled || !picked.assets[0]) return;

    const uri = picked.assets[0].uri;
    setPhotos((current) => [...current, { kind: nextPhotoKind(current), localUri: uri }]);
  }

  function confirmWithdraw() {
    showAlert(
      'Withdraw this submission?',
      'It is removed from the review queue. You can submit the barcode again later.',
      [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Withdraw', style: 'destructive', onPress: () => withdraw.mutate() },
      ]
    );
  }

  if (result) {
    return <ResultView result={result} game={game} onEdit={() => setResult(null)} />;
  }

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
          <Text variant="bodySmall" color="textMuted">
            Barcode {displayBarcode(code)}
          </Text>
        </View>

        <View
          style={[
            cardShape,
            styles.gameRow,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}>
          <Poster
            coverUrl={game.coverUrl}
            heroUrl={game.heroUrl}
            title={game.title}
            width={48}
            rounded="image"
          />
          <View style={styles.flex}>
            <Text variant="label" color="textMuted">
              Game
            </Text>
            <Text variant="h5" numberOfLines={2}>
              {game.title}
            </Text>
          </View>
          <Button title="Change" size="small" variant="ghost" onPress={onChangeGame} />
        </View>

        <SelectField
          label="Platform"
          sheetTitle="Platform"
          value={platform}
          options={platformOptions}
          onChange={setPlatform}
          placeholder="Choose"
          clearable={false}
        />

        <ChoiceChips
          label="Region"
          choices={REGIONS.map((value) => ({
            value,
            label: REGION_LABEL[value],
            hint: REGION_HINT[value],
          }))}
          value={region}
          onChange={setRegion}
          clearable={false}
        />

        <TextField
          label="Edition"
          value={edition}
          onChangeText={setEdition}
          placeholder="Standard"
          maxLength={80}
          hint="As printed on the box — Standard, Platinum, Greatest Hits, Collector’s…"
        />

        {/* ---------------------------------------------------- optional */}
        <PressableScale
          accessibilityRole="button"
          accessibilityState={{ expanded: more }}
          onPress={() => setMore((open) => !open)}
          scaleTo={0.98}
          style={styles.moreToggle}>
          <Text variant="h5" color="textSecondary">
            More details
          </Text>
          <Text variant="caption" color="textMuted" style={styles.flex}>
            Optional
          </Text>
          <Ionicons name={more ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textMuted} />
        </PressableScale>

        {more && (
          <View style={styles.more}>
            <TextField
              label="Publisher"
              value={publisher}
              onChangeText={setPublisher}
              maxLength={80}
            />
            <View style={styles.row}>
              <View style={styles.flex}>
                <TextField
                  label="Release date"
                  value={releaseDate}
                  onChangeText={setReleaseDate}
                  placeholder="1998-04-29"
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                  error={dateError}
                />
              </View>
              <View style={styles.flex}>
                <TextField
                  label="Catalogue number"
                  value={catalog}
                  onChangeText={setCatalog}
                  placeholder="SLES-00972"
                  autoCapitalize="characters"
                  maxLength={40}
                />
              </View>
            </View>
            <TextField
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              multiline
              maxLength={500}
              placeholder="Anything that tells this box apart from another"
              hint={`${notes.length}/500`}
            />
          </View>
        )}

        {/* ------------------------------------------------------ photos */}
        {!existing && (
          <View style={styles.photos}>
            <Text variant="label" color="textMuted" accessibilityRole="header">
              Photos · optional
            </Text>
            <Text variant="caption" color="textMuted">
              The front, the back and the barcode are what a reviewer checks first.
            </Text>

            {photos.map((photo, index) => (
              <View key={`${photo.localUri}-${index}`} style={styles.photoRow}>
                <Image
                  source={{ uri: photo.localUri }}
                  style={[styles.thumb, { backgroundColor: theme.surfaceElevated }]}
                  contentFit="cover"
                  accessibilityIgnoresInvertColors
                />
                <View style={styles.flex}>
                  <SelectField
                    value={photo.kind}
                    options={PHOTO_KINDS.map((kind) => ({
                      value: kind,
                      label: PHOTO_KIND_LABEL[kind],
                    }))}
                    sheetTitle="What does it show?"
                    clearable={false}
                    onChange={(kind) =>
                      setPhotos((current) =>
                        current.map((entry, at) =>
                          at === index ? { ...entry, kind: kind as ReleasePhotoKind } : entry
                        )
                      )
                    }
                  />
                </View>
                <IconButton
                  icon="close"
                  size="small"
                  tone="plain"
                  accessibilityLabel={`Remove the ${PHOTO_KIND_LABEL[photo.kind].toLowerCase()} photo`}
                  onPress={() => setPhotos((current) => current.filter((_, at) => at !== index))}
                />
              </View>
            ))}

            {photos.length < MAX_PHOTOS && (
              <View style={styles.row}>
                {Platform.OS !== 'web' && (
                  <View style={styles.flex}>
                    <Button
                      title="Take a photo"
                      icon="camera-outline"
                      variant="secondary"
                      size="small"
                      fullWidth
                      onPress={() => void addPhoto('camera')}
                    />
                  </View>
                )}
                <View style={styles.flex}>
                  <Button
                    title="Choose one"
                    icon="images-outline"
                    variant="secondary"
                    size="small"
                    fullWidth
                    onPress={() => void addPhoto('library')}
                  />
                </View>
              </View>
            )}
            {photoError && (
              <Text variant="bodySmall" color="danger">
                {photoError}
              </Text>
            )}
          </View>
        )}

        {submit.isError && (
          <Text variant="bodySmall" color="danger">
            {submit.error instanceof Error ? submit.error.message : 'Could not submit that.'}
          </Text>
        )}

        <Button
          title={existing ? 'Save changes' : 'Submit release'}
          fullWidth
          loading={submit.isPending}
          disabled={!!missing || !!dateError || withdraw.isPending}
          onPress={() => submit.mutate()}
        />
        {missing && (
          <Text variant="caption" color="textMuted" style={styles.centred}>
            {missing}
          </Text>
        )}

        {existing && (
          <Button
            title="Withdraw submission"
            variant="danger"
            fullWidth
            loading={withdraw.isPending}
            disabled={submit.isPending}
            onPress={confirmWithdraw}
          />
        )}
      </PageScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * What the database said, and what to do next.
 *
 * Each of the four outcomes ends on an action rather than a dead end — which is
 * the whole difference between a barcode database that grows and a form people
 * fill in once.
 */
function ResultView({
  result,
  game,
  onEdit,
}: {
  result: ContributionResult;
  game: Game;
  onEdit: () => void;
}) {
  const theme = useTheme();
  const router = useRouter();

  const release = useQuery({
    queryKey: ['release', result.status === 'exists' ? result.release_id : null],
    queryFn: () => getRelease((result as { release_id: string }).release_id),
    enabled: result.status === 'exists',
  });

  const done = () => router.back();

  let icon: keyof typeof Ionicons.glyphMap;
  let title: string;
  let message: string;
  let actions: React.ReactNode;

  switch (result.status) {
    case 'approved':
      icon = 'checkmark-circle';
      title = 'It’s in the database';
      message =
        'Your description matched another player’s, so the barcode now finds this release for everyone.';
      actions = (
        <Button
          title="Add it to my copies"
          icon="add"
          fullWidth
          onPress={() =>
            router.replace({
              pathname: '/add-copy',
              params: { game: game.id, release: result.release_id },
            })
          }
        />
      );
      break;
    case 'pending':
      icon = 'time';
      title = 'Thanks — it’s waiting for review';
      message =
        'It goes in once someone else with the same box confirms it, or a moderator approves it. You can add your copy now; it links to the release by itself when that happens.';
      actions = (
        <Button
          title="Add it to my copies"
          icon="add"
          fullWidth
          onPress={() =>
            router.replace({
              pathname: '/add-copy',
              params: { game: game.id, contribution: result.contribution_id },
            })
          }
        />
      );
      break;
    case 'duplicate':
      icon = 'information-circle';
      title = 'You’ve already submitted this barcode';
      message = 'One submission per barcode per person. You can edit the one you made.';
      actions = (
        <Button
          title="Edit my submission"
          fullWidth
          onPress={() =>
            router.replace({
              pathname: '/add-release',
              params: { contribution: result.contribution_id },
            })
          }
        />
      );
      break;
    case 'exists':
      icon = 'albums';
      title = 'This barcode already exists';
      message = 'Someone added it while you were filling this in. This is the release it finds:';
      actions = release.data ? (
        <>
          <View
            style={[
              cardShape,
              styles.gameRow,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <Poster
              coverUrl={release.data.game?.cover_url ?? null}
              heroUrl={release.data.game?.hero_url ?? null}
              title={release.data.game?.title ?? ''}
              width={48}
              rounded="image"
            />
            <View style={styles.flex}>
              <Text variant="h5" numberOfLines={2}>
                {release.data.game?.title ?? 'Unknown game'}
              </Text>
              <Text variant="bodySmall" color="textSecondary">
                {releaseLine(release.data)}
              </Text>
            </View>
          </View>
          <Button
            title="Add it to my copies"
            icon="add"
            fullWidth
            onPress={() =>
              router.replace({
                pathname: '/add-copy',
                params: { game: release.data!.game_id, release: release.data!.id },
              })
            }
          />
        </>
      ) : release.isLoading ? (
        <LoadingState />
      ) : null;
      break;
  }

  return (
    <PageScrollView contentContainerStyle={styles.result}>
      <Ionicons name={icon} size={44} color={theme.textSecondary} />
      <Text variant="h2" style={styles.centred} accessibilityLiveRegion="polite">
        {title}
      </Text>
      <Text variant="body" color="textSecondary" style={styles.centred}>
        {message}
      </Text>
      <View style={styles.stack}>
        {actions}
        {result.status === 'pending' && (
          <Button title="Edit what I sent" variant="secondary" fullWidth onPress={onEdit} />
        )}
        <Button title="Done" variant="ghost" fullWidth onPress={done} />
      </View>
    </PageScrollView>
  );
}

/** The first evidence kind not yet used, in the order a reviewer wants them. */
function nextPhotoKind(current: ContributionPhoto[]): ReleasePhotoKind {
  const used = new Set(current.map((photo) => photo.kind));
  return PHOTO_KINDS.find((kind) => kind !== 'other' && !used.has(kind)) ?? 'other';
}

/** `YYYY-MM-DD` that is also a real calendar date — no 2019-02-30. */
function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.x16, gap: Spacing.x24, paddingBottom: Spacing.x48 },
  head: { gap: Spacing.x4 },
  /* Every card's material (`card-material`). */
  gameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12, padding: CARD_INSET },
  row: { flexDirection: 'row', gap: Spacing.x8 },
  moreToggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8, minHeight: TapTarget },
  more: { gap: Spacing.x16 },
  photos: { gap: Spacing.x8 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  thumb: { width: 56, height: 56, borderRadius: Radius.image },
  centred: { textAlign: 'center' },
  result: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x16,
    padding: Spacing.x24,
  },
  stack: { gap: Spacing.x8, alignSelf: 'stretch' },
});
