import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { memo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { InfoCardButton } from '@/components/ui/info-card';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/screen';
import { SortBar, type SortOption } from '@/components/ui/sort-bar';
import { Card, Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import type { EditionKind } from '@/constants/game-editions';
import { SIMILARITY_REASON_LABEL, agreementLine, supportLine } from '@/constants/similarity';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCommunitySimilar } from '@/lib/api';
import type { CommunitySimilarGame, SimilaritySort } from '@/lib/database.types';
import { useAuth } from '@/store/auth';

/** How many games the card on the tab stacks: the three most agreed with. */
const PREVIEW = 3;

/** The stacked covers on the card: each one's width, and how far the next steps in. */
const STACK_COVER = 56;
const STACK_STEP = 34;

const SORTS: readonly SortOption<SimilaritySort>[] = [
  { key: 'top', label: 'Best rated' },
  { key: 'low', label: 'Worst rated' },
  { key: 'votes', label: 'Most votes' },
  { key: 'new', label: 'Newest' },
  { key: 'unrated', label: 'Not rated yet' },
];

// ---------------------------------------------------------------------------
// The card on the Similar tab
// ---------------------------------------------------------------------------

/**
 * The community's picks, as a door on the Similar tab — the way the reviews are
 * a door on Overview.
 *
 * The list used to be printed on the tab, capped at twelve, with every vote and
 * report control on every row. It is a sheet now, so it can be the whole list and
 * be sorted, and each pick opens a screen of the suggestions behind it. The card
 * says how many there are and shows the first few covers, which is enough to
 * decide whether to open it.
 */
export function CommunitySimilarCard({
  gameId,
  gameTitle,
  onOpen,
}: {
  gameId: string;
  gameTitle: string;
  onOpen: () => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const userId = useAuth((state) => state.session?.user.id) ?? null;

  const picks = useQuery({
    queryKey: ['community-similar', gameId, 'top'],
    queryFn: () => getCommunitySimilar(gameId, { sort: 'top' }),
    staleTime: 60_000,
  });

  const suggest = () => router.push({ pathname: '/suggest-similar/[id]', params: { id: gameId } });
  const count = picks.data?.length ?? 0;

  if (picks.isLoading) {
    return (
      <View style={styles.card} accessibilityLabel="Loading community picks">
        {/* The card's own corner, which is every card's now. */}
        <Skeleton width="100%" height={112} radius={Radius.review} />
      </View>
    );
  }

  if (picks.isLoadingError) {
    return <ErrorState error={picks.error} onRetry={() => void picks.refetch()} />;
  }

  if (count === 0) {
    return (
      <View style={styles.card}>
        <Text variant="h3" accessibilityRole="header">
          From the community
        </Text>
        <Text variant="body" color="textSecondary">
          Nobody here has said what {gameTitle} is like yet.
        </Text>
        {userId && (
          <Button
            title="Suggest a similar game"
            icon="add"
            variant="secondary"
            fullWidth
            onPress={suggest}
          />
        )}
      </View>
    );
  }

  /* The three the most people agree with — agreement, not the ranking score, so
     the card leads with the picks with the most hands up. Ties keep the rank. */
  const shown = [...picks.data!].sort((a, b) => b.up - a.up).slice(0, PREVIEW);
  const coverHeight = Math.round(STACK_COVER * 1.5);

  return (
    <View style={styles.card}>
      <InfoCardButton
        title="From the community"
        accessibilityLabel={`${count} ${count === 1 ? 'game' : 'games'} players say are like ${gameTitle}. See them all.`}
        onPress={onOpen}>
        <View style={styles.preview}>
          {/* Stacked like the profile's shelf: the most agreed-with in front,
              each card an edge and a short cast so two dark covers never merge
              into one shape. The edge is `<Poster>`'s own now — this wrapper
              drew a hairline of its own until every cover got one, and two
              would be a doubled line. Drawn back to front — paint order is the
              stacking order. */}
          <View
            style={[
              styles.covers,
              { width: STACK_COVER + (shown.length - 1) * STACK_STEP, height: coverHeight },
            ]}>
            {shown
              .map((pick, index) => ({ pick, index }))
              .reverse()
              .map(({ pick, index }) => (
                <View
                  key={pick.similarity_id}
                  style={[
                    styles.cover,
                    {
                      left: index * STACK_STEP,
                      shadowColor: theme.shadowInk,
                    },
                  ]}>
                  <Poster
                    coverUrl={pick.cover_url}
                    heroUrl={pick.hero_url}
                    title={pick.title}
                    width={STACK_COVER}
                    rounded="image"
                  />
                </View>
              ))}
          </View>
          <Text variant="body" color="textSecondary" style={styles.flex}>
            <Text variant="h4">{count}</Text>
            {count === 1
              ? ' game players say is like this, and why.'
              : ' games players say are like this, and why.'}
          </Text>
        </View>
      </InfoCardButton>

      {userId && (
        <Button
          title="Suggest a similar game"
          icon="add"
          variant="secondary"
          fullWidth
          onPress={suggest}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// The sheet
// ---------------------------------------------------------------------------

/**
 * Every game the community says is like this one, sortable.
 *
 * Sorting is done in Postgres (0029), so "worst rated" is the whole list's worst
 * and not the worst of whatever page came back. "Not rated yet" is also a filter:
 * picks nobody but their suggester has weighed in on, which the default order
 * buries by construction and which most need a second opinion.
 *
 * A pick opens its own screen — every person's reasons, to read and upvote. The
 * sheet stays open underneath, so coming back lands where you were.
 */
export function CommunitySimilarSheet({
  gameId,
  gameTitle,
}: {
  gameId: string;
  gameTitle: string;
}) {
  const router = useRouter();
  const userId = useAuth((state) => state.session?.user.id) ?? null;
  const [sort, setSort] = useState<SimilaritySort>('top');

  const picks = useQuery({
    queryKey: ['community-similar', gameId, sort],
    queryFn: () => getCommunitySimilar(gameId, { sort }),
    staleTime: 60_000,
  });

  const header = (
    <View style={styles.header}>
      <Text variant="h1" numberOfLines={2}>
        Games like {gameTitle}
      </Text>
      <View style={styles.controls}>
        <SortBar options={SORTS} value={sort} onChange={setSort} accessibilityLabel="Sort picks" />
      </View>
      {userId && (
        <Button
          title="Suggest a similar game"
          icon="add"
          variant="secondary"
          size="small"
          onPress={() => router.push({ pathname: '/suggest-similar/[id]', params: { id: gameId } })}
        />
      )}
    </View>
  );

  return (
    <FlatList
      data={picks.data ?? []}
      keyExtractor={(pick) => pick.similarity_id}
      ListHeaderComponent={header}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => (
        <PickRow
          pick={item}
          onOpen={() =>
            router.push({
              pathname: '/similar/[id]',
              params: { id: item.similarity_id, game: gameId },
            })
          }
        />
      )}
      ListEmptyComponent={
        picks.isPending ? (
          <LoadingState label="Loading picks…" />
        ) : picks.isLoadingError ? (
          <ErrorState error={picks.error} onRetry={() => void picks.refetch()} />
        ) : sort === 'unrated' ? (
          <EmptyState
            title="Every pick has been weighed in on"
            message="Each one has at least one vote beyond the person who suggested it."
          />
        ) : (
          <EmptyState title="No picks yet" message={`Nobody has said what ${gameTitle} is like.`} />
        )
      }
    />
  );
}

/**
 * One pick. The cover, and beside it everything about it: the title, the
 * suggestion people found most useful — its author and what they said — and who
 * stands behind it. The row is the link to every suggestion.
 */
const PickRow = memo(function PickRow({
  pick,
  onOpen,
}: {
  pick: CommunitySimilarGame;
  onOpen: () => void;
}) {
  const theme = useTheme();
  /* The 0030 sentence when the database can say it, and 0029's share of
     agreement when it cannot — never a count it does not have. */
  const support = supportLine(pick) ?? agreementLine(pick);
  /* What the top suggestion said: its line of text, or its reasons when it gave
     only reasons. */
  const said =
    pick.top_comment ??
    (pick.top_reasons?.length
      ? pick.top_reasons.map((reason) => SIMILARITY_REASON_LABEL[reason]).join(' · ')
      : null);

  return (
    <View style={styles.rowWrap}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={[
          pick.title,
          pick.top_author && said ? `${pick.top_author}: ${said}` : null,
          support,
        ]
          .filter(Boolean)
          .join('. ')}
        accessibilityHint="Opens every suggestion"
        onPress={onOpen}
        scaleTo={0.98}>
        {/* The row is a child of the card, not the card's `style`: `<Card>`
            puts `style` on its outer view and lays its children out in an
            inner one, so `flexDirection` there reached nothing and the text
            stacked under the art. */}
        <Card padded={false}>
          <View style={styles.row}>
            <Poster
              coverUrl={pick.cover_url}
              heroUrl={pick.hero_url}
              title={pick.title}
              edition={(pick.edition_kind as EditionKind | null) ?? null}
              gameId={pick.game_id}
              width={76}
              rounded="image"
            />
            <View style={styles.text}>
              <Text variant="h4" numberOfLines={2}>
                {pick.title}
                {pick.release_year ? (
                  <Text variant="bodySmall" color="textMuted">{`  ${pick.release_year}`}</Text>
                ) : null}
              </Text>

              {pick.top_author && said && (
                <View style={styles.top}>
                  <View style={styles.author}>
                    <Avatar uri={pick.top_author_avatar} name={pick.top_author} size={18} />
                    <Text variant="h6" color="textSecondary" numberOfLines={1} style={styles.flex}>
                      {pick.top_author}
                    </Text>
                  </View>
                  <Text variant="bodySmall" color="textSecondary" numberOfLines={2}>
                    {pick.top_comment ? `“${said}”` : said}
                  </Text>
                </View>
              )}

              <Text variant="caption" color="textMuted">
                {support}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
          </View>
        </Card>
      </PressableScale>
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: Spacing.x12 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  covers: { position: 'relative' },
  cover: {
    position: 'absolute',
    top: 0,
    borderRadius: Radius.image,
    overflow: 'hidden',
    /* Cast sideways onto the cover behind, the way the profile's shelf does. */
    shadowOpacity: 0.45,
    shadowRadius: 5,
    shadowOffset: { width: 3, height: 0 },
    elevation: 4,
  },
  content: { paddingBottom: Spacing.x48 },
  header: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x12, gap: Spacing.x8 },
  controls: { marginTop: Spacing.x8, marginBottom: Spacing.x4 },
  rowWrap: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x12 },
  /* `flex-start`: the art and the title share a top edge, and a long quote grows
     the row downwards rather than pushing the cover into the middle. */
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.x12, padding: Spacing.x12 },
  /* `minWidth: 0` beside `flex: 1`, so a long unbroken title wraps inside the
     column instead of measuring at its natural width and pushing the chevron
     off the card. */
  text: { flex: 1, minWidth: 0, gap: Spacing.x8 },
  top: { gap: Spacing.x4 },
  author: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
});
