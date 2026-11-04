import { BlurView } from 'expo-blur';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { useEffect, useSyncExternalStore, type ComponentType } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { withAlpha } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useScreenChrome } from '@/hooks/use-screen-chrome';
import { useTheme } from '@/hooks/use-theme';
import { liquidGlassOn, loadLiquidGlass, subscribeLiquidGlass } from '@/lib/liquid-glass';
import { useAuth } from '@/store/auth';

/*
 * Liquid glass on the app's controls — Settings → Liquid glass, off by
 * default (the owner's, 2026-11-03): the back button and every top bar key,
 * the tab bar and its search key, the dropdown buttons and their menus, the
 * round icon keys. **Never a card, and never a primary action** (the review
 * button, Log, Follow…): glass is for the chrome you steer with.
 *
 * ## Two engines, one look
 *
 *  - **iOS** with `expo-liquid-glass-view` in the build: the real material —
 *    Apple's `UIGlassEffect` on iOS 26, its own Metal lens below that. It is
 *    iOS only (its `expo-module.config.json` names one platform), so it is
 *    looked up with `requireOptionalNativeModule` before its JavaScript is
 *    loaded at all: the package asks for its native view as it is imported.
 *  - **Android, and anywhere the package is missing**: the material rebuilt
 *    from Podium's glass (GHOSTxASR/podium-music-player, ADR-007 and its
 *    `Glass.kt`, read for the numbers — the code there is GPL and none of it
 *    is copied): its "blur" tier, since its lens is a Compose library React
 *    Native cannot reach. Behind the control, the page blurred (12dp, its
 *    `Control` material); over it a dark tint at 30%; the game's colour
 *    falling on it from above, 16% at the top edge and gone by four fifths
 *    down; a one-dp rim of light, brightest where the light lands; and a
 *    long soft shadow under it (24dp, 8 down, 28%). Where the page cannot be
 *    blurred (Android outside a `<Screen>`, which owns the blur target), the
 *    tint thickens to 62% — Podium's "solid" tier, a surface, not a hole.
 *
 * A control opts in by drawing `<GlassSurface>` as its first child and going
 * clear itself while `useLiquidGlass()` is true.
 */

const NATIVE = Platform.OS === 'ios' && !!requireOptionalNativeModule('ExpoLiquidGlass');

type NativeGlassProps = {
  variant?: 'regular' | 'clear';
  cornerRadius?: number;
  tint?: string;
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
};

/* Loaded only where its native view exists: on Android the package's own
   import would ask for a view that is not there. */
const NativeGlass: ComponentType<NativeGlassProps> | null = NATIVE
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('expo-liquid-glass-view') as { LiquidGlassView: ComponentType<NativeGlassProps> })
      .LiquidGlassView
  : null;

/** Podium's `Control` material, in this app's units. */
export const GLASS = {
  blur: 12,
  tint: 0.3,
  solidTint: 0.62,
  glow: 0.16,
  glowUntil: 0.8,
  rim: 0.42,
  shadow: '0 8px 24px rgba(0,0,0,0.28)',
} as const;

const RIM = `linear-gradient(140deg, rgba(255,255,255,${GLASS.rim}) 0%, rgba(255,255,255,0.1) 38%, rgba(255,255,255,0.05) 64%, rgba(255,255,255,0.2) 100%)`;

/** Whether controls are drawn in liquid glass right now. */
export function useLiquidGlass(): boolean {
  return useSyncExternalStore(subscribeLiquidGlass, liquidGlassOn);
}

/** Reads the signed-in account's choice; in the root layout, once. */
export function LiquidGlassWarmup() {
  const userId = useAuth((state) => state.session?.user.id) ?? null;
  useEffect(() => loadLiquidGlass(userId), [userId]);
  return null;
}

export type GlassSurfaceProps = {
  /** The control's own corner — a circle's half its height, a pill's too. */
  radius: number;
  /** Drop the shadow: a control inside something that already casts one. */
  flat?: boolean;
  /**
   * Drawn over the page, outside `<Screen>`'s blur target — the top bar's
   * controls, and nothing else. **Only then does Android blur.** A blur
   * inside the view it blurs draws itself forever: Expo Go closed with no
   * log on Surprise Me, whose glass key sat in a card inside the page
   * (2026-11-03). Everywhere else Android draws the solid tier.
   */
  overPage?: boolean;
};

/**
 * The glass itself, filling its parent behind the control's glyph or words.
 * Draw it first, and give the parent no fill of its own while glass is on.
 */
export function GlassSurface({ radius, flat = false, overPage = false }: GlassSurfaceProps) {
  const theme = useTheme();
  const accent = useAccent();
  const chrome = useScreenChrome();

  if (NativeGlass) {
    return (
      <View
        pointerEvents="none"
        style={[styles.fill, { borderRadius: radius }, !flat && { boxShadow: GLASS.shadow }]}>
        <NativeGlass
          variant="regular"
          cornerRadius={radius}
          tint={withAlpha(accent.color, 0.12)}
          style={StyleSheet.absoluteFill}
        />
      </View>
    );
  }

  const target =
    Platform.OS === 'android' ? (overPage ? (chrome?.blurTarget ?? null) : null) : undefined;
  const blurs = Platform.OS !== 'android' || target !== null;
  const glow = `linear-gradient(180deg, ${withAlpha(accent.color, GLASS.glow)} 0%, ${withAlpha(
    accent.color,
    0
  )} ${GLASS.glowUntil * 100}%)`;

  return (
    <View
      pointerEvents="none"
      style={[styles.fill, { borderRadius: radius }, !flat && { boxShadow: GLASS.shadow }]}>
      {/* The rim: the whole shape, with the pane one dp inside it. */}
      <View
        style={[
          styles.fill,
          { borderRadius: radius, overflow: 'hidden', experimental_backgroundImage: RIM },
        ]}
      />
      <View style={[styles.pane, { borderRadius: Math.max(0, radius - 1) }]}>
        {blurs && (
          <BlurView
            intensity={GLASS.blur * 5}
            tint="dark"
            style={StyleSheet.absoluteFill}
            {...(Platform.OS === 'android'
              ? {
                  blurMethod: 'dimezisBlurView' as const,
                  blurTarget: target ?? undefined,
                  blurReductionFactor: 4,
                }
              : null)}
          />
        )}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: withAlpha(theme.shadowInk, blurs ? GLASS.tint : GLASS.solidTint) },
          ]}
        />
        <View style={[StyleSheet.absoluteFill, { experimental_backgroundImage: glow }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  pane: { position: 'absolute', top: 1, left: 1, right: 1, bottom: 1, overflow: 'hidden' },
});
