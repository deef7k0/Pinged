import * as THREE from 'three';

import { STAGE_CAMERA } from '../stage-geometry';
import {
  STUDIO,
  STUDIO_AMBIENT,
  STUDIO_ENV,
  TRACK_PITCH_NM,
  discZones,
  stageLens,
  studioDiffuse,
  studioDirection,
  type DiscFormat,
} from './optics';
import { CASE_FACE, DISC_DATA, DISC_EDGE, DISC_LABEL, VERTEX } from './shaders';

/**
 * The copy stage as a three.js scene: the case as a box with a cover that
 * swings, a tray and the inside of the cover, and the disc — both of its
 * sides and its edge — in one space, under one camera and one studio.
 *
 * It draws; it does not decide. Where everything is comes from the flat
 * stage's own numbers (`ScenePose`, worked out on the UI thread by
 * `<CopyShowcase>` exactly as before), in the same units — dp — round the
 * same centre, seen from the same camera distance (`STAGE_CAMERA`). So the 3D
 * case stands where the flat one stood, a tap finds it where the flat stage's
 * arithmetic says it is, and every gesture, spring and the idle turn are the
 * flat stage's, unchanged. What this adds is the third dimension those faces
 * could not have: the idle rock, light that is reflected rather than painted,
 * and a disc made of what a disc is made of.
 *
 * Platform-free: no React Native here. The phone's canvas, its texture
 * uploads and its render loop are `<CopyStageGL>`'s; a browser can build
 * this scene too, which is how its shaders were first seen.
 */

const RAD = Math.PI / 180;

/** A picture on the GPU, and its size in pixels. */
export type SceneImage = { texture: THREE.Texture; width: number; height: number };

export type SceneImages = {
  /** The box art: the cover, the disc's label art, the manual. */
  cover?: SceneImage;
  /** The case's template, whose window the art shows through. */
  caseTemplate?: SceneImage;
  /** The edition band across the foot of the cover, as the flat stage draws it. */
  edition?: SceneImage;
  /** The printed back, as the flat stage draws it — or a scan of the real one. */
  back?: SceneImage;
  scan?: SceneImage;
  /** The spine and the opening edge, as the flat stage draws them. */
  spine?: SceneImage;
  lip?: SceneImage;
  /** The console's disc template, and a scan of the real disc's label. */
  discTemplate?: SceneImage;
  discScan?: SceneImage;
};

export type DiscTemplateGeometry = {
  width: number;
  height: number;
  cx: number;
  cy: number;
  outerRadius: number;
  artRadius: number;
  hubRadius: number;
};

export type SceneSpec = {
  caseWidth: number;
  caseHeight: number;
  depth: number;
  /** The disc's diameter, dp. */
  disc: number;
  cased: boolean;
  opens: boolean;
  sealed: boolean;
  /** A cardboard box is printed on every side; a keep case's top and bottom are plastic. */
  printedEdges: boolean;
  /** How far in from the rim the tray sits, as a share of the depth. */
  trayRecess: number;
  /** The template's window, as fractions of the face (top-left origin). */
  coverArea: { x: number; y: number; width: number; height: number } | null;
  /** The back scan's drawn rectangle on the face, as fractions (top-left origin). */
  scanRect: { x: number; y: number; width: number; height: number } | null;
  /** How tall the edition band is, as a share of the face; 0 for none. */
  editionHeight: number;
  /** The corner of a back, a tray, the inside of a cover; and of bare box art. */
  radius: number;
  bareRadius: number;
  discTemplate: DiscTemplateGeometry;
  discFormat: DiscFormat;
  discDiameterMm: number;
  discTransmittance: readonly [number, number, number];
  manual: boolean;
  inserts: boolean;
  colours: {
    plasticTop: string;
    plasticBottom: string;
    rule: string;
    /** A cardboard box's edges. */
    edge: string;
    /** Where there is no art: the flat stage's empty well. */
    blank: string;
    paper: string;
    insert: string;
    /** The game's own lamp colour (its M3 primary). */
    light: string;
  };
};

/**
 * Where everything is this frame, in the flat stage's terms. Flat, so it
 * crosses from the UI thread to JavaScript in one small object.
 */
