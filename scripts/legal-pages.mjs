/**
 * Writes GameLog's privacy policy, terms of use and account-deletion page as
 * web pages, from the same text the app shows (`src/constants/legal.ts`):
 *
 *     node --import ./scripts/esm-register.mjs scripts/legal-pages.mjs
 *
 * Into `public/legal/`. Host that folder anywhere static (GitHub Pages,
 * Netlify, the web export) and give Google Play the URLs of
 * `privacy.html` and `delete-account.html`. `npm test` fails while the files
 * on disk are older than the text.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LEGAL_CONTACT_EMAIL, LEGAL_SLUGS } from '../src/constants/legal.ts';
import { renderLegalHtml } from '../src/constants/legal-html.ts';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'legal');
mkdirSync(out, { recursive: true });
for (const slug of LEGAL_SLUGS) {
  writeFileSync(join(out, `${slug}.html`), renderLegalHtml(slug));
  console.log(`wrote public/legal/${slug}.html`);
}
if (!LEGAL_CONTACT_EMAIL) {
  console.warn(
    '\nLEGAL_CONTACT_EMAIL is not set (src/constants/legal.ts): the pages point at the ' +
      'store listing’s contact address instead. Set it and run this again before publishing.'
  );
}
