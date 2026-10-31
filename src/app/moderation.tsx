import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { ChoiceChips } from '@/components/choice-chips';
import { Button } from '@/components/ui/button';
import { CARD_INSET, cardShape } from '@/components/ui/card-material';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageFlatList } from '@/components/ui/page-scroll';
import { Poster } from '@/components/ui/poster';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { TabBar } from '@/components/ui/tab-bar';
import { Text } from '@/components/ui/text';
import { PHOTO_KIND_LABEL, releaseLine } from '@/constants/physical';
import { USER_CONTENT_REASON_LABEL } from '@/constants/reports';
import { REPORT_REASON_LABEL, SIMILARITY_REASON_LABEL } from '@/constants/similarity';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  getPendingContributions,
  getReviewReports,
  getSimilarityReports,
  getSuggestionReports,
  getUserContentReports,
  isModerator,
  moderateContribution,
  moderateReview,
  moderateSimilarity,
  moderateSuggestion,
  moderateUserContent,
  type ContributionWithRelations,
} from '@/lib/api';
import type {
  ReviewReportQueueRow,
  SimilarityReportQueueRow,
  SuggestionReportQueueRow,
  UserContentKind,
  UserContentReportQueueRow,
  UserContentReportReason,
} from '@/lib/database.types';
import { displayBarcode } from '@/lib/barcode';
import { displayNameFor, timeAgo } from '@/lib/format';
import { useAuth } from '@/store/auth';

/**
 * Reasons a claim is turned down. Preset rather than typed: the contributor sees
 * the reason on their submissions screen, and a short, consistent one teaches
 * more than a moderator's shorthand.
 */
const REJECT_REASONS = [
  { value: 'wrong-game', label: 'Wrong game', note: 'The barcode belongs to a different game.' },
  {
    value: 'wrong-release',
    label: 'Wrong platform or region',
    note: 'The platform, region or edition does not match this barcode.',
  },
  {
    value: 'not-a-game',
    label: 'Not a game box',
    note: 'This barcode is not on a game’s packaging.',
  },
  { value: 'spam', label: 'Spam', note: 'Removed as spam.' },
] as const;

type RejectReason = (typeof REJECT_REASONS)[number]['value'];

/*
 * One tab per queue. The three report queues are apart rather than merged
 * because each is settled differently: a pick is hidden or put back, while a
 * suggestion or a review has its words removed or its reports dismissed.
 */
const TABS = [
  { key: 'releases' as const, label: 'Releases' },
  { key: 'picks' as const, label: 'Picks' },
  { key: 'suggestions' as const, label: 'Suggestions' },
  { key: 'reviews' as const, label: 'Reviews' },
  { key: 'people' as const, label: 'Comments & people' },
];

type ModerationTab = (typeof TABS)[number]['key'];

/**
 * The review queues for community data — barcode submissions, reported
 * recommendations, and reported suggestions and reviews (0031). Moderators only.
 *
 * ## What a moderator is deciding
 *
 * Whether a barcode is what someone said it is. Most claims never reach this
 * screen's judgement at all: two independent people describing the same box the
 * same way approve it themselves (0024). The queue is what is left — claims no
 * one has seconded yet, and barcodes two people disagree about, which is why
 * every claim for the same barcode is shown together.
 *
 * The screen is a convenience, not the authority. `moderate_release_contribution`
 * checks `moderators` itself, so a non-moderator who found this route would be
 * refused by the database, not merely by the screen.
 *
 * Oldest first: first come, first judged.
 */
