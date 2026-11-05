import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { Fragment, useMemo, type ReactNode } from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';

import { useTabBarClearance } from '@/components/app-tab-bar';
import { ReviewBox } from '@/components/game-overview';
import { GameListItem } from '@/components/game-list-item';
import { ResultsSkeleton } from '@/components/game-search-results';
import { HomeSection } from '@/components/home-section';
import { CollectionShelfCard } from '@/components/list-tile';
import { PersonRow } from '@/components/person-row';
import { LogoTile } from '@/components/search/logo-tile';
import { Avatar } from '@/components/ui/avatar';
import { LogoMark } from '@/components/ui/logo-mark';
import { PageScrollView } from '@/components/ui/page-scroll';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { MaxContentWidth, Palette, Radius, Spacing, withAlpha } from '@/constants/theme';
import { searchLists, searchProfiles, searchReviews } from '@/lib/api';
import type { Profile } from '@/lib/database.types';
import { displayNameFor } from '@/lib/format';
import { searchGames, type GameSearchResult } from '@/lib/games';
import { searchStudios, type StudioResult } from '@/lib/games/browse';
import type { SearchScope } from '@/lib/search-history';

/** How many of each kind the page holds before its "See all". */
const GAME_ROWS = 4;
const PEOPLE_ROWS = 3;
const RAIL_ITEMS = 10;
/** The Top Result's box art. */
const TOP_ART = 96;
/** A studio's square and a collection's on their rails, and a review box. */
const STUDIO_SHARE = 0.3;
const SHELF_SHARE = 0.42;
const REVIEW_SHARE = 0.82;

/** The one thing the page leads with, of whichever kind it is. */
type TopHit =
  | { kind: 'game'; game: GameSearchResult }
  | { kind: 'studio'; studio: StudioResult }
  | { kind: 'person'; profile: Profile };

/**
 * Search's "Top results" — Apple Music's search page (the Apple pass,
 * 2026-11-05): one Top Result, large, and then every kind the field found in
 * a section of its own, a few of each, each heading leading to its own tab
 * (`onSeeAll`) where the full list is.
 *
 * Each section is the query its tab already runs, under the same key, so
 * switching to a tab is the cache and not a second request.
 *
 * **Which is the Top Result is a rule, not a ranking**: a studio or a person
 * whose name *is* what was typed (ignoring case and spaces) beats the first
 * game, unless that game's title is as exact — "nintendo" is the company,
 * "hades" the game, "@ada" Ada. Otherwise it is IGDB's first game.
 *
 * A kind with nothing for the search is left out; with nothing at all the
 * page says so. A kind whose request fails is left out too, as long as
 * something else answered — its own tab says what failed.
 */
