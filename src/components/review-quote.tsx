import Ionicons from '@expo/vector-icons/Ionicons';
import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { QuoteBlock } from '@/components/quote-block';
import { Avatar } from '@/components/ui/avatar';
import { CARD_INSET, cardShape, useCardMaterial } from '@/components/ui/card-material';
import { Text } from '@/components/ui/text';
import { scoreColor } from '@/constants/score';
import { Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ReviewQuoteProps = {
  /** The words: a critic's snippet, or what a member wrote. */
  text: string;
  /**
   * Who wrote it, at the foot of the card opposite the score. Omitted where
   * the card is captioned from outside — the critics' rail names the outlet
   * under each card.
   */
  byline?: string | null;
  /**
   * Draw the writer's picture before their name: its address, or null for a
   * writer without one, who gets the initial `<Avatar>` draws. Omitted — the
   * critics' cards, the game page's rail — there is no picture at all.
   */
  avatarUrl?: string | null;
  /** 0-100, or null for a review that gave none. */
  score: number | null;
  /** Lines of the text before the clamp. */
  lines: number;
  /** Set the text in quotation marks: it is an excerpt of something published elsewhere. */
  quoted?: boolean;
  /**
   * A member's review in one sentence, drawn between large marks in place of
   * the words when its writer chose it for their cards (0040) — the copy
   * screen passes it when `cardShows` says so. Never a critic's.
   */
  pullQuote?: string | null;
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
  /** A fixed frame, for a rail. Without one the card is as tall as its text. */
  size?: { width: number; height: number };
  style?: StyleProp<ViewStyle>;
};

/**
 * One review as a card of its words: the text, and under it who wrote it and
 * what they scored it.
 *
 * ```text
 *   The morality of the show wasn't
 *   questioned until he caught someone
 *   who was rich and powerful. You see…
 *
 *   username                          84
 * ```
 *
 * The critics' card on the game page — a quote and a score in the corner, the
 * outlet printed under the card by its rail — and the card a copy's screen
 * shows its owner's review in, with their name and picture at the foot.
 *
 * **It was the member's review card too**, on the game page and in the reviews
 * sheet, for a while: text, a name and a score, and nothing else. The owner
 * replaced that with `<MemberReviewCard>` (2026-10-09), which is drawn as a
 * review is on a film's page in Letterboxd — a face, the score and replies on
 * the name's line, the likes under the words. The card itself is every
 * card's material (`useCardMaterial`): the review card's corner, its
 * hairline, fifteen in, the card shadow.
 *
 * The card is not pressable itself: the rail or the row around it is, so
 * there is one target and one spoken label. `avatarUrl` leads the name with
 * the writer's picture.
 *
 * The words are set in `reviewExcerpt` and `proseInk`: review prose keeps its
 * own step and its own quieter ink, in the same family as everything else. The
 * score is in the score ramp's colour, because good, mixed and bad are read
 * before the digits are.
 */
export const ReviewQuote = memo(function ReviewQuote({
  text,
  byline = null,
  avatarUrl,
  score,
  lines,
  quoted = false,
  pullQuote = null,
  spoiler = false,
  fill,
  size,
  style,
}: ReviewQuoteProps) {
  const theme = useTheme();
  const material = useCardMaterial();

  const rounded = score === null ? null : Math.round(score);
  const words = text.trim();

  return (
    <View
      style={[
        size,
        cardShape,
        styles.card,
        { backgroundColor: fill ?? material.fill, borderColor: material.edge },
        style,
      ]}>
      {spoiler ? (
        <View style={styles.covered}>
          {/* `danger`, as `<SpoilerNotice>` uses it: read this before you act.
              The glyph and the sentence say it too. */}
          <Ionicons name="eye-off-outline" size={18} color={theme.danger} />
          <Text variant="bodySmall" color="textSecondary" style={styles.coveredText}>
            This review contains spoilers
          </Text>
        </View>
      ) : pullQuote ? (
        <QuoteBlock text={pullQuote} size="card" color={theme.proseInk} accessible={false} />
      ) : (
        <Text variant="reviewExcerpt" color="proseInk" numberOfLines={lines} style={styles.text}>
          {quoted ? `“${words}”` : words}
        </Text>
      )}

      {(!!byline || rounded !== null) && (
        <View style={styles.foot}>
          {avatarUrl !== undefined && !!byline && (
            <Avatar uri={avatarUrl} name={byline} size={AVATAR} />
          )}
          <Text
            variant="reviewByline"
            color="textSecondary"
            numberOfLines={1}
            style={styles.byline}>
            {byline ?? ''}
          </Text>
          {rounded !== null && (
            <Text variant="h4" style={[styles.score, { color: scoreColor(rounded, theme) }]}>
              {rounded}
            </Text>
          )}
        </View>
      )}
    </View>
  );
});

/** The writer's picture beside their name: the size of the name's own line. */
const AVATAR = 20;

const styles = StyleSheet.create({
  /* The words take the room there is and the foot sits under them: the name at
     the leading edge, the score at the trailing one — the corner a price tag
     is in. */
  card: { justifyContent: 'space-between', gap: Spacing.x8, padding: CARD_INSET },
  text: { flexShrink: 1 },
  covered: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    minHeight: Type.reviewExcerpt.lineHeight * 2,
  },
  coveredText: { flex: 1 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  /* Elastic, so a long name truncates and the score keeps its width. Present
     even when empty: it is what holds a nameless card's score at the trailing
     edge. */
  byline: { flex: 1, minWidth: 0 },
  score: { lineHeight: Type.h4.lineHeight },
});
