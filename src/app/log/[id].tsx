import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { ChoiceChips } from '@/components/choice-chips';
import { LogCard } from '@/components/log-card';
import { ProgressPills } from '@/components/progress-pills';
import { Button } from '@/components/ui/button';
import { useCardMaterial } from '@/components/ui/card-material';
import { DropdownButton, type DropdownOption } from '@/components/ui/dropdown-button';
import { GameCaseDisplay } from '@/components/game-case-display';
import { PaintFill, PaintGlyph, inkTransition } from '@/components/ui/paint-fill';
import { PressableScale } from '@/components/ui/pressable-scale';
import {
  ReviewMetricsEditor,
  draftFromMetrics,
  metricsFromDraft,
  type ReviewMetricsDraft,
} from '@/components/review-metrics';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageScrollView } from '@/components/ui/page-scroll';
import { EmptyState, ErrorState, Screen } from '@/components/ui/screen';
import { ScoreInput } from '@/components/ui/score-input';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import {
  PROGRESS_CHOICES,
  PROGRESS_META,
  progressChoiceFor,
  type ProgressChoice,
} from '@/constants/progress';
import { averageMetrics, countMetrics, parseReviewMetrics } from '@/constants/review-metrics';
import {
  ControlHeight,
  Radius,
  Spacing,
  TapTarget,
  Type,
  ensureContrast,
  readableInk,
  withAlpha,
} from '@/constants/theme';
import { AccentProvider } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import {
  cachedGameOf,
  deleteLog,
  getMyLog,
  invalidateCommunityRatings,
  reviewDisplaySaved,
  saveLog,
} from '@/lib/api';
import type { CompletionLevel, GameLog, LogWithRelations } from '@/lib/database.types';
import { getGameById, type Game } from '@/lib/games';
import { formatReleaseDate, isUnreleased } from '@/lib/games/release';
import { clearDraft, loadDraft, saveDraft, type LogDraft } from '@/lib/log-draft';
import { platformOptionsFor } from '@/lib/platform-options';
import { PLAY_FILTERS, type ReviewPlayFilter } from '@/lib/review-facets';
import { QUOTE_MAX, displayOf, normaliseQuote, type ReviewDisplay } from '@/lib/review-quote';
import { useAuth } from '@/store/auth';
import { showAlert } from '@/components/ui/dialog';

/** How long the form waits after the last keystroke before writing a draft. */
const DRAFT_DEBOUNCE_MS = 800;

/** Solo or co-op, in the words the review list filters by — or not said. */
const PLAY_OPTIONS: DropdownOption<ReviewPlayFilter | ''>[] = [
  { value: '', label: 'Not said' },
  ...PLAY_FILTERS.map(({ key, label }) => ({ value: key, label })),
];

/** 2 to 16 — the range 0023's CHECK allows — or not said. */
const PLAYER_OPTIONS: DropdownOption<string>[] = [
  { value: '', label: 'Not said' },
  ...Array.from({ length: 15 }, (_, index) => ({
    value: String(index + 2),
    label: `${index + 2} players`,
    short: String(index + 2),
  })),
];

/** What a card of the review shows — the writer's choice (0040). */
const DISPLAY_CHOICES: { value: ReviewDisplay; label: string }[] = [
  { value: 'text', label: 'The review' },
  { value: 'quote', label: 'The sentence' },
];

/** The saved play type as the form holds it: '' is "didn't say". */
function playFrom(coop: boolean | null | undefined): ReviewPlayFilter | '' {
  return coop === true ? 'coop' : coop === false ? 'solo' : '';
}

export default function LogGameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuth((state) => state.session?.user.id);

  const game = useQuery({
    queryKey: ['game', id],
    queryFn: ({ signal }) => getGameById(id!, signal),
    enabled: !!id,
    staleTime: 30 * 60_000,
  });

  const existing = useQuery({
    queryKey: ['my-log', userId, id],
    queryFn: () => getMyLog(userId!, id!),
    enabled: !!userId && !!id,
  });

  /*
   * The unsaved draft, read *before* the form mounts.
   *
   * It is a query rather than an effect for the same reason `existing` is: the
   * form seeds its state from props on mount, so anything it initialises from
   * has to have resolved first. Invalidating this key is also how "Discard
   * draft" works — the key changes, the form remounts, and the saved log wins.
   */
  const draft = useQuery({
    queryKey: ['log-draft', userId, id],
    queryFn: () => loadDraft(userId!, id!),
    enabled: !!userId && !!id,
    staleTime: Infinity,
    gcTime: 0,
  });

  if (game.isLoading || existing.isLoading || draft.isLoading) {
    return (
      <Screen edges={['bottom']} padded insetHeader modal topBar={<FrostedTopBar dismiss />}>
        <LogFormSkeleton />
      </Screen>
    );
  }

  if (game.isLoadingError) {
    return (
      <Screen edges={['bottom']} insetHeader modal topBar={<FrostedTopBar dismiss />}>
        <ErrorState error={game.error} />
      </Screen>
    );
  }

  if (!game.data) {
    return (
      <Screen edges={['bottom']} insetHeader modal topBar={<FrostedTopBar dismiss />}>
        <EmptyState title="Game not found" />
      </Screen>
    );
  }

  /*
   * A game that is not out cannot be reviewed — the owner's rule (2026-10-14).
   *
   * Every way in already keeps away from one: the game page has no review
   * button for it, Surprise Me's card says when it can be reviewed, and the
   * profile's quick log says the same. This is the backstop for whatever does
   * not — a link, a route somebody kept. A log that already exists still opens:
   * it was written while the game was out, or before its date moved, and the
   * words are the writer's to change or remove.
   */
  if (isUnreleased(game.data) && !existing.data) {
    return (
      <Screen edges={['bottom']} insetHeader modal topBar={<FrostedTopBar dismiss />}>
        <EmptyState
          title="Not out yet"
          message={`${game.data.title} can be reviewed from ${formatReleaseDate(game.data.releaseDate ?? '')}.`}
        />
      </Screen>
    );
  }

  return (
    // The form runs on the game's colour — it is one of the four screens that
    // are about a single game, so the save button and the status picker take
    // that game's hue rather than the house blue.
    <AccentProvider artwork={game.data.heroUrl ?? game.data.coverUrl} genres={game.data.genres}>
      {/* Keying on the log id lets the form initialise its state from props on
          mount, instead of syncing it in an effect after the query resolves.
          The draft's timestamp joins the key so discarding one remounts the
          form against the saved log. */}
      <LogForm
        key={`${existing.data?.id ?? 'new'}:${draft.data?.savedAt ?? 0}`}
        game={game.data}
        existing={existing.data ?? null}
        draft={draft.data ?? null}
        userId={userId}
      />
    </AccentProvider>
  );
}

