/*
 * 0045 — what a store release needs from a social app: blocking, reports on
 * every kind of thing people write, and deleting your own account.
 *
 * Google Play's user-generated content policy asks for a way to report
 * objectionable content *and users*, a way to block them, and — for any app
 * where an account can be made — a way to delete it, with its data, from
 * inside the app. 0025 and 0031 covered picks, suggestions and reviews; this
 * covers the rest.
 *
 * Safe to re-run. Drops nothing.
 *
 * ## Blocking
 *
 * `blocks` holds who blocked whom, readable only by the person who did it.
 * A block works in both directions, because what it is for is distance:
 *
 *   - **Neither sees the other's writing.** Restrictive policies on `logs`,
 *     `comments`, `wall_posts` and `lists` hide every row whose author is on
 *     the other side of a block with the reader. Restrictive, so they AND with
 *     every existing policy instead of being one more way in. Profiles stay
 *     readable — every embed of an author would come back null otherwise, and
 *     the blocked profile is where the Unblock control is.
 *   - **Neither can reach the other.** A trigger refuses a follow, a friend
 *     request, a comment or a reply on the other's writing, a like, and a wall
 *     post across a block; and a notification between them is dropped.
 *   - **Blocking cuts what is already there**: follows both ways, the
 *     friendship, and the notifications between them (`block_user`).
 *
 * Only `block_user` / `unblock_user` write `blocks`. `block_partners()` is the
 * one way a policy learns who is on the other side, and says nothing about
 * anybody but the caller — so a person cannot ask whether two others have
 * blocked each other.
 *
 * Moderation and the community score are unaffected: their functions are
 * SECURITY DEFINER and read past RLS, so a block hides a person's ratings from
 * the reader's lists without changing what a game scores.
 *
 * ## Reports on comments, wall posts and profiles
 *
 * One table, `user_content_reports`, rather than a fourth, fifth and sixth
 * copy of 0031's: the three are judged the same way and land in one tab of the
 * moderation queue. Keyed on its own `id` — never on two foreign keys to
 * `profiles`, which PostgREST would read as a join table (0032's lesson).
 * `author_id` is filled in by a trigger from the thing reported, never taken
 * from the client.
 *
 * A moderator's `remove` replaces a comment's words with a line saying it was
 * removed (its replies stay in their thread), deletes a wall post, and on a
 * profile clears the name, the bio, the pictures and the place, and gives the
 * account back the handle it would have had on sign-up — so its owner is asked
 * for a new one.
 *
 * ## Deleting your account
 *
 * `delete_my_account()` deletes the caller's `auth.users` row. Every table that
 * holds a person's data references `profiles` (or `auth.users`) with ON DELETE
 * CASCADE, so that one delete takes their profile, logs, reviews, playthroughs,
 * lists, likes, comments, wall posts, follows, friendships, copies, linked
 * accounts, reports, pins, starred song and rating statistics with it. Before
 * it, the function removes what cascades cannot reach: other people's likes,
 * comments and notifications that point at this person's logs, lists and posts
 * (polymorphic targets, which have no foreign key).
 *
 * What stays is shared and holds no name: a release they added to the barcode
 * catalogue (`created_by` and `reviewed_by` are set null), and photos of a box
 * they submitted for it. Their uploaded pictures in the `media` bucket are
 * deleted by the app before this is called (storage cannot be emptied from
 * SQL); the privacy policy says all of this.
 *
 * It runs as the function's owner, which on Supabase is `postgres` and may
 * delete from `auth.users`. If a project ever refuses that, the fallback is an
 * Edge Function calling `auth.admin.deleteUser` with the service role.
 */

-- ---------------------------------------------------------------------------
-- Blocks
-- ---------------------------------------------------------------------------

