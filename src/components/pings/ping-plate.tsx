import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { PingFeedRef, PingFeedRow } from '@/lib/database.types';
import { displayNameFor, timeAgoPosted } from '@/lib/format';
import { plateFoot } from '@/lib/pings';

/** The picture's height: the covers, side by side, cropped into one band. */
export const PLATE_BAND = 96;
/** The asker's stamp, and the ring of page that presses it into the picture. */
const STAMP = 34;
const STAMP_RING = 3;
const STAMP_BOX = STAMP + STAMP_RING * 2;
/** How far in from the plate's left edge the stamp's centre sits. */
const STAMP_X = 24;
/** A request is read whole on its own page; a plate gives it three lines. */
const WORDS_LINES = 3;

/**
 * A request on the board — Latest and Mine (the owner's hybrid, 2026-11-01:
 * "The latest and mine tabs will display a style like The Board, make sure
 * to add the user's name alongside the pfp stamp"). Drawn from
 * `.impeccable/mocks/pings/board.png`, rendered by
 * `scripts/pings-concepts.mjs`.
 *
 * A plate, not a card: no fill and no edge, on the page.
 *
 *   1. **The picture** — the request's games as one band, each cover a slice
 *      of it, cropped a fifth of the way down where a box's subject and logo
 *      sit, a line of page between them and a registration mark in each
 *      corner. A game the reader has not played loses its colour (Latest
 *      only — on your own requests it would be about you asking yourself).
 *   2. **The stamp** — the asker's face pressed half off the picture's
 *      bottom-left corner, on a ring of page, and their name beside it with
 *      the time. A request on no games has no picture, and the stamp stands
 *      in the row on its own.
 *   3. **The words**, bold, as the headline they are.
 *   4. **The foot** — under a rule, two printed words: how many of its games
 *      you played (lit when any), and the answers. A request that is no longer
 *      open is struck through.
 *
 * The whole plate opens the request; the stamp and the name open the person.
 */
