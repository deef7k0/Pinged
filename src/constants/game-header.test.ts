import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PROGRESSIVE_BLUR, TITLELESS_KNEE, blurStart } from '../lib/progressive-blur';
import { GAME_HEADER, TITLELESS_WORDS_KNEE, coverHeight, wordsTop } from './game-header';

describe('the game page’s header', () => {
  it('draws the cover at its own shape, the display’s full width', () => {
    /* IGDB's commonest, 264×352, and a 2:3 one: each exactly, uncropped. */
    assert.equal(coverHeight(360, 352 / 264), 480);
    assert.equal(coverHeight(360, 1.5), 540);
    /* Not past the display's height cap any more — the page grows. */
    assert.equal(coverHeight(600, 1.5), 900);
  });

  it('assumes 3:4 until the shape is known, and bounds a shape that is no box', () => {
    assert.equal(coverHeight(360), Math.round(360 * GAME_HEADER.portraitRatio));
    assert.equal(coverHeight(360, null), 480);
    assert.equal(coverHeight(360, 0.2), 360);
    assert.equal(coverHeight(360, 9), 720);
  });

  it('stands the title where the blur begins', () => {
    const art = coverHeight(360, 1.5);
    assert.equal(wordsTop(art, 0, 100), Math.round(blurStart(art)));
    /* Under a "Coming" badge, the badge goes above the line. */
    assert.equal(wordsTop(art, 30, 100) + 30, Math.round(blurStart(art)));
  });

  it('follows the blur down when the page has no title', () => {
    const art = coverHeight(360, 1.5);
    assert.equal(wordsTop(art, 0, 100, TITLELESS_KNEE), Math.round(blurStart(art, TITLELESS_KNEE)));
    assert.ok(wordsTop(art, 0, 100, TITLELESS_KNEE) > wordsTop(art, 0, 100));
  });

  it('sets the title-less words on the blur, just above the cover’s foot', () => {
    assert.ok(TITLELESS_WORDS_KNEE > TITLELESS_KNEE);
    assert.ok(TITLELESS_WORDS_KNEE < PROGRESSIVE_BLUR.artworkExtent);
  });

  it('keeps the words clear of the top bar', () => {
    assert.equal(wordsTop(300, 400, 100), 100);
  });
});
