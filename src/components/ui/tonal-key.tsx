import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { PressGlyph } from '@/components/ui/press-glyph';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Elevation, Radius, Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { filledRoles } from '@/lib/filled';

/**
 * Where a key sits in its group, which is the only thing that decides its shape.
 *
 * `solo` exists because a group can be built from a list that shortens — if it
 * ever came down to one key, a lone half-round shape would look like a
 * rendering fault rather than a button.
 */
export type KeyPosition = 'start' | 'middle' | 'end' | 'solo';

/**
 * The corner where two keys meet, and the gap they meet across — Material 3's
 * connected button group: only the *outer* edges of the group are round,
 * because they are the edges of the object; every internal edge is nearly
 * square, so two keys across a 4dp gap read as a seam in one bar.
 */
const GROUP_END = Radius.pill;
const GROUP_SEAM = Radius.lg;
export const KEY_GROUP_GAP = Spacing.x4;

/** 52: past both tap floors with the glyph as the whole control. */
export const KEY_HEIGHT = 52;

export function keyCorners(position: KeyPosition) {
  const start = position === 'start' || position === 'solo';
  const end = position === 'end' || position === 'solo';
  return {
    borderTopLeftRadius: start ? GROUP_END : GROUP_SEAM,
    borderBottomLeftRadius: start ? GROUP_END : GROUP_SEAM,
    borderTopRightRadius: end ? GROUP_END : GROUP_SEAM,
    borderBottomRightRadius: end ? GROUP_END : GROUP_SEAM,
  };
}

/** A key's place in a group of `count`, by its index. */
export function keyPosition(index: number, count: number): KeyPosition {
  if (count === 1) return 'solo';
  if (index === 0) return 'start';
  if (index === count - 1) return 'end';
  return 'middle';
}

/**
 * One key of a game's own action group — the game page's Favourite /
 * Wishlist / Progress / Collect, and Surprise Me's Backlog / Next, which are
 * the same object by the owner's direction (2026-10-16).
 *
 * Off, it is the page's neutral `surfaceContainerHigh` with an outline glyph
 * in `onSurfaceVariant` — no colour until it has been used. On, it fills with
 * the game's colour, as the review button is, and its glyph turns solid in
 * the fill's own `onPrimary` (`filledRoles`) — SimpMusic's rule, the owner's
 * direction (2026-10-17). It was `primaryContainer`, a dark tone of the hue.
 * A key that is an act rather than a state carries no `active` and never
 * lights — and announces no selected state, which for an act would be a
 * permanent "not selected".
 *
 * `caption` prints one short word beside the glyph. Keys are glyphs alone by
 * design; the caption is for the one key whose glyph cannot say what it does
 * yet — the game page's progress key before there is a log, a bare "+"
 * beside Collect's stack (the owner's ruling, 2026-10-21: "label it until
 * logged").
 */
export function TonalKey({
  icon,
  outline,
  active,
  busy = false,
  label,
  caption,
  onPress,
  position,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  /** The glyph at rest; `icon` once lit. Defaults to `icon`. */
  outline?: keyof typeof Ionicons.glyphMap;
  /** On or off, for a key that is a state. Omitted for an act. */
  active?: boolean;
  busy?: boolean;
  label: string;
  /** A short printed word beside the glyph. */
  caption?: string;
  onPress: () => void;
  position: KeyPosition;
  style?: StyleProp<ViewStyle>;
}) {
  const accent = useAccent();
  const filled = filledRoles(accent);
  const lit = active === true;
  const ink = lit ? filled.ink : accent.m3.onSurfaceVariant;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={
        active === undefined ? { busy, disabled: busy } : { selected: lit, busy, disabled: busy }
      }
      disabled={busy}
      onPress={onPress}
      scaleTo={0.95}
      style={StyleSheet.flatten([
        styles.key,
        keyCorners(position),
        /* Raised when lit: a solid block of the accent where depth is the only
           edge it has. */
        lit ? Elevation.raised : Elevation.none,
        {
          backgroundColor: lit ? filled.fill : accent.m3.surfaceContainerHigh,
          borderColor: lit ? filled.fill : accent.m3.surfaceContainerHigh,
        },
        caption ? styles.captioned : null,
        busy && styles.busy,
        style,
      ])}>
      {/* Favourite and Wishlist pop as they turn on or off (Convx's like). */}
      <PressGlyph pop={active === undefined ? undefined : lit}>
        <Ionicons name={lit ? icon : (outline ?? icon)} size={caption ? 20 : 22} color={ink} />
      </PressGlyph>
      {caption && (
        <Text variant="tab" numberOfLines={1} style={{ color: ink }}>
          {caption}
        </Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  key: {
    minHeight: KEY_HEIGHT,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Glyph and word side by side, as Material's icon button with a label. */
  captioned: { flexDirection: 'row', gap: Spacing.x4, paddingHorizontal: Spacing.x8 },
  /* A brief dim rather than a spinner: one round trip. */
  busy: { opacity: 0.5 },
});
