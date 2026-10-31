import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { opensToDisc } from '../../constants/copy-stage.ts';
import { PLATFORM_MEDIUM } from '../../constants/platform-media.ts';
import {
  POLYCARBONATE_IOR,
  ROCK,
  STUDIO,
  TRACK_PITCH_NM,
  diffractedSine,
  discDiameterMm,
  discFormatFor,
  discPlasticTransmittance,
  discZones,
  easeRock,
  idleRock,
  normalReflectance,
  showsRainbowHeadOn,
  spectralRGB,
  stageLens,
  stageRenderScale,
  studioDirection,
  studioIrradiance,
} from './optics.ts';
import { CASE_FACE, DISC_DATA, DISC_LABEL } from './shaders.ts';

describe('the disc', () => {
  it('has the track pitch its format was pressed at', () => {
    assert.equal(TRACK_PITCH_NM.cd, 1600);
    assert.equal(TRACK_PITCH_NM.dvd, 740);
    assert.equal(TRACK_PITCH_NM.bd, 320);
  });

  it('is a rainbow as a CD or DVD and a plain mirror as a Blu-ray, head on', () => {
    assert.equal(showsRainbowHeadOn('cd'), true);
    assert.equal(showsRainbowHeadOn('dvd'), true);
    assert.equal(showsRainbowHeadOn('bd'), false);
    /* A CD sends 550nm off at about 20° under light falling straight on it. */
    const sine = diffractedSine(0, 550, TRACK_PITCH_NM.cd, 1);
    assert.ok(Math.abs(Math.asin(sine) * (180 / Math.PI) - 20.1) < 0.2);
  });

  it('is pressed on the format each console read', () => {
    for (const key of ['ps5', 'ps4', 'ps3', 'xbox', 'wiiu'] as const) {
      assert.equal(discFormatFor(key), 'bd', key);
    }
    for (const key of ['ps1', 'saturn', 'segacd', 'dreamcast', 'pcfx', 'threedo'] as const) {
      assert.equal(discFormatFor(key), 'cd', key);
    }
    for (const key of ['ps2', 'xbox360', 'xboxOriginal', 'wii', 'gamecube', 'psp'] as const) {
      assert.equal(discFormatFor(key), 'dvd', key);
    }
  });

  it('gives every copy whose disc comes out a format', () => {
    const discs = Object.keys(PLATFORM_MEDIUM).filter((key) =>
      opensToDisc(key as keyof typeof PLATFORM_MEDIUM, true)
    );
    assert.ok(discs.length > 10);
    for (const key of discs) {
      assert.ok(['cd', 'dvd', 'bd'].includes(discFormatFor(key as 'ps5')), key);
    }
  });

  it('keeps its rings in order, from the hole to the rim, on both sizes', () => {
    for (const mm of [120, 80]) {
      const z = discZones(mm);
      const order = [
        z.hole,
        z.ridge,
        z.stack,
        z.mirror,
        z.data,
        z.written,
        z.dataEnd,
        z.metalEnd,
        1,
      ];
      for (let i = 1; i < order.length; i += 1)
        assert.ok(order[i] > order[i - 1], `${mm}mm ring ${i}`);
    }
    const cd = discZones(120);
    assert.equal(cd.hole, 0.125);
    assert.ok(Math.abs(cd.mirror - 0.304) < 0.001);
    assert.equal(discDiameterMm('gamecube'), 80);
    assert.equal(discDiameterMm('ps5'), 120);
  });

  it('is black under its plastic as a PlayStation game, and clear otherwise', () => {
    assert.ok(discPlasticTransmittance('ps1').every((t) => t < 0.2));
    assert.deepEqual([...discPlasticTransmittance('ps2')], [1, 1, 1]);
  });

  it('reflects off its plastic as the shaders say polycarbonate does', () => {
    const f0 = normalReflectance(POLYCARBONATE_IOR);
    assert.ok(Math.abs(f0 - 0.05) < 0.002);
    assert.ok(DISC_DATA.includes('float F = 0.05 + 0.95 * pow(1.0 - NoV, 5.0);'));
    /* The case's plastic and the label's varnish: index ~1.5. */
    assert.ok(Math.abs(normalReflectance(1.5) - 0.04) < 0.001);
    assert.ok(CASE_FACE.includes('float F = 0.04 + 0.96 * pow(1.0 - NoV, 5.0);'));
    assert.ok(DISC_LABEL.includes('float Fc = 0.04 + 0.96 * pow(1.0 - NoV, 5.0);'));
  });
});

