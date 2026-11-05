import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useCardMaterial } from '@/components/ui/card-material';
import { DropdownButton, type DropdownOption } from '@/components/ui/dropdown-button';
import { MultiPickSheet, type PickOption } from '@/components/ui/multi-pick-sheet';
import { PressableScale } from '@/components/ui/pressable-scale';
import { useSelectable } from '@/components/ui/selectable';
import { Checkbox } from '@/components/ui/selection-marks';
import { SortBar } from '@/components/ui/sort-bar';
import { Text } from '@/components/ui/text';
import { sortGenresByReach } from '@/constants/game-genres';
import { SELECTABLE_PERSPECTIVES } from '@/constants/player-perspectives';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useRawgTags } from '@/hooks/use-rawg-tags';
import { rawgTagsAvailable } from '@/lib/games/rawg-tags';
import { useTheme } from '@/hooks/use-theme';
import { getGenres, getSurprisePoolSize, type SurprisePoolSize } from '@/lib/games';
import {
  GAME_MODES,
  LANGUAGES,
  MATCH_MODE_LABEL,
  PLATFORM_GROUPS,
  THEMES,
  type MatchMode,
} from '@/lib/games/facets';
import type { TrackPickMode } from '@/lib/soundtrack-pick';
import {
  activeFilterCount,
  eraYears,
  poolFiltersFor,
  poolKey,
  RATING_FLOORS,
  RELEASE_ERAS,
  withoutFilters,
  type RatingFloor,
  type ReleaseEra,
  type SurpriseGameMode,
  type SurprisePrefs,
} from '@/lib/surprise-prefs';

const GAME_OPTIONS: readonly DropdownOption<SurpriseGameMode>[] = [
  { value: 'random', label: 'Completely random', short: 'Random' },
  { value: 'popular', label: 'Popular' },
  { value: 'hidden', label: 'Hidden gems' },
];

/** Offered only when the viewer has enough logs to seed it. See `canUseForYou`. */
const FORYOU_OPTION: DropdownOption<SurpriseGameMode> = {
  value: 'foryou',
  label: 'Based on my games',
  short: 'My games',
};

/** What each pool is, under its menu — the menu says its name, this what it means. */
const GAME_HINTS: Record<SurpriseGameMode, string> = {
  random: 'Anything in the catalogue that a few people have rated.',
  popular: 'Games a lot of people have played and rated.',
  hidden: 'Well liked, by few — rated 75 or more by under sixty people.',
  foryou: 'Like the games you rated highest here.',
};

const MATCH_OPTIONS = [
  { key: 'any' as const, label: MATCH_MODE_LABEL.any },
  { key: 'all' as const, label: MATCH_MODE_LABEL.all },
];

const TRACK_OPTIONS: readonly DropdownOption<TrackPickMode>[] = [
  { value: 'popular', label: 'Popular' },
  { value: 'random', label: 'Random' },
  { value: 'surprise', label: 'Mixed' },
];

const RATING_LABELS: Record<RatingFloor, string> = {
  0: 'Any',
  70: '70+',
  80: '80+',
  90: '90+',
};

const RATING_OPTIONS: readonly DropdownOption<string>[] = RATING_FLOORS.map((floor) => ({
  value: String(floor),
  label: floor === 0 ? 'Any rating' : `${RATING_LABELS[floor]} on IGDB`,
  short: RATING_LABELS[floor],
}));

function eraLabel(era: ReleaseEra, thisYear: number): string {
  switch (era) {
    case 'recent':
      return `Since ${eraYears(era, thisYear).fromYear}`;
    case 'retro':
      return 'Before 1990';
    case 'any':
      return 'Any time';
    default:
      return `The ${era}`;
  }
}

/** The many-of filters, each a row that opens its own checklist. */
type ListFilter =
  'genres' | 'themes' | 'perspectives' | 'modes' | 'platforms' | 'languages' | 'tags';

export type SurpriseSettingsProps = {
  prefs: SurprisePrefs;
  onChange: (prefs: SurprisePrefs) => void;
  /**
   * Whether "Based on my games" is offered at all.
   *
   * Hidden rather than disabled when false. The mode reads the viewer's own
   * logs, and with too few of them it would return nothing — showing a control
   * that cannot do its job is the thing `app/settings.tsx` exists to argue
   * against.
   */
  canUseForYou: boolean;
};