export default function ModerationScreen() {
  const userId = useAuth((state) => state.session?.user.id) ?? null;
  const [tab, setTab] = useState<ModerationTab>('releases');

  const moderator = useQuery({
    queryKey: ['is-moderator', userId],
    queryFn: isModerator,
    enabled: !!userId,
  });

  const queue = useQuery({
    queryKey: ['moderation-queue'],
    queryFn: () => getPendingContributions(50),
    enabled: moderator.data === true,
  });

  /* Each fetched once its tab is opened: most visits here are for the release
     queue, and every report queue is an RPC that aggregates across its table. */
  const reports = useQuery({
    queryKey: ['similarity-reports'],
    queryFn: getSimilarityReports,
    enabled: moderator.data === true && tab === 'picks',
  });

  const suggestionReports = useQuery({
    queryKey: ['suggestion-reports'],
    queryFn: getSuggestionReports,
    enabled: moderator.data === true && tab === 'suggestions',
  });

  const reviewReports = useQuery({
    queryKey: ['review-reports'],
    queryFn: getReviewReports,
    enabled: moderator.data === true && tab === 'reviews',
  });

  /* Comments, wall posts and profiles (0045). `null` is a database without it. */
  const peopleReports = useQuery({
    queryKey: ['user-content-reports'],
    queryFn: getUserContentReports,
    enabled: moderator.data === true && tab === 'people',
  });

  if (moderator.isLoading) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back title="Moderation" />}>
        <LoadingState />
      </Screen>
    );
  }

  if (!moderator.data) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back title="Moderation" />}>
        <EmptyState title="Moderators only" message="This queue is for Gamelog’s moderators." />
      </Screen>
    );
  }

  /* How many claims share each barcode, so a disagreement reads as one. */
  const perBarcode = new Map<string, number>();
  for (const entry of queue.data ?? []) {
    perBarcode.set(entry.barcode, (perBarcode.get(entry.barcode) ?? 0) + 1);
  }

  const header = (
    <View style={styles.head}>
      <TabBar tabs={TABS} value={tab} onChange={setTab} label="What to review" />
      {tab === 'releases' && queue.data && (
        <Text variant="label" color="textMuted">
          {queue.data.length === 0
            ? 'NOTHING WAITING'
            : `${queue.data.length} WAITING · OLDEST FIRST`}
        </Text>
      )}
      {tab === 'picks' && reports.data && (
        <Text variant="label" color="textMuted">
          {reports.data.length === 0
            ? 'NO OPEN REPORTS'
            : `${reports.data.length} REPORTED · HIDDEN ONES FIRST`}
        </Text>
      )}
      {tab === 'suggestions' && suggestionReports.data && (
        <Text variant="label" color="textMuted">
          {suggestionReports.data.length === 0
            ? 'NO OPEN REPORTS'
            : `${suggestionReports.data.length} REPORTED · OLDEST FIRST`}
        </Text>
      )}
      {tab === 'reviews' && reviewReports.data && (
        <Text variant="label" color="textMuted">
          {reviewReports.data.length === 0
            ? 'NO OPEN REPORTS'
            : `${reviewReports.data.length} REPORTED · OLDEST FIRST`}
        </Text>
      )}
      {tab === 'people' && peopleReports.data && (
        <Text variant="label" color="textMuted">
          {peopleReports.data.length === 0
            ? 'NO OPEN REPORTS'
            : `${peopleReports.data.length} REPORTED · OLDEST FIRST`}
        </Text>
      )}
    </View>
  );

  let list: ReactNode;
  switch (tab) {
    case 'releases':
      list = (
        <PageFlatList
          data={queue.data ?? []}
          keyExtractor={(entry) => entry.id}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <ClaimCard entry={item} siblings={(perBarcode.get(item.barcode) ?? 1) - 1} />
          )}
          ItemSeparatorComponent={Separator}
          ListEmptyComponent={
            queue.isLoading ? (
              <LoadingState />
            ) : queue.isLoadingError ? (
              <ErrorState error={queue.error} onRetry={() => void queue.refetch()} />
            ) : (
              <EmptyState
                title="The queue is empty"
                message="Every submission has been decided — or seconded by someone else with the same box."
              />
            )
          }
        />
      );
      break;
    case 'picks':
      list = (
        <PageFlatList
          data={reports.data ?? []}
          keyExtractor={(entry) => entry.similarity_id}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={header}
          renderItem={({ item }) => <ReportCard entry={item} />}
          ItemSeparatorComponent={Separator}
          ListEmptyComponent={
            reports.isLoading ? (
              <LoadingState />
            ) : reports.isLoadingError ? (
              <ErrorState error={reports.error} onRetry={() => void reports.refetch()} />
            ) : (
              <EmptyState
                title="No open reports"
                message="Nobody has reported a community recommendation."
              />
            )
          }
        />
      );
      break;
    case 'suggestions':
      list = (
        <PageFlatList
          data={suggestionReports.data ?? []}
          keyExtractor={(entry) => `${entry.similarity_id}:${entry.author_id}`}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={header}
          renderItem={({ item }) => <SuggestionReportCard entry={item} />}
          ItemSeparatorComponent={Separator}
          ListEmptyComponent={
            suggestionReports.isLoading ? (
              <LoadingState />
            ) : suggestionReports.isLoadingError ? (
              <ErrorState
                error={suggestionReports.error}
                onRetry={() => void suggestionReports.refetch()}
              />
            ) : (
              <EmptyState
                title="No open reports"
                message="Nobody has reported what someone wrote about a pick."
              />
            )
          }
        />
      );
      break;
    case 'reviews':
      list = (
        <PageFlatList
          data={reviewReports.data ?? []}
          keyExtractor={(entry) => entry.log_id}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={header}
          renderItem={({ item }) => <ReviewReportCard entry={item} />}
          ItemSeparatorComponent={Separator}
          ListEmptyComponent={
            reviewReports.isLoading ? (
              <LoadingState />
            ) : reviewReports.isLoadingError ? (
              <ErrorState
                error={reviewReports.error}
                onRetry={() => void reviewReports.refetch()}
              />
            ) : (
              <EmptyState title="No open reports" message="Nobody has reported a review." />
            )
          }
        />
      );
      break;
    case 'people':
      list = (
        <PageFlatList
          data={peopleReports.data ?? []}
          keyExtractor={(entry) => `${entry.kind}:${entry.target_id}`}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={header}
          renderItem={({ item }) => <UserContentReportCard entry={item} />}
          ItemSeparatorComponent={Separator}
          ListEmptyComponent={
            peopleReports.isLoading ? (
              <LoadingState />
            ) : peopleReports.isLoadingError ? (
              <ErrorState
                error={peopleReports.error}
                onRetry={() => void peopleReports.refetch()}
              />
            ) : peopleReports.data === null ? (
              <EmptyState
                title="Not set up yet"
                message="Reports on comments, wall posts and profiles arrive with migration 0045."
              />
            ) : (
              <EmptyState
                title="No open reports"
                message="Nobody has reported a comment, a wall post or a profile."
              />
            )
          }
        />
      );
      break;
  }

  return (
    <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back title="Moderation" />}>
      {list}
    </Screen>
  );
}

