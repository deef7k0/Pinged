/**
 * Migration 0046 on a real Postgres, over every migration: pings to people,
 * requests to the community, the For You ranking and its cursor, and what
 * nobody may do to somebody else's.
 *
 *     npm install --no-save @electric-sql/pglite
 *     node scripts/pings-sql.mjs
 *
 * Same set-up as `scripts/account-safety-sql.mjs`. Each assertion's message is
 * the rule it checks.
 *
 * Five people. ana asks for a game like g1, g2 and g3. ben has played g1 and
 * g2, has g3 only on his wishlist and g4 in his backlog. cho has played g1.
 * dan has played nothing. mod moderates.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const UNDER_TEST = '0046_pings.sql';

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
  dan: '00000000-0000-4000-8000-000000000004',
  mod: '00000000-0000-4000-8000-000000000005',
};
for (const [name, id] of Object.entries(P)) {
  await db.query('insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)', [
    id,
    `${name}@example.test`,
    { username: name },
  ]);
}
await db.query('insert into public.moderators (user_id) values ($1)', [P.mod]);
for (const game of ['g1', 'g2', 'g3', 'g4', 'g5', 'g6']) {
  await db.query(
    "insert into public.games (id, source, source_id, title) values ($1, 'igdb', $2, $3)",
    [`igdb:${game}`, game, game.toUpperCase()]
  );
}
const G = (n) => `igdb:g${n}`;

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

/* Postgres's now() is the transaction's, and each statement here is its own
   transaction — but two may land in one microsecond. Space the requests out
   by setting their times directly, as the owner of the table. */
async function ageRequest(id, minutesAgo) {
  await db.query(`update public.pings set created_at = now() - make_interval(mins => $2) where id = $1`, [
    id,
    minutesAgo,
  ]);
}

// --- Libraries ------------------------------------------------------------
for (const [name, game, status, rating] of [
  ['ben', 1, 'played', 90],
  ['ben', 2, 'playing', null],
  ['ben', 4, 'backlog', null],
  ['cho', 1, 'dropped', null],
  ['ana', 5, 'played', null],
]) {
  await as(
    name,
    'insert into public.logs (user_id, game_id, status, rating) values ($1, $2, $3, $4)',
    [P[name], G(game), status, rating]
  );
}
/* ben's wishlist holds g3: interest, not experience. */
const wish = await as(
  'ben',
  "insert into public.lists (user_id, title, kind) values ($1, 'Wishlist', 'wishlist') returning id",
  [P.ben]
);
await as('ben', 'insert into public.list_items (list_id, game_id, position) values ($1, $2, 0)', [
  wish.rows[0].id,
  G(3),
]);

// --- Requests -------------------------------------------------------------
async function request(name, description, refs = [], extra = {}) {
  const { rows } = await as(
    name,
    `insert into public.pings (user_id, description, genres, platforms, suggestion_count, status)
     values ($1, $2, $3, $4, 99, 'found') returning id, suggestion_count, status`,
    [P[name], description, extra.genres ?? [], extra.platforms ?? []]
  );
  assert.equal(rows[0].suggestion_count, 0, 'a new request starts with no suggestions, whatever is sent');
  assert.equal(rows[0].status, 'open', 'a new request starts open, whatever is sent');
  for (const [index, game] of refs.entries()) {
    await as(
      name,
      'insert into public.ping_reference_games (ping_id, game_id, sort_order) values ($1, $2, $3)',
      [rows[0].id, G(game), index]
    );
  }
  return rows[0].id;
}

const A = await request('ana', 'Writing as good as g1', [1, 2, 3], { genres: ['RPG'] });
const B = await request('ana', 'Something short for one evening', [], { platforms: ['PC'] });
const C = await request('cho', 'More like g1, please', [1]);
const D = await request('dan', 'Anything cosy', [6]);
await ageRequest(A, 40);
await ageRequest(B, 30);
await ageRequest(C, 20);
await ageRequest(D, 10);

await refuses(
  as('ana', 'insert into public.ping_reference_games (ping_id, game_id, sort_order) values ($1, $2, 2)', [
    A,
    G(4),
  ]),
  /three games at most/,
  'a request is built on three games at most'
);
await refuses(
  as('ben', 'insert into public.ping_reference_games (ping_id, game_id, sort_order) values ($1, $2, 0)', [
    B,
    G(4),
  ]),
  /row-level security/,
  'nobody adds games to somebody else’s request'
);

