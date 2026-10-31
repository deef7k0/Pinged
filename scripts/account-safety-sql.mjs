/**
 * Migration 0045 on a real Postgres, over every migration: blocking, reports
 * on comments, wall posts and profiles, and deleting an account.
 *
 *     npm install --no-save @electric-sql/pglite
 *     node scripts/account-safety-sql.mjs
 *
 * Same set-up as `scripts/discovery-sql.mjs` (the Supabase stubs, the default
 * grants), and the same rule for a failure: each message is the rule it
 * checks, and a disagreement is argued out, not updated.
 *
 * Four people: ana blocks ben; cho watches; mod is a moderator. Then ben
 * deletes his account, and no row anywhere may still name him.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const UNDER_TEST = '0045_account_safety.sql';

let PGlite;
try {
  ({ PGlite } = await import('@electric-sql/pglite'));
} catch {
  console.error(
    'This needs PGlite, which is not one of the app’s dependencies:\n\n' +
      '    npm install --no-save @electric-sql/pglite\n'
  );
  process.exit(1);
}

const SUPABASE = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;
  create schema if not exists auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb,
    created_at timestamptz default now()
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
  create schema if not exists storage;
  create table storage.buckets (id text primary key, name text, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text,
    name text, owner uuid, created_at timestamptz default now());
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select string_to_array(name, '/') $$;
  create schema if not exists extensions;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on all functions in schema auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

const db = new PGlite();
await db.exec(SUPABASE);
for (const file of readdirSync(MIGRATIONS)
  .filter((name) => name.endsWith('.sql'))
  .sort()) {
  await db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'));
}
/* "Safe to re-run", as its header says. */
await db.exec(readFileSync(join(MIGRATIONS, UNDER_TEST), 'utf8'));

const P = {
  ana: '00000000-0000-4000-8000-000000000001',
  ben: '00000000-0000-4000-8000-000000000002',
  cho: '00000000-0000-4000-8000-000000000003',
  mod: '00000000-0000-4000-8000-000000000004',
};
for (const [name, id] of Object.entries(P)) {
  await db.query('insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)', [
    id,
    `${name}@example.test`,
    { username: name },
  ]);
}
await db.query('insert into public.moderators (user_id) values ($1)', [P.mod]);
for (const game of ['g1', 'g2', 'g3']) {
  await db.query(
    "insert into public.games (id, source, source_id, title) values ($1, 'igdb', $2, $3)",
    [`igdb:${game}`, game, game.toUpperCase()]
  );
}

/** Runs as one person, under RLS, as PostgREST would. */
async function as(name, sql, params = []) {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [P[name] ?? '']);
  await db.exec('set role authenticated');
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

async function refuses(promise, pattern, rule) {
  await assert.rejects(promise, pattern, rule);
}

const log = {};
for (const [name, game] of [
  ['ana', 'g1'],
  ['ben', 'g1'],
  ['cho', 'g2'],
]) {
  const { rows } = await as(
    name,
    `insert into public.logs (user_id, game_id, status, rating, review)
     values ($1, $2, 'played', 80, 'words') returning id`,
    [P[name], `igdb:${game}`]
  );
  log[name] = rows[0].id;
}

// Before any block: ben follows ana, likes and comments on her review.
await as('ben', 'insert into public.follows (follower_id, following_id) values ($1, $2)', [
  P.ben,
  P.ana,
]);
await as('ana', 'insert into public.follows (follower_id, following_id) values ($1, $2)', [
  P.ana,
  P.ben,
]);
await as(
  'ben',
  "insert into public.likes (user_id, target_type, target_id) values ($1, 'log', $2)",
  [P.ben, log.ana]
);
const benComment = (
  await as(
    'ben',
    "insert into public.comments (user_id, target_type, target_id, body) values ($1, 'log', $2, 'hi') returning id",
    [P.ben, log.ana]
  )
).rows[0].id;
const anaNotes = await db.query(
  'select count(*)::int as n from public.notifications where user_id = $1',
  [P.ana]
);
assert.ok(anaNotes.rows[0].n > 0, 'ana was notified of the follow, like and comment');

// ---------------------------------------------------------------------------
// Blocking
// ---------------------------------------------------------------------------

await as('ana', 'select public.block_user($1)', [P.ben]);