/* Module scope: an inline `() => …` is a new component type every render, which
   remounts every separator on screen. */
function Separator() {
  return <View style={styles.separator} />;
}

/**
 * A reported recommendation: the two games, how many people reported it and why.
 *
 * Three reports hide a pair on their own (0025), so a hidden one here is
 * waiting for a verdict — *keep it hidden* or *put it back*. Either closes the
 * reports; it takes three new ones to hide it again.
 */
function ReportCard({ entry }: { entry: SimilarityReportQueueRow }) {
  const theme = useTheme();
  const queryClient = useQueryClient();

  const decide = useMutation({
    mutationFn: (action: 'hide' | 'restore') => moderateSimilarity(entry.similarity_id, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['similarity-reports'] });
      queryClient.invalidateQueries({ queryKey: ['community-similar', entry.game_a] });
      queryClient.invalidateQueries({ queryKey: ['community-similar', entry.game_b] });
    },
  });

  return (
    <View
      style={[
        cardShape,
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}>
      <View style={styles.cardHead}>
        <Text variant="label" color={entry.status === 'hidden' ? 'danger' : 'textMuted'}>
          {entry.status === 'hidden' ? 'HIDDEN BY REPORTS' : 'STILL SHOWN'}
        </Text>
        <Text variant="label" color="textMuted">
          {`${entry.report_count} ${entry.report_count === 1 ? 'REPORT' : 'REPORTS'}`}
        </Text>
      </View>
      <Text variant="h4">
        {entry.game_a_title} ↔ {entry.game_b_title}
      </Text>
      <Text variant="bodySmall" color="textSecondary">
        {entry.reasons.map((reason) => REPORT_REASON_LABEL[reason]).join(' · ')}
      </Text>
      {entry.latest_note && (
        <Text variant="bodySmall" color="textSecondary">
          “{entry.latest_note}”
        </Text>
      )}
      <Text variant="caption" color="textMuted">
        First reported {timeAgo(entry.first_reported)}
      </Text>

      {decide.isError && (
        <Text variant="bodySmall" color="danger">
          {decide.error instanceof Error ? decide.error.message : 'Could not record that.'}
        </Text>
      )}

      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button
            title={entry.status === 'hidden' ? 'Keep hidden' : 'Hide'}
            variant="secondary"
            size="small"
            fullWidth
            loading={decide.isPending && decide.variables === 'hide'}
            disabled={decide.isPending}
            onPress={() => decide.mutate('hide')}
          />
        </View>
        <View style={styles.flex}>
          <Button
            title={entry.status === 'hidden' ? 'Put it back' : 'Dismiss reports'}
            size="small"
            fullWidth
            loading={decide.isPending && decide.variables === 'restore'}
            disabled={decide.isPending}
            onPress={() => decide.mutate('restore')}
          />
        </View>
      </View>
    </View>
  );
}

