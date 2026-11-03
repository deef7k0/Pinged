import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Easing, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { CoverFan, type FanCard } from '@/components/ui/cover-fan';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Motion, Spacing } from '@/constants/theme';
import { getGameLogChartPage, getGameLogRanking } from '@/lib/api';
import { getCriticChartPage } from '@/lib/games/browse';
import { TOP_CHART_SIZE, type ChartEntry } from '@/lib/top-chart';

/** The games on the button: the top three. */
const SHOWN = 3;

/**
 * The way into the Top 1000, on Search's Discover — the owner's direction
 * (2026-10-21): "Move the top games chart into its own screen. Make a widget,
 * like a button for opening the chart. Add the top 3 games in the button as
 * cards, similar to the Surprise Me graphic."
 *
 * So it is Surprise Me's button (`<SurpriseEntry>`) with the chart's games in
 * the fan (`<CoverFan>`): the number one in front, two and three behind it,
 * each with its rank on it; beside them the chart's name, what ranks it, and
 * the number one by name. One button; the chart is `app/top-chart.tsx`.
 *
 * The three are GameLog's — the chart opens on GameLog's ranking — and the
 * critics' where GameLog has not three rated games yet. Both are the chart's
 * own queries (`['top-chart', 'gamelog']`, `['critic-chart', 1]`), so the
 * screen it opens has its first page already.
 */
export function TopChartEntry() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const press = useSharedValue(0);

  const ranking = useQuery({
    queryKey: ['top-chart', 'gamelog'],
    queryFn: () => getGameLogRanking(TOP_CHART_SIZE),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const top = ranking.data?.slice(0, SHOWN) ?? [];
  const gamelog = useQuery({
    queryKey: ['top-chart', 'gamelog', 'entry', top.map((row) => row.gameId)],
    queryFn: () => getGameLogChartPage(top, 1),
    enabled: top.length >= SHOWN,
    staleTime: 5 * 60_000,
  });
  /* Too few rated here — or no 0037 — and the critics stand in. */
  const useCritics = ranking.isSuccess && (ranking.data?.length ?? 0) < SHOWN;
  const critics = useQuery({
    queryKey: ['critic-chart', 1],
    queryFn: ({ signal }) => getCriticChartPage(1, signal),
    enabled: useCritics || ranking.isError,
    staleTime: 6 * 60 * 60_000,
  });

  const games: ChartEntry[] =
    (useCritics || ranking.isError ? critics.data : gamelog.data)?.slice(0, SHOWN) ?? [];
  const whose = useCritics || ranking.isError ? 'by the critics' : 'on Pinged';
  const cards: FanCard[] = Array.from({ length: SHOWN }, (_, index) => ({
    kind: 'cover',
    uri: games[index]?.coverUrl ?? games[index]?.heroUrl ?? null,
    badge: games[index] ? String(index + 1) : undefined,
  }));

  function setPress(to: number) {
    if (reduceMotion) return;
    press.set(
      withTiming(to, {
        duration: to === 1 ? Motion.fast : Motion.normal,
        easing: to === 1 ? Easing.out(Easing.cubic) : Easing.out(Easing.quad),
      })
    );
  }

  const leader = games[0];

  return (
    <View style={styles.band}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Top 1000: the best-reviewed games${
          leader ? `. Number one ${whose}: ${leader.title}` : ''
        }.`}
        accessibilityHint="Opens the chart"
        scaleTo={0.985}
        onPressIn={() => setPress(1)}
        onPressOut={() => setPress(0)}
        onPress={() => router.push('/top-chart')}
        style={styles.row}>
        <CoverFan cards={cards} press={press} />
        <View style={styles.body}>
          <Text variant="h2" accessibilityRole="header">
            Top 1000
          </Text>
          <Text variant="bodySmall" color="textSecondary">
            The best-reviewed games, ranked on Pinged or by the critics
          </Text>
          {leader && (
            <Text variant="bodySmall" color="textMuted" numberOfLines={1} style={styles.leader}>
              {`No. 1 · ${leader.title}`}
            </Text>
          )}
        </View>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  /* The page gutter, as Surprise Me's button keeps it. */
  band: { paddingHorizontal: Spacing.x16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x20 },
  body: { flex: 1, gap: 2 },
  leader: { marginTop: Spacing.x4 },
});
