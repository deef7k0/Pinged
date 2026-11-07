import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';

import { SCORE_BANDS } from './score';
import { SCORE_FIGURES, figureFor, figureHasMan } from './score-figure';

const root = new URL('../../', import.meta.url);
const asset = (name: string) => new URL(`assets/images/scores/${name}`, root);

describe('the drawing that stands for a score', () => {
  it('is the one the owner named, at each of the five scores they named', () => {
    assert.equal(figureFor(0), 'gone');
    assert.equal(figureFor(50), 'asleep');
    assert.equal(figureFor(70), 'seated');
    assert.equal(figureFor(80), 'forward');
    assert.equal(figureFor(100), 'standing');
  });

  it('is, for any other score, the one whose anchor is nearest', () => {
    for (let score = 0; score <= 100; score++) {
      const shown = SCORE_FIGURES.find((figure) => figure.key === figureFor(score))!;
      const distance = Math.abs(score - shown.anchor);
      for (const other of SCORE_FIGURES) {
        assert.ok(
          distance <= Math.abs(score - other.anchor),
          `${score} shows ${shown.key} but is nearer ${other.key}`
        );
      }
    }
  });

  it('changes at the midpoints between anchors, the higher drawing taking the tie', () => {
    for (let i = 0; i + 1 < SCORE_FIGURES.length; i++) {
      const upper = SCORE_FIGURES[i];
      const lower = SCORE_FIGURES[i + 1];
      assert.equal(upper.min, (upper.anchor + lower.anchor) / 2, upper.key);
      assert.equal(figureFor(upper.min), upper.key);
      assert.equal(figureFor(upper.min - 1), lower.key);
    }
  });

  it('covers 0 to 100, high to low, with no gap', () => {
    assert.equal(SCORE_FIGURES[SCORE_FIGURES.length - 1].min, 0);
    for (let i = 0; i + 1 < SCORE_FIGURES.length; i++) {
      assert.ok(SCORE_FIGURES[i].min > SCORE_FIGURES[i + 1].min);
      assert.ok(SCORE_FIGURES[i].anchor > SCORE_FIGURES[i + 1].anchor);
    }
  });

  it('never changes between two scores that share a verdict word', () => {
    const words = new Set(SCORE_BANDS.map((band) => band.min));
    for (const figure of SCORE_FIGURES) {
      assert.ok(words.has(figure.min), `${figure.key} starts at ${figure.min}, inside a word`);
    }
  });

  it('takes anything that is not a score as the lowest one', () => {
    assert.equal(figureFor(Number.NaN), 'gone');
    assert.equal(figureFor(-20), 'gone');
    assert.equal(figureFor(140), 'standing');
    assert.equal(figureFor(89.6), 'standing');
  });
});

describe('where the drawing is drawn', () => {
  /** Every component and route file that names the drawing's components. */
  function users(directory: URL, found: string[] = []): string[] {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
      if (entry.isDirectory()) users(url, found);
      else if (
        /\.tsx$/.test(entry.name) &&
        /\b(ScoreFigure|FiguredScore)\b/.test(readFileSync(url, 'utf8'))
      ) {
        found.push(url.pathname.slice(new URL('src/', root).pathname.length));
      }
    }
    return found;
  }

  it('is the ratings graph and a review’s own page, and nowhere else', () => {
    /* The owner, having seen it on every card: "For review cards, leave it as
       the square number. Only display the drawing for the game page graph,
       review sheet graph, and full-screen review." The graph is one component
       in both of its places. */
    assert.deepEqual(users(new URL('src/', root)).sort(), [
      'components/score-summary.tsx',
      'components/ui/score-figure.tsx',
      'components/ui/score-meter.tsx',
    ]);
  });

  it('leaves a review card the score as a number and its word', () => {
    /* The ruling above is about the *drawing*, and it still holds: neither
       review card names it. What the number itself looks like on them has
       changed once since — the owner's reference of 2026-10-20 sets the score
       where a music app sets its stars, so the square (`<ScoreTile>`) gave way
       to the number and its verdict (`<ScoreLine>`). The square is still what
       a score in a strip or a metadata row wears. The list card is the
       coloured card now (2026-11-06), whose score is the number alone. */
    const member = readFileSync(new URL('src/components/member-review-card.tsx', root), 'utf8');
    assert.match(member, /<ScoreLine score=\{rounded\} \/>|<ScoreLine score=\{rating\} \/>/);
    for (const file of ['log-card.tsx', 'review-landscape-card.tsx', 'member-review-card.tsx']) {
      const card = readFileSync(new URL(`src/components/${file}`, root), 'utf8');
      assert.doesNotMatch(card, /\b(ScoreFigure|FiguredScore)\b/, file);
    }
  });
});

