import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { MultiChoiceChips } from '@/components/choice-chips';
import { GamePicker } from '@/components/game-picker';
import { Button } from '@/components/ui/button';
import { CARD_INSET, cardShape } from '@/components/ui/card-material';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageScrollView } from '@/components/ui/page-scroll';
import { Poster } from '@/components/ui/poster';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import {
  MAX_SIMILARITY_REASONS,
  SIMILARITY_REASONS,
  SIMILARITY_REASON_LABEL,
} from '@/constants/similarity';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getPairWithMyVote, suggestSimilarGame } from '@/lib/api';
import type { GameSimilarityVoteRow, SimilarityReason } from '@/lib/database.types';
import { getGameById, type Game } from '@/lib/games';
import { useAuth } from '@/store/auth';
import { toast } from '@/lib/toast';

const MAX_COMMENT = 280;

/**
 * Say a game is like this one, and why.
 *
 * Params: `id` is the game whose page this came from; `other`, when present, is
 * a game already on its community list — the form then skips the search and
 * edits *your* reasons for that pair, filled back in from your vote.
 *
 * Suggesting and agreeing are one act here (0025): the first person to name a
 * pair creates it with their vote, and everyone after adds theirs to the same
 * row. So the button says what it does in both cases without two forms.
 */
export default function SuggestSimilarScreen() {
  const params = useLocalSearchParams<{ id: string; other?: string }>();
  const userId = useAuth((state) => state.session?.user.id) ?? null;
  const [pickedOther, setPickedOther] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  const otherId = params.other ?? pickedOther;

  const game = useQuery({
    queryKey: ['game', params.id],
    queryFn: ({ signal }) => getGameById(params.id!, signal),
    enabled: !!params.id,
    staleTime: 30 * 60_000,
  });

  const other = useQuery({
    queryKey: ['game', otherId],
    queryFn: ({ signal }) => getGameById(otherId!, signal),
    enabled: !!otherId,
    staleTime: 30 * 60_000,
  });

  const pair = useQuery({
    queryKey: ['similarity-pair', userId, params.id, otherId],
    queryFn: () => getPairWithMyVote(userId!, params.id!, otherId!),
    enabled: !!userId && !!params.id && !!otherId,
  });

  let body: React.ReactNode;
  if (!userId) {
    body = <EmptyState title="Sign in to recommend games" />;
  } else if (!params.id) {
    body = <EmptyState title="Nothing to compare" />;
  } else if (game.isLoading) {
    body = <LoadingState />;
  } else if (!game.data) {
    body = game.isLoadingError ? (
      <ErrorState error={game.error} onRetry={() => void game.refetch()} />
    ) : (
      <EmptyState title="Game not found" />
    );
  } else if (!otherId) {
    body = (
      <View style={styles.flex}>
        <GamePicker
          heading={`What’s like ${game.data.title}?`}
          prompt={{
            title: 'Pick a game',
            message: pickError ?? 'Search for a game you think is similar, then tap it.',
          }}
          onPick={(id) => {
            if (id === params.id) {
              setPickError('That is the same game. Pick a different one.');
              return;
            }
            setPickError(null);
            setPickedOther(id);
          }}
        />
      </View>
    );
  } else if (other.isLoading || pair.isLoading) {
    body = <LoadingState />;
  } else if (!other.data) {
    body = other.isLoadingError ? (
      <ErrorState error={other.error} onRetry={() => void other.refetch()} />
    ) : (
      <EmptyState title="Game not found" />
    );
  } else {
    body = (
      <SuggestForm
        key={`${other.data.id}:${pair.data?.vote?.updated_at ?? 'none'}`}
        game={game.data}
        other={other.data}
        existingVote={pair.data?.vote ?? null}
        pairExists={!!pair.data}
        onChangeOther={params.other ? null : () => setPickedOther(null)}
      />
    );
  }

  return (
    <Screen
      edges={['bottom']}
      insetHeader
      modal
      topBar={
        <FrostedTopBar
          dismiss
          title={
            pair.data?.vote
              ? 'Your recommendation'
              : pair.data
                ? 'Agree, and say why'
                : 'Recommend a similar game'
          }
        />
      }>
      {body}
    </Screen>
  );
}

function SuggestForm({
  game,
  other,
  existingVote,
  pairExists,
  onChangeOther,
}: {
  game: Game;
  other: Game;
  existingVote: GameSimilarityVoteRow | null;
  pairExists: boolean;
  onChangeOther: (() => void) | null;
}) {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id) ?? null;

  const [reasons, setReasons] = useState<SimilarityReason[]>(existingVote?.reasons ?? []);
  const [comment, setComment] = useState(existingVote?.comment ?? '');

  const submit = useMutation({
    mutationFn: () => suggestSimilarGame(game, other, reasons, comment),
    onSuccess: () => {
      toast.success('Suggestion added');
      queryClient.invalidateQueries({ queryKey: ['community-similar', game.id] });
      queryClient.invalidateQueries({ queryKey: ['community-similar', other.id] });
      queryClient.invalidateQueries({ queryKey: ['similarity-pair', userId] });
      // The pick's own screen, if the form was opened from it.
      queryClient.invalidateQueries({ queryKey: ['similar-pair'] });
      queryClient.invalidateQueries({ queryKey: ['similar-suggestions'] });
      router.back();
    },
  });

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
      <PageScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <Text variant="h4" accessibilityRole="header">
            For players who liked {game.title}
          </Text>
        </View>

        <View
          style={[
            cardShape,
            styles.gameRow,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}>
          <Poster
            coverUrl={other.coverUrl}
            heroUrl={other.heroUrl}
            title={other.title}
            width={48}
            rounded="image"
          />
          <View style={styles.flex}>
            <Text variant="label" color="textMuted">
              Similar game
            </Text>
            <Text variant="h5" numberOfLines={2}>
              {other.title}
            </Text>
          </View>
          {onChangeOther && (
            <Button title="Change" size="small" variant="ghost" onPress={onChangeOther} />
          )}
        </View>

        {/* Structured first, because these are what get counted — "32 players
            say the combat" needs everyone choosing from the same twelve. The
            free text below is where the nuance goes. */}
        <MultiChoiceChips
          label="What makes them alike"
          choices={SIMILARITY_REASONS.map((reason) => ({
            value: reason,
            label: SIMILARITY_REASON_LABEL[reason],
          }))}
          value={reasons}
          onChange={setReasons}
          max={MAX_SIMILARITY_REASONS}
        />

        <TextField
          label="In a line · optional"
          value={comment}
          onChangeText={setComment}
          multiline
          maxLength={MAX_COMMENT}
          placeholder="Feels like Hades if the House of Hades were a settlement you had to build."
          hint={`${comment.length}/${MAX_COMMENT}`}
        />

        {submit.isError && (
          <Text variant="bodySmall" color="danger">
            {submit.error instanceof Error ? submit.error.message : 'Could not save that.'}
          </Text>
        )}

        <Button
          title={existingVote ? 'Save' : pairExists ? 'Agree' : 'Recommend'}
          fullWidth
          loading={submit.isPending}
          onPress={() => submit.mutate()}
        />
        {reasons.length === 0 && (
          <Text variant="caption" color="textMuted" style={styles.centred}>
            Reasons are optional, but they are what makes a recommendation useful.
          </Text>
        )}
      </PageScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.x16, gap: Spacing.x24, paddingBottom: Spacing.x48 },
  head: { gap: Spacing.x4 },
  /* Every card's material (`card-material`). */
  gameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12, padding: CARD_INSET },
  centred: { textAlign: 'center' },
});
