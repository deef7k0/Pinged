import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  QUOTE_MAX,
  REVIEW_DISPLAYS,
  cardShows,
  displayOf,
  hasWriting,
  normaliseQuote,
} from './review-quote.ts';
import { PULL_QUOTE, quoteMarkSize } from '../constants/pull-quote.ts';
import { textWidth } from './testkit/app-font.ts';

/** The owner's own example (2026-10-16). */
const OWNER_EXAMPLE =
  'An open world masterpiece that everyone should play at least once in their lives.';

/*
 * The two narrowest places a quote is drawn, on a 360dp phone, restated from
 * the components (which import React Native and cannot be loaded here). In
 * both, the words now span the card's whole inside: the owner's references of
 * 2026-10-20 put the writing under the art rather than beside it
 * (`<LogCard>`) and above the writer rather than beside their face
 * (`<MemberReviewCard>`), so each gained what the art or the face was taking.
 *
 * - Surprise Me's review card, and still the narrower of the two — the
 *   owner's reference for the limit. The card is the square's column, 0.84 of
 *   the display (302), less 16 of padding and the hairline edge each side.
 * - A review card in a list (`<LogCard>`): the display less the page's 15
 *   each side, the card's 15 each side, and its edge.
 */
const SURPRISE_WIDTH = 302 - 2 * 16 - 2;
const LIST_WIDTH = 360 - 2 * 15 - 2 * 15 - 2;
/*
 * How many lines a card's quote takes: one centred text, broken at spaces as a
 * text view breaks it, the marks part of the first and last words and drawn
 * at their own, larger size.
 */
const linesAt = (text: string, width: number) => {
  const { fontSize } = PULL_QUOTE.card;
  const mark = textWidth('“', quoteMarkSize('card'));
  const words = text.split(' ');
  let lines = 1;
  let used = 0;
  words.forEach((word, index) => {
    let wide = textWidth(word, fontSize);
    if (index === 0) wide += mark;
    if (index === words.length - 1) wide += mark;
    const next = used === 0 ? wide : used + textWidth(' ', fontSize) + wide;
    if (used > 0 && next > width) {
      lines += 1;
      used = wide;
    } else {
      used = next;
    }
  });
  return lines;
};

/** One-line reviews of the length people write them. */
const SAMPLES = [
  OWNER_EXAMPLE,
  'A gorgeous, lonely descent that overstays its welcome by ten hours, but still.',
  'The best combat system I have played, wrapped around a story that barely exists.',
  'Beautiful, melancholic and far too short. I would happily play forty more hours.',
  'A perfect metroidvania: every shortcut you unlock feels like a reward you earned.',
  'Unbelievably tense from start to finish, and the final act left me speechless.',
  'Ambitious, broken, brilliant. Patch it twice and this could be game of the decade.',
  'The writing is sharp, the characters unforgettable, and the choices matter.',
  'A technical marvel with nothing to say. Stunning to look at, exhausting to play.',
  'Masterpiece.',
];

describe('the quote’s length', () => {
  it('is within what 0004’s CHECK allows', () => {
    assert.ok(QUOTE_MAX <= 140);
  });

  it('takes the owner’s example whole', () => {
    assert.ok(OWNER_EXAMPLE.length <= QUOTE_MAX, `${OWNER_EXAMPLE.length} > ${QUOTE_MAX}`);
  });

  it('is three lines on Surprise Me’s card, the owner’s reference', () => {
    for (const sample of SAMPLES) {
      assert.ok(sample.length <= QUOTE_MAX, `sample over the limit: ${sample}`);
      const lines = linesAt(sample, SURPRISE_WIDTH);
      assert.ok(lines <= 3, `${lines} lines at ${SURPRISE_WIDTH}dp: ${sample}`);
    }
  });

  it('puts the owner’s example on three lines in a list’s card too', () => {
    assert.ok(linesAt(OWNER_EXAMPLE, LIST_WIDTH) <= 3);
  });

  /*
   * The cards are wider than the cap was cut for (see `QUOTE_MAX`), and this
   * is what says so: every sample fits in three lines with a card's width to
   * spare. If a future layout takes that room back, this fails before the
   * three-line rule above does.
   */
  it('has room to spare on both, now the writing spans the card', () => {
    for (const sample of SAMPLES) {
      assert.ok(
        linesAt(sample, SURPRISE_WIDTH) <= 3 && linesAt(sample, LIST_WIDTH) <= 3,
        `over three lines: ${sample}`
      );
    }
  });
});

describe('normaliseQuote', () => {
  it('trims, and makes one line of it', () => {
    assert.equal(normaliseQuote('  A  slow\nburn. '), 'A slow burn.');
    assert.equal(normaliseQuote(null), '');
  });

  it('takes off a pair of marks the writer wrapped it in, since the app draws its own', () => {
    assert.equal(normaliseQuote('“Masterpiece.”'), 'Masterpiece.');
    assert.equal(normaliseQuote('"Masterpiece."'), 'Masterpiece.');
    assert.equal(normaliseQuote('«Chef-d’œuvre»'), 'Chef-d’œuvre');
  });

  it('keeps marks inside the sentence, and two quotes side by side', () => {
    assert.equal(normaliseQuote('The “open world” part drags.'), 'The “open world” part drags.');
    assert.equal(normaliseQuote('“Yes” and “no”'), '“Yes” and “no”');
  });
});

describe('what a card shows', () => {
  const both = { review: 'Long words.', review_title: 'Short.' };

  it('honours the writer’s choice when it can', () => {
    assert.equal(cardShows({ ...both, review_display: 'quote' }), 'quote');
    assert.equal(cardShows({ ...both, review_display: 'text' }), 'text');
  });

  it('reads a row from before 0040 — no such field — as the review', () => {
    assert.equal(cardShows(both), 'text');
    assert.equal(displayOf({}), 'text');
  });

  it('never goes blank because the chosen half is empty', () => {
    assert.equal(
      cardShows({ review: null, review_title: 'Short.', review_display: 'text' }),
      'quote'
    );
    assert.equal(
      cardShows({ review: 'Words.', review_title: '  ', review_display: 'quote' }),
      'text'
    );
    assert.equal(cardShows({ review: null, review_title: null, review_display: 'quote' }), null);
    /* A pair of marks with nothing between them is not a quote. */
    assert.equal(hasWriting({ review: ' ', review_title: '“”' }), false);
  });
});

describe('0040', () => {
  const migration = readFileSync(
    new URL('../../supabase/migrations/0040_review_quote.sql', import.meta.url),
    'utf8'
  );

  it('allows exactly the displays the app writes', () => {
    const check = migration.match(/check \(review_display in \(([^)]*)\)\)/);
    assert.ok(check, 'no CHECK on review_display');
    const values = check[1].split(',').map((value) => value.trim().replace(/'/g, ''));
    assert.deepEqual(values, [...REVIEW_DISPLAYS]);
  });

  it('defaults to the review, which is what every existing card shows', () => {
    assert.match(migration, /review_display text not null default 'text'/);
  });
});
