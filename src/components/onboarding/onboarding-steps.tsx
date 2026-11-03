import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import {
  BracketNote,
  POSTER_GUTTER,
  PosterBody,
  PosterButton,
  PosterChip,
  PosterField,
  PosterFooter,
  PosterLabel,
  PosterLink,
  PosterStatus,
  Reveal,
  usePoster,
} from '@/components/onboarding/poster-kit';
import {
  ExamplePager,
  GamePagePreview,
  SurprisePreview,
} from '@/components/onboarding/look-previews';
import { TypedText } from '@/components/onboarding/typed-text';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { sortGenresByReach } from '@/constants/game-genres';
import { PosterAspectRatio, Radius, withAlpha } from '@/constants/theme';
import { useAnimatedArtwork } from '@/hooks/use-animated-artwork';
import { useGameColours } from '@/hooks/use-game-colours';
import { useTheme } from '@/hooks/use-theme';
import {
  addToList,
  claimUsername,
  getOrCreateSingletonList,
  isUsernameFree,
  setProgress,
  updateProfile,
  uploadImage,
} from '@/lib/api';
import { getGenres, type Game } from '@/lib/games';
import { getNextEvent } from '@/lib/games/browse';
import { searchWholeGames } from '@/lib/games/igdb';
import { getExampleGames, getOnboardingPicks, getPickingGrid } from '@/lib/games/onboarding-picks';
import {
  ANIMATED_EXAMPLES,
  COLOUR_EXAMPLES,
  COMPANY_OPTIONS,
  FAVOURITE_LIMIT,
  HERE_FOR_OPTIONS,
  PLATFORM_OPTIONS,
  afterPicks,
  handleProblem,
  normaliseHandle,
  typingDuration,
  type OnboardingAnswers,
} from '@/lib/onboarding';
import { REMINDER_LEAD_MINUTES, requestReminderPermission } from '@/lib/reminders';
import { requireProvider } from '@/lib/gaming/registry';
import { useAuth } from '@/store/auth';

/** Longest a page waits for its headline before showing what is under it. */
const REVEAL_CAP_MS = 900;

/** Covers across, in the favourites grid and on the last page. */
const GRID_COLUMNS = 3;
const GRID_GAP = 10;

function revealAfter(headline: string): number {
  return Math.min(typingDuration(headline), REVEAL_CAP_MS);
}

/** The mono instruction and the typed headline — the head of every page. */
function Head({ label, headline }: { label?: string; headline: string }) {
  return (
    <View>
      {label ? (
        <Reveal>
          <PosterLabel>{label}</PosterLabel>
        </Reveal>
      ) : null}
      <TypedText text={headline} maxFontSizeMultiplier={1.3} />
    </View>
  );
}

/** A favourite as the flow carries it: enough to resume and to finish. */
export type ChosenFavourite = { id: string; sourceId: string; title: string };

/* -------------------------------------------------------------------------
 * name
 * ---------------------------------------------------------------------- */

export function NameStep({
  userId,
  initial,
  onDone,
}: {
  userId: string;
  initial: string;
  onDone: (name: string) => void;
}) {
  const refreshProfile = useAuth((state) => state.refreshProfile);
  const queryClient = useQueryClient();
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headline = 'what should we call you?';
  const trimmed = name.trim();

  async function next() {
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await updateProfile(userId, { display_name: trimmed.slice(0, 40) });
      void refreshProfile();
      void queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      onDone(trimmed);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message.toLowerCase() : 'that did not save');
      setBusy(false);
    }
  }

  return (
    <>
      <PosterBody>
        <Head headline={headline} />
        <Reveal after={revealAfter(headline)}>
          <View style={styles.form}>
            <PosterField
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              maxLength={40}
              returnKeyType="next"
              onSubmitEditing={next}
              accessibilityLabel="Your name"
            />
            {error ? (
              <PosterStatus tone="bad">{error}</PosterStatus>
            ) : (
              <BracketNote>{"we've been calling you gorgeous. we can stop."}</BracketNote>
            )}
          </View>
        </Reveal>
      </PosterBody>
      <PosterFooter>
        <PosterButton title="Continue" disabled={!trimmed} busy={busy} onPress={next} />
      </PosterFooter>
    </>
  );
}

