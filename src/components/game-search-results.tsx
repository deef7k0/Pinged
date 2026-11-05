import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import type { CollectionLayout } from '@/components/collection-toolbar';
import { PORTRAIT_COLUMNS, gridItemWidth } from '@/components/gaming/game-tile';
import { GameListItem } from '@/components/game-list-item';
import { DropdownButton, type DropdownOption } from '@/components/ui/dropdown-button';
import { IconButton } from '@/components/ui/icon-button';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState } from '@/components/ui/screen';
import { useTabBarClearance } from '@/components/app-tab-bar';
import { PageFlatList } from '@/components/ui/page-scroll';
import {
  PLATFORM_FAMILIES,
  platformFamilies,
  type PlatformFamilyKey,
} from '@/constants/platform-family';
import { ArtRowWindow, CoverGridWindow } from '@/constants/list-window';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  enabledProviders,
  searchGames,
  sortGames,
  type GameSearchResult,
  type GameSort,
} from '@/lib/games';

/** Below this a search matches half the catalogue; IGDB is asked for nothing. */
export const MIN_QUERY_LENGTH = 2;

/**
 * How the results can be ordered, as the menu lists them and as the button
 * names the one in force.
 *
 * Relevance leads and is the default: IGDB's own ranking for a title query is
 * better than anything derivable here, and a search for "zelda" wants the Zelda
 * games, not the highest-rated game with a Z in it. The rest exist for the
 * searches relevance handles badly — a franchise name, or a genre word that
 * matches forty things. Release date is two entries rather than one with a
 * direction toggle: "newest" and "oldest" are the two things anyone asks for,
 * and a menu row each is one tap.
 */
const SORT_OPTIONS: readonly DropdownOption<GameSort>[] = [
  { value: 'default', label: 'Relevance' },
  { value: 'newest', label: 'Release date, newest first', short: 'Newest' },
  { value: 'oldest', label: 'Release date, oldest first', short: 'Oldest' },
  { value: 'rating', label: 'Rating, highest first', short: 'Top rated' },
  { value: 'title', label: 'Title, A to Z', short: 'A–Z' },
];

/** Every platform, or one family of them — or the games that fit no family. */
type PlatformFilter = 'all' | PlatformFamilyKey | 'other';

const ALL_PLATFORMS: DropdownOption<PlatformFilter> = { value: 'all', label: 'All platforms' };
const OTHER_PLATFORMS: DropdownOption<PlatformFilter> = {
  value: 'other',
  label: 'Other platforms',
  short: 'Other',
};

/** Between covers in the grid, across and down — the collection grid's. */
const GRID_GAP = Spacing.x12;

export type GameSearchResultsProps = {
  /** The search term. Debounce it in the caller, which owns the text field. */
  query: string;
  /**
   * What tapping a result does. Omitted, rows link to the game page.
   *
   * The two screens that search for games want opposite things — browse opens
   * the game, the collection picker wants the game back — so the behaviour is a
   * prop and everything else here is shared.
   */
  onSelect?: (game: GameSearchResult) => void;
  /** Per-row marker: "Added" once a game is already in the collection. */
  badgeFor?: (game: GameSearchResult) => string | null;
  /** Whether tapping a row does anything, e.g. while an add is in flight. */
  isDisabled?: (game: GameSearchResult) => boolean;
  /** Shown before the query is long enough to run. */
  prompt?: { title: string; message?: string };
  /**
   * Offer the collection's grid: a key at the end of the toolbar, and three big
   * covers across when it is flipped. The Search tab's; a picker keeps the
   * list, whose rows carry the "Added" badges and disabled states a cover has
   * no room for.
   */
  layoutToggle?: boolean;
  /** Drawn above the toolbar, in every state: the Search tab's facet suggestions. */
  header?: ReactNode;
};

/**
 * Game search results, from the query down: the sort and platform menus, the
 * four load states and the list itself.
 *
 * Deliberately does *not* own the text field. The Search tab shares one field
 * between its Games and People modes, so lifting the input in here would either
 * clear it on every mode switch or force a second field to exist alongside it.
 * Input is per-screen; results are not.
 */
