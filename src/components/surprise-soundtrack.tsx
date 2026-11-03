import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { PlayerArtwork } from '@/components/player/player-bar';
import { SoundCloudMark } from '@/components/player/soundcloud-mark';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { SectionCard } from '@/components/ui/section';
import { Skeleton } from '@/components/ui/surface';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import type { SoundCloudTrack } from '@/lib/soundcloud/types';
import { Loader } from '@/components/ui/loader';

const ARTWORK = 44;

export type SurpriseSoundtrackProps = {
  track: SoundCloudTrack | null;
  loading: boolean;
  /** Why there is no song, when there is none. */
  message: string | null;
  /** Why the song will not play, when it will not. Takes the progress line's place. */
  note: string | null;
  /** SoundCloud allows only a snippet of this track. */
  preview: boolean;
  playing: boolean;
  /** Play was pressed and the stream has not started yet. */
  starting: boolean;
  /** 0–1 through the song. */
  progress: number;
  /** False when the soundtrack holds a single playable track and shuffling cannot move. */
  canShuffle: boolean;
  onTogglePlay: () => void;
  onAnotherSong: () => void;
  /** Opens the soundtrack screen — every track, the star, the links to SoundCloud. */
  onOpenSoundtrack: () => void;
  /** Present only when asking again could change the answer. */
  onRetry?: () => void;
};

/**
 * The soundtrack, as one row.
 *
 * ## Why a row and not the card it replaced
 *
 * The reveal fits one viewport now, and the card wanted 230dp of it for artwork
 * the game's own case is already providing at four times the size. A row states
 * the same facts — what is playing and who uploaded it — in 64.
 *
 * ## What left, and where it went
 *
 * **The star is gone from this surface, deliberately.** It performed an upsert
 * that overwrites the profile's one pinned song, from a 32dp glyph, with no
 * confirmation and no undo, on a screen built for rapid mis-taps. That is the
 * most consequential action in the feature and it was also its smallest. Tapping
 * the row opens `/soundtrack/[id]`, which holds the full track list and the same
 * star — one tap away, on a screen where you are choosing a track deliberately
 * rather than thumbing past a card.
 *
 * ## The foot of the row is SoundCloud's
 *
 * The uploader's name is the row's second line, and SoundCloud's own mark
 * sits at the end of the progress line, linking to the track's page there. Together
 * they are the credit SoundCloud's API terms ask for wherever one of its
 * tracks is shown or played; the row is not allowed to be shorter than them.
 *
 * Purely presentational: the lookup, the pick and the player all live above it.
 */
