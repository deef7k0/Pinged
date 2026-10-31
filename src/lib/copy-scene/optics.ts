import type { PlatformKey } from '../../constants/platform-cases';

/**
 * The copy stage's optics, as numbers: what a game's disc is made of, how its
 * light behaves, how the idle stage rocks, and where the camera stands.
 *
 * The 3D stage (`lib/copy-scene/scene.ts`, drawn by `<CopyStageGL>`) is
 * shaded on the GPU, and a shader cannot be tested here. What it is *tuned
 * on* can be, and is: every physical constant the shaders are handed comes
 * from this file, and `npm test` holds each one to the object it describes.
 *
 * Pure, and under `npm test`: it may not import `platform-cases.ts` for
 * anything but a type, because that file `require()`s the case artwork.
 */

// ---------------------------------------------------------------------------
// The disc
// ---------------------------------------------------------------------------

/**
 * How a disc was pressed. The format is what decides how close its tracks
 * are, and the tracks are what put a rainbow in it.
 */
export type DiscFormat = 'cd' | 'dvd' | 'bd';

/**
 * The distance between neighbouring turns of the spiral track, in nanometres.
 *
 * A disc's rainbow is a reflection grating's first and second orders, and a
 * grating's colours leave it at `sin θ = sin θᵢ + mλ/d`: the closer the
 * tracks, the wider the angle. A CD's 1.6 µm puts a full spectrum within a
 * few tens of degrees of the mirror reflection — the streaks everybody knows.
 * A DVD's 0.74 µm throws it out to steep angles. A Blu-ray's 0.32 µm is
 * shorter than visible light, so at anything near normal incidence there is
 * no first order at all: a Blu-ray is a plain mirror, faintly coloured only
 * where it is seen edge-on. That is how the three really look, and the stage
 * draws each as it is.
 */
export const TRACK_PITCH_NM: Record<DiscFormat, number> = { cd: 1600, dvd: 740, bd: 320 };

/**
 * Which format each disc platform's games were pressed on.
 *
 * Blu-ray for the machines that read it (and the Wii U's own disc, which is
 * a Blu-ray in all but name); CD for the machines before DVD. Everything else
 * that takes a disc is DVD-based: the PlayStation 2 (its few CD-ROM games
 * aside), both older Xboxes, the GameCube's and the Wii's discs, and the
 * PSP's UMD, which is pressed like a DVD. The Dreamcast's GD-ROM has a denser
 * outer area than a CD's; it is drawn at a CD's pitch, which its inner area
 * has.
 */
const FORMAT: Partial<Record<PlatformKey, DiscFormat>> = {
  ps5: 'bd',
  ps4: 'bd',
  ps3: 'bd',
  xbox: 'bd',
  wiiu: 'bd',
  ps1: 'cd',
  saturn: 'cd',
  segacd: 'cd',
  dreamcast: 'cd',
  jaguarcd: 'cd',
  pcfx: 'cd',
  threedo: 'cd',
};

export function discFormatFor(platform: PlatformKey): DiscFormat {
  return FORMAT[platform] ?? 'dvd';
}

/** The disc's diameter in millimetres: 12cm, except the GameCube's 8cm. */
export function discDiameterMm(platform: PlatformKey): number {
  return platform === 'gamecube' ? 80 : 120;
}

/**
 * The rings of a disc's playing side, as fractions of its radius.
 *
 * From the centre out, in millimetres from it on a 12cm disc (ECMA-130's
 * figures, which a DVD and a Blu-ray share near enough):
 *
 *  - `hole` — the 15mm hole.
 *  - `ridge` — the small ridge the drive's clamp sits on, moulded in the
 *    clear hub.
 *  - `stack` — the raised stacking ring that keeps a pile of discs apart.
 *  - `mirror` — where the reflective layer begins: a plain mirror band, no
 *    tracks yet.
 *  - `data` — where the tracks begin (the lead-in).
 *  - `written` — how far a game's data reaches. Pressed pits are a shade
 *    darker than the unused land beyond them.
 *  - `dataEnd`, `metalEnd` — where the tracks stop, and the metal; past it,
 *    a thin clear lip to the rim, the label's ink showing through it.
 *
 * The inner rings are where a drive's hub needs them, so they keep their
 * millimetres on a small disc; the outer ones keep their distance from the rim.
 */
