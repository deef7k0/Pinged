import type { Game } from '../games';
import { supabase } from '../supabase';
import { cacheGame, likeLiteral } from './core';
import type { GameList, ListCover, ListKind, ListSummary, ListWithItems, Tier } from './types';

function unwrap<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error('No data returned');
  return data;
}

/**
 * Row shape shared by every query that builds a `ListSummary`.
 *
 * Exported with `SUMMARY_ITEMS` and `resolvePreview` because `discover.ts`
 * builds the same summaries; this was restated in four places and the copies
 * drifted the moment a column was added.
 */
export type SummaryRow = GameList & {
  items: { position: number; game_id: string; game: ListCover | null }[];
  owner: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
};

/**
 * The embedded select every summary query needs. Compose it into a `select()`.
 *
 * The owner is embedded rather than fetched per tile: a wall of collections
 * would otherwise be one profile request each. `lists_user_id_fkey` is declared
 * in `database.types.ts`, which is what lets supabase-js type this as the joined
 * row instead of `SelectQueryError` — see the note in CLAUDE.md.
 */
export const SUMMARY_ITEMS =
  'items:list_items(position, game_id, game:games(id, title, cover_url, hero_url)), ' +
  'owner:profiles!lists_user_id_fkey(username, display_name, avatar_url)';

/**
 * Pick the one cover a collection tile shows.
 *
 * The owner's choice wins. Falling back to the first item rather than to
 * nothing matters: every collection that existed before `cover_game_id` has a
 * null there, and a wall of empty tiles would look broken rather than
 * unconfigured. The `cover_game_id` lookup is defensive — a trigger already
 * clears it when the game leaves the list, but the tile should not depend on
 * that having run.
 */
export function resolvePreview(row: SummaryRow): ListCover | null {
  const items = (row.items ?? []).slice().sort((a, b) => a.position - b.position);
  if (items.length === 0) return null;

  const chosen = row.cover_game_id
    ? items.find((item) => item.game_id === row.cover_game_id)
    : undefined;

  return (chosen ?? items[0]).game ?? null;
}

/** How many covers a summary carries: five, of which a collection's row shows four (`<ListTile>`). */
const STACK_COVERS = 5;

/**
 * The covers a tile stacks: up to five, the one in front first.
 *
 * Free: `SUMMARY_ITEMS` already embeds every item's cover so `resolvePreview`
 * can pick one, so this reads from data the query was fetching anyway. Returns
 * however many exist — one, two or three games give a shorter stack, and the
 * tile lays out whatever it is handed rather than padding with placeholders.
 *
 * **The first is `resolvePreview`'s cover** — the one the owner chose, or the
 * first game — and the rest follow in `position` order. The stack draws its
 * first cover whole and in front, and that has to be the game the collection's
 * own screen opens on: tapping a tile lands on the same game it was showing.
 *
 * It was `resolveMosaic`: the first four in order, for a 2×2 picture of them.
 * The mosaic was removed from the app at the owner's direction; a collection is
 * one cover on its own screen and a stack everywhere it is listed.
 */
export function resolveStack(row: SummaryRow): ListCover[] {
  const covers = (row.items ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((item) => item.game)
    .filter((game): game is ListCover => game !== null);

  const front = resolvePreview(row);
  if (!front) return covers.slice(0, STACK_COVERS);

  return [front, ...covers.filter((cover) => cover.id !== front.id)].slice(0, STACK_COVERS);
}

const SUMMARY_SELECT = `*, ${SUMMARY_ITEMS}`;

/**
 * One row → one summary.
 *
 * The three lines this replaces were written out at every call site, which is
 * the drift `SummaryRow`'s own docblock warns about: the tile's covers were
 * added to two of them and forgotten in the third, and the collection tiles on
 * that screen drew a single cover until somebody noticed.
 */
function toSummary(row: SummaryRow): ListSummary {
  return {
    ...row,
    itemCount: row.items?.length ?? 0,
    preview: resolvePreview(row),
    stack: resolveStack(row),
  };
}

export async function getLists(userId: string): Promise<ListSummary[]> {
  const { data, error } = await supabase
    .from('lists')
    .select(SUMMARY_SELECT)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);

  return ((data ?? []) as SummaryRow[]).map(toSummary);
}

