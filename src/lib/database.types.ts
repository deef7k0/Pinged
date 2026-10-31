/**
 * Types mirroring supabase/migrations/*.sql.
 *
 * Hand-written on purpose: generating these needs the Supabase CLI pointed at a
 * live project, which does not exist until you run the migrations. Once it does,
 * you can replace this file wholesale with:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
 *
 * If you edit the SQL, edit this too — nothing enforces that they agree.
 */

import type { CommunityRatingConfig } from './community-rating';
import type { ReviewDisplay } from './review-quote';

/** `paused` since 0022 — stopped, meaning to come back. */
export type LogStatus = 'playing' | 'played' | 'backlog' | 'dropped' | 'paused';

/**
 * How far a run got (0023): the credits, the main content, or everything.
 * Independent of `LogStatus` — a game can be paused after the story.
 */
export type CompletionLevel = 'story' | 'main' | 'full';

// --- 0024 physical releases -------------------------------------------------
// Keys only; the words a reader sees live in `constants/physical.ts`. Both
// lists must match the CHECK constraints in the migration.

export type ReleaseRegion = 'ntsc_u' | 'pal' | 'ntsc_j' | 'asia' | 'region_free' | 'other';

/** What came with the copy. Independent of `CopyCondition` on purpose. */
export type CopyCompleteness =
  'sealed' | 'cib_inserts' | 'cib' | 'game_manual' | 'game_box' | 'loose' | 'other';

/** The one condition scale, best first. */
export type CopyCondition =
  'mint' | 'near_mint' | 'excellent' | 'very_good' | 'good' | 'fair' | 'poor';

export type ReleasePhotoKind =
  'front' | 'back' | 'barcode' | 'media' | 'manual' | 'markings' | 'other';

export type ContributionStatus = 'pending' | 'approved' | 'rejected' | 'superseded';

// --- 0025 community similarity ----------------------------------------------

/** Why two games are alike. Must match the CHECK on `game_similarity_votes`. */
export type SimilarityReason =
  | 'combat'
  | 'progression'
  | 'atmosphere'
  | 'story'
  | 'characters'
  | 'exploration'
  | 'mechanics'
  | 'multiplayer'
  | 'difficulty'
  | 'genre'
  | 'structure'
  | 'tone';

export type SimilarityReportReason = 'spam' | 'inappropriate' | 'incorrect';

// --- 0031 reports on suggestions and reviews --------------------------------

/**
 * What is wrong with something a person wrote — a suggestion or a review. Must
 * match the CHECKs on `similarity_suggestion_reports` and `review_reports`.
 */
export type ContentReportReason =
  'spoilers' | 'spam' | 'inappropriate' | 'harassment' | 'off_topic';

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  favorite_platform: string | null;
  location: string | null;
  /** SteamID64, set by the user to enable achievement sync. */
  steam_id: string | null;
  created_at: string;
};

export type CachedGame = {
  id: string;
  source: string;
  source_id: string;
  title: string;
  /** Portrait box art. */
  cover_url: string | null;
  /** Landscape key art. */
  hero_url: string | null;
  description: string | null;
  release_date: string | null;
  release_year: number | null;
  developer: string | null;
  publisher: string | null;
  genres: string[] | null;
  platforms: string[] | null;
  screenshots: string[] | null;
  score: number | null;
  store_url: string | null;
  /**
   * Release type — remake, remaster, dlc, expansion, port, edition, bundle.
   * Null means this is the game. See `constants/game-editions.ts`.
   */
  edition_kind: string | null;
  /**
   * App-wide id of the game this is a version of. Not a foreign key — the
   * parent is very often not in the cache. See migration 0017.
   */
  parent_game_id: string | null;
  cached_at: string;
};

export type GameLog = {
  id: string;
  user_id: string;
  game_id: string;
  status: LogStatus;
  /** 0-100 score, or null when unscored. See constants/score.ts for labels. */
  rating: number | null;
  /**
   * The review in one word or sentence — the quote (0040; it was a headline).
   * Drawn between large quotation marks on the review's page and, when
   * `review_display` says so, on its cards. Null when the writer gave none.
   * See `lib/review-quote.ts`.
   */
  review_title: string | null;
  review: string | null;
  /**
   * Per-category scores when the reviewer opted into advanced metrics; null when
   * they scored with the bar. When set, `rating` is their mean — the client
   * writes both together and `rating` stays the only score anything else reads.
   */
  review_metrics: ReviewMetrics | null;
  completion_percent: number | null;
  platinum: boolean;
  /**
   * The author flagged this review as giving something away (migration 0021).
   *
   * Every surface that prints the body replaces it with a notice while this is
   * true; the notice is a link to the full review rather than a reveal, so the
   * decision to read a spoiler is made on the screen that exists to be read.
   *
   * **Not an access control.** The text ships in the same row to every reader —
   * this is a courtesy the client honours, not a boundary the server enforces.
   */
  spoilers: boolean;
  hours_played: number | null;
  played_on: string | null;
  /**
   * How far this person has got with the game, at best (0023). Raised — never
   * lowered — by a playthrough that gets further; set directly by the progress
   * sheet. Null is "not recorded".
   */
  completion: CompletionLevel | null;
  /** Review context: played co-op. Null is "not said", which is not "solo". */
  coop: boolean | null;
  /** How many played together. Only with `coop`; the database enforces it. */
  player_count: number | null;
  /**
   * The language the review is written in (0038): an ISO 639-1 code the app
   * works out as the review is saved — `lib/language.ts` — or null when nobody
   * could tell. **Null is unknown, never "none"**, and an unknown review is
   * shown to everybody (`canRead`).
   *
   * Optional, not just nullable: a database that has not run 0038 has no such
   * column, so the field is *absent* from its rows. Read it as `?? null`.
   */
  review_lang?: string | null;
  /**
   * What a card of this review shows: three lines of it (`'text'`) or the
   * quote (`'quote'`) — the writer's choice (0040). Optional, as `review_lang`
   * is: a database without 0040 has no such column. Read it through
   * `displayOf` / `cardShows`, never directly.
   */
  review_display?: ReviewDisplay | null;
  created_at: string;
  updated_at: string;
};

export type Follow = {
  follower_id: string;
  following_id: string;
  created_at: string;
};

export type GameAchievementRow = {
  id: string;
  game_id: string;
  external_id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  global_percent: number | null;
  hidden: boolean;
  cached_at: string;
};

export type UserAchievementRow = {
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
  /** True when pulled from Steam rather than ticked by hand. */
  synced: boolean;
};

export type ProfileAchievementStats = {
  user_id: string;
  achievements_unlocked: number;
  platinums: number;
  completions: number;
  hours_played: number;
};

// --- 0003_social.sql --------------------------------------------------------

export type ListKind = 'list' | 'favorites' | 'tier' | 'wishlist' | 'awards' | 'captioned';
export type NotificationKind =
  'like' | 'comment' | 'follow' | 'reply' | 'friend_request' | 'friend_accepted' | 'wall_post';

// --- 0005_friends_and_wall.sql ----------------------------------------------

export type FriendshipStatus = 'pending' | 'accepted';

/**
 * One row per pair, stored with `user_a < user_b`. Never construct these by
 * hand — use the helpers in lib/api/friends.ts, which handle the ordering.
 */
export type FriendshipRow = {
  user_a: string;
  user_b: string;
  requested_by: string;
  status: FriendshipStatus;
  created_at: string;
  responded_at: string | null;
};

