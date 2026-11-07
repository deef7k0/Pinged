import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';

import {
  BracketNote,
  PosterBody,
  PosterButton,
  PosterField,
  PosterLink,
  PosterPage,
  PosterStatus,
  Reveal,
} from '@/components/onboarding/poster-kit';
import { TypedText } from '@/components/onboarding/typed-text';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Typeface, TapTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { INTRO_LINES, MIN_PASSWORD_LENGTH, typingDuration } from '@/lib/onboarding';
import { signInWithProvider, type OAuthProvider } from '@/lib/oauth';
import { useAuth } from '@/store/auth';
import { Loader } from '@/components/ui/loader';
import { DarkRoom } from '@/hooks/use-accent';

/** Longest a page waits for its headline before showing what is under it. */
const REVEAL_CAP_MS = 900;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Phase =
  | { kind: 'intro'; line: number }
  | { kind: 'email' }
  | { kind: 'password'; mode: 'log-in' | 'create' }
  | { kind: 'inbox' };

/**
 * What a signed-out reader opens the app to — the owner's reference
 * (2026-10-15), in the voice they chose for it (flirty, as the reference is).
 *
 * ## Four lines, then the email, then a password
 *
 * The pitch is four lines typed out on black, one at a time (`INTRO_LINES`).
 * **Nothing moves on by itself** — the owner's direction: "dont advance
 * automatically, wait for the user to tap the screen". A tap anywhere finishes
 * the line being typed; the next moves on, and "tap to continue" appears under
 * a line once it has typed. (It also keeps clear of WCAG 2.2.2: nothing here
 * replaces itself on a timer.)
 *
 * Then the reference's sign-in: one field for an email, and the other ways in
 * as two round marks under "or". **The owner kept passwords** (it was offered
 * a code sent by email instead), and a password cannot tell a sign-in from a
 * sign-up by the address alone — so the email leads to a password page that
 * logs in, with one line under it that turns it into "pick a password." for
 * somebody new. A failed log-in points at that line.
 *
 * Signing up asks for nothing else. The handle, the name, the photo and the
 * rest are onboarding's (`app/onboarding.tsx`), once there is a session —
 * IGDB, which half those steps need, only answers a signed-in caller.
 *
 * ## Email confirmation
 *
 * With confirmation on (Supabase's default), signing up returns no session:
 * the flow ends on "check your inbox." and the first sign-in after the link is
 * where onboarding begins.
 *
 * This one route replaces `welcome`, `sign-in-options`, `sign-in` and
 * `sign-up`, which were four screens in the app's own controls.
 */
function WelcomeScreen() {
  const [phase, setPhase] = useState<Phase>({ kind: 'intro', line: 0 });
  const [email, setEmail] = useState('');

  const back = useCallback((): boolean => {
    if (phase.kind === 'password' || phase.kind === 'inbox') {
      setPhase({ kind: 'email' });
      return true;
    }
    if (phase.kind === 'email') {
      setPhase({ kind: 'intro', line: INTRO_LINES.length - 1 });
      return true;
    }
    if (phase.kind === 'intro' && phase.line > 0) {
      setPhase({ kind: 'intro', line: phase.line - 1 });
      return true;
    }
    return false;
  }, [phase]);

  /* Android's back walks the flow backwards before it leaves the app. */
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', back);
      return () => subscription.remove();
    }, [back])
  );

  if (phase.kind === 'intro') {
    return (
      <Intro
        key={phase.line}
        line={phase.line}
        onNext={() =>
          setPhase(
            phase.line + 1 < INTRO_LINES.length
              ? { kind: 'intro', line: phase.line + 1 }
              : { kind: 'email' }
          )
        }
        onSkip={() => setPhase({ kind: 'email' })}
      />
    );
  }

  if (phase.kind === 'email') {
    return (
      <EmailStep
        email={email}
        onChangeEmail={setEmail}
        onBack={() => back()}
        onContinue={() => setPhase({ kind: 'password', mode: 'log-in' })}
      />
    );
  }

  if (phase.kind === 'password') {
    return (
      <PasswordStep
        key={phase.mode}
        email={email}
        mode={phase.mode}
        onBack={() => back()}
        onSwitch={() =>
          setPhase({ kind: 'password', mode: phase.mode === 'log-in' ? 'create' : 'log-in' })
        }
        onNeedsConfirm={() => setPhase({ kind: 'inbox' })}
      />
    );
  }

  return (
    <PosterPage
      onBack={() => back()}
      align="middle"
      footer={
        <PosterButton
          title="Log in"
          onPress={() => setPhase({ kind: 'password', mode: 'log-in' })}
        />
      }>
      <TypedText text="check your inbox." />
      <Reveal after={REVEAL_CAP_MS}>
        <BracketNote>{`we sent a link to ${email.trim()}. open it, then come back and log in`}</BracketNote>
      </Reveal>
    </PosterPage>
  );
}

