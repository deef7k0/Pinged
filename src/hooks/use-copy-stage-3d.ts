import { useQuery, useQueryClient } from '@tanstack/react-query';

import { STAGE_3D_DEFAULT, loadCopyStage3d, saveCopyStage3d } from '@/lib/copy-stage-3d';
import { useAuth } from '@/store/auth';

/**
 * Whether a copy's screen draws its case and disc in 3D, and the switch for
 * it (`lib/copy-stage-3d.ts`, Settings → Copies in 3D).
 *
 * One device store read under a query, as `useAnimatedArtwork` is, so a copy
 * screen still open under Settings changes the moment the switch is flipped.
 * Never written to the query cache on disk (`NEVER_PERSIST`): the device
 * store is the record. `ready` is false until it has been read — the stage
 * waits for it rather than start loading the 3D one and throw it away.
 */
export function useCopyStage3d(): { on: boolean; ready: boolean; setOn: (on: boolean) => void } {
  const userId = useAuth((state) => state.session?.user.id) ?? null;
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['copy-stage-3d', userId],
    queryFn: () => loadCopyStage3d(userId!),
    enabled: !!userId,
    staleTime: Infinity,
  });

  return {
    on: query.data ?? STAGE_3D_DEFAULT,
    ready: !userId || query.isSuccess,
    setOn: (on) => {
      queryClient.setQueryData(['copy-stage-3d', userId], on);
      if (userId) void saveCopyStage3d(userId, on);
    },
  };
}
