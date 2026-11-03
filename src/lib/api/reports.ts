import type {
  ContentReportReason,
  ReviewReportQueueRow,
  SuggestionReportQueueRow,
  UserContentKind,
  UserContentReportQueueRow,
  UserContentReportReason,
} from '../database.types';
import { supabase } from '../supabase';

/**
 * Reports on what people write (0031): a suggestion on a community pick, and a
 * review — and (0045) a comment, a wall post or a whole profile, all three in
 * `user_content_reports`. Reports on the picks themselves are 0025's and stay in
 * `similarity.ts` (`reportSimilarity`).
 *
 * Private — only the reporter and the moderators see one — and, unlike a pick,
 * never enough on their own to take anything down: somebody's writing waits for
 * a moderator. See the migration for why.
 */

/** One thing that can be reported, named the way its table keys it. */
export type ReportTarget =
  | { kind: 'pick'; pairId: string }
  | { kind: 'suggestion'; pairId: string; authorId: string }
  | { kind: 'review'; logId: string }
  | { kind: UserContentKind; targetId: string; authorId: string };

/** The three kinds 0045 added, which share one table. */
export function isUserContentTarget(
  target: ReportTarget
): target is Extract<ReportTarget, { kind: UserContentKind }> {
  return (
    target.kind === 'comment' ||
    target.kind === 'wall_post' ||
    target.kind === 'profile' ||
    target.kind === 'ping' ||
    target.kind === 'ping_suggestion'
  );
}

/** PostgREST's "no such table / function": the database predates 0045. */
const NOT_MIGRATED = new Set(['PGRST202', 'PGRST205', '42P01']);

export const REPORTS_NOT_READY =
  'Reporting this arrives with the database’s next update. Nothing was sent.';

/** A report you have already filed — enough to say so instead of the form. */
export type MyReport = { status: 'open' | 'resolved'; created_at: string };

/**
 * Your report on this, if you have filed one. Every report table lets its
 * author read their own rows, which is all this needs.
 */
