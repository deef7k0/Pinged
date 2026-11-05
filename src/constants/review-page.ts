/**
 * A review's own page, in numbers.
 *
 * Pure — its one import is a neighbour, by relative path — so `npm test`
 * loads it.
 *
 * ## The owner's screenshot, from their phone (2026-10-17, the third pass)
 *
 * "I've taken this from my phone, so you should be able to land the sizes 1:1…
 * FOLLOW THE SCREENSHOT, THE EXACT SAME STYLE, SIZES, GAPS." A review in a
 * music app, 720px across a 360dp phone: **two pixels a dp**, exactly. Every
 * number here is the screenshot's pixels halved, and `review-page.test.ts`
 * lays the page out from them and holds each line to where the screenshot has
 * it.
 *
 * Top to bottom: the game's **square** art as the hero, full width,
 * dissolving, and half the display tall as a collection's is (2026-10-21,
 * the one size here that is not the screenshot's); a row of the
 * writer's large face, their name with the score at the far end of its line,
 * the game's name in heavy type and "by" its developer; the quote, centred,
 * in quotation marks; the date; the review; how it was played, where the
 * screenshot has "Translate to English"; the platform, where it has the track
 * the listener liked; the like and share; "Replies"; and the reply composer
 * docked at the foot of the screen.
 *
 * The type is Inter, the app's, so each size is the one whose letters stand
 * as tall as the screenshot's — matched by x-height and capital height — and
 * the screenshot's face, a little narrower, fits a few more words a line.
 */

import { headerArtHeight } from './header-art';

/** dp per pixel of the screenshot. */
export const REFERENCE_SCALE = 0.5;

/** The page's side margin: the screenshot's text and face stand 34px in. */
export const REVIEW_MARGIN = 17;

/** The widest the column gets, on a tablet or the web. The hero is not capped. */
export const REVIEW_MAX_COLUMN = 560;

// ---------------------------------------------------------------------------
// Type
// ---------------------------------------------------------------------------

/**
 * A line of text: its size, its line, and which Inter file sets it. The
 * weight matters to where its glyphs sit — see `baselineIn`.
 */
export type ReviewLine = {
  size: number;
  line: number;
  weight: 'regular' | 'medium' | 'semibold' | 'bold' | 'extraBold';
};

/** Every line on the page. */
export const REVIEW_TYPE = {
  /** The writer's name, over the game's. */
  name: { size: 12, line: 16, weight: 'bold' },
  /** The score and its word, at the far end of the name's line: "87 AMAZING". */
  score: { size: 13, line: 16, weight: 'bold' },
  /** The game's name: the screenshot's strokes are a fifth of an em — the heaviest Inter the app ships. */
  title: { size: 22, line: 25, weight: 'extraBold' },
  /** "by" the developer. */
  credit: { size: 13, line: 18, weight: 'regular' },
  /** The date over the review. */
  date: { size: 12, line: 16, weight: 'regular' },
  /** The review. */
  body: { size: 14, line: 18, weight: 'regular' },
  /** How it was played, where the screenshot says "Translate to English". */
  details: { size: 12, line: 16, weight: 'regular' },
  /** The platform, where the screenshot has "♪ Japan". */
  platform: { size: 12, line: 16, weight: 'bold' },
  /** The like's count. */
  count: { size: 12, line: 16, weight: 'regular' },
  /** "Replies". */
  replies: { size: 13, line: 18, weight: 'regular' },
} as const satisfies Record<string, ReviewLine>;

/** A game's name is not cut on its own page, short of this. */
export const TITLE_LINES = 4;

/**
 * The game's name is tracked in a little, as the game page's is: the
 * screenshot's face is narrower than Inter at the same height.
 */
export const TITLE_TRACKING = -0.45;

// ---------------------------------------------------------------------------
// The hero
// ---------------------------------------------------------------------------

/**
 * The square art at the top, full width, and **as tall as a collection's
 * header art — half the display** (`constants/header-art`), at the owner's
 * direction of 2026-10-21: "Make the hero art in the review screen like the
 * collection's screen size-wise." It was the screenshot's — gone 526px down a
 * 720px-wide screen, 263dp, three quarters of the square — and was a
 * function of the width; it is now one of the height, so a tall phone shows
 * more of the art, as a collection's does. On a 360×780 display that is
 * 390dp: the whole square and a little more, cropped at its sides.
 *
 * It is dimmed: the screenshot's colours are about two thirds of the art's
 * own. Everything under the hero is measured from its foot, as the
 * screenshot's was, so nothing below it changed but where it starts.
 */
export const REVIEW_HERO = {
  /** Black over the whole art. */
  veil: 0.32,
} as const;

/** How tall the hero is drawn on a display this tall: a collection's header art. */
export function reviewHeroHeight(displayHeight: number): number {
  return headerArtHeight(displayHeight);
}

/**
 * The page's colour over the art, down the hero: none for its top third, then
 * close to a straight line to all of it at the foot — read off the
 * screenshot's art, column by column, from 190 to 526px.
 */
