import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ArtworkMeshPage } from '@/components/ui/artwork-mesh-page';
import type { ArtworkMeshImages } from '@/hooks/use-artwork-mesh';

/** The cover dissolves into the page over its last eighth — the viewer's own. */
const DISSOLVE_SHARE = 0.12;
const FADE_MS = 360;

/**
 * The game page with its cover in front (the owner's, 2026-11-03): the
 * cover stays where it is, pinned — no zoom — and under it SimpMusic's Apple
 * Music page fades in, the cover's own blurred mesh hung from its foot, in
 * place of the solid page. Drawn over the pinned hero and under the page's
 * words, which fade out the other way; the cover's last eighth dissolves into
 * it inside a mask, as the cover viewer's did (`DISSOLVE_SHARE`).
 *
 * Removed for one build on 2026-11-04 and brought back the same day at the
 * owner's word ("make the clear view artwork cover like before too").
 *
 * A CSS transition on a React prop, so the fade cannot lose its end value.
 */
export function CoverFront({
  shown,
  mesh,
  coverHeight,
  page,
}: {
  shown: boolean;
  mesh: ArtworkMeshImages | null;
  /** Where the cover's foot is, from the top of the display. */
  coverHeight: number;
  /** The page's own colour, until the mesh is read. */
  page: string;
}) {
  const fadeTop = coverHeight * (1 - DISSOLVE_SHARE);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          opacity: shown ? 1 : 0,
          transitionProperty: 'opacity',
          transitionDuration: FADE_MS,
          transitionTimingFunction: 'ease-out',
        },
      ]}>
      <MaskedView
        style={StyleSheet.absoluteFill}
        maskElement={
          <View style={StyleSheet.absoluteFill}>
            <View style={{ height: fadeTop }} />
            <LinearGradient
              colors={['rgba(0,0,0,0)', '#000']}
              style={{ height: coverHeight - fadeTop }}
            />
            <View style={styles.rest} />
          </View>
        }>
        <ArtworkMeshPage mesh={mesh} seam={coverHeight} fallback={page} />
      </MaskedView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rest: { flex: 1, backgroundColor: '#000' },
});
