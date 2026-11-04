import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MAX_ANIMATED_BYTES,
  animatedFormatOf,
  igdbAnimatedCoverUrl,
  lightEnough,
  matchesAspect,
  pickPlayable,
  rankGrids,
  sgdbCandidates,
  type SgdbGrid,
} from './animated-cover.ts';

/* Hollow Knight's animated grids, as SteamGridDB answered them (2026-10-20). */
const WEBP: SgdbGrid = {
  url: 'https://cdn2.steamgriddb.com/grid/2cffdc4195ce6adf0a57062e4318662e.webp',
  thumb: 'https://cdn2.steamgriddb.com/thumb/2cffdc4195ce6adf0a57062e4318662e.webm',
  mime: 'image/webp',
  width: 600,
  height: 900,
  nsfw: false,
  epilepsy: false,
};
const APNG: SgdbGrid = {
  url: 'https://cdn2.steamgriddb.com/grid/58d8e2b3e0c6cef74a997f1b4b5497c7.png',
  thumb: 'https://cdn2.steamgriddb.com/thumb/58d8e2b3e0c6cef74a997f1b4b5497c7.webm',
  mime: 'image/png',
  width: 600,
  height: 900,
  nsfw: false,
  epilepsy: false,
};

describe('animatedFormatOf', () => {
  it('tells a video from an animated image by its extension', () => {
    assert.equal(animatedFormatOf(WEBP.thumb!), 'video');
    assert.equal(animatedFormatOf('https://x.test/a.mp4'), 'video');
    assert.equal(animatedFormatOf(WEBP.url!), 'image');
    assert.equal(animatedFormatOf(APNG.url!), 'image');
    assert.equal(animatedFormatOf('https://x.test/a.apng'), 'image');
    assert.equal(animatedFormatOf('https://x.test/a.gif'), 'image');
  });

  it('reads past a query and a fragment, and ignores case', () => {
    assert.equal(animatedFormatOf('https://x.test/a.WEBM?t=1#x'), 'video');
    assert.equal(animatedFormatOf('https://x.test/a.webp?size=2'), 'image');
  });

  it('knows nothing it cannot draw', () => {
    assert.equal(animatedFormatOf('https://x.test/a.jpg'), null);
    assert.equal(animatedFormatOf('https://x.test/noextension'), null);
  });
});

describe('sgdbCandidates', () => {
  const full = (grid: SgdbGrid) => ({
    url: grid.url,
    format: 'image',
    quality: 'full',
    width: grid.width,
    height: grid.height,
  });
  const preview = (grid: SgdbGrid) => ({ url: grid.thumb, format: 'video', quality: 'preview' });

  it('plays the full animation first — the WebM is a 267×400 preview', () => {
    assert.deepEqual(sgdbCandidates([WEBP], 'android'), [full(WEBP), preview(WEBP)]);
    assert.deepEqual(sgdbCandidates([APNG], 'web'), [full(APNG), preview(APNG)]);
  });

  it('tries every grid’s full animation before any grid’s preview', () => {
    assert.deepEqual(
      sgdbCandidates([WEBP, APNG], 'android').map((asset) => asset.url),
      [WEBP.url, APNG.url, WEBP.thumb, APNG.thumb]
    );
  });

  it('animates the image alone on iOS, which cannot open a WebM', () => {
    assert.deepEqual(sgdbCandidates([WEBP, APNG], 'ios'), [full(WEBP), full(APNG)]);
  });

  it('never offers a grid flagged for epilepsy or as NSFW', () => {
    assert.deepEqual(sgdbCandidates([{ ...WEBP, epilepsy: true }], 'android'), []);
    assert.deepEqual(sgdbCandidates([{ ...WEBP, nsfw: true }], 'ios'), []);
  });

  it('keeps SteamGridDB’s order within each kind', () => {
    const order = sgdbCandidates([APNG, WEBP], 'android').map((asset) => asset.url);
    assert.deepEqual(order, [APNG.url, WEBP.url, APNG.thumb, WEBP.thumb]);
  });

  it('falls back to the preview when a grid has no full animation it can draw', () => {
    assert.deepEqual(sgdbCandidates([{ ...WEBP, url: 'https://x.test/a.jpg' }], 'android'), [
      preview(WEBP),
    ]);
  });

  it('offers nothing iOS cannot play', () => {
    assert.deepEqual(sgdbCandidates([{ ...WEBP, url: 'https://x.test/a.jpg' }], 'ios'), []);
  });
});