/**
 * Everything behind a roll: which slice, narrowed how, and what it sounds like.
 *
 * ## Laid out to be read and picked, not scanned (2026-10-16)
 *
 * The owner: "make the options in the Surprise Me page more friendly to look
 * at, easier to arrange and pick. Maybe have dropdown menus… it's kind of a
 * mess." It was three walls of chips — twenty-three genres, then the
 * perspectives, then the rating — one under another. Now:
 *
 * - **A single choice is a menu** (`<DropdownButton>`) at the end of its own
 *   row: which games, when they came out, the rating, the song.
 * - **A many-of list is one row** in a card of rows, saying what it holds —
 *   "Any", or "Shooter, Strategy +2" — and opening a checklist
 *   (`<MultiPickSheet>`): the chosen ones pinned at the top, a field to find a
 *   name in a long list, Clear and Done.
 *
 * **Nothing was taken away**, by the owner's standing ruling: this screen is a
 * discovery tool and every setting matters. All of them are still on the page,
 * none behind an "advanced" fold; what changed is how each is reached. Four
 * were added — themes, game modes, platforms, languages — and when a game came
 * out, the facets a game's details card leads to (`lib/games/facets.ts`).
 *
 * ## Why the filters give way under "Based on my games"
 *
 * That mode issues no catalogue query at all — it asks IGDB what the games you
 * rated highest are similar to. A clause has nothing to attach to, so the
 * group is replaced by one line saying why, rather than sitting there inert.
 */