/* -------------------------------------------------------------------------
 * The pitch
 * ---------------------------------------------------------------------- */

function Intro({ line, onNext, onSkip }: { line: number; onNext: () => void; onSkip: () => void }) {
  const [typed, setTyped] = useState(false);
  const [hurried, setHurried] = useState(false);
  const text = INTRO_LINES[line];
  const onDone = useCallback(() => setTyped(true), []);

  /* Nothing moves on by itself — the owner's direction: "wait for the user to
     tap the screen". The first tap finishes a line still typing; the next one
     moves on. */
  function tap() {
    if (!typed) setHurried(true);
    else onNext();
  }

  return (
    <PosterPage
      bare
      headerRight={
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Skip to log in"
          onPress={onSkip}
          scaleTo={0.95}
          style={styles.skip}>
          <Text variant="posterLabel" color="textMuted">
            skip
          </Text>
        </PressableScale>
      }>
      {/* The whole page is the button, not the line: a tap anywhere is the
          gesture, as it is in the reference. */}
      <Pressable
        onPress={tap}
        style={styles.flex}
        accessibilityRole="button"
        accessibilityLabel={text}
        accessibilityHint={typed ? 'Next' : 'Shows the whole line'}>
        <PosterBody align="middle">
          <TypedText text={text} complete={hurried} onDone={onDone} />
        </PosterBody>
        <View style={styles.hint}>
          {typed ? (
            <Reveal>
              <Text variant="posterLabel" color="textMuted">
                tap to continue
              </Text>
            </Reveal>
          ) : null}
        </View>
      </Pressable>
    </PosterPage>
  );
}

/* -------------------------------------------------------------------------
 * The email
 * ---------------------------------------------------------------------- */

