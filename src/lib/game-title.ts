import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Whether a game's page shows the game's name — its logo or its name in type
 * at the head of the page, and the name in the top bar once the page is
 * scrolled. The owner (2026-11-03): "add a setting to have the game title
 * never displayed on game pages". Settings → Game title.
 *
 * Hidden, the cover speaks for itself; the name is still what a screen
 * reader hears, and every other screen (a review, a collection, Search)
 * still prints it.
 *
 * Kept on the device, per account, as Animated artwork is
 * (`lib/animated-artwork.ts`). Shown by default, so only "hidden" is stored.
 */

const PREFIX = 'gamelog:game-title';

function keyFor(userId: string) {
  return `${PREFIX}:${userId}`;
}

/** True unless this account hid the game's name on its page. */
export async function loadGameTitle(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(keyFor(userId))) !== 'hidden';
  } catch {
    return true;
  }
}

export async function saveGameTitle(userId: string, shown: boolean): Promise<void> {
  try {
    if (shown) await AsyncStorage.removeItem(keyFor(userId));
    else await AsyncStorage.setItem(keyFor(userId), 'hidden');
  } catch {
    /* Ignored — worst case the next game page shows its name once more. */
  }
}