/* -------------------------------------------------------------------------
 * welcome
 * ---------------------------------------------------------------------- */

export function WelcomeStep({ name, onNext }: { name: string; onNext: () => void }) {
  const first = name.trim().split(/\s+/)[0] ?? '';
  return (
    <>
      <PosterBody align="middle">
        <Head label={first ? `welcome, ${first}` : 'welcome'} headline="let's get playing." />
      </PosterBody>
      <PosterFooter>
        <Reveal after={revealAfter("let's get playing.")}>
          <PosterButton title="Let's do it" onPress={onNext} />
        </Reveal>
      </PosterFooter>
    </>
  );
}

/* -------------------------------------------------------------------------
 * the choices: here, platforms, genres, company
 * ---------------------------------------------------------------------- */

type Option = { key: string; label: string };

function ChoiceStep({
  headline,
  options,
  selected,
  multiple,
  onToggle,
  onNext,
  loading,
  failed,
}: {
  headline: string;
  options: readonly Option[];
  selected: readonly string[];
  multiple: boolean;
  onToggle: (key: string) => void;
  onNext: () => void;
  loading?: boolean;
  failed?: boolean;
}) {
  return (
    <>
      <PosterBody>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <Head label={multiple ? 'choose any' : 'choose one'} headline={headline} />
          <Reveal after={revealAfter(headline)}>
            {loading ? (
              <PosterStatus>loading…</PosterStatus>
            ) : failed ? (
              <PosterStatus>could not load these. you can skip this one.</PosterStatus>
            ) : (
              <View style={styles.chips} accessibilityRole={multiple ? undefined : 'radiogroup'}>
                {options.map((option) => (
                  <PosterChip
                    key={option.key}
                    label={option.label}
                    multiple={multiple}
                    selected={selected.includes(option.key)}
                    onPress={() => onToggle(option.key)}
                  />
                ))}
              </View>
            )}
          </Reveal>
        </ScrollView>
      </PosterBody>
      <PosterFooter>
        {/* "choose one" waits for a choice, as the reference's does; "choose
            any" can be left empty — nothing ticked is no filter at all. */}
        <PosterButton
          title={multiple && selected.length === 0 ? 'Skip' : 'Continue'}
          disabled={!multiple && selected.length === 0 && !failed}
          onPress={onNext}
        />
      </PosterFooter>
    </>
  );
}

function toggle(list: readonly string[], key: string, multiple: boolean): string[] {
  if (!multiple) return [key];
  return list.includes(key) ? list.filter((entry) => entry !== key) : [...list, key];
}

type AnswerStepProps = {
  answers: OnboardingAnswers;
  onChange: (answers: OnboardingAnswers) => void;
  onNext: () => void;
};

export function HereStep({ answers, onChange, onNext }: AnswerStepProps) {
  return (
    <ChoiceStep
      headline="what are you here for?"
      options={HERE_FOR_OPTIONS}
      selected={answers.hereFor ? [answers.hereFor] : []}
      multiple={false}
      onToggle={(key) =>
        onChange({ ...answers, hereFor: key as NonNullable<OnboardingAnswers['hereFor']> })
      }
      onNext={onNext}
    />
  );
}

export function PlatformsStep({ answers, onChange, onNext }: AnswerStepProps) {
  return (
    <ChoiceStep
      headline="what do you play on?"
      options={PLATFORM_OPTIONS}
      selected={answers.platforms}
      multiple
      onToggle={(key) => onChange({ ...answers, platforms: toggle(answers.platforms, key, true) })}
      onNext={onNext}
    />
  );
}

/** How many genres the step offers: the ones people reach for, not all 23. */
const GENRE_COUNT = 15;