/**
 * The list kinds that count as "a collection this game is in".
 *
 * **`favorites` and `wishlist` are deliberately out.** Both are singleton lists
 * a toggle writes to — the heart and the bookmark on the game page's action row
 * — so counting them would turn "In 17 collections" into a wishlist counter, and
 * on a popular game it would be nothing else: a shelf somebody *built* is rarer
 * than a game somebody meant to buy by two orders of magnitude. Tapping through
 * would then be a list of four hundred rows all called "Wishlist".
 *
 * The other four are all authored — a plain collection, a tier list, an award
 * show, a captioned board — and each one is somebody's argument about where this
 * game belongs, which is the fact the strip is claiming.
 */
const SHELF_KINDS: readonly ListKind[] = ['list', 'tier', 'awards', 'captioned'];

/**
 * How many authored collections hold this game.
 *
 * A `head` request: the strip prints one integer and has no use for the rows, so
 * this is a `COUNT(*)` over the join and no payload at all. The sheet behind it
 * fetches the collections themselves, and only when it opens.
 *
 * `lists!inner(kind)` is the join — `list_items` carries no `kind`, and an
 * outer embed would count rows whose list was filtered out. The embed is
 * selected purely so the filter below has something to filter *on*; `head: true`
 * means none of it crosses the wire.
 */