export function GameSearchResults({
  query,
  onSelect,
  badgeFor,
  isDisabled,
  prompt,
  layoutToggle = false,
  header = null,
}: GameSearchResultsProps) {
  const clearance = useTabBarClearance();
  const [sort, setSort] = useState<GameSort>('default');
  const [platform, setPlatform] = useState<PlatformFilter>('all');
  const [layout, setLayout] = useState<CollectionLayout>('rows');
  const { width } = useWindowDimensions();
  const isQueryable = query.length >= MIN_QUERY_LENGTH;
  const grid = layoutToggle && layout === 'grid';
  /* The app's portrait size, three across: results are browsed, not shelved. */
  const tileWidth = gridItemWidth(width, PORTRAIT_COLUMNS, Spacing.x16, GRID_GAP);

  const games = useQuery({
    // Shared key: the picker and the Search tab hit the same cache, so opening
    // the picker for a term you just searched costs nothing.
    /* Under `search`, so neither is kept on the device (`NEVER_PERSIST`). */
    queryKey: ['search', 'games', query],
    queryFn: ({ signal }) => searchGames(query, signal),
    enabled: isQueryable,
    /*
     * Refine, don't wipe.
     *
     * Every debounce tick is a new query key, so without a placeholder each
     * natural pause mid-word put `isLoading` back to true and tore the whole
     * list down to a centred spinner — typing "elden ring" produced two full
     * page-wipes. Keeping the previous page means the results narrow in place,
     * which is what a reader believes is happening anyway.
     */
    placeholderData: keepPreviousData,
  });

  /*
   * The platforms these results are actually on, as the filter's choices.
   *
   * Read off the results rather than offered as a fixed list, so the menu never
   * holds a platform that would empty the page: a search for "halo" does not
   * offer Switch. Families, not consoles — PlayStation is one entry whichever
   * generations the games are on, which is how the result rows already show
   * them. A game on none of the six families (a Saturn or a 3DS exclusive) is
   * reachable under "Other" rather than dropped from every filter.
   */
  const platformOptions = useMemo(() => {
    const present = new Set<PlatformFamilyKey>();
    let other = false;
    for (const game of games.data ?? []) {
      const families = platformFamilies(game.platforms);
      if (families.length === 0) other = true;
      for (const family of families) present.add(family.key);
    }

    const options: DropdownOption<PlatformFilter>[] = [ALL_PLATFORMS];
    for (const family of PLATFORM_FAMILIES) {
      if (present.has(family.key)) {
        options.push({ value: family.key, label: family.name, icon: family.icon });
      }
    }
    if (other && options.length > 1) options.push(OTHER_PLATFORMS);
    return options;
  }, [games.data]);

  /*
   * The menu is only worth drawing with a real choice in it: "All" plus one
   * platform filters nothing, because every result is already on it.
   *
   * And a filter is only *applied* while its menu is on screen. One chosen for
   * an earlier search may not exist in this one's results, or may be the only
   * platform left; it then reads as "all" — never a filter in force with no
   * control showing it — without being forgotten, so a search that brings the
   * choice back brings the filter back with it.
   */
  const canFilter = platformOptions.length > 2;
  const activePlatform =
    canFilter && platformOptions.some((option) => option.value === platform) ? platform : 'all';

  const ordered = useMemo(() => {
    const all = games.data ?? [];
    const filtered =
      activePlatform === 'all'
        ? all
        : all.filter((game) => {
            const families = platformFamilies(game.platforms);
            return activePlatform === 'other'
              ? families.length === 0
              : families.some((family) => family.key === activePlatform);
          });
    return sortGames(filtered, sort);
  }, [games.data, sort, activePlatform]);

  const resultCount = games.data?.length ?? 0;

  /* Empty only when the provider list is empty — i.e. IGDB disabled. Naming no
     source at all read as "Nothing on  for zelda", with the gap where the
     provider should have been. */
  const providerNames =
    enabledProviders()
      .map((provider) => provider.label)
      .join(' and ') || 'the catalogue';

  /* The header stands over every state, not only the list, so suggestions do
     not blink out while the next results load. */
  const framed = (node: ReactNode) =>
    header ? (
      <View style={styles.framed}>
        {/* Where the list's own padding would have put it. */}
        <View style={styles.framedHead}>{header}</View>
        {node}
      </View>
    ) : (
      node
    );

  if (!isQueryable) {
    return framed(
      <EmptyState
        title={prompt?.title ?? 'Find a game'}
        message={
          prompt?.message ??
          `Searching ${providerNames}. Type at least ${MIN_QUERY_LENGTH} characters.`
        }
      />
    );
  }

  /* A skeleton, not a spinner (DESIGN.md § 22). The shape of a result row is
     fully known before the response arrives, so the wait can show what is
     coming instead of only that something is. */
  if (games.isLoading) return framed(<ResultsSkeleton />);
  if (games.isLoadingError)
    return framed(<ErrorState error={games.error} onRetry={() => games.refetch()} />);

  return (
    <PageFlatList
      data={ordered}
      /* `numColumns` cannot change on a mounted list — React Native refuses to
         re-lay it out — so each layout is its own list, and the key swaps it. */
      key={grid ? 'search-grid' : 'search-rows'}
      numColumns={grid ? PORTRAIT_COLUMNS : 1}
      columnWrapperStyle={grid ? styles.gridRow : undefined}
      keyExtractor={(game) => game.id}
      {...(grid ? CoverGridWindow : ArtRowWindow)}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.content,
        grid && styles.gridContent,
        { paddingBottom: Spacing.x48 + clearance },
      ]}
      renderItem={({ item }) =>
        grid ? (
          /* The collection's grid: the cover is the result, as it is on a
             shelf — the title is on the box. */
          <Link href={{ pathname: '/game/[id]', params: { id: item.id } }} asChild>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={item.title}
              scaleTo={0.95}>
              <Poster
                coverUrl={item.coverUrl}
                heroUrl={item.heroUrl}
                title={item.title}
                edition={item.edition}
                gameId={item.id}
                steamAppId={item.steamAppId}
                width={tileWidth}
                rounded="image"
              />
            </PressableScale>
          </Link>
        ) : (
          <GameListItem
            game={item}
            badge={badgeFor?.(item) ?? null}
            onPress={onSelect ? () => onSelect(item) : undefined}
            disabled={isDisabled?.(item)}
          />
        )
      }
      ListHeaderComponent={
        /*
         * Two menus and, on the Search tab, the layout key.
         *
         * `<DropdownButton>` each: the order and the platform are both "one of
         * a short list", and a button that shows the choice in force and opens
         * the rest from itself costs one line where the old pills cost two and
         * the glyph keys said nothing about what they sorted by. Only once
         * there is more than one result — a toolbar above a single hit is
         * chrome that does nothing — and the platform menu only when the
         * results are on more than one platform (`canFilter`).
         */
        resultCount > 1 ? (
          <View>
            {header}
            <View style={styles.toolbar}>
              <DropdownButton
                label="Sort by"
                value={sort}
                options={SORT_OPTIONS}
                onChange={setSort}
              />
              {canFilter && (
                <DropdownButton
                  label="Platform"
                  value={activePlatform}
                  options={platformOptions}
                  onChange={setPlatform}
                />
              )}

              {layoutToggle && (
                <>
                  <View style={styles.spacer} />
                  {/* Shows the layout you would *get*, not the one you are in. */}
                  <IconButton
                    icon={layout === 'grid' ? 'list' : 'grid'}
                    accessibilityLabel={layout === 'grid' ? 'Show as a list' : 'Show as a grid'}
                    size="small"
                    onPress={() => setLayout(layout === 'grid' ? 'rows' : 'grid')}
                  />
                </>
              )}
            </View>
          </View>
        ) : header ? (
          <View>{header}</View>
        ) : null
      }
      ListEmptyComponent={
        <EmptyState
          icon="search"
          title="No games found"
          /* A zero result on a catalogue this size is nearly always a typo, an
             abbreviation ("botw"), or a subtitle that does not match — so the
             message says what to try instead of just reporting the absence. */
          message={`Nothing on ${providerNames} for “${query}”. Check the spelling, or try the full title rather than an abbreviation.`}
        />
      }
    />
  );
}