export function GenresStep({ answers, onChange, onNext }: AnswerStepProps) {
  /* The same request, under the same key, that Home's genre chip makes. */
  const genres = useQuery({
    queryKey: ['igdb', 'genres'],
    queryFn: ({ signal }) => getGenres(signal),
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const options = sortGenresByReach(genres.data ?? [])
    .slice(0, GENRE_COUNT)
    .map((genre) => ({ key: String(genre.id), label: genre.name.toLowerCase() }));
  const selected = answers.genres.map(String);

  return (
    <ChoiceStep
      headline="what gets you going?"
      options={options}
      selected={selected}
      multiple
      loading={genres.isPending}
      failed={genres.isLoadingError}
      onToggle={(key) => onChange({ ...answers, genres: toggle(selected, key, true).map(Number) })}
      onNext={onNext}
    />
  );
}

export function CompanyStep({ answers, onChange, onNext }: AnswerStepProps) {
  return (
    <ChoiceStep
      headline="solo, or with friends?"
      options={COMPANY_OPTIONS}
      selected={answers.company ? [answers.company] : []}
      multiple={false}
      onToggle={(key) =>
        onChange({ ...answers, company: key as NonNullable<OnboardingAnswers['company']> })
      }
      onNext={onNext}
    />
  );
}

/* -------------------------------------------------------------------------
 * favourites
 * ---------------------------------------------------------------------- */

function useGridWidth(): number {
  const { width } = useWindowDimensions();
  return Math.floor((width - POSTER_GUTTER * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
}

/** A typed search, settled: what was typed, once it stops changing. */
function useSettled(value: string, ms: number): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

export function FavouritesStep({
  userId,
  chosen,
  onChange,
  onNext,
}: {
  userId: string;
  chosen: readonly Game[];
  onChange: (games: Game[]) => void;
  /** `saved`: the picks were written to the profile, rather than skipped. */
  onNext: (saved: boolean) => void;
}) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const tile = useGridWidth();
  const [term, setTerm] = useState('');
  const settled = useSettled(term.trim(), 350);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headline = 'your favourite games.';

  const grid = useQuery({
    queryKey: ['onboarding-grid'],
    queryFn: ({ signal }) => getPickingGrid(signal),
    staleTime: 60 * 60_000,
  });
  const search = useQuery({
    queryKey: ['onboarding-search', settled],
    queryFn: ({ signal }) => searchWholeGames(settled, signal),
    enabled: settled.length >= 2,
    staleTime: 10 * 60_000,
  });

  const searching = settled.length >= 2;
  const games = (searching ? search.data : grid.data) ?? [];
  const pending = searching ? search.isPending : grid.isPending;
  const failed = searching ? search.isLoadingError : grid.isLoadingError;
  const full = chosen.length >= FAVOURITE_LIMIT;

  function pick(game: Game) {
    if (chosen.some((entry) => entry.id === game.id)) {
      onChange(chosen.filter((entry) => entry.id !== game.id));
    } else if (!full) {
      onChange([...chosen, game]);
    }
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const list = await getOrCreateSingletonList(userId, 'favorites');
      /* In order, so the profile shows them as they were picked. */
      for (const [position, game] of chosen.entries()) {
        await addToList(list.id, game, { position });
      }
      void queryClient.invalidateQueries({ queryKey: ['favorites'] });
      onNext(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message.toLowerCase() : 'those did not save');
      setBusy(false);
    }
  }

  return (
    <>
      <PosterBody>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Head label="up to four" headline={headline} />
          <Reveal after={revealAfter(headline)}>
            <View style={styles.form}>
              <Slots chosen={chosen} onRemove={pick} />
              <PosterField
                value={term}
                onChangeText={setTerm}
                placeholder="Search games"
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel="Search games"
                trailing={<Ionicons name="search" size={18} color={theme.textMuted} />}
              />
              {error ? <PosterStatus tone="bad">{error}</PosterStatus> : null}
              {pending ? (
                <PosterStatus>{searching ? 'searching…' : 'loading…'}</PosterStatus>
              ) : failed ? (
                <PosterStatus>could not reach the games. try searching again.</PosterStatus>
              ) : searching && games.length === 0 ? (
                <PosterStatus>{`nothing called "${settled}". try another word?`}</PosterStatus>
              ) : (
                <View style={styles.grid}>
                  {games.map((game) => {
                    const on = chosen.some((entry) => entry.id === game.id);
                    return (
                      <CoverChoice
                        key={game.id}
                        game={game}
                        width={tile}
                        selected={on}
                        disabled={full && !on}
                        onPress={() => pick(game)}
                      />
                    );
                  })}
                </View>
              )}
            </View>
          </Reveal>
        </ScrollView>
      </PosterBody>
      <PosterFooter>
        <PosterButton title="Continue" disabled={chosen.length === 0} busy={busy} onPress={save} />
        <PosterLink title="Not now" onPress={() => onNext(false)} disabled={busy} />
      </PosterFooter>
    </>
  );
}

/** The four places a favourite goes — the profile's row of four, in small. */
function Slots({ chosen, onRemove }: { chosen: readonly Game[]; onRemove: (game: Game) => void }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const slot = Math.floor(
    (width - POSTER_GUTTER * 2 - 8 * (FAVOURITE_LIMIT - 1)) / FAVOURITE_LIMIT
  );
  const height = Math.round(slot / PosterAspectRatio);

  return (
    <View style={styles.slots}>
      {Array.from({ length: FAVOURITE_LIMIT }, (_, index) => {
        const game = chosen[index];
        if (!game) {
          return (
            <View
              key={index}
              style={[styles.slot, { width: slot, height, borderColor: theme.onboardingEdge }]}
              accessibilityLabel={`Favourite ${index + 1}, empty`}
            />
          );
        }
        return (
          <PressableScale
            key={game.id}
            accessibilityRole="button"
            accessibilityLabel={`${game.title}, favourite ${index + 1}. Remove`}
            onPress={() => onRemove(game)}
            scaleTo={0.95}>
            <Poster
              coverUrl={game.coverUrl}
              heroUrl={game.heroUrl}
              title={game.title}
              width={slot}
            />
          </PressableScale>
        );
      })}
    </View>
  );
}

/** A cover that can be chosen: a check lands on it, and the rest stay as they are. */
function CoverChoice({
  game,
  width,
  selected,
  disabled = false,
  onPress,
}: {
  game: Game;
  width: number;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { ink, page } = usePoster();
  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={game.title}
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.96}
      style={StyleSheet.flatten([styles.cover, disabled && styles.coverOff])}>
      <Poster coverUrl={game.coverUrl} heroUrl={game.heroUrl} title={game.title} width={width} />
      {selected ? (
        <View style={[styles.check, { backgroundColor: ink }]}>
          <Ionicons name="checkmark" size={16} color={page} />
        </View>
      ) : null}
    </PressableScale>
  );
}

/* -------------------------------------------------------------------------
 * colours and animated — how the app looks, shown before it is asked
 * ---------------------------------------------------------------------- */

/** The examples' width: the page's column, between its two gutters. */
function useExampleWidth(): number {
  const { width } = useWindowDimensions();
  return Math.round(Math.min(width, 520) - POSTER_GUTTER * 2);
}

/**
 * Game colours — the owner's (2026-10-21): "When the user signs up, show
 * examples of the game page and ask if they want the expressive material
 * color or no color, with a button to switch on/off in real time."
 *
 * Three games' pages, drawn small in the roles the real page uses, swiped
 * between; under them the two choices as the onboarding's own pills. A press
 * writes the setting (`useGameColours`) and every example changes with it —
 * the switch *is* the preview. Settings → Game colours changes it later.
 */
export function ColoursStep({ onNext }: { onNext: () => void }) {
  const colours = useGameColours();
  const width = useExampleWidth();
  const headline = 'every game in its own colours.';
  const examples = useQuery({
    queryKey: ['onboarding-examples', 'colours'],
    queryFn: ({ signal }) => getExampleGames(COLOUR_EXAMPLES, signal),
    staleTime: Infinity,
  });

  return (
    <>
      <PosterBody>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <Head label="your call" headline={headline} />
          <Reveal after={revealAfter(headline)}>
            <BracketNote>a game’s page takes its colours from its box art. try both</BracketNote>
            <ExamplePager
              games={examples.data ?? []}
              width={width}
              loading={examples.isPending}
              render={(game) => <GamePagePreview game={game} width={width} />}
            />
            <View style={styles.chips} accessibilityRole="radiogroup">
              <PosterChip
                label="in colour"
                selected={colours.on}
                onPress={() => colours.setOn(true)}
              />
              <PosterChip
                label="no colour"
                selected={!colours.on}
                onPress={() => colours.setOn(false)}
              />
            </View>
          </Reveal>
        </ScrollView>
      </PosterBody>
      <PosterFooter>
        <PosterButton title="Continue" onPress={onNext} />
      </PosterFooter>
    </>
  );
}

/**
 * Animated artwork — the owner's (2026-10-21): "Same with animated artwork,
 * show an example of 2-3 games that are in SteamGridDB, preferably most known
 * games, and show it as a Surprise Me screen example."
 *
 * Three dealt cards, drawn small with Surprise Me's own art
 * (`<SurpriseCardArt>`): Hollow Knight's animated square, Portal 2's and
 * Cyberpunk 2077's animated portraits — only the one in view loads. The two
 * pills write the setting (`useAnimatedArtwork`) and the card in view starts
 * or stops at once. Settings → Animated artwork changes it later.
 */
export function AnimatedStep({ onNext }: { onNext: () => void }) {
  const artwork = useAnimatedArtwork();
  const width = useExampleWidth();
  const headline = 'some covers move.';
  const examples = useQuery({
    queryKey: ['onboarding-examples', 'animated'],
    queryFn: ({ signal }) => getExampleGames(ANIMATED_EXAMPLES, signal),
    staleTime: Infinity,
  });

  return (
    <>
      <PosterBody>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <Head label="your call" headline={headline} />
          <Reveal after={revealAfter(headline)}>
            <BracketNote>
              surprise me and reviews play a game’s animated cover. still saves data
            </BracketNote>
            <ExamplePager
              games={examples.data ?? []}
              width={width}
              loading={examples.isPending}
              render={(game, inView) => (
                <SurprisePreview game={game} width={width} inView={inView} />
              )}
            />
            <View style={styles.chips} accessibilityRole="radiogroup">
              <PosterChip
                label="animated"
                selected={artwork.on}
                onPress={() => artwork.setOn(true)}
              />
              <PosterChip
                label="still"
                selected={!artwork.on}
                onPress={() => artwork.setOn(false)}
              />
            </View>
          </Reveal>
        </ScrollView>
      </PosterBody>
      <PosterFooter>
        <PosterButton title="Continue" onPress={onNext} />
      </PosterFooter>
    </>
  );
}

/* -------------------------------------------------------------------------
 * notify — cobalt
 * ---------------------------------------------------------------------- */

export function NotifyStep({ onNext }: { onNext: () => void }) {
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => Date.now());
  const headline = 'be the first to know.';

  async function allow() {
    setBusy(true);
    await requestReminderPermission();
    onNext();
  }

  return (
    <>
      <SampleNotification now={now} />
      <PosterBody align="middle">
        <Head headline={headline} />
        <Reveal after={revealAfter(headline)}>
          <BracketNote>
            {`a nudge ${REMINDER_LEAD_MINUTES} minutes before the showcases you're watching`}
          </BracketNote>
        </Reveal>
      </PosterBody>
      <PosterFooter>
        <PosterButton title="Allow notifications" busy={busy} onPress={allow} />
        <PosterLink title="Not now" onPress={onNext} disabled={busy} />
      </PosterFooter>
    </>
  );
}

