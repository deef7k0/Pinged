import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { PlayerArtwork } from '@/components/player/player-bar';
import { SoundCloudMark } from '@/components/player/soundcloud-mark';
import { ProfileWidget } from '@/components/profile-section';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getStarredSong } from '@/lib/api';
import { noticeText, progressOf } from '@/lib/player-queue';
import { getSoundCloudTrack, isSoundCloudUrn } from '@/lib/soundcloud/api';
import { player, usePlayer } from '@/store/player';
import { Loader } from '@/components/ui/loader';

/** Track art: 56, a step over the soundtrack screen's rows, with the widget. */
const ARTWORK = 56;

/**
 * The one song pinned to a profile.
 *
 * Modelled on the track pinned to an Instagram bio: a statement about taste
 * that the visitor can hear rather than only read. It renders nothing at all
 * when nobody has pinned one — an empty "no song" row on every profile would be
 * a permanent advert for a feature most people will not use.
 *
 * ## The profile stores an id and nothing else
 *
 * A star is a SoundCloud track's URN and the game it was starred from. The
 * title, the uploader and the artwork are asked of SoundCloud when the profile
 * is shown, because its terms forbid an app to keep them — which also means a
 * track its uploader takes down leaves the profile by itself. So there are two
 * queries here: whose star (Postgres), then what it is (SoundCloud).
 *
 * It draws nothing when the second has no answer to give: the track is gone,
 * SoundCloud is not connected, or the row is an Apple Music id from a database
 * that has not run 0036. A profile is not the place to explain any of those.
 * That is also why the space above it is its own (`styles.section`) and not the
 * profile's: a wrapper the profile kept for it would be a gap with nothing
 * under it on every profile that has no song.
 *
 * ## It plays through the app's one player
 *
 * And stops when the profile is left — another tab, a page opened over it —
 * if the song is still this widget's. Keep playing is the soundtrack screen's
 * switch and does not reach here: a pinned song ends with its profile.
 */
export function StarredSongWidget({ profileId }: { profileId: string }) {
  const theme = useTheme();

  const song = useQuery({
    queryKey: ['starred-song', profileId],
    queryFn: () => getStarredSong(profileId),
    enabled: !!profileId,
  });

  const starred = song.data ?? null;
  const urn = isSoundCloudUrn(starred?.track_id) ? starred.track_id : null;

  const lookup = useQuery({
    /* `soundcloud-track` is in NEVER_PERSIST: this holds SoundCloud's words. */
    queryKey: ['soundcloud-track', urn],
    queryFn: ({ signal }) => getSoundCloudTrack(urn!, signal),
    enabled: !!urn,
    /* "Not connected" is not kept, so the song appears the day the keys are set. */
    staleTime: (current) => (current.state.data?.status === 'unconfigured' ? 0 : 60 * 60_000),
    retry: false,
  });

  const owner = `starred:${profileId}`;
  /*
   * On losing focus, not only on unmount. Your own profile is a tab, and a tab
   * is never unmounted: an unmount cleanup alone would leave the song playing
   * behind every screen opened from there, with nothing on screen to stop it.
   */
  useFocusEffect(useCallback(() => () => player.release(owner), [owner]));

  const isCurrent = usePlayer(
    (state) => urn !== null && state.queue?.tracks[state.index]?.urn === urn
  );
  const phase = usePlayer((state) => state.phase);
  const notice = usePlayer((state) => state.notice);
  const progress = usePlayer((state) =>
    urn !== null && state.queue?.tracks[state.index]?.urn === urn
      ? progressOf(state.position, state.duration)
      : 0
  );

  if (!urn) return null;

  /* A song is pinned and its name is on the way: hold its place, so the
     profile under it does not jump when SoundCloud answers. */
  if (lookup.isPending) {
    return (
      <ProfileWidget title="Starred song" icon="star">
        <View style={styles.row}>
          <Skeleton width={ARTWORK} height={ARTWORK} />
          <View style={styles.body}>
            <Skeleton width="58%" height={13} radius={Radius.sm} />
            <Skeleton width="40%" height={10} radius={Radius.sm} />
          </View>
        </View>
      </ProfileWidget>
    );
  }

  const track = lookup.data?.status === 'ok' ? lookup.data.track : null;
  if (!track) return null;

  const playable = track.access !== 'blocked';
  const playing = isCurrent && phase === 'playing';
  const starting = isCurrent && phase === 'loading';
  const trouble = isCurrent && notice ? noticeText(notice) : null;

  function toggle() {
    if (!track || !playable) return;
    player.play(
      {
        owner,
        gameId: starred?.game_id ?? null,
        gameTitle: starred?.game_title ?? null,
        tracks: [track],
      },
      0
    );
  }

  return (
    /* A widget like the favourites and the games over it: a hairline, a
       heading, the song (`<ProfileWidget>`) — not a card. SoundCloud's mark is
       at the far end of the heading's line, linking to the track there: with
       the uploader named below, the credit its terms ask for. */
    <ProfileWidget
      title="Starred song"
      icon="star"
      action={
        <SoundCloudMark url={track.permalinkUrl} label={`Open ${track.title} on SoundCloud`} />
      }>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={
          playable
            ? `${playing ? 'Pause' : 'Play'} ${track.title} by ${track.uploader.name}`
            : `${track.title} by ${track.uploader.name}. SoundCloud does not let it play here.`
        }
        accessibilityState={{ disabled: !playable }}
        disabled={!playable}
        onPress={toggle}
        scaleTo={0.99}
        style={StyleSheet.flatten([styles.row, { opacity: playable ? 1 : 0.6 }])}>
        <PlayerArtwork uri={track.artworkUrl} size={ARTWORK} />

        <View style={styles.body}>
          <Text variant="itemTitle" numberOfLines={1}>
            {track.title}
          </Text>
          <Text
            variant="bodySmall"
            color={trouble ? 'textSecondary' : 'textMuted'}
            numberOfLines={trouble ? 2 : 1}>
            {trouble ?? [track.uploader.name, starred?.game_title].filter(Boolean).join(' · ')}
          </Text>

          {/* Progress only while it is actually playing — a full-width empty
                  track under a song nobody has tapped is just a rule. */}
          {playing && (
            <View style={[styles.track, { backgroundColor: theme.surfaceElevated }]}>
              <View
                style={[
                  styles.fill,
                  { width: `${progress * 100}%`, backgroundColor: theme.primary },
                ]}
              />
            </View>
          )}
        </View>

        {playable && (
          <View style={[styles.play, { backgroundColor: theme.controlFill }]}>
            {starting ? (
              <Loader size="small" color={theme.text} />
            ) : (
              <Ionicons name={playing ? 'pause' : 'play'} size={18} color={theme.text} />
            )}
          </View>
        )}
      </PressableScale>
    </ProfileWidget>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  body: { flex: 1, gap: 2 },
  track: { height: 3, borderRadius: Radius.pill, overflow: 'hidden', marginTop: Spacing.x4 },
  fill: { height: '100%', borderRadius: Radius.pill },
  /* A round transport key, like every glyph-only control. */
  play: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
