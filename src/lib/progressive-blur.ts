/**
 * The pinned hero's blur, row by row — Convx's Apple Music artist page
 * (`cosmictaserdev-creator/Convx`, `ArtistHero.kt`: `artistFootBlurPt`,
 * `artistHeroBlurPt`, `HeroBlurShader`), at the owner's direction
 * (2026-10-31): "use convx's row by row blur, if you have to bring skia do it".
 *
 * ## What it is
 *
 * Not one blurred copy crossfading over the art, which is what the pinned
 * hero had: **a blur whose radius is a function of the row**, so the art is
 * sharp at the top and softens toward its foot at rest, and as the page
 * scrolls a second ramp climbs from the foot to the top until the whole
 * picture is soft.
 *
 *  - **The foot** (`footBlurPt`): nothing above 78% of the art's height, then
 *    a power curve — 207 × (f − 0.78)^1.855, capped at 48 — that leaves zero
 *    with no step for the eye to catch. Convx fitted it to iOS's artist page.
 *  - **The climb** (`heroBlurPt`): 28pt over a smoothstep whose two ends slide
 *    from below the art (1.1 → 1.3) to above it (−0.6 → −0.05) as `progress`
 *    goes 0 → 1. The radius at any row is the larger of the two.
 *  - **Radii are points of a 402pt-wide reference** (Convx's iPhone), scaled to
 *    the art's width, so the picture looks the same on any display.
 *
 *  - **The tail** (`TAIL`): the hero runs on past the art's foot by a fifth
 *    of its height, and what is there is the art reflected in its own foot —
 *    Apple's extension, so the picture has something to melt into instead of
 *    an edge. It is never seen sharp: the blur there is 16 to 48pt.
 *  - **The wash** (`heroWash`, `washStops`): the page's colour coming over the
 *    art from where the blur begins to just short of the tail's foot. It *is*
 *    the hero's foot fade, in place of each page's own — the owner's
 *    (2026-10-31): "Add convx's mirrored tail and color wash just like their
 *    artist page". About two fifths of the art is still there at its foot,
 *    which is what the tail carries on from.
 *
 * **Rows are counted in Convx's own unit, a *side*** — its square's width.
 * This app's art is landscape, so a side here is the art's height × 393/405,
 * which puts the art's foot where Convx's square has its. Every number in
 * `PROGRESSIVE_BLUR` is then Convx's, unconverted.
 *
 * **The wash is drawn as a gradient, not in the shader as Convx draws it** —
 * the one change of method. A playing trailer is under the shader's output,
 * and the shader blurs the still, so it cannot wash the video; and the sharp
 * art and the blur must dissolve by one curve (CLAUDE.md, "one foot fade, over
 * both copies"). `<PinnedHero>` draws `washStops()` once, over both.
 *
 * ## How it is drawn
 *
 * Two passes of one separable gaussian (`blurShader`), 81 taps each, as two
 * Skia runtime-shader image filters, over a canvas a quarter of the art's size
 * that is scaled back up (`DOWNSCALE`) — Convx's own arithmetic: at a quarter,
 * 48pt is about 32px of radius and 81 taps cover ±3σ. The output is
 * transparent where the radius is nothing and fades in over the first 7.5pt
 * (`fadeIn`), so it lies *over* the sharp art (and a trailer) the way the old
 * blurred copy did. The vertical pass adds ±½/255 of noise so the dark foot
 * does not band.
 *
 * Pure, nothing imported: `npm test` loads it, and CanvasKit can compile the
 * shader it writes.
 */

