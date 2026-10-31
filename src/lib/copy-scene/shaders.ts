/**
 * The copy stage's shaders: the case's plastic and print, and the disc's two
 * sides and its edge.
 *
 * Written for three.js's `ShaderMaterial` on WebGL 2 (GLSL ES 3.00 after
 * three's own prefix), which is what expo-gl gives a phone. Every surface is
 * lit by one small, procedural photographer's studio — a dark room, four
 * softboxes — so the case, its sheen and the disc's rainbow all come from the
 * same lights and move together when the object does. The lights' numbers are
 * `scene.ts`'s; the physics they feed is `optics.ts`'s, under `npm test`.
 *
 * Colours: textures arrive as sRGB bytes and are decoded here (`toLinear`);
 * three tone-maps (Khronos PBR Neutral, which leaves everything under ~0.76
 * as it is, so box art keeps its colours) and encodes back to sRGB in the
 * `#include`s at the foot of each shader. Every transparent surface writes
 * **premultiplied** colour, which is what a transparent canvas is composited
 * as on both platforms.
 *
 * Kept affordable on a phone: the disc's playing side, the most expensive
 * thing here, integrates six wavelengths where an offline renderer would take
 * thirty, and only the orders its format can produce.
 */

const COMMON = /* glsl */ `
uniform vec3 uLdir[4];
uniform vec3 uLcol[4];
uniform vec4 uLbox[4];
uniform vec3 uLrt[4];
uniform vec3 uLup[4];
uniform vec3 uEnvLow;
uniform vec3 uEnvMid;
uniform vec3 uEnvTop;
uniform vec3 uEnvRoom;
uniform vec3 uAmbient;

varying vec3 vPos;
varying vec2 vUv;
varying vec3 vWPos;
varying vec3 vWN;
varying vec3 vWT;
varying vec3 vWR;

vec3 toLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    s += a * vnoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return s;
}

/* A wavelength as linear RGB (Zucconi's fit; optics.ts's spectralRGB). */
vec3 bump3y(vec3 x, vec3 yo) {
  vec3 y = 1.0 - x * x;
  return clamp(y - yo, 0.0, 1.0);
}
vec3 spectral(float w) {
  if (w < 400.0 || w > 700.0) return vec3(0.0);
  float x = (w - 400.0) / 300.0;
  const vec3 c1 = vec3(3.54585104, 2.93225262, 2.41593945);
  const vec3 x1 = vec3(0.69549072, 0.49228336, 0.27699880);
  const vec3 y1 = vec3(0.02312639, 0.15225084, 0.52607955);
  const vec3 c2 = vec3(3.90307140, 3.21182957, 3.96587128);
  const vec3 x2 = vec3(0.11748627, 0.86755042, 0.66077860);
  const vec3 y2 = vec3(0.84897130, 0.88445281, 0.73949448);
  return bump3y(c1 * (x - x1), y1) + bump3y(c2 * (x - x2), y2);
}

/*
 * Thin-film interference: a transparent film d nm thick (index 1.38, a
 * coating's), its two surfaces' reflections adding or cancelling by
 * wavelength. Integrated over seven wavelengths and normalised, so it is a
 * tint — saturated a little, as a film's colours read against the light.
 */
vec3 thinFilm(float cosI, float d) {
  float n = 1.38;
  float cosT = sqrt(max(1.0 - (1.0 - cosI * cosI) / (n * n), 0.0));
  float opd = 2.0 * n * d * cosT;
  vec3 acc = vec3(0.0);
  vec3 nrm = vec3(0.0);
  for (int i = 0; i < 7; i++) {
    float lam = 420.0 + 45.0 * float(i);
    vec3 s = spectral(lam);
    acc += s * (0.5 - 0.5 * cos(6.2831853 * opd / lam));
    nrm += s;
  }
  vec3 c = acc / max(nrm, vec3(1e-3));
  float l = dot(c, vec3(0.3333));
  return clamp(mix(vec3(l), c, 1.9), 0.0, 1.0);
}

/* A softbox seen in direction r: a soft-edged rectangle round its axis. */
float softBox(vec3 r, int i, float soft) {
  vec3 c = uLdir[i];
  float d = dot(r, c);
  if (d <= 0.0) return 0.0;
  vec2 p = abs(vec2(dot(r, uLrt[i]), dot(r, uLup[i])) / d);
  vec2 sz = uLbox[i].xy;
  vec2 q = 1.0 - smoothstep(sz - soft, sz + soft, p);
  return q.x * q.y;
}

/*
 * The studio, as a mirror sees it: a dark floor, a dim cyclorama rising to
 * a brighter ceiling, the four softboxes — and, behind the reader, the room
 * they are sitting in, soft and grey. The studio is dark because the page
 * is; the room behind is what lets a mirror read as metal and not as a hole,
 * since a mirror held up to a dark wall is black.
 */
vec3 envMap(vec3 r, float rough) {
  float soft = 0.015 + rough * 0.5;
  vec3 c = mix(uEnvLow, uEnvMid, smoothstep(-0.55, 0.05, r.y));
  c = mix(c, uEnvTop, smoothstep(0.05, 0.95, r.y));
  c += uEnvRoom * smoothstep(0.05, 0.85, r.z) * (0.45 + 0.55 * smoothstep(-0.45, 0.55, r.y));
  for (int i = 0; i < 4; i++) c += uLcol[i] * softBox(r, i, soft);
  return c;
}

/* Diffuse light on a surface facing n: the room's fill and each box's share. */
vec3 irradiance(vec3 n) {
  vec3 c = uAmbient * (0.82 + 0.18 * n.y);
  for (int i = 0; i < 4; i++) c += uLcol[i] * uLbox[i].z * max(dot(n, uLdir[i]), 0.0);
  return c;
}
`;