export function SurpriseSoundtrack({
  track,
  loading,
  message,
  note,
  preview,
  playing,
  starting,
  progress,
  canShuffle,
  onTogglePlay,
  onAnotherSong,
  onOpenSoundtrack,
  onRetry,
}: SurpriseSoundtrackProps) {
  const theme = useTheme();
  const accent = useAccent();

  if (loading) {
    return (
      <SectionCard>
        <View style={styles.row}>
          <Skeleton width={ARTWORK} height={ARTWORK} />
          <View style={styles.meta}>
            <Skeleton width="64%" height={13} radius={Radius.sm} />
            <Skeleton width="40%" height={10} radius={Radius.sm} />
          </View>
        </View>
      </SectionCard>
    );
  }

  /*
   * One row for every way there can be no song, with the message doing the
   * distinguishing. The retry key appears only where the caller passes a
   * handler: it used to appear in all of them and spent a real round trip to
   * return the same nothing in most.
   */
  if (!track) {
    return (
      <SectionCard>
        <View style={styles.row}>
          <View style={[styles.blank, { backgroundColor: accent.m3.surfaceContainerHigh }]}>
            <Ionicons name="musical-notes-outline" size={19} color={theme.textMuted} />
          </View>
          <Text variant="bodySmall" color="textMuted" style={styles.meta} numberOfLines={2}>
            {message ?? 'No soundtrack on SoundCloud.'}
          </Text>
          {onRetry && (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Look for the soundtrack again"
              onPress={onRetry}
              scaleTo={0.9}
              style={StyleSheet.flatten([
                styles.disc,
                { backgroundColor: accent.m3.surfaceContainerHigh },
              ])}>
              <Ionicons name="refresh" size={19} color={accent.m3.onSurfaceVariant} />
            </PressableScale>
          )}
        </View>
      </SectionCard>
    );
  }

  const playable = track.access !== 'blocked';
  const active = playing || starting;

  return (
    <SectionCard>
      <View style={styles.row}>
        {/* The row's body opens the soundtrack. Everything the card used to
            carry — the full track list, the star — lives on that screen. */}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${track.title} by ${track.uploader.name}. Open the soundtrack.`}
          onPress={onOpenSoundtrack}
          scaleTo={0.99}
          style={styles.body}>
          <PlayerArtwork uri={track.artworkUrl} size={ARTWORK} />
          <View style={styles.meta}>
            <Text variant="h5" numberOfLines={1}>
              {track.title}
            </Text>
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              {preview ? `${track.uploader.name} · Preview` : track.uploader.name}
            </Text>
          </View>
        </PressableScale>

        {/* Disabled rather than hidden on a one-track soundtrack: a control
            that vanishes between games reads as a layout bug, and the state is
            the honest answer — there is nothing else here to play. */}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={canShuffle ? 'Another song' : 'This soundtrack has only one song'}
          accessibilityState={{ disabled: !canShuffle }}
          disabled={!canShuffle}
          onPress={onAnotherSong}
          scaleTo={0.9}
          style={StyleSheet.flatten([
            styles.disc,
            /* M3 filled-tonal: the game page's keys' resting fill. */
            { backgroundColor: accent.m3.surfaceContainerHigh },
            !canShuffle && styles.dimmed,
          ])}>
          <Ionicons name="shuffle" size={19} color={accent.m3.onSurfaceVariant} />
        </PressableScale>

        <PressableScale
          accessibilityRole="button"
          accessibilityState={{ disabled: !playable, selected: active }}
          accessibilityLabel={
            playable
              ? active
                ? `Pause ${track.title}`
                : `Play ${track.title}`
              : 'SoundCloud does not let this track play here'
          }
          disabled={!playable}
          onPress={onTogglePlay}
          scaleTo={0.9}
          style={StyleSheet.flatten([
            styles.disc,
            /* M3 filled: the one primary key on the card, as the game page's
               review button is the one on its page. */
            { backgroundColor: playable ? accent.color : accent.m3.surfaceContainerHigh },
          ])}>
          {starting ? (
            <Loader size="small" color={accent.ink} />
          ) : (
            <Ionicons
              name={playing ? 'pause' : 'play'}
              size={19}
              color={playable ? accent.ink : theme.textMuted}
              /* A play triangle is optically left-heavy inside a circle; the pause
                 glyph is symmetrical and needs no correction. */
              style={playing ? undefined : styles.playNudge}
            />
          )}
        </PressableScale>
      </View>

      {/* How far through, with SoundCloud's mark at its end. The line is not
          interactive and does not pretend to be: scrubbing is on the soundtrack
          screen, where it is a finger tall. A song that will not play says why
          here instead, where the line would have been. */}
      <View style={styles.foot}>
        {note ? (
          <Text variant="caption" color="textSecondary" numberOfLines={2} style={styles.footLead}>
            {note}
          </Text>
        ) : (
          <View
            style={[
              styles.track,
              styles.footLead,
              { backgroundColor: accent.m3.surfaceContainerHigh },
            ]}>
            <View
              style={[
                styles.fill,
                { backgroundColor: accent.color, width: `${Math.min(100, progress * 100)}%` },
              ]}
            />
          </View>
        )}
        <SoundCloudMark url={track.permalinkUrl} label={`Open ${track.title} on SoundCloud`} />
      </View>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  blank: {
    width: ARTWORK,
    height: ARTWORK,
    borderRadius: Radius.image,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { flex: 1, gap: 1 },
  /* `TapTarget`, not a literal 44 — it resolves to 48 on Android, and a
     hard-coded 44 here is the exact bug the token exists to prevent. */
  disc: {
    width: TapTarget,
    height: TapTarget,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmed: { opacity: 0.4 },
  playNudge: { marginLeft: 2 },
  track: { height: 3, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: 3, borderRadius: Radius.pill },
  /* One line, as tall as SoundCloud's mark: the progress line beside it costs
     the row nine more dp than it had alone, on a screen that must not scroll. */
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
  },
  footLead: { flex: 1 },
});
