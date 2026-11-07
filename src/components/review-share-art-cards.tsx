import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import type { Ref } from 'react';
import { Image, Text as RNText, StyleSheet, View } from 'react-native';

import { PosterTitle } from '@/components/poster-title';
import { QuoteBlock } from '@/components/quote-block';
import { labelFor, scoreColor } from '@/constants/score';
import { shareInkToken, shareTintOn } from '@/constants/share-card';
import { Palette, Typeface, ensureContrast, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { GameLogo } from '@/lib/games/logo-art';
import { smoothScrimStops } from '@/lib/scrim';

/*
 * Two shared images of a review, after the owner's references (2026-11-06):
 *
 * - **Colour** — the review card in lists, as an image: the game's landscape
 *   art at the top fading into its own key colour (or a chosen one), and the
 *   review, the score and the writer on that colour.
 * - **Poster** — Muvy's card: the box art in the middle of a frame of the
 *   game's art, under an overlay of the game's colour, a blur or black, at a
 *   chosen strength; four frame shapes, the poster centred or beside the
 *   words.
 *
 * Both are captured as they stand (`react-native-view-shot`, PNG), so — as
 * `<ReviewShareCard>` explains — every picture on them is React Native's
 * `<Image>`, never expo-image. The card is the captured view and its corners
 * are rounded, so the PNG is the card with transparent corners and nothing
 * round it.
 */

const RAMP = smoothScrimStops();

/** What the two cards may leave out: the owner's switches. */
export type ShareArtShows = {
  title: boolean;
  rating: boolean;
  profile: boolean;
  words: boolean;
};

type Common = {
  ref?: Ref<View>;
  width: number;
  gameTitle: string;
  logo: GameLogo | null;
  /** Developer · year, under the title. */
  credit: string;
  handle: string;
  avatarUrl: string | null;
  /** The quote, or the part of the review that was picked. */
  text: string;
  asQuote: boolean;
  score: number | null;
  shows: ShareArtShows;
};

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

export type ColourShareCardProps = Common & {
  /** The game's landscape art. */
  artUri: string | null;
  /** The card's colour: the art's key colour, or a chosen swatch. */
  ground: string;
};

export function ColourShareCard({
  ref,
  width,
  gameTitle,
  logo,
  credit,
  handle,
  avatarUrl,
  text,
  asQuote,
  score,
  shows,
  artUri,
  ground,
}: ColourShareCardProps) {
  const theme = useTheme();
  const ink = theme[shareInkToken(ground)];
  const quiet = withAlpha(ink, 0.72);
  const artHeight = Math.round((width * 9) / 16);
  const fade = RAMP.alphas.map((alpha) => withAlpha(ground, alpha)) as [
    string,
    string,
    ...string[],
  ];
  const locations = RAMP.locations.map((at) => 0.3 + at * 0.7) as [number, number, ...number[]];

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.colourCard, { width, backgroundColor: ground }]}
      accessible
      accessibilityLabel={spoken({ gameTitle, handle, text, asQuote, score, shows })}>
      <View style={{ height: artHeight, justifyContent: 'flex-end' }}>
        {artUri && (
          <Image source={{ uri: artUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        )}
        <LinearGradient colors={fade} locations={locations} style={StyleSheet.absoluteFill} />
        {shows.title && (
          <View style={styles.colourTitle}>
            <PosterTitle
              logo={logo}
              title={gameTitle}
              cardWidth={width * 0.8}
              forCapture
              color={ink}
            />
          </View>
        )}
      </View>

      <View style={styles.colourBody}>
        {!!credit && shows.title && (
          <RNText numberOfLines={1} style={[styles.credit, { color: quiet }]}>
            {credit}
          </RNText>
        )}
        {shows.words && !!text && (
          <Words text={text} asQuote={asQuote} ink={ink} lines={6} size={17} />
        )}
        {shows.rating && score !== null && (
          <Score score={score} ink={ink} ground={ground} big={42} />
        )}
        <Foot
          handle={handle}
          avatarUrl={avatarUrl}
          ink={ink}
          ground={ground}
          showProfile={shows.profile}
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Poster
// ---------------------------------------------------------------------------

export type PosterFrame = '9:16' | '4:5' | '1:1' | '16:9';
export type PosterLayout = 'centred' | 'side';
export type PosterOverlay = 'colour' | 'blur' | 'black';

/** A frame's width over its height. */
export const FRAME_ASPECT: Record<PosterFrame, number> = {
  '9:16': 9 / 16,
  '4:5': 4 / 5,
  '1:1': 1,
  '16:9': 16 / 9,
};

export type PosterShareCardProps = Common & {
  /** The frame's height; its width is `width`. */
  height: number;
  /** The game's landscape art: the backdrop. */
  backdropUri: string | null;
  /** The box art: the poster. */
  coverUri: string | null;
  layout: PosterLayout;
  overlay: PosterOverlay;
  /** The overlay's colour when `overlay` is `colour`. */
  colour: string;
  /** 0–1: how blurred the backdrop is. */
  intensity: number;
  /** 0–1: how strongly the overlay covers the backdrop. */
  opacity: number;
  /** The art over the whole frame, or over its top with the overlay's colour under it. */
  fullBackground: boolean;
  /** The genres, for the line under the title. */
  genres: string;
  year: number | null;
  developer: string | null;
};

export function PosterShareCard({
  ref,
  width,
  height,
  gameTitle,
  handle,
  avatarUrl,
  text,
  asQuote,
  score,
  shows,
  backdropUri,
  coverUri,
  layout,
  overlay,
  colour,
  intensity,
  opacity,
  fullBackground,
  genres,
  year,
  developer,
}: PosterShareCardProps) {
  const theme = useTheme();
  /* The ground the words stand on: the overlay's colour, black, or — for
     the blur — black at the overlay's strength over the blurred art. */
  const ground = overlay === 'colour' ? colour : Palette.shadowInk;
  const lightGround = overlay === 'colour' && shareInkToken(colour) === 'shareInkDark';
  const ink = lightGround && opacity >= 0.6 ? theme.shareInkDark : Palette.white;
  const quiet = withAlpha(ink, 0.72);
  const tint =
    overlay === 'blur' ? withAlpha(Palette.shadowInk, opacity * 0.75) : withAlpha(ground, opacity);
  const blur = Math.round(intensity * 30);
  const artBox = fullBackground ? height : Math.round(height * 0.6);
  const side = layout === 'side';

  /* The poster: as large as the frame allows beside or above the words. */
  const posterWidth = side
    ? Math.min(width * 0.34, (height - 96) * (2 / 3))
    : Math.min(width * 0.42, height * 0.36 * (2 / 3));
  const posterHeight = posterWidth * 1.5;

  const fadeTo = overlay === 'blur' ? withAlpha(Palette.shadowInk, opacity * 0.75) : ground;
  const fade = RAMP.alphas.map((alpha) => withAlpha(fadeTo, alpha)) as [
    string,
    string,
    ...string[],
  ];
  const fadeStops = RAMP.locations.map((at) => 0.35 + at * 0.65) as [number, number, ...number[]];
  /* With the art over the whole frame, a foot under the words so they read
     on any picture. */
  const footShade = [withAlpha(fadeTo, 0), withAlpha(fadeTo, Math.max(0.55, opacity))] as const;

  const facts = [year, genres].filter(Boolean).join('  ·  ');

  const info = (
    <View style={[styles.info, !side && styles.infoCentred]}>
      {shows.title && (
        <RNText
          numberOfLines={2}
          style={[styles.posterTitle, { color: ink }, !side && styles.centredText]}>
          {gameTitle}
        </RNText>
      )}
      {shows.title && !!facts && (
        <RNText
          numberOfLines={1}
          style={[styles.facts, { color: quiet }, !side && styles.centredText]}>
          {facts}
        </RNText>
      )}
      {shows.title && !!developer && (
        <RNText
          numberOfLines={1}
          style={[styles.by, { color: quiet }, !side && styles.centredText]}>
          {`BY ${developer.toUpperCase()}`}
        </RNText>
      )}
      {shows.rating && score !== null && (
        <View style={[styles.myRating, !side && styles.centredItems]}>
          <RNText style={[styles.ratingLabel, { color: quiet }]}>MY RATING</RNText>
          <Score
            score={score}
            ink={ink}
            ground={overlay === 'colour' ? colour : '#000000'}
            big={side ? 28 : 30}
          />
        </View>
      )}
      {shows.words && !!text && (
        <Words
          text={text}
          asQuote={asQuote}
          ink={ink}
          lines={side ? 3 : 4}
          size={14}
          centred={!side}
        />
      )}
    </View>
  );

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.posterCard, { width, height, backgroundColor: ground }]}
      accessible
      accessibilityLabel={spoken({ gameTitle, handle, text, asQuote, score, shows })}>
      {/* The ground under everything: the blurred art, for the blur. */}
      {overlay === 'blur' && backdropUri && (
        <>
          <Image
            source={{ uri: backdropUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            blurRadius={Math.max(12, blur + 12)}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: withAlpha(Palette.shadowInk, opacity * 0.75) },
            ]}
          />
        </>
      )}

      {/* The art: the whole frame, or its top dissolving into the ground. */}
      {backdropUri && (
        <View style={[styles.backdrop, { height: artBox }]}>
          <Image
            source={{ uri: backdropUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            blurRadius={blur > 0 ? blur : undefined}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />
          {!fullBackground && (
            <LinearGradient colors={fade} locations={fadeStops} style={StyleSheet.absoluteFill} />
          )}
        </View>
      )}
      {fullBackground && (
        <LinearGradient colors={footShade} style={styles.footShade} pointerEvents="none" />
      )}

      <View style={styles.posterContent}>
        <View style={[styles.stage, side && styles.stageSide]}>
          {coverUri && (
            <Image
              source={{ uri: coverUri }}
              style={[
                styles.poster,
                { width: posterWidth, height: posterHeight },
                !side && styles.posterCentred,
              ]}
              resizeMode="cover"
            />
          )}
          {info}
        </View>
        <Foot
          handle={handle}
          avatarUrl={avatarUrl}
          ink={ink}
          ground={overlay === 'colour' ? colour : '#000000'}
          showProfile={shows.profile}
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

function Words({
  text,
  asQuote,
  ink,
  lines,
  size,
  centred = false,
}: {
  text: string;
  asQuote: boolean;
  ink: string;
  lines: number;
  size: number;
  centred?: boolean;
}) {
  if (asQuote) {
    return (
      <QuoteBlock
        text={text}
        size="share"
        color={ink}
        accessible={false}
        style={centred ? undefined : styles.quoteLeft}
      />
    );
  }
  return (
    <RNText
      numberOfLines={lines}
      ellipsizeMode="tail"
      style={[
        styles.words,
        { color: ink, fontSize: size, lineHeight: Math.round(size * 1.35) },
        centred && styles.centredText,
      ]}>
      {text}
    </RNText>
  );
}

function Score({
  score,
  ink,
  ground,
  big,
}: {
  score: number;
  ink: string;
  ground: string;
  big: number;
}) {
  const theme = useTheme();
  const colour = ensureContrast(scoreColor(score, theme), ground, 3);
  return (
    <View style={styles.score}>
      <RNText style={[styles.scoreNumber, { color: colour, fontSize: big, lineHeight: big + 4 }]}>
        {score}
      </RNText>
      <RNText style={[styles.scoreWord, { color: ink }]}>{labelFor(score)}</RNText>
    </View>
  );
}

function Foot({
  handle,
  avatarUrl,
  ink,
  ground,
  showProfile,
}: {
  handle: string;
  avatarUrl: string | null;
  ink: string;
  ground: string;
  showProfile: boolean;
}) {
  const quiet = withAlpha(ink, 0.72);
  const initial = handle.replace(/^@/, '').charAt(0).toUpperCase() || '?';
  return (
    <View style={styles.foot}>
      {showProfile ? (
        <View style={styles.writer}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: withAlpha(ink, 0.24) }]}>
              <RNText style={[styles.initial, { color: ink }]}>{initial}</RNText>
            </View>
          )}
          <View style={styles.writerWords}>
            <RNText style={[styles.reviewBy, { color: quiet }]}>Review by</RNText>
            <RNText numberOfLines={1} style={[styles.handle, { color: ink }]}>
              {handle}
            </RNText>
          </View>
        </View>
      ) : (
        <View />
      )}
      <View style={styles.signature}>
        <View style={[styles.disc, { backgroundColor: ink }]}>
          <Ionicons name="game-controller" size={11} color={shareTintOn(ground, ink)} />
        </View>
        <RNText style={[styles.brand, { color: ink }]}>Pinged</RNText>
      </View>
    </View>
  );
}