export type WallPostRow = {
  id: string;
  wall_owner_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

// --- 0007_events_and_articles.sql -------------------------------------------

export type AttendanceMode = 'livestream' | 'in_person';

export type EventRow = {
  id: string;
  source: string;
  source_id: string;
  name: string;
  description: string | null;
  starts_at: string | null;
  live_stream_url: string | null;
  has_venue: boolean;
  cached_at: string;
};

export type EventAttendanceRow = {
  event_id: string;
  user_id: string;
  mode: AttendanceMode;
  /** Set when a local reminder is scheduled on the user's device. */
  reminder_at: string | null;
  created_at: string;
};
// --- 0008_review_metrics.sql ------------------------------------------------

/** Closed vocabulary — see the CHECK constraint on logs.review_metrics. */
export type ReviewMetricKey =
  | 'personal-enjoyment'
  | 'genre-execution'
  | 'innovation'
  | 'gameplay'
  | 'content'
  | 'replayability'
  | 'narrative'
  | 'difficulty'
  | 'art-direction'
  | 'cinematography'
  | 'soundtrack'
  | 'level-design'
  | 'audio-design'
  | 'voice-acting';

/** Scores 0-100 by metric. An absent key means that metric was not scored. */
export type ReviewMetrics = Partial<Record<ReviewMetricKey, number>>;

/**
 * What a like or a comment points at.
 *
 * `list` is likes-only — collections are likeable but not commentable, and the
 * CHECK on `comments.target_type` still allows only `log`. Keeping one union
 * means a comment call with a list id is a *runtime* rejection rather than a
 * compile error; `LIKE_ONLY_TARGETS` below is the reminder.
 *
 * **`post` is gone from the client, not from the database.** The columns are
 * still `text` with a CHECK that accepts it, and rows written before user posts
 * were removed still carry it. Narrowing the type here is what stops new code
 * pointing a like at a target the app can no longer render; it is deliberately
 * not a schema claim.
 */
export type TargetType = 'log' | 'list';

/** Target types that accept likes but not comments. */
export const LIKE_ONLY_TARGETS: readonly TargetType[] = ['list'];

export type LikeRow = {
  user_id: string;
  target_type: TargetType;
  target_id: string;
  created_at: string;
};

export type CommentRow = {
  id: string;
  user_id: string;
  target_type: TargetType;
  target_id: string;
  body: string;
  parent_id: string | null;
  created_at: string;
};

export type ListRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  kind: ListKind;
  is_ranked: boolean;
  /** Free-form author labels shown on the Collection header. Max 12. */
  tags: string[] | null;
  /**
   * Game whose cover represents the collection on a tile.
   *
   * Null means the owner has not chosen one, and the tile falls back to the
   * first item. A trigger (0014) nulls this when the game leaves the list, so
   * it can never point at something the collection no longer holds.
   */
  cover_game_id: string | null;
  /**
   * Four covers or one (0033). **Nothing reads or writes it any more.** The
   * mosaic it chose between was removed from the app: a collection is one
   * cover on its own screen and a stack where it is listed. The column is still
   * in the database — nothing was dropped and no migration was written, as with
   * `posts` and `diary_entries` — and it is typed here only because the row has
   * it. Absent on a database before 0033.
   */
  cover_style?: ListCoverStyle;
  created_at: string;
  updated_at: string;
};

/** What `lists.cover_style` (0033) holds. Unused by the app — see the column's note. */
export type ListCoverStyle = 'mosaic' | 'single';

export type ListItemRow = {
  list_id: string;
  game_id: string;
  position: number;
  tier: 'S' | 'A' | 'B' | 'C' | 'D' | 'F' | null;
  note: string | null;
  added_at: string;
};

/**
 * One award category in an awards-kind list.
 *
 * A row exists before anything has won it — `game_id` is nullable, which is the
 * whole reason this is not a `list_items` row (that table's key is
 * `(list_id, game_id)`, so a slot without a game cannot be expressed). When a
 * game *is* named, a trigger from 0016 mirrors it into `list_items` so the tile's
 * stack, the item count and every "is this game in a list" query keep working
 * without knowing awards exist.
 */
export type AwardRow = {
  id: string;
  list_id: string;
  /** The category — "Game of the Year", or whatever the owner typed. */
  label: string;
  position: number;
  /** The winner. Null for a category nobody has filled in yet. */
  game_id: string | null;
  /** Why it won, in the owner's words. */
  note: string | null;
  created_at: string;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  actor_id: string;
  kind: NotificationKind;
  target_type: TargetType | null;
  target_id: string | null;
  read: boolean;
  created_at: string;
};

/*
 * 0011_diary.sql has no types here on purpose.
 *
 * Per-game diaries were removed from the app. `diary_entries` still exists in
 * Postgres — nothing was dropped and no migration was written, exactly as with
 * `posts` — but nothing in the client may read or write it, and a row type here
 * is the first thing that would let something start. Same treatment `posts` and
 * `post_media` got when that feature went.
 */

// --- 0012_starred_song.sql, reshaped by 0036 --------------------------------

/**
 * One pinned track per profile. `user_id` is the primary key, which is what
 * enforces the limit of one — see the migration.
 *
 * **Only the track's id, and which game it was starred from.** The columns
 * that held its title, artist, artwork and preview address were dropped in
 * 0036: the track is SoundCloud's now, and its terms forbid storing those. The
 * profile fetches them live (`getSoundCloudTrack`).
 */
export type StarredSongRow = {
  user_id: string;
  /** A SoundCloud track URN, `soundcloud:tracks:…`. Not a foreign key. */
  track_id: string;
  game_id: string | null;
  game_title: string | null;
  created_at: string;
  updated_at: string;
};

/*
 * `game_soundtracks` (0020), the shared cache of iTunes lookups, had its row
 * types here. 0036 drops the table. Nothing took its place on the client: which
 * SoundCloud upload is a game's soundtrack is kept in `soundcloud_matches`,
 * which only the `soundcloud` Edge Function can read.
 */

// --- 0009_gaming_accounts.sql -----------------------------------------------

/** Closed vocabulary — see gaming_providers() in migration 0009. */
export type GamingProvider =
  'steam' | 'xbox' | 'playstation' | 'epic' | 'gog' | 'battlenet' | 'riot' | 'ubisoft';

export type GamingVisibility = 'public' | 'friends' | 'private' | 'unknown';

export type GamingSyncSection =
  'profile' | 'library' | 'achievements' | 'inventory' | 'badges' | 'friends';

export type GamingSyncStatus = 'idle' | 'syncing' | 'ok' | 'partial' | 'private' | 'error';

export type GamingAccountRow = {
  user_id: string;
  provider: GamingProvider;
  /**
   * SteamID64 for Steam, written only by the steam-auth Edge Function; the
   * service's own id for one linked by username (game-accounts, 0044).
   */
  external_id: string;
  /** 0044: `sign-in` (proved) or `username` (a public name). Absent before it. */
  linked_by?: 'sign-in' | 'username';
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  profile_url: string | null;
  country: string | null;
  level: number | null;
  xp: number | null;
  visibility: GamingVisibility;
  status: string;
  current_game_app_id: string | null;
  current_game_name: string | null;
  linked_at: string;
  last_synced_at: string | null;
};