const follows = await db.query(
  'select count(*)::int as n from public.follows where $1 in (follower_id, following_id) and $2 in (follower_id, following_id)',
  [P.ana, P.ben]
);
assert.equal(follows.rows[0].n, 0, 'a block removes the follows both ways');
const notes = await db.query(
  'select count(*)::int as n from public.notifications where (user_id = $1 and actor_id = $2) or (user_id = $2 and actor_id = $1)',
  [P.ana, P.ben]
);
assert.equal(notes.rows[0].n, 0, 'a block removes the notifications between them');

const seen = async (viewer, author) =>
  (await as(viewer, 'select count(*)::int as n from public.logs where user_id = $1', [P[author]]))
    .rows[0].n;
assert.equal(await seen('ana', 'ben'), 0, 'the blocker does not see the blocked person’s reviews');
assert.equal(await seen('ben', 'ana'), 0, 'nor the other way round');
assert.equal(await seen('cho', 'ben'), 1, 'everybody else still does');
assert.equal(await seen('ana', 'ana'), 1, 'nor does a block hide your own');

const comments = await as('ana', 'select count(*)::int as n from public.comments where id = $1', [
  benComment,
]);
assert.equal(comments.rows[0].n, 0, 'the blocked person’s comments are hidden from the blocker');
const profile = await as('ana', 'select username from public.profiles where id = $1', [P.ben]);
assert.equal(
  profile.rows[0]?.username,
  'ben',
  'profiles stay readable: embeds must not come back null'
);

await refuses(
  as('ben', 'insert into public.follows (follower_id, following_id) values ($1, $2)', [
    P.ben,
    P.ana,
  ]),
  /blocked/,
  'the blocked person cannot follow again'
);
await refuses(
  as('ben', 'insert into public.friendships (user_a, user_b, requested_by) values ($1, $2, $3)', [
    P.ana < P.ben ? P.ana : P.ben,
    P.ana < P.ben ? P.ben : P.ana,
    P.ben,
  ]),
  /blocked|row-level security/,
  'nor send a friend request'
);
await refuses(
  as(
    'ana',
    "insert into public.comments (user_id, target_type, target_id, body) values ($1, 'log', $2, 'x')",
    [P.ana, log.ben]
  ),
  /blocked|does not exist|row-level|not found/i,
  'the blocker cannot comment on the blocked person either'
);
await refuses(
  db
    .query('select public.is_blocked_between($1, $2)', [P.ana, P.ben])
    .then(() => as('cho', 'select public.is_blocked_between($1, $2)', [P.ana, P.ben])),
  /permission denied/,
  'nobody can ask whether two other people blocked each other'
);

const benSees = await as('ben', 'select count(*)::int as n from public.blocks');
assert.equal(benSees.rows[0].n, 0, 'the blocked person cannot read the block');
const anaSees = await as('ana', 'select count(*)::int as n from public.blocks');
assert.equal(anaSees.rows[0].n, 1, 'the blocker can');
await refuses(
  as('ana', 'insert into public.blocks (blocker_id, blocked_id) values ($1, $2)', [P.ana, P.cho]),
  /row-level security/,
  'blocks are written by block_user alone'
);
await refuses(
  as('ana', 'select public.block_user($1)', [P.ana]),
  /yourself/,
  'nobody blocks themselves'
);

await as('ana', 'select public.unblock_user($1)', [P.ben]);
assert.equal(await seen('ana', 'ben'), 1, 'unblocking shows the reviews again');
await as('ben', 'insert into public.follows (follower_id, following_id) values ($1, $2)', [
  P.ben,
  P.ana,
]);

// ---------------------------------------------------------------------------
// Reports on comments, wall posts and profiles
// ---------------------------------------------------------------------------

await as(
  'cho',
  `insert into public.user_content_reports (kind, target_id, author_id, user_id, reason)
   values ('comment', $1, $2, $2, 'harassment')`,
  [benComment, P.cho]
);
/* cho sent herself as the author; the trigger read the comment's instead. */
const filed = await db.query(
  'select author_id from public.user_content_reports where target_id = $1',
  [benComment]
);
assert.equal(
  filed.rows[0]?.author_id,
  P.ben,
  'a report’s author is read off the comment, not the client'
);

await refuses(
  as(
    'ben',
    `insert into public.user_content_reports (kind, target_id, author_id, user_id, reason)
     values ('comment', $1, $2, $2, 'spam')`,
    [benComment, P.ben]
  ),
  /user_content_reports_not_own/,
  'nobody reports their own comment'
);
await as(
  'ana',
  `insert into public.user_content_reports (kind, target_id, author_id, user_id, reason, note)
   values ('profile', $1, $1, $2, 'impersonation', 'not who he says')`,
  [P.ben, P.ana]
);
await refuses(
  as(
    'cho',
    `insert into public.user_content_reports (kind, target_id, author_id, user_id, reason)
     values ('comment', gen_random_uuid(), $1, $1, 'spam')`,
    [P.cho]
  ),
  /nothing there/,
  'a report needs something to report'
);

