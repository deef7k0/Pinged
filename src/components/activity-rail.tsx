import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { CoverRail, type CoverRailGame } from '@/components/game-rail';
import { Avatar } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';
import { RAIL_FOOT } from '@/constants/cover-rail';
import type { EditionKind } from '@/constants/game-editions';
import { scoreColor } from '@/constants/score';
import { Typeface } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CachedGame, LogWithRelations } from '@/lib/database.types';
import { displayNameFor } from '@/lib/format';
import { hasWriting } from '@/lib/review-quote';

/** A log whose game came back with it — the only kind this row can draw. */
type Entry = LogWithRelations & { game: CachedGame };

function boxOf(game: CachedGame): CoverRailGame {
  return {
    id: game.id,
    title: game.title,
    coverUrl: game.cover_url,
    heroUrl: game.hero_url,
    edition: (game.edition_kind as EditionKind | null) ?? null,
    releaseYear: game.release_year,
  };
}

/* Words behind the number: the review, or its one sentence (0040). */
const wrote = (log: LogWithRelations) => hasWriting(log);

/**
 * What people have been playing, as a row of covers with a face under each —
 * Home's "New from friends".
 *
 * ```text
 *   ▯▯▯▯   ▯▯▯▯   ▯▯▯▯
 *   ▯▯▯▯   ▯▯▯▯   ▯▯▯▯
 *   ◍ Ada  ◍ Kaan ◍ Lan
 *     84 ≡   91     77 ≡
 * ```
 *
 * The owner's reference (2026-10-09): the row of that name on Letterboxd's
 * home. Under each poster a small face, the person's name, and what they gave
 * it — here the 0–100 score in the score ramp's colour — with a mark when
 * there are words behind the number.
 *
 * It took the place of Home's stack of review cards, at the owner's direction.
 * A card is somebody's writing; this is the news that they played something,
 * so a score with no review belongs in it and a review's text does not.
 *
 * ## One target
 *
 * A cover and its foot are one button. It opens the review when one was
 * written, and otherwise that person's record of the game — both are pages
 * about this person and this game, and both carry the way to the person. Two
 * targets would have put a 22dp face under a thumb.
 *
 * ## No Must Play badge
 *
 * These are covers in a row about people, not the catalogue, so they are not
 * given the label (CLAUDE.md § Labels: reviews and the surfaces made of them
 * go without).
 */
export function ActivityRail({
  logs,
  inset,
}: {
  logs: readonly LogWithRelations[];
  /** Where the first cover starts: the page's margin. */
  inset?: number;
}) {
  const router = useRouter();
  const entries = useMemo(() => logs.filter((log): log is Entry => log.game !== null), [logs]);

  return (
    <CoverRail
      data={entries}
      keyOf={(log) => log.id}
      gameOf={(log) => boxOf(log.game)}
      labelled={false}
      inset={inset}
      footOf={(log) => <PersonFoot log={log} />}
      labelOf={(log) => {
        const name = displayNameFor(log.profile);
        const said =
          log.rating !== null
            ? `scored ${log.game.title} ${Math.round(log.rating)}`
            : `reviewed ${log.game.title}`;
        return `${name} ${said}. ${wrote(log) ? 'Opens their review.' : 'Opens their record of it.'}`;
      }}
      onPressItem={(log) =>
        wrote(log)
          ? router.push({ pathname: '/review/[id]', params: { id: log.id } })
          : router.push({
              pathname: '/game-stats/[user]/[game]',
              params: { user: log.user_id, game: log.game_id },
            })
      }
    />
  );
}

/** The face, and beside it the name over what they gave the game. */
function PersonFoot({ log }: { log: LogWithRelations }) {
  const theme = useTheme();
  const name = displayNameFor(log.profile);
  const rounded = log.rating === null ? null : Math.round(log.rating);
  const written = wrote(log);

  return (
    <View style={styles.foot}>
      <Avatar uri={log.profile?.avatar_url} name={name} size={RAIL_FOOT.avatar} />

      <View style={styles.words}>
        <Text variant="bodySmall" numberOfLines={1} style={styles.name}>
          {name}
        </Text>

        <View style={styles.verdict}>
          {rounded !== null ? (
            <Text variant="bodySmall" style={[styles.score, { color: scoreColor(rounded, theme) }]}>
              {rounded}
            </Text>
          ) : (
            /* A review with no score: say so, where a number would be. */
            <Text variant="bodySmall" color="textSecondary" numberOfLines={1}>
              Reviewed
            </Text>
          )}
          {written && rounded !== null && (
            <Ionicons name="reorder-three" size={13} color={theme.textSecondary} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  foot: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: RAIL_FOOT.avatarGap,
    height: RAIL_FOOT.line * 2,
  },
  /* Shrinks, so a long name truncates and never widens the cover's column. */
  words: { flex: 1, minWidth: 0 },
  /* Families, not weights: Android synthesises none for a custom font. */
  name: { fontFamily: Typeface.semibold },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 3, height: RAIL_FOOT.line },
  score: { fontFamily: Typeface.bold, fontVariant: ['tabular-nums'] },
});
