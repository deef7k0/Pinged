import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The device stores of the colour methods removed on 2026-10-28, when
 * Material 3 became the app's one way of colouring anything: each kept an
 * answer per picture, a row per game, and nothing reads them any more.
 */
const RETIRED_PREFIXES = ['page-color:', 'key-color:', 'artwork-dominant:'];

/** Set once the sweep has run, so a launch after the first reads one key and stops. */
const DONE_KEY = 'gamelog:colour-stores:swept:v1';

/**
 * Delete what those stores left on the device — dead weight in a database
 * that is 6 MB in all and shared with the saved query cache.
 *
 * Runs once per install. Quiet in every direction: storage that cannot be read
 * or written is left as it is, and the next launch tries again.
 */
export async function forgetRetiredColourStores(): Promise<void> {
  try {
    if ((await AsyncStorage.getItem(DONE_KEY)) === '1') return;

    const keys = await AsyncStorage.getAllKeys();
    const old = keys.filter((key) => RETIRED_PREFIXES.some((prefix) => key.startsWith(prefix)));
    if (old.length > 0) await AsyncStorage.multiRemove(old);

    await AsyncStorage.setItem(DONE_KEY, '1');
  } catch {
    /* Nothing depends on this having happened. */
  }
}
