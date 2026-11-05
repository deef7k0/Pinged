import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { reportHref, useCanReport } from '@/components/report-flag';
import { AnchoredMenu, AnchoredMenuItem, useAnchoredMenu } from '@/components/ui/anchored-menu';
import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { RichText } from '@/components/ui/rich-text';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CommentWithAuthor } from '@/lib/api';
import { displayNameFor, timeAgo } from '@/lib/format';

/** A face in a comment: 32. A reply is indented by the face and its gap. */
export const COMMENT_FACE = 32;
export const COMMENT_INDENT = COMMENT_FACE + Spacing.x12;

/**
 * One comment — the one row a review's replies and a thread both draw (the
 * Apple pass, 2026-11-05): a 32 face, "Ada · 2h" on one line (the name 15
 * semibold, the time quiet), the words at 16 under it, and its actions —
 * Reply, Delete (your own), Report (somebody else's) — in a ⋯ at the far end
 * and on a long press. It replaced two rows: the review page's (a fixed
 * identity column with the name under the face, a bin or a flag beside it)
 * and the thread's (Reply / Delete / Report as a line of small words).
 *
 * `onPress` makes the whole row a door (the review page opens the thread).
 */
export function CommentRow({
  comment,
  canDelete,
  onDelete,
  onReply,
  onPress,
}: {
  comment: CommentWithAuthor;
  canDelete: boolean;
  onDelete: () => void;
  onReply?: () => void;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const canReport = useCanReport(comment.user_id);
  const [trigger, menu] = useAnchoredMenu();
  const name = displayNameFor(comment.profile);
  const when = timeAgo(comment.created_at);
  const hasActions = !!onReply || canDelete || canReport;

  const body = (
    <>
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={`${name}’s profile`}
        onPress={() => router.push({ pathname: '/profile/[id]', params: { id: comment.user_id } })}
        scaleTo={0.92}>
        <Avatar uri={comment.profile?.avatar_url} name={name} size={COMMENT_FACE} />
      </PressableScale>
      <View style={styles.text}>
        <Text variant="h5" numberOfLines={1}>
          {name}
          <Text variant="body" color="textMuted">{` · ${when}`}</Text>
        </Text>
        {/* `**bold**` and `*italic*` are what the composer's keys write. */}
        <RichText variant="body" style={styles.words}>
          {comment.body}
        </RichText>
      </View>
      {hasActions && (
        <View ref={trigger} collapsable={false}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Actions for ${name}’s comment`}
            accessibilityState={{ expanded: menu.isOpen }}
            onPress={menu.open}
            hitSlop={10}
            scaleTo={0.9}
            pressedColor={theme.controlPressed}
            style={styles.more}>
            <Ionicons name="ellipsis-horizontal" size={16} color={theme.textMuted} />
          </PressableScale>
        </View>
      )}
    </>
  );

  return (
    <>
      <PressableScale
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={`${name}, ${when}. ${comment.body}`}
        accessibilityHint={onPress ? 'Opens the thread' : undefined}
        onPress={onPress}
        onLongPress={hasActions ? menu.open : undefined}
        scaleTo={0.99}
        style={styles.row}>
        {body}
      </PressableScale>
      <AnchoredMenu menu={menu} label="Comment" align="end">
        {onReply && (
          <AnchoredMenuItem
            icon="arrow-undo-outline"
            title="Reply"
            onPress={() => {
              menu.close();
              onReply();
            }}
          />
        )}
        {canDelete && (
          <AnchoredMenuItem
            icon="trash-outline"
            iconColor={theme.danger}
            title="Delete"
            onPress={() => {
              menu.close();
              onDelete();
            }}
          />
        )}
        {canReport && (
          <AnchoredMenuItem
            icon="flag-outline"
            title="Report"
            onPress={() => {
              menu.close();
              router.push(
                reportHref({ kind: 'comment', targetId: comment.id, authorId: comment.user_id })
              );
            }}
          />
        )}
      </AnchoredMenu>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.x12,
    paddingVertical: Spacing.x12,
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
  words: { fontSize: 16, lineHeight: 22 },
  more: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