/**
 * What a reminder looks like, drawn over the page as the reference draws its
 * own — with the name of the next real showcase IGDB knows of, so the example
 * is not made up. Without one it names no event.
 */
function SampleNotification({ now }: { now: number }) {
  const theme = useTheme();
  const next = useQuery({
    queryKey: ['onboarding-next-event'],
    queryFn: ({ signal }) => getNextEvent(now, signal),
    staleTime: 60 * 60_000,
  });
  const name = next.data?.name;

  return (
    <Reveal after={500}>
      <View
        style={[styles.notification, { backgroundColor: theme.onboardingPage }]}
        accessibilityLabel="An example of a reminder">
        <Image
          source={require('@/assets/images/icon.png')}
          style={styles.notificationIcon}
          accessibilityIgnoresInvertColors
        />
        <View style={styles.notificationText}>
          <Text variant="itemTitle">Pinged</Text>
          <Text variant="bodySmall" color="textSecondary" numberOfLines={2}>
            {name
              ? `${name} starts in ${REMINDER_LEAD_MINUTES} minutes.`
              : `Your showcase starts in ${REMINDER_LEAD_MINUTES} minutes.`}
          </Text>
        </View>
      </View>
    </Reveal>
  );
}

/* -------------------------------------------------------------------------
 * steam — pink
 * ---------------------------------------------------------------------- */

