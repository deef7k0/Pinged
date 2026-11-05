import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { contrast, luminance } from '../lib/color.ts';

/*
 * The tokens are read out of `theme.ts` as text. That file imports React
 * Native, so it cannot be loaded here — and copying the hexes into the test
 * would only prove the copy.
 */
const theme = readFileSync(new URL('./theme.ts', import.meta.url), 'utf8');
function token(name: string): string {
  const match = theme.match(new RegExp(`^\\s{4}${name}: '(#[0-9A-Fa-f]{6})',`, 'm'));
  assert.ok(match, `no ${name} token in constants/theme.ts`);
  return match[1];
}

/** The fill of every card in the app, the review card included. */
const card = token('surface');

/** WCAG AA for body text. */
const AA = 4.5;

describe('the card on the page', () => {
  /*
   * Apple's pair since the Apple pass (2026-11-04): the page is true black
   * and the card iOS's `secondarySystemBackground`, #1C1C1E — 1.24:1, the
   * step Apple Music and Apple TV draw a card on. It was the owner's #1B1F28
   * on #14171C (1.089:1) from 2026-10-20.
   *
   * It used to be the other way round — the review card was its own near-black
   * a shade *under* the page (1.03:1), which is why this file is named after
   * it. The band below is the new rule: a card is one perceptible step above
   * the page, and both pages are held to it, because the card is on Home and
   * on every other list.
   */
  for (const page of ['background', 'homeBackground']) {
    it(`is one step above \`${page}\``, () => {
      const ratio = contrast(card, token(page));
      assert.ok(ratio > 1.05 && ratio < 1.3, `card against ${page}: ${ratio.toFixed(3)}`);
    });

    it(`is lighter than \`${page}\``, () => {
      assert.ok(luminance(card) > luminance(token(page)));
    });
  }

  it('holds every ink set on it at AA', () => {
    for (const ink of ['text', 'textSecondary', 'textMuted', 'proseInk']) {
      const ratio = contrast(token(ink), card);
      assert.ok(ratio >= AA, `${ink} on the card: ${ratio.toFixed(2)}`);
    }
  });
});

describe('the surface ladder', () => {
  /*
   * `background` → `surface` → `surfaceElevated` → `surfaceSelected`, each a
   * step lighter than the last. This is not decoration: a control resting on a
   * card is drawn by being lighter than the card, so an `elevated` that fell
   * below `surface` would make every button inside a card a dark hole. It
   * nearly happened when the page and the card moved up — the ladder's old
   * middle (#15171D) is darker than the new card.
   */
  const ladder = ['background', 'surface', 'surfaceElevated', 'surfaceSelected'];

  it('only ever climbs', () => {
    for (let step = 1; step < ladder.length; step += 1) {
      const below = token(ladder[step - 1]);
      const above = token(ladder[step]);
      assert.ok(
        luminance(above) > luminance(below),
        `${ladder[step]} (${above}) is not above ${ladder[step - 1]} (${below})`
      );
    }
  });

  it('keeps every step perceptible and none of them loud', () => {
    for (let step = 1; step < ladder.length; step += 1) {
      const ratio = contrast(token(ladder[step]), token(ladder[step - 1]));
      assert.ok(
        ratio > 1.04 && ratio < 1.3,
        `${ladder[step - 1]} → ${ladder[step]}: ${ratio.toFixed(3)}`
      );
    }
  });

  it('puts a skeleton where a control rests, so it reads on a card', () => {
    assert.ok(luminance(token('skeleton')) > luminance(card));
  });

  it('holds `textMuted` at AA on a control, the tightest pair in the ladder', () => {
    const ratio = contrast(token('textMuted'), token('surfaceElevated'));
    assert.ok(ratio >= AA, `textMuted on a control: ${ratio.toFixed(2)}`);
  });
});

describe('every card is the review card', () => {
  /*
   * The owner's direction (2026-10-20): "make all the cards in the app with
   * that style of the review ones, with the same size and corner ratio and
   * stuff. Even the ones in the game page." One corner, one material
   * (`components/ui/card-material.ts`), and nothing still drawing the game
   * page's old description card — scaled corner and inset — by hand.
   */
  const radius = (name: string) => {
    const block = theme.slice(theme.indexOf('export const Radius = {'));
    const match = block.match(new RegExp(`^\\s{2}${name}: (\\d+),`, 'm'));
    assert.ok(match, `no Radius.${name} in constants/theme.ts`);
    return Number(match[1]);
  };

  it('gives a card the review card’s corner', () => {
    assert.equal(radius('card'), radius('review'));
  });

  it('draws no card with the old scaled corner or inset', () => {
    const root = fileURLToPath(new URL('..', import.meta.url));
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(name) && !name.endsWith('.test.ts')) {
          const text = readFileSync(path, 'utf8');
          if (/metrics\.card(Radius|Padding)|useSectionCardFill|Radius\.cardLarge/.test(text)) {
            offenders.push(path.slice(root.length));
          }
        }
      }
    };
    walk(root);
    assert.deepEqual(offenders, []);
  });
});
