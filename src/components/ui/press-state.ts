import { createContext, useContext } from 'react';
import type { SharedValue } from 'react-native-reanimated';

/**
 * Whether the control around a glyph is held — what `<PressableScale>` tells
 * the `<PressGlyph>`s inside it, so an icon can answer the finger on the
 * control (Convx's `pressWobble` reads its button's interaction source the
 * same way).
 */
export type PressState = {
  /** 1 while a finger is down, 0 otherwise, set at once — the glyph springs on its own. */
  down: SharedValue<number>;
  /** When the last press began (`Date.now()`), so a change of state can tell it was pressed. */
  pressedAt: { current: number };
};

export const PressContext = createContext<PressState | null>(null);

export function usePressState(): PressState | null {
  return useContext(PressContext);
}
