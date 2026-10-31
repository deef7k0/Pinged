import { Colors } from '@/constants/theme';

/**
 * The app is dark, always.
 *
 * Not a default the OS can override: the design is a dark room, the surface
 * steps that carry every bit of depth are tuned for it, and a light counterpart
 * would be a second product rather than a second stylesheet. Exported so that
 * anything needing to name the scheme — `expo-blur`'s `tint`, a status bar
 * style — asks this constant instead of guessing.
 */
export const APP_SCHEME = 'dark' as const;

export function useTheme() {
  return Colors[APP_SCHEME];
}
