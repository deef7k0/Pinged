import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { CARD_INSET, cardShape, useCardMaterial } from '@/components/ui/card-material';
import { Shimmer } from '@/components/ui/shimmer';
import { Text } from '@/components/ui/text';
import { labelFor, scoreColor } from '@/constants/score';
import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export type CardProps = {
  children: ReactNode;
  /**
   * `elevated` puts the card on `surfaceElevated` instead of its usual fill —
   * for a card that sits *on* another card, where the same fill would disappear.
   */
  elevated?: boolean;
  padded?: boolean;
  /**
   * Lands on the **outer** view — the fill, the edge and the shadow — whose
   * only child is the inner view that clips and holds `children`. Padding and
   * margins work here; layout does not. `flexDirection`, `gap` and
   * `alignItems` arrange that one inner view and nothing you passed, so a row
   * set here renders as a column. Put a `<View>` carrying the layout inside
   * the card instead.
   */
  style?: ViewStyle | ViewStyle[];
};

/**
 * A modular block of content, made of the review card's material
 * (`useCardMaterial`): one flat fill a step above the page, `Radius.review`'s
 * corner, a 1dp hairline in `border`, the card shadow, fifteen in.
 *
 * It was a corner of 16 with no edge — "an edge is what marks something
 * pressable" — and the owner had every card made the review card's
 * (2026-10-20): "with the same size and corner ratio and stuff". The edge is
 * the review card's hairline, white at 7%; a *control*'s edge is `outline`,
 * at 16%, so the two still read as different things.
 *
 * On a game's page the fill is the game's own dark tone, as every card there
 * is; elsewhere `surface`. A card that needs different numbers is a different
 * component.
 */