/** One vertex shader for everything: the disc's tangent frame comes from its own plane. */
export const VERTEX = /* glsl */ `
varying vec3 vPos;
varying vec2 vUv;
varying vec3 vWPos;
varying vec3 vWN;
varying vec3 vWT;
varying vec3 vWR;
void main() {
  vPos = position;
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWPos = wp.xyz;
  mat3 m = mat3(modelMatrix);
  vWN = normalize(m * normal);
  vec2 rp = position.xy;
  float rl = max(length(rp), 1e-4);
  vWR = normalize(m * vec3(rp / rl, 0.0));
  vWT = normalize(m * vec3(-rp.y / rl, rp.x / rl, 0.0));
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

/**
 * Every face of the case, printed or plain, under the case's clear plastic.
 *
 * One shader with a define per kind of face (`FACE_*`), so each compiles to
 * only its own branch. What is printed on a face is worked out first, as the
 * view stage draws it; the light is the same for all of them after that.
 *
 * The plastic is a dielectric (index ~1.5, 4% head on) over the print, and
 * its reflection carries a thin film's colours — a keep case's sleeve, or a
 * sealed copy's shrink-wrap, which is thinner, uneven, crinkled and much more
 * colourful. That reflection is the sheen: dark where the room is dark, and a
 * band of shifting colour wherever a softbox is caught, which the rock and
 * the turn slide across the face.
 */
export const CASE_FACE = /* glsl */ `
${COMMON}
uniform sampler2D uMap;
uniform sampler2D uOver;
uniform sampler2D uArt;
uniform vec4 uRect;
uniform vec2 uFaceSize;
uniform float uArtAspect;
uniform float uHasArt;
uniform float uHasBand;
uniform vec3 uBlank;
uniform vec3 uPlasticTop;
uniform vec3 uPlasticBottom;
uniform vec3 uRule;
uniform vec3 uPrint;
uniform vec3 uPaper;
uniform vec3 uInsert;
uniform float uEditionH;
uniform float uRadius;
uniform float uDisc;
uniform float uManual;
uniform float uInserts;
uniform float uIris;
uniform float uWrap;

