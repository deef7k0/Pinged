import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Spacing, TapTarget, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type IconName = keyof typeof Ionicons.glyphMap;

export type ProfileWidgetProps = {
  title: string;
  /**
   * Words set after the title in the quieter ink: "Ada" + "’s games". The
   * name is what the eye lands on; the rest says what of theirs this is.
   */
  tail?: string;
  /** A small glyph before the title, in the accent's legible form. */
  icon?: IconName;
  /** At the far end of the title's line: "Edit", a credit mark. */
  action?: ReactNode;
  /**
   * Where the widget leads, when what it holds is a glimpse of something with
   * a screen of its own. The title's line becomes the way there and ends in
   * "View all", in place of an `action`.
   */
  href?: Href;
  /** What the title's link is called, when it is one. */
  accessibilityLabel?: string;
  children: ReactNode;
};

/**
 * A widget on the profile — the favourites, the games, the pinned song, the
 * ratings — as an Apple shelf (the Apple pass, 2026-11-04): its heading in
 * `h2`, and where it leads somewhere a chevron straight after the words, the
 * whole line the door. It was a hairline over a 13pt heading with a small
 * "View all ›" at the far end.
 *
 * ## Not a card
 *
 * These are sections of the profile, not objects floating on it; their own
 * space separates them, and a row of covers keeps the full width of the
 * page. For about a week each was a card (`<ProfileBox>`), and the owner went
 * back (2026-10-12). **Do not box them.**
 */
export function ProfileWidget({
  title,
  tail,
  icon,
  action,
  href,
  accessibilityLabel,
  children,
}: ProfileWidgetProps) {
  const theme = useTheme();

  const heading = (
    <View style={styles.title}>
      {icon && <Ionicons name={icon} size={18} color={theme.text} />}
      <Text variant="h2" numberOfLines={1} accessibilityRole="header" style={styles.words}>
        {title}
        {tail && (
          <Text variant="h2" color="textSecondary">
            {tail}
          </Text>
        )}
      </Text>
      {href && <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />}
    </View>
  );

  return (
    <View style={styles.widget}>
      {href ? (
        <Link href={href} asChild>
          <PressableScale
            accessibilityRole="link"
            accessibilityLabel={accessibilityLabel ?? `${title}${tail ?? ''}. View all.`}
            hitSlop={HEAD_SLOP}
            scaleTo={0.98}
            style={StyleSheet.flatten(styles.head)}>
            {heading}
          </PressableScale>
        </Link>
      ) : (
        <View style={styles.head}>
          {heading}
          {action}
        </View>
      )}

      {children}
    </View>
  );
}

/** One line of `h2`; the slop above and below it reaches the tap floor. */
const HEAD_SLOP = {
  top: Math.ceil(Math.max(0, TapTarget - Type.h2.lineHeight) / 2),
  bottom: Math.ceil(Math.max(0, TapTarget - Type.h2.lineHeight) / 2),
  left: 0,
  right: 0,
};

const styles = StyleSheet.create({
  /* Twelve above, twelve from the heading to what it heads. */
  widget: { gap: Spacing.x12, paddingTop: Spacing.x12 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.x8,
  },
  /* Shrinks on a long display name; the chevron hugs the words. */
  title: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
  words: { flexShrink: 1 },
});
