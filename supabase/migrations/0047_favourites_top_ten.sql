/*
 * 0047 — Favourites is a person's Top 10 (the owner's, 2026-11-03).
 *
 * "The default Favourites collection that links to the top 4 favourite should
 * only allow 10 games to be listed, and this collection can't be created by
 * the user nor deleted, although they can have it so no games are inside."
 *
 *  - **Ten at most.** A trigger refuses an eleventh game in a `favorites`
 *    list. Re-saving a game already in it (an upsert, a move) is not an
 *    eleventh and passes. A list that already holds more than ten from
 *    before this keeps them; it only cannot grow.
 *  - **Never deleted by its owner.** Favourites and the wishlist are made by
 *    the app (`getOrCreateSingletonList`) and 0003's partial unique indexes
 *    already keep them one each, so nobody can make a second. A DELETE of
 *    either, sent directly, is refused. A delete that cascades — an account
 *    being deleted (0045's `delete_my_account`) — runs inside the foreign
 *    key's own trigger, at a trigger depth above one, and is let through.
 *    Emptying it is allowed: a Top 10 can have nothing in it.
 *
 * Safe to re-run. Drops nothing. Nothing in the app breaks without it: the
 * app checks the ten itself before it asks, and hides Delete on both lists.
 */

create or replace function public.favorites_hold_ten()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.lists where id = new.list_id and kind = 'favorites')
     and (
       select count(*) from public.list_items
       where list_id = new.list_id and game_id <> new.game_id
     ) >= 10
  then
    raise exception 'Your favourites hold ten games. Take one off first.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists list_items_favorites_hold_ten on public.list_items;
create trigger list_items_favorites_hold_ten
  before insert on public.list_items
  for each row execute function public.favorites_hold_ten();

create or replace function public.keep_singleton_lists()
returns trigger
language plpgsql
as $$
begin
  /* Depth 1 is a DELETE somebody sent; deeper is a cascade (an account going). */
  if old.kind in ('favorites', 'wishlist') and pg_trigger_depth() = 1 then
    raise exception 'Favourites and the wishlist can be emptied, not deleted.'
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

drop trigger if exists lists_keep_singletons on public.lists;
create trigger lists_keep_singletons
  before delete on public.lists
  for each row execute function public.keep_singleton_lists();
