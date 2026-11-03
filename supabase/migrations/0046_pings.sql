/*
 * 0046 — Pinged: pinging somebody about a thing, and asking everybody for a game.
 *
 * The app is called Pinged now, and a ping is two things in it:
 *
 *   1. **A ping to a person** (`direct_pings`). Somebody sends a game, a
 *      review, a collection, an event, a soundtrack or a request (below) to
 *      people they know, with a line of their own. It lands in the
 *      recipient's inbox, under the bell's Pings tab. Who may ping you is
 *      yours to say (`ping_preferences`): anyone who follows you (the
 *      default), only people you follow back, or only friends.
 *
 *   2. **A ping to the community** (`pings`, `ping_reference_games`,
 *      `ping_suggestions`): a request for a game — "something with writing as
 *      good as Disco Elysium" — with up to three games it is built on. Others
 *      answer it with games from the catalogue and say why. The For You feed
 *      puts first the requests whose reference games the reader has played
 *      (`ping_feed`), which is the whole of the personalisation: a count of
 *      matching games, worked out in Postgres from the reader's own logs, and
 *      never anything but that count leaves the database.
 *
 * Safe to re-run. Drops nothing. The one enum value it adds
 * (`notification_kind.ping_suggestion`) is used only inside a PL/pgSQL
 * trigger body, which runs later — the same arrangement as 0005's.
 *
 * ## What counts as having played a game
 *
 * A log whose status is playing, played, paused or dropped — the set the game
 * page's "Played by" already uses. Not backlog (that is "want to play"), not a
 * wishlist or a collection (list rows, not logs), not a physical copy (a box
 * on a shelf). A score or written words on such a log is the second signal,
 * `reviewed_count`, which the card says but the ranking does not use.
 *
 * ## The ranking
 *
 * For You: the number of a request's reference games the reader has played,
 * capped at two — two or more, then one, then none — and inside a tier the
 * newest first. Latest: newest first, nothing else. A cursor is the last row's
 * `(tier, created_at, id)`, compared as a row, so a page boundary never repeats
 * or skips a request while the feed holds still.
 *
 * ## Safety
 *
 * Every table here is hidden across a block (restrictive policies, as 0045's),
 * a suggestion or a ping cannot be sent across one, and `block_user` now also
 * deletes the pings between the two. Requests and suggestions can be reported
 * through 0045's `user_content_reports`, whose kinds widen to take them, and a
 * moderator's `remove` deletes them. Everything cascades from `profiles`, so
 * `delete_my_account()` needs no change: a deleted request takes its
 * notifications and reports with it by trigger.
 */

-- ---------------------------------------------------------------------------
-- 1. Who may ping you
-- ---------------------------------------------------------------------------

create table if not exists public.ping_preferences (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  audience   text not null default 'followers'
               check (audience in ('followers', 'mutuals', 'friends')),
  updated_at timestamptz not null default now()
);

alter table public.ping_preferences enable row level security;

drop policy if exists "people read their own ping preferences" on public.ping_preferences;
create policy "people read their own ping preferences"
  on public.ping_preferences for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "people set their own ping preferences" on public.ping_preferences;
create policy "people set their own ping preferences"
  on public.ping_preferences for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "people change their own ping preferences" on public.ping_preferences;
create policy "people change their own ping preferences"
  on public.ping_preferences for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

/*
 * May this person ping that one? The recipient's audience, the follows and
 * friendship between them, and no block either way. Internal: a client asks
 * through `pingable_people()`, which only ever answers about people the
 * caller already follows or is friends with.
 */
