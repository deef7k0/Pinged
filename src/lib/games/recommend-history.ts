import AsyncStorage from '@react-native-async-storage/async-storage';

import { appendHistory } from './recommend-rules';

/**
 * Which games "Games for you" has already shown, on the device, oldest first.
 *
 * Kept per account, like the search history, and on the device rather than in
 * a table: it is a record of what the app put in front of somebody, which is
 * the app's business and nobody else's, and a second phone starting its own
 * rotation costs nothing. Any failure reads as "nothing shown yet" — the
 * band is then merely less fresh, never absent.
 */

const PREFIX = 'gamelog:recommend-history';

function keyFor(userId: string) {
  return `${PREFIX}:${userId}`;
}

export async function loadRecommendHistory(userId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/** Adds a round's games to the history. Reads the stored list, not a snapshot. */
export async function recordRecommended(userId: string, gameIds: readonly string[]) {
  if (gameIds.length === 0) return;
  try {
    const history = await loadRecommendHistory(userId);
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(appendHistory(history, gameIds)));
  } catch {
    /* Not remembered this time; the next round may repeat a game. */
  }
}
