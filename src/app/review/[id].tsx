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
import { Text } from '@/components/ui/text';
import { PLATFORMS } from '@/constants/platform-cases';
import { familyForStored, platformKeyForStored } from '@/constants/platform-family';
import { PROGRESS_META, progressChoiceFor } from '@/constants/progress';
import { orderedMetrics, parseReviewMetrics } from '@/constants/review-metrics';
import {
  ARTICLE_TOP,
  CONTENT_BOTTOM,
  DATE_TOP,
  DETAILS_ICON,
  DETAILS_TOP,
  HERO_FADE,
  LIKE_ROW,
  PLATFORM_ICON,
  PLATFORM_TOP,
  QUOTE_GAP,
  REPLIES_TOP,
  REVIEW_HERO,
  REVIEW_MARGIN,
  REVIEW_MAX_COLUMN,
  REVIEW_ROW,
  REVIEW_TYPE,
  TITLE_LINES,
  TITLE_TRACKING,
  reviewHeroHeight,
  type ReviewLine,
} from '@/constants/review-page';
import { labelFor, scoreColor } from '@/constants/score';
import { FontFamily, Palette, Spacing, withAlpha } from '@/constants/theme';
import { AccentProvider, useAccent } from '@/hooks/use-accent';
import { useLikeToggle } from '@/hooks/use-like-toggle';
import { useAnimatedCover } from '@/hooks/use-animated-cover';
import { useGameColours } from '@/hooks/use-game-colours';
import { useReviewColour } from '@/hooks/use-review-colour';
import { useSquareCover } from '@/hooks/use-square-cover';
import { useTheme } from '@/hooks/use-theme';
import { getEngagement, getLogById } from '@/lib/api';
import { recallLog } from '@/lib/api/seen-logs';
import type { CachedGame, LogWithRelations } from '@/lib/database.types';
import { displayNameFor } from '@/lib/format';
import { ordinalDate, playedDetails } from '@/lib/review-details';
import { normaliseQuote } from '@/lib/review-quote';
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
  const { width, height: windowHeight } = useWindowDimensions();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;

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
  const platformIcon = familyForStored(review.played_on)?.icon ?? 'game-controller';
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

  const heroHeight = reviewHeroHeight(windowHeight);
  const column = Math.min(width, REVIEW_MAX_COLUMN) - REVIEW_MARGIN * 2;

  /* What stands between the date and the platform. */
  const articleShown = hasProse || !quote;
  const reviewInk = withAlpha(theme.text, REVIEW_INK);

  return (
    <>
      <Screen
        edges={['bottom']}
        background={accent.page}
        /* The disc leaves with the art; the bar that follows names the game the
           review is of, once the row has gone under it. */
        topBar={
          <FrostedTopBar
            back
            title={game?.title ?? 'Review'}
            header={heroHeight + REVIEW_ROW.top + REVIEW_ROW.avatar}
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
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <ReviewHero game={game} width={width} height={heroHeight} page={accent.page} />

            <View style={{ width: column }}>
              {/*
                The row: the writer's face, and beside it — centred on it — their
                name with the score at the far end, the game's name, its
                developer.
              */}
              <View style={styles.row}>
                {author ? (
                  <Link href={{ pathname: '/profile/[id]', params: { id: author.id } }} asChild>
                    <PressableScale
                      accessibilityRole="link"
                      accessibilityLabel={`${authorName}’s profile`}
                      scaleTo={0.96}>
                      <Avatar uri={author.avatar_url} name={authorName} size={REVIEW_ROW.avatar} />
                    </PressableScale>
                  </Link>
                ) : (
                  <Avatar uri={null} name={authorName} size={REVIEW_ROW.avatar} />
                )}

                <View style={styles.billing}>
                  <View style={styles.nameLine}>
                    {author ? (
                      <Link href={{ pathname: '/profile/[id]', params: { id: author.id } }} asChild>
                        <PressableScale
                          accessibilityRole="link"
                          accessibilityLabel={`Review by ${authorName}. Opens their profile.`}
                          hitSlop={NAME_SLOP}
                          scaleTo={0.97}
                          style={styles.nameLink}>
                          <Text
                            numberOfLines={1}
                            style={[styles.name, { color: withAlpha(theme.text, NAME_INK) }]}>
                            {authorName}
                          </Text>
                        </PressableScale>
                      </Link>
                    ) : (
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.name,
                          styles.nameLink,
                          { color: withAlpha(theme.text, NAME_INK) },
                        ]}>
                        {authorName}
                      </Text>
                    )}

                    {/* The score and its word, where the screenshot has its
                        stars, in the score's own colour. */}
                    {rating !== null && (
                      <Text
                        accessibilityLabel={`Scored ${rating} out of 100, ${labelFor(rating)}`}
                        style={[styles.score, { color: scoreColor(rating, theme) }]}>
                        {`${rating} ${labelFor(rating).toUpperCase()}`}
                      </Text>
                    )}
                  </View>

                  <GameName game={game} gameId={review.game_id} />

                  {!!game?.developer && (
                    <Text numberOfLines={1} style={[styles.credit, { color: theme.textMuted }]}>
                      by {game.developer}
                    </Text>
                  )}
                </View>
              </View>

              {/* The review in one sentence, between its marks, centred over the
                  review it heads. Not covered by a spoiler flag: it was the
                  review's headline, and the headline never was. */}
              {!!quote && (
                <QuoteBlock
                  text={quote}
                  size="page"
                  color={theme.text}
                  typed
                  style={styles.quote}
                />
              )}

              <Text style={[styles.date, { color: theme.textMuted }]}>
                {ordinalDate(review.created_at)}
              </Text>

              {/*
                The review. The one screen where a spoiler notice uncovers rather
                than navigates: the reader arrived here on purpose, so one
                deliberate tap and the review appears.
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

              {/* How it was played, where the screenshot offers a translation:
                  a quiet line under the progress glyph. */}
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

              {/* The platform, where the screenshot has the track the listener
                  liked: its mark and its name, at the far end. */}
              {platform && (
                <View
                  style={styles.platform}
                  accessible
                  accessibilityLabel={`Played on ${platform}`}>
                  <Ionicons name={platformIcon} size={PLATFORM_ICON.size} color={theme.white} />
                  <Text numberOfLines={1} style={[styles.platformName, { color: theme.white }]}>
                    {platform}
                  </Text>
                </View>
              )}

              {/* The like and its count; share, and the flag beside it for anyone
                  but the writer. */}
              <View
                style={[
                  styles.likeRow,
                  { marginTop: platform ? LIKE_ROW.top : LIKE_ROW.topAfterText },
                ]}>
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
                  scaleTo={0.9}
                  style={styles.like}>
                  <PressGlyph pop={liked}>
                    <Ionicons
                      name={liked ? 'heart' : 'heart-outline'}
                      size={LIKE_ROW.heart}
                      color={liked ? theme.liked : theme.textMuted}
                    />
                  </PressGlyph>
                  {likeCount > 0 && (
                    <Text style={[styles.count, { color: theme.textMuted }]}>
                      {likeCount.toLocaleString()}
                    </Text>
                  )}
                </PressableScale>

                <View style={styles.likeEnd}>
                  {canReport && (hasProse || !!quote) && (
                    <ReportFlag
                      target={{ kind: 'review', logId: review.id }}
                      authorId={review.user_id}
                      label={`Report ${authorName}’s review`}
                    />
                  )}
                  {pingTo && (
                    <PressableScale
                      accessibilityRole="button"
                      accessibilityLabel="Ping this review to someone"
                      onPress={() =>
                        pingTo({
                          kind: 'review',
                          targetId: review.id,
                          title: game ? `${authorName} on ${game.title}` : `${authorName}’s review`,
                          subtitle:
                            quote ?? (rating !== null ? `${rating} out of 100` : 'A review'),
                          imageUrl: game?.cover_url ?? null,
                        })
                      }
                      scaleTo={0.9}
                      style={styles.share}>
                      <PressGlyph motion="skip">
                        <Ionicons name={PING_GLYPH} size={LIKE_ROW.share} color={theme.textMuted} />
                      </PressGlyph>
                    </PressableScale>
                  )}
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel="Share this review as an image"
                    onPress={() => setSharing(true)}
                    scaleTo={0.9}
                    style={styles.share}>
                    <Ionicons name="share-outline" size={LIKE_ROW.share} color={theme.textMuted} />
                  </PressableScale>
                </View>
              </View>

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

