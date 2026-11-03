import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import type { PingTarget } from '@/lib/api';
import { useAuth } from '@/store/auth';

/**
 * Opens the send sheet for one thing — the same call behind every Ping button
 * in the app: a game's page, a review, a collection, an event, a soundtrack
 * and a request. `null` while signed out, so a caller can leave its button out.
 *
 * The thing travels as route params (its kind, id, and how it looks), which
 * is what the recipient's inbox will draw; the sheet looks nothing up.
 */
export function usePingTo(): ((target: PingTarget) => void) | null {
  const router = useRouter();
  const signedIn = useAuth((state) => !!state.session?.user.id);

  const open = useCallback(
    (target: PingTarget) =>
      router.push({
        pathname: '/send-ping',
        params: {
          kind: target.kind,
          target: target.targetId,
          title: target.title.slice(0, 200),
          subtitle: target.subtitle?.slice(0, 200) ?? '',
          image: target.imageUrl ?? '',
        },
      }),
    [router]
  );

  return signedIn ? open : null;
}

/** The glyph every Ping button draws: a paper plane, going out. */
export const PING_GLYPH = 'paper-plane-outline' as const;