/**
 * A reported suggestion: which pick it is on, whose it is, what it says, and
 * what the reporters said is wrong with it.
 *
 * Nothing here hid itself — somebody's writing waits for a moderator (0031) — so
 * the choice is to take the words down or leave them up. Removing keeps the
 * author's vote, since they still agree the games are alike, and drops the
 * upvotes the words earned. It cannot be undone, so it asks first.
 */
function SuggestionReportCard({ entry }: { entry: SuggestionReportQueueRow }) {
  const theme = useTheme();
  const queryClient = useQueryClient();

  const decide = useMutation({
    mutationFn: (action: 'remove' | 'dismiss') =>
      moderateSuggestion(entry.similarity_id, entry.author_id, action),
    onSuccess: (_result, action) => {
      queryClient.invalidateQueries({ queryKey: ['suggestion-reports'] });
      if (action !== 'remove') return;
      queryClient.invalidateQueries({ queryKey: ['similar-suggestions', entry.similarity_id] });
      queryClient.invalidateQueries({ queryKey: ['similar-pair', entry.similarity_id] });
      queryClient.invalidateQueries({ queryKey: ['community-similar'] });
    },
  });

  function askRemove() {
    Alert.alert(
      'Remove this suggestion?',
      `${entry.author_name}’s reasons and text come down, with the upvotes they earned. They still count as agreeing with the pick. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => decide.mutate('remove') },
      ]
    );
  }

  const comment = entry.comment?.trim() || null;
  const reasons = entry.reasons.map((reason) => SIMILARITY_REASON_LABEL[reason]).join(' · ');

  return (
    <View
      style={[
        cardShape,
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}>
      <View style={styles.cardHead}>
        <Text variant="label" color="textMuted" numberOfLines={1} style={styles.shrink}>
          {`SUGGESTION BY ${entry.author_name.toUpperCase()}`}
        </Text>
        <Text variant="label" color="textMuted">
          {`${entry.report_count} ${entry.report_count === 1 ? 'REPORT' : 'REPORTS'}`}
        </Text>
      </View>
      <Text variant="h4">
        {entry.game_a_title} ↔ {entry.game_b_title}
      </Text>

      {comment && <Quoted text={`“${comment}”`} />}
      {reasons.length > 0 && (
        <Text variant="caption" color="textMuted">
          {reasons}
        </Text>
      )}

      <ReportFacts
        reasons={entry.report_reasons}
        note={entry.latest_note}
        since={entry.first_reported}
      />

      {decide.isError && (
        <Text variant="bodySmall" color="danger">
          {decide.error instanceof Error ? decide.error.message : 'Could not record that.'}
        </Text>
      )}

      <RemoveOrDismiss
        removeTitle="Remove"
        pending={decide.isPending ? decide.variables : null}
        onRemove={askRemove}
        onDismiss={() => decide.mutate('dismiss')}
      />
    </View>
  );
}

/** How much of a reported review the card prints; the review page has the rest. */
const REVIEW_LINES = 12;

/**
 * A reported review: whose, of what, the writing itself, and why it was
 * reported.
 *
 * Removing takes down the headline and the prose and nothing else — the log,
 * its score and its hours stay, because those are a record of play rather than
 * something somebody said. It cannot be undone, so it asks first.
 */
function ReviewReportCard({ entry }: { entry: ReviewReportQueueRow }) {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const decide = useMutation({
    mutationFn: (action: 'remove' | 'dismiss') => moderateReview(entry.log_id, action),
    onSuccess: (_result, action) => {
      queryClient.invalidateQueries({ queryKey: ['review-reports'] });
      if (action !== 'remove') return;
      /* Everywhere a review is printed, so the removed words go from this
         device at once rather than when each screen next goes stale. */
      queryClient.invalidateQueries({ queryKey: ['log', entry.log_id] });
      queryClient.invalidateQueries({ queryKey: ['top-reviews', entry.game_id] });
      queryClient.invalidateQueries({ queryKey: ['game-reviews', entry.game_id] });
      queryClient.invalidateQueries({ queryKey: ['game-review-list', entry.game_id] });
      queryClient.invalidateQueries({ queryKey: ['review-stats', entry.game_id] });
      queryClient.invalidateQueries({ queryKey: ['user-logs', entry.author_id] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['home-activity'] });
      queryClient.invalidateQueries({ queryKey: ['discover', 'reviews'] });
      queryClient.invalidateQueries({ queryKey: ['review-chart'] });
      queryClient.invalidateQueries({ queryKey: ['latest-reviews'] });
    },
  });

  function askRemove() {
    Alert.alert(
      'Remove this review?',
      `The headline and the writing come down. ${entry.author_name}’s log of ${entry.game_title} — the score and the hours — stays. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => decide.mutate('remove') },
      ]
    );
  }

  const headline = entry.review_title?.trim() || null;
  const prose = entry.review?.trim() || null;

  return (
    <View
      style={[
        cardShape,
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}>
      <View style={styles.cardHead}>
        <Text variant="label" color="textMuted" numberOfLines={1} style={styles.shrink}>
          {`REVIEW BY ${entry.author_name.toUpperCase()}`}
        </Text>
        <Text variant="label" color="textMuted">
          {`${entry.report_count} ${entry.report_count === 1 ? 'REPORT' : 'REPORTS'}`}
        </Text>
      </View>
      <Text variant="h4">{entry.game_title}</Text>

      {/* Uncovered, even when it is flagged: judging a spoiler report means
          reading the spoiler. The flag is said in words above it instead. */}
      {entry.spoilers && (
        <Text variant="caption" color="textMuted">
          MARKED AS CONTAINING SPOILERS
        </Text>
      )}
      {headline && <Quoted text={headline} strong />}
      {prose && <Quoted text={prose} lines={REVIEW_LINES} />}
      {!headline && !prose && (
        <Text variant="bodySmall" color="textMuted">
          The writing is already gone — its author took it down.
        </Text>
      )}
      {prose && (
        <View style={styles.readAll}>
          <Button
            title="Read it in full"
            variant="ghost"
            size="small"
            onPress={() => router.push({ pathname: '/review/[id]', params: { id: entry.log_id } })}
          />
        </View>
      )}

      <ReportFacts
        reasons={entry.report_reasons}
        note={entry.latest_note}
        since={entry.first_reported}
      />

      {decide.isError && (
        <Text variant="bodySmall" color="danger">
          {decide.error instanceof Error ? decide.error.message : 'Could not record that.'}
        </Text>
      )}

      <RemoveOrDismiss
        removeTitle="Remove text"
        pending={decide.isPending ? decide.variables : null}
        onRemove={askRemove}
        onDismiss={() => decide.mutate('dismiss')}
      />
    </View>
  );
}

