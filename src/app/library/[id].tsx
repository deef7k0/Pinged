import { useQuery } from '@tanstack/react-query';
import { Link, useLocalSearchParams } from 'expo-router';
import { memo, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import {
  SHELF_COLUMNS,
  SHELF_GAP,
  gridItemWidth,
  steamHeaderUrl,
} from '@/components/gaming/game-tile';
import { PhysicalShelf } from '@/components/copy-coverflow';
import { LibraryHome, type LibraryRow } from '@/components/library-home';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageFlatList } from '@/components/ui/page-scroll';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, Screen } from '@/components/ui/screen';
import { SortBar } from '@/components/ui/sort-bar';
import { ScoreBadge, Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { STATUS_LABEL } from '@/constants/status';
import { ShelfGridWindow } from '@/constants/list-window';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGamingSync, useLinkedAccount } from '@/hooks/use-gaming';
import {
  getCopies,
  getFavorites,
  getLibraryStatistics,
  getOwnedGames,
  getUserBacklog,
  getUserGameStats,
  getUserLogs,
} from '@/lib/api';
import type { ListItem } from '@/lib/api';
import type { LogWithRelations } from '@/lib/database.types';
import {
  availableSorts,
  formatPlaytime,
  formatPlaytimeLong,
  requireProvider,
  type LibrarySort,
  type OwnedGame,
} from '@/lib/gaming';
import { useAuth } from '@/store/auth';

/**
 * Four across, close together (`SHELF_COLUMNS`). The owner's reference for this
 * screen is a Letterboxd films tab, and that grid is the layout — four posters
 * to a row with one quiet line under each. It was three, the size every other
 * grid in the app keeps — the inside of a collection included, which was four
 * for one pass and went back.
 */
const COLUMNS = SHELF_COLUMNS;
const GAP = SHELF_GAP;

/** How many placeholder covers stand in for a grid that is loading: four rows. */
const SKELETON_TILES = COLUMNS * 4;

type LibraryTab =
  'logged' | 'favourites' | 'backlog' | 'physical' | 'steam' | 'playstation' | 'xbox' | 'gog';

/** The lists that are a linked account's games (`gaming_owned_games`). */
type OwnedTab = Extract<LibraryTab, 'steam' | 'playstation' | 'xbox' | 'gog'>;
const OWNED_TABS: readonly OwnedTab[] = ['steam', 'playstation', 'xbox', 'gog'];
const isOwnedTab = (tab: LibraryTab | null): tab is OwnedTab =>
  !!tab && (OWNED_TABS as readonly string[]).includes(tab);

/**
 * The lists a library opens onto — the rows of its head (`<LibraryHome>`),
 * Apple Music's Playlists / Artists / Albums / Songs (the owner's, 2026-10-22).
 *
 * `logged` is every log but the backlog; `backlog` is what they want to play.
 * `physical` is the binder: the boxes on the shelf, as discs in sleeves.
 * `steam` is the linked library, with Steam's own figures at its head;
 * `playstation`, `xbox` and `gog` the games imported from a public username
 * (`game-accounts`, RAWG's way). Each is a row only when that account is linked.
 */
const TAB_ORDER: LibraryTab[] = [
  'logged',
  'favourites',
  'backlog',
  'physical',
  'steam',
  'playstation',
  'xbox',
  'gog',
];

const TAB_LABELS: Record<LibraryTab, string> = {
  logged: 'Logged',
  favourites: 'Favourites',
  backlog: 'Backlog',
  physical: 'Physical',
  steam: 'Steam',
  playstation: 'PlayStation',
  xbox: 'Xbox',
  gog: 'GOG',
};

const TAB_ICONS: Record<LibraryTab, LibraryRow['icon']> = {
  logged: 'game-controller-outline',
  favourites: 'star-outline',
  backlog: 'bookmark-outline',
  physical: 'disc-outline',
  steam: 'logo-steam',
  playstation: 'logo-playstation',
  xbox: 'logo-xbox',
  gog: 'game-controller-outline',
};