export function SteamStep({ userId, onNext }: { userId: string; onNext: () => void }) {
  const { ink } = usePoster();
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headline = 'bring your library.';

  async function link() {
    setBusy(true);
    setError(null);
    const outcome = await requireProvider('steam').link({ userId });
    setBusy(false);
    if (outcome.ok) onNext();
    else if (outcome.reason !== 'cancelled') setError(outcome.message.toLowerCase());
  }

  return (
    <>
      <PosterBody>
        <Head headline={headline} />
        <Reveal after={revealAfter(headline)}>
          <BracketNote>your steam games and achievements, imported</BracketNote>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Link Steam"
            onPress={link}
            disabled={busy}
            scaleTo={0.98}
            style={StyleSheet.flatten([
              styles.provider,
              { backgroundColor: withAlpha(theme.text, 0.28) },
            ])}>
            <View style={[styles.providerMark, { backgroundColor: theme.text }]}>
              <Ionicons name="logo-steam" size={26} color={theme.onboardingPage} />
            </View>
            <View style={styles.providerText}>
              <Text variant="posterButton" style={{ color: ink }}>
                Steam
              </Text>
              <Text variant="posterLabel" style={{ color: ink }}>
                {busy ? 'opening steam…' : 'games + achievements'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={ink} />
          </PressableScale>
          {error ? <PosterStatus tone="bad">{error}</PosterStatus> : null}
        </Reveal>
      </PosterBody>
      <PosterFooter>
        <PosterLink title="Not now" onPress={onNext} disabled={busy} />
      </PosterFooter>
    </>
  );
}

/* -------------------------------------------------------------------------
 * photo
 * ---------------------------------------------------------------------- */

export function PhotoStep({ userId, onNext }: { userId: string; onNext: () => void }) {
  const theme = useTheme();
  const refreshProfile = useAuth((state) => state.refreshProfile);
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const size = Math.min(220, Math.round(width * 0.56));
  const [uri, setUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headline = 'make it yours.';

  async function choose() {
    setError(null);
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!picked.canceled && picked.assets[0]) setUri(picked.assets[0].uri);
  }

  async function next() {
    if (!uri) {
      onNext();
      return;
    }
    setBusy(true);
    try {
      const url = await uploadImage(userId, uri, 'avatars');
      await updateProfile(userId, { avatar_url: url });
      void refreshProfile();
      void queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      onNext();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message.toLowerCase() : 'that photo did not upload'
      );
      setBusy(false);
    }
  }

  return (
    <>
      <PosterBody>
        <Head headline={headline} />
        <Reveal after={revealAfter(headline)}>
          <View style={styles.avatarRow}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={uri ? 'Choose another photo' : 'Add a photo'}
              onPress={choose}
              scaleTo={0.97}
              style={StyleSheet.flatten([
                styles.avatar,
                {
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  backgroundColor: theme.onboardingField,
                  borderColor: theme.onboardingEdge,
                },
              ])}>
              {uri ? (
                <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" />
              ) : (
                <Ionicons name="person-outline" size={size * 0.36} color={theme.textMuted} />
              )}
            </PressableScale>
          </View>
          {error ? <PosterStatus tone="bad">{error}</PosterStatus> : null}
        </Reveal>
      </PosterBody>
      <PosterFooter>
        <PosterButton title="Continue" busy={busy} onPress={next} />
        <PosterLink
          title={uri ? 'Choose another' : 'Add a photo'}
          onPress={choose}
          disabled={busy}
        />
      </PosterFooter>
    </>
  );
}

