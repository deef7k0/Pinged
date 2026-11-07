import { periodStart, type ChartPeriod, type MemberActivity } from '../discovery';
import { resolvePreview, resolveStack, SUMMARY_ITEMS, type SummaryRow } from './lists';
import { getEngagement } from './engagement';
import { rememberLogs } from './seen-logs';
import type { ListSummary } from './types';
import type { CachedGame, LogStatus, LogWithRelations, Profile } from '../database.types';
import { hasWriting } from '../review-quote';
import { supabase } from '../supabase';
import type { ChartEntry } from '../top-chart';

/**
 * The Reviews / Collections / People tabs.
 *
 * **Two generations of ranking live here.** 0013's functions (`popular_reviews`,
 * `popular_users`…) count every like there has ever been. 0038's
 * (`review_popularity`, `member_popularity`) count activity inside a period,
 * optionally among the viewer's circle and in the languages they read — how
 * Letterboxd's API documents its own (CLAUDE.md § Discovery). The newer ones
 * are what the screens ask for; the older ones are what they fall back to on a
 * database that has not run 0038, so they stay.
 *
 * Every function here is two round trips on purpose. The 0013 functions answer
 * only "which ids, in what order, with what number" — PostgREST cannot order a
 * resource by an aggregate over an embedded one, so the ranking has to happen
 * in SQL — and then the rows themselves come back through the same selects and
 * embeds the rest of the app uses. The alternative was composing
 * `LogWithRelations` inside a SQL function, which is a second definition of
 * what a review is, in a language where nothing would tell us when it drifted.
 *
 * Postgres does not promise to preserve the function's ordering through the
 * follow-up `in (…)` query, so every one of these re-sorts in memory against
 * the rank it asked for. Do not remove those sorts: they look redundant right
 * up until a query plan changes.
 */

function unwrap<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error('No data returned');
  return data;
}

const LOG_WITH_RELATIONS = '*, game:games(*), profile:profiles(*)';

/** A ranked row plus the number it was ranked by, so the UI can show its reason. */
export type Ranked<T, K extends string> = T & Record<K, number>;

export type PopularReview = Ranked<LogWithRelations, 'likeCount'>;
export type PopularCollection = Ranked<ListSummary, 'likeCount'>;
export type RankedProfile = Profile & {
  /** Whichever number this person was ranked by; the caller knows which. */
  metric: number;
  /** Only set by `getRecommendedPeople` — 0-1 agreement on shared games. */
  affinity?: number;
};

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export async function getPopularReviews(limit = 20): Promise<PopularReview[]> {
  const ranking = await supabase.rpc('popular_reviews', { p_limit: limit });
  const ranked = unwrap(ranking.data, ranking.error);
  if (ranked.length === 0) return [];

  const likesById = new Map(ranked.map((row) => [row.log_id, Number(row.like_count)]));

  const { data, error } = await supabase
    .from('logs')
    .select(LOG_WITH_RELATIONS)
    .in(
      'id',
      ranked.map((row) => row.log_id)
    );

  return rememberLogs(unwrap(data as LogWithRelations[] | null, error))
    .map((log) => ({ ...log, likeCount: likesById.get(log.id) ?? 0 }))
    .sort((a, b) => b.likeCount - a.likeCount);
}

/** PostgREST's code for "no function of that name": the database predates it. */
const NO_SUCH_FUNCTION = 'PGRST202';

function isMissingFunction(error: { code?: string; message: string }): boolean {
  return error.code === NO_SUCH_FUNCTION || /could not find the function/i.test(error.message);
}

/**
 * The Reviews chart: what it holds, and whether it could be asked for a period.
 *
 * `windowed` is false on a database that has not run 0038. The reviews are
 * then 0013's — every like there has ever been, in any language, and as many
 * from one author as they have written — and the screen says so by not
 * offering a period it could not honour.
 */
export type ReviewChart = {
  reviews: LogWithRelations[];
  windowed: boolean;
};

/**
 * The reviews people responded to most in a period, for somebody who reads
 * `reading` (null: every language).
 *
 * `review_popularity` (0038) does the counting — likes and the people who
 * commented, since the period began, every author's best before anybody's
 * second — and answers ids in order. **That order is kept, not re-derived**:
 * it is not the order of the activity number (an author's second review comes
 * after everybody's first, whatever it scored), so sorting by the number here
 * would undo the one rule that stops one person from being the chart.
 */
