import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { IconButton } from '@/components/ui/icon-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { useSelectable } from '@/components/ui/selectable';
import { Text } from '@/components/ui/text';
import { ControlHeight, Radius, SmallControlSlop, Spacing, Type } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import { clampPage, pagerSlots, type PagerSlot } from '@/lib/games/paging';
import { Loader } from '@/components/ui/loader';

export type PagerProps = {
  /** The page on screen, 1-based. */
  page: number;
  /** How many pages there are, or null while that is still being counted. */
  pageCount: number | null;
  /**
   * Whether there is a page after this one, for the time the count is unknown:
   * a full page implies another. Ignored once `pageCount` is a number.
   */
  hasNext?: boolean;
  onChange: (page: number) => void;
  /**
   * A line under the numbers — "Page 5 of 512" and a field to jump to any page.
   * Off for a second pager at the foot of a list, which is only there to turn
   * the page.
   */
  detail?: boolean;
  /** Said after the page count: "5,120 games". */
  summary?: string | null;
};

/** The slots while the count is unknown: the first page, and the ones in reach. */
function openEndedSlots(page: number, hasNext: boolean): PagerSlot[] {
  const pages = new Set<number>([1, Math.max(1, page - 1), page]);
  if (hasNext) pages.add(page + 1);
  const ordered = [...pages].sort((a, b) => a - b);

  const slots: PagerSlot[] = [];
  ordered.forEach((value, index) => {
    const previous = ordered[index - 1];
    if (previous !== undefined && value - previous > 1) {
      slots.push({ kind: 'gap', key: `gap-${previous}` });
    }
    slots.push({ kind: 'page', page: value });
  });
  if (hasNext) slots.push({ kind: 'gap', key: 'gap-end' });
  return slots;
}

/**
 * Pages of a list too long to scroll: previous, next, the numbers around where
 * you are, and a way to any page by number.
 *
 * A platform's catalogue can be tens of thousands of games. Scrolling that is
 * not a way to reach anything, and "load more" has no middle — so it is pages,
 * ten games each, and this is how you move between them:
 *
 *  - **the arrows** turn one page;
 *  - **the numbers** are the first page, the last, and the ones either side of
 *    the current one (`pagerSlots`) — the current one in the app's selected
 *    state, since it is the one of these that is chosen;
 *  - **the field** takes any number. A gap in the row cannot be tapped to a
 *    particular page, and page 317 of 512 is forty presses of the arrow away.
 *
 * ## While the pages are still being counted
 *
 * The count can take a few seconds (`countGames`), and the first page does not
 * wait for it. Until it lands the row shows the pages in reach and says
 * "Page 3 of …" beside a spinner; the arrows and the field already work, and
 * `hasNext` — the page on screen is full — is what keeps Next alive.
 *
 * The numbers are choices, so they are outlined pills at the chip's 32, lifted
 * to the touch floor by slop. The arrows are actions, so they are the filled
 * round key. DESIGN.md § 9.
 */
