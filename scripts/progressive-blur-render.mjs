/**
 * The pinned hero's foot, Convx's — the row-by-row blur, the mirrored tail and
 * the wash (`lib/progressive-blur`) — drawn through Skia's own CanvasKit from
 * the very shader the app sends, to look at, since nothing here can be judged
 * on a phone.
 *
 *   node --import ./scripts/esm-register.mjs scripts/progressive-blur-render.mjs [image-url] [out.png]
 *
 * Four panels, a 360dp game page at 3× with its 38% hero: the hero as it was
 * before the tail (the page's own dissolve, `MASTHEAD_FADE`, over the art
 * alone), then Convx's at rest, a little scrolled and scrolled. Each has the
 * game's name set where the masthead sets it — Inter Bold 22, white — so
 * what is behind it can be judged — and measured: before the name is set,
 * every panel prints white's contrast on the ground under it, its mean and
 * its worst (the brightest tenth of it). Bold 22 is large text: WCAG asks 3:1.
 *
 * It is drawn as the phone draws it, not approximately:
 *
 *  - **The quarter canvas is in dp, under the density.** React Native Skia
 *    scales its canvas by the pixel ratio and hands a runtime shader *local*
 *    coordinates, so the shader here gets dp too: the surface is scaled by
 *    the density and each pass's child image is read through the inverse.
 *    Uniforms are the ones `<ProgressiveBlur>` sends, in the same units.
 *  - **The tail is drawn into the layer** — the art, then the art turned over
 *    in its own foot, each clipped to its band — exactly as the component
 *    does it, and both passes run over the lot.
 *  - The image filter the app uses is not in CanvasKit, so the two passes are
 *    run by hand: a shader with the layer as its child, drawn to a surface,
 *    then the second with that surface as its child. That is what
 *    `SkImageFilters::RuntimeShader` composed twice does.
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';

import { DISSOLVE_STOPS, ROW_ENTERS_AT } from '../src/constants/game-masthead.ts';
import {
  PROGRESSIVE_BLUR,
  TAIL,
  blurShader,
  coverRect,
  washStops,
} from '../src/lib/progressive-blur.ts';

const require = createRequire(import.meta.url);
const init = require('canvaskit-wasm/bin/full/canvaskit.js');
const CK = await init({ locateFile: (f) => require.resolve(`canvaskit-wasm/bin/full/${f}`) });

const url = process.argv[2] ?? 'https://images.igdb.com/igdb/image/upload/t_720p/ar5w5.jpg';
const out = process.argv[3] ?? 'progressive-blur.png';
const title = process.argv[4] ?? 'The Walking Dead';

const DENSITY = 3;
const W = 360;
const H = Math.round(800 * 0.38);
const BOX = H * (1 + TAIL);
const HOLD = 32;
/* A game page's M3 background at tone 10, roughly. */
const PAGE = [0.07, 0.085, 0.1];
const PANELS = [
  { label: 'before', progress: 0, convx: false },
  { label: 'rest', progress: 0, convx: true },
  { label: '40%', progress: 0.4, convx: true },
  { label: 'scrolled', progress: 1, convx: true },
];
const GAP = 8;

const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
const art = CK.MakeImageFromEncoded(bytes);
if (!art) throw new Error(`could not decode ${url}`);
const artSize = { width: art.width(), height: art.height() };

const font = CK.Typeface.MakeFreeTypeFaceFromData(
  readFileSync(require.resolve('@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf')).buffer
);
const regular = CK.Typeface.MakeFreeTypeFaceFromData(
  readFileSync(require.resolve('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf'))
    .buffer
);

const effects = ['horizontal', 'vertical'].map((axis) =>
  CK.RuntimeEffect.Make(blurShader(axis), (e) => {
    throw new Error(e);
  })
);

/* `<ProgressiveBlur>`'s own arithmetic. */
const w = Math.ceil(W / PROGRESSIVE_BLUR.downscale);
const h = Math.ceil(BOX / PROGRESSIVE_BLUR.downscale);
const foot = (h * PROGRESSIVE_BLUR.artworkExtent) / PROGRESSIVE_BLUR.heroExtent;
const side = h / PROGRESSIVE_BLUR.heroExtent;
const pw = w * DENSITY;
const ph = h * DENSITY;
const toLocal = CK.Matrix.scaled(1 / DENSITY, 1 / DENSITY);

const linear = (image, src, dst, canvas, paint) =>
  canvas.drawImageRectOptions(image, src, dst, CK.FilterMode.Linear, CK.MipmapMode.None, paint);

/** The layer the filters see: the art, and the art turned over in its foot. */
function layer() {
  const surface = CK.MakeSurface(pw, ph);
  const canvas = surface.getCanvas();
  canvas.clear(CK.TRANSPARENT);
  canvas.scale(DENSITY, DENSITY);
  const r = coverRect(artSize, { width: w, height: foot }, 0.5, 0.5);
  const src = CK.XYWHRect(0, 0, artSize.width, artSize.height);
  const dst = CK.XYWHRect(r.x, r.y, r.width, r.height);
  const paint = new CK.Paint();
  canvas.save();
  canvas.clipRect(CK.XYWHRect(0, 0, w, foot), CK.ClipOp.Intersect, true);
  linear(art, src, dst, canvas, paint);
  canvas.restore();
  canvas.save();
  canvas.clipRect(CK.XYWHRect(0, foot, w, h - foot), CK.ClipOp.Intersect, true);
  canvas.translate(0, 2 * foot);
  canvas.scale(1, -1);
  linear(art, src, dst, canvas, paint);
  canvas.restore();
  const image = surface.makeImageSnapshot();
  surface.delete();
  return image;
}