/** What each of 0045's kinds is called on its card, and what removing it does. */
const PEOPLE_KIND: Record<
  UserContentKind,
  { noun: string; remove: string; explain: (name: string) => string }
> = {
  comment: {
    noun: 'COMMENT',
    remove: 'Remove words',
    explain: (name) =>
      `${name}’s words are replaced by “This comment was removed by a moderator.” Replies to it stay. This cannot be undone.`,
  },
  wall_post: {
    noun: 'WALL POST',
    remove: 'Delete post',
    explain: (name) => `${name}’s wall post is deleted. This cannot be undone.`,
  },
  profile: {
    noun: 'PROFILE',
    remove: 'Reset profile',
    explain: (name) =>
      `${name}’s display name, bio, pictures and location are cleared, and their handle goes back to the one a new account gets, so they are asked for a new one. Their reviews and logs stay. This cannot be undone.`,
  },
};

/**
 * A reported comment, wall post or profile (0045). The words, a way to see
 * them where they are, what the reporters said, and the two verdicts.
 */
function UserContentReportCard({ entry }: { entry: UserContentReportQueueRow }) {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const kind = PEOPLE_KIND[entry.kind];

  const decide = useMutation({
    mutationFn: (action: 'remove' | 'dismiss') =>
      moderateUserContent(entry.kind, entry.target_id, action),
    onSuccess: (_result, action) => {
      queryClient.invalidateQueries({ queryKey: ['user-content-reports'] });
      if (action !== 'remove') return;
      if (entry.kind === 'profile') {
        queryClient.invalidateQueries({ queryKey: ['profile', entry.author_id] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['comments'] });
        queryClient.invalidateQueries({ queryKey: ['wall'] });
      }
    },
  });

  function askRemove() {
    Alert.alert(`${kind.remove}?`, kind.explain(entry.author_name), [
      { text: 'Cancel', style: 'cancel' },
      { text: kind.remove, style: 'destructive', onPress: () => decide.mutate('remove') },
    ]);
  }

  function open() {
    if (entry.kind === 'comment' && entry.context_type && entry.context_id) {
      router.push({
        pathname: '/comments/[type]/[id]',
        params: { type: entry.context_type, id: entry.context_id },
      });
    } else if (entry.kind === 'wall_post' && entry.context_id) {
      router.push({ pathname: '/profile/[id]', params: { id: entry.context_id } });
    } else {
      router.push({ pathname: '/profile/[id]', params: { id: entry.author_id } });
    }
  }

  return (
    <View
      style={[
        cardShape,
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}>
      <View style={styles.cardHead}>
        <Text variant="label" color="textMuted" numberOfLines={1} style={styles.shrink}>
          {`${kind.noun} · @${entry.author_username.toUpperCase()}`}
        </Text>
        <Text variant="label" color="textMuted">
          {`${entry.report_count} ${entry.report_count === 1 ? 'REPORT' : 'REPORTS'}`}
        </Text>
      </View>
      <Text variant="h4">{entry.author_name}</Text>

      {entry.kind === 'profile' && entry.avatar_url && (
        <Image source={{ uri: entry.avatar_url }} style={styles.reportedAvatar} />
      )}
      {entry.body?.trim() ? (
        <Quoted text={entry.body.trim()} lines={REVIEW_LINES} />
      ) : (
        <Text variant="bodySmall" color="textMuted">
          {entry.kind === 'profile' ? 'No name or bio — look at the profile.' : 'No words.'}
        </Text>
      )}
      <View style={styles.readAll}>
        <Button
          title={entry.kind === 'comment' ? 'Open the thread' : 'Open the profile'}
          variant="ghost"
          size="small"
          onPress={open}
        />
      </View>

      <ReportFacts
        reasons={entry.report_reasons}
        note={entry.latest_note}
        since={entry.first_reported}
      />

      {decide.isError && (
        <Text variant="bodySmall" color="danger">
          {decide.error instanceof Error ? decide.error.message : 'Could not record that.'}
        </Text>
      )}

      <RemoveOrDismiss
        removeTitle={kind.remove}
        pending={decide.isPending ? decide.variables : null}
        onRemove={askRemove}
        onDismiss={() => decide.mutate('dismiss')}
      />
    </View>
  );
}

/** Somebody's words, set off by a rule down the left — what is being judged. */
function Quoted({
  text,
  lines,
  strong = false,
}: {
  text: string;
  lines?: number;
  strong?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.quote, { borderLeftColor: theme.borderStrong }]}>
      <Text
        variant={strong ? 'h5' : 'bodySmall'}
        color={strong ? 'text' : 'textSecondary'}
        numberOfLines={lines}>
        {text}
      </Text>
    </View>
  );
}

