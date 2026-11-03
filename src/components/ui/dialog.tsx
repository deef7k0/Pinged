import { BlurView } from 'expo-blur';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View, type AlertButton } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/*
 * reacticx's dialog (`primitives/dialog`, MIT), measured from its source: a
 * card that swings in from above — 20° about its top edge under a 500
 * perspective, from 0.8 to full size — on a spring of 150 / 25, and leaves
 * on a 450ms timing; behind it a scrim (zinc-950 at 55%), blurred on iOS.
 */
const CONTENT_SPRING = { stiffness: 150, damping: 25, mass: 1 } as const;
const EXIT_MS = 450;
const ROTATION = 20;
const START_SCALE = 0.8;
const PERSPECTIVE = 500;
/** The card: 22 round, 20 in, 16 between its parts, 420 at most. */
const RADIUS = 22;
const MAX_WIDTH = 420;

export type DialogButton = AlertButton;

type Request = {
  id: number;
  title: string;
  message?: string;
  buttons: DialogButton[];
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

  useEffect(() => {
    progress.set(reduceMotion ? 1 : withSpring(1, CONTENT_SPRING));
  }, [progress, reduceMotion]);

  function close(button?: DialogButton) {
    if (leaving) return;
    setLeaving(true);
    button?.onPress?.();
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
      { perspective: PERSPECTIVE },
      {
        rotateX: `${interpolate(progress.get(), [0, 1], [-ROTATION, 0], Extrapolation.CLAMP)}deg`,
      },
      { scale: interpolate(progress.get(), [0, 1], [START_SCALE, 1], Extrapolation.CLAMP) },
    ],
  }));

  /* The cancel first, then the rest in their order — the reading order of a
     footer laid out to the right. */
  const ordered = [
    ...request.buttons.filter((button) => button.style === 'cancel'),
    ...request.buttons.filter((button) => button.style !== 'cancel'),
  ];

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

      <View style={styles.viewport} pointerEvents="box-none">
        <Animated.View
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
            cardStyle,
          ]}>
          <View style={styles.header}>
            <Text variant="h3">{request.title}</Text>
            {!!request.message && (
              <Text variant="body" color="textSecondary">
                {request.message}
              </Text>
            )}
          </View>
          <View style={styles.footer}>
            {ordered.map((button, index) => (
              <Button
                key={`${button.text}-${index}`}
                title={button.text ?? 'OK'}
                size="small"
                variant={
                  button.style === 'destructive'
                    ? 'danger'
                    : button.style === 'cancel'
                      ? 'secondary'
                      : 'primary'
                }
                disabled={leaving}
                onPress={() => close(button)}
              />
            ))}
          </View>
        </Animated.View>
      </View>
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
    width: '100%',
    maxWidth: MAX_WIDTH,
    gap: Spacing.x16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    padding: Spacing.x20,
    boxShadow: '0px 12px 28px rgba(0, 0, 0, 0.35)',
  },
  header: { gap: Spacing.x4 },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: Spacing.x8,
  },
});
