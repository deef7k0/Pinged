import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
  type TextStyle,
} from 'react-native';

import { CommentSection } from '@/components/comment-section';
import { QuoteBlock } from '@/components/quote-block';
import { ReplyComposer } from '@/components/reply-composer';
import { ReportFlag, useCanReport } from '@/components/report-flag';
import { PING_GLYPH, usePingTo } from '@/components/pings/use-ping-to';
import { ReviewShareSheet } from '@/components/review-share-sheet';
import { SpoilerNotice } from '@/components/spoiler-notice';
import { AnimatedCoverImage } from '@/components/ui/animated-cover-image';
import { Avatar } from '@/components/ui/avatar';
import { FrostedTopBar, TopBarDisc } from '@/components/ui/frosted-top-bar';
import { PageScrollView } from '@/components/ui/page-scroll';
import { PressGlyph } from '@/components/ui/press-glyph';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { HandoffTitle } from '@/components/ui/handoff-title';
import { HERO_ANIMATES, MASTHEAD_FADE, PageFill, PinnedHero } from '@/components/ui/pinned-hero';
import { Text } from '@/components/ui/text';
import { PLATFORMS } from '@/constants/platform-cases';
import { platformKeyForStored } from '@/constants/platform-family';
import { PROGRESS_META, progressChoiceFor } from '@/constants/progress';
import { orderedMetrics, parseReviewMetrics } from '@/constants/review-metrics';
import {
  ARTICLE_TOP,
  CONTENT_BOTTOM,
  DATE_TOP,
  DETAILS_ICON,
  DETAILS_TOP,
  LIKE_ROW,
  PLATFORM_ICON,
  PLATFORM_TOP,
  QUOTE_GAP,
  REPLIES_TOP,
  REVIEW_MARGIN,
  REVIEW_MAX_COLUMN,
  REVIEW_ROW,
  REVIEW_TYPE,
  TITLE_LINES,
  TITLE_TRACKING,
  type ReviewLine,
} from '@/constants/review-page';
import { wordsTop } from '@/constants/game-header';
import { labelFor, scoreColor } from '@/constants/score';
import { TOP_BAR_ROW, handoffBand, revealOffset } from '@/constants/top-bar';
import { Typeface, Palette, Spacing, withAlpha } from '@/constants/theme';
import { AccentProvider, useAccent } from '@/hooks/use-accent';
import { useLikeToggle } from '@/hooks/use-like-toggle';
import { useAnimatedCover } from '@/hooks/use-animated-cover';
import { useGameColours } from '@/hooks/use-game-colours';
import { useReviewColour } from '@/hooks/use-review-colour';
import { useSquareCover } from '@/hooks/use-square-cover';
import { useTopBarInset } from '@/hooks/use-header-height';
import { useTheme } from '@/hooks/use-theme';
import { getEngagement, getLogById } from '@/lib/api';
import { recallLog } from '@/lib/api/seen-logs';
import type { CachedGame, LogWithRelations } from '@/lib/database.types';
import { skiaAnimates } from '@/lib/animated-cover';
import { displayNameFor } from '@/lib/format';
import { BAND } from '@/lib/progressive-blur';
import { ordinalDate, playedDetails } from '@/lib/review-details';
import { normaliseQuote } from '@/lib/review-quote';
import { smoothScrimStops } from '@/lib/scrim';
import { useAuth } from '@/store/auth';

