import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Light or dark — Settings → Appearance (the owner's, 2026-11-06: "make a
 * Light mode for the app instead of black, with the setting to turn it on/off
 * for dark or light").
 *
 * **Per device, not per account**: the welcome screen is drawn before anybody
 * has signed in, and the splash is held until this one read is in
 * (`loadColorScheme`, the root layout), so the first frame is already in the
 * chosen room. Dark is the default; nothing changes for anyone who never
 * opens the setting.
 *
 * A module store rather than a query: every one of the ~200 components that
 * call `useTheme()` reads it, and a store read is a variable read.
 */
export type ColorScheme = 'dark' | 'light';

const KEY = 'app-color-scheme:v1';

let current: ColorScheme = 'dark';
let started = false;
let loaded = false;
const listeners = new Set<() => void>();

export function getColorScheme(): ColorScheme {
  return current;
}

export function subscribeColorScheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setColorScheme(next: ColorScheme): void {
  if (next === current) return;
  current = next;
  listeners.forEach((listener) => listener());
  AsyncStorage.setItem(KEY, next).catch(() => {
    /* A full disk keeps the choice for this session. */
  });
}

/** Whether the stored choice has been read — the splash waits for it. */
export function isColorSchemeLoaded(): boolean {
  return loaded;
}

/** Read the stored choice once, at launch. Never throws; dark on any failure. */
export async function loadColorScheme(): Promise<void> {
  if (started) return;
  started = true;
  try {
    const stored = await AsyncStorage.getItem(KEY);
    if (stored === 'light' || stored === 'dark') current = stored;
  } catch {
    /* An unreadable store is the default room. */
  }
  loaded = true;
  listeners.forEach((listener) => listener());
}
