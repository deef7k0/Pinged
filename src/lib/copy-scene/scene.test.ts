import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as THREE from 'three';

import { STAGE_CAMERA, turnX, turnZ } from '../stage-geometry.ts';
import { createCopyScene, type ScenePose, type SceneSpec } from './scene.ts';

/*
 * The 3D stage draws; the flat stage decides. These hold the one promise that
 * makes that true: the scene's camera is the flat stage's, so a case at a
 * given turn is drawn exactly where `lib/stage-geometry` puts it — which is
 * also where the stage's taps look for it.
 */

const W = 295;
const H = 370;
const DEPTH = 31;
const DISC = 262;
/* A canvas whose middle is not the object's: the lens has to be offset. */
const CANVAS = { width: 360, height: 560, centreX: 180, centreY: 236 };

function spec(extra: Partial<SceneSpec> = {}): SceneSpec {
  return {
    caseWidth: W,
    caseHeight: H,
    depth: DEPTH,
    disc: DISC,
    cased: true,
    opens: true,
    sealed: false,
    printedEdges: false,
    trayRecess: 0.2,
    coverArea: { x: 0, y: 0.11, width: 1, height: 0.89 },
    scanRect: null,
    editionHeight: 0,
    radius: 7,
    bareRadius: 4,
    discTemplate: {
      width: 890,
      height: 897,
      cx: 450.5,
      cy: 448,
      outerRadius: 427,
      artRadius: 421,
      hubRadius: 156,
    },
    discFormat: 'cd',
    discDiameterMm: 120,
    discTransmittance: [1, 1, 1],
    manual: true,
    inserts: false,
    colours: {
      plasticTop: '#17181A',
      plasticBottom: '#0E0F11',
      rule: '#2A2B2E',
      edge: '#0D47A1',
      blank: '#1F2430',
      paper: '#E9EAEC',
      insert: '#9A9DA3',
      light: '#A8C8FF',
    },
    ...extra,
  };
}

const REST: ScenePose = {
  theta: 0,
  scale: 1,
  shift: 0,
  drop: 0,
  swing: 0,
  here: true,
  discShown: false,
  discX: 0,
  discZ: 0,
  discAngle: 0,
  discScale: 1,
  discDrop: 0,
  tiltX: 0,
  tiltY: 0,
};

function staged(pose: Partial<ScenePose> = {}, pitch = 0, extra: Partial<SceneSpec> = {}) {
  const s = createCopyScene(spec(extra), {});
  s.setLens(CANVAS.width, CANVAS.height, CANVAS.centreX, CANVAS.centreY);
  s.setPose({ ...REST, ...pose }, pitch, 0);
  s.scene.updateMatrixWorld(true);
  s.camera.updateMatrixWorld(true);
  return s;
}

/** A point in the world, where the camera draws it on the canvas, in dp. */
function onCanvas(camera: THREE.Camera, point: THREE.Vector3) {
  const p = point.clone().project(camera);
  return {
    x: ((p.x + 1) / 2) * CANVAS.width,
    y: ((1 - p.y) / 2) * CANVAS.height,
  };
}

/** The same point as the flat stage's arithmetic draws it: the plan, then the perspective. */
function flat(x: number, y: number, z: number) {
  const k = STAGE_CAMERA / (STAGE_CAMERA - z);
  return { x: CANVAS.centreX + x * k, y: CANVAS.centreY - y * k };
}

const close = (a: { x: number; y: number }, b: { x: number; y: number }, what: string) => {
  assert.ok(
    Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01,
    `${what}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`
  );
};

describe('the camera', () => {
  it('draws a point at the object’s depth one dp to a dp, round the object’s centre', () => {
    const { camera } = staged();
    for (const [x, y] of [
      [0, 0],
      [100, 0],
      [-140, 180],
      [60, -200],
    ]) {
      close(
        onCanvas(camera, new THREE.Vector3(x, y, 0)),
        { x: CANVAS.centreX + x, y: CANVAS.centreY - y },
        `${x},${y}`
      );
    }
  });

  it('puts the case’s corners where the flat stage puts them, at any turn', () => {
    for (const theta of [0, 23, -48, 90, 157, 180, 311]) {
      const s = staged({ theta });
      for (const [sx, sy] of [
        [-1, -1],
        [1, 1],
      ]) {
        const x = (sx * W) / 2;
        const y = (sy * H) / 2;
        const plan = { x: turnX(x, DEPTH / 2, theta), z: turnZ(x, DEPTH / 2, theta) };
        close(
          onCanvas(s.camera, new THREE.Vector3(plan.x, y, plan.z)),
          flat(plan.x, y, plan.z),
          `turn ${theta}`
        );
      }
      s.dispose();
    }
  });

  it('builds the box at those corners: the cover at the front, the spine on the left', () => {
    const s = staged({ theta: 31 });
    const meshes: THREE.Mesh[] = [];
    s.scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
    });
    /* The cover's top left corner, in the world. */
    const cover = meshes.find(
      (m) => m.parent !== null && m.parent.parent !== null && m.parent.position.z > 0
    )!;
    const corner = new THREE.Vector3(-W / 2, H / 2, 0).applyMatrix4(cover.matrixWorld);
    const plan = { x: turnX(-W / 2, DEPTH / 2, 31), z: turnZ(-W / 2, DEPTH / 2, 31) };
    assert.ok(Math.abs(corner.x - plan.x) < 1e-6 && Math.abs(corner.z - plan.z) < 1e-6);
    assert.ok(Math.abs(corner.y - H / 2) < 1e-6);
    s.dispose();
  });
});

