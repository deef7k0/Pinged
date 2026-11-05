import { Link } from 'expo-router';
import { memo } from 'react';
import { View } from 'react-native';

import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import type { StudioGame } from '@/lib/games/igdb';

/**
 * One cover of a studio's grid — its All games page. Memoised so a grid of
 * two hundred does not redraw on every render of the list (CLAUDE.md,
 * performance traps).
 */
export const StudioGridItem = memo(function StudioGridItem({
  item,
  tileWidth,
}: {
  item: StudioGame;
  tileWidth: number;
}) {
  return (
    <Link href={{ pathname: '/game/[id]', params: { id: item.id } }} asChild>
      <PressableScale accessibilityRole="button" accessibilityLabel={item.title} scaleTo={0.95}>
        <View style={{ width: tileWidth }}>
          <Poster
            coverUrl={item.coverUrl}
            heroUrl={item.heroUrl}
            title={item.title}
            edition={item.edition}
            gameId={item.id}
            width={tileWidth}
            rounded="image"
            priority="low"
          />
        </View>
      </PressableScale>
    </Link>
  );
});
