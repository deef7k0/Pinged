import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

/** One URL per studio, overwritten by every visit — nothing to expire. */
const STORAGE_PREFIX = 'studio-banner:v1:';

const bannerKey = (companyId: number) => ['studio-banner', companyId] as const;

/**
 * The studio's banner art: the catalogue's choice once it has one, and until
 * then the one this device showed last time.
 *
 * The banner is chosen from the catalogue, and the page colour is read from the
 * banner, so on every visit both waited for two IGDB requests — and on a cold
 * start, for the whole catalogue again. The URL is all it takes to skip that:
 * the art is in expo-image's disk cache and its Material 3 seed in the
 * extractor's store (`useAlbumArtColor`), so a studio opened before paints its
 * banner and its colour from the device while the catalogue refreshes behind
 * them.
 *
 * A first visit has nothing remembered and waits, as before. A catalogue whose
 * choice has moved on — a new release out-reviewing the old banner — replaces
 * the remembered art when it arrives, and is what the next visit opens on.
 *
 * `current` is `undefined` while the catalogue is loading, which is the only
 * time the remembered art stands in; `null` is the catalogue's answer that
 * there is no banner, and is kept, never papered over with an old one.
 */
export function useStudioBanner(
  companyId: number,
  current: string | null | undefined
): string | null {
  const client = useQueryClient();

  const remembered = useQuery({
    queryKey: bannerKey(companyId),
    queryFn: () => readBanner(companyId),
    enabled: Number.isFinite(companyId),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  });

  /* Written to the device, and into the query so a return this session opens
     on the new art rather than on what was read at the start of it. */
  useEffect(() => {
    if (!current || current === remembered.data) return;
    client.setQueryData(bannerKey(companyId), current);
    AsyncStorage.setItem(STORAGE_PREFIX + companyId, current).catch(() => undefined);
  }, [client, companyId, current, remembered.data]);

  return current === undefined ? (remembered.data ?? null) : current;
}

async function readBanner(companyId: number): Promise<string | null> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_PREFIX + companyId);
    return stored?.startsWith('https://') ? stored : null;
  } catch {
    return null;
  }
}
