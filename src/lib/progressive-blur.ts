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
 * transparent above the knee and fades in over the `fadeSpan` under it
 * (the climb, over its first 7.5pt — `fadeIn`), so it lies *over* the sharp
 * art (and a trailer) the way the old blurred copy did. The vertical pass adds ±½/255 of noise so the dark foot
 * does not band.
 *
 * Pure, nothing imported: `npm test` loads it, and CanvasKit can compile the
 * shader it writes.
 */

export const PROGRESSIVE_BLUR = {
  /**
   * Convx's geometry, in its own unit — the *side*, its square's width — so
   * every number below is the one in `ArtistHero.kt`: the artwork is 405/393
   * of a side tall (`ArtistArtworkExtent`).
   *
   * A side is not the art's width: it is the art's height × 393/405, which
   * puts the art's foot exactly where Convx's square puts its — and every row
   * of the curve, the wash and the tail where Convx's are, as shares of the
   * art.
   */
  artworkExtent: 405 / 393,
  /**
   * The hero, art and tail together: Convx's 495/393, lengthened to 585/393
   * at the owner's word (2026-11-03: "make the blur longer, stretch it a
   * little bit more downwards") — the game page's title stands where the
   * blur begins, so its words sit lower and the blur has to reach under them.
   * The tail is twice Convx's: 180/405 of the art.
   */
  heroExtent: 585 / 393,
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
   * Over how far, **in sides from the knee**, the foot's blurred copy fades
   * in over the sharp art — on a smootherstep, which leaves both ends with no
   * slope. The owner (2026-11-03): "have it so that the top fades almost like
   * a gradient with the blur… don't make it larger or smaller". Until then it
   * faded by its *radius* (`fadeIn`), whole at 7.5pt — about a sixth of a side
   * from the knee, most of it in the middle twelfth, about 30dp on a phone:
   * read as an edge. The knee and the foot did not move; `fadeIn` still fades
   * the climb in as the page scrolls.
   *
   * Whole at 0.78 + 0.22 = 1.0 of a side on a studio's and a collection's
   * hero — above the art's foot (1.031), so its bottom edge is never sharp —
   * and by 0.78, the title, on the game page's long one.
   */
  fadeSpan: 0.22,
  /**
   * The wash into the page's colour (`artistWash`): a smoothstep from 307/393
   * of a side — where the foot's blur begins, to the thousandth — to 1.21,
   * which is short of the hero's foot (1.26), so the last of the tail is the
   * page's colour already.
   */
  washFrom: 307 / 393,
  /** Whole page colour here — Convx's 1.21, moved down with the tail. */
  washTo: 1.42,
  /**
   * The long hero's knee and wash — the game page's and a studio's, the ones
   * that draw the tail. The owner (2026-11-03): "The title of the game sits
   * on the cover and it blends with it… make it so the blur goes up to where
   * the game title is." The title stays where Convx's knee is (`blurStart`);
   * the blur starts higher, so by the title it is about 12pt, and the wash
   * a little under that, so the page's colour is already rising behind it.
   * It started at 0.5 / 0.56 (20pt by the title); the owner had it brought
   * down a little the same day: "make it not go too much further up".
   */
  longKnee: 0.56,
  longWashFrom: 0.6,
} as const;

/**
 * Where the blur's knee goes when the cover is brought to the front, in
 * sides: just above the art's foot (405/393), so a sliver of softness is
 * left on its edge for the page under it to meet (the owner's, 2026-11-03:
 * "the blur should smoothly move… downwards into the edge of the cover").
 */
export const COVER_FRONT_KNEE = 0.97;

/** How far, in sides, a blur whose knee is `knee` drops for the cover in front. */
export function coverFrontDrop(knee: number): number {
  return kneeDrop(knee, COVER_FRONT_KNEE);
}

/**
 * Where the game page's blur begins when Settings → Game title is off, in
 * sides: a little above the cover's foot (405/393), so the logo printed on
 * the box art is seen, but not the whole cover clear as `COVER_FRONT_KNEE`
 * leaves it (the owner's, 2026-11-04: "the blur in the game pages start at
 * the edge of the cover, but slightly just slightly up, so that the logo in
 * the cover can be seen, but not quite like the one with the full clear
 * view").
 */
export const TITLELESS_KNEE = 0.88;

/**
 * Which row of the undropped curve a row `fraction` sides down reads, once
 * the blur's start has dropped `drop` sides: the curve from `knee` to the
 * art's foot squeezed in between `knee + drop` and the foot, and unchanged
 * from the foot down. The shader's `fr`.
 *
 * **The foot is never weakened.** For one build (2026-11-04) the drop slid
 * the whole curve down, so with the title off the blur at the cover's foot
 * was a few points and barely faded in: the cover's bottom edge showed, and
 * its mirrored tail read as a sharp reflection — "a 3d look", the owner
 * said, "not a fade". Squeezed, the foot and the tail are as before.
 */
export function droppedRow(
  fraction: number,
  knee: number = PROGRESSIVE_BLUR.knee,
  drop = 0
): number {
  const foot = PROGRESSIVE_BLUR.artworkExtent;
  if (fraction >= foot) return fraction;
  const start = knee + drop;
  return knee + ((fraction - start) * (foot - knee)) / Math.max(foot - start, 0.001);
}

/** How far, in sides, a blur whose knee is `from` drops to stand at `to`. */
export function kneeDrop(from: number, to: number): number {
  return Math.max(0, to - from);
}

