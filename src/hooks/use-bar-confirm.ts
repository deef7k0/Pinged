import { useEffect, useRef, useSyncExternalStore } from 'react';

import { useScreenChrome } from '@/hooks/use-screen-chrome';
import type { ConfirmAction } from '@/lib/confirm-slot';

export type { ConfirmAction, ConfirmSlot } from '@/lib/confirm-slot';

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