describe('the case', () => {
  it('swings its cover about the spine, as the flat stage does', () => {
    const swing = 100;
    const s = staged({ swing });
    let free: THREE.Vector3 | null = null;
    s.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (
        mesh.isMesh &&
        mesh.renderOrder === 1 &&
        mesh.parent?.position.x === -W / 2 &&
        mesh.position.z === 0
      ) {
        free = new THREE.Vector3(W / 2, 0, 0).applyMatrix4(mesh.matrixWorld);
      }
    });
    assert.ok(free);
    const edge = free as unknown as THREE.Vector3;
    const r = (swing * Math.PI) / 180;
    assert.ok(Math.abs(edge.x - (-W / 2 + W * Math.cos(r))) < 1e-6);
    assert.ok(Math.abs(edge.z - (DEPTH / 2 + W * Math.sin(r))) < 1e-6);
    s.dispose();
  });

  it('is gone when the disc has taken its place', () => {
    const s = staged({ here: false, discShown: true });
    const visible: string[] = [];
    s.scene.traverseVisible((o) => {
      if ((o as THREE.Mesh).isMesh) visible.push((o as THREE.Mesh).geometry.type);
    });
    assert.ok(!visible.includes('PlaneGeometry'));
    assert.ok(visible.includes('RingGeometry'));
    s.dispose();
  });
});

describe('the disc', () => {
  const discVisible = (pose: Partial<ScenePose>, extra: Partial<SceneSpec> = {}) => {
    const s = staged(pose, 0, extra);
    let seen = false;
    s.scene.traverseVisible((o) => {
      if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry.type === 'RingGeometry')
        seen = true;
    });
    s.dispose();
    return seen;
  };

  it('is drawn in its tray only while the case is open', () => {
    assert.equal(discVisible({}), false);
    assert.equal(discVisible({ swing: 40 }), true);
    assert.equal(discVisible({ discShown: true, here: false }), true);
  });

  it('is never drawn for a copy whose case does not open to one', () => {
    assert.equal(discVisible({ swing: 40 }, { opens: false }), false);
    assert.equal(discVisible({ discShown: true }, { opens: false }), false);
  });

  it('stands where the flat stage stands it, turned as far', () => {
    const pose = {
      here: false,
      discShown: true,
      discX: 12,
      discZ: 30,
      discAngle: 37,
      discDrop: 50,
    };
    const s = staged(pose);
    let rim: THREE.Mesh | null = null;
    s.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry.type === 'RingGeometry' && m.renderOrder === 3) rim = m;
    });
    const label = rim as unknown as THREE.Mesh;
    /* The label's right-hand edge, on the label's own plane. */
    const edge = new THREE.Vector3(1, 0, 0).applyMatrix4(label.matrixWorld);
    const r = DISC / 2;
    const a = (37 * Math.PI) / 180;
    /* It lies on the tray: half a 1.2mm disc and half a dp in front of it. */
    const lift = (1.2 / 60 / 2) * r + 0.5;
    assert.ok(Math.abs(edge.y + 50) < 1e-6);
    /* Its plane is turned by the disc's angle, a hair in front of the point
       the flat stage turns it about. */
    const expected = {
      x: 12 + r * Math.cos(a) + lift * Math.sin(a),
      z: 30 - r * Math.sin(a) + lift * Math.cos(a),
    };
    assert.ok(Math.abs(edge.x - expected.x) < 1e-6, `${edge.x} vs ${expected.x}`);
    assert.ok(Math.abs(edge.z - expected.z) < 1e-6, `${edge.z} vs ${expected.z}`);
    s.dispose();
  });
});

describe('the studio', () => {
  it('is one set of lights, shared by every surface, so the phone moves them all', () => {
    const s = staged();
    const directions = new Set<unknown>();
    s.scene.traverse((o) => {
      const material = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
      if (material?.uniforms?.uLdir) directions.add(material.uniforms.uLdir.value);
    });
    assert.equal(directions.size, 1);
    s.dispose();
  });

  it('rocks the whole object about its centre, and only the object', () => {
    const s = staged({}, 7);
    const root = s.scene.children[0];
    assert.ok(Math.abs(root.rotation.x - (7 * Math.PI) / 180) < 1e-12);
    assert.equal(s.camera.position.z, STAGE_CAMERA);
    s.dispose();
  });
});
