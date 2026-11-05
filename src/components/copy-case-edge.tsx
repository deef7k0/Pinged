import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { StyleSheet, Text as RNText, View } from 'react-native';

import { PLASTIC } from '@/components/copy-case-back';
import { caseBuildFor } from '@/constants/copy-stage';
import { CASE_TEMPLATES, hasCase, type PlatformKey } from '@/constants/platform-cases';
import { Typeface } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { mix } from '@/lib/color';

export type CopyCaseEdgeProps = {
  platform: PlatformKey;
  /** The strip itself: the case's depth across, its height tall. */
  depth: number;
  height: number;
  /** The case's face width — the spine's type is set in fractions of it, as the case's is. */
  caseWidth: number;
};

/**
 * The spine of the showcase's case: the side you read on a shelf.
 *
 * The protected `<GameCase>` has no drawn spine, and its docblock says why — a
 * coloured slab set flush against a finished template read as something stuck
 * to its edge. That was a face with a strip beside it. This is a box, and the
 * spine is one of its sides: it is not there at all while the cover is square
 * on, and comes round as the case is turned.
 *
 * It is printed as the back's branding band is — the console's own colour
 * (`spineColor`), its short name at the head, the game's title running down
 * from it — in the type DESIGN.md § 4.1.8 set for a spine. Reading top to
 * bottom, the way a case on a shelf does. Rounded by a gradient across it, not
 * by a radius: the box's corners are where its faces meet.
 */
export const CopyCaseSpine = memo(function CopyCaseSpine({
  platform,
  depth,
  height,
  caseWidth,
  title,
}: CopyCaseEdgeProps & { title: string }) {
  const theme = useTheme();

  if (!hasCase(platform)) {
    /* Bare box art is a printed card: its edge is a line of board. */
    return <View style={{ width: depth, height, backgroundColor: theme.surfaceSelected }} />;
  }

  const template = CASE_TEMPLATES[platform];
  const ink = template.spineTextColor;
  /* The type is the case's, capped by the room a thin jewel case has. */
  const titleSize = Math.min(Math.max(7, caseWidth * 0.045), depth * 0.5);
  const brandSize = Math.min(Math.max(6, caseWidth * 0.038), depth * 0.42);
  const showType = depth >= 14;

  return (
    <View style={{ width: depth, height, overflow: 'hidden' }}>
      <LinearGradient
        colors={[
          mix(template.spineColor, PLASTIC.bottom, 0.45),
          template.spineColor,
          mix(template.spineColor, PLASTIC.bottom, 0.3),
        ]}
        locations={[0, 0.42, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      {showType && (
        /* Laid out as wide as the spine is tall, then turned: a rotated view is
           measured before it is rotated. */
        <View
          style={[
            styles.run,
            {
              width: height,
              height: depth,
              left: (depth - height) / 2,
              top: (height - depth) / 2,
              paddingHorizontal: Math.round(caseWidth * 0.05),
            },
          ]}>
          <RNText
            style={[styles.brand, { fontSize: brandSize, color: ink }]}
            numberOfLines={1}
            allowFontScaling={false}>
            {template.spineLabel}
          </RNText>
          <RNText
            style={[styles.title, { fontSize: titleSize, color: ink }]}
            numberOfLines={1}
            allowFontScaling={false}>
            {title}
          </RNText>
        </View>
      )}
    </View>
  );
});

/**
 * The opening edge: the side opposite the spine, where the two halves meet.
 *
 * Plastic, with the seam down it, on a hinged case. A cardboard box is printed
 * on every side, so its far edge is the console's colour like its spine.
 */
export const CopyCaseLip = memo(function CopyCaseLip({
  platform,
  depth,
  height,
}: CopyCaseEdgeProps) {
  const theme = useTheme();

  if (!hasCase(platform)) {
    return <View style={{ width: depth, height, backgroundColor: theme.surfaceSelected }} />;
  }

  const printed = caseBuildFor(platform) === 'box';
  const base = printed ? CASE_TEMPLATES[platform].spineColor : PLASTIC.top;

  return (
    <View style={{ width: depth, height, overflow: 'hidden' }}>
      <LinearGradient
        colors={[mix(base, PLASTIC.bottom, 0.3), base, mix(base, PLASTIC.bottom, 0.5)]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      {!printed && (
        <View
          style={[
            styles.seam,
            { left: depth * 0.36, backgroundColor: PLASTIC.bottom, borderRightColor: PLASTIC.rule },
          ]}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  run: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    transform: [{ rotate: '90deg' }],
  },
  brand: { fontFamily: Typeface.bold, letterSpacing: 0.5, opacity: 0.85 },
  title: { fontFamily: Typeface.semibold, flexShrink: 1 },
  seam: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
});
