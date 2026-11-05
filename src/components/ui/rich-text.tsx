import { Fragment, type ReactNode } from 'react';

import { Text, type TextProps } from '@/components/ui/text';
import { Typeface } from '@/constants/theme';

/**
 * Body copy with the two emphases people actually type: `**bold**` and
 * `*italic*`.
 *
 * ## Why a hand-rolled parser and not a markdown library
 *
 * Because this is not markdown and must not become it. The input is a
 * collection's description, written in a `<TextField multiline>` by someone
 * describing a shelf of games — the useful part of markdown here is emphasis,
 * and every other feature is a liability. Headings would put a second type scale
 * inside a caption. Links would need sanitising, resolving and a safe tap
 * target. Images would let one collection's blurb push a wall of tiles off the
 * screen. Tables have nowhere to go on a 390dp phone.
 *
 * A parser that knows only two rules also degrades the right way: text that is
 * not valid emphasis is text. An unclosed `**` renders as two asterisks — which
 * is what the writer typed, so they can see it and fix it — where a real
 * markdown renderer would either eat it or swallow the rest of the paragraph
 * into a bold run.
 *
 * `react-native-markdown-display` and friends also want a `rules` map of ~30
 * node types and ship a parser several times the size of this file, to render
 * two of them.
 *
 * ## The grammar, in full
 *
 * - `**text**` → semibold. Not `bold` (700): this runs inside `body` and
 *   `bodySmall`, where 700 against 400 is a shout rather than an emphasis, and
 *   700 is reserved for the two largest steps of the scale.
 * - `*text*` → italic.
 * - `***text***` → both, as its own marker rather than as a consequence of the
 *   other two. Tried first, because `**` would otherwise claim two of the three
 *   asterisks and leave a literal one stranded.
 * - A marker with only whitespace between it (`**`, `* *`) is not emphasis and
 *   stays literal, which is what stops a row of asterisks in ASCII art from
 *   becoming an invisible formatting instruction.
 *
 * Emphasis does not span a blank line. There is no paragraph model here — the
 * string renders as one `<Text>` and newlines are newlines — but the pattern
 * refuses to match across `\n\n`, so a stray `*` in one paragraph cannot
 * italicise everything down to the next one.
 *
 * ## Nesting has to name the combined face
 *
 * A `<Text>` inside a `<Text>` inherits `fontFamily`, and setting it *replaces*
 * the parent's rather than combining with it — there is no `fontStyle` axis to
 * fall back on, because italic is a separate family here (see `Typeface`). So
 * `**bold with *italic* inside**` cannot be rendered by nesting an italic run
 * inside a semibold one: the inner run would come out regular italic, quietly
 * dropping the weight. The active emphasis is therefore threaded down the
 * recursion and each run names the one face that expresses all of it.
 */
export type RichTextProps = Omit<TextProps, 'children'> & {
  /** The raw string, markers and all. Null and blank render nothing. */
  children?: string | null;
};

export function RichText({ children, ...rest }: RichTextProps) {
  if (!children?.trim()) return null;

  return <Text {...rest}>{renderRuns(children, 0, false, false)}</Text>;
}

/** Paste into a `hint` so the rule is discoverable where it is typed. */
export const RICH_TEXT_HINT = 'Optional. **bold** and *italic* work here.';

/**
 * The markers, longest first — the order settles ties at the same index.
 *
 * Which marker wins is decided by *position* first (see `renderRuns`), not by
 * length. Length-first is the obvious implementation and it is wrong: in
 * `*italic with **bold** inside*` the bold run starts later but would be matched
 * first, closing the outer italic against the wrong asterisk and emitting
 * `<i>italic with **bold</i>* inside*`. Position-first with length as the
 * tie-break gets both this and `***both***` right.
 */
const MARKERS = [
  { token: '***', bold: true, italic: true },
  { token: '**', bold: true, italic: false },
  { token: '*', bold: false, italic: true },
] as const;

/** The one loaded face that expresses this combination, or none to inherit. */
function familyFor(bold: boolean, italic: boolean): string | undefined {
  if (bold && italic) return Typeface.boldItalic;
  if (bold) return Typeface.semibold;
  if (italic) return Typeface.italic;
  return undefined;
}

/**
 * Match one emphasis run: `<token>content<token>`.
 *
 * Three guards, and the first is the subtle one.
 *
 * **`(?![*\s])` after the opening marker, `(?!\*)` after the closing one.** A
 * marker may not sit against another asterisk, which is what stops a short
 * marker from biting into a longer delimiter run. Without it the lazy `*` in
 * `*italic with **bold** inside*` closes on the *opening* asterisk of `**bold**`
 * — the classic failure of a regex-based emphasis parser, and the reason real
 * markdown tokenises delimiter runs instead. Requiring both ends to be isolated
 * gets the same answer here without a tokeniser, because the grammar is two
 * rules deep rather than thirty. It is also why `****` and `*****x*****` stay
 * literal rather than resolving to something arbitrary.
 *
 * **`(?![*\s])` and the trailing `[^\s*]`** are the "no empty, no
 * whitespace-only" rule: `* *` and `** **` are text.
 *
 * **`[\s\S]` with `(?!\n\n)`** — a run may cross a single newline, because a
 * sentence wrapped mid-emphasis is ordinary typing, but never a blank line, so a
 * stray asterisk cannot italicise everything down to the next paragraph.
 *
 * Non-greedy, so `*a* and *b*` is two runs rather than one containing
 * `a* and *b`.
 */
function patternFor(token: string): RegExp {
  const escaped = token.replace(/\*/g, '\\*');
  return new RegExp(`${escaped}(?![*\\s])((?:(?!\\n\\n)[\\s\\S])*?[^\\s*])${escaped}(?!\\*)`);
}

/**
 * Split one string into plain text and emphasised runs, recursively.
 *
 * `depth` is a hard stop rather than a style choice. The recursion is already
 * structurally bounded — every level consumes at least one marker pair and hands
 * down a strictly shorter string — but this runs on text a stranger typed, and a
 * cheap ceiling is worth more than a proof. Four levels is well past every
 * combination the grammar has.
 */
function renderRuns(input: string, depth: number, bold: boolean, italic: boolean): ReactNode {
  if (depth > 4) return input;

  /* Earliest match wins; `MARKERS` being longest-first means a strict `<` leaves
     the longer marker in place on a tie, which is what `***both***` needs. */
  let best: { marker: (typeof MARKERS)[number]; match: RegExpExecArray } | null = null;

  for (const marker of MARKERS) {
    /* Already inside this emphasis: the markers would be a no-op run, and
       matching them again just strips a literal pair of asterisks the writer
       meant to keep. */
    if ((marker.bold && bold) || (marker.italic && italic)) continue;

    const match = patternFor(marker.token).exec(input);
    if (match && (!best || match.index < best.match.index)) best = { marker, match };
  }

  if (!best) return input;

  const { marker, match } = best;
  const before = input.slice(0, match.index);
  const after = input.slice(match.index + match[0].length);
  const nextBold = bold || marker.bold;
  const nextItalic = italic || marker.italic;

  return (
    <Fragment>
      {before ? renderRuns(before, depth, bold, italic) : null}
      <Text style={{ fontFamily: familyFor(nextBold, nextItalic) }}>
        {renderRuns(match[1], depth + 1, nextBold, nextItalic)}
      </Text>
      {after ? renderRuns(after, depth, bold, italic) : null}
    </Fragment>
  );
}
