/**
 * The labels a moderator can put on a game (migration 0034).
 *
 * A label is curation, not a statistic: nothing computes it and no number of
 * ratings earns it. A moderator sets it by hand — from the game's own page, or
 * from the label's list — and the app shows it as a badge on the game's cover
 * and in the game page's stats strip.
 *
 * **This list and 0034's CHECK on `game_labels.label` must match**, and
 * `game-labels.test.ts` reads the migration to hold them together. Adding a
 * label is an entry here, the same word in a new migration's CHECK, and — if it
 * has its own artwork — a badge; nothing else in the app enumerates them.
 */
export const GAME_LABELS = ['must_play'] as const;

export type GameLabel = (typeof GAME_LABELS)[number];

export function isGameLabel(value: unknown): value is GameLabel {
  return typeof value === 'string' && (GAME_LABELS as readonly string[]).includes(value);
}

export type GameLabelText = {
  /** The label as a heading and on the stats strip: "Must Play". */
  title: string;
  /** What carrying it means, for the list's own page and a moderator's toggle. */
  description: string;
  /** One sentence for a screen reader, on a cover that carries it. */
  spoken: string;
};

export const GAME_LABEL_TEXT: Record<GameLabel, GameLabelText> = {
  must_play: {
    title: 'Must Play',
    description:
      'Picked by hand by Pinged’s moderators: the games worth playing whatever you usually play.',
    spoken: 'Must Play, picked by Pinged’s moderators',
  },
};
