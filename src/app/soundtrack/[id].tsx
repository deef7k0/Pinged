import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { GameDisc } from '@/components/game-disc';
import { PlayerBar } from '@/components/player/player-bar';
import { SoundCloudMark, openOnSoundCloud } from '@/components/player/soundcloud-mark';
import { SoundtrackUnavailable } from '@/components/soundtrack-section';
import { Button } from '@/components/ui/button';
import { PING_GLYPH, usePingTo } from '@/components/pings/use-ping-to';
import { FrostedTopBar, TopBarDisc } from '@/components/ui/frosted-top-bar';
import { PageFlatList } from '@/components/ui/page-scroll';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ErrorState, Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { ArtRowWindow } from '@/constants/list-window';
import { Radius, Spacing } from '@/constants/theme';
import { AccentProvider, useAccent, DarkRoom } from '@/hooks/use-accent';
import { useGameSoundtrack } from '@/hooks/use-game-soundtrack';
import { useDiscRoom } from '@/hooks/use-header-height';
import { useTheme } from '@/hooks/use-theme';
import { getStarredSong, starSong, unstarSong } from '@/lib/api';
import { getGameById } from '@/lib/games';
import { recallGame } from '@/lib/games/seen-games';
import type { GameSoundtrack, SoundCloudTrack } from '@/lib/soundcloud/types';
import { formatDuration, formatRunningTime } from '@/lib/soundtrack-pick';
import { useAuth } from '@/store/auth';
import { firstPlayable, shuffled } from '@/lib/player-queue';
import { player, usePlayer, type PlayerPhase, type PlayerQueue } from '@/store/player';
import { Loader } from '@/components/ui/loader';
import { toast } from '@/lib/toast';

/** The disc at the head of the list. */
const DISC = 196;

/** The name and the line under the disc, and the gap over them, near enough. */
const HEADING_BLOCK = 72;
/** The first column of a row: a track's number, or what it is doing. */
const LEAD = 26;
/** The star and the link at the end of a row — glyphs at a finger's width. */
const ROW_KEY = 36;

/**
 * A game's soundtrack, from SoundCloud, in the app's own player.
 *
 * The route's `id` is the **game's** id. It was an Apple Music album's, and the
 * screen was one of several albums a title search turned up, each with
 * thirty-second previews. Now there is one soundtrack per game — whichever
 * upload the matcher judged to be it (`supabase/functions/_shared/
 * soundcloud-match.ts`) — played whole.
 *
 * ## What is on it
 *
 * The game's disc, turning while its music plays; whose upload this is, with
 * SoundCloud's logo and a link to the playlist there; every track with its
 * uploader, its length, a star and a link to its own page; and the player,
 * docked at the foot (`<PlayerBar>`).
 *
 * The uploader's name, the logo and the two links are not decoration. They
 * are the three things SoundCloud's API terms require beside anything of
 * theirs that is shown or played; taking one off takes the app out of them.
 *
 * ## Leaving
 *
 * Music stops when this screen is left, unless **Keep playing** is on, in
 * which case it carries on under the mini player. That is `player.release`
 * below, and it stops only a queue this screen started: a song Surprise Me
 * began is Surprise Me's to stop.
 *
 * ## It runs on the game's colour
 *
 * One game, so `<AccentProvider>`, like its page, its log form and its review.
 */
function SoundtrackScreen() {
  const params = useLocalSearchParams<{ id: string; title?: string; play?: string }>();
  const id = params.id;

  /*
   * The game page's own query, under its own key, so a soundtrack opened from
   * that page has the game — its name, who made it, its cover — without a
   * request. Opened from the mini player an hour later it is one request, and
   * the name passed along with the route stands in until it answers.
   */
  const game = useQuery({
    queryKey: ['game', id],
    queryFn: ({ signal }) => getGameById(id!, signal),
    enabled: !!id,
    staleTime: 30 * 60_000,
    initialData: () => recallGame(id)?.value,
    initialDataUpdatedAt: () => recallGame(id)?.at,
  });

  const title = game.data?.title ?? (params.title || null);

  return (
    <AccentProvider artwork={game.data?.heroUrl ?? game.data?.coverUrl} genres={game.data?.genres}>
      <Soundtrack
        gameId={id}
        title={title}
        developer={game.data?.developer ?? null}
        coverUrl={game.data?.coverUrl ?? null}
        heroUrl={game.data?.heroUrl ?? null}
        /* The developer decides whose upload counts as official, so the
           soundtrack is not asked for until the game has said who that is —
           or has failed to, in which case the name alone has to do. */
        playAt={params.play ? Number(params.play) : null}
        gameSettled={!game.isPending}
        gameError={game.isLoadingError && !title ? game.error : null}
        onRetryGame={() => game.refetch()}
      />
    </AccentProvider>
  );
}