export async function getGameListCount(gameId: string): Promise<number> {
  const { count, error } = await supabase
    .from('list_items')
    .select('list_id, lists!inner(kind)', { count: 'exact', head: true })
    .eq('game_id', gameId)
    .in('lists.kind', SHELF_KINDS);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Which collections hold this game, most recently added first.
 *
 * ## Two round trips, on purpose
 *
 * The membership lives on `list_items` and everything a tile draws lives on
 * `lists` — the title, the owner, and the covers its stack is made of. Asking
 * from the `list_items` side with a filtered embed (`lists!inner(…,
 * items:list_items(…))`) is one request and returns the wrong thing: PostgREST
 * applies the `game_id` filter to the *inner* embed too, so every collection
 * comes back holding exactly one item — this game — and every stack collapses
 * to a single cover.
 *
 * So: the ids, then the summaries. Both are indexed lookups, it happens once
 * when a sheet opens, and the alternative is a correct-looking query that
 * silently ruins the artwork.
 *
 * Capped, because a much-loved game can be on thousands of shelves. The caller
 * has the exact figure from `getGameListCount` and can say so.
 */
export async function getGameLists(gameId: string, limit = 50): Promise<ListSummary[]> {
  const { data: rows, error } = await supabase
    .from('list_items')
    .select('list_id, added_at, lists!inner(kind)')
    .eq('game_id', gameId)
    .in('lists.kind', SHELF_KINDS)
    .order('added_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  /* `added_at` order, deduped. A list cannot hold the same game twice — the
     primary key is `(list_id, game_id)` — so the Set is belt and braces, and it
     is cheap insurance against a future kind that relaxes that. */
  const ids = [...new Set((rows ?? []).map((row) => row.list_id))];
  if (ids.length === 0) return [];

  const { data, error: summaryError } = await supabase
    .from('lists')
    .select(SUMMARY_SELECT)
    .in('id', ids);

  if (summaryError) throw new Error(summaryError.message);

  /* `in()` returns rows in whatever order Postgres found them, which is not the
     recency order the ids were fetched in. Re-imposing it here rather than
     ordering in SQL: the sort key lives on the *other* table. */
  const rank = new Map(ids.map((id, index) => [id, index]));

  return ((data ?? []) as SummaryRow[])
    .map(toSummary)
    .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
}

/**
 * Choose which game's cover represents a collection.
 *
 * `gameId` must already be in the list — migration 0014 enforces that with a
 * trigger rather than trusting the client, so passing a game that is not in it
 * raises instead of silently storing a dangling reference. Pass null to go back
 * to the default (the first item).
 *
 * This is the whole of a collection's artwork setting now. There was a second
 * one beside it — four covers or one, `lists.cover_style` (0033) — and it went
 * with the mosaic: a collection is always one cover on its own screen, so the
 * only question left is which.
 */
export async function setListCover(listId: string, gameId: string | null): Promise<void> {
  const { error } = await supabase.from('lists').update({ cover_game_id: gameId }).eq('id', listId);

  if (error) throw new Error(error.message);
}

export async function getList(listId: string): Promise<ListWithItems | null> {
  const { data, error } = await supabase
    .from('lists')
    .select('*, items:list_items(*, game:games(*))')
    .eq('id', listId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const list = data as ListWithItems;
  list.items?.sort((a, b) => a.position - b.position);
  return list;
}

export async function createList(
  userId: string,
  input: { title: string; description?: string | null; kind?: ListKind; isRanked?: boolean }
): Promise<string> {
  const title = input.title.trim();
  if (!title) throw new Error('Give the list a title.');

  const { data, error } = await supabase
    .from('lists')
    .insert({
      user_id: userId,
      title,
      description: input.description?.trim() || null,
      kind: input.kind ?? 'list',
      is_ranked: input.isRanked ?? false,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}

/**
 * Rename a collection, or rewrite what it says about itself.
 *
 * Title and description only. `kind` and `is_ranked` are deliberately not here:
 * a tier list whose items carry tiers cannot become a plain collection without
 * deciding what happens to those tiers, and an award show's rows exist in
 * `list_awards` before they exist in `list_items` — flipping either one is a
 * migration of the collection's contents, not an edit to its details, and a
 * settings field that silently discarded data would be the worst way to offer
 * it.
 *
 * `.eq('user_id', userId)` belts the RLS policy's braces. The policy is what
 * actually enforces this; the filter is what makes a non-owner's attempt come
 * back as "nothing matched" instead of a permission error.
 */
export async function updateListDetails(
  userId: string,
  listId: string,
  input: { title: string; description?: string | null }
): Promise<void> {
  const title = input.title.trim();
  if (!title) throw new Error('Give the collection a title.');

  const { error } = await supabase
    .from('lists')
    .update({
      title,
      description: input.description?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listId)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}

/**
 * Write the caption under a game in a captioned collection.
 *
 * Stored in `list_items.note`, which has held a 300-character text field since
 * 0003 and never had a consumer — see migration 0019 for why the caption reuses
 * it rather than adding a column.
 *
 * An empty string clears it rather than storing `''`. A caption is the whole
 * point of the row in this kind of list, so "no caption" has to be a state the
 * grid can detect and prompt for, and `null` is that state.
 */
export async function setItemCaption(
  listId: string,
  gameId: string,
  caption: string | null
): Promise<void> {
  const trimmed = caption?.trim();

  const { error } = await supabase
    .from('list_items')
    .update({ note: trimmed || null })
    .eq('list_id', listId)
    .eq('game_id', gameId);

  if (error) throw new Error(error.message);
}

export async function deleteList(userId: string, listId: string): Promise<void> {
  const { error } = await supabase.from('lists').delete().eq('id', listId).eq('user_id', userId);
  if (error) throw new Error(error.message);
}

/**
 * Fetch the user's singleton list of a given kind, creating it on first use.
 *
 * Favourites and wishlist are one-per-user (enforced by a partial unique index)
 * and should always exist from the UI's point of view, so this hides the
 * "does it exist yet" question from callers.
 */
export async function getOrCreateSingletonList(
  userId: string,
  kind: 'favorites' | 'wishlist'
): Promise<GameList> {
  const { data, error } = await supabase
    .from('lists')
    .select('*')
    .eq('user_id', userId)
    .eq('kind', kind)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data) return data;

  const { data: created, error: createError } = await supabase
    .from('lists')
    .insert({
      user_id: userId,
      title: kind === 'favorites' ? 'Favourites' : 'Wishlist',
      kind,
      is_ranked: kind === 'favorites',
    })
    .select('*')
    .single();

  if (createError) throw new Error(createError.message);
  return created;
}

/**
 * How many games Favourites holds: a person's Top 10. The profile pins the
 * first four. 0047's trigger holds the database to the same number.
 */
export const FAVOURITES_MAX = 10;

/** Favourites, ready for the four-poster identity row. */
export async function getFavorites(userId: string): Promise<ListWithItems | null> {
  const { data, error } = await supabase
    .from('lists')
    .select('*, items:list_items(*, game:games(*))')
    .eq('user_id', userId)
    .eq('kind', 'favorites')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const list = data as ListWithItems;
  list.items?.sort((a, b) => a.position - b.position);
  return list;
}

export async function addToList(
  listId: string,
  game: Game,
  options?: { position?: number; tier?: Tier | null; note?: string | null }
): Promise<void> {
  // list_items has an FK to games, so the cache row must exist first.
  await cacheGame(game);

  const { error } = await supabase.from('list_items').upsert(
    {
      list_id: listId,
      game_id: game.id,
      position: options?.position ?? 0,
      tier: options?.tier ?? null,
      note: options?.note ?? null,
    },
    { onConflict: 'list_id,game_id' }
  );
  if (error) throw new Error(error.message);
}

/**
 * Add a game to the end of a list.
 *
 * `addToList` defaults `position` to 0, which is right for a wishlist toggle and
 * wrong for a curated collection: every game added that way lands in the same
 * slot and the stored order becomes whatever Postgres felt like. Counting first
 * costs one HEAD request and keeps a ranked list's numbering meaningful.
 *
 * Re-adding an existing game is a no-op rather than an error — `addToList`
 * upserts on `(list_id, game_id)` — so a caller does not have to check
 * membership first to stay safe.
 */
export async function appendToList(listId: string, game: Game): Promise<void> {
  const { count } = await supabase
    .from('list_items')
    .select('*', { count: 'exact', head: true })
    .eq('list_id', listId);

  await addToList(listId, game, { position: count ?? 0 });
}

export async function removeFromList(listId: string, gameId: string): Promise<void> {
  const { error } = await supabase
    .from('list_items')
    .delete()
    .eq('list_id', listId)
    .eq('game_id', gameId);
  if (error) throw new Error(error.message);
}

/**
 * Take several games off a list in one request — the collection screen's
 * "Remove from collection (3 selected)".
 *
 * One `delete … where game_id in (…)` rather than a request per game, so a
 * selection of twenty leaves together or not at all as far as the reader can
 * tell. `.in()` is safe here: these are the app's own game ids (`igdb:1234`),
 * not text somebody typed — the case `inList()` in `lib/postgrest.ts` exists for.
 *
 * Never call this for an award show: its `list_items` rows are written by a
 * trigger from the ballot (0016), and the collection screen does not offer the
 * selection there.
 */
export async function removeManyFromList(
  listId: string,
  gameIds: readonly string[]
): Promise<void> {
  if (gameIds.length === 0) return;

  const { error } = await supabase
    .from('list_items')
    .delete()
    .eq('list_id', listId)
    .in('game_id', [...gameIds]);
  if (error) throw new Error(error.message);
}

/**
 * Persist a new ordering (and tier assignment) after a drag.
 *
 * Sent as one upsert rather than N updates so a reorder is a single round trip.
 */
export async function reorderList(
  listId: string,
  items: { gameId: string; position: number; tier?: Tier | null }[]
): Promise<void> {
  if (items.length === 0) return;

  const { error } = await supabase.from('list_items').upsert(
    items.map((item) => ({
      list_id: listId,
      game_id: item.gameId,
      position: item.position,
      tier: item.tier ?? null,
    })),
    { onConflict: 'list_id,game_id' }
  );
  if (error) throw new Error(error.message);
}

/** Whether a game sits in the user's favourites / wishlist — for toggle buttons. */
export async function getListMembership(
  userId: string,
  gameId: string
): Promise<{ favorited: boolean; wishlisted: boolean }> {
  const { data, error } = await supabase
    .from('list_items')
    .select('list_id, lists!inner(user_id, kind)')
    .eq('game_id', gameId)
    .eq('lists.user_id', userId);

  if (error) throw new Error(error.message);

  type Row = { lists: { kind: string } | { kind: string }[] };
  const kinds = new Set<string>();
  for (const row of (data ?? []) as Row[]) {
    const list = Array.isArray(row.lists) ? row.lists[0] : row.lists;
    if (list?.kind) kinds.add(list.kind);
  }

  return { favorited: kinds.has('favorites'), wishlisted: kinds.has('wishlist') };
}

/** Add/remove a game from a singleton list, creating the list if needed. */
export async function toggleSingletonMembership(
  userId: string,
  kind: 'favorites' | 'wishlist',
  game: Game,
  member: boolean
): Promise<void> {
  const list = await getOrCreateSingletonList(userId, kind);

  if (!member) {
    await removeFromList(list.id, game.id);
    return;
  }

  // Append to the end rather than colliding at position 0.
  const { count } = await supabase
    .from('list_items')
    .select('*', { count: 'exact', head: true })
    .eq('list_id', list.id);

  /* Favourites holds ten — the Top 10 (the owner's, 2026-11-03). 0047 says
     the same in the database; this says it before a request is spent. */
  if (kind === 'favorites' && (count ?? 0) >= FAVOURITES_MAX) {
    throw new Error('Your favourites hold ten games. Take one off first.');
  }

  await addToList(list.id, game, { position: count ?? 0 });
}

/** Longest title query worth sending — the same cap a people search has. */
const LIST_QUERY_MAX = 60;

/**
 * Collections by title, for Search.
 *
 * The four authored kinds (`SHELF_KINDS`) and never a favourites list or a
 * wishlist: those are per-user state with the same fixed title on every
 * account, and a search for "wish" would otherwise return everybody's.
 *
 * Ranked here, as people are and for the same reason: relevance to a typed word
 * is not a column, so Postgres hands back an arbitrary thirty of the matches.
 * An exact title leads, then titles that start with the term, then the rest —
 * and inside each of those the collection with more in it, since an empty
 * collection that happens to match is a draft.
 */
export async function searchLists(query: string, signal?: AbortSignal): Promise<ListSummary[]> {
  const trimmed = query.trim().slice(0, LIST_QUERY_MAX);
  if (!trimmed) return [];

  const request = supabase
    .from('lists')
    .select(SUMMARY_SELECT)
    .in('kind', SHELF_KINDS)
    .ilike('title', `%${likeLiteral(trimmed)}%`)
    .order('updated_at', { ascending: false })
    .limit(60);

  const { data, error } = await (signal ? request.abortSignal(signal) : request);
  if (error) throw new Error(error.message);

  const needle = trimmed.toLowerCase();
  const rank = (title: string) => {
    const lowered = title.toLowerCase();
    if (lowered === needle) return 0;
    if (lowered.startsWith(needle)) return 1;
    return 2;
  };

  return ((data ?? []) as unknown as SummaryRow[])
    .map(toSummary)
    .sort((a, b) => rank(a.title) - rank(b.title) || b.itemCount - a.itemCount)
    .slice(0, 30);
}

/**
 * The newest collections — authored ones (`SHELF_KINDS`), never a favourites
 * list or a wishlist — a page at a time: Search's "Latest collections".
 *
 * Newest by `created_at`, and only those with a game in them: a collection
 * made a minute ago and still empty is a draft, not news. `list_items!inner`
 * is what leaves those out — PostgREST cannot filter on an embedded count,
 * and an inner embed keeps only the collections that have a row there
 * (verified against the live project: the empty one is dropped, the rest keep
 * every item). `before` is the last tile's `created_at`.
 */
export async function getLatestCollections({
  before = null,
  limit = 20,
}: {
  before?: string | null;
  limit?: number;
} = {}): Promise<ListSummary[]> {
  let query = supabase
    .from('lists')
    .select(SUMMARY_SELECT.replace('items:list_items(', 'items:list_items!inner('))
    .in('kind', SHELF_KINDS)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (before) query = query.lt('created_at', before);

  const { data, error } = await query;
  return unwrap(data as SummaryRow[] | null, error).map(toSummary);
}

export async function getPublicLists(limit = 30): Promise<ListSummary[]> {
  const { data, error } = await supabase
    .from('lists')
    .select(SUMMARY_SELECT)
    .eq('kind', 'list')
    .order('updated_at', { ascending: false })
    .limit(limit);

  return unwrap(data as SummaryRow[] | null, error).map(toSummary);
}
