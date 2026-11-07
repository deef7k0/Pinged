/**
 * The colours of BitChord's two station covers (`TopPicksShelf.kt`), which
 * Home's Surprise Me and Top 1000 cards are drawn in (`components/home/
 * pick-art`, `pick-cards`). Artwork, not chrome: like a store's brand hex
 * (`constants/stores`), they are the picture's own and are not themed.
 */

/** Outermost to innermost: where each arrow's tip rests, and its fold's two tones. */
export const PERSONAL_LAYERS = [
  { rest: 1.0, deep: '#FE5E83', light: '#FA6196' },
  { rest: 0.66, deep: '#FE5065', light: '#FC657C' },
  { rest: 0.43, deep: '#FB594C', light: '#FC776D' },
  { rest: 0.21, deep: '#FB6729', light: '#F98A48' },
] as const;
export const PERSONAL_GROUND = ['#F7334F', '#FA6094', '#F02A4A', '#EE213D'] as const;

export const DISCOVERY_TOP = [
  '#3A2496',
  '#2F4FB0',
  '#3B30A0',
  '#2E7FB8',
  '#27988A',
  '#3C8DA8',
] as const;
export const DISCOVERY_BOTTOM = [
  '#3A2496',
  '#333EA4',
  '#2F62B6',
  '#288B99',
  '#3477BA',
  '#42A296',
] as const;
export const DISCOVERY_GROUND = ['#2A869F', '#3477BA'] as const;
export const DISCOVERY_ARROW = ['#502798', '#421C88', '#4A2292'] as const;
export const DISCOVERY_INNER = 'rgba(60,25,129,0.35)';

/** Each station's still, for a build without Skia: its own colours. */
export const PICK_STILL = {
  personal: ['#F7334F', '#FA6094', '#F02A4A'],
  discovery: ['#2A869F', '#3477BA', '#421C88'],
} as const;

/** BitChord's eyebrows: a pale tone of each card's own colour. */
export const PICK_EYEBROW = { personal: '#FFD2DA', discovery: '#CDBDFF' } as const;
