import { readFileSync } from 'node:fs';

/**
 * The app's typeface's (Inter's) advance widths, read out of the font files
 * the app ships — for
 * tests that need to know how many lines a sentence takes. Node only: it reads
 * `node_modules`, and nothing in the app may import it.
 *
 * Just enough of TrueType to answer "how wide is this string": the `cmap`
 * (format 4 or 12) for a character's glyph, `hmtx` for its advance. No
 * kerning, which Inter applies sparingly and which only narrows a line.
 */

type Weight = '400Regular' | '500Medium' | '600SemiBold' | '700Bold' | '800ExtraBold';

const cache = new Map<Weight, (char: string) => number>();

function advanceTable(weight: Weight): (char: string) => number {
  const known = cache.get(weight);
  if (known) return known;

  const file = new URL(
    `../../../node_modules/@expo-google-fonts/inter/${weight}/Inter_${weight}.ttf`,
    import.meta.url
  );
  const font = readFileSync(file);
  const tables = new Map<string, number>();
  for (let index = 0; index < font.readUInt16BE(4); index++) {
    const at = 12 + index * 16;
    tables.set(font.toString('ascii', at, at + 4), font.readUInt32BE(at + 8));
  }
  const table = (tag: string) => {
    const offset = tables.get(tag);
    if (offset === undefined) throw new Error(`Inter ${weight} has no ${tag} table`);
    return offset;
  };

  const unitsPerEm = font.readUInt16BE(table('head') + 18);
  const hMetrics = font.readUInt16BE(table('hhea') + 34);
  const hmtx = table('hmtx');
  const cmap = table('cmap');

  let subtable = -1;
  let format = 0;
  for (let index = 0; index < font.readUInt16BE(cmap + 2); index++) {
    const at = cmap + 4 + index * 8;
    const offset = cmap + font.readUInt32BE(at + 4);
    const kind = font.readUInt16BE(offset);
    if (kind === 12 || (kind === 4 && format !== 12)) {
      subtable = offset;
      format = kind;
    }
  }

  function glyphOf(codePoint: number): number {
    if (format === 12) {
      const groups = font.readUInt32BE(subtable + 12);
      for (let index = 0; index < groups; index++) {
        const at = subtable + 16 + index * 12;
        const start = font.readUInt32BE(at);
        const end = font.readUInt32BE(at + 4);
        if (codePoint >= start && codePoint <= end) {
          return font.readUInt32BE(at + 8) + codePoint - start;
        }
      }
      return 0;
    }
    const segments = font.readUInt16BE(subtable + 6) / 2;
    const ends = subtable + 14;
    const starts = ends + segments * 2 + 2;
    const deltas = starts + segments * 2;
    const ranges = deltas + segments * 2;
    for (let index = 0; index < segments; index++) {
      const end = font.readUInt16BE(ends + index * 2);
      const start = font.readUInt16BE(starts + index * 2);
      if (codePoint < start || codePoint > end) continue;
      const delta = font.readInt16BE(deltas + index * 2);
      const range = font.readUInt16BE(ranges + index * 2);
      if (!range) return (codePoint + delta) & 0xffff;
      const glyph = font.readUInt16BE(ranges + index * 2 + range + 2 * (codePoint - start));
      return glyph ? (glyph + delta) & 0xffff : 0;
    }
    return 0;
  }

  const advance = (char: string) => {
    const glyph = glyphOf(char.codePointAt(0) ?? 0);
    return font.readUInt16BE(hmtx + 4 * Math.min(glyph, hMetrics - 1)) / unitsPerEm;
  };
  cache.set(weight, advance);
  return advance;
}

/** The width of `text` at `fontSize`, in dp. */
export function textWidth(text: string, fontSize: number, weight: Weight = '400Regular'): number {
  const advance = advanceTable(weight);
  let width = 0;
  for (const char of text) width += advance(char);
  return width * fontSize;
}

/** How many lines `text` takes at `width`, broken at spaces as a text view breaks it. */
export function linesAt(
  text: string,
  width: number,
  fontSize: number,
  weight: Weight = '400Regular'
): number {
  let lines = 1;
  let current = '';
  for (const word of text.split(' ')) {
    const next = current ? `${current} ${word}` : word;
    if (current && textWidth(next, fontSize, weight) > width) {
      lines++;
      current = word;
    } else {
      current = next;
    }
  }
  return lines;
}