export const HERO_FADE: readonly { at: number; alpha: number }[] = [
  { at: 0, alpha: 0 },
  { at: 0.36, alpha: 0 },
  { at: 0.46, alpha: 0.08 },
  { at: 0.53, alpha: 0.22 },
  { at: 0.61, alpha: 0.41 },
  { at: 0.68, alpha: 0.52 },
  { at: 0.76, alpha: 0.63 },
  { at: 0.84, alpha: 0.76 },
  { at: 0.91, alpha: 0.84 },
  { at: 0.97, alpha: 0.92 },
  { at: 1, alpha: 1 },
];

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** The row under the hero: the writer's face beside the name, the score and the game. */
export const REVIEW_ROW = {
  /** From the foot of the hero to the top of the face. */
  top: 41,
  /** The writer's face: 144px. */
  avatar: 72,
  /** From the face to the text beside it. */
  avatarGap: 10,
  /** At least this between the name and the score at the end of its line. */
  scoreGap: 8,
  /** From the name's line to the game's. */
  titleTop: 1.5,
  /** From the game's name to "by" its developer: nothing — Inter's line has no slack to give back. */
  creditTop: 0,
} as const;

/** From the row to the quote, and from the quote to the date. */
export const QUOTE_GAP = 24;

/** From the row (or the quote) to the date. */
export const DATE_TOP = 24;

/** From the date to the review. */
export const ARTICLE_TOP = 6;

/** From the review to how it was played. */
export const DETAILS_TOP = 7;

/** The glyph before how it was played, and its distance from the words. */
export const DETAILS_ICON = { size: 15, gap: 7 } as const;

/** From how it was played to the platform. */
export const PLATFORM_TOP = 25;

/** The glyph before the platform, and its distance from it. */
export const PLATFORM_ICON = { size: 15, gap: 8 } as const;

/** The like and share: a row the height of the tap floor. */
export const LIKE_ROW = {
  height: 44,
  /** From the platform's line. */
  top: 15,
  /** From the review or how it was played, when no platform was recorded. */
  topAfterText: 24,
  heart: 18,
  heartGap: 8,
  share: 22,
} as const;

/** From the like row to "Replies". */
export const REPLIES_TOP = 29;

/** Between the last thing on the page and the composer docked under it. */
export const CONTENT_BOTTOM = 16;

/** The reply composer docked at the foot of the screen. */
export const COMPOSER = {
  /** In from each side of the screen: 27px. */
  side: 14,
  /** The top corners. The bottom meets the foot of the screen. */
  radius: 16,
  /** The field: the words start 31px in and 54px down. */
  inputSide: 15,
  inputTop: 11,
  /** What is typed. */
  text: 15,
  /** From the field to the row of keys under it. */
  keysTop: 14.5,
  /** The keys stand 21px in from the panel's sides and 24px over its foot. */
  keysSide: 10.5,
  keysBottom: 12,
  /** Bold and italic: 64 by 56px, a 12px corner, 8px apart. */
  key: { width: 32, height: 28, radius: 6, gap: 4, glyph: 13 },
  /** "0/500". */
  counter: 12,
  counterGap: 8.5,
  /** Send: a 68px circle. */
  send: 34,
  /** The screenshot's count: "0/500". */
  maxLength: 500,
} as const;

// ---------------------------------------------------------------------------
// Where a line's glyphs sit
// ---------------------------------------------------------------------------

/** Inter's vertical metrics, per em, read off the font files the app ships. */
export const FONT_METRICS = {
  ascent: 0.969,
  descent: 0.241,
  /** The bounding box's top and foot (`head.yMax` / `yMin`), per weight. */
  top: { regular: 1.108, medium: 1.109, semibold: 1.111, bold: 1.113, extraBold: 1.115 },
  bottom: { regular: 0.322, medium: 0.326, semibold: 0.331, bold: 0.334, extraBold: 0.339 },
  /** `OS/2.sxHeight` and `sCapHeight`. */
  xHeight: { regular: 0.546, medium: 0.546, semibold: 0.546, bold: 0.546, extraBold: 0.546 },
  capHeight: { regular: 0.728, medium: 0.728, semibold: 0.728, bold: 0.728, extraBold: 0.728 },
} as const;

/**
 * How far down its line box a line's baseline is, on Android — the owner's
 * platform.
 *
 * React Native sets a line height with `CustomLineHeightSpan`, which keeps as
 * much of the font as fits in this order: the descent, the ascent, the box's
 * foot, the box's top, and shares out what is left over. Inter's ascent and
 * descent are 1.21em, so a line tighter than that keeps its descent and cuts
 * its ascent.
 */
export function baselineIn({ size, line, weight }: ReviewLine): number {
  const ascent = FONT_METRICS.ascent * size;
  const descent = FONT_METRICS.descent * size;
  const top = FONT_METRICS.top[weight] * size;
  const bottom = FONT_METRICS.bottom[weight] * size;

  if (ascent + descent > line) return line - descent;
  if (ascent + bottom > line) return ascent;
  if (top + bottom > line) return line - bottom;
  return (line + top - bottom) / 2;
}