/* The art filling a box (0–1, top-left origin) as contentFit "cover" would. */
vec3 coverArt(vec2 q, float boxAspect) {
  float a = uArtAspect / boxAspect;
  vec2 uv = 0.5 + (q - 0.5) * vec2(min(1.0, 1.0 / a), min(1.0, a));
  return uHasArt > 0.5 ? toLinear(texture(uArt, uv).rgb) : uBlank;
}

/* Signed distance to a rounded rectangle centred on the origin. */
float roundRect(vec2 p, vec2 hs, float r) {
  vec2 q = abs(p) - hs + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float inside(float d) {
  float w = max(fwidth(d), 1e-3);
  return 1.0 - smoothstep(-w, w, d);
}

vec3 plastic(vec2 uv) {
  return mix(uPlasticTop, uPlasticBottom, uv.y);
}

vec4 printed(vec2 uv) {
  vec2 p = uv * uFaceSize;
#if defined(FACE_FRONT_CASED)
  vec2 q = (uv - uRect.xy) / uRect.zw;
  float win = step(0.0, q.x) * step(q.x, 1.0) * step(0.0, q.y) * step(q.y, 1.0);
  vec3 art = coverArt(q, (uRect.z * uFaceSize.x) / (uRect.w * uFaceSize.y));
  vec4 base = vec4(art, win);
  vec4 t = texture(uOver, uv);
  t.rgb = toLinear(t.rgb);
  float a = t.a + base.a * (1.0 - t.a);
  vec3 rgb = (t.rgb * t.a + base.rgb * base.a * (1.0 - t.a)) / max(a, 1e-4);
  vec4 c = vec4(rgb, a);
#elif defined(FACE_FRONT_BARE)
  vec3 art = coverArt(uv, uFaceSize.x / uFaceSize.y);
  float d = roundRect(p - uFaceSize * 0.5, uFaceSize * 0.5, uRadius);
  float edge = 1.0 - smoothstep(0.0, 1.0, -d);
  vec4 c = vec4(mix(art, uRule, edge * 0.6), inside(d));
#elif defined(FACE_PICTURE)
  vec4 c = texture(uMap, uv);
  c.rgb = toLinear(c.rgb);
  if (!gl_FrontFacing) c = vec4(plastic(uv), 1.0);
#elif defined(FACE_SCAN)
  float d = roundRect(p - uFaceSize * 0.5, uFaceSize * 0.5, uRadius);
  vec2 s = (uv - uRect.xy) / uRect.zw;
  float on = step(0.0, s.x) * step(s.x, 1.0) * step(0.0, s.y) * step(s.y, 1.0);
  vec4 scan = texture(uMap, clamp(s, 0.0, 1.0));
  vec3 rgb = mix(plastic(uv), toLinear(scan.rgb), scan.a * on);
  vec4 c = vec4(rgb, inside(d));
#elif defined(FACE_PLASTIC)
  vec4 c = vec4(uPrint, 1.0);
  if (!gl_FrontFacing) c = vec4(plastic(uv), 1.0);
#elif defined(FACE_TRAY)
  vec3 rgb = plastic(uv);
  vec2 m = p - uFaceSize * 0.5;
  float rim = abs(roundRect(m, uFaceSize * 0.5 - uFaceSize.x * 0.022, uRadius));
  rgb = mix(rgb, uRule, (1.0 - smoothstep(0.0, 0.9, rim)) * 0.8);
  float r = length(m);
  float well = uDisc * 1.045 * 0.5;
  rgb = mix(rgb, uPlasticBottom * 0.7, (1.0 - smoothstep(well - 0.6, well + 0.6, r)) * 0.7);
  rgb = mix(rgb, uRule, (1.0 - smoothstep(0.0, 0.8, abs(r - well))) * 0.7);
  float clip = max(10.0, uDisc * 0.115) * 0.5;
  rgb = mix(rgb, uPlasticTop, 1.0 - smoothstep(clip - 0.6, clip + 0.6, r));
  rgb = mix(rgb, uRule * 1.6, (1.0 - smoothstep(0.0, 0.7, abs(r - clip))) * 0.8);
  rgb = mix(rgb, uPlasticBottom, 1.0 - smoothstep(clip * 0.48 - 0.6, clip * 0.48 + 0.6, r));
  rgb = mix(rgb, uPlasticBottom * 0.5, (1.0 - smoothstep(0.0, 0.16, uv.x)) * 0.85);
  vec4 c = vec4(rgb, inside(roundRect(m, uFaceSize * 0.5, uRadius)));
#elif defined(FACE_LEAF)
  vec3 rgb = plastic(uv);
  vec2 bl = vec2(0.11, 0.09) * uFaceSize;
  vec2 bs = vec2(0.76, 0.82) * uFaceSize;
  if (uInserts > 0.5) {
    vec2 o = bl + vec2(0.03 * uFaceSize.x, -0.025 * uFaceSize.y);
    float d = roundRect(p - (o + bs * 0.5), bs * 0.5, 2.0);
    rgb = mix(rgb, uInsert, inside(d));
  }
  float book = roundRect(p - (bl + bs * 0.5), bs * 0.5, 2.0);
  if (uManual > 0.5) {
    rgb = mix(rgb, uPaper, inside(book));
    vec2 margin = vec2(0.02 * uFaceSize.x);
    vec2 aq = (p - bl - margin) / (bs - 2.0 * margin);
    float onArt = step(0.0, aq.x) * step(aq.x, 1.0) * step(0.0, aq.y) * step(aq.y, 1.0);
    vec3 art = coverArt(aq, (bs.x - 2.0 * margin.x) / (bs.y - 2.0 * margin.x));
    rgb = mix(rgb, art, onArt * uHasArt);
    float fold = step(bl.x + bs.x - 3.0, p.x) * step(p.x, bl.x + bs.x) * inside(book);
    rgb = mix(rgb, rgb * 0.78, fold);
  } else {
    float dash = step(0.5, fract((p.x + p.y) / 6.0));
    rgb = mix(rgb, uRule * 1.4, (1.0 - smoothstep(0.0, 0.8, abs(book))) * dash);
  }
  for (int i = 0; i < 2; i++) {
    float at = i == 0 ? 0.24 : 0.66;
    vec2 ts = vec2(0.07, 0.1) * uFaceSize;
    vec2 tc = vec2(ts.x * 0.5, uFaceSize.y * at + ts.y * 0.5);
    float d = roundRect(p - tc, ts * 0.5, 3.0);
    rgb = mix(rgb, uPlasticTop, inside(d));
    rgb = mix(rgb, uRule * 1.6, (1.0 - smoothstep(0.0, 0.7, abs(d))) * 0.8);
  }
  vec4 c = vec4(rgb, inside(roundRect(p - uFaceSize * 0.5, uFaceSize * 0.5, uRadius)));
#else
  vec4 c = vec4(uBlank, 1.0);
#endif
#if defined(FACE_FRONT_CASED) || defined(FACE_FRONT_BARE)
  /* The edition band: a snapshot of the view stage's own, across the foot. */
  if (uHasBand > 0.5 && uEditionH > 0.0) {
    float y = (uv.y - (1.0 - uEditionH)) / uEditionH;
    if (y >= 0.0) {
      vec4 band = texture(uMap, vec2(uv.x, y));
      c.rgb = mix(c.rgb, toLinear(band.rgb), band.a);
    }
  }
#endif
  return c;
}

void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  vec4 base = printed(uv);
  if (base.a < 0.004) discard;

  vec3 N = normalize(vWN);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vWPos);

  /* A sealed copy's film is crinkled: its normal wanders a little, in long
     creases, and its reflection breaks up along them. */
  vec2 fp = uv * uFaceSize / 46.0;
  if (uWrap > 0.0) {
    float e = 0.35;
    vec2 wp = fp * vec2(0.55, 1.1);
    float n0 = fbm(wp);
    float nx = fbm(wp + vec2(e, 0.0)) - n0;
    float ny = fbm(wp + vec2(0.0, e)) - n0;
    vec3 tx = normalize(cross(abs(N.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0), N));
    vec3 ty = cross(N, tx);
    N = normalize(N - uWrap * 0.1 * (nx * tx + ny * ty));
  }

  float NoV = clamp(dot(N, V), 1e-3, 1.0);
  vec3 R = reflect(-V, N);
  float F = 0.04 + 0.96 * pow(1.0 - NoV, 5.0);

  /* The film thickens steadily across the face, corner to corner, so its
     colours lie in soft diagonal bands — which slide as the angle to them
     changes. A little unevenness, and much more of it in shrink-wrap. */
  float th = 300.0 + 320.0 * (0.55 * uv.x + 0.45 * uv.y) + 50.0 * fbm(fp * 0.35 + vec2(3.1, 0.7))
           + uWrap * 150.0 * vnoise(fp * vec2(0.5, 1.0));
  vec3 film = thinFilm(NoV, th);
  vec3 spec = envMap(R, 0.05 + uWrap * 0.08) * F * mix(vec3(1.0), film * 2.0, uIris);
  /* Shrink-wrap is two more surfaces over the case's own. */
  spec *= 1.0 + uWrap * 0.5;

  vec3 col = base.rgb * irradiance(N) * (1.0 - F) + spec;
  gl_FragColor = vec4(col, base.a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor.rgb *= gl_FragColor.a;
}
`;

/**
 * The label: what the view stage's `<CdDisc>` prints — the game's art in the
 * label window, the console's own disc template over it, or a scan of the
 * real disc — and where it is clear plastic. Shared by both sides, because
 * from the playing side the clear rings show the label's ink through them.
 */
const LABEL = /* glsl */ `
uniform sampler2D uArt;
uniform sampler2D uTpl;
uniform sampler2D uScan;
uniform vec4 uTplGeo;
uniform vec2 uTplRadii;
uniform float uArtAspect;
uniform float uHasArt;
uniform float uUseScan;
uniform float uScanAspect;
uniform vec3 uBlank;

