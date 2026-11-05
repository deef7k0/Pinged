import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';

import { COMMENT_INDENT, CommentRow } from '@/components/comment-row';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Spacing, TapTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addComment, deleteComment, getComments, type TargetType } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { toast } from '@/lib/toast';

/**
 * How many comments a page renders before handing off to the thread screen.
 *
 * This section lives inside somebody else's `ScrollView`, so it cannot window —
 * every row it returns is mounted and measured whether or not it is on screen.
 * Eight is about two screenfuls under a review, which is enough for the
 * conversation to look like a conversation and short enough that a thread with
 * two hundred replies does not quietly turn one page into two hundred views.
 *
 * The rest are not hidden: `/comments/[type]/[id]` is the full thread, with
 * replies and a pinned composer, and the footer link says how many are there.
 */
const INLINE_LIMIT = 8;

export type CommentSectionProps = {
  targetType: TargetType;
  targetId: string;
  /**
   * Heading for the block. Defaults to the count, which is what the reference
   * does and what a reader is actually looking for.
   */
  title?: string;
  /**
   * The composer is docked at the foot of the screen (`<ReplyComposer>`), so
   * this is the conversation alone: the heading as a quiet line, no "Add
   * comment" and no inline field, and nothing said when there is nothing yet.
   * A review's page.
   */
  docked?: boolean;
  /** The heading's type, when `docked`. */
  headingStyle?: StyleProp<TextStyle>;
};

/**
 * The conversation under a piece of work, inline on the page it belongs to.
 *
 * ## Why inline rather than only at `/comments`
 *
 * Because a review with replies and a review without are different objects, and
 * a page that shows neither the replies nor their number makes them the same
 * one. The count was already invisible here — `<EngagementBar layout="stacked">`
 * drops it — so a review could carry a live argument and say nothing about it,
 * which is the loop that decides whether a writer comes back for a second game.
 *
 * ## The shape
 *
 * A heading row, one button, then rows separated by hairlines. Each row is an
 * *identity column* — avatar, name, age, stacked — beside the comment body, which
 * is the arrangement Letterboxd uses and it earns its keep on a phone for a
 * reason that is not obvious: comment bodies vary from three words to three
 * hundred, and a name inline above the body makes every short comment two lines
 * of mostly-empty row. Moving the identity into a fixed column beside the text
 * means a three-word comment is one line tall.
 *
 * `IDENTITY_WIDTH` is 76 against the 34dp avatar it holds, which leaves ~260dp
 * of measure on a 390dp phone — about 35 characters, narrow but well inside what
 * a comment is for. The reference is a desktop screenshot at roughly twice this;
 * the proportion, not the pixel size, is what carries over.
 *
 * ## Composing
 *
 * The button is a disclosure, not a link: it opens a field in place rather than
 * pushing a screen, because leaving the page you are replying to in order to
 * reply to it is the thing that makes people not reply. Replies to a *specific*
 * comment still go to the thread screen, which is the only place the two-level
 * structure exists.
 */
