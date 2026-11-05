import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Recent searches, on the device.
 *
 * Local and not synced, deliberately. A search history is a record of what
 * somebody was curious about — including the things they looked up and did not
 * log — and there is no table in this schema that should hold that. It is also
 * genuinely per-device: the phone you search on is the phone you search on
 * again.
 *
 * Keyed by user id so two accounts sharing a handset never see each other's
 * searches, the same rule `log-draft.ts` follows.
 */

const PREFIX = 'gamelog:search-history';

/** How many entries survive. Beyond this it stops being "recent". */
const MAX_ENTRIES = 8;

/**
 * What the Search field was looking through when a term was typed.
 *
 * Six kinds, and each is a tab under the field. Events was a seventh until it
 * moved to the News tab (2026-10-14); a stored entry for it is dropped on read. `platforms` is
 * here because it is a scope of the field, but it is never *recorded*: its
 * search is a filter over a list already in memory, and "play" on the way to
 * "PlayStation 5" is not a search anyone made.
 */
export const SEARCH_SCOPES = [
  'top',
  'games',
  'reviews',
  'people',
  'collections',
  'studios',
  'platforms',
] as const;

export type SearchScope = (typeof SEARCH_SCOPES)[number];

export type SearchHistoryEntry = {
  term: string;
  /**
   * Restored along with the term.
   *
   * Without it, tapping "hollow knight" while the People scope happens to be
   * selected runs a people search for a game — the term is only half of what the
   * reader did.
   */
  scope: SearchScope;
  /** Epoch ms, for ordering and for pruning. */
  at: number;
};

function keyFor(userId: string) {
  return `${PREFIX}:${userId}`;
}

/** Read the list, newest first. Any failure reads as "no history". */
export async function loadSearchHistory(userId: string): Promise<SearchHistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SearchHistoryEntry[];
    return Array.isArray(parsed)
      ? parsed.filter(
          (entry) =>
            typeof entry?.term === 'string' &&
            /* A scope this build does not have would restore to nothing. */
            (SEARCH_SCOPES as readonly string[]).includes(entry.scope)
        )
      : [];
  } catch {
    return [];
  }
}

/**
 * Record a search.
 *
 * ## Why prefixes are collapsed rather than de-duplicated exactly
 *
 * The screen searches as you type, so one deliberate search for "elden ring"
 * passes through "el", "eld", "elde"… and every pause long enough to fire a
 * request would otherwise leave its own row. Exact de-duplication does not help:
 * those are all different strings.
 *
 * So adding a term drops any stored entry the new term *starts with*, in the
 * same scope. "elden ring" swallows "elden" and "eld", and the history ends up
 * holding the searches somebody meant rather than the keystrokes on the way to
 * them. Typing a genuinely shorter term later still keeps both, because the
 * longer one is not a prefix of it.
 */
export async function addSearchHistory(
  userId: string,
  term: string,
  scope: SearchScope
): Promise<void> {
  const trimmed = term.trim();
  if (!trimmed) return;

  try {
    const existing = await loadSearchHistory(userId);
    const lowered = trimmed.toLowerCase();

    const kept = existing.filter(
      (entry) => entry.scope !== scope || !lowered.startsWith(entry.term.toLowerCase())
    );

    const next = [{ term: trimmed, scope, at: Date.now() }, ...kept].slice(0, MAX_ENTRIES);
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(next));
  } catch {
    /* A history is a convenience. Losing one must never fail a search. */
  }
}

/** Forget one entry — the row-level "remove this". */
export async function removeSearchHistory(userId: string, term: string): Promise<void> {
  try {
    const existing = await loadSearchHistory(userId);
    const next = existing.filter((entry) => entry.term !== term);
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(next));
  } catch {
    /* Ignored — worst case the row is offered once more. */
  }
}

/** Forget everything. */
export async function clearSearchHistory(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(userId));
  } catch {
    /* Ignored, as above. */
  }
}
