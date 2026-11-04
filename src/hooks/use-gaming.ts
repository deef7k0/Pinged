import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { getLinkedAccount, getSyncState } from '@/lib/api';
import type { GamingProvider } from '@/lib/database.types';
import { requireProvider, SteamProvider, type SyncOutcome, type SyncSection } from '@/lib/gaming';
import { toast } from '@/lib/toast';

/**
 * Hooks for a linked gaming account.
 *
 * Background synchronisation is modelled as a **query**, not an effect. That is
 * deliberate: TanStack Query already does everything a hand-rolled sync effect
 * would need — run once on mount, dedupe concurrent callers, respect a staleness
 * window, expose loading state — and doing it this way keeps the React Compiler
 * rules satisfied, since there is no setState in an effect anywhere here.
 *
 * The backend enforces the real rate limits (`gaming_sync_state.next_run_after`),
 * so `staleTime` is only about not spamming the function from a remounting
 * screen; a request that arrives too early is answered from cache server-side.
 */

/** Read queries that a completed sync invalidates. */
const DEPENDENT_KEYS = [
  'gaming-account',
  'gaming-stats',
  'gaming-library',
  'gaming-library-stats',
  'gaming-achievement-progress',
  'gaming-recent-unlocks',
  'gaming-rarest-unlocks',
  'gaming-inventory',
  'gaming-badges',
  'gaming-friends',
  'gaming-sync-state',
] as const;

/** How long a completed background sync is considered fresh, client-side. */
const SYNC_STALE_MS = 5 * 60_000;

/**
 * A long achievement scan reports `hasMore` and needs several runs. This caps how
 * many follow-ups one screen visit will chain, so a 900-game library makes steady
 * progress across sessions instead of hammering Steam in a single sitting.
 */
const MAX_CONTINUATIONS = 4;

export function useLinkedAccount(userId: string | null, provider: GamingProvider = 'steam') {
  return useQuery({
    queryKey: ['gaming-account', provider, userId],
    queryFn: () => getLinkedAccount(userId!, provider),
    enabled: !!userId,
  });
}

export function useGamingSyncState(userId: string | null, provider: GamingProvider = 'steam') {
  return useQuery({
    queryKey: ['gaming-sync-state', provider, userId],
    queryFn: () => getSyncState(userId!, provider),
    enabled: !!userId,
  });
}

export type UseGamingSyncOptions = {
  userId: string | null;
  provider?: GamingProvider;
  /** Only sync when the viewer owns this profile — never sync someone else's. */
  enabled?: boolean;
  /** Restrict the run, e.g. just `['library']` on the library screen. */
  sections?: SyncSection[];
};

/**
 * Keep a linked account's cached data fresh.
 *
 * Returns both the automatic background sync and a `refresh` mutation for the
 * manual "Refresh Steam Data" control, which passes `force` so it bypasses the
 * server-side rate-limit window.
 */
