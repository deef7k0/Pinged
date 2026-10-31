import Ionicons from '@expo/vector-icons/Ionicons';
import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { QuoteBlock } from '@/components/quote-block';
import { Avatar } from '@/components/ui/avatar';
import { CARD_INSET, cardShape, useCardMaterial } from '@/components/ui/card-material';
import { ScoreLine } from '@/components/ui/score';
import { Text } from '@/components/ui/text';
import { Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { cardShows } from '@/lib/review-quote';

export type MemberReviewCardProps = {
  /** Who wrote it. */
  name: string;
  /** Their picture, or null for the initial `<Avatar>` draws. */
  avatarUrl: string | null;
  /** What they wrote. */
  text: string;
  /**
   * The review in one sentence, and which of the two its writer wants on its
   * cards (0040). The quote is drawn between large marks in the words' place
   * when it is chosen — or when there are no words. See `cardShows`.
   */
  quote?: string | null;
  display?: string | null;
  /** 0-100, or null for a review that gave none. */
  score: number | null;
  likes: number;
  comments: number;
  /** The person looking has liked it: the heart is lit. */
  likedByViewer?: boolean;
  /** Lines of the text before the clamp. */
  lines: number;
  /**
   * The writer flagged the review as spoiling something. The words are
   * withheld and the card says so; the review's own page is where they are
   * uncovered, and the card is the way there.
   */
  spoiler?: boolean;
  /**
   * The card's fill. Defaults to the card material's (`useCardMaterial`) —
   * the game's own dark tone on its page, `surface` elsewhere. The reviews
   * sheet passes the app's neutral surface, whatever the page under it.
   */
  fill?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * A member's review of a game, on that game's own screens: the game page's
 * Overview and every row of the reviews sheet.
 *
 * ```text
 *   ┌────────────────────────────────────────────┐
 *   │ Finally a sequel that knows what the first │
 *   │ one was about, and the patience to say it… │
 *   │ ────────────────────────────────────────── │
 *   │ ◍  Ada   84 GREAT              ♥ 87   ◔ 12 │
 *   └────────────────────────────────────────────┘
 * ```
 *
 * **The owner's reference** (2026-10-20, a music app's review card): the
 * writing first and alone, a rule under it, and the writer along the foot —
 * face, name, and the score where the reference sets its stars. Their
 * instruction for the score is the feed card's: GameLog's number and its
 * verdict word (`<ScoreLine>`), because a 0–100 scale has fifteen verdicts and
 * five stars cannot say which.
 *
 * It replaced the arrangement before it, which was a film page's in Letterboxd
 * — the face at the left of the words, the name and score across the top, the
 * likes on a line of their own. Everything that card carried is still here; it
 * is the order that changed, and the rule is what the reference puts between
 * the two halves.
 *
 * **At the far right, where the reference has a chip**, are the counts the
 * card has always carried: how many liked the review and how many replied,
 * each drawn only when there is one (a new review is a face, a name, a score
 * and its words, not "0 likes"). The heart lights when *you* have liked it.
 *
 * ## What was not carried over
 *
 * - **Stars**, as above.
 * - **The orange heart beside the rating.** In the reference's forebear it
 *   means the writer marked the film as liked. GameLog records no such thing
 *   about a game, and giving the mark a different meaning would be a quiet
 *   lie.
 *
 * ## The card itself
 *
 * The material is every card's (`useCardMaterial`, the review card's): the
 * corner the owner measured their references by, the hairline, fifteen in.
 * The fill is the game's own tone on its page and the app's neutral `surface`
 * in the sheet, so a review is the same object in a list and on a game's page.
 *
 * Not pressable itself — the row around it is, so there is one target and one
 * spoken label.
 */
export const MemberReviewCard = memo(function MemberReviewCard({
  name,
  avatarUrl,
  text,
  quote = null,
  display = null,
  score,
  likes,
  comments,
  likedByViewer = false,
  lines,
  spoiler = false,
  fill,
  style,
}: MemberReviewCardProps) {
  const theme = useTheme();
  const material = useCardMaterial();

  const rounded = score === null ? null : Math.round(score);
  const words = text.trim();
  const shows = cardShows({ review: words, review_title: quote, review_display: display });
  /* The quote is the words' ink, so the card reads as one voice. */
  const ink = theme.proseInk;

  return (
    <View
      style={[
        cardShape,
        { backgroundColor: fill ?? material.fill, borderColor: material.edge },
        styles.card,
        style,
      ]}>
      {spoiler ? (
        <View style={styles.covered}>
          {/* `danger`, as `<SpoilerNotice>` uses it: read this before you act.
              The glyph and the sentence say it too. */}
          <Ionicons name="eye-off-outline" size={16} color={theme.danger} />
          <Text variant="bodySmall" color="textSecondary" style={styles.coveredText}>
            This review contains spoilers
          </Text>
        </View>
      ) : shows === 'quote' && quote ? (
        /* The writer chose their one sentence for their cards: it takes the
           words' place, between its drawn marks. */
        <QuoteBlock text={quote} size="card" color={ink} accessible={false} />
      ) : (
        <Text variant="reviewExcerpt" color="proseInk" numberOfLines={lines}>
          {words}
        </Text>
      )}

      {/* The reference's rule between the writing and whoever wrote it. */}
      <View style={[styles.rule, { backgroundColor: theme.border }]} />

      <View style={styles.foot}>
        <View style={styles.who}>
          <Avatar uri={avatarUrl} name={name} size={AVATAR} />
          {/* The brightest thing in the row, as it is in the reference, where
              the name measures ~#D0D5DD against the writing's ~#99A3AE — the
              writing is quiet (`proseInk`) and the signature is not. */}
          <Text variant="reviewByline" numberOfLines={1} style={styles.name}>
            {name}
          </Text>
          {/* Where the reference sets its stars. */}
          {rounded !== null && <ScoreLine score={rounded} />}
        </View>

        {(likes > 0 || comments > 0) && (
          <View style={styles.counts}>
            {likes > 0 && (
              <View style={styles.count}>
                <Ionicons
                  name="heart"
                  size={12}
                  color={likedByViewer ? theme.liked : theme.textSecondary}
                />
                <Text variant="bodySmall" color="textSecondary" style={styles.figure}>
                  {likes.toLocaleString()}
                </Text>
              </View>
            )}
            {comments > 0 && (
              <View style={styles.count}>
                <Ionicons name="chatbubble" size={12} color={theme.textSecondary} />
                <Text variant="bodySmall" color="textSecondary" style={styles.figure}>
                  {comments.toLocaleString()}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
});

/** The writer's face at the foot: the reference's 40px at its own scale, ~27dp. */
const AVATAR = 28;

const styles = StyleSheet.create({
  /* A column now: the writing, the rule, the writer. The corner and the edge
     are `<LogCard>`'s — one review card, two places. */
  card: { padding: CARD_INSET },
  /*
   * Twelve above and eight below, measured off the reference (18px and 12px at
   * its scale). The rule is the card's own edge colour — 7% white, visible as
   * a division and never as a line you read.
   */
  rule: { height: 1, marginTop: Spacing.x12, marginBottom: Spacing.x8 },

  foot: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  /* Face, name and score as one group at the leading edge; it takes the row so
     the counts sit at the far end. */
  who: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
  },
  /* Elastic, so a long name truncates and the score keeps its place beside it. */
  name: { flexShrink: 1, minWidth: 0 },

  counts: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  count: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
  figure: { fontVariant: ['tabular-nums'] },

  covered: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    minHeight: Type.reviewExcerpt.lineHeight * 2,
  },
  coveredText: { flex: 1 },
});
