import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { ScreenshotViewer, type Screenshot } from '@/components/screenshot-viewer';
import { ArtRail, Section } from '@/components/ui/section';
import { Palette, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { trailerThumbnail, trailerUrl, type GameTrailer } from '@/lib/games/trailer';

type Item =
  | { kind: 'header'; art: string | null; name: string }
  | { kind: 'trailer'; trailer: GameTrailer }
  | { kind: 'shot'; shot: Screenshot; index: number };

/** The Apple TV tile's corner, and the caption band's colours over its foot. */
const TILE_RADIUS = 12;
/** The play disc on a trailer's tile. */
const PLAY = 40;

/**
 * The game page's first section: its trailers, then its screenshots — as
 * Apple TV's "Trailers ›" row (the owner's references, 2026-11-03): wide
 * tiles with a 12dp corner, a trailer's name and "Trailer" under it (the
 * Apple pass, 2026-11-05 — they were on a dark band over its foot), nothing
 * printed on a screenshot.
 *
 * - **The Steam trailer plays in the header** (`headerTrailer`): the tile is
 *   the game's landscape art, and pressing it takes the page back to its top,
 *   where the header turns on its side and plays it.
 * - **IGDB's trailer is YouTube's**, and opens there (the owner's, 2026-10-15).
 * - **A screenshot opens `<ScreenshotViewer>`**: full width, one at a time,
 *   pinched, swiped through.
 *
 * Its own component so opening the viewer re-renders this row and not the
 * whole game page (CLAUDE.md, performance traps).
 */
export function GameScreenshots({
  shots,
  trailer,
  headerTrailer,
}: {
  shots: readonly Screenshot[];
  trailer: GameTrailer | null;
  /** The trailer the header plays, and the way to start it from here. */
  headerTrailer?: { art: string | null; name: string; onPlay: () => void } | null;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState<number | null>(null);

  const items: Item[] = [
    ...(headerTrailer
      ? [{ kind: 'header' as const, art: headerTrailer.art, name: headerTrailer.name }]
      : []),
    ...(trailer ? [{ kind: 'trailer' as const, trailer }] : []),
    ...shots.map((shot, index) => ({ kind: 'shot' as const, shot, index })),
  ];
  if (items.length === 0) return null;

  const hasTrailer = !!trailer || !!headerTrailer;

  return (
    <Section title={hasTrailer ? 'Trailers and screenshots' : 'Screenshots'}>
      <ArtRail
        data={items}
        keyOf={(item) =>
          item.kind === 'header'
            ? 'header-trailer'
            : item.kind === 'trailer'
              ? `trailer-${item.trailer.videoId}`
              : item.shot.url
        }
        shape="wide"
        /* Apple TV's captions, under the tile (the Apple pass, 2026-11-05):
           the trailer's name and what it is; a screenshot has none. */
        titleOf={(item) =>
          item.kind === 'header'
            ? item.name
            : item.kind === 'trailer'
              ? item.trailer.name
              : undefined
        }
        subtitleOf={(item) =>
          item.kind === 'header' ? 'Trailer' : item.kind === 'trailer' ? 'Trailer · YouTube' : null
        }
        labelOf={(item) =>
          item.kind === 'header'
            ? `${item.name}. Plays at the top of the page.`
            : item.kind === 'trailer'
              ? `${item.trailer.name}. Opens YouTube.`
              : `${item.shot.label}. Opens it full screen.`
        }
        onPressItem={(item) => {
          if (item.kind === 'header') {
            headerTrailer?.onPlay();
          } else if (item.kind === 'trailer') {
            Linking.openURL(trailerUrl(item.trailer)).catch(() => {
              /* No browser and no YouTube app — nothing useful to say here. */
            });
          } else {
            setOpen(item.index);
          }
        }}
        renderArt={(item, size) => {
          if (item.kind === 'shot') {
            return (
              <Image
                source={{ uri: item.shot.url }}
                style={[size, styles.tile, { backgroundColor: theme.surfaceElevated }]}
                contentFit="cover"
                transition={200}
                accessibilityIgnoresInvertColors
              />
            );
          }
          const art = item.kind === 'header' ? item.art : trailerThumbnail(item.trailer);
          return (
            <View style={[size, styles.tile, { backgroundColor: theme.surfaceElevated }]}>
              {art && (
                <Image
                  source={{ uri: art }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={200}
                  accessibilityIgnoresInvertColors
                />
              )}
              {/* The play glyph alone on the art: the words are under it. */}
              <View style={styles.play}>
                <Ionicons name="play" size={18} color={theme.white} style={styles.playNudge} />
              </View>
            </View>
          );
        }}
      />

      <ScreenshotViewer shots={shots} index={open} onClose={() => setOpen(null)} />
    </Section>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: TILE_RADIUS, overflow: 'hidden' },
  play: {
    position: 'absolute',
    left: Spacing.x12,
    bottom: Spacing.x12,
    width: PLAY,
    height: PLAY,
    borderRadius: PLAY / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(Palette.shadowInk, 0.55),
  },
  playNudge: { marginLeft: 2 },
});
