import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';

import { QuoteBlock } from '@/components/quote-block';
import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Section, useSectionInset } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { clampScore, labelFor, scoreColor } from '@/constants/score';
import { STATUS_LABEL } from '@/constants/status';
import { Typeface, Palette, Spacing, withAlpha } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import {
  getGamePlayers,
  getGameReviewPage,
  getGameReviewRanking,
  getRatingBreakdown,
  type GamePlayer,
  type ReviewListItem,
} from '@/lib/api';
import { displayNameFor } from '@/lib/format';
import { cardShows, hasWriting } from '@/lib/review-quote';
import { useAuth } from '@/store/auth';

/*
 * The game page's Overview, the community's half, in Apple's own layouts
 * (the owner's, 2026-11-03: things that were on cards "look weird now. Like
 * the app's reviews, who reviewed it"):
 *
 * - **Ratings & Reviews** is the App Store's: the score large at the left with
 *   its verdict, the rating graph at the right, and the reviews as a rail of
 *   soft boxes you swipe through — Apple's one boxed thing, the same fill as
 *   the Information box, not the old card's edge and shadow.
 * - **Played by** is Apple TV's Cast & Crew: round faces in a row, a name
 *   under each and, where a role would be, the score they gave.
 */

const BOX_HEIGHT = 196;
const BOX_RADIUS = 12;
const FACE = 64;

/** Apple's soft box: white over the page, whatever the page's colour. */
const BOX_FILL = withAlpha(Palette.white, 0.07);

/**
 * Ratings & Reviews: the score, and one review under it (the owner's,
 * 2026-11-03: "show only the number, below only one card") — the most liked,
 * as the sheet opens on. The heading's chevron, the number and the review
 * each lead on: the sheet, or the review's own page.
 */
export function RatingsAndReviews({
  gameId,
  title,
  onOpen,
}: {
  gameId: string;
  title: string;
  onOpen: () => void;
}) {
  const theme = useTheme();
  const inset = useSectionInset();
  const { width } = useWindowDimensions();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;

  const breakdown = useQuery({
    queryKey: ['rating-breakdown', gameId],
    queryFn: () => getRatingBreakdown(gameId),
    enabled: !!gameId,
  });

  /* The most liked, under the sheet's own prefix, so whatever refreshes the
     sheet refreshes this. A few, so one with writing is among them. */
  const reviews = useQuery({
    queryKey: ['game-review-list', gameId, 'top', viewerId],
    queryFn: async () => {
      const ids = await getGameReviewRanking(gameId, 'popular', {});
      return getGameReviewPage(ids.slice(0, TOP_CANDIDATES), viewerId);
    },
    enabled: !!gameId,
    staleTime: 60_000,
  });

  const data = breakdown.data;
  const top = (reviews.data ?? []).find((item) => hasWriting(item.log)) ?? null;
  if (!data && !top) return null;

  const shown = data ? clampScore(data.average) : null;

  return (
    <Section
      title="Ratings & Reviews"
      more={{ accessibilityLabel: `All the ratings and reviews of ${title}`, onPress: onOpen }}>
      <View style={[styles.ratings, { paddingHorizontal: inset }]}>
        {data && shown !== null && (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`${shown} out of 100, ${labelFor(shown)}, from ${data.total} ${
              data.total === 1 ? 'rating' : 'ratings'
            }. Opens the reviews.`}
            onPress={onOpen}
            scaleTo={0.98}
            style={StyleSheet.flatten(styles.number)}>
            <Text style={[styles.score, { color: scoreColor(shown, theme) }]}>{shown}</Text>
          </PressableScale>
        )}
        {top && (
          <ReviewBox
            log={top.log}
            likes={top.likes}
            likedByViewer={top.likedByViewer}
            width={width - inset * 2}
          />
        )}
      </View>
    </Section>
  );
}

/** How many of the most liked are asked for, to find one with writing. */
const TOP_CANDIDATES = 5;

/**
 * One review, as the App Store draws one: who and how much across the top,
 * the words under them — the writer's one sentence between its marks when
 * they chose it, else their text — and the likes at the foot. `showGame`
 * names the game under the writer, for a rail of reviews of many games
 * (Explore's Popular reviews).
 */
