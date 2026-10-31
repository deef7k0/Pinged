import type { Profile } from '../database.types';
import { supabase } from '../supabase';

/**
 * Blocking (0045). A block works both ways — neither person sees the other's
 * reviews, collections, comments or wall posts, and neither can follow,
 * befriend, like, comment on or write to the other — and it cuts the follows,
 * the friendship and the notifications already between them. The database
 * does all of that; these only ask it.
 *
 * Whom you blocked is yours to read. Whether somebody blocked *you* is not
 * something the app can ask, by design.
 */

/** PostgREST's codes for "no such function / table": the database predates 0045. */
const NOT_MIGRATED = new Set(['PGRST202', 'PGRST205', '42P01', '42883']);

export const BLOCKS_NOT_READY =
  'Blocking arrives with the database’s next update. Nothing was changed.';

function fail(error: { code?: string; message: string }): never {
  throw new Error(NOT_MIGRATED.has(error.code ?? '') ? BLOCKS_NOT_READY : error.message);
}

export type BlockedProfile = Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> & {
  blocked_at: string;
};

/** The people you blocked, most recent first. Empty before 0045. */
export async function getBlockedProfiles(userId: string): Promise<BlockedProfile[]> {
  const { data, error } = await supabase
    .from('blocks')
    .select(
      'created_at, profile:profiles!blocks_blocked_id_fkey(id, username, display_name, avatar_url)'
    )
    .eq('blocker_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    if (NOT_MIGRATED.has(error.code ?? '')) return [];
    throw new Error(error.message);
  }
  type Row = { created_at: string; profile: Omit<BlockedProfile, 'blocked_at'> | null };
  return ((data ?? []) as unknown as Row[])
    .filter((row) => row.profile)
    .map((row) => ({ ...row.profile!, blocked_at: row.created_at }));
}

/** Whether you blocked this person. False before 0045. */
export async function isBlockedByMe(userId: string, targetId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('blocks')
    .select('id')
    .eq('blocker_id', userId)
    .eq('blocked_id', targetId)
    .maybeSingle();

  if (error) {
    if (NOT_MIGRATED.has(error.code ?? '')) return false;
    throw new Error(error.message);
  }
  return !!data;
}

export async function blockUser(targetId: string): Promise<void> {
  const { error } = await supabase.rpc('block_user', { p_target: targetId });
  if (error) fail(error);
}

export async function unblockUser(targetId: string): Promise<void> {
  const { error } = await supabase.rpc('unblock_user', { p_target: targetId });
  if (error) fail(error);
}