export const PingPlate = memo(function PingPlate({
  ping,
  viewerId,
  showFamiliarity = true,
  width,
}: {
  ping: PingFeedRow;
  viewerId: string | null;
  showFamiliarity?: boolean;
  /** The plate's width — the page's, less its margins. */
  width: number;
}) {
  const theme = useTheme();
  const router = useRouter();

  const mine = ping.user_id === viewerId;
  const name = mine ? 'You' : displayNameFor(ping);
  const foot = plateFoot(ping, mine);
  const hasBand = ping.refs.length > 0;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${name} asks: ${ping.description}. ${foot.left}, ${foot.right}`}
      accessibilityHint="Opens the ping and its suggestions"
      onPress={() => router.push({ pathname: '/ping/[id]', params: { id: ping.id } })}
      scaleTo={0.985}
      style={styles.plate}>
      {hasBand && <Band refs={ping.refs} width={width} dimUnplayed={showFamiliarity && !mine} />}

      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={`${name}’s profile`}
        onPress={() => router.push({ pathname: '/profile/[id]', params: { id: ping.user_id } })}
        hitSlop={6}
        scaleTo={0.96}
        style={StyleSheet.flatten([styles.who, hasBand ? styles.whoOnBand : styles.whoAlone])}>
        <View
          style={[styles.stamp, { backgroundColor: hasBand ? theme.background : 'transparent' }]}>
          <Avatar uri={ping.avatar_url} name={displayNameFor(ping)} size={STAMP} />
        </View>
        <View style={[styles.byline, hasBand && styles.bylineOnBand]}>
          <Text variant="itemTitle" numberOfLines={1} style={styles.name}>
            {name}
          </Text>
          <Text variant="caption" color="textMuted">
            {timeAgoPosted(ping.created_at)}
          </Text>
        </View>
      </PressableScale>

      <Text variant="h4" numberOfLines={WORDS_LINES} style={styles.words}>
        {ping.description}
      </Text>

      <View style={[styles.foot, { borderTopColor: theme.border }]}>
        <Text
          variant="label"
          numberOfLines={1}
          style={[styles.footLeft, { color: foot.leftLit ? theme.primaryText : theme.textMuted }]}>
          {foot.left}
        </Text>
        <Text variant="label" color="textMuted" numberOfLines={1}>
          {foot.right}
        </Text>
        {foot.struck && (
          <View
            pointerEvents="none"
            style={[styles.strike, { backgroundColor: withAlpha(theme.textMuted, 0.8) }]}
          />
        )}
      </View>
    </PressableScale>
  );
});

/**
 * The covers as one picture. Plain expo-image, not `<Poster>`: a slice of a
 * band is not a cover's 2:3 slot, it has no corner and wears no badge.
 */
function Band({
  refs,
  width,
  dimUnplayed,
}: {
  refs: readonly PingFeedRef[];
  width: number;
  dimUnplayed: boolean;
}) {
  const theme = useTheme();
  const slice = width / refs.length;

  return (
    <View style={[styles.band, { width, backgroundColor: theme.surfaceElevated }]}>
      {refs.map((ref, index) => {
        const dim = dimUnplayed && !ref.played;
        return (
          <View
            key={ref.game_id}
            style={[styles.slice, { left: slice * index, width: slice }]}
            accessibilityLabel={
              dimUnplayed ? `${ref.title}${ref.played ? ', played' : ', not played'}` : ref.title
            }>
            {ref.cover_url && (
              <View style={[StyleSheet.absoluteFill, dim && styles.unplayed]}>
                <Image
                  source={{ uri: ref.cover_url }}
                  contentFit="cover"
                  contentPosition={{ top: '20%' }}
                  recyclingKey={ref.cover_url}
                  transition={220}
                  style={StyleSheet.absoluteFill}
                />
              </View>
            )}
            {dim && (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: withAlpha(theme.background, 0.58) },
                ]}
              />
            )}
            {index > 0 && (
              <View style={[styles.seam, { backgroundColor: withAlpha(theme.background, 0.8) }]} />
            )}
          </View>
        );
      })}
      <Crosshairs color={theme.text} />
    </View>
  );
}

/** A plate's registration marks, one in each corner — the board's one ornament. */
function Crosshairs({ color }: { color: string }) {
  const ink = withAlpha(color, 0.75);
  return (
    <>
      {CORNERS.map((corner) => (
        <View key={corner.key} pointerEvents="none" style={[styles.mark, corner.style]}>
          <View style={[styles.markH, { backgroundColor: ink }]} />
          <View style={[styles.markV, { backgroundColor: ink }]} />
        </View>
      ))}
    </>
  );
}

const MARK = 9;
const MARK_INSET = 5 - MARK / 2 + 0.5;
const CORNERS = [
  { key: 'tl', style: { top: MARK_INSET, left: MARK_INSET } },
  { key: 'tr', style: { top: MARK_INSET, right: MARK_INSET } },
  { key: 'bl', style: { bottom: MARK_INSET, left: MARK_INSET } },
  { key: 'br', style: { bottom: MARK_INSET, right: MARK_INSET } },
] as const;

const styles = StyleSheet.create({
  plate: {},
  band: { height: PLATE_BAND, overflow: 'hidden' },
  slice: { position: 'absolute', top: 0, bottom: 0, overflow: 'hidden' },
  /* Android 12+ draws it; elsewhere the dim alone carries "not played". */
  unplayed: { filter: [{ grayscale: 0.96 }] },
  seam: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 1 },
  mark: { position: 'absolute', width: MARK, height: MARK },
  markH: { position: 'absolute', left: 0, right: 0, top: (MARK - 0.75) / 2, height: 0.75 },
  markV: { position: 'absolute', top: 0, bottom: 0, left: (MARK - 0.75) / 2, width: 0.75 },
  who: { flexDirection: 'row', alignSelf: 'flex-start', gap: Spacing.x8, maxWidth: '100%' },
  /* The stamp's centre on the picture's foot. */
  whoOnBand: { marginTop: -STAMP_BOX / 2, marginLeft: STAMP_X - STAMP_BOX / 2 },
  whoAlone: { alignItems: 'center', marginLeft: -STAMP_RING },
  stamp: {
    width: STAMP_BOX,
    height: STAMP_BOX,
    borderRadius: STAMP_BOX / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  byline: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.x8, flexShrink: 1 },
  /* Beside the stamp's lower half, clear of the picture. */
  bylineOnBand: { alignSelf: 'flex-end', paddingBottom: 2 },
  name: { flexShrink: 1 },
  words: { marginTop: Spacing.x8 },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    marginTop: Spacing.x8 + 1,
    paddingTop: Spacing.x8 + 1,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footLeft: { flex: 1 },
  strike: { position: 'absolute', left: 0, right: 0, bottom: 6, height: 1 },
});
