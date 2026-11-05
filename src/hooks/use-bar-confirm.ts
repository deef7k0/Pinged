import { useEffect, useRef, useSyncExternalStore } from 'react';

import { useScreenChrome } from '@/hooks/use-screen-chrome';

/** A modal's commit — Save, Send, Done — drawn as the ✓ in its bar. */
export type ConfirmAction = {
  onPress: () => void;
  /** What a screen reader hears — "Save", "Send report". */
  label: string;
  disabled?: boolean;
  loading?: boolean;
};

/**
 * Where a form inside a `<Screen>` tells that screen's bar what its ✓ does.
 *
 * The bar is the screen's and the form is often a child component that owns
 * the mutation, so the action travels through this per-screen store rather
 * than through props. An external store and not React state, so registering
 * from an effect re-renders only the bar.
 */
export type ConfirmSlot = {
  get: () => ConfirmAction | null;
  set: (action: ConfirmAction | null) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createConfirmSlot(): ConfirmSlot {
  let action: ConfirmAction | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => action,
    set: (next) => {
      action = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const NONE = () => null;
const IDLE = () => () => {};

/** The bar's read: the action the screen's form registered, or `null`. */
export function useSlotConfirm(): ConfirmAction | null {
  const slot = useScreenChrome()?.confirmSlot;
  return useSyncExternalStore(slot?.subscribe ?? IDLE, slot?.get ?? NONE, slot?.get ?? NONE);
}

/**
 * Put this form's commit in its screen's bar, as the ✓ — or nothing, while
 * the form is showing something with no commit (a picker over it). The press
 * always reaches the latest `onPress`; the bar redraws when the label,
 * `disabled` or `loading` change. Cleared when the form unmounts.
 */
export function useBarConfirm(action: ConfirmAction | null): void {
  const slot = useScreenChrome()?.confirmSlot;
  const press = useRef(action?.onPress);
  useEffect(() => {
    press.current = action?.onPress;
  });
  const shown = action !== null;
  const label = action?.label ?? '';
  const disabled = action?.disabled ?? false;
  const loading = action?.loading ?? false;
  useEffect(() => {
    if (!slot) return;
    slot.set(shown ? { label, disabled, loading, onPress: () => press.current?.() } : null);
  }, [slot, shown, label, disabled, loading]);
  useEffect(() => {
    if (!slot) return;
    return () => slot.set(null);
  }, [slot]);
}