type SoundtrackProps = {
  gameId: string;
  title: string | null;
  developer: string | null;
  coverUrl: string | null;
  heroUrl: string | null;
  /** A track pressed on the game page's Soundtrack tab: played once it is here. */
  playAt: number | null;
  gameSettled: boolean;
  gameError: unknown;
  onRetryGame: () => void;
};

function Soundtrack({
  gameId,
  title,
  developer,
  coverUrl,
  heroUrl,
  playAt,
  gameSettled,
  gameError,
  onRetryGame,
}: SoundtrackProps) {
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id);

  const { query, lookAgain, isLookingAgain, lookAgainFailed } = useGameSoundtrack({
    gameId,
    title,
    developer,
    enabled: gameSettled,
  });

  const owner = `soundtrack:${gameId}`;
  const pingTo = usePingTo();
  useEffect(() => () => player.release(owner, { honourKeepPlaying: true }), [owner]);

  const answer = query.data;
  const soundtrack =
    answer?.status === 'ok' && answer.soundtrack.tracks.length > 0 ? answer.soundtrack : null;

  const queue = useMemo<PlayerQueue | null>(
    () => (soundtrack ? { owner, gameId, gameTitle: title, tracks: soundtrack.tracks } : null),
    [soundtrack, owner, gameId, title]
  );

  /* The track somebody pressed on the game page, once, when the queue is
     here — a press, so it is the one stream this spends. */
  const played = useRef(false);
  useEffect(() => {
    if (played.current || playAt === null || !queue) return;
    played.current = true;
    const track = queue.tracks[playAt];
    if (track && track.access !== 'blocked') player.play(queue, playAt);
  }, [playAt, queue]);

  const starred = useQuery({
    queryKey: ['starred-song', userId],
    queryFn: () => getStarredSong(userId!),
    enabled: !!userId,
  });
  const starredUrn = starred.data?.track_id ?? null;

  /*
   * One mutation for both directions: starring the starred track clears it.
   * With a limit of one there has to be a way back to none, and a separate
   * "unstar" would be a second control for the same star.
   *
   * Only the track's id is written, with the game. Its title is SoundCloud's
   * to tell, each time a profile is shown.
   */
  const star = useMutation({
    mutationFn: async (track: SoundCloudTrack) => {
      if (!userId) throw new Error('You must be signed in.');
      if (starredUrn === track.urn) return unstarSong(userId);
      return starSong(userId, track.urn, { gameId, gameTitle: title });
    },
    onSuccess: () => {
      toast.success('Song saved to your profile');
      queryClient.invalidateQueries({ queryKey: ['starred-song', userId] });
    },
  });

  /* Handed to every row once. A handler made per row would defeat the rows'
     memo, and starting a track would re-draw the whole soundtrack. */
  const onPlay = useCallback(
    (index: number) => {
      if (queue) player.play(queue, index);
    },
    [queue]
  );
  const starTrack = star.mutate;
  const onStar = useCallback((track: SoundCloudTrack) => starTrack(track), [starTrack]);

  if (gameError) {
    return (
      <Shell>
        <ErrorState error={gameError} onRetry={onRetryGame} />
      </Shell>
    );
  }

  if (!title || query.isPending) {
    return (
      <Shell scrolls>
        <LoadingSoundtrack />
      </Shell>
    );
  }

  if (query.isLoadingError) {
    return (
      <Shell>
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </Shell>
    );
  }

  if (!soundtrack || !queue) {
    return (
      <Shell>
        <SoundtrackUnavailable
          status={answer?.status ?? 'none'}
          title={title}
          busy={isLookingAgain || query.isRefetching}
          failed={lookAgainFailed}
          onLookAgain={lookAgain}
          onRetry={() => query.refetch()}
        />
      </Shell>
    );
  }

  return (
    <Shell
      docked={<PlayerBar queue={queue} />}
      scrolls
      title={title}
      onPing={
        pingTo && title
          ? () =>
              pingTo({
                kind: 'soundtrack',
                targetId: gameId,
                /* The game's name — never SoundCloud's words, which may not
                   be stored (§ Soundtracks). */
                title: `${title} — the soundtrack`,
                subtitle: developer,
                imageUrl: coverUrl,
              })
          : undefined
      }>
      <TrackList
        queue={queue}
        soundtrack={soundtrack}
        title={title}
        coverUrl={coverUrl}
        heroUrl={heroUrl}
        starredUrn={starredUrn}
        canStar={!!userId}
        starBusy={star.isPending}
        onPlay={onPlay}
        onStar={onStar}
      />
    </Shell>
  );
}

