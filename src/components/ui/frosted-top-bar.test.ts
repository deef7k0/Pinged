import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { TOP_BAR_DISC_ROOM, TOP_BAR_ROW } from '../../constants/top-bar';

/*
 * The bar's measurements are in `constants/top-bar.ts`, with their own tests.
 * What is held here is that the things built on them still say what they
 * measure: the bar, the hooks a screen reserves room with, and the list a
 * page scrolls. None of the three can be loaded here — each reaches React
 * Native — so their sources are read.
 */
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('the top bar', () => {
  const bar = read('./frosted-top-bar.tsx');
  const heights = read('../../hooks/use-header-height.ts');
  const scrollers = read('./page-scroll.tsx');

  it('has no size of its own — every number is the constants’', () => {
    /* A second `TOP_BAR_…` declared beside the first is how the disc and the
       room reserved for it came apart once. */
    assert.doesNotMatch(bar, /const TOP_BAR_[A-Z_]+ = \d/);
    assert.match(bar, /from '@\/constants\/top-bar'/);
  });

  it('reserves the bar’s row under a list, and the discs’ room under artwork', () => {
    assert.match(heights, /useTopBarInset\(modal\) \+ TOP_BAR_ROW/);
    assert.match(heights, /useTopBarInset\(modal\) \+ TOP_BAR_DISC_ROOM/);
    /* The discs are centred in the bar's row (2026-11-04), so the room a page
       keeps for them is the row less the gap left under a disc. */
    assert.equal(TOP_BAR_ROW - TOP_BAR_DISC_ROOM, 2);
  });

  it('is told how far the page has scrolled by the page’s own scroller', () => {
    /* The offset the bar reads and the one a page scroller writes are the
       same value, published by `<Screen>`. */
    assert.match(bar, /useScreenChrome\(\)\?\.scrollY/);
    assert.match(scrollers, /useScreenChrome\(\)\?\.scrollY/);
    assert.match(scrollers, /useScrollOffset\(scroller, offset\)/);
  });

  it('fades its light to white at nothing, never to a keyword', () => {
    /* Android interpolates a gradient unpremultiplied: `transparent` is black
       at zero, and a fade to it goes grey on the way. */
    const gradients = bar.match(/linear-gradient\([^']+\)/g) ?? [];
    assert.ok(gradients.length >= 2, 'the rim and the sheen');
    for (const gradient of gradients) assert.doesNotMatch(gradient, /transparent/);
  });

  it('stands on reacticx’s header fade, never a blur — every bar, the glass one too', () => {
    /* The owner had the bar's blur removed (2026-10-14), kept Apple's glass
       on three pages (2026-10-23), then asked for reacticx's header fade
       "across the app" (2026-11-02). The two `<BlurView>`s left are buttons:
       the back disc of glass over artwork, and the capsule the right-hand
       controls share (`GlassGroup`, 2026-11-03). */
    assert.equal((bar.match(/^\s*<BlurView\b/gm) ?? []).length, 2);
    assert.doesNotMatch(bar, /AnimatedBlurView|function GlassFrost/);
    assert.doesNotMatch(
      bar.slice(bar.indexOf('function Frost('), bar.indexOf("/** The bar's row")),
      /BlurView/,
      'the ground is a fade and nothing else'
    );
    assert.match(bar, /<LinearGradient colors=\{colours\}/);

    /* The three Apple Music pages keep the glass bar's behaviour — discs that
       stay, a centred name — on the same fade. */
    const app = (path: string) => read(`../../app/${path}`);
    const glassy = ['game/[id].tsx', 'studio/[id].tsx', 'list/[id].tsx'];
    for (const page of glassy) {
      const source = app(page);
      const bars = source.match(/<FrostedTopBar\b[^>]*?(?:\/>|>)/gs) ?? [];
      assert.ok(bars.length > 0, page);
      for (const tag of bars) {
        /* "Studio not found" is a list page's bar, not an artwork one. */
        if (/insetHeader|title="Studio"/.test(tag)) continue;
        assert.match(tag, /\bglass\b/, `${page}: ${tag}`);
      }
    }
  });

  it('keeps Home’s bar where it is: nothing folds it with the scroll', () => {
    /* "Make the home top bar stay at the top, it should not move with the
       scroll" (2026-10-14). */
    assert.doesNotMatch(bar, /homeBarOpen|homeBarMoved/);
  });

  it('gives no worklet a default that names a constant', () => {
    /* A parameter default is evaluated before a worklet's closure is unpacked
       (CLAUDE.md § Gotchas); under Node it would pass and on a phone throw. */
    const maths = read('../../constants/top-bar.ts');
    const worklets = maths.match(/export function \w+\([^)]*\)[^{]*\{\s*'worklet'/g) ?? [];
    assert.ok(worklets.length >= 5, 'the worklets are still marked');
    for (const worklet of worklets) assert.doesNotMatch(worklet, /=/, worklet);
  });
});
