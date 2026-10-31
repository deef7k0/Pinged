import * as THREE from 'three';

import { whileThreeRuns } from './three-globals';

/**
 * three.js on expo-gl, without expo-three.
 *
 * expo-three is a few lines of this plus `@expo/browser-polyfill`, which puts
 * a fake `document` and `window` on the global object for the whole app — and
 * this app has already been bitten once by a library deciding there was a DOM
 * (CLAUDE.md § Gotchas). So what it does is done here, and only here:
 *
 *  - **A canvas that is only a size**, given to three.js *and* hung on the
 *    context as `gl.canvas`. A browser's context points at its canvas, and
 *    three.js reads it there: `resetState()` sets the viewport to
 *    `gl.canvas.width`. expo-gl's context has no `canvas`, and the stage's
 *    second run on a phone stopped on "Cannot read property 'width' of
 *    undefined" for exactly that.
 *  - **`pixelStorei` limited to what expo-gl knows.** three.js sets every
 *    unpack parameter WebGL has on every state reset; expo-gl understands two
 *    and logs a line for each of the rest.
 *  - **The WebGL 1 check sidestepped.** three.js has refused WebGL 1 since
 *    r163 by testing `context instanceof WebGLRenderingContext` — and expo-gl
 *    57 makes its WebGL 2 context inherit from that class (`EXWebGLRenderer.cpp`),
 *    as the spec's interfaces do, so the test fails a context that *is*
 *    WebGL 2. For the length of the constructor that global is hidden. The
 *    caller checks WebGL 2 itself first (`supportsWebGL2`).
 *  - **Hermes's missing globals lent** for the constructor (`whileThreeRuns`);
 *    the caller does the same round `compile` and `render`.
 *
 * Platform-free, so the browser harness that renders this stage builds its
 * renderer through the same function, on a context made to look like
 * expo-gl's (no `canvas`, two `pixelStorei` parameters).
 */
export function makeRenderer(gl: WebGL2RenderingContext): THREE.WebGLRenderer {
  const context = gl as WebGL2RenderingContext & {
    pixelStorei: (pname: number, param: number | boolean) => void;
  };
  const pixelStorei = context.pixelStorei.bind(gl);
  context.pixelStorei = (pname, param) => {
    if (pname === gl.UNPACK_FLIP_Y_WEBGL || pname === gl.UNPACK_ALIGNMENT) {
      pixelStorei(pname, param as number);
    }
  };

  const canvas = {
    width: gl.drawingBufferWidth,
    height: gl.drawingBufferHeight,
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    clientWidth: gl.drawingBufferWidth,
    clientHeight: gl.drawingBufferHeight,
  } as unknown as HTMLCanvasElement;
  if (!(gl as { canvas?: unknown }).canvas) {
    Object.defineProperty(gl, 'canvas', { value: canvas, configurable: true });
  }

  const scope = globalThis as { WebGLRenderingContext?: unknown };
  const webgl1 = scope.WebGLRenderingContext;
  scope.WebGLRenderingContext = undefined;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = whileThreeRuns(
      () =>
        new THREE.WebGLRenderer({
          canvas,
          context: gl,
          alpha: true,
          premultipliedAlpha: true,
          antialias: false,
          powerPreference: 'high-performance',
        })
    );
  } finally {
    scope.WebGLRenderingContext = webgl1;
  }
  renderer.setPixelRatio(1);
  renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  return renderer;
}