describe('the drawings themselves', () => {
  it('each have their layers on disk: a tone, and the man where there is one', () => {
    for (const { key } of SCORE_FIGURES) {
      assert.ok(existsSync(asset(`${key}-tone.png`)), `${key}-tone.png`);
      assert.equal(existsSync(asset(`${key}-ink.png`)), figureHasMan(key), `${key}-ink.png`);
    }
  });

  it('have a man in all but the empty chair', () => {
    assert.deepEqual(
      SCORE_FIGURES.filter((figure) => !figureHasMan(figure.key)).map((figure) => figure.key),
      ['gone']
    );
  });

  it('are the five the script draws, and the component draws all five', () => {
    const script = readFileSync(new URL('scripts/score-figures.mjs', root), 'utf8');
    const component = readFileSync(new URL('src/components/ui/score-figure.tsx', root), 'utf8');
    for (const { key } of SCORE_FIGURES) {
      assert.match(script, new RegExp(`\\b${key}: \\(\\) =>`), `the script draws ${key}`);
      assert.match(component, new RegExp(`scores/${key}-tone\\.png`), `the app draws ${key}`);
    }
  });

  it('show the chair as a silhouette: one shape, nothing cut into it', () => {
    /* The owner, of a chair drawn with its cushions, piping, hinge and armrest:
       "all I want is the silhouette of the gaming chair, not every component
       visible". */
    const script = readFileSync(new URL('scripts/score-figures.mjs', root), 'utf8');
    const chair = script.slice(script.indexOf('function chair()'));
    const body = chair.slice(0, chair.indexOf('\n}\n'));
    assert.equal(body.match(/colour: 'tone'/g)?.length, 1, 'one part');
    assert.doesNotMatch(body, /knock:/);
  });

  it('give the man on his feet one arm, and it is holding the controller', () => {
    /* The arm he had in the air read as "a little pillow on the back of his
       head". */
    const script = readFileSync(new URL('scripts/score-figures.mjs', root), 'utf8');
    const standing = script.slice(script.indexOf('standing: () =>'));
    const pose = standing.slice(0, standing.indexOf('// ---'));
    assert.equal(pose.match(/holding\(/g)?.length, 1);
  });

  it('keep the man at 80 straight-backed, and the controller a bare slab', () => {
    /* Two things the owner asked for, saw, and took back: a hunch ("too much.
       Go back to the old one") and a controller with a trigger, a long finger
       on it and its grip poking out under his fist ("scuffed"). */
    const script = readFileSync(new URL('scripts/score-figures.mjs', root), 'utf8');
    assert.doesNotMatch(script, /\bspine\b/);
    const held = script.slice(script.indexOf('function held('));
    const unit = held.slice(0, held.indexOf('\n}\n'));
    const controller = unit.slice(unit.indexOf('const controller'), unit.indexOf('const hand'));
    assert.equal(controller.match(/\b(line|curve|dot|shape)\(/g)?.length, 1, 'one part');
    /* Three fingers, the same length to within a unit, and a thumb. */
    const fingers = [
      ...unit.matchAll(
        /line\(\s*\[\s*\[(-?[\d.]+), (-?[\d.]+)\],\s*\[(-?[\d.]+), (-?[\d.]+)\],?\s*\],\s*2\.6/g
      ),
    ].map((m) => Math.hypot(Number(m[3]) - Number(m[1]), Number(m[4]) - Number(m[2])));
    assert.equal(fingers.length, 3);
    assert.ok(Math.max(...fingers) - Math.min(...fingers) < 1, fingers.join(', '));
  });

  it('put no screen and no second chair in the picture', () => {
    /* The owner's two rules for the art: the man on his feet is the man alone,
       and nothing he could be looking at is ever drawn. */
    const script = readFileSync(new URL('scripts/score-figures.mjs', root), 'utf8');
    const standing = script.slice(script.indexOf('standing: () =>'));
    assert.doesNotMatch(standing.slice(0, standing.indexOf('// ---')), /chair\(\)/);
    assert.doesNotMatch(script, /\b(screen|television|monitor|tv)\s*\(/i);
  });
});
