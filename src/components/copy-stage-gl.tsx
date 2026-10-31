import { Asset } from 'expo-asset';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { memo, useEffect, useState } from 'react';
import { Image as RNImage, PixelRatio, StyleSheet, View } from 'react-native';
import { runOnJS, useAnimatedReaction, type DerivedValue } from 'react-native-reanimated';
import { releaseCapture } from 'react-native-view-shot';
import * as THREE from 'three';

import { PLASTIC, backCornerRadius } from '@/components/copy-case-back';
import { caseContents } from '@/components/copy-case-inside';
import type { StageSnapshots } from '@/components/copy-stage-sheet';
import { discTemplateFor } from '@/constants/cd-template';
import { TRAY_RECESS, caseBuildFor } from '@/constants/copy-stage';
import { CASE_TEMPLATES, hasCase, type PlatformKey } from '@/constants/platform-cases';
import { Radius } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import type { CopyArt } from '@/lib/api/copy-art';
import { mix } from '@/lib/color';
import {
  TILT_PITCH,
  discDiameterMm,
  discFormatFor,
  discPlasticTransmittance,
  easeRock,
  idleRock,
  stageRenderScale,
} from '@/lib/copy-scene/optics';
import {
  createCopyScene,
  type CopyScene,
  type SceneImage,
  type SceneImages,
  type ScenePose,
  type SceneSpec,
} from '@/lib/copy-scene/scene';
import { makeRenderer } from '@/lib/copy-scene/renderer';
import { whileThreeRuns } from '@/lib/copy-scene/three-globals';
import { sharpCoverUrl } from '@/lib/games/sharp-cover';

/** Give up on the 3D stage, and leave the flat one, if it is not drawn by then. */
const READY_WITHIN_MS = 20_000;

export type CopyStageGLProps = {
  platform: PlatformKey;
  coverUrl?: string | null;
  heroUrl?: string | null;
  art: CopyArt;
  /** The stage: its width (the display's), height, the case and where it stands. */
  width: number;
  height: number;
  centreY: number;
  caseWidth: number;
  caseHeight: number;
  depth: number;
  disc: number;
  cased: boolean;
  opens: boolean;
  sealed: boolean;
  completeness: Parameters<typeof caseContents>[0];
  /** Pictures of the printed faces, once `<CopyStageSheet>` has taken them. */
  snapshots: StageSnapshots | null;
  /** Where everything is, worked out on the UI thread by the flat stage. */
  pose: DerivedValue<ScenePose>;
  /** Whether the stage is alive (in front, on screen), and whether it may rock. */
  active: boolean;
  rocking: boolean;
  /** Its first frame is drawn: the flat stage can go. */
  onReady: () => void;
  /** It cannot be drawn: the flat stage stays. Said once. */
  onFail: (reason: string) => void;
};

/**
 * The copy's stage in 3D: the case and the disc as objects, in a studio, on
 * the GPU — `lib/copy-scene` drawn into an expo-gl canvas by three.js.
 *
 * ## It follows the flat stage; it does not lead
 *
 * `<CopyShowcase>` still owns every number that moves — the drift, the
 * springs, the gestures, the tilt — on the UI thread, and hands this one
 * small object a frame (`pose`). The canvas draws it, rocked a few degrees
 * back and forth (`idleRock`), which is the one motion the flat stage could
 * not make: its faces could only turn about an upright axis.
 *
 * ## It arrives over the flat stage, and leaves it there if it cannot
 *
 * The flat stage is on screen from the first frame, as it always was. This
 * loads behind it — the box art at 1080p, the case and disc templates, and
 * the printed faces' pictures — builds the scene, compiles its shaders and
 * draws one frame; only then does it say `onReady` and the flat stage fade
 * out from under it. Anything that fails on the way says `onFail` and the
 * flat stage simply stays: a build without expo-gl never gets here, and a
 * phone without WebGL 2, a shader its driver refuses, a template that would
 * not load or a frame that never comes all end the same way.
 *
 * ## The canvas is drawn at two pixels a dp
 *
 * And scaled up to the display (`stageRenderScale`): the disc's playing side
 * is the most expensive surface in the app to shade, and the object is never
 * still long enough for the difference to be seen.
 *
 * Imported only through `React.lazy`, behind a check that expo-gl and
 * view-shot are both in the build: expo-gl asks for its native module as it
 * is imported, and a build made before it would close on that.
 */
