import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { RichText } from '@/components/ui/rich-text';
import { Text } from '@/components/ui/text';
import { labelFor, scoreColor } from '@/constants/score';
import { STATUS_LABEL } from '@/constants/status';
import { Palette, Radius, Spacing, Typeface, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getFriendsWhoPlayed, type FriendPlay } from '@/lib/api';
import { displayNameFor, timeAgoPosted } from '@/lib/format';
import { hasWriting, normaliseQuote } from '@/lib/review-quote';
import { useAuth } from '@/store/auth';

/** Faces stacked at the start of the row, each over the last by a third. */
const FACES = 3;
const FACE = 30;
const FACE_OVERLAP = 10;
/** A review in the sheet: this many lines, then "…" — the whole is on its page. */
const REVIEW_LINES = 6;

const SOFT = withAlpha(Palette.white, 0.86);
const QUIET = withAlpha(Palette.white, 0.7);

/** The one query, shared by the row and its sheet. */
export function useFriendsWhoPlayed(gameId: string) {
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;
  return useQuery({
    queryKey: ['friends-played', gameId, viewerId],
    queryFn: () => getFriendsWhoPlayed(gameId, viewerId),
    enabled: !!gameId && !!viewerId,
    staleTime: 60_000,
  });
}

/** "Ada played this", "Ada and Ben played this", "Ada and 12 other friends played this". */
export function friendsLine(names: readonly string[], total: number): string {
  const [first, second] = names;
  if (total <= 1 || !first) return `${first ?? 'A friend'} played this`;
  if (total === 2 && second) return `${first} and ${second} played this`;
  const others = total - 1;
  return `${first} and ${others} other ${others === 1 ? 'friend' : 'friends'} played this`;
}

/**
 * The game page's "friends who played it" row — the owner's (2026-11-06),
 * after Letterboxd's "May and 12 other friends watched this": a few faces
 * stacked, the sentence, a chevron. Under "Developed by" in the header, on
 * the art, so its type is the header's white. Absent until somebody in the
 * viewer's circle has played the game.
 *
 * Pressing it raises the sheet (`<FriendsPlayedList>`): every friend's log of
 * the game, newest first. **The sheet is the page's, not this row's** — it is
 * one of the game page's `<GameSheets>`, outside the scroller. Mounted here,
 * inside the header, it was laid out in the header and scrolled with it.
 */
