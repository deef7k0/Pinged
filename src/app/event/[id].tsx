import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Linking, Share, StyleSheet, View, useWindowDimensions } from 'react-native';

import { GameGridTile } from '@/components/game-grid-tile';
import { PORTRAIT_COLUMNS, gridItemWidth } from '@/components/gaming/game-tile';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ExpandableText } from '@/components/ui/expandable-text';
import { PING_GLYPH, usePingTo } from '@/components/pings/use-ping-to';
import { FrostedTopBar, TopBarDisc } from '@/components/ui/frosted-top-bar';
import { IconButton } from '@/components/ui/icon-button';
import { InfoCard } from '@/components/ui/info-card';
import { PageFlatList } from '@/components/ui/page-scroll';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { SlideUpSheet } from '@/components/ui/slide-up-sheet';
import { Text } from '@/components/ui/text';
import { CoverGridWindow } from '@/constants/list-window';
import { MaxContentWidth, Spacing, TapTarget, withAlpha } from '@/constants/theme';
import { AccentProvider, useGameAccent } from '@/hooks/use-accent';
import { useEventAttendance } from '@/hooks/use-event-attendance';
import { useTheme } from '@/hooks/use-theme';
import { getEventWatchers, type EventWatcher } from '@/lib/api';
import {
  countdown,
  eventPhase,
  runningTime,
  showsGames,
  startCells,
  type EventPhase,
} from '@/lib/event-phase';
import { getEvent, getEventGames, type EventDetail } from '@/lib/games/browse';
import type { GameEvent } from '@/lib/news';
import { remindersAvailable } from '@/lib/reminders';
import { useAuth } from '@/store/auth';

/** Between covers, across and down — the collection grid's. */
const GRID_GAP = Spacing.x12;

/** Lines of the event's description before More. */
const ABOUT_LINES = 3;

/** IGDB's event art is 16:9, and so is the banner. */
const BANNER_RATIO = 9 / 16;

/** The event's name under its banner, and the gap over it, near enough. */
const NAME_BLOCK = 64;

/** Faces in the row before "+N". */
const FACES = 7;
const FACE_SIZE = 40;

/** A link's square tile. */
const LINK_TILE = 88;

/** A link's glyph by its label: the network when it is one this app knows. */
function linkGlyph(label: string): keyof typeof Ionicons.glyphMap {
  const name = label.toLowerCase();
  if (name.includes('youtube')) return 'logo-youtube';
  if (name.includes('twitch')) return 'logo-twitch';
  if (name.includes('twitter') || name.includes(' x')) return 'logo-twitter';
  if (name.includes('facebook')) return 'logo-facebook';
  if (name.includes('instagram')) return 'logo-instagram';
  if (name.includes('tiktok')) return 'logo-tiktok';
  if (name.includes('discord')) return 'logo-discord';
  if (name.includes('steam')) return 'logo-steam';
  return 'globe-outline';
}

/** Room under the last row for the foot bar: its button, its padding, its fade. */
const FOOT_ROOM = 112;

function open(url: string) {
  Linking.openURL(url).catch(() => {
    // No handler for the scheme; nothing useful to say about it.
  });
}

/**
 * One event — a showcase, a conference, an award show — laid out as the owner's
 * reference lays out a race (2026-10-15: "Landscape art at the top, name of the
 * event in big bold, small info below, in bigger the date, time it starts,
 * people participating/watching, and then the games that are shown whenever
 * the event is over").
 *
 * Top to bottom: the key art, melting into the page; the name; one small line
 * of where it streams and a tag for where it is in its life (upcoming, live,
 * ended — the reference's "RUNNING"); then the three things in bigger type —
 * the date, the start time, how many are watching; the faces of the people
 * watching, friends first; what it is; and, **only once it is over**, the
 * games shown at it (`showsGames`). Before then nothing is printed there:
 * IGDB's list for an event still to come is an announcement, not a record.
 *
 * The one action is pinned to the foot, as the reference's "View Results" is,
 * and it is the action for the moment: say you will be watching (with a
 * reminder beside it) before; watch while it is live; watch the replay after,
 * when there is a stream to go back to. Watching in person is a quiet line
 * under the faces, not a second big button.
 *
 * Opened from News's Events. Two IGDB requests (the event, then its games by
 * id — only when they will be shown) and two of ours (attendance, faces).
 */
