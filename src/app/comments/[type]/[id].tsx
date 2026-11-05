import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { COMMENT_INDENT, CommentRow } from '@/components/comment-row';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageFlatList } from '@/components/ui/page-scroll';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { ControlHeight, Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import {
  addComment,
  deleteComment,
  getComments,
  type CommentWithAuthor,
  type TargetType,
} from '@/lib/api';
import { displayNameFor } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { toast } from '@/lib/toast';

/** A top-level comment with its replies nested one level deep. */
type Thread = { comment: CommentWithAuthor; replies: CommentWithAuthor[] };

export default function CommentsScreen() {
  const theme = useTheme();
  const accent = useAccent();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ type: string; id: string }>();
  const userId = useAuth((state) => state.session?.user.id);

  /* Logs are the only commentable target left — `post` was the other half of
     this route and that feature is gone. Kept as a param rather than hardcoded
     because the `comments` table is still polymorphic and the CHECK is what
     would have to change to add another. */
  const targetType: TargetType = 'log';
  const targetId = params.id;

  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<CommentWithAuthor | null>(null);

  const comments = useQuery({
    queryKey: ['comments', targetType, targetId],
    queryFn: () => getComments(targetType, targetId!),
    enabled: !!targetId,
  });

  /*
   * The table allows arbitrary nesting, but the UI renders exactly two levels.
   * Any deeper reply is attached to its top-level ancestor so nothing is
   * silently hidden.
   */
  const threads = useMemo<Thread[]>(() => {
    const all = comments.data ?? [];
    const byId = new Map(all.map((comment) => [comment.id, comment]));
    const roots = all.filter((comment) => !comment.parent_id);
    const threadFor = new Map<string, Thread>(
      roots.map((comment) => [comment.id, { comment, replies: [] }])
    );

    for (const comment of all) {
      if (!comment.parent_id) continue;

      // Walk up to the top-level ancestor.
      let cursor = byId.get(comment.parent_id);
      const guard = new Set<string>();
      while (cursor?.parent_id && !guard.has(cursor.id)) {
        guard.add(cursor.id);
        cursor = byId.get(cursor.parent_id);
      }
      if (cursor) threadFor.get(cursor.id)?.replies.push(comment);
    }

    return [...threadFor.values()];
  }, [comments.data]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['comments', targetType, targetId] });
    queryClient.invalidateQueries({ queryKey: ['engagement'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }

  const send = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('You must be signed in.');
      await addComment(userId, targetType, targetId!, draft, replyTo?.id ?? null);
    },
    onSuccess: () => {
      setDraft('');
      setReplyTo(null);
      invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: async (commentId: string) => {
      if (!userId) throw new Error('You must be signed in.');
      await deleteComment(userId, commentId);
    },
    onSuccess: () => {
      toast.success('Comment deleted');
      return invalidate();
    },
  });

  if (comments.isLoading) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back title="Comments" />}>
        <LoadingState />
      </Screen>
    );
  }

  if (comments.isLoadingError) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back title="Comments" />}>
        <ErrorState error={comments.error} />
      </Screen>
    );
  }

  return (
    /* A composer is pinned to the bottom of this screen, so the header stays put
       too — chrome that comes and goes around a text field you are typing into
       is chrome that is in the way. */
    <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back title="Comments" />}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}>
        <PageFlatList
          data={threads}
          keyExtractor={(thread) => thread.comment.id}
          contentContainerStyle={threads.length === 0 ? styles.empty : styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={ThreadRule}
          renderItem={({ item }) => (
            <View>
              <CommentRow
                comment={item.comment}
                canDelete={item.comment.user_id === userId}
                onReply={() => setReplyTo(item.comment)}
                onDelete={() => remove.mutate(item.comment.id)}
              />
              {/* Replies indented by a face and its gap, no rule beside them. */}
              {item.replies.length > 0 && (
                <View style={styles.replies}>
                  {item.replies.map((reply) => (
                    <CommentRow
                      key={reply.id}
                      comment={reply}
                      canDelete={reply.user_id === userId}
                      onReply={() => setReplyTo(item.comment)}
                      onDelete={() => remove.mutate(reply.id)}
                    />
                  ))}
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="chatbubble-ellipses-outline"
              title="No comments yet"
              message="Be the first to say something."
            />
          }
        />

        <View style={[styles.composer, { borderTopColor: theme.border }]}>
          {replyTo && (
            <View style={styles.replyingTo}>
              <Text variant="caption" color="textMuted">
                Replying to {displayNameFor(replyTo.profile)}
              </Text>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Cancel reply"
                onPress={() => setReplyTo(null)}
                scaleTo={0.85}>
                <Ionicons name="close-circle" size={16} color={theme.textMuted} />
              </PressableScale>
            </View>
          )}

          <View style={styles.composerRow}>
            <View style={styles.composerField}>
              <TextField
                value={draft}
                onChangeText={setDraft}
                placeholder={replyTo ? 'Write a reply…' : 'Add a comment…'}
                multiline
                maxLength={2000}
                style={styles.input}
              />
            </View>
            {/* A round key in the action grey, like every button in the app;
                the arrow brightens once there is something to send. */}
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Send"
              disabled={!draft.trim() || send.isPending}
              onPress={() => send.mutate()}
              scaleTo={0.9}
              pressedColor={theme.controlPressed}
              focusRing={accent.ring}
              style={StyleSheet.flatten([styles.send, { backgroundColor: theme.controlFill }])}>
              <Ionicons
                name="arrow-up"
                size={20}
                color={draft.trim() ? theme.text : theme.textMuted}
              />
            </PressableScale>
          </View>

          {send.isError && (
            <Text variant="caption" color="danger">
              {send.error instanceof Error ? send.error.message : 'Could not post.'}
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/* Module scope: an inline component is a new type every render. */
function ThreadRule() {
  const theme = useTheme();
  return <View style={[styles.rule, { backgroundColor: theme.border }]} />;
}

/** The send key's edge: the composer field's own height, so the two align. */
const SEND = ControlHeight.field;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.x16, paddingBottom: Spacing.x24 },
  empty: { flexGrow: 1 },
  replies: { marginLeft: COMMENT_INDENT },
  rule: { height: StyleSheet.hairlineWidth, marginLeft: COMMENT_INDENT },
  composer: { padding: Spacing.x12, gap: Spacing.x8, borderTopWidth: StyleSheet.hairlineWidth },
  replyingTo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.x8 },
  composerField: { flex: 1 },
  /* One line tall to start — the field's 2dp of edge make it exactly the send
     key's height — growing to about five lines before it scrolls. */
  input: { minHeight: ControlHeight.field - 3, maxHeight: 120 },
  send: {
    width: SEND,
    height: SEND,
    borderRadius: SEND / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
