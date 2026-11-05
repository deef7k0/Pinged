import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View, type TextStyle } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { COMPOSER } from '@/constants/review-page';
import { Typeface } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addComment, type TargetType } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { Loader } from '@/components/ui/loader';

/** `**` for bold, `*` for italic — what `<RichText>` reads back. */
type Marker = '**' | '*';

/**
 * The reply field docked at the foot of a review's page — the owner's
 * screenshot (2026-10-17): a panel the width of the screen less 14 at each
 * side, its top corners rounded and its foot on the bottom of the screen; the
 * words in it, and under them **B** and *I*, the count against 500, and a
 * round send key. Every number is `COMPOSER`'s.
 *
 * **B** and *I* wrap what is selected in `**` or `*` — the two marks
 * `<RichText>` understands, and the replies under a review are drawn with it.
 * With nothing selected they put the pair at the cursor and the cursor between
 * them, so the next words are bold.
 *
 * It posts a top-level reply; answering one reply is the thread screen's.
 */
export function ReplyComposer({
  targetType,
  targetId,
  fill,
  placeholder = 'Add a reply…',
}: {
  targetType: TargetType;
  targetId: string;
  /** The panel's colour: a step above the page it is docked on. */
  fill: string;
  placeholder?: string;
}) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id) ?? null;

  const [draft, setDraft] = useState('');
  const input = useRef<TextInput>(null);
  /* Where the cursor is, for the keys. A ref: nothing is drawn from it. */
  const selection = useRef({ start: 0, end: 0 });

  const send = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Sign in to reply.');
      await addComment(userId, targetType, targetId, draft);
    },
    onSuccess: () => {
      setDraft('');
      selection.current = { start: 0, end: 0 };
      input.current?.blur();
      queryClient.invalidateQueries({ queryKey: ['comments', targetType, targetId] });
      queryClient.invalidateQueries({ queryKey: ['engagement'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  function mark(marker: Marker) {
    const { start, end } = selection.current;
    const next = `${draft.slice(0, start)}${marker}${draft.slice(start, end)}${marker}${draft.slice(end)}`;
    if (next.length > COMPOSER.maxLength) return;
    setDraft(next);
    const from = start + marker.length;
    const to = end + marker.length;
    selection.current = { start: from, end: to };
    input.current?.focus();
    /* After the new text has landed in the field, or it puts the cursor back. */
    requestAnimationFrame(() => input.current?.setSelection(from, to));
  }

  const canSend = !!draft.trim() && !send.isPending;

  return (
    <View style={[styles.panel, { backgroundColor: fill, borderColor: theme.border }]}>
      <TextInput
        ref={input}
        value={draft}
        onChangeText={setDraft}
        onSelectionChange={(event) => {
          selection.current = event.nativeEvent.selection;
        }}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        multiline
        maxLength={COMPOSER.maxLength}
        accessibilityLabel="Reply"
        /* No line height: on Android one clips a field's descenders. */
        style={[styles.input, { color: theme.text }]}
      />

      {send.isError && (
        <Text variant="caption" color="danger" style={styles.error}>
          {send.error instanceof Error ? send.error.message : 'Could not post your reply.'}
        </Text>
      )}

      <View style={styles.keys}>
        <MarkKey label="Bold" glyph="B" style={styles.bold} onPress={() => mark('**')} />
        <MarkKey label="Italic" glyph="I" style={styles.italic} onPress={() => mark('*')} />

        <View style={styles.spacer} />

        <Text
          accessibilityLabel={`${draft.length} of ${COMPOSER.maxLength} characters`}
          style={[styles.counter, { color: theme.textMuted }]}>
          {`${draft.length}/${COMPOSER.maxLength}`}
        </Text>

        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Send reply"
          accessibilityState={{ disabled: !canSend, busy: send.isPending }}
          disabled={!canSend}
          onPress={() => send.mutate()}
          scaleTo={0.9}
          style={StyleSheet.flatten([
            styles.send,
            { backgroundColor: canSend ? theme.white : theme.controlFill },
          ])}>
          {send.isPending ? (
            <Loader size="small" color={theme.textMuted} />
          ) : (
            <Ionicons
              name="arrow-up"
              size={18}
              color={canSend ? theme.background : theme.textMuted}
            />
          )}
        </PressableScale>
      </View>
    </View>
  );
}

/** **B** or *I*: a small rounded key in the action grey. */
function MarkKey({
  label,
  glyph,
  style,
  onPress,
}: {
  label: string;
  glyph: string;
  style: TextStyle;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Marks the selected words, or the next ones you type"
      onPress={onPress}
      /* 28dp tall: eight of slop above and below lifts it to the floor. */
      hitSlop={{ top: 8, bottom: 8 }}
      scaleTo={0.92}
      style={StyleSheet.flatten([styles.key, { backgroundColor: theme.controlFill }])}>
      <Text style={[styles.glyph, style, { color: theme.textMuted }]}>{glyph}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  /* The foot meets the bottom of the screen, so only the top is rounded and
     edged — a hairline, as the screenshot's panel catches the light there. */
  panel: {
    marginHorizontal: COMPOSER.side,
    borderTopLeftRadius: COMPOSER.radius,
    borderTopRightRadius: COMPOSER.radius,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  input: {
    fontFamily: Typeface.regular,
    fontSize: COMPOSER.text,
    paddingTop: COMPOSER.inputTop,
    paddingBottom: 0,
    paddingHorizontal: COMPOSER.inputSide,
    maxHeight: 120,
    textAlignVertical: 'top',
  },
  error: { paddingHorizontal: COMPOSER.inputSide, paddingTop: 4 },
  keys: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: COMPOSER.key.gap,
    marginTop: COMPOSER.keysTop,
    paddingHorizontal: COMPOSER.keysSide,
    paddingBottom: COMPOSER.keysBottom,
  },
  key: {
    width: COMPOSER.key.width,
    height: COMPOSER.key.height,
    borderRadius: COMPOSER.key.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: COMPOSER.key.glyph, lineHeight: COMPOSER.key.glyph + 4 },
  bold: { fontFamily: Typeface.bold },
  italic: { fontFamily: Typeface.italic },
  spacer: { flex: 1 },
  counter: {
    fontFamily: Typeface.regular,
    fontSize: COMPOSER.counter,
    lineHeight: COMPOSER.counter + 4,
    marginRight: COMPOSER.counterGap - COMPOSER.key.gap,
  },
  /* Centred on the keys and taller than them, as the screenshot's is: it
     reaches past the row rather than making it taller. */
  send: {
    width: COMPOSER.send,
    height: COMPOSER.send,
    marginVertical: (COMPOSER.key.height - COMPOSER.send) / 2,
    borderRadius: COMPOSER.send / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