function EmailStep({
  email,
  onChangeEmail,
  onBack,
  onContinue,
}: {
  email: string;
  onChangeEmail: (value: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const theme = useTheme();
  const [busy, setBusy] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const valid = EMAIL.test(email.trim());
  const headline = "what's your email?";

  async function provider(which: OAuthProvider) {
    setError(null);
    setBusy(which);
    try {
      /* The root layout's guard takes over once the session lands. */
      await signInWithProvider(which);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That did not work. Try again?');
    } finally {
      setBusy(null);
    }
  }

  return (
    <PosterPage
      onBack={onBack}
      headerRight={
        <Text variant="posterLabel" style={styles.wordmark} accessibilityRole="header">
          GAMELOG
        </Text>
      }>
      <TypedText text={headline} />
      <Reveal after={Math.min(typingDuration(headline), REVEAL_CAP_MS)}>
        <View style={styles.form}>
          <PosterField
            value={email}
            onChangeText={onChangeEmail}
            placeholder="Email address"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => valid && onContinue()}
            accessibilityLabel="Email address"
          />
          <PosterButton title="Continue" disabled={!valid} onPress={onContinue} />

          <View
            style={styles.or}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants">
            <View style={[styles.rule, { backgroundColor: theme.onboardingEdge }]} />
            <Text variant="posterLabel" color="textMuted">
              or
            </Text>
            <View style={[styles.rule, { backgroundColor: theme.onboardingEdge }]} />
          </View>

          <View style={styles.providers}>
            <ProviderMark
              icon="logo-google"
              label="Continue with Google"
              busy={busy === 'google'}
              disabled={busy !== null}
              onPress={() => provider('google')}
            />
            <ProviderMark
              icon="logo-facebook"
              label="Continue with Facebook"
              /* Facebook's own blue: its brand guidance asks for the mark in it. */
              tint="#1877F2"
              busy={busy === 'facebook'}
              disabled={busy !== null}
              onPress={() => provider('facebook')}
            />
          </View>

          {error ? <PosterStatus tone="bad">{error}</PosterStatus> : null}
          {/* Google and Facebook make an account on the first press. */}
          <AgreementNote action="continuing with Google or Facebook" />
        </View>
      </Reveal>
    </PosterPage>
  );
}

/**
 * What making an account agrees to, with the two documents a tap away — the
 * user-generated content policy's "accept the terms before posting". Both open
 * signed out (`legal/[doc]` is outside the guards).
 */
function AgreementNote({ action }: { action: string }) {
  const router = useRouter();
  const open = (doc: 'terms' | 'privacy') =>
    router.push({ pathname: '/legal/[doc]', params: { doc } });

  return (
    <Text variant="caption" color="textMuted" style={styles.agreement}>
      {`By ${action} you agree to Pinged’s `}
      <Text
        variant="caption"
        color="textSecondary"
        style={styles.agreementLink}
        accessibilityRole="link"
        onPress={() => open('terms')}>
        Terms of use
      </Text>
      {' and '}
      <Text
        variant="caption"
        color="textSecondary"
        style={styles.agreementLink}
        accessibilityRole="link"
        onPress={() => open('privacy')}>
        Privacy policy
      </Text>
      .
    </Text>
  );
}

/**
 * Another company's way in, as a round mark — the reference's. The glyph is
 * the brand's; the disc is the room's, so the two read as doors out rather
 * than as GameLog features.
 */
function ProviderMark({
  icon,
  label,
  tint,
  busy,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tint?: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      scaleTo={0.92}
      style={StyleSheet.flatten([
        styles.mark,
        { backgroundColor: theme.onboardingField, borderColor: theme.onboardingEdge },
        disabled && !busy && styles.dimmed,
      ])}>
      {busy ? (
        <Loader color={theme.text} />
      ) : (
        <Ionicons name={icon} size={22} color={tint ?? theme.text} />
      )}
    </PressableScale>
  );
}

/* -------------------------------------------------------------------------
 * The password
 * ---------------------------------------------------------------------- */

function PasswordStep({
  email,
  mode,
  onBack,
  onSwitch,
  onNeedsConfirm,
}: {
  email: string;
  mode: 'log-in' | 'create';
  onBack: () => void;
  onSwitch: () => void;
  onNeedsConfirm: () => void;
}) {
  const theme = useTheme();
  const signIn = useAuth((state) => state.signIn);
  const signUp = useAuth((state) => state.signUp);
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const creating = mode === 'create';
  const headline = creating ? 'pick a password.' : 'your password.';
  const longEnough = password.length >= (creating ? MIN_PASSWORD_LENGTH : 1);

  async function submit() {
    if (!longEnough || busy) return;
    setError(null);
    setBusy(true);
    try {
      if (creating) {
        const { needsEmailConfirm } = await signUp(email, password);
        if (needsEmailConfirm) onNeedsConfirm();
      } else {
        await signIn(email, password);
      }
      /* With a session, the root layout's guard takes over. */
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '';
      if (!creating && /invalid login credentials/i.test(message)) {
        setError("that doesn't match. new here? make an account below.");
      } else if (creating && /already registered/i.test(message)) {
        setError('that email already has an account. log in instead?');
      } else {
        setError(message.toLowerCase() || 'that did not work. try again?');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <PosterPage
      onBack={onBack}
      footer={
        <>
          <PosterButton
            title={creating ? 'Make my account' : 'Log in'}
            disabled={!longEnough}
            busy={busy}
            onPress={submit}
          />
          <PosterLink
            title={creating ? 'Have an account? Log in' : 'New here? Make an account'}
            onPress={onSwitch}
            disabled={busy}
          />
          {creating && <AgreementNote action="making an account" />}
        </>
      }>
      <TypedText text={headline} />
      <Reveal after={Math.min(typingDuration(headline), REVEAL_CAP_MS)}>
        <View style={styles.form}>
          <Text variant="posterLabel" color="textMuted" numberOfLines={1}>
            {email.trim()}
          </Text>
          <PosterField
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry={!visible}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete={creating ? 'new-password' : 'current-password'}
            textContentType={creating ? 'newPassword' : 'password'}
            returnKeyType="go"
            onSubmitEditing={submit}
            autoFocus
            invalid={error !== null}
            accessibilityLabel="Password"
            trailing={
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={visible ? 'Hide password' : 'Show password'}
                onPress={() => setVisible((current) => !current)}
                scaleTo={0.9}
                style={styles.eye}>
                <Ionicons
                  name={visible ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.textMuted}
                />
              </PressableScale>
            }
          />
          {error ? (
            <PosterStatus tone="bad">{error}</PosterStatus>
          ) : (
            <BracketNote>
              {creating
                ? `at least ${MIN_PASSWORD_LENGTH} characters. make it a good one`
                : 'the one you made when you joined'}
            </BracketNote>
          )}
        </View>
      </Reveal>
    </PosterPage>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  /* Where "tap to continue" appears, reserved from the start so the line above
     does not move when it does. */
  hint: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  skip: {
    minHeight: TapTarget,
    minWidth: TapTarget,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  wordmark: { letterSpacing: 2, fontFamily: Typeface.extraBold, fontSize: 14 },
  form: { marginTop: 24, gap: 14 },
  or: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 6 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  providers: { flexDirection: 'row', justifyContent: 'center', gap: 32 },
  mark: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmed: { opacity: 0.45 },
  eye: { width: TapTarget, height: TapTarget, alignItems: 'flex-end', justifyContent: 'center' },
  agreement: { textAlign: 'center' },
  agreementLink: { textDecorationLine: 'underline' },
});

/** A game's room: dark in either setting (Settings → Appearance). */
export default function WelcomeScreenRoute() {
  return (
    <DarkRoom>
      <WelcomeScreen />
    </DarkRoom>
  );
}
