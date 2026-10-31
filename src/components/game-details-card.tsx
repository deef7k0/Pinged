import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, useReducedMotion } from 'react-native-reanimated';

import { InfoCard } from '@/components/ui/info-card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { FontFamily, Spacing, TapTarget } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { FACET_INFO, facetParams, type Facet, type FacetKind } from '@/lib/games/facets';
import { getGameDetails, type GameDetails } from '@/lib/games/igdb';
import { getGameRawgTags, rawgTagsAvailable, type RawgTag } from '@/lib/games/rawg-tags';
import { parseGameId } from '@/lib/games';

/**
 * One row: its label, and its values — each with its IGDB id when the record
 * carries ids, which is what makes it a link (`facet`).
 */
type Row = { label: string; kind: FacetKind; values: { name: string; id: number | null }[] };

/** A value's reach past its own words: the lines are close, so up and down stay small. */
const VALUE_SLOP = { top: 4, bottom: 4, left: 4, right: 4 };

/**
 * The IGDB record for a game, in a card on the Overview that opens in place —
 * the owner's direction (2026-10-15): "make it expandable, remove the pop up
 * screen with information. Display the information in the card. But, remove
 * the developers and publishers… display the genre and themes before
 * expanding."
 *
 * So the card shows the genres and themes, and "Show all" opens the rest under
 * them — modes, perspectives, series, franchises, engine, age ratings,
 * languages. The developers and publishers are not here: they are the links
 * under the game's name in the masthead. It was a door to a dialog over the
 * page.
 *
 * The record is asked for as the card mounts — it has to be, to show the
 * genres — under the key the stats strip already reads, so it is the same one
 * request. Every row is left out when IGDB has nothing for it, rather than
 * printed as a dash; a card with no rows at all is not drawn.
 *
 * **Every value is a way to its games** — the owner's direction (2026-10-16):
 * "every information in the details card should be tappable… if it's a
 * thriller game then the 'thriller' label… is in bold, and users can tap that
 * and they are sent to the search screen with the selected theme". So each is
 * bold, and opens the Search tab on that facet's games (`lib/games/facets.ts`)
 * — the theme, the engine, the language, the age rating alike.
 *
 * **Tags are RAWG's** (2026-10-22): its players' words for the game, read
 * from RAWG by the game's name and year, listed after the themes and as
 * searchable as they are — a tag opens Search on RAWG's games with it.
 * Absent without a RAWG key, or when RAWG has no game of this name and year.
 */