function isLibraryTab(value: string | undefined): value is LibraryTab {
  return !!value && (TAB_ORDER as string[]).includes(value);
}

/**
 * A person's games.
 *
 * Without `?tab=` it is the library's head (`<LibraryHome>`): pinned games, a
 * row per list, the newest games. A row pushes this screen again with its
 * `tab`, which is one list on a page of its own — no tab bar, as Apple Music
 * pushes Albums. The profile's "14 physical" opens straight onto the binder.
 *
 * Was Steam-only, and gated behind a linked account — so for anyone who had
 * never connected Steam it was a screen that existed and always said "no
 * account linked". It now merges two sources: the Steam library, and everything
 * logged in this app. Only the Owned and Statistics tabs still need Steam, and
 * they say so individually instead of the whole screen refusing to open.
 *
 * Sorting and search stay server-side for `owned` through the ordering in
 * `getOwnedGames`, because a 900-game library re-sorted in JavaScript on every
 * keystroke is a dropped frame per character. The other tabs are short enough
 * to sort in memory.
 */
export default function LibraryScreen() {
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ id: string; tab?: string }>();
  const id = params.id;
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;
  const isSelf = viewerId === id;

  /* Null is the library's head; a list is pushed as its own page. */
  const tab: LibraryTab | null = isLibraryTab(params.tab) ? params.tab : null;
  const ownedProvider: OwnedTab = isOwnedTab(tab) ? tab : 'steam';
  /* PlayStation's trophy list and Xbox's title history carry no playtime, so
     their lists open on the most recent. */
  const playtime = ownedProvider === 'steam' || ownedProvider === 'gog';
  const [sort, setSort] = useState<LibrarySort>(playtime ? 'most-played' : 'recently-played');
  const [search, setSearch] = useState('');

  const provider = requireProvider(ownedProvider);
  const account = useLinkedAccount(id ?? null);
  const playstation = useLinkedAccount(id ?? null, 'playstation');
  const xbox = useLinkedAccount(id ?? null, 'xbox');
  const gog = useLinkedAccount(id ?? null, 'gog');
  const linked: Record<OwnedTab, boolean> = {
    steam: !!account.data,
    playstation: !!playstation.data,
    xbox: !!xbox.data,
    gog: !!gog.data,
  };

  // Only the owner's own library syncs — visiting a profile must never trigger
  // API calls against someone else's Steam account.
  useGamingSync({ userId: id ?? null, enabled: isSelf, sections: ['library', 'achievements'] });

  const games = useQuery({
    queryKey: ['gaming-library', ownedProvider, id, sort, search.trim()],
    queryFn: () =>
      getOwnedGames(id!, { provider: ownedProvider, sort, search: search.trim() || undefined }),
    enabled: !!id,
  });

  const steamStats = useQuery({
    queryKey: ['gaming-library-stats', 'steam', id],
    queryFn: () => getLibraryStatistics(id!),
    enabled: !!id && tab === 'steam',
  });

  /* The Physical row's count. One server-side aggregate (0028). */
  const collection = useQuery({
    queryKey: ['user-game-stats', id],
    queryFn: () => getUserGameStats(id!),
    enabled: !!id,
  });

  const copies = useQuery({
    queryKey: ['copies', id, 'all'],
    queryFn: () => getCopies(id!),
    enabled: !!id && tab === 'physical',
  });
  const physical = useMemo(
    () => (copies.data ?? []).filter((copy) => copy.ownership === 'physical'),
    [copies.data]
  );

  /* Games logged in this app: the Logged list, and the head's "Recently added".
     One indexed query, capped at 100 rows. */
  const logs = useQuery({
    queryKey: ['user-logs', id],
    queryFn: () => getUserLogs(id!),
    enabled: !!id && (tab === null || tab === 'logged'),
  });

  /* Under `['user-logs', id]`, so everything that refreshes a person's logs
     refreshes it too. */
  const backlog = useQuery({
    queryKey: ['user-logs', id, 'backlog'],
    queryFn: () => getUserBacklog(id!),
    enabled: !!id && (tab === null || tab === 'backlog'),
  });

  const favourites = useQuery({
    queryKey: ['favorites', id],
    queryFn: () => getFavorites(id!),
    enabled: !!id && (tab === null || tab === 'favourites'),
  });

  /*
   * One list, whichever tab is showing.
   *
   * Built here rather than in four branches of the render so the grid below is
   * one `<FlatList>` with one key extractor — swapping tabs changes its data,
   * not its identity, which is what keeps the scroll position and the recycled
   * rows behaving.
   */
  const entries = useMemo<LibraryEntry[]>(() => {
    const owned = games.data ?? [];
    const logged = logs.data ?? [];

    switch (tab) {
      case 'steam':
      case 'playstation':
      case 'xbox':
      case 'gog':
        return owned.map(fromOwned);
      case 'logged':
        return logged
          .filter((log) => log.status !== 'backlog')
          .map(fromLog)
          .filter((entry): entry is LibraryEntry => entry !== null);
      case 'backlog':
        return (backlog.data ?? [])
          .map(fromLog)
          .filter((entry): entry is LibraryEntry => entry !== null);
      case 'favourites':
        return (favourites.data?.items ?? [])
          .map(fromFavourite)
          .filter((entry): entry is LibraryEntry => entry !== null);
      default:
        return [];
    }
  }, [tab, games.data, logs.data, backlog.data, favourites.data]);

  /* A count only where it is the whole of the list: `getUserLogs` stops at a
     hundred, so a full page of logs says nothing about how many there are. */
  const loggedCount =
    logs.data && logs.data.length < 100
      ? logs.data.filter((log) => log.status !== 'backlog').length
      : null;
  const counts: Record<LibraryTab, number | null> = {
    logged: loggedCount,
    favourites: favourites.data?.items?.length ?? null,
    backlog: backlog.data?.length ?? null,
    physical: collection.data?.copies ?? null,
    steam: tab === null ? (games.data?.length ?? null) : null,
    /* Not fetched for the head: the count is on the list itself. */
    playstation: null,
    xbox: null,
    gog: null,
  };

  const rows: LibraryRow[] = TAB_ORDER.filter((key) => !isOwnedTab(key) || linked[key]).map(
    (key) => ({
      key,
      label: TAB_LABELS[key],
      icon: TAB_ICONS[key],
      count: counts[key],
      href: { pathname: '/library/[id]', params: { id: id ?? '', tab: key } },
    })
  );

  const tileWidth = gridItemWidth(width, COLUMNS, Spacing.x16, GAP);

  if (!id) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back title="Library" />}>
        <EmptyState icon="search" title="Library not found" />
      </Screen>
    );
  }

  const isPrivate = account.data?.visibility === 'private';
  const noSteam = !account.isLoading && !account.data;

  if (tab === null) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back title="Library" />}>
        <LibraryHome
          userId={id}
          isSelf={isSelf}
          rows={rows}
          recent={logs.data ?? []}
          recentLoading={logs.isLoading}
        />
      </Screen>
    );
  }

  /* Physical is Cover Flow, a screen of its own: the copy's colours are its
     backdrop as a box is picked up (`<PhysicalShelf>`). */
  if (tab === 'physical') {
    return (
      <PhysicalShelf
        copies={physical}
        loading={copies.isLoading}
        error={copies.error}
        onRetry={() => void copies.refetch()}
        isSelf={isSelf}
        ownerId={id}
      />
    );
  }

  return (
    <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back title={TAB_LABELS[tab]} />}>
      <PageFlatList
        data={entries}
        key={`grid-${COLUMNS}`}
        numColumns={COLUMNS}
        keyExtractor={(entry) => entry.key}
        {...ShelfGridWindow}
        renderItem={({ item }) => (
          /* Favourites say nothing under their covers, so that tab keeps no
               line for it; every other tab holds one, so its rows are level
               whether or not a game has something to say. */
          <LibraryCard entry={item} width={tileWidth} captioned={tab !== 'favourites'} />
        )}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          /* Search and sort are a linked account's, sorted in Postgres. The
               others are short enough to scan, and a sort row that silently
               applied to only part of what was on screen would be worse than
               no sort row. */
          isOwnedTab(tab) ? (
            <View style={styles.controls}>
              {tab === 'steam' && <SteamFigures data={steamStats.data} />}
              <TextField
                value={search}
                onChangeText={setSearch}
                icon="search"
                variant="search"
                placeholder="Search this library"
                autoCapitalize="none"
                autoCorrect={false}
              />

              {/* "Recently purchased" is absent for Steam on purpose: its Web
                    API exposes no purchase date, and a sort that quietly fell
                    back to last-played would misrepresent what it shows. */}
              <SortBar
                /* "Most played" only where the service reports playtime. */
                options={availableSorts(provider).filter(
                  (option) => playtime || option.key !== 'most-played'
                )}
                value={sort}
                onChange={setSort}
                accessibilityLabel="Sort this library"
              />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <LibraryEmpty
            tab={tab}
            isSelf={isSelf}
            isPrivate={isPrivate}
            noSteam={noSteam}
            search={search}
            loading={
              isOwnedTab(tab)
                ? games.isLoading
                : tab === 'backlog'
                  ? backlog.isLoading
                  : tab === 'favourites'
                    ? favourites.isLoading
                    : logs.isLoading
            }
            error={
              isOwnedTab(tab)
                ? games.error
                : tab === 'backlog'
                  ? backlog.error
                  : tab === 'favourites'
                    ? favourites.error
                    : logs.error
            }
            tileWidth={tileWidth}
          />
        }
      />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// One row shape for four different sources