const CopyStageGL = memo(function CopyStageGL(props: CopyStageGLProps) {
  const theme = useTheme();
  const accent = useAccent();
  const [runtime] = useState(() => new StageRuntime());

  const { width, height, centreY, snapshots, pose, active, rocking, onReady, onFail } = props;
  const { platform, cased } = props;

  /* What to build, decided by React and read by the runtime when it builds.
     First of the effects, so the rest find it. */
  const colours: Colours = {
    plasticTop: PLASTIC.top,
    plasticBottom: PLASTIC.bottom,
    rule: mix(PLASTIC.top, '#FFFFFF', 0.07),
    /* A cardboard box's edges are printed in its console's colour. */
    edge: cased && hasCase(platform) ? CASE_TEMPLATES[platform].spineColor : theme.surfaceSelected,
    blank: theme.surfaceElevated,
    paper: theme.text,
    insert: theme.textSecondary,
    light: accent.m3.primary,
  };
  useEffect(() => {
    runtime.configure(props, colours);
  });

  useEffect(() => {
    runtime.start(onReady, onFail);
    return () => runtime.destroy();
    /* Once: the runtime reads what it needs from `configure` as it goes. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime]);

  useEffect(() => {
    if (snapshots) runtime.print(snapshots);
  }, [runtime, snapshots]);

  useEffect(() => {
    runtime.live(active, rocking);
  }, [runtime, active, rocking]);

  useEffect(() => {
    runtime.lens(width, height, centreY);
  }, [runtime, width, height, centreY]);

  const receive = runtime.receive;
  useAnimatedReaction(
    () => pose.get(),
    (now) => {
      runOnJS(receive)(now);
    }
  );

  /* Laid out small and scaled up: the canvas's pixels are its laid-out size. */
  const density = PixelRatio.get();
  const shrink = stageRenderScale(density) / density;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={{
          width: width * shrink,
          height: height * shrink,
          transform: [{ scale: 1 / shrink }],
          transformOrigin: 'top left',
        }}>
        <GLView style={StyleSheet.absoluteFill} onContextCreate={runtime.attach} />
      </View>
    </View>
  );
});

export default CopyStageGL;

type Colours = SceneSpec['colours'];

/**
 * Everything imperative: the GL context, the textures, the scene, the frame
 * loop. One per mounted canvas, created once and told what React decides.
 */
class StageRuntime {
  private props!: CopyStageGLProps;
  private colours!: Colours;

  private gl: ExpoWebGLRenderingContext | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: CopyScene | null = null;
  /** The pictures that are files (art, templates, scans), as loaded for one set of art. */
  private files: Files | null = null;
  private filesFor = '';
  /** What is on the GPU: those pictures, and the printed faces. */
  private pictures: Uploaded | null = null;
  private printed: { key: string; images: Printed; editionHeight: number } | null = null;
  private pose: ScenePose | null = null;
  private size = { width: 0, height: 0, centreY: 0 };

  private isLive = false;
  private isRocking = false;
  private rock = 0;
  private clock = 0;
  private last = 0;
  private frame: number | null = null;

  private ready = false;
  private dead = false;
  private shaderFailed = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private onReady: () => void = () => {};
  private onFail: (reason: string) => void = () => {};

  configure(props: CopyStageGLProps, colours: Colours) {
    this.props = props;
    this.colours = colours;
    /* A scan of the real back or disc found after the stage was built: load
       it and swap a new scene in, the old one drawn until then. */
    if (this.ready && artKey(props.art) !== this.filesFor) void this.load();
  }

  start(onReady: () => void, onFail: (reason: string) => void) {
    this.onReady = onReady;
    this.onFail = onFail;
    this.timer = setTimeout(() => this.fail('it was not drawn in time'), READY_WITHIN_MS);
    void this.load();
  }

  /** Called on the JS thread with each frame the UI thread worked out. */
  receive = (pose: ScenePose) => {
    this.pose = pose;
    this.request();
  };

  live(active: boolean, rocking: boolean) {
    this.isLive = active;
    this.isRocking = rocking;
    /* Not rocking means put away, or Reduce Motion: either way, at once. */
    if (!rocking) this.rock = 0;
    this.request();
  }

  lens(width: number, height: number, centreY: number) {
    this.size = { width, height, centreY };
    this.scene?.setLens(width, height, width / 2, centreY);
    this.request();
  }

  attach = (gl: ExpoWebGLRenderingContext) => {
    if (this.dead) return;
    this.gl = gl;
    try {
      if ((gl as { supportsWebGL2?: boolean }).supportsWebGL2 === false) {
        throw new Error('this phone has no WebGL 2');
      }
      this.renderer = makeRenderer(gl as unknown as WebGL2RenderingContext);
      this.renderer.debug.onShaderError = () => {
        this.shaderFailed = true;
      };
    } catch (error) {
      this.fail(`the canvas could not be set up: ${String(error)}`);
      return;
    }
    this.build();
  };

  /** The printed faces' pictures, first or again: onto the GPU, and their files let go. */
  print(snapshots: StageSnapshots) {
    const gl = this.gl;
    if (this.dead) return;
    if (!gl) {
      /* No canvas yet: keep the files until there is one. */
      this.pendingPrint = snapshots;
      return;
    }
    if (this.printed?.key === snapshots.key) return;
    const old = this.printed;
    try {
      this.printed = {
        key: snapshots.key,
        images: uploadPrinted(gl, snapshots),
        editionHeight: snapshots.editionHeight,
      };
    } catch {
      this.fail('the printed faces would not load');
      return;
    }
    if (this.scene) {
      this.scene.reprint(this.printed.images, this.printed.editionHeight);
      this.renderer?.resetState();
      if (old) deleteTextures(gl, Object.values(old.images));
      this.request();
    } else {
      this.build();
    }
  }

  private pendingPrint: StageSnapshots | null = null;

  destroy() {
    this.dead = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    try {
      this.scene?.dispose();
      const gl = this.gl;
      if (gl) {
        deleteTextures(gl, Object.values(this.pictures ?? {}));
        deleteTextures(gl, Object.values(this.printed?.images ?? {}));
      }
      this.renderer?.dispose();
    } catch {
      /* The context may already be gone with its view. */
    }
    this.scene = null;
    this.renderer = null;
    this.gl = null;
  }

  // -------------------------------------------------------------------------

  private fail(reason: string) {
    if (this.dead || this.ready) return;
    this.dead = true;
    if (this.timer) clearTimeout(this.timer);
    if (__DEV__) console.warn(`[copy-stage] the 3D stage is off: ${reason}`);
    this.onFail(reason);
  }

  /** The pictures that are files somewhere: downloaded once, then ready for the GPU. */
  private async load() {
    const p = this.props;
    const key = artKey(p.art);
    this.filesFor = key;
    const platform = p.platform;
    try {
      const small = p.coverUrl ?? p.heroUrl ?? null;
      const sharp = sharpCoverUrl(small);
      const [cover, caseTemplate, discTemplate, scan, discScan] = await Promise.all([
        localImage(sharp).then((found) => found ?? localImage(small)),
        hasCase(platform) ? localImage(moduleOf(CASE_TEMPLATES[platform].template)) : null,
        p.opens ? localImage(moduleOf(discTemplateFor(platform).template)) : null,
        p.art.back ? localImage(p.art.back.url) : null,
        p.opens && p.art.disc ? localImage(p.art.disc.url) : null,
      ]);
      if (hasCase(platform) && !caseTemplate) throw new Error('the case template would not load');
      if (p.opens && !discTemplate) throw new Error('the disc template would not load');
      /* Superseded while it loaded. */
      if (this.filesFor !== key || this.dead) return;
      this.files = { cover, caseTemplate, discTemplate, scan, discScan };
      if (this.scene) this.rebuild();
      else this.build();
    } catch (error) {
      this.fail(`its pictures would not load: ${String(error)}`);
    }
  }

  /** Once the context, the pictures and the printed faces are all here. */
  private build() {
    const gl = this.gl;
    const renderer = this.renderer;
    if (this.dead || this.scene || !gl || !renderer || !this.files) return;
    if (!this.printed && this.pendingPrint) {
      const pending = this.pendingPrint;
      this.pendingPrint = null;
      this.print(pending);
      return;
    }
    if (!this.printed) return;
    try {
      this.pictures = uploadFiles(gl, this.files);
      renderer.resetState();
      this.scene = this.compose();
      this.draw();
      if (this.shaderFailed) throw new Error('a shader would not compile');
    } catch (error) {
      this.fail(`it could not be built: ${String(error)}`);
      return;
    }
    if (this.timer) clearTimeout(this.timer);
    this.ready = true;
    this.onReady();
    this.request();
  }

  /** New art after the stage is up: a new scene, swapped in whole. */
  private rebuild() {
    const gl = this.gl;
    const renderer = this.renderer;
    const files = this.files;
    if (this.dead || !gl || !renderer || !files || !this.printed) return;
    const oldScene = this.scene;
    const oldPictures = this.pictures;
    try {
      this.pictures = uploadFiles(gl, files);
      renderer.resetState();
      this.scene = this.compose();
      this.draw();
    } catch {
      /* The scene that was there stays. */
      if (this.pictures && this.pictures !== oldPictures) {
        deleteTextures(gl, Object.values(this.pictures));
      }
      this.scene = oldScene;
      this.pictures = oldPictures;
      return;
    }
    oldScene?.dispose();
    if (oldPictures) deleteTextures(gl, Object.values(oldPictures));
    this.request();
  }

  private compose(): CopyScene {
    const scene = createCopyScene(this.spec(), { ...this.pictures, ...this.printed!.images });
    scene.setLens(this.size.width, this.size.height, this.size.width / 2, this.size.centreY);
    whileThreeRuns(() => this.renderer!.compile(scene.scene, scene.camera));
    return scene;
  }

  private spec(): SceneSpec {
    const p = this.props;
    const platform = p.platform;
    const template = hasCase(platform) ? CASE_TEMPLATES[platform] : null;
    const contents = caseContents(p.completeness);
    const scan = this.files?.scan ? p.art.back : null;
    let scanRect: SceneSpec['scanRect'] = null;
    if (scan) {
      /* As the flat back draws it: as tall as the face, the back's part of
         a whole sleeve slid into the middle. */
      const part = scan.crop ? scan.crop.right - scan.crop.left : 1;
      const drawnWidth = (p.caseHeight * scan.width) / Math.max(1, scan.height);
      const left = -(scan.crop?.left ?? 0) * drawnWidth + (p.caseWidth - drawnWidth * part) / 2;
      scanRect = { x: left / p.caseWidth, y: 0, width: drawnWidth / p.caseWidth, height: 1 };
    }
    return {
      caseWidth: p.caseWidth,
      caseHeight: p.caseHeight,
      depth: p.depth,
      disc: p.disc,
      cased: template !== null,
      opens: p.opens,
      sealed: p.sealed,
      printedEdges: caseBuildFor(platform) === 'box',
      trayRecess: TRAY_RECESS,
      coverArea: template
        ? {
            x: template.coverArea.x / template.templateSize.width,
            y: template.coverArea.y / template.templateSize.height,
            width: template.coverArea.width / template.templateSize.width,
            height: template.coverArea.height / template.templateSize.height,
          }
        : null,
      scanRect,
      editionHeight: this.printed?.editionHeight ?? 0,
      radius: backCornerRadius(p.caseWidth),
      bareRadius: Radius.image,
      discTemplate: discTemplateFor(platform),
      discFormat: discFormatFor(platform),
      discDiameterMm: discDiameterMm(platform),
      discTransmittance: discPlasticTransmittance(platform),
      manual: contents.manual,
      inserts: contents.inserts,
      colours: this.colours,
    };
  }

  private request() {
    if (this.frame !== null || !this.ready || this.dead) return;
    this.frame = requestAnimationFrame(this.tick);
  }

  private tick = () => {
    this.frame = null;
    if (this.dead || !this.scene) return;
    const now = Date.now() / 1000;
    const dt = this.last ? Math.min(0.05, Math.max(0, now - this.last)) : 0;
    this.last = now;
    if (this.isRocking) {
      this.rock = easeRock(this.rock, 1, dt);
      this.clock += dt;
    }
    try {
      this.draw();
    } catch {
      return;
    }
    if (this.isLive) {
      this.frame = requestAnimationFrame(this.tick);
    } else {
      this.last = 0;
    }
  };

  private draw() {
    const scene = this.scene;
    const renderer = this.renderer;
    const gl = this.gl;
    if (!scene || !renderer || !gl) return;
    const pose = this.pose ?? RESTING;
    const { pitch, roll } = idleRock(this.clock, this.rock);
    scene.setPose(pose, pitch + TILT_PITCH * pose.tiltY, roll);
    whileThreeRuns(() => renderer.render(scene.scene, scene.camera));
    gl.endFrameEXP();
  }
}

type FileKey = 'cover' | 'caseTemplate' | 'discTemplate' | 'scan' | 'discScan';
type Files = Record<FileKey, LocalImage | null>;
type Uploaded = Partial<Record<FileKey, SceneImage>>;
type Printed = Pick<SceneImages, 'back' | 'spine' | 'lip' | 'edition'>;

/** Which art the stage was built with: a scan found later is a new key. */
function artKey(art: CopyArt): string {
  return `${art.back?.url ?? ''}|${art.disc?.url ?? ''}`;
}

function uploadFiles(gl: ExpoWebGLRenderingContext, files: Files): Uploaded {
  const out: Uploaded = {};
  (Object.keys(files) as FileKey[]).forEach((key) => {
    const image = files[key];
    if (!image) return;
    out[key] = {
      texture: new THREE.ExternalTexture(uploadTexture(gl, image.uri)),
      width: image.width,
      height: image.height,
    };
  });
  return out;
}

function uploadPrinted(gl: ExpoWebGLRenderingContext, snapshots: StageSnapshots): Printed {
  const one = (uri: string | null): SceneImage | undefined => {
    if (!uri) return undefined;
    const texture = uploadTexture(gl, uri);
    /* expo-gl reads the file into the texture as it is called: it can go. */
    try {
      releaseCapture(uri);
    } catch {
      /* A temporary file the system clears in any case. */
    }
    return { texture: new THREE.ExternalTexture(texture), width: 1, height: 1 };
  };
  return {
    back: one(snapshots.back),
    spine: one(snapshots.spine),
    lip: one(snapshots.lip),
    edition: one(snapshots.edition),
  };
}

function deleteTextures(gl: ExpoWebGLRenderingContext, images: (SceneImage | undefined)[]) {
  images.forEach((image) => {
    const raw = (image?.texture as THREE.ExternalTexture | undefined)?.sourceTexture;
    if (raw) gl.deleteTexture(raw as WebGLTexture);
  });
}

const RESTING: ScenePose = {
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

/**
 * A picture onto the GPU straight from its file: expo-gl decodes it natively
 * (stb_image — JPEG and PNG) from a `localUri`, which is the one way a phone
 * can hand it an image without decoding it in JavaScript.
 *
 * Row 0 is the picture's top; the shaders read it that way, so nothing is
 * flipped. Mipmapped, because every face is seen smaller than its picture.
 */
function uploadTexture(gl: ExpoWebGLRenderingContext, uri: string): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error('no texture');
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  (gl.texImage2D as unknown as (...args: unknown[]) => void)(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    { localUri: uri }
  );
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}

type LocalImage = { uri: string; width: number; height: number };

/** A bundled picture's module id: what `require()` of a PNG is, whatever its type says. */
function moduleOf(source: unknown): number | null {
  return typeof source === 'number' ? source : null;
}

/**
 * A picture as a local file and its size: downloaded into the cache (or, for
 * one bundled with the app, copied out of it) by expo-asset, which keeps it
 * there for next time. `null` when there is no such picture or it cannot be
 * had — the caller decides whether the stage can do without it.
 */
async function localImage(source: string | number | null | undefined): Promise<LocalImage | null> {
  if (source === null || source === undefined) return null;
  try {
    const asset = typeof source === 'number' ? Asset.fromModule(source) : Asset.fromURI(source);
    await asset.downloadAsync();
    const uri = asset.localUri;
    if (!uri || !uri.startsWith('file://')) return null;
    if (asset.width && asset.height) return { uri, width: asset.width, height: asset.height };
    const size = await new Promise<{ width: number; height: number }>((resolve, reject) =>
      RNImage.getSize(uri, (w, h) => resolve({ width: w, height: h }), reject)
    );
    return { uri, ...size };
  } catch {
    return null;
  }
}