// --- The feed -------------------------------------------------------------
async function feed(name, mode, extra = {}) {
  const { rows } = await as(
    name,
    `select * from public.ping_feed(p_mode => $1, p_genre => $2, p_platform => $3, p_with_refs => $4,
       p_cursor_tier => $5, p_cursor_at => $6, p_cursor_id => $7, p_limit => $8, p_ping => $9)`,
    [
      mode,
      extra.genre ?? null,
      extra.platform ?? null,
      extra.withRefs ?? false,
      extra.cursor?.tier ?? null,
      extra.cursor?.created_at ?? null,
      extra.cursor?.id ?? null,
      extra.limit ?? 20,
      extra.ping ?? null,
    ]
  );
  return rows;
}

const bensForYou = await feed('ben', 'for_you');
assert.deepEqual(
  bensForYou.map((row) => row.id),
  [A, C, D, B],
  'For You: two played reference games, then one, then none by newest'
);
const a = bensForYou[0];
assert.equal(a.matched_count, 2, 'g1 and g2 are played; g3 is only wishlisted');
assert.equal(a.reference_count, 3);
assert.equal(a.reviewed_count, 1, 'ben scored g1, not g2');
assert.equal(a.tier, 2);
assert.deepEqual(
  a.refs.map((ref) => [ref.game_id, ref.played]),
  [
    [G(1), true],
    [G(2), true],
    [G(3), false],
  ],
  'each reference says whether the reader played it, in the owner’s order'
);
assert.equal(a.username, 'ana');

const dansForYou = await feed('dan', 'for_you');
assert.deepEqual(
  dansForYou.map((row) => row.id),
  [C, B, A],
  'with nothing played, For You is newest first — and never the reader’s own'
);
assert.ok(dansForYou.every((row) => row.matched_count === 0));

/* A backlog log is not experience: dan's g6 is backlog-free here, so give him
   one and check it does not count. */
await as('dan', "insert into public.logs (user_id, game_id, status) values ($1, $2, 'backlog')", [
  P.dan,
  G(1),
]);
assert.equal(
  (await feed('dan', 'for_you')).find((row) => row.id === A).matched_count,
  0,
  'a game in the backlog is not a game played'
);

assert.deepEqual(
  (await feed('ben', 'latest')).map((row) => row.id),
  [D, C, B, A],
  'Latest is strictly newest first'
);
assert.ok(
  (await feed('ben', 'latest')).every((row) => row.tier === 0),
  'Latest has no tiers'
);
assert.deepEqual(
  (await feed('ana', 'latest')).map((row) => row.id),
  [D, C, B, A],
  'Latest includes the reader’s own requests'
);
assert.deepEqual(
  (await feed('ana', 'mine')).map((row) => row.id),
  [B, A],
  'My Pings is the reader’s own, newest first'
);
assert.deepEqual(
  (await feed('ben', 'latest', { genre: 'RPG' })).map((row) => row.id),
  [A],
  'the genre filter'
);
assert.deepEqual(
  (await feed('ben', 'latest', { platform: 'PC' })).map((row) => row.id),
  [B],
  'the platform filter'
);
assert.deepEqual(
  (await feed('ben', 'latest', { withRefs: true })).map((row) => row.id),
  [D, C, A],
  'only requests built on games'
);

/* Paging one at a time from the last row's (tier, created_at, id) walks the
   whole feed once, in order, for both rankings. */
for (const mode of ['for_you', 'latest']) {
  const whole = (await feed('ben', mode)).map((row) => row.id);
  const walked = [];
  let cursor = null;
  for (;;) {
    const page = await feed('ben', mode, { limit: 1, cursor });
    if (page.length === 0) break;
    walked.push(page[0].id);
    cursor = page[0];
    assert.ok(walked.length <= whole.length, `${mode}: the cursor must not loop`);
  }
  assert.deepEqual(walked, whole, `${mode}: pages of one repeat nothing and skip nothing`);
}

// --- Suggestions ------------------------------------------------------------
const suggest = (name, ping, game, message = null) =>
  as(
    name,
    `insert into public.ping_suggestions (ping_id, user_id, game_id, message, interesting)
     values ($1, $2, $3, $4, true) returning id, interesting`,
    [ping, P[name], G(game), message]
  );

const bensSuggestion = await suggest('ben', A, 4, 'Same writers, more walking');
assert.equal(bensSuggestion.rows[0].interesting, false, 'only the owner marks a suggestion interesting');
await refuses(suggest('ben', A, 4), /duplicate key|ping_suggestions_once/, 'one person, one game, once');
await suggest('cho', A, 4, 'Agreed, try it');
await suggest('cho', A, 5);
await refuses(suggest('ana', A, 4), /your own ping/, 'nobody answers their own request');
await refuses(suggest('ben', A, 1), /built on/, 'a reference game is not an answer');