/** The writer's name: the screenshot's is a step under white (#E2E2E2). */
const NAME_INK = 0.92;

/**
 * The review: the screenshot's is a light grey (#CFCFCF at its strokes'
 * cores) — between `text` and `textSecondary`, where there is no token.
 */
const REVIEW_INK = 0.82;

/** Lifts the 16dp name to the tap floor without moving anything. */
const NAME_SLOP = { top: 14, bottom: 6, left: 6, right: 6 };

/**
 * The square art at the top, full width and half the display tall — a
 * collection's header art's size: the game's square from SteamGridDB, else its
 * landscape art, else its cover, each cropped to fill the box. Dimmed, then
 * faded into the page by the screenshot's own ramp (`HERO_FADE`).
 *
 * **Nothing is drawn until the square lookup has an answer** — painting the
 * landscape art and swapping it for the square a beat later is exactly the
 * flicker `useSquareCover`'s `resolved` exists to prevent.
 *
 * **It moves, when the game has an animated square** (2026-10-20): the still
 * first, then a crossfade to the animation once found, and nothing said when
 * there is none. Subdued, so it does not pull the eye from the review: drawn
 * at `ANIMATED_HERO_OPACITY` over the page's colour, under the same veil and
 * fade as the still — about 0.4 of its full strength in all, inside the
 * request's 0.3–0.5.
 */