export function GameDetailsCard({
  gameId,
  title,
  year,
}: {
  gameId: string;
  /** The game's name and year, which RAWG's tags are looked up by. */
  title?: string;
  year?: number | null;
}) {
  const accent = useAccent();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);

  const parsed = parseGameId(gameId);
  const igdbId = parsed?.source === 'igdb' ? parsed.sourceId : null;

  const details = useQuery({
    queryKey: ['game-details', igdbId],
    queryFn: ({ signal }) => getGameDetails(igdbId!, signal),
    enabled: !!igdbId,
    staleTime: 24 * 60 * 60_000,
    retry: false,
  });

  /* A record saved on the device before values carried their ids has none:
     ask again once, so its values become links instead of staying words for
     the day the record is fresh for. */
  const untagged = !!details.data && !details.data.tags;
  const { refetch } = details;
  useEffect(() => {
    if (untagged) void refetch();
  }, [untagged, refetch]);

  const rawgTags = useQuery({
    queryKey: ['rawg-game-tags', gameId],
    queryFn: ({ signal }) => getGameRawgTags(title!, year ?? null, signal),
    enabled: !!title && rawgTagsAvailable(),
    staleTime: 7 * 24 * 60 * 60_000,
    retry: false,
  });

  if (!igdbId || !details.data) return null;

  const open = (facet: Facet) =>
    router.navigate({ pathname: '/search', params: facetParams(facet) });

  const { head, rest } = rowsOf(details.data, rawgTags.data ?? []);
  if (head.length === 0 && rest.length === 0) return null;
  /* With nothing behind the button, the card is just its first rows. */
  const shown = expanded || head.length === 0 ? [...head, ...rest] : head;

  return (
    <InfoCard title="Details">
      <Animated.View
        style={styles.rows}
        layout={reduceMotion ? undefined : LinearTransition.duration(250)}>
        {shown.map((row, index) => (
          <Animated.View
            key={row.label}
            entering={reduceMotion || index < head.length ? undefined : FadeIn.duration(220)}
            style={styles.row}>
            <Text variant="label" style={{ color: accent.quietInk }}>
              {row.label}
            </Text>
            <View style={styles.values}>
              {row.values.map((value, place) => {
                const last = place === row.values.length - 1;
                const words = (
                  <Text variant="body" style={styles.value}>
                    {value.name}
                    {last ? '' : ','}
                  </Text>
                );
                if (value.id === null) return <View key={value.name}>{words}</View>;
                const facet = { kind: row.kind, id: value.id, name: value.name };
                return (
                  <PressableScale
                    key={value.id}
                    accessibilityRole="link"
                    accessibilityLabel={`${value.name}. See ${FACET_INFO[
                      row.kind
                    ].label.toLowerCase()} games like it in Search.`}
                    onPress={() => open(facet)}
                    hitSlop={VALUE_SLOP}
                    scaleTo={0.96}>
                    {words}
                  </PressableScale>
                );
              })}
            </View>
          </Animated.View>
        ))}

        {head.length > 0 && rest.length > 0 && (
          <PressableScale
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={expanded ? 'Show fewer details' : 'Show all the details'}
            onPress={() => setExpanded((current) => !current)}
            scaleTo={0.98}
            style={styles.toggle}>
            <Text variant="itemTitle">{expanded ? 'Show less' : 'Show all'}</Text>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={accent.quietInk}
            />
          </PressableScale>
        )}
      </Animated.View>
    </InfoCard>
  );
}

/** The rows shown before expanding, and the rest. No companies: see above. */
function rowsOf(details: GameDetails, rawgTags: readonly RawgTag[]): { head: Row[]; rest: Row[] } {
  const tags = details.tags;

  /* With ids, each value is a link; a record from before them is words. */
  const row = (label: string, kind: FacetKind, names: string[]): Row => ({
    label,
    kind,
    values: tags?.[kind]
      ? tags[kind]!.map((tag) => ({ name: tag.name, id: tag.id }))
      : names.map((name) => ({ name, id: null })),
  });
  const keep = (entry: Row) => entry.values.length > 0;

  return {
    head: [
      row('Genres', 'genre', details.genres),
      row('Themes', 'theme', details.themes),
      {
        label: 'Tags',
        kind: 'tag' as const,
        values: rawgTags.map((tag) => ({ name: tag.name, id: tag.id })),
      },
    ].filter(keep),
    rest: [
      row('Game modes', 'mode', details.gameModes),
      row('Player perspectives', 'perspective', details.playerPerspectives),
      row('Series', 'series', details.series ? [details.series] : []),
      row('Franchises', 'franchise', details.franchises),
      row('Game engine', 'engine', details.engines),
      row(
        'Age ratings',
        'rating',
        details.ageRatings.map((entry) => `${entry.organization} ${entry.rating}`)
      ),
      row('Languages', 'language', details.languages),
    ].filter(keep),
  };
}

const styles = StyleSheet.create({
  rows: { gap: Spacing.x16 },
  row: { gap: Spacing.x4 },
  /* The values wrap as words do, a space apart, each its own target. */
  values: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.x4, rowGap: 2 },
  /* Bold, in the full ink: the owner's sign that a word goes somewhere. The
     family, not a weight — Android synthesises none for a custom font. */
  value: { fontFamily: FontFamily.bold },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x4,
    alignSelf: 'flex-start',
    minHeight: TapTarget,
  },
});