export default function EventScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = Number(id);
  const valid = Number.isFinite(eventId);
  /* Read once, when the screen mounts: "now" must not move between renders, and
     a lazy initialiser is the one place a clock may be read during one. */
  const [now] = useState(() => Date.now());
  const pingTo = usePingTo();

  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(windowWidth, MaxContentWidth);
  const tileWidth = gridItemWidth(width, PORTRAIT_COLUMNS, Spacing.x16, GRID_GAP);

  const event = useQuery({
    queryKey: ['event', eventId],
    queryFn: ({ signal }) => getEvent(eventId, signal),
    enabled: valid,
    staleTime: 30 * 60_000,
  });

  const data = event.data ?? null;
  const phase: EventPhase = data ? eventPhase(data.startTime, data.endTime, now) : 'undated';
  const gameIds = data?.gameIds ?? [];
  const wantGames = showsGames(phase) && gameIds.length > 0;

  /* The page in its art's Material 3 colours (the Apple pass, 2026-11-05),
     as a game's, a studio's and a collection's are. */
  const accent = useGameAccent(data?.bannerUrl ?? null, null);
  const page = data?.bannerUrl && accent.tonal ? accent.page : theme.background;

  const games = useQuery({
    queryKey: ['event-games', eventId],
    queryFn: ({ signal }) => getEventGames(gameIds, signal),
    enabled: wantGames,
    staleTime: 30 * 60_000,
  });

  if (event.isLoading) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back variant="art" />}>
        <LoadingState />
      </Screen>
    );
  }

  if (event.isLoadingError) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back variant="art" />}>
        <ErrorState error={event.error} onRetry={() => event.refetch()} />
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back variant="art" />}>
        <EmptyState icon="search" title="Event not found" />
      </Screen>
    );
  }

  const gameEvent: GameEvent = {
    id: String(data.id),
    name: data.name,
    description: data.description,
    startsAt: data.startTime !== null ? new Date(data.startTime * 1000).toISOString() : null,
    liveStreamUrl: data.liveStreamUrl,
    isUpcoming: phase === 'upcoming',
  };
  const shown = wantGames ? (games.data ?? []) : [];

  function share() {
    const url = data!.liveStreamUrl ?? data!.links[0]?.url;
    void Share.share({ message: url ? `${data!.name} — ${url}` : data!.name }).catch(() => {
      // Dismissed, or the platform has no share sheet; nothing to say.
    });
  }

  const head = (
    <View style={styles.head}>
      {/* Cancels the list's side padding so the art reaches both edges. */}
      <View style={styles.bleed}>
        <EventBanner event={data} width={width} background={page} />
      </View>

      <View style={styles.title}>
        <Text variant="display" accessibilityRole="header">
          {data.name}
        </Text>
        <SmallInfo event={data} phase={phase} />
        <Figures event={data} phase={phase} now={now} gameEvent={gameEvent} />
      </View>

      <Watching
        event={gameEvent}
        phase={phase}
        onOpenProfile={(profileId) =>
          router.push({ pathname: '/profile/[id]', params: { id: profileId } })
        }
      />

      {data.description ? (
        <InfoCard title="About">
          <ExpandableText lines={ABOUT_LINES} subject="the description">
            {data.description}
          </ExpandableText>
        </InfoCard>
      ) : null}

      {/* Where it lives, as square tiles — Apple TV's "Watch on" (the Apple
          pass, 2026-11-05); they were a wrapping row of grey pills. */}
      {data.links.length > 0 && (
        <View style={styles.links}>
          {data.links.map((link) => (
            <PressableScale
              key={link.url}
              accessibilityRole="link"
              accessibilityLabel={`Open ${data.name} on ${link.label}`}
              onPress={() => open(link.url)}
              scaleTo={0.95}
              style={StyleSheet.flatten([
                styles.linkTile,
                { backgroundColor: withAlpha(theme.text, 0.07) },
              ])}>
              <Ionicons name={linkGlyph(link.label)} size={26} color={theme.text} />
              <Text variant="caption" numberOfLines={2} style={styles.linkLabel}>
                {link.label}
              </Text>
            </PressableScale>
          ))}
        </View>
      )}

      {wantGames && (
        <View style={styles.gamesHead}>
          <Text variant="h4" accessibilityRole="header">
            Games shown
          </Text>
          <Text variant="bodySmall" color="textMuted">
            {gameIds.length}
          </Text>
        </View>
      )}
    </View>
  );

  /* Whether the foot bar has an action — the same rule `<FootBar>` draws by. */
  const hasFoot =
    phase === 'upcoming' || ((phase === 'live' || phase === 'over') && !!data.liveStreamUrl);

  return (
    /* The banner runs under the disc, so no `insetHeader`. The disc leaves
       with it; the bar that follows carries the event's name, once the banner
       and the name under it have gone. */
    <AccentProvider artwork={data.bannerUrl} genres={null}>
      <Screen
        edges={['bottom']}
        background={page}
        topBar={
          <FrostedTopBar
            back
            title={data.name}
            header={Math.round(width * BANNER_RATIO) + NAME_BLOCK}
            right={
              <>
                {pingTo && (
                  <TopBarDisc
                    icon={PING_GLYPH}
                    label={`Ping ${data.name} to someone`}
                    onPress={() =>
                      pingTo({
                        kind: 'event',
                        targetId: String(data.id),
                        title: data.name,
                        subtitle: data.startTime
                          ? new Date(data.startTime * 1000).toLocaleDateString(undefined, {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })
                          : null,
                        imageUrl: data.thumbnailUrl ?? data.bannerUrl,
                      })
                    }
                  />
                )}
                <TopBarDisc icon="share-outline" label={`Share ${data.name}`} onPress={share} />
              </>
            }
          />
        }>
        <PageFlatList
          data={shown}
          numColumns={PORTRAIT_COLUMNS}
          keyExtractor={(game) => game.id}
          {...CoverGridWindow}
          columnWrapperStyle={styles.column}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: hasFoot ? FOOT_ROOM : Spacing.x48 },
          ]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={head}
          renderItem={({ item }) => (
            <GameGridTile
              id={item.id}
              title={item.title}
              coverUrl={item.coverUrl}
              heroUrl={item.heroUrl}
              edition={item.edition}
              steamAppId={item.steamAppId}
              caption={item.releaseYear}
              width={tileWidth}
            />
          )}
          ListEmptyComponent={
            !wantGames ? null : games.isLoadingError ? (
              <ErrorState error={games.error} onRetry={() => games.refetch()} />
            ) : (
              <LoadingState />
            )
          }
        />
        {hasFoot ? <FootBar event={gameEvent} phase={phase} background={page} /> : null}
      </Screen>
    </AccentProvider>
  );
}