export type DiscZones = {
  hole: number;
  ridge: number;
  stack: number;
  mirror: number;
  data: number;
  written: number;
  dataEnd: number;
  metalEnd: number;
};

export function discZones(diameterMm: number): DiscZones {
  const r = diameterMm / 2;
  return {
    hole: 7.5 / r,
    ridge: 9 / r,
    stack: 15.7 / r,
    mirror: 18.25 / r,
    data: 22.6 / r,
    written: Math.min(51.4, r - 4) / r,
    dataEnd: (r - 2.8) / r,
    metalEnd: (r - 2.2) / r,
  };
}

/**
 * How much light the playing side's plastic lets through on each pass, per
 * channel. A disc is read through its polycarbonate, and the aluminium under
 * it is seen through the same plastic twice — in and out.
 *
 * Clear on nearly every disc. **The PlayStation's are black**: the plastic is
 * dyed to pass the drive's infrared laser and stop visible light, so the
 * mirror and its rainbow are all but gone and what is left is the gloss of
 * the plastic's own surface. A PlayStation game turned over is a black disc.
 */
export function discPlasticTransmittance(platform: PlatformKey): readonly [number, number, number] {
  return platform === 'ps1' ? [0.13, 0.12, 0.14] : [1, 1, 1];
}

/** Polycarbonate's refractive index, the plastic a disc is moulded from. */
export const POLYCARBONATE_IOR = 1.58;

/** The share of light a surface reflects head on, from its refractive index (Fresnel at 0°). */
export function normalReflectance(ior: number): number {
  return ((ior - 1) / (ior + 1)) ** 2;
}

// ---------------------------------------------------------------------------
// Light
// ---------------------------------------------------------------------------

/**
 * A wavelength in nanometres as linear RGB, after Alan Zucconi's spectral
 * fit — the same function the shaders integrate with, so a test of this is a
 * test of the colours they draw. Zero outside 400–700.
 */
export function spectralRGB(nm: number): [number, number, number] {
  if (nm < 400 || nm > 700) return [0, 0, 0];
  const x = (nm - 400) / 300;
  const c1 = [3.54585104, 2.93225262, 2.41593945];
  const x1 = [0.69549072, 0.49228336, 0.2769988];
  const y1 = [0.02312639, 0.15225084, 0.52607955];
  const c2 = [3.9030714, 3.21182957, 3.96587128];
  const x2 = [0.11748627, 0.86755042, 0.6607786];
  const y2 = [0.8489713, 0.88445281, 0.73949448];
  const bump = (c: number, xo: number, yo: number) => {
    const t = c * (x - xo);
    return Math.min(1, Math.max(0, 1 - t * t - yo));
  };
  return [0, 1, 2].map((i) => bump(c1[i], x1[i], y1[i]) + bump(c2[i], x2[i], y2[i])) as [
    number,
    number,
    number,
  ];
}

/**
 * The sine of the angle a reflection grating sends one order of one colour
 * off at: `sin θₘ = sin θᵢ + mλ/d`. Outside -1…1 that order does not leave
 * the disc at all.
 */
export function diffractedSine(
  incidenceSine: number,
  wavelengthNm: number,
  pitchNm: number,
  order: number
): number {
  return incidenceSine + (order * wavelengthNm) / pitchNm;
}

/**
 * Whether light falling straight onto a disc of this format comes back with
 * any visible first-order colour: the reason a CD is a rainbow and a Blu-ray
 * is a mirror.
 */
export function showsRainbowHeadOn(format: DiscFormat): boolean {
  return Math.abs(diffractedSine(0, 400, TRACK_PITCH_NM[format], 1)) <= 1;
}

// ---------------------------------------------------------------------------
// The studio
// ---------------------------------------------------------------------------