export function Pager({
  page,
  pageCount,
  hasNext = false,
  onChange,
  detail = true,
  summary,
}: PagerProps) {
  const theme = useTheme();
  const accent = useAccent();
  const selectable = useSelectable();
  const [draft, setDraft] = useState('');

  const known = pageCount !== null;
  const last = known ? pageCount : null;
  const slots = known ? pagerSlots(page, pageCount) : openEndedSlots(page, hasNext);
  const canGoBack = page > 1;
  const canGoForward = known ? page < pageCount : hasNext;

  function go(target: number) {
    /* Unbounded above while the count is unknown: an empty page says so itself. */
    const next = known ? clampPage(target, pageCount) : Math.max(1, Math.trunc(target) || 1);
    if (next !== page) onChange(next);
  }

  function submitDraft() {
    const typed = Number(draft.trim());
    setDraft('');
    if (Number.isFinite(typed) && typed >= 1) go(typed);
  }

  return (
    <View style={styles.pager} accessibilityRole="toolbar" accessibilityLabel="Pages">
      <View style={styles.row}>
        <IconButton
          icon="chevron-back"
          accessibilityLabel="Previous page"
          size="small"
          disabled={!canGoBack}
          onPress={() => go(page - 1)}
        />

        {/* A scroller only so a row of four-digit pages on a narrow phone has
            somewhere to go; `flexGrow` centres it whenever it fits, which is
            nearly always. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={styles.numbers}
          contentContainerStyle={styles.numbersContent}>
          {slots.map((slot) => {
            if (slot.kind === 'gap') {
              return (
                <Text
                  key={slot.key}
                  variant="bodySmall"
                  color="textMuted"
                  style={styles.gap}
                  accessibilityElementsHidden
                  importantForAccessibility="no">
                  …
                </Text>
              );
            }

            const current = slot.page === page;
            const look = selectable(current);
            return (
              <PressableScale
                key={slot.page}
                accessibilityRole="button"
                accessibilityState={{ selected: current }}
                accessibilityLabel={
                  current
                    ? `Page ${slot.page}, the current page`
                    : slot.page === last
                      ? `Page ${slot.page}, the last page`
                      : `Page ${slot.page}`
                }
                disabled={current}
                onPress={() => go(slot.page)}
                hitSlop={SmallControlSlop}
                scaleTo={0.92}
                pressedColor={look.pressedColor}
                focusRing={look.focusRing}
                style={StyleSheet.flatten([styles.number, look.style])}>
                <Text variant="bodySmall" color={look.label} style={styles.numberText}>
                  {slot.page.toLocaleString()}
                </Text>
              </PressableScale>
            );
          })}
        </ScrollView>

        <IconButton
          icon="chevron-forward"
          accessibilityLabel="Next page"
          size="small"
          disabled={!canGoForward}
          onPress={() => go(page + 1)}
        />
      </View>

      {detail && (
        <View style={styles.detail}>
          <View style={styles.status} accessible accessibilityLiveRegion="polite">
            <Text variant="bodySmall" color="textSecondary">
              {known
                ? `Page ${page.toLocaleString()} of ${pageCount.toLocaleString()}`
                : `Page ${page.toLocaleString()} of …`}
              {known && summary ? ` · ${summary}` : ''}
            </Text>
            {!known && <Loader size="small" color={theme.textMuted} />}
          </View>

          <View style={styles.jump}>
            <Text variant="bodySmall" color="textMuted">
              Go to
            </Text>
            <TextInput
              value={draft}
              onChangeText={(text) => setDraft(text.replace(/[^0-9]/g, '').slice(0, 7))}
              onSubmitEditing={submitDraft}
              onBlur={submitDraft}
              keyboardType="number-pad"
              returnKeyType="go"
              inputMode="numeric"
              placeholder="page"
              placeholderTextColor={theme.textMuted}
              selectionColor={accent.onSurface}
              accessibilityLabel={
                known ? `Go to a page, 1 to ${pageCount}` : 'Go to a page by number'
              }
              style={[styles.jumpField, { backgroundColor: theme.input, color: theme.text }]}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pager: { gap: Spacing.x8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  numbers: { flex: 1 },
  numbersContent: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x4,
    /* Room for the pills' vertical slop inside the scroller's clip. */
    paddingVertical: Spacing.x4,
  },
  /* The chip's 32, and at least as wide: a single digit is a circle, a
     four-digit page a short pill. */
  number: {
    minWidth: ControlHeight.small,
    height: ControlHeight.small,
    paddingHorizontal: Spacing.x8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Tabular, so "11" and "88" are one width and the row does not shift a
     pixel as the pages turn. */
  numberText: { fontVariant: ['tabular-nums'] },
  gap: { paddingHorizontal: 2 },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.x12,
  },
  status: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  jump: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  /* A field at the small control's height rather than the form field's 54:
     it holds a number, beside a line of caption type. The well, no border —
     the app's field, at this size. */
  jumpField: {
    width: 72,
    height: ControlHeight.small + Spacing.x4,
    paddingHorizontal: Spacing.x12,
    paddingVertical: 0,
    borderRadius: Radius.pill,
    textAlign: 'center',
    ...Type.fieldText,
    fontVariant: ['tabular-nums'],
  },
});
