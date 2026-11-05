import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import type { Ref } from 'react';
import { Image, Text as RNText, StyleSheet, View } from 'react-native';

import { QuoteBlock } from '@/components/quote-block';
import { ScoreTile } from '@/components/ui/score-tile';
import { labelFor } from '@/constants/score';
import { SHARE_PODIUM, shareCardRamp, shareInkToken, shareTintOn } from '@/constants/share-card';
import { Typeface, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ReviewPodiumCardProps = {
  /** What is captured: the card and nothing else. */
  ref?: Ref<View>;
  width: number;
  /** The chosen background, as the Words card wears it. */
  background: string;
  gameTitle: string;
  /** Developer · year, as a review card prints it. */
  credit: string;
  artUri: string | null;
  /** "@handle", or the writer's name when they have none. */
  handle: string;
  avatarUrl: string | null;
  /** "now", "12h ago" — when the review was written. */
  posted: string;
  text: string;
  asQuote: boolean;
  score: number | null;
};

/**
 * The second image a review can be shared as — the owner's reference
 * (2026-10-16), a music rating app's card, its layout replicated with the
 * app's own pieces: who and when across the top with the app's mark in the
 * corner; the art, the game and the score — the app's square in place of the
 * reference's ring — in a row; and the words under them.
 *
 * Its ground is the Words card's — the chosen background as the same ramp,
 * the type white or near-black by its luminance — at the owner's direction
 * (2026-10-16): it was a light wash of the colour, as the reference's frosted
 * glass is, and they had it match the first card. Measured in `SHARE_PODIUM`.
 *
 * Captured as the classic card is, so its pictures are React Native's
 * `<Image>` (see `<ReviewShareCard>` for why).
 */
export function ReviewPodiumCard({
  ref,
  width,
  background,
  gameTitle,
  credit,
  artUri,
  handle,
  avatarUrl,
  posted,
  text,
  asQuote,
  score,
}: ReviewPodiumCardProps) {
  const theme = useTheme();
  const [top, foot] = shareCardRamp(background);
  const ink = theme[shareInkToken(background)];
  const quiet = withAlpha(ink, SHARE_PODIUM.quietAlpha);
  const initial = handle.replace(/^@/, '').charAt(0).toUpperCase() || '?';

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.card, { width, backgroundColor: foot }]}
      accessible
      accessibilityLabel={[
        `${handle} on ${gameTitle}`,
        score !== null ? `${score}, ${labelFor(score)}` : null,
        asQuote ? `“${text}”` : text,
      ]
        .filter(Boolean)
        .join('. ')}>
      <LinearGradient colors={[top, foot]} style={StyleSheet.absoluteFill} />

      <View style={styles.top}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: withAlpha(ink, 0.14) }]}>
            <RNText style={[styles.initial, { color: ink }]}>{initial}</RNText>
          </View>
        )}
        <RNText numberOfLines={1} style={[styles.handle, { color: ink }]}>
          {handle}
          {!!posted && <RNText style={[styles.time, { color: quiet }]}>{`  ${posted}`}</RNText>}
        </RNText>
        {/* The app's mark where the reference has its own: a controller in a
            disc until GameLog has a logo. */}
        <View style={[styles.mark, { backgroundColor: ink }]}>
          <Ionicons
            name="game-controller"
            size={SHARE_PODIUM.markGlyph}
            color={shareTintOn(background, ink)}
          />
        </View>
      </View>

      <View style={styles.game}>
        {artUri && <Image source={{ uri: artUri }} style={styles.art} resizeMode="cover" />}
        <View style={styles.titles}>
          <RNText numberOfLines={2} style={[styles.title, { color: ink }]}>
            {gameTitle}
          </RNText>
          {!!credit && (
            <RNText numberOfLines={1} style={[styles.credit, { color: quiet }]}>
              {credit}
            </RNText>
          )}
        </View>
        {score !== null && <ScoreTile score={score} size="medium" showLabel={false} />}
      </View>

      {asQuote ? (
        <QuoteBlock text={text} size="podium" color={ink} accessible={false} style={styles.words} />
      ) : (
        <RNText
          numberOfLines={SHARE_PODIUM.maxLines}
          ellipsizeMode="tail"
          style={[styles.words, styles.text, { color: ink }]}>
          {`“${text}”`}
        </RNText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: SHARE_PODIUM.padding,
    borderRadius: SHARE_PODIUM.radius,
    overflow: 'hidden',
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: {
    width: SHARE_PODIUM.avatar,
    height: SHARE_PODIUM.avatar,
    borderRadius: SHARE_PODIUM.avatar / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: { fontSize: 12, lineHeight: 14, fontFamily: Typeface.bold },
  handle: { ...SHARE_PODIUM.handle, flex: 1, minWidth: 0, fontFamily: Typeface.bold },
  time: { ...SHARE_PODIUM.time, fontFamily: Typeface.regular },
  mark: {
    width: SHARE_PODIUM.mark,
    height: SHARE_PODIUM.mark,
    borderRadius: SHARE_PODIUM.mark / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  game: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SHARE_PODIUM.artGap,
    marginTop: SHARE_PODIUM.rowGap,
  },
  art: {
    width: SHARE_PODIUM.art,
    height: SHARE_PODIUM.art,
    borderRadius: SHARE_PODIUM.artRadius,
  },
  titles: { flex: 1, minWidth: 0, gap: 4 },
  title: { ...SHARE_PODIUM.title, fontFamily: Typeface.bold },
  credit: { ...SHARE_PODIUM.credit, fontFamily: Typeface.regular },
  words: { marginTop: SHARE_PODIUM.rowGap },
  /* The reference sets its line in italic: a family here, never a style —
     Android synthesises no oblique for a custom font. */
  text: { ...SHARE_PODIUM.text, fontFamily: Typeface.italic },
});