/* -------------------------------------------------------------------------
 * handle
 * ---------------------------------------------------------------------- */

type Availability = 'idle' | 'checking' | 'free' | 'taken' | 'error';

export function HandleStep({
  userId,
  suggestion,
  onNext,
}: {
  userId: string;
  suggestion: string;
  onNext: () => void;
}) {
  const refreshProfile = useAuth((state) => state.refreshProfile);
  const queryClient = useQueryClient();
  const [value, setValue] = useState(suggestion);
  const handle = normaliseHandle(value);
  const problem = handleProblem(handle);
  const settled = useSettled(handle, 400);
  const [busy, setBusy] = useState(false);
  const [lost, setLost] = useState<string | null>(null);
  const headline = 'claim your handle.';

  const check = useQuery({
    queryKey: ['onboarding-handle', settled.toLowerCase()],
    queryFn: ({ signal }) => isUsernameFree(settled, signal),
    enabled: settled.length > 0 && handleProblem(settled) === null,
    staleTime: 30_000,
  });

  let availability: Availability = 'idle';
  if (handle.length > 0 && problem === null) {
    if (settled !== handle || check.isFetching) availability = 'checking';
    else if (check.isLoadingError) availability = 'error';
    else if (check.data === true && lost !== handle) availability = 'free';
    else if (check.data === false || lost === handle) availability = 'taken';
  }

  async function claim() {
    if (availability !== 'free' || busy) return;
    setBusy(true);
    try {
      const result = await claimUsername(userId, handle);
      if (result === 'taken') {
        setLost(handle);
        setBusy(false);
        return;
      }
      void refreshProfile();
      void queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      onNext();
    } catch {
      setBusy(false);
    }
  }

  return (
    <>
      <PosterBody>
        <Head headline={headline} />
        <Reveal after={revealAfter(headline)}>
          <View style={styles.form}>
            <PosterField
              value={value}
              onChangeText={(next) => setValue(normaliseHandle(next))}
              prefix="@"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              maxLength={24}
              returnKeyType="done"
              onSubmitEditing={claim}
              invalid={problem !== null || availability === 'taken'}
              accessibilityLabel="Handle"
            />
            {problem ? (
              <PosterStatus tone="bad">{problem}</PosterStatus>
            ) : availability === 'checking' ? (
              <PosterStatus>checking…</PosterStatus>
            ) : availability === 'free' ? (
              <PosterStatus tone="good">{`@${handle} is yours`}</PosterStatus>
            ) : availability === 'taken' ? (
              <PosterStatus tone="bad">taken. try another?</PosterStatus>
            ) : availability === 'error' ? (
              <PosterStatus tone="bad">could not check that one. try again?</PosterStatus>
            ) : null}
            <BracketNote>how your friends find you</BracketNote>
          </View>
        </Reveal>
      </PosterBody>
      <PosterFooter>
        <PosterButton
          title="Continue"
          disabled={availability !== 'free'}
          busy={busy}
          onPress={claim}
        />
      </PosterFooter>
    </>
  );
}