/**
 * One person's review of one game.
 *
 * ## It is the owner's screenshot, from their phone (2026-10-17)
 *
 * "FOLLOW THE SCREENSHOT, THE EXACT SAME STYLE, SIZES, GAPS." A music app's
 * review, captured at 720px across a 360dp phone, so every size is its pixels
 * halved — `constants/review-page`, whose test holds each line to within a dp
 * of the screenshot. Top to bottom:
 *
 * - **The game's square art as the hero**, full width, dimmed, fading into the
 *   page ("the ratio of the top hero art is of a square") — and half the
 *   display tall, a collection's header art's size (2026-10-21). There is no
 *   small art beside the title any more: the square is up here.
 * - **The row**: the writer's face, large; beside it their name with **the
 *   score and its word** at the far end of the line ("87 AMAZING", where the
 *   screenshot has stars), the game's name in heavy type, "by" its developer.
 * - **The quote**, centred, in quotation marks, typing itself out — or nothing.
 * - **The date**, then **the review**.
 * - **How it was played**, where the screenshot says "Translate to English",
 *   under the progress glyph; **the platform**, where it has the track the
 *   listener liked, under the platform's mark.
 * - **The like and share**; the report flag beside share for anyone but the
 *   writer.
 * - **"Replies"**, and the reply composer docked at the foot of the screen
 *   (`<ReplyComposer>`): bold, italic, the count against 500, send.
 *
 * ## It runs on the game's colour, unless the reader turns that off
 *
 * `<AccentProvider>`, and the page fills flat with `accent.page`, as the game
 * page and Surprise Me do. The disc at the top right switches it off — the
 * owner's (2026-10-16) — and the page is the app's own room.
 *
 * With game colours off for the whole app (Settings → Game colours,
 * 2026-10-20) the page is the app's own room already, and the disc is not
 * drawn: it would be a switch for something that cannot happen.
 */
export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colour = useReviewColour();
  const gameColours = useGameColours();
  const colourful = gameColours.on && colour.colourful;

  const log = useQuery({
    queryKey: ['log', id],
    queryFn: () => getLogById(id!),
    enabled: !!id,
    /*
     * Start from the card that was tapped.
     *
     * Every list of reviews selects the same record this page asks for
     * (`api/seen-logs.ts`), so the page opens on it instead of on "Loading
     * review". The time it was loaded rides along, and past this query's
     * `staleTime` it is refreshed behind what is already on screen.
     */
    initialData: () => recallLog(id)?.value,
    initialDataUpdatedAt: () => recallLog(id)?.at,
  });

  /*
   * Every branch below carries a bar: `headerShown` is false app-wide, so a
   * screen that renders no bar of its own has no way out of itself.
   *
   * Waiting on the colour switch too — one device read — so a reader who
   * turned the colours off does not see the page open in them first.
   */
  if (log.isLoading || !colour.ready || !gameColours.ready) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back variant="art" />}>
        <LoadingState label="Loading review" />
      </Screen>
    );
  }

  if (log.isLoadingError) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back variant="art" />}>
        <ErrorState error={log.error} onRetry={() => void log.refetch()} />
      </Screen>
    );
  }

  if (!log.data) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back variant="art" />}>
        <EmptyState
          icon="search"
          title="Review not found"
          message="It may have been deleted by the person who wrote it."
        />
      </Screen>
    );
  }

  const game = log.data.game;

  /* The provider is rendered here and read below: a component is not inside its
     own context, so the page itself is the child. */
  return (
    <AccentProvider
      artwork={game?.cover_url ?? game?.hero_url}
      genres={game?.genres}
      neutral={!colourful}>
      <ReviewPage
        review={log.data}
        colourful={colourful}
        onColourful={gameColours.on ? colour.setColourful : null}
      />
    </AccentProvider>
  );
}

