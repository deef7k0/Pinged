import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

import {
  blurStart,
  COVER_FRONT_KNEE,
  coverFrontDrop,
  droppedRow,
  heroExtension,
  kneeDrop,
  TITLELESS_KNEE,
  PROGRESSIVE_BLUR,
  TAIL,
  blurShader,
  blurSourceUri,
  coverRect,
  footBlurPt,
  footFade,
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
      assert.deepEqual(names, ['size', 'side', 'pxPerPt', 'progress', 'drop', 'slide']);
      /* One child, which an image filter feeds with the layer under it. */
      assert.equal(effect.getUniformFloatCount(), 7);
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
  const { artworkExtent, heroExtent, knee, washFrom, washTo } = PROGRESSIVE_BLUR;

  it('is Convx’s artwork, 405/393 of a side, and the owner’s longer hero, 585/393', () => {
    assert.ok(Math.abs(artworkExtent * 393 - 405) < 1e-9);
    assert.ok(Math.abs(heroExtent * 393 - 585) < 1e-9);
    /* So the tail is 180/405 of the art: twice Convx's fifth. */
    assert.ok(Math.abs(TAIL - 180 / 405) < 1e-12);
  });

  it('begins the wash where the blur begins, to the thousandth, as Convx’s does', () => {
    assert.ok(Math.abs(washFrom - knee) < 0.002);
  });

  it('has the page’s colour whole before the tail’s foot, so nothing ends on an edge', () => {
    assert.ok(washTo < heroExtent);
    assert.equal(heroWash(heroExtent), 1);
    assert.equal(heroWash(knee - 0.01), 0, 'the art is untouched above the blur');
  });

  it('leaves most of the art at its own foot, for the longer tail to carry on', () => {
    const left = 1 - heroWash(artworkExtent);
    assert.ok(left > 0.55 && left < 0.75, `${left}`);
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
    while (footFade(whole) < 1) whole += 0.0005;
    assert.ok(whole < artworkExtent, `whole at ${whole}, the foot at ${artworkExtent}`);
    assert.ok(footBlurPt(artworkExtent) > 15, 'at the reflection’s first row');
    assert.equal(footBlurPt(heroExtent), 48, 'and at its last');
  });
});

describe('the blur’s top edge — a gradient, not a line', () => {
  const { knee, longKnee, fadeSpan } = PROGRESSIVE_BLUR;

  it('starts at the knee and ends a fadeSpan under it, for both heroes', () => {
    for (const k of [knee, longKnee]) {
      assert.equal(footFade(k, k), 0);
      assert.equal(footFade(k - 0.05, k), 0, 'nothing above the knee');
      assert.ok(footFade(k + fadeSpan + 1e-9, k) === 1);
    }
  });

  it('has no slope at either end and no jump between', () => {
    const step = 0.0005;
    assert.ok(footFade(knee + step) < 1e-6, 'eases out of nothing');
    assert.ok(1 - footFade(knee + fadeSpan - step) < 1e-6, 'eases into whole');
    for (let f = knee; f <= knee + fadeSpan; f += step) {
      assert.ok(footFade(f + step) - footFade(f) < 0.006, `jump at ${f}`);
    }
  });

  it('is longer than the old radius-led fade, which was whole at 7.5pt', () => {
    let old = knee;
    while (footBlurPt(old) < 7.5) old += 0.0005;
    assert.ok(knee + fadeSpan > old + 0.04, `${knee + fadeSpan} against ${old}`);
  });
});

describe('where the blur begins', () => {
  it('is Convx’s knee, in sides of the art', () => {
    assert.ok(Math.abs(blurStart(405) - 0.78 * 393) < 1e-9);
    assert.ok(Math.abs(blurStart(540) - 408.7) < 0.1);
  });
});

describe('the long hero — the game page’s and a studio’s', () => {
  const { knee, longKnee, longWashFrom, washTo } = PROGRESSIVE_BLUR;

  it('is already well blurred where the title stands, Convx’s knee', () => {
    assert.ok(footBlurPt(knee, longKnee) > 10, `${footBlurPt(knee, longKnee)}`);
    assert.equal(footBlurPt(knee), 0, 'where the short hero has only begun');
  });

  it('starts its wash a little under its blur, and is page colour by its foot', () => {
    assert.ok(longWashFrom > longKnee && longWashFrom < knee);
    assert.equal(heroWash(longWashFrom - 0.01, longWashFrom), 0);
    assert.ok(heroWash(knee, longWashFrom) > 0.1, 'rising behind the title');
    assert.equal(heroWash(washTo, longWashFrom), 1);
  });

  it('drops to just above the cover’s foot when the cover is in front', () => {
    const drop = coverFrontDrop(longKnee);
    assert.ok(longKnee + drop > 0.9 && longKnee + drop < PROGRESSIVE_BLUR.artworkExtent);
    assert.equal(coverFrontDrop(2), 0);
  });

  it('stands near the cover’s foot with the title off — under the cover in front', () => {
    const at = longKnee + kneeDrop(longKnee, TITLELESS_KNEE);
    assert.ok(at > 0.84 && at < COVER_FRONT_KNEE, `${at}`);
    assert.equal(kneeDrop(1, 0.5), 0);
  });

  it('moves the foot, never the climb, when it drops', () => {
    assert.match(blurShader('vertical'), /climbPt\(c\.y \/ side\)/);
  });

  it('starts lower when dropped, and is as heavy as ever at the cover’s foot and in its tail', () => {
    const drop = kneeDrop(longKnee, TITLELESS_KNEE);
    const foot = PROGRESSIVE_BLUR.artworkExtent;
    /* Nothing above the new start… */
    assert.equal(footBlurPt(droppedRow(TITLELESS_KNEE - 0.01, longKnee, drop), longKnee), 0);
    /* …the full weight at the foot, and the tail untouched. */
    assert.ok(Math.abs(droppedRow(foot, longKnee, drop) - foot) < 1e-9);
    assert.equal(droppedRow(1.2, longKnee, drop), 1.2);
    assert.ok(footBlurPt(droppedRow(foot - 0.001, longKnee, drop), longKnee) > 40);
    assert.ok(footFade(droppedRow(foot - 0.001, longKnee, drop), longKnee) > 0.999);
    /* With no drop it is the plain curve. */
    assert.ok(Math.abs(droppedRow(0.9, longKnee, 0) - 0.9) < 1e-9);
    /* Never backwards. */
    let previous = -Infinity;
    for (let f = 0; f <= 1.4; f += 0.001) {
      const row = droppedRow(f, longKnee, drop);
      assert.ok(row >= previous);
      previous = row;
    }
  });

  it('compiles with its own knee', () => {
    assert.ok(blurShader('vertical', longKnee).includes(`${longKnee}`));
  });
});

describe('the tail running on under low words', () => {
  it('is nothing while the words end above the whole wash, and reaches them when they do not', () => {
    const art = 480;
    const side = art / PROGRESSIVE_BLUR.artworkExtent;
    assert.equal(heroExtension(art, side * 1.2), 0);
    const extend = heroExtension(art, side * 1.6);
    assert.ok(Math.abs(PROGRESSIVE_BLUR.washTo + extend - 1.6) < 1e-9);
    assert.equal(heroExtension(0, 500), 0);
  });

  it('keeps the wash whole by the tail’s end, however far it runs', () => {
    const stops = washStops(PROGRESSIVE_BLUR.longWashFrom, 0.3);
    assert.equal(stops.alphas[stops.alphas.length - 1], 1);
    assert.equal(stops.alphas[0], 0);
  });
});
