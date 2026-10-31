import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { logoNeedsLightInk } from '@/lib/logo-ink';
import type { StudioLogo } from '@/lib/wikidata/commons';
import { USER_AGENT } from '@/lib/wikidata/client';

/** SimpMusic's artist logo: at most 70% of the width and 84dp tall, whole (`ContentScale.Fit`). */
export const LOGO_WIDTH_RATIO = 0.7;
const LOGO_MAX_HEIGHT = 84;

/**
 * The studio's name — as its logo when there is a verified one, as type when
 * there is not.
 *
 * SimpMusic's artist header, where the band's wordmark replaces the name over
 * the photograph. The logo arrives after the name (it is looked up; the name
 * comes with the route) and simply takes its place; until then, and whenever
 * there is no free logo, the image fails to load or the lookup failed, the name
 * is what shows. The page never waits on it and never shows a hole where it was.
 *
 * **Ink.** Commons' logos are drawn for white pages. One whose own ink would
 * sit under 3:1 on this page — FromSoftware's black type, a navy wordmark — is
 * drawn as a light silhouette in the page's text colour; one that already reads
 * (Valve's red, Mojang's white-on-red block) is drawn as it is. See
 * `logoNeedsLightInk`. Either way it is the logo, never a colour taken from it
 * for a button.
 *
 * **The name's colour** (`nameColor`) is the banner game's Material 3 colour
 * when there is no logo — the owner's, 2026-10-22: "paint the text of their
 * name with the m3 color from the background game". Without one, the page's
 * own ink.
 */
export function StudioIdentity({
  name,
  logo,
  pageColor,
  maxWidth,
  nameColor,
}: {
  name: string | undefined;
  logo: StudioLogo | null | undefined;
  /** The page the logo sits on, which decides its ink. */
  pageColor: string;
  maxWidth: number;
  /** The name's ink when it is drawn as type. */
  nameColor?: string;
}) {
  const theme = useTheme();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (logo && failedUrl !== logo.url) {
    const aspect = logo.width / logo.height;
    const width = Math.round(Math.min(maxWidth, LOGO_MAX_HEIGHT * aspect));
    const height = Math.round(width / aspect);

    return (
      <Image
        source={{
          uri: logo.url,
          /* Wikimedia's media host answers a generic client with 403. */
          headers: { 'User-Agent': USER_AGENT },
          cacheKey: logo.url,
        }}
        style={{ width, height }}
        contentFit="contain"
        tintColor={logoNeedsLightInk(logo.luminance, pageColor) ? theme.text : undefined}
        transition={220}
        onError={() => setFailedUrl(logo.url)}
        accessible
        accessibilityRole="header"
        accessibilityLabel={name ?? 'Studio logo'}
      />
    );
  }

  if (!name) return null;
  return (
    <Text
      variant="display"
      numberOfLines={2}
      accessibilityRole="header"
      style={[styles.name, nameColor ? { color: nameColor } : null]}>
      {name}
    </Text>
  );
}

const styles = StyleSheet.create({
  name: { textAlign: 'center' },
});
