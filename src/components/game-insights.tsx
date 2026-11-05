import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { MemberReviewCard } from '@/components/member-review-card';
import { ScoreSummary } from '@/components/score-summary';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PANEL_GAP, Panel } from '@/components/ui/panel';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Section, useSectionInset } from '@/components/ui/section';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { clampScore, ratingVerdict, scoreColor } from '@/constants/score';
import { STATUS_LABEL } from '@/constants/status';
import { Typeface, Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useReadingLanguages } from '@/hooks/use-reading-languages';
import { useTheme } from '@/hooks/use-theme';
import {
  getGameAudience,
  getGamePlayers,
  getRatingBreakdown,
  getTopGameReview,
  type GamePlayer,
} from '@/lib/api';
import { readingKey } from '@/lib/discovery';
import { displayNameFor } from '@/lib/format';
import { spokenWords } from '@/lib/review-quote';
import { useAuth } from '@/store/auth';

// ---------------------------------------------------------------------------
// Ratings — what the people here scored it
// ---------------------------------------------------------------------------

/**
 * GameLog's own verdict on the game, at the head of its Overview: the word,
 * the average, and how the scores divide.
 *
 * ```text
 *   ╭ Ratings ─────────────────────────────╮
 *   │ ──────────────────────────────────── │
 *   │ Very Positive                (o_o)   │
 *   │ Based on 128 ratings          /|\ 84 │
 *   │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ▒▒▒▒  ░░          │
 *   ╰──────────────────────────────────────╯
 * ```
 *
 * The owner's direction (2026-10-09): the ratings graph "used inside the
 * reviews sheet", on the Overview — in a card titled as the reference's is, a
 * film's page in Letterboxd. The graph is `<ScoreSummary>`, the sheet's own,
 * so the two are one thing; the card is a door to that sheet, where the same
 * summary heads every review.
 *
 * **The count is under the verdict**, at the owner's direction (2026-10-16):
 * "display the rating label like 'Very Positive' and below that the amount of
 * reviews". It was at the far end of the title — "128 ratings" — with the
 * summary told not to say it twice; it moved, so the card reads as Steam's
 * does and as the sheet's head already did, and the title stands alone.
 *
 * **The app's own numbers, never IGDB's.** This answers what an outside score
 * cannot: what the people here thought.
 *
 * Renders nothing when nobody has rated the game — an empty graph under a real
 * heading claims a distribution exists and that it is flat — and nothing while
 * it loads: the page's masthead asks for the same numbers under the same key,
 * so they have nearly always arrived with the page.
 */