/**
 * What the reporters said, under a rule: the line between the thing being
 * judged and the case against it.
 */
function ReportFacts({
  reasons,
  note,
  since,
}: {
  reasons: UserContentReportReason[];
  note: string | null;
  since: string;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.facts, { borderTopColor: theme.border }]}>
      <Text variant="bodySmall" color="textSecondary">
        {`Reported as ${reasons.map((reason) => USER_CONTENT_REASON_LABEL[reason]).join(' · ')}`}
      </Text>
      {note && (
        <Text variant="bodySmall" color="textSecondary">
          “{note}”
        </Text>
      )}
      <Text variant="caption" color="textMuted">
        First reported {timeAgo(since)}
      </Text>
    </View>
  );
}

/** The two verdicts on somebody's writing, in the pick card's arrangement. */
function RemoveOrDismiss({
  removeTitle,
  pending,
  onRemove,
  onDismiss,
}: {
  removeTitle: string;
  /** Which verdict is being sent, if one is. */
  pending: 'remove' | 'dismiss' | null | undefined;
  onRemove: () => void;
  onDismiss: () => void;
}) {
  return (
    <View style={styles.actions}>
      <View style={styles.flex}>
        <Button
          title={removeTitle}
          variant="secondary"
          size="small"
          fullWidth
          loading={pending === 'remove'}
          disabled={!!pending}
          onPress={onRemove}
        />
      </View>
      <View style={styles.flex}>
        <Button
          title="Dismiss reports"
          size="small"
          fullWidth
          loading={pending === 'dismiss'}
          disabled={!!pending}
          onPress={onDismiss}
        />
      </View>
    </View>
  );
}

