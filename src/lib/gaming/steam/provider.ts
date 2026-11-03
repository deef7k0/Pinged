import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase';

import type {
  GamingAccountProvider,
  LinkOutcome,
  ProviderCapabilities,
  SyncOutcome,
  SyncSection,
} from '../types';

/**
 * Steam, as an implementation of `GamingAccountProvider`.
 *
 * Everything network-facing happens in the `steam-auth` and `steam-sync` Edge
 * Functions: the Steam Web API key cannot ship in an Expo bundle, and an OpenID
 * assertion is only worth anything if the server verified it. So this class does
 * three things — open the browser for the link, ask the backend to sync, and
 * clean up on unlink. There is deliberately no Steam URL anywhere in this file.
 */

/**
 * What Steam actually supports.
 *
 * `purchaseDates: false` is the important one. Steam's Web API exposes no
 * purchase or "date added" field on any endpoint — not `GetOwnedGames`, not the
 * store API — so the library's "recently purchased" sort is hidden rather than
 * silently falling back to last-played and lying about what it is showing.
 */
const STEAM_CAPABILITIES: ProviderCapabilities = {
  sections: ['profile', 'library', 'achievements', 'inventory', 'badges', 'friends'],
  accountLevel: true,
  accountXp: true,
  purchaseDates: false,
  achievementRarity: true,
  inventories: true,
  presence: true,
};

/** Matches the deep-link path the Edge Function is allow-listed to return to. */
const RETURN_PATH = 'steam-linked';

type StartResponse = { url?: string; error?: string };
type SyncResponse = {
  results?: {
    section: SyncSection;
    status: SyncOutcome['status'];
    written: number;
    hasMore: boolean;
    message: string | null;
    skipped: boolean;
  }[];
  error?: string;
};

export class SteamProvider implements GamingAccountProvider {
  readonly id = 'steam' as const;
  readonly label = 'Steam';
  readonly capabilities = STEAM_CAPABILITIES;

  /**
   * Steam needs no client-side configuration — the key lives in Supabase
   * secrets. If the functions are not deployed the sync call reports it, which
   * is a clearer signal than a client-side guess.
   */
  isConfigured(): boolean {
    return true;
  }

  async link(): Promise<LinkOutcome> {
    // `createURL` resolves to `gamelog://…` in a build and `exp://…` under Expo
    // Go, both of which the function allow-lists.
    const redirectTo = Linking.createURL(RETURN_PATH);

    const { data, error } = await supabase.functions.invoke<StartResponse>('steam-auth', {
      body: { action: 'start', redirectTo },
    });

    if (error) {
      return { ok: false, reason: 'unavailable', message: describeInvokeError(error) };
    }
    if (!data?.url) {
      return {
        ok: false,
        reason: 'unavailable',
        message: data?.error ?? 'Steam sign-in is unavailable right now.',
      };
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { ok: false, reason: 'cancelled', message: 'Steam sign-in was cancelled.' };
    }
    if (result.type !== 'success') {
      return { ok: false, reason: 'failed', message: 'Steam sign-in did not complete.' };
    }

    // The function encodes the outcome in the deep link rather than making the
    // app re-query, so a failure can carry a specific reason.
    const outcome = new URL(result.url).searchParams.get('result');

    switch (outcome) {
      case 'ok':
        break;
      case 'cancelled':
        return { ok: false, reason: 'cancelled', message: 'Steam sign-in was cancelled.' };
      case 'already-linked':
        return {
          ok: false,
          reason: 'failed',
          message: 'That Steam account is already linked to another Pinged profile.',
        };
      default:
        return {
          ok: false,
          reason: 'failed',
          message: 'Steam could not verify that sign-in. Nothing was linked.',
        };
    }

    // The function wrote the row; read the verified id back rather than trusting
    // anything that came through the browser.
    const { data: account } = await supabase
      .from('gaming_accounts')
      .select('external_id')
      .eq('provider', this.id)
      .maybeSingle();

    return account?.external_id
      ? { ok: true, externalId: account.external_id }
      : { ok: false, reason: 'failed', message: 'Steam linked but the account could not be read.' };
  }

  async unlink({ userId }: { userId: string }): Promise<void> {
    const { error } = await supabase.functions.invoke('steam-auth', {
      body: { action: 'unlink' },
    });

    // The function keeps `profiles.steam_id` in step and controls delete order,
    // but DELETE policies exist so an unlink still works if it is unavailable.
    if (error) {
      const tables = [
        'gaming_owned_games',
        'gaming_achievements',
        'gaming_inventory_items',
        'gaming_badges',
        'gaming_provider_friends',
        'gaming_sync_state',
        'gaming_accounts',
      ] as const;

      for (const table of tables) {
        await supabase.from(table).delete().eq('user_id', userId).eq('provider', this.id);
      }
      await supabase.from('profiles').update({ steam_id: null }).eq('id', userId);
    }
  }

  async sync({
    section,
    force = false,
  }: {
    userId: string;
    section: SyncSection;
    force?: boolean;
  }): Promise<SyncOutcome> {
    const { data, error } = await supabase.functions.invoke<SyncResponse>('steam-sync', {
      body: { section, force },
    });

    if (error) {
      return {
        section,
        status: 'error',
        written: 0,
        hasMore: false,
        message: describeInvokeError(error),
      };
    }
    if (data?.error) {
      return { section, status: 'error', written: 0, hasMore: false, message: data.error };
    }

    const result = data?.results?.find((entry) => entry.section === section);
    if (!result) {
      return {
        section,
        status: 'error',
        written: 0,
        hasMore: false,
        message: 'No result returned.',
      };
    }

    return {
      section: result.section,
      status: result.status,
      written: result.written,
      hasMore: result.hasMore,
      message: result.message,
    };
  }

  /**
   * Sync several sections in one round trip.
   *
   * Not part of the generic interface because it is an optimisation, not a
   * capability: the function runs sections sequentially anyway to stay inside
   * Steam's per-key rate limit, and this just avoids six HTTP round trips.
   */
  async syncAll(
    options: { sections?: SyncSection[]; force?: boolean } = {}
  ): Promise<SyncOutcome[]> {
    const { data, error } = await supabase.functions.invoke<SyncResponse>('steam-sync', {
      body: {
        sections: options.sections ?? this.capabilities.sections,
        force: options.force === true,
      },
    });

    if (error || data?.error) {
      const message = error ? describeInvokeError(error) : (data?.error ?? 'Sync failed.');
      return (options.sections ?? this.capabilities.sections).map((section) => ({
        section,
        status: 'error' as const,
        written: 0,
        hasMore: false,
        message,
      }));
    }

    return (data?.results ?? []).map((result) => ({
      section: result.section,
      status: result.status,
      written: result.written,
      hasMore: result.hasMore,
      message: result.message,
    }));
  }
}

/**
 * Supabase wraps a non-2xx function response in a FunctionsHttpError whose
 * `message` is just "Edge Function returned a non-2xx status code" — useless on
 * screen. The real reason is in the response body, so dig it out.
 */
function describeInvokeError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message: unknown }).message);
    if (/non-2xx/i.test(message)) {
      return 'Steam sync is not available. Are the Edge Functions deployed?';
    }
    return message;
  }
  return 'Steam request failed.';
}

export const steamProvider = new SteamProvider();
