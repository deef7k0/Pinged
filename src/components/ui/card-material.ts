import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { Elevation, Palette, Radius, Spacing, type AccentRoles } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import { mix } from '@/lib/color';

/**
 * The review card's material, which every card in the app is made of.
 *
 * The owner's direction (2026-10-20): "make all the cards in the app with that
 * style of the review ones, with the same size and corner ratio and stuff.
 * Even the ones in the game page." The review card is `<LogCard>`: a flat
 * fill one step above the page, `Radius.review`'s corner, a 1dp hairline in
 * `border`, the card shadow, fifteen in and twelve between its parts. Those
 * five are here, once, and every card reads them — `<Card>`, the game page's
 * section cards (`<SectionCard>`, `<InfoCard>`), its titled cards
 * (`<Panel>`), the member's review card, the critics' card, the notices and
 * blocks screens draw for themselves.
 *
 * ## The fill follows the page
 *
 * On the app's own pages a card is `surface` — the owner's `#1B1F28` on their
 * `#14171C`. On a game's page, which is built from the game's own colours
 * (Material 3, seeded by its box art), a neutral blue-grey card would be the
 * one foreign object on a red or green page; there the card is the game's
 * dark tone instead — its `primaryContainer` at half brightness, the tone the
 * page's section cards and its review card already had — at the same corner,
 * edge, inset and shadow. Switch game colours off (Settings → Game colours)
 * and a game's page is the app's own room, so its cards are `surface` too.
 *
 * `border` is white at 7%, so the one edge reads on either fill.
 */
export type CardMaterial = {
  /** The card's fill. */
  fill: string;
  /** Its 1dp hairline. */
  edge: string;
};

export function useCardMaterial(): CardMaterial {
  const theme = useTheme();
  const accent = useAccent();
  return useMemo(() => cardMaterialFor(accent, theme), [accent, theme]);
}

/**
 * The same, from an accent in hand — for the screen that renders a game's
 * `<AccentProvider>` and so cannot read it (`useGameAccent`).
 */
export function cardMaterialFor(
  accent: AccentRoles,
  theme: { surface: string; border: string }
): CardMaterial {
  return {
    fill: accent.tonal ? mix(accent.m3.primaryContainer, Palette.shadowInk, 0.5) : theme.surface,
    edge: theme.border,
  };
}

/** Fifteen in — the reference's card inset, and the page margin. */
export const CARD_INSET = Spacing.x16;

/** Twelve between the blocks inside a card, as the review card stacks its three. */
export const CARD_GAP = Spacing.x12;

/**
 * The shape without the fill: the corner, the edge's width and the shadow.
 * Spread it and add `{ backgroundColor: fill, borderColor: edge }`.
 *
 * The shadow is on the same view as the fill: Android clips `elevation` with
 * `overflow: 'hidden'`, so a card that must clip its contents (art to its
 * corner) clips on an inner view, as `<Card>` does.
 */
export const cardShape = StyleSheet.create({
  shape: {
    borderRadius: Radius.review,
    borderWidth: 1,
    ...Elevation.card,
  },
}).shape;