create or replace function public.can_ping(p_sender uuid, p_recipient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_sender is not null
     and p_recipient is not null
     and p_sender <> p_recipient
     and not public.is_blocked_between(p_sender, p_recipient)
     and case coalesce(
            (select audience from public.ping_preferences where user_id = p_recipient),
            'followers')
           when 'friends' then public.are_friends(p_sender, p_recipient)
           when 'mutuals' then
             exists (select 1 from public.follows
                      where follower_id = p_sender and following_id = p_recipient)
             and exists (select 1 from public.follows
                          where follower_id = p_recipient and following_id = p_sender)
           else
             exists (select 1 from public.follows
                      where follower_id = p_sender and following_id = p_recipient)
         end
$$;

revoke all on function public.can_ping(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. A ping to a person
-- ---------------------------------------------------------------------------
--
-- What was pinged is a kind and an id in the app's own vocabulary — a game id
-- ('igdb:1942'), a log, a list, an event ('igdb:1147'), a game's soundtrack
-- (the game's id) or a request — plus the title, line and picture the sender
-- saw, so an inbox of fifty mixed pings draws in one query. Events live in
-- IGDB and soundtracks on SoundCloud, so there is nothing local to join them
-- to; a soundtrack's title here is the *game's*, never SoundCloud's words.

create table if not exists public.direct_pings (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind         text not null
                 check (kind in ('game', 'review', 'collection', 'event', 'soundtrack', 'request')),
  target_id    text not null check (char_length(target_id) between 1 and 100),
  title        text not null check (char_length(btrim(title)) between 1 and 200),
  subtitle     text check (char_length(subtitle) <= 200),
  image_url    text check (char_length(image_url) <= 1000),
  message      text check (char_length(message) <= 280),
  read         boolean not null default false,
  created_at   timestamptz not null default now(),
  constraint direct_pings_not_self check (sender_id <> recipient_id)
);

create index if not exists direct_pings_inbox_idx
  on public.direct_pings (recipient_id, created_at desc);
create index if not exists direct_pings_unread_idx
  on public.direct_pings (recipient_id) where not read;
create index if not exists direct_pings_sender_idx
  on public.direct_pings (sender_id, created_at desc);

alter table public.direct_pings enable row level security;

drop policy if exists "people see pings they sent or got" on public.direct_pings;
create policy "people see pings they sent or got"
  on public.direct_pings for select to authenticated
  using (recipient_id = auth.uid() or sender_id = auth.uid());

drop policy if exists "people send their own pings" on public.direct_pings;
create policy "people send their own pings"
  on public.direct_pings for insert to authenticated
  with check (sender_id = auth.uid());

drop policy if exists "recipients mark pings read" on public.direct_pings;
create policy "recipients mark pings read"
  on public.direct_pings for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

drop policy if exists "either side deletes a ping" on public.direct_pings;
create policy "either side deletes a ping"
  on public.direct_pings for delete to authenticated
  using (recipient_id = auth.uid() or sender_id = auth.uid());

drop policy if exists "hidden across a block" on public.direct_pings;
create policy "hidden across a block"
  on public.direct_pings as restrictive for select
  using (not (sender_id = any (coalesce((select public.block_partners()), '{}'::uuid[]))));

/* A recipient may only mark a ping read; nothing else about it is theirs. */
revoke update on public.direct_pings from anon, authenticated;
grant update (read) on public.direct_pings to authenticated;

/*
 * The recipient's rule, said in words the sender can act on, and a ceiling
 * on how many pings one person sends in an hour.
 */
create or replace function public.direct_ping_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  audience text;
begin
  new.read := false;
  new.created_at := now();

  if not public.can_ping(new.sender_id, new.recipient_id) then
    if public.is_blocked_between(new.sender_id, new.recipient_id) then
      raise exception 'You can’t ping this person.' using errcode = '42501';
    end if;
    select p.audience into audience from public.ping_preferences p where p.user_id = new.recipient_id;
    raise exception '%', case coalesce(audience, 'followers')
        when 'friends' then 'They only take pings from friends.'
        when 'mutuals' then 'They only take pings from people they follow back.'
        else 'Follow them to ping them.'
      end
      using errcode = '42501';
  end if;

  if (select count(*) from public.direct_pings
       where sender_id = new.sender_id and created_at > now() - interval '1 hour') >= 100 then
    raise exception 'That’s a lot of pings for one hour. Try again later.' using errcode = '54000';
  end if;

  return new;
end;
$$;

drop trigger if exists direct_ping_guard on public.direct_pings;
create trigger direct_ping_guard before insert on public.direct_pings
  for each row execute function public.direct_ping_guard();

/*
 * The people the caller can ping right now: everybody they follow or are
 * friends with whose setting lets them in. The ones pinged most recently
 * first, then by name.
 */
create or replace function public.pingable_people(p_search text default null, p_limit int default 200)
returns setof public.profiles
language sql
stable
security definer
set search_path = public
as $$
  with me as (select auth.uid() as uid),
  candidates as (
    select f.following_id as id from public.follows f where f.follower_id = (select uid from me)
    union
    select case when fr.user_a = (select uid from me) then fr.user_b else fr.user_a end
      from public.friendships fr
     where fr.status = 'accepted'
       and (fr.user_a = (select uid from me) or fr.user_b = (select uid from me))
  )
  select p.*
    from candidates c
    join public.profiles p on p.id = c.id
    left join lateral (
      select max(d.created_at) as last_at
        from public.direct_pings d
       where d.sender_id = (select uid from me) and d.recipient_id = p.id
    ) recent on true
   where public.can_ping((select uid from me), p.id)
     and (coalesce(btrim(p_search), '') = ''
          or p.username ilike '%' || btrim(p_search) || '%'
          or p.display_name ilike '%' || btrim(p_search) || '%')
   order by recent.last_at desc nulls last, lower(coalesce(nullif(btrim(p.display_name), ''), p.username))
   limit least(greatest(coalesce(p_limit, 200), 1), 500)
$$;

revoke all on function public.pingable_people(text, int) from public, anon;
grant execute on function public.pingable_people(text, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. A ping to the community: a request, its games, and the answers
-- ---------------------------------------------------------------------------

create table if not exists public.pings (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  description      text not null check (char_length(btrim(description)) between 1 and 500),
  status           text not null default 'open' check (status in ('open', 'found', 'closed')),
  genres           text[] not null default '{}' check (cardinality(genres) <= 5),
  platforms        text[] not null default '{}' check (cardinality(platforms) <= 5),
  play_length      text check (play_length in ('short', 'medium', 'long')),
  player_mode      text check (player_mode in ('solo', 'multi')),
  release_era      text check (release_era in ('recent', 'modern', 'retro')),
  /* The game that answered it, when its owner says so. */
  resolved_game_id text references public.games (id) on delete set null,
  /* Kept by trigger; never the client's. */
  suggestion_count int not null default 0,
  /* When the owner last opened it — suggestions after this are unseen. */
  owner_seen_at    timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists pings_open_feed_idx
  on public.pings (created_at desc, id desc) where status = 'open';
create index if not exists pings_user_idx on public.pings (user_id, created_at desc);

create table if not exists public.ping_reference_games (
  id         uuid primary key default gen_random_uuid(),
  ping_id    uuid not null references public.pings (id) on delete cascade,
  game_id    text not null references public.games (id) on delete cascade,
  sort_order smallint not null default 0 check (sort_order between 0 and 2),
  created_at timestamptz not null default now(),
  constraint ping_reference_games_once unique (ping_id, game_id)
);

create index if not exists ping_reference_games_game_idx on public.ping_reference_games (game_id);

create table if not exists public.ping_suggestions (
  id          uuid primary key default gen_random_uuid(),
  ping_id     uuid not null references public.pings (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  game_id     text not null references public.games (id) on delete cascade,
  message     text check (char_length(message) <= 500),
  /* The request's owner found this one worth a look. */
  interesting boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint ping_suggestions_once unique (ping_id, user_id, game_id)
);

create index if not exists ping_suggestions_ping_idx on public.ping_suggestions (ping_id, created_at);
create index if not exists ping_suggestions_user_idx on public.ping_suggestions (user_id);

alter table public.pings enable row level security;
alter table public.ping_reference_games enable row level security;
alter table public.ping_suggestions enable row level security;

-- Requests: everybody signed in reads them; their owner writes them.
drop policy if exists "pings are readable" on public.pings;
create policy "pings are readable" on public.pings for select to authenticated using (true);

drop policy if exists "people post their own pings" on public.pings;
create policy "people post their own pings"
  on public.pings for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "people edit their own pings" on public.pings;
create policy "people edit their own pings"
  on public.pings for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "people delete their own pings" on public.pings;
create policy "people delete their own pings"
  on public.pings for delete to authenticated using (user_id = auth.uid());

drop policy if exists "hidden across a block" on public.pings;
create policy "hidden across a block"
  on public.pings as restrictive for select
  using (not (user_id = any (coalesce((select public.block_partners()), '{}'::uuid[]))));

/* What an owner may change. The count and the seen mark are the database's. */
revoke update on public.pings from anon, authenticated;
grant update (description, status, genres, platforms, play_length, player_mode, release_era,
              resolved_game_id)
  on public.pings to authenticated;

-- Reference games follow their request.
drop policy if exists "reference games are readable" on public.ping_reference_games;
create policy "reference games are readable"
  on public.ping_reference_games for select to authenticated
  using (exists (select 1 from public.pings p where p.id = ping_id));

drop policy if exists "owners add reference games" on public.ping_reference_games;
create policy "owners add reference games"
  on public.ping_reference_games for insert to authenticated
  with check (exists (select 1 from public.pings p where p.id = ping_id and p.user_id = auth.uid()));

drop policy if exists "owners remove reference games" on public.ping_reference_games;
create policy "owners remove reference games"
  on public.ping_reference_games for delete to authenticated
  using (exists (select 1 from public.pings p where p.id = ping_id and p.user_id = auth.uid()));

revoke update on public.ping_reference_games from anon, authenticated;

-- Suggestions: readable with their request; written by their author; the
-- owner's "interesting" goes through `set_ping_suggestion_interesting`.
drop policy if exists "suggestions are readable" on public.ping_suggestions;
create policy "suggestions are readable"
  on public.ping_suggestions for select to authenticated
  using (exists (select 1 from public.pings p where p.id = ping_id));

drop policy if exists "people suggest as themselves" on public.ping_suggestions;
create policy "people suggest as themselves"
  on public.ping_suggestions for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "people take back their suggestions" on public.ping_suggestions;
create policy "people take back their suggestions"
  on public.ping_suggestions for delete to authenticated using (user_id = auth.uid());

drop policy if exists "hidden across a block" on public.ping_suggestions;
create policy "hidden across a block"
  on public.ping_suggestions as restrictive for select
  using (not (user_id = any (coalesce((select public.block_partners()), '{}'::uuid[]))));

revoke update on public.ping_suggestions from anon, authenticated;

/*
 * A request as it is written: the database's own fields reset on insert,
 * `updated_at` moved only when the words or the preferences change (a new
 * suggestion, or its owner opening it, is not an edit), and a game that
 * answered it kept only while it is Found.
 */
create or replace function public.pings_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'open';
    new.resolved_game_id := null;
    new.suggestion_count := 0;
    new.owner_seen_at := now();
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  if new.status <> 'found' then
    new.resolved_game_id := null;
  end if;

  if (new.description, new.status, new.genres, new.platforms, new.play_length,
      new.player_mode, new.release_era, new.resolved_game_id)
     is distinct from
     (old.description, old.status, old.genres, old.platforms, old.play_length,
      old.player_mode, old.release_era, old.resolved_game_id) then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists pings_guard on public.pings;
create trigger pings_guard before insert or update on public.pings
  for each row execute function public.pings_guard();

/* Three games at most: a request built on more is not a request any more. */
create or replace function public.ping_reference_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.ping_reference_games where ping_id = new.ping_id) >= 3 then
    raise exception 'A ping can be built on three games at most.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists ping_reference_limit on public.ping_reference_games;
create trigger ping_reference_limit before insert on public.ping_reference_games
  for each row execute function public.ping_reference_limit();

/*
 * What a suggestion has to be: for an open request, somebody else's, not
 * across a block, not one of the games it is built on, and no more than five
 * from one person on one request.
 */
create or replace function public.ping_suggestion_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
  state text;
begin
  select p.user_id, p.status into owner, state from public.pings p where p.id = new.ping_id;
  if owner is null then
    raise exception 'That ping is gone.' using errcode = 'P0002';
  end if;
  if state <> 'open' then
    raise exception 'This ping isn’t taking suggestions any more.' using errcode = '42501';
  end if;
  if owner = new.user_id then
    raise exception 'You can’t suggest a game for your own ping.' using errcode = '42501';
  end if;
  if public.is_blocked_between(owner, new.user_id) then
    raise exception 'You can’t suggest a game here.' using errcode = '42501';
  end if;
  if exists (select 1 from public.ping_reference_games r
              where r.ping_id = new.ping_id and r.game_id = new.game_id) then
    raise exception 'That’s one of the games this ping is built on.' using errcode = '23514';
  end if;
  if (select count(*) from public.ping_suggestions s
       where s.ping_id = new.ping_id and s.user_id = new.user_id) >= 5 then
    raise exception 'You’ve suggested five games here already.' using errcode = '23514';
  end if;

  new.interesting := false;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists ping_suggestion_guard on public.ping_suggestions;
create trigger ping_suggestion_guard before insert on public.ping_suggestions
  for each row execute function public.ping_suggestion_guard();

/* The count is counted, never incremented: a failed write cannot drift it. */
create or replace function public.ping_suggestion_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.ping_id, old.ping_id);
  owner uuid;
begin
  update public.pings
     set suggestion_count = (select count(*) from public.ping_suggestions where ping_id = target)
   where id = target
  returning user_id into owner;

  if tg_op = 'INSERT' and owner is not null and owner <> new.user_id then
    insert into public.notifications (user_id, actor_id, kind, target_type, target_id)
    values (owner, new.user_id, 'ping_suggestion', 'ping', target);
  end if;
  return null;
end;
$$;

drop trigger if exists ping_suggestion_count on public.ping_suggestions;
create trigger ping_suggestion_count after insert or delete on public.ping_suggestions
  for each row execute function public.ping_suggestion_count();

-- ---------------------------------------------------------------------------
-- 4. Notifications learn what a request is
-- ---------------------------------------------------------------------------

alter type public.notification_kind add value if not exists 'ping_suggestion';

alter table public.notifications drop constraint if exists notifications_target_type_check;
alter table public.notifications
  add constraint notifications_target_type_check
  check (target_type in ('post', 'log', 'list', 'ping'));

/* A request that goes takes its notifications and its reports with it. */
create or replace function public.ping_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'pings' then
    delete from public.notifications where target_type = 'ping' and target_id = old.id;
    delete from public.user_content_reports where kind = 'ping' and target_id = old.id;
  else
    delete from public.user_content_reports where kind = 'ping_suggestion' and target_id = old.id;
  end if;
  return old;
end;
$$;

drop trigger if exists ping_cleanup on public.pings;
create trigger ping_cleanup after delete on public.pings
  for each row execute function public.ping_cleanup();

drop trigger if exists ping_cleanup on public.ping_suggestions;
create trigger ping_cleanup after delete on public.ping_suggestions
  for each row execute function public.ping_cleanup();

-- ---------------------------------------------------------------------------
-- 5. The feed
-- ---------------------------------------------------------------------------

/*
 * Requests as a card draws them, a page at a time.
 *
 *   p_mode 'for_you'  open requests by others, by familiarity tier, then newest
 *          'latest'   open requests, newest first
 *          'mine'     the caller's own, every status, newest first
 *   p_ping            one request by id, whatever its status (the detail page)
 *
 * The caller's library enters only as three counts per row and one flag per
 * reference game (`played`), all about the caller themselves.
 *
 * SECURITY INVOKER: the block policies above apply to what it reads.
 */
create or replace function public.ping_feed(
  p_mode        text default 'latest',
  p_genre       text default null,
  p_platform    text default null,
  p_with_refs   boolean default false,
  p_cursor_tier int default null,
  p_cursor_at   timestamptz default null,
  p_cursor_id   uuid default null,
  p_limit       int default 20,
  p_ping        uuid default null
)
returns table (
  id                  uuid,
  user_id             uuid,
  username            text,
  display_name        text,
  avatar_url          text,
  description         text,
  status              text,
  genres              text[],
  platforms           text[],
  play_length         text,
  player_mode         text,
  release_era         text,
  suggestion_count    int,
  unseen_count        int,
  my_suggestion_count int,
  created_at          timestamptz,
  updated_at          timestamptz,
  reference_count     int,
  matched_count       int,
  reviewed_count      int,
  tier                int,
  refs                jsonb,
  resolved_game       jsonb
)
language sql
stable
set search_path = public
as $$
  with me as (select auth.uid() as uid),
  base as (
    select p.*
      from public.pings p
     where case
             when p_ping is not null then p.id = p_ping
             when p_mode = 'mine' then p.user_id = (select uid from me)
             when p_mode = 'for_you' then p.status = 'open' and p.user_id <> (select uid from me)
             else p.status = 'open'
           end
       and (p_ping is not null or p_genre is null or p_genre = any (p.genres))
       and (p_ping is not null or p_platform is null or p_platform = any (p.platforms))
       and (p_ping is not null or not coalesce(p_with_refs, false)
            or exists (select 1 from public.ping_reference_games r0 where r0.ping_id = p.id))
  ),
  scored as (
    select b.*,
           coalesce(m.refs, 0) as ref_total,
           coalesce(m.matched, 0) as matched,
           coalesce(m.reviewed, 0) as reviewed,
           case when p_ping is null and p_mode = 'for_you'
                then least(coalesce(m.matched, 0), 2) else 0 end as rank_tier
      from base b
      left join lateral (
        select count(*)::int as refs,
               count(l.id) filter (
                 where l.status in ('playing', 'played', 'paused', 'dropped'))::int as matched,
               count(l.id) filter (
                 where l.status in ('playing', 'played', 'paused', 'dropped')
                   and (l.rating is not null or l.review is not null or l.review_title is not null)
               )::int as reviewed
          from public.ping_reference_games r
          left join public.logs l on l.game_id = r.game_id and l.user_id = (select uid from me)
         where r.ping_id = b.id
      ) m on true
  )
  select s.id,
         s.user_id,
         pr.username,
         pr.display_name,
         pr.avatar_url,
         s.description,
         s.status,
         s.genres,
         s.platforms,
         s.play_length,
         s.player_mode,
         s.release_era,
         s.suggestion_count,
         case when s.user_id = (select uid from me) then
           (select count(*)::int from public.ping_suggestions u
             where u.ping_id = s.id and u.created_at > s.owner_seen_at)
         else 0 end,
         (select count(*)::int from public.ping_suggestions mine
           where mine.ping_id = s.id and mine.user_id = (select uid from me)),
         s.created_at,
         s.updated_at,
         s.ref_total,
         s.matched,
         s.reviewed,
         s.rank_tier,
         (select coalesce(jsonb_agg(jsonb_build_object(
                    'game_id', g.id,
                    'title', g.title,
                    'cover_url', g.cover_url,
                    'release_year', g.release_year,
                    'played', coalesce(l2.status in ('playing', 'played', 'paused', 'dropped'), false)
                  ) order by r2.sort_order, r2.created_at), '[]'::jsonb)
            from public.ping_reference_games r2
            join public.games g on g.id = r2.game_id
            left join public.logs l2 on l2.game_id = r2.game_id and l2.user_id = (select uid from me)
           where r2.ping_id = s.id),
         (select jsonb_build_object('game_id', rg.id, 'title', rg.title, 'cover_url', rg.cover_url,
                                    'release_year', rg.release_year)
            from public.games rg where rg.id = s.resolved_game_id)
    from scored s
    join public.profiles pr on pr.id = s.user_id
   where p_ping is not null
      or p_cursor_at is null
      or (s.rank_tier, s.created_at, s.id) < (coalesce(p_cursor_tier, 0), p_cursor_at, p_cursor_id)
   order by s.rank_tier desc, s.created_at desc, s.id desc
   limit least(greatest(coalesce(p_limit, 20), 1), 50)
$$;

revoke all on function public.ping_feed(text, text, text, boolean, int, timestamptz, uuid, int, uuid)
  from public, anon;
grant execute on function public.ping_feed(text, text, text, boolean, int, timestamptz, uuid, int, uuid)
  to authenticated;

/* How many suggestions on the caller's requests they have not opened yet. */
create or replace function public.my_unseen_ping_suggestions()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
    from public.ping_suggestions s
    join public.pings p on p.id = s.ping_id
   where p.user_id = auth.uid()
     and s.created_at > p.owner_seen_at
     and not (s.user_id = any (coalesce(public.block_partners(), '{}'::uuid[])))
$$;

revoke all on function public.my_unseen_ping_suggestions() from public, anon;
grant execute on function public.my_unseen_ping_suggestions() to authenticated;

/* The owner opened their request: everything on it so far has been seen. */
create or replace function public.mark_ping_seen(p_ping uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.pings set owner_seen_at = now() where id = p_ping and user_id = auth.uid()
$$;

revoke all on function public.mark_ping_seen(uuid) from public, anon;
grant execute on function public.mark_ping_seen(uuid) to authenticated;

/* The owner's "worth a look" on one suggestion. Nobody else's to set. */
create or replace function public.set_ping_suggestion_interesting(p_suggestion uuid, p_interesting boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ping_suggestions s
     set interesting = coalesce(p_interesting, false)
    from public.pings p
   where s.id = p_suggestion
     and p.id = s.ping_id
     and p.user_id = auth.uid();
  if not found then
    raise exception 'Only the person who asked can mark a suggestion.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.set_ping_suggestion_interesting(uuid, boolean) from public, anon;
grant execute on function public.set_ping_suggestion_interesting(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Blocking reaches pings
-- ---------------------------------------------------------------------------

create or replace function public.block_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Sign in to block someone.' using errcode = '42501';
  end if;
  if p_target is null or p_target = me then
    raise exception 'You can’t block yourself.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_target) then
    raise exception 'That account no longer exists.' using errcode = 'P0002';
  end if;

  insert into public.blocks (blocker_id, blocked_id)
    values (me, p_target)
    on conflict (blocker_id, blocked_id) do nothing;

  delete from public.follows
   where (follower_id = me and following_id = p_target)
      or (follower_id = p_target and following_id = me);
  delete from public.friendships
   where user_a = least(me, p_target) and user_b = greatest(me, p_target);
  delete from public.notifications
   where (user_id = me and actor_id = p_target)
      or (user_id = p_target and actor_id = me);
  delete from public.direct_pings
   where (sender_id = me and recipient_id = p_target)
      or (sender_id = p_target and recipient_id = me);
end;
$$;

revoke all on function public.block_user(uuid) from public, anon;
grant execute on function public.block_user(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Reports reach requests and suggestions
-- ---------------------------------------------------------------------------

alter table public.user_content_reports drop constraint if exists user_content_reports_kind_check;
alter table public.user_content_reports
  add constraint user_content_reports_kind_check
  check (kind in ('comment', 'wall_post', 'profile', 'ping', 'ping_suggestion'));

create or replace function public.fill_report_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.author_id := case new.kind
    when 'comment' then (select user_id from public.comments where id = new.target_id)
    when 'wall_post' then (select author_id from public.wall_posts where id = new.target_id)
    when 'profile' then (select id from public.profiles where id = new.target_id)
    when 'ping' then (select user_id from public.pings where id = new.target_id)
    when 'ping_suggestion' then (select user_id from public.ping_suggestions where id = new.target_id)
  end;
  if new.author_id is null then
    raise exception 'There is nothing there to report any more.' using errcode = 'P0002';
  end if;
  return new;
end;
$$;

create or replace function public.user_content_reports_queue()
returns table (
  kind           text,
  target_id      uuid,
  author_id      uuid,
  author_name    text,
  author_username text,
  body           text,
  avatar_url     text,
  context_type   text,
  context_id     uuid,
  report_count   int,
  report_reasons text[],
  latest_note    text,
  first_reported timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'Only moderators can see reports.' using errcode = '42501';
  end if;
  return query
    select r.kind,
           r.target_id,
           r.author_id,
           coalesce(nullif(btrim(p.display_name), ''), p.username),
           p.username,
           case r.kind
             when 'comment' then c.body
             when 'wall_post' then w.body
             when 'ping' then pg.description
             when 'ping_suggestion' then concat_ws(E'\n', sg_game.title, sg.message)
             else concat_ws(E'\n', nullif(btrim(p.display_name), ''), nullif(btrim(p.bio), ''))
           end,
           case when r.kind = 'profile' then p.avatar_url end,
           case r.kind
             when 'comment' then c.target_type
             when 'wall_post' then 'wall'
             when 'ping' then 'ping'
             when 'ping_suggestion' then 'ping'
           end,
           case r.kind
             when 'comment' then c.target_id
             when 'wall_post' then w.wall_owner_id
             when 'ping' then pg.id
             when 'ping_suggestion' then sg.ping_id
           end,
           count(*)::int,
           array_agg(distinct r.reason),
           (array_agg(r.note order by r.created_at desc) filter (where r.note is not null))[1],
           min(r.created_at)
      from public.user_content_reports r
      join public.profiles p on p.id = r.author_id
      left join public.comments c on r.kind = 'comment' and c.id = r.target_id
      left join public.wall_posts w on r.kind = 'wall_post' and w.id = r.target_id
      left join public.pings pg on r.kind = 'ping' and pg.id = r.target_id
      left join public.ping_suggestions sg on r.kind = 'ping_suggestion' and sg.id = r.target_id
      left join public.games sg_game on sg_game.id = sg.game_id
     where r.status = 'open'
       and (r.kind = 'profile' or c.id is not null or w.id is not null
            or pg.id is not null or sg.id is not null)
     group by r.kind, r.target_id, r.author_id, p.display_name, p.username, p.bio,
              p.avatar_url, c.body, c.target_type, c.target_id, w.body, w.wall_owner_id,
              pg.id, pg.description, sg.ping_id, sg.message, sg_game.title
     order by min(r.created_at);
end;
$$;

revoke all on function public.user_content_reports_queue() from public, anon;
grant execute on function public.user_content_reports_queue() to authenticated;

create or replace function public.moderate_user_content(
  p_kind   text,
  p_target uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'Only moderators can do that.' using errcode = '42501';
  end if;
  if p_action not in ('remove', 'dismiss') then
    raise exception 'Unknown action %.', p_action using errcode = '22023';
  end if;

  if p_action = 'remove' then
    if p_kind = 'comment' then
      update public.comments
         set body = 'This comment was removed by a moderator.'
       where id = p_target;
    elsif p_kind = 'wall_post' then
      /* Its reports go with it (`drop_reports_of_deleted`). */
      delete from public.wall_posts where id = p_target;
      return;
    elsif p_kind = 'ping' then
      /* Its suggestions, notifications and reports go with it. */
      delete from public.pings where id = p_target;
      return;
    elsif p_kind = 'ping_suggestion' then
      delete from public.ping_suggestions where id = p_target;
      return;
    elsif p_kind = 'profile' then
      update public.profiles
         set display_name = null,
             bio = null,
             avatar_url = null,
             banner_url = null,
             location = null,
             username = 'user_' || substr(replace(id::text, '-', ''), 1, 12)
       where id = p_target;
    else
      raise exception 'Unknown kind %.', p_kind using errcode = '22023';
    end if;
  end if;

  update public.user_content_reports set status = 'resolved'
   where kind = p_kind and target_id = p_target and status = 'open';
end;
$$;

revoke all on function public.moderate_user_content(text, uuid, text) from public, anon;
grant execute on function public.moderate_user_content(text, uuid, text) to authenticated;

notify pgrst, 'reload schema';
