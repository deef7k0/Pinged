import { useRouter } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import type { EditionKind } from '@/constants/game-editions';
import { Spacing, Type } from '@/constants/theme';

export type GameGridTileProps = {
  /** App-wide game id — where a tap goes. */
  id: string;
  title: string;
  coverUrl: string | null;
  heroUrl: string | null;
  edition?: EditionKind | null;
  steamAppId?: string | null;
  /** The quiet line under the title. Usually the release year. */
  caption?: string | number | null;
  /** The column's width: the cover is this wide and the title wraps to it. */
  width: number;
  /**
   * Let the cover wear the Must Play badge. Off on the Must Play list itself,
   * where it would be on every tile.
   */
  badge?: boolean;
  onLongPress?: () => void;
  /** What a long press does, said to a screen reader. */
  longPressHint?: string;
};

/**
 * A game in a grid that is read as well as looked at: the cover, its title in
 * two lines always held open, and one quiet line.
 *
 * A collection's grid is covers alone, because there the shelf is the content
 * and the title is on the box. A list somebody is choosing *from* — every Must
 * Play game, everything shown at an event — is a different job: the names are
 * what is scanned, and a wall of unfamiliar box art with nothing under it is a
 * guessing game. The caption is the rail's (`<ArtRail>`), so a cover is titled
 * the same way in a row and in a grid.
 */
export const GameGridTile = memo(function GameGridTile({
  id,
  title,
  coverUrl,
  heroUrl,
  edition = null,
  steamAppId = null,
  caption,
  width,
  badge = true,
  onLongPress,
  longPressHint,
}: GameGridTileProps) {
  const router = useRouter();

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={onLongPress ? longPressHint : undefined}
      scaleTo={0.96}
      onPress={() => router.push({ pathname: '/game/[id]', params: { id } })}
      onLongPress={onLongPress}
      style={{ width }}>
      <Poster
        coverUrl={coverUrl}
        heroUrl={heroUrl}
        title={title}
        edition={edition}
        gameId={badge ? id : null}
        steamAppId={steamAppId}
        width={width}
        rounded="image"
        /* A hold that already means something keeps its meaning. */
        zoomable={!onLongPress}
      />
      <View style={styles.caption}>
        <Text variant="itemTitle" numberOfLines={2} style={styles.title}>
          {title}
        </Text>
        {caption !== null && caption !== undefined && caption !== '' && (
          <Text variant="bodySmall" color="textSecondary" numberOfLines={1}>
            {caption}
          </Text>
        )}
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  caption: { paddingTop: Spacing.x8, gap: 1 },
  /* Two lines held open, so a row of three is one height whatever its titles. */
  title: { minHeight: Type.itemTitle.lineHeight * 2 },
});
