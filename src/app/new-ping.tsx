import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';

import { useBarConfirm } from '@/hooks/use-bar-confirm';
import { GameSearchResults } from '@/components/game-search-results';
import { Button } from '@/components/ui/button';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { ChecklistGroup, chosenLine } from '@/components/ui/checklist-group';
import { InsetGroup, Row } from '@/components/ui/inset-group';
import { PullDownRow } from '@/components/ui/pull-down-row';
import { PageScrollView } from '@/components/ui/page-scroll';
import { Poster } from '@/components/ui/poster';
import { PressGlyph } from '@/components/ui/press-glyph';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Spacing, Typeface } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
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
  const accent = useAccent();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id) ?? null;
  const [draft, setDraft] = useState<PingDraft>(() => draftOf(existing));
  const [picking, setPicking] = useState(false);
  /** A checklist pushed over the form — Genres or Platforms — or none. */
  const [checklist, setChecklist] = useState<'genres' | 'platforms' | null>(null);
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

  useBarConfirm(
    picking
      ? null
      : checklist
        ? /* A checklist's ✓ returns to the form, its picks kept. */
          { label: 'Done', onPress: () => setChecklist(null) }
        : {
            label: existing ? 'Save changes' : 'Publish ping',
            onPress: () => publish.mutate(),
            loading: publish.isPending,
            disabled: length === 0 || tooLong,
          }
  );

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

  if (checklist) {
    const isGenres = checklist === 'genres';
    return (
      <PageScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ChecklistGroup
          title={isGenres ? 'Genres' : 'Platforms'}
          choices={isGenres ? PING_GENRES : PING_PLATFORMS}
          value={isGenres ? draft.genres : draft.platforms}
          onChange={(next) => update(isGenres ? { genres: next } : { platforms: next })}
          max={PING_FILTER_MAX}
        />
      </PageScrollView>
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
        {/*
          The Apple pass (2026-11-05): the question is the page — a borderless
          20pt field, no well; the games an editable list (⊖ to take one off,
          ⊕ to add); the preferences five rows, Genres and Platforms pushing
          checklists, the rest pull-downs. It was a heading over a well, a
          dashed "Add a game" box, and a disclosure of ~30 chips.
        */}
        <View style={styles.block}>
          <TextInput
            value={draft.description}
            onChangeText={(description) => update({ description })}
            placeholder={example}
            placeholderTextColor={theme.textMuted}
            selectionColor={accent.onSurface}
            cursorColor={accent.onSurface}
            multiline
            autoFocus={!existing}
            maxLength={PING_DESCRIPTION_MAX + 50}
            accessibilityLabel="What you’re looking for"
            style={[styles.question, { color: theme.text }]}
          />
          <Text variant="caption" color={tooLong ? 'danger' : 'textMuted'} style={styles.count}>
            {tooLong
              ? `${PING_DESCRIPTION_MAX} characters at most`
              : `${draft.description.length} / ${PING_DESCRIPTION_MAX}`}
          </Text>
        </View>

        <InsetGroup
          header={`Like these games · ${draft.references.length} of ${PING_REFERENCE_MAX}`}
          footer="Optional, but it helps: people who’ve played them see your ping first.">
          {draft.references.map((ref, index) => (
            <View key={ref.id} style={styles.refRow}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`Remove ${ref.title}`}
                onPress={() =>
                  update({ references: draft.references.filter((_, at) => at !== index) })
                }
                hitSlop={12}
                scaleTo={0.9}>
                <PressGlyph>
                  <Ionicons name="remove-circle" size={22} color={theme.danger} />
                </PressGlyph>
              </PressableScale>
              <Poster coverUrl={ref.coverUrl} title={ref.title} width={32} zoomable={false} />
              <Text variant="body" numberOfLines={2} style={styles.refTitle}>
                {ref.title}
              </Text>
            </View>
          ))}
          {draft.references.length < PING_REFERENCE_MAX && (
            <PressableScale
              key="add"
              accessibilityRole="button"
              accessibilityLabel="Add a game it should be like"
              onPress={() => setPicking(true)}
              scaleTo={1}
              pressedColor={theme.controlPressed}
              style={styles.refRow}>
              <Ionicons name="add-circle" size={22} color={theme.success} />
              <Text variant="body" style={{ color: theme.primaryText }}>
                {draft.references.length === 0 ? 'Add a game' : 'Add another'}
              </Text>
            </PressableScale>
          )}
        </InsetGroup>

        <InsetGroup header="Preferences" footer="All optional.">
          <Row
            title="Genres"
            value={chosenLine(draft.genres, PING_GENRES)}
            onPress={() => setChecklist('genres')}
          />
          <Row
            title="Platforms"
            value={chosenLine(draft.platforms, PING_PLATFORMS)}
            onPress={() => setChecklist('platforms')}
          />
          <PullDownRow
            title="Length"
            choices={PING_LENGTHS}
            value={draft.playLength}
            onChange={(playLength) => update({ playLength })}
            anyLabel="Any"
          />
          <PullDownRow
            title="Players"
            choices={PING_PLAYERS}
            value={draft.playerMode}
            onChange={(playerMode) => update({ playerMode })}
            anyLabel="Any"
          />
          <PullDownRow
            title="Release"
            choices={PING_ERAS}
            value={draft.releaseEra}
            onChange={(releaseEra) => update({ releaseEra })}
            anyLabel="Any"
          />
        </InsetGroup>

        {publish.isError && (
          <Text variant="bodySmall" color="danger">
            {publish.error instanceof Error ? publish.error.message : 'Could not publish that.'}
          </Text>
        )}
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
  question: {
    fontFamily: Typeface.semibold,
    fontSize: 20,
    lineHeight: 26,
    minHeight: 104,
    textAlignVertical: 'top',
    paddingHorizontal: 0,
  },
  count: { alignSelf: 'flex-end' },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    minHeight: 52,
    paddingHorizontal: Spacing.x16,
    paddingVertical: Spacing.x8,
  },
  refTitle: { flex: 1, minWidth: 0 },
  footnote: { textAlign: 'center', paddingHorizontal: Spacing.x16 },
  pickerHead: { padding: Spacing.x16, gap: Spacing.x12 },
});