/**
 * The event's key art, edge to edge, its foot dissolving into the page so
 * the name under it stands on the page and not on a hard edge — or, for the
 * few with none, a panel with its initial.
 */
function EventBanner({
  event,
  width,
  background,
}: {
  event: EventDetail;
  width: number;
  /** The page's colour, which the art's foot dissolves into. */
  background: string;
}) {
  const theme = useTheme();
  const height = Math.round(width * BANNER_RATIO);

  if (!event.bannerUrl) {
    return (
      <View style={[styles.bannerEmpty, { width, height, backgroundColor: theme.surfaceElevated }]}>
        <Text variant="display" color="textMuted">
          {event.name.trim().charAt(0).toUpperCase()}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ width, height }}>
      <Image
        source={{ uri: event.bannerUrl }}
        style={{ width, height, backgroundColor: theme.surfaceElevated }}
        cachePolicy="memory-disk"
        contentFit="cover"
        transition={220}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Key art for ${event.name}`}
        accessibilityIgnoresInvertColors
      />
      <LinearGradient
        pointerEvents="none"
        colors={[withAlpha(background, 0), background]}
        style={[styles.bannerFade, { height: height * 0.4 }]}
      />
    </View>
  );
}

/** Where it streams, and a tag for where it is in its life. */
function SmallInfo({ event, phase }: { event: EventDetail; phase: EventPhase }) {
  const theme = useTheme();
  const networks = event.links.map((link) => link.label).filter((label) => label !== 'Link');
  const where =
    networks.length > 0
      ? `Streaming on ${networks.slice(0, 3).join(' · ')}`
      : event.liveStreamUrl
        ? 'Streaming online'
        : null;

  const tag =
    phase === 'live'
      ? { icon: 'radio' as const, label: 'Live now', color: theme.danger }
      : phase === 'upcoming'
        ? { icon: 'time-outline' as const, label: 'Upcoming', color: theme.textSecondary }
        : phase === 'over'
          ? { icon: 'checkmark-done' as const, label: 'Ended', color: theme.textMuted }
          : null;

  return (
    <View style={styles.smallInfo}>
      {where ? (
        <Text variant="body" color="textSecondary">
          {where}
        </Text>
      ) : null}
      {/* Apple TV's capsule: LIVE filled red, the rest the control grey. */}
      {tag ? (
        <View
          style={[
            styles.tag,
            { backgroundColor: phase === 'live' ? theme.danger : theme.controlFill },
          ]}>
          <Ionicons name={tag.icon} size={12} color={phase === 'live' ? theme.text : tag.color} />
          <Text variant="badge" style={{ color: phase === 'live' ? theme.text : tag.color }}>
            {tag.label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** The three in bigger type: the date, the start, and how many are watching. */
function Figures({
  event,
  phase,
  now,
  gameEvent,
}: {
  event: EventDetail;
  phase: EventPhase;
  now: number;
  gameEvent: GameEvent;
}) {
  const { total } = useEventAttendance(gameEvent);

  if (event.startTime === null) {
    return (
      <Text variant="body" color="textSecondary">
        No date announced yet.
      </Text>
    );
  }

  const cells = startCells(event.startTime);
  const ran = runningTime(event.startTime, event.endTime);
  const timeLabel =
    phase === 'upcoming'
      ? countdown(event.startTime, now)
      : phase === 'over' && ran
        ? `ran ${ran}`
        : 'started';
  const watchingLabel = phase === 'over' ? 'watched' : 'watching';

  /* One line — Apple TV's facts line (the Apple pass, 2026-11-05); it was a
     strip of three figures. */
  return (
    <Text
      variant="body"
      color="textSecondary"
      accessibilityLabel={`${cells.weekday} ${cells.date}, ${phase === 'upcoming' ? 'starts' : 'started'} at ${cells.time} your time, ${timeLabel}. ${total.toLocaleString()} ${watchingLabel}.`}>
      {[
        `${cells.weekday} ${cells.date}`,
        `${cells.time} · ${timeLabel}`,
        total > 0 ? `${total.toLocaleString()} ${watchingLabel}` : null,
      ]
        .filter(Boolean)
        .join(' · ')}
    </Text>
  );
}

/**
 * The faces of the people watching, friends first, and the line that says who
 * — "You and 12 others". The row opens the whole list.
 */
function Watching({
  event,
  phase,
  onOpenProfile,
}: {
  event: GameEvent;
  phase: EventPhase;
  onOpenProfile: (profileId: string) => void;
}) {
  const theme = useTheme();
  const userId = useAuth((state) => state.session?.user.id ?? null);
  const { eventId, mine, total, inPerson, rsvp } = useEventAttendance(event);
  const [listOpen, setListOpen] = useState(false);

  const watchers = useQuery({
    queryKey: ['event-attendees', eventId, userId],
    queryFn: () => getEventWatchers(eventId, userId),
    staleTime: 60_000,
  });
  const people = watchers.data ?? [];
  const over = phase === 'over';
  const others = total - (mine ? 1 : 0);

  const line =
    total === 0
      ? over
        ? 'Nobody marked this one.'
        : "Nobody's said they're watching yet."
      : mine
        ? others === 0
          ? `Just you${over ? '' : ', so far'}.`
          : `You and ${others.toLocaleString()} ${others === 1 ? 'other' : 'others'}`
        : `${total.toLocaleString()} ${total === 1 ? 'person' : 'people'}`;
  const there = inPerson > 0 ? ` · ${inPerson.toLocaleString()} there in person` : '';

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text variant="h4" accessibilityRole="header">
          {over ? 'Watched' : 'Watching'}
        </Text>
        <Text variant="bodySmall" color="textMuted">
          {line + there}
        </Text>
      </View>

      {people.length > 0 ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`See everyone ${over ? 'who watched' : 'watching'}`}
          onPress={() => setListOpen(true)}
          scaleTo={0.99}
          style={styles.faces}>
          {people.slice(0, FACES).map((entry) => (
            <Avatar
              key={entry.profile.id}
              uri={entry.profile.avatar_url}
              name={entry.profile.display_name ?? entry.profile.username}
              size={FACE_SIZE}
            />
          ))}
          {people.length > FACES ? (
            <View style={[styles.more, { backgroundColor: theme.surfaceElevated }]}>
              <Text variant="itemTitle" color="textSecondary">
                {`+${people.length - FACES}`}
              </Text>
            </View>
          ) : null}
        </PressableScale>
      ) : null}

      {/* Watching in person is the quieter of the two ways to attend, and a
          showcase is nearly always watched on a screen: a line, not a button. */}
      {mine && phase === 'upcoming' ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityState={{ selected: mine.mode === 'in_person' }}
          onPress={() => rsvp.mutate(mine.mode === 'in_person' ? 'livestream' : 'in_person')}
          scaleTo={0.98}
          style={styles.inPerson}>
          <Ionicons
            name={mine.mode === 'in_person' ? 'location' : 'location-outline'}
            size={14}
            color={theme.primaryText}
          />
          <Text variant="bodySmall" color="primaryText">
            {mine.mode === 'in_person' ? "You're going in person" : 'Going in person?'}
          </Text>
        </PressableScale>
      ) : null}

      <SlideUpSheet
        visible={listOpen}
        onClose={() => setListOpen(false)}
        title={over ? 'Watched' : 'Watching'}>
        <View style={styles.sheetList}>
          {people.map((entry) => (
            <WatcherRow
              key={entry.profile.id}
              entry={entry}
              onPress={() => {
                setListOpen(false);
                onOpenProfile(entry.profile.id);
              }}
            />
          ))}
        </View>
      </SlideUpSheet>
    </View>
  );
}

function WatcherRow({ entry, onPress }: { entry: EventWatcher; onPress: () => void }) {
  const name = entry.profile.display_name ?? entry.profile.username;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${name}${entry.friend ? ', you follow them' : ''}`}
      onPress={onPress}
      scaleTo={0.98}
      style={styles.watcher}>
      <Avatar uri={entry.profile.avatar_url} name={name} size={FACE_SIZE} />
      <View style={styles.watcherText}>
        <Text variant="itemTitle" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="bodySmall" color="textMuted" numberOfLines={1}>
          {`@${entry.profile.username}${entry.mode === 'in_person' ? ' · in person' : ''}`}
        </Text>
      </View>
      {entry.friend ? (
        <Text variant="caption" color="textSecondary">
          Following
        </Text>
      ) : null}
    </PressableScale>
  );
}

