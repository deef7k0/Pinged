import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { CASE_TEMPLATES, hasCase, type PlatformKey } from '@/constants/platform-cases';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { sharpCoverUrl } from '@/lib/games/sharp-cover';

export type CopyCaseFrontProps = {
  coverUrl?: string | null;
  heroUrl?: string | null;
  title: string;
  /** "Collector's Edition", "Deluxe" — the band across the foot of the face. */
  edition?: string | null;
  platform: PlatformKey;
  width: number;
  height: number;
};

/**
 * The cover of the copy showcase's case: the showcase's own drawing of it.
 *
 * `<GameCase>` draws this face everywhere else and is protected. The owner
 * lifted that protection for `copy/[id]` alone, and this is why the showcase
 * needed to: its case is a box that turns, which wants a face with **no
 * shadow of its own** (the box casts on the floor, once, as a whole — a shadow
 * on each face would turn with it) and artwork at **four times the pixels**.
 * Neither is a change `<GameCase>` should wear on a game's page.
 *
 * So the layering is `<GameCase>`'s, restated: the artwork in the template's
 * window, the platform's template PNG over it, the diagonal gloss at the same
 * 0.20, the edition band. Its geometry is read from the same table
 * (`CASE_TEMPLATES`) by the same one scale factor, so a re-cut template moves
 * both cases at once. A platform with no case is the bare box art.
 *
 * **The art arrives twice.** The 264px cover the list had is already in the
 * image cache, so it is the placeholder and is on screen in the first frame;
 * the 1080p file fades in over it (`sharpCoverUrl`). The same picture getting
 * sharper is not the swap `useSquareCover` exists to prevent — that one traded
 * a portrait for a square.
 */
export const CopyCaseFront = memo(function CopyCaseFront({
  coverUrl,
  heroUrl,
  title,
  edition,
  platform,
  width,
  height,
}: CopyCaseFrontProps) {
  const theme = useTheme();
  const cased = hasCase(platform);
  const small = coverUrl ?? heroUrl ?? null;
  const sharp = sharpCoverUrl(small);

  const art = sharp ? (
    <Image
      source={{ uri: sharp }}
      placeholder={small && small !== sharp ? { uri: small } : undefined}
      placeholderContentFit="cover"
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      transition={220}
      cachePolicy="memory-disk"
      recyclingKey={sharp}
      accessibilityIgnoresInvertColors
    />
  ) : (
    <View style={styles.placeholder}>
      <Text variant="caseTitle" color="textMuted">
        {title.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );

  if (!cased) {
    return (
      <View
        style={[
          styles.bare,
          { width, height, backgroundColor: theme.surfaceElevated, borderColor: theme.border },
        ]}>
        {art}
        <Gloss />
      </View>
    );
  }

  const template = CASE_TEMPLATES[platform];
  const scale = width / template.templateSize.width;
  const { coverArea } = template;

  return (
    <View style={{ width, height }}>
      <View
        style={[
          styles.cover,
          {
            left: coverArea.x * scale,
            top: coverArea.y * scale,
            width: coverArea.width * scale,
            height: coverArea.height * scale,
            backgroundColor: theme.surfaceElevated,
          },
        ]}>
        {art}
      </View>

      <Image
        source={template.template}
        style={[StyleSheet.absoluteFill, { width, height }]}
        contentFit="fill"
        pointerEvents="none"
        accessibilityIgnoresInvertColors
      />

      <Gloss />

      {!!edition && <CopyCaseEditionBand edition={edition} />}
    </View>
  );
});

/**
 * The edition band across the foot of the cover. Exported for the 3D stage,
 * which takes a picture of it (`<CopyStageSheet>`) to print on its cover:
 * `floating={false}` lays it out on its own, as wide as its parent.
 */
export function CopyCaseEditionBand({
  edition,
  floating = true,
}: {
  edition: string;
  floating?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[styles.edition, !floating && styles.editionAlone, { backgroundColor: theme.scrim }]}>
      <Text variant="caseEdition" color="text" style={styles.editionText} numberOfLines={1}>
        {edition.toUpperCase()}
      </Text>
    </View>
  );
}

/** The case's own diagonal sheen, at the values DESIGN.md § 4.1.7 fixes for it. */
function Gloss() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.9, y: 0.55 }}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  cover: { position: 'absolute', overflow: 'hidden' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bare: { overflow: 'hidden', borderRadius: Radius.image, borderWidth: StyleSheet.hairlineWidth },
  edition: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    /* Literal, as on `<GameCase>`: the case's printing does not ride the
       interface's spacing ladder. */
    paddingVertical: 4,
    alignItems: 'center',
  },
  editionAlone: { position: 'relative' },
  editionText: { letterSpacing: 1 },
});
