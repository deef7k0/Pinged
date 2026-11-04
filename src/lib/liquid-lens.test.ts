import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

import { LENS, lensShader, lensShape } from './liquid-lens.ts';

describe('the tab bar’s lens — expo-liquid-lens’s', () => {
  it('compiles in Skia with the uniforms the tab bar sends', async () => {
    const require = createRequire(import.meta.url);
    const init = require('canvaskit-wasm/bin/full/canvaskit.js');
    const CanvasKit = await init({
      locateFile: (file: string) => require.resolve(`canvaskit-wasm/bin/full/${file}`),
    });
    let error = '';
    const effect = CanvasKit.RuntimeEffect.Make(lensShader(), (message: string) => {
      error = message;
    });
    assert.ok(effect, error);
    const names = Array.from({ length: effect.getUniformCount() }, (_, i) =>
      effect.getUniformName(i)
    );
    assert.deepEqual(names, [
      'center',
      'halfSize',
      'radius',
      'refraction',
      'depth',
      'tintWidth',
      'visibility',
      'activeColor',
      'pillColor',
      'pillOpacity',
    ]);
    effect.delete();
  });

  it('is its own size at rest, and the reference’s bend', () => {
    const shape = lensShape(40, 20, 0, 0);
    assert.deepEqual(shape, { halfWidth: 40, halfHeight: 20, refraction: LENS.refraction });
  });

  it('stretches and flattens with speed, to the reference’s 30%', () => {
    const fast = lensShape(40, 20, 10_000, 0);
    assert.ok(Math.abs(fast.halfWidth - 40 * 1.3) < 1e-9);
    assert.ok(Math.abs(fast.halfHeight - 20 * (1 - 0.3 * 0.55)) < 1e-9);
    assert.deepEqual(lensShape(40, 20, -2400, 0), lensShape(40, 20, 2400, 0));
  });

  it('swells and bends harder while pressed, never narrower than it is tall', () => {
    const pressed = lensShape(40, 20, 0, 1);
    assert.ok(pressed.halfHeight > 20 && pressed.halfWidth > 40);
    assert.ok(pressed.refraction > LENS.refraction);
    assert.ok(lensShape(5, 20, 0, 0).halfWidth >= 20);
  });
});
