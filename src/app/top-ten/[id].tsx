import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { CircularCarousel } from '@/components/ui/circular-carousel';
import { DynamicText } from '@/components/ui/dynamic-text';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Typeface, Palette, Spacing, withAlpha } from '@/constants/theme';
import { useHeaderHeight } from '@/hooks/use-header-height';
import { FAVOURITES_MAX, getFavorites, getProfile } from '@/lib/api';
import { displayNameFor } from '@/lib/format';
import { sharpCoverUrl } from '@/lib/games/sharp-cover';

/** The line of "Number 1", as tall as its type. */
const NUMBER_LINE = 52;
const TITLE_LINE = 26;
/** The numeral behind each poster: its size and how far over the top it rises, of the poster's height. */
const RANK_SIZE = 0.44;
const RANK_RISE = 0.27;

/**
 * Somebody's Top 10, full screen (the owner's, 2026-11-03): their Favourites
 * — ten at most, in their order (0047) — as reacticx's circular carousel of
 * covers, and under the cover in front its place, "Number 1", big, white and
 * bold, changing with reacticx's dynamic text: rising to the next, falling
 * back. A cover opens its game. Opened from the profile's Favourites.
 *
 * The favourites query is the profile's own (`['favorites', id]`), so it
 * opens on what the profile already loaded.
 */
export default function TopTenScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const headerHeight = useHeaderHeight();
  const [index, setIndex] = useState(0);

  const favorites = useQuery({
    queryKey: ['favorites', id],
    queryFn: () => getFavorites(id!),
    enabled: !!id,
  });
  const profile = useQuery({
    queryKey: ['profile', id],
    queryFn: () => getProfile(id!),
    enabled: !!id,
  });

  const name = profile.data ? displayNameFor(profile.data) : null;
  const title = name ? `${name}’s Top 10` : 'Top 10';
  const items = (favorites.data?.items ?? []).filter((item) => item.game).slice(0, FAVOURITES_MAX);

  /* The numeral rises a little past the carousel's own room above a card. */
  const room = height - headerHeight - NUMBER_LINE - TITLE_LINE * 2 - Spacing.x48 * 2;
  const itemWidth = Math.round(Math.min(width * 0.66, room / 1.5));
  const itemHeight = Math.round(itemWidth * 1.5);
  const current = items[Math.min(index, items.length - 1)];
  const credit = current?.game
    ? [current.game.developer, current.game.release_year].filter(Boolean).join(' · ')
    : '';

  const bar = <FrostedTopBar back title={title} />;

  if (favorites.isLoading) {
    return (
      <Screen insetHeader topBar={bar}>
        <LoadingState />
      </Screen>
    );
  }
  if (favorites.isLoadingError) {
    return (
      <Screen insetHeader topBar={bar}>
        <ErrorState error={favorites.error} onRetry={() => void favorites.refetch()} />
      </Screen>
    );
  }
  if (items.length === 0) {
    return (
      <Screen insetHeader topBar={bar}>
        <EmptyState title="No favourites yet" message="A Top 10 is made by starring games." />
      </Screen>
    );
  }

  return (
    <Screen insetHeader topBar={bar} miniPlayer={false}>
      <View style={styles.stage}>
        <CircularCarousel
          data={items}
          keyOf={(item) => item.game_id}
          itemWidth={itemWidth}
          itemHeight={itemHeight}
          width={width}
          onIndexChange={(next) => setIndex(Math.max(0, Math.min(items.length - 1, next)))}
          /* Apple TV's Top 10: the place as a huge numeral behind the poster,
             rising out over its top (the Apple pass, 2026-11-05). It turns and
             drops with its card, so each cover carries its own number. */
          renderBehind={(_, position) => (
            <Text
              accessible={false}
              numberOfLines={1}
              style={[
                styles.rank,
                {
                  top: -itemHeight * RANK_RISE,
                  fontSize: itemHeight * RANK_SIZE,
                  lineHeight: itemHeight * RANK_SIZE,
                  letterSpacing: -itemHeight * RANK_SIZE * 0.06,
                },
              ]}>
              {position + 1}
            </Text>
          )}
          renderItem={(item, position) => (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Number ${position + 1}: ${item.game?.title ?? 'a game'}. Opens the game.`}
              onPress={() => router.push({ pathname: '/game/[id]', params: { id: item.game_id } })}
              scaleTo={0.97}
              style={StyleSheet.flatten(styles.cover)}>
              <Image
                source={{
                  uri: sharpCoverUrl(item.game?.cover_url) ?? item.game?.hero_url ?? undefined,
                }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
                accessibilityIgnoresInvertColors
              />
            </PressableScale>
          )}
        />

        {/* The place of the cover in front, and its name. */}
        <DynamicText
          id={index}
          order={index}
          text={`Number ${index + 1}`}
          height={NUMBER_LINE}
          style={styles.number}
        />
        <DynamicText
          id={current?.game_id ?? index}
          order={index}
          text={current?.game?.title ?? ''}
          height={TITLE_LINE}
          style={styles.title}
          containerStyle={styles.titleBox}
        />
        {!!credit && (
          <Text numberOfLines={1} style={styles.credit}>
            {credit}
          </Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, justifyContent: 'center', paddingBottom: Spacing.x32 },
  rank: {
    position: 'absolute',
    left: -40,
    right: -40,
    textAlign: 'center',
    fontFamily: Typeface.extraBold,
    color: withAlpha(Palette.white, 0.16),
    fontVariant: ['tabular-nums'],
  },
  cover: { flex: 1, backgroundColor: withAlpha(Palette.white, 0.06) },
  number: {
    fontFamily: Typeface.extraBold,
    fontSize: 44,
    lineHeight: NUMBER_LINE,
    letterSpacing: -1,
    color: Palette.white,
  },
  titleBox: { marginTop: Spacing.x4, paddingHorizontal: Spacing.x24 },
  title: {
    fontFamily: Typeface.semibold,
    fontSize: 18,
    lineHeight: TITLE_LINE,
    color: Palette.white,
  },
  credit: {
    textAlign: 'center',
    fontFamily: Typeface.regular,
    fontSize: 14,
    lineHeight: 20,
    color: withAlpha(Palette.white, 0.65),
    paddingHorizontal: Spacing.x24,
  },
});
