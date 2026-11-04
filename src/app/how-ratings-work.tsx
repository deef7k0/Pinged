import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageScrollView } from '@/components/ui/page-scroll';
import { Screen } from '@/components/ui/screen';
import { Card, Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { CONSENSUS_FLOOR, scoreColor } from '@/constants/score';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  getCommunityRatingReport,
  getMyRatingInfluence,
  invalidateCommunityRatings,
  isModerator,
  recalculateCommunityRatings,
  type MyRatingInfluence,
} from '@/lib/api';
import {
  COMMUNITY_RATING,
  entropyBands,
  explainInfluence,
  weightPercent,
  type CommunityRatingConfig,
} from '@/lib/community-rating';
import { timeAgoPosted } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { toast } from '@/lib/toast';

/**
 * How the GameLog score works, and how much the reader's own ratings count.
 *
 * The method's transparency page (0041). Everything a person could want to
 * know about why a game has the score it has is here in plain words — and
 * the one number that is theirs, their own weight, with the pattern behind
 * it. Nobody else's weight is shown anywhere: `my_rating_influence()` answers
 * for the caller alone.
 *
 * The wording describes ratings, never people: a weight below 1 is "ratings
 * that rarely vary", not a kind of user. `explainInfluence` (tested) writes
 * the personal part; the rules below are written from the parameters in
 * force, so the page cannot describe a threshold the server does not use.
 *
 * Reached from the reviews sheet, under GameLog's own summary, and from
 * Settings. Moderators also see the weighting across the app, in aggregate,
 * and can recalculate it.
 */
