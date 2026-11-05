import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Elevation, Typeface } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type AvatarProps = {
  uri?: string | null;
  /** Used for the initial when there is no image. */
  name?: string | null;
  size?: number;
};

/** Deterministic hue per user so the fallback colour is stable across renders. */
function hueFor(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  }
  return hash;
}

export function Avatar({ uri, name, size = 40 }: AvatarProps) {
  const theme = useTheme();
  const label = (name ?? '?').trim();
  const initial = label.charAt(0).toUpperCase() || '?';

  /*
   * The shadow lives on an outer view because the circle is made by clipping,
   * and Android's elevation does not survive `overflow: 'hidden'`. The outer
   * view needs the radius and a fill too, or the shadow is cast as a square.
   * See DESIGN.md § 6.3.
   */
  const box = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return (
      <View style={[box, Elevation.card, { backgroundColor: theme.surfaceElevated }]}>
        {/* `recyclingKey` is a correctness fix before it is a performance one.
            Avatars are the densest recycled image in the app — one per wall
            row, feed row and comment — and without a key expo-image keeps the
            previous view's bitmap while the new one decodes, so a fast scroll
            shows somebody else's face against this row's name. `memory-disk`
            then stops the same handful of faces being refetched on every
            screen that lists people. */}
        <Image
          source={{ uri }}
          style={[styles.base, box]}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          recyclingKey={uri}
          accessibilityIgnoresInvertColors
        />
      </View>
    );
  }

  return (
    /*
     * Decorative, so assistive tech skips it.
     *
     * A bare `<Text>` is focusable by default, so this fallback announced as a
     * single meaningless character — "A" — immediately before the name it is an
     * initial of. Every call site pairs the avatar with that name, so there is
     * nothing here a reader needs and one stop fewer to swipe past.
     */
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.base,
        styles.fallback,
        Elevation.card,
        box,
        {
          // 28% lightness sits between `surface` and `surfaceElevated`, so a generated
          // avatar reads as part of the same dark room as everything around it.
          backgroundColor: `hsl(${hueFor(label)}, 45%, 28%)`,
        },
      ]}>
      {/*
        `allowFontScaling={false}`, which is the one place in this app that is
        the right call rather than a shortcut.

        The circle is a fixed diameter by contract — 76dp on a profile, 30–54dp
        in a row — and it cannot grow with the OS text size without moving every
        layout it sits inside. So at large accessibility sizes the glyph grew and
        the box did not, and the letter clipped against its own clip mask.

        What makes freezing it correct rather than a regression is that this
        letter is **not text to read**. It is a stand-in for a face, and the
        person's actual name is always rendered beside it at a size that *does*
        scale — every call site pairs the two. Nothing is lost by holding the
        monogram still; the name carries the meaning.
      */}
      <Text
        allowFontScaling={false}
        style={[styles.initial, { fontSize: size * 0.42, color: theme.text }]}>
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: Typeface.semibold },
});