type LogFormProps = {
  game: Game;
  existing: GameLog | null;
  draft: LogDraft | null;
  userId: string | undefined;
};

/** Everything the dirty check and the draft both care about, as one comparable value. */
type FormValues = {
  /** Null until a choice is made: a new log starts with none of the seven. */
  progress: ProgressChoice | null;
  /** For `completed` only: how far past the credits. */
  level: 'story' | 'main';
  rating: number | null;
  advanced: boolean;
  metricDraft: ReviewMetricsDraft;
  /** The game in one word or sentence — the quote (it was a headline). */
  reviewTitle: string;
  review: string;
  /** What the review's cards show. */
  display: ReviewDisplay;
  platinum: boolean;
  /** The author says this review gives something away. */
  spoilers: boolean;
  hours: string;
  playedOn: string;
  /** Solo or co-op, or '' for "didn't say". */
  play: ReviewPlayFilter | '';
  /** How many played, for co-op only: '' or '2'…'16'. */
  players: string;
};

/**
 * A draft's progress, whichever shape it was saved in.
 *
 * Drafts written before the progress sheet hold a four-value `status` and a
 * `completed` flag for the old "Completed 100%" toggle. Read into the seven
 * choices so a review someone left half-written last month comes back with the
 * progress they had picked, rather than silently reset to "Played".
 */
function progressFromDraft(draft: LogDraft): ProgressChoice | null {
  const known = PROGRESS_CHOICES.find((choice) => choice.key === draft.progress);
  if (known) return known.key;
  if (draft.completed) return 'full';
  switch (draft.status) {
    case 'playing':
    case 'backlog':
    case 'dropped':
    case 'paused':
      return draft.status;
    case 'played':
      return 'played';
    default:
      return null;
  }
}

/*
 * A stable string for a set of form values.
 *
 * Metric keys are sorted because the draft object's insertion order depends on
 * the order the user typed in, and comparing two objects whose keys arrived in
 * different orders would report every restored draft as dirty.
 */
function signature(values: FormValues): string {
  const metrics = Object.keys(values.metricDraft)
    .sort()
    .map((key) => `${key}=${values.metricDraft[key as keyof ReviewMetricsDraft]}`)
    .join(',');

  return [
    values.progress ?? '',
    values.level,
    values.rating ?? '',
    values.advanced,
    metrics,
    values.reviewTitle.trim(),
    values.review.trim(),
    values.display,
    values.platinum,
    values.spoilers,
    values.hours.trim(),
    values.playedOn.trim(),
    values.play,
    values.players,
  ].join('|');
}

/** Fire and forget — a missing Taptic engine must never interrupt a save. */
function tap(run: () => Promise<void>) {
  if (Platform.OS === 'web') return;
  void run().catch(() => {});
}

