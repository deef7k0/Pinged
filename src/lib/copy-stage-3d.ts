import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';

import { isThirtyTwoBit, stage3dByDefault } from '@/lib/copy-scene/device';

/**
 * Whether a physical copy's screen draws its case and disc in 3D — Settings →
 * Copies in 3D, the owner's (2026-10-30): "add a setting to disable the 3d
 * effect and on phones with 32 bit make it off by default, but keep them
 * able to turn it on".
 *
 * Off, the copy screen is the flat stage it always was, and nothing of the
 * 3D one is loaded. Kept on the device, per account, as Animated artwork is
 * (`lib/animated-artwork.ts`). Unlike that one the default is not always on
 * (`stage3dByDefault`), so the choice is stored either way: a 32-bit phone
 * that turned it on keeps it on.
 */

/**
 * Whether this build can draw the 3D stage at all: expo-gl for the canvas,
 * and view-shot for the pictures of the case's printed faces. Asked of the
 * native side without importing either — expo-gl requires its module as it
 * is imported, so a build made before it would close on that. Settings does
 * not offer the choice where it would do nothing.
 */
export const STAGE_3D_AVAILABLE =
  Platform.OS !== 'web' &&
  requireOptionalNativeModule('ExpoGL') != null &&
  (TurboModuleRegistry.get('RNViewShot') ?? NativeModules.RNViewShot) != null;

/** The ABIs this phone runs, from expo-device without importing it; null when unknown. */
const ABIS: string[] | null =
  (
    requireOptionalNativeModule('ExpoDevice') as {
      supportedCpuArchitectures?: string[] | null;
    } | null
  )?.supportedCpuArchitectures ?? null;

/** This phone's default, before anybody chooses. */
export const STAGE_3D_DEFAULT = stage3dByDefault(ABIS);

/** Whether this phone is known to be 32-bit, for Settings to say why the default is off. */
export const THIRTY_TWO_BIT = isThirtyTwoBit(ABIS) === true;

const PREFIX = 'gamelog:copy-stage-3d';

function keyFor(userId: string) {
  return `${PREFIX}:${userId}`;
}

/** This account's choice, or the phone's default when it has made none. */
export async function loadCopyStage3d(userId: string): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(keyFor(userId));
    if (stored === 'on') return true;
    if (stored === 'off') return false;
  } catch {
    /* The default, below. */
  }
  return STAGE_3D_DEFAULT;
}

export async function saveCopyStage3d(userId: string, on: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(userId), on ? 'on' : 'off');
  } catch {
    /* Ignored — worst case the next copy opens the other way once more. */
  }
}
