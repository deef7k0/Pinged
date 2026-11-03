import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { ChoiceChips, type Choice } from '@/components/choice-chips';
import { Button } from '@/components/ui/button';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageScrollView } from '@/components/ui/page-scroll';
import { EmptyState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import {
  CONTENT_REPORT_REASONS,
  CONTENT_REPORT_REASON_HINT,
  CONTENT_REPORT_REASON_LABEL,
  MAX_REPORT_NOTE,
  PICK_REPORT_REASONS,
  PICK_REPORT_REASON_HINT,
  PROFILE_REPORT_REASONS,
  PROFILE_REPORT_REASON_HINT,
  USER_CONTENT_REASON_LABEL,
  isReportKind,
  type ReportKind,
} from '@/constants/reports';
import { REPORT_REASON_LABEL, SIMILARITY_REASON_LABEL } from '@/constants/similarity';
import { Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import {
  getLogById,
  getMyReport,
  getReportedContent,
  getSimilarPair,
  getSimilaritySuggestions,
  reportReview,
  reportSimilarity,
  reportSuggestion,
  reportUserContent,
  type MyReport,
  type ReportTarget,
} from '@/lib/api';
import type {
  ContentReportReason,
  UserContentKind,
  UserContentReportReason,
} from '@/lib/database.types';
import { displayNameFor, timeAgoLong } from '@/lib/format';
import { getGameById } from '@/lib/games';
import { useAuth } from '@/store/auth';

type Params = { kind: string; id: string; author?: string; game?: string };

/** The choices a suggestion and a review share (0031). */
const CONTENT_CHOICES: readonly Choice<ContentReportReason>[] = CONTENT_REPORT_REASONS.map(
  (reason) => ({
    value: reason,
    label: CONTENT_REPORT_REASON_LABEL[reason],
    hint: CONTENT_REPORT_REASON_HINT[reason],
  })
);

/** A profile's (0045): what can be true of a person's page. */
const PROFILE_CHOICES: readonly Choice<UserContentReportReason>[] = PROFILE_REPORT_REASONS.map(
  (reason) => ({
    value: reason,
    label: USER_CONTENT_REASON_LABEL[reason],
    hint: PROFILE_REPORT_REASON_HINT[reason],
  })
);

const PICK_CHOICES = PICK_REPORT_REASONS.map((reason) => ({
  value: reason,
  label: REPORT_REASON_LABEL[reason],
  hint: PICK_REPORT_REASON_HINT[reason],
}));

/**
 * Report something: a community pick, somebody's suggestion, or a review.
 *
 * Params: `kind` and `id` name the target — a pick's pair id, the pair id of a
 * suggestion (with `author`, whose suggestion), or a review's log id. `game` is
 * the side of a pick you came from, used only to describe it.
 *
 * ## One screen, every flag
 *
 * Every `<ReportFlag>` in the app opens this. The pick's report used to be an
 * alert with a button per reason, which Android caps at three — Cancel was the
 * one it dropped, so it could not be dismissed without reporting. A screen also
 * has room for what an alert could not say: what each reason means, a line for
 * the moderators, and who will read it.
 *
 * It opens on what is being reported — whose, about which game, and the words
 * themselves — so a flag tapped on the wrong card is caught before it is sent.
 * Every one of those reads the query the previous screen already filled, so it
 * is usually on screen at once.
 *
 * ## After
 *
 * The same state whether you have just sent it or come back a week later: when
 * you reported it, and whether a moderator has looked. Reporting twice is a
 * no-op in the database, so the second visit says so instead of offering the
 * form again.
 */
export default function ReportScreen() {
  const params = useLocalSearchParams<Params>();
  const userId = useAuth((state) => state.session?.user.id) ?? null;
  const queryClient = useQueryClient();
  const target = targetFrom(params);

  const mineKey = ['my-report', userId, params.kind, params.id, params.author ?? null];
  const mine = useQuery({
    queryKey: mineKey,
    queryFn: () => getMyReport(userId!, target!),
    enabled: !!userId && !!target,
  });

  /* Written straight into the check's cache, so the screen turns into its
     "reported" state without a round trip to ask what it already knows. */
  const onSent = () =>
    queryClient.setQueryData<MyReport>(mineKey, {
      status: 'open',
      created_at: new Date().toISOString(),
    });

  let body: ReactNode;
  if (!userId) {
    body = <EmptyState title="Sign in to report" />;
  } else if (!target) {
    body = (
      <EmptyState
        title="Nothing to report"
        message="This link does not point at anything that can be reported."
      />
    );
  } else if (mine.isLoading) {
    body = <LoadingState />;
  } else if (mine.data) {
    body = <Reported kind={target.kind} report={mine.data} />;
  } else if (target.kind === 'pick') {
    /* A failed check lands here too: knowing you already reported is a
       courtesy, and a second report is a no-op in the database anyway. */
    body = <PickReport userId={userId} target={target} game={params.game} onSent={onSent} />;
  } else if (target.kind === 'suggestion') {
    body = <SuggestionReport userId={userId} target={target} onSent={onSent} />;
  } else if (target.kind === 'review') {
    body = <ReviewReport userId={userId} target={target} onSent={onSent} />;
  } else {
    body = <UserContentReport userId={userId} target={target} onSent={onSent} />;
  }

  return (
    <Screen
      edges={['bottom']}
      insetHeader
      modal
      topBar={<FrostedTopBar dismiss title={target ? REPORT_TITLE[target.kind] : 'Report'} />}>
      {body}
    </Screen>
  );
}

/** What the bar calls the form, per kind of thing reported. */
const REPORT_TITLE: Record<ReportKind, string> = {
  pick: 'Report this pick',
  suggestion: 'Report this suggestion',
  review: 'Report this review',
  comment: 'Report this comment',
  wall_post: 'Report this post',
  profile: 'Report this account',
  ping: 'Report this ping',
  ping_suggestion: 'Report this suggestion',
};

function targetFrom(params: Params): ReportTarget | null {
  if (!params.id || !isReportKind(params.kind)) return null;
  switch (params.kind) {
    case 'pick':
      return { kind: 'pick', pairId: params.id };
    case 'suggestion':
      return params.author
        ? { kind: 'suggestion', pairId: params.id, authorId: params.author }
        : null;
    case 'review':
      return { kind: 'review', logId: params.id };
    case 'comment':
    case 'wall_post':
    case 'profile':
    case 'ping':
    case 'ping_suggestion':
      return params.author
        ? { kind: params.kind, targetId: params.id, authorId: params.author }
        : null;
  }
}

// ---------------------------------------------------------------------------
// The three kinds: what each one is, and where it is sent
// ---------------------------------------------------------------------------

function PickReport({
  userId,
  target,
  game,
  onSent,
}: {
  userId: string;
  target: Extract<ReportTarget, { kind: 'pick' }>;
  game: string | undefined;
  onSent: () => void;
}) {
  /* Both keys are the pick screen's own, so coming from there costs nothing. */
  const pair = useQuery({
    queryKey: ['similar-pair', target.pairId, game],
    queryFn: () => getSimilarPair(game!, target.pairId),
    enabled: !!game,
  });
  const source = useQuery({
    queryKey: ['game', game],
    queryFn: ({ signal }) => getGameById(game!, signal),
    enabled: !!game,
    staleTime: 30 * 60_000,
  });

  const context = pair.data
    ? source.data
      ? `${pair.data.title}, suggested as like ${source.data.title}`
      : pair.data.title
    : null;

  return (
    <ReportForm
      context={context}
      choices={PICK_CHOICES}
      send={(reason, note) => reportSimilarity(userId, target.pairId, reason, note)}
      onSent={onSent}
      promise="Only moderators see reports. Three of them take a pick off the list until a moderator has looked."
    />
  );
}

function SuggestionReport({
  userId,
  target,
  onSent,
}: {
  userId: string;
  target: Extract<ReportTarget, { kind: 'suggestion' }>;
  onSent: () => void;
}) {
  const suggestions = useQuery({
    queryKey: ['similar-suggestions', target.pairId],
    queryFn: () => getSimilaritySuggestions(target.pairId),
  });

  const entry = suggestions.data?.find((row) => row.author_id === target.authorId) ?? null;
  const name = entry ? displayNameFor(entry) : null;
  const comment = entry?.comment?.trim() || null;
  const reasons = entry?.reasons.map((reason) => SIMILARITY_REASON_LABEL[reason]).join(' · ');

  return (
    <ReportForm
      context={name ? `${name}’s reasons` : null}
      quote={comment ? `“${comment}”` : reasons || null}
      choices={CONTENT_CHOICES}
      send={(reason, note) =>
        reportSuggestion(userId, target.pairId, target.authorId, reason, note)
      }
      onSent={onSent}
      promise={`Only moderators see reports, and ${name ?? 'its author'} is never told who sent one. Nothing comes down until a moderator has read it.`}
    />
  );
}

function ReviewReport({
  userId,
  target,
  onSent,
}: {
  userId: string;
  target: Extract<ReportTarget, { kind: 'review' }>;
  onSent: () => void;
}) {
  /* The review page's key: reporting from there is instant. */
  const log = useQuery({
    queryKey: ['log', target.logId],
    queryFn: () => getLogById(target.logId),
  });

  const review = log.data ?? null;
  const name = review ? displayNameFor(review.profile) : null;
  const prose = review?.review?.trim() || review?.review_title?.trim() || null;

  return (
    <ReportForm
      context={review ? `${name}’s review of ${review.game?.title ?? 'a game'}` : null}
      /* A review behind a spoiler warning is not quoted: whoever is reporting
         it may have tapped the flag without uncovering it, and this is no
         place to give the ending away. */
      quote={review?.spoilers ? null : prose}
      asReview
      aside={
        review?.spoilers && prose ? 'Marked as containing spoilers, so not quoted here.' : null
      }
      choices={CONTENT_CHOICES}
      send={(reason, note) => reportReview(userId, target.logId, reason, note)}
      onSent={onSent}
      promise={`Only moderators see reports, and ${name ?? 'its author'} is never told who sent one. Nothing comes down until a moderator has read it.`}
    />
  );
}

/** What each of 0045's kinds is called in the form's head. */
const USER_CONTENT_NOUN: Record<UserContentKind, string> = {
  comment: 'comment',
  wall_post: 'wall post',
  profile: 'account',
  ping: 'ping',
  ping_suggestion: 'suggestion',
};

function UserContentReport({
  userId,
  target,
  onSent,
}: {
  userId: string;
  target: Extract<ReportTarget, { kind: UserContentKind }>;
  onSent: () => void;
}) {
  const content = useQuery({
    queryKey: ['reported-content', target.kind, target.targetId],
    queryFn: () => getReportedContent(target),
  });

  const name = content.data?.authorName ?? null;
  const profile = target.kind === 'profile';

  return (
    <ReportForm<UserContentReportReason>
      context={name ? (profile ? name : `${name}’s ${USER_CONTENT_NOUN[target.kind]}`) : null}
      quote={content.data?.quote ?? null}
      choices={profile ? PROFILE_CHOICES : CONTENT_CHOICES}
      send={(reason, note) => reportUserContent(userId, target, reason, note)}
      onSent={onSent}
      promise={`Only moderators see reports, and ${name ?? 'they'} ${name ? 'is' : 'are'} never told who sent one. Nothing comes down until a moderator has read it.${profile ? ' To stop seeing them now, block them from their profile.' : ''}`}
    />
  );
}

// ---------------------------------------------------------------------------
// The form, and what follows it
// ---------------------------------------------------------------------------

/** How much of the reported words to show: enough to recognise, not to reread. */
const QUOTE_LINES = 4;

function ReportForm<R extends string>({
  context,
  quote = null,
  asReview = false,
  aside = null,
  choices,
  send,
  onSent,
  promise,
}: {
  /** Whose, and about what. Null until the target has loaded. */
  context: string | null;
  /** The words being reported, if there are any to show. */
  quote?: string | null;
  /** A review's words keep the review's own type step and its quieter ink. */
  asReview?: boolean;
  /** A line under the quote — why there is none, when there is none. */
  aside?: string | null;
  choices: readonly Choice<R>[];
  send: (reason: R, note: string) => Promise<void>;
  onSent: () => void;
  /** Who will see this, and what it can and cannot do. */
  promise: string;
}) {
  const theme = useTheme();
  const [reason, setReason] = useState<R | null>(null);
  const [note, setNote] = useState('');

  const submit = useMutation({
    mutationFn: () => send(reason!, note),
    onSuccess: onSent,
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
          {context && (
            <Text variant="h4" accessibilityRole="header">
              {context}
            </Text>
          )}
          {quote && (
            /* A rule down the left, the way a quotation is set: these are
               somebody else's words, shown so you can check they are the ones
               you meant. */
            <View style={[styles.quote, { borderLeftColor: theme.borderStrong }]}>
              <Text
                variant={asReview ? 'reviewExcerpt' : 'bodySmall'}
                color={asReview ? 'proseInk' : 'textSecondary'}
                numberOfLines={QUOTE_LINES}>
                {quote}
              </Text>
            </View>
          )}
          {aside && (
            <Text variant="caption" color="textMuted">
              {aside}
            </Text>
          )}
        </View>

        <ChoiceChips
          label="What’s wrong with it"
          choices={choices}
          value={reason}
          onChange={setReason}
          withHints
        />

        <TextField
          label="Anything a moderator should know · optional"
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={MAX_REPORT_NOTE}
          hint={`${note.length}/${MAX_REPORT_NOTE}`}
        />

        {submit.isError && (
          <Text variant="bodySmall" color="danger">
            {submit.error instanceof Error
              ? `That did not send. ${submit.error.message}`
              : 'That did not send.'}
          </Text>
        )}

        <View style={styles.send}>
          <Button
            title="Send report"
            fullWidth
            disabled={!reason}
            loading={submit.isPending}
            onPress={() => submit.mutate()}
          />
          <Text variant="caption" color="textMuted" style={styles.centred}>
            {promise}
          </Text>
        </View>
      </PageScrollView>
    </KeyboardAvoidingView>
  );
}

/** Sent — now, or on an earlier visit. Either way there is nothing left to do. */
function Reported({ kind, report }: { kind: ReportKind; report: MyReport }) {
  const accent = useAccent();
  const router = useRouter();

  return (
    <View style={styles.done}>
      {/* A lit disc rather than a bare glyph: the one thing on this screen,
          and the answer to the question the form asked. */}
      <View style={[styles.doneMark, { backgroundColor: accent.wash, borderColor: accent.edge }]}>
        <Ionicons name="checkmark" size={30} color={accent.onSurface} />
      </View>
      <Text variant="h2" style={styles.centred} accessibilityRole="header">
        Reported
      </Text>
      <Text variant="body" color="textSecondary" style={styles.centred}>
        {`You reported this ${timeAgoLong(report.created_at)}. `}
        {report.status === 'resolved'
          ? 'A moderator has looked at it since.'
          : 'A moderator will look at it.'}
      </Text>
      <Text variant="bodySmall" color="textMuted" style={styles.centred}>
        {kind === 'pick'
          ? 'Three reports take a pick off the list until then.'
          : 'Nothing comes down until they have read it.'}
      </Text>
      <View style={styles.doneAction}>
        <Button title="Done" variant="secondary" fullWidth onPress={() => router.back()} />
      </View>
    </View>
  );
}

const DONE_MARK = 64;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centred: { textAlign: 'center' },
  /* Roomier than a list screen: `x24` at the sides and `x32` between the four
     parts (what, why, a note, send). A report is read before it is sent, and a
     form packed to list density reads as a formality to click through. */
  content: {
    paddingHorizontal: Spacing.x24,
    paddingTop: Spacing.x16,
    gap: Spacing.x32,
    paddingBottom: Spacing.x48,
  },
  head: { gap: Spacing.x8 },
  quote: { borderLeftWidth: 2, paddingLeft: Spacing.x12, marginTop: Spacing.x4 },
  send: { gap: Spacing.x16 },
  done: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x12,
    paddingHorizontal: Spacing.x32,
  },
  doneMark: {
    width: DONE_MARK,
    height: DONE_MARK,
    borderRadius: DONE_MARK / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.x8,
  },
  doneAction: { alignSelf: 'stretch', marginTop: Spacing.x24 },
});