export function Card({ children, elevated = false, padded = true, style }: CardProps) {
  const theme = useTheme();
  const material = useCardMaterial();

  /*
   * Two views on purpose. Android's `elevation` is clipped by `overflow:
   * 'hidden'`, and the card needs that clip to round whatever it contains — so
   * the outer view owns the fill, the edge and the shadow, and the inner one
   * does the clipping. Collapsing these back into one view silently drops the
   * shadow on Android only. See DESIGN.md § 6.3.
   *
   * The inner corner is the outer one less the edge, so the art a card clips
   * meets the hairline without a sliver of fill between them.
   */
  return (
    <View
      style={[
        cardShape,
        {
          backgroundColor: elevated ? theme.surfaceElevated : material.fill,
          borderColor: material.edge,
        },
        style,
      ]}>
      <View style={[styles.cardClip, padded && styles.cardPadded]}>{children}</View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Chip
// ---------------------------------------------------------------------------

export type ChipProps = {
  label: string;
  /**
   * `active` fills with a wash of the accent and takes the accent's text — for
   * a chip that is *on*, not for one that merely matters.
   */
  tone?: 'neutral' | 'active';
  /** Leading glyph, usually an icon or an emoji. */
  icon?: ReactNode;
  /**
   * Override the chip's ink with a specific colour — a status, a rarity, a
   * platform's own brand.
   *
   * The *label* takes the colour; the fill stays a neutral surface step. That
   * asymmetry is the rule for every coloured chip in the app: a run of filled
   * colour capsules reads as a row of buttons demanding to be pressed, and
   * chips are not buttons. The pill shape is already saying "metadata" — the
   * colour only has to say *which*.
   */
  color?: string | null;
};

/**
 * The metadata capsule: `📅 Played`, `⏱ 45h`, `🏁 Completed`.
 *
 * Chips are how this app stays information-dense without shrinking anything —
 * six facts in two rows of capsules are scannable in a way that six lines of
 * small grey text are not. 34px tall with 14px of horizontal padding, fully
 * rounded, on `surfaceSelected`.
 *
 * They are not buttons. Nothing here has a press state unless a caller wraps it
 * in one, and the missing edge is what says so: a filter pill is the same shape
 * with a 1px border, because a filter can be pressed and a fact cannot.
 *
 * No shadow. It is one surface step lighter than any card it sits on, which is
 * enough to read as a tag rather than a hole.
 */
export function Chip({ label, tone = 'neutral', icon, color }: ChipProps) {
  const theme = useTheme();
  const accent = useAccent();
  const active = tone === 'active';

  /* An explicit colour wins over `active`, because it is the more specific
     claim: "this chip is Legendary" outranks "this chip is selected". */
  const ink = color ?? (active ? accent.onSurface : theme.textSecondary);

  return (
    <View style={[styles.chip, { backgroundColor: active ? accent.wash : theme.surfaceSelected }]}>
      {icon}
      <Text variant="bodySmall" style={{ color: ink }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// SectionHeader
// ---------------------------------------------------------------------------

export type SectionHeaderProps = {
  title: string;
  /** Right-aligned affordance, typically a "See all" link. */
  action?: ReactNode;
};

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      {/* `role="header"` is what puts these in the rotor. Without it a screen
          reader has no way past a twelve-section page except swiping through
          every paragraph of it — which on the game page means the whole IGDB
          synopsis before you reach Screenshots.

          `numberOfLines` because the title is not always ours: the game page
          passes IGDB's collection name straight in, beside an action, in a
          `space-between` row that has no other way to yield. */}
      <Text variant="h4" accessibilityRole="header" numberOfLines={2} style={styles.sectionTitle}>
        {title}
      </Text>
      {action}
    </View>
  );
}

// ---------------------------------------------------------------------------
// ScoreBadge
// ---------------------------------------------------------------------------

/**
 * Community score, 0-100, as a bare coloured numeral.
 *
 * No box. The verdict colour and the digits carry it, and wrapping two
 * characters in an outlined capsule made a number look like a control you could
 * press. See `ScoreNumber` in `ui/score` — this is the same idea sized for a
 * metadata row.
 *
 * The colour comes from `scoreColor` rather than an inline ramp. It used to
 * carry its own copy on identical thresholds, which is how the app ended up
 * showing a 55 as amber here and blue in a review masthead.
 */
export function ScoreBadge({
  score,
  size = 'medium',
}: {
  score: number;
  size?: 'small' | 'medium';
}) {
  const theme = useTheme();

  const rounded = Math.round(score);

  return (
    <Text
      variant={size === 'small' ? 'bodySmall' : 'h5'}
      /* Two digits announce as two digits. `<ScoreNumber>` two elements away on
         the same page says "Scored 82 out of 100 — Very Good"; this said "82",
         and the word beside it ("COMMUNITY") arrived as a separate node with no
         stated relationship to it. */
      accessibilityLabel={`${rounded} out of 100 — ${labelFor(rounded)}`}
      style={{ color: scoreColor(score, theme) }}>
      {rounded}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

/**
 * A placeholder block for a loading state, shimmering.
 *
 * **It was deliberately static**, on this argument: "a shimmer across a whole
 * search list costs more in dropped frames than it gains in perceived speed."
 * That was right about the cost and the cost has moved — `<Shimmer>` is a
 * Reanimated CSS animation on the UI thread, so a list of thirty of them
 * neither slows the JS thread nor is slowed by it. The sweep is SimpMusic's,
 * measured (`ui/shimmer`, and `skeletonSweep` for the light), at the owner's
 * direction (2026-10-22: "use simpmusic way of loading things, animations and
 * skeletons").
 *
 * Skeletons everywhere, still — a spinner tells you to wait, a skeleton tells
 * you what is coming — and a skeleton that lies about its size is worse than
 * none, because the page commits to a layout it is about to abandon.
 */
export function Skeleton({
  width,
  height,
  radius = Radius.image,
}: {
  width: number | `${number}%`;
  height: number;
  radius?: number;
}) {
  return <Shimmer radius={radius} style={{ width, height }} />;
}

const styles = StyleSheet.create({
  /* The clip, inside the edge — Android's elevation is on the outer view, which
     must not clip, or the shadow is cut off. */
  cardClip: { borderRadius: Radius.review - 1, overflow: 'hidden' },
  cardPadded: { padding: CARD_INSET },
  /* `minHeight`, not `height`.
     
     React Native scales text with the OS font-size setting by default, and a
     fixed 34 could not grow with it — at the larger accessibility sizes the
     label clipped inside its own capsule. The floor keeps every chip the same
     34 at the default setting, which is what the row's rhythm depends on, and
     lets the capsule grow instead of the text being cut. The vertical padding
     is what gives it somewhere to grow to. */
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    minHeight: 34,
    paddingVertical: Spacing.x4,
    paddingHorizontal: Spacing.x12 + 2,
    borderRadius: Radius.pill,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.x12,
  },
  /* Shrinks rather than pushing its own action off the row. */
  sectionTitle: { flexShrink: 1 },
});

export type { ThemeColor };
