import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  logoInkOf,
  logoNeedsLightInk,
  logoTreatment,
  meanOpaqueLuminance,
  type LogoPixels,
} from './logo-ink.ts';

/**
 * Run with `npm test`.
 *
 * Fixtures are painted here, pixel by pixel, in the shapes the live catalogue
 * actually holds — the figures in the comments are what the real files
 * measured when the rule was written.
 */

type Rgba = readonly [number, number, number, number];

const CLEAR: Rgba = [0, 0, 0, 0];
const BLACK: Rgba = [0, 0, 0, 255];
const WHITE: Rgba = [255, 255, 255, 255];
const CHARCOAL: Rgba = [58, 58, 58, 255];
const BLUE: Rgba = [0, 120, 212, 255];
const RED: Rgba = [230, 0, 18, 255];
const GREY: Rgba = [103, 103, 103, 255];

/** A `width`×`height` image whose pixel at (x, y) is `paint(x, y)`. */
function image(width: number, height: number, paint: (x: number, y: number) => Rgba): LogoPixels {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      data.set(paint(x, y), (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

/** A band of ink across the middle of an otherwise clear square. */
const wordmark = (ink: Rgba) => image(20, 20, (_x, y) => (y >= 8 && y < 12 ? ink : CLEAR));

describe('logoInkOf', () => {
  it('measures a cut-out: its coverage, how dark it is, and no ground', () => {
    const ink = logoInkOf(wordmark(BLACK));
    assert.deepEqual(ink, { coverage: 0.2, dark: 1, ground: null });
  });

  it('counts only the opaque pixels as ink', () => {
    /* Half the band is black and half is blue; the clear pixels are neither. */
    const ink = logoInkOf(
      image(20, 20, (x, y) => (y >= 8 && y < 12 ? (x < 10 ? BLACK : BLUE) : CLEAR))
    );
    assert.equal(ink?.coverage, 0.2);
    assert.equal(ink?.dark, 0.5);
  });

  it('treats a nearly clear pixel as clear and a mostly solid one as ink', () => {
    const faint = logoInkOf(image(2, 2, () => [0, 0, 0, 127]));
    assert.equal(faint, null);
    const solid = logoInkOf(image(2, 2, () => [0, 0, 0, 128]));
    assert.equal(solid?.coverage, 1);
  });

  it('reads the ground of a picture with no cut-out from its corners', () => {
    const ink = logoInkOf(image(10, 6, (x, y) => (y === 3 && x > 2 && x < 7 ? WHITE : GREY)));
    assert.equal(ink?.coverage, 1);
    assert.equal(ink?.ground, '#676767');
  });

  it('has no ground when a corner is cut out', () => {
    const ink = logoInkOf(image(10, 10, (x, y) => (x === 0 && y === 0 ? CLEAR : WHITE)));
    assert.equal(ink?.ground, null);
  });

  it('is null for an image with nothing in it, or with too few bytes', () => {
    assert.equal(logoInkOf(image(4, 4, () => CLEAR)), null);
    assert.equal(logoInkOf({ width: 4, height: 4, data: new Uint8Array(8) }), null);
  });
});

describe('logoTreatment', () => {
  const treat = (pixels: LogoPixels) => logoTreatment(logoInkOf(pixels));

  it('puts an unmeasured logo on the light plate', () => {
    assert.deepEqual(logoTreatment(null), { kind: 'plate', color: null });
  });

  it('draws black ink cut out of nothing as a light silhouette (PlayStation 4)', () => {
    assert.deepEqual(treat(wordmark(BLACK)), { kind: 'silhouette' });
  });

  it('draws charcoal ink as a light silhouette too (Xbox Series X)', () => {
    assert.deepEqual(treat(wordmark(CHARCOAL)), { kind: 'silhouette' });
  });

  it('draws ink that already reads as it is (Windows)', () => {
    assert.deepEqual(treat(wordmark(BLUE)), { kind: 'asis' });
    assert.deepEqual(treat(wordmark(WHITE)), { kind: 'asis' });
  });

  it('gives a picture with its own ground a plate of that ground (PlayStation 5)', () => {
    const boxed = image(10, 6, (x, y) => (y === 3 && x > 2 && x < 7 ? WHITE : BLACK));
    assert.deepEqual(treat(boxed), { kind: 'plate', color: '#000000' });
  });

  it('lightens a cut-out whose wordmark is black beside a coloured mark (NES)', () => {
    /* A red roundel over a black line of type: a fifth of the ink is dark. */
    const mixed = image(20, 20, (_x, y) => (y >= 4 && y < 8 ? RED : y === 12 ? BLACK : CLEAR));
    assert.deepEqual(treat(mixed), { kind: 'silhouette' });
  });

  it('keeps a coloured cut-out with only a little dark in it as it is', () => {
    const outlined = image(20, 20, (x, y) => (y >= 4 && y < 14 ? (x === 0 ? BLACK : RED) : CLEAR));
    assert.deepEqual(treat(outlined), { kind: 'asis' });
  });

  it('keeps a filled badge with something light inside it as it is', () => {
    /* A black rounded square — its corners clear — holding a white glyph. */
    const badge = image(10, 10, (x, y) => {
      const corner = (x === 0 || x === 9) && (y === 0 || y === 9);
      if (corner) return CLEAR;
      return x >= 3 && x < 7 && y >= 3 && y < 7 ? WHITE : BLACK;
    });
    assert.deepEqual(treat(badge), { kind: 'asis' });
  });

  it('lightens a filled shape that is dark all over', () => {
    const roundel = image(10, 10, (x, y) => ((x === 0 || x === 9) && y === 0 ? CLEAR : BLACK));
    assert.deepEqual(treat(roundel), { kind: 'silhouette' });
  });
});

describe('a studio logo on its page', () => {
  /** One pixel of each run, `[r, g, b, alpha]`. */
  const solid = (r: number, g: number, b: number, alpha: number, count: number) => {
    const data = new Uint8Array(count * 4);
    for (let i = 0; i < count; i += 1) data.set([r, g, b, alpha], i * 4);
    return data;
  };

  it('measures the ink of the opaque pixels only', () => {
    assert.equal(meanOpaqueLuminance(solid(0, 0, 0, 255, 100)), 0);
    assert.equal(meanOpaqueLuminance(solid(255, 255, 255, 255, 100)), 1);
    assert.equal(meanOpaqueLuminance(solid(255, 255, 255, 0, 100)), null);
    const half = meanOpaqueLuminance(new Uint8Array([255, 255, 255, 255, 0, 0, 0, 0]));
    assert.equal(half, 1);
  });

  it('draws a dark logo light, and leaves a legible one as it is', () => {
    const page = '#1B1B1B';
    /* FromSoftware: pure black type. */
    assert.equal(logoNeedsLightInk(0, page), true);
    /* Mojang Studios: white type on a red block, mean luminance 0.46. */
    assert.equal(logoNeedsLightInk(0.461, page), false);
    /* Valve: bright red-orange, 0.25. */
    assert.equal(logoNeedsLightInk(0.248, page), false);
    /* Supergiant Games: dark red, 0.133 — 3.0:1 on this page, just on the floor. */
    assert.equal(logoNeedsLightInk(0.133, page), false);
    /* A navy wordmark (#1A2A5A, 0.025) would be 1.4:1: drawn light. */
    assert.equal(logoNeedsLightInk(0.025, page), true);
    /* Not measured (the web build has no decoder): drawn light. */
    assert.equal(logoNeedsLightInk(null, page), true);
  });
});
