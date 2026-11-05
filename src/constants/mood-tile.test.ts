import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { luminance, toHsl } from '../lib/color';
import { GAME_GENRES } from './game-genres';
import { MOODS } from '../lib/games/moods';
import { advanceWidth } from '../lib/font-advance';
import {
  ART_OFFSET,
  ART_SIZE,
  ART_TURN,
  GRADIENT_TURN,
  INK_RATIO,
  LUMINANCE,
  NAME_LINES,
  NAME_TYPE,
  SATURATION_FLOOR,
  TILE_ASPECT,
  TILE_COLUMNS,
  TILE_GAP,
  TILE_PAD,
  TILE_RADIUS,
  inkContrast,
  tileGradient,
  tileSize,
} from './mood-tile';

/** The phones this ships to, narrowest to widest. */
const DISPLAYS = [320, 360, 375, 393, 412, 430];

/** The app's page margin (`Spacing.x16`, which is 15). */
const MARGIN = 15;

/**
 * Every hue a tile can stand for: the identity ramp, **read out of
 * `theme.ts`'s source**.
 *
 * It cannot be imported — `constants/theme.ts` imports `@/global.css`, which
 * `npm test` has no resolver for — and it must not be copied here, because a
 * copy would keep passing after somebody retunes a hue. So the file is parsed,
 * the way this suite reads a migration elsewhere.
 */
const RAMP: readonly (readonly [string, string])[] = (() => {
  const source = readFileSync(new URL('./theme.ts', import.meta.url), 'utf8');
  const keys = /export const IDENTITY_KEYS = \[([\s\S]*?)\]/.exec(source);
  assert.ok(keys, 'IDENTITY_KEYS is no longer an array literal in theme.ts');
  const named = [...keys[1].matchAll(/'(identity[A-Za-z]+)'/g)].map((match) => match[1]);
  assert.equal(named.length, 10, 'expected ten identity hues');
  return named.map((key) => {
    const hex = new RegExp(`\\b${key}: '(#[0-9A-Fa-f]{6})'`).exec(source);
    assert.ok(hex, `theme.ts has no hex for ${key}`);
    return [key, hex[1]] as const;
  });
})();

const HUES = RAMP.map(([, hex]) => hex);
const KEY_OF = RAMP.map(([key]) => key);

/** Every genre Home offers, by the word on its tile. */
const GENRE_LABELS = GAME_GENRES.map((genre) => genre.label);

/** How far apart two hue angles are, the short way round. */
function apart(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return Math.min(d, 360 - d);
}

describe('a mood tile, against MoodCategoryCard.kt', () => {
  it('is the reference’s block: 2:1, a 10dp corner, two to a row, twelve apart', () => {
    assert.equal(TILE_ASPECT, 2);
    assert.equal(TILE_RADIUS, 10);
    assert.equal(TILE_COLUMNS, 2);
    assert.equal(TILE_GAP, 12);
  });

  it('carries the reference’s cover: 64dp, turned 25°, offset 8 and 12 past the corner', () => {
    assert.equal(ART_SIZE, 64);
    assert.equal(ART_TURN, 25);
    assert.deepEqual({ ...ART_OFFSET }, { x: 8, y: 12 });
  });

  it('keeps the name clear of the turned cover, not merely of the corner', () => {
    /* The reference's own arithmetic for its 72: a 64dp square turned 25°
       grows to 64 × (cos 25° + sin 25°), spilling half that growth past each
       side, and it is already pushed 8dp past the tile's edge. */
    const radians = (ART_TURN * Math.PI) / 180;
    const turned = ART_SIZE * (Math.cos(radians) + Math.sin(radians));
    const inside = turned - (turned - ART_SIZE) / 2 - ART_OFFSET.x;
    assert.ok(TILE_PAD.end >= inside, `${TILE_PAD.end} < ${inside.toFixed(1)}`);
  });

  it('fits every mood’s and every genre’s name, measured in the font it is set in', () => {
    /* The names are one or two short words, so what has to fit is the longest
       unbreakable one — Inter SemiBold at 14 (`NAME_TYPE`), bounded here by
       the Bold table,
       which is the wider of the two the advance widths hold.

       `320` is left out on purpose: the reference's 72 is a constant measured
       for its own ~158dp phone tile, and on a 320dp display the tile is 139
       across and the longest names ellipsize — which is what the reference
       does there too. Everything from 360 up, the owner's phone included,
       fits. */
    const words = [...MOODS.map((mood) => mood.label), ...GENRE_LABELS].flatMap((label) =>
      label.split(/[\s-]/).filter(Boolean)
    );
    for (const display of DISPLAYS.filter((width) => width >= 360)) {
      const room = tileSize(display, MARGIN).width - TILE_PAD.start - TILE_PAD.end;
      for (const word of words) {
        const width = advanceWidth(word, NAME_TYPE.fontSize, 'bold');
        assert.ok(width <= room, `${display}dp: "${word}" is ${width.toFixed(0)}dp in ${room}dp`);
      }
    }
  });

  it('holds two lines of the name inside the tile', () => {
    /* The tile draws its name in `NAME_TYPE`. */
    const { height } = tileSize(360, MARGIN);
    assert.ok(TILE_PAD.top + NAME_LINES * NAME_TYPE.lineHeight + TILE_PAD.bottom <= height + 1);
  });

  it('fills the row at every width — two whole tiles, no rounding gap', () => {
    for (const display of DISPLAYS) {
      const { width, height } = tileSize(display, MARGIN);
      const room = display - MARGIN * 2;
      assert.ok(width * TILE_COLUMNS + TILE_GAP <= room, `${display}dp overflows`);
      assert.ok(width * TILE_COLUMNS + TILE_GAP > room - TILE_COLUMNS, `${display}dp leaves a gap`);
      assert.equal(height, Math.round(width / TILE_ASPECT), `${display}dp`);
    }
  });
});