export type ScenePose = {
  /** The case: how far round (degrees), how large, how far aside and down (dp). */
  theta: number;
  scale: number;
  shift: number;
  drop: number;
  /** How far its cover is swung open, in degrees. */
  swing: number;
  /** Whether the case is on the stage at all. */
  here: boolean;
  /** The disc: whether it is drawn, where, how far round, how large. */
  discShown: boolean;
  discX: number;
  discZ: number;
  discAngle: number;
  discScale: number;
  discDrop: number;
  /** The phone's tilt, -1…1. */
  tiltX: number;
  tiltY: number;
};

export type CopyScene = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** The canvas, in dp, and where on it the object's centre is. */
  setLens: (width: number, height: number, centreX: number, centreY: number) => void;
  /** Put everything where `pose` says, rocked by `pitch`/`roll` degrees. */
  setPose: (pose: ScenePose, pitch: number, roll: number) => void;
  /**
   * New pictures of the printed faces — the copy's record changed — swapped in
   * without building anything again. The old pictures are the caller's to free.
   */
  reprint: (
    images: Pick<SceneImages, 'back' | 'spine' | 'lip' | 'edition'>,
    editionHeight: number
  ) => void;
  dispose: () => void;
};

/** A real disc is 1.2mm thick on a 60mm radius. */
const DISC_THICKNESS_MM = 1.2;

function linear(hex: string): THREE.Vector3 {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
}

