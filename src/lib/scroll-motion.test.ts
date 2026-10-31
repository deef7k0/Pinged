import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { revealOffset, TOP_BAR_ROW } from '../constants/top-bar.ts';
import {
  PINNED_HERO,
  SHELF_REVEAL,
  pinnedBlur,
  pinnedDrain,
  pinnedDrift,
  pinnedStretch,
  shelfArrived,
} from './scroll-motion.ts';

/** A hero on a 360 × 800 phone with a 24dp status bar: the game page's 38%. */
const HERO = 304;
const BAR = 24 + TOP_BAR_ROW;

const steps = (count: number) => Array.from({ length: count + 1 }, (_, i) => i / count);

describe('the game page’s hero, pinned behind the page', () => {
  /* Where the art is solid and the top bar comes in on a 360 × 800 phone with
     a 24dp status bar: the lines under a one-line name (the hero, 304, less
     the row's rise, 35, plus the billing's 12 + 27 + 20) reaching the foot of
     the bar (24 + 64). */
  const SOLID_AT = revealOffset(304 - 35 + 12 + 27 + 20, BAR);
  it('is nearly still: it drifts up, slower than the page by far', () => {
    assert.equal(pinnedDrift(0, PINNED_HERO.drift, HERO), 0);
    assert.equal(pinnedDrift(-60, PINNED_HERO.drift, HERO), 0, 'a bounce is the stretch’s');
    const moved = -pinnedDrift(SOLID_AT, PINNED_HERO.drift, HERO);
    assert.ok(moved > 0, 'not completely still');
    assert.ok(moved < SOLID_AT * 0.35, '"mostly still"');
    /* Never further than its own height — it is off the display by then. */
    assert.equal(pinnedDrift(1e6, PINNED_HERO.drift, HERO), -HERO);
  });

  it('blurs after a little scroll, gently, and is whole before it drains', () => {
    const blur = (offset: number) =>
      pinnedBlur(offset, SOLID_AT, PINNED_HERO.blurFrom, PINNED_HERO.blurUntil);
    assert.equal(blur(0), 0, 'sharp at rest');
    assert.equal(blur(-40), 0, 'and on a bounce');
    /* "I don't want it to start sooner": not from the first pixel. */
    assert.equal(blur(SOLID_AT * PINNED_HERO.blurFrom), 0);
    assert.ok(PINNED_HERO.blurFrom >= 0.1, 'a little scroll first');
    /* Whole before solid, and gently: "the blur strength transition is
       slower, not as harsh" — its ramp is most of the way. */
    assert.equal(blur(SOLID_AT * PINNED_HERO.blurUntil), 1);
    assert.ok(PINNED_HERO.blurUntil - PINNED_HERO.blurFrom >= 0.5, 'a long, gentle ramp');
    const curve = steps(40).map((t) => blur(t * SOLID_AT));
    for (let i = 1; i < curve.length; i += 1) assert.ok(curve[i] >= curve[i - 1]);
  });

  it('drains early but slowly, and is solid where the top bar comes in', () => {
    const drain = (offset: number) => pinnedDrain(offset, SOLID_AT, PINNED_HERO.drainFrom);
    const from = SOLID_AT * PINNED_HERO.drainFrom;
    assert.equal(drain(from), 0);
    /* "I want it to start slower, not faster": a long ramp, flat at its start. */
    assert.ok(1 - PINNED_HERO.drainFrom >= 0.5, 'most of the way');
    assert.ok(drain(from + (SOLID_AT - from) * 0.1) < 0.05, 'gentle at first');
    const middle = SOLID_AT * ((PINNED_HERO.drainFrom + 1) / 2);
    assert.ok(drain(middle) > 0 && drain(middle) < 1, 'between, it is crossing');
    assert.equal(drain(SOLID_AT), 1, 'solid as the bar arrives');
    assert.equal(drain(SOLID_AT * 2), 1, 'and stays solid');
  });

  it('hangs a strip of page colour under the art, so its foot has no edge', () => {
    assert.ok(PINNED_HERO.footHold >= 16);
  });

  it('pulled past the top, keeps its top pinned and its foot with the page', () => {
    assert.deepEqual(pinnedStretch(0, HERO), { scale: 1, translateY: 0 });
    assert.deepEqual(pinnedStretch(200, HERO), { scale: 1, translateY: 0 });
    for (const offset of [-1, -40, -120, -300]) {
      const { scale, translateY } = pinnedStretch(offset, HERO);
      /* Laid out at the top of the display, scaled about its centre. */
      const top = HERO / 2 - (HERO * scale) / 2 + translateY;
      const foot = HERO / 2 + (HERO * scale) / 2 + translateY;
      assert.ok(Math.abs(top) < 1e-9, `top at ${top} for ${offset}`);
      /* The page has come down by -offset, and the row set into the hero's
         foot with it. */
      assert.ok(Math.abs(foot - (HERO - offset)) < 1e-9, `foot at ${foot} for ${offset}`);
    }
  });
});

