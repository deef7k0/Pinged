/**
 * What three.js expects of a browser and Hermes does not have, lent to it
 * while it runs and taken back after.
 *
 * three.js (r160 on) keeps a `FinalizationRegistry` and `WeakRef`s in two
 * of its renderer's books — the geometries and the textures it has uploaded
 * — so that an object collected without `dispose()` drops out of them.
 * Hermes has no `FinalizationRegistry` (seen on the owner's phone: "Property
 * 'FinalizationRegistry' doesn't exist", thrown by `new WebGLRenderer`), and
 * the copy stage could not start.
 *
 * Nothing on the copy stage relies on that cleanup: every geometry,
 * material and texture is disposed by hand (`CopyScene.dispose`,
 * `<CopyStageGL>`). So a registry that never fires and a reference that is
 * never weak change nothing here — the books are emptied by `dispose()` as
 * they always were.
 *
 * **Lent, not installed.** A global `FinalizationRegistry` that does nothing
 * would tell every other library that feature-detects one that it works, and
 * any that relied on it would leak instead of taking its own fallback. So the
 * stand-ins exist only for the length of a call into three.js — its
 * constructor, `compile` and `render`, which are the only places it creates
 * either (`three-globals.test.ts` reads three's source to hold that) — and
 * only where the engine lacks the real ones.
 */

class NoRegistry {
  register(): void {}
  unregister(): boolean {
    return false;
  }
}

class StrongRef<T extends object> {
  private readonly target: T;
  constructor(target: T) {
    this.target = target;
  }
  deref(): T {
    return this.target;
  }
}

const STAND_INS: Record<string, unknown> = {
  FinalizationRegistry: NoRegistry,
  WeakRef: StrongRef,
};

/** Run a call into three.js with the stand-ins lent for its length, where they are needed. */
export function whileThreeRuns<T>(run: () => T): T {
  const scope = globalThis as unknown as Record<string, unknown>;
  const lent: string[] = [];
  for (const name of Object.keys(STAND_INS)) {
    if (typeof scope[name] !== 'function') {
      scope[name] = STAND_INS[name];
      lent.push(name);
    }
  }
  if (lent.length === 0) return run();
  try {
    return run();
  } finally {
    for (const name of lent) delete scope[name];
  }
}