export type GamingOwnedGameRow = {
  user_id: string;
  provider: GamingProvider;
  app_id: string;
  name: string;
  icon_url: string | null;
  playtime_minutes: number;
  playtime_recent_minutes: number;
  last_played_at: string | null;
  achievements_total: number | null;
  achievements_unlocked: number | null;
  achievements_synced_at: string | null;
  /** Null for Steam — its Web API exposes no purchase date. */
  acquired_at: string | null;
  game_id: string | null;
  synced_at: string;
};

export type GamingAchievementRow = {
  user_id: string;
  provider: GamingProvider;
  app_id: string;
  achievement_key: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  icon_gray_url: string | null;
  unlocked: boolean;
  unlocked_at: string | null;
  global_percent: number | null;
  synced_at: string;
};

export type GamingInventoryItemRow = {
  user_id: string;
  provider: GamingProvider;
  app_id: string;
  item_id: string;
  name: string;
  type: string | null;
  icon_url: string | null;
  rarity: string | null;
  /** Provider's own hex, without '#'. */
  rarity_color: string | null;
  amount: number;
  tradable: boolean;
  marketable: boolean;
  /** The single join key a future pricing integration would need. */
  market_hash_name: string | null;
  feature_rank: number | null;
  synced_at: string;
};

export type GamingBadgeRow = {
  user_id: string;
  provider: GamingProvider;
  badge_key: string;
  name: string | null;
  icon_url: string | null;
  level: number | null;
  xp: number | null;
  earned_at: string | null;
  is_years_of_service: boolean;
  synced_at: string;
};

export type GamingProviderFriendRow = {
  user_id: string;
  provider: GamingProvider;
  friend_external_id: string;
  friend_handle: string | null;
  friend_avatar_url: string | null;
  friends_since: string | null;
  /** Non-null when this provider friend also uses GameLog. */
  matched_user_id: string | null;
  synced_at: string;
};

export type GamingSyncStateRow = {
  user_id: string;
  provider: GamingProvider;
  section: GamingSyncSection;
  status: GamingSyncStatus;
  last_run_at: string | null;
  last_success_at: string | null;
  next_run_after: string | null;
  cursor: string | null;
  attempts: number;
  error: string | null;
};

/** Rollup view. Numeric aggregates arrive as strings over PostgREST. */
export type GamingProfileStatsRow = {
  user_id: string;
  provider: GamingProvider;
  games_owned: number;
  total_playtime_minutes: number;
  achievements_unlocked: number;
  achievements_total: number;
  perfect_games: number;
  avg_playtime_minutes: number;
};

// --- 0023_play_progress.sql -------------------------------------------------

/**
 * One run of a game. Belongs to a log through `(user_id, game_id)`, so it cannot
 * exist without one and goes when the log does.
 *
 * Dates are partial ISO — '2021', '2021-05' or '2021-05-14' — exactly as precise
 * as the player said, and they sort correctly as text.
 */
