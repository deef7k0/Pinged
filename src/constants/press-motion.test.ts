import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PRESS_MOTION, damping, keyframeSteps } from './press-motion.ts';

/** The damping ratio a physical spring has: c / 2√(k·m). */
const ratio = (s: { mass: number; stiffness: number; damping: number }) =>
  s.damping / (2 * Math.sqrt(s.stiffness * s.mass));

/** How far past its mark a spring released from rest goes, as a share of the travel. */
const overshoot = (zeta: number) =>
  zeta >= 1 ? 0 : Math.exp((-zeta * Math.PI) / Math.sqrt(1 - zeta * zeta));

describe('Convx’s press motion, as springs', () => {
  it('turns a Compose ratio into the damping that gives it', () => {
    assert.equal(damping(1, 400, 1), 40);
    assert.ok(Math.abs(ratio(PRESS_MOTION.press) - 0.5) < 1e-9);
    assert.ok(Math.abs(ratio(PRESS_MOTION.wobble) - 0.38) < 1e-9);
    assert.ok(Math.abs(ratio(PRESS_MOTION.play) - 0.6) < 1e-9);
    assert.ok(Math.abs(ratio(PRESS_MOTION.skip) - 1) < 1e-9);
    assert.ok(Math.abs(ratio(PRESS_MOTION.sheen) - 0.5) < 1e-9);
  });

  it('springs a control back past where it was, a little — a wobble, a lot', () => {
    const press = overshoot(ratio(PRESS_MOTION.press));
    assert.ok(press > 0.1 && press < 0.2, `${press}`);
    const wobble = overshoot(ratio(PRESS_MOTION.wobble));
    assert.ok(wobble > press, 'an icon wobbles more than a card bounces');
    /* A skip dip lands without passing its mark: the nudge is its movement. */
    assert.equal(overshoot(ratio(PRESS_MOTION.skip)), 0);
  });

  it('pops in 700ms and blinks in the first 110, hiding the glyph’s swap', () => {
    const steps = keyframeSteps(PRESS_MOTION.pop.scale);
    assert.equal(
      steps.reduce((sum, s) => sum + s.ms, 0),
      700
    );
    assert.deepEqual(
      steps.map((s) => s.to),
      [1.08, 1.56, 1.56, 1]
    );
    const blink = keyframeSteps(PRESS_MOTION.pop.blink);
    assert.equal(
      blink.reduce((sum, s) => sum + s.ms, 0),
      110
    );
    assert.equal(blink[blink.length - 1].to, 1, 'it ends seen');
    assert.equal(steps[steps.length - 1].to, 1, 'and at its own size');
  });
});
