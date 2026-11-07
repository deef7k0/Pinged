import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text as RNText, View, useWindowDimensions } from 'react-native';

import { ReviewHighlighter } from '@/components/review-highlighter';
import { ReviewPodiumCard } from '@/components/review-podium-card';
import {
  ColourShareCard,
  FRAME_ASPECT,
  PosterShareCard,
  type PosterFrame,
  type PosterLayout,
  type PosterOverlay,
  type ShareArtShows,
} from '@/components/review-share-art-cards';
import { ReviewShareCard } from '@/components/review-share-card';
import { SpoilerNotice } from '@/components/spoiler-notice';
import { PressableScale } from '@/components/ui/pressable-scale';
import { SeekBar } from '@/components/ui/seek-bar';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { SlideUpSheet } from '@/components/ui/slide-up-sheet';
import { TabBar } from '@/components/ui/tab-bar';
import { Text } from '@/components/ui/text';
import {
  SHARE_CARD,
  SHARE_SHEET,
  SHARE_SWATCHES,
  shareCardWidth,
  shareInkToken,
  shareSheetRamp,
  shareTextWidth,
  shareTintOn,
} from '@/constants/share-card';
import { Typeface, Radius, Spacing, withAlpha } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useAlbumArtColor } from '@/hooks/use-album-art-color';
import { useArtGround } from '@/hooks/use-key-color';
import { usePosterArt } from '@/hooks/use-poster-art';
import { useSquareCover } from '@/hooks/use-square-cover';
import { useTheme } from '@/hooks/use-theme';
import type { LogWithRelations } from '@/lib/database.types';
import { displayNameFor, timeAgoPosted } from '@/lib/format';
import {
  cardLines,
  openingRange,
  rangeText,
  reviewWords,
  type WordRange,
} from '@/lib/review-highlight';
import { normaliseQuote } from '@/lib/review-quote';

export type ReviewShareSheetProps = {
  visible: boolean;
  onClose: () => void;
  review: LogWithRelations;
  /** The reader has uncovered the review on its page (or it has no spoilers). */
  revealed: boolean;
  onReveal: () => void;
};

type Mode = 'quote' | 'text';

/** The cards a review can be shared as. */
type CardLook = 'classic' | 'podium' | 'colour' | 'poster';
const CARD_LOOKS: { key: CardLook; label: string }[] = [
  { key: 'colour', label: 'Colour' },
  { key: 'poster', label: 'Poster' },
  { key: 'classic', label: 'Words' },
  { key: 'podium', label: 'Rating' },
];

const FRAMES: { value: PosterFrame; label: string }[] = [
  { value: '9:16', label: '9:16' },
  { value: '4:5', label: '4:5' },
  { value: '1:1', label: '1:1' },
  { value: '16:9', label: '16:9' },
];
const LAYOUTS: { value: PosterLayout; label: string }[] = [
  { value: 'centred', label: 'Centred' },
  { value: 'side', label: 'Beside' },
];
const OVERLAYS: { value: PosterOverlay; label: string }[] = [
  { value: 'colour', label: 'Dynamic colour' },
  { value: 'blur', label: 'Blur' },
  { value: 'black', label: 'Black' },
];
/** The poster card's preview is never taller than this share of the display. */
const POSTER_MAX_HEIGHT = 0.56;

