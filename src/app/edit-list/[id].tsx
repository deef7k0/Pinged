import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { CollectionArtTile, CollectionTitleField } from '@/components/collection-form';
import { collectionCover } from '@/components/collection-header';
import { InsetGroup } from '@/components/ui/inset-group';

import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageScrollView } from '@/components/ui/page-scroll';
import { RICH_TEXT_HINT } from '@/components/ui/rich-text';
import { ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { getList, updateListDetails, type ListCover } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { toast } from '@/lib/toast';

/**
 * Rename a collection and rewrite its About.
 *
 * ## Why this route exists
 *
 * Because a description was write-once. `new-list` was the only field that had
 * ever accepted one, so a collection's About could be typed exactly once — in
 * the same modal that asks you to name it and choose its shape, before a single
 * game is in it and therefore before there is anything to describe. That is the
 * worst possible moment to ask someone for the argument behind a shelf, and it
 * is the only moment the app offered.
 *
 * Type and ranking are not editable here; `updateListDetails` explains why.
 *
 * ## Seeding the form
 *
 * The fields are seeded through a keyed child rather than a `useEffect`, which
 * is the house rule (`app/log/[id].tsx` is the other instance and CLAUDE.md
 * states it): the React Compiler lint treats `setState` in an effect as an
 * error, and remounting on a changed `key` is the pattern that replaces it.
 */
export default function EditListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuth((state) => state.session?.user.id) ?? null;

  const list = useQuery({
    queryKey: ['list', id],
    queryFn: () => getList(id!),
    enabled: !!id,
  });

  if (list.isLoading) {
    return (
      <Screen
        edges={['bottom']}
        padded
        insetHeader
        modal
        topBar={<FrostedTopBar dismiss title="Edit collection" />}>
        <LoadingState />
      </Screen>
    );
  }

  if (list.isLoadingError || !list.data) {
    return (
      <Screen
        edges={['bottom']}
        padded
        insetHeader
        modal
        topBar={<FrostedTopBar dismiss title="Edit collection" />}>
        <ErrorState error={list.error ?? new Error('That collection no longer exists.')} />
      </Screen>
    );
  }

  /* Not the owner: the update would be refused by RLS anyway, and a form that
     lets you type for a minute before telling you so is worse than not opening.
     `list/[id]` only offers this to an owner — this is the direct-link case. */
  if (list.data.user_id !== userId) {
    return (
      <Screen
        edges={['bottom']}
        padded
        insetHeader
        modal
        topBar={<FrostedTopBar dismiss title="Edit collection" />}>
        <ErrorState error={new Error('This is not your collection.')} />
      </Screen>
    );
  }

  return (
    <EditForm
      key={list.data.id}
      listId={list.data.id}
      userId={userId}
      initialTitle={list.data.title}
      initialDescription={list.data.description ?? ''}
      cover={collectionCover(list.data)}
    />
  );
}

function EditForm({
  listId,
  userId,
  initialTitle,
  initialDescription,
  cover,
}: {
  listId: string;
  userId: string;
  initialTitle: string;
  initialDescription: string;
  cover: ListCover | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);

  const save = useMutation({
    mutationFn: () => updateListDetails(userId, listId, { title, description }),
    onSuccess: () => {
      toast.success('Collection saved');
      queryClient.invalidateQueries({ queryKey: ['list', listId] });
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      queryClient.invalidateQueries({ queryKey: ['public-lists'] });
      router.back();
    },
  });

  const dirty = title !== initialTitle || description !== initialDescription;

  return (
    <Screen
      edges={['bottom']}
      padded
      insetHeader
      modal
      topBar={
        <FrostedTopBar
          dismiss
          title="Edit collection"
          confirm={{
            label: 'Save',
            onPress: () => save.mutate(),
            loading: save.isPending,
            disabled: !title.trim() || !dirty,
          }}
        />
      }>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <PageScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* New collection's head (the Apple pass, 2026-11-05): the art,
              the name under it, the description as a row that grows. */}
          <View style={styles.head}>
            <CollectionArtTile cover={cover} />
            <CollectionTitleField
              value={title}
              onChangeText={setTitle}
              placeholder="Collection name"
              maxLength={100}
            />
          </View>
          <InsetGroup footer={RICH_TEXT_HINT}>
            <TextField
              variant="row"
              value={description}
              onChangeText={setDescription}
              placeholder="Description"
              accessibilityLabel="Description"
              multiline
              maxLength={1000}
              style={styles.about}
            />
          </InsetGroup>

          {save.isError && (
            <Text variant="bodySmall" color="danger">
              {save.error instanceof Error ? save.error.message : 'Could not save.'}
            </Text>
          )}
        </PageScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: Spacing.x24, paddingVertical: Spacing.x24 },
  head: { gap: Spacing.x12 },
  /* Grows with what is written, to a cap. */
  about: { maxHeight: 300 },
});