export function CommentSection({
  targetType,
  targetId,
  title,
  docked = false,
  headingStyle,
}: CommentSectionProps) {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id) ?? null;

  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState('');

  const comments = useQuery({
    queryKey: ['comments', targetType, targetId],
    queryFn: () => getComments(targetType, targetId),
    enabled: !!targetId,
  });

  /* Top-level only. Replies exist and are threaded, but a nested tree inside a
     page that is already a document is a second reading order competing with
     the first — the thread screen is where that belongs. */
  const roots = (comments.data ?? []).filter((comment) => !comment.parent_id);
  const shown = roots.slice(0, INLINE_LIMIT);
  const hidden = roots.length - shown.length;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['comments', targetType, targetId] });
    queryClient.invalidateQueries({ queryKey: ['engagement'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }

  const send = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Sign in to comment.');
      await addComment(userId, targetType, targetId, draft);
    },
    onSuccess: () => {
      setDraft('');
      setComposing(false);
      invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: async (commentId: string) => {
      if (!userId) throw new Error('Sign in to comment.');
      await deleteComment(userId, commentId);
    },
    onSuccess: () => {
      toast.success('Comment deleted');
      return invalidate();
    },
  });

  const heading = title ?? `${roots.length} ${roots.length === 1 ? 'comment' : 'comments'}`;

  return (
    <View style={styles.section}>
      {docked ? (
        <Text variant="body" color="textMuted" accessibilityRole="header" style={headingStyle}>
          {heading}
        </Text>
      ) : (
        <View style={[styles.heading, { borderBottomColor: theme.border }]}>
          <Text variant="label" color="textMuted">
            {heading}
          </Text>

          {!composing && (
            <Button
              title={roots.length === 0 ? 'Write the first' : 'Add comment'}
              variant="secondary"
              size="small"
              icon="chatbubble-outline"
              onPress={() => setComposing(true)}
            />
          )}
        </View>
      )}

      {composing && !docked && (
        <View style={styles.composer}>
          <TextField
            value={draft}
            onChangeText={setDraft}
            placeholder="Say something about this…"
            multiline
            autoFocus
            maxLength={2000}
            style={styles.input}
          />

          {send.isError && (
            <Text variant="caption" color="danger">
              {send.error instanceof Error ? send.error.message : 'Could not post.'}
            </Text>
          )}

          <View style={styles.composerActions}>
            <Button
              title="Cancel"
              variant="ghost"
              size="small"
              onPress={() => {
                setComposing(false);
                setDraft('');
              }}
            />
            <Button
              title="Post"
              size="small"
              loading={send.isPending}
              disabled={!draft.trim() || send.isPending}
              onPress={() => send.mutate()}
            />
          </View>
        </View>
      )}

      {comments.isLoading ? (
        <Text variant="bodySmall" color="textMuted" style={styles.quiet}>
          Loading comments…
        </Text>
      ) : comments.isLoadingError ? (
        <Text variant="bodySmall" color="textMuted" style={styles.quiet}>
          Comments could not be loaded.
        </Text>
      ) : roots.length === 0 ? (
        docked ? null : (
          /* Honest rather than decorative. There is nothing to illustrate here and
           an empty state with artwork in it would be louder than the comments it
           is standing in for. */
          <Text variant="bodySmall" color="textMuted" style={styles.quiet}>
            No comments yet.
          </Text>
        )
      ) : (
        shown.map((comment) => (
          <View key={comment.id} style={[styles.rule, { borderTopColor: theme.border }]}>
            <CommentRow
              comment={comment}
              canDelete={comment.user_id === userId}
              onDelete={() => remove.mutate(comment.id)}
              onPress={() =>
                router.push({
                  pathname: '/comments/[type]/[id]',
                  params: { type: targetType, id: targetId },
                })
              }
            />
          </View>
        ))
      )}

      {hidden > 0 && (
        <Link
          href={{ pathname: '/comments/[type]/[id]', params: { type: targetType, id: targetId } }}
          asChild>
          <PressableScale
            accessibilityRole="link"
            accessibilityLabel={`Show all ${roots.length} comments`}
            scaleTo={0.98}
            style={StyleSheet.flatten([styles.more, { borderTopColor: theme.border }])}>
            <Text variant="h5" color="primaryText">
              Show {hidden} more {hidden === 1 ? 'comment' : 'comments'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={theme.primaryText} />
          </PressableScale>
        </Link>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 0 },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.x12,
    paddingBottom: Spacing.x12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: TapTarget,
  },

  composer: { paddingTop: Spacing.x16, gap: Spacing.x8 },
  input: { minHeight: 88, maxHeight: 220 },
  composerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.x8 },

  quiet: { paddingTop: Spacing.x16 },

  /* The hairline between comments, from where the words start. */
  rule: { borderTopWidth: StyleSheet.hairlineWidth, marginLeft: COMMENT_INDENT },
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x4,
    paddingVertical: Spacing.x16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
