import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/button';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageScrollView } from '@/components/ui/page-scroll';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { addAwardCategory, getAwards, renameAward, setAwardNote } from '@/lib/api';
import { toast } from '@/lib/toast';

/** Matches `list_awards.label`'s CHECK. */
const MAX_LABEL = 60;
/** Matches `list_awards.note`'s CHECK. */
const MAX_NOTE = 1000;

/**
 * Write an award category: its name, or the case for its winner.
 *
 * One modal for three jobs, because they are the same form with different fields
 * shown. `id` is the slot, or the literal `new` when a category is being added:
 *
 *   /award-edit/new?list=…        add a category (label only)
 *   /award-edit/<slot>?list=…     rename it
 *   /award-edit/<slot>?list=…&field=note   write why it won
 *
 * A separate screen rather than an inline field on the list, for the note in
 * particular: the explanation is the substance of an award show and people write
 * paragraphs into it. An inline `TextInput` inside a scrolling ballot fights the
 * keyboard for room and loses on every phone.
 */
export default function AwardEditScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id, list, field } = useLocalSearchParams<{ id: string; list?: string; field?: string }>();

  const isNew = id === 'new';
  const isNote = field === 'note';

  const ballot = useQuery({
    queryKey: ['awards', list],
    queryFn: () => getAwards(list!),
    enabled: !!list,
  });

  const award = ballot.data?.awards.find((entry) => entry.id === id);

  /* Seeded from the query the moment it resolves, without an effect: the form
     lives in a child keyed on the loaded value, which is the pattern
     `app/log/[id].tsx` established — see the no-setState-in-effects rule. */
  const initial = isNote ? (award?.note ?? '') : (award?.label ?? '');
  const ready = isNew || !!award || ballot.isLoadingError;

  const save = useMutation({
    mutationFn: async (value: string) => {
      if (isNew) {
        if (!list) throw new Error('Missing collection.');
        await addAwardCategory(list, { label: value });
        return;
      }
      if (isNote) return setAwardNote(id!, value);
      return renameAward(id!, value);
    },
    onSuccess: () => {
      toast.success('Saved');
      queryClient.invalidateQueries({ queryKey: ['awards', list] });
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      router.back();
    },
  });

  const title = isNew ? 'New award' : isNote ? 'Why it wins' : 'Rename award';

  return (
    /* `modal`: an iOS sheet already begins below the status bar, so the bar must
       not inset itself again — see `useTopBarInset`. */
    <Screen
      edges={['bottom']}
      padded
      insetHeader
      modal
      topBar={<FrostedTopBar dismiss title={title} />}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <PageScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {ready && (
            <AwardForm
              key={initial}
              initial={initial}
              isNote={isNote}
              awardLabel={award?.label}
              gameTitle={award?.game?.title}
              pending={save.isPending}
              onSubmit={(value) => save.mutate(value)}
            />
          )}

          {save.isError && (
            <Text variant="bodySmall" color="danger">
              {save.error instanceof Error ? save.error.message : 'Could not save that.'}
            </Text>
          )}
        </PageScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/**
 * The field itself, mounted with its starting value already in place.
 *
 * Split out and keyed by the caller so form state is initialised from props on
 * mount rather than synced in an effect — the React Compiler rules treat the
 * latter as an error, and the `key` remount is what `log/[id]` does for the
 * same reason.
 */
function AwardForm({
  initial,
  isNote,
  awardLabel,
  gameTitle,
  pending,
  onSubmit,
}: {
  initial: string;
  isNote: boolean;
  awardLabel?: string;
  gameTitle?: string;
  pending: boolean;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const trimmed = value.trim();

  return (
    <>
      {isNote ? (
        <>
          {!!awardLabel && (
            <Text variant="bodySmall" color="textMuted">
              {gameTitle ? `${gameTitle} · ${awardLabel}` : awardLabel}
            </Text>
          )}
          <TextField
            label="Your case for it"
            value={value}
            onChangeText={setValue}
            placeholder="One of the most detailed worlds I've gotten to explore."
            multiline
            numberOfLines={6}
            maxLength={MAX_NOTE}
            style={styles.note}
            autoFocus
          />
          <Text variant="caption" color="textMuted">
            {value.length} / {MAX_NOTE}
          </Text>
        </>
      ) : (
        <TextField
          label="Award"
          value={value}
          onChangeText={setValue}
          placeholder="Best Gameplay"
          maxLength={MAX_LABEL}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={() => trimmed && onSubmit(trimmed)}
          autoFocus
        />
      )}

      {/* The note is the one field that may legitimately be emptied — clearing
          it is how you take back what you wrote. A label cannot be blank. */}
      <Button
        title="Save"
        onPress={() => onSubmit(value)}
        disabled={pending || (!isNote && !trimmed)}
        fullWidth
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingVertical: Spacing.x16, gap: Spacing.x12 },
  note: { minHeight: 140, textAlignVertical: 'top' },
});
