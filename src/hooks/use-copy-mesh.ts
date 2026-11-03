import { useQuery, useQueryClient } from '@tanstack/react-query';

import { loadCopyMesh, saveCopyMesh } from '@/lib/copy-backdrop';
import { useAuth } from '@/store/auth';

/** Whether a copy's page stands on the mesh, and the switch at its top. */
export function useCopyMesh(): { mesh: boolean; ready: boolean; setMesh: (mesh: boolean) => void } {
  const userId = useAuth((state) => state.session?.user.id) ?? null;
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['copy-mesh', userId],
    queryFn: () => loadCopyMesh(userId!),
    enabled: !!userId,
    staleTime: Infinity,
  });
  return {
    mesh: query.data ?? true,
    ready: !userId || query.isSuccess,
    setMesh: (mesh) => {
      queryClient.setQueryData(['copy-mesh', userId], mesh);
      if (userId) void saveCopyMesh(userId, mesh);
    },
  };
}
