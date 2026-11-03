import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Spacing, TapTarget, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Loader } from '@/components/ui/loader';

/**
 * The pieces of an untyped Search tab drawn as sections — Reviews' "Popular
 * reviews" and "Latest reviews", Collections' "Most popular" and "Latest
 * collections": a heading, a way to the rest, and a section's own loading and
 * failure, so one section failing never takes the other down.
 */

/** A section's heading: one line of `h4`, and a quiet line under it if there is one. */
export function SectionHead({
  title,
  note,
  first = false,
}: {
  title: string;
  /** One quiet line — which languages the section is in. */
  note?: ReactNode;
  /** The first section starts under the tabs; the rest stand thirty-two apart. */
  first?: boolean;
}) {
  return (
    <View style={[styles.head, !first && styles.later]}>
      <Text variant="h4" accessibilityRole="header">
        {title}
      </Text>
      {note}
    </View>
  );
}

/** "See all … ›" under a preview of a chart, when the chart's heading cannot be the link. */
export function SeeAll({ href, label }: { href: Href; label: string }) {
  const theme = useTheme();
  return (
    <Link href={href} asChild>
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={label}
        hitSlop={SLOP}
        scaleTo={0.98}
        style={StyleSheet.flatten(styles.seeAll)}>
        <Text variant="bodySmall" color="textSecondary">
          {label}
        </Text>
        <Ionicons name="chevron-forward" size={12} color={theme.textSecondary} />
      </PressableScale>
    </Link>
  );
}

export function SectionLoading() {
  const theme = useTheme();
  return <Loader color={theme.textMuted} style={styles.loading} />;
}

/** A section that failed says so in place. */
export function SectionFailed({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <View style={styles.failed}>
      <Text variant="bodySmall" color="textMuted">
        {`Couldn’t load ${what}.`}
      </Text>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Try loading ${what} again`}
        onPress={onRetry}
        hitSlop={SLOP}
        scaleTo={0.94}>
        <Text variant="bodySmall" color="primaryText">
          Try again
        </Text>
      </PressableScale>
    </View>
  );
}

/** A section with nothing in it, said in a sentence where its cards would be. */
export function SectionEmpty({ children }: { children: string }) {
  return (
    <Text variant="body" color="textSecondary" style={styles.empty}>
      {children}
    </Text>
  );
}

/** The interval every list of cards keeps between them. */
export function CardGap() {
  return <View style={styles.cardGap} />;
}

/** One line of `bodySmall`, reached at the tap floor through slop. */
const SLOP = {
  top: Math.ceil(Math.max(0, TapTarget - Type.bodySmall.lineHeight) / 2),
  bottom: Math.ceil(Math.max(0, TapTarget - Type.bodySmall.lineHeight) / 2),
  left: Spacing.x8,
  right: Spacing.x8,
};

const styles = StyleSheet.create({
  /* `<ReviewChartHead>`'s own rhythm, so every heading on the tab matches it. */
  head: { gap: Spacing.x4, paddingTop: Spacing.x8, paddingBottom: Spacing.x16 },
  later: { paddingTop: Spacing.x32 },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.x4,
    paddingTop: Spacing.x12,
  },
  loading: { paddingVertical: Spacing.x16 },
  failed: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8, paddingTop: Spacing.x8 },
  empty: { paddingTop: Spacing.x4 },
  cardGap: { height: Spacing.x12 },
});