/* The label at a point of the disc (radius 1), straight alpha, and how much
   of it is the disc's own silver printing rather than the art. */
vec4 labelInk(vec2 xy, out float foil) {
  foil = 0.0;
  if (uUseScan > 0.5) {
    vec2 s = uScanAspect >= 1.0 ? vec2(1.0, 1.0 / uScanAspect) : vec2(uScanAspect, 1.0);
    vec2 uv = 0.5 + vec2(xy.x, -xy.y) / (2.0 * s);
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
    vec4 c = texture(uScan, uv);
    float mx = max(c.r, max(c.g, c.b));
    float mn = min(c.r, min(c.g, c.b));
    foil = (1.0 - smoothstep(0.18, 0.4, (mx - mn) / max(mx, 1e-3))) * smoothstep(0.45, 0.75, mx);
    return vec4(toLinear(c.rgb), c.a);
  }
  float r = length(xy);
  vec4 base = vec4(0.0);
  if (r < uTplRadii.x && r > uTplRadii.y) {
    vec2 q = 0.5 + 0.5 * vec2(xy.x, -xy.y) / uTplRadii.x;
    vec2 uv = 0.5 + (q - 0.5) * vec2(min(1.0, 1.0 / uArtAspect), min(1.0, uArtAspect));
    base = vec4(uHasArt > 0.5 ? toLinear(texture(uArt, uv).rgb) : uBlank, 1.0);
  }
  vec4 t = texture(uTpl, vec2(uTplGeo.x + xy.x * uTplGeo.z, uTplGeo.y - xy.y * uTplGeo.w));
  float mx = max(t.r, max(t.g, t.b));
  float mn = min(t.r, min(t.g, t.b));
  foil = t.a * (1.0 - smoothstep(0.18, 0.4, (mx - mn) / max(mx, 1e-3))) * smoothstep(0.35, 0.7, mx);
  t.rgb = toLinear(t.rgb);
  float a = t.a + base.a * (1.0 - t.a);
  vec3 rgb = (t.rgb * t.a + base.rgb * base.a * (1.0 - t.a)) / max(a, 1e-4);
  return vec4(rgb, a);
}
`;

/** The track grating's answer to one bright light: its diffracted orders, in colour. */
const GRATING = /* glsl */ `
vec3 grating(vec3 V, vec3 N, vec3 T, vec3 Rd, float d, float sig) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    vec3 Ld = uLdir[i];
    float nl = dot(N, Ld);
    if (nl <= 0.0) continue;
    vec3 H = Ld + V;
    /* Along the tracks the light keeps its momentum; across them it changes
       by whole multiples of λ/d. */
    float a = dot(H, T);
    float w = exp(-a * a / (sig * sig));
    float u = abs(dot(H, Rd));
    vec3 s = vec3(0.0);
    for (int m = 1; m <= 3; m++) s += spectral(u * d / float(m)) / float(m);
    acc += uLcol[i] * s * w * nl;
  }
  return acc;
}
`;

/**
 * The disc's printed side: varnished print, the console's silver printing as
 * holographic foil with a little glitter in it, and the clear hub.
 */
export const DISC_LABEL = /* glsl */ `
${COMMON}
${LABEL}
${GRATING}
uniform vec4 uZones;