type Vec3 = readonly [number, number, number];

export type StudioLight = {
  /** Where it hangs, from the object, in the camera's frame: x right, y up, z toward the viewer. */
  dir: Vec3;
  /** Its half-size, as the tangent of the angle each way: how large it looks in a mirror. */
  box: readonly [number, number];
  /** How bright it is in a reflection, against a white page's 1. */
  power: number;
  /** How much of the game's own lamp colour it takes on. */
  tint: number;
  /** Its share of the light a matte surface square on to the camera receives. */
  share: number;
};

/**
 * The room the copy is lit in: a dark studio, as the page is dark, with four
 * softboxes.
 *
 *  - **The front key**, a long strip just over the camera and a little to
 *    the left. A surface square on to the reader catches its reflection as a
 *    band near its top, and the rock sweeps that band up and down the face —
 *    the sheen, carrying the plastic's thin-film colours. It is also what a
 *    CD's first order catches head on: the rainbow streaks.
 *  - **The lamp**, up and to the left, where the floor's glow has always been
 *    and the case's shadow falls away from. Tinted with the game's colour.
 *  - **A tall strip** to the right, for a highlight down the turning edges.
 *  - **One overhead and behind**, which lights the top edge as it rocks.
 *
 * The floor is nearly black and the cyclorama dim, so a mirror shows the
 * room as it is — dark, with the boxes in it — and not a flat grey.
 */
export const STUDIO: readonly StudioLight[] = [
  { dir: [-0.16, 0.2, 0.97], box: [0.5, 0.07], power: 6, tint: 0.14, share: 0.5 },
  { dir: [-0.62, 0.52, 0.58], box: [0.5, 0.3], power: 4.6, tint: 0.32, share: 0.4 },
  { dir: [0.86, 0.12, 0.49], box: [0.07, 0.7], power: 3.6, tint: 0, share: 0.1 },
  { dir: [0.1, 0.86, -0.5], box: [0.7, 0.14], power: 2.8, tint: 0.1, share: 0 },
];

/** The room's own light; the cyclorama's three heights and the room behind the reader, linear. */
export const STUDIO_AMBIENT = 0.3;
export const STUDIO_ENV = { low: 0.01, mid: 0.035, top: 0.12, room: 0.26, tint: 0.25 } as const;
/** The overhead box lights a top edge; this much, against the others' shares. */
const OVERHEAD_SHARE = 0.03;

