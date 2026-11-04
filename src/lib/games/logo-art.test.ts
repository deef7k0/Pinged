import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LOGO_AREA, LOGO_MAX_HEIGHT, chooseLogo, gameLogoLook, logoBox } from './logo-art.ts';

const art = (image_id: string, width: number, height: number, artwork_type: number) => ({
  image_id,
  width,
  height,
  artwork_type,
});

const WHITE = 5;
const BLACK = 6;
const COLOUR = 7;
const KEY_ART = 2;

describe('chooseLogo', () => {
  it('has nothing to choose from no artworks, or none that is a logo', () => {
    assert.equal(chooseLogo(undefined), null);
    assert.equal(chooseLogo([]), null);
    assert.equal(chooseLogo([art('key', 1920, 1080, KEY_ART)]), null);
  });

  it('takes the white logo before the colour one, and the colour before the black', () => {
    /* Elden Ring's three, as IGDB has them (live, 2026-11-03). */
    const elden = [
      art('black', 5981, 920, BLACK),
      art('white', 5981, 920, WHITE),
      art('colour', 5981, 920, COLOUR),
    ];
    assert.match(chooseLogo(elden)!.url, /\/white\.png$/);
    assert.match(chooseLogo(elden.slice(0, 1).concat(elden[2]))!.url, /\/colour\.png$/);
  });

  it('draws a black logo white', () => {
    const logo = chooseLogo([art('hzd', 2560, 907, BLACK)])!;
    assert.equal(logo.tint, true);
    assert.equal(chooseLogo([art('w', 2560, 907, WHITE)])!.tint, false);
  });

  it('takes the widest of one kind', () => {
    /* Portal's two colour logos. */
    const logo = chooseLogo([art('small', 1280, 419, COLOUR), art('big', 3000, 965, COLOUR)])!;
    assert.match(logo.url, /\/big\.png$/);
  });

  it('asks for a PNG, at 720p only when the original is larger', () => {
    assert.equal(
      chooseLogo([art('big', 3000, 965, COLOUR)])!.url,
      'https://images.igdb.com/igdb/image/upload/t_720p/big.png'
    );
    assert.equal(
      chooseLogo([art('small', 640, 80, COLOUR)])!.url,
      'https://images.igdb.com/igdb/image/upload/t_original/small.png'
    );
  });

  it('passes over thumbnails and tall emblems', () => {
    assert.equal(chooseLogo([art('tiny', 120, 40, WHITE)]), null);
    assert.equal(chooseLogo([art('tall', 400, 900, WHITE)]), null);
    /* GTA V's near-square colour logo is fine. */
    assert.ok(chooseLogo([art('gta', 1106, 956, COLOUR)]));
  });

  it('passes over an artwork with no size', () => {
    assert.equal(chooseLogo([{ image_id: 'x', artwork_type: WHITE }]), null);
  });
});

describe('logoBox', () => {
  const area = (box: { width: number; height: number }) => box.width * box.height;

  it('draws Red Dead Redemption 2 about as it was, which the owner called decent', () => {
    const box = logoBox(1280 / 472, 328);
    assert.ok(box.width >= 255 && box.width <= 275, `${box.width}`);
  });

  it('gives a wide wordmark and a stacked one the same ground', () => {
    const wide = logoBox(3.06, 328); // Disco Elysium
    const stacked = logoBox(2, 328);
    assert.ok(Math.abs(area(wide) - LOGO_AREA) / LOGO_AREA < 0.03);
    assert.ok(Math.abs(area(stacked) - LOGO_AREA) / LOGO_AREA < 0.03);
    assert.ok(stacked.height > wide.height);
  });

  it('stops a strip at the width it has, and a tall one at its height', () => {
    const strip = logoBox(13.7, 328); // Phantom Blade Zero, cropped to its ink
    assert.equal(strip.width, 328);
    assert.equal(strip.height, Math.round(328 / 13.7));
    assert.equal(logoBox(0.8, 328).height, LOGO_MAX_HEIGHT);
  });
});

describe('gameLogoLook', () => {
  it('keeps a logo with a black band as it is (Disco Elysium)', () => {
    assert.equal(gameLogoLook({ coverage: 0.54, dark: 0.49, ground: null }), 'asis');
  });

  it('draws one that is dark all over white, and a boxed picture as the name', () => {
    assert.equal(gameLogoLook({ coverage: 0.2, dark: 0.95, ground: null }), 'white');
    assert.equal(gameLogoLook({ coverage: 1, dark: 0, ground: '#000000' }), 'name');
    assert.equal(gameLogoLook(null), 'asis');
  });
});