const othersReports = await as('ana', 'select count(*)::int as n from public.user_content_reports');
assert.equal(othersReports.rows[0].n, 1, 'a reporter sees their own reports only');
await refuses(
  as('cho', 'select * from public.user_content_reports_queue()'),
  /moderators/,
  'the queue is moderators’'
);

const queue = await as('mod', 'select * from public.user_content_reports_queue()');
assert.equal(queue.rows.length, 2, 'both reports are in the queue');
const reportedComment = queue.rows.find((row) => row.kind === 'comment');
assert.equal(reportedComment.body, 'hi');
assert.equal(reportedComment.context_type, 'log');
assert.equal(reportedComment.context_id, log.ana);

await as('mod', "select public.moderate_user_content('comment', $1, 'remove')", [benComment]);
const removed = await db.query('select body from public.comments where id = $1', [benComment]);
assert.match(
  removed.rows[0].body,
  /removed by a moderator/,
  'a removed comment keeps its place in the thread'
);

await as('mod', "select public.moderate_user_content('profile', $1, 'remove')", [P.ben]);
const reset = await db.query(
  'select username, bio, display_name from public.profiles where id = $1',
  [P.ben]
);
assert.match(
  reset.rows[0].username,
  /^user_[0-9a-f]{12}$/,
  'a removed profile gets the sign-up fallback handle'
);
const left = await as('mod', 'select * from public.user_content_reports_queue()');
assert.equal(left.rows.length, 0, 'both decisions closed their reports');

// ---------------------------------------------------------------------------
// Deleting an account
// ---------------------------------------------------------------------------

/* Something of everyone's on ben's writing, and of his on theirs. */
await as(
  'cho',
  "insert into public.likes (user_id, target_type, target_id) values ($1, 'log', $2)",
  [P.cho, log.ben]
);
await as(
  'cho',
  "insert into public.comments (user_id, target_type, target_id, body) values ($1, 'log', $2, 'nice')",
  [P.cho, log.ben]
);
await as(
  'ben',
  "insert into public.comments (user_id, target_type, target_id, body) values ($1, 'log', $2, 'mine')",
  [P.ben, log.cho]
);
const list = (
  await as('ben', "insert into public.lists (user_id, title) values ($1, 'Faves') returning id", [
    P.ben,
  ])
).rows[0].id;
await as(
  'cho',
  "insert into public.likes (user_id, target_type, target_id) values ($1, 'list', $2)",
  [P.cho, list]
);

await refuses(
  db.query('select public.delete_my_account()'),
  /Sign in/,
  'nobody deletes an account signed out'
);
await as('ben', 'select public.delete_my_account()');

const user = await db.query('select count(*)::int as n from auth.users where id = $1', [P.ben]);
assert.equal(user.rows[0].n, 0, 'the account is gone');

const orphans = await db.query(
  `select count(*)::int as n from public.likes where target_id in ($1, $2)`,
  [log.ben, list]
);
assert.equal(orphans.rows[0].n, 0, 'other people’s likes on his writing went with it');
const theirComments = await db.query(
  `select count(*)::int as n from public.comments where target_id = $1`,
  [log.ben]
);
assert.equal(theirComments.rows[0].n, 0, 'and their comments on it');
const choLog = await db.query('select count(*)::int as n from public.logs where user_id = $1', [
  P.cho,
]);
assert.equal(choLog.rows[0].n, 1, 'other people’s own data is untouched');

/* No column of any table in public may still hold his id. */
const columns = await db.query(
  `select table_name, column_name from information_schema.columns
    where table_schema = 'public' and data_type = 'uuid'
      and table_name in (select table_name from information_schema.tables
                          where table_schema = 'public' and table_type = 'BASE TABLE')`
);
for (const { table_name, column_name } of columns.rows) {
  const hit = await db.query(
    `select count(*)::int as n from public."${table_name}" where "${column_name}" = $1`,
    [P.ben]
  );
  assert.equal(hit.rows[0].n, 0, `${table_name}.${column_name} still names the deleted account`);
}

console.log('0045: blocking, reports and account deletion hold.');
