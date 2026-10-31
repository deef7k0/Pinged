/**
 * Whether this phone draws the copy stage in 3D unless told otherwise.
 *
 * The owner's (2026-10-30): "on phones with 32 bit make it off by default,
 * but keep them able to turn it on". A 32-bit phone is an old or a very cheap
 * one, and the stage's GPU shading — the disc's grating above all — is the
 * heaviest drawing in the app.
 *
 * Read from Android's list of the ABIs the device runs (`Build.SUPPORTED_ABIS`,
 * through expo-device): 32-bit is a list with no 64-bit ABI in it. That is
 * the system's answer, not the chip's — a 64-bit chip under a 32-bit-only
 * Android (Android Go on cheap phones) is 32-bit here, which is the point.
 * An unknown list — iOS, which has been 64-bit only since iOS 11, or a build
 * without expo-device — is not a reason to switch anything off.
 *
 * Pure, and under `npm test`.
 */

const SIXTY_FOUR_BIT = new Set(['arm64-v8a', 'x86_64', 'riscv64']);

/** Whether a list of supported ABIs is a 32-bit device's; null when it is not known. */
export function isThirtyTwoBit(abis: readonly string[] | null | undefined): boolean | null {
  if (!abis || abis.length === 0) return null;
  return !abis.some((abi) => SIXTY_FOUR_BIT.has(abi));
}

/** The 3D stage's default: on, except on a phone known to be 32-bit. */
export function stage3dByDefault(abis: readonly string[] | null | undefined): boolean {
  return isThirtyTwoBit(abis) !== true;
}