export type PlaythroughRow = {
  id: string;
  user_id: string;
  game_id: string;
  /** Short platform form, the same vocabulary as `logs.played_on`. */
  platform: string | null;
  started_on: string | null;
  finished_on: string | null;
  completion: CompletionLevel | null;
  completion_percent: number | null;
  hours: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// --- 0024_physical_releases.sql ---------------------------------------------

/** A specific commercial release of a game. Canonical; clients never write it. */
export type GameReleaseRow = {
  id: string;
  game_id: string;
  platform: string;
  region: ReleaseRegion;
  edition: string;
  publisher: string | null;
  release_date: string | null;
  catalog_number: string | null;
  created_at: string;
};

/** A canonical barcode. GTIN-14: the primary key is the duplicate detection. */
export type ReleaseBarcodeRow = {
  barcode: string;
  release_id: string;
  contribution_id: string | null;
  created_at: string;
};

export type ReleaseImageRow = {
  id: string;
  release_id: string;
  kind: ReleasePhotoKind;
  /** Public URL in the `media` bucket — a reference, never the bytes. */
  url: string;
  contribution_id: string | null;
  created_at: string;
};

/** A user's claim about a barcode. Not canonical until approved. */
export type ReleaseContributionRow = {
  id: string;
  user_id: string;
  barcode: string;
  game_id: string;
  platform: string;
  region: ReleaseRegion;
  edition: string;
  publisher: string | null;
  release_date: string | null;
  catalog_number: string | null;
  notes: string | null;
  status: ContributionStatus;
  release_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
};

export type ReleaseContributionPhotoRow = {
  id: string;
  contribution_id: string;
  kind: ReleasePhotoKind;
  url: string;
  created_at: string;
};

/**
 * One physical copy someone owns. `release_id` when the release is known; the
 * copy's own platform/region/edition otherwise — and the database overwrites
 * those from the release whenever one is attached. No price, ever.
 */
export type OwnedCopyRow = {
  id: string;
  user_id: string;
  game_id: string;
  release_id: string | null;
  /** The pending claim this copy is waiting on, when its barcode was unknown. */
  contribution_id: string | null;
  ownership: 'physical' | 'digital';
  platform: string | null;
  region: ReleaseRegion | null;
  edition: string | null;
  completeness: CopyCompleteness | null;
  condition: CopyCondition | null;
  notes: string | null;
  /** Partial ISO date, like a playthrough's. */
  acquired_on: string | null;
  created_at: string;
  updated_at: string;
};

/** One pair of games someone said are alike. Undirected: `game_a < game_b`. */
export type GameSimilarityRow = {
  id: string;
  game_a: string;
  game_b: string;
  created_by: string | null;
  status: 'active' | 'hidden';
  created_at: string;
};

export type GameSimilarityVoteRow = {
  similarity_id: string;
  user_id: string;
  value: -1 | 1;
  reasons: SimilarityReason[];
  comment: string | null;
  created_at: string;
  updated_at: string;
};

/** One person upvoting one suggestion (0029) — the vote `author_id` cast on a pair. */
export type GameSimilarityUpvoteRow = {
  similarity_id: string;
  author_id: string;
  user_id: string;
  created_at: string;
};

/** One row of `similarity_suggestions()` — somebody's reasons for a pair (0029). */
export type SimilaritySuggestion = {
  author_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  reasons: SimilarityReason[];
  comment: string | null;
  created_at: string;
  updated_at: string;
  upvotes: number;
  viewer_upvoted: boolean;
};

/** How the community's picks can be ordered (0029). `unrated` also filters. */
export type SimilaritySort = 'top' | 'low' | 'votes' | 'new' | 'unrated';

/** Private to its author; moderators read them through an RPC. */
export type GameSimilarityReportRow = {
  similarity_id: string;
  user_id: string;
  reason: SimilarityReportReason;
  note: string | null;
  status: 'open' | 'resolved';
  created_at: string;
};

/** One row of `community_similar_games()` — a ranked pick, seen from one game. */
export type CommunitySimilarGame = {
  similarity_id: string;
  /** The *other* game in the pair. */
  game_id: string;
  title: string;
  cover_url: string | null;
  hero_url: string | null;
  release_year: number | null;
  edition_kind: string | null;
  /** Counted votes only — accounts with no logs are stored but not counted. */
  up: number;
  down: number;
  /** Wilson lower bound; the order, never shown. */
  score: number;
  /** Reason → how many counted upvotes gave it, most given first. */
  reasons: Partial<Record<SimilarityReason, number>>;
  viewer_vote: -1 | 1 | null;
  /** Counted votes either way (0029). */
  votes: number;
  /** When the pair was first suggested (0029). */
  created_at: string;
  /**
   * People who said why — a reason or a line — and people who only tapped Agree
   * (0030). They never overlap. **Null when the database predates 0030**: the
   * client can run ahead of migrations applied by hand, and an older function
   * returns rows without these columns. `getCommunitySimilar` turns the missing
   * columns into nulls so every reader has to decide what to show without them.
   */
  suggesters: number | null;
  agreers: number | null;
  /** The most upvoted suggestion, ties to the earliest (0030). Null with none. */
  top_author_id: string | null;
  top_author: string | null;
  top_author_avatar: string | null;
  top_comment: string | null;
  top_reasons: SimilarityReason[] | null;
};

export type SimilarityReportQueueRow = {
  similarity_id: string;
  status: 'active' | 'hidden';
  game_a: string;
  game_a_title: string;
  game_b: string;
  game_b_title: string;
  report_count: number;
  reasons: SimilarityReportReason[];
  latest_note: string | null;
  first_reported: string;
};

/**
 * Private to its author (0031); moderators read them through an RPC.
 *
 * Keyed on its own `id` (0032), with one report per person per suggestion held
 * by a unique constraint instead — see that migration for why the natural key
 * could not be the primary one.
 */
export type SuggestionReportRow = {
  id: string;
  similarity_id: string;
  /** Whose suggestion — with `similarity_id`, the vote being reported. */
  author_id: string;
  user_id: string;
  reason: ContentReportReason;
  note: string | null;
  status: 'open' | 'resolved';
  created_at: string;
};

/**
 * Private to its author (0031); moderators read them through an RPC.
 *
 * Keyed on its own `id` (0032): keyed on (log_id, user_id), PostgREST read the
 * table as a join between `logs` and `profiles` and refused every embed of a
 * log's author as ambiguous.
 */
export type ReviewReportRow = {
  id: string;
  log_id: string;
  user_id: string;
  reason: ContentReportReason;
  note: string | null;
  status: 'open' | 'resolved';
  created_at: string;
};

/** One row of `suggestion_reports_queue()` — a reported suggestion and its words. */
export type SuggestionReportQueueRow = {
  similarity_id: string;
  author_id: string;
  author_name: string;
  game_a_title: string;
  game_b_title: string;
  reasons: SimilarityReason[];
  comment: string | null;
  report_count: number;
  report_reasons: ContentReportReason[];
  latest_note: string | null;
  first_reported: string;
};

// --- 0045 blocks, reports on comments / wall posts / profiles ---------------

/** Who blocked whom. Readable only by the blocker; written by `block_user`. */
export type BlockRow = {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
};

/** What can be reported in `user_content_reports`. */
export type UserContentKind = 'comment' | 'wall_post' | 'profile';

/** 0031's reasons, and one only a profile can be: pretending to be somebody. */
export type UserContentReportReason = ContentReportReason | 'impersonation';

/**
 * A report on a comment, a wall post or a profile. `author_id` is filled in by
 * the database from the thing reported; whatever the client sends is replaced.
 */
export type UserContentReportRow = {
  id: string;
  kind: UserContentKind;
  target_id: string;
  author_id: string;
  user_id: string;
  reason: UserContentReportReason;
  note: string | null;
  status: 'open' | 'resolved';
  created_at: string;
};

/** One row of `user_content_reports_queue()`. */
export type UserContentReportQueueRow = {
  kind: UserContentKind;
  target_id: string;
  author_id: string;
  author_name: string;
  author_username: string;
  /** A comment's or wall post's words; a profile's name and bio. */
  body: string | null;
  /** A profile's picture, for a profile report. */
  avatar_url: string | null;
  /** Where a comment is (`log`, `list`, `post`) or `wall` for a wall post. */
  context_type: string | null;
  /** The log or list a comment is on, or whose wall a post is on. */
  context_id: string | null;
  report_count: number;
  report_reasons: UserContentReportReason[];
  latest_note: string | null;
  first_reported: string;
};

/** One row of `review_reports_queue()` — a reported review, in full. */
export type ReviewReportQueueRow = {
  log_id: string;
  author_id: string;
  author_name: string;
  game_id: string;
  game_title: string;
  review_title: string | null;
  review: string | null;
  spoilers: boolean;
  report_count: number;
  report_reasons: ContentReportReason[];
  latest_note: string | null;
  first_reported: string;
};

/**
 * How many rated logs, and the sum of their scores. Sums merge; averages do not.
 *
 * Since 0041 a tally also carries its **weighted** mean — the community score's
 * method, over just these ratings — and, for a platform, its share of the
 * game's whole weight, which is what lets PS4 and PS5 fold into PlayStation
 * exactly. Never a weight sum: on a group of one, that is somebody's weight.
 * Absent on a database before 0041.
 */
export type ScoreTally = {
  count: number;
  sum: number;
  weighted_mean?: number | null;
  weight_share?: number | null;
};

/**
 * `game_review_stats()` (0026) — one game's ratings, tallied by how they were
 * played. `lib/review-facets.ts` folds it into what the reviews sheet shows.
 */
export type GameReviewStats = {
  /** Every rated log: the same population as the rating histogram. */
  count: number;
  sum: number;
  /** The game's community score, as 0041's `game_ratings` holds it. Absent before 0041. */
  weighted_mean?: number | null;
  groups: Record<'finished' | 'full' | 'playing' | 'dropped' | 'solo' | 'coop', ScoreTally>;
  /** Rated logs per stored platform string, not yet folded into families. */
  platforms: ({ platform: string } & ScoreTally)[];
  /** Every stored platform string with a written review — the filter's choices. */
  written_platforms: string[];
};

/** A game named in `user_game_stats()` — the best or worst thing someone scored. */
export type StatGame = {
  game_id: string;
  title: string;
  rating: number;
  cover_url: string | null;
  hero_url: string | null;
};

/**
 * `user_game_stats()` (0028) — one person's collection, summarised. `physical`
 * and `digital` count games, never overlap, and add up to the collection; see
 * the migration for what each includes.
 */
export type UserGameStats = {
  logged: number;
  reviews: number;
  rated: number;
  /** Mean score, 0-100, rounded. Null with nothing rated. */
  average: number | null;
  finished: number;
  full: number;
  platinum: number;
  hours: number;
  physical: number;
  /** Physical boxes, which can exceed `physical` — two releases of one game. */
  copies: number;
  digital: number;
  highest: StatGame | null;
  lowest: StatGame | null;
};

export type ModeratorRow = {
  user_id: string;
  created_at: string;
};

/**
 * One rater's statistics and weight (0041) — derived from `logs`, readable by
 * its owner alone. `lib/community-rating.ts` says what every column means.
 */
export type RaterStatsRow = {
  user_id: string;
  rated_count: number;
  distribution: number[];
  entropy: number;
  normalized_entropy: number;
  comparison_count: number;
  average_deviation: number | null;
  deviation_percentile: number | null;
  low_entropy: boolean;
  high_deviation: boolean;
  pattern_confidence: number;
  target_penalty: number;
  weight: number;
  algorithm_version: number;
  computed_at: string;
};

/**
 * One game's community score (0041). Public — except `weight_sum` and
 * `effective_raters`, which are not granted to clients: select columns by
 * name, never `*`.
 */
export type GameRatingRow = {
  game_id: string;
  weighted_rating: number;
  raw_mean: number;
  raters: number;
  weight_sum: number;
  effective_raters: number;
  min_rating: number;
  max_rating: number;
  histogram: number[];
  algorithm_version: number;
  computed_at: string;
};

/** The last full recalculation of the community scores (0041), one row. */
export type CommunityRatingStateRow = {
  id: boolean;
  algorithm_version: number;
  recalculated_at: string | null;
  duration_ms: number | null;
  rated_logs: number | null;
  raters: number | null;
  comparable_raters: number | null;
  games: number | null;
  stale_since: string | null;
};

/** `community_rating_report()` (0041): the weighting across the app, in aggregate. Moderators only. */
export type CommunityRatingReport = {
  params: CommunityRatingConfig;
  state: Omit<CommunityRatingStateRow, 'id'> | null;
  raters: {
    total: number;
    adjusted: number;
    at_minimum: number;
    low_entropy: number;
    high_deviation: number;
    both: number;
    mean_weight: number;
  };
  weights: { weight: number; raters: number }[];
  games: { total: number; moved: number; mean_difference: number; max_difference: number };
  largest: {
    game_id: string;
    title: string;
    raters: number;
    raw_mean: number;
    weighted_rating: number;
    effective_raters: number;
  }[];
};

/**
 * One label on one game (0034) — `must_play`. Readable by everyone; inserted
 * and deleted by moderators only, which the table's policies enforce.
 *
 * `label` is text + CHECK in the database, and the vocabulary is `GAME_LABELS`
 * in `constants/game-labels.ts`.
 */
export type GameLabelRow = {
  game_id: string;
  label: string;
  /** The moderator who set it; null once their account is gone. */
  added_by: string | null;
  created_at: string;
};

/** A game pinned to the head of a person's library (0043). */
export type LibraryPinRow = {
  id: number;
  user_id: string;
  game_id: string;
  /** 0–5: six at most, unique per person. */
  position: number;
  created_at: string;
};

/**
 * What the contribution RPCs answer.
 *
 * `exists` — the barcode is already canonical, and here is its release.
 * `duplicate` — you already have a pending claim for it.
 * `pending` — queued. `approved` — it agreed with someone else's claim and is
 * canonical now.
 */
export type ContributionResult =
  | { status: 'exists'; release_id: string }
  | { status: 'duplicate'; contribution_id: string }
  | { status: 'pending'; contribution_id: string; release_id: null }
  | { status: 'approved'; contribution_id: string; release_id: string };

type Insert<T, Optional extends keyof T> = Omit<T, Optional> & Partial<Pick<T, Optional>>;

/**
 * Shorthand for one foreign key in a table's `Relationships` tuple.
 *
 * supabase-js reads these to type embedded selects like
 * `select('*, profile:profiles(*)')`. An empty `Relationships: []` makes every
 * such embed resolve to `SelectQueryError` instead of the joined row, so each
 * FK that the app actually embeds across has to be declared here.
 */
type FK<
  Name extends string,
  Column extends string,
  Relation extends string,
  Referenced extends string,
> = {
  foreignKeyName: Name;
  columns: [Column];
  isOneToOne: false;
  referencedRelation: Relation;
  referencedColumns: [Referenced];
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Insert<
          Profile,
          | 'created_at'
          | 'display_name'
          | 'avatar_url'
          | 'banner_url'
          | 'bio'
          | 'favorite_platform'
          | 'location'
          | 'steam_id'
        >;
        Update: Partial<Profile>;
        Relationships: [];
      };
      games: {
        Row: CachedGame;
        Insert: Insert<CachedGame, 'cached_at'>;
        Update: Partial<CachedGame>;
        Relationships: [];
      };
      logs: {
        Row: GameLog;
        Insert: Insert<
          GameLog,
          | 'id'
          | 'created_at'
          | 'updated_at'
          | 'rating'
          | 'review'
          | 'review_title'
          | 'review_metrics'
          | 'completion_percent'
          | 'platinum'
          | 'spoilers'
          | 'hours_played'
          | 'played_on'
          | 'completion'
          | 'coop'
          | 'player_count'
        >;
        Update: Partial<GameLog>;
        Relationships: [
          FK<'logs_user_id_fkey', 'user_id', 'profiles', 'id'>,
          FK<'logs_game_id_fkey', 'game_id', 'games', 'id'>,
        ];
      };
      follows: {
        Row: Follow;
        Insert: Insert<Follow, 'created_at'>;
        Update: Partial<Follow>;
        Relationships: [
          FK<'follows_follower_id_fkey', 'follower_id', 'profiles', 'id'>,
          FK<'follows_following_id_fkey', 'following_id', 'profiles', 'id'>,
        ];
      };
      game_achievements: {
        Row: GameAchievementRow;
        Insert: Insert<
          GameAchievementRow,
          'cached_at' | 'description' | 'icon_url' | 'global_percent' | 'hidden'
        >;
        Update: Partial<GameAchievementRow>;
        Relationships: [];
      };
      user_achievements: {
        Row: UserAchievementRow;
        Insert: Insert<UserAchievementRow, 'unlocked_at' | 'synced'>;
        Update: Partial<UserAchievementRow>;
        Relationships: [];
      };
      likes: {
        Row: LikeRow;
        Insert: Insert<LikeRow, 'created_at'>;
        Update: Partial<LikeRow>;
        Relationships: [FK<'likes_user_id_fkey', 'user_id', 'profiles', 'id'>];
      };
      comments: {
        Row: CommentRow;
        Insert: Insert<CommentRow, 'id' | 'created_at' | 'parent_id'>;
        Update: Partial<CommentRow>;
        Relationships: [FK<'comments_user_id_fkey', 'user_id', 'profiles', 'id'>];
      };
      lists: {
        Row: ListRow;
        Insert: Insert<
          ListRow,
          | 'id'
          | 'created_at'
          | 'updated_at'
          | 'description'
          | 'kind'
          | 'is_ranked'
          | 'tags'
          | 'cover_game_id'
          | 'cover_style'
        >;
        Update: Partial<ListRow>;
        Relationships: [
          FK<'lists_user_id_fkey', 'user_id', 'profiles', 'id'>,
          FK<'lists_cover_game_id_fkey', 'cover_game_id', 'games', 'id'>,
        ];
      };
      list_items: {
        Row: ListItemRow;
        Insert: Insert<ListItemRow, 'added_at' | 'position' | 'tier' | 'note'>;
        Update: Partial<ListItemRow>;
        Relationships: [
          FK<'list_items_list_id_fkey', 'list_id', 'lists', 'id'>,
          FK<'list_items_game_id_fkey', 'game_id', 'games', 'id'>,
        ];
      };
      list_awards: {
        Row: AwardRow;
        Insert: Insert<AwardRow, 'id' | 'created_at' | 'position' | 'game_id' | 'note'>;
        Update: Partial<AwardRow>;
        Relationships: [
          FK<'list_awards_list_id_fkey', 'list_id', 'lists', 'id'>,
          FK<'list_awards_game_id_fkey', 'game_id', 'games', 'id'>,
        ];
      };
      friendships: {
        Row: FriendshipRow;
        Insert: Insert<FriendshipRow, 'created_at' | 'responded_at' | 'status'>;
        Update: Partial<FriendshipRow>;
        Relationships: [
          FK<'friendships_user_a_fkey', 'user_a', 'profiles', 'id'>,
          FK<'friendships_user_b_fkey', 'user_b', 'profiles', 'id'>,
          FK<'friendships_requested_by_fkey', 'requested_by', 'profiles', 'id'>,
        ];
      };
      events: {
        Row: EventRow;
        Insert: Insert<
          EventRow,
          'cached_at' | 'source' | 'description' | 'starts_at' | 'live_stream_url' | 'has_venue'
        >;
        Update: Partial<EventRow>;
        Relationships: [];
      };
      event_attendance: {
        Row: EventAttendanceRow;
        Insert: Insert<EventAttendanceRow, 'created_at' | 'mode' | 'reminder_at'>;
        Update: Partial<EventAttendanceRow>;
        Relationships: [
          FK<'event_attendance_event_id_fkey', 'event_id', 'events', 'id'>,
          FK<'event_attendance_user_id_fkey', 'user_id', 'profiles', 'id'>,
        ];
      };
      wall_posts: {
        Row: WallPostRow;
        Insert: Insert<WallPostRow, 'id' | 'created_at'>;
        Update: Partial<WallPostRow>;
        Relationships: [
          FK<'wall_posts_wall_owner_id_fkey', 'wall_owner_id', 'profiles', 'id'>,
          FK<'wall_posts_author_id_fkey', 'author_id', 'profiles', 'id'>,
        ];
      };
      notifications: {
        Row: NotificationRow;
        Insert: Insert<NotificationRow, 'id' | 'created_at' | 'read' | 'target_type' | 'target_id'>;
        Update: Partial<NotificationRow>;
        Relationships: [
          FK<'notifications_user_id_fkey', 'user_id', 'profiles', 'id'>,
          FK<'notifications_actor_id_fkey', 'actor_id', 'profiles', 'id'>,
        ];
      };
      starred_songs: {
        Row: StarredSongRow;
        Insert: Insert<StarredSongRow, 'created_at' | 'updated_at'>;
        Update: Partial<StarredSongRow>;
        Relationships: [
          FK<'starred_songs_user_id_fkey', 'user_id', 'profiles', 'id'>,
          FK<'starred_songs_game_id_fkey', 'game_id', 'games', 'id'>,
        ];
      };
      // --- 0023 playthroughs ---------------------------------------------------
      // The foreign key is composite, to `logs (user_id, game_id)`, which the
      // `FK` shorthand cannot express — and nothing embeds across it.
      playthroughs: {
        Row: PlaythroughRow;
        Insert: Insert<
          PlaythroughRow,
          | 'id'
          | 'created_at'
          | 'updated_at'
          | 'platform'
          | 'started_on'
          | 'finished_on'
          | 'completion'
          | 'completion_percent'
          | 'hours'
          | 'notes'
        >;
        Update: Partial<PlaythroughRow>;
        Relationships: [];
      };
      // --- 0024 physical releases ----------------------------------------------
      // The canonical three (`game_releases`, `release_barcodes`,
      // `release_images`) have no client write policies: their Insert types exist
      // only because supabase-js requires the shape. Writes go through the RPCs.
      game_releases: {
        Row: GameReleaseRow;
        Insert: Insert<
          GameReleaseRow,
          'id' | 'created_at' | 'edition' | 'publisher' | 'release_date' | 'catalog_number'
        >;
        Update: Partial<GameReleaseRow>;
        Relationships: [FK<'game_releases_game_id_fkey', 'game_id', 'games', 'id'>];
      };
      release_barcodes: {
        Row: ReleaseBarcodeRow;
        Insert: Insert<ReleaseBarcodeRow, 'created_at' | 'contribution_id'>;
        Update: Partial<ReleaseBarcodeRow>;
        Relationships: [
          FK<'release_barcodes_release_id_fkey', 'release_id', 'game_releases', 'id'>,
          FK<
            'release_barcodes_contribution_id_fkey',
            'contribution_id',
            'release_contributions',
            'id'
          >,
        ];
      };
      release_images: {
        Row: ReleaseImageRow;
        Insert: Insert<ReleaseImageRow, 'id' | 'created_at' | 'contribution_id'>;
        Update: Partial<ReleaseImageRow>;
        Relationships: [FK<'release_images_release_id_fkey', 'release_id', 'game_releases', 'id'>];
      };
      release_contributions: {
        Row: ReleaseContributionRow;
        Insert: Insert<
          ReleaseContributionRow,
          | 'id'
          | 'created_at'
          | 'updated_at'
          | 'edition'
          | 'publisher'
          | 'release_date'
          | 'catalog_number'
          | 'notes'
          | 'status'
          | 'release_id'
          | 'reviewed_by'
          | 'reviewed_at'
          | 'review_note'
        >;
        Update: Partial<ReleaseContributionRow>;
        /* Two foreign keys to `profiles` (author and reviewer), so an embed of
           either has to name its key: `profile:profiles!release_contributions_user_id_fkey(*)`. */
        Relationships: [
          FK<'release_contributions_user_id_fkey', 'user_id', 'profiles', 'id'>,
          FK<'release_contributions_reviewed_by_fkey', 'reviewed_by', 'profiles', 'id'>,
          FK<'release_contributions_game_id_fkey', 'game_id', 'games', 'id'>,
          FK<'release_contributions_release_id_fkey', 'release_id', 'game_releases', 'id'>,
        ];
      };
      release_contribution_photos: {
        Row: ReleaseContributionPhotoRow;
        Insert: Insert<ReleaseContributionPhotoRow, 'id' | 'created_at'>;
        Update: Partial<ReleaseContributionPhotoRow>;
        Relationships: [
          FK<
            'release_contribution_photos_contribution_id_fkey',
            'contribution_id',
            'release_contributions',
            'id'
          >,
        ];
      };
      owned_copies: {
        Row: OwnedCopyRow;
        Insert: Insert<
          OwnedCopyRow,
          | 'id'
          | 'created_at'
          | 'updated_at'
          | 'release_id'
          | 'contribution_id'
          | 'ownership'
          | 'platform'
          | 'region'
          | 'edition'
          | 'completeness'
          | 'condition'
          | 'notes'
          | 'acquired_on'
        >;
        Update: Partial<OwnedCopyRow>;
        Relationships: [
          FK<'owned_copies_user_id_fkey', 'user_id', 'profiles', 'id'>,
          FK<'owned_copies_game_id_fkey', 'game_id', 'games', 'id'>,
          FK<'owned_copies_release_id_fkey', 'release_id', 'game_releases', 'id'>,
          FK<'owned_copies_contribution_id_fkey', 'contribution_id', 'release_contributions', 'id'>,
        ];
      };
      // --- 0025 community similarity -------------------------------------------
      // Pairs are created only by `suggest_similar_game`; votes are the one
      // community write that goes straight to a table.
      game_similarities: {
        Row: GameSimilarityRow;
        Insert: Insert<GameSimilarityRow, 'id' | 'created_at' | 'created_by' | 'status'>;
        Update: Partial<GameSimilarityRow>;
        Relationships: [
          FK<'game_similarities_game_a_fkey', 'game_a', 'games', 'id'>,
          FK<'game_similarities_game_b_fkey', 'game_b', 'games', 'id'>,
        ];
      };
      game_similarity_upvotes: {
        Row: GameSimilarityUpvoteRow;
        Insert: Insert<GameSimilarityUpvoteRow, 'created_at'>;
        Update: Partial<GameSimilarityUpvoteRow>;
        Relationships: [];
      };
      game_similarity_votes: {
        Row: GameSimilarityVoteRow;
        Insert: Insert<GameSimilarityVoteRow, 'created_at' | 'updated_at' | 'reasons' | 'comment'>;
        Update: Partial<GameSimilarityVoteRow>;
        Relationships: [
          FK<
            'game_similarity_votes_similarity_id_fkey',
            'similarity_id',
            'game_similarities',
            'id'
          >,
        ];
      };
      game_similarity_reports: {
        Row: GameSimilarityReportRow;
        Insert: Insert<GameSimilarityReportRow, 'created_at' | 'note' | 'status'>;
        Update: Partial<GameSimilarityReportRow>;
        Relationships: [];
      };
      // --- 0031 reports on suggestions and reviews ----------------------------
      // Insert and read-your-own only; moderators close them through RPCs.
      similarity_suggestion_reports: {
        Row: SuggestionReportRow;
        Insert: Insert<SuggestionReportRow, 'id' | 'created_at' | 'note' | 'status'>;
        Update: Partial<SuggestionReportRow>;
        Relationships: [];
      };
      review_reports: {
        Row: ReviewReportRow;
        Insert: Insert<ReviewReportRow, 'id' | 'created_at' | 'note' | 'status'>;
        Update: Partial<ReviewReportRow>;
        Relationships: [];
      };
      // --- 0045 ------------------------------------------------------------
      // Both keyed on their own `id`, never on two keys into `profiles`.
      blocks: {
        Row: BlockRow;
        Insert: Insert<BlockRow, 'id' | 'created_at'>;
        Update: Partial<BlockRow>;
        Relationships: [FK<'blocks_blocked_id_fkey', 'blocked_id', 'profiles', 'id'>];
      };
      user_content_reports: {
        Row: UserContentReportRow;
        Insert: Insert<UserContentReportRow, 'id' | 'created_at' | 'note' | 'status'>;
        Update: Partial<UserContentReportRow>;
        Relationships: [];
      };
      moderators: {
        Row: ModeratorRow;
        Insert: Insert<ModeratorRow, 'created_at'>;
        Update: Partial<ModeratorRow>;
        Relationships: [FK<'moderators_user_id_fkey', 'user_id', 'profiles', 'id'>];
      };
      // --- 0034 labels on games ----------------------------------------------
      // The key is `(game_id, label)` and `label` is a word, not a reference,
      // so PostgREST does not read this as a join table (the 0031/0032 trap).
      game_labels: {
        Row: GameLabelRow;
        Insert: Insert<GameLabelRow, 'created_at'>;
        Update: Partial<GameLabelRow>;
        Relationships: [
          FK<'game_labels_game_id_fkey', 'game_id', 'games', 'id'>,
          FK<'game_labels_added_by_fkey', 'added_by', 'profiles', 'id'>,
        ];
      };
      library_pins: {
        Row: LibraryPinRow;
        Insert: Insert<LibraryPinRow, 'id' | 'created_at'>;
        Update: Partial<LibraryPinRow>;
        Relationships: [
          FK<'library_pins_user_id_fkey', 'user_id', 'profiles', 'id'>,
          FK<'library_pins_game_id_fkey', 'game_id', 'games', 'id'>,
        ];
      };
      // --- 0009 linked gaming accounts ---------------------------------------
      // No Insert/Update reaches these from the client: they have no INSERT or
      // UPDATE policies, because `external_id` is only trustworthy when the
      // server verified it. Writes happen in the Edge Functions with the service
      // role. The types stay accurate so the *unlink* path still typechecks.
      // --- 0041 the community score ---------------------------------------
      // Derived and read-only: no client has a write grant on any of these.
      // The Insert/Update types are only what supabase-js's generics need.
      rater_stats: {
        Row: RaterStatsRow;
        Insert: RaterStatsRow;
        Update: Partial<RaterStatsRow>;
        Relationships: [FK<'rater_stats_user_id_fkey', 'user_id', 'profiles', 'id'>];
      };
      game_ratings: {
        Row: GameRatingRow;
        Insert: GameRatingRow;
        Update: Partial<GameRatingRow>;
        Relationships: [FK<'game_ratings_game_id_fkey', 'game_id', 'games', 'id'>];
      };
      community_rating_state: {
        Row: CommunityRatingStateRow;
        Insert: CommunityRatingStateRow;
        Update: Partial<CommunityRatingStateRow>;
        Relationships: [];
      };
      gaming_accounts: {
        Row: GamingAccountRow;
        Insert: Insert<GamingAccountRow, 'linked_at' | 'last_synced_at'>;
        Update: Partial<GamingAccountRow>;
        Relationships: [FK<'gaming_accounts_user_id_fkey', 'user_id', 'profiles', 'id'>];
      };
      gaming_owned_games: {
        Row: GamingOwnedGameRow;
        Insert: Insert<GamingOwnedGameRow, 'synced_at'>;
        Update: Partial<GamingOwnedGameRow>;
        Relationships: [
          FK<'gaming_owned_games_user_id_fkey', 'user_id', 'profiles', 'id'>,
          FK<'gaming_owned_games_game_id_fkey', 'game_id', 'games', 'id'>,
        ];
      };
      gaming_achievements: {
        Row: GamingAchievementRow;
        Insert: Insert<GamingAchievementRow, 'synced_at'>;
        Update: Partial<GamingAchievementRow>;
        Relationships: [FK<'gaming_achievements_user_id_fkey', 'user_id', 'profiles', 'id'>];
      };
      gaming_inventory_items: {
        Row: GamingInventoryItemRow;
        Insert: Insert<GamingInventoryItemRow, 'synced_at'>;
        Update: Partial<GamingInventoryItemRow>;
        Relationships: [FK<'gaming_inventory_items_user_id_fkey', 'user_id', 'profiles', 'id'>];
      };
      gaming_badges: {
        Row: GamingBadgeRow;
        Insert: Insert<GamingBadgeRow, 'synced_at'>;
        Update: Partial<GamingBadgeRow>;
        Relationships: [FK<'gaming_badges_user_id_fkey', 'user_id', 'profiles', 'id'>];
      };
      gaming_provider_friends: {
        Row: GamingProviderFriendRow;
        Insert: Insert<GamingProviderFriendRow, 'synced_at'>;
        Update: Partial<GamingProviderFriendRow>;
        Relationships: [
          FK<'gaming_provider_friends_user_id_fkey', 'user_id', 'profiles', 'id'>,
          // The embed the "friends already on GameLog" list depends on.
          FK<'gaming_provider_friends_matched_user_id_fkey', 'matched_user_id', 'profiles', 'id'>,
        ];
      };
      gaming_sync_state: {
        Row: GamingSyncStateRow;
        Insert: Insert<GamingSyncStateRow, 'attempts'>;
        Update: Partial<GamingSyncStateRow>;
        Relationships: [FK<'gaming_sync_state_user_id_fkey', 'user_id', 'profiles', 'id'>];
      };
    };
    Views: {
      profile_achievement_stats: {
        Row: ProfileAchievementStats;
        Relationships: [];
      };
      gaming_profile_stats: {
        Row: GamingProfileStatsRow;
        Relationships: [];
      };
    };
    /*
     * The discovery functions from 0013. PostgREST cannot order a resource by
     * an aggregate over an embedded one, so "most-liked collections" has to be
     * a function; each returns ids plus a ranking number and the client
     * re-selects the rows it already knows how to select.
     */
    Functions: {
      popular_reviews: {
        Args: { p_limit?: number };
        Returns: { log_id: string; like_count: number }[];
      };
      popular_collections: {
        Args: { p_limit?: number };
        Returns: { list_id: string; like_count: number; item_count: number }[];
      };
      top_reviewers: {
        Args: { p_limit?: number };
        Returns: { user_id: string; review_count: number }[];
      };
      popular_users: {
        Args: { p_limit?: number };
        Returns: { user_id: string; like_count: number }[];
      };
      recommended_users: {
        Args: { p_viewer: string; p_limit?: number };
        Returns: { user_id: string; shared_games: number; affinity: number }[];
      };
      /**
       * The games rated highest on GameLog since `p_since` (0037): a damped
       * average of `logs.rating`, best first. Absent on a database that has
       * not run 0037 — `getBelovedGames` turns that into `null`.
       */
      beloved_games: {
        Args: { p_since: string; p_limit?: number };
        Returns: { game_id: string; average: number; ratings: number }[];
      };
      /**
       * 0038 — popularity as Letterboxd counts it. Reviews by the likes and
       * commenters they drew since `p_since` (null: ever), every author's best
       * first; optionally only those in `p_langs`. In the function's order —
       * which is not the order of `activity`, so do not re-sort by it.
       * Absent before 0038: `getReviewChart` falls back to `popular_reviews`.
       */
      review_popularity: {
        Args: { p_since?: string | null; p_langs?: string[] | null; p_limit?: number };
        Returns: { log_id: string; activity: number; likes: number; comments: number }[];
      };
      /**
       * 0038 — people by the likes, commenters and followers they drew since
       * `p_since`. With `p_circle`, counted among `p_viewer`'s circle only and
       * leaving the circle out: who the people you follow follow and like.
       * Absent before 0038: `getPopularMembers` answers `null`.
       */
      member_popularity: {
        Args: {
          p_since?: string | null;
          p_viewer?: string | null;
          p_circle?: boolean;
          p_langs?: string[] | null;
          p_limit?: number;
        };
        Returns: {
          user_id: string;
          activity: number;
          likes: number;
          comments: number;
          followers: number;
        }[];
      };
      /** 0038 — the people somebody follows, and their accepted friends. */
      circle_of: {
        Args: { p_viewer: string };
        Returns: { user_id: string }[];
      };
      /**
       * Create an awards list and seed its eight default categories.
       *
       * One call rather than an insert plus eight more: a half-seeded ballot is
       * worse than no list, and the client has no transaction to wrap them in.
       * Owner is `auth.uid()` — the function is SECURITY DEFINER and checks the
       * caller itself, so there is no `user_id` argument to get wrong.
       */
      create_awards_list: {
        Args: { list_title: string; list_description?: string | null };
        Returns: string;
      };
      // --- 0024: every write to the release catalogue goes through these ------
      is_moderator: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      submit_release_contribution: {
        Args: {
          p_barcode: string;
          p_game_id: string;
          p_platform: string;
          p_region: ReleaseRegion;
          p_edition?: string;
          p_publisher?: string | null;
          p_release_date?: string | null;
          p_catalog_number?: string | null;
          p_notes?: string | null;
          p_photos?: { kind: ReleasePhotoKind; url: string }[];
        };
        Returns: ContributionResult;
      };
      update_release_contribution: {
        Args: {
          p_id: string;
          p_game_id: string;
          p_platform: string;
          p_region: ReleaseRegion;
          p_edition?: string;
          p_publisher?: string | null;
          p_release_date?: string | null;
          p_catalog_number?: string | null;
          p_notes?: string | null;
        };
        Returns: ContributionResult;
      };
      confirm_release_contribution: {
        Args: { p_id: string };
        Returns: ContributionResult;
      };
      moderate_release_contribution: {
        Args: { p_id: string; p_decision: 'approve' | 'reject'; p_note?: string | null };
        Returns: { status: 'approved'; release_id: string } | { status: 'rejected' };
      };
      // --- 0025 ---------------------------------------------------------------
      suggest_similar_game: {
        Args: {
          p_game: string;
          p_other: string;
          p_reasons?: SimilarityReason[];
          p_comment?: string | null;
        };
        Returns: string;
      };
      community_similar_games: {
        Args: { p_game: string; p_limit?: number; p_sort?: SimilaritySort; p_pair?: string };
        Returns: CommunitySimilarGame[];
      };
      similarity_suggestions: {
        Args: { p_similarity: string };
        Returns: SimilaritySuggestion[];
      };
      similarity_reports_queue: {
        Args: Record<string, never>;
        Returns: SimilarityReportQueueRow[];
      };
      moderate_similarity: {
        Args: { p_id: string; p_action: 'hide' | 'restore' };
        Returns: undefined;
      };
      // --- 0031 ---------------------------------------------------------------
      suggestion_reports_queue: {
        Args: Record<string, never>;
        Returns: SuggestionReportQueueRow[];
      };
      review_reports_queue: {
        Args: Record<string, never>;
        Returns: ReviewReportQueueRow[];
      };
      moderate_suggestion: {
        Args: { p_similarity: string; p_author: string; p_action: 'remove' | 'dismiss' };
        Returns: undefined;
      };
      moderate_review: {
        Args: { p_log: string; p_action: 'remove' | 'dismiss' };
        Returns: undefined;
      };
      // --- 0045 ---------------------------------------------------------------
      block_user: { Args: { p_target: string }; Returns: undefined };
      unblock_user: { Args: { p_target: string }; Returns: undefined };
      user_content_reports_queue: {
        Args: Record<string, never>;
        Returns: UserContentReportQueueRow[];
      };
      moderate_user_content: {
        Args: { p_kind: UserContentKind; p_target: string; p_action: 'remove' | 'dismiss' };
        Returns: undefined;
      };
      delete_my_account: { Args: Record<string, never>; Returns: undefined };
      // --- 0026 ---------------------------------------------------------------
      game_review_stats: {
        Args: { p_game: string };
        Returns: GameReviewStats;
      };
      // --- 0028 ---------------------------------------------------------------
      user_game_stats: {
        Args: { p_user: string };
        Returns: UserGameStats;
      };
      // --- 0041 ---------------------------------------------------------------
      community_rating_params: {
        Args: Record<string, never>;
        Returns: CommunityRatingConfig;
      };
      /** The caller's own statistics — `null` until something has been computed. */
      my_rating_influence: {
        Args: Record<string, never>;
        Returns: {
          rated: number;
          stats: Omit<RaterStatsRow, 'user_id'> | null;
          state: Omit<CommunityRatingStateRow, 'id'> | null;
          params: CommunityRatingConfig;
        };
      };
      recalculate_community_ratings: {
        Args: Record<string, never>;
        Returns: Record<string, number>;
      };
      community_rating_report: {
        Args: { p_limit?: number };
        Returns: CommunityRatingReport;
      };
    };
    Enums: { log_status: LogStatus };
    CompositeTypes: Record<never, never>;
  };
};

/** A log joined with its game and author — what the feed and profile render. */
export type LogWithRelations = GameLog & {
  game: CachedGame | null;
  profile: Profile | null;
};

/** An achievement definition joined with whether the viewed user has it. */
export type AchievementWithUnlock = GameAchievementRow & {
  unlocked_at: string | null;
};
