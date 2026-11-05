/*
 * DIRECTION — the copy screen (impeccable, surface seed 4add57d0)
 *
 * THESIS: A copy is an object to handle, not a record to read. It stands alone
 * and drifts round until a finger takes over. Refused: a detail page with a
 * picture at the top and a list of facts under it.
 * OWN-WORLD: the app's dark room in the game's own tone; one lamp and the
 * shadow it throws; the case as a box of plastic with a depth and an inside.
 * (It stood on a ring of light. The owner had the ring removed.)
 * STORY: they turn it, open it, lift the disc out, tilt the phone to move the
 * light — and learn what this copy is from the object itself.
 * FIRST VIEWPORT: the stage alone, edge to edge: the case at 82% of the width,
 * a centred two-line caption, three round keys; the top of Notes shows as the
 * cue to scroll.
 * FORM: "On the turntable", fourth of seven ranked structures.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the
 * finish review, the verdict, and DESIGN.md.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import {
  CopyShowcase,
  copyStage,
  type CopySide,
  type CopyStageMode,
} from '@/components/copy-showcase';
import { STAGE_KEY_WIDTH, StageKey } from '@/components/copy-stage-key';
import { copyRecordLine } from '@/components/copy-case-back';
import { formatReleaseDate } from '@/lib/games/release';
import { ReviewQuote } from '@/components/review-quote';
import { Button } from '@/components/ui/button';
import { FrostedTopBar, TopBarDisc } from '@/components/ui/frosted-top-bar';
import { PageScrollView } from '@/components/ui/page-scroll';
import { PressableScale } from '@/components/ui/pressable-scale';
import { RichText } from '@/components/ui/rich-text';
import { EmptyState, ErrorState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { stageMetrics } from '@/constants/copy-stage';
import { CONTRIBUTION_STATUS_LABEL } from '@/constants/physical';
import { CASE_TEMPLATE_SIZE } from '@/constants/platform-cases';
import { platformKeyForStored } from '@/constants/platform-family';
import { Radius, Spacing, Type } from '@/constants/theme';
import { AccentProvider, useAccent, useGameAccent } from '@/hooks/use-accent';
import { useCopyMesh } from '@/hooks/use-copy-mesh';
import { SKIA_AVAILABLE } from '@/lib/skia-available';
import { MeshBackdrop } from '@/components/ui/mesh-backdrop';
import { useCopyArt } from '@/hooks/use-copy-art';
import { useDiscRoom } from '@/hooks/use-header-height';
import { CAPTION_ROOM, useStageRoom } from '@/hooks/use-copy-stage-room';
import { useTheme } from '@/hooks/use-theme';
import {
  COPY_NOTES_MAX,
  deleteCopy,
  getCopy,
  getLogOf,
  updateCopyNotes,
  type CopyWithRelations,
} from '@/lib/api';
import { recallCopy } from '@/lib/api/seen-copies';
import { displayNameFor } from '@/lib/format';
import { cardShows } from '@/lib/review-quote';
import { useAuth } from '@/store/auth';
import { showAlert } from '@/components/ui/dialog';
import { toast } from '@/lib/toast';

/** Lines of the review its card prints — the reviews sheet's own measure. */
const REVIEW_LINES = 10;

/** How long the caption says a sealed copy would not open, before it goes back. */
const REFUSAL_MS = 2600;

