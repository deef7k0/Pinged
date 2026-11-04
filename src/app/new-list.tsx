import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { ChoiceChips } from '@/components/choice-chips';
import { Button } from '@/components/ui/button';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageScrollView } from '@/components/ui/page-scroll';
import { RICH_TEXT_HINT } from '@/components/ui/rich-text';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { createAwardsList, createList, type ListKind } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { toast } from '@/lib/toast';

type Shape = { kind: ListKind; label: string; hint: string; ranked: boolean };

/** Favourites and wishlist are singletons created on demand, so not offered here. */
const SHAPES: Shape[] = [
  { kind: 'list', label: 'Collection', hint: 'An unordered set of games', ranked: false },
  { kind: 'list', label: 'Ranked list', hint: 'Numbered, best to worst', ranked: true },
  { kind: 'tier', label: 'Tier list', hint: 'Sort games into S–F tiers', ranked: false },
  {
    kind: 'captioned',
    label: 'Captioned board',
    hint: 'A line of your own under each cover',
    ranked: false,
  },
  {
    kind: 'awards',
    label: 'Award show',
    hint: 'Categories with a winner and your reasons',
    ranked: false,
  },
];

/** The shapes as choices, keyed by their index — two share a `kind`. */
const SHAPE_CHOICES = SHAPES.map((shape, index) => ({
  value: String(index),
  label: shape.label,
  hint: shape.hint,
}));

export default function NewListScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [shapeIndex, setShapeIndex] = useState(0);

  const create = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('You must be signed in.');
      const shape = SHAPES[shapeIndex];

      /* An award show is created by an RPC, not an insert: it arrives with its
         eight categories already in place, and a list that existed with half a
         ballot would be worse than one that failed. The function reads
         `auth.uid()` itself, which is why `userId` is only checked here. */
      if (shape.kind === 'awards') {
        return createAwardsList({ title, description });
      }

      return createList(userId, {
        title,
        description,
        kind: shape.kind,
        isRanked: shape.ranked,
      });
    },
    onSuccess: (listId) => {
      toast.success('Collection created');
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      router.replace({ pathname: '/list/[id]', params: { id: listId } });
    },
  });

  return (
    /* `modal`: an iOS sheet already begins below the status bar, so the bar must
       not inset itself again — see `useTopBarInset`. `dismiss` for the same
       reason the chevron is wrong here: a sheet closes, it does not go back. */
    <Screen
      edges={['bottom']}
      padded
      insetHeader
      modal
      topBar={<FrostedTopBar dismiss title="New collection" />}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <PageScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <TextField
            label="Title"
            value={title}
            onChangeText={setTitle}
            placeholder="Best horror games"
            maxLength={100}
            autoFocus
          />

          {/* Tall enough to write in. This is the collection's argument, not a
              caption, and a field one line deep tells you to write one line. */}
          <TextField
            label="About"
            value={description}
            onChangeText={setDescription}
            placeholder="What ties these together?"
            multiline
            maxLength={1000}
            hint={RICH_TEXT_HINT}
            style={styles.about}
          />

          {/* The app's selection cards, the same object as a report's reasons:
              a name, what it means, and a radio. Not clearable — a collection
              is always one of these. */}
          <ChoiceChips
            label="Type"
            choices={SHAPE_CHOICES}
            value={String(shapeIndex)}
            onChange={(next) => next !== null && setShapeIndex(Number(next))}
            clearable={false}
            withHints
          />

          {create.isError && (
            <Text variant="bodySmall" color="danger">
              {create.error instanceof Error ? create.error.message : 'Could not create the list.'}
            </Text>
          )}

          <Button
            title="Create collection"
            onPress={() => create.mutate()}
            loading={create.isPending}
            disabled={!title.trim()}
            fullWidth
          />
        </PageScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: Spacing.x16, paddingVertical: Spacing.x24 },
  about: { minHeight: 120, maxHeight: 260 },
});
