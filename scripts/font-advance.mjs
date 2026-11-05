/**
 * Prints the advance tables for `src/lib/font-advance.ts` from the font files
 * the app ships. Run after changing the app's typeface:
 *
 *   node --import ./scripts/esm-register.mjs scripts/font-advance.mjs
 *
 * and paste its output over the three arrays there.
 */
import { readFileSync } from 'node:fs';
import { textWidth } from '../src/lib/testkit/app-font.ts';

const source = readFileSync(new URL('../src/lib/font-advance.ts', import.meta.url), 'utf8');
const literal = source.match(/const CHARS =\s*\n\s*('(?:[^'\\]|\\.)*');/);
if (!literal) throw new Error('No CHARS in font-advance.ts');
const chars = [...Function(`return ${literal[1]}`)()];

for (const [name, weight] of [
  ['REGULAR', '400Regular'],
  ['BOLD', '700Bold'],
  ['EXTRA_BOLD', '800ExtraBold'],
]) {
  const values = chars.map((char) => Math.round(textWidth(char, 1000, weight)));
  const rows = [];
  for (let at = 0; at < values.length; at += 19) rows.push(`  ${values.slice(at, at + 19).join(', ')},`);
  console.log(`const ${name} = [\n${rows.join('\n')}\n];`);
}
