import { useQuery, useQueryClient } from '@tanstack/react-query';

import { loadGameTitle, saveGameTitle } from '@/lib/game-title';
import { useAuth } from '@/store/auth';

/**
 * Whether a game's page shows the game's name, and the switch for it
 * (`lib/game-title.ts`, Settings → Game title). One device store read under
 * a query, as `useAnimatedArtwork` is, never written to the query cache on
 * disk (`NEVER_PERSIST`).
 */
export function useGameTitle(): {
  /** True unless this account hid the name. */
  shown: boolean;
  ready: boolean;
  setShown: (shown: boolean) => void;
} {
  const userId = useAuth((state) => state.session?.user.id) ?? null;
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['game-title', userId],
    queryFn: () => loadGameTitle(userId!),
    enabled: !!userId,
    staleTime: Infinity,
  });

  return {
    shown: query.data ?? true,
    ready: !userId || query.isSuccess,
    setShown: (shown) => {
      queryClient.setQueryData(['game-title', userId], shown);
      if (userId) void saveGameTitle(userId, shown);
    },
  };
}