/**
 * One physical copy, turning on its stage.
 *
 * **The first screen is the object and nothing else.** `<CopyShowcase>` runs
 * edge to edge: the copy's case, as a box, under one lamp in the game's own
 * colour, turning slowly by itself. Drag it and it turns with the finger; tap
 * the cover and it opens on the disc; lift the disc out and it stands there
 * alone; tilt the phone and the lamp moves. It is a screen
 * to stay on — the owner's brief was "stare at it for a minute or more" — so
 * everything that is not the object is either one quiet line under it or below
 * the fold.
 *
 * Under the stage, centred on its axis: the game's name (the door to its
 * page), a line that follows whichever side is toward the reader, and the keys
 * — each the twin of a gesture, for a thumb that would rather press and for a
 * screen reader that cannot drag.
 *
 * **What this copy is — release, what is in the box, condition, when it was
 * got — is printed on the back of the case and nowhere else**, at the owner's
 * direction, and the caption does not repeat it: on the back it only says that
 * it is the back. Below the fold are the things that are the owner's own words:
 * a notes field, saved as it is left, and their review of the game if they
 * wrote one, as the card the reviews sheet uses. No price, anywhere: condition
 * describes a copy, it does not value it.
 *
 * A full screen on the game's own colour, like the game page — it is a screen
 * about one game, and the one where a case is an object you can pick up
 * (DESIGN.md § 4.3).
 */
export default function CopyScreen() {
  const { id, handover } = useLocalSearchParams<{ id: string; handover?: string }>();
  /* Opened from the physical shelf's Cover Flow, which has already flown the
     cover to where the case stands and faded the moving colours in: the case
     is there at once, square on, and the colours do not fade in again. */
  const handedOver = handover === '1';

  const copy = useQuery({
    queryKey: ['copy', id],
    queryFn: () => getCopy(id!),
    enabled: !!id,
    /* The binder, the copies list and the game page each fetched this copy
       whole to draw the row that was tapped (`seen-copies`): the object is on
       its stage in the first frame, and is not asked for twice. */
    initialData: () => recallCopy(id)?.value,
    initialDataUpdatedAt: () => recallCopy(id)?.at,
  });

  const accent = useGameAccent(
    copy.data?.game?.cover_url ?? copy.data?.game?.hero_url,
    copy.data?.game?.genres
  );

  const discRoom = useDiscRoom();
  const stageRoom = useStageRoom();
  /* The game's colours moving slowly behind the copy, or the plain page —
     the owner's (2026-11-02), switched by the disc at the top right. */
  const backdrop = useCopyMesh();
  const meshOn = backdrop.mesh && SKIA_AVAILABLE && !!copy.data;

  let body: React.ReactNode;
  if (copy.isLoading) body = <StageSkeleton />;
  else if (copy.isLoadingError)
    body = <ErrorState error={copy.error} onRetry={() => void copy.refetch()} />;
  else if (!copy.data)
    body = (
      <EmptyState
        icon="disc-outline"
        title="That copy is gone"
        message="It may have been deleted."
      />
    );
  else
    body = (
      <AccentProvider
        artwork={copy.data.game?.cover_url ?? copy.data.game?.hero_url}
        genres={copy.data.game?.genres}>
        <CopyDetail copy={copy.data} pageColor={accent.page} handedOver={handedOver} />
      </AccentProvider>
    );

  return (
    /* No `insetHeader`: the stage pads itself clear of the back key instead, so
       that the scroll view runs to the top of the display. The lamp's light
       reaches above the stage, and a scroll view that began under the header
       would cut it off along a straight line. */
    <Screen
      edges={['bottom']}
      background={copy.data ? accent.page : undefined}
      backdrop={
        meshOn ? (
          <MeshBackdrop
            instant={handedOver}
            colours={[
              accent.m3.primaryContainer,
              accent.m3.tertiaryContainer,
              accent.m3.secondaryContainer,
              accent.page,
            ]}
          />
        ) : undefined
      }
      /* The disc of glass leaves with the stage. The bar that follows names
         the game, once the stage and the name under it have gone — which is
         the room the stage was given, the caption under it, and the disc's own
         band over it. */
      topBar={
        <FrostedTopBar
          back
          title={copy.data?.game?.title}
          header={discRoom + stageRoom + CAPTION_ROOM}
          right={
            SKIA_AVAILABLE && copy.data ? (
              <TopBarDisc
                icon={backdrop.mesh ? 'color-palette' : 'color-palette-outline'}
                label={
                  backdrop.mesh
                    ? 'Moving colours behind the copy. Switch to the plain page'
                    : 'Plain page behind the copy. Switch to moving colours'
                }
                onPress={() => backdrop.setMesh(!backdrop.mesh)}
              />
            ) : undefined
          }
        />
      }>
      {body}
    </Screen>
  );
}

