import { lazy, Suspense } from 'react';
import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { readableInk } from '@/lib/color';
import { SKIA_AVAILABLE } from '@/lib/skia-available';

const MascotLoader = SKIA_AVAILABLE
  ? lazy(() => import('@/components/ui/mascot-loader-skia'))
  : null;

/** `ActivityIndicator`'s sizes, as the mascot draws them. */
const SIZES = { small: 22, large: 44 } as const;

export type LoaderProps = {
  /** `small` (22, the default — `ActivityIndicator`'s) , `large` (44) or a number of dp. */
  size?: 'small' | 'large' | number;
  /** His body. The house blue's type twin unless the caller says otherwise. */
  color?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/**
 * The app's loader: the mascot — a blob with two rounded-rectangle eyes — who
 * turns into plain shapes and back while something loads (the owner's,
 * 2026-11-02, on reacticx's morph loader). It replaced `ActivityIndicator`
 * everywhere and takes the same `size` and `color`.
 *
 * Drawn with Skia where the build has it; a build without falls back to the
 * platform's spinner, so nothing loads without a sign.
 */
export function Loader({ size = 'small', color, style, accessibilityLabel }: LoaderProps) {
  const theme = useTheme();
  const body = color ?? theme.primaryText;
  const dp = typeof size === 'number' ? size : SIZES[size];
  const fallback = (
    <ActivityIndicator size={typeof size === 'number' ? 'small' : size} color={body} />
  );

  return (
    <View
      style={[{ width: dp, height: dp, alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? 'Loading'}>
      {MascotLoader ? (
        <Suspense fallback={fallback}>
          <MascotLoader size={dp} color={body} eyeColor={readableInk(body)} />
        </Suspense>
      ) : (
        fallback
      )}
    </View>
  );
}