function ReviewHero({
  game,
  width,
  height,
  page,
}: {
  game: CachedGame | null;
  width: number;
  height: number;
  /** The page's colour, which the art fades into. */
  page: string;
}) {
  const square = useSquareCover({ gameId: game?.id, title: game?.title, enabled: !!game });
  const uri = square.resolved ? (square.uri ?? game?.hero_url ?? game?.cover_url ?? null) : null;
  const animated = useAnimatedCover({
    gameId: game?.id,
    title: game?.title,
    aspect: 'square',
    enabled: !!uri,
  });

  return (
    <View style={[styles.hero, { height }]} pointerEvents="none">
      {uri && (
        <AnimatedCoverImage
          staticUrl={uri}
          staticCacheKey={`review-hero-${uri}`}
          staticTransition={280}
          animatedUrl={animated.animatedUrl}
          format={animated.format}
          status={animated.status}
          onFailed={animated.reportFailure}
          aspect="square"
          style={{ width, height }}
          backdrop={page}
          animatedOpacity={ANIMATED_HERO_OPACITY}
        />
      )}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: withAlpha(Palette.shadowInk, REVIEW_HERO.veil) },
        ]}
      />
      <LinearGradient
        colors={HERO_COLOURS(page)}
        locations={HERO_LOCATIONS}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

/**
 * The animated square's strength over the page, under the veil: 0.6 × the
 * veil's 0.68 is about 0.41 — moving, and quieter than the still it replaces.
 */
const ANIMATED_HERO_OPACITY = 0.6;

const HERO_LOCATIONS = HERO_FADE.map((stop) => stop.at) as [number, number, ...number[]];

/** The ramp in the page's colour: only its alpha moves, ending on the page itself. */
function HERO_COLOURS(page: string) {
  return HERO_FADE.map((stop) => withAlpha(page, stop.alpha)) as [string, string, ...string[]];
}

/** The game's name, a link to its page: heavy, white, never cut short of four lines. */
function GameName({ game, gameId }: { game: CachedGame | null; gameId: string }) {
  const theme = useTheme();
  const name = (
    <Text numberOfLines={TITLE_LINES} style={[styles.title, { color: theme.white }]}>
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

/** A measured line as a style: its Poppins file, its size and its line. */
function lineStyle({ size, line, weight }: ReviewLine): TextStyle {
  return { fontFamily: FontFamily[weight], fontSize: size, lineHeight: line };
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { alignItems: 'center', paddingBottom: CONTENT_BOTTOM },
  hero: { alignSelf: 'stretch', overflow: 'hidden' },
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
  titleBox: { alignSelf: 'flex-start', marginTop: REVIEW_ROW.titleTop },
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
});