function normalise(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/**
 * Each box's diffuse weight: chosen so that a printed surface square on to
 * the reader is lit at exactly 1 — the box art at its own colours, as the
 * flat stage drew it — and turning it away from the boxes darkens it.
 */
export function studioDiffuse(): number[] {
  const facing = 1 - STUDIO_AMBIENT * 0.82;
  return STUDIO.map((light) => {
    const d = normalise(light.dir);
    const share = light.share > 0 ? light.share : 0;
    if (d[2] <= 0) return OVERHEAD_SHARE / light.power;
    return (facing * share) / (light.power * d[2]);
  });
}

/** What the shaders' `irradiance()` gives a surface facing `n` (unit), before any tint. */
export function studioIrradiance(n: Vec3): number {
  const weights = studioDiffuse();
  let total = STUDIO_AMBIENT * (0.82 + 0.18 * n[1]);
  STUDIO.forEach((light, i) => {
    const d = normalise(light.dir);
    total += light.power * weights[i] * Math.max(0, n[0] * d[0] + n[1] * d[1] + n[2] * d[2]);
  });
  return total;
}

/** The studio turned with the phone: its lights swing as the flat stage's lamp did. */
export const LAMP_SWING = 16;
export const LAMP_LIFT = 10;

export function studioDirection(dir: Vec3, tiltX: number, tiltY: number): Vec3 {
  const yaw = (LAMP_SWING * tiltX * Math.PI) / 180;
  const lift = (LAMP_LIFT * tiltY * Math.PI) / 180;
  const [x0, y0, z0] = normalise(dir);
  /* About y, then about x. */
  const x1 = x0 * Math.cos(yaw) + z0 * Math.sin(yaw);
  const z1 = -x0 * Math.sin(yaw) + z0 * Math.cos(yaw);
  const y2 = y0 * Math.cos(lift) - z1 * Math.sin(lift);
  const z2 = y0 * Math.sin(lift) + z1 * Math.cos(lift);
  return normalise([x1, y2, z2]);
}

// ---------------------------------------------------------------------------
// The idle rock
// ---------------------------------------------------------------------------

/**
 * Left alone, the object does more than turn: it rocks, a few degrees back
 * and forth and a little side to side, so the light runs over it and the
 * sheen shifts as a real one does when it is held. Two slow periods that
 * never line up, so the motion never visibly repeats.
 */
export const ROCK = {
  /** Back and forth, in degrees either way, and the seconds one swing takes. */
  pitch: 7,
  pitchPeriod: 11.5,
  /** Side to side. */
  roll: 2.2,
  rollPeriod: 17.3,
  /** How quickly the rock comes in and goes, a share of the gap a second. */
  ease: 1.4,
} as const;

/** How far the phone's own forward tilt leans the object, in degrees. */
export const TILT_PITCH = 4;

/**
 * The rock at a moment, in degrees. `amount` is how much of it is wanted,
 * 0–1, which the stage eases to nothing when it is not alive.
 */
export function idleRock(seconds: number, amount: number): { pitch: number; roll: number } {
  const k = Math.max(0, Math.min(1, amount));
  if (k === 0) return { pitch: 0, roll: 0 };
  return {
    pitch: ROCK.pitch * k * Math.sin((2 * Math.PI * seconds) / ROCK.pitchPeriod),
    roll: ROCK.roll * k * Math.sin((2 * Math.PI * seconds) / ROCK.rollPeriod + 1.1),
  };
}

/** One frame of easing `amount` toward `target`, over `dt` seconds. */
export function easeRock(amount: number, target: number, dt: number): number {
  const step = Math.min(1, Math.max(0, dt) * ROCK.ease);
  return amount + (target - amount) * step;
}

// ---------------------------------------------------------------------------
// The lens
// ---------------------------------------------------------------------------

/**
 * The 3D stage's camera, matched to the one `lib/stage-geometry` solves by
 * hand: at `camera` dp in front of the object's centre, looking straight at
 * it, with the object's centre at `(centreX, centreY)` of a canvas
 * `width × height` dp. At the object's own depth one unit is one dp on the
 * screen, so the two stages draw the same case in the same place, and the
 * stage's taps — worked out against the hand-solved camera — land on it.
 *
 * The camera's axis is not the canvas's middle, so the projection is a window
 * into a larger, centred one: `fullWidth × fullHeight`, `offsetX/offsetY` in
 * from its top left (three.js's `setViewOffset`). `fov` is the larger one's
 * vertical field, in degrees.
 */
export function stageLens(
  width: number,
  height: number,
  centreX: number,
  centreY: number,
  camera: number
): { fov: number; fullWidth: number; fullHeight: number; offsetX: number; offsetY: number } {
  const fullWidth = 2 * Math.max(centreX, width - centreX);
  const fullHeight = 2 * Math.max(centreY, height - centreY);
  return {
    fov: (2 * Math.atan(fullHeight / 2 / camera) * 180) / Math.PI,
    fullWidth,
    fullHeight,
    offsetX: fullWidth / 2 - centreX,
    offsetY: fullHeight / 2 - centreY,
  };
}

/**
 * How many pixels a dp the 3D stage draws at. A phone's display is 2.6–3.5;
 * the stage is shaded per pixel, and its disc's rainbow is the most expensive
 * thing in the app to draw, so it is drawn at two and scaled up — finer than
 * the eye separates at arm's length on an object that is always moving.
 */
export const STAGE_PIXELS_PER_DP = 2;

export function stageRenderScale(density: number): number {
  return Math.min(density, STAGE_PIXELS_PER_DP);
}
