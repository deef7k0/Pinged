import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  MINI_PLAYER_HIDDEN_ROUTES,
  clockOf,
  firstPlayable,
  hidesMiniPlayer,
  isTabRoute,
  limitLiftsAt,
  nextPlayable,
  noticeText,
  phaseOf,
  previousPlayable,
  progressOf,
  resetClock,
  shuffled,
  type QueueTrack,
} from './player-queue.ts';

const track = (urn: string, access?: QueueTrack['access']): QueueTrack => ({ urn, access });

describe('nextPlayable / previousPlayable', () => {
  const tracks = [
    track('a', 'blocked'),
    track('b'),
    track('c', 'blocked'),
    track('d', 'preview'),
    track('e', 'blocked'),
  ];

  it('steps over tracks SoundCloud will not let the app play', () => {
    assert.equal(nextPlayable(tracks, 1), 3);
    assert.equal(previousPlayable(tracks, 3), 1);
  });

  it('starts a soundtrack on its first playable track', () => {
    assert.equal(firstPlayable(tracks), 1);
    assert.equal(firstPlayable([track('x', 'blocked')]), -1);
    assert.equal(firstPlayable([]), -1);
  });

  it('ends at the last playable track instead of wrapping round', () => {
    assert.equal(nextPlayable(tracks, 3), -1);
    assert.equal(nextPlayable(tracks, 4), -1);
    assert.equal(previousPlayable(tracks, 1), -1);
    assert.equal(previousPlayable(tracks, 0), -1);
  });

  it('survives an index outside the list', () => {
    assert.equal(nextPlayable(tracks, -5), 1);
    assert.equal(nextPlayable(tracks, 99), -1);
    assert.equal(previousPlayable(tracks, 99), 3);
  });

  it('counts a preview as playable', () => {
    assert.equal(nextPlayable([track('a'), track('b', 'preview')], 0), 1);
  });
});

describe('phaseOf', () => {
  it('is playing whenever sound is coming out', () => {
    assert.equal(phaseOf({ wantsPlay: true, playing: true, isBuffering: true }), 'playing');
  });

  it('is loading while a stream that was asked for has not started', () => {
    assert.equal(phaseOf({ wantsPlay: true, playing: false, isLoaded: false }), 'loading');
    assert.equal(
      phaseOf({ wantsPlay: true, playing: false, isLoaded: true, isBuffering: true }),
      'loading'
    );
  });

  it('is paused when nobody asked for sound, however the stream is doing', () => {
    assert.equal(phaseOf({ wantsPlay: false, playing: false, isBuffering: true }), 'paused');
    assert.equal(phaseOf({ wantsPlay: false, playing: false, isLoaded: false }), 'paused');
  });

  it('reads a report with nothing in it — Android’s error status — as paused', () => {
    assert.equal(phaseOf({ wantsPlay: false }), 'paused');
    /* Wanted, loaded as far as anybody knows, and silent: that is a pause too. */
    assert.equal(phaseOf({ wantsPlay: true }), 'paused');
  });
});

describe('progressOf', () => {
  it('is the fraction played, held between nothing and all of it', () => {
    assert.equal(progressOf(30, 120), 0.25);
    assert.equal(progressOf(500, 120), 1);
    assert.equal(progressOf(-4, 120), 0);
  });

  it('is nothing when the length is unknown', () => {
    assert.equal(progressOf(10, 0), 0);
    assert.equal(progressOf(10, NaN), 0);
    assert.equal(progressOf(NaN, 120), 0);
    assert.equal(progressOf(10, Infinity), 0);
  });
});

describe('clockOf', () => {
  it('prints seconds as minutes and seconds', () => {
    assert.equal(clockOf(0), '0:00');
    assert.equal(clockOf(187.9), '3:07');
    assert.equal(clockOf(3675), '61:15');
  });

  it('reads a time it was not given as the start', () => {
    assert.equal(clockOf(NaN), '0:00');
    assert.equal(clockOf(-3), '0:00');
  });
});

describe('limitLiftsAt', () => {
  const now = Date.parse('2026-10-08T12:00:00Z');

  it('waits until the moment SoundCloud names', () => {
    assert.equal(limitLiftsAt('2026-10-08T15:30:00Z', now), Date.parse('2026-10-08T15:30:00Z'));
  });

  it('waits a minute when no moment is named, or it cannot be read, or it has passed', () => {
    assert.equal(limitLiftsAt(null, now), now + 60_000);
    assert.equal(limitLiftsAt('soon', now), now + 60_000);
    assert.equal(limitLiftsAt('2026-10-08T11:00:00Z', now), now + 60_000);
  });
});

describe('what the player says when a track will not play', () => {
  /* Built from local parts, because the clock it prints is the reader's own. */
  const now = new Date(2026, 9, 8, 12, 0, 0).getTime();
  const later = new Date(2026, 9, 8, 14, 5, 0).toISOString();

  it('names the time a limit lifts, on the reader’s clock', () => {
    assert.equal(resetClock(later, now), '14:05');
    assert.match(noticeText({ kind: 'rate_limited', resetAt: later }, now), /Try after 14:05\./);
  });

  it('names no time it cannot stand behind', () => {
    assert.equal(resetClock(null, now), null);
    assert.equal(resetClock('whenever', now), null);
    assert.equal(resetClock(new Date(2026, 9, 8, 11, 0, 0).toISOString(), now), null);
    /* Two days off: "14:05" would be read as today's. */
    assert.equal(resetClock(new Date(2026, 9, 10, 14, 5, 0).toISOString(), now), null);
    assert.match(noticeText({ kind: 'rate_limited', resetAt: null }, now), /Try again shortly\./);
  });

  it('has a sentence for every notice, and never an empty one', () => {
    const notices = [
      { kind: 'blocked' },
      { kind: 'unconfigured' },
      { kind: 'rate_limited', resetAt: null },
      { kind: 'failed' },
    ] as const;
    const said = notices.map((notice) => noticeText(notice, now));
    for (const line of said) assert.ok(line.length > 10);
    assert.equal(new Set(said).size, notices.length);
  });
});