export function createCopyScene(spec: SceneSpec, images: SceneImages): CopyScene {
  const { caseWidth: W, caseHeight: H, depth } = spec;
  const deep = depth / 2;
  const owned: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(thing: T): T => {
    owned.push(thing);
    return thing;
  };

  /* A transparent pixel, for any picture a face does not have. */
  const blankTexture = keep(new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1));
  blankTexture.needsUpdate = true;
  const tex = (image?: SceneImage) => image?.texture ?? blankTexture;

  // -------------------------------------------------------------------------
  // The studio, shared by every material: one set of uniform objects
  // -------------------------------------------------------------------------

  const light = linear(spec.colours.light);
  const white = new THREE.Vector3(1, 1, 1);
  const weights = studioDiffuse();
  const studio = {
    uLdir: { value: STUDIO.map(() => new THREE.Vector3()) },
    uLcol: {
      value: STUDIO.map((s) => white.clone().lerp(light, s.tint).multiplyScalar(s.power)),
    },
    uLbox: { value: STUDIO.map((s, i) => new THREE.Vector4(s.box[0], s.box[1], weights[i], 0)) },
    uLrt: { value: STUDIO.map(() => new THREE.Vector3()) },
    uLup: { value: STUDIO.map(() => new THREE.Vector3()) },
    uEnvLow: { value: white.clone().lerp(light, STUDIO_ENV.tint).multiplyScalar(STUDIO_ENV.low) },
    uEnvMid: { value: white.clone().lerp(light, STUDIO_ENV.tint).multiplyScalar(STUDIO_ENV.mid) },
    uEnvTop: { value: white.clone().lerp(light, STUDIO_ENV.tint).multiplyScalar(STUDIO_ENV.top) },
    uEnvRoom: {
      value: white
        .clone()
        .lerp(light, STUDIO_ENV.tint * 0.4)
        .multiplyScalar(STUDIO_ENV.room),
    },
    uAmbient: { value: white.clone().multiplyScalar(STUDIO_AMBIENT) },
  };

  let lastTilt = [NaN, NaN];
  const aimStudio = (tiltX: number, tiltY: number) => {
    if (lastTilt[0] === tiltX && lastTilt[1] === tiltY) return;
    lastTilt = [tiltX, tiltY];
    STUDIO.forEach((s, i) => {
      const [x, y, z] = studioDirection(s.dir, tiltX, tiltY);
      const c = studio.uLdir.value[i].set(x, y, z);
      const up0 = Math.abs(y) > 0.95 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
      const rt = studio.uLrt.value[i].crossVectors(up0, c).normalize();
      studio.uLup.value[i].crossVectors(c, rt);
    });
  };
  aimStudio(0, 0);

  const colours = {
    uPlasticTop: { value: linear(spec.colours.plasticTop) },
    uPlasticBottom: { value: linear(spec.colours.plasticBottom) },
    uRule: { value: linear(spec.colours.rule) },
    uBlank: { value: linear(spec.colours.blank) },
    uPaper: { value: linear(spec.colours.paper) },
    uInsert: { value: linear(spec.colours.insert) },
  };

  const art = {
    uArt: { value: tex(images.cover) },
    uArtAspect: { value: images.cover ? images.cover.width / images.cover.height : 2 / 3 },
    uHasArt: { value: images.cover ? 1 : 0 },
  };

  // -------------------------------------------------------------------------
  // The case
  // -------------------------------------------------------------------------

  const sheen = {
    /* How much colour the plastic's reflection carries, and the shrink-wrap. */
    uIris: { value: spec.sealed ? 0.8 : 0.55 },
    uWrap: { value: spec.sealed ? 1 : 0 },
  };

  const face = (
    kind: string,
    width: number,
    height: number,
    extra: Record<string, THREE.IUniform>,
    options: { transparent?: boolean; side?: THREE.Side } = {}
  ) =>
    keep(
      new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: CASE_FACE,
        defines: { [kind]: '' },
        uniforms: {
          ...studio,
          ...colours,
          ...art,
          ...sheen,
          uMap: { value: blankTexture },
          uOver: { value: blankTexture },
          uRect: { value: new THREE.Vector4(0, 0, 1, 1) },
          uFaceSize: { value: new THREE.Vector2(width, height) },
          uHasBand: { value: 0 },
          uPrint: { value: linear(spec.colours.plasticTop) },
          uEditionH: { value: 0 },
          uRadius: { value: spec.radius },
          uDisc: { value: spec.disc },
          uManual: { value: spec.manual ? 1 : 0 },
          uInserts: { value: spec.inserts ? 1 : 0 },
          ...extra,
        },
        transparent: options.transparent ?? false,
        premultipliedAlpha: true,
        side: options.side ?? THREE.FrontSide,
      })
    );

  const plane = (width: number, height: number) => keep(new THREE.PlaneGeometry(width, height));

  const area = spec.coverArea;
  const frontMaterial = spec.cased
    ? face(
        'FACE_FRONT_CASED',
        W,
        H,
        {
          uOver: { value: tex(images.caseTemplate) },
          uRect: {
            value: area
              ? new THREE.Vector4(area.x, area.y, area.width, area.height)
              : new THREE.Vector4(0, 0, 1, 1),
          },
          uMap: { value: tex(images.edition) },
          uHasBand: { value: images.edition ? 1 : 0 },
          uEditionH: { value: images.edition ? spec.editionHeight : 0 },
        },
        { transparent: true }
      )
    : face(
        'FACE_FRONT_BARE',
        W,
        H,
        {
          uRadius: { value: spec.bareRadius },
          uMap: { value: tex(images.edition) },
          uHasBand: { value: images.edition ? 1 : 0 },
          uEditionH: { value: images.edition ? spec.editionHeight : 0 },
        },
        { transparent: true }
      );

  const rect = spec.scanRect;
  const backMaterial = images.scan
    ? face(
        'FACE_SCAN',
        W,
        H,
        {
          uMap: { value: images.scan.texture },
          uRect: {
            value: rect
              ? new THREE.Vector4(rect.x, rect.y, rect.width, rect.height)
              : new THREE.Vector4(0, 0, 1, 1),
          },
        },
        { transparent: true }
      )
    : face('FACE_PICTURE', W, H, { uMap: { value: tex(images.back) } }, { transparent: true });

  const edgeColour = spec.printedEdges ? spec.colours.edge : spec.colours.plasticTop;
  const spineMaterial = face(
    'FACE_PICTURE',
    depth,
    H,
    { uMap: { value: tex(images.spine) } },
    { side: THREE.DoubleSide }
  );
  const lipMaterial = face(
    'FACE_PICTURE',
    depth,
    H,
    { uMap: { value: tex(images.lip) } },
    { side: THREE.DoubleSide }
  );
  const capMaterial = face(
    'FACE_PLASTIC',
    W,
    depth,
    { uPrint: { value: linear(edgeColour) } },
    { side: THREE.DoubleSide }
  );

  const caseGroup = new THREE.Group();
  const hinge = new THREE.Group();
  hinge.position.set(-W / 2, 0, deep);
  caseGroup.add(hinge);

  const front = new THREE.Mesh(plane(W, H), frontMaterial);
  front.position.set(W / 2, 0, 0);
  front.renderOrder = 1;
  hinge.add(front);

  const backGeometry = plane(W, H);
  backGeometry.rotateY(Math.PI);
  const back = new THREE.Mesh(backGeometry, backMaterial);
  back.position.set(0, 0, -deep);
  back.renderOrder = 1;
  caseGroup.add(back);

  const spineGeometry = plane(depth, H);
  spineGeometry.rotateY(-Math.PI / 2);
  const spine = new THREE.Mesh(spineGeometry, spineMaterial);
  spine.position.set(-W / 2, 0, 0);
  caseGroup.add(spine);

  const lipGeometry = plane(depth, H);
  lipGeometry.rotateY(Math.PI / 2);
  const lip = new THREE.Mesh(lipGeometry, lipMaterial);
  lip.position.set(W / 2, 0, 0);
  caseGroup.add(lip);

  const topGeometry = plane(W, depth);
  topGeometry.rotateX(-Math.PI / 2);
  const top = new THREE.Mesh(topGeometry, capMaterial);
  top.position.set(0, H / 2, 0);
  caseGroup.add(top);

  const bottomGeometry = plane(W, depth);
  bottomGeometry.rotateX(Math.PI / 2);
  const bottom = new THREE.Mesh(bottomGeometry, capMaterial);
  bottom.position.set(0, -H / 2, 0);
  caseGroup.add(bottom);

  const trayZ = deep - depth * spec.trayRecess;
  let tray: THREE.Mesh | null = null;
  let leaf: THREE.Mesh | null = null;
  if (spec.opens) {
    tray = new THREE.Mesh(plane(W, H), face('FACE_TRAY', W, H, {}, { transparent: true }));
    tray.position.set(0, 0, trayZ);
    tray.renderOrder = 1;
    caseGroup.add(tray);

    const leafGeometry = plane(W, H);
    leafGeometry.rotateY(Math.PI);
    leaf = new THREE.Mesh(leafGeometry, face('FACE_LEAF', W, H, {}, { transparent: true }));
    leaf.position.set(W / 2, 0, -0.8);
    leaf.renderOrder = 1;
    hinge.add(leaf);
  }

  // -------------------------------------------------------------------------
  // The disc
  // -------------------------------------------------------------------------

  const discGroup = new THREE.Group();
  const discBody = new THREE.Group();
  discGroup.add(discBody);

  const zones = discZones(spec.discDiameterMm);
  const thickness = DISC_THICKNESS_MM / (spec.discDiameterMm / 2);
  const geometryOf = spec.discTemplate;
  const label = {
    uTpl: { value: tex(images.discTemplate) },
    uTplGeo: {
      value: new THREE.Vector4(
        geometryOf.cx / geometryOf.width,
        geometryOf.cy / geometryOf.height,
        geometryOf.outerRadius / geometryOf.width,
        geometryOf.outerRadius / geometryOf.height
      ),
    },
    uTplRadii: {
      value: new THREE.Vector2(
        geometryOf.artRadius / geometryOf.outerRadius,
        geometryOf.hubRadius / geometryOf.outerRadius
      ),
    },
    uScan: { value: tex(images.discScan) },
    uUseScan: { value: images.discScan ? 1 : 0 },
    uScanAspect: {
      value: images.discScan ? images.discScan.width / images.discScan.height : 1,
    },
    uZones: { value: new THREE.Vector4(zones.hole, zones.ridge, zones.stack, zones.mirror) },
    uZones2: {
      value: new THREE.Vector4(zones.data, zones.written, zones.dataEnd, zones.metalEnd),
    },
  };
  const discUniforms = { ...studio, ...art, uBlank: colours.uBlank, ...label };

  const labelMaterial = keep(
    new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: DISC_LABEL,
      uniforms: discUniforms,
      transparent: true,
      premultipliedAlpha: true,
    })
  );
  const pitch = TRACK_PITCH_NM[spec.discFormat];
  const dataMaterial = keep(
    new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: DISC_DATA,
      /* ±1 for every format; ±2 only where the tracks are far enough apart for
         a second order to leave the disc at a useful angle. */
      defines: { ORDERS: spec.discFormat === 'cd' ? 4 : 2 },
      uniforms: {
        ...discUniforms,
        uPitch: { value: pitch },
        uPolyT: { value: new THREE.Vector3(...spec.discTransmittance) },
      },
      transparent: true,
      premultipliedAlpha: true,
    })
  );
  const edgeMaterial = keep(
    new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: DISC_EDGE,
      uniforms: discUniforms,
      side: THREE.DoubleSide,
    })
  );

  /* The ring runs a hair past the rim and inside the hole, so the edge each
     shader fades to is drawn and not cut by the triangles. */
  const labelGeometry = keep(new THREE.RingGeometry(zones.hole * 0.96, 1.006, 192, 1));
  labelGeometry.translate(0, 0, thickness / 2);
  const dataGeometry = keep(new THREE.RingGeometry(zones.hole * 0.96, 1.006, 192, 1));
  dataGeometry.rotateY(Math.PI);
  dataGeometry.translate(0, 0, -thickness / 2);
  const rimGeometry = keep(new THREE.CylinderGeometry(1, 1, thickness, 192, 1, true));
  rimGeometry.rotateX(Math.PI / 2);
  const holeGeometry = keep(
    new THREE.CylinderGeometry(zones.hole, zones.hole, thickness, 64, 1, true)
  );
  holeGeometry.rotateX(Math.PI / 2);

  const labelSide = new THREE.Mesh(labelGeometry, labelMaterial);
  labelSide.renderOrder = 3;
  const dataSide = new THREE.Mesh(dataGeometry, dataMaterial);
  dataSide.renderOrder = 3;
  discBody.add(labelSide, dataSide);
  discBody.add(new THREE.Mesh(rimGeometry, edgeMaterial));
  discBody.add(new THREE.Mesh(holeGeometry, edgeMaterial));
  const radius = spec.disc / 2;
  discBody.scale.setScalar(radius);
  /* It lies on the tray, not in it. */
  discBody.position.z = (thickness / 2) * radius + 0.5;

  // -------------------------------------------------------------------------
  // The stage
  // -------------------------------------------------------------------------

  const scene = new THREE.Scene();
  const rock = new THREE.Group();
  rock.add(caseGroup, discGroup);
  scene.add(rock);

  const camera = new THREE.PerspectiveCamera(30, 1, STAGE_CAMERA * 0.3, STAGE_CAMERA * 2);
  camera.position.set(0, 0, STAGE_CAMERA);
  camera.lookAt(0, 0, 0);

  return {
    scene,
    camera,
    setLens(width, height, centreX, centreY) {
      const lens = stageLens(width, height, centreX, centreY, STAGE_CAMERA);
      camera.fov = lens.fov;
      camera.aspect = lens.fullWidth / lens.fullHeight;
      camera.setViewOffset(
        lens.fullWidth,
        lens.fullHeight,
        lens.offsetX,
        lens.offsetY,
        width,
        height
      );
      camera.updateProjectionMatrix();
    },
    setPose(pose, pitch, roll) {
      aimStudio(pose.tiltX, pose.tiltY);
      rock.rotation.set(pitch * RAD, 0, roll * RAD);

      caseGroup.visible = pose.here;
      caseGroup.position.set(pose.shift, -pose.drop, 0);
      caseGroup.scale.setScalar(pose.scale);
      caseGroup.rotation.set(0, pose.theta * RAD, 0);
      hinge.rotation.set(0, -pose.swing * RAD, 0);
      const opened = pose.swing > 0.5;
      if (tray) tray.visible = opened;
      if (leaf) leaf.visible = opened;

      discGroup.visible = spec.opens && (pose.discShown || (pose.here && opened));
      discGroup.position.set(pose.discX, -pose.discDrop, pose.discZ);
      discGroup.scale.setScalar(pose.discScale);
      discGroup.rotation.set(0, pose.discAngle * RAD, 0);
    },
    reprint(next, editionHeight) {
      if (!images.scan) backMaterial.uniforms.uMap.value = tex(next.back);
      spineMaterial.uniforms.uMap.value = tex(next.spine);
      lipMaterial.uniforms.uMap.value = tex(next.lip);
      frontMaterial.uniforms.uMap.value = tex(next.edition);
      frontMaterial.uniforms.uHasBand.value = next.edition ? 1 : 0;
      frontMaterial.uniforms.uEditionH.value = next.edition ? editionHeight : 0;
    },
    dispose() {
      owned.forEach((thing) => thing.dispose());
      owned.length = 0;
    },
  };
}