void main() {
  vec2 xy = vPos.xy;
  float r = length(xy);
  float fw = max(fwidth(r), 1e-4);
  float shape = smoothstep(uZones.x - fw, uZones.x + fw, r) * (1.0 - smoothstep(1.0 - fw, 1.0, r));
  if (shape < 0.004) discard;

  float foil;
  vec4 ink = labelInk(xy, foil);
  vec3 N = normalize(vWN);
  vec3 V = normalize(cameraPosition - vWPos);
  vec3 T = normalize(vWT);
  vec3 Rd = normalize(vWR);
  float NoV = clamp(dot(N, V), 1e-3, 1.0);
  vec3 R = reflect(-V, N);
  vec3 irr = irradiance(N);

  float th = 250.0 + 420.0 * fbm(xy * 3.2 + vec2(0.0, r * 1.4)) + 110.0 * dot(V, Rd);
  vec3 film = thinFilm(NoV, th);

  /* Varnished print: a dielectric (4% head on) with a faint pearl laminate. */
  float Fc = 0.04 + 0.96 * pow(1.0 - NoV, 5.0);
  vec3 envC = envMap(R, 0.06);
  vec3 printCol = ink.rgb * irr * (1.0 - Fc) + envC * Fc * mix(vec3(1.0), film * 2.0, 0.45);
  printCol += grating(V, N, T, Rd, 1600.0, 0.45) * 0.012;

  /* Foil: metal under a thin film, embossed with a grating of its own. */
  vec3 envF = envMap(R, 0.14);
  vec3 foilCol = ink.rgb * irr * 0.4 + envF * mix(film * 1.15, ink.rgb, 0.25) * 0.75;
  foilCol += grating(V, N, T, Rd, 1100.0, 0.35) * 0.2;

  /* Glitter in the foil: tiny facets, each a mirror turned its own way. */
  vec2 g = xy * 240.0;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  vec2 h2 = hash22(id);
  float h = hash12(id + 17.3);
  vec3 Np = normalize(N + 0.22 * ((h2.x - 0.5) * T + (h2.y - 0.5) * Rd));
  vec3 Rp = reflect(-V, Np);
  float sp = 0.0;
  for (int i = 0; i < 4; i++) sp += pow(max(dot(Rp, uLdir[i]), 0.0), 900.0) * uLcol[i].x;
  sp *= step(0.6, h) * (1.0 - smoothstep(0.12, 0.5, length(f)));
  vec3 glit = sp * mix(vec3(1.0), film * 1.6, 0.6) * foil;

  vec3 inkCol = mix(printCol, foilCol, foil) + glit;
  /* Where nothing is printed the plastic is clear: what is behind shows, and
     over it only the plastic's own reflection — added light, as glass adds
     it, so this is written premultiplied. */
  vec3 clearRef = envC * Fc;
  vec3 col = inkCol * ink.a + clearRef * (1.0 - ink.a);
  float a = clamp(ink.a + (1.0 - ink.a) * (0.05 + dot(clearRef, vec3(0.2))), 0.0, 1.0);
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor *= shape;
}
`;

/**
 * The disc's playing side: clear polycarbonate over a layer of aluminium
 * pressed with the spiral track.
 *
 * From the centre out: the clear hub, with its moulded stacking ring and the
 * small clamping ridge catching the light; a plain mirror band where the
 * metal starts; the data, a touch cooler and darker where it is written,
 * with faint rings across it; and a thin clear lip at the rim, the label's
 * ink showing through it from the other side.
 *
 * Two reflections, as a real disc has: a faint one off the plastic's surface,
 * and under it the metal's — smeared along the radius, across the tracks,
 * the way a disc's highlights stretch out from its centre. Into the metal's go
 * the track grating's orders, lit by the whole studio: for each wavelength
 * the grating equation is solved for where the light must come from, and the
 * studio is looked up there. `ORDERS` is how many of ±1, ±2 the format makes
 * (`optics.ts`).
 */
export const DISC_DATA = /* glsl */ `
${COMMON}
${LABEL}
uniform vec4 uZones;
uniform vec4 uZones2;
uniform float uPitch;
uniform vec3 uPolyT;