export default function HowRatingsWorkScreen() {
  const userId = useAuth((state) => state.session?.user.id) ?? null;

  const influence = useQuery({
    queryKey: ['rating-influence', userId],
    queryFn: getMyRatingInfluence,
    enabled: !!userId,
  });

  const moderator = useQuery({
    queryKey: ['is-moderator', userId],
    queryFn: isModerator,
    enabled: !!userId,
  });

  /* The server's parameters when it has answered; the app's own (the same
     numbers — `npm test` holds the two together) until then. */
  const params = influence.data?.params ?? COMMUNITY_RATING;

  return (
    <Screen
      edges={['bottom']}
      insetHeader
      padded
      topBar={<FrostedTopBar back title="How ratings work" />}>
      <PageScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text variant="body" color="textSecondary">
          A game’s Pinged score is a weighted average of every rating people here have given it. It
          is an estimate of what this community thinks — not a measure of how good a game
          objectively is.
        </Text>

        {userId && (
          <YourRatings
            loading={influence.isPending}
            failed={influence.isLoadingError}
            influence={influence.data}
            config={params}
          />
        )}

        <Group title="What always holds">
          <Rule icon="checkmark-circle-outline">
            Every rating counts. None is left out, and none ever counts for nothing.
          </Rule>
          <Rule icon="checkmark-circle-outline">
            A first rating counts in full — so do the first {params.confidence.from}. There is no
            waiting period, no minimum number of games and no rule about how old an account is.
          </Rule>
          <Rule icon="checkmark-circle-outline">
            Time never lowers a rating’s weight. Ratings from people who haven’t opened the app in
            years count exactly as they did.
          </Rule>
          <Rule icon="checkmark-circle-outline">
            Writing a review doesn’t make a rating count more. A score on its own counts the same.
          </Rule>
          <Rule icon="checkmark-circle-outline">
            Disagreeing with everybody costs nothing. Unusual taste is not treated as a problem.
          </Rule>
        </Group>

        <Group title="When a rating counts a little less">
          <Text variant="body" color="textSecondary">
            Only when the numbers show a pattern, and never below {weightPercent(params.weight.min)}
            % of a full rating:
          </Text>
          <Rule icon="remove-circle-outline">
            When nearly all of someone’s ratings fall inside one {params.entropy.bucketWidth}-point
            band — everything between 80 and 100, say — they count up to{' '}
            {weightPercent(params.penalty.lowEntropy)}% less. When every score is much the same,
            each one says less about how one game compares with another.
          </Rule>
          <Rule icon="remove-circle-outline">
            If those ratings are also further from what other people gave the same games than almost
            anybody’s here (the top {100 - params.deviation.highPercentile}%), they count up to{' '}
            {weightPercent(params.penalty.combined)}% less. Distance on its own changes nothing.
          </Rule>
          <Text variant="body" color="textSecondary">
            Nothing is adjusted until someone has rated more than {params.confidence.from} games,
            and any adjustment builds up a little with each rating until the{' '}
            {params.confidence.full}th. Distance is only measured on games at least{' '}
            {params.deviation.minOtherRaters} other people have rated, and only once{' '}
            {params.deviation.minPopulation} people have {params.deviation.minComparisons} such
            games each.
          </Text>
          <Text variant="body" color="textSecondary">
            It is a pattern in numbers, not a judgement of anyone’s taste or honesty. Nobody is
            flagged, hidden or told anything except what this page says.
          </Text>
        </Group>

        <Group title="How the score is worked out">
          <Text variant="body" color="textSecondary">
            Each rating is multiplied by its weight, and the total is divided by the total weight.
            Three ratings of 90, 80 and 40, with the 40 counting at 85%, make (90 + 80 + 34) ÷ 2.85
            = 72; the plain average is 70. Everybody counting in full makes the two the same.
          </Text>
          <Text variant="body" color="textSecondary">
            “Beloved by the community” ranks a period’s ratings, weighted the same way, as if each
            game had three more ratings at the period’s average — so one 100 can’t outrank thirty
            94s. The number under each cover is its own average. And the verdicts above “Positive”
            need at least {CONSENSUS_FLOOR} ratings behind them.
          </Text>
        </Group>

        <MethodLine influence={influence.data} config={params} />

        {moderator.data === true && <ModeratorReport />}
      </PageScrollView>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// The reader's own ratings
// ---------------------------------------------------------------------------

function YourRatings({
  loading,
  failed,
  influence,
  config,
}: {
  loading: boolean;
  failed: boolean;
  influence: MyRatingInfluence | null | undefined;
  config: CommunityRatingConfig;
}) {
  if (loading) {
    return (
      <Card>
        <View style={styles.card}>
          <Skeleton width="70%" height={16} radius={Radius.sm} />
          <Skeleton width="90%" height={12} radius={Radius.sm} />
          <Skeleton width="60%" height={12} radius={Radius.sm} />
        </View>
      </Card>
    );
  }

  /* A database that has not run 0041 weighs nobody, which is the same as
     everybody counting in full — said plainly, rather than an error. */
  if (failed || !influence) {
    return (
      <Card>
        <View style={styles.card}>
          <Text variant="h5">Your ratings</Text>
          <Text variant="body" color="textSecondary">
            {failed
              ? 'How much your ratings count couldn’t be loaded just now.'
              : 'Scores here are plain averages for now, so every rating — yours included — counts in full.'}
          </Text>
        </View>
      </Card>
    );
  }

  const explanation = explainInfluence(influence.rated, influence.stats, config);
  const distribution = influence.stats?.distribution ?? [];

  return (
    <Card>
      <View style={styles.card}>
        <Text variant="label" color="textMuted">
          YOUR RATINGS
        </Text>
        <Text variant="h5">{explanation.headline}</Text>
        {explanation.details.map((line) => (
          <Text key={line} variant="body" color="textSecondary">
            {line}
          </Text>
        ))}
        {influence.rated > 0 && distribution.length > 0 && (
          <Spread distribution={distribution} config={config} />
        )}
      </View>
    </Card>
  );
}

/**
 * Where somebody's ratings fall, band by band: the thing the entropy is
 * computed from, so the reader can see what "rarely varies" means for them.
 */
function Spread({
  distribution,
  config,
}: {
  distribution: readonly number[];
  config: CommunityRatingConfig;
}) {
  const theme = useTheme();
  const bands = entropyBands(config);
  const most = Math.max(1, ...distribution);

  return (
    <View
      style={styles.spread}
      accessible
      accessibilityLabel={`Your ratings by band: ${bands
        .map((band, index) => `${band.from} to ${band.to}, ${distribution[index] ?? 0}`)
        .join('; ')}`}>
      {[...bands].reverse().map((band, reversed) => {
        const index = bands.length - 1 - reversed;
        const count = distribution[index] ?? 0;
        return (
          <View key={band.from} style={styles.band}>
            <Text variant="caption" color="textMuted" style={styles.bandLabel}>
              {`${band.from}–${band.to}`}
            </Text>
            <View style={[styles.track, { backgroundColor: theme.surfaceElevated }]}>
              {count > 0 && (
                <View
                  style={{
                    width: `${(count / most) * 100}%`,
                    height: '100%',
                    borderRadius: Radius.pill,
                    backgroundColor: scoreColor((band.from + band.to) / 2, theme),
                  }}
                />
              )}
            </View>
            <Text variant="caption" color="textSecondary" style={styles.bandCount}>
              {count}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// The method's version, and when it last ran
// ---------------------------------------------------------------------------

function MethodLine({
  influence,
  config,
}: {
  influence: MyRatingInfluence | null | undefined;
  config: CommunityRatingConfig;
}) {
  const state = influence?.state;
  const parts = [`Method version ${state?.version ?? config.version}`];
  if (state?.recalculatedAt)
    parts.push(`weights worked out ${timeAgoPosted(state.recalculatedAt)}`);
  if (state?.staleSince) parts.push('catching up with recent ratings');

  return (
    <Text variant="caption" color="textMuted">
      {parts.join(' · ')}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Moderators: the weighting across the app, in aggregate
// ---------------------------------------------------------------------------

function ModeratorReport() {
  const queryClient = useQueryClient();

  const report = useQuery({
    queryKey: ['rating-report'],
    queryFn: () => getCommunityRatingReport(5),
  });

  const recalculate = useMutation({
    mutationFn: recalculateCommunityRatings,
    onSuccess: () => {
      toast.success('Ratings recalculated');
      return invalidateCommunityRatings(queryClient);
    },
  });

  const data = report.data;

  return (
    <Group title="For moderators">
      <Text variant="body" color="textSecondary">
        The weighting across Pinged, in aggregate. No person’s statistics are shown here or anywhere
        else.
      </Text>
      {report.isPending ? (
        <Skeleton width="100%" height={72} radius={Radius.card} />
      ) : !data ? (
        <Text variant="body" color="textMuted">
          {report.isLoadingError
            ? 'The report couldn’t be loaded.'
            : 'The database hasn’t been updated for weighted scores yet (0041).'}
        </Text>
      ) : (
        <Card>
          <View style={styles.card}>
            <Fact
              label="Raters"
              value={`${data.raters.total} · ${data.raters.adjusted} adjusted · ${data.raters.at_minimum} at the floor`}
            />
            <Fact
              label="Signals"
              value={`${data.raters.low_entropy} low spread · ${data.raters.high_deviation} far from others · ${data.raters.both} both`}
            />
            <Fact label="Mean weight" value={Number(data.raters.mean_weight).toFixed(3)} />
            <Fact
              label="Games"
              value={`${data.games.total} scored · ${data.games.moved} shown differently from the plain average`}
            />
            <Fact
              label="Difference from the plain average"
              value={`${Number(data.games.mean_difference).toFixed(2)} on average, ${Number(
                data.games.max_difference
              ).toFixed(2)} at most`}
            />
            {data.largest.map((game) => (
              <Fact
                key={game.game_id}
                label={game.title}
                value={`${Number(game.raw_mean).toFixed(1)} plain → ${Number(game.weighted_rating).toFixed(1)} weighted · ${game.raters} raters`}
              />
            ))}
          </View>
        </Card>
      )}
      {recalculate.isError && (
        <Text variant="bodySmall" color="danger">
          {recalculate.error instanceof Error
            ? recalculate.error.message
            : 'Could not recalculate.'}
        </Text>
      )}
      <Button
        title="Recalculate from every rating"
        variant="secondary"
        onPress={() => recalculate.mutate()}
        loading={recalculate.isPending}
      />
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text variant="h4" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Rule({ icon, children }: { icon: keyof typeof Ionicons.glyphMap; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.rule}>
      <Ionicons name={icon} size={16} color={theme.textMuted} style={styles.ruleIcon} />
      <Text variant="body" color="textSecondary" style={styles.ruleText}>
        {children}
      </Text>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text variant="caption" color="textMuted" numberOfLines={1}>
        {label}
      </Text>
      <Text variant="bodySmall" color="textSecondary">
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.x32, paddingTop: Spacing.x16, paddingBottom: Spacing.x48 },
  group: { gap: Spacing.x12 },
  card: { gap: Spacing.x8 },
  rule: { flexDirection: 'row', gap: Spacing.x8, alignItems: 'flex-start' },
  /* Level with the first line of `body` (19 high) rather than its top. */
  ruleIcon: { marginTop: 1.5 },
  ruleText: { flex: 1 },
  spread: { gap: Spacing.x4, marginTop: Spacing.x4 },
  band: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  bandLabel: { width: 48 },
  track: { flex: 1, height: 6, borderRadius: Radius.pill, overflow: 'hidden' },
  bandCount: { width: 28, textAlign: 'right' },
  fact: { gap: 1 },
});
