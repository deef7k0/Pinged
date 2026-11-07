import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { choosePosterArt } from './poster-art.ts';

const keyArtWithLogo = { image_id: 'withlogo', width: 1920, height: 1080, artwork_type: 3 };
const keyArtClean = { image_id: 'clean', width: 1920, height: 1080, artwork_type: 2 };
const whiteLogo = { image_id: 'logo', width: 1200, height: 400, artwork_type: 5 };
const icon = { image_id: 'icon', width: 128, height: 128, artwork_type: 12 };
const shot = { image_id: 'shot', width: 1920, height: 1080 };

describe('choosePosterArt', () => {
  it('never puts the name on the card twice: no key art with a logo when one is drawn', () => {
    const art = choosePosterArt([keyArtWithLogo, keyArtClean, whiteLogo], [shot]);
    assert.equal(art.logo?.url.includes('logo'), true);
    assert.equal(art.artUrl?.includes('/clean.jpg'), true);
  });

  it('falls to a screenshot before key art with a logo, while a logo is drawn', () => {
    const art = choosePosterArt([keyArtWithLogo, whiteLogo], [shot]);
    assert.equal(art.artUrl?.includes('/shot.jpg'), true);
  });

  it('uses key art with its logo when that is all there is', () => {
    const art = choosePosterArt([keyArtWithLogo, whiteLogo], []);
    assert.equal(art.artUrl?.includes('/withlogo.jpg'), true);
  });

  it('keeps key art with its logo when there is no logo to draw', () => {
    const art = choosePosterArt([keyArtWithLogo, icon], [shot]);
    assert.equal(art.logo, null);
    assert.equal(art.artUrl?.includes('/withlogo.jpg'), true);
  });

  it('asks for the 1080p file, and answers nothing for nothing', () => {
    assert.equal(choosePosterArt([keyArtClean], []).artUrl?.includes('/t_1080p/'), true);
    assert.deepEqual(choosePosterArt([], []), { artUrl: null, logo: null });
    assert.deepEqual(choosePosterArt(null, undefined), { artUrl: null, logo: null });
  });
});