function ReviewPage({
  review,
  colourful,
  onColourful,
}: {
  review: LogWithRelations;
  colourful: boolean;
  /** The page's own switch; null while game colours are off app-wide. */
  onColourful: ((colourful: boolean) => void) | null;
}) {
  const theme = useTheme();
  const accent = useAccent();
  const { width } = useWindowDimensions();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;
  const topInset = useTopBarInset();

  const engagement = useQuery({
    queryKey: ['engagement', 'log', review.id, viewerId],
    queryFn: () => getEngagement('log', [review.id], viewerId),
  });

  /* The optimistic toggle lives in the hook, shared with the feed card and the
     collection masthead — this page must not grow its own copy of the like
     state. */
  const { liked, likeCount, toggle } = useLikeToggle(
    'log',
    review.id,
    engagement.data?.[review.id]
  );

  /* Whether the reader has uncovered a spoiler-flagged review. Per-visit rather
     than persisted: leaving and coming back re-covers it, which is the safer
     default for a screen somebody may hand to a friend. */
  const [revealed, setRevealed] = useState(false);

  /* The image of the review to save or send (`<ReviewShareSheet>`). */
  const [sharing, setSharing] = useState(false);

  const canReport = useCanReport(review.user_id);
  const pingTo = usePingTo();

  const game = review.game;
  const author = review.profile;
  const authorName = displayNameFor(author);
  const quote = normaliseQuote(review.review_title);
  const rating = review.rating === null ? null : Math.round(review.rating);
  const hasProse = !!review.review?.trim();

  /* The platform has a line of its own, by its full name — "PlayStation 5",
     not the picker's "PS5" — under its own mark; a hand-typed one as it was
     typed, under a controller. So the sentence about the run leaves it out. */
  const platformKey = platformKeyForStored(review.played_on);
  const platform = platformKey ? PLATFORMS[platformKey].label : review.played_on?.trim() || null;
  const metrics = parseReviewMetrics(review.review_metrics);
  const details = playedDetails(
    review,
    null,
    metrics
      ? orderedMetrics(metrics).map(({ metric, score }) => ({ label: metric.label, score }))
      : []
  );
  const progress = progressChoiceFor({
    status: review.status,
    completion: review.platinum ? 'full' : review.completion,
  });
  const detailsIcon = progress ? PROGRESS_META[progress].outline : 'game-controller-outline';

  const column = Math.min(width, REVIEW_MAX_COLUMN) - REVIEW_MARGIN * 2;

  /* What stands under the buttons. */
  const articleShown = hasProse || !quote;
  const reviewInk = withAlpha(theme.text, REVIEW_INK);
  const page = accent.page;
  /* The reference's keys: glass at the left, the like filled in the page's
     own light — the scheme's primary on a game's colours, white without. */
  const glassKeyColours = {
    backgroundColor: withAlpha(Palette.white, 0.1),
    borderColor: withAlpha(Palette.white, 0.22),
  };
  const keyInk = Palette.white;
  const likeFill = accent.tonal ? accent.m3.primary : theme.white;
  const likeInk = accent.tonal ? accent.m3.onPrimary : Palette.shadowInk;

  /*
   * The album page (the owner's reference, 2026-11-04): the game's art pinned
   * at the top, square and full width; on its foot the game's name, the
   * writer, the facts and the buttons, on a band of blur that is the page's
   * own colour by the buttons; the review and everything after on the page.
   * The words are set as the game page's are — the name where the blur's
   * knee is — and the band runs from just above the name to the buttons.
   */
  const art = useReviewArt(game);
  const artHeight = width;
  /* The name's box in the words (under the tags), and where the facts start:
     the band is the tags, the name and the writer; the page is solid from
     the facts down (the owner's, 2026-11-04). */
  const [titleBox, setTitleBox] = useState({ y: 0, height: 36 });
  const [factsY, setFactsY] = useState<number | null>(null);
  const contentTop = wordsTop(artHeight, titleBox.y, topInset + TOP_BAR_ROW);
  const titleTop = contentTop + titleBox.y;
  const titleFoot = titleTop + titleBox.height;
  const handoff = handoffBand(titleTop, titleFoot, topInset + TOP_BAR_ROW);
  const solidAt = Math.max(1, revealOffset(titleFoot, topInset + TOP_BAR_ROW));
  const bandStart = contentTop - BAND.lead;
  const bandEnd = factsY !== null ? contentTop + factsY : titleFoot + 44;
  const band = { from: bandStart, to: Math.max(bandStart + 40, bandEnd) };
  /* The tags over the name: what the reference's "Album" and "Pop" are. */
  const tags = [
    rating !== null ? `${rating} · ${labelFor(rating)}` : null,
    platform,
    progress ? PROGRESS_META[progress].label : null,
  ].filter((part): part is string => !!part);
  const facts = [
    ordinalDate(review.created_at),
    game?.developer ? `by ${game.developer}` : null,
  ].filter((part): part is string => !!part);

  return (
    <>
      <Screen
        edges={['bottom']}
        background={page}
        /* Behind the page: its colour, then the art pinned at the top — the
           game page's hero and blur. */
        backdrop={
          <>
            <PageFill color={page} />
            {art.uri && (
              <PinnedHero
                uri={art.uri}
                height={artHeight}
                page={page}
                fade={MASTHEAD_FADE}
                solidAt={solidAt}
                scrim={0.4}
                tail
                band={band}
                animation={art.skia}
                onAnimationFail={art.refuse}
                media={(still) => (
                  <>
                    {still}
                    {art.overlay && (
                      <AnimatedCoverImage
                        staticUrl={null}
                        animatedUrl={art.overlay.animatedUrl}
                        format={art.overlay.format}
                        status={art.overlay.status}
                        aspect="square"
                        backdrop="transparent"
                        style={StyleSheet.absoluteFill}
                        onFailed={art.overlay.reportFailure}
                      />
                    )}
                  </>
                )}
              />
            )}
          </>
        }
        topBar={
          <FrostedTopBar
            back
            title={game?.title ?? 'Review'}
            header={titleFoot}
            handoff={handoff}
            right={
              /* The game's colours on and off — the owner's (2026-10-16). */
              onColourful ? (
                <TopBarDisc
                  icon={colourful ? 'color-palette' : 'color-palette-outline'}
                  label={
                    colourful
                      ? 'Show this page in the app’s colours'
                      : 'Show this page in the game’s colours'
                  }
                  onPress={() => onColourful(!colourful)}
                />
              ) : undefined
            }
          />
        }>
        {/* The composer is docked under the page, so the two rise together
            over the keyboard — as the comment thread's screen does it. */}
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <PageScrollView
            style={styles.flex}
            settle={handoff}
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {/* Where the art shows through, the words on its foot. */}
            <View style={styles.masthead}>
              <View pointerEvents="none" style={styles.lip}>
                <LinearGradient
                  colors={lipColours(page)}
                  locations={
                    LIP_STOPS.locations as unknown as readonly [number, number, ...number[]]
                  }
                  style={StyleSheet.absoluteFill}
                />
              </View>
              <View style={{ height: contentTop }} />
              <View style={[styles.words, { width: column }]}>
                {/* The tags, glass capsules: the score, the platform, how far. */}
                {tags.length > 0 && (
                  <View style={styles.tags}>
                    {tags.map((tag, index) => (
                      <View
                        key={tag}
                        style={styles.tag}
                        accessible
                        accessibilityLabel={index === 0 && rating !== null ? `Scored ${tag}` : tag}>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.tagText,
                            index === 0 && rating !== null
                              ? { color: scoreColor(rating, theme) }
                              : undefined,
                          ]}>
                          {tag}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* The game's name, a link to it. */}
                <View onLayout={(event) => setTitleBox(event.nativeEvent.layout)}>
                  <HandoffTitle band={handoff}>
                    <GameName game={game} gameId={review.game_id} />
                  </HandoffTitle>
                </View>

                {/* The writer, where the reference has its artist. */}
                {author ? (
                  <Link href={{ pathname: '/profile/[id]', params: { id: author.id } }} asChild>
                    <PressableScale
                      accessibilityRole="link"
                      accessibilityLabel={`Review by ${authorName}. Opens their profile.`}
                      hitSlop={NAME_SLOP}
                      scaleTo={0.97}
                      style={styles.bylineLink}>
                      <Avatar uri={author.avatar_url} name={authorName} size={BYLINE_FACE} />
                      <Text numberOfLines={1} style={[styles.name, { color: Palette.white }]}>
                        {authorName}
                      </Text>
                    </PressableScale>
                  </Link>
                ) : (
                  <View style={styles.bylineLink}>
                    <Avatar uri={null} name={authorName} size={BYLINE_FACE} />
                    <Text numberOfLines={1} style={[styles.name, { color: Palette.white }]}>
                      {authorName}
                    </Text>
                  </View>
                )}

                {/* On the page's colour from here: when, and whose game. */}
                <Text
                  numberOfLines={2}
                  onLayout={(event) => setFactsY(event.nativeEvent.layout.y)}
                  style={[styles.facts, { color: theme.textMuted }]}>
                  {facts.join(' · ')}
                </Text>

                {/* The buttons, as the reference's: round glass keys at the
                    left, and the one big filled key — the like — at the
                    right, its count beside it. */}
                <View style={styles.keys}>
                  <View style={styles.keysStart}>
                    <PressableScale
                      accessibilityRole="button"
                      accessibilityLabel="Share this review as an image"
                      onPress={() => setSharing(true)}
                      scaleTo={0.92}
                      style={[styles.glassKey, glassKeyColours]}>
                      <Ionicons name="share-outline" size={19} color={keyInk} />
                    </PressableScale>
                    {pingTo && (
                      <PressableScale
                        accessibilityRole="button"
                        accessibilityLabel="Ping this review to someone"
                        onPress={() =>
                          pingTo({
                            kind: 'review',
                            targetId: review.id,
                            title: game
                              ? `${authorName} on ${game.title}`
                              : `${authorName}’s review`,
                            subtitle:
                              quote ?? (rating !== null ? `${rating} out of 100` : 'A review'),
                            imageUrl: game?.cover_url ?? null,
                          })
                        }
                        scaleTo={0.92}
                        style={[styles.glassKey, glassKeyColours]}>
                        <PressGlyph motion="skip">
                          <Ionicons name={PING_GLYPH} size={19} color={keyInk} />
                        </PressGlyph>
                      </PressableScale>
                    )}
                    {canReport && (hasProse || !!quote) && (
                      <View style={[styles.glassKey, glassKeyColours]}>
                        <ReportFlag
                          target={{ kind: 'review', logId: review.id }}
                          authorId={review.user_id}
                          label={`Report ${authorName}’s review`}
                        />
                      </View>
                    )}
                  </View>

                  <View style={styles.keysEnd}>
                    {likeCount > 0 && (
                      <Text style={[styles.count, { color: theme.textSecondary }]}>
                        {likeCount.toLocaleString()}
                      </Text>
                    )}
                    <PressableScale
                      accessibilityRole="button"
                      accessibilityLabel={liked ? 'Unlike this review' : 'Like this review'}
                      accessibilityState={{ selected: liked }}
                      accessibilityValue={
                        likeCount > 0
                          ? { text: `${likeCount} ${likeCount === 1 ? 'like' : 'likes'}` }
                          : undefined
                      }
                      onPress={toggle}
                      scaleTo={0.92}
                      style={[
                        styles.likeKey,
                        { backgroundColor: likeFill, borderColor: withAlpha(likeFill, 0.45) },
                      ]}>
                      <PressGlyph pop={liked}>
                        <Ionicons
                          name={liked ? 'heart' : 'heart-outline'}
                          size={26}
                          color={liked ? theme.liked : likeInk}
                        />
                      </PressGlyph>
                    </PressableScale>
                  </View>
                </View>

                {/* The reference's rule between the head and the words. */}
                <View style={[styles.divider, { backgroundColor: withAlpha(theme.text, 0.14) }]} />
              </View>
            </View>

            {/* The page's solid part: the review and everything after it. */}
            <View style={[styles.solid, { backgroundColor: page }]}>
              <View style={{ width: column }}>
                {/* The review in one sentence, between its marks. Not covered
                    by a spoiler flag: it was the review's headline. */}
                {!!quote && (
                  <QuoteBlock
                    text={quote}
                    size="page"
                    color={theme.text}
                    typed
                    style={styles.quote}
                  />
                )}

                {/*
                  The review. The one screen where a spoiler notice uncovers
                  rather than navigates: the reader arrived here on purpose.
                */}
                {articleShown && (
                  <View style={styles.article}>
                    {hasProse && review.spoilers && !revealed ? (
                      <SpoilerNotice
                        onPress={() => setRevealed(true)}
                        minHeight={140}
                        hint="Shows the review on this screen"
                      />
                    ) : hasProse ? (
                      <Text style={[styles.body, { color: reviewInk }]}>{review.review}</Text>
                    ) : (
                      <Text style={[styles.body, { color: theme.textMuted }]}>
                        {authorName} scored this game without writing it up.
                      </Text>
                    )}
                  </View>
                )}

                {/* How it was played: a quiet line under the progress glyph. */}
                {details && (
                  <View style={styles.details}>
                    <Ionicons
                      name={detailsIcon}
                      size={DETAILS_ICON.size}
                      color={theme.textMuted}
                      style={styles.detailsIcon}
                    />
                    <Text style={[styles.detailsText, { color: theme.textMuted }]}>{details}</Text>
                  </View>
                )}

                {/* The conversation; its composer is docked under the page. */}
                <View style={styles.replies}>
                  <CommentSection
                    targetType="log"
                    targetId={review.id}
                    title="Replies"
                    docked
                    headingStyle={styles.repliesHeading}
                  />
                </View>
              </View>
            </View>
          </PageScrollView>

          <ReplyComposer
            targetType="log"
            targetId={review.id}
            fill={colourful ? accent.card : theme.surface}
          />
        </KeyboardAvoidingView>
      </Screen>

      {/* A sibling of `<Screen>`, as the game page's sheets are: it rises over
        the top bar, not under it. */}
      <ReviewShareSheet
        visible={sharing}
        onClose={() => setSharing(false)}
        review={review}
        revealed={revealed || !review.spoilers}
        onReveal={() => setRevealed(true)}
      />
    </>
  );
}

/**
 * The review: the screenshot's is a light grey (#CFCFCF at its strokes'
 * cores) — between `text` and `textSecondary`, where there is no token.
 */
const REVIEW_INK = 0.82;

/** Lifts the 16dp name to the tap floor without moving anything. */
const NAME_SLOP = { top: 14, bottom: 6, left: 6, right: 6 };

/**
 * The art the page is pinned under: the game's square from SteamGridDB, else
 * its landscape art, else its cover, cropped to the square. **Nothing until
 * the square lookup has an answer** — painting one picture and swapping it for
 * the square a beat later is the flicker `useSquareCover`'s `resolved` exists
 * to prevent.
 *
 * **It moves, when the game has an animated square**: an animated WebP, GIF
 * or video in the hero's one blur (`skia`), so the blur moves with it; an
 * APNG, or a file Skia refuses, over the art (`overlay`) with the still's
 * blur under it.
 */
function useReviewArt(game: CachedGame | null) {
  const square = useSquareCover({ gameId: game?.id, title: game?.title, enabled: !!game });
  const uri = square.resolved ? (square.uri ?? game?.hero_url ?? game?.cover_url ?? null) : null;
  const animated = useAnimatedCover({
    gameId: game?.id,
    title: game?.title,
    aspect: 'square',
    enabled: !!uri,
  });
  const [refused, setRefused] = useState<string | null>(null);
  const found = animated.status === 'found' && animated.animatedUrl ? animated : null;
  const skia =
    found && HERO_ANIMATES && skiaAnimates(found.animatedUrl) && found.animatedUrl !== refused
      ? found.animatedUrl
      : null;
  return {
    uri,
    skia,
    overlay: found && !skia ? found : null,
    refuse: () => setRefused(found?.animatedUrl ?? null),
  };
}

/** The writer's face beside their name, the reference's artist's. */
const BYLINE_FACE = 24;

/** The lip of the page's solid part, where it meets the art the words float on. */
const LIP = 40;
const LIP_STOPS = smoothScrimStops();
function lipColours(page: string) {
  return LIP_STOPS.alphas.map((alpha) => withAlpha(page, alpha)) as unknown as readonly [
    string,
    string,
    ...string[],
  ];
}

/** The game's name, a link to its page: heavy, white, never cut short of four lines. */
function GameName({ game, gameId }: { game: CachedGame | null; gameId: string }) {
  const theme = useTheme();
  const name = (
    <Text
      numberOfLines={TITLE_LINES}
      style={[styles.title, styles.centred, { color: theme.white }]}>
      {game?.title ?? 'Unknown game'}
    </Text>
  );

  if (!game) return <View style={styles.titleBox}>{name}</View>;

  return (
    <Link href={{ pathname: '/game/[id]', params: { id: gameId } }} asChild>
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={`Open ${game.title}`}
        scaleTo={0.98}
        style={styles.titleBox}>
        {name}
      </PressableScale>
    </Link>
  );
}

/** A measured line as a style: its Inter file, its size and its line. */
function lineStyle({ size, line, weight }: ReviewLine): TextStyle {
  return { fontFamily: Typeface[weight], fontSize: size, lineHeight: line };
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { alignItems: 'center', paddingBottom: CONTENT_BOTTOM },
  /* The art is clipped to its box; its blurred tail is not — it runs on
     behind the row under it. */
  hero: { alignSelf: 'stretch' },
  heroArt: { overflow: 'hidden' },
  /* The face and the text beside it, centred on each other. */
  row: { flexDirection: 'row', alignItems: 'center', marginTop: REVIEW_ROW.top },
  /* `minWidth: 0` so a long name or title wraps, not pushes. */
  billing: { flex: 1, minWidth: 0, marginLeft: REVIEW_ROW.avatarGap },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: REVIEW_ROW.scoreGap,
    height: REVIEW_TYPE.name.line,
  },
  nameLink: { flexShrink: 1 },
  name: lineStyle(REVIEW_TYPE.name),
  score: { ...lineStyle(REVIEW_TYPE.score), flexShrink: 0 },
  titleBox: { alignSelf: 'flex-start' },
  title: { ...lineStyle(REVIEW_TYPE.title), letterSpacing: TITLE_TRACKING },
  credit: { ...lineStyle(REVIEW_TYPE.credit), marginTop: REVIEW_ROW.creditTop },
  quote: { marginTop: QUOTE_GAP },
  date: { ...lineStyle(REVIEW_TYPE.date), marginTop: DATE_TOP },
  article: { marginTop: ARTICLE_TOP },
  body: lineStyle(REVIEW_TYPE.body),
  details: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: DETAILS_ICON.gap,
    marginTop: DETAILS_TOP,
  },
  /* On the first line, centred on it. */
  detailsIcon: { marginTop: (REVIEW_TYPE.details.line - DETAILS_ICON.size) / 2 },
  detailsText: { ...lineStyle(REVIEW_TYPE.details), flex: 1 },
  platform: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: PLATFORM_ICON.gap,
    marginTop: PLATFORM_TOP,
    maxWidth: '100%',
  },
  platformName: { ...lineStyle(REVIEW_TYPE.platform), flexShrink: 1 },
  likeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: LIKE_ROW.height,
  },
  like: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LIKE_ROW.heartGap,
    minWidth: LIKE_ROW.height,
    height: LIKE_ROW.height,
  },
  count: lineStyle(REVIEW_TYPE.count),
  likeEnd: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x16 },
  share: {
    width: LIKE_ROW.height,
    height: LIKE_ROW.height,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  replies: { marginTop: REPLIES_TOP },
  repliesHeading: lineStyle(REVIEW_TYPE.replies),
  /* The album page's head: the art's room, then the words on its foot. */
  masthead: { alignSelf: 'stretch', alignItems: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.x8 },
  tag: {
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 12,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: withAlpha(Palette.white, 0.3),
    backgroundColor: withAlpha(Palette.white, 0.14),
  },
  tagText: {
    fontFamily: Typeface.semibold,
    fontSize: 11,
    lineHeight: 14,
    color: withAlpha(Palette.white, 0.86),
  },
  lip: { position: 'absolute', left: 0, right: 0, bottom: 0, height: LIP },
  words: { alignItems: 'flex-start', gap: Spacing.x8 },
  centred: { textAlign: 'left' },
  bylineLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8, maxWidth: '100%' },
  facts: { ...lineStyle(REVIEW_TYPE.date), marginTop: Spacing.x4 },
  keys: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.x8,
  },
  keysStart: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  keysEnd: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  glassKey: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeKey: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    alignSelf: 'stretch',
    height: StyleSheet.hairlineWidth,
    marginTop: Spacing.x16,
    marginBottom: Spacing.x4,
  },
  solid: { alignSelf: 'stretch', alignItems: 'center', paddingTop: Spacing.x8 },
});