// ---------------------------------------------------------------------------

/**
 * A game on this screen, whichever tab it arrived on.
 *
 * The grid renders one of these regardless of whether it came from a Steam
 * library row, a log, or a favourites list. Without it the screen would need
 * four `renderItem`s and four `keyExtractor`s, and the tiles would drift apart
 * the way the profile's tab bar drifted from `<TabBar>`.
 */
type LibraryEntry = {
  /** Stable list key. An unmatched Steam title has no `gameId`, so not that. */
  key: string;
  /** App-wide id when the game has a page. Null makes the tile inert. */
  gameId: string | null;
  title: string;
  coverUrl: string | null;
  heroUrl: string | null;
  steamAppId: string | null;
  /** Their score for it, 0–100, when they gave one. Drawn in the score's own colour. */
  score: number | null;
  /** What stands under the art when there is no score: a status, or playtime. */
  caption: string | null;
};

function fromOwned(game: OwnedGame): LibraryEntry {
  /* An imported PlayStation, Xbox or GOG game: the service's own art, and its
     playtime or how far through its trophies or achievements. */
  if (game.provider !== 'steam') {
    const progress =
      game.achievementsTotal != null && game.achievementsTotal > 0
        ? `${game.achievementsUnlocked ?? 0}/${game.achievementsTotal}`
        : null;
    return {
      key: `${game.provider}:${game.appId}`,
      gameId: game.gameId,
      title: game.name,
      coverUrl: null,
      heroUrl: game.iconUrl,
      steamAppId: null,
      score: null,
      caption: game.playtimeMinutes > 0 ? formatPlaytime(game.playtimeMinutes) : progress,
    };
  }
  return {
    key: `steam:${game.appId}`,
    gameId: game.gameId,
    title: game.name,
    /*
     * No cover of its own: `steamAppId` is what draws Steam's portrait capsule,
     * and the header under it is the fallback for a game that has none.
     *
     * This used to name the capsule a second time, on Steam's other host. That
     * is the same file, so where it is missing it is missing twice — and a
     * `<Poster>` only reaches `heroUrl` when `coverUrl` is null, so the header
     * was never tried and the tile stayed blank. Verified live: appids 2520,
     * 3170, 18700 and 26300 answer 404 for the capsule on both hosts and 200
     * for the header. With the title off the tile, a blank one is a game nobody
     * can name.
     */
    coverUrl: null,
    heroUrl: steamHeaderUrl(game.appId),
    steamAppId: game.appId,
    score: null,
    caption: game.playtimeMinutes > 0 ? formatPlaytime(game.playtimeMinutes) : null,
  };
}

