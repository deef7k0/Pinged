import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BackHandler } from 'react-native';

import {
  AnimatedStep,
  ColoursStep,
  CompanyStep,
  FavouritesStep,
  GenresStep,
  HandleStep,
  HereStep,
  HoldingStep,
  NameStep,
  NotifyStep,
  PhotoStep,
  PicksStep,
  PlatformsStep,
  SteamStep,
  WelcomeStep,
  type ChosenFavourite,
} from '@/components/onboarding/onboarding-steps';
import { PosterPage } from '@/components/onboarding/poster-kit';
import type { PosterKey } from '@/constants/poster';
import { useTheme } from '@/hooks/use-theme';
import type { Game } from '@/lib/games';
import {
  EMPTY_ANSWERS,
  onboardingSteps,
  type OnboardingAnswers,
  type OnboardingStep,
} from '@/lib/onboarding';
import { remindersAvailable } from '@/lib/reminders';
import { useAuth } from '@/store/auth';
import {
  clearResume,
  finishOnboarding,
  readResume,
  saveResume,
  useOnboarding,
} from '@/store/onboarding';
import { Loader } from '@/components/ui/loader';

/**
 * Whether linking Steam would import anything yet.
 *
 * Linking works; importing needs a Steam Web API key on the project, and there
 * is none (PRODUCT.md, open decisions). Until there is, "bring your library."
 * would bring nothing, so the page is not shown. Set this when the key is set.
 */
const STEAM_IMPORT_READY = false;

/** The page colour of each step: black asks about you, a colour asks for access. */
const POSTER_OF: Partial<Record<OnboardingStep, PosterKey>> = {
  notify: 'cobalt',
  steam: 'pink',
  picks: 'red',
};

type Flow = {
  index: number;
  name: string;
  answers: OnboardingAnswers;
  favourites: ChosenFavourite[];
};

/**
 * Onboarding, signed in — the owner's reference (2026-10-15).
 *
 * Fourteen steps at most (`onboardingSteps`): a name, a welcome, four
 * questions about how somebody plays, their favourite games, how the app
 * should look — game colours and animated covers, each shown on real games
 * before it is asked — notifications, Steam, a photo, a handle, and six games
 * to start with. The root layout routes here
 * and nowhere else until `store/onboarding` says the account is done, so there
 * is no way past it but through it — every step but the handle can be skipped.
 *
 * ## One page, a step inside it
 *
 * The page is mounted once and the step swaps inside it (`bare`), which is
 * what lets the colour wash from black to cobalt and back. Each step is keyed,
 * so its headline types afresh.
 *
 * ## Closed halfway
 *
 * Where the flow is, what was answered and which favourites were picked are
 * kept on the device as it goes (`saveResume`), and read back when it opens.
 * They are deleted when it finishes: the answers only ever chose six games.
 */
export default function OnboardingScreen() {
  const userId = useAuth((state) => state.session?.user.id ?? null);
  const status = useOnboarding((state) => state.status);

  if (!userId || status === 'unknown') {
    return (
      <PosterPage bare>
        <Holding />
      </PosterPage>
    );
  }

  return <OnboardingFlow key={userId} userId={userId} />;
}

function Holding() {
  const theme = useTheme();
  return (
    <HoldingStep>
      <Loader color={theme.textMuted} />
    </HoldingStep>
  );
}