vec3 anisoEnv(vec3 V, vec3 N, vec3 Rd, float k) {
  vec3 acc = vec3(0.0);
  for (int i = -2; i <= 2; i++) {
    vec3 Np = normalize(N + Rd * (float(i) * k));
    acc += envMap(reflect(-V, Np), 0.02);
  }
  return acc * 0.2;
}

vec3 envGrating(vec3 V, vec3 N, vec3 T, vec3 Rd, float d) {
  float vr = dot(V, Rd);
  float vt = dot(V, T);
  vec3 acc = vec3(0.0);
  vec3 nrm = vec3(0.0);
  for (int i = 0; i < 6; i++) {
    float lam = 425.0 + 50.0 * float(i);
    vec3 s = spectral(lam);
    nrm += s;
    for (int k = 0; k < ORDERS; k++) {
      float m = (k < 2 ? 1.0 : 2.0) * (k == 0 || k == 2 ? 1.0 : -1.0);
      float lr = m * lam / d - vr;
      float ln2 = 1.0 - lr * lr - vt * vt;
      if (ln2 <= 0.0) continue;
      vec3 Ld = lr * Rd - vt * T + sqrt(ln2) * N;
      acc += s * envMap(Ld, 0.07) * (k < 2 ? 1.0 : 0.4);
    }
  }
  return acc / max(nrm, vec3(1e-3));
}