describe('where the mini player is drawn', () => {
  it('stays off the soundtrack screen, Surprise Me, the scanner and the forms', () => {
    assert.equal(hidesMiniPlayer(['soundtrack', '[id]']), true);
    assert.equal(hidesMiniPlayer(['surprise']), true);
    assert.equal(hidesMiniPlayer(['scan']), true);
    assert.equal(hidesMiniPlayer(['log', '[id]']), true);
    assert.equal(hidesMiniPlayer(['report', '[kind]', '[id]']), true);
  });

  it('is drawn on the tabs and on the pages pushed over them', () => {
    assert.equal(hidesMiniPlayer(['(tabs)']), false);
    assert.equal(hidesMiniPlayer(['(tabs)', 'search']), false);
    assert.equal(hidesMiniPlayer(['game', '[id]']), false);
    assert.equal(hidesMiniPlayer(['copy', '[id]']), false);
    assert.equal(hidesMiniPlayer([]), false);
  });

  it('knows a tab from a page', () => {
    assert.equal(isTabRoute(['(tabs)', 'news']), true);
    assert.equal(isTabRoute(['game', '[id]']), false);
    assert.equal(isTabRoute([]), false);
  });

  /*
   * A modal is a sheet the system draws over the app on iOS and a form on
   * Android; the bar belongs on neither. This list and the root layout are two
   * files, so the layout is read: a route given `presentation: 'modal'` (or
   * `fullScreenModal`) — written out, or through the layout's `SHEET` /
   * `FULL_SHEET` options — that is not in the list fails here, by name.
   */
  it('lists every route the root layout presents as a modal', () => {
    const layout = readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
    const modals = [
      ...layout.matchAll(
        /<Stack\.Screen\s+name="([^"]+)"\s+options=\{(?:\{\s*presentation:\s*'(?:modal|fullScreenModal)'|(?:SHEET|FULL_SHEET)\})/g
      ),
    ].map((match) => match[1].split('/')[0]);

    assert.ok(modals.length >= 10, `expected the layout's modals, found ${modals.length}`);
    for (const name of modals) {
      assert.ok(
        MINI_PLAYER_HIDDEN_ROUTES.has(name),
        `"${name}" is a modal the mini player would be drawn over`
      );
    }
  });

  /*
   * `<Screen>` gives up a band at its foot for the bar. On a route the bar is
   * never drawn over, that band would be empty — so those pages say
   * `miniPlayer={false}`, every `<Screen>` of them. (A modal's `<Screen modal>`
   * needs no flag, and nothing can be playing on a signed-out screen.)
   */
  it('keeps no empty band for the bar on the routes it stays off', () => {
    for (const file of ['soundtrack/[id].tsx', 'surprise.tsx', 'scan.tsx']) {
      const source = readFileSync(new URL(`../app/${file}`, import.meta.url), 'utf8');
      const shells = source.match(/^\s*<Screen(?:\s|$)/gm)?.length ?? 0;
      const optedOut = source.match(/miniPlayer=\{false\}/g)?.length ?? 0;

      assert.ok(shells > 0, `${file} draws no <Screen>`);
      assert.equal(optedOut, shells, `${file}: every <Screen> needs miniPlayer={false}`);
    }
  });

  it('lists every signed-out route, and onboarding', () => {
    const layout = readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
    /* Everything from the onboarding group on: onboarding, then the signed-out
       routes — nothing can be playing on any of them, and a bar there would sit
       over the one button the page has. */
    const outside = layout.slice(layout.indexOf("onboarding !== 'done'"));
    const names = [...outside.matchAll(/<Stack\.Screen\s+name="([^"]+)"/g)].map((m) => m[1]);

    assert.ok(names.includes('onboarding') && names.includes('welcome'), names.join(', '));
    /* By its first segment, as `hidesMiniPlayer` reads a route. */
    for (const name of names) assert.ok(MINI_PLAYER_HIDDEN_ROUTES.has(name.split('/')[0]), name);
  });
});

describe('shuffled', () => {
  const tracks: QueueTrack[] = [
    { urn: 'a' },
    { urn: 'b', access: 'blocked' },
    { urn: 'c' },
    { urn: 'd', access: 'preview' },
    { urn: 'e' },
  ];

  it('keeps every track once and leaves the original alone', () => {
    const order = shuffled(tracks, () => 0.42);
    assert.deepEqual(order.map((t) => t.urn).sort(), ['a', 'b', 'c', 'd', 'e']);
    assert.deepEqual(
      tracks.map((t) => t.urn),
      ['a', 'b', 'c', 'd', 'e']
    );
  });

  it('puts the tracks that cannot be played last', () => {
    for (const seed of [0, 0.2, 0.5, 0.8, 0.99]) {
      const order = shuffled(tracks, () => seed);
      assert.equal(order[order.length - 1].urn, 'b');
      assert.equal(firstPlayable(order), 0);
    }
  });

  it('is decided by the random source', () => {
    let n = 0;
    const seq = [0.9, 0.1, 0.6, 0.3];
    const a = shuffled(tracks, () => seq[n++ % seq.length]).map((t) => t.urn);
    n = 0;
    const b = shuffled(tracks, () => seq[n++ % seq.length]).map((t) => t.urn);
    assert.deepEqual(a, b);
  });
});
