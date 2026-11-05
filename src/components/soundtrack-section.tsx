import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { SoundCloudMark } from '@/components/player/soundcloud-mark';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useGameSoundtrack } from '@/hooks/use-game-soundtrack';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration, formatRunningTime } from '@/lib/soundtrack-pick';

/** How many tracks the summary names before "and N more". */
const SHOWN = 5;
/** A row's first column: the track's number. */
const LEAD = 22;

export type SoundtrackSummaryProps = {
  /** The app-wide game id — the soundtrack screen's route. */
  gameId: string;
  title: string;
  /** Whose uploads count as official. */
  developer: string | null;
};

/**
 * The game page's Soundtrack tab: what the soundtrack is, and the button that
 * opens it.
 *
 * The owner kept the tab and asked for exactly this — "the user taps a button,
 * a screen opens and the game's soundtrack is displayed to listen". So the tab
 * is a summary, not a player: how much music there is, whose upload it is,
 * its first few tracks, and **Listen**. Nothing here plays; the player is on
 * the screen the button opens — and a track pressed here opens that screen
 * playing it (`?play=`).
 *
 * It used to be a grid of every album a title search turned up on Apple Music.
 * There is one soundtrack per game now, chosen by the matcher, so there is no
 * grid to draw.
 *
 * Mounted only while its tab is chosen, so a game page that is never turned to
 * Soundtrack asks SoundCloud nothing.
 */