export function SurpriseSettings({ prefs, onChange, canUseForYou }: SurpriseSettingsProps) {
  const theme = useTheme();
  const material = useCardMaterial();
  const accent = useAccent();
  const excludeLook = useSelectable()(prefs.excludePlayed);
  const [picking, setPicking] = useState<ListFilter | null>(null);
  const [thisYear] = useState(() => new Date().getFullYear());

  const gameOptions = canUseForYou ? [...GAME_OPTIONS, FORYOU_OPTION] : GAME_OPTIONS;

  /*
   * IGDB owns the genre vocabulary, so it is fetched — the same call
   * Home's genre chip makes, under the same key, so opening this after it costs
   * nothing.
   */
  const rawgTags = useRawgTags();
  const genres = useQuery({
    queryKey: ['igdb', 'genres'],
    queryFn: ({ signal }) => getGenres(signal),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  /* All twenty-three, in the order somebody reaches for them. */
  const genreOptions = useMemo(
    () =>
      sortGenresByReach(genres.data ?? []).map((genre) => ({ key: genre.id, label: genre.name })),
    [genres.data]
  );

  const eraOptions: DropdownOption<ReleaseEra>[] = RELEASE_ERAS.map((era) => ({
    value: era,
    label: eraLabel(era, thisYear),
  }));

  const filtersApply = prefs.gameMode !== 'foryou';
  const activeFilters = activeFilterCount(prefs);

  /*
   * How many games the settings currently match, while anything narrows them.
   * The key is every pool setting (`poolKey`), so a change aborts the request
   * in flight and an answered combination is served from cache; the previous
   * answer stays on screen while the next lands.
   */
  const poolSize = useQuery({
    queryKey: ['surprise-pool-size', poolKey(prefs)],
    queryFn: ({ signal }) =>
      /* `enabled` keeps this off in `foryou`, the one mode that is not a pool. */
      getSurprisePoolSize(
        prefs.gameMode as Exclude<SurpriseGameMode, 'foryou'>,
        poolFiltersFor(prefs, thisYear),
        signal
      ),
    /* Not with RAWG tags: IGDB cannot count RAWG's tagging, and a count of
       the other settings alone would be a wrong number. */
    enabled: filtersApply && activeFilters > 0 && prefs.tagIds.length === 0,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    placeholderData: (previous) => previous,
  });

  /* Each many-of filter: its name, its options, what it holds, how it is set.
     Tags are RAWG's and offered only with a RAWG key. */
  const lists: Partial<
    Record<
      ListFilter,
      {
        title: string;
        hint: string;
        options: readonly PickOption<number | string>[];
        selected: readonly (number | string)[];
        set: (next: (number | string)[]) => void;
      }
    >
  > = {
    genres: {
      title: 'Genres',
      hint: 'A game in any of these.',
      options: genreOptions,
      selected: prefs.genreIds,
      set: (next) => onChange({ ...prefs, genreIds: next as number[] }),
    },
    themes: {
      title: 'Themes',
      hint: 'A game with any of these.',
      options: [...THEMES]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((entry) => ({ key: entry.id, label: entry.name })),
      selected: prefs.themeIds,
      set: (next) => onChange({ ...prefs, themeIds: next as number[] }),
    },
    perspectives: {
      title: 'Perspective',
      hint: 'Seen in any of these ways.',
      options: SELECTABLE_PERSPECTIVES.map((perspective) => ({
        key: perspective.id,
        label: perspective.label,
      })),
      selected: prefs.perspectiveIds,
      set: (next) => onChange({ ...prefs, perspectiveIds: next as number[] }),
    },
    modes: {
      title: 'Game modes',
      hint: 'Playable in any of these.',
      options: GAME_MODES.map((mode) => ({ key: mode.id, label: mode.name })),
      selected: prefs.modeIds,
      set: (next) => onChange({ ...prefs, modeIds: next as number[] }),
    },
    platforms: {
      title: 'Platforms',
      hint: 'On any of these.',
      options: PLATFORM_GROUPS.map((group) => ({ key: group.key, label: group.label })),
      selected: prefs.platforms,
      set: (next) => onChange({ ...prefs, platforms: next as SurprisePrefs['platforms'] }),
    },
    languages: {
      title: 'Languages',
      hint: 'Playable in any of these — spoken, subtitled or on screen.',
      options: LANGUAGES.map((language) => ({ key: language.id, label: language.name })),
      selected: prefs.languageIds,
      set: (next) => onChange({ ...prefs, languageIds: next as number[] }),
    },
    ...(rawgTagsAvailable()
      ? {
          tags: {
            title: 'Tags',
            hint: 'Tagged by RAWG’s players with any of these.',
            options: [...(rawgTags.data ?? [])]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((tag) => ({ key: tag.id, label: tag.name })),
            selected: prefs.tagIds,
            set: (next: (number | string)[]) => onChange({ ...prefs, tagIds: next as number[] }),
          },
        }
      : {}),
  };

  const open = picking ? (lists[picking] ?? null) : null;

  return (
    <View style={styles.root}>
      <Band title="Game">
        <SettingRow label="Which games" hint={GAME_HINTS[prefs.gameMode]}>
          <DropdownButton
            label="Which games to pick from"
            value={prefs.gameMode}
            options={gameOptions}
            onChange={(gameMode) => onChange({ ...prefs, gameMode })}
          />
        </SettingRow>
      </Band>

      {filtersApply ? (
        <Band
          title="Narrow it down"
          spokenTitle={
            activeFilters > 0
              ? `Narrow it down. ${activeFilters} ${activeFilters === 1 ? 'filter' : 'filters'} set.`
              : 'Narrow it down'
          }
          count={activeFilters}
          trailing={
            activeFilters > 0 ? (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Clear all filters"
                hitSlop={CLEAR_SLOP}
                scaleTo={0.94}
                onPress={() => onChange(withoutFilters(prefs))}>
                <Text variant="bodySmall" style={{ color: accent.onSurface }}>
                  Clear all
                </Text>
              </PressableScale>
            ) : null
          }>
          {/* Absent rather than wrong when the count cannot be had. `isError`
              is checked beside `data` because a placeholder is the previous
              settings' answer, and must not sit under the new ones. */}
          {/* The owner's selection mode (2026-10-16): every pick, or any. */}
          <View style={styles.matchRow}>
            <SortBar
              options={MATCH_OPTIONS}
              value={prefs.match}
              onChange={(match) => onChange({ ...prefs, match })}
              accessibilityLabel="Selection mode"
              kind="choice"
            />
            <Text variant="bodySmall" color="textSecondary">
              {prefs.match === 'all'
                ? 'Combined: only a game with every pick — an RPG that is also isometric, a comedy and on Switch.'
                : 'Any of: a game with at least one of your picks in each list.'}
            </Text>
          </View>

          {poolSize.data && !poolSize.isLoadingError && (
            <PoolSizeLine size={poolSize.data} match={prefs.match} />
          )}

          <View
            style={[styles.card, { backgroundColor: material.fill, borderColor: material.edge }]}>
            {(Object.keys(lists) as ListFilter[]).map((key, index) => {
              const list = lists[key]!;
              const genresFailed = key === 'genres' && genres.isLoadingError;
              const genresLoading = key === 'genres' && genres.isPending;
              return (
                <PickRow
                  key={key}
                  first={index === 0}
                  label={list.title}
                  summary={
                    genresFailed
                      ? 'Didn’t load — tap to retry'
                      : genresLoading
                        ? 'Loading…'
                        : summaryOf(list.options, list.selected)
                  }
                  chosen={list.selected.length}
                  onPress={() => (genresFailed ? genres.refetch() : setPicking(key))}
                  disabled={genresLoading}
                />
              );
            })}
          </View>

          <SettingRow label="Released">
            <DropdownButton
              label="When it came out"
              value={prefs.era}
              options={eraOptions}
              onChange={(era) => onChange({ ...prefs, era })}
            />
          </SettingRow>

          <SettingRow
            label="Minimum rating"
            hint="IGDB’s community score. Unrated games are kept on Any and dropped by every other step.">
            <DropdownButton
              label="Minimum rating"
              value={String(prefs.minRating)}
              options={RATING_OPTIONS}
              onChange={(value) => onChange({ ...prefs, minRating: Number(value) as RatingFloor })}
            />
          </SettingRow>
        </Band>
      ) : (
        <View style={[styles.note, { borderColor: theme.border }]}>
          <Ionicons name="information-circle-outline" size={17} color={theme.textMuted} />
          <Text variant="bodySmall" color="textSecondary" style={styles.noteText}>
            The filters narrow the catalogue. “Based on my games” reads your own library instead, so
            it uses none of them.
          </Text>
        </View>
      )}

      <Band title="Soundtrack">
        <SettingRow label="Which song" hint="From the game’s soundtrack on SoundCloud.">
          <DropdownButton
            label="How to pick a song"
            value={prefs.trackMode}
            options={TRACK_OPTIONS}
            onChange={(trackMode) => onChange({ ...prefs, trackMode })}
          />
        </SettingRow>
      </Band>

      {/* A toggle, so a checkbox row: the app's one selected state, plus the
          box itself, the carrier that is not a colour. */}
      <PressableScale
        accessibilityRole="checkbox"
        accessibilityState={{ checked: prefs.excludePlayed }}
        accessibilityLabel="Exclude games I’ve played"
        scaleTo={0.98}
        pressedColor={excludeLook.pressedColor}
        focusRing={excludeLook.focusRing}
        onPress={() => onChange({ ...prefs, excludePlayed: !prefs.excludePlayed })}
        style={StyleSheet.flatten([styles.toggle, excludeLook.style])}>
        <Checkbox checked={prefs.excludePlayed} />
        <View style={styles.toggleText}>
          <Text variant="body" color={excludeLook.label}>
            Exclude games I’ve played
          </Text>
          {/* `textMuted` is under AA on the accent's wash, so the caption steps
              up with the row. */}
          <Text variant="bodySmall" color={prefs.excludePlayed ? 'textSecondary' : 'textMuted'}>
            Skips anything you logged as played or dropped. Backlog stays in.
          </Text>
        </View>
      </PressableScale>

      {open && (
        <MultiPickSheet
          visible
          title={open.title}
          hint={open.hint}
          options={open.options}
          selected={open.selected}
          onChange={open.set}
          onClose={() => setPicking(null)}
        />
      )}
    </View>
  );
}

/** "Any", or the first two chosen and how many more. */
function summaryOf(
  options: readonly PickOption<number | string>[],
  selected: readonly (number | string)[]
): string {
  if (selected.length === 0) return 'Any';
  const names = options
    .filter((option) => selected.includes(option.key))
    .map((option) => option.label);
  const shown = names.slice(0, 2).join(', ');
  return names.length > 2 ? `${shown} +${names.length - 2}` : shown || `${selected.length} chosen`;
}

/** A band of the form: a heading — with a count and an action when it has them — then its rows. */
function Band({
  title,
  spokenTitle,
  count = 0,
  trailing,
  children,
}: {
  title: string;
  spokenTitle?: string;
  count?: number;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={styles.band}>
      <View style={styles.bandHead}>
        <View style={styles.bandTitle}>
          <Text variant="h4" accessibilityRole="header" accessibilityLabel={spokenTitle ?? title}>
            {title}
          </Text>
          {/* Neutral and inline: a set filter is not an alert. */}
          {count > 0 && (
            <Text variant="bodySmall" color="textMuted">
              {count} set
            </Text>
          )}
        </View>
        {trailing}
      </View>
      {children}
    </View>
  );
}

/** A setting's name — and what it means, when that needs a line — with its control at the end. */
function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.setting}>
      <View style={styles.settingText}>
        <Text variant="itemTitle">{label}</Text>
        {!!hint && (
          <Text variant="bodySmall" color="textSecondary">
            {hint}
          </Text>
        )}
      </View>
      {children}
    </View>
  );
}

