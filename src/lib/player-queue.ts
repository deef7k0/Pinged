/**
 * The player's arithmetic: which track comes next, what the transport should
 * show, and where the mini player stays out of the way.
 *
 * Pure, and under `npm test`. The player itself (`store/player.ts`) holds a
 * native audio object and cannot be loaded by Node; everything it decides
 * rather than does is here.
 */

/** As much of a track as the queue's arithmetic needs. */
export type QueueTrack = {
  urn: string;
  /** `blocked` is a track SoundCloud does not let this app play at all. */
  access?: 'playable' | 'preview' | 'blocked';
};

function playable(track: QueueTrack | undefined): boolean {
  return !!track && track.access !== 'blocked';
}

/**
 * The next track after `from` that may be played, or -1.
 *
 * It does not wrap: a soundtrack that has reached its last track has ended,
 * and starting it again unasked would spend the app's daily plays on a phone
 * left on a table.
 */
export function nextPlayable(tracks: readonly QueueTrack[], from: number): number {
  for (let index = Math.max(-1, from) + 1; index < tracks.length; index += 1) {
    if (playable(tracks[index])) return index;
  }
  return -1;
}

/** The nearest track before `from` that may be played, or -1. */
export function previousPlayable(tracks: readonly QueueTrack[], from: number): number {
  for (let index = Math.min(tracks.length, from) - 1; index >= 0; index -= 1) {
    if (playable(tracks[index])) return index;
  }
  return -1;
}

/** Where "Listen" starts: the first track that may be played, or -1. */
export function firstPlayable(tracks: readonly QueueTrack[]): number {
  return nextPlayable(tracks, -1);
}

/**
 * How far into a track "previous" stops meaning "the one before" and starts
 * meaning "from the top", in seconds — every music player's rule.
 */
export const RESTART_AFTER_SECONDS = 3;

export type PlayerPhase = 'idle' | 'loading' | 'playing' | 'paused';

/**
 * What the transport shows, from what the audio object last reported.
 *
 * `wantsPlay` is what was last asked for. Without it a track that is still
 * buffering is indistinguishable from one that was paused — both are "not
 * playing" — and the key would flick back to a play triangle for the second it
 * takes a stream to start.
 *
 * Every field is optional because the native side does not always send them
 * all: Android reports a playback error as a status holding `error` and
 * nothing else.
 */
export function phaseOf(report: {
  wantsPlay: boolean;
  playing?: boolean;
  isLoaded?: boolean;
  isBuffering?: boolean;
}): PlayerPhase {
  if (report.playing) return 'playing';
  if (report.wantsPlay && (report.isBuffering || report.isLoaded === false)) return 'loading';
  return 'paused';
}

/** 0–1 through a track, safe against a length that is zero, unknown or not a number. */
export function progressOf(position: number, duration: number): number {
  if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(1, Math.max(0, position / duration));
}

/** Seconds as a clock — `0:00`, `3:07`, `61:15`. An unknown time reads as the start. */
export function clockOf(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * When a rate limit lifts, in epoch milliseconds.
 *
 * SoundCloud's 429 names the moment (`reset_time`); when it does not, or names
 * one that cannot be read, wait a minute — long enough not to hammer, short
 * enough that a passing limit is not a dead feature.
 */
export function limitLiftsAt(resetAt: string | null | undefined, now: number): number {
  const parsed = resetAt ? Date.parse(resetAt) : NaN;
  if (Number.isFinite(parsed) && parsed > now) return parsed;
  return now + 60_000;
}

/** Why the current track is not playing, in the only four ways that can be said. */
export type PlayerNotice =
  /** SoundCloud does not let this app play the track. */
  | { kind: 'blocked' }
  /** No SoundCloud keys on the server yet: the state this feature was built in. */
  | { kind: 'unconfigured' }
  /** The app's plays for the day are spent, or SoundCloud asked it to slow down. */
  | { kind: 'rate_limited'; resetAt: string | null }
  /** The request or the stream failed. Pressing play tries again. */
  | { kind: 'failed' };

/**
 * The time on the clock when a limit lifts — "14:05" — or null when SoundCloud
 * named no moment, one that has passed, or one more than a day off (a time of
 * day would then name the wrong day).
 */
export function resetClock(resetAt: string | null | undefined, now: number): string | null {
  const at = resetAt ? Date.parse(resetAt) : NaN;
  if (!Number.isFinite(at) || at <= now || at - now > 24 * 60 * 60_000) return null;
  const date = new Date(at);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** A notice as one line the player can print in place of the uploader's name. */
export function noticeText(notice: PlayerNotice, now: number = Date.now()): string {
  switch (notice.kind) {
    case 'blocked':
      return 'SoundCloud does not let this track play here.';
    case 'unconfigured':
      return 'SoundCloud is not connected yet.';
    case 'rate_limited': {
      const clock = resetClock(notice.resetAt, now);
      return clock
        ? `SoundCloud’s play limit was reached. Try after ${clock}.`
        : 'SoundCloud’s play limit was reached. Try again shortly.';
    }
    case 'failed':
      return 'Could not play this track. Press play to try again.';
  }
}

/**
 * The first segment of every route the mini player is not drawn over.
 *
 *  - `soundtrack`: the screen has the full player docked at its foot.
 *  - `surprise`: one song per card is that screen's own thing, and its foot is
 *    where the card is thrown.
 *  - `scan`: a camera, full screen.
 *  - Every modal. On iOS a modal is a sheet the system draws over the whole
 *    app, the bar included, so it could not be reached there anyway; on Android
 *    it would sit on a form's last field and its save button.
 *  - The signed-out screens, where nothing can be playing.
 *
 * `player-queue.test.ts` reads `app/_layout.tsx` and fails when a route
 * presented as a modal there is missing from this list.
 */
export const MINI_PLAYER_HIDDEN_ROUTES: ReadonlySet<string> = new Set([
  'soundtrack',
  'surprise',
  'scan',
  'log',
  'playthrough',
  'add-copy',
  'add-release',
  'suggest-similar',
  'report',
  'award-game',
  'award-edit',
  'new-list',
  'edit-list',
  'add-to-list',
  'label-games',
  'pin-game',
  'quick-log',
  'edit-profile',
  'new-ping',
  'suggest-game',
  'send-ping',
  'welcome',
  'onboarding',
  /* The terms and the privacy policy: readable signed out too. */
  'legal',
]);

/** Whether the mini player stays off the route these segments name. */
export function hidesMiniPlayer(segments: readonly string[]): boolean {
  const first = segments[0];
  return typeof first === 'string' && MINI_PLAYER_HIDDEN_ROUTES.has(first);
}

/** Whether the route is one of the four tabs, where the bar sits above the tab capsule. */
export function isTabRoute(segments: readonly string[]): boolean {
  return segments[0] === '(tabs)';
}