function CopyDetail({
  copy,
  pageColor,
  handedOver,
}: {
  copy: CopyWithRelations;
  pageColor: string;
  handedOver: boolean;
}) {
  const theme = useTheme();
  const accent = useAccent();
  const { width, height } = useWindowDimensions();
  const room = useStageRoom();
  const headerHeight = useDiscRoom();
  const router = useRouter();
  const queryClient = useQueryClient();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;
  const isOwner = viewerId === copy.user_id;

  /* Held: it is a prop of the memoised stage, and the caption re-renders this
     screen each time the copy turns to its other side. */
  const stage = useMemo(() => copyStage(copy, width, height, room), [copy, width, height, room]);

  /* What is on the stage, and which side of it is showing. Held here, not in
     the showcase: the keys under it change the first, and the caption reads
     the second. */
  const [mode, setMode] = useState<CopyStageMode>('closed');
  const [side, setSide] = useState<CopySide>('cover');
  const [turnRequest, setTurnRequest] = useState(0);

  /* A sealed copy that was asked to open says why it did not, for a moment. */
  const [refused, setRefused] = useState(false);
  const refusal = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refuse = useCallback(() => {
    setRefused(true);
    if (refusal.current) clearTimeout(refusal.current);
    refusal.current = setTimeout(() => setRefused(false), REFUSAL_MS);
  }, []);
  useEffect(
    () => () => {
      if (refusal.current) clearTimeout(refusal.current);
    },
    []
  );

  /* Whether the stage should be working: this screen in front, the app in
     front, the stage on the display, and nobody typing under it. Otherwise it
     parks on a face and lets the phone's sensor go. */
  const [focused, setFocused] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [scrolledAway, setScrolledAway] = useState(false);
  const [typing, setTyping] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) =>
      setForeground(state === 'active')
    );
    return () => listener.remove();
  }, []);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const away = event.nativeEvent.contentOffset.y > stage.stageHeight * 0.7;
    if (away !== scrolledAway) setScrolledAway(away);
  };

  /* The real back cover and disc label, looked up when the copy was added
     (`useCopyArt`); the case draws its own until they are found, and if
     they never are. */
  const art = useCopyArt(copy);

  const waiting = !copy.release_id && copy.contribution?.status === 'pending';
  /* Who made it and when it came out — the game's facts, not the copy's. The
     full date when the catalogue has one, the year when that is all there is. */
  const credit = [
    copy.game?.developer,
    copy.game?.release_date
      ? formatReleaseDate(copy.game.release_date)
      : (copy.game?.release_year ?? null),
  ]
    .filter(Boolean)
    .join(' · ');

  /*
   * The line under the name follows the side that is toward the reader. On the
   * cover it is the game's own credit. Everywhere else it names the side and
   * the one thing to do there — never what the back prints, which is read on
   * the back.
   */
  const facing = refused
    ? 'Sealed. This copy has never been opened.'
    : side === 'cover'
      ? credit || 'The cover'
      : side === 'back'
        ? /* A scanned back covers the printed record, so it is said here. */
          art.back
          ? copyRecordLine(copy, platformKeyForStored(copy.platform) ?? 'other')
          : 'The back of the case'
        : side === 'inside'
          ? 'Inside · tap the disc to lift it out'
          : side === 'disc'
            ? 'The disc · flick it left to put it back'
            : 'The disc, from underneath';

  /* The owner's log of this game, for their review. Under `['my-log', …]`, so
     saving a review in the log form refreshes it. */
  const log = useQuery({
    queryKey: ['my-log', copy.user_id, copy.game_id, 'with-relations'],
    queryFn: () => getLogOf(copy.user_id, copy.game_id),
  });
  /* Anything written — the review, or only its one sentence (0040). */
  const review = log.data && cardShows(log.data) !== null ? log.data : null;

  const remove = useMutation({
    mutationFn: () => deleteCopy(copy.id),
    onSuccess: () => {
      toast.success('Copy removed from your collection');
      queryClient.invalidateQueries({ queryKey: ['copies', copy.user_id] });
      queryClient.invalidateQueries({ queryKey: ['user-game-stats', copy.user_id] });
      queryClient.removeQueries({ queryKey: ['copy', copy.id] });
      router.back();
    },
  });

  function confirmRemove() {
    showAlert(
      'Delete this copy?',
      `It comes off your shelf. ${copy.game?.title ?? 'The game'} itself, your log and any review stay as they are.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => remove.mutate() },
      ]
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
      <PageScrollView
        contentContainerStyle={[styles.content, { paddingTop: headerHeight }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={120}>
        {/* Edge to edge: the lamp's light is wider than the page's column, and
            an open cover leaves by the side of the display. */}
        <CopyShowcase
          copy={copy}
          art={art}
          width={width}
          stage={stage}
          pageColor={pageColor}
          mode={mode}
          onModeChange={setMode}
          turnRequest={turnRequest}
          onSideChange={setSide}
          onRefuse={refuse}
          active={focused && foreground && !scrolledAway && !typing}
          handedOver={handedOver}
        />

        <View style={styles.caption}>
          {copy.game ? (
            <Link href={{ pathname: '/game/[id]', params: { id: copy.game.id } }} asChild>
              <PressableScale
                accessibilityRole="link"
                accessibilityLabel={`${copy.game.title}. Open the game page.`}
                scaleTo={0.98}
                style={StyleSheet.flatten(styles.titleRow)}>
                <Text variant="h2" numberOfLines={2} style={styles.title}>
                  {copy.game.title}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={accent.quietInk} />
              </PressableScale>
            </Link>
          ) : (
            <Text variant="h2">A copy</Text>
          )}
          {/* Keyed on its words, so a new side fades in and is not a line of
              text changing under the reader. Polite: it is said when it is the
              reader's turn, and the drift is off for a screen reader anyway. */}
          <Animated.View key={facing} entering={FadeIn.duration(180)}>
            <Text
              variant="body"
              numberOfLines={1}
              accessibilityLiveRegion="polite"
              style={[styles.facing, { color: accent.quietInk }]}>
              {facing}
            </Text>
          </Animated.View>
        </View>

        <View style={styles.keys}>
          <StageKey
            icon="swap-horizontal"
            word="Turn over"
            label={mode === 'disc' ? 'Turn the disc over' : 'Turn the case over'}
            disabled={mode === 'open'}
            onPress={() => setTurnRequest((count) => count + 1)}
          />
          {stage.opens && (
            <>
              <StageKey
                icon={mode === 'open' ? 'book' : 'book-outline'}
                word={stage.sealed ? 'Sealed' : mode === 'open' ? 'Close' : 'Open'}
                label={
                  stage.sealed
                    ? 'This copy is sealed and does not open'
                    : mode === 'open'
                      ? 'Shut the case'
                      : 'Open the case'
                }
                selected={mode === 'open'}
                disabled={stage.sealed || mode === 'disc'}
                onPress={() => setMode(mode === 'open' ? 'closed' : 'open')}
              />
              <StageKey
                icon={mode === 'disc' ? 'disc' : 'disc-outline'}
                word={mode === 'disc' ? 'Put back' : 'Take out'}
                label={mode === 'disc' ? 'Put the disc back in its case' : 'Take the disc out'}
                selected={mode === 'disc'}
                disabled={stage.sealed}
                onPress={() => setMode(mode === 'disc' ? 'closed' : 'disc')}
              />
            </>
          )}
        </View>

        <View style={styles.rest}>
          {waiting && copy.contribution && (
            <View style={[styles.notice, { borderColor: theme.border }]}>
              <Ionicons name="time-outline" size={16} color={theme.textSecondary} />
              <Text variant="bodySmall" color="textSecondary" style={styles.flex}>
                {CONTRIBUTION_STATUS_LABEL.pending}. This copy links to the release by itself once
                its barcode is approved.
              </Text>
            </View>
          )}

          {isOwner ? (
            /* Keyed on the copy: the field's text is seeded from it once, not
               synced to it (CLAUDE.md, "No setState in effects"). */
            <CopyNotes key={copy.id} copy={copy} onTyping={setTyping} />
          ) : (
            !!copy.notes?.trim() && (
              <View style={styles.block}>
                <Text variant="fieldLabel" style={{ color: accent.quietInk }}>
                  Notes
                </Text>
                <RichText variant="body">{copy.notes}</RichText>
              </View>
            )
          )}

          {review && (
            <View style={styles.block}>
              <Text variant="fieldLabel" style={{ color: accent.quietInk }}>
                {isOwner ? 'Your review' : `${displayNameFor(review.profile)}’s review`}
              </Text>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={[
                  `${displayNameFor(review.profile)}’s review`,
                  review.rating !== null ? `scored ${Math.round(review.rating)}` : null,
                  review.spoilers ? 'Contains spoilers' : null,
                  'Read all of it.',
                ]
                  .filter(Boolean)
                  .join('. ')}
                onPress={() => router.push({ pathname: '/review/[id]', params: { id: review.id } })}
                scaleTo={0.99}>
                {/* The reviews sheet's card, as it is there: the writer's picture,
                    and the app's neutral surface rather than the game's tone. */}
                <ReviewQuote
                  text={review.review ?? ''}
                  pullQuote={cardShows(review) === 'quote' ? review.review_title : null}
                  byline={displayNameFor(review.profile)}
                  avatarUrl={review.profile?.avatar_url ?? null}
                  score={review.rating}
                  lines={REVIEW_LINES}
                  spoiler={!!review.spoilers}
                  fill={theme.surface}
                />
              </PressableScale>
            </View>
          )}

          {remove.isError && (
            <Text variant="bodySmall" color="danger">
              {remove.error instanceof Error ? remove.error.message : 'Could not delete this copy.'}
            </Text>
          )}

          {isOwner && (
            <View style={styles.actions}>
              <Button
                title="Edit copy"
                icon="create-outline"
                variant="secondary"
                fullWidth
                onPress={() => router.push({ pathname: '/add-copy', params: { copy: copy.id } })}
              />
              <Button
                title="Delete copy"
                variant="danger"
                fullWidth
                loading={remove.isPending}
                onPress={confirmRemove}
              />
            </View>
          )}
        </View>
      </PageScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * The owner's notes on this copy, edited where they are read.
 *
 * **Saved as it is left** — when the field loses focus, and when the screen
 * closes with something unsaved in it. No button: a note is not a form, and a
 * note that was typed and lost to a back gesture is the failure worth designing
 * out. The line under the field says what happened to the words — the count
 * while typing, then "Saved".
 *
 * The same `owned_copies.notes` the copy form writes, and the case's back
 * prints two lines of. `onTyping` tells the screen the keyboard is up, which is
 * when the stage above stops working.
 */
function CopyNotes({
  copy,
  onTyping,
}: {
  copy: CopyWithRelations;
  onTyping: (typing: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [text, setText] = useState(copy.notes ?? '');
  /* What the database holds, and what is in the field — for the save on the
     way out, which runs after the last render and cannot read state. */
  const stored = useRef(copy.notes ?? '');
  const latest = useRef(copy.notes ?? '');

  const save = useMutation({
    mutationFn: (notes: string) => updateCopyNotes(copy.id, notes),
    onSuccess: (notes) => {
      stored.current = notes ?? '';
      queryClient.setQueryData<CopyWithRelations | null>(['copy', copy.id], (old) =>
        old ? { ...old, notes } : old
      );
      queryClient.invalidateQueries({ queryKey: ['copies', copy.user_id] });
    },
  });
  const { mutate } = save;

  const commit = useCallback(() => {
    if (latest.current.trim() === stored.current.trim()) return;
    mutate(latest.current);
  }, [mutate]);

  /* Leaving with the keyboard still up does not blur the field first. */
  useEffect(() => commit, [commit]);

  const dirty = text.trim() !== (copy.notes ?? '').trim();
  const hint = save.isPending
    ? 'Saving…'
    : !dirty && save.isSuccess
      ? 'Saved'
      : `${text.length}/${COPY_NOTES_MAX}`;

  return (
    <TextField
      label="Notes"
      value={text}
      onChangeText={(next) => {
        latest.current = next;
        setText(next);
      }}
      onFocus={() => onTyping(true)}
      onBlur={() => {
        onTyping(false);
        commit();
      }}
      multiline
      maxLength={COPY_NOTES_MAX}
      placeholder="Original case, tiny crack on the front…"
      hint={hint}
      error={save.isError ? 'Could not save your notes. Tap out of the field to try again.' : null}
    />
  );
}

/**
 * A copy that has not arrived yet, in the stage's own shape.
 *
 * Seldom seen: a copy opened from the binder, a list or the game page is on its
 * stage in the first frame. This is for one opened cold — a link, a relaunch —
 * and it holds the place of what will be there, at a keep case's
 * proportions, so nothing jumps when the real one lands. A spinner would
 * say "wait"; this says what is coming.
 */
function StageSkeleton() {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const room = useStageRoom();
  const headerHeight = useDiscRoom();
  const stage = stageMetrics(
    width,
    height,
    room,
    CASE_TEMPLATE_SIZE.height / CASE_TEMPLATE_SIZE.width
  );

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading this copy"
      style={{ paddingTop: headerHeight }}>
      <View style={{ width, height: stage.stageHeight }}>
        <View
          style={[
            styles.bone,
            {
              left: (width - stage.caseWidth) / 2,
              top: stage.centreY - stage.caseHeight / 2,
              width: stage.caseWidth,
              height: stage.caseHeight,
              borderRadius: Radius.image,
              backgroundColor: theme.skeleton,
            },
          ]}
        />
      </View>
      <View style={styles.caption}>
        <View style={[styles.line, { width: width * 0.5, backgroundColor: theme.skeleton }]} />
        <View
          style={[styles.lineSmall, { width: width * 0.34, backgroundColor: theme.skeleton }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  /* No side padding here: the stage runs edge to edge. Everything under it
     pads itself. */
  content: { paddingBottom: Spacing.x48 },
  /* Centred on the stage's axis: the object is symmetrical, and so is what is
     said about it. It was set to the art's left edge, which belonged to a case
     that stood to one side of a page. */
  caption: {
    alignItems: 'center',
    gap: Spacing.x4,
    paddingTop: Spacing.x16,
    paddingHorizontal: Spacing.x24,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
  title: { flexShrink: 1, textAlign: 'center' },
  facing: { textAlign: 'center' },
  /* Fixed columns, so the keys stand in the same places whichever of them are
     lit or dimmed. */
  keys: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.x12,
    paddingTop: Spacing.x20,
    minWidth: STAGE_KEY_WIDTH,
  },
  /* `x24` above, inside a peek of `x48`: the Notes label is whole on the first
     screen, which is what says the page goes on. */
  rest: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x24, gap: Spacing.x24 },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.x8,
    padding: Spacing.x12,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  /* A quiet label over its content, as a field's label sits over its field. */
  block: { gap: Spacing.x8 },
  actions: { gap: Spacing.x8 },
  bone: { position: 'absolute' },
  line: { height: Type.h2.fontSize, borderRadius: Radius.md },
  lineSmall: { height: Type.body.fontSize, borderRadius: Radius.md, marginTop: Spacing.x4 },
});
