/*
 * The store behind a modal's ✓ (`hooks/use-bar-confirm`), on its own so
 * `use-screen-chrome` can create one without importing the hook that reads
 * the chrome — which was a require cycle.
 */

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
