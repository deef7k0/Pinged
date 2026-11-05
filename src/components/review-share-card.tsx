import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import type { Ref } from 'react';
import { Image, Text as RNText, StyleSheet, View } from 'react-native';

import { QuoteBlock } from '@/components/quote-block';
import { labelFor, scoreColor } from '@/constants/score';
import { SHARE_CARD, shareCardRamp, shareInkToken, shareTintOn } from '@/constants/share-card';
import { Typeface, ensureContrast, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ReviewShareCardProps = {
  /** What is captured: the card and nothing else. */
  ref?: Ref<View>;
  width: number;
  background: string;
  gameTitle: string;
  /** Developer · release year, under the title. Empty draws nothing. */
  credit: string;
  /** The game's art, square where SteamGridDB has one, else the box (cropped). */
  artUri: string | null;
  authorName: string;
  avatarUrl: string | null;
  /** The words: the quote, or the part of the review that was picked. */
  text: string;
  /** Draw the words as the quote, between the marks; else as the review's own. */
  asQuote: boolean;
  score: number | null;
};

/**
 * The image somebody saves or sends of a review — SimpMusic's lyrics card
 * (`ShareLyricsCard.kt`), with the review's words where the lyrics are and the
 * score in the corner opposite the app's name. Every measurement is its own and
 * is in `constants/share-card.ts`.
 *
 * ```text
 *   [ art ]  Hollow Knight
 *            Team Cherry · 2017
 *
 *   (◍) ada
 *
 *   Gorgeous and lonely, and far too
 *   long for what it has to say.
 *
 *   (◉) GameLog                92 GREAT
 * ```
 *
 * When the card is the quote, its writer signs it underneath, centred, as a
 * quotation is cited (2026-10-17):
 *
 * ```text
 *   [ art ]  Hollow Knight
 *            Team Cherry · 2017
 *
 *      “Gorgeous and lonely, and far
 *        too long for what it says.”
 *               — (◍) ada
 *
 *   (◉) GameLog                92 GREAT
 * ```
 *
 * ## Drawn to be photographed
 *
 * The card is captured as it stands (`react-native-view-shot`), which on
 * Android draws it into a software canvas. Two consequences:
 *
 * - **Its pictures are React Native's `<Image>`, not expo-image.** Glide, which
 *   draws expo-image on Android, hands its views hardware bitmaps, and a
 *   software canvas cannot draw one — the art would come out blank or the
 *   capture would fail. The art and the face are small and already loaded by
 *   the time anybody presses Save: the preview is on screen first.
 * - **Its ramp is a gradient view, and it ends on a colour, not on
 *   `transparent`.** Nothing on it is blurred or animated.
 *
 * The words take the card's own ink, chosen by the background's luminance
 * (SimpMusic's rule): white on a dark swatch, near-black on the paper one.
 */
export function ReviewShareCard({
  ref,
  width,
  background,
  gameTitle,
  credit,
  artUri,
  authorName,
  avatarUrl,
  text,
  asQuote,
  score,
}: ReviewShareCardProps) {
  const theme = useTheme();
  const ink = theme[shareInkToken(background)];
  const quiet = withAlpha(ink, SHARE_CARD.secondaryAlpha);
  const [top, foot] = shareCardRamp(background);
  const initial = authorName.trim().charAt(0).toUpperCase() || '?';
  const scoreInk = score === null ? ink : ensureContrast(scoreColor(score, theme), foot, 3);

  /* Who wrote it: on a row of its own under the game (2026-10-16) — or, when
     the card is the quote, under the quote as its citation. */
  const writer = (
    <View style={[styles.writer, asQuote && styles.citation]}>
      {asQuote && <RNText style={[styles.byline, { color: quiet }]}>—</RNText>}
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, { backgroundColor: withAlpha(ink, 0.24) }]}>
          <RNText style={[styles.initial, { color: ink }]}>{initial}</RNText>
        </View>
      )}
      <RNText numberOfLines={1} style={[styles.byline, { color: quiet }]}>
        {authorName}
      </RNText>
    </View>
  );

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.card, { width, backgroundColor: foot }]}
      accessible
      accessibilityLabel={[
        `${authorName} on ${gameTitle}${credit ? ` (${credit})` : ''}`,
        asQuote ? `“${text}”` : text,
        score !== null ? `${score}, ${labelFor(score)}` : null,
      ]
        .filter(Boolean)
        .join('. ')}>
      <LinearGradient colors={[top, foot]} style={StyleSheet.absoluteFill} />

      {/* The game, then who wrote it — unless the card is the quote, which
          its writer signs at the foot. */}
      <View style={styles.head}>
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
      </View>
      {!asQuote && writer}

      {asQuote ? (
        <>
          <QuoteBlock
            text={text}
            size="share"
            color={ink}
            accessible={false}
            style={styles.quote}
          />
          {/* Signed under it, as a quotation is cited — the owner's direction
              (2026-10-17): centred, a dash before the writer. */}
          {writer}
        </>
      ) : (
        <RNText
          numberOfLines={SHARE_CARD.maxLines}
          ellipsizeMode="tail"
          style={[styles.words, styles.text, { color: ink }]}>
          {text}
        </RNText>
      )}

      <View style={styles.foot}>
        {/*
          Whose app made the card, the way SimpMusic signs its own: a disc in
          the words' ink with the mark in the card's colour pushed off it. The
          mark is a controller until GameLog has a logo of its own.
        */}
        <View style={styles.signature}>
          <View style={[styles.disc, { backgroundColor: ink }]}>
            <Ionicons
              name="game-controller"
              size={SHARE_CARD.signature.glyph}
              color={shareTintOn(background, ink)}
            />
          </View>
          <RNText style={[styles.small, { color: quiet, fontFamily: Typeface.medium }]}>
            Pinged
          </RNText>
        </View>

        {/* In the score's colour, as everywhere a score is drawn — lifted until
            it reads on whichever background was chosen. */}
        {score !== null && (
          <RNText style={[styles.small, { color: scoreInk }]}>
            <RNText style={{ fontFamily: Typeface.bold }}>{score}</RNText>
            {`  ${labelFor(score).toUpperCase()}`}
          </RNText>
        )}
      </View>
    </View>
  );
}

