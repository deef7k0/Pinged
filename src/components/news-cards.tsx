import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { EventRsvp } from '@/components/event-rsvp';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Card } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { HeroAspectRatio, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { timeAgo } from '@/lib/format';
import type { LatestEvent } from '@/lib/games/browse';
import type { Article, GameEvent } from '@/lib/news';

/** Diameter of the play glyph centred on a trailer thumbnail. */
const PLAY_BADGE = 52;

/**
 * Cards for the News tab: headlines, trailers and events.
 *
 * Nothing here renders a <GameCase /> — the News tab is a browsing surface, and
 * physical cases are reserved for dedicated game pages. Anything that shows a
 * game rather than a story about one belongs in <CoverTile> or <GameListItem>.
 */

function openExternal(url: string) {
  Linking.openURL(url).catch(() => {
    // Nothing sensible to do if the OS has no handler; failing silently beats
    // an alert the user cannot act on.
  });
}

/**
 * A news story, laid out as an editorial card.
 *
 * Top to bottom: the key image full-bleed across the card, then a byline row
 * (round outlet badge + the outlet's name in caps), then the headline at
 * display weight, the standfirst in grey, and a `READ STORY` call to action on
 * its own line at the foot.
 *
 * This replaces a microblog row — a small round badge on the left, the headline
 * beside it, and a 76px thumbnail tucked to the right of the text. That layout
 * was chosen for density, and density is the wrong goal here: a news tab is
 * read a story at a time, not scanned like a timeline, and shrinking the
 * photograph to a stamp threw away the one thing that makes somebody stop.
 *
 * The proportions come from the reference: the image is the loudest element,
 * the outlet is the quietest, and the headline sits between them carrying most
 * of the card's weight. Every text row is left-aligned to the same edge, which
 * is what makes a stack of these read as a publication rather than as a feed.
 */
export function ArticleCard({ article }: { article: Article }) {
  const theme = useTheme();

  /* Apple News's row (the Apple pass, 2026-11-05): the outlet, the headline,
     the time, and the story's picture as an 80 square at the trailing edge.
     No summary and no "Read story" — the whole row is the door. It was a card
     with the picture full-bleed over a byline, a headline, three lines of
     summary and "Read story". */
  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={`${article.title} — ${article.source}`}
      onPress={() => openExternal(article.url)}
      scaleTo={0.98}
      style={styles.row}>
      <View style={styles.rowText}>
        <Text variant="h5" color="textSecondary" numberOfLines={1}>
          {article.source}
        </Text>
        <Text variant="h4" numberOfLines={3}>
          {article.title}
        </Text>
        {article.publishedAt && (
          <Text variant="caption" color="textMuted">
            {timeAgo(article.publishedAt)}
          </Text>
        )}
      </View>
      {article.imageUrl ? (
        <Image
          source={{ uri: article.imageUrl }}
          recyclingKey={article.id}
          cachePolicy="memory-disk"
          style={[styles.thumb, { backgroundColor: theme.surfaceElevated }]}
          contentFit="cover"
          transition={200}
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </PressableScale>
  );
}

/** A news row's height, for its skeleton: the 80 picture and the row's padding. */
export const ARTICLE_ROW_HEIGHT = 80 + 24;

/**
 * A showcase that has finished, laid out as a news story — Home's "Latest
 * events", at the owner's direction (2026-10-15): "in the same style as the
 * news card… it should redirect to the specific event screen".
 *
 * `<ArticleCard>`'s shape, part for part: the event's key art full-bleed, a
 * byline row — a round badge, where it streamed in caps where the outlet's
 * name goes, the date where the time goes — the name as the headline, a few
 * lines of what it was, and an action on its own line at the foot. The whole
 * card opens `event/[id]`, whose games are shown now that it is over.
 */
export function PastEventCard({ event }: { event: LatestEvent }) {
  const theme = useTheme();
  const router = useRouter();
  const date = new Date(event.startTime * 1000).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
  const byline = event.networks.length > 0 ? event.networks.slice(0, 2).join(' · ') : 'Showcase';
  const action =
    event.gameCount > 0
      ? `See the ${event.gameCount} ${event.gameCount === 1 ? 'game' : 'games'} shown`
      : 'See the event';

  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={`${event.name}, ${date}. ${action}.`}
      onPress={() => router.push({ pathname: '/event/[id]', params: { id: String(event.id) } })}
      scaleTo={0.98}>
      <Card padded={false}>
        {event.bannerUrl && (
          <Image
            source={{ uri: event.bannerUrl }}
            recyclingKey={String(event.id)}
            cachePolicy="memory-disk"
            style={[styles.storyImage, { backgroundColor: theme.surfaceElevated }]}
            contentFit="cover"
            transition={200}
            accessibilityIgnoresInvertColors
          />
        )}

        <View style={styles.storyBody}>
          <View style={styles.bylineRow}>
            <View style={[styles.outletBadge, { backgroundColor: theme.surfaceElevated }]}>
              <Ionicons name="calendar-clear" size={12} color={theme.primary} />
            </View>
            <Text variant="label" color="textSecondary" numberOfLines={1} style={styles.outlet}>
              {byline}
            </Text>
            <Text variant="caption" color="textMuted">
              {date}
            </Text>
          </View>

          <Text variant="h2" numberOfLines={3}>
            {event.name}
          </Text>

          {event.description && (
            <Text variant="body" color="textSecondary" numberOfLines={3}>
              {event.description}
            </Text>
          )}

          <Text variant="label" style={[styles.readStory, { color: theme.text }]}>
            {action}
          </Text>
        </View>
      </Card>
    </PressableScale>
  );
}

/*
 * There is deliberately no ChartRow here any more. The popularity chart is a
 * wall of covers built from <CoverTile>, on both the News tab and the Top 10
 * screen, so a second row-shaped rendering of the same data would put the two
 * surfaces back out of step the moment one of them changed.
 */

export function EventCard({ event }: { event: GameEvent }) {
  const theme = useTheme();
  const starts = event.startsAt ? new Date(event.startsAt) : null;

  return (
    <Card>
      <View style={styles.eventBody}>
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={13} color={theme.textMuted} />
          <Text variant="caption" color="textMuted">
            {starts
              ? starts.toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : 'Date to be announced'}
          </Text>
          {event.isUpcoming && (
            <View style={[styles.pill, { backgroundColor: theme.primaryMuted }]}>
              <Text variant="caption" style={{ color: theme.primary }}>
                UPCOMING
              </Text>
            </View>
          )}
        </View>

        <Text variant="h5">{event.name}</Text>

        {event.description && (
          <Text variant="bodySmall" color="textMuted" numberOfLines={3}>
            {event.description}
          </Text>
        )}

        {event.liveStreamUrl && (
          <Text
            variant="bodySmall"
            color="primaryText"
            onPress={() => openExternal(event.liveStreamUrl!)}>
            Watch the stream
          </Text>
        )}

        {/* Only upcoming events can be attended or reminded about. */}
        {event.isUpcoming && <EventRsvp event={event} />}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.x12,
    paddingVertical: Spacing.x12,
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  thumb: { width: 80, height: 80, borderRadius: Radius.image, borderCurve: 'continuous' },
  storyImage: { width: '100%', aspectRatio: HeroAspectRatio },
  /* 16 all round rather than the card's usual padding: this is a page of type,
     and type wants a margin. */
  storyBody: { padding: Spacing.x16, gap: Spacing.x12 },
  bylineRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  outletBadge: {
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Takes the slack so the timestamp holds the right edge. */
  outlet: { flex: 1 },
  /* Set apart from the standfirst above it — it is an action, not another
     paragraph, and the gap is the only thing saying so. */
  readStory: { paddingTop: Spacing.x4 },
  articleImage: { width: '100%', aspectRatio: HeroAspectRatio },
  articleBody: { padding: Spacing.x16, gap: Spacing.x8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  playBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: PLAY_BADGE,
    height: PLAY_BADGE,
    /* Geometric, not spacing: pulls the badge back by half its own size so the
       50%/50% origin lands on its centre. Derived so the two stay in step. */
    marginTop: -PLAY_BADGE / 2,
    marginLeft: -PLAY_BADGE / 2,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventBody: { gap: Spacing.x8 },
  pill: {
    paddingHorizontal: Spacing.x8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
});