function fromLog(log: LogWithRelations): LibraryEntry | null {
  const game = log.game;
  if (!game) return null;

  return {
    key: `log:${game.id}`,
    gameId: game.id,
    title: game.title,
    coverUrl: game.cover_url,
    heroUrl: game.hero_url,
    steamAppId: null,
    // The score if they gave one, the status otherwise — a logged game always
    // has the second and only sometimes the first.
    score: log.rating != null ? Math.round(log.rating) : null,
    caption: log.rating != null ? null : (STATUS_LABEL[log.status] ?? null),
  };
}

function fromFavourite(item: ListItem): LibraryEntry | null {
  const game = item.game;
  if (!game) return null;

  return {
    key: `fav:${game.id}`,
    gameId: game.id,
    title: game.title,
    coverUrl: game.cover_url,
    heroUrl: game.hero_url,
    steamAppId: null,
    score: null,
    caption: null,
  };
}

/**
 * One tile: the box, and one quiet line under it — their score, or where they
 * are with it, or how long they have played.
 *
 * The reference's tile: a poster with its star rating beneath and nothing else.
 * It carried the game's name on a line of its own until the grid went four
 * across; at 76dp that line was a dozen characters of a title the box already
 * prints, and it is the screen reader's now (`spoken`).
 *
 * Memoised: `entry` comes out of a memo keyed on query data, so it holds its
 * identity until a query lands, and a grid of four is a third more tiles than
 * the grid of three it replaced.
 */