export const PROGRESSIVE_BLUR = {
  /**
   * Convx's geometry, in its own unit — the *side*, its square's width — so
   * every number below is the one in `ArtistHero.kt`: the artwork is 405/393
   * of a side tall (`ArtistArtworkExtent`), and the hero, artwork and
   * mirrored tail together, 495/393 (`ArtistHeroExtent`).
   *
   * This app's art is landscape, so a side is not its width: it is the art's
   * height × 393/405, which puts the art's foot exactly where Convx's square
   * puts its — and every row of the curve, the wash and the tail where
   * Convx's are, as shares of the art.
   */
  artworkExtent: 405 / 393,
  heroExtent: 495 / 393,
  /** Where the foot's blur begins, in sides. */
  knee: 0.78,
  /** The foot's curve: `scale × (f − knee)^power`, never more than `footMax`. */
  scale: 207,
  power: 1.855,
  footMax: 48,
  /** The climb's strength once it has covered the whole picture. */
  climb: 28,
  /** Where the climb's smoothstep starts and ends, at rest and once the page has scrolled. */
  climbFrom: [1.1, -0.6] as const,
  climbTo: [1.3, -0.05] as const,
  /** The width the radii are measured in: Convx's 402pt display. */
  reference: 402,
  /** The canvas is this many times smaller than the art, and scaled back up. */
  downscale: 4,
  /** Taps either side of the centre, per pass. */
  taps: 40,
  /**
   * Over how much radius, **in points**, the blurred copy fades in over the
   * sharp art. Convx's is 1.5px, about 2pt — which cut the art in a line here
   * (`scripts/progressive-blur-render.mjs`). It was 5 in the canvas's own
   * units until 2026-10-31, and those are dp on a phone and pixels in the
   * render: the phone faded in three times slower than the render that was
   * looked at. Points mean the same on both.
   *
   * At 7.5pt the copy is whole at 0.947 of a side, above the art's foot
   * (1.031), so the art's own bottom edge is always under solid blur.
   */
  fadeIn: 7.5,
  /**
   * The wash into the page's colour (`artistWash`): a smoothstep from 307/393
   * of a side — where the foot's blur begins, to the thousandth — to 1.21,
   * which is short of the hero's foot (1.26), so the last of the tail is the
   * page's colour already.
   */
  washFrom: 307 / 393,
  washTo: 1.21,
} as const;

/**
 * How much of the art's height its mirrored tail adds below it: 90/405,
 * about a fifth (`ArtistHeroExtent − ArtistArtworkExtent`, over the artwork).
 */
export const TAIL = PROGRESSIVE_BLUR.heroExtent / PROGRESSIVE_BLUR.artworkExtent - 1;

