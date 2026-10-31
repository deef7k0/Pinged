import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

import {
  PROGRESSIVE_BLUR,
  TAIL,
  blurShader,
  blurSourceUri,
  coverRect,
  footBlurPt,
  heroBlurPt,
  heroWash,
  washStops,
} from './progressive-blur.ts';

/* Convx's own assertions (`ArtistFootBlurTest.kt`), on the same curve. */
describe('the foot’s blur, Convx’s curve', () => {
  it('leaves zero smoothly, hits the measured point, caps', () => {
    assert.equal(footBlurPt(0.5), 0);
    assert.equal(footBlurPt(PROGRESSIVE_BLUR.knee), 0);
    assert.ok(footBlurPt(0.8) < 0.2, 'just past the knee it is still invisible');
    assert.ok(Math.abs(footBlurPt(0.995) - 12) <= 1);
    assert.equal(footBlurPt(1.3), 48);
    let previous = 0;
    for (let f = 0.7; f <= 1.3; f += 0.001) {
      const value = footBlurPt(f);
      assert.ok(value - previous < 0.4, `a step at ${f}`);
      previous = value;
    }
  });
});

describe('the climb as the page scrolls', () => {
  it('is the foot at rest', () => {
    for (const f of [0.2, 0.78, 0.9, 1.0]) {
      assert.ok(Math.abs(heroBlurPt(f, 0) - footBlurPt(f)) < 0.001);
    }
  });

  it('covers the whole picture once scrolled, and never steps or shrinks', () => {
    assert.ok(heroBlurPt(0, 1) > 20, 'the top of the art is soft');
    for (let p = 0; p <= 1; p += 0.05) {
      let previous = heroBlurPt(0, p);
      for (let f = 0.001; f <= 1; f += 0.001) {
        const value = heroBlurPt(f, p);
        assert.ok(Math.abs(value - previous) < 0.5, `a step at f=${f} p=${p}`);
        assert.ok(value + 0.001 >= heroBlurPt(f, Math.max(0, p - 0.05)), `shrinks at ${f}, ${p}`);
        previous = value;
      }
    }
  });
});

describe('the shader', () => {
  it('compiles in Skia, both passes, with the uniforms the canvas sends', async () => {
    const require = createRequire(import.meta.url);
    const init = require('canvaskit-wasm/bin/full/canvaskit.js');
    const CanvasKit = await init({
      locateFile: (file: string) => require.resolve(`canvaskit-wasm/bin/full/${file}`),
    });
    for (const axis of ['horizontal', 'vertical'] as const) {
      let error = '';
      const effect = CanvasKit.RuntimeEffect.Make(blurShader(axis), (message: string) => {
        error = message;
      });
      assert.ok(effect, `${axis}: ${error}`);
      const names = Array.from({ length: effect.getUniformCount() }, (_, i) =>
        effect.getUniformName(i)
      );
      assert.deepEqual(names, ['size', 'side', 'pxPerPt', 'progress']);
      /* One child, which an image filter feeds with the layer under it. */
      assert.equal(effect.getUniformFloatCount(), 5);
      effect.delete();
    }
  });

  it('writes the curve’s own numbers', () => {
    const source = blurShader('vertical');
    for (const value of [207, 1.855, 48, 28, 0.78, 1.1, -0.6, 1.3, -0.05]) {
      assert.ok(source.includes(String(value)), `${value}`);
    }
  });
});

describe('the art it is drawn over', () => {
  it('covers its box as expo-image does, at the anchor asked for', () => {
    const box = { width: 360, height: 304 };
    const wide = coverRect({ width: 1920, height: 1080 }, box, 0.5, 0.5);
    assert.equal(Math.round(wide.height), 304);
    assert.ok(wide.width > 360 && Math.abs(wide.x + (wide.width - 360) / 2) < 1e-9);
    const tall = coverRect({ width: 600, height: 900 }, box, 0.5, 0.22);
    assert.equal(tall.width, 360);
    assert.ok(Math.abs(tall.y - (304 - 540) * 0.22) < 1e-9, 'a fifth of the way down');
  });

  it('is made from IGDB’s 720p where the page draws its 1080p', () => {
    assert.equal(
      blurSourceUri('https://images.igdb.com/igdb/image/upload/t_1080p/ar5w.jpg'),
      'https://images.igdb.com/igdb/image/upload/t_720p/ar5w.jpg'
    );
    const steam = 'https://shared.steamstatic.com/store_item_assets/steam/apps/1/library_hero.jpg';
    assert.equal(blurSourceUri(steam), steam);
  });
});

describe('the mirrored tail and the wash — Convx’s artist page', () => {
  const { artworkExtent, heroExtent, knee, washFrom, washTo, fadeIn } = PROGRESSIVE_BLUR;

  it('is Convx’s geometry: the artwork 405/393 of a side, the hero 495/393', () => {
    assert.ok(Math.abs(artworkExtent * 393 - 405) < 1e-9);
    assert.ok(Math.abs(heroExtent * 393 - 495) < 1e-9);
    /* So the tail is 90/405 of the art: about a fifth. */
    assert.ok(Math.abs(TAIL - 90 / 405) < 1e-12);
  });

  it('begins the wash where the blur begins, to the thousandth, as Convx’s does', () => {
    assert.ok(Math.abs(washFrom - knee) < 0.002);
  });

  it('has the page’s colour whole before the tail’s foot, so nothing ends on an edge', () => {
    assert.ok(washTo < heroExtent);
    assert.equal(heroWash(heroExtent), 1);
    assert.equal(heroWash(knee - 0.01), 0, 'the art is untouched above the blur');
  });

  it('leaves about two fifths of the art at its own foot, for the tail to carry on', () => {
    const left = 1 - heroWash(artworkExtent);
    assert.ok(left > 0.3 && left < 0.45, `${left}`);
  });

  /* Convx's own test (ArtistFootBlurTest.kt): no jump, no break in slope. */
  it('is continuous and smooth end to end', () => {
    assert.equal(heroWash(washFrom), 0);
    assert.ok(Math.abs(heroWash((washFrom + washTo) / 2) - 0.5) < 0.001);
    let previous = heroWash(0);
    let previousSlope = 0;
    for (let f = 0.001; f <= heroExtent; f += 0.001) {
      const value = heroWash(f);
      const slope = (value - previous) / 0.001;
      assert.ok(Math.abs(value - previous) < 0.004, `jump at ${f}`);
      assert.ok(Math.abs(slope - previousSlope) < 0.2, `slope break at ${f}`);
      previous = value;
      previousSlope = slope;
    }
  });

  it('is drawn as a gradient over the art and its tail, top to foot', () => {
    const { locations, alphas } = washStops();
    assert.equal(locations.length, alphas.length);
    assert.equal(locations[0], 0);
    assert.equal(locations[locations.length - 1], 1);
    assert.equal(alphas[0], 0);
    assert.equal(alphas[alphas.length - 1], 1);
    for (let i = 1; i < alphas.length; i += 1) assert.ok(alphas[i] >= alphas[i - 1]);
  });

  it('is never seen sharp: the blur is whole before the art’s foot, and heavy in the tail', () => {
    /* The row where the blurred copy has fully faded in. */
    let whole = knee;
    while (footBlurPt(whole) < fadeIn) whole += 0.0005;
    assert.ok(whole < artworkExtent, `whole at ${whole}, the foot at ${artworkExtent}`);
    assert.ok(footBlurPt(artworkExtent) > 15, 'at the reflection’s first row');
    assert.equal(footBlurPt(heroExtent), 48, 'and at its last');
  });
});
