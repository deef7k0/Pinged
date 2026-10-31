import type {
  ContentReportReason,
  SimilarityReportReason,
  UserContentReportReason,
} from '@/lib/database.types';

/**
 * What can be reported — and the route segment that names it on
 * `report/[kind]/[id]`.
 *
 * A **pick** is a pair of games the community says are alike (0025): nobody's
 * writing, so its reasons are about the claim. A **suggestion** (0029) and a
 * **review** are one person's words, and share one vocabulary (0031). A
 * **comment**, a **wall post** and a **profile** (0045) share it too, and a
 * profile adds impersonation.
 */
export type ReportKind = 'pick' | 'suggestion' | 'review' | 'comment' | 'wall_post' | 'profile';

export const REPORT_KINDS: readonly ReportKind[] = [
  'pick',
  'suggestion',
  'review',
  'comment',
  'wall_post',
  'profile',
];

export function isReportKind(value: string | undefined): value is ReportKind {
  return (REPORT_KINDS as readonly string[]).includes(value ?? '');
}

/**
 * Why somebody's writing should not be up, in the order the form offers them.
 * This list and the CHECKs in 0031 must match; `reports.test.ts` reads the
 * migration and holds them to it.
 *
 * Spoilers lead because they are the report this app most expects: a review
 * can carry a spoiler warning (0021), and the report is how a reader says one
 * was needed and not given.
 */
export const CONTENT_REPORT_REASONS: readonly ContentReportReason[] = [
  'spoilers',
  'spam',
  'inappropriate',
  'harassment',
  'off_topic',
];

export const CONTENT_REPORT_REASON_LABEL: Record<ContentReportReason, string> = {
  spoilers: 'Unmarked spoilers',
  spam: 'Spam',
  inappropriate: 'Offensive',
  harassment: 'Harassment',
  off_topic: 'Off-topic',
};

/** Printed under each choice: the words need defining more than the scale does. */
export const CONTENT_REPORT_REASON_HINT: Record<ContentReportReason, string> = {
  spoilers: 'Gives the story away without the spoiler warning',
  spam: 'Advertising, links, or the same thing posted over and over',
  inappropriate: 'Hateful, sexual or violent',
  harassment: 'Goes after a person rather than the game',
  off_topic: 'Not about the game at all',
};

/**
 * What 0045's table accepts, in its CHECK's order; `reports.test.ts` holds
 * the two together. A comment or a wall post is offered the content reasons;
 * a profile the ones that can be true of a person's page.
 */
export const USER_CONTENT_REPORT_REASONS: readonly UserContentReportReason[] = [
  ...CONTENT_REPORT_REASONS,
  'impersonation',
];

export const PROFILE_REPORT_REASONS: readonly UserContentReportReason[] = [
  'impersonation',
  'harassment',
  'inappropriate',
  'spam',
];

export const USER_CONTENT_REASON_LABEL: Record<UserContentReportReason, string> = {
  ...CONTENT_REPORT_REASON_LABEL,
  impersonation: 'Pretending to be someone',
};

export const PROFILE_REPORT_REASON_HINT: Record<UserContentReportReason, string> = {
  ...CONTENT_REPORT_REASON_HINT,
  impersonation: 'Uses another person’s name, picture or identity',
  harassment: 'Exists to go after a person',
  inappropriate: 'A hateful, sexual or violent name, picture or bio',
  spam: 'Advertising, or an account that only posts links',
};

/** A pick's reasons (0025), in the order the form offers them. */
export const PICK_REPORT_REASONS: readonly SimilarityReportReason[] = [
  'incorrect',
  'spam',
  'inappropriate',
];

export const PICK_REPORT_REASON_HINT: Record<SimilarityReportReason, string> = {
  incorrect: 'Nothing about one is much like the other',
  spam: 'Put here to push a game rather than to compare two',
  inappropriate: 'Offensive, or a joke at someone’s expense',
};

/** The longest note a report can carry — the CHECK on every report table. */
export const MAX_REPORT_NOTE = 300;