describe('a shelf arriving', () => {
  it('waits until its top is well inside the screen', () => {
    assert.equal(shelfArrived(800, 800, SHELF_REVEAL.inset), false);
    assert.equal(shelfArrived(800 - SHELF_REVEAL.inset, 800, SHELF_REVEAL.inset), false);
    assert.equal(shelfArrived(800 - SHELF_REVEAL.inset - 1, 800, SHELF_REVEAL.inset), true);
  });

  it('rises a little and lands softly', () => {
    assert.ok(SHELF_REVEAL.rise > 0 && SHELF_REVEAL.rise <= 24);
    assert.ok(SHELF_REVEAL.ms >= 400 && SHELF_REVEAL.ms <= 700);
    /* An ease-out: the first control point leaves fast, the second lands flat. */
    const [x1, y1, x2, y2] = SHELF_REVEAL.easing;
    assert.ok(y1 / x1 > 3, 'leaves fast');
    assert.equal(y2, 1, 'lands flat');
    assert.ok(x2 < 1);
  });
});

describe('the source', () => {
  it('gives no worklet a default — one would throw on a phone', () => {
    /* A parameter default is evaluated before a worklet's closure is unpacked
       (CLAUDE.md § Gotchas); under Node it would pass and on a phone throw. */
    const source = readFileSync(new URL('./scroll-motion.ts', import.meta.url), 'utf8');
    const worklets = [...source.matchAll(/export function (\w+)\(([^)]*)\)[^\n]*\n\s*'worklet'/g)];
    const exported = [...source.matchAll(/export function (\w+)/g)].map(([, name]) => name);
    /* Every function here runs on the UI thread, so every one is marked — a
       new one that is not would run on the JS thread and be a dropped frame a
       scroll. */
    assert.deepEqual(
      worklets.map(([, name]) => name),
      exported
    );
    for (const [, name, parameters] of worklets) assert.doesNotMatch(parameters, /=/, name);
  });

  it('never calls a worklet written later in the file', () => {
    /*
     * The worklets plugin rewrites `export function x` into a `const`, which
     * is not hoisted, and builds each worklet's closure where the worklet
     * stands. So a worklet calling one defined below it captures `undefined`
     * and throws "undefined is not a function" on the UI thread — while Node
     * hoists the declaration and every test here passes. `pinnedBlur` did
     * exactly that on the owner's phone (2026-10-27); `smoothstep` is first
     * in the file because of it.
     */
    const source = readFileSync(new URL('./scroll-motion.ts', import.meta.url), 'utf8');
    const declarations = [...source.matchAll(/export function (\w+)/g)];
    const at = new Map(declarations.map((match) => [match[1], match.index!]));

    for (const [index, declaration] of declarations.entries()) {
      const name = declaration[1];
      const from = declaration.index!;
      const to = declarations[index + 1]?.index ?? source.length;
      const body = source.slice(from, to);
      for (const [callee, position] of at) {
        if (callee === name) continue;
        if (!new RegExp(`\\b${callee}\\(`).test(body)) continue;
        assert.ok(
          position < from,
          `${name} calls ${callee}, which is written after it — move ${callee} up`
        );
      }
    }
  });
});