function ClaimCard({ entry, siblings }: { entry: ContributionWithRelations; siblings: number }) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<RejectReason | null>(null);

  const decide = useMutation({
    mutationFn: ({ decision, note }: { decision: 'approve' | 'reject'; note?: string }) =>
      moderateContribution(entry.id, decision, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-queue'] });
      queryClient.invalidateQueries({ queryKey: ['barcode', entry.barcode] });
      queryClient.invalidateQueries({ queryKey: ['game-releases', entry.game_id] });
    },
  });

  const facts = [
    entry.publisher,
    entry.release_date,
    entry.catalog_number ? `Cat. ${entry.catalog_number}` : null,
  ].filter(Boolean);

  return (
    <View
      style={[
        cardShape,
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}>
      <View style={styles.cardHead}>
        <Text variant="label" color="textMuted">
          BARCODE {displayBarcode(entry.barcode)}
        </Text>
        {siblings > 0 && (
          <Text variant="label" color="danger">
            {`${siblings} OTHER ${siblings === 1 ? 'CLAIM' : 'CLAIMS'}`}
          </Text>
        )}
      </View>

      <View style={styles.game}>
        <Poster
          coverUrl={entry.game?.cover_url ?? null}
          heroUrl={entry.game?.hero_url ?? null}
          title={entry.game?.title ?? ''}
          width={56}
          rounded="image"
        />
        <View style={styles.flex}>
          <Text variant="h4" numberOfLines={2}>
            {entry.game?.title ?? 'Unknown game'}
          </Text>
          <Text variant="body" color="textSecondary">
            {releaseLine(entry)} · {entry.edition}
          </Text>
          {facts.length > 0 && (
            <Text variant="caption" color="textMuted">
              {facts.join(' · ')}
            </Text>
          )}
        </View>
      </View>

      {entry.notes && (
        <Text variant="bodySmall" color="textSecondary">
          “{entry.notes}”
        </Text>
      )}

      {entry.photos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photos}>
          {entry.photos.map((photo) => (
            <View key={photo.id} style={styles.photo}>
              <Image
                source={{ uri: photo.url }}
                style={[styles.thumb, { backgroundColor: theme.surfaceElevated }]}
                contentFit="cover"
                accessible
                accessibilityLabel={PHOTO_KIND_LABEL[photo.kind]}
                accessibilityIgnoresInvertColors
              />
              <Text variant="caption" color="textMuted" numberOfLines={1}>
                {PHOTO_KIND_LABEL[photo.kind]}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      <Text variant="caption" color="textMuted">
        Submitted by {displayNameFor(entry.profile)} · {timeAgo(entry.created_at)}
      </Text>

      {decide.isError && (
        <Text variant="bodySmall" color="danger">
          {decide.error instanceof Error ? decide.error.message : 'Could not record that.'}
        </Text>
      )}

      {rejecting ? (
        <View style={styles.reject}>
          <ChoiceChips
            label="Why not"
            choices={REJECT_REASONS.map(({ value, label }) => ({ value, label }))}
            value={reason}
            onChange={setReason}
          />
          <View style={styles.actions}>
            <View style={styles.flex}>
              <Button
                title="Back"
                variant="ghost"
                size="small"
                fullWidth
                onPress={() => {
                  setRejecting(false);
                  setReason(null);
                }}
              />
            </View>
            <View style={styles.flex}>
              <Button
                title="Reject"
                variant="danger"
                size="small"
                fullWidth
                disabled={!reason}
                loading={decide.isPending}
                onPress={() =>
                  decide.mutate({
                    decision: 'reject',
                    note: REJECT_REASONS.find((entry) => entry.value === reason)?.note,
                  })
                }
              />
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          <View style={styles.flex}>
            <Button
              title="Reject"
              variant="secondary"
              size="small"
              fullWidth
              disabled={decide.isPending}
              onPress={() => setRejecting(true)}
            />
          </View>
          <View style={styles.flex}>
            <Button
              title="Approve"
              size="small"
              fullWidth
              loading={decide.isPending}
              onPress={() => decide.mutate({ decision: 'approve' })}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.x16, paddingBottom: Spacing.x48 },
  head: { gap: Spacing.x12, marginBottom: Spacing.x16 },
  separator: { height: Spacing.x12 },
  /* Every card's material (`card-material`), on the app's own page. */
  card: { gap: Spacing.x12, padding: CARD_INSET },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.x8 },
  game: { flexDirection: 'row', gap: Spacing.x12, alignItems: 'flex-start' },
  photos: { gap: Spacing.x8 },
  photo: { width: 72, gap: 2 },
  thumb: { width: 72, height: 72, borderRadius: Radius.image },
  reject: { gap: Spacing.x12 },
  actions: { flexDirection: 'row', gap: Spacing.x8 },
  /* The label truncates before the report count does. */
  shrink: { flexShrink: 1 },
  quote: { borderLeftWidth: 2, paddingLeft: Spacing.x12 },
  readAll: { alignItems: 'flex-start' },
  reportedAvatar: { width: 56, height: 56, borderRadius: 28 },
  facts: { gap: Spacing.x4, paddingTop: Spacing.x12, borderTopWidth: StyleSheet.hairlineWidth },
});
