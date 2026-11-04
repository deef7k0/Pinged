/**
 * Migration 0047 on a real Postgres, over every migration: Favourites holds
 * ten games, and neither Favourites nor the wishlist can be deleted by its
 * owner — while deleting an account (a cascade) still takes both.
 *
 *     npm install --no-save @electric-sql/pglite
 *     node scripts/favourites-sql.mjs
 *
 * Same set-up as scripts/account-safety-sql.mjs.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const UNDER_TEST = '0047_favourites_top_ten.sql';

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


/* Nine more games, and ana's favourites and wishlist, as the app makes them. */
for (let n = 4; n <= 12; n += 1) {
  await db.query(
    "insert into public.games (id, source, source_id, title) values ($1, 'igdb', $2, $3)",
    [`igdb:g${n}`, `g${n}`, `G${n}`]
  );
}
const games = Array.from({ length: 12 }, (_, i) => `igdb:g${i + 1}`);
const fav = (
  await as(
    'ana',
    "insert into public.lists (user_id, title, kind, is_ranked) values ($1, 'Favourites', 'favorites', true) returning id",
    [P.ana]
  )
).rows[0].id;
const wish = (
  await as(
    'ana',
    "insert into public.lists (user_id, title, kind) values ($1, 'Wishlist', 'wishlist') returning id",
    [P.ana]
  )
).rows[0].id;

for (let i = 0; i < 10; i += 1) {
  await as('ana', 'insert into public.list_items (list_id, game_id, position) values ($1, $2, $3)', [
    fav,
    games[i],
    i,
  ]);
}
await refuses(
  as('ana', 'insert into public.list_items (list_id, game_id, position) values ($1, $2, 10)', [
    fav,
    games[10],
  ]),
  /ten games/,
  'an eleventh favourite is refused'
);
/* Re-saving one already in it is not an eleventh. */
await as(
  'ana',
  `insert into public.list_items (list_id, game_id, position) values ($1, $2, 3)
   on conflict (list_id, game_id) do update set position = excluded.position`,
  [fav, games[0]]
);
/* A wishlist has no such limit. */
for (const game of games) {
  await as('ana', 'insert into public.list_items (list_id, game_id) values ($1, $2)', [wish, game]);
}

await as('ana', 'delete from public.list_items where list_id = $1', [fav]);
const left = (
  await db.query('select count(*)::int as n from public.list_items where list_id = $1', [fav])
).rows[0].n;
assert.equal(left, 0, 'favourites can be emptied');

await refuses(
  as('ana', 'delete from public.lists where id = $1', [fav]),
  /emptied, not deleted/,
  'favourites cannot be deleted by their owner'
);
await refuses(
  as('ana', 'delete from public.lists where id = $1', [wish]),
  /emptied, not deleted/,
  'the wishlist cannot be deleted by its owner'
);
const own = (
  await as('ana', "insert into public.lists (user_id, title, kind) values ($1, 'Mine', 'list') returning id", [
    P.ana,
  ])
).rows[0].id;
await as('ana', 'delete from public.lists where id = $1', [own]);

/* An account deleted takes both with it. */
await as('ana', 'select public.delete_my_account()');
const gone = (
  await db.query('select count(*)::int as n from public.lists where user_id = $1', [P.ana])
).rows[0].n;
assert.equal(gone, 0, 'a deleted account leaves no lists');

console.log('0047: Favourites holds ten, and the two singleton lists stay.');
