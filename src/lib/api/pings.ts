import type {
  CachedGame,
  DirectPingKind,
  DirectPingRow,
  PingAudience,
  PingEra,
  PingFeedRow,
  PingLength,
  PingPlayers,
  PingStatus,
  PingSuggestionRow,
  Profile,
} from '../database.types';
import type { Game } from '../games';
import { DEFAULT_PING_AUDIENCE, PING_PAGE_SIZE, type PingCursor } from '../pings';
import { supabase } from '../supabase';
import { cacheGame } from './core';

/**
 * Pings (0046), both kinds: a request to the community — its feed, its
 * suggestions and its owner's controls — and a ping to a person, with the
 * setting that says who may send one.
 *
 * Every game a request or a suggestion names goes through `cacheGame` first,
 * because the tables reference `games` by the app's own id: the same id the
 * game page, a log, a list and a review use, so a suggested game is one tap
 * from being wishlisted, logged or collected like any other.
 */

/** "No such table / function": the database predates 0046. */
const NOT_MIGRATED = new Set(['PGRST202', 'PGRST205', '42P01', '42883']);

export const PINGS_NOT_READY = 'Pings arrive with the database’s next update.';

/** Thrown when the database has not run 0046, so a screen can say so once. */
export class PingsNotReadyError extends Error {
  constructor() {
    super(PINGS_NOT_READY);
    this.name = 'PingsNotReadyError';
  }
}

export function isPingsNotReady(error: unknown): boolean {
  return error instanceof PingsNotReadyError;
}