function spoken({
  gameTitle,
  handle,
  text,
  asQuote,
  score,
  shows,
}: Pick<Common, 'gameTitle' | 'handle' | 'text' | 'asQuote' | 'score' | 'shows'>): string {
  return [
    shows.profile ? `${handle} on ${gameTitle}` : gameTitle,
    shows.rating && score !== null ? `${score}, ${labelFor(score)}` : null,
    shows.words && text ? (asQuote ? `“${text}”` : text) : null,
  ]
    .filter(Boolean)
    .join('. ');
}

const RADIUS = 24;

const styles = StyleSheet.create({
  colourCard: { borderRadius: RADIUS, overflow: 'hidden' },
  colourTitle: { paddingHorizontal: 20, paddingBottom: 4 },
  colourBody: { paddingHorizontal: 20, paddingBottom: 18, paddingTop: 4, gap: 14 },
  credit: { fontFamily: Typeface.medium, fontSize: 13, lineHeight: 18, marginTop: -6 },
  words: { fontFamily: Typeface.semibold },
  quoteLeft: { alignSelf: 'flex-start' },
  score: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  scoreNumber: {
    fontFamily: Typeface.extraBold,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  scoreWord: { fontFamily: Typeface.semibold, fontSize: 14, lineHeight: 18 },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 4,
  },
  writer: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  writerWords: { flexShrink: 1 },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: { fontSize: 12, lineHeight: 14, fontFamily: Typeface.bold },
  reviewBy: { fontFamily: Typeface.regular, fontSize: 10, lineHeight: 13 },
  handle: { fontFamily: Typeface.bold, fontSize: 13, lineHeight: 17 },
  signature: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  disc: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { fontFamily: Typeface.extraBold, fontSize: 14, lineHeight: 18 },

  posterCard: { borderRadius: RADIUS, overflow: 'hidden' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  footShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' },
  posterContent: { flex: 1, padding: 18, justifyContent: 'space-between' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  stageSide: { flexDirection: 'row', justifyContent: 'flex-start', gap: 16 },
  poster: { borderRadius: 10 },
  posterCentred: { marginTop: 8 },
  info: { flex: 1, justifyContent: 'center', gap: 6, minWidth: 0 },
  infoCentred: { flex: 0, alignSelf: 'stretch', alignItems: 'center' },
  centredText: { textAlign: 'center' },
  centredItems: { alignItems: 'center' },
  posterTitle: { fontFamily: Typeface.extraBold, fontSize: 24, lineHeight: 28 },
  facts: { fontFamily: Typeface.medium, fontSize: 12, lineHeight: 16 },
  by: { fontFamily: Typeface.semibold, fontSize: 10, lineHeight: 14, letterSpacing: 1.2 },
  myRating: { marginTop: 6, gap: 2 },
  ratingLabel: { fontFamily: Typeface.bold, fontSize: 10, lineHeight: 14, letterSpacing: 1.4 },
});
