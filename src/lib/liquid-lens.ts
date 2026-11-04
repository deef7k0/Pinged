/**
 * The tab bar's lens — rit3zh's expo-liquid-lens (`config/liquid-lens.wgsl.ts`,
 * `utils/write-lens-uniforms.ts`, `constants/liquid-pill-tab.ts`, MIT, read
 * from its source), at the owner's direction (2026-11-04: "Look at this for
 * the liquid glass/lens buttons in the app").
 *
 * The highlight that slides between the tabs is a lens: inside it the tabs'
 * glyphs and words are refracted — pulled in toward its middle near its rim,
 * as a drop of water bends what is under it — and turned the chosen ink
 * inside a band as wide as the lens; it is filled with a breath of white and
 * edged with a rim of light; and it stretches sideways and flattens with its
 * speed as it travels, and swells a little while pressed.
 *
 * **The same shader, in Skia's language.** expo-liquid-lens draws it with
 * WebGPU (`react-native-webgpu`), a native module this app does not have and
 * Expo Go cannot load; Skia — which the app already ships for the hero's
 * blur — runs it as an image filter over the glyphs and words, which is what
 * the WebGPU version samples from a texture of them. Every number below is
 * the reference's.
 *
 * Pure, nothing imported: `npm test` compiles the shader in CanvasKit.
 */

export const LENS = {
  /** How far the rim bends what is under it, and over how deep a band. */
  refraction: 8,
  depth: 11,
  /** The lens's own fill: white, at the reference's 6%. */
  fillOpacity: 0.06,
  /** At full speed (2,400dp/s) the lens is 30% wider… */
  stretchAt: 2400,
  stretchMax: 0.3,
  /** …and 55% of that flatter. */
  flatten: 0.55,
  /** Pressed: 6% taller, 4% wider, and bending 35% harder. */
  pressTall: 0.06,
  pressWide: 0.04,
  pressBend: 0.35,
} as const;

/** The lens's shape for a speed (dp/s) and a press (0–1): its half size, and how hard it bends. */
export function lensShape(
  halfWidth: number,
  halfHeight: number,
  speed: number,
  press: number
): { halfWidth: number; halfHeight: number; refraction: number } {
  'worklet';
  const stretch = Math.min(Math.abs(speed) / LENS.stretchAt, LENS.stretchMax);
  const h = halfHeight * (1 - stretch * LENS.flatten) * (1 + press * LENS.pressTall);
  const w = Math.max(halfWidth * (1 + stretch + press * LENS.pressWide), h);
  return {
    halfWidth: w,
    halfHeight: h,
    refraction: LENS.refraction * (1 + press * LENS.pressBend),
  };
}

/**
 * The lens, as SkSL — `liquidLensShader`'s fragment stage line for line, as
 * an image filter: `image` is the layer of glyphs and words it lies over.
 * Skia's colours are premultiplied, as the reference's blend state is.
 */
export function lensShader(): string {
  return `
uniform shader image;
uniform float2 center;
uniform float2 halfSize;
uniform float radius;
uniform float refraction;
uniform float depth;
uniform float tintWidth;
uniform float visibility;
uniform float3 activeColor;
uniform float3 pillColor;
uniform float pillOpacity;

float sdRoundedRect(float2 p, float2 hs, float r) {
  float rr = min(r, min(hs.x, hs.y));
  float2 q = abs(p) - hs + float2(rr);
  return length(max(q, float2(0.0))) + min(max(q.x, q.y), 0.0) - rr;
}

half4 main(float2 p) {
  float2 local = p - center;
  float dist = sdRoundedRect(local, halfSize, radius);
  float inside = 1.0 - smoothstep(-0.75, 0.75, dist);

  float2 e = float2(1.0, 0.0);
  float2 grad = float2(
    sdRoundedRect(local + e.xy, halfSize, radius) - sdRoundedRect(local - e.xy, halfSize, radius),
    sdRoundedRect(local + e.yx, halfSize, radius) - sdRoundedRect(local - e.yx, halfSize, radius)
  );
  float2 outward = grad / max(length(grad), 0.0001);

  float edge = 1.0 - smoothstep(0.0, depth, -dist);
  float bend = edge * edge * refraction;

  float2 samplePos = mix(p, p - outward * bend, inside * visibility);
  half4 label = image.eval(samplePos);
  float a = label.a;
  float3 rgb = a > 0.0 ? float3(label.rgb) / a : float3(0.0);

  float selected = (1.0 - smoothstep(tintWidth * 0.55, tintWidth * 1.15, abs(samplePos.x - center.x))) * visibility;
  float3 tinted = mix(rgb, activeColor, selected);

  float fillAlpha = inside * pillOpacity * visibility;
  float3 color = tinted * a + pillColor * fillAlpha * (1.0 - a);
  float outAlpha = a + fillAlpha * (1.0 - a);

  float rim = (1.0 - smoothstep(0.0, 1.6, abs(dist))) * 0.07 * visibility;
  color += pillColor * rim;
  outAlpha = min(outAlpha + rim, 1.0);

  return half4(half3(color), half(outAlpha));
}
`;
}
