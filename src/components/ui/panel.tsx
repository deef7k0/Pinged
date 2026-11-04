import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import Ionicons from '@expo/vector-icons/Ionicons';

import { CARD_INSET, cardShape, useCardMaterial, useCardless } from '@/components/ui/card-material';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal, useRevealing } from '@/components/ui/reveal';
import { useSectionInset } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';

export type PanelProps = {
  title: string;
  /** At the far end of the title's line: a count. */
  trailing?: ReactNode;
  /** Makes the whole card one button — a card that opens what it summarises. */
  onPress?: () => void;
  /** What the button is called. The title, when absent. */
  accessibilityLabel?: string;
  /**
   * The space outside the card, left and right. The section inset in force by
   * default; 0 where the parent already keeps one (two cards side by side).
   */
  margin?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * A small card that titles itself: the title inside it, a hairline, then what
 * it holds.
 *
 * ```text
 *   ╭ Ratings ──────── 128 ratings ╮
 *   │ ──────────────────────────── │
 *   │ …                            │
 *   ╰──────────────────────────────╯
 * ```
 *
 * A game's Overview has three of these — Ratings, and the two "Played by"
 * squares — from the owner's reference for it, a film's page in Letterboxd
 * (2026-10-09), in the review card's material like every card in the app
 * (`useCardMaterial`, 2026-10-20): its corner, its hairline, fifteen in, the
 * card shadow — and on a game's page the game's dark tone for a fill.
 *
 * ## It is not for rows of games
 *
 * For one build it was: every row of covers in the app sat in one of these,
 * heading and all, as the sections on Letterboxd's home do. The owner saw that
 * on a phone and had it undone — "remove the cards and leave the game's rails
 * on their own. They should not be inside a card." A row of games is a heading
 * on the page and its covers under it (`<HomeSection>` or `<Section>` over a
 * `<GameCoverRail>`). Do not give this a rail to hold.
 */
export function Panel({
  title,
  trailing,
  onPress,
  accessibilityLabel,
  margin,
  style,
  children,
}: PanelProps) {
  const accent = useAccent();
  const material = useCardMaterial();
  const sectionInset = useSectionInset();
  const revealing = useRevealing();
  /* On the Apple TV game page (`CardlessContext`) there is no card: the
     contents stand on the page under the page's own heading — "Ratings ›". */
  const cardless = useCardless();

  const shell = StyleSheet.flatten(
    cardless
      ? [{ marginHorizontal: margin ?? sectionInset, gap: Spacing.x8 }, style]
      : [
          cardShape,
          {
            marginHorizontal: margin ?? sectionInset,
            backgroundColor: material.fill,
            borderColor: material.edge,
            paddingHorizontal: CARD_INSET,
          },
          styles.shell,
          style,
        ]
  );

  const body = cardless ? (
    <>
      <View style={styles.head}>
        <View style={styles.tvTitle}>
          <Text variant="h2" numberOfLines={1} accessibilityRole="header" style={styles.tvWords}>
            {title}
          </Text>
          {onPress && <Ionicons name="chevron-forward" size={20} color={accent.quietInk} />}
        </View>
        {trailing}
      </View>
      {children}
    </>
  ) : (
    <>
      <View style={styles.head}>
        <Text
          variant="h5"
          numberOfLines={1}
          accessibilityRole="header"
          /* A long title in a half-width card gives up a little size before it
             gives up its last word. */
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={styles.title}>
          {title}
        </Text>
        {trailing}
      </View>
      <View style={[styles.rule, { backgroundColor: accent.m3.outlineVariant }]} />
      {children}
    </>
  );

  /* A `<Reveal>`: on a page that opts in (`<RevealScope>`, a game's
     Overview) the card rises into place as it scrolls into view. A card that
     is a door keeps its press on the card itself, so the reveal goes round it
     there — and only there, where a box round it costs nothing. */
  if (!onPress) {
    return <Reveal style={shell}>{body}</Reveal>;
  }

  const door = (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      scaleTo={0.98}
      style={shell}>
      {body}
    </PressableScale>
  );
  return revealing ? <Reveal>{door}</Reveal> : door;
}

/** Between two of these side by side, or one under another: as cards stack everywhere. */
export const PANEL_GAP = Spacing.x12;

const styles = StyleSheet.create({
  shell: { paddingTop: Spacing.x12, paddingBottom: CARD_INSET },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8, minHeight: 24 },
  /* Takes the line, so whatever follows it sits at the far end. */
  title: { flex: 1 },
  tvTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2 },
  tvWords: { flexShrink: 1 },
  rule: { height: StyleSheet.hairlineWidth, marginTop: Spacing.x8, marginBottom: Spacing.x12 },
});