describe('rankGrids', () => {
  it('drops a joke grid, as the owner asked', () => {
    assert.deepEqual(rankGrids([{ ...WEBP, humor: true }, APNG]), [APNG]);
    assert.deepEqual(sgdbCandidates([{ ...WEBP, humor: true }], 'android'), []);
  });

  it('puts the most liked first, then SteamGridDB’s own order', () => {
    const liked = { ...APNG, upvotes: 12, downvotes: 2 };
    const disliked = { ...WEBP, url: 'https://x.test/b.webp', upvotes: 0, downvotes: 3 };
    assert.deepEqual(rankGrids([WEBP, disliked, liked]), [liked, WEBP, disliked]);
    assert.deepEqual(rankGrids([APNG, WEBP]), [APNG, WEBP]);
  });
});

describe('pickPlayable', () => {
  /* Red Dead Redemption 2's files, as the lookup keeps them (2026-10-21). */
  const heavy = {
    url: 'https://x.test/rdr.webp',
    format: 'image' as const,
    quality: 'full' as const,
    bytes: 8_078_338,
  };
  const lighter = {
    url: 'https://x.test/b.webp',
    format: 'image' as const,
    quality: 'full' as const,
    bytes: 4_100_000,
  };
  const heavier = {
    url: 'https://x.test/c.png',
    format: 'image' as const,
    quality: 'full' as const,
    bytes: 9_000_000,
  };
  const preview = {
    url: 'https://x.test/rdr.webm',
    format: 'video' as const,
    quality: 'preview' as const,
    bytes: 1_200_000,
  };

  it('plays the first while nothing has failed', () => {
    assert.equal(pickPlayable([heavy, lighter, preview], new Set(), Infinity), heavy);
  });

  it('moves past a file that would not play, and every full one as heavy', () => {
    const failed = new Set([heavy.url]);
    assert.equal(pickPlayable([heavy, heavier, lighter, preview], failed, heavy.bytes), lighter);
  });

  it('never passes over a preview for a full file’s weight', () => {
    const failed = new Set([heavy.url, lighter.url]);
    assert.equal(pickPlayable([heavy, lighter, preview], failed, lighter.bytes), preview);
  });

  it('is none when everything has failed', () => {
    assert.equal(pickPlayable([heavy], new Set([heavy.url]), heavy.bytes), null);
    assert.equal(pickPlayable([], new Set(), Infinity), null);
  });
});

describe('matchesAspect', () => {
  it('reads a taller-than-wide IGDB cover as portrait', () => {
    assert.equal(matchesAspect(600, 800, 'portrait'), true);
    assert.equal(matchesAspect(600, 375, 'portrait'), false);
    assert.equal(matchesAspect(600, 600, 'portrait'), false);
  });

  it('reads a square to within a pixel in a hundred', () => {
    assert.equal(matchesAspect(600, 600, 'square'), true);
    assert.equal(matchesAspect(600, 605, 'square'), true);
    assert.equal(matchesAspect(600, 620, 'square'), false);
  });

  it('refuses a cover with no size', () => {
    assert.equal(matchesAspect(0, 0, 'square'), false);
    assert.equal(matchesAspect(Number.NaN, 600, 'portrait'), false);
  });
});

describe('igdbAnimatedCoverUrl', () => {
  it('asks for the WebP — IGDB’s PNG of an animated cover is a still frame', () => {
    assert.equal(
      igdbAnimatedCoverUrl('co4a6r'),
      'https://images.igdb.com/igdb/image/upload/t_720p/co4a6r.webp'
    );
  });
});

describe('lightEnough', () => {
  it('passes over Hollow Knight’s 18.7 MB portrait WebP for its 6.5 MB third', () => {
    assert.equal(lightEnough(18_690_280), false);
    assert.equal(lightEnough(6_500_000), true);
    assert.equal(lightEnough(1_399_028), true);
  });

  it('allows a size the server did not say', () => {
    assert.equal(lightEnough(null), true);
    assert.equal(lightEnough(MAX_ANIMATED_BYTES), true);
    assert.equal(lightEnough(MAX_ANIMATED_BYTES + 1), false);
  });
});

describe('which animations the hero’s blur can draw', () => {
  it('is an animated WebP, GIF or APNG, or a video', async () => {
    const { skiaAnimates } = await import('./animated-cover.ts');
    assert.equal(skiaAnimates('https://cdn2.steamgriddb.com/grid/a.webp'), true);
    assert.equal(skiaAnimates('https://images.igdb.com/x/t_720p/co4a6r.webp?x=1'), true);
    assert.equal(skiaAnimates('https://x/y.GIF'), true);
    assert.equal(skiaAnimates('https://cdn2.steamgriddb.com/grid/a.png'), true);
    assert.equal(skiaAnimates('https://cdn2.steamgriddb.com/thumb/a.webm'), true);
    assert.equal(skiaAnimates('https://x/a.APNG'), true);
    assert.equal(skiaAnimates('https://x/a.jpg'), false);
    assert.equal(skiaAnimates(null), false);
  });
});
