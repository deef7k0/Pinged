import Ionicons from '@expo/vector-icons/Ionicons';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useTabBarClearance } from '@/components/app-tab-bar';
import { ChoiceChips } from '@/components/choice-chips';
import { PageFlatList } from '@/components/ui/page-scroll';
import { PressableScale } from '@/components/ui/pressable-scale';
import { useSelectable } from '@/components/ui/selectable';
import { SortBar } from '@/components/ui/sort-bar';
import { Text } from '@/components/ui/text';
import {
  ControlHeight,
  Radius,
  SmallControlRowGap,
  SmallControlSlop,
  Spacing,
  TapTarget,
} from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import { getGenres } from '@/lib/games';
import {
  FACET_INFO,
  FIXED_VALUES,
  LOOKUP_KINDS,
  MATCH_MODE_LABEL,
  facetTitle,
  matchValues,
  type MatchMode,
  type Facet,
  type FacetKind,
  type FacetValue,
} from '@/lib/games/facets';
import { searchFacetValues } from '@/lib/games/igdb';
import { rawgTagsAvailable } from '@/lib/games/rawg-tags';
import { useRawgTags } from '@/hooks/use-rawg-tags';
import { Loader } from '@/components/ui/loader';

/** What a remote lookup needs before it asks: two letters, as a title search does. */
const MIN_LOOKUP = 2;

/** How many facets the title search suggests above its results. */
const SUGGESTIONS = 6;

/** The fetched genres, under the key the genre grid already reads. */
function useGenres(enabled = true) {
  return useQuery({
    queryKey: ['igdb', 'genres'],
    queryFn: ({ signal }) => getGenres(signal),
    enabled,
    staleTime: 24 * 60 * 60_000,
  });
}

// ---------------------------------------------------------------------------
// Search by
// ---------------------------------------------------------------------------

type SearchByValue = 'game' | FacetKind;

/* Tags are RAWG's: offered only in a build with a RAWG key. */
const SEARCH_BY_CHOICES = [
  { value: 'game' as const, label: 'Game' },
  ...LOOKUP_KINDS.filter((kind) => kind !== 'tag' || rawgTagsAvailable()).map((kind) => ({
    value: kind,
    label: FACET_INFO[kind].label,
  })),
];

/**
 * What the field looks for: a game by its title — or a genre, a theme, a
 * perspective, a mode, an engine, a series, a franchise, a language, whose
 * games it then shows.
 *
 * The owner's request (2026-10-16): "when the user taps the search bar, the app
 * tells the user a few options for searching a game, a theme, a game engine, a
 * perspective, etc." So it is drawn as the field is touched in the Games tab,
 * above the recent searches, and stays while a kind is chosen so another can
 * be.
 */
