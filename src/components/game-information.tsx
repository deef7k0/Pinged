import { StyleSheet, View } from 'react-native';

import { Section, useSectionInset } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { FontFamily, Palette, Spacing, withAlpha } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';

/**
 * Apple TV's "Información" (the owner's reference, 2026-11-03): one soft box
 * under the heading holding the title, its genres in small capitals and the
 * whole synopsis — the only filled block on that page, and the only one on
 * this one. The header gives the synopsis two lines; this is all of it.
 */
export function GameInformation({
  title,
  genres,
  description,
}: {
  title: string;
  genres: readonly string[];
  description: string | null;
}) {
  const accent = useAccent();
  const inset = useSectionInset();
  if (!description && genres.length === 0) return null;

  return (
    <Section title="Information">
      <View style={[styles.box, { marginHorizontal: inset }]}>
        <Text variant="h4">{title}</Text>
        {genres.length > 0 && (
          <Text style={[styles.genres, { color: accent.quietInk }]}>
            {genres.join(' · ').toUpperCase()}
          </Text>
        )}
        {!!description && (
          <Text style={[styles.description, { color: accent.quietInk }]}>{description}</Text>
        )}
      </View>
    </Section>
  );
}

/**
 * Apple TV's one boxed thing: a step lighter than the page, whatever the
 * page's colour — white over it, as the reference's #2C2C2E stands on its
 * #1C1C1E. Information's box, and Details' (the owner's, 2026-11-04: "make
 * the details information in the overview tab inside a card like the
 * information one").
 */
export const INFO_BOX = {
  borderRadius: 12,
  padding: Spacing.x16,
  backgroundColor: withAlpha(Palette.white, 0.07),
} as const;

const styles = StyleSheet.create({
  box: { ...INFO_BOX, gap: Spacing.x4 },
  genres: {
    fontFamily: FontFamily.semibold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.6,
    marginBottom: Spacing.x4,
  },
  description: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 21 },
});