let anasA = (await feed('ana', 'mine')).find((row) => row.id === A);
assert.equal(anasA.suggestion_count, 3, 'the count is the database’s');
assert.equal(anasA.unseen_count, 3, 'three suggestions ana has not opened');
assert.equal(
  (await as('ana', 'select public.my_unseen_ping_suggestions() as n')).rows[0].n,
  3,
  'the tab’s dot'
);
const notified = await db.query(
  "select actor_id from public.notifications where user_id = $1 and kind = 'ping_suggestion' and target_type = 'ping' and target_id = $2",
  [P.ana, A]
);
assert.equal(notified.rows.length, 3, 'each suggestion tells the owner');
assert.equal(
  (await feed('ben', 'latest')).find((row) => row.id === A).my_suggestion_count,
  1,
  'the reader sees how many they suggested'
);

await as('ana', 'select public.mark_ping_seen($1)', [A]);
anasA = (await feed('ana', 'mine')).find((row) => row.id === A);
assert.equal(anasA.unseen_count, 0, 'opening it sees everything so far');
await refuses(
  as('ana', 'update public.pings set suggestion_count = 50 where id = $1', [A]),
  /permission denied/,
  'not even the owner sets the count'
);
const bensEdit = await as('ben', "update public.pings set description = 'mine now' where id = $1", [A]);
assert.equal(bensEdit.affectedRows, 0, 'nobody edits somebody else’s request');
await refuses(
  as('ben', 'select public.set_ping_suggestion_interesting($1, true)', [bensSuggestion.rows[0].id]),
  /Only the person who asked/,
  'only the owner marks a suggestion'
);
await as('ana', 'select public.set_ping_suggestion_interesting($1, true)', [bensSuggestion.rows[0].id]);
assert.equal(
  (await db.query('select interesting from public.ping_suggestions where id = $1', [bensSuggestion.rows[0].id]))
    .rows[0].interesting,
  true
);

await as('ana', "update public.pings set status = 'found', resolved_game_id = $2 where id = $1", [A, G(4)]);
assert.ok(
  !(await feed('ben', 'latest')).some((row) => row.id === A),
  'a found request leaves the open feeds'
);
const found = (await feed('ben', 'latest', { ping: A }))[0];
assert.equal(found.status, 'found', 'and still opens by its id');
assert.equal(found.resolved_game.game_id, G(4), 'with the game that answered it');
await refuses(suggest('dan', A, 6), /isn’t taking suggestions/, 'a found request takes no more');
await as('ana', "update public.pings set status = 'open' where id = $1", [A]);
assert.equal(
  (await db.query('select resolved_game_id from public.pings where id = $1', [A])).rows[0].resolved_game_id,
  null,
  'reopened, it has no answer'
);