export function RatingsCard({
  gameId,
  title,
  onOpen,
}: {
  gameId: string;
  title: string;
  /** Open every review of the game. */
  onOpen: () => void;
}) {
  const breakdown = useQuery({
    queryKey: ['rating-breakdown', gameId],
    queryFn: () => getRatingBreakdown(gameId),
    enabled: !!gameId,
  });

  const data = breakdown.data;
  if (!data) return null;

  const shown = clampScore(data.average);
  const verdict = ratingVerdict(shown, data.total);
  /* Said as the card prints it: `<ScoreSummary>`'s "Based on N ratings". */
  const counted = `${data.total.toLocaleString()} ${data.total === 1 ? 'rating' : 'ratings'}`;

  return (
    <Panel
      title="Ratings"
      onPress={onOpen}
      accessibilityLabel={`Ratings of ${title} on Pinged: ${verdict.label}, ${shown} out of 100 from ${counted}. Opens the reviews.`}>
      {/* The verdict, and under it how many reviews it is from. */}
      <ScoreSummary gameId={gameId} breakdown={data} graphCard={false} />
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// On GameLog — how many want it, are playing it, have played it
// ---------------------------------------------------------------------------

/**
 * Three figures about the room: how many people here have the game on their
 * wishlist, are playing it now, and have played it.
 *
 * ```text
 *   ╭ On GameLog ──────────────────────────╮
 *   │ ──────────────────────────────────── │
 *   │    24      │     3       │    58     │
 *   │ Wishlisted │ Playing now │  Played   │
 *   ╰──────────────────────────────────────╯
 * ```
 *
 * The owner's request (2026-10-16): "how much people want the game
 * (wishlist), how many are playing rn, how many already played it". The
 * numbers are GameLog's own (`getGameAudience` says exactly what each
 * counts); IGDB has figures with the same names, and they are shares of its
 * traffic, not people.
 *
 * Three centred rows (the owner's, 2026-11-03): each a glyph — a bookmark,
 * a controller, a tick — and under it the number with what it counts, "25
 * playing now". It was a strip of three in a titled card. **A zero is printed** — it is a
 * number the app knows, as the masthead's "0 Collections" is — so the card is
 * there for every game, once its answer is in. Its shape is held while it
 * loads so nothing under it moves; a failed request says so in the card and
 * offers a retry — it vanished, so a game whose counts would not load looked
 * like one that had no card (critique, 2026-10-21).
 *
 * Invalidated by anything that writes a status or the wishlist
 * (`['game-audience', gameId]`): the log form, the progress sheet, the
 * action row's Wishlist key.
 */
export function GameAudienceCard({ gameId, title }: { gameId: string; title: string }) {
  const accent = useAccent();
  const audience = useQuery({
    queryKey: ['game-audience', gameId],
    queryFn: () => getGameAudience(gameId),
    enabled: !!gameId,
    staleTime: 60_000,
  });

  if (audience.isLoadingError) {
    return (
      <Panel title="On Pinged">
        <View style={styles.failed}>
          <Text variant="body" color="textSecondary">
            These counts couldn’t be loaded.
          </Text>
          <Button
            title="Try again"
            size="small"
            variant="secondary"
            loading={audience.isFetching}
            onPress={() => void audience.refetch()}
          />
        </View>
      </Panel>
    );
  }

  const data = audience.data;
  const count = (n: number, one: string, many: string) =>
    `${n.toLocaleString()} ${n === 1 ? one : many}`;

  /* One row a figure, centred: its glyph, then the number and what it counts
     (the owner's, 2026-11-03). */
  const rows: AudienceRow[] = data
    ? [
        {
          key: 'wishlisted',
          icon: 'bookmark',
          line: `${data.wishlisted.toLocaleString()} wishlisted`,
          a11y: `${count(data.wishlisted, 'person has', 'people have')} ${title} on their wishlist`,
        },
        {
          key: 'playing',
          icon: 'game-controller',
          line: `${data.playing.toLocaleString()} playing now`,
          a11y: `${count(data.playing, 'person is', 'people are')} playing it now`,
        },
        {
          key: 'played',
          icon: 'checkmark-circle',
          line: `${data.played.toLocaleString()} played`,
          a11y: `${count(data.played, 'person has', 'people have')} played it`,
        },
      ]
    : [];

  return (
    <Panel title="On Pinged">
      {data ? (
        <View style={styles.audience}>
          {rows.map((row) => (
            <View key={row.key} style={styles.audienceRow} accessible accessibilityLabel={row.a11y}>
              <Ionicons name={row.icon} size={26} color={accent.onSurface} />
              <Text variant="h4" style={styles.audienceLine}>
                {row.line}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.audience}>
          {[0, 1, 2].map((index) => (
            <View key={index} style={styles.audienceRow}>
              <Skeleton width={26} height={26} radius={13} />
              <Skeleton width={120} height={16} />
            </View>
          ))}
        </View>
      )}
    </Panel>
  );
}

type AudienceRow = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  line: string;
  a11y: string;
};

// ---------------------------------------------------------------------------
// Played by — and by the people you follow
// ---------------------------------------------------------------------------

/** A face in a square: the reference's 46pt on a 393pt phone, to the app's scale. */
const FACE = 44;

/**
 * Who played the game, as two squares side by side: anybody, and the people
 * you follow.
 *
 * ```text
 *   ╭ Played by ──── 214 ╮  ╭ From your friends ╮
 *   │ ────────────────── │  │ ───────────────── │
 *   │  ◍      ◍          │  │  ◍      ◍         │
 *   │  84     Playing    │  │  91     77        │
 *   ╰────────────────────╯  ╰───────────────────╯
 * ```
 *
 * The owner's reference (2026-10-09) is the pair of "Watched by" squares on a
 * film's page in Letterboxd: two faces each, and under each face what that
 * person gave it — here the 0–100 score in the score ramp's colour, or the
 * word for where they are with it when they have not scored it.
 *
 * - **Played** is playing, played, paused or dropped. A game on somebody's
 *   backlog has not been played by them.
 * - **Friends** are the people you follow and your accepted friends
 *   (`getCircleIds`). You are in neither square: these are other people.
 * - **A face opens that person's record of this game** (`game-stats`): what
 *   they logged, and Steam's measured time when there is any.
 *
 * The pair is absent when nobody else has played the game. When somebody has
 * and none of them is yours, the second square says so in a sentence rather
 * than leaving, so the first is never a lone half-width card.
 */
export function PlayedBy({ gameId }: { gameId: string }) {
  const accent = useAccent();
  const inset = useSectionInset();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;

  const players = useQuery({
    queryKey: ['game-players', gameId, viewerId],
    queryFn: () => getGamePlayers(gameId, viewerId),
    enabled: !!gameId,
    staleTime: 60_000,
  });

  const data = players.data;
  if (!data || data.total === 0) return null;

  return (
    <View style={[styles.squares, { paddingHorizontal: inset }]}>
      <Panel
        title="Played by"
        margin={0}
        style={styles.square}
        trailing={
          <Text variant="bodySmall" style={{ color: accent.quietInk }}>
            {data.total.toLocaleString()}
          </Text>
        }>
        <Faces players={data.recent} gameId={gameId} />
      </Panel>

      <Panel title="From your friends" margin={0} style={styles.square}>
        {data.circle.length > 0 ? (
          <Faces players={data.circle} gameId={gameId} />
        ) : (
          <Text variant="bodySmall" style={{ color: accent.quietInk }}>
            Nobody you follow has played this yet.
          </Text>
        )}
      </Panel>
    </View>
  );
}

/** Up to two people: a face each, and under it what they gave the game. */
function Faces({ players, gameId }: { players: readonly GamePlayer[]; gameId: string }) {
  const router = useRouter();
  const theme = useTheme();
  const accent = useAccent();

  return (
    <View style={styles.faces}>
      {players.map((player) => {
        const rounded = player.rating === null ? null : Math.round(player.rating);
        const status = STATUS_LABEL[player.status];

        return (
          <PressableScale
            key={player.userId}
            accessibilityRole="button"
            accessibilityLabel={`${player.name}, ${
              rounded !== null ? `scored it ${rounded}` : status.toLowerCase()
            }. Opens their record of this game.`}
            onPress={() =>
              router.push({
                pathname: '/game-stats/[user]/[game]',
                params: { user: player.userId, game: gameId },
              })
            }
            hitSlop={FACE_SLOP}
            scaleTo={0.94}
            style={StyleSheet.flatten(styles.face)}>
            <Avatar uri={player.avatarUrl} name={player.name} size={FACE} />
            {rounded !== null ? (
              <Text
                variant="bodySmall"
                style={[styles.faceScore, { color: scoreColor(rounded, theme) }]}>
                {rounded}
              </Text>
            ) : (
              <Text variant="bodySmall" numberOfLines={1} style={{ color: accent.quietInk }}>
                {status}
              </Text>
            )}
          </PressableScale>
        );
      })}
    </View>
  );
}

/** A face is 44 across; this takes its target to the tap floor on Android. */
const FACE_SLOP = { left: 2, right: 2, top: 0, bottom: 0 };

// Time to beat was a card here, until the owner had it removed (2026-10-15).
// The stats strip under the masthead still says how long a game is.

// ---------------------------------------------------------------------------
// Reviews — the most liked of the app's own
// ---------------------------------------------------------------------------

/**
 * How much of the most-liked review the Overview prints. A sample, offered to
 * somebody reading about the game; the sheet behind the heading's More prints
 * twice as much of each, and the review's own page all of it.
 */
const TOP_REVIEW_LINES = 5;

/**
 * What people here wrote: the most liked review of the game, in one card.
 *
 * It was a rail of the ten newest reviews, most liked first, in the critics'
 * card. The owner's direction (2026-10-09): one card, "from the most liked
 * review", drawn as a review is on a film's page in Letterboxd —
 * `<MemberReviewCard>`, which the reviews sheet's rows are too. One, because
 * the heading's More is a tap from all of them, and a sample that scrolls
 * sideways is a second list competing with the first.
 *
 * Which review it is is `getTopGameReview`: most liked, the newest of a tie —
 * **of the ones this reader can read**, when there is one (0038). The slot
 * holds one review, and the most liked one in a language somebody does not
 * read tells them nothing; with none they can read, it is the most liked
 * outright. The card opens that review; the heading's More opens every
 * review, in the sheet, where nothing is left out.
 *
 * Absent when nobody has written one — a section exists here only when it has
 * something in it — and no skeleton, for the reason the critics' rail has
 * none: a section drawn while loading and then withdrawn would move everything
 * under it twice.
 */
export function TopReview({
  gameId,
  title,
  onSeeAll,
}: {
  gameId: string;
  title: string;
  /** Open every review of the game. */
  onSeeAll: () => void;
}) {
  const router = useRouter();
  const inset = useSectionInset();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;
  const { reading, ready } = useReadingLanguages();

  const top = useQuery({
    /* Under the key the log form and a moderator's removal invalidate
       (`['top-reviews', gameId]`), with the viewer after it: whether the
       heart is lit depends on who is looking. */
    queryKey: ['top-reviews', gameId, viewerId, readingKey(reading)],
    queryFn: () => getTopGameReview(gameId, viewerId, reading),
    /* After the reader's languages are known, so the card is not drawn with
       one review and then redrawn with another. */
    enabled: !!gameId && ready,
    staleTime: 60_000,
  });

  const review = top.data;
  if (!review) return null;

  const { log } = review;
  const name = displayNameFor(log.profile);

  return (
    <Section
      title="Reviews"
      more={{ accessibilityLabel: `See all reviews of ${title}`, onPress: onSeeAll }}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={[
          `${name}’s review, the most liked`,
          log.rating !== null ? `scored it ${Math.round(log.rating)}` : null,
          log.spoilers ? 'Contains spoilers' : spokenWords(log),
          review.likes > 0 ? `${review.likes} ${review.likes === 1 ? 'like' : 'likes'}` : null,
          'Opens the review.',
        ]
          .filter(Boolean)
          .join('. ')}
        onPress={() => router.push({ pathname: '/review/[id]', params: { id: log.id } })}
        scaleTo={0.99}
        style={{ marginHorizontal: inset }}>
        <MemberReviewCard
          name={name}
          avatarUrl={log.profile?.avatar_url ?? null}
          text={log.review ?? ''}
          quote={log.review_title}
          display={log.review_display}
          score={log.rating}
          likes={review.likes}
          comments={review.comments}
          likedByViewer={review.likedByViewer}
          lines={TOP_REVIEW_LINES}
          spoiler={!!log.spoilers}
        />
      </PressableScale>
    </Section>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  audience: { gap: Spacing.x20, paddingVertical: Spacing.x8 },
  audienceRow: { alignItems: 'center', gap: Spacing.x8 },
  audienceLine: { textAlign: 'center' },
  /* A failed card: the sentence, then its way out. */
  failed: { gap: Spacing.x12, alignItems: 'flex-start' },
  /* Two equal squares, a panel's gap apart; `stretch` (the default) keeps them
     one height whichever holds more. */
  squares: { flexDirection: 'row', gap: PANEL_GAP },
  square: { flex: 1 },
  faces: { flexDirection: 'row', gap: Spacing.x12 },
  /* Its line under the face is centred on the face, as the reference's
     ratings are under theirs. */
  face: { alignItems: 'center', gap: Spacing.x4, minWidth: FACE },
  /* The bold family — Android synthesises no weight for a custom font. */
  faceScore: { fontFamily: Typeface.bold, fontVariant: ['tabular-nums'] },
});