/** One many-of filter in the card: its name, what it holds, the way into its checklist. */
function PickRow({
  label,
  summary,
  chosen,
  first,
  disabled = false,
  onPress,
}: {
  label: string;
  summary: string;
  chosen: number;
  first: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const accent = useAccent();

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${summary}. Opens the list.`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      scaleTo={0.99}
      style={StyleSheet.flatten([
        styles.pickRow,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
      ])}>
      <Text variant="body" style={styles.pickLabel}>
        {label}
      </Text>
      {/* What is chosen, in the accent's legible ink; "Any" in the quiet one —
          so a set filter is seen without reading every row. */}
      <Text
        variant="bodySmall"
        numberOfLines={1}
        style={[styles.pickSummary, { color: chosen > 0 ? accent.onSurface : theme.textMuted }]}>
        {summary}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
    </PressableScale>
  );
}

/**
 * Below this, the count stops being reassurance and becomes a warning: about
 * half a batch (`SURPRISE_BATCH` is 50), where rolls start repeating.
 */
const NARROW_POOL = 25;

/** One line saying what the filters currently match, its consequence in words. */
function PoolSizeLine({ size, match }: { size: SurprisePoolSize; match: MatchMode }) {
  const { count, atLeast } = size;

  const message = atLeast
    ? `${count}+ games match. Plenty to draw from.`
    : count === 0
      ? match === 'all'
        ? 'No game has every one of these picks. Take one away, or switch to Any of.'
        : 'Nothing matches these filters. Loosen one and this updates.'
      : count === 1
        ? 'Exactly one game matches — every roll will be that game.'
        : count <= NARROW_POOL
          ? `Only ${count} games match, so rolls will repeat.`
          : `About ${count} games match.`;

  return (
    /* `polite`: it changes on every choice, and must not talk over it. */
    <Text
      variant="bodySmall"
      color="textSecondary"
      accessibilityLiveRegion="polite"
      accessibilityRole="text">
      {message}
    </Text>
  );
}

/** Lifts a one-word inline control to the tap floor without moving the word. */
const CLEAR_SLOP = { top: 18, bottom: 18, left: 16, right: 16 };

const styles = StyleSheet.create({
  root: { gap: Spacing.x32 },
  band: { gap: Spacing.x12 },
  bandHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bandTitle: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.x8 },
  /* The name and its hint take the row; the menu sits at its end. */
  setting: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x16 },
  settingText: { flex: 1, gap: 2 },
  /* The many-of filters as one card of rows: a list to read down, not a wall. */
  /* Every card's corner and hairline (`card-material`). No shadow: it clips
     its rows, and Android clips a shadow with them. */
  card: { borderRadius: Radius.review, borderWidth: 1, overflow: 'hidden' },
  matchRow: { gap: Spacing.x8 },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    minHeight: TapTarget + Spacing.x4,
    paddingHorizontal: Spacing.x16,
    paddingVertical: Spacing.x8,
  },
  pickLabel: { flexShrink: 0 },
  /* Takes what is left, right-aligned, and gives up its end before the name does. */
  pickSummary: { flex: 1, textAlign: 'right' },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.x8,
    padding: Spacing.x12,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  noteText: { flex: 1 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x16,
    paddingVertical: Spacing.x16,
    paddingHorizontal: Spacing.x20,
    borderRadius: Radius.card,
    borderWidth: 1,
  },
  toggleText: { flex: 1, gap: 2 },
});
