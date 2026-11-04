import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Whether the app's controls are drawn in liquid glass — Settings → Liquid
 * glass (the owner's, 2026-11-03: "use it on buttons… the back button, the
 * navigation bar, the dropdown menus… Have this disabled by default, but add
 * an option to enable it in settings").
 *
 * Kept on the device, per account, as Animated artwork is
 * (`lib/animated-artwork.ts`). **Off by default**, so only "on" is stored.
 *
 * A module store rather than a query, unlike the other switches: it is read
 * by every glass-able control on screen at once — a top bar's keys, the tab
 * bar, each dropdown — and a store read through `useSyncExternalStore` costs
 * them nothing until it changes.
 */

const PREFIX = 'gamelog:liquid-glass';

let current: { userId: string | null; on: boolean } = { userId: null, on: false };
const loaded = new Set<string>();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Read this account's choice once; until it is read, controls are drawn without glass. */
export function loadLiquidGlass(userId: string | null): void {
  if (!userId) {
    if (current.userId !== null || current.on) {
      current = { userId: null, on: false };
      emit();
    }
    return;
  }
  if (current.userId !== userId) {
    current = { userId, on: false };
    emit();
  }
  if (loaded.has(userId)) return;
  loaded.add(userId);
  AsyncStorage.getItem(`${PREFIX}:${userId}`)
    .then((value) => {
      if (current.userId === userId && value === 'on' && !current.on) {
        current = { userId, on: true };
        emit();
      }
    })
    .catch(() => {
      /* Unreadable: glass stays off, which is the default anyway. */
    });
}

export function setLiquidGlass(on: boolean): void {
  const { userId } = current;
  current = { userId, on };
  emit();
  if (!userId) return;
  const key = `${PREFIX}:${userId}`;
  (on ? AsyncStorage.setItem(key, 'on') : AsyncStorage.removeItem(key)).catch(() => {
    /* Ignored — worst case it is off again next launch. */
  });
}

export function liquidGlassOn(): boolean {
  return current.on;
}

export function subscribeLiquidGlass(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