export function SearchBy({
  value,
  onChange,
}: {
  value: FacetKind | null;
  onChange: (kind: FacetKind | null) => void;
}) {
  return (
    <View style={styles.searchBy}>
      <ChoiceChips<SearchByValue>
        label="Search by"
        choices={SEARCH_BY_CHOICES}
        value={value ?? 'game'}
        clearable={false}
        onChange={(next) => onChange(!next || next === 'game' ? null : next)}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// The picker
// ---------------------------------------------------------------------------

/**
 * The values of one kind that match what is typed, best first — every theme
 * with nothing typed, the engines called "unreal" once that is.
 *
 * Fixed kinds and genres are filtered on the keystroke (`typed`); engines,
 * series and franchises are asked of IGDB once the word settles (`settled`).
 * Picking one is the Search tab's business (`onPick`).
 */
export function FacetPicker({
  kind,
  typed,
  settled,
  header,
  onPick,
}: {
  kind: FacetKind;
  typed: string;
  settled: string;
  header?: ReactElement | null;
  onPick: (facet: Facet) => void;
}) {
  const theme = useTheme();
  const clearance = useTabBarClearance();
  const info = FACET_INFO[kind];

  const genres = useGenres(info.lookup === 'fetched');
  const tags = useRawgTags(info.lookup === 'tags');
  const remote = useQuery({
    /* Under `search`: an answer to something typed is not kept (`NEVER_PERSIST`). */
    queryKey: ['search', 'facet-values', kind, settled],
    queryFn: ({ signal }) => searchFacetValues(kind, settled, signal),
    enabled: info.lookup === 'remote' && settled.length >= MIN_LOOKUP,
    placeholderData: keepPreviousData,
    staleTime: 60 * 60_000,
  });

  let values: FacetValue[] = [];
  let note: string;
  let busy = false;

  if (info.lookup === 'remote') {
    const asked = settled.length >= MIN_LOOKUP;
    values = asked ? (remote.data ?? []) : [];
    busy = asked && remote.isFetching;
    note = !asked
      ? `Type the name of ${a(info.label)} to find it.`
      : remote.isLoadingError
        ? `Could not search ${info.plural}. Try again in a moment.`
        : values.length === 0 && !busy
          ? `No ${info.label.toLowerCase()} called “${settled}”.`
          : `${info.plural[0].toUpperCase()}${info.plural.slice(1)} matching “${settled}”`;
  } else {
    const all =
      info.lookup === 'fetched'
        ? (genres.data ?? [])
        : info.lookup === 'tags'
          ? (tags.data ?? [])
          : (FIXED_VALUES[kind] ?? []);
    values = matchValues(all, typed);
    busy =
      (info.lookup === 'fetched' && genres.isLoading) || (info.lookup === 'tags' && tags.isLoading);
    note = typed.trim()
      ? values.length === 0 && !busy
        ? `No ${info.label.toLowerCase()} called “${typed.trim()}”.`
        : `${info.plural[0].toUpperCase()}${info.plural.slice(1)} matching “${typed.trim()}”`
      : '';
  }

  return (
    <PageFlatList
      data={values}
      keyExtractor={(value) => String(value.id)}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.picker, { paddingBottom: Spacing.x48 + clearance }]}
      ListHeaderComponent={
        <View style={styles.pickerHead}>
          {header}
          {/* Nothing is said over the untyped list: the owner had the line
              describing it ("Every theme on IGDB") removed (2026-10-17). */}
          {(!!note || busy) && (
            <View style={styles.noteRow}>
              <Text variant="bodySmall" color="textMuted" style={styles.note}>
                {note}
              </Text>
              {busy && <Loader size="small" color={theme.textMuted} />}
            </View>
          )}
        </View>
      }
      renderItem={({ item }) => (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${item.name}. Shows its games.`}
          onPress={() => onPick({ kind, id: item.id, name: item.name })}
          scaleTo={0.98}
          style={StyleSheet.flatten([styles.value, { borderBottomColor: theme.outline }])}>
          <Text variant="body" style={styles.valueName} numberOfLines={2}>
            {item.name}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
        </PressableScale>
      )}
    />
  );
}

/** "an engine", "a theme". */
function a(label: string): string {
  return `${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label.toLowerCase()}`;
}

// ---------------------------------------------------------------------------
// The chosen facet
// ---------------------------------------------------------------------------

/** The selection mode, as the two choices it is. */
const MATCH_OPTIONS = [
  { key: 'all' as const, label: MATCH_MODE_LABEL.all },
  { key: 'any' as const, label: MATCH_MODE_LABEL.any },
];

/**
 * The facets the results are of — "Genre · RPG", "Engine · Unity" — each a
 * chosen pill with a cross that takes it off, a pill to add another, and, with
 * two or more, the selection mode (the owner's, 2026-10-16): **Combined**, a
 * game that is every one of them, or **Any of**, a game that is at least one.
 */
export function FacetBar({
  facets,
  match,
  onRemove,
  onAdd,
  onClearAll,
  onMatchChange,
}: {
  facets: readonly Facet[];
  match: MatchMode;
  onRemove: (facet: Facet) => void;
  onAdd: () => void;
  onClearAll: () => void;
  onMatchChange: (match: MatchMode) => void;
}) {
  const theme = useTheme();
  const accent = useAccent();
  const selectable = useSelectable();
  const chosen = selectable(true);
  const resting = selectable(false);
  const several = facets.length > 1;

  return (
    <View style={styles.facetBar}>
      <View style={styles.facetPills}>
        {facets.map((facet) => (
          <PressableScale
            key={`${facet.kind}:${facet.id}`}
            accessibilityRole="button"
            accessibilityLabel={`${facetTitle(facet)}. Remove this filter.`}
            onPress={() => onRemove(facet)}
            scaleTo={0.96}
            hitSlop={SmallControlSlop}
            pressedColor={chosen.pressedColor}
            focusRing={chosen.focusRing}
            style={StyleSheet.flatten([styles.pill, chosen.style])}>
            <Text variant="body" color={chosen.label} numberOfLines={1} style={styles.pillText}>
              {facetTitle(facet)}
            </Text>
            <Ionicons name="close" size={16} color={theme.text} />
          </PressableScale>
        ))}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Add another filter"
          onPress={onAdd}
          scaleTo={0.96}
          hitSlop={SmallControlSlop}
          pressedColor={resting.pressedColor}
          focusRing={resting.focusRing}
          style={StyleSheet.flatten([styles.pill, resting.style])}>
          <Ionicons name="add" size={16} color={theme.textSecondary} />
          <Text variant="body" color={resting.label}>
            Add
          </Text>
        </PressableScale>
      </View>

      {several && (
        <View style={styles.matchRow}>
          <Text variant="itemTitle">Selection mode</Text>
          <SortBar
            options={MATCH_OPTIONS}
            value={match}
            onChange={onMatchChange}
            accessibilityLabel="Selection mode"
          />
        </View>
      )}

      {/* No line describing the list under the filters — the owner had those
          explanations removed (2026-10-17). Only the control is left. */}
      {several && (
        <View style={styles.facetLine}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Clear all filters"
            onPress={onClearAll}
            hitSlop={CLEAR_SLOP}
            scaleTo={0.94}>
            <Text variant="bodySmall" style={{ color: accent.onSurface }}>
              Clear all
            </Text>
          </PressableScale>
        </View>
      )}
    </View>
  );
}

/** Lifts a one-word inline control to the tap floor without moving the word. */
const CLEAR_SLOP = { top: 18, bottom: 18, left: 16, right: 16 };

// ---------------------------------------------------------------------------
// Suggestions while a title is typed
// ---------------------------------------------------------------------------

/**
 * The genres, themes, perspectives, modes and RAWG tags whose names match
 * what is typed as a game's title — "thri" offers Theme · Thriller — above the
 * games. The owner's "the user types the genre and the app gives the
 * options", without choosing a kind first. Only vocabularies the phone
 * already has or keeps for a week, so it costs no request as you type;
 * engines and the rest are under "Search by".
 */
export function FacetSuggestions({
  query,
  onPick,
}: {
  query: string;
  onPick: (facet: Facet) => void;
}) {
  const genres = useGenres();
  const tags = useRawgTags();
  const look = useSelectable()(false);

  const pools: [FacetKind, readonly FacetValue[]][] = [
    ['genre', genres.data ?? []],
    ['theme', FIXED_VALUES.theme ?? []],
    ['perspective', FIXED_VALUES.perspective ?? []],
    ['mode', FIXED_VALUES.mode ?? []],
    ['tag', tags.data ?? []],
  ];

  /* Two of each kind at most, so one vocabulary cannot fill the row. */
  const found: Facet[] = pools
    .flatMap(([kind, values]) =>
      matchValues(values, query)
        .slice(0, 2)
        .map((value) => ({ kind, id: value.id, name: value.name }))
    )
    .slice(0, SUGGESTIONS);

  if (query.trim().length < MIN_LOOKUP || found.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={styles.suggestions}
      contentContainerStyle={styles.suggestionRow}>
      {found.map((facet) => (
        <PressableScale
          key={`${facet.kind}:${facet.id}`}
          accessibilityRole="button"
          accessibilityLabel={`${facetTitle(facet)}. Shows its games.`}
          onPress={() => onPick(facet)}
          scaleTo={0.96}
          hitSlop={SmallControlSlop}
          pressedColor={look.pressedColor}
          focusRing={look.focusRing}
          style={StyleSheet.flatten([styles.pill, look.style])}>
          <Text variant="body" color={look.label} numberOfLines={1}>
            {facetTitle(facet)}
          </Text>
        </PressableScale>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  searchBy: { paddingBottom: Spacing.x8 },
  picker: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x16 },
  pickerHead: { gap: Spacing.x12, paddingBottom: Spacing.x4 },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  note: { flex: 1 },
  value: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    minHeight: TapTarget,
    paddingVertical: Spacing.x8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  valueName: { flex: 1 },
  facetBar: { gap: Spacing.x12, paddingBottom: Spacing.x12 },
  facetPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.x8,
    rowGap: SmallControlRowGap,
  },
  matchRow: { gap: Spacing.x8 },
  facetLine: { flexDirection: 'row', justifyContent: 'flex-end' },
  /* The app's small chip: 32 drawn, 16 at the sides, touched at the floor. */
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    minHeight: ControlHeight.small,
    paddingHorizontal: Spacing.x16,
    paddingVertical: Spacing.x4,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  pillText: { flexShrink: 1 },
  /* `flexGrow: 0`: a horizontal scroller grows into spare height otherwise
     (CLAUDE.md, § Gotchas). */
  suggestions: { flexGrow: 0, marginHorizontal: -Spacing.x16, marginBottom: Spacing.x12 },
  suggestionRow: { gap: Spacing.x8, paddingHorizontal: Spacing.x16 },
});