/**
 * The one action, pinned to the foot with the page fading under it — the
 * reference's "View Results". Null when the moment has none: an event that is
 * over with no stream to replay, or one with no date.
 */
function FootBar({
  event,
  phase,
  background,
}: {
  event: GameEvent;
  phase: EventPhase;
  background: string;
}) {
  const { mine, hasReminder, rsvp, reminder, notice } = useEventAttendance(event);
  const stream = event.liveStreamUrl;

  let action: ReactNode = null;
  if (phase === 'upcoming') {
    action = (
      <View style={styles.footRow}>
        <View style={styles.flex}>
          <Button
            title={mine ? "You're watching" : "I'll be watching"}
            icon={mine ? 'checkmark' : 'eye-outline'}
            variant={mine ? 'secondary' : 'primary'}
            fullWidth
            loading={rsvp.isPending}
            accessibilityHint={mine ? 'Says you are no longer watching' : undefined}
            onPress={() => rsvp.mutate(mine ? null : 'livestream')}
          />
        </View>
        {mine && remindersAvailable ? (
          <IconButton
            icon={hasReminder ? 'notifications' : 'notifications-outline'}
            accessibilityLabel={
              hasReminder ? 'Turn the reminder off' : 'Remind me before it starts'
            }
            active={hasReminder}
            onPress={() => reminder.mutate()}
          />
        ) : null}
      </View>
    );
  } else if (phase === 'live' && stream) {
    action = (
      <Button
        title="Watch live"
        icon="play"
        variant="primary"
        fullWidth
        onPress={() => open(stream)}
      />
    );
  } else if (phase === 'over' && stream) {
    action = (
      <Button
        title="Watch the replay"
        icon="play"
        variant="secondary"
        fullWidth
        onPress={() => open(stream)}
      />
    );
  }

  if (!action) return null;

  return (
    <View style={styles.foot} pointerEvents="box-none">
      <LinearGradient
        pointerEvents="none"
        colors={[withAlpha(background, 0), background]}
        style={styles.footFade}
      />
      <View style={[styles.footBody, { backgroundColor: background }]}>
        {action}
        {notice ? (
          <Text variant="caption" color="textMuted" style={styles.notice}>
            {notice}
          </Text>
        ) : null}
        {rsvp.error || reminder.error ? (
          <Text variant="caption" color="danger" style={styles.notice}>
            {(rsvp.error ?? reminder.error) instanceof Error
              ? (rsvp.error ?? reminder.error)!.message
              : 'Could not update.'}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: Spacing.x16, gap: Spacing.x16 },
  column: { gap: GRID_GAP },
  head: { gap: Spacing.x24 },
  bleed: { marginHorizontal: -Spacing.x16, marginBottom: -Spacing.x12 },
  title: { gap: Spacing.x8 },
  smallInfo: { gap: Spacing.x4 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.x4,
    height: 24,
    paddingHorizontal: Spacing.x8,
    borderRadius: 12,
  },
  section: { gap: Spacing.x12 },
  sectionHead: { gap: 2 },
  faces: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.x8, alignSelf: 'flex-start' },
  more: {
    width: FACE_SIZE,
    height: FACE_SIZE,
    borderRadius: FACE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inPerson: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x4 + 2,
    minHeight: TapTarget,
    alignSelf: 'flex-start',
  },
  sheetList: { gap: Spacing.x4, paddingBottom: Spacing.x24 },
  watcher: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    minHeight: TapTarget + 8,
  },
  watcherText: { flex: 1, gap: 2 },
  /* Wrapped: an event has four or five places it lives, and their names are
     different lengths. `rowGap` clears the small buttons' touch slop. */
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.x12 },
  linkTile: {
    width: LINK_TILE,
    height: LINK_TILE,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x8,
    padding: Spacing.x8,
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  linkLabel: { textAlign: 'center' },
  gamesHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingTop: Spacing.x8,
  },
  bannerEmpty: { alignItems: 'center', justifyContent: 'center' },
  bannerFade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  foot: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  footFade: { height: Spacing.x24 },
  footBody: { paddingHorizontal: Spacing.x16, paddingBottom: Spacing.x12, gap: Spacing.x8 },
  footRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  notice: { textAlign: 'center' },
});