create table if not exists public.blocks (
  id          uuid primary key default gen_random_uuid(),
  blocker_id  uuid not null references public.profiles (id) on delete cascade,
  blocked_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint blocks_one_per_pair unique (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

drop policy if exists "people see whom they blocked" on public.blocks;
create policy "people see whom they blocked"
  on public.blocks for select to authenticated
  using (blocker_id = auth.uid());

/* Everyone on either side of a block with the caller. Empty when signed out. */
create or replace function public.block_partners()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(other), '{}'::uuid[])
    from (
      select blocked_id as other from public.blocks where blocker_id = auth.uid()
      union
      select blocker_id from public.blocks where blocked_id = auth.uid()
    ) partners
$$;

revoke all on function public.block_partners() from public;
grant execute on function public.block_partners() to anon, authenticated;

/* For triggers only: says whether two arbitrary people are blocked. */
create or replace function public.is_blocked_between(p_one uuid, p_two uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_one is not null and p_two is not null and exists (
    select 1 from public.blocks
     where (blocker_id = p_one and blocked_id = p_two)
        or (blocker_id = p_two and blocked_id = p_one)
  )
$$;

revoke all on function public.is_blocked_between(uuid, uuid) from public, anon, authenticated;

-- Hidden across a block. `(select …)` makes the array an init plan: worked
-- out once per query, not once per row.
drop policy if exists "hidden across a block" on public.logs;
create policy "hidden across a block"
  on public.logs as restrictive for select
  using (not (user_id = any (coalesce((select public.block_partners()), '{}'::uuid[]))));

drop policy if exists "hidden across a block" on public.comments;
create policy "hidden across a block"
  on public.comments as restrictive for select
  using (not (user_id = any (coalesce((select public.block_partners()), '{}'::uuid[]))));

drop policy if exists "hidden across a block" on public.wall_posts;
create policy "hidden across a block"
  on public.wall_posts as restrictive for select
  using (not (author_id = any (coalesce((select public.block_partners()), '{}'::uuid[]))));

drop policy if exists "hidden across a block" on public.lists;
create policy "hidden across a block"
  on public.lists as restrictive for select
  using (not (user_id = any (coalesce((select public.block_partners()), '{}'::uuid[]))));

/* Refuses reaching somebody across a block. One function, every table. */
create or replace function public.refuse_across_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid;
  other uuid;
  parent_author uuid;
begin
  case tg_table_name
    when 'follows' then
      actor := new.follower_id;
      other := new.following_id;
    when 'friendships' then
      actor := new.requested_by;
      other := case when new.user_a = new.requested_by then new.user_b else new.user_a end;
    when 'comments' then
      actor := new.user_id;
      other := public.target_owner(new.target_type, new.target_id);
      if new.parent_id is not null then
        select user_id into parent_author from public.comments where id = new.parent_id;
        if public.is_blocked_between(actor, parent_author) then
          raise exception 'You can’t reply to this person.' using errcode = '42501';
        end if;
      end if;
    when 'likes' then
      actor := new.user_id;
      other := public.target_owner(new.target_type, new.target_id);
    when 'wall_posts' then
      actor := new.author_id;
      other := new.wall_owner_id;
    else
      return new;
  end case;

  if public.is_blocked_between(actor, other) then
    raise exception 'You can’t do that: one of you has blocked the other.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists refuse_across_block on public.follows;
create trigger refuse_across_block before insert on public.follows
  for each row execute function public.refuse_across_block();

drop trigger if exists refuse_across_block on public.friendships;
create trigger refuse_across_block before insert on public.friendships
  for each row execute function public.refuse_across_block();

drop trigger if exists refuse_across_block on public.comments;
create trigger refuse_across_block before insert on public.comments
  for each row execute function public.refuse_across_block();

drop trigger if exists refuse_across_block on public.likes;
create trigger refuse_across_block before insert on public.likes
  for each row execute function public.refuse_across_block();

drop trigger if exists refuse_across_block on public.wall_posts;
create trigger refuse_across_block before insert on public.wall_posts
  for each row execute function public.refuse_across_block();

/* A notification between two people with a block between them is not sent. */
create or replace function public.drop_notification_across_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_blocked_between(new.user_id, new.actor_id) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists drop_across_block on public.notifications;
create trigger drop_across_block before insert on public.notifications
  for each row execute function public.drop_notification_across_block();

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
end;
$$;

create or replace function public.unblock_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to unblock someone.' using errcode = '42501';
  end if;
  delete from public.blocks where blocker_id = auth.uid() and blocked_id = p_target;
end;
$$;

revoke all on function public.block_user(uuid) from public, anon;
revoke all on function public.unblock_user(uuid) from public, anon;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Reports on comments, wall posts and profiles
-- ---------------------------------------------------------------------------

create table if not exists public.user_content_reports (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('comment', 'wall_post', 'profile')),
  target_id   uuid not null,
  author_id   uuid not null references public.profiles (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  reason      text not null
                check (reason in ('spoilers', 'spam', 'inappropriate', 'harassment', 'off_topic', 'impersonation')),
  note        text check (char_length(note) <= 300),
  status      text not null default 'open' check (status in ('open', 'resolved')),
  created_at  timestamptz not null default now(),
  constraint user_content_reports_one_per_person unique (kind, target_id, user_id),
  constraint user_content_reports_not_own check (author_id <> user_id)
);

create index if not exists user_content_reports_open_idx
  on public.user_content_reports (kind, target_id)
  where status = 'open';

alter table public.user_content_reports enable row level security;

drop policy if exists "reporters read their own reports" on public.user_content_reports;
create policy "reporters read their own reports"
  on public.user_content_reports for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "people file their own reports" on public.user_content_reports;
create policy "people file their own reports"
  on public.user_content_reports for insert to authenticated
  with check (user_id = auth.uid());

/* Who wrote it is read off the thing itself, not taken from the client. */
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
  end;
  if new.author_id is null then
    raise exception 'There is nothing there to report any more.' using errcode = 'P0002';
  end if;
  return new;
end;
$$;

drop trigger if exists fill_report_author on public.user_content_reports;
create trigger fill_report_author before insert on public.user_content_reports
  for each row execute function public.fill_report_author();

/* A deleted comment or wall post takes its reports with it. */
create or replace function public.drop_reports_of_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.user_content_reports
   where target_id = old.id
     and kind = case tg_table_name when 'comments' then 'comment' else 'wall_post' end;
  return old;
end;
$$;

drop trigger if exists drop_reports_of_deleted on public.comments;
create trigger drop_reports_of_deleted after delete on public.comments
  for each row execute function public.drop_reports_of_deleted();

drop trigger if exists drop_reports_of_deleted on public.wall_posts;
create trigger drop_reports_of_deleted after delete on public.wall_posts
  for each row execute function public.drop_reports_of_deleted();

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
             else concat_ws(E'\n', nullif(btrim(p.display_name), ''), nullif(btrim(p.bio), ''))
           end,
           case when r.kind = 'profile' then p.avatar_url end,
           case r.kind when 'comment' then c.target_type when 'wall_post' then 'wall' end,
           case r.kind when 'comment' then c.target_id when 'wall_post' then w.wall_owner_id end,
           count(*)::int,
           array_agg(distinct r.reason),
           (array_agg(r.note order by r.created_at desc) filter (where r.note is not null))[1],
           min(r.created_at)
      from public.user_content_reports r
      join public.profiles p on p.id = r.author_id
      left join public.comments c on r.kind = 'comment' and c.id = r.target_id
      left join public.wall_posts w on r.kind = 'wall_post' and w.id = r.target_id
     where r.status = 'open'
       and (r.kind = 'profile' or c.id is not null or w.id is not null)
     group by r.kind, r.target_id, r.author_id, p.display_name, p.username, p.bio,
              p.avatar_url, c.body, c.target_type, c.target_id, w.body, w.wall_owner_id
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
    elsif p_kind = 'profile' then
      update public.profiles
         set display_name = null,
             bio = null,
             avatar_url = null,
             banner_url = null,
             location = null,
             /* The handle 0001 gives an account that signed up without one,
                so its owner is asked for a new one. */
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

-- ---------------------------------------------------------------------------
-- Deleting your account
-- ---------------------------------------------------------------------------

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Sign in to delete your account.' using errcode = '42501';
  end if;

  /* Other people's likes, comments and notifications on this person's
     writing: polymorphic, so no foreign key cascades them. */
  delete from public.likes
   where (target_type = 'log' and target_id in (select id from public.logs where user_id = me))
      or (target_type = 'list' and target_id in (select id from public.lists where user_id = me))
      or (target_type = 'post' and target_id in (select id from public.posts where user_id = me));
  delete from public.comments
   where (target_type = 'log' and target_id in (select id from public.logs where user_id = me))
      or (target_type = 'list' and target_id in (select id from public.lists where user_id = me))
      or (target_type = 'post' and target_id in (select id from public.posts where user_id = me));
  delete from public.notifications
   where (target_type = 'log' and target_id in (select id from public.logs where user_id = me))
      or (target_type = 'list' and target_id in (select id from public.lists where user_id = me))
      or (target_type = 'post' and target_id in (select id from public.posts where user_id = me));

  /* Everything else is ON DELETE CASCADE from here. */
  delete from auth.users where id = me;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

notify pgrst, 'reload schema';
