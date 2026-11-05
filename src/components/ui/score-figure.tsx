import { Image } from 'expo-image';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui/text';
import { labelFor, scoreColor } from '@/constants/score';
import { SHOW_SCORE_FIGURES, figureFor, type ScoreFigureKey } from '@/constants/score-figure';
import { Typeface, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/*
 * The five drawings, each as its layers: one colour on a transparent ground,
 * tinted here. `scripts/score-figures.mjs` draws them and says how; the empty
 * chair has no man in it and so no ink.
 */
const LAYERS: Record<ScoreFigureKey, { tone: number; ink: number | null }> = {
  gone: { tone: require('@/assets/images/scores/gone-tone.png'), ink: null },
  asleep: {
    tone: require('@/assets/images/scores/asleep-tone.png'),
    ink: require('@/assets/images/scores/asleep-ink.png'),
  },
  seated: {
    tone: require('@/assets/images/scores/seated-tone.png'),
    ink: require('@/assets/images/scores/seated-ink.png'),
  },
  forward: {
    tone: require('@/assets/images/scores/forward-tone.png'),
    ink: require('@/assets/images/scores/forward-ink.png'),
  },
  standing: {
    tone: require('@/assets/images/scores/standing-tone.png'),
    ink: require('@/assets/images/scores/standing-ink.png'),
  },
};

export type ScoreFigureProps = {
  score: number;
  /** The side of the square it is drawn in, in dp. */
  size: number;
  /**
   * The man's colour.
   *
   * @default the page's ink — he is drawn in the colour the words are
   */
  ink?: string;
  /**
   * Say the score to a screen reader. Off where the number is printed beside
   * it and would be read twice.
   */
  labelled?: boolean;
  style?: ViewStyle;
};

/**
 * A score as a drawing: a little man and his gaming chair.
 *
 * ```text
 *     0   the chair, empty          70   sitting up, playing
 *    50   asleep in it              80   on the edge of the seat, leaning in
 *                                  100   on his feet
 * ```
 *
 * The owner's brief (2026-10-12): five drawings for the ratings, after the
 * little man a newspaper rates films with — a gaming chair for the chair, the
 * man alone at the top, and no screen anywhere.
 *
 * **It is drawn in three places and no others**, the owner's ruling on first
 * seeing it everywhere: the ratings graph on a game's page, the same graph in
 * the reviews sheet (`<ScoreSummary>` — with the number, `<FiguredScore>`),
 * and a review's own page (`<ScoreMeter>`). A review card keeps its square
 * with the number in it. Do not put it on a card.
 *
 * ## Two colours, and where each comes from
 *
 * The chair, the controller and the small marks round him (the z's, the
 * sparks) are the **score's own colour** — `scoreColor()`, the one ramp, so an
 * 88 is the same green here as its number is everywhere else. The man is the
 * page's ink. Score is one of the three places colour may come from in this
 * app, and this spends it on the thing that is about the game, not on him.
 *
 * ## The drawing is the second carrier
 *
 * Colour is never the only carrier here. This leans on posture: an empty
 * chair, a sleeper and a man on his feet are three shapes before they are
 * three colours. What a drawing cannot say is the exact figure — a 76 and an
 * 88 are both a man leaning in over his controller — which is why the number is
 * printed beside it or under it in every place it is drawn, and is always what
 * a screen reader is told.
 */
export function ScoreFigure({ score, size, ink, labelled = true, style }: ScoreFigureProps) {
  const theme = useTheme();
  const layers = LAYERS[figureFor(score)];
  const rounded = Math.round(score);

  return (
    <View
      accessible={labelled}
      accessibilityRole={labelled ? 'image' : undefined}
      accessibilityLabel={labelled ? `Rated ${rounded} out of 100, ${labelFor(score)}` : undefined}
      importantForAccessibility={labelled ? 'yes' : 'no-hide-descendants'}
      accessibilityElementsHidden={!labelled}
      style={[{ width: size, height: size }, style]}>
      {/* Bundled, and on screen with the frame they belong to: a fade would be
          the score arriving late on every card. */}
      <Image
        source={layers.tone}
        style={styles.layer}
        tintColor={scoreColor(score, theme)}
        contentFit="contain"
        transition={0}
        accessibilityIgnoresInvertColors
      />
      {layers.ink !== null && (
        <Image
          source={layers.ink}
          style={styles.layer}
          tintColor={ink ?? theme.text}
          contentFit="contain"
          transition={0}
          accessibilityIgnoresInvertColors
        />
      )}
    </View>
  );
}

/** The drawing with its number: beside a verdict, and — should one want it — larger. */
const FIGURED = {
  medium: { figure: 56, number: 30, line: 36 },
  large: { figure: 72, number: 40, line: 46 },
} as const;

export type FiguredScoreProps = {
  score: number;
  size?: keyof typeof FIGURED;
  ink?: string;
  style?: ViewStyle;
};

/**
 * A score with room to be read: **the drawing, then the number.**
 *
 * The owner's rule for it — "inside screens where the rating is expanded… it
 * would be the symbol + the number rating". The drawing says how it felt; the
 * number says which 80-something it was.
 *
 * The number is in the score's colour and bold, as a score's number is
 * everywhere, and the pair is one thing to a screen reader.
 */
export function FiguredScore({ score, size = 'medium', ink, style }: FiguredScoreProps) {
  /* With the drawings off (`SHOW_SCORE_FIGURES`), the number alone. */
  const theme = useTheme();
  const { figure, number, line } = FIGURED[size];
  const rounded = Math.round(score);

  return (
    <View
      style={[styles.figured, style]}
      accessible
      accessibilityLabel={`Rated ${rounded} out of 100, ${labelFor(score)}`}>
      {SHOW_SCORE_FIGURES && <ScoreFigure score={score} size={figure} ink={ink} labelled={false} />}
      <Text
        style={[
          styles.number,
          { fontSize: number, lineHeight: line, color: scoreColor(score, theme) },
        ]}>
        {rounded}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  /* Stacked, both the size of the square: the man over his chair. Nothing in
     one layer is under anything in the other — the script cuts each away
     beneath the other — so the order is only tidiness. */
  layer: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  figured: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  number: {
    fontFamily: Typeface.bold,
    letterSpacing: -0.5,
    /* Every digit the same width, so a 71 and a 77 are the same block. */
    fontVariant: ['tabular-nums'],
    /* Android pads a line box above and below by the font's own metrics, and
       unevenly — which beside a drawing reads as the number sitting low. */
    includeFontPadding: false,
  },
});