function OnboardingFlow({ userId }: { userId: string }) {
  const metadata = useAuth((state) => state.session?.user.user_metadata);
  const profileName = useAuth((state) => state.profile?.display_name);
  const steps = useMemo(
    () => onboardingSteps({ notifications: remindersAvailable, steam: STEAM_IMPORT_READY }),
    []
  );

  const [flow, setFlow] = useState<Flow | null>(null);
  /* Whole games for the favourites step's slots. Not kept on the device: a
     resumed flow shows the slots empty and still knows what was saved. */
  const [picked, setPicked] = useState<Game[]>([]);

  useEffect(() => {
    let live = true;
    void readResume(userId).then((saved) => {
      if (!live) return;
      const initialName =
        profileName ??
        (typeof metadata?.full_name === 'string' ? metadata.full_name : null) ??
        (typeof metadata?.name === 'string' ? metadata.name : null) ??
        '';
      const index = saved ? Math.max(0, steps.indexOf(saved.step as OnboardingStep)) : 0;
      setFlow({
        index,
        name: saved?.name ?? initialName,
        answers: saved?.answers ?? EMPTY_ANSWERS,
        favourites: saved?.favourites ?? [],
      });
    });
    return () => {
      live = false;
    };
    // Read once, on open; the name sources only seed the first step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, steps]);

  const go = useCallback(
    (next: Flow) => {
      setFlow(next);
      saveResume(userId, {
        step: steps[next.index],
        name: next.name,
        answers: next.answers,
        favourites: next.favourites,
      });
    },
    [steps, userId]
  );

  const back = useCallback((): boolean => {
    if (!flow || flow.index === 0) return false;
    go({ ...flow, index: flow.index - 1 });
    return true;
  }, [flow, go]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', back);
      return () => subscription.remove();
    }, [back])
  );

  if (!flow) {
    return (
      <PosterPage bare>
        <Holding />
      </PosterPage>
    );
  }

  const step = steps[flow.index];
  const next = (patch: Partial<Flow> = {}) =>
    go({ ...flow, ...patch, index: Math.min(flow.index + 1, steps.length - 1) });
  const setAnswers = (answers: OnboardingAnswers) => setFlow({ ...flow, answers });

  function finish(destination: 'home' | 'search' | { review: ChosenFavourite }) {
    clearResume(userId);
    finishOnboarding(
      destination === 'home'
        ? null
        : destination === 'search'
          ? '/search'
          : { pathname: '/log/[id]', params: { id: destination.review.id } }
    );
  }

  const body = (() => {
    switch (step) {
      case 'name':
        return <NameStep userId={userId} initial={flow.name} onDone={(name) => next({ name })} />;
      case 'welcome':
        return <WelcomeStep name={flow.name} onNext={() => next()} />;
      case 'here':
        return <HereStep answers={flow.answers} onChange={setAnswers} onNext={() => next()} />;
      case 'platforms':
        return <PlatformsStep answers={flow.answers} onChange={setAnswers} onNext={() => next()} />;
      case 'genres':
        return <GenresStep answers={flow.answers} onChange={setAnswers} onNext={() => next()} />;
      case 'company':
        return <CompanyStep answers={flow.answers} onChange={setAnswers} onNext={() => next()} />;
      case 'favourites':
        return (
          <FavouritesStep
            userId={userId}
            chosen={picked}
            onChange={setPicked}
            onNext={(saved) =>
              next({
                favourites: saved
                  ? picked.map((game) => ({
                      id: game.id,
                      sourceId: game.sourceId,
                      title: game.title,
                    }))
                  : flow.favourites,
              })
            }
          />
        );
      case 'colours':
        return <ColoursStep onNext={() => next()} />;
      case 'animated':
        return <AnimatedStep onNext={() => next()} />;
      case 'notify':
        return <NotifyStep onNext={() => next()} />;
      case 'steam':
        return <SteamStep userId={userId} onNext={() => next()} />;
      case 'photo':
        return <PhotoStep userId={userId} onNext={() => next()} />;
      case 'handle':
        return (
          <HandleStep userId={userId} suggestion={handleFrom(flow.name)} onNext={() => next()} />
        );
      case 'picks':
        return (
          <PicksStep
            userId={userId}
            answers={flow.answers}
            favourites={flow.favourites}
            onFinish={finish}
          />
        );
    }
  })();

  return (
    <PosterPage
      bare
      poster={POSTER_OF[step] ?? 'night'}
      onBack={flow.index > 0 ? () => back() : undefined}
      progress={{ index: flow.index, count: steps.length }}>
      <StepFrame key={step}>{body}</StepFrame>
    </PosterPage>
  );
}

/** Keys the step, so each one mounts — and types its headline — afresh. */
function StepFrame({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/** A first guess at a handle, from the name: "Ana Lucía" → "analucia". */
function handleFrom(name: string): string {
  const guess = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20);
  return guess.length >= 3 ? guess : '';
}