export function useGamingSync({
  userId,
  provider = 'steam',
  enabled = true,
  sections,
}: UseGamingSyncOptions) {
  const queryClient = useQueryClient();
  const account = useLinkedAccount(userId, provider);
  const continuations = useRef(0);

  const shouldSync = enabled && !!userId && !!account.data;

  const sync = useQuery({
    queryKey: ['gaming-sync', provider, userId, sections?.join(',') ?? 'all'],
    queryFn: async (): Promise<SyncOutcome[]> => {
      const instance = requireProvider(provider);

      // `syncAll` batches every section into one round trip. It is a Steam
      // optimisation rather than part of the generic contract, so it is used only
      // when the provider actually offers it.
      if (instance instanceof SteamProvider) {
        return instance.syncAll({ sections });
      }

      const targets = sections ?? instance.capabilities.sections;
      const outcomes: SyncOutcome[] = [];
      for (const section of targets) {
        outcomes.push(await instance.sync({ userId: userId!, section }));
      }
      return outcomes;
    },
    enabled: shouldSync,
    staleTime: SYNC_STALE_MS,
    // A failed sync should not retry in a tight loop — the backend already
    // applies exponential backoff and will refuse early callers anyway.
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Destructured so the effects below depend on the individual values rather
  // than the query object, whose identity changes on every render.
  const { data: outcomes, isFetching: isFetchingSync, refetch: refetchSync } = sync;

  /**
   * Refresh the reads once a sync has actually written something.
   *
   * `invalidateQueries` is not state, so this is a legal effect under the React
   * Compiler rules — unlike copying sync results into local state.
   */
  useEffect(() => {
    if (!outcomes) return;
    if (!outcomes.some((outcome) => outcome.written > 0)) return;

    for (const key of DEPENDENT_KEYS) {
      queryClient.invalidateQueries({ queryKey: [key, provider, userId] });
    }
  }, [outcomes, queryClient, provider, userId]);

  /** Chain a follow-up run while a section still has work queued. */
  useEffect(() => {
    if (!outcomes || isFetchingSync) return;
    if (!outcomes.some((outcome) => outcome.hasMore)) return;
    if (continuations.current >= MAX_CONTINUATIONS) return;

    continuations.current += 1;
    refetchSync();
  }, [outcomes, isFetchingSync, refetchSync]);

  const refresh = useMutation({
    mutationFn: async (): Promise<SyncOutcome[]> => {
      if (!userId) throw new Error('You must be signed in.');
      const instance = requireProvider(provider);

      continuations.current = 0;

      if (instance instanceof SteamProvider) {
        return instance.syncAll({ sections, force: true });
      }

      const targets = sections ?? instance.capabilities.sections;
      const results: SyncOutcome[] = [];
      for (const section of targets) {
        results.push(await instance.sync({ userId, section, force: true }));
      }
      return results;
    },
    onSuccess: () => {
      for (const key of DEPENDENT_KEYS) {
        queryClient.invalidateQueries({ queryKey: [key, provider, userId] });
      }
    },
  });

  return {
    account,
    /** True on the very first sync, when there is nothing cached to show yet. */
    isInitialSync: sync.isLoading && !account.data?.lastSyncedAt,
    isSyncing: isFetchingSync || refresh.isPending,
    outcomes: outcomes ?? [],
    error: sync.error ?? refresh.error,
    refresh,
  };
}

/**
 * Link and unlink.
 *
 * Kept separate from `useGamingSync` because linking is a user-initiated,
 * one-shot action with its own error surface, whereas syncing runs on its own.
 */
export function useAccountLink(userId: string | null, provider: GamingProvider = 'steam') {
  const queryClient = useQueryClient();

  function invalidateAll() {
    for (const key of DEPENDENT_KEYS) {
      queryClient.invalidateQueries({ queryKey: [key, provider, userId] });
    }
    queryClient.invalidateQueries({ queryKey: ['gaming-sync', provider, userId] });
    queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    /* The badges beside the profile's name. */
    queryClient.invalidateQueries({ queryKey: ['gaming-accounts', userId] });
  }

  const link = useMutation({
    /* `handle`: the public name a username-linked provider imports from. */
    mutationFn: async (handle: string | void) => {
      if (!userId) throw new Error('You must be signed in.');
      const outcome = await requireProvider(provider).link({ userId, handle: handle ?? undefined });
      // A cancellation is not an error worth throwing — the UI just stays put.
      if (!outcome.ok && outcome.reason !== 'cancelled') throw new Error(outcome.message);
      return outcome;
    },
    onSuccess: () => {
      toast.success('Account linked');
      return invalidateAll();
    },
  });

  const unlink = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('You must be signed in.');
      await requireProvider(provider).unlink({ userId });
    },
    onSuccess: () => {
      toast.success('Account disconnected');
      return invalidateAll();
    },
  });

  return { link, unlink };
}
