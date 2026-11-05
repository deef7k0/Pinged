import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ARTICLE_TOP,
  COMPOSER,
  DATE_TOP,
  DETAILS_TOP,
  HERO_FADE,
  LIKE_ROW,
  PLATFORM_TOP,
  FONT_METRICS,
  REFERENCE_SCALE,
  REPLIES_TOP,
  REVIEW_MARGIN,
  REVIEW_ROW,
  REVIEW_TYPE,
  baselineIn,
  reviewHeroHeight,
  type ReviewLine,
} from './review-page';
import { HEADER_ART_SHARE } from './header-art';

/**
 * The owner's screenshot, as measured: rows of a 720px-wide phone screen. The
 * second screenshot was the same page scrolled 270px, so its rows are given
 * here with that added back.
 */
const PX = {
  width: 720,
  heroGone: 526,
  avatar: { top: 608, bottom: 752, left: 33 },
  name: { xTop: 629.5, baseline: 643.5 },
  stars: { top: 622, bottom: 647.5 },
  title: { capTop: 661.5, xTop: 669.5, baseline: 693.5 },
  credit: { xTop: 716.5, baseline: 731.5 },
  date: { capTop: 807, baseline: 823.5 },
  review: { xTop: 854.5, baseline: 870.5, pitch: 36, lines: 11, lastBaseline: 1230.5 },
  translate: { capTop: 1261, baseline: 1278.5 },
  japan: { baseline: 1359.5 },
  likeCentre: 1441,
  replies: { capTop: 1554.5, baseline: 1571.5 },
  composer: { top: 1330, placeholderBaseline: 1384.5, keysTop: 1424, foot: 1504 },
} as const;

const dp = (px: number) => px * REFERENCE_SCALE;

const xTop = (line: ReviewLine, baseline: number) =>
  baseline - FONT_METRICS.xHeight[line.weight] * line.size;
const capTop = (line: ReviewLine, baseline: number) =>
  baseline - FONT_METRICS.capHeight[line.weight] * line.size;

/**
 * The page on the screenshot's 360dp phone, laid out the way the screen lays
 * it out — from the foot of the hero down. The hero itself is a collection's
 * size now (2026-10-21), not the screenshot's, so the page is laid out from
 * where the screenshot's hero ended: every gap under it is still the
 * screenshot's.
 */
function layout() {
  const T = REVIEW_TYPE;
  const row = dp(PX.heroGone) + REVIEW_ROW.top;
  const avatarBottom = row + REVIEW_ROW.avatar;

  /* The name's line, the game's name and the credit, centred on the face. */
  const block =
    T.name.line + REVIEW_ROW.titleTop + T.title.line + REVIEW_ROW.creditTop + T.credit.line;
  const nameBox = row + (REVIEW_ROW.avatar - block) / 2;
  const titleBox = nameBox + T.name.line + REVIEW_ROW.titleTop;
  const creditBox = titleBox + T.title.line + REVIEW_ROW.creditTop;

  const dateBox = avatarBottom + DATE_TOP;
  const articleBox = dateBox + T.date.line + ARTICLE_TOP;
  const articleBottom = articleBox + PX.review.lines * T.body.line;
  const detailsBox = articleBottom + DETAILS_TOP;
  const platformBox = detailsBox + T.details.line + PLATFORM_TOP;
  const likeBox = platformBox + T.platform.line + LIKE_ROW.top;
  const repliesBox = likeBox + LIKE_ROW.height + REPLIES_TOP;

  return {
    row,
    avatarBottom,
    nameBaseline: nameBox + baselineIn(T.name),
    /* The score shares the name's line, centred on it. */
    scoreBaseline: nameBox + (T.name.line - T.score.line) / 2 + baselineIn(T.score),
    titleBaseline: titleBox + baselineIn(T.title),
    creditBaseline: creditBox + baselineIn(T.credit),
    dateBaseline: dateBox + baselineIn(T.date),
    firstBaseline: articleBox + baselineIn(T.body),
    lastBaseline: articleBox + (PX.review.lines - 1) * T.body.line + baselineIn(T.body),
    detailsBaseline: detailsBox + baselineIn(T.details),
    platformBaseline: platformBox + baselineIn(T.platform),
    likeCentre: likeBox + LIKE_ROW.height / 2,
    repliesBaseline: repliesBox + baselineIn(T.replies),
  };
}

/** Within a dp of the screenshot. */
function near(actual: number, expected: number, what: string, tolerance = 1) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${what}: ${actual.toFixed(2)} against the screenshot's ${expected.toFixed(2)}`
  );
}

