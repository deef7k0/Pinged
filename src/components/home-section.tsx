import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { Text } from '@/components/ui/text';
import { Typeface, Spacing, TapTarget, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type HomeSectionProps = {
  title: string;
  /**
   * Words set before the title in the regular weight, so the title is the
   * bold part: "Similar to **Hades**". For a heading whose subject is a name
   * the page did not choose — the bold is where the reader's eye lands.
   */
  lead?: string;
  /** Optional one-line explanation of what the section is showing and why. */
  subtitle?: string;
  /**
   * A small line *over* the title — SimpMusic's shelf `subtitle`, YouTube's
   * strapline: "FOR RELAXING" over a mood's first shelf, "Let's start with one
   * of these" over Quick picks, "STUDIO" over a studio's row.
   */
  strapline?: string;
  /**
   * A round picture before the title: the artist's face YouTube heads a shelf
   * with (`HomeSectionHeader`'s 36dp circle) — a studio's logo here.
   */
  avatar?: ReactNode;
  /** Where the section leads. Omit to render the heading without a chevron. */
  seeAll?: Href;
  /** The heading leads on by a callback instead of a route (Search's Top results switching tab). */
  onSeeAll?: () => void;
  /**
   * A small control at the far end of the heading's line — the period on
   * "Beloved by the community". In place of the chevron, never beside it.
   */
  trailing?: ReactNode;
  /**
   * The band's content.
   *
   * Optional, for the one case where the host owns the rows: a band whose items
   * are a `FlatList`'s own data cannot nest them here, so it uses this for the
   * heading and lets the list render underneath.
   */
  children?: ReactNode;
};

/**
 * A band of a page: a heading on the page, and under it what the heading
 * names — a row of games, news, the genres, collections, a studio's grid.
 *
 * The heading is the owner's reference for a section (2026-10-09, Letterboxd's
 * home), in this app's type:
 *
 * - **`h2`**, one line — Apple Music's large section titles, at the owner's
 *   direction (2026-10-22: "make the texts for the sections title bigger").
 *   It was `h4` (16) for a while.
 * - **A chevron, not "See all".** A heading that leads somewhere is the link —
 *   the whole line — and ends in a quiet chevron.
 * - **A row of games has no subtitle**: the covers under it explain it. The
 *   line is for what is not a row of covers — a grid of ten genres does not
 *   explain itself.
 *
 * **On the page, not in a card.** For one build every row of games sat in a
 * rounded panel with its heading inside, as the reference's do; the owner saw
 * it on a phone and had the cards removed. This is what a row stands under.
 *
 * Separation between sections is set by the page (`Spacing.x32`, 32dp) rather
 * than here, so a section never decides its own distance from its neighbours.
 */
export function HomeSection({
  title,
  lead,
  subtitle,
  strapline,
  avatar,
  seeAll,
  onSeeAll,
  trailing,
  children,
}: HomeSectionProps) {
  const theme = useTheme();

  const words = (
    <View style={styles.headText}>
      {/* `textSecondary`: Home's glow is behind it, where the muted grey is under AA. */}
      {strapline && (
        <Text variant="bodySmall" color="textSecondary" numberOfLines={1}>
          {strapline}
        </Text>
      )}
      <Text variant="h2" accessibilityRole="header" numberOfLines={strapline ? 1 : undefined}>
        {lead && <Text variant="h2" style={styles.lead}>{`${lead} `}</Text>}
        {title}
        {/* Apple's: the chevron straight after the words, on their line and
            in the quiet ink — not pushed to the far end of the row. Inline,
            so it wraps with the last word. */}
        {(seeAll || onSeeAll) && (
          <Text variant="h2" color="textSecondary">
            {' '}
            <Ionicons name="chevron-forward" size={CHEVRON} color={theme.textSecondary} />
          </Text>
        )}
      </Text>
      {subtitle && (
        <Text variant="bodySmall" color="textMuted">
          {subtitle}
        </Text>
      )}
    </View>
  );

  /* The reference's 10 between the circle and the words, inside the row's 12. */
  const text = avatar ? (
    <View style={styles.withAvatar}>
      {avatar}
      {words}
    </View>
  ) : (
    words
  );

  /* A `<Reveal>`: on a page that opts in (`<RevealScope>` — a studio's
     rails), the section rises into place as it scrolls into view. */
  return (
    <Reveal style={styles.section}>
      {onSeeAll && !seeAll ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`See all ${(lead ? `${lead} ${title}` : title).toLowerCase()}`}
          hitSlop={HEAD_SLOP}
          onPress={onSeeAll}
          scaleTo={0.98}
          style={StyleSheet.flatten(styles.head)}>
          {text}
        </PressableScale>
      ) : seeAll ? (
        <Link href={seeAll} asChild>
          <PressableScale
            accessibilityRole="link"
            accessibilityLabel={`See all ${(lead ? `${lead} ${title}` : title).toLowerCase()}`}
            hitSlop={HEAD_SLOP}
            scaleTo={0.98}
            style={StyleSheet.flatten(styles.head)}>
            {text}
          </PressableScale>
        </Link>
      ) : (
        <View style={styles.head}>
          {text}
          {trailing}
        </View>
      )}

      {children}
    </Reveal>
  );
}

/** The chevron after a heading that leads somewhere: Apple's, a little under the words' cap height. */
const CHEVRON = 18;

/** One line of `h2` is 28dp; the slop above and below it reaches the tap floor. */
const HEAD_SLOP = {
  top: Math.ceil(Math.max(0, TapTarget - Type.h2.lineHeight) / 2),
  bottom: Math.ceil(Math.max(0, TapTarget - Type.h2.lineHeight) / 2),
  left: 0,
  right: 0,
};

const styles = StyleSheet.create({
  /* `x12` between the heading and what it heads: the cards under it are twelve
     apart from each other, and the heading is the first of that column. */
  section: { gap: Spacing.x12 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    paddingHorizontal: Spacing.x16,
  },
  headText: { flex: 1, gap: 2 },
  withAvatar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  /* The heading's size in the regular family: Android synthesises no weight
     for a custom font, so the lighter half is a family, not a `fontWeight`. */
  lead: { fontFamily: Typeface.regular },
});
