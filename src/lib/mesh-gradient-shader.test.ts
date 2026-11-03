import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

import { MESH_SHADER } from './mesh-gradient-shader';

describe('the mesh gradient behind a copy', () => {
  it('compiles in Skia, with the uniforms the canvas sends', async () => {
    const require = createRequire(import.meta.url);
    const init = require('canvaskit-wasm/bin/full/canvaskit.js');
    const CanvasKit = await init({
      locateFile: (file: string) => require.resolve(`canvaskit-wasm/bin/full/${file}`),
    });
    let error = '';
    const effect = CanvasKit.RuntimeEffect.Make(MESH_SHADER, (message: string) => {
      error = message;
    });
    assert.ok(effect, error);
    const names = Array.from({ length: effect.getUniformCount() }, (_, i) =>
      effect.getUniformName(i)
    );
    /* `<MeshGradientSkia>` sends exactly these, by name. */
    assert.deepEqual(names, [
      'resolution',
      'time',
      'noise',
      'blur',
      'contrast',
      'color1',
      'color2',
      'color3',
      'color4',
    ]);
    effect.delete();
  });
});
