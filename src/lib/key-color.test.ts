import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import jpeg from 'jpeg-js';

import { contrast, luminance, toOklab } from './color.ts';
import {
  HERO_EDGES,
  KEY_PAGE_DARKEN,
  MAX_BRIGHT_LUMINANCE,
  getSecondaryTextColor,
  getTextColor,
  keyColorOf,
  keyGround,
  keyPage,
  relativeLuminance,
  visibleRegion,
  type EdgeWeights,
} from './key-color.ts';

type Paint = (x: number, y: number) => string;

/** An RGBA image `width` × `height`, each pixel the hex `paint` returns. */
function image(width: number, height: number, paint: Paint): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const hex = paint(x, y);
      data.set(
        [
          parseInt(hex.slice(1, 3), 16),
          parseInt(hex.slice(3, 5), 16),
          parseInt(hex.slice(5, 7), 16),
          255,
        ],
        (y * width + x) * 4
      );
    }
  }
  return data;
}

/** Oklab distance between two hexes: the measure the clustering uses. */
function distance(a: string, b: string): number {
  const p = toOklab(a)!;
  const q = toOklab(b)!;
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

/** Oklab hue, 0–360°. */
function hueOf(hex: string): number {
  const [, a, b] = toOklab(hex)!;
  return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
}

const FOOT_ONLY: EdgeWeights = { top: 0, right: 0, bottom: 1, left: 0 };

describe('the part of the image that is on screen', () => {
  it('is the middle of a 16:9 picture drawn into a square', () => {
    const region = visibleRegion({ width: 1920, height: 1080 }, { width: 400, height: 400 });
    assert.equal(region.top, 0);
    assert.equal(region.bottom, 1);
    assert.ok(Math.abs(region.right - region.left - 1080 / 1920) < 1e-9);
    assert.ok(Math.abs(region.left - (1 - 1080 / 1920) / 2) < 1e-9);
  });

  it('follows the anchor, as `contentPosition` does', () => {
    /* A 2:3 box in a collection's banner, anchored a fifth of the way down. */
    const region = visibleRegion(
      { width: 264, height: 396 },
      { width: 360, height: 400 },
      { x: 0.5, y: 0.22 }
    );
    const shown = 264 / 396 / (360 / 400);
    assert.ok(Math.abs(region.bottom - region.top - shown) < 1e-9);
    assert.ok(Math.abs(region.top - (1 - shown) * 0.22) < 1e-9);
  });

  it('is the whole image when a size is unknown', () => {
    assert.deepEqual(visibleRegion({ width: 0, height: 10 }, { width: 10, height: 10 }), {
      left: 0,
      top: 0,
      right: 1,
      bottom: 1,
    });
  });
});

describe('the key colour', () => {
  it('is the colour at the foot, not the colour of the picture', () => {
    /* A sky the colour of most of the image, and a red ground along its foot. */
    const data = image(60, 40, (_, y) => (y >= 36 ? '#B0201C' : '#2050C0'));
    const key = keyColorOf(data, 60, 40, { edges: FOOT_ONLY });
    assert.ok(key);
    assert.ok(distance(key.color, '#B0201C') < 0.01, key.color);
  });

  it('never answers with a frame round the picture', () => {
    /* A two-pixel magenta frame round an orange picture. */
    const data = image(64, 64, (x, y) =>
      x < 2 || y < 2 || x >= 62 || y >= 62 ? '#FF00FF' : '#E07A10'
    );
    const key = keyColorOf(data, 64, 64);
    assert.ok(key);
    assert.ok(distance(key.color, '#E07A10') < 0.01, key.color);
  });

  it('reads only the edges of what is shown', () => {
    /* Green at the sides of a 16:9 picture, yellow down its middle: drawn into
       a square, the green is cropped away, and so is not its colour. */
    const data = image(96, 54, (x) => (x < 28 || x >= 68 ? '#1E9E3A' : '#E8C21A'));
    const square = visibleRegion({ width: 96, height: 54 }, { width: 300, height: 300 });
    const key = keyColorOf(data, 96, 54, { region: square });
    const uncropped = keyColorOf(data, 96, 54);
    assert.ok(key && uncropped);
    assert.ok(distance(key.color, '#E8C21A') < 0.01, key.color);
    assert.ok(distance(uncropped.color, '#1E9E3A') < 0.01, 'the full frame is green at its edges');
  });

  it('prefers a colour to black when the colour is at least 30% as large', () => {
    const colour = keyColorOf(
      image(100, 20, (x, y) => (y >= 17 ? (x < 62 ? '#050505' : '#9C1A22') : '#404040')),
      100,
      20,
      { edges: FOOT_ONLY }
    );
    assert.ok(colour);
    assert.ok(distance(colour.color, '#9C1A22') < 0.01, colour.color);

    const black = keyColorOf(
      image(100, 20, (x, y) => (y >= 17 ? (x < 85 ? '#050505' : '#9C1A22') : '#404040')),
      100,
      20,
      { edges: FOOT_ONLY }
    );
    assert.ok(black);
    assert.ok(distance(black.color, '#050505') < 0.01, 'a colour under 30% does not win');
  });

  it('takes grain as one colour', () => {
    /* A red ground with JPEG-sized noise in every channel. */
    let seed = 7;
    const noise = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed % 25) - 12;
    };
    const hex = (value: number) => Math.min(255, Math.max(0, value)).toString(16).padStart(2, '0');
    const data = image(80, 40, (_, y) =>
      y >= 34 ? `#${hex(176 + noise())}${hex(32 + noise())}${hex(28 + noise())}` : '#202830'
    );
    const key = keyColorOf(data, 80, 40, { edges: FOOT_ONLY });
    assert.ok(key);
    assert.ok(key.share > 0.9, `one cluster, not a scatter (${key.share})`);
    assert.ok(distance(key.color, '#B0201C') < 0.03, key.color);
  });

  it('does not depend on the order the pixels were read in', () => {
    const colours = ['#9C1A22', '#1A6E9C', '#050505', '#E0C080'];
    const forward = image(40, 20, (x, y) => (y >= 17 ? colours[x % 4] : '#303030'));
    const backward = image(40, 20, (x, y) => (y >= 17 ? colours[(39 - x) % 4] : '#303030'));
    assert.deepEqual(
      keyColorOf(forward, 40, 20, { edges: FOOT_ONLY }),
      keyColorOf(backward, 40, 20, { edges: FOOT_ONLY })
    );
  });

  it('weights a hero’s foot over its sides and its top', () => {
    assert.ok(HERO_EDGES.bottom > HERO_EDGES.left);
    assert.equal(HERO_EDGES.left, HERO_EDGES.right);
    assert.ok(HERO_EDGES.left > HERO_EDGES.top);
  });

  it('is nothing when there is nothing to read', () => {
    assert.equal(keyColorOf(new Uint8Array(0), 0, 0), null);
    assert.equal(
      keyColorOf(
        image(3, 3, () => '#FFFFFF'),
        3,
        3,
        { region: { left: 0, top: 0, right: 0.1, bottom: 1 } }
      ),
      null
    );
  });
});