function pass(effect, input, progress) {
  const surface = CK.MakeSurface(pw, ph);
  const canvas = surface.getCanvas();
  canvas.clear(CK.TRANSPARENT);
  canvas.scale(DENSITY, DENSITY);
  const child = input.makeShaderOptions(
    CK.TileMode.Clamp,
    CK.TileMode.Clamp,
    CK.FilterMode.Linear,
    CK.MipmapMode.None,
    toLocal
  );
  const shader = effect.makeShaderWithChildren(
    [w, h, side, w / PROGRESSIVE_BLUR.reference, progress],
    [child]
  );
  const paint = new CK.Paint();
  paint.setShader(shader);
  canvas.drawRect(CK.XYWHRect(0, 0, w, h), paint);
  const image = surface.makeImageSnapshot();
  surface.delete();
  return image;
}

function fadePaint(stops, height) {
  const paint = new CK.Paint();
  paint.setShader(
    CK.Shader.MakeLinearGradient(
      [0, 0],
      [0, height],
      stops.alphas.map((a) => CK.Color4f(...PAGE, a)),
      stops.locations,
      CK.TileMode.Clamp
    )
  );
  return paint;
}

/* The page's own dissolve, as `MASTHEAD_FADE` gives it to the gradient. */
const MASTHEAD = {
  locations: DISSOLVE_STOPS.map((s) => s.at),
  alphas: DISSOLVE_STOPS.map((s) => 1 - s.alpha),
};
const WASH = washStops();
const quarter = layer();

const report = [];
const lum = (v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
/** White's contrast on the ground in a band (dp), as drawn so far. */
function measure(x, y, width, height, label) {
  const px = total
    .makeImageSnapshot()
    .readPixels(Math.round(x * DENSITY), Math.round(y * DENSITY), {
      width: Math.round(width * DENSITY),
      height: Math.round(height * DENSITY),
      colorType: CK.ColorType.RGBA_8888,
      alphaType: CK.AlphaType.Unpremul,
      colorSpace: CK.ColorSpace.SRGB,
    });
  const ls = [];
  for (let i = 0; i < px.length; i += 4)
    ls.push(0.2126 * lum(px[i]) + 0.7152 * lum(px[i + 1]) + 0.0722 * lum(px[i + 2]));
  ls.sort((a, b) => a - b);
  const on = (l) => 1.05 / (l + 0.05);
  const mean = ls.reduce((a, b) => a + b, 0) / ls.length;
  return `${label.padEnd(9)} white on the title's ground: mean ${on(mean).toFixed(1)}:1, worst tenth ${on(ls[Math.floor(ls.length * 0.9)]).toFixed(1)}:1`;
}

const panelHeight = Math.ceil(BOX + HOLD + 120);
const total = CK.MakeSurface(
  (W * PANELS.length + GAP * (PANELS.length - 1)) * DENSITY,
  panelHeight * DENSITY
);
const canvas = total.getCanvas();
canvas.clear(CK.Color4f(...PAGE, 1));
canvas.scale(DENSITY, DENSITY);

PANELS.forEach(({ progress, convx }, index) => {
  const left = index * (W + GAP);
  const reach = convx ? BOX : H;
  canvas.save();
  canvas.translate(left, 0);
  canvas.clipRect(CK.XYWHRect(0, 0, W, panelHeight), CK.ClipOp.Intersect, true);

  /* The sharp art, at the art's height only. */
  const r = coverRect(artSize, { width: W, height: H }, 0.5, 0.5);
  canvas.save();
  canvas.clipRect(CK.XYWHRect(0, 0, W, H), CK.ClipOp.Intersect, true);
  linear(
    art,
    CK.XYWHRect(0, 0, artSize.width, artSize.height),
    CK.XYWHRect(r.x, r.y, r.width, r.height),
    canvas,
    new CK.Paint()
  );
  canvas.restore();

  /* Convx's blur over it, and below it, its tail. */
  if (convx) {
    const blurred = pass(effects[1], pass(effects[0], quarter, progress), progress);
    linear(blurred, CK.XYWHRect(0, 0, pw, ph), CK.XYWHRect(0, 0, W, BOX), canvas, new CK.Paint());
  }

  /* One fade over every copy: Convx's wash over art and tail, or the page's own over the art. */
  canvas.drawRect(CK.XYWHRect(0, 0, W, reach), fadePaint(convx ? WASH : MASTHEAD, reach));

  /* The masthead: the name where it is set, and the line under it. */
  const top = ROW_ENTERS_AT * H + 12;
  report.push(measure(left, top + 4, 230, 17, PANELS[index].label));
  const name = new CK.Font(font, 22);
  const white = new CK.Paint();
  white.setColor(CK.Color4f(1, 1, 1, 1));
  white.setAntiAlias(true);
  canvas.drawText(title, 15, top + 21, white, name);
  const quiet = new CK.Paint();
  quiet.setColor(CK.Color4f(0.78, 0.8, 0.84, 1));
  quiet.setAntiAlias(true);
  canvas.drawText('2012 · Telltale Games', 15, top + 27 + 20 + 14, quiet, new CK.Font(regular, 13));
  /* Where the cover stands, against the far margin. */
  const outline = new CK.Paint();
  outline.setStyle(CK.PaintStyle.Stroke);
  outline.setColor(CK.Color4f(1, 1, 1, 0.35));
  outline.setAntiAlias(true);
  canvas.drawRect(CK.XYWHRect(W - 15 - 100, ROW_ENTERS_AT * H, 100, 150), outline);
  canvas.restore();
});

writeFileSync(out, total.makeImageSnapshot().encodeToBytes());
console.log(`${out}: ${PANELS.map((p) => p.label).join(' | ')} — ${url}`);
for (const line of report) console.log('  ' + line);
