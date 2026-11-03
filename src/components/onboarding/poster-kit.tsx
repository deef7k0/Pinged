import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import { createContext, useContext, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PaintFill, inkTransition } from '@/components/ui/paint-fill';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { POSTER_THEMES, type PosterKey } from '@/constants/poster';
import { FontFamily, Radius, TapTarget, Type, readableInk, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { INK_ON_LIGHT } from '@/lib/color';
import { Loader } from '@/components/ui/loader';

/**
 * Onboarding's kit — the owner's reference (2026-10-15), drawn once.
 *
 * Every onboarding page is a `<PosterPage>` and is built from these, so the
 * reference's grammar is stated in one file: the black (or poster-coloured)
 * page, the dashes across the top beside a back chevron, the headline set very
 * large in lowercase, the mono instruction over it, the sentence between two
 * tall brackets, the dark field with a hairline, the outlined pills that turn
 * off-white, and the one off-white pill at the foot with "Not now" under it.
 *
 * **None of this is the app's control language, and that is deliberate.** The
 * app's actions are grey pills and its choices take the accent's wash
 * (CLAUDE.md, "Choices are outlined; actions are filled"). Onboarding is the
 * reference's own room, entered once; its controls are the reference's. Do not
 * reach for these anywhere else, and do not "fix" them toward `<Button>`.
 */

/** Gutter: the reference's text starts a tenth of the way in. */
export const POSTER_GUTTER = 24;

type PosterColors = {
  key: PosterKey;
  page: string;
  ink: string;
  quiet: string;
  button: string;
  buttonInk: string;
  link: string;
};

const PosterContext = createContext<PosterColors | null>(null);

/** The colours of the page this is drawn on. */
export function usePoster(): PosterColors {
  const value = useContext(PosterContext);
  if (!value) throw new Error('usePoster() outside a <PosterPage>');
  return value;
}

export type PosterPageProps = {
  poster?: PosterKey;
  /** The back chevron; absent when there is nowhere to go back to. */
  onBack?: () => void;
  /** Which of how many — the dashes across the top. Absent: no dashes. */
  progress?: { index: number; count: number };
  /** Something at the far end of the top row instead of the dashes' end. */
  headerRight?: ReactNode;
  /** Above the body, under the top row — the notification card. */
  top?: ReactNode;
  /**
   * `top`: a question with something to fill in under it — the headline sits
   * near the top, as the reference's do. `middle`: a statement or a request —
   * the headline sits in the lower middle, with the room above it empty.
   */
  align?: 'top' | 'middle';
  children: ReactNode;
  footer?: ReactNode;
  /**
   * The children lay out the page themselves, with `<PosterBody>` and
   * `<PosterFooter>`. For a flow that keeps one page and swaps the step inside
   * it — which is what lets the colour wash from one step to the next.
   */
  bare?: boolean;
};

/**
 * One onboarding page.
 *
 * The page colour is a CSS transition, so moving from a black page to the
 * cobalt one washes the colour in — and, being a React prop rather than an
 * animated style's last frame, it cannot be left behind on the old colour
 * (CLAUDE.md, "An animated style's end value can be lost").
 */
export function PosterPage({
  poster = 'night',
  onBack,
  progress,
  headerRight,
  top,
  align = 'top',
  children,
  footer,
  bare = false,
}: PosterPageProps) {
  const theme = useTheme();
  const tokens = POSTER_THEMES[poster];
  const colors: PosterColors = {
    key: poster,
    page: theme[tokens.page],
    ink: theme[tokens.ink],
    quiet: theme[tokens.quiet],
    button: theme[tokens.button],
    buttonInk: theme[tokens.buttonInk],
    link: theme[tokens.link],
  };
  const darkIcons = readableInk(colors.page) === INK_ON_LIGHT;
  const reduceMotion = useReducedMotion();

  return (
    <PosterContext.Provider value={colors}>
      <Animated.View
        style={[
          styles.flex,
          styles.wash,
          { backgroundColor: colors.page, transitionDuration: reduceMotion ? 0 : 420 },
        ]}>
        <StatusBar style={darkIcons ? 'dark' : 'light'} />
        <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.header}>
              {onBack ? (
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                  onPress={onBack}
                  scaleTo={0.9}
                  style={styles.back}>
                  <Ionicons name="chevron-back" size={24} color={colors.ink} />
                </PressableScale>
              ) : (
                <View style={styles.backSpace} />
              )}
              {progress ? <Dashes index={progress.index} count={progress.count} /> : null}
              {headerRight ? <View style={styles.headerRight}>{headerRight}</View> : null}
            </View>

            {top}

            {bare ? (
              <View style={styles.flex}>{children}</View>
            ) : (
              <>
                <PosterBody align={align}>{children}</PosterBody>
                {footer ? <PosterFooter>{footer}</PosterFooter> : null}
              </>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Animated.View>
    </PosterContext.Provider>
  );
}

/** The page's content, under the top row: near the top, or in the lower middle. */
export function PosterBody({
  align = 'top',
  children,
}: {
  align?: 'top' | 'middle';
  children: ReactNode;
}) {
  return <View style={[styles.body, align === 'middle' && styles.bodyMiddle]}>{children}</View>;
}

/** The pill, and whatever quiet way out sits under it, pinned to the foot. */
export function PosterFooter({ children }: { children: ReactNode }) {
  return <View style={styles.footer}>{children}</View>;
}

/**
 * The dashes: one per step, lit up to and including this one.
 *
 * Read aloud as "step 3 of 12", once, rather than as twelve shapes.
 */
function Dashes({ index, count }: { index: number; count: number }) {
  const { ink } = usePoster();
  return (
    <View
      style={styles.dashes}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${index + 1} of ${count}`}
      accessibilityValue={{ min: 1, max: count, now: index + 1 }}>
      {Array.from({ length: count }, (_, position) => (
        <Animated.View
          key={position}
          style={[styles.dash, { backgroundColor: position <= index ? ink : withAlpha(ink, 0.26) }]}
        />
      ))}
    </View>
  );
}

/**
 * Fades its content in once the headline has typed, so the page arrives in
 * the order it is read: the question, then what to do about it. `after` is the
 * typing's length, capped by the caller; Reduce Motion skips the wait.
 */
export function Reveal({ after = 0, children }: { after?: number; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View entering={reduceMotion ? undefined : FadeIn.delay(after).duration(320)}>
      {children}
    </Animated.View>
  );
}

/** The mono instruction over a headline: "choose one", "up to four". */
export function PosterLabel({ children }: { children: string }) {
  const { quiet } = usePoster();
  return (
    <Text variant="posterLabel" style={[styles.label, { color: quiet }]}>
      {children}
    </Text>
  );
}

/**
 * One sentence between two tall brackets — the reference's way of saying why
 * it is asking. The brackets are typography, not an icon, and are kept from a
 * screen reader, which reads the sentence alone.
 */
export function BracketNote({ children }: { children: string }) {
  const { ink, quiet } = usePoster();
  return (
    <View style={styles.note}>
      <Text
        style={[styles.bracket, { color: ink }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        (
      </Text>
      <Text variant="posterNote" style={[styles.noteText, { color: quiet }]}>
        {children}
      </Text>
      <Text
        style={[styles.bracket, { color: ink }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        )
      </Text>
    </View>
  );
}

export type PosterButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  accessibilityHint?: string;
};

/**
 * The full-width pill at the foot: off-white on black, and the page's own
 * second colour on a poster page (navy on red, butter on cobalt). Disabled is
 * the reference's — a mid grey with a dim label — and busy keeps the pill's
 * size, swapping the label for a spinner.
 */
export function PosterButton({
  title,
  onPress,
  disabled = false,
  busy = false,
  accessibilityHint,
}: PosterButtonProps) {
  const theme = useTheme();
  const { button, buttonInk } = usePoster();
  const off = disabled || busy;
  const fill = disabled ? theme.posterDisabled : button;
  const ink = disabled ? theme.posterDisabledInk : buttonInk;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, busy }}
      disabled={off}
      onPress={onPress}
      scaleTo={0.98}
      style={StyleSheet.flatten([styles.button, { backgroundColor: fill }])}>
      {busy ? (
        <Loader color={ink} />
      ) : (
        <Text variant="posterButton" style={{ color: ink }} numberOfLines={1}>
          {title}
        </Text>
      )}
    </PressableScale>
  );
}

/** "Not now", and the other quiet ways out under the pill. */
export function PosterLink({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { link } = usePoster();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      scaleTo={0.97}
      style={styles.link}>
      <Text variant="posterButton" style={{ color: link, opacity: disabled ? 0.5 : 1 }}>
        {title}
      </Text>
    </PressableScale>
  );
}

export type PosterFieldProps = Omit<TextInputProps, 'style'> & {
  /** A fixed mark before the text — the handle's "@". */
  prefix?: string;
  /** Trailing control inside the well — the password's eye. */
  trailing?: ReactNode;
  invalid?: boolean;
};

/**
 * The reference's field: a dark well with a hairline, which lights a little
 * when it has the focus and turns red when what is in it will not do.
 */
export function PosterField({ prefix, trailing, invalid = false, ...input }: PosterFieldProps) {
  const theme = useTheme();
  const { ink } = usePoster();
  const [focused, setFocused] = useState(false);
  const edge = invalid ? theme.danger : focused ? withAlpha(ink, 0.55) : theme.onboardingEdge;

  return (
    <View style={[styles.field, { backgroundColor: theme.onboardingField, borderColor: edge }]}>
      {prefix ? (
        <Text variant="posterField" color="textMuted" style={styles.prefix}>
          {prefix}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={theme.textMuted}
        selectionColor={ink}
        cursorColor={ink}
        {...input}
        onFocus={(event) => {
          setFocused(true);
          input.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          input.onBlur?.(event);
        }}
        style={[styles.input, Type.posterField, { color: theme.text }]}
      />
      {trailing}
    </View>
  );
}

/**
 * An outlined pill that turns off-white when chosen — "racing", "race
 * directing", "both" in the reference. A radio when the step takes one, a
 * checkbox when it takes several.
 */
export function PosterChip({
  label,
  selected,
  onPress,
  multiple = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  multiple?: boolean;
}) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  return (
    /* The off-white is poured in from the chip's middle (`<PaintFill>`), as
       every control that goes from an outline to solid is. */
    <PressableScale
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityState={multiple ? { checked: selected } : { selected }}
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={0.96}
      style={StyleSheet.flatten([
        styles.chip,
        { borderColor: selected ? theme.posterPaper : theme.onboardingEdge },
      ])}>
      <PaintFill on={selected} color={theme.posterPaper} />
      <Animated.Text
        style={[
          Type.posterButton,
          { color: selected ? theme.posterNavy : theme.text },
          inkTransition(reduceMotion),
        ]}>
        {label}
      </Animated.Text>
    </PressableScale>
  );
}

/** A line under a field: what is wrong, or that it is fine. Mono, quiet. */
export function PosterStatus({
  children,
  tone = 'quiet',
}: {
  children: string;
  tone?: 'quiet' | 'good' | 'bad';
}) {
  const theme = useTheme();
  const { quiet } = usePoster();
  const color = tone === 'bad' ? theme.danger : tone === 'good' ? theme.success : quiet;
  return (
    <Text variant="posterLabel" style={[styles.status, { color }]} accessibilityLiveRegion="polite">
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wash: { transitionProperty: 'backgroundColor' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TapTarget,
    paddingHorizontal: POSTER_GUTTER - 8,
  },
  back: {
    width: TapTarget,
    height: TapTarget,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingLeft: 4,
  },
  backSpace: { width: 8 },
  headerRight: { marginLeft: 'auto' },
  dashes: { flex: 1, flexDirection: 'row', gap: 5, paddingRight: 8 },
  dash: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    transitionProperty: 'backgroundColor',
    transitionDuration: 300,
  },
  body: { flex: 1, paddingHorizontal: POSTER_GUTTER, paddingTop: 28 },
  bodyMiddle: { justifyContent: 'center', paddingTop: 0, paddingBottom: 40 },
  footer: { paddingHorizontal: POSTER_GUTTER, paddingTop: 12, paddingBottom: 12, gap: 4 },
  label: { marginBottom: 10 },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
  },
  bracket: { fontFamily: FontFamily.light, fontSize: 64, lineHeight: 74 },
  noteText: { flex: 1, textAlign: 'center' },
  button: {
    height: 56,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  link: { minHeight: TapTarget, alignItems: 'center', justifyContent: 'center' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  prefix: { marginRight: 2 },
  input: { flex: 1, paddingVertical: 14 },
  chip: {
    minHeight: 42,
    paddingHorizontal: 18,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  status: { marginTop: 10 },
});
