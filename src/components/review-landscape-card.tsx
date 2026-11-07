import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { QuoteBlock } from '@/components/quote-block';
import { PosterTitle } from '@/components/poster-title';
import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { RichText } from '@/components/ui/rich-text';
import { Text } from '@/components/ui/text';
import { labelFor, scoreColor } from '@/constants/score';
import { STATUS_LABEL } from '@/constants/status';
import { Palette, Radius, Spacing, Typeface, withAlpha } from '@/constants/theme';
import { DarkRoom } from '@/hooks/use-accent';
import { useArtGround } from '@/hooks/use-key-color';
import { usePosterArt } from '@/hooks/use-poster-art';
import { smoothScrimStops } from '@/lib/scrim';
import type { LogWithRelations } from '@/lib/database.types';
import { displayNameFor } from '@/lib/format';
import { cardShows, normaliseQuote } from '@/lib/review-quote';

/** The art's shape: a rectangle, the width of the card. */
const ART_ASPECT = 16 / 9;
const LINES = 3;
/* The art's foot melts into the card's ground — its own colour — from 30%
   of the way down, on SimpMusic's smoothstep, so the logo sits on the
   colour and the words under it are on the same colour, solid. */
const RAMP = smoothScrimStops();
const FADE_FROM = 0.3;
const FADE_LOCATIONS = RAMP.locations.map((at) => FADE_FROM + at * (1 - FADE_FROM)) as [
  number,
  number,
  ...number[],
];
/** Where the art is anchored in its frame: key art is composed for its upper middle. */
const ANCHOR = { x: 0.5, y: 0.35 };

/**
 * A review on Explore's Popular reviews rail (the owner's, 2026-11-05): the
 * poster card (`<ReviewPosterCard>`) as a smaller rectangle — the game's
 * landscape art with its logo on its foot, and under the art, on the card,
 * three lines of the review (or its one sentence), the score as a number,
 * and the writer. Its art and logo are the poster's (`usePosterArt`).
 *
 * **The card is the art's colour** (the owner's, 2026-11-06, after Apple
 * News's cards): under the art the card is the art's key colour, as a game
 * page is (`useArtGround`), the art fading into it, and the words white on
 * it — in either room, so its inks are the dark room's (`<DarkRoom>`).
 */
export const ReviewLandscapeCard = memo(function ReviewLandscapeCard({
  log,
  width,
}: {
  log: LogWithRelations;
  width: number;
}) {
  const art = usePosterArt(log.game_id);
  const { game, profile } = log;

  const title = game?.title ?? 'Unknown game';
  const shows = cardShows(log);
  const review = log.review?.trim() || null;
  const quote = normaliseQuote(log.review_title) || null;
  const rating = log.rating === null ? null : Math.round(log.rating);
  const name = profile ? displayNameFor(profile) : null;
  const handle = profile?.username ? `@${profile.username}` : name;
  const picture =
    art.data?.artUrl ?? game?.hero_url ?? game?.screenshots?.[0] ?? game?.cover_url ?? null;
  const artHeight = Math.round(width / ART_ASPECT);
  const ground = useArtGround(picture, { width, height: artHeight }, ANCHOR);
  const fade = RAMP.alphas.map((alpha) => withAlpha(ground, alpha)) as [
    string,
    string,
    ...string[],
  ];

  const label = [
    handle ? `${handle}'s review of ${title}` : `A review of ${title}`,
    rating !== null ? `${rating} out of 100, ${labelFor(rating)}` : STATUS_LABEL[log.status],
    log.spoilers ? 'Contains spoilers' : shows === 'quote' ? quote : review,
    'Opens the review.',
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <Link href={{ pathname: '/review/[id]', params: { id: log.id } }} asChild>
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={label}
        scaleTo={0.97}
        style={StyleSheet.flatten([styles.card, { width, backgroundColor: ground }])}>
        <DarkRoom>
          <View style={[styles.art, { height: artHeight }]}>
            {picture && (
              <Image
                source={{ uri: picture }}
                recyclingKey={picture}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                contentPosition={{ top: `${ANCHOR.y * 100}%`, left: `${ANCHOR.x * 100}%` }}
                transition={220}
                cachePolicy="memory-disk"
                accessibilityIgnoresInvertColors
              />
            )}
            <LinearGradient
              colors={fade}
              locations={FADE_LOCATIONS}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.logo}>
              <PosterTitle logo={art.data?.logo ?? null} title={title} cardWidth={width * 0.8} />
            </View>
          </View>

          <View style={styles.body}>
            <View style={styles.wordsRow}>
              <View style={styles.words}>
                {log.spoilers ? (
                  <Text variant="bodySmall" color="textSecondary">
                    This review contains spoilers
                  </Text>
                ) : shows === 'quote' && quote ? (
                  <QuoteBlock
                    text={quote}
                    size="card"
                    color={Palette.text}
                    accessible={false}
                    style={styles.quote}
                  />
                ) : (
                  <RichText variant="bodySmall" numberOfLines={LINES} ellipsizeMode="tail">
                    {review ?? ''}
                  </RichText>
                )}
              </View>
              {rating !== null && (
                <Text style={[styles.score, { color: scoreColor(rating, Palette) }]}>{rating}</Text>
              )}
            </View>

            {profile && handle && (
              <View style={styles.writer}>
                <Avatar uri={profile.avatar_url} name={name} size={20} />
                <Text
                  variant="caption"
                  color="textSecondary"
                  numberOfLines={1}
                  style={styles.handle}>
                  {handle}
                </Text>
              </View>
            )}
          </View>
        </DarkRoom>
      </PressableScale>
    </Link>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: Radius.card, borderCurve: 'continuous', overflow: 'hidden' },
  art: { justifyContent: 'flex-end', overflow: 'hidden' },
  logo: { padding: Spacing.x12 },
  body: { padding: Spacing.x12, gap: Spacing.x8 },
  wordsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.x12 },
  /* Three lines held, so every card on the rail is one height. */
  words: { flex: 1, minWidth: 0, minHeight: 54 },
  quote: { textAlign: 'left' },
  score: {
    fontFamily: Typeface.extraBold,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  writer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  handle: { flexShrink: 1 },
});