/**
 * The page every state of this screen is drawn on.
 *
 * No bottom edge, and no room for the mini player: the player docked here
 * runs to the foot of the display and pads the system's inset itself, and the
 * mini player is not drawn over this route. A state that does not scroll is
 * centred under the back disc; the list pads its own head, so its disc can sit
 * where a page's art does.
 */
function Shell({
  children,
  docked,
  scrolls = false,
  title,
  onPing,
}: {
  children: ReactNode;
  docked?: ReactNode;
  scrolls?: boolean;
  /** The game's name, for the bar that follows the disc off the page. */
  title?: string | null;
  /** Ping this soundtrack to somebody (0046). */
  onPing?: () => void;
}) {
  const accent = useAccent();
  const discRoom = useDiscRoom();

  return (
    <Screen
      edges={docked ? [] : ['bottom']}
      insetHeader={!scrolls}
      background={accent.page}
      miniPlayer={false}
      /* Always the artwork kind: this page's subject is the disc, in every
         state, and its back control is the glass disc in every state. The bar
         comes in with the game's name once the disc and its heading have gone
         under where it sits. */
      topBar={
        <FrostedTopBar
          back
          variant="art"
          title={title ?? undefined}
          header={discRoom + Spacing.x8 + DISC + HEADING_BLOCK}
          right={
            onPing ? (
              <TopBarDisc
                icon={PING_GLYPH}
                label="Ping this soundtrack to someone"
                onPress={onPing}
              />
            ) : undefined
          }
        />
      }>
      <View style={styles.flex}>{children}</View>
      {docked}
    </Screen>
  );
}

type TrackListProps = {
  queue: PlayerQueue;
  soundtrack: GameSoundtrack;
  title: string;
  coverUrl: string | null;
  heroUrl: string | null;
  starredUrn: string | null;
  canStar: boolean;
  starBusy: boolean;
  onPlay: (index: number) => void;
  onStar: (track: SoundCloudTrack) => void;
};

function TrackList({
  queue,
  soundtrack,
  title,
  coverUrl,
  heroUrl,
  starredUrn,
  canStar,
  starBusy,
  onPlay,
  onStar,
}: TrackListProps) {
  const headerHeight = useDiscRoom();
  const tracks = soundtrack.tracks;

  /* What the player holds, by id: a row lights up for a song whoever started
     it, so one Surprise Me began shows as playing in its own soundtrack. */
  const currentUrn = usePlayer((state) => state.queue?.tracks[state.index]?.urn ?? null);
  const phase = usePlayer((state) => state.phase);

  const urns = useMemo(() => new Set(tracks.map((track) => track.urn)), [tracks]);
  const spinning = phase === 'playing' && !!currentUrn && urns.has(currentUrn);

  return (
    <PageFlatList
      data={tracks}
      keyExtractor={(track) => track.urn}
      /* Only the row that is playing changes with these; the rest keep their props. */
      extraData={`${currentUrn}:${phase}:${starredUrn}:${starBusy}`}
      contentContainerStyle={[styles.content, { paddingTop: headerHeight + Spacing.x8 }]}
      showsVerticalScrollIndicator={false}
      {...ArtRowWindow}
      ListHeaderComponent={
        <SoundtrackHeader
          queue={queue}
          soundtrack={soundtrack}
          title={title}
          coverUrl={coverUrl}
          heroUrl={heroUrl}
          spinning={spinning}
        />
      }
      ListFooterComponent={<SoundtrackFooter soundtrack={soundtrack} />}
      renderItem={({ item, index }) => (
        <TrackRow
          track={item}
          index={index}
          phase={item.urn === currentUrn ? phase : null}
          starred={item.urn === starredUrn}
          canStar={canStar}
          starBusy={starBusy}
          onPlay={onPlay}
          onStar={onStar}
        />
      )}
    />
  );
}

type SoundtrackHeaderProps = {
  queue: PlayerQueue;
  soundtrack: GameSoundtrack;
  title: string;
  coverUrl: string | null;
  heroUrl: string | null;
  spinning: boolean;
};

/**
 * The disc, the game's name, and whose music this is.
 *
 * Over the disc this screen has no bar — only the glass disc — so the heading
 * is here: the game, then "Soundtrack" with what it holds. (The bar that comes
 * in once this has scrolled away says the game's name again.) Under it the credit — the one place the
 * upload is named as a whole, and where SoundCloud's own mark and the link to
 * the playlist are.
 */