export function TopResults({
  query,
  onSeeAll,
}: {
  query: string;
  onSeeAll: (scope: SearchScope) => void;
}) {
  const clearance = useTabBarClearance();
  const { width } = useWindowDimensions();
  const page = Math.min(width, MaxContentWidth);

  /* The tabs' own keys and functions: `['search', …]`, never kept on the device. */
  const games = useQuery({
    queryKey: ['search', 'games', query],
    queryFn: ({ signal }) => searchGames(query, signal),
    placeholderData: keepPreviousData,
  });
  const studios = useQuery({
    queryKey: ['search', 'studios', query],
    queryFn: ({ signal }) => searchStudios(query, signal),
    placeholderData: keepPreviousData,
  });
  const people = useQuery({
    queryKey: ['search', 'people', query],
    queryFn: ({ signal }) => searchProfiles(query, signal),
    placeholderData: keepPreviousData,
  });
  const collections = useQuery({
    queryKey: ['search', 'collections', query],
    queryFn: ({ signal }) => searchLists(query, signal),
    placeholderData: keepPreviousData,
  });
  const reviews = useQuery({
    queryKey: ['search', 'reviews', query],
    queryFn: ({ signal }) => searchReviews(query, signal),
    placeholderData: keepPreviousData,
  });

  const top = useMemo<TopHit | null>(() => {
    const key = squash(query);
    const firstGame = games.data?.[0] ?? null;
    if (firstGame && squash(firstGame.title) === key) return { kind: 'game', game: firstGame };
    const studio = studios.data?.find((entry) => squash(entry.name) === key);
    if (studio) return { kind: 'studio', studio };
    const person = people.data?.find(
      (entry) =>
        squash(entry.username ?? '') === key.replace(/^@/, '') ||
        squash(entry.display_name ?? '') === key
    );
    if (person) return { kind: 'person', profile: person };
    return firstGame ? { kind: 'game', game: firstGame } : null;
  }, [query, games.data, studios.data, people.data]);

  const gameRows = (games.data ?? [])
    .filter((game) => !(top?.kind === 'game' && top.game.id === game.id))
    .slice(0, GAME_ROWS);
  const studioRail = (studios.data ?? [])
    .filter((studio) => !(top?.kind === 'studio' && top.studio.id === studio.id))
    .slice(0, RAIL_ITEMS);
  const personRows = (people.data ?? [])
    .filter((profile) => !(top?.kind === 'person' && top.profile.id === profile.id))
    .slice(0, PEOPLE_ROWS);
  const listRail = (collections.data ?? []).slice(0, RAIL_ITEMS);
  const reviewRail = (reviews.data ?? []).slice(0, RAIL_ITEMS);

  const all = [games, studios, people, collections, reviews];
  const waiting = all.every((entry) => entry.isPending);
  /* The games are most of the page: wait for them before drawing it. */
  if (waiting || (games.isPending && !games.data)) return <ResultsSkeleton />;
  if (all.every((entry) => entry.isLoadingError)) {
    return (
      <ErrorState error={games.error} onRetry={() => all.forEach((entry) => entry.refetch())} />
    );
  }

  const nothing =
    !top &&
    studioRail.length === 0 &&
    personRows.length === 0 &&
    listRail.length === 0 &&
    reviewRail.length === 0;
  if (nothing) {
    return (
      <EmptyState
        icon="search"
        title="No results"
        message={`Nothing on Pinged matches “${query}”. Check the spelling, or try fewer words.`}
      />
    );
  }

  const settling = all.some((entry) => entry.isPlaceholderData);
  const studioSize = Math.round(page * STUDIO_SHARE);
  const shelfSize = Math.round(page * SHELF_SHARE);
  const reviewWidth = Math.round(page * REVIEW_SHARE);

  return (
    <PageScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.page,
        settling && styles.settling,
        { paddingBottom: Spacing.x48 + clearance },
      ]}>
      {top && (
        <HomeSection title="Top result">
          <View style={styles.inset}>
            <TopResultCard hit={top} />
          </View>
        </HomeSection>
      )}

      {gameRows.length > 0 && (
        <HomeSection title="Games" onSeeAll={() => onSeeAll('games')}>
          <View style={styles.inset}>
            {gameRows.map((game) => (
              <GameListItem key={game.id} game={game} />
            ))}
          </View>
        </HomeSection>
      )}

      {studioRail.length > 0 && (
        <HomeSection title="Studios" onSeeAll={() => onSeeAll('studios')}>
          <Rail
            data={studioRail}
            keyOf={(studio) => String(studio.id)}
            render={(studio) => (
              <LogoTile
                href={{
                  pathname: '/studio/[id]',
                  params: { id: String(studio.id), name: studio.name },
                }}
                logoUrl={studio.logoUrl}
                name={studio.name}
                detail={`${studio.gameCount.toLocaleString()} ${studio.gameCount === 1 ? 'game' : 'games'}`}
                width={studioSize}
                accessibilityLabel={`${studio.name}. See their games.`}
              />
            )}
          />
        </HomeSection>
      )}

      {personRows.length > 0 && (
        <HomeSection title="People" onSeeAll={() => onSeeAll('people')}>
          <View style={styles.inset}>
            {personRows.map((profile, index) => (
              <PersonRow key={profile.id} profile={profile} divided={index > 0} />
            ))}
          </View>
        </HomeSection>
      )}

      {listRail.length > 0 && (
        <HomeSection title="Collections" onSeeAll={() => onSeeAll('collections')}>
          <Rail
            data={listRail}
            keyOf={(list) => list.id}
            render={(list) => <CollectionShelfCard list={list} size={shelfSize} />}
          />
        </HomeSection>
      )}

      {reviewRail.length > 0 && (
        <HomeSection title="Reviews" onSeeAll={() => onSeeAll('reviews')}>
          <Rail
            data={reviewRail}
            keyOf={(log) => log.id}
            snap={reviewWidth + Spacing.x12}
            render={(log) => <ReviewBox log={log} width={reviewWidth} showGame />}
          />
        </HomeSection>
      )}
    </PageScrollView>
  );
}