function smoothstep(from: number, to: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/** The foot's radius at a row `fraction` sides down (`artistFootBlurPt`), in reference points. */
export function footBlurPt(fraction: number): number {
  const { knee, scale, power, footMax } = PROGRESSIVE_BLUR;
  return fraction <= knee ? 0 : Math.min(footMax, scale * (fraction - knee) ** power);
}

/**
 * The radius at a row `fraction` sides down once the page has scrolled
 * `progress` (0–1) of the way: the foot or the climb (`artistHeroBlurPt`).
 */
export function heroBlurPt(fraction: number, progress: number): number {
  const { climb, climbFrom, climbTo } = PROGRESSIVE_BLUR;
  const p = Math.min(1, Math.max(0, progress));
  const from = climbFrom[0] + (climbFrom[1] - climbFrom[0]) * p;
  const to = climbTo[0] + (climbTo[1] - climbTo[0]) * p;
  return Math.max(footBlurPt(fraction), climb * smoothstep(from, to, fraction));
}

/**
 * How much of the page's colour is over a row `fraction` sides down
 * (`artistWash`): 0 above the knee, 1 a little before the tail's foot.
 */
export function heroWash(fraction: number): number {
  return smoothstep(PROGRESSIVE_BLUR.washFrom, PROGRESSIVE_BLUR.washTo, fraction);
}

/**
 * The wash as a gradient over the whole hero — the art and its tail — in the
 * shape `<PinnedHero>` draws its foot fade (`artistWashStops`, 32 steps):
 * each stop's alpha is how much of the page's colour is there.
 */
export function washStops(): { locations: number[]; alphas: number[] } {
  const steps = 32;
  const locations: number[] = [];
  const alphas: number[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const at = i / steps;
    locations.push(at);
    alphas.push(heroWash(at * PROGRESSIVE_BLUR.heroExtent));
  }
  return { locations, alphas };
}

/**
 * One pass of the blur, as SkSL. `axis` is the pass's direction; the vertical
 * one fades the copy in and dithers. Its uniforms: `size` (the canvas — the
 * art and its tail — in its own units), `side` (Convx's unit, in the same),
 * `pxPerPt` (`size.x / 402`) and `progress`.
 *
 * The tail is not reflected here, as Convx's shader does it: the canvas draws
 * the reflection into the layer it filters (`<ProgressiveBlur>`). Skia may
 * work a filter's output out only where its input has something drawn, so a
 * layer that held the art alone could come back with no tail at all.
 *
 * The same curve as `heroBlurPt`, written again in the shader's language —
 * `progressive-blur.test.ts` checks the two agree.
 */
export function blurShader(axis: 'horizontal' | 'vertical'): string {
  const b = PROGRESSIVE_BLUR;
  const f = (value: number) => (Number.isInteger(value) ? `${value}.0` : `${value}`);
  const vertical = axis === 'vertical';
  return `
uniform shader image;
uniform float2 size;
uniform float side;
uniform float pxPerPt;
uniform float progress;

float ease(float a, float b, float x) {
  float t = clamp((x - a) / (b - a), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

float ptAt(float y) {
  float fr = y / side;
  float k = max(fr - ${f(b.knee)}, 0.0);
  float foot = fr <= ${f(b.knee)} ? 0.0 : min(${f(b.footMax)}, ${f(b.scale)} * pow(k, ${f(b.power)}));
  float rs = mix(${f(b.climbFrom[0])}, ${f(b.climbFrom[1])}, progress);
  float re = mix(${f(b.climbTo[0])}, ${f(b.climbTo[1])}, progress);
  float climb = ${f(b.climb)} * ease(rs, re, fr);
  return max(foot, climb);
}

half4 main(float2 c) {
  float2 axis = ${vertical ? 'float2(0.0, 1.0)' : 'float2(1.0, 0.0)'};
  float pt = ptAt(c.y);
  float s = pt * pxPerPt;
  if (s < 0.05) {
    return ${vertical ? 'half4(0.0)' : 'image.eval(c)'};
  }
  float stepPx = max(1.0, s * 3.0 / ${f(b.taps)});
  float4 acc = float4(0.0);
  float wsum = 0.0;
  for (int i = -${b.taps}; i <= ${b.taps}; i++) {
    float d = float(i) * stepPx;
    float w = exp(-0.5 * d * d / (s * s));
    float2 q = clamp(c + axis * d, float2(0.5), size - 0.5);
    acc += float4(image.eval(q)) * w;
    wsum += w;
  }
  float4 col = acc / wsum;${
    vertical
      ? `
  float n = fract(sin(dot(c, float2(12.9898, 78.233))) * 43758.5453) - 0.5;
  col.rgb += n / 255.0;
  col *= ease(0.0, ${f(b.fadeIn)}, pt);`
      : ''
  }
  return half4(col);
}
`;
}

/**
 * Where an image of `image` size is drawn to cover a `box`, anchored at
 * (`anchorX`, `anchorY`) — 0.5, 0.5 is the centre — as expo-image's
 * `contentFit="cover"` with a `contentPosition` draws it, so the blur lies
 * exactly over the sharp art.
 */
export function coverRect(
  image: { width: number; height: number },
  box: { width: number; height: number },
  anchorX: number,
  anchorY: number
): { x: number; y: number; width: number; height: number } {
  if (image.width <= 0 || image.height <= 0) return { x: 0, y: 0, ...box };
  const scale = Math.max(box.width / image.width, box.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return {
    x: (box.width - width) * anchorX,
    y: (box.height - height) * anchorY,
    width,
    height,
  };
}

/**
 * The file the blur is made from: the drawn art, smaller where IGDB serves a
 * smaller copy of the same picture. The blur's canvas is a quarter of the art
 * (about 270px across on a 3× phone), so IGDB's 1080p is twice the 720p it
 * needs — and Skia downloads and decodes its own copy, apart from expo-image's.
 * `t_720p` is IGDB's *fit* size, the whole picture at its own shape.
 */
export function blurSourceUri(uri: string): string {
  return uri.replace(/\/t_(1080p|screenshot_huge)(_2x)?\//, '/t_720p/');
}