export async function getReviewChart(
  period: ChartPeriod,
  reading: readonly string[] | null,
  limit = 20
): Promise<ReviewChart> {
  const ranking = await supabase.rpc('review_popularity', {
    p_since: periodStart(period),
    p_langs: reading ? [...reading] : null,
    p_limit: limit,
  });

  if (ranking.error) {
    if (isMissingFunction(ranking.error)) {
      return { reviews: await getPopularReviews(limit), windowed: false };
    }
    throw new Error(ranking.error.message);
  }

  const ranked = ranking.data ?? [];
  if (ranked.length === 0) return { reviews: [], windowed: true };

  const place = new Map(ranked.map((row, index) => [row.log_id, index]));

  const { data, error } = await supabase
    .from('logs')
    .select(LOG_WITH_RELATIONS)
    .in(
      'id',
      ranked.map((row) => row.log_id)
    );

  return {
    reviews: rememberLogs(unwrap(data as LogWithRelations[] | null, error)).sort(
      (a, b) => (place.get(a.id) ?? 0) - (place.get(b.id) ?? 0)
    ),
    windowed: true,
  };
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export async function getPopularCollections(limit = 20): Promise<PopularCollection[]> {
  const ranking = await supabase.rpc('popular_collections', { p_limit: limit });
  const ranked = unwrap(ranking.data, ranking.error);
  if (ranked.length === 0) return [];

  const likesById = new Map(ranked.map((row) => [row.list_id, Number(row.like_count)]));

  const { data, error } = await supabase
    .from('lists')
    .select(`*, profile:profiles(*), ${SUMMARY_ITEMS}`)
    .in(
      'id',
      ranked.map((row) => row.list_id)
    );

  return unwrap(data as SummaryRow[] | null, error)
    .map((row) => ({
      ...row,
      itemCount: row.items?.length ?? 0,
      preview: resolvePreview(row),
      stack: resolveStack(row),
      likeCount: likesById.get(row.id) ?? 0,
    }))
    .sort((a, b) => b.likeCount - a.likeCount);
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

/** Shared tail: turn `(id, metric)` pairs into profiles in the same order. */
async function profilesFor(
  ranked: { user_id: string; metric: number; affinity?: number }[]
): Promise<RankedProfile[]> {
  if (ranked.length === 0) return [];

  const byId = new Map(ranked.map((row) => [row.user_id, row]));

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in(
      'id',
      ranked.map((row) => row.user_id)
    );

  return unwrap(data as Profile[] | null, error)
    .map((profile) => ({
      ...profile,
      metric: byId.get(profile.id)?.metric ?? 0,
      affinity: byId.get(profile.id)?.affinity,
    }))
    .sort((a, b) => b.metric - a.metric);
}

/** Most reviews written. Volume. */
export async function getTopReviewers(limit = 20): Promise<RankedProfile[]> {
  const { data, error } = await supabase.rpc('top_reviewers', { p_limit: limit });
  return profilesFor(
    unwrap(data, error).map((row) => ({ user_id: row.user_id, metric: Number(row.review_count) }))
  );
}

/** Most likes received across reviews and posts. Reception. */
export async function getPopularPeople(limit = 20): Promise<RankedProfile[]> {
  const { data, error } = await supabase.rpc('popular_users', { p_limit: limit });
  return profilesFor(
    unwrap(data, error).map((row) => ({ user_id: row.user_id, metric: Number(row.like_count) }))
  );
}

/**
 * People with similar taste: the same games logged, scored the same way.
 *
 * Ranked by shared games — the headline number a reader can check — while the
 * SQL orders by overlap × agreement, so somebody who agrees strongly about ten
 * games can outrank somebody who merely played twelve of the same.
 */
export async function getRecommendedPeople(viewerId: string, limit = 20): Promise<RankedProfile[]> {
  const { data, error } = await supabase.rpc('recommended_users', {
    p_viewer: viewerId,
    p_limit: limit,
  });
  return profilesFor(
    unwrap(data, error).map((row) => ({
      user_id: row.user_id,
      metric: Number(row.shared_games),
      affinity: Number(row.affinity),
    }))
  );
}

/** Somebody in a popularity chart, with what put them there. */
export type PopularMember = Profile & MemberActivity & { activity: number };

/**
 * The people whose reviews and collections drew the most in a period — or
 * `null` on a database that has not run 0038.
 *
 * `member_popularity` counts likes, the people who commented, and new
 * followers, all from somebody else, and never returns `viewerId` to
 * themselves.
 *
 * **With `circle`**, the same count is taken among the viewer's circle only,
 * and the circle is left out of the answer: not "who is popular" but "who do
 * the people I follow follow, like and talk to, that I do not follow yet".
 * Letterboxd's `MemberPopularityWithFriends`. It needs a viewer.
 *
 * `reading` leaves out somebody only when every review of theirs that has a
 * language is in another one.
 */
export async function getPopularMembers({
  period,
  viewerId,
  circle = false,
  reading,
  limit = 20,
}: {
  period: ChartPeriod;
  viewerId: string | null;
  circle?: boolean;
  reading: readonly string[] | null;
  limit?: number;
}): Promise<PopularMember[] | null> {
  if (circle && !viewerId) return [];

  const ranking = await supabase.rpc('member_popularity', {
    p_since: periodStart(period),
    p_viewer: viewerId,
    p_circle: circle,
    p_langs: reading ? [...reading] : null,
    p_limit: limit,
  });

  if (ranking.error) {
    if (isMissingFunction(ranking.error)) return null;
    throw new Error(ranking.error.message);
  }

  const ranked = ranking.data ?? [];
  if (ranked.length === 0) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in(
      'id',
      ranked.map((row) => row.user_id)
    );
  const byId = new Map(unwrap(data as Profile[] | null, error).map((row) => [row.id, row]));

  /* In the function's order: activity, then followers, then a stable id. */
  return ranked.flatMap((row) => {
    const profile = byId.get(row.user_id);
    return profile
      ? [
          {
            ...profile,
            activity: Number(row.activity),
            likes: Number(row.likes),
            comments: Number(row.comments),
            followers: Number(row.followers),
          },
        ]
      : [];
  });
}

// ---------------------------------------------------------------------------
// The people you follow
// ---------------------------------------------------------------------------

/**
 * Everybody a person counts as theirs: the people they follow, and their
 * accepted friends.
 *
 * Two tables because they are two relationships — a follow is one-way and
 * needs nobody's agreement, a friendship is a request somebody accepted (0005)
 * — and "from your friends" on a game's page, and "New from friends" on Home,
 * mean either. Two small requests, in parallel.
 */
export async function getCircleIds(viewerId: string): Promise<string[]> {
  const [follows, friends] = await Promise.all([
    supabase.from('follows').select('following_id').eq('follower_id', viewerId),
    supabase
      .from('friendships')
      .select('user_a, user_b')
      .eq('status', 'accepted')
      .or(`user_a.eq.${viewerId},user_b.eq.${viewerId}`),
  ]);

  if (follows.error) throw new Error(follows.error.message);
  /* A database without 0005 has no friendships to add; the follows still stand. */
  const friendRows = friends.error ? [] : (friends.data ?? []);

  const ids = new Set<string>();
  for (const row of follows.data ?? []) ids.add(row.following_id);
  for (const row of friendRows) ids.add(row.user_a === viewerId ? row.user_b : row.user_a);
  ids.delete(viewerId);
  return [...ids];
}

// ---------------------------------------------------------------------------
// Home: new from friends
// ---------------------------------------------------------------------------

/**
 * What Home's row of people's activity holds, and whose it is.
 *
 * `scope` is the row's heading: `friends` when the people the viewer follows
 * have logged something, `everyone` when they have not — or there are none —
 * and the row falls back to the rest of GameLog. Never both, and never
 * blended: the owner's ruling (2026-10-09) is one row that is honest about
 * whose it is.
 */
export type HomeActivity = {
  scope: 'friends' | 'everyone';
  logs: LogWithRelations[];
};

/**
 * The newest games people scored or wrote about — the viewer's circle first.
 *
 * It replaced `getHomeReviews`, which returned written reviews only, as two
 * lists of cards. This is a row of covers with a face under each, so a score
 * with no words belongs in it too: what a friend thought of a game is news
 * whether or not they explained it. A log with neither a score nor a review —
 * a game put on the backlog — is a status change and stays out.
 *
 * The viewer's own logs are never in it. Whole rows (`LOG_WITH_RELATIONS`), so
 * a review opens from the row without being fetched again.
 */
export async function getHomeActivity(viewerId: string, limit = 20): Promise<HomeActivity> {
  const circle = await getCircleIds(viewerId);

  const said = () =>
    supabase
      .from('logs')
      .select(LOG_WITH_RELATIONS)
      .or('rating.not.is.null,review.not.is.null,review_title.not.is.null')
      .neq('user_id', viewerId)
      .order('created_at', { ascending: false })
      .limit(limit);

  /* An empty review is not a null one, and a row holding only that says nothing.
     The review's one sentence is words too (0040). */
  const worthShowing = (rows: LogWithRelations[]) =>
    rows.filter((log) => log.rating !== null || hasWriting(log));

  if (circle.length > 0) {
    const friends = await said().in('user_id', circle);
    if (friends.error) throw new Error(friends.error.message);

    const logs = worthShowing(rememberLogs((friends.data ?? []) as LogWithRelations[]));
    if (logs.length > 0) return { scope: 'friends', logs };
  }

  const everyone = await said();
  if (everyone.error) throw new Error(everyone.error.message);

  return {
    scope: 'everyone',
    logs: worthShowing(rememberLogs((everyone.data ?? []) as LogWithRelations[])),
  };
}

// ---------------------------------------------------------------------------
// A game's page: who played it
// ---------------------------------------------------------------------------

/** The statuses that mean somebody has played a game. A backlog entry has not. */
const PLAYED_STATUSES: LogStatus[] = ['playing', 'played', 'paused', 'dropped'];

/** How many faces each of the two squares shows. */
const PLAYER_FACES = 2;

/** One person who played a game, as much as a face and a score need. */
export type GamePlayer = {
  userId: string;
  username: string | null;
  name: string;
  avatarUrl: string | null;
  /** 0-100, or null when they logged it without scoring it. */
  rating: number | null;
  status: LogStatus;
};

export type GamePlayers = {
  /** Everybody but the viewer who played it. */
  total: number;
  recent: GamePlayer[];
  /** Of those, the ones in the viewer's circle. */
  circleTotal: number;
  circle: GamePlayer[];
};

type PlayerRow = {
  user_id: string;
  rating: number | null;
  status: LogStatus;
  profile: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> | null;
};

const PLAYER_COLUMNS =
  'user_id, rating, status, profile:profiles(id, username, display_name, avatar_url)';

function toPlayer(row: PlayerRow): GamePlayer {
  return {
    userId: row.user_id,
    username: row.profile?.username ?? null,
    name: row.profile?.display_name?.trim() || row.profile?.username || 'Someone',
    avatarUrl: row.profile?.avatar_url ?? null,
    rating: row.rating,
    status: row.status,
  };
}

/**
 * Who played a game: the two most recent people, and the two most recent of
 * the viewer's circle — the game page's "Played by" and "From your friends".
 *
 * Played means playing, played, paused or dropped; a game on somebody's
 * backlog has not been played by them. The viewer is in neither list: these
 * are other people. Each count is exact and rides on the request that fetches
 * its two faces, so a square can say "214" without a second query.
 */
export async function getGamePlayers(
  gameId: string,
  viewerId: string | null
): Promise<GamePlayers> {
  const played = () => {
    const query = supabase
      .from('logs')
      .select(PLAYER_COLUMNS, { count: 'exact' })
      .eq('game_id', gameId)
      .in('status', PLAYED_STATUSES)
      .order('created_at', { ascending: false })
      .limit(PLAYER_FACES);
    return viewerId ? query.neq('user_id', viewerId) : query;
  };

  const circleIds = viewerId ? await getCircleIds(viewerId) : [];

  const [recent, circle] = await Promise.all([
    played(),
    circleIds.length > 0 ? played().in('user_id', circleIds) : Promise.resolve(null),
  ]);

  if (recent.error) throw new Error(recent.error.message);
  if (circle?.error) throw new Error(circle.error.message);

  return {
    total: recent.count ?? 0,
    recent: ((recent.data ?? []) as unknown as PlayerRow[]).map(toPlayer),
    circleTotal: circle?.count ?? 0,
    circle: ((circle?.data ?? []) as unknown as PlayerRow[]).map(toPlayer),
  };
}

/** At most this many friends' logs in the sheet: a circle, not a crowd. */
const FRIENDS_PLAYED_LIMIT = 100;

/** A friend's log of a game, with what the sheet prints under it. */
export type FriendPlay = {
  log: LogWithRelations;
  likes: number;
  likedByViewer: boolean;
};

export type FriendsPlayed = {
  /** Every person in the viewer's circle who played it. */
  total: number;
  /** Their logs, newest first — written reviews and plain logs alike. */
  plays: FriendPlay[];
};

/**
 * Which of the viewer's friends played a game — the game page's "friends who
 * played it" row and its sheet (the owner's, 2026-11-06, after Letterboxd's
 * "Friends who watched").
 *
 * Friends are the viewer's circle (`getCircleIds`: follows and accepted
 * friends), played is what "Played by" counts, and the viewer is not among
 * them. A log with writing carries its likes (`getEngagement`).
 */
export async function getFriendsWhoPlayed(
  gameId: string,
  viewerId: string | null
): Promise<FriendsPlayed> {
  if (!viewerId) return { total: 0, plays: [] };
  const circleIds = (await getCircleIds(viewerId)).filter((id) => id !== viewerId);
  if (circleIds.length === 0) return { total: 0, plays: [] };

  const { data, error, count } = await supabase
    .from('logs')
    .select(LOG_WITH_RELATIONS, { count: 'exact' })
    .eq('game_id', gameId)
    .in('status', PLAYED_STATUSES)
    .in('user_id', circleIds)
    .order('updated_at', { ascending: false })
    .limit(FRIENDS_PLAYED_LIMIT);
  if (error) throw new Error(error.message);

  const logs = rememberLogs((data as LogWithRelations[] | null) ?? []);
  const written = logs.filter(hasWriting).map((log) => log.id);
  const engagement = await getEngagement('log', written, viewerId);

  return {
    total: count ?? logs.length,
    plays: logs.map((log) => ({
      log,
      likes: engagement[log.id]?.likes ?? 0,
      likedByViewer: engagement[log.id]?.likedByViewer ?? false,
    })),
  };
}

// ---------------------------------------------------------------------------
// A game's page: how many want it, are playing it, have played it
// ---------------------------------------------------------------------------

/** Played it and not playing it now: finished, set down, or stopped. */
const PLAYED_BEFORE: LogStatus[] = ['played', 'paused', 'dropped'];

export type GameAudience = {
  /** People with the game on their wishlist. */
  wishlisted: number;
  /** People whose log says they are playing it now. */
  playing: number;
  /** People who have played it and are not playing it now. */
  played: number;
};

/**
 * How many people here want a game, are playing it, and have played it — the
 * game page's "On GameLog" figures, the owner's request (2026-10-16).
 *
 * Everybody's, the viewer's included: these are counts of the room, not the
 * faces in "Played by", which are other people. Three `head` requests in
 * parallel — a `COUNT(*)` each and no rows.
 *
 * - **Wishlisted** is the wishlist (the action row's bookmark): one list a
 *   person, so a row of `list_items` in one is one person. A backlog log is
 *   not counted here — that is a game somebody has, not one they want.
 * - **Playing** is the `playing` status.
 * - **Played** is played, paused or dropped: everybody who has played it and
 *   is not playing it right now, so the two never count one person twice and
 *   together they are the "Played by" square's total, plus the viewer.
 *
 * Unlike IGDB's popularity "Want to Play / Playing / Played", which are shares
 * of its own traffic (0.000042 for Disco Elysium, 2026-10-16) and not people.
 */
export async function getGameAudience(gameId: string): Promise<GameAudience> {
  const [wishlisted, playing, played] = await Promise.all([
    supabase
      .from('list_items')
      .select('list_id, lists!inner(kind)', { count: 'exact', head: true })
      .eq('game_id', gameId)
      .eq('lists.kind', 'wishlist'),
    supabase
      .from('logs')
      .select('user_id', { count: 'exact', head: true })
      .eq('game_id', gameId)
      .eq('status', 'playing'),
    supabase
      .from('logs')
      .select('user_id', { count: 'exact', head: true })
      .eq('game_id', gameId)
      .in('status', PLAYED_BEFORE),
  ]);

  for (const answer of [wishlisted, playing, played]) {
    if (answer.error) throw new Error(answer.error.message);
  }

  return {
    wishlisted: wishlisted.count ?? 0,
    playing: playing.count ?? 0,
    played: played.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Search: beloved by the community
// ---------------------------------------------------------------------------

/** The window "Beloved by the community" can be read over. */
export type BelovedPeriod = 'week' | 'month' | 'year';

const PERIOD_DAYS: Record<BelovedPeriod, number> = { week: 7, month: 30, year: 365 };

/** One game in the row: enough to draw its box, and what the people here gave it. */
export type BelovedGame = Pick<
  CachedGame,
  'id' | 'title' | 'cover_url' | 'hero_url' | 'edition_kind' | 'release_year'
> & {
  /**
   * GameLog's own average over the period, 0-100, **unrounded**: the
   * period's ratings weighted as the community score is (0041). Round it
   * where it is drawn.
   */
  average: number;
  ratings: number;
};

/**
 * The games rated highest on GameLog over a period, best first — or `null`
 * when the database has not run migration 0037.
 *
 * Two round trips, as everything here is: `beloved_games` answers which games,
 * in what order, with what average, and the covers come back through `games`.
 * The order is re-applied in memory afterwards (see the note at the top).
 *
 * `null` is not an error and not an empty period: the row is absent until the
 * function exists, where an empty array means "nobody scored a game this
 * week" and is said.
 */
export async function getBelovedGames(
  period: BelovedPeriod,
  limit = 20
): Promise<BelovedGame[] | null> {
  const since = new Date(Date.now() - PERIOD_DAYS[period] * 86_400_000).toISOString();

  const ranking = await supabase.rpc('beloved_games', { p_since: since, p_limit: limit });
  if (ranking.error) {
    if (isMissingFunction(ranking.error)) return null;
    throw new Error(ranking.error.message);
  }

  const ranked = ranking.data ?? [];
  if (ranked.length === 0) return [];

  const { data, error } = await supabase
    .from('games')
    .select('id, title, cover_url, hero_url, edition_kind, release_year')
    .in(
      'id',
      ranked.map((row) => row.game_id)
    );
  if (error) throw new Error(error.message);

  const byId = new Map((data ?? []).map((game) => [game.id, game]));

  return ranked.flatMap((row) => {
    const game = byId.get(row.game_id);
    return game ? [{ ...game, average: Number(row.average), ratings: Number(row.ratings) }] : [];
  });
}

// ---------------------------------------------------------------------------
// The Top 1000, by GameLog's members
// ---------------------------------------------------------------------------

/** One place in GameLog's ranking: the game, its score and how many gave one. */
export type GameLogRank = {
  gameId: string;
  /** 0-100, **unrounded** — the community score (0041), or the plain mean. */
  average: number;
  ratings: number;
};

/**
 * Every game rated on GameLog, best first, up to `TOP_CHART_SIZE` — or `null`
 * on a database without 0037.
 *
 * "Beloved by the community" over all time: the same function (`beloved_games`)
 * with the period opened to the beginning, so the chart and that row are one
 * rule — the community score as each game's average (0041 weights it, as the
 * game's own page does) and a damped figure for the order, so one 100 does not
 * top thirty 94s. One request, a column of ids and two numbers, ~50 KB at a
 * thousand games; the pages are slices of it (`getGameLogChartPage`).
 */
export async function getGameLogRanking(limit: number): Promise<GameLogRank[] | null> {
  const ranking = await supabase.rpc('beloved_games', {
    p_since: '1970-01-01T00:00:00Z',
    p_limit: limit,
  });
  if (ranking.error) {
    if (isMissingFunction(ranking.error)) return null;
    throw new Error(ranking.error.message);
  }
  return (ranking.data ?? []).map((row) => ({
    gameId: row.game_id,
    average: Number(row.average),
    ratings: Number(row.ratings),
  }));
}

/**
 * One page of GameLog's ranking, with each game's box and credit: the games
 * cache (`games`) for the slice's ids, in the ranking's order. A game the
 * cache has lost is left out rather than drawn as a blank.
 */
export async function getGameLogChartPage(
  slice: readonly GameLogRank[],
  firstRank: number
): Promise<ChartEntry[]> {
  if (slice.length === 0) return [];

  const { data, error } = await supabase
    .from('games')
    .select('id, title, cover_url, hero_url, edition_kind, release_year, developer')
    .in(
      'id',
      slice.map((row) => row.gameId)
    );
  if (error) throw new Error(error.message);

  const byId = new Map((data ?? []).map((game) => [game.id, game]));
  return slice.flatMap((row, index) => {
    const game = byId.get(row.gameId);
    return game
      ? [
          {
            rank: firstRank + index,
            id: game.id,
            title: game.title,
            coverUrl: game.cover_url,
            heroUrl: game.hero_url,
            edition: game.edition_kind,
            developer: game.developer,
            releaseYear: game.release_year,
            score: row.average,
            count: row.ratings,
          },
        ]
      : [];
  });
}