describe('the hero', () => {
  it('is a collection’s header art: half the display tall', () => {
    assert.equal(HEADER_ART_SHARE, 0.5);
    assert.equal(reviewHeroHeight(780), 390);
    assert.equal(reviewHeroHeight(640), 320);
  });

  it('is taller than the screenshot’s on the screenshot’s phone, so more of the square shows', () => {
    assert.ok(reviewHeroHeight(780) > dp(PX.heroGone));
  });

  it('fades from nothing to the page, never back', () => {
    assert.deepEqual(HERO_FADE[0], { at: 0, alpha: 0 });
    assert.deepEqual(HERO_FADE.at(-1), { at: 1, alpha: 1 });
    for (let index = 1; index < HERO_FADE.length; index++) {
      assert.ok(HERO_FADE[index].at > HERO_FADE[index - 1].at);
      assert.ok(HERO_FADE[index].alpha >= HERO_FADE[index - 1].alpha);
    }
  });
});

describe('the row', () => {
  const page = layout();

  it('puts the face where the screenshot does, at its size', () => {
    near(page.row, dp(PX.avatar.top), 'face top');
    near(page.avatarBottom, dp(PX.avatar.bottom), 'face bottom');
    near(REVIEW_MARGIN, dp(PX.avatar.left), 'face left');
  });

  it('sets the name, the game and its developer on the screenshot’s lines', () => {
    const T = REVIEW_TYPE;
    near(page.nameBaseline, dp(PX.name.baseline), 'name baseline');
    near(xTop(T.name, page.nameBaseline), dp(PX.name.xTop), 'name x-height');
    near(page.titleBaseline, dp(PX.title.baseline), 'title baseline');
    near(capTop(T.title, page.titleBaseline), dp(PX.title.capTop), 'title caps');
    near(xTop(T.title, page.titleBaseline), dp(PX.title.xTop), 'title x-height');
    near(page.creditBaseline, dp(PX.credit.baseline), 'credit baseline');
    near(xTop(T.credit, page.creditBaseline), dp(PX.credit.xTop), 'credit x-height');
  });

  it('centres the score on the name’s line, where the stars are', () => {
    const figures = capTop(REVIEW_TYPE.score, page.scoreBaseline);
    near((figures + page.scoreBaseline) / 2, dp((PX.stars.top + PX.stars.bottom) / 2), 'score');
  });
});

describe('the review', () => {
  const page = layout();
  const T = REVIEW_TYPE;

  it('is dated over its first line', () => {
    near(page.dateBaseline, dp(PX.date.baseline), 'date baseline');
    near(capTop(T.date, page.dateBaseline), dp(PX.date.capTop), 'date figures');
  });

  it('is set at the screenshot’s size, on its line', () => {
    near(dp(PX.review.pitch), T.body.line, 'line', 0.01);
    near(page.firstBaseline, dp(PX.review.baseline), 'first baseline');
    near(xTop(T.body, page.firstBaseline), dp(PX.review.xTop), 'first x-height');
    near(page.lastBaseline, dp(PX.review.lastBaseline), 'last baseline');
  });

  it('is followed by how it was played, the platform, the like and Replies', () => {
    near(page.detailsBaseline, dp(PX.translate.baseline), 'details');
    near(capTop(T.details, page.detailsBaseline), dp(PX.translate.capTop), 'details caps');
    near(page.platformBaseline, dp(PX.japan.baseline), 'platform');
    near(page.likeCentre, dp(PX.likeCentre), 'like row');
    near(page.repliesBaseline, dp(PX.replies.baseline), 'replies');
    near(capTop(T.replies, page.repliesBaseline), dp(PX.replies.capTop), 'replies caps');
  });
});

describe('the composer', () => {
  /* A field with no line height is as tall as the font's box: its top and foot. */
  const field = (FONT_METRICS.top.regular + FONT_METRICS.bottom.regular) * COMPOSER.text;

  it('starts its words where the screenshot’s placeholder sits', () => {
    const baseline = COMPOSER.inputTop + FONT_METRICS.top.regular * COMPOSER.text;
    near(baseline, dp(PX.composer.placeholderBaseline - PX.composer.top), 'placeholder');
  });

  it('puts its keys, and its foot, where the screenshot’s are', () => {
    const keys = COMPOSER.inputTop + field + COMPOSER.keysTop;
    near(keys, dp(PX.composer.keysTop - PX.composer.top), 'keys');
    const height = keys + COMPOSER.key.height + COMPOSER.keysBottom;
    near(height, dp(PX.composer.foot - PX.composer.top), 'panel');
  });

  it('counts to the screenshot’s 500', () => {
    assert.equal(COMPOSER.maxLength, 500);
  });
});

describe('baselineIn', () => {
  it('keeps the descent and cuts the ascent of a line tighter than the font', () => {
    assert.equal(baselineIn({ size: 15, line: 17, weight: 'bold' }), 17 - 0.241 * 15);
  });

  it('sits on the ascent when the font fits and its box does not', () => {
    assert.equal(baselineIn({ size: 15, line: 19, weight: 'regular' }), 0.969 * 15);
  });

  it('shares out a loose line evenly round the box', () => {
    const line = { size: 10, line: 40, weight: 'regular' } as const;
    assert.equal(baselineIn(line), (40 + 11.08 - 3.22) / 2);
  });
});
