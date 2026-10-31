import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { whileThreeRuns } from './three-globals.ts';

type Scope = Record<string, unknown>;
const scope = globalThis as unknown as Scope;

/** Run `test` as if on Hermes: no FinalizationRegistry, no WeakRef. */
function onHermes(test: () => void) {
  const saved = { FinalizationRegistry: scope.FinalizationRegistry, WeakRef: scope.WeakRef };
  delete scope.FinalizationRegistry;
  delete scope.WeakRef;
  try {
    test();
  } finally {
    Object.assign(scope, saved);
  }
}

describe('three.js on Hermes', () => {
  it('lends a registry and a reference while three runs, and takes them back', () => {
    onHermes(() => {
      const thing = { id: 1 };
      const held = whileThreeRuns(() => {
        const Registry = scope.FinalizationRegistry as new (cleanup: () => void) => {
          register: (target: object, held: unknown, token?: object) => void;
          unregister: (token: object) => boolean;
        };
        const Ref = scope.WeakRef as new (target: object) => { deref: () => object };
        const registry = new Registry(() => {});
        registry.register(thing, 1, thing);
        registry.unregister(thing);
        return new Ref(thing);
      });
      /* What three keeps after the call still answers. */
      assert.equal(held.deref(), thing);
      assert.equal(typeof scope.FinalizationRegistry, 'undefined');
      assert.equal(typeof scope.WeakRef, 'undefined');
    });
  });

  it('takes them back when three throws', () => {
    onHermes(() => {
      assert.throws(() =>
        whileThreeRuns(() => {
          throw new Error('no WebGL 2');
        })
      );
      assert.equal(typeof scope.FinalizationRegistry, 'undefined');
    });
  });

  it('leaves the real ones alone where the engine has them', () => {
    const real = scope.FinalizationRegistry;
    const seen = whileThreeRuns(() => scope.FinalizationRegistry);
    assert.equal(seen, real);
    assert.equal(scope.FinalizationRegistry, real);
  });

  it('covers every place three creates one: its renderer’s geometries and textures', () => {
    /* If a new three.js creates either anywhere else — somewhere a call this
       app makes outside the constructor, `compile` and `render` could reach —
       this fails, and the stage's calls need looking at before upgrading. */
    /* The file the app bundles (its package exports nothing else by path). */
    const build = dirname(fileURLToPath(import.meta.resolve('three')));
    const module = readFileSync(join(build, 'three.module.js'), 'utf8');
    const core = readFileSync(join(build, 'three.core.js'), 'utf8');
    assert.equal(/new (FinalizationRegistry|WeakRef)\b/.test(core), false);

    const lines = module.split('\n');
    const owners = new Set<string>();
    lines.forEach((line, i) => {
      if (!/new (FinalizationRegistry|WeakRef)\b/.test(line)) return;
      for (let j = i; j >= 0; j -= 1) {
        const match = /^function (\w+)\(/.exec(lines[j]);
        if (match) {
          owners.add(match[1]);
          return;
        }
      }
    });
    assert.deepEqual([...owners].sort(), ['WebGLGeometries', 'WebGLTextures']);
  });
});
