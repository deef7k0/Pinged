import {
  createContext,
  createElement,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import { Colors } from '@/constants/theme';
import { getColorScheme, subscribeColorScheme, type ColorScheme } from '@/lib/color-scheme';

/**
 * The app's default scheme, as a constant — kept for the few module-level
 * values that are built once (the M3 fallback scheme). Nothing that draws
 * should read it: `useColorScheme()` is the scheme in force.
 */
export const APP_SCHEME = 'dark' as const;

/**
 * A subtree that is always one scheme, whatever the setting says.
 *
 * The screens about one game — its page, a studio, a collection, a review,
 * Surprise Me, a copy, the log form — are built out of the game's artwork
 * (its key colour, its Material 3 scheme, white type on the cover's foot),
 * and stay dark rooms in light mode, as Apple TV's product pages do.
 * `<AccentProvider>` sets this for its children; a route that reads the
 * theme above its own provider is wrapped in `<DarkRoom>`.
 */
const SchemeOverride = createContext<ColorScheme | null>(null);

export function SchemeProvider({ scheme, children }: { scheme: ColorScheme; children: ReactNode }) {
  return createElement(SchemeOverride.Provider, { value: scheme }, children);
}

/** The scheme in force here: a subtree's override, else the setting. */
export function useColorScheme(): ColorScheme {
  const override = useContext(SchemeOverride);
  const chosen = useSyncExternalStore(subscribeColorScheme, getColorScheme, getColorScheme);
  return override ?? chosen;
}

/** The setting itself, ignoring any override — Settings and the status bar's root. */
export function useChosenColorScheme(): ColorScheme {
  return useSyncExternalStore(subscribeColorScheme, getColorScheme, getColorScheme);
}

export function useTheme() {
  return Colors[useColorScheme()];
}
