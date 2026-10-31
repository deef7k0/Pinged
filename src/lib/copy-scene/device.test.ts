import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isThirtyTwoBit, stage3dByDefault } from './device.ts';

describe('the 3D stage by default', () => {
  it('is on for a 64-bit phone, which also runs 32-bit code', () => {
    assert.equal(stage3dByDefault(['arm64-v8a', 'armeabi-v7a', 'armeabi']), true);
    assert.equal(stage3dByDefault(['x86_64', 'x86']), true);
  });

  it('is off for a 32-bit phone, Android Go on a 64-bit chip included', () => {
    assert.equal(isThirtyTwoBit(['armeabi-v7a', 'armeabi']), true);
    assert.equal(stage3dByDefault(['armeabi-v7a', 'armeabi']), false);
    assert.equal(stage3dByDefault(['x86']), false);
  });

  it('is on when the phone does not say: iOS, or a build without expo-device', () => {
    assert.equal(isThirtyTwoBit(null), null);
    assert.equal(stage3dByDefault(null), true);
    assert.equal(stage3dByDefault([]), true);
  });
});
