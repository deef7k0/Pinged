import type Ionicons from '@expo/vector-icons/Ionicons';

/**
 * The app's toasts — reacticx's `Toast` (the owner's, 2026-11-03: "for every
 * notification that is needed, such as the app telling you whenever you added
 * a game to your collection"), as a store anything can write to and
 * `<Toaster>` draws.
 *
 * ```ts
 * toast.success('Added to Favourites');
 * toast.error('Couldn’t save your log', { description: error.message });
 * toast('Link copied');
 * ```
 *
 * A plain module, not a context: a toast is said from a mutation's
 * `onSuccess`, a sheet's button, a gesture — places that have no reason to be
 * inside a provider, and no business re-rendering when a toast comes or goes.
 */

export type ToastKind = 'default' | 'success' | 'error' | 'info';

export type ToastOptions = {
  /** A second, quieter line. */
  description?: string;
  /** One button at the toast's end — Undo, View. Pressing it dismisses the toast. */
  action?: { label: string; onPress: () => void };
  /** In place of the kind's own glyph. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** How long it stands, in ms; reacticx's `TOAST_LIFETIME` by default. */
  duration?: number;
};

export type ToastRecord = ToastOptions & {
  id: number;
  kind: ToastKind;
  title: string;
  /** On its way out: the row plays its exit, then removes itself. */
  leaving: boolean;
};

/** reacticx's lifetime: four seconds. */
export const TOAST_LIFETIME = 4000;
/** One at a time, iOS's (the Apple pass, 2026-11-05): a new one replaces it. */
export const TOAST_VISIBLE = 1;
/** Kept at once: the one shown. reacticx stacked three of five. */
const TOAST_KEPT = 1;

let records: ToastRecord[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function show(kind: ToastKind, title: string, options: ToastOptions = {}): number {
  const id = nextId++;
  /* The same words twice in a row are one toast, refreshed: two taps on a
     key must not stack two identical notes. */
  const same = records.find((r) => !r.leaving && r.title === title && r.kind === kind);
  const rest = same ? records.filter((r) => r !== same) : records;
  records = [{ id, kind, title, leaving: false, ...options }, ...rest].slice(0, TOAST_KEPT);
  emit();
  return id;
}

/** Say something. `toast.success`, `.error` and `.info` choose the glyph and its colour. */
export const toast = Object.assign(
  (title: string, options?: ToastOptions) => show('default', title, options),
  {
    success: (title: string, options?: ToastOptions) => show('success', title, options),
    error: (title: string, options?: ToastOptions) => show('error', title, options),
    info: (title: string, options?: ToastOptions) => show('info', title, options),
    /** Start a toast's exit; it removes itself once it has left. */
    dismiss: (id: number) => {
      if (!records.some((r) => r.id === id && !r.leaving)) return;
      records = records.map((r) => (r.id === id ? { ...r, leaving: true } : r));
      emit();
    },
  }
);

/** Gone for good, once its exit has played. `<Toaster>`'s, not the app's. */
export function removeToast(id: number): void {
  records = records.filter((r) => r.id !== id);
  emit();
}

export function subscribeToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getToasts(): ToastRecord[] {
  return records;
}

/** What a failed write says, from whatever it threw. */
export function errorText(error: unknown, fallback = 'Something went wrong.'): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/*
 * Which `<Toaster>` draws. Android draws a sheet in a window of its own, so a
 * toast from the root would be under any sheet that is open; every sheet
 * mounts a `<Toaster>` inside its window, and only the newest one mounted
 * draws — the sheet in front, else the root.
 */
let hostSeq = 0;
let hosts: number[] = [];
const hostListeners = new Set<() => void>();

/** A new host's id, once, when it is created. */
export function newToastHostId(): number {
  return ++hostSeq;
}

/** While mounted, `id` is a host; the newest mounted draws. */
export function registerToastHost(id: number): () => void {
  hosts = [...hosts, id];
  for (const listener of hostListeners) listener();
  return () => {
    hosts = hosts.filter((h) => h !== id);
    for (const listener of hostListeners) listener();
  };
}

export function topToastHost(): number | null {
  return hosts.length > 0 ? hosts[hosts.length - 1] : null;
}

export function subscribeToastHosts(listener: () => void): () => void {
  hostListeners.add(listener);
  return () => {
    hostListeners.delete(listener);
  };
}

/** What adding to or taking off the two built-in lists says. */
export function listToastFor(kind: 'favorites' | 'wishlist', added: boolean): string {
  if (kind === 'favorites')
    return added ? 'Added to your favourites' : 'Removed from your favourites';
  return added ? 'Added to your wishlist' : 'Removed from your wishlist';
}