export function SoundtrackSummary({ gameId, title, developer }: SoundtrackSummaryProps) {
  const router = useRouter();
  const theme = useTheme();
  const { query, lookAgain, isLookingAgain, lookAgainFailed } = useGameSoundtrack({
    gameId,
    title,
    developer,
  });

  if (query.isPending) return <LoadingSummary />;

  if (query.isLoadingError) {
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  }

  const answer = query.data;
  const soundtrack =
    answer?.status === 'ok' && answer.soundtrack.tracks.length > 0 ? answer.soundtrack : null;

  if (!soundtrack) {
    return (
      <SoundtrackUnavailable
        status={answer?.status ?? 'none'}
        title={title}
        busy={isLookingAgain || query.isRefetching}
        failed={lookAgainFailed}
        onLookAgain={lookAgain}
        onRetry={() => query.refetch()}
      />
    );
  }

  const tracks = soundtrack.tracks;
  const length = formatRunningTime(tracks.map((track) => track.durationMs));
  const playlist = soundtrack.source === 'playlist' ? soundtrack.playlist : null;
  const more = tracks.length - SHOWN;

  return (
    <View style={styles.summary}>
      <View style={styles.head}>
        <View style={styles.headWords}>
          <Text variant="h4" accessibilityRole="header">
            Soundtrack
          </Text>
          <Text variant="bodySmall" color="textMuted">
            {[`${tracks.length} ${tracks.length === 1 ? 'track' : 'tracks'}`, length]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>

        {/* SoundCloud's own mark, linking to the playlist there: with each
            uploader named below, the credit its terms ask for. */}
        <SoundCloudMark url={playlist?.permalinkUrl} label="Open this playlist on SoundCloud" />
      </View>

      <Text variant="bodySmall" color="textSecondary">
        {playlist
          ? `“${playlist.title}”, a playlist by ${playlist.uploader.name}`
          : 'Tracks on SoundCloud that name this game, most played first.'}
      </Text>

      {/* Apple Music's top songs, inline (the Apple pass, 2026-11-05): a
          tap opens the soundtrack on that track and plays it there — the
          player stays on its own screen, the owner's rule. */}
      <View style={styles.tracks}>
        {tracks.slice(0, SHOWN).map((track, index) => (
          <PressableScale
            key={track.urn}
            accessibilityRole="button"
            accessibilityLabel={`Play ${track.title} by ${track.uploader.name}`}
            disabled={track.access === 'blocked'}
            onPress={() =>
              router.push({
                pathname: '/soundtrack/[id]',
                params: { id: gameId, title, play: String(index) },
              })
            }
            scaleTo={0.98}
            style={StyleSheet.flatten([
              styles.row,
              index > 0 && { ...styles.divided, borderTopColor: theme.border },
              track.access === 'blocked' && styles.blocked,
            ])}>
            <Text variant="bodySmall" color="textMuted" style={styles.lead}>
              {index + 1}
            </Text>
            <View style={styles.rowWords}>
              <Text variant="itemTitle" numberOfLines={1}>
                {track.title}
              </Text>
              <Text variant="caption" color="textMuted" numberOfLines={1}>
                {track.uploader.name}
              </Text>
            </View>
            <Text variant="caption" color="textMuted">
              {formatDuration(track.durationMs)}
            </Text>
          </PressableScale>
        ))}

        {more > 0 && (
          <Text variant="caption" color="textMuted" style={styles.more}>
            and {more} more
          </Text>
        )}
      </View>

      <Button
        title={more > 0 ? `All ${tracks.length} tracks` : 'Listen'}
        icon="play"
        variant="secondary"
        fullWidth
        accessibilityLabel={`Listen to the soundtrack of ${title}`}
        onPress={() => router.push({ pathname: '/soundtrack/[id]', params: { id: gameId, title } })}
      />
    </View>
  );
}

export type SoundtrackUnavailableProps = {
  status: 'ok' | 'none' | 'unconfigured' | 'rate_limited';
  title: string;
  /** A second look, or a retry, is in flight. */
  busy: boolean;
  /** The second look itself failed. */
  failed: boolean;
  onLookAgain: () => void;
  onRetry: () => void;
};

/**
 * The three ways there is nothing to play that are not errors — shared by the
 * tab and by the soundtrack screen, so they say the same thing.
 *
 * Each states what is true and offers only what could change it. "Nothing
 * found" can be looked for again — a soundtrack goes up, a game is new — and
 * the server searches at most every ten minutes however often it is pressed.
 * "Not connected" offers nothing: no press on a phone sets a key on a server.
 */
export function SoundtrackUnavailable({
  status,
  title,
  busy,
  failed,
  onLookAgain,
  onRetry,
}: SoundtrackUnavailableProps) {
  if (status === 'unconfigured') {
    return (
      <EmptyState
        icon="musical-notes-outline"
        title="Soundtracks are not connected yet"
        message="Pinged plays soundtracks from SoundCloud, and that connection has not been set up."
        footnote={
          __DEV__
            ? 'Deploy the soundcloud function and set SOUNDCLOUD_CLIENT_ID and SOUNDCLOUD_CLIENT_SECRET. EXPO_PUBLIC_SOUNDCLOUD_FIXTURE=true shows sample tracks.'
            : undefined
        }
      />
    );
  }

  if (status === 'rate_limited') {
    return (
      <EmptyState
        title="SoundCloud is busy"
        message="Too many requests reached SoundCloud just now. Try again in a minute."
        action={<Button title="Try again" loading={busy} onPress={onRetry} />}
      />
    );
  }

  return (
    <EmptyState
      icon="search"
      title="No soundtrack found"
      message={
        failed
          ? 'Could not reach SoundCloud to look again. Check your connection and try once more.'
          : `Nothing on SoundCloud is clearly the soundtrack of ${title}. Covers, remixes and mixes of several games are left out on purpose.`
      }
      action={<Button title="Look again" loading={busy} onPress={onLookAgain} />}
    />
  );
}

/** The summary's own shape while it is fetched, so the tab does not jump when it lands. */
function LoadingSummary() {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading the soundtrack"
      style={styles.summary}>
      <View style={styles.headWords}>
        <Skeleton width={110} height={16} radius={Radius.sm} />
        <Skeleton width={90} height={11} radius={Radius.sm} />
      </View>
      <Skeleton width="70%" height={11} radius={Radius.sm} />

      <View style={styles.tracks}>
        {[66, 48, 58, 44, 62].map((width, row) => (
          <View key={row} style={styles.row}>
            <View style={styles.lead}>
              <Skeleton width={10} height={11} radius={Radius.sm} />
            </View>
            <View style={styles.rowWords}>
              <Skeleton width={`${width}%`} height={13} radius={Radius.sm} />
              <Skeleton width="30%" height={10} radius={Radius.sm} />
            </View>
            <Skeleton width={28} height={10} radius={Radius.sm} />
          </View>
        ))}
      </View>

      <Skeleton width="100%" height={52} radius={Radius.pill} />
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { gap: Spacing.x16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  headWords: { flex: 1, gap: Spacing.x4 },
  tracks: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    minHeight: 52,
    paddingVertical: Spacing.x8,
  },
  divided: { borderTopWidth: StyleSheet.hairlineWidth },
  blocked: { opacity: 0.45 },
  lead: { width: LEAD, textAlign: 'center', alignItems: 'center' },
  rowWords: { flex: 1, gap: 2 },
  /* In line with the titles, past the number column. */
  more: { marginLeft: LEAD + Spacing.x8 },
});