function fail(error: { code?: string; message: string }): never {
  if (NOT_MIGRATED.has(error.code ?? '')) throw new PingsNotReadyError();
  throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export type PingFeedMode = 'for_you' | 'latest' | 'mine';

export type PingFilters = {
  genre: string | null;
  platform: string | null;
  /** Only requests built on at least one game. */
  withRefs: boolean;
};

export const NO_PING_FILTERS: PingFilters = { genre: null, platform: null, withRefs: false };

/** A page of the feed, after `cursor` (the last row of the page before). */
export async function getPingFeed(
  mode: PingFeedMode,
  filters: PingFilters,
  cursor: PingCursor | null,
  limit: number = PING_PAGE_SIZE
): Promise<PingFeedRow[]> {
  const { data, error } = await supabase.rpc('ping_feed', {
    p_mode: mode,
    p_genre: mode === 'mine' ? null : filters.genre,
    p_platform: mode === 'mine' ? null : filters.platform,
    p_with_refs: mode === 'mine' ? false : filters.withRefs,
    p_cursor_tier: cursor?.tier ?? null,
    p_cursor_at: cursor?.created_at ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_limit: limit,
  });
  if (error) fail(error);
  return (data ?? []) as PingFeedRow[];
}

/** One request as its card draws it, whatever its status. Null when it is gone. */
export async function getPing(id: string): Promise<PingFeedRow | null> {
  const { data, error } = await supabase.rpc('ping_feed', { p_ping: id });
  if (error) fail(error);
  return ((data ?? []) as PingFeedRow[])[0] ?? null;
}

export type PingSuggestion = PingSuggestionRow & {
  profile: Profile | null;
  game: CachedGame | null;
};

/** Every suggestion on a request, oldest first, with who and which game. */
export async function getPingSuggestions(pingId: string): Promise<PingSuggestion[]> {
  const { data, error } = await supabase
    .from('ping_suggestions')
    .select('*, profile:profiles(*), game:games(*)')
    .eq('ping_id', pingId)
    .order('created_at', { ascending: true })
    .limit(300);
  if (error) fail(error);
  return (data ?? []) as unknown as PingSuggestion[];
}

/**
 * A game a request is built on. `game` is the full record when it was just
 * picked, so it can be cached first; null for one already on the request,
 * which is in `games` already.
 */
export type PingReference = {
  id: string;
  title: string;
  coverUrl: string | null;
  game: Game | null;
};

/** What the create and edit form hands over. */
export type PingDraft = {
  description: string;
  /** In the owner's order; at most three. */
  references: PingReference[];
  genres: string[];
  platforms: string[];
  playLength: PingLength | null;
  playerMode: PingPlayers | null;
  releaseEra: PingEra | null;
};

function draftColumns(draft: PingDraft) {
  return {
    description: draft.description.trim(),
    genres: draft.genres,
    platforms: draft.platforms,
    play_length: draft.playLength,
    player_mode: draft.playerMode,
    release_era: draft.releaseEra,
  };
}

async function cacheReferences(references: PingReference[]): Promise<void> {
  await Promise.all(references.flatMap((ref) => (ref.game ? [cacheGame(ref.game)] : [])));
}

async function writeReferences(pingId: string, references: PingReference[]): Promise<void> {
  if (references.length === 0) return;
  const { error } = await supabase
    .from('ping_reference_games')
    .insert(
      references.map((ref, index) => ({ ping_id: pingId, game_id: ref.id, sort_order: index }))
    );
  if (error) fail(error);
}

/** Publish a request. Returns its id. */
export async function createPing(userId: string, draft: PingDraft): Promise<string> {
  /* The games first: a request whose references failed to cache would be
     published without the games it is about. */
  await cacheReferences(draft.references);
  const { data, error } = await supabase
    .from('pings')
    .insert({ user_id: userId, ...draftColumns(draft) })
    .select('id')
    .single();
  if (error) fail(error);
  await writeReferences(data.id, draft.references);
  return data.id;
}

/**
 * Edit a request. Its games are replaced in one go — removed, then written in
 * the new order — because the order is part of what the owner wrote.
 */
export async function updatePing(pingId: string, draft: PingDraft): Promise<void> {
  await cacheReferences(draft.references);
  const { error } = await supabase.from('pings').update(draftColumns(draft)).eq('id', pingId);
  if (error) fail(error);
  const { error: clearError } = await supabase
    .from('ping_reference_games')
    .delete()
    .eq('ping_id', pingId);
  if (clearError) fail(clearError);
  await writeReferences(pingId, draft.references);
}

/** Open, found (optionally with the game that answered it) or closed. */
export async function setPingStatus(
  pingId: string,
  status: PingStatus,
  resolvedGameId: string | null = null
): Promise<void> {
  const { error } = await supabase
    .from('pings')
    .update({ status, resolved_game_id: status === 'found' ? resolvedGameId : null })
    .eq('id', pingId);
  if (error) fail(error);
}

export async function deletePing(pingId: string): Promise<void> {
  const { error } = await supabase.from('pings').delete().eq('id', pingId);
  if (error) fail(error);
}

/** Answer a request with a game, and why. */
export async function suggestGame(
  userId: string,
  pingId: string,
  game: Game,
  message: string | null
): Promise<void> {
  await cacheGame(game);
  const { error } = await supabase.from('ping_suggestions').insert({
    ping_id: pingId,
    user_id: userId,
    game_id: game.id,
    message: message?.trim() || null,
  });
  if (error) {
    if (error.code === '23505') throw new Error('You’ve already suggested that game here.');
    fail(error);
  }
}

export async function withdrawSuggestion(suggestionId: string): Promise<void> {
  const { error } = await supabase.from('ping_suggestions').delete().eq('id', suggestionId);
  if (error) fail(error);
}

/** The owner's "worth a look". */
export async function setSuggestionInteresting(
  suggestionId: string,
  value: boolean
): Promise<void> {
  const { error } = await supabase.rpc('set_ping_suggestion_interesting', {
    p_suggestion: suggestionId,
    p_interesting: value,
  });
  if (error) fail(error);
}

/** The owner opened their request. Quiet on failure: it only moves a dot. */
export async function markPingSeen(pingId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_ping_seen', { p_ping: pingId });
  if (error && !NOT_MIGRATED.has(error.code ?? '')) {
    console.warn('[pings] could not mark seen:', error.message);
  }
}

/** Suggestions on your requests you have not opened. 0 before 0046. */
export async function getUnseenPingSuggestions(): Promise<number> {
  const { data, error } = await supabase.rpc('my_unseen_ping_suggestions');
  if (error) {
    if (NOT_MIGRATED.has(error.code ?? '')) return 0;
    throw new Error(error.message);
  }
  return (data as number | null) ?? 0;
}

// ---------------------------------------------------------------------------
// Pings to people
// ---------------------------------------------------------------------------

/** Who may ping you. The default before you choose, and before 0046. */
export async function getPingAudience(userId: string): Promise<PingAudience> {
  const { data, error } = await supabase
    .from('ping_preferences')
    .select('audience')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) fail(error);
  return data?.audience ?? DEFAULT_PING_AUDIENCE;
}