const LibraryCard = memo(function LibraryCard({
  entry,
  width,
  captioned,
}: {
  entry: LibraryEntry;
  width: number;
  /** Hold a line under the art even when this game has nothing to put on it. */
  captioned: boolean;
}) {
  const spoken = [
    entry.title,
    entry.score != null ? `scored ${entry.score} out of 100` : entry.caption,
  ]
    .filter(Boolean)
    .join(', ');

  const art = (
    <View style={[styles.tile, { width }]}>
      <Poster
        coverUrl={entry.coverUrl}
        heroUrl={entry.heroUrl}
        title={entry.title}
        gameId={entry.gameId}
        steamAppId={entry.steamAppId}
        width={width}
        rounded="image"
      />
      {captioned && (
        <View style={styles.under}>
          {entry.score != null ? (
            <ScoreBadge score={entry.score} size="small" />
          ) : entry.caption ? (
            <Text variant="bodySmall" color="textMuted" numberOfLines={1}>
              {entry.caption}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );

  // A Steam title nobody has logged has no page to open. Shown, not tappable —
  // dropping it would hide most of a large library. Its name is not printed, so
  // it is spoken from here.
  if (!entry.gameId) {
    return (
      <View accessible accessibilityRole="image" accessibilityLabel={spoken}>
        {art}
      </View>
    );
  }

  /* Straight to the game page rather than to this person's record of it. The
     old Steam-only grid went to the per-user screen because every row *was*
     theirs; a merged list is mostly games, and a tile that behaved differently
     depending on which tab surfaced it would be the surprising kind of clever. */
  return (
    <Link href={{ pathname: '/game/[id]', params: { id: entry.gameId } }} asChild>
      <PressableScale accessibilityRole="button" accessibilityLabel={spoken} scaleTo={0.95}>
        {art}
      </PressableScale>
    </Link>
  );
});

/** What an empty grid says, which depends entirely on why it is empty. */
function LibraryEmpty({
  tab,
  isSelf,
  isPrivate,
  noSteam,
  search,
  loading,
  error,
  tileWidth,
}: {
  tab: LibraryTab;
  isSelf: boolean;
  isPrivate: boolean;
  noSteam: boolean;
  search: string;
  loading: boolean;
  error: unknown;
  tileWidth: number;
}) {
  if (loading) return <GridSkeleton width={tileWidth} />;
  if (error) return <ErrorState error={error} />;

  if (tab === 'playstation' || tab === 'xbox' || tab === 'gog') {
    return (
      <EmptyState
        title="Nothing imported"
        message={
          isSelf
            ? 'No games came through. Make sure your profile and games are public, then import again from Edit profile.'
            : 'No games imported yet.'
        }
      />
    );
  }

  if (tab === 'steam') {
    if (noSteam) {
      return (
        <EmptyState
          icon="logo-steam"
          title="No Steam account linked"
          message={
            isSelf
              ? 'Connect Steam from your profile to import your library.'
              : 'This person has not linked a Steam account.'
          }
        />
      );
    }
    if (isPrivate) {
      return (
        <EmptyState
          title="Profile is private"
          message="Steam is not sharing this library. Game details must be public to import it."
        />
      );
    }
    if (search.trim()) {
      return (
        <EmptyState
          icon="search"
          title="No matches"
          message={`Nothing here matches “${search.trim()}”.`}
        />
      );
    }
    return (
      <EmptyState
        title="Nothing here yet"
        message={isSelf ? 'Your library is still syncing.' : 'No games synced.'}
      />
    );
  }

  if (tab === 'favourites') {
    return (
      <EmptyState
        title="No favourites"
        message={isSelf ? 'Star a game to pin it here.' : 'Nothing pinned yet.'}
      />
    );
  }

  if (tab === 'backlog') {
    return (
      <EmptyState
        title="Nothing in the backlog"
        message={isSelf ? 'Mark a game as Backlog and it waits for you here.' : 'No backlog yet.'}
      />
    );
  }

  return (
    <EmptyState
      title="Nothing logged"
      message={isSelf ? 'Log a game and it shows up here.' : 'No games logged yet.'}
    />
  );
}

// ---------------------------------------------------------------------------
// Steam
// ---------------------------------------------------------------------------

/**
 * Steam's own figures, at the head of the Steam tab. They were a Statistics tab
 * of their own; they are about this library and nothing else, so they sit on it.
 */
function SteamFigures({
  data,
}: {
  data: Awaited<ReturnType<typeof getLibraryStatistics>> | undefined;
}) {
  const theme = useTheme();
  if (!data || data.totalGames === 0) return null;

  return (
    <View style={styles.steamFigures}>
      <View style={[styles.statGrid, { borderTopColor: theme.border }]}>
        <StatCell label="Games owned" value={data.totalGames.toLocaleString()} />
        <StatCell label="Total playtime" value={formatPlaytime(data.totalPlaytimeMinutes)} />
        <StatCell
          label="Average per game"
          value={formatPlaytime(Math.round(data.avgPlaytimeMinutes))}
          hint="Across played games"
        />
        <StatCell label="Never played" value={data.neverPlayed.toLocaleString()} />
      </View>
      <Text variant="bodySmall" color="textMuted">
        {formatPlaytimeLong(data.totalPlaytimeMinutes)} across {data.playedGames} played{' '}
        {data.playedGames === 1 ? 'game' : 'games'}.
      </Text>
    </View>
  );
}

function StatCell({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.statCell}>
      <Text variant="h3">{value}</Text>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      {hint && (
        <Text variant="caption" color="textMuted">
          {hint}
        </Text>
      )}
    </View>
  );
}

function GridSkeleton({ width }: { width: number }) {
  return (
    <View style={styles.skeletonGrid}>
      {Array.from({ length: SKELETON_TILES }).map((_, index) => (
        <Skeleton key={index} width={width} height={width / (2 / 3)} radius={Radius.image} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { paddingHorizontal: Spacing.x16, paddingBottom: Spacing.x48, gap: GAP },
  column: { gap: GAP },
  tile: { gap: Spacing.x4 },
  /* One line of `bodySmall`, held open: a row of four is level whether each
     game has a score, a status or nothing to say. `minHeight`, so a larger
     system font grows the line instead of clipping it. */
  under: { minHeight: Type.bodySmall.lineHeight, paddingHorizontal: 1 },
  controls: { gap: Spacing.x12, paddingTop: Spacing.x16, paddingBottom: Spacing.x12 },
  steamFigures: { gap: Spacing.x8 },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: Spacing.x16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  statCell: { width: '50%', gap: 1, paddingVertical: Spacing.x8 },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
});