describe('a mood tile’s gradient', () => {
  it('is the item’s own hue, turned — never a hash of its name', () => {
    for (const [index, hue] of HUES.entries()) {
      const [from, to] = tileGradient(hue);
      const own = toHsl(hue)!.h;
      /* Three degrees of slack: both stops are dark, where rounding a channel
         to eight bits moves the hue by more than it does mid-scale. */
      assert.ok(
        apart(toHsl(from)!.h, own) <= 3,
        `${KEY_OF[index]}: the deep stop is not its own hue`
      );
      assert.ok(
        apart(toHsl(to)!.h, own + GRADIENT_TURN) <= 3,
        `${KEY_OF[index]}: the rich stop is not its hue turned ${GRADIENT_TURN}°`
      );
    }
  });

  it('runs deep to rich, so the corner the name starts in is the dark one', () => {
    for (const [index, hue] of HUES.entries()) {
      const [from, to] = tileGradient(hue);
      assert.ok(luminance(from) < luminance(to), KEY_OF[index]);
      assert.ok(luminance(from) <= LUMINANCE.from + 0.005, KEY_OF[index]);
      assert.ok(luminance(to) <= LUMINANCE.to + 0.005, KEY_OF[index]);
    }
  });

  it('is never the muted label colour — a whole block of it reads grey', () => {
    for (const [index, hue] of HUES.entries()) {
      for (const stop of tileGradient(hue)) {
        assert.ok(
          toHsl(stop)!.s >= SATURATION_FLOOR - 0.01,
          `${KEY_OF[index]} ${stop}: saturation ${toHsl(stop)!.s.toFixed(2)}`
        );
      }
    }
  });

  it('sets the name in white at AA on all ten hues, everywhere on the tile', () => {
    for (const [index, hue] of HUES.entries()) {
      const worst = inkContrast(hue);
      assert.ok(worst >= INK_RATIO, `${KEY_OF[index]} ${hue}: ${worst.toFixed(2)}:1`);
    }
  });

  it('is as bright as it can be and still do that', () => {
    /* What holds `LUMINANCE.to` at this number rather than a rounder one:
       white clears AA on a surface at it, and fails a hundredth above — so no
       hue could pass there, whatever its saturation. If this fails, the stop
       is what to put back, not the threshold. */
    const whiteOn = (lum: number) => 1.05 / (lum + 0.05);
    assert.ok(whiteOn(LUMINANCE.to) >= INK_RATIO, `white fails AA at ${LUMINANCE.to}`);
    assert.ok(whiteOn(LUMINANCE.to + 0.01) < INK_RATIO, `${LUMINANCE.to} could be brighter`);
  });

  it('draws a flat block rather than nothing for a colour it cannot read', () => {
    assert.deepEqual(tileGradient('not a colour'), ['not a colour', 'not a colour']);
  });

  it('every mood’s hue is one of the ten the inks were measured on', () => {
    for (const mood of MOODS) {
      assert.ok(KEY_OF.includes(mood.hue), `${mood.key}: ${mood.hue}`);
    }
  });
});

describe('the reference it was read from', () => {
  it('is named in the docblock, with what it departs from', () => {
    const source = readFileSync(new URL('./mood-tile.ts', import.meta.url), 'utf8');
    for (const name of [
      'MoodCategoryCard.kt',
      'playlistTitleGradient',
      'angledGradientBackground',
    ]) {
      assert.ok(source.includes(name), `the docblock does not name ${name}`);
    }
  });
});