export async function setPingAudience(userId: string, audience: PingAudience): Promise<void> {
  const { error } = await supabase.from('ping_preferences').upsert(
    { user_id: userId, audience, updated_at: new Date().toISOString() },
    {
      onConflict: 'user_id',
    }
  );
  if (error) fail(error);
}

/** The people you can ping now, recently pinged first. */
export async function getPingablePeople(): Promise<Profile[]> {
  const { data, error } = await supabase.rpc('pingable_people', { p_limit: 300 });
  if (error) fail(error);
  return (data ?? []) as Profile[];
}

/** The thing being pinged, as the sender sees it. */
export type PingTarget = {
  kind: DirectPingKind;
  targetId: string;
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
};

export type SendResult = {
  sent: number;
  /** Who it did not reach, and the database's reason in words. */
  failed: { recipientId: string; reason: string }[];
};

/**
 * Ping each recipient. One insert each, side by side, so somebody who changed
 * their setting a moment ago costs that one ping and not the rest.
 */
export async function sendPings(
  userId: string,
  recipientIds: readonly string[],
  target: PingTarget,
  message: string | null
): Promise<SendResult> {
  const row = {
    sender_id: userId,
    kind: target.kind,
    target_id: target.targetId,
    title: target.title.slice(0, 200),
    subtitle: target.subtitle?.slice(0, 200) || null,
    image_url: target.imageUrl?.slice(0, 1000) || null,
    message: message?.trim() || null,
  };
  const results = await Promise.all(
    recipientIds.map(async (recipientId) => {
      const { error } = await supabase
        .from('direct_pings')
        .insert({ ...row, recipient_id: recipientId });
      if (error && NOT_MIGRATED.has(error.code ?? '')) throw new PingsNotReadyError();
      return { recipientId, error };
    })
  );
  return {
    sent: results.filter((result) => !result.error).length,
    failed: results
      .filter((result) => result.error)
      .map((result) => ({ recipientId: result.recipientId, reason: result.error!.message })),
  };
}

export type InboxPing = DirectPingRow & { sender: Profile | null };

/** Pings to you, newest first. Empty before 0046. */
export async function getInboxPings(userId: string): Promise<InboxPing[]> {
  const { data, error } = await supabase
    .from('direct_pings')
    .select('*, sender:profiles!direct_pings_sender_id_fkey(*)')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    if (NOT_MIGRATED.has(error.code ?? '')) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as unknown as InboxPing[];
}

/** Unread pings to you. 0 before 0046. */
export async function getUnreadPingCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('direct_pings')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('read', false);
  if (error) {
    if (NOT_MIGRATED.has(error.code ?? '')) return 0;
    throw new Error(error.message);
  }
  return count ?? 0;
}

export async function markPingRead(pingId: string): Promise<void> {
  const { error } = await supabase.from('direct_pings').update({ read: true }).eq('id', pingId);
  if (error) fail(error);
}

export async function markAllPingsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('direct_pings')
    .update({ read: true })
    .eq('recipient_id', userId)
    .eq('read', false);
  if (error) fail(error);
}

export async function deleteInboxPing(pingId: string): Promise<void> {
  const { error } = await supabase.from('direct_pings').delete().eq('id', pingId);
  if (error) fail(error);
}