function SoundtrackHeader({
  queue,
  soundtrack,
  title,
  coverUrl,
  heroUrl,
  spinning,
}: SoundtrackHeaderProps) {
  const playlist = soundtrack.source === 'playlist' ? soundtrack.playlist : null;
  const first = firstPlayable(queue.tracks);

  return (
    <View style={styles.header}>
      {/* The app's disc, as it is: the protected component, used and not edited. */}
      <GameDisc
        coverUrl={coverUrl}
        heroUrl={heroUrl}
        size={DISC}
        spinning={spinning}
        revolutionMs={9000}
      />

      <View style={styles.heading}>
        <Text variant="h3" numberOfLines={2} style={styles.centred} accessibilityRole="header">
          {title}
        </Text>
        <Text variant="bodySmall" color="textMuted" style={styles.centred}>
          {playlist ? `Soundtrack · ${playlist.uploader.name}` : 'Soundtrack'}
        </Text>
      </View>

      {/* Apple Music's two capsules under an album's name: Play from the top,
          Shuffle in an order of its own (the Apple pass, 2026-11-05). A
          stream is still asked for only when one of them is pressed. */}
      {first !== -1 && (
        <View style={styles.capsules}>
          <View style={styles.capsule}>
            <Button
              title="Play"
              icon="play"
              variant="secondary"
              onPress={() => player.play(queue, first)}
            />
          </View>
          <View style={styles.capsule}>
            <Button
              title="Shuffle"
              icon="shuffle"
              variant="secondary"
              onPress={() => player.play({ ...queue, tracks: shuffled(queue.tracks) }, 0)}
            />
          </View>
        </View>
      )}
    </View>
  );
}

/**
 * Under the last track, as an album page ends: how many tracks and how long,
 * then whose upload it is — the credit — with SoundCloud's mark and the link.
 */
function SoundtrackFooter({ soundtrack }: { soundtrack: GameSoundtrack }) {
  const count = soundtrack.tracks.length;
  const length = formatRunningTime(soundtrack.tracks.map((track) => track.durationMs));
  const playlist = soundtrack.source === 'playlist' ? soundtrack.playlist : null;

  return (
    <View style={styles.footer}>
      <Text variant="bodySmall" color="textSecondary">
        {[`${count} ${count === 1 ? 'track' : 'tracks'}`, length].filter(Boolean).join(', ')}
      </Text>
      <Text variant="bodySmall" color="textMuted">
        {playlist
          ? `“${playlist.title}”, a playlist by ${playlist.uploader.name}`
          : 'No single upload had the whole soundtrack. These are tracks that name the game, most played first.'}
      </Text>
      <View style={styles.footerMark}>
        <SoundCloudMark
          variant="poweredBy"
          url={playlist?.permalinkUrl}
          label="Open this playlist on SoundCloud"
        />
        {playlist?.permalinkUrl && (
          <Button
            title="Open on SoundCloud"
            variant="ghost"
            size="small"
            icon="open-outline"
            onPress={() => openOnSoundCloud(playlist.permalinkUrl)}
          />
        )}
      </View>
    </View>
  );
}

type TrackRowProps = {
  track: SoundCloudTrack;
  index: number;
  /** What the player is doing with this track, or null when it holds another. */
  phase: PlayerPhase | null;
  starred: boolean;
  canStar: boolean;
  starBusy: boolean;
  onPlay: (index: number) => void;
  onStar: (track: SoundCloudTrack) => void;
};

/**
 * One track: what it is doing, its name and uploader, its length, the star,
 * and the way to its page on SoundCloud.
 *
 * A track SoundCloud does not let this app play stays in the list — the
 * soundtrack has it, and its page can still be opened — dimmed, saying so.
 */
