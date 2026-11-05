import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Radius, Spacing, Typeface } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import type { ListCover } from '@/lib/api';

/** Apple Music's New Playlist artwork: 140 square. */
export const COLLECTION_ART = 140;

/**
 * The head of New and Edit collection — Apple Music's New Playlist (the
 * Apple pass, 2026-11-05): the collection's art, a 140 square (its cover's
 * box, or a glyph on the well while it has no game), and under it the name as
 * a borderless 22pt field, centred.
 */
export function CollectionArtTile({ cover }: { cover?: ListCover | null }) {
  const theme = useTheme();
  return (
    <View
      style={[styles.art, { backgroundColor: theme.surfaceElevated }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {cover ? (
        /* The box cropped to a square at its upper middle, as the
           collection's own header crops it. */
        <Image
          source={{ uri: cover.cover_url ?? cover.hero_url ?? undefined }}
          style={styles.fill}
          contentFit="cover"
          contentPosition="top"
          transition={150}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Ionicons name="albums" size={52} color={theme.textMuted} />
      )}
    </View>
  );
}

/** The name: no well, no edge, centred, 22 semibold — the screen's subject. */
export const CollectionTitleField = forwardRef<TextInput, TextInputProps>(
  function CollectionTitleField(props, ref) {
    const theme = useTheme();
    const accent = useAccent();
    return (
      <TextInput
        ref={ref}
        placeholderTextColor={theme.textMuted}
        selectionColor={accent.onSurface}
        cursorColor={accent.onSurface}
        textAlign="center"
        accessibilityLabel="Collection name"
        {...props}
        style={[styles.title, { color: theme.text }, props.style]}
      />
    );
  }
);

const styles = StyleSheet.create({
  art: {
    width: COLLECTION_ART,
    height: COLLECTION_ART,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.image,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  fill: { width: '100%', height: '100%' },
  title: {
    fontFamily: Typeface.semibold,
    fontSize: 22,
    paddingVertical: Spacing.x8,
    paddingHorizontal: Spacing.x16,
  },
});