/** A row of one kind, from the page's margin, running off the far edge. */
function Rail<T>({
  data,
  keyOf,
  render,
  snap,
}: {
  data: readonly T[];
  keyOf: (item: T) => string;
  render: (item: T) => ReactNode;
  snap?: number;
}) {
  return (
    <FlatList
      horizontal
      data={data}
      keyExtractor={keyOf}
      renderItem={({ item }) => <Fragment>{render(item)}</Fragment>}
      showsHorizontalScrollIndicator={false}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      snapToInterval={snap}
      snapToAlignment={snap ? 'start' : undefined}
      decelerationRate={snap ? 'fast' : undefined}
      /* A horizontal scroller grows unless told not to (CLAUDE.md, gotchas). */
      style={styles.rail}
      contentContainerStyle={styles.railRow}
    />
  );
}

/**
 * The Top Result, as Apple Music's: one box, the art large at the left — a
 * cover, a studio's logo square, a face — the name in `h3`, and what kind of
 * thing it is under it.
 */
function TopResultCard({ hit }: { hit: TopHit }) {
  let href;
  let art: ReactNode;
  let title: string;
  let kind: string;

  if (hit.kind === 'game') {
    const { game } = hit;
    href = { pathname: '/game/[id]' as const, params: { id: game.id } };
    title = game.title;
    kind = ['Game', game.developer, game.releaseYear].filter(Boolean).join(' · ');
    art = (
      <Poster
        coverUrl={game.coverUrl}
        heroUrl={game.heroUrl}
        title={game.title}
        gameId={game.id}
        width={TOP_ART}
        rounded="image"
        zoomable={false}
      />
    );
  } else if (hit.kind === 'studio') {
    const { studio } = hit;
    href = {
      pathname: '/studio/[id]' as const,
      params: { id: String(studio.id), name: studio.name },
    };
    title = studio.name;
    kind = `Studio · ${studio.gameCount.toLocaleString()} ${studio.gameCount === 1 ? 'game' : 'games'}`;
    art = (
      <LogoMark uri={studio.logoUrl} name={studio.name} width={TOP_ART} height={TOP_ART} tile />
    );
  } else {
    const { profile } = hit;
    href = { pathname: '/profile/[id]' as const, params: { id: profile.id } };
    title = displayNameFor(profile);
    kind = profile.username ? `Person · @${profile.username}` : 'Person';
    art = <Avatar uri={profile.avatar_url ?? null} name={title} size={TOP_ART} />;
  }

  return (
    <Link href={href} asChild>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Top result: ${title}, ${kind}`}
        scaleTo={0.98}
        style={styles.top}>
        <View pointerEvents="none">{art}</View>
        <View style={styles.topWords}>
          <Text variant="h3" numberOfLines={3}>
            {title}
          </Text>
          <Text variant="bodySmall" color="textSecondary" numberOfLines={2}>
            {kind}
          </Text>
        </View>
      </PressableScale>
    </Link>
  );
}

/** A name with case, spaces and punctuation taken out, for "is it exactly this". */
function squash(text: string): string {
  /* No `\p{…}` (CLAUDE.md § Discovery): spaces and common punctuation only. */
  return text.toLowerCase().replace(/[\s.,:;!?'’"()\-–—_&+]+/g, '');
}

const styles = StyleSheet.create({
  page: { gap: Spacing.x32, paddingTop: Spacing.x8 },
  settling: { opacity: 0.6 },
  inset: { paddingHorizontal: Spacing.x16 },
  rail: { flexGrow: 0 },
  railRow: { paddingHorizontal: Spacing.x16, gap: Spacing.x12 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x16,
    padding: Spacing.x12,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: withAlpha(Palette.white, 0.07),
  },
  topWords: { flex: 1, gap: Spacing.x4 },
});