const TrackRow = memo(function TrackRow({
  track,
  index,
  phase,
  starred,
  canStar,
  starBusy,
  onPlay,
  onStar,
}: TrackRowProps) {
  const theme = useTheme();
  const accent = useAccent();

  const blocked = track.access === 'blocked';
  const current = phase !== null;
  const playing = phase === 'playing';

  const note = blocked ? 'Not available here' : track.access === 'preview' ? 'Preview' : null;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={
        blocked
          ? `${track.title} by ${track.uploader.name}. SoundCloud does not let it play here.`
          : `${playing ? 'Pause' : 'Play'} ${track.title} by ${track.uploader.name}`
      }
      accessibilityState={{ disabled: blocked, selected: current }}
      disabled={blocked}
      onPress={() => onPlay(index)}
      pressedColor={theme.pressed}
      scaleTo={0.99}
      style={StyleSheet.flatten([styles.row, current && { backgroundColor: accent.wash }])}>
      <View style={[styles.lead, blocked && styles.dimmed]}>
        {phase === 'loading' ? (
          <Loader size="small" color={accent.onSurface} />
        ) : current ? (
          <Ionicons name={playing ? 'pause' : 'play'} size={16} color={accent.onSurface} />
        ) : (
          <Text variant="bodySmall" color="textMuted">
            {index + 1}
          </Text>
        )}
      </View>

      <View style={[styles.rowWords, blocked && styles.dimmed]}>
        <Text
          variant="itemTitle"
          numberOfLines={1}
          style={current ? { color: accent.onSurface } : undefined}>
          {track.title}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {[track.uploader.name, note].filter(Boolean).join(' · ')}
        </Text>
      </View>

      <Text variant="caption" color="textMuted" style={blocked ? styles.dimmed : undefined}>
        {formatDuration(track.durationMs)}
      </Text>

      {/* Only for somebody signed in — there is no profile to pin it to
          otherwise — and never for a track that cannot be played. */}
      {canStar && !blocked && (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={
            starred ? `Unstar ${track.title}` : `Star ${track.title} on your profile`
          }
          accessibilityState={{ selected: starred, disabled: starBusy }}
          disabled={starBusy}
          onPress={() => onStar(track)}
          scaleTo={0.85}
          style={styles.rowKey}>
          <Ionicons
            name={starred ? 'star' : 'star-outline'}
            size={18}
            color={starred ? theme.accent : theme.textMuted}
          />
        </PressableScale>
      )}

      {track.permalinkUrl && (
        <PressableScale
          accessibilityRole="link"
          accessibilityLabel={`Open ${track.title} on SoundCloud`}
          onPress={() => openOnSoundCloud(track.permalinkUrl)}
          scaleTo={0.85}
          style={styles.rowKey}>
          <Ionicons name="open-outline" size={17} color={theme.textMuted} />
        </PressableScale>
      )}
    </PressableScale>
  );
});

/** The list's own shape, while it is being fetched: the disc, two lines, rows. */
function LoadingSoundtrack() {
  const headerHeight = useDiscRoom();

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading the soundtrack"
      style={[styles.content, { paddingTop: headerHeight + Spacing.x8 }]}>
      <View style={styles.header}>
        <Skeleton width={DISC} height={DISC} radius={DISC / 2} />
        <View style={styles.heading}>
          <Skeleton width={180} height={18} radius={Radius.sm} />
          <Skeleton width={130} height={11} radius={Radius.sm} />
        </View>
      </View>

      {[72, 54, 64, 48, 68, 58].map((width, row) => (
        <View key={row} style={styles.row}>
          <View style={styles.lead}>
            <Skeleton width={12} height={11} radius={Radius.sm} />
          </View>
          <View style={styles.rowWords}>
            <Skeleton width={`${width}%`} height={13} radius={Radius.sm} />
            <Skeleton width="34%" height={10} radius={Radius.sm} />
          </View>
          <Skeleton width={28} height={10} radius={Radius.sm} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: Spacing.x16, paddingBottom: Spacing.x24, gap: Spacing.x4 },

  header: { alignItems: 'center', gap: Spacing.x16, marginBottom: Spacing.x20 },
  heading: { alignItems: 'center', gap: Spacing.x4 },
  capsules: { flexDirection: 'row', gap: Spacing.x12, alignSelf: 'stretch' },
  capsule: { flex: 1 },
  footer: { gap: Spacing.x4, paddingTop: Spacing.x24, paddingHorizontal: Spacing.x8 },
  footerMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    marginTop: Spacing.x12,
  },
  centred: { textAlign: 'center' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    minHeight: 56,
    paddingVertical: Spacing.x8,
    paddingLeft: Spacing.x8,
    paddingRight: Spacing.x4,
    borderRadius: Radius.lg,
  },
  lead: { width: LEAD, alignItems: 'center' },
  rowWords: { flex: 1, gap: 2 },
  rowKey: {
    width: ROW_KEY,
    height: ROW_KEY,
    borderRadius: ROW_KEY / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmed: { opacity: 0.45 },
});

/** A game's room: dark in either setting (Settings → Appearance). */
export default function SoundtrackScreenRoute() {
  return (
    <DarkRoom>
      <SoundtrackScreen />
    </DarkRoom>
  );
}