/* -------------------------------------------------------------------------
 * picks — red
 * ---------------------------------------------------------------------- */

export function PicksStep({
  userId,
  answers,
  favourites,
  onFinish,
}: {
  userId: string;
  answers: OnboardingAnswers;
  favourites: readonly ChosenFavourite[];
  onFinish: (destination: 'home' | 'search' | { review: ChosenFavourite }) => void;
}) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const tile = useGridWidth();
  const [saved, setSaved] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const headline = "you'll like these.";
  const favouriteIds = favourites.map((entry) => Number(entry.sourceId)).filter(Number.isFinite);

  const picks = useQuery({
    queryKey: ['onboarding-picks', userId, answers, favouriteIds],
    queryFn: ({ signal }) => getOnboardingPicks(answers, favouriteIds, signal),
    staleTime: Infinity,
    retry: 1,
  });

  const destination = afterPicks(answers.hereFor);
  const firstFavourite = favourites[0];
  const title =
    destination === 'review' && firstFavourite
      ? `Review ${firstFavourite.title}`
      : destination === 'search'
        ? 'Start exploring'
        : "Let's go";

  function flip(id: string) {
    setSaved((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );
  }

  async function finish() {
    setBusy(true);
    const games = (picks.data ?? []).filter((game) => saved.includes(game.id));
    /* Each one is a "Want to play" log. One failing does not hold up the rest,
       or the flow: they are a head start, not a requirement. */
    await Promise.allSettled(games.map((game) => setProgress(userId, game, { status: 'backlog' })));
    if (games.length > 0) {
      void queryClient.invalidateQueries({ queryKey: ['user-logs', userId] });
      void queryClient.invalidateQueries({ queryKey: ['profile-stats', userId] });
    }
    onFinish(
      destination === 'review' && firstFavourite
        ? { review: firstFavourite }
        : destination === 'search'
          ? 'search'
          : 'home'
    );
  }

  return (
    <>
      <PosterBody>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <Head label="tap to save them for later" headline={headline} />
          <Reveal after={revealAfter(headline)}>
            <View style={[styles.grid, styles.picks]}>
              {picks.isPending || picks.isLoadingError
                ? Array.from({ length: 6 }, (_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.placeholder,
                        {
                          width: tile,
                          height: Math.round(tile / PosterAspectRatio),
                          backgroundColor: withAlpha(theme.posterRedInk, 0.14),
                        },
                      ]}
                    />
                  ))
                : (picks.data ?? []).map((game) => (
                    <CoverChoice
                      key={game.id}
                      game={game}
                      width={tile}
                      selected={saved.includes(game.id)}
                      onPress={() => flip(game.id)}
                    />
                  ))}
            </View>
            {picks.isLoadingError ? (
              <PosterStatus>could not reach the games. you can find them in search.</PosterStatus>
            ) : null}
          </Reveal>
        </ScrollView>
      </PosterBody>
      <PosterFooter>
        <PosterButton title={title} busy={busy} onPress={finish} />
      </PosterFooter>
    </>
  );
}

