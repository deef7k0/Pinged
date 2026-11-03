import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { useSelectable } from '@/components/ui/selectable';
import { SelectionCard } from '@/components/ui/selection-card';
import { Text } from '@/components/ui/text';
import { Tray } from '@/components/ui/tray';
import { TextField } from '@/components/ui/text-field';
import { ControlHeight, Radius, SmallControlSlop, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { EARLIEST_IGDB_YEAR, getGenres, getPlatforms, type GameFilters } from '@/lib/games';

/**
 * Rows in the year wheel, newest first.
 *
 * Built once at module scope: it is ~70 entries that never change within a
 * session, and rebuilding it per render would allocate a new array every time
 * the sheet opened.
 */
const YEARS = Array.from(
  { length: new Date().getFullYear() - EARLIEST_IGDB_YEAR + 1 },
  (_, index) => new Date().getFullYear() - index
);

export type GameFilterBarProps = {
  value: GameFilters;
  onChange: (next: GameFilters) => void;
};

/**
 * The four ways to narrow a catalogue search: genre, platform, studio, year.
 *
 * A row of pills that open sheets, rather than four fields stacked above the
 * results. On a phone the filters are the smaller half of this screen — the
 * results are what you are actually looking at — and four permanently-expanded
 * controls would push the first cover below the fold on every device the app
 * runs on.
 *
 * Each pill shows its current value when set, which is what makes the collapsed
 * row honest: you can read the whole query without opening anything, and a
 * filter you forgot you applied is not hiding behind a funnel icon.
 *
 * ## Why genre and platform are ids and studio is free text
 *
 * IGDB indexes genre and platform as relations, so those are picked from its own
 * vocabulary — fetched once and cached for the session, since it changes on the
 * order of once a year. There is no company picker because there is no company
 * *endpoint* worth paging through here (IGDB lists tens of thousands, most of
 * them one-credit contractors), so studio is a substring match on the name,
 * which is how anyone would search for it anyway.
 */
export function GameFilterBar({ value, onChange }: GameFilterBarProps) {
  const [open, setOpen] = useState<'genre' | 'platform' | 'studio' | 'year' | null>(null);

  /* IGDB's vocabularies. `staleTime: Infinity` because the list of genres does
     not move during a session, and this sheet can be opened a dozen times while
     filling in a ballot. */
  const genres = useQuery({
    queryKey: ['igdb', 'genres'],
    queryFn: ({ signal }) => getGenres(signal),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const platforms = useQuery({
    queryKey: ['igdb', 'platforms'],
    queryFn: ({ signal }) => getPlatforms(signal),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const genreName = genres.data?.find((entry) => entry.id === value.genreId)?.name;
  const platformName = platforms.data?.find((entry) => entry.id === value.platformId)?.name;
  const yearLabel =
    value.fromYear && value.toYear
      ? value.fromYear === value.toYear
        ? String(value.fromYear)
        : `${value.fromYear}–${value.toYear}`
      : (value.fromYear ?? value.toYear)
        ? `From ${value.fromYear ?? value.toYear}`
        : null;

  const active = !!value.genreId || !!value.platformId || !!value.studio?.trim() || !!yearLabel;

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}>
        <FilterPill
          label="Genre"
          selection={genreName}
          onPress={() => setOpen('genre')}
          onClear={value.genreId ? () => onChange({ ...value, genreId: null }) : undefined}
        />
        <FilterPill
          label="Platform"
          selection={platformName}
          onPress={() => setOpen('platform')}
          onClear={value.platformId ? () => onChange({ ...value, platformId: null }) : undefined}
        />
        <FilterPill
          label="Studio"
          selection={value.studio?.trim() || undefined}
          onPress={() => setOpen('studio')}
          onClear={value.studio ? () => onChange({ ...value, studio: null }) : undefined}
        />
        <FilterPill
          label="Year"
          selection={yearLabel ?? undefined}
          onPress={() => setOpen('year')}
          onClear={
            yearLabel ? () => onChange({ ...value, fromYear: null, toYear: null }) : undefined
          }
        />

        {active && (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Clear all filters"
            onPress={() => onChange({ term: value.term })}
            scaleTo={0.95}
            style={styles.clearAll}>
            <Text variant="bodySmall" color="textMuted">
              Clear
            </Text>
          </PressableScale>
        )}
      </ScrollView>

      <FilterSheet
        title="Genre"
        visible={open === 'genre'}
        onClose={() => setOpen(null)}
        options={(genres.data ?? []).map((entry) => ({ key: entry.id, label: entry.name }))}
        selected={value.genreId ?? null}
        onSelect={(key) => {
          onChange({ ...value, genreId: key as number | null });
          setOpen(null);
        }}
      />

      <FilterSheet
        title="Platform"
        visible={open === 'platform'}
        onClose={() => setOpen(null)}
        options={(platforms.data ?? []).map((entry) => ({ key: entry.id, label: entry.name }))}
        selected={value.platformId ?? null}
        onSelect={(key) => {
          onChange({ ...value, platformId: key as number | null });
          setOpen(null);
        }}
      />

      <StudioSheet
        visible={open === 'studio'}
        initial={value.studio ?? ''}
        onClose={() => setOpen(null)}
        onSubmit={(studio) => {
          onChange({ ...value, studio: studio || null });
          setOpen(null);
        }}
      />

      <YearSheet
        visible={open === 'year'}
        from={value.fromYear ?? null}
        to={value.toYear ?? null}
        onClose={() => setOpen(null)}
        onSubmit={(from, to) => {
          onChange({ ...value, fromYear: from, toYear: to });
          setOpen(null);
        }}
      />
    </View>
  );
}

/**
 * One collapsed filter.
 *
 * Follows the app's selection rule — `surfaceElevated` → `surfaceSelected` and
 * `border` → `borderStrong` when set, never a colour. A set filter also swaps
 * its own name for its value, so the row reads as a sentence rather than as four
 * identical buttons with a dot on some of them.
 */
function FilterPill({
  label,
  selection,
  onPress,
  onClear,
}: {
  label: string;
  selection?: string;
  onPress: () => void;
  onClear?: () => void;
}) {
  const theme = useTheme();
  const set = !!selection;
  const look = useSelectable()(set);

  /* One pill with two hit areas: the body opens the picker, the × clears it.
     The pill carries the selected state; the halves only press. */
  return (
    <View style={[styles.pill, look.style]}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={
          set ? `${label}: ${selection}. Change` : `Filter by ${label.toLowerCase()}`
        }
        onPress={onPress}
        scaleTo={0.97}
        hitSlop={SmallControlSlop}
        focusRing={look.focusRing}
        style={styles.pillBody}>
        <Text variant="bodySmall" color={look.label} numberOfLines={1}>
          {selection ?? label}
        </Text>
        {!onClear && <Ionicons name="chevron-down" size={13} color={theme.textSecondary} />}
      </PressableScale>

      {!!onClear && (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Clear ${label.toLowerCase()} filter`}
          onPress={onClear}
          scaleTo={0.9}
          hitSlop={SmallControlSlop}
          focusRing={look.focusRing}
          style={styles.pillClear}>
          <Ionicons name="close" size={14} color={theme.textSecondary} />
        </PressableScale>
      )}
    </View>
  );
}

/** A scrollable single-choice list. Used for both vocabularies. */
function FilterSheet({
  title,
  visible,
  onClose,
  options,
  selected,
  onSelect,
}: {
  title: string;
  visible: boolean;
  onClose: () => void;
  options: { key: number; label: string }[];
  selected: number | null;
  onSelect: (key: number | null) => void;
}) {
  return (
    <Sheet title={title} visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={styles.sheetList}>
        <SheetRow
          label={`Any ${title.toLowerCase()}`}
          active={selected === null}
          onPress={() => onSelect(null)}
        />
        {options.map((option) => (
          <SheetRow
            key={option.key}
            label={option.label}
            active={selected === option.key}
            onPress={() => onSelect(option.key)}
          />
        ))}
        {options.length === 0 && (
          <Text variant="bodySmall" color="textMuted" style={styles.sheetEmpty}>
            Could not load {title.toLowerCase()}s from IGDB.
          </Text>
        )}
      </ScrollView>
    </Sheet>
  );
}

/** Free text, because there is no company vocabulary worth paging through. */
function StudioSheet({
  visible,
  initial,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  initial: string;
  onClose: () => void;
  onSubmit: (studio: string) => void;
}) {
  const [draft, setDraft] = useState(initial);

  return (
    <Sheet title="Studio" visible={visible} onClose={onClose}>
      {/* Keyed on `initial` so reopening the sheet starts from what is currently
          applied, without an effect syncing state to props — see CLAUDE.md. */}
      <View key={initial} style={styles.sheetForm}>
        <TextField
          label="Developer or publisher"
          value={draft}
          onChangeText={setDraft}
          placeholder="Team Cherry"
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => onSubmit(draft.trim())}
          autoFocus
        />
        <Button title="Apply" onPress={() => onSubmit(draft.trim())} fullWidth />
      </View>
    </Sheet>
  );
}

/**
 * The year range, as two columns of the same list.
 *
 * A range rather than a single year because both questions are real: an award
 * show for 2025 wants one year exactly, and "the best PS2 platformer" wants a
 * decade. Picking the same year twice gives the first; the sheet shows that as
 * a single number rather than "2025–2025".
 */
function YearSheet({
  visible,
  from,
  to,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  from: number | null;
  to: number | null;
  onClose: () => void;
  onSubmit: (from: number | null, to: number | null) => void;
}) {
  const [draftFrom, setDraftFrom] = useState<number | null>(from);
  const [draftTo, setDraftTo] = useState<number | null>(to);

  /* Whichever end the user set second wins the ordering, so dragging the range
     backwards silently corrects instead of returning nothing. */
  const low = draftFrom && draftTo ? Math.min(draftFrom, draftTo) : draftFrom;
  const high = draftFrom && draftTo ? Math.max(draftFrom, draftTo) : draftTo;

  return (
    <Sheet title="Release year" visible={visible} onClose={onClose}>
      <View key={`${from}:${to}`} style={styles.yearBody}>
        <View style={styles.yearColumns}>
          <YearColumn heading="From" value={draftFrom} onChange={setDraftFrom} />
          <YearColumn heading="To" value={draftTo} onChange={setDraftTo} />
        </View>

        <View style={styles.sheetForm}>
          <Button title="Apply" onPress={() => onSubmit(low, high)} fullWidth />
          <Button title="Any year" variant="ghost" onPress={() => onSubmit(null, null)} fullWidth />
        </View>
      </View>
    </Sheet>
  );
}

function YearColumn({
  heading,
  value,
  onChange,
}: {
  heading: string;
  value: number | null;
  onChange: (year: number | null) => void;
}) {
  return (
    <View style={styles.yearColumn}>
      <Text variant="label" color="textSecondary" style={styles.yearHeading}>
        {heading}
      </Text>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SheetRow label="Any" active={value === null} onPress={() => onChange(null)} />
        {YEARS.map((year) => (
          <SheetRow
            key={year}
            label={String(year)}
            active={value === year}
            onPress={() => onChange(year)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * The shared sheet chrome: a scrim, a titled panel, a close control.
 *
 * A tray (`<Tray>`, reacticx's) rather than a routed screen — these are
 * disclosures belonging to one control on one screen, not destinations, and
 * routing them would put four entries in the history stack between opening the
 * picker and choosing a game.
 */
function Sheet({
  title,
  visible,
  onClose,
  children,
}: {
  title: string;
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const theme = useTheme();

  return (
    <Tray visible={visible} onClose={onClose} maxHeightRatio={0.75}>
      <View style={styles.panel}>
        <View style={[styles.panelHead, { borderBottomColor: theme.border }]}>
          <Text variant="h3">{title}</Text>
          <IconButton icon="close" accessibilityLabel="Close" size="small" onPress={onClose} />
        </View>

        {children}
      </View>
    </Tray>
  );
}

function SheetRow({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  /* A long picker, so the rows are bare until chosen — thirty outlined cards
     would be a wall of boxes around the words — with the circle on the leading
     edge like every choice in the app. */
  return (
    <View style={styles.sheetRow}>
      <SelectionCard title={label} selected={active} onPress={onPress} frame="row" compact />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: Spacing.x8, paddingHorizontal: Spacing.x16, paddingVertical: Spacing.x8 },
  /* A filter pill: `ControlHeight.small`, fully round, 1px edge. The halves
     inside reach the tap floor through `SmallControlSlop` — this row scrolls
     sideways and never wraps, so vertical slop overlaps nothing. */
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: ControlHeight.small,
    borderRadius: Radius.pill,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pillBody: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: Spacing.x4,
    paddingHorizontal: Spacing.x16,
    maxWidth: 180,
  },
  pillClear: {
    justifyContent: 'center',
    alignSelf: 'stretch',
    paddingRight: Spacing.x16,
    paddingLeft: Spacing.x4,
  },
  clearAll: { justifyContent: 'center', paddingHorizontal: Spacing.x8 },

  /* In a tray (`<Tray>`), capped at three quarters of the screen: a sheet
     that filled the display would be a screen, and this is a disclosure. */
  panel: { flexShrink: 1 },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.x16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetList: { paddingBottom: Spacing.x32 },
  sheetEmpty: { padding: Spacing.x16 },
  sheetForm: { padding: Spacing.x16, gap: Spacing.x12 },
  /* Inset from the sheet's edges so a chosen row's rounded ends show. */
  sheetRow: { marginHorizontal: Spacing.x8 },
  yearBody: { maxHeight: 460 },
  yearColumns: { flexDirection: 'row', height: 300 },
  yearColumn: { flex: 1 },
  yearHeading: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x12 },
});
