import { TurboModuleRegistry } from 'react-native';

/**
 * Whether this build has Skia's native module — asked without importing Skia,
 * whose entry calls `getEnforcing('RNSkiaModule')` as it loads and would throw
 * in a build from before it (and on the web). Anything drawn with Skia is
 * reached through `React.lazy` behind this (`<PinnedHero>`'s pattern).
 */
export const SKIA_AVAILABLE = TurboModuleRegistry.get('RNSkiaModule') != null;