/**
 * Where the blur begins on art `height` tall, in dp from its top: Convx's
 * knee, in its own unit (a side, the art's height × 393/405). The game page
 * stands its Log pill here, so the blur starts at the pill (the owner's,
 * 2026-11-03).
 */
export function blurStart(height: number, knee: number = PROGRESSIVE_BLUR.knee): number {
  return (height * knee) / PROGRESSIVE_BLUR.artworkExtent;
}

/**
 * How much of the art's height its mirrored tail adds below it: 90/405,
 * about a fifth (`ArtistHeroExtent − ArtistArtworkExtent`, over the artwork).
 */
export const TAIL = PROGRESSIVE_BLUR.heroExtent / PROGRESSIVE_BLUR.artworkExtent - 1;

function smoothstep(from: number, to: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/**
 * How opaque the foot's blurred copy is at a row `fraction` sides down: a
 * smootherstep over `fadeSpan` from the knee. The shader's `smoother`.
 */
export function footFade(fraction: number, knee: number = PROGRESSIVE_BLUR.knee): number {
  const t = Math.min(1, Math.max(0, (fraction - knee) / PROGRESSIVE_BLUR.fadeSpan));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** The foot's radius at a row `fraction` sides down (`artistFootBlurPt`), in reference points. */
export function footBlurPt(fraction: number, knee: number = PROGRESSIVE_BLUR.knee): number {
  const { scale, power, footMax } = PROGRESSIVE_BLUR;
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
export function heroWash(
  fraction: number,
  from: number = PROGRESSIVE_BLUR.washFrom,
  to: number = PROGRESSIVE_BLUR.washTo
): number {
  return smoothstep(from, to, fraction);
}

/**
 * The wash as a gradient over the whole hero — the art and its tail — in the
 * shape `<PinnedHero>` draws its foot fade (`artistWashStops`, 32 steps):
 * each stop's alpha is how much of the page's colour is there.
 */
export function washStops(
  from: number = PROGRESSIVE_BLUR.washFrom,
  extend = 0
): {
  locations: number[];
  alphas: number[];
} {
  const steps = 32;
  const extent = PROGRESSIVE_BLUR.heroExtent + extend;
  const to = PROGRESSIVE_BLUR.washTo + extend;
  const locations: number[] = [];
  const alphas: number[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const at = i / steps;
    locations.push(at);
    alphas.push(heroWash(at * extent, from, to));
  }
  return { locations, alphas };
}

/**
 * How many sides further the hero's tail and its wash must run for words
 * whose foot is `wordsFoot` dp down art `artHeight` tall to stand wholly on
 * the blur — the game page with its title off (the owner's, 2026-11-04: "the
 * header info and buttons sit half on the blur and half on the game page").
 * Nothing while they end above where the wash is whole.
 */
export function heroExtension(artHeight: number, wordsFoot: number): number {
  if (!(artHeight > 0)) return 0;
  const side = artHeight / PROGRESSIVE_BLUR.artworkExtent;
  return Math.max(0, wordsFoot / side - PROGRESSIVE_BLUR.washTo);
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
 *
 * `drop` moves the whole curve down by that many sides: the game page's
 * cover in front (2026-11-03) eases its blur down to the cover's edge
 * (`coverFrontDrop`), so the cover is seen.
 */
export function blurShader(
  axis: 'horizontal' | 'vertical',
  knee: number = PROGRESSIVE_BLUR.knee
): string {
  const b = { ...PROGRESSIVE_BLUR, knee };
  const f = (value: number) => (Number.isInteger(value) ? `${value}.0` : `${value}`);
  const vertical = axis === 'vertical';
  return `
uniform shader image;
uniform float2 size;
uniform float side;
uniform float pxPerPt;
uniform float progress;
uniform float drop;
uniform float slide;

float ease(float a, float b, float x) {
  float t = clamp((x - a) / (b - a), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

float smoother(float a, float b, float x) {
  float t = clamp((x - a) / (b - a), 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

float footPt(float fr) {
  float k = max(fr - ${f(b.knee)}, 0.0);
  return fr <= ${f(b.knee)} ? 0.0 : min(${f(b.footMax)}, ${f(b.scale)} * pow(k, ${f(b.power)}));
}

float climbPt(float fr) {
  float rs = mix(${f(b.climbFrom[0])}, ${f(b.climbFrom[1])}, progress);
  float re = mix(${f(b.climbTo[0])}, ${f(b.climbTo[1])}, progress);
  return ${f(b.climb)} * ease(rs, re, fr);
}

half4 main(float2 c) {
  float2 axis = ${vertical ? 'float2(0.0, 1.0)' : 'float2(1.0, 0.0)'};
  /* The drop starts the foot lower, never the climb, and squeezes the foot's
     curve into what is left of the art — so at the art's own foot, and all
     the way down its tail, the blur is as heavy as ever (\`droppedRow\`). */
  float row = c.y / side - slide;
  float kneeAt = ${f(b.knee)} + drop;
  float fr = row >= ${f(b.artworkExtent)}
    ? row
    : ${f(b.knee)} + (row - kneeAt) * (${f(b.artworkExtent - b.knee)}) / max(${f(b.artworkExtent)} - kneeAt, 0.001);
  float climb = climbPt(c.y / side);
  float pt = max(footPt(fr), climb);
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
  float fade = max(
    smoother(${f(b.knee)}, ${f(b.knee + b.fadeSpan)}, fr),
    ease(0.0, ${f(b.fadeIn)}, climb)
  );
  col *= fade;`
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
  'worklet';
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
