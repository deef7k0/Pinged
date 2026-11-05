import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { useBarConfirm } from '@/hooks/use-bar-confirm';
import { GameSearchResults } from '@/components/game-search-results';
import { ReferenceCovers } from '@/components/pings/reference-covers';
import { Button } from '@/components/ui/button';
import { cardShape, CARD_INSET, useCardMaterial } from '@/components/ui/card-material';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageScrollView } from '@/components/ui/page-scroll';
import { Poster } from '@/components/ui/poster';
import { EmptyState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { getPing, getPingSuggestions, suggestGame } from '@/lib/api';
import type { PingFeedRow } from '@/lib/database.types';
import { displayNameFor } from '@/lib/format';
import { getGameById, type Game, type GameSearchResult } from '@/lib/games';
import { SUGGESTION_MESSAGE_MAX, canSuggest } from '@/lib/pings';
import { useAuth } from '@/store/auth';
import { toast } from '@/lib/toast';

/**
 * Suggest a game for somebody's ping: pick it, then say why.
 *
 * Two steps on one sheet. The request stays at the head of both — what they
 * asked and the games it is built on — because a suggestion is an answer to
 * those words, and the brief's point is that it comes with a reason: "do not
 * make Pings a list of unexplained game titles". The reason is optional, and
 * the field asks for it in the voice of the request ("Why does it fit what
 * Ada is looking for?") rather than saying so.
 *
 * Games already suggested by you here, or the ones the request is built on,
 * are marked and cannot be picked; the database refuses both anyway.
 */
export default function SuggestGameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuth((state) => state.session?.user.id) ?? null;

  /* The detail page's keys, so coming from there draws at once. */
  const ping = useQuery({
    queryKey: ['ping', id],
    queryFn: () => getPing(id!),
    enabled: !!id && !!userId,
  });
  const suggestions = useQuery({
    queryKey: ['ping-suggestions', id],
    queryFn: () => getPingSuggestions(id!),
    enabled: !!id && !!userId,
  });

  const bar = <FrostedTopBar dismiss title="Suggest a game" />;

  if (ping.isPending) {
    return (
      <Screen edges={['bottom']} insetHeader modal topBar={bar}>
        <LoadingState />
      </Screen>
    );
  }
  if (!ping.data || !canSuggest(ping.data, userId)) {
    return (
      <Screen edges={['bottom']} insetHeader modal topBar={bar}>
        <EmptyState
          icon="paper-plane-outline"
          title="Not taking suggestions"
          message={
            ping.data?.user_id === userId
              ? 'This is your own ping.'
              : 'This ping is closed, found, or gone.'
          }
        />
      </Screen>
    );
  }

  const mine = (suggestions.data ?? [])
    .filter((suggestion) => suggestion.user_id === userId)
    .map((suggestion) => suggestion.game_id);

  return (
    <Screen edges={['bottom']} insetHeader modal topBar={bar}>
      <SuggestFlow ping={ping.data} alreadyMine={mine} />
    </Screen>
  );
}

