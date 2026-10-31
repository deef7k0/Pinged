import type Ionicons from '@expo/vector-icons/Ionicons';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { PaintFill, PaintGlyph, inkTransition } from '@/components/ui/paint-fill';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import {
  ControlHeight,
  Radius,
  SmallControlSlop,
  Spacing,
  TapTarget,
  Type,
  withAlpha,
} from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import { readableInk } from '@/lib/color';

export type TabItem<T extends string> = {
  key: T;
  label: string;
  /** Optional leading glyph. */
  icon?: keyof typeof Ionicons.glyphMap;
  /**
   * Optional trailing count, set inline after the label.
   *
   * Neutral, not a badge: "ALL GAMES 135" is a *size*, and the overwhelming
   * majority of counts on a tab are. A red badge means "there is something here
   * you have not seen", which is a different claim — pass `alert` for that.
   */
  count?: number | null;
  /**
   * Render the count as an unread badge instead of an inline number.
   *
   * For genuinely new things — pending friend requests, unread replies. Rare
   * enough to be opt-in, because a library that says 135 in red is shouting at
   * someone about their own shelf.
   */
  alert?: boolean;
};

export type TabBarProps<T extends string> = {
  tabs: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /**
   * What this set of tabs is choosing between — "What to search", "Library view".
   *
   * Read out before the tabs themselves, so a screen-reader user is told what
   * the row decides rather than just hearing four words in a line.
   */
  label?: string;
  /**
   * Draw the glyph and drop the printed word.
   *
   * Every tab must still carry an `icon` and a `label`: the label becomes the
   * accessible name, so a screen reader hears "Collections, tab 2 of 4" exactly
   * as it did before. Only sighted readers lose the word.
   *
   * **That loss is real** — an icon strip is recognition rather than reading,
   * and it is only affordable where the glyphs are conventions the reader has
   * already met. Use it where the set is small, stable and iconic; a row of five
   * invented marks is a puzzle, not a control.
   *
   * The row also stops scrolling in this mode and divides the width evenly.
   * Glyphs are all the same size, so there is nothing to scroll for, and an
   * icon strip that ran off the edge would hide a destination behind a gesture
   * with nothing to suggest it.
   */
  iconOnly?: boolean;
  /**
   * Where a short row sits when it does not fill the width.
   *
   * `start` (the default) is right for a bar that is one of several things on a
   * line, and for any row long enough to scroll — a centred row that overflows
   * would start mid-label.
   *
   * `center` is for a bar that is *the* control on its own line and has too few
   * tabs to reach the edges. Centring costs nothing when the content overflows —
   * `flexGrow` only has slack to distribute when there is slack. (The game page
   * used it, after left-aligned it read as a row that had lost something; it
   * uses `spread` now.)
   *
   * `spread` shares the row out: every tab the same width, the first on the
   * left margin, the last on the right, 4 apart — taller than a chip, with a
   * larger label. The game page's three, at the owner's direction (2026-10-15):
   * first "overview touches the left margin and similar touches the right
   * margin", then, seeing chips at their own widths with wide gaps between,
   * "too small and far apart… big enough so they barely touch and it doesnt
   * scroll and its alligned perfectly". It does not scroll, so it is for a few
   * short labels that always fit.
   */
  align?: 'start' | 'center' | 'spread';
  /**
   * How far in from the screen's edge the row starts and ends, when the screen
   * it is on does not keep the app's 15.
   *
   * The first pill lines up with the page's content, and on every screen but
   * one that is the app's margin — the default. The profile keeps a margin of
   * its own (`PROFILE_MARGIN`), so its tab row has to as well.
   */
  inset?: number;
};

