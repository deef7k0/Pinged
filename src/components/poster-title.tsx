import { Image } from 'expo-image';
import { useState } from 'react';
import { Image as NativeImage, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Palette, Typeface } from '@/constants/theme';
import { useLogoInk } from '@/hooks/use-logo-ink';
import { gameLogoLook, logoBox, type GameLogo } from '@/lib/games/logo-art';

/** The logo's ink, and the name's: white, over art or a dark ground. */
const INK = Palette.white;

/** The logo, as a share of the card: the area every logo is drawn at, and its limits. */
const LOGO_AREA_SHARE = 0.1;
const LOGO_MAX_WIDTH = 0.62;
const LOGO_MAX_HEIGHT = 0.26;

/**
 * The game's logo over the foot of the art, or its name in type: until IGDB
 * answers, for a game without a usable logo, and for one that will not load.
 * Measured first, as the game page's is, so it is cropped to its ink and
 * drawn at one area whatever its file's shape.
 */
export function PosterTitle({
  logo,
  title,
  cardWidth,
  forCapture = false,
  color = INK,
}: {
  logo: GameLogo | null;
  title: string;
  cardWidth: number;
  /**
   * Drawn into an image (a shared card): React Native's `<Image>`, not
   * expo-image, whose hardware bitmaps a software canvas cannot draw.
   */
  forCapture?: boolean;
  /** The name's ink, and a dark logo's. White over art. */
  color?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const measured = useLogoInk(logo?.url ?? null);

  const name = (
    <Text numberOfLines={2} style={[styles.title, { color }]}>
      {title}
    </Text>
  );
  if (!logo || failed === logo.url) return name;

  const bounds = measured.ink?.bounds ?? FULL;
  const aspect = (logo.width * bounds.width) / Math.max(1, logo.height * bounds.height);
  const box = logoBox(
    aspect,
    cardWidth * LOGO_MAX_WIDTH,
    cardWidth * LOGO_MAX_HEIGHT,
    cardWidth * cardWidth * LOGO_AREA_SHARE
  );
  /* Its first sighting: its place held while it is measured. */
  if (!measured.resolved) return <View style={box} />;

  const look = logo.tint ? 'white' : gameLogoLook(measured.ink);
  if (look === 'name') return name;

  const drawn = { width: box.width / bounds.width, height: box.height / bounds.height };
  const placed = {
    position: 'absolute' as const,
    left: -bounds.x * drawn.width,
    top: -bounds.y * drawn.height,
  };
  if (forCapture) {
    return (
      <View style={[box, styles.logoBox]}>
        <NativeImage
          source={{ uri: logo.url }}
          style={[drawn, placed, look === 'white' && { tintColor: color }]}
          resizeMode="stretch"
          onError={() => setFailed(logo.url)}
          accessible={false}
        />
      </View>
    );
  }
  return (
    <View style={[box, styles.logoBox]}>
      <Image
        source={{ uri: logo.url }}
        style={[
          drawn,
          { position: 'absolute', left: -bounds.x * drawn.width, top: -bounds.y * drawn.height },
        ]}
        contentFit="fill"
        tintColor={look === 'white' ? color : undefined}
        transition={200}
        cachePolicy="memory-disk"
        onError={() => setFailed(logo.url)}
        accessible={false}
      />
    </View>
  );
}

const FULL = { x: 0, y: 0, width: 1, height: 1 };

const styles = StyleSheet.create({
  logoBox: { overflow: 'hidden' },
  title: {
    fontFamily: Typeface.extraBold,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.4,
    color: INK,
  },
});
