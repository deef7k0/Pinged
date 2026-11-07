import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { DISCOVER } from '@/constants/discover-carousel';
import { Palette, Radius, Spacing, Typeface, withAlpha } from '@/constants/theme';
import { usePosterArt } from '@/hooks/use-poster-art';
import { useTheme } from '@/hooks/use-theme';
import type { PingFeedRow } from '@/lib/database.types';
import { displayNameFor, timeAgoPosted } from '@/lib/format';
import { plateFoot } from '@/lib/pings';

/** The compact card's shape: a rectangle, taller than wide, two to a row. */
export const PING_COMPACT_RATIO = 1.32;

/* The black under the words, over art: clear above the middle, then deep. */
const FADE = [
  withAlpha(Palette.shadowInk, 0),
  withAlpha(Palette.shadowInk, 0.6),
  withAlpha(Palette.shadowInk, 0.9),
] as const;
const FADE_STOPS = [0.3, 0.62, 1] as const;

/**
 * A ping on the board (Latest and Mine) — the owner's, 2026-11-05: the
 * layout of Explore's carousel card (`<SpotlightSlider>`'s: an 18 corner,
 * a 1dp rim of white at 15%, the words over a scrim at its foot), without
 * its parallax.
 *
 * - **With games**: the first game's landscape art fills the card (the
 *   poster card's art, `usePosterArt`; its box art until that answers),
 *   a disc at the top left counts the games named, and at the foot are two
 *   lines of the request in small type and the asker's face and name.
 * - **With none**: a plain card, the request in larger type over most of it.
 * - **`compact`**: the same at half the width, a rectangle two to a row, the
 *   type a step smaller — the Pings tab's grid view.
 *
 * A request no longer open wears its word at the top right ("Closed",
 * "Found it"). The whole card opens the request.
 */
export const PingCard = memo(function PingCard({
  ping,
  viewerId,
  width,
  compact = false,
}: {
  ping: PingFeedRow;
  viewerId: string | null;
  width: number;
  compact?: boolean;
}) {
  const theme = useTheme();
  const router = useRouter();
  const first = ping.refs[0] ?? null;
  const art = usePosterArt(first?.game_id ?? null);

  const mine = ping.user_id === viewerId;
  const name = mine ? 'You' : displayNameFor(ping);
  const foot = plateFoot(ping, mine);
  const games = ping.refs.length;
  const height = compact ? Math.round(width * PING_COMPACT_RATIO) : width;
  const picture = first ? (art.data?.artUrl ?? first.cover_url) : null;
  const withArt = !!first;

  const words = withArt
    ? { lines: 2, style: compact ? styles.wordsSmallCompact : styles.wordsSmall }
    : { lines: compact ? 7 : 8, style: compact ? styles.wordsLargeCompact : styles.wordsLarge };

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={[
        `${name} asks: ${ping.description}`,
        games > 0 ? `${games} ${games === 1 ? 'game' : 'games'} named` : null,
        foot.right,
      ]
        .filter(Boolean)
        .join('. ')}
      accessibilityHint="Opens the ping and its suggestions"
      onPress={() => router.push({ pathname: '/ping/[id]', params: { id: ping.id } })}
      scaleTo={0.98}
      style={StyleSheet.flatten([
        styles.card,
        {
          width,
          height,
          backgroundColor: withArt ? theme.surface : theme.surfaceElevated,
          borderColor: withAlpha(theme.white, DISCOVER.edgeAlpha),
        },
      ])}>
      {picture && (
        <Image
          source={{ uri: picture }}
          recyclingKey={picture}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition={{ top: '35%', left: '50%' }}
          transition={220}
          cachePolicy="memory-disk"
          accessibilityIgnoresInvertColors
        />
      )}
      {withArt && (
        <LinearGradient colors={FADE} locations={FADE_STOPS} style={StyleSheet.absoluteFill} />
      )}

      <View style={styles.top} pointerEvents="none">
        {games > 0 ? (
          <View style={[styles.count, { backgroundColor: withAlpha(Palette.shadowInk, 0.55) }]}>
            <Ionicons name="game-controller" size={compact ? 12 : 14} color={Palette.white} />
            <Text style={styles.countNumber}>{games}</Text>
          </View>
        ) : (
          <View />
        )}
        {foot.struck && (
          <View style={[styles.tag, { backgroundColor: withAlpha(Palette.shadowInk, 0.55) }]}>
            <Text variant="caption" style={styles.tagText}>
              {foot.right}
            </Text>
          </View>
        )}
      </View>

      <View
        style={[styles.foot, compact && styles.footCompact, !withArt && styles.footPlain]}
        pointerEvents="none">
        <Text numberOfLines={words.lines} style={[words.style, !withArt && { color: theme.text }]}>
          {ping.description}
        </Text>
        <View style={styles.who}>
          <Avatar uri={ping.avatar_url} name={displayNameFor(ping)} size={compact ? 18 : 22} />
          <Text
            numberOfLines={1}
            style={[
              compact ? styles.nameCompact : styles.name,
              { color: withArt ? Palette.white : theme.text },
            ]}>
            {name}
          </Text>
          {!compact && (
            <Text
              style={[
                styles.time,
                { color: withArt ? withAlpha(Palette.white, 0.65) : theme.textMuted },
              ]}>
              {timeAgoPosted(ping.created_at)}
            </Text>
          )}
        </View>
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: DISCOVER.radius,
    borderCurve: 'continuous',
    borderWidth: DISCOVER.edgeWidth,
    overflow: 'hidden',
  },
  top: {
    position: 'absolute',
    top: Spacing.x12,
    left: Spacing.x12,
    right: Spacing.x12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  /* The disc: the games' glyph and how many. */
  count: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 32,
    height: 32,
    paddingHorizontal: 9,
    borderRadius: 16,
    justifyContent: 'center',
  },
  countNumber: {
    fontFamily: Typeface.bold,
    fontSize: 14,
    lineHeight: 18,
    color: Palette.white,
    fontVariant: ['tabular-nums'],
  },
  tag: { paddingHorizontal: Spacing.x8, paddingVertical: 3, borderRadius: Radius.pill },
  tagText: { color: Palette.white, fontFamily: Typeface.semibold },
  foot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: DISCOVER.captionSide,
    paddingBottom: DISCOVER.captionBottom,
    gap: Spacing.x8,
  },
  footCompact: { paddingHorizontal: Spacing.x12, paddingBottom: Spacing.x12, gap: 6 },
  /* With no art, the words take the card from under the top row down. */
  footPlain: { top: 56, justifyContent: 'space-between' },
  wordsSmall: {
    fontFamily: Typeface.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: Palette.white,
  },
  wordsSmallCompact: {
    fontFamily: Typeface.semibold,
    fontSize: 13,
    lineHeight: 17,
    color: Palette.white,
  },
  wordsLarge: { fontFamily: Typeface.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  wordsLargeCompact: { fontFamily: Typeface.bold, fontSize: 15, lineHeight: 20 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, fontFamily: Typeface.semibold, fontSize: 13, lineHeight: 18 },
  nameCompact: { flexShrink: 1, fontFamily: Typeface.semibold, fontSize: 12, lineHeight: 16 },
  time: { fontFamily: Typeface.regular, fontSize: 12, lineHeight: 16 },
});