function LogForm({ game, existing, draft, userId }: LogFormProps) {
  const theme = useTheme();
  const cardMaterial = useCardMaterial();
  const router = useRouter();
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const savedMetrics = parseReviewMetrics(existing?.review_metrics ?? null);

  /* The draft wins on mount when there is one — it is by definition newer than
     the saved log, and it is the work the user has not been given back yet. */
  /* No default. It used to start on "Played", which saved a claim nobody made
     whenever someone scored a game without touching the row — and the owner's
     pills are all bright until one is chosen, so "nothing chosen" is a state
     the form has to be able to be in. Saving waits for a choice. */
  const [progress, setProgress] = useState<ProgressChoice | null>(
    () => (draft && progressFromDraft(draft)) ?? progressChoiceFor(existing) ?? null
  );
  const [level, setLevel] = useState<'story' | 'main'>(() =>
    (draft?.level ?? existing?.completion) === 'main' ? 'main' : 'story'
  );
  const [rating, setRating] = useState<number | null>(draft?.rating ?? existing?.rating ?? null);
  const [advanced, setAdvanced] = useState(draft?.advanced ?? savedMetrics !== null);
  const [metricDraft, setMetricDraft] = useState<ReviewMetricsDraft>(
    () => draft?.metricDraft ?? draftFromMetrics(savedMetrics)
  );
  const [reviewTitle, setReviewTitle] = useState(
    draft?.reviewTitle ?? existing?.review_title ?? ''
  );
  const [review, setReview] = useState(draft?.review ?? existing?.review ?? '');
  const [display, setDisplay] = useState<ReviewDisplay>(() =>
    draft?.reviewDisplay === 'quote' || draft?.reviewDisplay === 'text'
      ? draft.reviewDisplay
      : displayOf(existing ?? {})
  );
  const [platinum, setPlatinum] = useState(draft?.platinum ?? existing?.platinum ?? false);
  const [spoilers, setSpoilers] = useState(draft?.spoilers ?? existing?.spoilers ?? false);
  const [hours, setHours] = useState(
    draft?.hours ?? (existing?.hours_played != null ? String(existing.hours_played) : '')
  );
  const [playedOn, setPlayedOn] = useState(draft?.playedOn ?? existing?.played_on ?? '');
  /* Drafts from before 0023 have neither key, and fall through to the log. */
  const [play, setPlay] = useState<ReviewPlayFilter | ''>(() =>
    draft?.play === 'solo' || draft?.play === 'coop' || draft?.play === ''
      ? draft.play
      : playFrom(existing?.coop)
  );
  const [players, setPlayers] = useState(
    draft?.players ?? (existing?.player_count != null ? String(existing.player_count) : '')
  );

  /* What this game can honestly have been played on. See `platformOptionsFor`
     for why the stored value is the short form and a legacy value is kept. */
  const platformOptions = useMemo<DropdownOption<string>[]>(
    () => [
      { value: '', label: 'Not set' },
      ...platformOptionsFor(game.platforms, existing?.played_on, theme.textSecondary).map(
        ({ value, label, icon }) => ({ value, label, icon })
      ),
    ],
    [game.platforms, existing?.played_on, theme.textSecondary]
  );

  /*
   * The score is derived during render, never synced into state by an effect
   * (which the React Compiler rules reject anyway). In advanced mode it is the
   * mean of the activated metrics; the bar's own value is left untouched
   * underneath, so unticking the box gives the user back the score they had.
   */
  const metrics = metricsFromDraft(metricDraft);
  const metricCount = countMetrics(metrics);
  const effectiveRating = advanced ? averageMetrics(metrics) : rating;

  /* A review is the sentence, the text, or both — the owner's change
     (2026-10-16). It used to be a headline and a body, all or nothing. */
  const writingReview = !!reviewTitle.trim() || !!review.trim();
  const quote = normaliseQuote(reviewTitle);

  const values: FormValues = {
    progress,
    level,
    rating,
    advanced,
    metricDraft,
    reviewTitle,
    review,
    display,
    platinum,
    spoilers,
    hours,
    playedOn,
    play,
    players,
  };

  /* Measured against the *saved log*, not against the draft: the question the
     discard prompt and the draft writer both ask is "is there work here that
     Postgres does not have", and a restored draft is exactly that. */
  const baseline: FormValues = {
    progress: progressChoiceFor(existing) ?? null,
    level: existing?.completion === 'main' ? 'main' : 'story',
    rating: existing?.rating ?? null,
    advanced: savedMetrics !== null,
    metricDraft: draftFromMetrics(savedMetrics),
    reviewTitle: existing?.review_title ?? '',
    review: existing?.review ?? '',
    display: displayOf(existing ?? {}),
    platinum: existing?.platinum ?? false,
    spoilers: existing?.spoilers ?? false,
    hours: existing?.hours_played != null ? String(existing.hours_played) : '',
    playedOn: existing?.played_on ?? '',
    play: playFrom(existing?.coop),
    players: existing?.player_count != null ? String(existing.player_count) : '',
  };

  const dirty = signature(values) !== signature(baseline);

  /*
   * Everything that would stop a save, resolved during render rather than
   * thrown from the mutation.
   *
   * The hours check used to live inside `mutationFn`, so its message arrived as
   * a red line above the buttons — roughly 600dp from the field that caused it,
   * with the field itself off-screen by then. Deriving it here lets the error
   * sit on the input and lets the button say up front that it will not go.
   */
  const parsedHours = hours.trim() ? Number(hours.trim()) : null;
  const hoursError =
    parsedHours !== null && (!Number.isFinite(parsedHours) || parsedHours < 0)
      ? 'Enter a number of hours — 40, or 12.5. Not a negative one.'
      : null;

  /*
   * Advanced metrics on, nothing scored, and a score already saved.
   *
   * `averageMetrics` returns null for an empty set, and `saveLog` writes that
   * straight over `logs.rating` — the one column feeds, game averages, profile
   * stats and share text all read. Ticking the box out of curiosity and saving
   * would silently delete the score, so this blocks instead.
   */
  const clearsRating = advanced && metricCount === 0 && existing?.rating != null;

  /* A sentence kept from before the cap — a headline of up to 140 — is the
     one way past `maxLength`. It would be four or five lines on a card, so it
     asks to be shortened rather than being cut there. */
  const quoteError =
    quote.length > QUOTE_MAX
      ? `Shorten it to ${QUOTE_MAX} characters — it is drawn on three lines.`
      : null;

  const blocked =
    (progress === null ? 'Pick where you are with it.' : null) ??
    hoursError ??
    quoteError ??
    (clearsRating ? 'Advanced metrics are on with nothing scored.' : null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['feed'] });
    queryClient.invalidateQueries({ queryKey: ['my-log', userId, game.id] });
    queryClient.invalidateQueries({ queryKey: ['game-reviews', game.id] });
    queryClient.invalidateQueries({ queryKey: ['user-logs', userId] });
    // A status changed what you have played: For You's tiers with it (0046).
    queryClient.invalidateQueries({ queryKey: ['pings', 'for_you'] });
    queryClient.invalidateQueries({ queryKey: ['profile-stats', userId] });
    queryClient.invalidateQueries({ queryKey: ['achievement-stats', userId] });
    queryClient.invalidateQueries({ queryKey: ['completions', userId] });
    // The reviews sheet: its list, its histogram and its breakdown all read this log.
    queryClient.invalidateQueries({ queryKey: ['game-review-list', game.id] });
    /* The game page's rail of reviews: a new one, or new words, shows at once. */
    queryClient.invalidateQueries({ queryKey: ['top-reviews', game.id] });
    /* Every community score, not this game's alone: a rating changes its
       rater's weight, and with it every other game they rated (0041). The
       game's score, its sheet's breakdown, Beloved and the influence page. */
    invalidateCommunityRatings(queryClient);
    // The library's head: logged, reviewed, averages, best and worst.
    queryClient.invalidateQueries({ queryKey: ['user-game-stats', userId] });
    /* 0038: the review may be in a language this game had none in, or one this
       person had not written in before — and it is a new entry for the chart. */
    queryClient.invalidateQueries({ queryKey: ['review-languages', game.id] });
    queryClient.invalidateQueries({ queryKey: ['written-languages', userId] });
    queryClient.invalidateQueries({ queryKey: ['review-chart'] });
    // Search's "Latest reviews": a new review is the newest one there is.
    queryClient.invalidateQueries({ queryKey: ['latest-reviews'] });
    // The game page's "On GameLog": how many are playing it and have played it.
    queryClient.invalidateQueries({ queryKey: ['game-audience', game.id] });
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('You must be signed in.');

      /* The derived checks above already gate the button. These stay as the
         backstop for a save that arrives some other way. */
      if (progress === null) throw new Error('Pick where you are with it.');
      if (hoursError) throw new Error(hoursError);
      if (quoteError) throw new Error(quoteError);
      if (clearsRating) {
        throw new Error('Score a metric, or untick advanced metrics to keep your score.');
      }

      /*
       * The progress choice becomes a status and a completion level, the same
       * pair the progress sheet writes (`progressPatch`) — with one addition:
       * a platinum is everything, so it is always `full`, as the 0023 backfill
       * read it.
       *
       * The percentage is not this form's to clear. It used to be written as
       * `100` or `null` from a single toggle, which was harmless while that
       * toggle was the only thing that set it — and now erases the "73%" the
       * progress sheet recorded the moment a review is saved. So it is 100 when
       * the game is 100%, cleared only when it *was* 100 and no longer is, and
       * otherwise left as it stood.
       */
      const completion: CompletionLevel | null = platinum
        ? 'full'
        : progress === 'full'
          ? 'full'
          : progress === 'completed'
            ? level
            : progress === 'played'
              ? null
              : (existing?.completion ?? null);

      await saveLog(userId, {
        game,
        status: PROGRESS_META[progress].status,
        rating: effectiveRating,
        reviewMetrics: advanced ? metrics : null,
        reviewTitle,
        review,
        reviewDisplay: display,
        platinum,
        spoilers,
        completion,
        completionPercent:
          completion === 'full'
            ? 100
            : existing?.completion_percent === 100
              ? null
              : (existing?.completion_percent ?? null),
        hoursPlayed: parsedHours,
        playedOn: playedOn.trim() || null,
        coop: play === '' ? null : play === 'coop',
        playerCount: play === 'coop' && players ? Number(players) : null,
      });

      if (userId) await clearDraft(userId, game.id);
    },
    onSuccess: () => {
      tap(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
      invalidate();
      queryClient.removeQueries({ queryKey: ['log-draft', userId, game.id] });
      router.back();
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('You must be signed in.');
      await deleteLog(userId, game.id);
      await clearDraft(userId, game.id);
    },
    onSuccess: () => {
      tap(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
      invalidate();
      queryClient.removeQueries({ queryKey: ['log-draft', userId, game.id] });
      router.back();
    },
  });

  const mutationError = save.error ?? remove.error;

  /*
   * The card a list will draw, from the form as it stands — the owner's
   * direction: "it should show them the card with the info they've put,
   * updating in real time". Their own face and name; the game as it will be
   * cached; the time the form opened, or the log's own.
   */
  const profile = useAuth((state) => state.profile);
  const [openedAt] = useState(() => new Date().toISOString());
  const previewLog: LogWithRelations = {
    id: existing?.id ?? 'preview',
    user_id: userId ?? '',
    game_id: game.id,
    status: progress ? PROGRESS_META[progress].status : (existing?.status ?? 'played'),
    rating: effectiveRating === null ? null : Math.round(effectiveRating),
    review_title: reviewTitle,
    review,
    review_metrics: null,
    completion_percent: null,
    platinum,
    spoilers,
    hours_played: null,
    played_on: null,
    completion: null,
    coop: null,
    player_count: null,
    review_display: display,
    created_at: existing?.created_at ?? openedAt,
    updated_at: openedAt,
    game: cachedGameOf(game, openedAt),
    profile,
  };

  /* Said under the choice when the card cannot show what was chosen yet. */
  const displayNote =
    display === 'quote' && !quote && review.trim()
      ? 'Until you write the sentence, cards show the review.'
      : display === 'text' && !review.trim() && quote
        ? 'Until you write the review, cards show the sentence.'
        : reviewDisplaySaved() === false
          ? 'Cards will show the review until the app’s database is updated (0040).'
          : null;

  /*
   * Write the draft behind the keystrokes.
   *
   * Debounced because this runs on every character of a piece of writing that
   * can reach 40,000 of them, and an AsyncStorage round trip per keypress would
   * be felt. Only while dirty: a form that matches the saved log has nothing
   * worth keeping, and writing one would resurrect a draft the user just
   * discarded.
   */
  useEffect(() => {
    if (!userId || !dirty || save.isPending || remove.isPending) return;

    const timer = setTimeout(() => {
      void saveDraft(userId, game.id, {
        ...values,
        progress: values.progress ?? undefined,
        reviewDisplay: values.display,
        savedAt: Date.now(),
      });
    }, DRAFT_DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, game.id, dirty, save.isPending, remove.isPending, signature(values)]);

  /*
   * Leaving with unsaved work.
   *
   * Three exits, three mechanisms, because no single public API covers all of
   * them: the close disc routes through `onBack` below, the iOS sheet's
   * swipe-down is disabled while dirty, and Android's hardware back is
   * intercepted here. Missing any one of them leaves a way to lose a review.
   */
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !dirty });
  }, [navigation, dirty]);

  function confirmDismiss() {
    if (!dirty) {
      router.back();
      return;
    }

    showAlert(
      'Leave without saving?',
      draft
        ? 'Your draft is kept on this device, so you can pick it up again.'
        : `Your unsaved changes to ${game.title} are kept as a draft on this device.`,
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Leave', onPress: () => router.back() },
      ]
    );
  }

  useEffect(() => {
    if (!dirty) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      confirmDismiss();
      return true;
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  function confirmRemove() {
    showAlert(
      'Remove your log?',
      `Your score and review for ${game.title} are deleted along with it. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => remove.mutate() },
      ]
    );
  }

  function discardDraft() {
    showAlert(
      'Discard this draft?',
      'The form goes back to what is saved. The draft cannot be recovered.',
      [
        { text: 'Keep draft', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            if (!userId) return;
            void clearDraft(userId, game.id).then(() =>
              queryClient.invalidateQueries({ queryKey: ['log-draft', userId, game.id] })
            );
          },
        },
      ]
    );
  }

  /* Words, not characters. "38,412 characters" tells a writer nothing about the
     length of what they have written; every writer counts in words. */
  const wordCount = review.trim() ? review.trim().split(/\s+/).length : 0;
  const quoteLeft = QUOTE_MAX - reviewTitle.length;
  const bodyLeft = REVIEW_BODY_MAX - review.length;

  /* The button names the work. Arriving from "Write a review" and leaving via
     "Log game" made the app rename the task between entering and exiting. */
  const saveLabel = writingReview
    ? existing
      ? 'Save review'
      : 'Publish review'
    : existing
      ? 'Save changes'
      : 'Log game';

  return (
    /* `modal`: an iOS sheet already begins below the status bar, so the bar must
       not inset itself again — see `useTopBarInset`. `dismiss` for the same
       reason the chevron is wrong here: a sheet closes, it does not go back. */
    <Screen
      edges={['bottom']}
      padded
      insetHeader
      modal
      topBar={
        /* Named as the save button is, so the task has one name from the way
           in to the way out. */
        <FrostedTopBar
          dismiss
          onBack={confirmDismiss}
          title={
            writingReview
              ? existing
                ? 'Edit review'
                : 'Write a review'
              : existing
                ? 'Edit log'
                : 'Log game'
          }
        />
      }>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
        {/* `flex: 1` is load-bearing now that the footer is a sibling: without it
            the scroll view sizes to its content and pushes the button off the
            bottom of the screen instead of scrolling underneath it. */}
        <PageScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.gameHead}>
            <GameCaseDisplay
              coverUrl={game.coverUrl}
              heroUrl={game.heroUrl}
              title={game.title}
              platforms={game.platforms}
              size="small"
            />
            <View style={styles.gameHeadText}>
              <Text variant="h3" numberOfLines={2}>
                {game.title}
              </Text>
              <Text variant="bodySmall" color="textMuted">
                {[game.releaseYear, game.developer].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </View>

          {/* Restored work is announced, never silently swapped in: a draft that
              quietly overrode a saved review would look like data loss. */}
          {draft && (
            <View style={[styles.draftNote, { borderColor: theme.borderStrong }]}>
              <Ionicons name="document-text-outline" size={16} color={theme.textSecondary} />
              <Text variant="bodySmall" color="textSecondary" style={styles.flex}>
                Picked up where you left off {relativeTime(draft.savedAt)}.
              </Text>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Discard this draft"
                onPress={discardDraft}
                /* 16 + 16 + a 16dp line clears Android's 48. */
                hitSlop={{ top: 16, bottom: 16, left: 10, right: 10 }}
                scaleTo={0.94}>
                <Text variant="bodySmall" color="primaryText">
                  Discard
                </Text>
              </PressableScale>
            </View>
          )}

          {/*
            Progress — the same seven choices as the game page's progress sheet
            (`constants/progress.ts`), so the two places a log is written speak
            one vocabulary. It was four statuses here and a "Completed 100%"
            toggle further down, which could not say "I finished the story" at
            all, and could say "dropped, 100% complete" without complaint.
          */}
          <View style={styles.section}>
            <Text variant="label" color="textMuted" accessibilityRole="header">
              Progress
            </Text>
            {/* The poster palette's solid pills — the owner's reference
                (2026-10-15). See `<ProgressPills>` for how choosing reads. */}
            <ProgressPills
              value={progress}
              onChange={setProgress}
              level={level}
              onLevelChange={setLevel}
            />
          </View>

          <View style={styles.section}>
            <Text variant="label" color="textMuted" accessibilityRole="header">
              Score
            </Text>

            <ScoreInput
              value={effectiveRating}
              onChange={setRating}
              disabled={advanced}
              hint={
                advanced
                  ? metricCount === 0
                    ? 'Score a metric below'
                    : `averaged from ${metricCount} ${metricCount === 1 ? 'metric' : 'metrics'}`
                  : undefined
              }
            />

            <View style={styles.metrics}>
              <ReviewMetricsEditor
                enabled={advanced}
                onToggleEnabled={setAdvanced}
                draft={metricDraft}
                onChangeDraft={setMetricDraft}
              />
            </View>

            {clearsRating && (
              <Text variant="bodySmall" color="danger">
                Saving now would clear your score of {existing?.rating}. Score a metric, or untick
                advanced metrics to keep it.
              </Text>
            )}
          </View>

          {/*
            The facts of the playthrough, as rows — compacted as Surprise Me's
            settings were (2026-10-16), so the card preview below has room:
            each a name and its control at the end of the row, one card of
            them. They were full-width fields and pills, a screen of their own.
          */}
          <View style={styles.section}>
            <Text variant="label" color="textMuted" accessibilityRole="header">
              Playthrough
            </Text>
            <View
              style={[
                styles.rows,
                { backgroundColor: cardMaterial.fill, borderColor: cardMaterial.edge },
              ]}>
              {/* Chosen, never typed: a typed platform could be a word that is
                  not one, and the case's back prints whatever is here. */}
              <FormRow label="Played on" first>
                <DropdownButton
                  label="Played on"
                  value={playedOn}
                  options={platformOptions}
                  onChange={setPlayedOn}
                />
              </FormRow>

              <FormRow label="Hours played">
                <TextInput
                  value={hours}
                  onChangeText={setHours}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={theme.textMuted}
                  accessibilityLabel="Hours played"
                  selectionColor={theme.primaryText}
                  style={[
                    styles.hours,
                    {
                      backgroundColor: theme.input,
                      color: theme.text,
                      borderColor: hoursError ? theme.danger : 'transparent',
                    },
                  ]}
                />
              </FormRow>

              {/* Optional, and nothing is assumed when it is left alone: a
                  review says "Co-op" only because its writer did. It is what
                  the reviews sheet's Solo / Co-op filter reads. */}
              <FormRow label="Solo or co-op">
                <DropdownButton
                  label="Solo or co-op"
                  value={play}
                  options={PLAY_OPTIONS}
                  onChange={(next) => {
                    setPlay(next);
                    // A player count means nothing without co-op; the database agrees.
                    if (next !== 'coop') setPlayers('');
                  }}
                />
              </FormRow>

              {play === 'coop' && (
                <FormRow label="Players">
                  <DropdownButton
                    label="How many played"
                    value={players}
                    options={PLAYER_OPTIONS}
                    onChange={setPlayers}
                  />
                </FormRow>
              )}

              {/* Self-reported for every platform — no console publishes a
                  trophy API. A platinum still implies 100%. */}
              <FormRow label="Trophies" hint="Self-reported">
                <Toggle
                  icon="trophy"
                  label="Platinum"
                  tint={theme.platinum}
                  value={platinum}
                  onPress={() => setPlatinum((current) => !current)}
                />
              </FormRow>
            </View>
            {hoursError && (
              <Text variant="bodySmall" color="danger">
                {hoursError}
              </Text>
            )}
          </View>

          {/*
            The review — a sentence, the text, or both.

            The owner's change (2026-10-16): the headline became "Describe the
            game in one word or sentence", drawn between large quotation marks
            on the review's page, and the writer chooses which of the two their
            cards show. The card is drawn here as they type, so the choice is
            made looking at it.

            This is still the one section announced as a band rather than as a
            group inside the form (DESIGN.md § 17): everything above it is
            metadata about a playthrough; this is the thing the product is for.
          */}
          <View style={styles.reviewSection}>
            <Text variant="h2" accessibilityRole="header">
              Review
            </Text>
            <Text variant="bodySmall" color="textMuted">
              Optional. One sentence, the whole story, or both. The score summarises it — it does
              not replace it.
            </Text>

            <TextField
              label="Describe the game in one word or sentence"
              value={reviewTitle}
              /* One line, however it wraps on screen: it is set justified
                 between the marks, and a break would leave a hole in it. */
              onChangeText={(text) => setReviewTitle(text.replace(/\s*\n\s*/g, ' '))}
              placeholder="One word, or one sentence"
              multiline
              submitBehavior="blurAndSubmit"
              maxLength={Math.max(QUOTE_MAX, reviewTitle.length)}
              style={styles.quote}
              hint={
                quoteError
                  ? undefined
                  : quoteLeft <= 25
                    ? `${quoteLeft} characters left`
                    : undefined
              }
              error={quoteError}
            />

            <TextField
              label="The review"
              value={review}
              onChangeText={setReview}
              placeholder="Write as much as you like — this can be a full article."
              multiline
              maxLength={REVIEW_BODY_MAX}
              style={styles.reviewBody}
              hint={
                bodyLeft <= 1000
                  ? `${bodyLeft} characters left`
                  : wordCount > 0
                    ? `${wordCount} ${wordCount === 1 ? 'word' : 'words'}`
                    : undefined
              }
            />

            {/*
              The spoiler flag, under what it describes and always visible.

              It was first gated on having typed, and appeared a screen above
              the field you were typing in; nobody could find it. A log saved
              with no review stores `false`, as it always did. `danger` for the
              tint — it aliases onto a token that already means "read this
              before you act" — and the label says the word too.
            */}
            <View style={styles.spoilers}>
              <Toggle
                icon="eye-off"
                label="Contains spoilers"
                tint={theme.danger}
                value={spoilers}
                onPress={() => setSpoilers((current) => !current)}
              />
              <Text variant="bodySmall" color="textMuted" style={styles.flex}>
                Readers see a notice instead of your words until they open them.
              </Text>
            </View>
          </View>

          {existing && (
            <Button
              title="Remove log"
              variant="danger"
              onPress={confirmRemove}
              loading={remove.isPending}
              fullWidth
            />
          )}
          {/*
            The card, last — the owner's direction (2026-10-16): "Place the
            review card in the review writing screen at the bottom". Drawn from
            the form as it changes, with the choice of what it shows beside it.
          */}
          <View style={styles.reviewSection}>
            {/* The card as a list will draw it — Home's, a profile's, Search's —
                built from what is on this form, as it changes. Not pressable:
                it is a picture of the card, not a way anywhere. */}
            <View style={styles.preview}>
              <Text variant="fieldLabel" color="textSecondary">
                On a card
              </Text>
              <View
                pointerEvents="none"
                accessible
                accessibilityLabel="How your review looks on a card">
                <LogCard log={previewLog} />
              </View>
            </View>

            <ChoiceChips
              label="Cards show"
              choices={DISPLAY_CHOICES}
              value={display}
              onChange={(next) => setDisplay(next ?? 'text')}
              clearable={false}
            />
            {displayNote && (
              <Text variant="bodySmall" color="textMuted">
                {displayNote}
              </Text>
            )}
          </View>
        </PageScrollView>

        {/*
          The primary action, pinned.

          It used to sit at the end of the scroll, which put it roughly 1400dp
          from the top with advanced metrics open — so the ten-second status
          change cost a full-screen scroll, and the only permanently reachable
          control was the one that discards. A shelf rather than a floating
          button: the form runs under it and the hairline is where it stops.
        */}
        {/* `borderStrong`, not `border`. The 5% hairline is for an edge inside a
            surface, where the surface step is already doing the separating; this
            rule sits on the page itself and at 5% it measured 1.12:1 — invisible,
            which left the form's last line dissolving at an arbitrary height. */}
        <View
          style={[
            styles.footer,
            { backgroundColor: theme.background, borderTopColor: theme.borderStrong },
          ]}>
          {mutationError && (
            <Text variant="bodySmall" color="danger">
              {mutationError instanceof Error ? mutationError.message : 'Could not save.'}
            </Text>
          )}

          <Button
            title={saveLabel}
            onPress={() => save.mutate()}
            loading={save.isPending}
            disabled={!!blocked}
            fullWidth
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const REVIEW_BODY_MAX = 40000;

/** "a moment ago" / "2 hours ago" / "on 4 Aug" — enough to judge whose draft it is. */
function relativeTime(epochMs: number): string {
  const minutes = Math.round((Date.now() - epochMs) / 60_000);
  if (minutes < 2) return 'a moment ago';
  if (minutes < 60) return `${minutes} minutes ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;

  return `on ${new Date(epochMs).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
}

/**
 * The form's shape, before its data arrives.
 *
 * A spinner said "something is happening"; this says "a case, a title, four
 * pills and a score are coming", which is the whole argument for a skeleton
 * (DESIGN.md § 22). Static rather than shimmering on purpose — on a near-black
 * page a pulsing grey block draws more attention than the content it stands in
 * for.
 */
function LogFormSkeleton() {
  const theme = useTheme();
  const block = (width: number | `${number}%`, height: number, radius: number = Radius.control) => (
    <View style={{ width, height, borderRadius: radius, backgroundColor: theme.skeleton }} />
  );

  return (
    <View style={styles.content} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <View style={styles.gameHead}>
        {block(108, 144, Radius.image)}
        <View style={styles.gameHeadText}>
          {block('80%', 18)}
          {block('50%', 12)}
        </View>
      </View>

      <View style={styles.section}>
        {block(52, 10)}
        {/* The pills' grid: one across, then pairs. */}
        {block('100%', ControlHeight.medium, Radius.pill)}
        <View style={styles.skeletonRow}>
          <View style={styles.flex}>{block('100%', ControlHeight.medium, Radius.pill)}</View>
          <View style={styles.flex}>{block('100%', ControlHeight.medium, Radius.pill)}</View>
        </View>
      </View>

      <View style={styles.section}>
        {block(48, 10)}
        {block('100%', 44)}
        {block('100%', TapTarget, Radius.pill)}
      </View>

      <View style={styles.section}>
        {block(80, 10)}
        {block('100%', 40)}
      </View>
    </View>
  );
}

/** One fact of the playthrough: its name, a hint when it needs one, its control at the end. */
function FormRow({
  label,
  hint,
  first = false,
  children,
}: {
  label: string;
  hint?: string;
  first?: boolean;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.formRow,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
      ]}>
      <View style={styles.formRowText}>
        <Text variant="body">{label}</Text>
        {!!hint && (
          <Text variant="bodySmall" color="textMuted">
            {hint}
          </Text>
        )}
      </View>
      {children}
    </View>
  );
}

function Toggle({
  icon,
  label,
  tint,
  value,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tint: string;
  value: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const ink = value ? readableInk(tint) : ensureContrast(tint, theme.background, 4.5);

  return (
    /* In the toggle's own meaning colour — platinum, or the spoiler warning's
       red — rather than the accent: the colour says *what* is on. Outlined in
       it at rest, poured solid when on: the owner's rule for every outlined
       control (2026-10-15), the same as the progress pills above. */
    <PressableScale
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      scaleTo={0.97}
      focusRing={withAlpha(tint, 0.3)}
      style={StyleSheet.flatten([
        styles.toggle,
        { borderColor: tint, opacity: disabled ? 0.6 : 1 },
      ])}>
      <PaintFill on={value} color={tint} cornerRadius={Radius.control} />
      <PaintGlyph name={icon} size={18} color={ink} />
      <Animated.Text style={[Type.bodySmall, { color: ink }, inkTransition(reduceMotion)]}>
        {label}
      </Animated.Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  /* `x64` at the foot per DESIGN.md § 25. The pinned footer is a sibling of the
     scroll rather than part of it, so this is clearance for the last control,
     not for the button. */
  content: { gap: Spacing.x24, paddingTop: Spacing.x24, paddingBottom: Spacing.x64 },
  gameHead: { flexDirection: 'row', gap: Spacing.x16, alignItems: 'center' },
  gameHeadText: { flex: 1, gap: Spacing.x4 },
  draftNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    paddingVertical: Spacing.x12,
    paddingHorizontal: Spacing.x16,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  section: { gap: Spacing.x8 },
  /* Wider than `section`: an `h2` band heading needs the air a 10px group label
     does not, and the two fields under it are the tallest block on the screen. */
  reviewSection: { gap: Spacing.x12 },
  // A little air between the bar and the tick box so they read as two choices
  // rather than one control with a stray checkbox attached.
  metrics: { marginTop: Spacing.x8 },
  skeletonRow: { flexDirection: 'row', gap: Spacing.x8 },
  /* The playthrough's rows: one card, a hairline between rows (Surprise Me's). */
  /* Every card's corner and hairline (`card-material`). No shadow: it clips
     its rows, and Android clips a shadow with them. */
  rows: { borderRadius: Radius.review, borderWidth: 1, overflow: 'hidden' },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    minHeight: TapTarget + Spacing.x12,
    paddingHorizontal: Spacing.x16,
    paddingVertical: Spacing.x8,
  },
  formRowText: { flex: 1, gap: 2 },
  /* The dropdown's height, the field's well: a number, so a narrow box. */
  hours: {
    ...Type.fieldText,
    width: 88,
    height: 40,
    paddingHorizontal: Spacing.x12,
    paddingVertical: 0,
    borderRadius: Radius.input,
    borderWidth: 1.5,
    textAlign: 'center',
  },
  preview: { gap: Spacing.x8 },
  /* Two or three lines as it wraps: room for the sentence to be read whole. */
  quote: { minHeight: 64 },
  // Tall by default: a short box invites a short review.
  reviewBody: { minHeight: 200 },
  spoilers: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x8,
    paddingVertical: Spacing.x12,
    paddingHorizontal: Spacing.x16,
    minHeight: TapTarget,
    borderRadius: Radius.control,
    borderWidth: 1.5,
    /* The paint is clipped to the control. */
    overflow: 'hidden',
  },
  /* Bled back out to the display edge: `<Screen padded>` insets its children by
     `x16`, and a rule that stops 12dp short of both edges reads as a stray line
     rather than as the top of a shelf. */
  footer: {
    gap: Spacing.x8,
    paddingTop: Spacing.x16,
    paddingBottom: Spacing.x8,
    marginHorizontal: -Spacing.x16,
    paddingHorizontal: Spacing.x16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