const { signature } = SHARE_CARD;

const styles = StyleSheet.create({
  card: {
    padding: SHARE_CARD.padding,
    borderRadius: SHARE_CARD.radius,
    overflow: 'hidden',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: SHARE_CARD.artGap },
  art: { width: SHARE_CARD.art, height: SHARE_CARD.art, borderRadius: SHARE_CARD.artRadius },
  titles: { flex: 1, minWidth: 0, gap: SHARE_CARD.titleToCredit },
  title: { ...SHARE_CARD.title, fontFamily: Typeface.semibold },
  credit: { ...SHARE_CARD.credit, fontFamily: Typeface.regular },
  writer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SHARE_CARD.writerGap,
    marginTop: SHARE_CARD.headToWriter,
  },
  avatar: {
    width: SHARE_CARD.avatar,
    height: SHARE_CARD.avatar,
    borderRadius: SHARE_CARD.avatar / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: { fontSize: 11, lineHeight: 13, fontFamily: Typeface.bold },
  byline: { ...SHARE_CARD.byline, fontFamily: Typeface.regular, flexShrink: 1 },
  words: { marginTop: SHARE_CARD.headToText, marginBottom: SHARE_CARD.textToFoot },
  quote: { marginTop: SHARE_CARD.headToText },
  /* Under the quote, centred, and the foot's room under it instead. */
  citation: {
    alignSelf: 'center',
    marginTop: SHARE_CARD.headToWriter,
    marginBottom: SHARE_CARD.textToFoot,
  },
  text: { ...SHARE_CARD.text, fontFamily: Typeface.bold },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  signature: { flexDirection: 'row', alignItems: 'center', gap: signature.gap },
  disc: {
    width: signature.disc,
    height: signature.disc,
    borderRadius: signature.disc / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: {
    fontSize: signature.fontSize,
    lineHeight: signature.lineHeight,
    fontFamily: Typeface.medium,
  },
});