/**
 * Horizontal tabs, shared by every screen that switches between views — drawn
 * as SimpMusic draws its top bar's tabs, at the owner's direction (2026-10-15:
 * "make the tabs in the app like simpmusic… the style of the tabs that
 * simpmusic uses on the top bar").
 *
 * Read from its source, not its screenshots: `ui/component/ChipGroup.kt`
 * (`Chip`, an `ElevatedFilterChip`) and the rows under the top bars of
 * `HomeScreen.kt`, `LibraryScreen.kt` and `SearchScreen.kt`. So:
 *
 * - **A full pill, 32 high, 16 at each side** — Material's filter chip.
 * - **Unselected: no fill at all, a 1dp `outlineVariant` edge, the label in
 *   `onSurfaceVariant`.** No fill because the row mostly sits over a page or
 *   artwork, where a solid pill reads as a slab punched over it; the edge is
 *   what carries the shape.
 * - **Selected: a solid `primary` fill and its `onPrimary` label, no check.**
 *   The solid against the see-through is the selection, filled versus empty,
 *   so it survives without colour vision; a check would widen the chosen chip
 *   and shove the row sideways under the finger. **The fill pours** in from
 *   the chip's middle (`<PaintFill>`) — the owner's rule for every control that
 *   goes from an outline to solid (2026-10-15) — and drains from the one left.
 * - **The label is Material's `labelLarge`**: 14, medium, sentence case.
 * - **4 apart, 15 in from the edge**, scrolling when it overflows.
 *
 * The roles are the accent's own M3 set (`accent.m3`): the house blue's off a
 * game's screens, the game's palette on them — as SimpMusic's are its seed's.
 *
 * **This replaced a wash and caps.** The selected tab was a 14% wash of the
 * accent with its label in the accent, every other tab bare muted type, and
 * every label uppercase and tracked out. The underline before that is gone for
 * the reason it always was: a rule needs an edge to sit on.
 */