describe('light', () => {
  it('runs violet to red across the spectrum, and is dark outside it', () => {
    assert.deepEqual(spectralRGB(380), [0, 0, 0]);
    assert.deepEqual(spectralRGB(720), [0, 0, 0]);
    const dominant = (nm: number) => {
      const c = spectralRGB(nm);
      return c.indexOf(Math.max(...c));
    };
    assert.equal(dominant(450), 2);
    assert.equal(dominant(540), 1);
    assert.equal(dominant(640), 0);
  });

  it('lights a printed face square on to the reader at its own colours', () => {
    assert.ok(Math.abs(studioIrradiance([0, 0, 1]) - 1) < 1e-9);
  });

  it('lights a face less the further it turns from the reader', () => {
    const square = studioIrradiance([0, 0, 1]);
    const side = studioIrradiance([Math.sin(Math.PI / 3), 0, Math.cos(Math.PI / 3)]);
    const edge = studioIrradiance([1, 0, 0]);
    const away = studioIrradiance([0, 0, -1]);
    assert.ok(side < square && edge < side && away < edge);
    /* The lamp is up and to the left: the left is the lit side. */
    assert.ok(studioIrradiance([-1, 0, 0]) > studioIrradiance([1, 0, 0]));
  });

  it('turns its lights with the phone, and leaves them where they hang when it is level', () => {
    for (const light of STUDIO) {
      const [x, y, z] = studioDirection(light.dir, 0, 0);
      const l = Math.hypot(...light.dir);
      assert.ok(Math.abs(x - light.dir[0] / l) < 1e-12);
      assert.ok(Math.abs(y - light.dir[1] / l) < 1e-12);
      assert.ok(Math.abs(z - light.dir[2] / l) < 1e-12);
    }
    const right = studioDirection([0, 0, 1], 1, 0);
    assert.ok(right[0] > 0.2);
  });

  it('hangs its front key just over the camera, where a face square on catches it', () => {
    const [x, y, z] = studioDirection(STUDIO[0].dir, 0, 0);
    const off = Math.acos(z) * (180 / Math.PI);
    assert.ok(off > 8 && off < 20, `${off}°`);
    assert.ok(y > 0 && x < 0);
  });
});

describe('the rock', () => {
  it('stays inside its amplitude, and is nothing when it is not wanted', () => {
    for (let t = 0; t < 60; t += 0.37) {
      const { pitch, roll } = idleRock(t, 1);
      assert.ok(Math.abs(pitch) <= ROCK.pitch + 1e-9);
      assert.ok(Math.abs(roll) <= ROCK.roll + 1e-9);
      assert.deepEqual(idleRock(t, 0), { pitch: 0, roll: 0 });
    }
  });

  it('never moves more than a tenth of a degree in a frame', () => {
    let last = idleRock(0, 1);
    for (let t = 1 / 60; t < 30; t += 1 / 60) {
      const now = idleRock(t, 1);
      assert.ok(Math.abs(now.pitch - last.pitch) < 0.1);
      assert.ok(Math.abs(now.roll - last.roll) < 0.1);
      last = now;
    }
  });

  it('comes in gradually, and gets there', () => {
    let amount = 0;
    amount = easeRock(amount, 1, 1 / 60);
    assert.ok(amount > 0 && amount < 0.05);
    for (let i = 0; i < 600; i += 1) amount = easeRock(amount, 1, 1 / 60);
    assert.ok(amount > 0.999);
  });
});

describe('the lens', () => {
  it('is a window on a centred view, its axis on the object', () => {
    const lens = stageLens(360, 520, 180, 250, 900);
    assert.equal(lens.fullWidth, 360);
    assert.equal(lens.fullHeight, 540);
    assert.equal(lens.offsetX, 0);
    assert.equal(lens.offsetY, 20);
    /* One dp at the object's depth is one dp on the screen. */
    const tan = Math.tan((lens.fov * Math.PI) / 360);
    assert.ok(Math.abs(lens.fullHeight / 2 / tan - 900) < 1e-9);
  });

  it('draws at two pixels a dp at most', () => {
    assert.equal(stageRenderScale(3), 2);
    assert.equal(stageRenderScale(2.75), 2);
    assert.equal(stageRenderScale(1.5), 1.5);
  });
});
