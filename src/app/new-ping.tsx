import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { ChoiceChips, MultiChoiceChips } from '@/components/choice-chips';
import { GameSearchResults } from '@/components/game-search-results';
import { Button } from '@/components/ui/button';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageScrollView } from '@/components/ui/page-scroll';
import { Poster } from '@/components/ui/poster';
import { PressGlyph } from '@/components/ui/press-glyph';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useTheme } from '@/hooks/use-theme';
import { createPing, getPing, updatePing, type PingDraft, type PingReference } from '@/lib/api';
import type { PingFeedRow } from '@/lib/database.types';
import { getGameById, type GameSearchResult } from '@/lib/games';
import {
  PING_DESCRIPTION_MAX,
  PING_ERAS,
  PING_EXAMPLES,
  PING_FILTER_MAX,
  PING_GENRES,
  PING_LENGTHS,
  PING_PLATFORMS,
  PING_PLAYERS,
  PING_REFERENCE_MAX,
} from '@/lib/pings';
import { useAuth } from '@/store/auth';
import { toast } from '@/lib/toast';

/**
 * Ask the community for a game — or edit what you asked (`?edit=<id>`).
 *
 * Three things, in the order the brief ranks them, and only the first is
 * required:
 *
 *  1. **What you're looking for**, in your own words. The field's placeholder
 *     is one of the brief's examples, so an empty field already shows what a
 *     good request reads like.
 *  2. **Like these games** — up to three, picked from the catalogue, so
 *     similarity is explicit and not read out of the words. Strongly
 *     encouraged, and the line under the heading says why: people who played
 *     them see the request first.
 *  3. **Preferences**, folded away until asked for: genres, platforms, a
 *     length, single- or multiplayer, an era.
 *
 * Picking a game takes the sheet over with a search, and gives it back with
 * the game added — one sheet, never a trip to the Search tab (CLAUDE.md,
 * "picking a game is not browsing for one").
 */
export default function NewPingScreen() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const userId = useAuth((state) => state.session?.user.id) ?? null;

  const existing = useQuery({
    queryKey: ['ping', edit],
    queryFn: () => getPing(edit!),
    enabled: !!edit && !!userId,
  });

  const title = edit ? 'Edit ping' : 'New ping';
  const bar = <FrostedTopBar dismiss title={title} />;

  if (edit && existing.isPending) {
    return (
      <Screen edges={['bottom']} insetHeader modal topBar={bar}>
        <LoadingState />
      </Screen>
    );
  }
  if (edit && existing.isLoadingError) {
    return (
      <Screen edges={['bottom']} insetHeader modal topBar={bar}>
        <ErrorState error={existing.error} onRetry={() => void existing.refetch()} />
      </Screen>
    );
  }
  if (edit && (!existing.data || existing.data.user_id !== userId)) {
    return (
      <Screen edges={['bottom']} insetHeader modal topBar={bar}>
        <EmptyState title="Nothing to edit" message="This ping is gone, or it isn’t yours." />
      </Screen>
    );
  }

  /* Seeded once from what was loaded: a child with a key, never an effect. */
  return (
    <Screen edges={['bottom']} insetHeader modal topBar={bar}>
      <PingForm key={existing.data?.id ?? 'new'} existing={existing.data ?? null} />
    </Screen>
  );
}

function draftOf(ping: PingFeedRow | null): PingDraft {
  return {
    description: ping?.description ?? '',
    references: (ping?.refs ?? []).map((ref) => ({
      id: ref.game_id,
      title: ref.title,
      coverUrl: ref.cover_url,
      game: null,
    })),
    genres: ping?.genres ?? [],
    platforms: ping?.platforms ?? [],
    playLength: ping?.play_length ?? null,
    playerMode: ping?.player_mode ?? null,
    releaseEra: ping?.release_era ?? null,
  };
}

