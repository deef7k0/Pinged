import { useSyncExternalStore } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * A number that changes each time the app is *opened* — what "Games for you"
 * keys its round on (`lib/games/recommend-rules`).
 *
 * A cold start is a new round. So is coming back to the app after
 * `AWAY_MS` in the background: Android keeps an app's process for hours, and
 * reopening it from the launcher is opening the app to the person doing it,
 * whatever the process thinks. A glance at another app and back is not — the
 * band does not reshuffle because a notification was read. Pull to refresh on
 * Home starts one too (`startNewRound`).
 */

const AWAY_MS = 15 * 60_000;

let round = Date.now();
let leftAt: number | null = null;
let listening = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

/** Starts a new round now. */
export function startNewRound() {
  round = Math.max(Date.now(), round + 1);
  notify();
}

function onAppState(state: AppStateStatus) {
  if (state === 'active') {
    if (leftAt !== null && Date.now() - leftAt >= AWAY_MS) startNewRound();
    leftAt = null;
  } else if (leftAt === null) {
    leftAt = Date.now();
  }
}

function subscribe(listener: () => void) {
  if (!listening) {
    listening = true;
    AppState.addEventListener('change', onAppState);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getRound = () => round;

export function useAppRound(): number {
  return useSyncExternalStore(subscribe, getRound, getRound);
}