/**
 * Make an image of a review, to save or to send — the owner's direction
 * (2026-10-16), after SimpMusic's lyrics sheet (`ShareLyricsSheet.kt`), in
 * two steps:
 *
 * 1. **Pick the words.** The quote, or a part of the review. Not SimpMusic's
 *    list of lines, at the owner's correction: the whole review, with a
 *    highlight over its first few words that a tap moves to one word and
 *    whose ends are held and dragged to take in more, stopping where the card
 *    is full (`<ReviewHighlighter>`, Instagram's slider for a song in a
 *    story). "Continue" floats over it as a pill.
 * 2. **The card** — SimpMusic's ("Words"), or the rating card the owner
 *    pointed at ("Rating", `<ReviewPodiumCard>`) — the background under it,
 *    the game's own colour first and then SimpMusic's four, and two pills:
 *    Save image, and Share.
 *
 * The sheet is tinted from the game, as SimpMusic's is from the song: a ramp
 * from the game's deep container tone towards black. It is the review page's
 * own colour family, so the sheet reads as part of the page it rose from.
 *
 * ## The native half, loaded when it is used
 *
 * Capturing the card (`react-native-view-shot`), saving it
 * (`expo-media-library`) and sending it (`expo-sharing`) are native modules,
 * imported **when a pill is pressed**, never at the top of this file. A build
 * made before they were added has none of them, and a module that throws while
 * it loads takes the review page down with it (CLAUDE.md, on
 * `expo-notifications`). Here a missing module is a sentence on the sheet.
 *
 * Saving asks for write-only access to the photos — on Android 10 and later
 * that is no prompt at all — and never for the photo library itself.
 */
export function ReviewShareSheet({
  visible,
  onClose,
  review,
  revealed,
  onReveal,
}: ReviewShareSheetProps) {
  const accent = useAccent();
  const surface = shareSheetRamp(accent.m3.primaryContainer);

  return (
    <SlideUpSheet
      visible={visible}
      onClose={onClose}
      title="Share review"
      maxHeightRatio={0.94}
      surface={surface}>
      <ShareFlow review={review} revealed={revealed} onReveal={onReveal} seed={surface[0]} />
    </SlideUpSheet>
  );
}

function ShareFlow({
  review,
  revealed,
  onReveal,
  seed,
}: {
  review: LogWithRelations;
  revealed: boolean;
  onReveal: () => void;
  seed: string;
}) {
  const theme = useTheme();
  const accent = useAccent();
  const { width } = useWindowDimensions();

  const game = review.game;
  const gameTitle = game?.title ?? 'A game';
  const authorName = displayNameFor(review.profile);
  const quote = normaliseQuote(review.review_title);
  const prose = review.review?.trim() ?? '';
  const rating = review.rating === null ? null : Math.round(review.rating);

  /* The card's size on this phone, and whether a pick fits its eight lines —
     counted as the card will wrap it, the review's line breaks included. */
  const cardWidth = shareCardWidth(width);
  const textWidth = shareTextWidth(cardWidth);
  const text = useMemo(() => reviewWords(prose), [prose]);
  const linesOf = (range: WordRange) =>
    cardLines(rangeText(text, range), textWidth, SHARE_CARD.text.fontSize);
  const fits = (range: WordRange) => linesOf(range) <= SHARE_CARD.maxLines;

  const [mode, setMode] = useState<Mode>(quote ? 'quote' : 'text');
  /* The first few words, picked as it opens, so the card shows at once what
     it will look like — the owner's direction. */
  const [range, setRange] = useState<WordRange | null>(() => openingRange(text, fits));
  const [step, setStep] = useState<'pick' | 'card'>('pick');
  const [note, setNote] = useState<string | null>(null);

  /* The sheet's ink, and the colour of anything printed on a filled surface. */
  const ink = theme[shareInkToken(seed)];
  const onFilled = shareTintOn(seed, ink);

  const words = mode === 'quote' ? quote : range ? rangeText(text, range) : '';
  const ready = words.length > 0;

  if (step === 'card') {
    return (
      <CardStep
        review={review}
        gameTitle={gameTitle}
        authorName={authorName}
        words={words}
        asQuote={mode === 'quote'}
        rating={rating}
        cardWidth={cardWidth}
        ink={ink}
        onFilled={onFilled}
        fallback={accent.m3.primary}
        onBack={() => setStep('pick')}
      />
    );
  }

  return (
    <View style={styles.flex}>
      {!!quote && !!prose && (
        <TabBar
          tabs={[
            { key: 'quote', label: 'The quote' },
            { key: 'text', label: 'From the review' },
          ]}
          value={mode}
          onChange={(next: Mode) => {
            setMode(next);
            setNote(null);
          }}
        />
      )}

      <Text
        variant="bodySmall"
        style={[styles.subtitle, { color: withAlpha(ink, 0.62) }]}
        accessibilityLiveRegion="polite">
        {mode === 'quote'
          ? 'Your one sentence goes on the card.'
          : range
            ? `Hold an arrow and drag to take in more · tap a word to start there · ${linesOf(range)} of ${SHARE_CARD.maxLines} lines`
            : 'There are no words to pick.'}
      </Text>

      {mode === 'quote' ? (
        <View style={styles.list}>
          <PickedLine text={`“${quote}”`} picked ink={ink} onFilled={onFilled} />
        </View>
      ) : !revealed ? (
        /* The words are withheld on the page until the reader uncovers them;
           picking from them is uncovering them, so it is asked here too. */
        <View style={styles.list}>
          <SpoilerNotice onPress={onReveal} minHeight={160} hint="Shows the review to pick from" />
        </View>
      ) : range ? (
        /* The whole review, the highlight over the part that goes on the card
           (`<ReviewHighlighter>`). */
        <View style={[styles.panel, { backgroundColor: withAlpha(ink, 0.06) }]}>
          <ReviewHighlighter
            review={text}
            range={range}
            onChange={(next) => {
              setRange(next);
              setNote(null);
            }}
            fits={fits}
            onLimit={() => setNote('That’s as much as the card holds.')}
            ink={ink}
            onInk={onFilled}
          />
        </View>
      ) : null}

      {/* The floating action: a pill, not a full-width button — "carry on",
          not "this form is finished" (SimpMusic). */}
      <View style={styles.floating} pointerEvents="box-none">
        {note && (
          <Text
            variant="bodySmall"
            style={[styles.note, { color: ink }]}
            accessibilityLiveRegion="polite">
            {note}
          </Text>
        )}
        <SharePill
          label="Continue"
          container={ink}
          ink={onFilled}
          disabled={!ready}
          onPress={() => setStep('card')}
        />
      </View>
    </View>
  );
}

