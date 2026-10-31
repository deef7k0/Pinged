import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { MemberReviewCard } from '@/components/member-review-card';
import { CARD_INSET, cardShape, useCardMaterial } from '@/components/ui/card-material';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import type { TopReview } from '@/lib/api';
import { displayNameFor } from '@/lib/format';
import { formatReleaseDate } from '@/lib/games/release';
import { spokenWords } from '@/lib/review-quote';

/**
 * How much of the review is printed: three lines, at most — Surprise Me does
 * not scroll, and two more lines there come straight out of the artwork. The
 * game page prints five of the same card.
 */
const BODY_LINES = 3;

export type TopReviewCardProps = {
  review: TopReview | null;
  loading: boolean;
  onOpenReview: () => void;
  /**
   * Opens the log form for this game, where the first review gets written.
   * Absent for a game that is not out yet, which cannot be reviewed: the empty
   * state then says so and offers nothing.
   */
  onWriteReview?: () => void;
  /** The planned date of a game that is not out yet — see `onWriteReview`. */
  notOutUntil?: string;
};

/**
 * The most liked review of the dealt game, under it on Surprise Me.
 *
 * **The game page's card, literally** — the owner's direction (2026-10-16):
 * "make the review card the same one as in the game page overview tab". So the
 * review is `<MemberReviewCard>`, the component the Overview's Reviews section
 * and every row of the reviews sheet draw: the words, a rule, then the writer
 * — face, name, score, and the counts at the far end — in the game's own card
 * tone. Three lines of words, where the Overview prints five. The whole card
 * opens the review, as it does there.
 *
 * The two states with no review — none written yet, and a game not out — are
 * the same card's material (`useCardMaterial`, the card's corner, inset and
 * shadow) around a sentence, so the space under the artwork is the same object
 * whichever game is dealt.
 */
export function TopReviewCard({
  review,
  loading,
  onOpenReview,
  onWriteReview,
  notOutUntil,
}: TopReviewCardProps) {
  if (loading) {
    return (
      <Shell>
        {/* The card's own shape: three lines of words, the rule, then the
            writer's row — so nothing moves when the review lands. */}
        <View style={styles.lines}>
          <Skeleton width="100%" height={11} radius={Radius.sm} />
          <Skeleton width="92%" height={11} radius={Radius.sm} />
          <Skeleton width="68%" height={11} radius={Radius.sm} />
        </View>
        <View style={styles.rule} />
        <View style={styles.row}>
          <Skeleton width={28} height={28} radius={Radius.pill} />
          <Skeleton width="36%" height={12} radius={Radius.sm} />
        </View>
      </Shell>
    );
  }

  /* Not out yet: nothing to review and no review to write — a sentence with
     its date, and the card is not a door to anything. */
  if (!review && notOutUntil) {
    return (
      <Shell>
        <View style={styles.body}>
          <Text variant="h5">Not out yet</Text>
          <Text variant="bodySmall" color="textSecondary" numberOfLines={BODY_LINES}>
            {`It can be reviewed from ${formatReleaseDate(notOutUntil)}.`}
          </Text>
        </View>
      </Shell>
    );
  }

  /* Nobody has written about it: the card is the way to write the first. A
     random pool is mostly games nobody here has reviewed, so this is the app's
     most frequent chance to ask. */
  if (!review) {
    return (
      <Shell onPress={onWriteReview} label="Write the first review">
        <View style={styles.body}>
          <Text variant="h5">No reviews yet</Text>
          <Text variant="bodySmall" color="textSecondary" numberOfLines={BODY_LINES}>
            Nobody here has written about this one. Want to be the first?
          </Text>
        </View>
      </Shell>
    );
  }

  const { log } = review;
  const name = displayNameFor(log.profile);

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={[
        `${name}’s review, the most liked`,
        log.rating !== null ? `scored it ${Math.round(log.rating)}` : null,
        log.spoilers ? 'Contains spoilers' : spokenWords(log),
        review.likes > 0 ? `${review.likes} ${review.likes === 1 ? 'like' : 'likes'}` : null,
        'Opens the review.',
      ]
        .filter(Boolean)
        .join('. ')}
      onPress={onOpenReview}
      scaleTo={0.99}>
      <MemberReviewCard
        name={name}
        avatarUrl={log.profile?.avatar_url ?? null}
        text={log.review ?? ''}
        quote={log.review_title}
        display={log.review_display}
        score={log.rating}
        likes={review.likes}
        comments={review.comments}
        likedByViewer={review.likedByViewer}
        lines={BODY_LINES}
        spoiler={!!log.spoilers}
      />
    </PressableScale>
  );
}

/** `<MemberReviewCard>`'s material around something that is not a review. */
function Shell({
  onPress,
  label,
  children,
}: {
  onPress?: () => void;
  label?: string;
  children: ReactNode;
}) {
  const material = useCardMaterial();
  /* The review card's material: this stands where one would, and the two must
     read as the same object. */
  const card = StyleSheet.flatten([
    cardShape,
    { backgroundColor: material.fill, borderColor: material.edge, padding: CARD_INSET },
  ]);

  if (!onPress) return <View style={card}>{children}</View>;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={0.99}
      style={card}>
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  /* The three lines of the placeholder's review, at the card's own leading. */
  lines: { gap: Spacing.x4 },
  /* Where the card draws its rule, and the same room around it. */
  rule: { height: 1, marginTop: Spacing.x12, marginBottom: Spacing.x8 },
  body: { flex: 1, gap: Spacing.x4, justifyContent: 'center' },
});