describe('on real heroes from IGDB', () => {
  /*
   * Three heroes the game page draws, as `t_cover_small` — the very file the
   * app decodes — chosen by `chooseHero` from the live catalogue on
   * 2026-10-23. Each is drawn into the game page's hero on a 360dp phone
   * (360 × 304), so the sides are cropped as they are on screen.
   */
  const fixture = (name: string) => {
    const decoded = jpeg.decode(
      readFileSync(new URL(`./fixtures/key-color/${name}.jpg`, import.meta.url)),
      { useTArray: true }
    );
    return { data: decoded.data, width: decoded.width, height: decoded.height };
  };

  it('stardew-valley: the teal of the hills, not the navy of the sky', () => {
    /* The case that decided it: Palette's dominant colour is the night sky,
       and a page that colour would meet the teal foot of the art in a seam. */
    const img = fixture('stardew-valley');
    const key = keyColorOf(img.data, img.width, img.height, {
      region: visibleRegion(img, { width: 360, height: 304 }),
    });
    assert.ok(key);
    const hue = hueOf(key.color);
    assert.ok(hue > 150 && hue < 230, `a teal, not a navy: ${key.color} at ${hue.toFixed(0)}°`);
  });
});

describe('the page: the key colour in a dark room', () => {
  const ink = '#9AA0A6';
  const keys = ['#FFFFFF', '#E8C21A', '#0B908C', '#C60713', '#C6C4C5', '#5A352C', '#7A3CC8'];

  it('holds the quiet ink at AA at rest, where everything is read', () => {
    for (const key of keys) {
      const { bright } = keyPage(key, { ink });
      assert.ok(
        contrast(ink, bright) >= 4.5,
        `${key} → ${bright}: ${contrast(ink, bright).toFixed(2)}`
      );
    }
  });

  it('is darker once the page has been read, and darker still is always safe', () => {
    for (const key of keys) {
      const { bright, dark } = keyPage(key, { ink });
      assert.ok(luminance(dark) < luminance(bright), key);
      assert.ok(contrast(ink, dark) >= 4.5, `${key} → ${dark}`);
    }
  });

  it('makes a step a reader can see, on a colour there is room to darken', () => {
    /*
     * Not on every game: art that is already near black gives two tones close
     * together, and a dark game's page is dark at both ends.
     *
     * How large the step is depends on the ink, because the ink is what bounds
     * the bright tone — the lighter the type, the brighter the page may be and
     * the further it has to fall. On the pages' own inks (`accent.quietInk`,
     * `textSecondary`) these same keys measure 1.8–1.9; this ink is darker
     * than either, which is the floor.
     */
    for (const key of ['#0B908C', '#C60713', '#C6C4C5', '#E8C21A']) {
      const { bright, dark } = keyPage(key, { ink });
      assert.ok(contrast(bright, dark) >= 1.4, `${key}: ${contrast(bright, dark).toFixed(2)}`);
    }
  });

  it('keeps the colour’s hue at both ends', () => {
    for (const key of ['#E8C21A', '#0B908C', '#C60713', '#7A3CC8']) {
      const { bright, dark } = keyPage(key, { ink });
      for (const tone of [bright, dark]) {
        const turned = Math.abs(hueOf(tone) - hueOf(key));
        assert.ok(Math.min(turned, 360 - turned) < 5, `${key} → ${tone}`);
      }
    }
  });

  it('never lightens a key that already holds', () => {
    assert.equal(keyPage('#1C1316', { ink }).bright, '#1C1316');
    assert.equal(keyPage('#0E1616', { ink }).bright, '#0E1616');
  });

  it('darkens by the one fraction, so both tones are one colour', () => {
    assert.ok(KEY_PAGE_DARKEN > 0 && KEY_PAGE_DARKEN < 1);
    assert.equal(keyGround('#0E1616', { ink }), '#0E1616');
  });

  it('caps bright luminance at MAX_BRIGHT_LUMINANCE to avoid neon red', () => {
    // Saturated neon red like RDR2
    const neonRed = '#D82828';
    assert.ok(relativeLuminance(neonRed) > MAX_BRIGHT_LUMINANCE);
    const bright = keyGround(neonRed);
    assert.ok(
      relativeLuminance(bright) <= MAX_BRIGHT_LUMINANCE,
      `expected ${bright} to have relativeLuminance <= ${MAX_BRIGHT_LUMINANCE}, got ${relativeLuminance(bright)}`
    );
  });
});

describe('Apple Music WCAG luminance text color rules', () => {
  it('relativeLuminance calculates accurate WCAG relative luminance', () => {
    assert.equal(Math.round(relativeLuminance('#000000') * 1000) / 1000, 0);
    assert.equal(Math.round(relativeLuminance('#ffffff') * 1000) / 1000, 1);
  });

  it('picks dark text (#1c1c1e) on light background (L > 0.5) and white on dark (L <= 0.5)', () => {
    assert.equal(getTextColor('#ffffff'), '#1c1c1e');
    assert.equal(getTextColor('#ffff80'), '#1c1c1e');
    assert.equal(getTextColor('#121212'), '#ffffff');
    assert.equal(getTextColor('#3f6186'), '#ffffff');
  });

  it('provides secondary text color adapting to luminance threshold', () => {
    assert.equal(getSecondaryTextColor('#ffffff'), 'rgba(60, 60, 67, 0.6)');
    assert.equal(getSecondaryTextColor('#121212'), 'rgba(235, 235, 245, 0.6)');
    assert.equal(getSecondaryTextColor('#3f6186'), 'rgba(235, 235, 245, 0.6)');
  });
});
