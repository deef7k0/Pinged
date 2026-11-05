import { advanceWidth, type FontWeight } from './font-advance';

/**
 * Picking the part of a review that goes on its image — the owner's design
 * (2026-10-16), after Instagram's music slider rather than SimpMusic's list of
 * lines: the whole review is shown, a highlight sits over its first few words,
 * a tap moves it to one whole word, and holding an end and dragging stretches
 * or shrinks it — until the card is full, where it stops. Line breaks are kept,
 * on the screen and on the card.
 *
 * Every word is laid out here, from Poppins' advance widths, so the screen
 * knows where each one is: a finger's position is a word without asking the
 * platform, and the highlight and its two ends are drawn exactly round it.
 *
 * Pure: `review-highlight.test.ts`.
 */

/** One word of the review, and where it is in the text. */
export type ReviewWord = {
  text: string;
  /** Its first character, and one past its last, in `ReviewText.text`. */
  start: number;
  end: number;
  /** How many line breaks come between it and the word before it. */
  breaks: number;
};

export type ReviewText = { text: string; words: ReviewWord[] };

/** The review as words, its line breaks counted — `\r\n` and `\r` read as `\n`. */
export function reviewWords(review: string): ReviewText {
  const text = review.replace(/\r\n?/g, '\n').trim();
  const words: ReviewWord[] = [];
  let previousEnd = 0;
  const pattern = /\S+/g;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const start = match.index;
    const between = text.slice(previousEnd, start);
    words.push({
      text: match[0],
      start,
      end: start + match[0].length,
      breaks: (between.match(/\n/g) ?? []).length,
    });
    previousEnd = start + match[0].length;
  }
  return { text, words };
}

/** A run of words, first to last, both kept. Always next to each other. */
export type WordRange = { first: number; last: number };

/** What the picked words say, with the review's own spaces and line breaks. */
export function rangeText(review: ReviewText, range: WordRange): string {
  const first = review.words[range.first];
  const last = review.words[range.last];
  if (!first || !last) return '';
  return review.text.slice(first.start, last.end);
}

/** A word where it is drawn: its line, and its left edge and width on it. */
export type PlacedWord = ReviewWord & { line: number; x: number; width: number };

export type WordLayout = {
  words: PlacedWord[];
  lines: number;
  lineHeight: number;
  /** The width of a space at this size: half of it either side of a word is its. */
  space: number;
};

/**
 * The words as lines `width` wide: a line break starts a line (two leave one
 * empty), and a word that does not fit after the last starts the next.
 */
export function layoutWords(
  words: readonly ReviewWord[],
  width: number,
  fontSize: number,
  lineHeight: number,
  weight: FontWeight = 'regular'
): WordLayout {
  const space = advanceWidth(' ', fontSize, weight);
  const placed: PlacedWord[] = [];
  let line = 0;
  let x = 0;
  words.forEach((word, index) => {
    const wide = advanceWidth(word.text, fontSize, weight);
    if (index > 0) {
      if (word.breaks > 0) {
        line += word.breaks;
        x = 0;
      } else if (x + space + wide > width) {
        line += 1;
        x = 0;
      } else {
        x += space;
      }
    }
    placed.push({ ...word, line, x, width: wide });
    x += wide;
  });
  return {
    words: placed,
    lines: placed.length ? placed[placed.length - 1].line + 1 : 0,
    lineHeight,
    space,
  };
}

/**
 * The word at a point (x, y from the top left of the laid-out text): the one
 * on that line whose box — with half a space either side — holds x, or the
 * nearest on the line. A blank line, or a point past the last line, takes the
 * nearest line that has words.
 */
export function wordAt(layout: WordLayout, x: number, y: number): number {
  const { words } = layout;
  if (words.length === 0) return -1;
  const wanted = Math.max(0, Math.min(layout.lines - 1, Math.floor(y / layout.lineHeight)));

  let best = -1;
  let bestDistance = Infinity;
  let bestLineGap = Infinity;
  words.forEach((word, index) => {
    const lineGap = Math.abs(word.line - wanted);
    if (lineGap > bestLineGap) return;
    const left = word.x - layout.space / 2;
    const right = word.x + word.width + layout.space / 2;
    const distance = x < left ? left - x : x > right ? x - right : 0;
    if (lineGap < bestLineGap || distance < bestDistance) {
      best = index;
      bestDistance = distance;
      bestLineGap = lineGap;
    }
  });
  return best;
}

/**
 * How many lines `text` takes on the share card — its line breaks kept, each
 * paragraph broken at its spaces — in bold at `fontSize` across `width`. A
 * shade wide, as `fit-quote` measures, so the card is never the one that
 * cannot hold what was picked.
 */
export function cardLines(text: string, width: number, fontSize: number): number {
  const space = advanceWidth(' ', fontSize, 'bold') * CARD_SAFETY;
  let lines = 0;
  for (const paragraph of text.split('\n')) {
    lines += 1;
    let x = 0;
    for (const word of paragraph.split(' ').filter(Boolean)) {
      const wide = advanceWidth(word, fontSize, 'bold') * CARD_SAFETY;
      if (x > 0 && x + space + wide > width) {
        lines += 1;
        x = wide;
      } else {
        x += (x > 0 ? space : 0) + wide;
      }
    }
  }
  return lines;
}

const CARD_SAFETY = 1.03;

/**
 * The first few words, picked as the sheet opens so the card shows at once
 * what it will look like — fewer when even those would not fit.
 */
export function openingRange(
  review: ReviewText,
  fits: (range: WordRange) => boolean,
  count = 6
): WordRange | null {
  if (review.words.length === 0) return null;
  for (let last = Math.min(count, review.words.length) - 1; last >= 0; last--) {
    const range = { first: 0, last };
    if (fits(range)) return range;
  }
  return { first: 0, last: 0 };
}

/**
 * One end of the pick dragged to word `target` — from the pick as it was when
 * the drag began, so dragging back gives words back.
 *
 * The end cannot pass the other end (the pick is then that one word), and the
 * pick cannot outgrow the card: it stops at the last word that still fits, and
 * `limited` says the finger went further than the card would let it.
 */
export function dragEnd(
  from: WordRange,
  edge: 'start' | 'end',
  target: number,
  fits: (range: WordRange) => boolean
): { range: WordRange; limited: boolean } {
  if (edge === 'end') {
    const wanted = Math.max(from.first, target);
    if (wanted <= from.last) return { range: { first: from.first, last: wanted }, limited: false };
    /* Longer picks only ever take more lines: the furthest that fits is found
       by halving, not by trying every word on the way. */
    let low = from.last;
    let high = wanted;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (fits({ first: from.first, last: middle })) low = middle;
      else high = middle - 1;
    }
    return { range: { first: from.first, last: low }, limited: low < wanted };
  }

  const wanted = Math.min(from.last, target);
  if (wanted >= from.first) return { range: { first: wanted, last: from.last }, limited: false };
  let low = wanted;
  let high = from.first;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (fits({ first: middle, last: from.last })) high = middle;
    else low = middle + 1;
  }
  return { range: { first: low, last: from.last }, limited: low > wanted };
}