export async function getMyReport(userId: string, target: ReportTarget): Promise<MyReport | null> {
  if (isUserContentTarget(target)) {
    const { data, error } = await supabase
      .from('user_content_reports')
      .select('status, created_at')
      .eq('kind', target.kind)
      .eq('target_id', target.targetId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      if (NOT_MIGRATED.has(error.code ?? '')) return null;
      throw new Error(error.message);
    }
    return data;
  }

  const { data, error } =
    target.kind === 'pick'
      ? await supabase
          .from('game_similarity_reports')
          .select('status, created_at')
          .eq('similarity_id', target.pairId)
          .eq('user_id', userId)
          .maybeSingle()
      : target.kind === 'suggestion'
        ? await supabase
            .from('similarity_suggestion_reports')
            .select('status, created_at')
            .eq('similarity_id', target.pairId)
            .eq('author_id', target.authorId)
            .eq('user_id', userId)
            .maybeSingle()
        : await supabase
            .from('review_reports')
            .select('status, created_at')
            .eq('log_id', target.logId)
            .eq('user_id', userId)
            .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Report someone's suggestion. Reporting twice is a no-op rather than an error,
 * as it is for a pick: you have already said so. Your own is refused by the
 * table's CHECK.
 */
export async function reportSuggestion(
  userId: string,
  pairId: string,
  authorId: string,
  reason: ContentReportReason,
  note?: string | null
): Promise<void> {
  const { error } = await supabase.from('similarity_suggestion_reports').upsert(
    {
      similarity_id: pairId,
      author_id: authorId,
      user_id: userId,
      reason,
      note: note?.trim() || null,
    },
    { onConflict: 'similarity_id,author_id,user_id', ignoreDuplicates: true }
  );

  if (error) {
    console.warn('[reports] suggestion report failed:', error.message);
    throw new Error(error.message);
  }
}

/**
 * Report a review. A no-op the second time; your own is refused by the insert
 * policy, which is the one place that can see who wrote the log.
 */
export async function reportReview(
  userId: string,
  logId: string,
  reason: ContentReportReason,
  note?: string | null
): Promise<void> {
  const { error } = await supabase
    .from('review_reports')
    .upsert(
      { log_id: logId, user_id: userId, reason, note: note?.trim() || null },
      { onConflict: 'log_id,user_id', ignoreDuplicates: true }
    );

  if (error) {
    console.warn('[reports] review report failed:', error.message);
    throw new Error(error.message);
  }
}

/**
 * Report a comment, a wall post or a profile. A no-op the second time. The
 * database reads who wrote it off the thing itself; `authorId` is only what
 * the insert's type asks for.
 */
export async function reportUserContent(
  userId: string,
  target: Extract<ReportTarget, { kind: UserContentKind }>,
  reason: UserContentReportReason,
  note?: string | null
): Promise<void> {
  const { error } = await supabase.from('user_content_reports').upsert(
    {
      kind: target.kind,
      target_id: target.targetId,
      author_id: target.authorId,
      user_id: userId,
      reason,
      note: note?.trim() || null,
    },
    { onConflict: 'kind,target_id,user_id', ignoreDuplicates: true }
  );

  if (error) {
    console.warn(`[reports] ${target.kind} report failed:`, error.message);
    throw new Error(NOT_MIGRATED.has(error.code ?? '') ? REPORTS_NOT_READY : error.message);
  }
}

// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------

/** Comments, wall posts and profiles with an open report, oldest first. Null before 0045. */
export async function getUserContentReports(): Promise<UserContentReportQueueRow[] | null> {
  const { data, error } = await supabase.rpc('user_content_reports_queue');
  if (error) {
    if (NOT_MIGRATED.has(error.code ?? '')) return null;
    console.warn('[moderation] could not load user content reports:', error.message);
    throw new Error(error.message);
  }
  return (data ?? []) as UserContentReportQueueRow[];
}

/**
 * `remove`: a comment's words are replaced by a line saying a moderator took
 * them down, a wall post is deleted, a profile loses its name, bio, pictures
 * and handle. `dismiss` keeps it. Either closes the reports.
 */
export async function moderateUserContent(
  kind: UserContentKind,
  targetId: string,
  action: 'remove' | 'dismiss'
): Promise<void> {
  const { error } = await supabase.rpc('moderate_user_content', {
    p_kind: kind,
    p_target: targetId,
    p_action: action,
  });
  if (error) {
    console.warn(`[moderation] ${kind} ${action} failed:`, error.message);
    throw new Error(error.message);
  }
}

export async function getSuggestionReports(): Promise<SuggestionReportQueueRow[]> {
  const { data, error } = await supabase.rpc('suggestion_reports_queue');
  if (error) {
    console.warn('[moderation] could not load suggestion reports:', error.message);
    throw new Error(error.message);
  }
  return (data ?? []) as SuggestionReportQueueRow[];
}

export async function getReviewReports(): Promise<ReviewReportQueueRow[]> {
  const { data, error } = await supabase.rpc('review_reports_queue');
  if (error) {
    console.warn('[moderation] could not load review reports:', error.message);
    throw new Error(error.message);
  }
  return (data ?? []) as ReviewReportQueueRow[];
}

/**
 * `remove` takes a suggestion's words down — its vote stays; `dismiss` keeps
 * it. Either closes its open reports.
 */
export async function moderateSuggestion(
  pairId: string,
  authorId: string,
  action: 'remove' | 'dismiss'
): Promise<void> {
  const { error } = await supabase.rpc('moderate_suggestion', {
    p_similarity: pairId,
    p_author: authorId,
    p_action: action,
  });

  if (error) {
    console.warn(`[moderation] suggestion ${action} failed:`, error.message);
    throw new Error(error.message);
  }
}

/**
 * `remove` takes a review's headline and prose down — the log and its score
 * stay; `dismiss` keeps it. Either closes its open reports.
 */
export async function moderateReview(logId: string, action: 'remove' | 'dismiss'): Promise<void> {
  const { error } = await supabase.rpc('moderate_review', { p_log: logId, p_action: action });

  if (error) {
    console.warn(`[moderation] review ${action} failed:`, error.message);
    throw new Error(error.message);
  }
}

/**
 * What a comment, wall post or profile report form shows at its head: whose
 * it is and the words. Null when it has gone (or is hidden from the reader).
 */
export async function getReportedContent(
  target: Extract<ReportTarget, { kind: UserContentKind }>
): Promise<{ authorName: string; quote: string | null } | null> {
  type Author = { username: string; display_name: string | null } | null;
  const nameOf = (author: Author) =>
    author?.display_name?.trim() || (author?.username ? `@${author.username}` : 'Someone');

  if (target.kind === 'comment') {
    const { data, error } = await supabase
      .from('comments')
      .select('body, profile:profiles(username, display_name)')
      .eq('id', target.targetId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const row = data as unknown as { body: string; profile: Author };
    return { authorName: nameOf(row.profile), quote: row.body };
  }

  if (target.kind === 'wall_post') {
    const { data, error } = await supabase
      .from('wall_posts')
      .select('body, author:profiles!wall_posts_author_id_fkey(username, display_name)')
      .eq('id', target.targetId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const row = data as unknown as { body: string; author: Author };
    return { authorName: nameOf(row.author), quote: row.body };
  }

  if (target.kind === 'ping') {
    const { data, error } = await supabase
      .from('pings')
      .select('description, profile:profiles(username, display_name)')
      .eq('id', target.targetId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const row = data as unknown as { description: string; profile: Author };
    return { authorName: nameOf(row.profile), quote: row.description };
  }

  if (target.kind === 'ping_suggestion') {
    const { data, error } = await supabase
      .from('ping_suggestions')
      .select('message, profile:profiles(username, display_name), game:games(title)')
      .eq('id', target.targetId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const row = data as unknown as {
      message: string | null;
      profile: Author;
      game: { title: string } | null;
    };
    const quote = [row.game?.title, row.message?.trim()].filter(Boolean).join(' — ');
    return { authorName: nameOf(row.profile), quote: quote || null };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('username, display_name, bio')
    .eq('id', target.targetId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { authorName: nameOf(data), quote: data.bio?.trim() || null };
}