export function FriendsPlayedRow({ gameId, onOpen }: { gameId: string; onOpen: () => void }) {
  const friends = useFriendsWhoPlayed(gameId);

  const data = friends.data;
  if (!data || data.total === 0 || data.plays.length === 0) return null;

  const people = data.plays.map((play) =>
    play.log.profile ? displayNameFor(play.log.profile) : 'A friend'
  );
  const line = friendsLine(people, data.total);
  const faces = data.plays.slice(0, FACES);

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${line}. Opens what your friends made of it.`}
      onPress={onOpen}
      scaleTo={0.98}
      style={styles.row}>
      <View style={[styles.faces, { width: FACE + (faces.length - 1) * (FACE - FACE_OVERLAP) }]}>
        {faces.map((play, index) => (
          <View
            key={play.log.id}
            style={[
              styles.face,
              { left: index * (FACE - FACE_OVERLAP), zIndex: faces.length - index },
            ]}>
            <Avatar
              uri={play.log.profile?.avatar_url ?? null}
              name={people[index]}
              size={FACE - 2}
            />
          </View>
        ))}
      </View>
      <Text style={styles.line} numberOfLines={2}>
        {line}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={QUIET} />
    </PressableScale>
  );
}

/** The sheet's body: every friend's log of the game, from the row's own query. */
export function FriendsPlayedList({ gameId, onLeave }: { gameId: string; onLeave: () => void }) {
  const theme = useTheme();
  const friends = useFriendsWhoPlayed(gameId);
  return (
    <FlatList
      data={friends.data?.plays ?? []}
      keyExtractor={(play) => play.log.id}
      renderItem={({ item }) => <FriendPlayRow play={item} onLeave={onLeave} />}
      ItemSeparatorComponent={Separator}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      style={{ backgroundColor: theme.background }}
    />
  );
}

function Separator() {
  const theme = useTheme();
  return <View style={[styles.separator, { backgroundColor: theme.border }]} />;
}

/**
 * One friend's log, as Letterboxd's sheet draws one: the face, the name, the
 * score — the number and its word in the score ramp, where Letterboxd sets
 * stars — the review in a few lines, a spoiler as a pill to tap, then the
 * likes, and the date at the far end. A log with no writing is
 * the face, the name, the score or the status, and the date.
 */
function FriendPlayRow({ play, onLeave }: { play: FriendPlay; onLeave: () => void }) {
  const theme = useTheme();
  const router = useRouter();
  const { log, likes, likedByViewer } = play;
  const [revealed, setRevealed] = useState(false);
  const name = log.profile ? displayNameFor(log.profile) : 'A friend';
  const rating = log.rating === null ? null : Math.round(log.rating);
  const written = hasWriting(log);
  const words = log.review?.trim() || normaliseQuote(log.review_title) || '';

  function go(href: Href) {
    onLeave();
    router.push(href);
  }

  const open = () =>
    go(
      written
        ? { pathname: '/review/[id]', params: { id: log.id } }
        : {
            pathname: '/game-stats/[user]/[game]',
            params: { user: log.user_id, game: log.game_id },
          }
    );

  return (
    <View style={styles.play}>
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={`${name}'s profile`}
        onPress={() => go({ pathname: '/profile/[id]', params: { id: log.user_id } })}
        scaleTo={0.94}>
        <Avatar uri={log.profile?.avatar_url ?? null} name={name} size={40} />
      </PressableScale>

      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={[
          name,
          rating !== null ? `${rating}, ${labelFor(rating)}` : STATUS_LABEL[log.status],
          written ? (log.spoilers && !revealed ? 'Contains spoilers' : words) : null,
          written ? 'Opens the review.' : 'Opens their record of the game.',
        ]
          .filter(Boolean)
          .join('. ')}
        onPress={open}
        scaleTo={0.99}
        style={styles.playBody}>
        <Text variant="h5" numberOfLines={1}>
          {name}
        </Text>

        {rating !== null ? (
          <Text style={[styles.score, { color: scoreColor(rating, theme) }]}>
            <Text style={[styles.scoreNumber, { color: scoreColor(rating, theme) }]}>{rating}</Text>
            {`  ${labelFor(rating)}`}
          </Text>
        ) : (
          <Text variant="bodySmall" color="textSecondary">
            {STATUS_LABEL[log.status]}
          </Text>
        )}

        {written &&
          (log.spoilers && !revealed ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Reveal the spoiler"
              onPress={() => setRevealed(true)}
              scaleTo={0.96}
              style={StyleSheet.flatten([
                styles.spoiler,
                { backgroundColor: theme.surfaceElevated },
              ])}>
              <Text variant="bodySmall" color="textSecondary">
                Tap to reveal spoiler
              </Text>
            </PressableScale>
          ) : (
            <RichText
              variant="body"
              numberOfLines={REVIEW_LINES}
              ellipsizeMode="tail"
              style={styles.review}>
              {words}
            </RichText>
          ))}

        <View style={styles.foot}>
          {written && (
            <View style={styles.count}>
              <Ionicons
                name={likedByViewer ? 'heart' : 'heart-outline'}
                size={17}
                color={likedByViewer ? theme.liked : theme.textSecondary}
              />
              {likes > 0 && (
                <Text variant="bodySmall" color="textSecondary">
                  {likes}
                </Text>
              )}
            </View>
          )}
          <Text variant="caption" color="textMuted" style={styles.date}>
            {timeAgoPosted(log.updated_at ?? log.created_at)}
          </Text>
        </View>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    paddingVertical: Spacing.x4,
  },
  faces: { height: FACE },
  face: {
    position: 'absolute',
    top: 0,
    width: FACE,
    height: FACE,
    borderRadius: FACE / 2,
    borderWidth: 1,
    borderColor: withAlpha(Palette.shadowInk, 0.6),
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    flex: 1,
    fontFamily: Typeface.semibold,
    fontSize: 14,
    lineHeight: 19,
    color: SOFT,
  },
  list: { paddingHorizontal: Spacing.x16, paddingBottom: Spacing.x48 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 40 + Spacing.x12 },
  play: { flexDirection: 'row', gap: Spacing.x12, paddingVertical: Spacing.x16 },
  playBody: { flex: 1, minWidth: 0, gap: Spacing.x4 },
  score: { fontFamily: Typeface.semibold, fontSize: 13, lineHeight: 18 },
  scoreNumber: { fontFamily: Typeface.bold },
  review: { marginTop: Spacing.x4 },
  spoiler: {
    alignSelf: 'flex-start',
    marginTop: Spacing.x4,
    paddingHorizontal: Spacing.x12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x16,
    marginTop: Spacing.x8,
  },
  count: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  date: { marginLeft: 'auto' },
});
