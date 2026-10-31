import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Palette, withAlpha } from '@/constants/theme';
import type { ArtworkMeshImages } from '@/hooks/use-artwork-mesh';
import { MESH_SCRIM } from '@/lib/artwork-mesh';
import { smoothScrimStops } from '@/lib/scrim';

/** How long a mesh takes to come in over the page colour: the reference's 900 is a skip's; this is a first paint. */
const MESH_IN_MS = 320;

const STOPS = smoothScrimStops();
const SCRIM_LOCATIONS = STOPS.locations as unknown as readonly [number, number, ...number[]];
const SCRIM_COLORS = STOPS.alphas.map((alpha) =>
  withAlpha(Palette.shadowInk, MESH_SCRIM.top + (MESH_SCRIM.bottom - MESH_SCRIM.top) * alpha)
) as unknown as readonly [string, string, ...string[]];

/**
 * SimpMusic's Apple Music page (`lib/artwork-mesh.ts`), drawn: the artwork's
 * colours as a mesh hung from `seam` — the y where the artwork's foot is —
 * with its first row held above it, behind the artwork, and the reference's
 * scrim over the whole of it.
 *
 * Fills its parent. Until the mesh is read, and for a cover that has none,
 * it is `fallback` — the page colour the screen already had — and the mesh
 * fades in over it rather than cutting in.
 *
 * The mesh is two images stretched by the platform's bilinear filter: a
 * 64×64 texture below the seam, its first row above. Drawn twice by the cover
 * viewer — once under the artwork, once over its foot inside a mask — which
 * is how the artwork dissolves into the page with no line where the colours
 * would have to match: they are the same pixels.
 */
export function ArtworkMeshPage({
  mesh,
  seam,
  fallback,
}: {
  mesh: ArtworkMeshImages | null;
  seam: number;
  fallback: string;
}) {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: fallback }]} pointerEvents="none">
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: mesh ? 1 : 0,
            transitionProperty: 'opacity',
            transitionDuration: MESH_IN_MS,
          },
        ]}>
        {mesh && (
          <>
            <Image
              source={{ uri: mesh.seam }}
              style={[styles.held, { height: Math.max(1, seam) }]}
              contentFit="fill"
              cachePolicy="memory"
              transition={0}
              accessible={false}
            />
            <Image
              source={{ uri: mesh.page }}
              style={[styles.hung, { top: seam }]}
              contentFit="fill"
              cachePolicy="memory"
              transition={0}
              accessible={false}
            />
          </>
        )}
      </Animated.View>
      <LinearGradient
        colors={SCRIM_COLORS}
        locations={SCRIM_LOCATIONS}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  held: { position: 'absolute', top: 0, left: 0, right: 0 },
  hung: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