function SuggestFlow({ ping, alreadyMine }: { ping: PingFeedRow; alreadyMine: string[] }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id) ?? null;
  const [input, setInput] = useState('');
  const query = useDebouncedValue(input.trim());
  const [chosen, setChosen] = useState<Game | null>(null);
  const [message, setMessage] = useState('');
  const name = displayNameFor(ping);
  const references = ping.refs.map((ref) => ref.game_id);

  const load = useMutation({
    mutationFn: async (result: GameSearchResult) => {
      const game = await getGameById(result.id);
      if (!game) throw new Error(`Could not load “${result.title}”.`);
      return game;
    },
    onSuccess: setChosen,
  });

  const send = useMutation({
    mutationFn: () => suggestGame(userId!, ping.id, chosen!, message),
    onSuccess: () => {
      toast.success('Suggestion sent');
      void queryClient.invalidateQueries({ queryKey: ['ping-suggestions', ping.id] });
      void queryClient.invalidateQueries({ queryKey: ['ping', ping.id] });
      void queryClient.invalidateQueries({ queryKey: ['pings'] });
      router.back();
    },
  });

  useBarConfirm(
    chosen
      ? {
          label: message.trim() ? 'Suggest it' : 'Suggest it without a reason',
          onPress: () => send.mutate(),
          loading: send.isPending,
          disabled: message.length > SUGGESTION_MESSAGE_MAX,
        }
      : null
  );

  if (!chosen) {
    return (
      <View style={styles.flex}>
        <View style={styles.head}>
          <Asked ping={ping} />
          <TextField
            value={input}
            onChangeText={setInput}
            icon="search"
            variant="search"
            placeholder="Search games…"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {load.isError && (
            <Text variant="bodySmall" color="danger">
              {load.error instanceof Error ? load.error.message : 'Could not load that game.'}
            </Text>
          )}
        </View>
        <GameSearchResults
          query={query}
          onSelect={(game) => load.mutate(game)}
          badgeFor={(game) =>
            references.includes(game.id)
              ? 'One of their games'
              : alreadyMine.includes(game.id)
                ? 'You suggested it'
                : null
          }
          isDisabled={(game) =>
            load.isPending || references.includes(game.id) || alreadyMine.includes(game.id)
          }
          prompt={{
            title: `What should ${name} play?`,
            message: 'Search the catalogue, then tap the game.',
          }}
        />
      </View>
    );
  }

  const tooLong = message.length > SUGGESTION_MESSAGE_MAX;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
      <PageScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Asked ping={ping} />

        <View style={styles.chosen}>
          <Poster
            coverUrl={chosen.coverUrl}
            heroUrl={chosen.heroUrl}
            title={chosen.title}
            width={72}
            elevated
          />
          <View style={styles.chosenText}>
            <Text variant="label" color="textMuted">
              YOUR SUGGESTION
            </Text>
            <Text variant="h3" numberOfLines={3}>
              {chosen.title}
            </Text>
            {[chosen.developer, chosen.releaseYear].filter(Boolean).length > 0 && (
              <Text variant="bodySmall" color="textSecondary" numberOfLines={1}>
                {[chosen.developer, chosen.releaseYear].filter(Boolean).join(' · ')}
              </Text>
            )}
            <Button
              title="Choose another"
              variant="ghost"
              size="small"
              onPress={() => {
                setChosen(null);
                send.reset();
              }}
            />
          </View>
        </View>

        <View style={styles.block}>
          <Text variant="h4">{`Why does it fit what ${name} is looking for?`}</Text>
          <TextField
            value={message}
            onChangeText={setMessage}
            placeholder="The atmosphere, the writing, how it plays… a sentence or two helps them decide."
            multiline
            autoFocus
            maxLength={SUGGESTION_MESSAGE_MAX + 50}
            style={styles.message}
            accessibilityLabel="Why it fits"
            error={tooLong ? `${SUGGESTION_MESSAGE_MAX} characters at most.` : null}
          />
          <Text variant="caption" color={tooLong ? 'danger' : 'textMuted'} style={styles.count}>
            {`${message.length} / ${SUGGESTION_MESSAGE_MAX}`}
          </Text>
        </View>

        {send.isError && (
          <Text variant="bodySmall" color="danger">
            {send.error instanceof Error ? send.error.message : 'Could not send that.'}
          </Text>
        )}
      </PageScrollView>
    </KeyboardAvoidingView>
  );
}

/** What was asked, as a quiet card at the head of the sheet. */
function Asked({ ping }: { ping: PingFeedRow }) {
  const material = useCardMaterial();
  return (
    <View
      style={[
        cardShape,
        styles.asked,
        { backgroundColor: material.fill, borderColor: material.edge },
      ]}>
      <Text variant="caption" color="textMuted">
        {`${displayNameFor(ping)} asks`}
      </Text>
      <Text variant="h5" numberOfLines={3}>
        {ping.description}
      </Text>
      {ping.refs.length > 0 && (
        <ReferenceCovers refs={ping.refs} ringColor={material.fill} width={32} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { padding: Spacing.x16, gap: Spacing.x12 },
  content: { padding: Spacing.x16, gap: Spacing.x24, paddingBottom: Spacing.x48 },
  asked: { padding: CARD_INSET, gap: Spacing.x8, shadowOpacity: 0, elevation: 0 },
  chosen: { flexDirection: 'row', gap: Spacing.x16, alignItems: 'flex-start' },
  chosenText: { flex: 1, minWidth: 0, gap: 4, alignItems: 'flex-start' },
  block: { gap: Spacing.x12 },
  message: { minHeight: 110, textAlignVertical: 'top' },
  count: { alignSelf: 'flex-end' },
});