// --- Pings to people ---------------------------------------------------------
const ping = (from, to, extra = {}) =>
  as(
    from,
    `insert into public.direct_pings (sender_id, recipient_id, kind, target_id, title, message)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [P[from], P[to], extra.kind ?? 'game', extra.target ?? G(1), extra.title ?? 'G1', extra.message ?? null]
  );

await refuses(ping('ben', 'ana'), /Follow them/, 'by default, only followers ping');
await as('ben', 'insert into public.follows (follower_id, following_id) values ($1, $2)', [P.ben, P.ana]);
const first = await ping('ben', 'ana', { message: 'You need this' });
assert.deepEqual(
  (await as('ben', 'select id from public.pingable_people()')).rows.map((row) => row.id),
  [P.ana],
  'the people ben can ping'
);

await as('ana', "insert into public.ping_preferences (user_id, audience) values ($1, 'mutuals')", [P.ana]);
await refuses(ping('ben', 'ana'), /follow back/, 'mutuals: a one-way follow is not enough');
assert.deepEqual(
  (await as('ben', 'select id from public.pingable_people()')).rows,
  [],
  'and the picker stops offering her'
);
await as('ana', 'insert into public.follows (follower_id, following_id) values ($1, $2)', [P.ana, P.ben]);
await ping('ben', 'ana', { kind: 'request', target: C, title: 'More like g1' });

await as('ana', "update public.ping_preferences set audience = 'friends' where user_id = $1", [P.ana]);
await refuses(ping('ben', 'ana'), /friends/, 'friends only: follows are not enough');
await as(
  'ben',
  "insert into public.friendships (user_a, user_b, requested_by, status) values ($1, $2, $2, 'pending')",
  [P.ana, P.ben]
);
await as('ana', "update public.friendships set status = 'accepted' where user_a = $1 and user_b = $2", [
  P.ana,
  P.ben,
]);
await ping('ben', 'ana');

await refuses(
  as('cho', "select * from public.ping_preferences where user_id = $1", [P.ana]).then((result) => {
    if (result.rows.length === 0) throw new Error('hidden');
  }),
  /hidden/,
  'who may ping somebody is theirs to know'
);

const inbox = await as('ana', 'select id, read from public.direct_pings where recipient_id = $1', [P.ana]);
assert.equal(inbox.rows.length, 3);
assert.equal(
  (await as('cho', 'select id from public.direct_pings')).rows.length,
  0,
  'nobody reads pings between two others'
);
await as('ana', 'update public.direct_pings set read = true where id = $1', [first.rows[0].id]);
await refuses(
  as('ana', "update public.direct_pings set title = 'edited' where id = $1", [first.rows[0].id]),
  /permission denied/,
  'a recipient marks a ping read and changes nothing else'
);
const bensMark = await as('ben', 'update public.direct_pings set read = false where id = $1', [first.rows[0].id]);
assert.equal(bensMark.affectedRows, 0, 'the sender cannot mark it for her');

// --- Blocking ------------------------------------------------------------------
await as('ana', 'select public.block_user($1)', [P.ben]);
assert.equal(
  (await db.query('select count(*)::int as n from public.direct_pings where sender_id = $1 and recipient_id = $2', [P.ben, P.ana]))
    .rows[0].n,
  0,
  'a block deletes the pings between them'
);
assert.ok(
  !(await feed('ben', 'latest')).some((row) => row.user_id === P.ana),
  'ben no longer sees ana’s requests'
);
assert.equal(
  (await as('ana', 'select id from public.ping_suggestions where user_id = $1', [P.ben])).rows.length,
  0,
  'ana no longer sees ben’s suggestions'
);
await refuses(ping('ben', 'ana'), /can’t ping/, 'nor can he ping her');
await refuses(suggest('ben', B, 6), /can’t suggest/, 'nor answer her');
await as('ana', 'select public.unblock_user($1)', [P.ben]);

// --- Reports --------------------------------------------------------------------
await as(
  'dan',
  `insert into public.user_content_reports (kind, target_id, author_id, user_id, reason)
   values ('ping', $1, $2, $2, 'spam')`,
  [B, P.dan]
);
const report = await db.query("select author_id from public.user_content_reports where kind = 'ping'");
assert.equal(report.rows[0].author_id, P.ana, 'the author is read off the request, not the client');
const choSuggestion = await db.query('select id from public.ping_suggestions where user_id = $1 limit 1', [P.cho]);
await as(
  'dan',
  `insert into public.user_content_reports (kind, target_id, author_id, user_id, reason)
   values ('ping_suggestion', $1, $2, $2, 'off_topic')`,
  [choSuggestion.rows[0].id, P.dan]
);
const queue = await as('mod', 'select kind, context_type, context_id, body from public.user_content_reports_queue()');
assert.deepEqual(
  queue.rows.map((row) => [row.kind, row.context_type]).sort(),
  [
    ['ping', 'ping'],
    ['ping_suggestion', 'ping'],
  ],
  'both reach the moderators, pointing at their request'
);
await as('mod', "select public.moderate_user_content('ping', $1, 'remove')", [B]);
assert.equal(
  (await db.query('select count(*)::int as n from public.pings where id = $1', [B])).rows[0].n,
  0,
  'removing a request deletes it'
);
assert.equal(
  (await db.query("select count(*)::int as n from public.user_content_reports where kind = 'ping'")).rows[0].n,
  0,
  'and its reports'
);

// --- Deleting an account -----------------------------------------------------------
await as('ana', 'select public.delete_my_account()');
assert.equal(
  (await db.query("select count(*)::int as n from public.notifications where target_type = 'ping'")).rows[0].n,
  0,
  'a deleted account’s requests take their notifications with them'
);
const columns = await db.query(
  `select table_name, column_name from information_schema.columns
    where table_schema = 'public' and data_type = 'uuid'
      and table_name in (select table_name from information_schema.tables
                          where table_schema = 'public' and table_type = 'BASE TABLE')`
);
for (const { table_name, column_name } of columns.rows) {
  const hit = await db.query(
    `select count(*)::int as n from public."${table_name}" where "${column_name}" = $1`,
    [P.ana]
  );
  assert.equal(hit.rows[0].n, 0, `${table_name}.${column_name} still names the deleted account`);
}

console.log('0046: pings, requests, the For You ranking and its cursor hold.');