export function ReviewBox({
  log,
  likes = 0,
  likedByViewer = false,
  width,
  showGame = false,
}: {
  log: ReviewListItem['log'];
  likes?: number;
  likedByViewer?: boolean;
  width: number;
  showGame?: boolean;
}) {
  const router = useRouter();
  const theme = useTheme();
  const gameTitle = showGame ? (log.game?.title ?? null) : null;
  const name = displayNameFor(log.profile);
  const score = log.rating === null ? null : Math.round(log.rating);
  const shows = cardShows(log);
  const words = (log.review ?? '').trim();

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={[
        gameTitle ? `${name}’s review of ${gameTitle}` : `${name}’s review`,
        score !== null ? `scored it ${score}, ${labelFor(score)}` : null,
        log.spoilers ? 'Contains spoilers' : shows === 'quote' ? log.review_title : words,
        'Opens the review.',
      ]
        .filter(Boolean)
        .join('. ')}
      onPress={() => router.push({ pathname: '/review/[id]', params: { id: log.id } })}
      scaleTo={0.97}>
      <View style={[styles.box, { width, backgroundColor: BOX_FILL }]}>
        <View style={styles.boxHead}>
          <Avatar uri={log.profile?.avatar_url ?? null} name={name} size={28} />
          <View style={styles.boxName}>
            <Text variant="itemTitle" numberOfLines={1}>
              {name}
            </Text>
            {!!gameTitle && (
              <Text variant="bodySmall" color="textSecondary" numberOfLines={1}>
                {gameTitle}
              </Text>
            )}
          </View>
          {score !== null && (
            <Text style={[styles.boxScore, { color: scoreColor(score, theme) }]}>{score}</Text>
          )}
        </View>

        <View style={styles.boxWords}>
          {log.spoilers ? (
            <View style={styles.spoiler}>
              <Ionicons name="eye-off-outline" size={16} color={theme.danger} />
              <Text variant="bodySmall" color="textSecondary">
                This review contains spoilers
              </Text>
            </View>
          ) : shows === 'quote' && log.review_title ? (
            <QuoteBlock
              text={log.review_title}
              size="card"
              color={theme.proseInk}
              accessible={false}
            />
          ) : (
            <Text variant="reviewExcerpt" color="proseInk" numberOfLines={5}>
              {words}
            </Text>
          )}
        </View>

        {likes > 0 && (
          <View style={styles.boxFoot}>
            {likes > 0 && (
              <View style={styles.count}>
                <Ionicons
                  name="heart"
                  size={12}
                  color={likedByViewer ? theme.liked : theme.textSecondary}
                />
                <Text variant="bodySmall" color="textSecondary">
                  {likes.toLocaleString()}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </PressableScale>
  );
}

/**
 * Who has played it, as Apple TV's Cast & Crew: your friends first, then
 * everybody, each a round face with their name under it and the score they
 * gave — or where they are with it — where a role would be. A face opens
 * that person's record of the game.
 */
export function PlayedByFaces({ gameId }: { gameId: string }) {
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;
  const inset = useSectionInset();

  /* The Overview's own query, shared by key with everything else that asks. */
  const players = useQuery({
    queryKey: ['game-players', gameId, viewerId],
    queryFn: () => getGamePlayers(gameId, viewerId),
    enabled: !!gameId,
    staleTime: 60_000,
  });

  const data = players.data;
  if (!data || data.total === 0) return null;

  const friends = new Set(data.circle.map((player) => player.userId));
  const faces = [...data.circle, ...data.recent.filter((player) => !friends.has(player.userId))];

  return (
    <Section title={`Played by ${data.total.toLocaleString()}`}>
      <FlatList
        data={faces}
        horizontal
        keyExtractor={(player) => player.userId}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.faces, { paddingHorizontal: inset }]}
        renderItem={({ item }) => (
          <Face player={item} gameId={gameId} friend={friends.has(item.userId)} />
        )}
      />
    </Section>
  );
}

function Face({ player, gameId, friend }: { player: GamePlayer; gameId: string; friend: boolean }) {
  const router = useRouter();
  const theme = useTheme();
  const accent = useAccent();
  const score = player.rating === null ? null : Math.round(player.rating);
  const status = STATUS_LABEL[player.status];

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${player.name}${friend ? ', a friend' : ''}, ${
        score !== null ? `scored it ${score}` : status.toLowerCase()
      }. Opens their record of this game.`}
      onPress={() =>
        router.push({
          pathname: '/game-stats/[user]/[game]',
          params: { user: player.userId, game: gameId },
        })
      }
      scaleTo={0.95}
      style={StyleSheet.flatten(styles.face)}>
      <View>
        <Avatar uri={player.avatarUrl} name={player.name} size={FACE} />
        {friend && (
          <View
            style={[styles.friend, { backgroundColor: accent.color, borderColor: accent.page }]}>
            <Ionicons name="people" size={10} color={accent.ink} />
          </View>
        )}
      </View>
      <Text variant="itemTitle" numberOfLines={1} style={styles.faceName}>
        {player.name}
      </Text>
      <Text
        variant="bodySmall"
        numberOfLines={1}
        style={[
          styles.faceRole,
          { color: score !== null ? scoreColor(score, theme) : accent.quietInk },
        ]}>
        {score !== null ? String(score) : status}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  ratings: { gap: Spacing.x16 },
  number: { alignSelf: 'flex-start' },
  score: {
    fontFamily: Typeface.extraBold,
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  box: {
    height: BOX_HEIGHT,
    borderRadius: BOX_RADIUS,
    padding: Spacing.x16,
    gap: Spacing.x12,
  },
  boxHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  boxName: { flex: 1 },
  boxScore: { fontFamily: Typeface.extraBold, fontSize: 17, lineHeight: 22 },
  boxWords: { flex: 1, overflow: 'hidden' },
  boxFoot: { flexDirection: 'row', gap: Spacing.x12 },
  count: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
  spoiler: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  faces: { gap: Spacing.x16, paddingTop: Spacing.x8 },
  face: { width: FACE + 12, alignItems: 'center', gap: 2 },
  faceName: { marginTop: Spacing.x8, textAlign: 'center' },
  faceRole: { textAlign: 'center', fontFamily: Typeface.semibold },
  friend: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