function PingForm({ existing }: { existing: PingFeedRow | null }) {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id) ?? null;
  const [draft, setDraft] = useState<PingDraft>(() => draftOf(existing));
  const [picking, setPicking] = useState(false);
  const [showPreferences, setShowPreferences] = useState(
    () =>
      !!existing &&
      (existing.genres.length > 0 ||
        existing.platforms.length > 0 ||
        !!existing.play_length ||
        !!existing.player_mode ||
        !!existing.release_era)
  );
  /* One example a visit, chosen when the sheet opens. */
  const [example] = useState(() => PING_EXAMPLES[Math.floor(Math.random() * PING_EXAMPLES.length)]);

  const update = (patch: Partial<PingDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const length = draft.description.trim().length;
  const tooLong = draft.description.length > PING_DESCRIPTION_MAX;

  const publish = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Sign in to ask.');
      if (existing) {
        await updatePing(existing.id, draft);
        return existing.id;
      }
      return createPing(userId, draft);
    },
    onSuccess: (id) => {
      toast.success('Your request is posted');
      void queryClient.invalidateQueries({ queryKey: ['pings'] });
      void queryClient.invalidateQueries({ queryKey: ['ping', id] });
      if (existing) {
        router.back();
      } else {
        /* Straight to what was published: it is the page its suggestions
           will arrive on. */
        router.replace({ pathname: '/ping/[id]', params: { id } });
      }
    },
  });

  if (picking) {
    return (
      <ReferencePicker
        taken={draft.references.map((ref) => ref.id)}
        onCancel={() => setPicking(false)}
        onPick={(ref) => {
          update({ references: [...draft.references, ref].slice(0, PING_REFERENCE_MAX) });
          setPicking(false);
        }}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
      <PageScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.block}>
          <Text variant="h3" accessibilityRole="header">
            What are you looking for?
          </Text>
          <TextField
            value={draft.description}
            onChangeText={(description) => update({ description })}
            placeholder={example}
            multiline
            autoFocus={!existing}
            maxLength={PING_DESCRIPTION_MAX + 50}
            accessibilityLabel="What you’re looking for"
            style={styles.description}
            error={tooLong ? `${PING_DESCRIPTION_MAX} characters at most.` : null}
          />
          <Text variant="caption" color={tooLong ? 'danger' : 'textMuted'} style={styles.count}>
            {`${draft.description.length} / ${PING_DESCRIPTION_MAX}`}
          </Text>
        </View>

        <View style={styles.block}>
          <View style={styles.headRow}>
            <Text variant="h4" accessibilityRole="header">
              Like these games
            </Text>
            <Text variant="caption" color="textMuted">
              {`${draft.references.length} of ${PING_REFERENCE_MAX}`}
            </Text>
          </View>
          <Text variant="bodySmall" color="textSecondary">
            Optional, but it helps: people who’ve played them see your ping first.
          </Text>
          <View style={styles.refs}>
            {draft.references.map((ref, index) => (
              <View key={ref.id} style={[styles.refRow, { backgroundColor: theme.controlFill }]}>
                <Poster coverUrl={ref.coverUrl} title={ref.title} width={32} />
                <Text variant="itemTitle" numberOfLines={2} style={styles.refTitle}>
                  {ref.title}
                </Text>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${ref.title}`}
                  onPress={() =>
                    update({ references: draft.references.filter((_, at) => at !== index) })
                  }
                  hitSlop={10}
                  scaleTo={0.9}
                  style={StyleSheet.flatten(styles.remove)}>
                  <PressGlyph>
                    <Ionicons name="close" size={18} color={theme.textMuted} />
                  </PressGlyph>
                </PressableScale>
              </View>
            ))}
            {draft.references.length < PING_REFERENCE_MAX && (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Add a game it should be like"
                onPress={() => setPicking(true)}
                scaleTo={0.98}
                style={StyleSheet.flatten([styles.addRow, { borderColor: theme.outline }])}>
                <Ionicons name="add-circle-outline" size={20} color={theme.primaryText} />
                <Text variant="itemTitle" style={{ color: theme.primaryText }}>
                  {draft.references.length === 0 ? 'Add a game' : 'Add another'}
                </Text>
              </PressableScale>
            )}
          </View>
        </View>

        <View style={styles.block}>
          <PressableScale
            accessibilityRole="button"
            accessibilityState={{ expanded: showPreferences }}
            onPress={() => setShowPreferences((open) => !open)}
            scaleTo={0.98}
            pressedColor={theme.controlPressed}
            style={StyleSheet.flatten([
              styles.disclosure,
              { backgroundColor: showPreferences ? theme.surfaceSelected : theme.controlFill },
            ])}>
            <Ionicons name="options-outline" size={18} color={theme.textSecondary} />
            <View style={styles.flex}>
              <Text variant="h5">Preferences</Text>
              <Text variant="caption" color="textMuted">
                Genre, platform, length, players, era — all optional
              </Text>
            </View>
            <Ionicons
              name={showPreferences ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={theme.textMuted}
            />
          </PressableScale>

          {showPreferences && (
            <View style={styles.preferences}>
              <MultiChoiceChips
                label="Genres"
                choices={PING_GENRES}
                value={draft.genres}
                onChange={(genres) => update({ genres })}
                max={PING_FILTER_MAX}
              />
              <MultiChoiceChips
                label="Platforms"
                choices={PING_PLATFORMS}
                value={draft.platforms}
                onChange={(platforms) => update({ platforms })}
                max={PING_FILTER_MAX}
              />
              <ChoiceChips
                label="Length"
                choices={PING_LENGTHS}
                value={draft.playLength}
                onChange={(playLength) => update({ playLength })}
                clearable
              />
              <ChoiceChips
                label="Players"
                choices={PING_PLAYERS}
                value={draft.playerMode}
                onChange={(playerMode) => update({ playerMode })}
                clearable
              />
              <ChoiceChips
                label="Release"
                choices={PING_ERAS}
                value={draft.releaseEra}
                onChange={(releaseEra) => update({ releaseEra })}
                clearable
              />
            </View>
          )}
        </View>

        {publish.isError && (
          <Text variant="bodySmall" color="danger">
            {publish.error instanceof Error ? publish.error.message : 'Could not publish that.'}
          </Text>
        )}

        <Button
          title={existing ? 'Save changes' : 'Publish ping'}
          icon={existing ? 'checkmark' : 'paper-plane'}
          fullWidth
          size="large"
          loading={publish.isPending}
          disabled={length === 0 || tooLong}
          onPress={() => publish.mutate()}
        />
        {!existing && (
          <Text variant="caption" color="textMuted" style={styles.footnote}>
            Everyone on Pinged can see it and suggest a game. You can edit it, mark it found or
            close it at any time.
          </Text>
        )}
      </PageScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * The search that stands in for the form while a game is picked. The full
 * record is fetched on a tap — the request's tables reference `games`, and the
 * cached row wants more than a search row carries.
 */
function ReferencePicker({
  taken,
  onPick,
  onCancel,
}: {
  taken: readonly string[];
  onPick: (ref: PingReference) => void;
  onCancel: () => void;
}) {
  const [input, setInput] = useState('');
  const query = useDebouncedValue(input.trim());

  const pick = useMutation({
    mutationFn: async (result: GameSearchResult) => {
      const game = await getGameById(result.id);
      if (!game) throw new Error(`Could not load “${result.title}”.`);
      return {
        id: game.id,
        title: game.title,
        coverUrl: game.coverUrl,
        game,
      } satisfies PingReference;
    },
    onSuccess: onPick,
  });

  return (
    <View style={styles.flex}>
      <View style={styles.pickerHead}>
        <View style={styles.headRow}>
          <Text variant="h3">Which game is it like?</Text>
          <Button title="Cancel" variant="ghost" size="small" onPress={onCancel} />
        </View>
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
        {pick.isError && (
          <Text variant="bodySmall" color="danger">
            {pick.error instanceof Error ? pick.error.message : 'Could not add that game.'}
          </Text>
        )}
      </View>
      <GameSearchResults
        query={query}
        onSelect={(game) => pick.mutate(game)}
        badgeFor={(game) => (taken.includes(game.id) ? 'Already added' : null)}
        isDisabled={(game) => pick.isPending || taken.includes(game.id)}
        prompt={{
          title: 'A game it should be like',
          message: 'Search the catalogue, then tap the game.',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.x16, gap: Spacing.x32, paddingBottom: Spacing.x48 },
  block: { gap: Spacing.x12 },
  description: { minHeight: 120, textAlignVertical: 'top' },
  count: { alignSelf: 'flex-end' },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  refs: { gap: Spacing.x8 },
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    padding: Spacing.x8,
    paddingRight: Spacing.x12,
    borderRadius: Radius.card,
  },
  refTitle: { flex: 1, minWidth: 0 },
  remove: { padding: Spacing.x4 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x8,
    height: 52,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  disclosure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    minHeight: 56,
    paddingHorizontal: Spacing.x16,
    borderRadius: Radius.card,
  },
  preferences: { gap: Spacing.x24, paddingTop: Spacing.x8 },
  footnote: { textAlign: 'center', paddingHorizontal: Spacing.x16 },
  pickerHead: { padding: Spacing.x16, gap: Spacing.x12 },
});
