import { Text as RNText, StyleSheet, type StyleProp, type TextStyle } from 'react-native';

import { PULL_QUOTE, quoteMarkSize, type PullQuoteSize } from '@/constants/pull-quote';
import { Typeface, withAlpha } from '@/constants/theme';
import { useTypedCount } from '@/hooks/use-typed-count';
import { normaliseQuote } from '@/lib/review-quote';

export type QuoteBlockProps = {
  /** The sentence, as written. Marks the writer typed round it are taken off. */
  text: string;
  /** Where it is drawn: `card`, `page`, `share` or `podium` (`PULL_QUOTE`). */
  size: PullQuoteSize;
  /** The words' and the marks' ink. A hex: an untyped rest is drawn in it at no alpha. */
  color: string;
  /** Type itself out from mount, on onboarding's clock — a review's own page. */
  typed?: boolean;
  /**
   * Its own stop for a screen reader. Off inside a card or a link that already
   * speaks the sentence, so it is not heard twice.
   */
  accessible?: boolean;
  style?: StyleProp<TextStyle>;
};

/**
 * A review's one sentence, in quotation marks, as ordinary centred text — the
 * owner's direction (2026-10-17): "exactly like a normal text message", the
 * marks right beside the first and last words, the whole thing centred as one.
 *
 * ```text
 *    “The most unique and entertaining
 *      skateboarding video game ever
 *                created.”
 * ```
 *
 * Poppins Regular, and Poppins' own “ and ” a little larger than the words
 * (`quoteMarkSize`): one text, broken by the platform, so the marks cannot
 * come away from the words.
 *
 * Typed as onboarding's lines are: the whole sentence is laid out from the
 * first frame, the untyped rest drawn in the ink at no alpha — never
 * `transparent`, which Android reads as no colour at all — so nothing reflows,
 * and the closing mark comes with the last letter.
 */
export function QuoteBlock({
  text,
  size,
  color,
  typed = false,
  accessible = true,
  style,
}: QuoteBlockProps) {
  const words = normaliseQuote(text);
  const shown = useTypedCount(words, typed);

  if (!words) return null;

  const { fontSize, lineHeight } = PULL_QUOTE[size];
  const hidden = withAlpha(color, 0);
  const done = shown >= words.length;
  const mark = { fontSize: quoteMarkSize(size) };

  return (
    <RNText
      allowFontScaling={false}
      accessible={accessible}
      accessibilityRole={accessible ? 'text' : undefined}
      accessibilityLabel={accessible ? `“${words}”` : undefined}
      style={[styles.quote, { fontSize, lineHeight, color }, style]}>
      <RNText style={mark}>“</RNText>
      {words.slice(0, shown)}
      {!done && <RNText style={{ color: hidden }}>{words.slice(shown)}</RNText>}
      <RNText style={[mark, !done && { color: hidden }]}>”</RNText>
    </RNText>
  );
}

const styles = StyleSheet.create({
  quote: { fontFamily: Typeface.regular, textAlign: 'center', includeFontPadding: false },
});
