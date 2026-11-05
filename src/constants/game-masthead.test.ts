import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ABOUT_FADE,
  ABOUT_LINES,
  COVER_MAX_WIDTH,
  DISSOLVE_STARTS_AT,
  DISSOLVE_STOPS,
  HALO_STOPS,
  ROW_ENTERS_AT,
  dissolveAt,
  haloAt,
  haloRadii,
  mastheadCoverWidth,
  mastheadOverlap,
} from './game-masthead.ts';

/** The hero is 38% of the display; these are the phones it ships to. */
const HERO_HEIGHTS = [243, 266, 304, 342, 354];

/** The ramp the dissolve replaced: full to 38% of the hero, then a straight line. */
const straightLine = (t: number) => (t <= 0.38 ? 1 : (1 - t) / 0.62);

describe('the masthead cover', () => {
  it('is the reference poster: 100dp on a 360dp display', () => {
    assert.equal(mastheadCoverWidth(360), 100);
  });

  it('is smaller than the third of the display it used to be, on every phone', () => {
    for (const width of [320, 360, 393, 412, 430]) {
      assert.ok(mastheadCoverWidth(width) < Math.round(width * 0.33), `${width}dp`);
    }
  });

  it('stops growing on a display wider than a phone', () => {
    assert.equal(mastheadCoverWidth(1200), COVER_MAX_WIDTH);
  });

  it('leaves the billing more than half the row on the narrowest phone', () => {
    const display = 320;
    const row = display - 15 * 2;
    assert.ok(row - mastheadCoverWidth(display) - 16 > row / 2);
  });
});

describe('the hero dissolve', () => {
  it('holds the art at full strength to where it starts, and ends on nothing', () => {
    assert.equal(dissolveAt(0), 1);
    assert.equal(dissolveAt(DISSOLVE_STARTS_AT), 1);
    assert.equal(dissolveAt(1), 0);
    assert.equal(dissolveAt(1.2), 0);
  });

  it('only ever thins on the way down', () => {
    for (let step = 1; step <= 200; step++) {
      assert.ok(dissolveAt(step / 200) <= dissolveAt((step - 1) / 200) + 1e-12, `at ${step / 200}`);
    }
  });

  it('has no corner where it starts or where it ends', () => {
    assert.ok(1 - dissolveAt(DISSOLVE_STARTS_AT + 0.01) < 0.001);
    assert.ok(dissolveAt(0.99) < 0.005);
  });

  it('holds full strength through the top 60% of the hero', () => {
    for (const t of [0, 0.2, 0.4, 0.6]) {
      assert.equal(dissolveAt(t), 1, `at ${t}`);
    }
  });

  it('is drawn as stops that start at the top, end at the bottom and never rise', () => {
    assert.deepEqual(DISSOLVE_STOPS[0], { at: 0, alpha: 1 });
    assert.deepEqual(DISSOLVE_STOPS[DISSOLVE_STOPS.length - 1], { at: 1, alpha: 0 });
    for (let index = 1; index < DISSOLVE_STOPS.length; index++) {
      assert.ok(DISSOLVE_STOPS[index].at > DISSOLVE_STOPS[index - 1].at);
      assert.ok(DISSOLVE_STOPS[index].alpha <= DISSOLVE_STOPS[index - 1].alpha);
    }
  });

  it('is never more than a hundredth off the curve between two stops', () => {
    for (let index = 1; index < DISSOLVE_STOPS.length; index++) {
      const from = DISSOLVE_STOPS[index - 1];
      const to = DISSOLVE_STOPS[index];
      const middle = (from.at + to.at) / 2;
      const drawn = (from.alpha + to.alpha) / 2;
      assert.ok(Math.abs(drawn - dissolveAt(middle)) < 0.01, `between ${from.at} and ${to.at}`);
    }
  });
});

describe('where the row sits in the fade', () => {
  it('sits in the lower dissolve portion of the art', () => {
    const showing = dissolveAt(ROW_ENTERS_AT);
    assert.ok(showing > 0.25 && showing < 0.35, `${showing}`);
  });

  it('rises about thirty dp into the hero, and never half a cover', () => {
    for (const hero of HERO_HEIGHTS) {
      const overlap = mastheadOverlap(hero);
      assert.ok(overlap >= 26 && overlap <= 42, `${hero}dp hero: ${overlap}`);
    }
  });

  it('retains clear visibility above the cover: around three quarters showing 34dp up', () => {
    const hero = 304;
    const showing = dissolveAt(ROW_ENTERS_AT - 34 / hero);
    assert.ok(showing > 0.7 && showing < 0.8, `${showing}`);
  });

  it('has let the art largely go by the title, 18dp under the top of the cover', () => {
    for (const hero of HERO_HEIGHTS) {
      assert.ok(dissolveAt(ROW_ENTERS_AT + 18 / hero) < 0.15, `${hero}dp hero`);
    }
  });
});

describe('the halo', () => {
  const cover = { width: 100, height: 150 };
  const { rx, ry } = haloRadii(cover.width, cover.height);

  it('shows about forty dp past the cover on every side', () => {
    assert.equal(rx - cover.width / 2, 40);
    assert.equal(ry - cover.height / 2, 51);
  });

  it('is three tenths at the middle of the cover’s sides, a little less above and below', () => {
    const side = haloAt(cover.width / 2 / rx);
    const top = haloAt(cover.height / 2 / ry);
    assert.ok(side > 0.28 && side < 0.32, `${side}`);
    assert.ok(top > 0.22 && top < side, `${top}`);
  });

  it('is still there at the cover’s corners, and gone at its own rim', () => {
    const corner = Math.hypot(cover.width / 2 / rx, cover.height / 2 / ry);
    assert.ok(corner < 1);
    assert.ok(haloAt(corner) > 0.04);
    assert.equal(haloAt(1), 0);
    assert.ok(haloAt(0.99) < 0.001);
  });

  it('is drawn as stops from its core to nothing, never rising', () => {
    assert.equal(HALO_STOPS[0].at, 0);
    assert.deepEqual(HALO_STOPS[HALO_STOPS.length - 1], { at: 1, alpha: 0 });
    for (let index = 1; index < HALO_STOPS.length; index++) {
      assert.ok(HALO_STOPS[index].alpha < HALO_STOPS[index - 1].alpha);
    }
  });
});

describe('the closed synopsis', () => {
  /* How much of the text shows at a height above the foot of the window, in
     lines — the reference measured 0.54 at the top of its third line's letters
     and 0.12 at its foot. */
  const showing = (linesAboveFoot: number) =>
    1 - ABOUT_FADE.depth * Math.max(0, 1 - linesAboveFoot / ABOUT_FADE.lines);

  it('is three lines, with the first and most of the second untouched', () => {
    assert.equal(ABOUT_LINES, 3);
    assert.equal(showing(ABOUT_LINES), 1);
    assert.equal(showing(1.25), 1);
  });

  it('leaves the third line readable at its top and nearly gone at its foot', () => {
    assert.ok(Math.abs(showing(0.6) - 0.54) < 0.04, `${showing(0.6)}`);
    assert.ok(Math.abs(showing(0) - 0.12) < 0.01, `${showing(0)}`);
  });
});