/* -------------------------------------------------------------------------
 * A holding page while the flow works out where it is
 * ---------------------------------------------------------------------- */

export function HoldingStep({ children }: { children?: ReactNode }) {
  return <PosterBody align="middle">{children}</PosterBody>;
}

const styles = StyleSheet.create({
  form: { marginTop: 24, gap: 14 },
  scroll: { flex: 1, marginHorizontal: -POSTER_GUTTER },
  scrollContent: { paddingHorizontal: POSTER_GUTTER, paddingBottom: 24 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 24 },
  slots: { flexDirection: 'row', gap: 8 },
  slot: { borderRadius: Radius.image, borderWidth: 1, borderStyle: 'dashed' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  picks: { marginTop: 24 },
  cover: { position: 'relative' },
  coverOff: { opacity: 0.4 },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: { borderRadius: Radius.image },
  notification: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: POSTER_GUTTER - 8,
    marginTop: 8,
    padding: 12,
    borderRadius: 18,
  },
  notificationIcon: { width: 40, height: 40, borderRadius: 9 },
  notificationText: { flex: 1, gap: 2 },
  provider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 24,
    padding: 14,
    borderRadius: 16,
  },
  providerMark: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerText: { flex: 1, gap: 2 },
  avatarRow: { alignItems: 'center', marginTop: 40 },
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1 },
});
