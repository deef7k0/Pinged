import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { contrast, luminance } from '../lib/color.ts';

/**
 * The light room (Settings → Appearance), read out of `theme.ts` as text —
 * that file imports React Native. LIGHT is the dark palette with overrides,
 * so a token it does not name is the dark one's.
 */
const theme = readFileSync(new URL('./theme.ts', import.meta.url), 'utf8');

function block(start: string): Record<string, string> {
  const from = theme.indexOf(start);
  assert.ok(from >= 0, `${start} is in theme.ts`);
  const body = theme.slice(from, theme.indexOf('\n};', from));
  const out: Record<string, string> = {};
  for (const match of body.matchAll(/^\s+(\w+): '(#[0-9A-Fa-f]{6})',?$/gm)) {
    out[match[1]] = match[2];
  }
  return out;
}

const dark = block('const DARK = {');
const light = { ...dark, ...block('const LIGHT: ThemePalette = {') };

const STEPS = ['background', 'surface', 'surfaceElevated', 'surfaceSelected'] as const;

describe('the light palette', () => {
  it('has every hex token the dark one has', () => {
    for (const key of Object.keys(dark)) assert.ok(light[key], key);
  });

  it('is a light room: white page, darker steps above it', () => {
    assert.equal(light.background, '#FFFFFF');
    for (let i = 1; i < STEPS.length; i += 1) {
      assert.ok(
        luminance(light[STEPS[i]]) < luminance(light[STEPS[i - 1]]),
        `${STEPS[i]} is darker than ${STEPS[i - 1]}`
      );
    }
  });

  it('holds every ink at AA on every step', () => {
    for (const ink of ['text', 'textSecondary', 'textMuted', 'proseInk'] as const) {
      for (const step of STEPS) {
        const ratio = contrast(light[ink], light[step]);
        assert.ok(ratio >= 4.5, `${ink} on ${step}: ${ratio.toFixed(2)}`);
      }
    }
  });

  it('draws its meaning colours at 3:1 or more on the page', () => {
    const meanings = Object.keys(light).filter((key) =>
      /^(identity|score|status|rarity)/.test(key)
    );
    assert.ok(meanings.length > 20);
    for (const key of meanings) {
      const ratio = contrast(light[key], light.background);
      assert.ok(ratio >= 3, `${key}: ${ratio.toFixed(2)}`);
    }
  });

  it('keeps white white — it is type over artwork, in either room', () => {
    assert.equal(light.white, '#FFFFFF');
    assert.equal(light.shareInkLight, dark.shareInkLight);
  });
});