/** Four result rows' worth of structure, while the first search is in flight. */
export function ResultsSkeleton() {
  const theme = useTheme();

  return (
    <View
      style={styles.content}
      accessibilityRole="progressbar"
      accessibilityLabel="Searching the catalogue">
      {[0, 1, 2, 3].map((row) => (
        <View key={row} style={styles.skeletonRow}>
          <View
            style={[styles.skeletonPoster, { backgroundColor: theme.skeleton }]}
            /* Matches `<Poster>`'s 2:3 at the width `GameListItem` uses, so the
               list does not resize when the real rows land. */
          />
          <View style={styles.skeletonText}>
            <View
              style={[styles.skeletonLine, { width: '70%', backgroundColor: theme.skeleton }]}
            />
            <View
              style={[styles.skeletonLine, { width: '40%', backgroundColor: theme.skeleton }]}
            />
            <View
              style={[styles.skeletonLine, { width: '55%', backgroundColor: theme.skeleton }]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const SKELETON_POSTER = 84;

const styles = StyleSheet.create({
  /* `flexGrow: 1` so `ListEmptyComponent` centres rather than pinning to the
     top — `EmptyState` fills its parent, and a content-sized container gave it
     nothing to fill. */
  content: { padding: Spacing.x16, gap: Spacing.x8, paddingBottom: Spacing.x48, flexGrow: 1 },
  /* Wraps rather than squeezing: two menus and a key fit a 360dp phone with a
     few points to spare, and a long platform name must not push the key off. */
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.x8,
    minHeight: TapTarget,
    paddingBottom: Spacing.x4,
  },
  spacer: { flex: 1 },
  framed: { flex: 1 },
  framedHead: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x16 },
  /* The grid sets its own rhythm: covers `GRID_GAP` apart both ways. */
  gridContent: { gap: GRID_GAP },
  gridRow: { gap: GRID_GAP },
  skeletonRow: { flexDirection: 'row', gap: Spacing.x12, paddingVertical: Spacing.x16 },
  skeletonPoster: {
    width: SKELETON_POSTER,
    height: SKELETON_POSTER * 1.5,
    borderRadius: Radius.image,
  },
  skeletonText: { flex: 1, gap: Spacing.x8, paddingTop: Spacing.x4 },
  skeletonLine: { height: 12, borderRadius: Radius.xs },
});