void main() {
  vec2 xy = vPos.xy;
  float r = length(xy);
  float fw = max(fwidth(r), 1e-4);
  float shape = smoothstep(uZones.x - fw, uZones.x + fw, r) * (1.0 - smoothstep(1.0 - fw, 1.0, r));
  if (shape < 0.004) discard;

  vec3 N = normalize(vWN);
  vec3 V = normalize(cameraPosition - vWPos);
  vec3 T = normalize(vWT);
  vec3 Rd = normalize(vWR);

  float metal = smoothstep(uZones.w - 0.002, uZones.w + 0.002, r)
              * (1.0 - smoothstep(uZones2.w - 0.002, uZones2.w + 0.002, r));
  float data = smoothstep(uZones2.x - 0.004, uZones2.x + 0.004, r)
             * (1.0 - smoothstep(uZones2.z - 0.003, uZones2.z + 0.003, r));
  float written = data * (1.0 - smoothstep(uZones2.y - 0.005, uZones2.y + 0.005, r));

  /* The stacking ring and the clamp ridge, moulded in the clear hub. */
  float g1 = (r - uZones.z) / 0.009;
  float g2 = (r - uZones.y) / 0.004;
  float slope = -2.0 * g1 / 0.009 * exp(-g1 * g1) * 0.010 - 2.0 * g2 / 0.004 * exp(-g2 * g2) * 0.003;
  vec3 Nh = normalize(N - Rd * slope * (1.0 - metal));
  float NoV = clamp(dot(Nh, V), 1e-3, 1.0);
  float F = 0.05 + 0.95 * pow(1.0 - NoV, 5.0);
  vec3 Rt = reflect(-V, Nh);
  vec3 topSpec = envMap(Rt, 0.01) * F;

  /* The metal, seen through the plastic twice. */
  vec3 metalCol = vec3(0.0);
  if (metal > 0.0) {
    float k = mix(0.004, 0.03, data);
    vec3 zero = anisoEnv(V, N, Rd, k);
    vec3 tint = mix(vec3(0.92, 0.925, 0.93), vec3(0.80, 0.81, 0.845), written);
    float rings = 1.0 - data * (0.06 * vnoise(vec2(r * 240.0, 0.5)) + 0.04 * vnoise(vec2(r * 31.0, 3.1)));
    float leadIn = exp(-pow((r - uZones2.x) / 0.003, 2.0));
    float eff = data * mix(0.18, 0.28, written);
    vec3 diff = data > 0.0 ? envGrating(V, N, T, Rd, uPitch) * eff : vec3(0.0);
    metalCol = (zero * tint * rings * (1.0 - eff) * (1.0 + 0.25 * leadIn) + diff)
             * (1.0 - F) * (1.0 - F) * uPolyT * uPolyT;
  }

  /* The clear rings: the label's ink from behind, else nothing but plastic. */
  float clearA = 1.0 - metal;
  float foil;
  vec4 ink = labelInk(xy, foil);
  float inkA = ink.a * 0.85;
  vec3 inkCol = ink.rgb * (0.75 + 0.25 * irradiance(N)) * uPolyT;
  vec3 clearCol = inkCol * inkA * (1.0 - F) + vec3(0.93, 0.94, 0.99) * 0.04 * (1.0 - inkA);

  vec3 col = metal * metalCol + clearA * clearCol + topSpec;
  float a = metal + clearA * clamp(inkA + 0.05 * (1.0 - inkA) + F * 0.6 + dot(topSpec, vec3(0.25)), 0.0, 1.0);
  /* Already weighted by coverage where it is clear: premultiplied as written. */
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor *= shape;
}
`;

/**
 * The disc's edge and the wall of its hole: polycarbonate seen end-on, which
 * pipes the label's colour round to its rim and carries a film's sheen.
 */
export const DISC_EDGE = /* glsl */ `
${COMMON}
${LABEL}
void main() {
  vec3 N = normalize(vWN);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vWPos);
  float NoV = clamp(dot(N, V), 0.0, 1.0);
  float F = 0.05 + 0.95 * pow(1.0 - NoV, 5.0);
  vec3 R = reflect(-V, N);
  float ang = atan(vPos.y, vPos.x);
  float foil;
  vec4 ink = labelInk(vec2(cos(ang), sin(ang)) * 0.97, foil);
  vec3 tint = mix(vec3(0.78, 0.8, 0.84), ink.rgb, ink.a * 0.8);
  vec3 film = thinFilm(max(NoV, 0.05), 380.0 + 170.0 * sin(ang * 2.0 + vPos.z * 60.0));
  vec3 col = tint * irradiance(N) * 0.8 * (1.0 - F)
           + envMap(R, 0.04) * mix(vec3(1.0), film * 1.8, 0.55) * max(F, 0.14);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
