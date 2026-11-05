import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  cardLines,
  dragEnd,
  layoutWords,
  openingRange,
  rangeText,
  reviewWords,
  wordAt,
  type WordRange,
} from './review-highlight.ts';
import { textWidth } from './testkit/app-font.ts';

const REVIEW =
  'Hollow Knight is gorgeous.\r\nIt is also lonely, and far too long.\n\nThe bosses carry it.  Mostly.';

describe('the review as words', () => {
  const review = reviewWords(REVIEW);

  it('counts the line breaks between words, and reads \\r\\n as one', () => {
    assert.deepEqual(
      review.words.map((word) => word.breaks),
      [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0]
    );
  });

  it('gives back what was picked with its own spaces and line breaks', () => {
    assert.equal(rangeText(review, { first: 3, last: 5 }), 'gorgeous.\nIt is');
    assert.equal(rangeText(review, { first: 10, last: 13 }), 'too long.\n\nThe bosses');
    assert.equal(rangeText(review, { first: 15, last: 16 }), 'it.  Mostly.');
  });
});

describe('laying the words out', () => {
  const review = reviewWords(REVIEW);
  const layout = layoutWords(review.words, 200, 17, 26);

  it('starts a line at a break, and leaves one empty for two', () => {
    const lineOf = (text: string) => layout.words.find((word) => word.text === text)!.line;
    assert.equal(lineOf('It'), lineOf('gorgeous.') + 1);
    assert.equal(lineOf('The'), lineOf('long.') + 2);
  });

  it('keeps every line within its width, measured as the font file measures', () => {
    for (const word of layout.words) {
      assert.ok(word.x + textWidth(word.text, 17) <= 200 + 0.5, word.text);
    }
  });

  it('finds the word under a finger, and the nearest beside it', () => {
    const it2 = layout.words.findIndex((word) => word.text === 'It');
    const placed = layout.words[it2];
    assert.equal(wordAt(layout, placed.x + 2, placed.line * 26 + 10), it2);
    /* Far past the right of a line: that line's last word. */
    const lastOnLine = layout.words.filter((word) => word.line === placed.line).pop()!;
    assert.equal(wordAt(layout, 999, placed.line * 26 + 10), layout.words.indexOf(lastOnLine));
    /* On the empty line: a word on a line next to it. */
    const blank = layout.words.find((word) => word.text === 'The')!.line - 1;
    const near = layout.words[wordAt(layout, 10, blank * 26 + 10)];
    assert.ok(Math.abs(near.line - blank) === 1);
  });
});

describe('what the card holds', () => {
  const width = 272;

  it('counts lines as the font wraps them, a line break a line', () => {
    const text =
      'The bosses carry it, mostly; Hornet is the best of them and the Radiance the worst.';
    let lines = 1;
    let line = '';
    for (const word of text.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && textWidth(next, 22, '700Bold') > width) {
        lines++;
        line = word;
      } else line = next;
    }
    /* Measured a shade wide, so never fewer lines than the font's. */
    const counted = cardLines(text, width, 22);
    assert.ok(counted >= lines && counted <= lines + 1);
    assert.equal(cardLines('One.\n\nTwo.', width, 22), 3);
  });

  it('opens on the first few words', () => {
    const review = reviewWords(REVIEW);
    assert.deepEqual(
      openingRange(review, () => true),
      { first: 0, last: 5 }
    );
  });
});

describe('dragging an end', () => {
  /* A card that holds four words. */
  const fits = (range: WordRange) => range.last - range.first < 4;

  it('stretches the end, and gives words back when it is dragged back', () => {
    assert.deepEqual(dragEnd({ first: 2, last: 3 }, 'end', 4, fits), {
      range: { first: 2, last: 4 },
      limited: false,
    });
    assert.deepEqual(dragEnd({ first: 2, last: 5 }, 'end', 3, fits).range, { first: 2, last: 3 });
  });

  it('stops where the card is full, and says so', () => {
    assert.deepEqual(dragEnd({ first: 2, last: 3 }, 'end', 40, fits), {
      range: { first: 2, last: 5 },
      limited: true,
    });
    assert.deepEqual(dragEnd({ first: 10, last: 11 }, 'start', 0, fits), {
      range: { first: 8, last: 11 },
      limited: true,
    });
  });

  it('never lets one end pass the other', () => {
    assert.deepEqual(dragEnd({ first: 5, last: 8 }, 'end', 1, fits).range, { first: 5, last: 5 });
    assert.deepEqual(dragEnd({ first: 5, last: 8 }, 'start', 12, fits).range, {
      first: 8,
      last: 8,
    });
  });
});
