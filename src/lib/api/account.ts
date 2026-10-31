import { contactPhrase } from '../../constants/legal';
import { supabase } from '../supabase';

/**
 * Deleting your own account (0045, `delete_my_account`).
 *
 * Two steps, in this order. First the pictures you uploaded — your avatar, your
 * banner, images in posts — because storage cannot be emptied from SQL and
 * the database step takes away the session that is allowed to delete them.
 * Then the database: your `auth.users` row, and with it everything that hangs
 * off your profile (see the migration's header).
 *
 * Photos of a game box you sent to the release catalogue (`<uid>/releases`)
 * are kept: they are the catalogue's pictures now, other people's copies are
 * drawn with them, and nothing in them names you. The privacy policy says so.
 */

const BUCKET = 'media';
const PERSONAL_FOLDERS = ['avatars', 'banners', 'posts'] as const;

/** PostgREST's code for "no function of that name": the database predates 0045. */
const NO_SUCH_FUNCTION = 'PGRST202';

export const DELETION_NOT_READY =
  'Deleting an account from the app arrives with the database’s next update. ' +
  `Until then, write to ${contactPhrase()} and we will delete it for you.`;

async function deleteUploads(userId: string): Promise<void> {
  for (const folder of PERSONAL_FOLDERS) {
    const prefix = `${userId}/${folder}`;
    /* Pages of a thousand until the folder is empty. */
    for (;;) {
      const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 });
      if (error) throw new Error(`Your pictures could not be deleted: ${error.message}`);
      const files = (data ?? []).filter((entry) => entry.id !== null);
      if (files.length === 0) break;
      const removed = await supabase.storage
        .from(BUCKET)
        .remove(files.map((file) => `${prefix}/${file.name}`));
      if (removed.error)
        throw new Error(`Your pictures could not be deleted: ${removed.error.message}`);
      if (files.length < 1000) break;
    }
  }
}

/**
 * Deletes the signed-in account and everything of theirs. Throws with a
 * sentence for the screen on failure; on success the session is gone and the
 * caller signs out locally.
 */
export async function deleteMyAccount(userId: string): Promise<void> {
  /* Checked before any file goes: a database that cannot finish the job must
     not be left with an account whose pictures are already gone. */
  const probe = await supabase.from('blocks').select('id', { head: true, count: 'exact' }).limit(1);
  if (probe.error && ['PGRST205', '42P01'].includes(probe.error.code ?? '')) {
    throw new Error(DELETION_NOT_READY);
  }

  await deleteUploads(userId);

  const { error } = await supabase.rpc('delete_my_account');
  if (error) {
    throw new Error(error.code === NO_SUCH_FUNCTION ? DELETION_NOT_READY : error.message);
  }
}