export function TabBar<T extends string>({
  tabs,
  value,
  onChange,
  label,
  iconOnly = false,
  align = 'start',
  inset,
}: TabBarProps<T>) {
  const theme = useTheme();
  const accent = useAccent();

  const { m3 } = accent;
  const reduceMotion = useReducedMotion();
  const fill = align === 'spread' && !iconOnly;
  const items = tabs.map((tab, index) => {
    const active = tab.key === value;
    const showCount = tab.count != null && tab.count > 0;
    const ink = active ? m3.onPrimary : m3.onSurfaceVariant;

    return (
      <PressableScale
        key={tab.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={showCount ? `${tab.label}, ${tab.count}` : tab.label}
        /* Position has to be spoken explicitly: a horizontal `ScrollView`
           is not a list, so nothing derives "2 of 4" on its own. */
        accessibilityHint={`${index + 1} of ${tabs.length}`}
        onPress={() => onChange(tab.key)}
        /* Drawn at the reference's chip height, touched at the floor. */
        hitSlop={iconOnly ? undefined : fill ? FILL_SLOP : SmallControlSlop}
        scaleTo={0.95}
        pressedColor={active ? accent.pressed : theme.pressed}
        focusRing={accent.ring}
        style={StyleSheet.flatten([
          styles.tab,
          iconOnly && styles.tabIcon,
          fill && styles.tabFill,
          /* The fill is poured, not set (`<PaintFill>`): the chip itself stays
             clear, and its edge takes the fill's colour once chosen so the two
             meet without a seam. The explicit `transparent` is what the press
             fill eases in from. */
          {
            backgroundColor: 'transparent',
            borderColor: active ? m3.primary : m3.outlineVariant,
          },
        ])}>
        <PaintFill on={active} color={m3.primary} />
        {tab.icon && <PaintGlyph name={tab.icon} size={iconOnly ? 22 : 15} color={ink} />}

        {!iconOnly && (
          <Animated.Text
            style={[
              Type.tab,
              fill && styles.labelFill,
              { color: ink },
              inkTransition(reduceMotion),
            ]}
            numberOfLines={1}>
            {tab.label}
          </Animated.Text>
        )}

        {!iconOnly &&
          showCount &&
          (tab.alert ? (
            <View style={[styles.badge, { backgroundColor: theme.danger }]}>
              {/* Ink measured against the red: dark, at 5.74:1. White on this
                  red is 3.36:1, under AA at the 10px a count is set in. */}
              <Text variant="caption" style={{ color: readableInk(theme.danger) }}>
                {tab.count! > 99 ? '99+' : tab.count}
              </Text>
            </View>
          ) : (
            /* One step quieter than its own label in both states, so the
               number never competes with the word it belongs to. */
            <Text variant="caption" style={[styles.count, { color: withAlpha(ink, 0.72) }]}>
              {tab.count}
            </Text>
          ))}
      </PressableScale>
    );
  });

  const edge = inset === undefined ? undefined : { paddingHorizontal: inset };

  /* A plain row, not a scroller: a fixed set spread edge to edge. */
  if (align === 'spread' && !iconOnly) {
    return (
      <View
        style={[styles.content, styles.contentBetween, edge]}
        accessibilityRole="tablist"
        accessibilityLabel={label}>
        {items}
      </View>
    );
  }

  /* A plain row, not a scroller. See the note on `iconOnly`. */
  if (iconOnly) {
    return (
      <View
        style={[styles.content, styles.contentSpread, edge]}
        accessibilityRole="tablist"
        accessibilityLabel={label}>
        {items}
      </View>
    );
  }

  return (
    /*
     * `tablist` on the container, and it is not decoration.
     *
     * Every pill already carried `role="tab"` and its selected state, but with
     * no set around them VoiceOver and TalkBack cannot say "tab 2 of 4" — the
     * reader got four buttons, one of which claimed to be selected, with nothing
     * saying what it was selected *out of*. This is the app's only in-page tab
     * implementation, so the role belongs here rather than at each call site.
     */
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      /* **Never let this grow.** A `ScrollView` is `flexGrow: 1` out of the box
         — a horizontal one too — so in a column it takes a share of whatever
         height is spare. Above a list long enough to fill the screen there is
         none and the row is its 48; above anything shorter, or anything that
         is `flex: 1` itself, the row took half the screen and pushed the
         content into what was left. That was Search with nothing typed, and
         every tab whose list had not filled yet. See CLAUDE.md § Gotchas. */
      style={styles.scroller}
      /* A tab is tapped with a keyboard up on Search, where the row sits under
         a focused field. Without this the first tap only puts the keyboard
         away and the tab needs a second. */
      keyboardShouldPersistTaps="handled"
      accessibilityRole="tablist"
      accessibilityLabel={label}
      contentContainerStyle={[styles.content, align === 'center' && styles.contentCenter, edge]}>
      {items}
    </ScrollView>
  );
}

/** `align="spread"`'s tab height: a step over the 32 chip. */
const FILL_HEIGHT = 40;

/** Up to Android's 48 from 40, above and below. */
const FILL_SLOP = { top: 4, bottom: 4, left: 0, right: 0 };

const styles = StyleSheet.create({
  /* As tall as its pills, and no taller — see the note on the scroller. */
  scroller: { flexGrow: 0 },
  /* No wrapper and no hairline. The bar sits directly on whatever is behind it
     — page, artwork, a blurred header — and the pill is what carries selection,
     so the divider the underline needed is gone with it.

     SimpMusic's chip row (`LibraryScreen.kt`, `HomeScreen.kt`): 15 in from the
     edge, so the first pill lines up with the page's content, 8 above and
     below, 4 between. */
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x4,
    paddingHorizontal: Spacing.x16,
    paddingVertical: Spacing.x8,
  },
  /* Evenly divided rather than scrolled, for `iconOnly`. */
  contentSpread: { alignSelf: 'stretch' },
  /* `flexGrow`, not `width: '100%'`. The content container of a horizontal
     ScrollView is sized by its children; growing it to the viewport gives
     `justifyContent` something to centre *within*, and when the pills are wider
     than the screen there is no slack and the row scrolls from its start exactly
     as it did before. */
  contentCenter: { flexGrow: 1, justifyContent: 'center' },
  /* `align="spread"`: no slack anywhere — the tabs take the row between them. */
  contentBetween: { alignSelf: 'stretch' },
  /* One equal share of the row each, 40 high: a tab that is the page's main
     control, not a chip in a scrolling strip. */
  tabFill: {
    flex: 1,
    justifyContent: 'center',
    minHeight: FILL_HEIGHT,
    paddingHorizontal: Spacing.x8,
  },
  /* A step over the chip's 14, with its own line so Android does not clip it. */
  labelFill: { fontSize: 15, lineHeight: 20 },
  /* The reference's chip: 32 drawn and 16 at the sides (Material's filter
     chip, which SimpMusic draws every row of choices with). It reaches the tap
     floor through `SmallControlSlop`, vertically — the row's own 8 above and
     below is room for it. */
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    paddingVertical: Spacing.x4,
    /* 16 at each side, less the edge, as Material measures it from outside. */
    paddingHorizontal: Spacing.x16 - 1,
    minHeight: ControlHeight.small,
    borderWidth: 1,
    /* The poured fill is clipped to the pill. */
    overflow: 'hidden',
    /* `pill`, not `control`. A tab is not a button — it is a position in a set,
       and the fully-round end is what distinguishes "where you are" from "what
       you can press". Same reasoning that keeps `<Chip>` a pill. */
    borderRadius: Radius.pill,
  },
  /* Each glyph takes an equal share of the row and centres in it, so four
     destinations sit on a rhythm rather than at four label-driven widths. */
  tabIcon: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.x8,
    /* A glyph strip has no word to size it, so it stays at the floor. */
    minHeight: TapTarget,
  },
  count: { letterSpacing: 0.3 },
  badge: {
    minWidth: 18,
    paddingHorizontal: Spacing.x4,
    paddingVertical: 1,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
