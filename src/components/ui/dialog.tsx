import { BlurView } from 'expo-blur';
import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type AlertButton,
} from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/*
 * Apple's alert (the Apple pass, 2026-11-04; it was reacticx's dialog, a card
 * swinging in 20° about its top edge with a row of small pills at its foot):
 * a centred card 300 wide and 30 round, its title and message centred, its
 * buttons full-width capsules — side by side when there are two, stacked
 * when there are more — the default prominent, a destructive one red. It
 * fades and settles from 1.08, and fades out in 150ms; behind it a scrim,
 * blurred on iOS.
 */
const ENTER_MS = 220;
const EXIT_MS = 150;
const START_SCALE = 1.08;
/** The card: 30 round, 20 in, 300 wide. */
const RADIUS = 30;
const WIDTH = 300;

export type DialogButton = AlertButton;

type Request = {
  id: number;
  title: string;
  message?: string;
  buttons: DialogButton[];
  input?: PromptInput;
};

/** A field in the alert — iOS's `alert.addTextField` (the Apple pass, 2026-11-05). */
type PromptInput = {
  placeholder?: string;
  /** The confirming button is enabled only while this holds. */
  accepts?: (text: string) => boolean;
  onSubmit: (text: string) => void;
};

/* A queue, not a slot: two alerts raised in a row are both seen, in order. */
let queue: Request[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function current(): Request | null {
  return queue[0] ?? null;
}

/**
 * The app's alert — reacticx's dialog in place of the platform's. The same
 * arguments as `Alert.alert(title, message, buttons)`, so a call moves over
 * unchanged: a button's `style` (`cancel`, `destructive`) picks its look, and
 * `onPress` runs as the dialog begins to close. No buttons is one "OK".
 *
 * Drawn by `<DialogHost>` in the root layout. Android's own alert draws at
 * most three buttons and drops the rest silently (the report form found that
 * once); this draws every one.
 */
export function showAlert(title: string, message?: string, buttons?: DialogButton[]): void {
  queue = [
    ...queue,
    {
      id: nextId++,
      title,
      message,
      buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }],
    },
  ];
  emit();
}

/**
 * An alert with a text field in it: Cancel, and `confirm`, which hands over
 * what was typed and is enabled only while `accepts` says so — Delete
 * account's "type your username".
 */
export function showPrompt(
  title: string,
  message: string | undefined,
  options: {
    placeholder?: string;
    confirm: { text: string; style?: 'default' | 'destructive' };
    accepts?: (text: string) => boolean;
    onSubmit: (text: string) => void;
  }
): void {
  queue = [
    ...queue,
    {
      id: nextId++,
      title,
      message,
      buttons: [{ text: 'Cancel', style: 'cancel' }, options.confirm],
      input: {
        placeholder: options.placeholder,
        accepts: options.accepts,
        onSubmit: options.onSubmit,
      },
    },
  ];
  emit();
}

function finish(id: number) {
  queue = queue.filter((request) => request.id !== id);
  emit();
}

/** Draws the alert at the head of the queue. Mounted once, in the root layout. */
export function DialogHost() {
  const request = useSyncExternalStore(subscribe, current, current);
  if (!request) return null;
  return <AlertDialog key={request.id} request={request} />;
}

function AlertDialog({ request }: { request: Request }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const [leaving, setLeaving] = useState(false);
  const [typed, setTyped] = useState('');
  const input = request.input;
  const accepted = !input?.accepts || input.accepts(typed);

  useEffect(() => {
    progress.set(
      reduceMotion ? 1 : withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) })
    );
  }, [progress, reduceMotion]);

  function close(button?: DialogButton) {
    if (leaving) return;
    setLeaving(true);
    button?.onPress?.();
    if (input && button && button.style !== 'cancel') input.onSubmit(typed);
    if (reduceMotion) {
      finish(request.id);
      return;
    }
    progress.set(
      withTiming(0, { duration: EXIT_MS }, (done) => {
        'worklet';
        if (done) runOnJS(finish)(request.id);
      })
    );
  }

  const cancel = request.buttons.find((button) => button.style === 'cancel');

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 1], [0, 1], Extrapolation.CLAMP),
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(progress.get(), [0, 1], [START_SCALE, 1], Extrapolation.CLAMP) },
    ],
  }));

  /* Two buttons sit side by side with the cancel on the left, as Apple's do;
     more are stacked with the cancel at the foot. */
  const others = request.buttons.filter((button) => button.style !== 'cancel');
  const cancels = request.buttons.filter((button) => button.style === 'cancel');
  const sideBySide = request.buttons.length === 2;
  const ordered = sideBySide ? [...cancels, ...others] : [...others, ...cancels];
  /* The prominent one: the last button that is neither cancel nor destructive. */
  const prominent = [...others].reverse().find((button) => button.style !== 'destructive');

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => close(cancel)}>
      <Animated.View style={[StyleSheet.absoluteFill, overlayStyle]}>
        {Platform.OS === 'ios' && (
          <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
        )}
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(theme.shadowInk, 0.55) }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => close(cancel)}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <KeyboardAvoidingView
        style={styles.viewport}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none">
        <Animated.View
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={[
            styles.card,
            { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
            cardStyle,
          ]}>
          <View style={styles.header}>
            <Text variant="h4" style={styles.centred}>
              {request.title}
            </Text>
            {!!request.message && (
              <Text variant="bodySmall" color="textSecondary" style={styles.centred}>
                {request.message}
              </Text>
            )}
          </View>
          {input && (
            <TextInput
              value={typed}
              onChangeText={setTyped}
              placeholder={input.placeholder}
              placeholderTextColor={theme.textMuted}
              selectionColor={theme.text}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              accessibilityLabel={input.placeholder ?? request.title}
              style={[styles.input, { color: theme.text, backgroundColor: theme.input }]}
            />
          )}
          {/* Not `disabled` while it leaves: that would redraw every button in
              its disabled look for the length of the exit. */}
          <View
            style={[styles.footer, sideBySide && styles.footerRow]}
            pointerEvents={leaving ? 'none' : 'auto'}>
            {ordered.map((button, index) => (
              <View key={`${button.text}-${index}`} style={sideBySide ? styles.half : undefined}>
                <Button
                  title={button.text ?? 'OK'}
                  fullWidth
                  variant={
                    button.style === 'destructive'
                      ? 'danger'
                      : button === prominent
                        ? 'primary'
                        : 'secondary'
                  }
                  disabled={!!input && button.style !== 'cancel' && !accepted}
                  onPress={() => close(button)}
                />
              </View>
            ))}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  viewport: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.x24,
  },
  card: {
    width: WIDTH,
    maxWidth: '100%',
    gap: Spacing.x20,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    borderCurve: 'continuous',
    padding: Spacing.x20,
    boxShadow: '0px 12px 28px rgba(0, 0, 0, 0.35)',
  },
  header: { gap: Spacing.x4, paddingTop: Spacing.x4 },
  centred: { textAlign: 'center' },
  input: {
    height: 44,
    paddingHorizontal: Spacing.x12,
    borderRadius: 12,
    fontSize: 16,
    marginTop: -Spacing.x8,
  },
  footer: { gap: Spacing.x8 },
  footerRow: { flexDirection: 'row' },
  half: { flex: 1 },
});