/** The quote, as the picker shows it: filled — it is what goes on the card. */
function PickedLine({
  text,
  ink,
  onFilled,
}: {
  text: string;
  picked: true;
  ink: string;
  onFilled: string;
}) {
  return (
    <View style={[styles.line, { backgroundColor: ink }]}>
      <RNText style={[styles.lineText, { color: onFilled }]}>{text}</RNText>
    </View>
  );
}

function CardStep({
  review,
  gameTitle,
  authorName,
  words,
  asQuote,
  rating,
  cardWidth,
  ink,
  onFilled,
  fallback,
  onBack,
}: {
  review: LogWithRelations;
  gameTitle: string;
  authorName: string;
  words: string;
  asQuote: boolean;
  rating: number | null;
  cardWidth: number;
  ink: string;
  onFilled: string;
  fallback: string;
  onBack: () => void;
}) {
  const theme = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const game = review.game;

  /* The game's landscape art and logo, as its review card draws them, and
     the art's key colour — the Colour and Poster cards' own colour. */
  const poster = usePosterArt(review.game_id);
  const landscape =
    poster.data?.artUrl ?? game?.hero_url ?? game?.screenshots?.[0] ?? game?.cover_url ?? null;
  const keyColour = useArtGround(
    landscape,
    { width: cardWidth, height: Math.round((cardWidth * 9) / 16) },
    { x: 0.5, y: 0.35 }
  );

  /* The game's own colour, read off its cover — the first swatch and the one
     the card opens on, as SimpMusic's opens on the song's. */
  const own = useAlbumArtColor(game?.cover_url, { fallback });
  /* Which card: the coloured one (first, the owner's of 2026-11-06),
     Muvy's poster, SimpMusic's words, or the rating card. */
  const [look, setLook] = useState<CardLook>('colour');
  const artLook = look === 'colour' || look === 'poster';
  /* The first swatch is the game's own: its art's key colour on the two art
     cards, its cover's colour on the other two. */
  const first = artLook ? keyColour : own;
  const swatches = useMemo(
    () => [first, ...SHARE_SWATCHES.map((token) => theme[token])],
    [first, theme]
  );
  const [chosen, setChosen] = useState(0);
  const background = swatches[chosen] ?? first;

  /* The art cards' switches, and the poster's frame. */
  const [shows, setShows] = useState<ShareArtShows>({
    title: true,
    rating: rating !== null,
    profile: true,
    words: true,
  });
  const toggle = (key: keyof ShareArtShows) =>
    setShows((current) => ({ ...current, [key]: !current[key] }));
  const [frame, setFrame] = useState<PosterFrame>('9:16');
  const [layout, setLayout] = useState<PosterLayout>('centred');
  const [overlay, setOverlay] = useState<PosterOverlay>('colour');
  const [intensity, setIntensity] = useState(0.2);
  const [opacity, setOpacity] = useState(0.55);
  const [fullBackground, setFullBackground] = useState(false);
  /* A wide frame has no room for the poster over the words. */
  const posterLayout: PosterLayout = frame === '16:9' ? 'side' : layout;
  const aspect = FRAME_ASPECT[frame];
  const posterWidth = Math.min(cardWidth, windowHeight * POSTER_MAX_HEIGHT * aspect);
  const posterHeight = Math.round(posterWidth / aspect);
  const credit = [game?.developer, game?.release_year].filter(Boolean).join(' · ');
  const handle = review.profile?.username ? `@${review.profile.username}` : authorName;

  const square = useSquareCover({ gameId: review.game_id, title: gameTitle });
  const artUri = square.uri ?? game?.cover_url ?? null;

  const card = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const fileName = `Pinged_${gameTitle.slice(0, 32).replace(/[^A-Za-z0-9]+/g, '_')}`;

  async function capture(): Promise<string> {
    const { captureRef } = await import('react-native-view-shot');
    return captureRef(card, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
      fileName: `${fileName}_${Date.now()}`,
    });
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const uri = await capture();
      const saved = await saveToPhotos(uri);
      if (saved === 'denied') {
        setStatus('Pinged needs permission to add it to your photos.');
      } else if (saved === 'saved') {
        setStatus('Saved to your photos.');
      } else {
        /* No photo library module in this build: the system's own sheet can
           save an image (iOS's Save Image, Android's Save to device / Files). */
        const sharing = await import('expo-sharing');
        await sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' });
        setStatus('This build can’t save directly — choose Save from the sheet.');
      }
    } catch (error) {
      setStatus(
        isMissingModule(error)
          ? 'This build of the app can’t make images yet — it needs updating.'
          : 'Could not save the image.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const sharing = await import('expo-sharing');
      if (!(await sharing.isAvailableAsync())) {
        setStatus('Sharing is not available on this device.');
        return;
      }
      await sharing.shareAsync(await capture(), {
        mimeType: 'image/png',
        UTI: 'public.png',
        dialogTitle: `Share ${authorName}’s review`,
      });
    } catch (error) {
      setStatus(
        isMissingModule(error)
          ? 'This build of the app can’t make images yet — it needs updating.'
          : 'Could not share the image.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.cardStep} showsVerticalScrollIndicator={false}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Back to picking the words"
        onPress={onBack}
        hitSlop={BACK_SLOP}
        scaleTo={0.96}
        style={styles.back}>
        <Ionicons name="chevron-back" size={16} color={ink} />
        <Text variant="bodySmall" style={{ color: ink }}>
          Change the words
        </Text>
      </PressableScale>

      {look === 'colour' ? (
        <ColourShareCard
          ref={card}
          width={cardWidth}
          gameTitle={gameTitle}
          logo={poster.data?.logo ?? null}
          credit={credit}
          handle={handle}
          avatarUrl={review.profile?.avatar_url ?? null}
          text={words}
          asQuote={asQuote}
          score={rating}
          shows={shows}
          artUri={landscape}
          ground={background}
        />
      ) : look === 'poster' ? (
        <PosterShareCard
          ref={card}
          width={posterWidth}
          height={posterHeight}
          gameTitle={gameTitle}
          logo={poster.data?.logo ?? null}
          credit={credit}
          handle={handle}
          avatarUrl={review.profile?.avatar_url ?? null}
          text={words}
          asQuote={asQuote}
          score={rating}
          shows={shows}
          backdropUri={landscape}
          coverUri={game?.cover_url ?? null}
          layout={posterLayout}
          overlay={overlay}
          colour={background}
          intensity={intensity}
          opacity={opacity}
          fullBackground={fullBackground}
          genres={(game?.genres ?? []).slice(0, 2).join(', ')}
          year={game?.release_year ?? null}
          developer={game?.developer ?? null}
        />
      ) : look === 'classic' ? (
        <ReviewShareCard
          ref={card}
          width={cardWidth}
          background={background}
          gameTitle={gameTitle}
          credit={credit}
          artUri={artUri}
          authorName={authorName}
          avatarUrl={review.profile?.avatar_url ?? null}
          text={words}
          asQuote={asQuote}
          score={rating}
        />
      ) : (
        <ReviewPodiumCard
          ref={card}
          width={cardWidth}
          background={background}
          gameTitle={gameTitle}
          credit={credit}
          artUri={artUri}
          handle={handle}
          avatarUrl={review.profile?.avatar_url ?? null}
          posted={timeAgoPosted(review.created_at)}
          text={words}
          asQuote={asQuote}
          score={rating}
        />
      )}

      <View style={styles.looks}>
        <TabBar tabs={CARD_LOOKS} value={look} onChange={(next: CardLook) => setLook(next)} />
      </View>

      {look === 'poster' && (
        <View style={styles.options}>
          <OptionRow label="Frame" ink={ink}>
            <Segmented label="Frame" options={FRAMES} value={frame} onChange={setFrame} />
          </OptionRow>
          {frame !== '16:9' && (
            <OptionRow label="Poster" ink={ink}>
              <Segmented label="Poster" options={LAYOUTS} value={layout} onChange={setLayout} />
            </OptionRow>
          )}
          <OptionRow label="Overlay" ink={ink}>
            <Segmented label="Overlay" options={OVERLAYS} value={overlay} onChange={setOverlay} />
          </OptionRow>
          <SliderRow
            label="Intensity"
            ink={ink}
            value={intensity}
            onChange={setIntensity}
            hint="How blurred the art is"
          />
          <SliderRow
            label="Opacity"
            ink={ink}
            value={opacity}
            onChange={setOpacity}
            hint="How strongly the overlay covers it"
          />
          <ToggleRow
            label="Full background"
            ink={ink}
            value={fullBackground}
            onChange={setFullBackground}
          />
        </View>
      )}

      {(look !== 'poster' || overlay === 'colour') && (
        <Text variant="bodySmall" style={[styles.paletteLabel, { color: withAlpha(ink, 0.6) }]}>
          {artLook ? 'Colour' : 'Background'}
        </Text>
      )}
      {(look !== 'poster' || overlay === 'colour') && (
        <View style={styles.palette}>
          {swatches.map((swatch, index) => (
            <PressableScale
              key={`${index}:${swatch}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: index === chosen }}
              accessibilityLabel={index === 0 ? 'The game’s colour' : `Colour ${index + 1}`}
              hitSlop={SWATCH_SLOP}
              onPress={() => setChosen(index)}
              scaleTo={0.9}>
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: swatch },
                  index === chosen && { borderWidth: SHARE_SHEET.swatchRing, borderColor: ink },
                ]}
              />
            </PressableScale>
          ))}
        </View>
      )}

      {artLook && (
        <View style={styles.options}>
          <ToggleRow label="Title" ink={ink} value={shows.title} onChange={() => toggle('title')} />
          {rating !== null && (
            <ToggleRow
              label="My rating"
              ink={ink}
              value={shows.rating}
              onChange={() => toggle('rating')}
            />
          )}
          <ToggleRow
            label="The review"
            ink={ink}
            value={shows.words}
            onChange={() => toggle('words')}
          />
          <ToggleRow
            label="My profile"
            ink={ink}
            value={shows.profile}
            onChange={() => toggle('profile')}
          />
        </View>
      )}

      {artLook && (
        <Text variant="caption" style={[styles.transparentNote, { color: withAlpha(ink, 0.55) }]}>
          Saved as a PNG: the card alone, transparent round its corners.
        </Text>
      )}

      <View style={styles.pills}>
        <SharePill
          label="Save image"
          icon="download-outline"
          container={withAlpha(ink, 0)}
          ink={ink}
          outlined
          disabled={busy}
          onPress={() => void save()}
        />
        <SharePill
          label="Share"
          icon="share-social-outline"
          container={ink}
          ink={onFilled}
          disabled={busy}
          onPress={() => void share()}
        />
      </View>

      {status && (
        <Text
          variant="bodySmall"
          style={[styles.status, { color: ink }]}
          accessibilityLiveRegion="polite">
          {status}
        </Text>
      )}
    </ScrollView>
  );
}

/**
 * Adds an image to the phone's photos, with whichever media library the build
 * has.
 *
 * `expo-media-library`'s current API is a native module of its own
 * (`ExpoMediaLibraryNext`), and a build made before it — a development client,
 * a sideloaded APK — does not have it: importing it throws "Cannot find native
 * module", seen on the owner's phone through Metro. The legacy API
 * (`expo-media-library/legacy`, `ExpoMediaLibrary`) is the module Expo Go has
 * shipped for years, so it is tried next. `'missing'` when neither is there.
 *
 * Write-only either way, and no media kinds: the image is added, nothing is
 * read — and in Expo Go on Android, asking for `photo` throws.
 */
async function saveToPhotos(uri: string): Promise<'saved' | 'denied' | 'missing'> {
  try {
    const library = await import('expo-media-library');
    const permission = await library.requestPermissionsAsync(true, []);
    if (!permission.granted) return 'denied';
    await library.Asset.create(uri);
    return 'saved';
  } catch (error) {
    if (!isMissingModule(error)) throw error;
  }
  try {
    const legacy = await import('expo-media-library/legacy');
    const permission = await legacy.requestPermissionsAsync(true, []);
    if (!permission.granted) return 'denied';
    await legacy.saveToLibraryAsync(uri);
    return 'saved';
  } catch (error) {
    if (!isMissingModule(error)) throw error;
  }
  return 'missing';
}

function isMissingModule(error: unknown): boolean {
  return error instanceof Error && /native module/i.test(error.message);
}

/** A labelled row of the share options: the name, its control at the end. */
function OptionRow({ label, ink, children }: { label: string; ink: string; children: ReactNode }) {
  return (
    <View style={styles.optionColumn}>
      <Text variant="h5" style={{ color: ink }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function ToggleRow({
  label,
  ink,
  value,
  onChange,
}: {
  label: string;
  ink: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.optionRow}>
      <Text variant="body" style={[styles.optionLabel, { color: ink }]}>
        {label}
      </Text>
      <Switch label={label} value={value} onValueChange={onChange} />
    </View>
  );
}

function SliderRow({
  label,
  hint,
  ink,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  ink: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <View style={styles.optionColumn} accessible accessibilityLabel={`${label}: ${hint}`}>
      <View style={styles.optionRow}>
        <Text variant="h5" style={{ color: ink }}>
          {label}
        </Text>
        <Text variant="bodySmall" style={{ color: withAlpha(ink, 0.6) }}>
          {`${Math.round(value * 100)}%`}
        </Text>
      </View>
      <SeekBar
        value={value}
        onValueChange={onChange}
        activeColor={ink}
        inactiveColor={withAlpha(ink, 0.18)}
      />
    </View>
  );
}

/**
 * SimpMusic's `ShareLyricsPill`: a pill as wide as its words, filled or
 * outlined, an 18dp glyph before a 15sp label. A disabled one fades its fill.
 */
function SharePill({
  label,
  icon,
  container,
  ink,
  outlined = false,
  disabled = false,
  onPress,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  container: string;
  ink: string;
  outlined?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const shown = disabled ? withAlpha(ink, 0.5) : ink;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      scaleTo={0.96}
      style={StyleSheet.flatten([
        styles.pill,
        { backgroundColor: disabled ? withAlpha(container, SHARE_SHEET.disabledAlpha) : container },
        outlined && { borderWidth: 1, borderColor: withAlpha(ink, 0.45) },
      ])}>
      {icon && <Ionicons name={icon} size={SHARE_SHEET.pill.glyph} color={shown} />}
      <RNText style={[styles.pillLabel, { color: shown }]}>{label}</RNText>
    </PressableScale>
  );
}

const BACK_SLOP = { top: 14, bottom: 14, left: 8, right: 8 };
/** 32dp discs, 14 apart: slop of 7 meets the neighbour's and stops. */
const SWATCH_SLOP = { top: 8, bottom: 8, left: 7, right: 7 };

const { line, pill } = SHARE_SHEET;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  subtitle: { textAlign: 'center', marginTop: Spacing.x8, marginBottom: Spacing.x4 },
  /* Room under the last lines for the pill to hover over them, not cover them. */
  list: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x4, paddingBottom: 110 },
  /* The review in a panel of its own, to the sheet's gutters. */
  panel: {
    flex: 1,
    marginHorizontal: Spacing.x16,
    marginTop: Spacing.x8,
    borderRadius: Radius.card,
    overflow: 'hidden',
  },
  /* SimpMusic's row: 3 apart, a 10dp corner, 14 across and 12 down inside. */
  line: {
    marginVertical: 3,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  lineText: { ...line, fontFamily: Typeface.medium },
  floating: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Spacing.x24,
    alignItems: 'center',
    gap: Spacing.x8,
  },
  note: { textAlign: 'center' },
  cardStep: {
    alignItems: 'center',
    paddingHorizontal: Spacing.x20,
    paddingTop: Spacing.x8,
    paddingBottom: 28,
  },
  back: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x4,
    marginBottom: Spacing.x12,
  },
  looks: { alignSelf: 'stretch', marginTop: Spacing.x20 },
  paletteLabel: { marginTop: Spacing.x16 },
  options: { alignSelf: 'stretch', gap: Spacing.x16, marginTop: Spacing.x20 },
  optionColumn: { gap: Spacing.x8 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.x12,
  },
  optionLabel: { flex: 1 },
  transparentNote: { marginTop: Spacing.x16, textAlign: 'center' },
  palette: {
    flexDirection: 'row',
    gap: SHARE_SHEET.swatchGap,
    marginTop: Spacing.x12,
  },
  swatch: {
    width: SHARE_SHEET.swatch,
    height: SHARE_SHEET.swatch,
    borderRadius: SHARE_SHEET.swatch / 2,
  },
  pills: { flexDirection: 'row', gap: Spacing.x12, marginTop: Spacing.x24 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    paddingHorizontal: pill.padX,
    paddingVertical: pill.padY,
    borderRadius: Radius.pill,
  },
  pillLabel: {
    fontSize: pill.fontSize,
    lineHeight: pill.fontSize + 5,
    fontFamily: Typeface.medium,
  },
  status: { marginTop: Spacing.x16, textAlign: 'center' },
});
