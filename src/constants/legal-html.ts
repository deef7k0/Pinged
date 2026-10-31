import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_DOCS,
  LEGAL_UPDATED,
  fillContact,
  type LegalBlock,
  type LegalSlug,
} from './legal';

/**
 * A legal page as a web page of its own — what Google Play's "privacy policy"
 * and "delete account" URLs point at. Written into `public/legal/` by
 * `node --import ./scripts/esm-register.mjs scripts/legal-pages.mjs`; any
 * static host serves them (`expo export -p web` copies `public/` too).
 *
 * No script, no font download, nothing loaded from anywhere: a privacy policy
 * that loads a tracker would be a strange thing to publish. The colours are
 * the app's page and inks.
 */

function escape(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** The contact address as a mail link, everything else escaped. */
function inline(text: string, email: string | null): string {
  const filled = escape(fillContact(text, email));
  if (!email) return filled;
  const safe = escape(email);
  return filled.replaceAll(safe, `<a href="mailto:${safe}">${safe}</a>`);
}

function block(item: LegalBlock, email: string | null): string {
  if (typeof item === 'string') return `<p>${inline(item, email)}</p>`;
  return `<ul>${item.list.map((line) => `<li>${inline(line, email)}</li>`).join('')}</ul>`;
}

const OTHER_PAGES: Record<LegalSlug, string> = {
  privacy: 'Privacy policy',
  terms: 'Terms of use',
  'delete-account': 'Delete your account',
};

export function renderLegalHtml(
  slug: LegalSlug,
  email: string | null = LEGAL_CONTACT_EMAIL
): string {
  const doc = LEGAL_DOCS[slug];
  const sections = doc.sections
    .map(
      (section) =>
        `<section><h2>${escape(section.heading)}</h2>${section.blocks
          .map((item) => block(item, email))
          .join('')}</section>`
    )
    .join('\n');
  const nav = (Object.keys(OTHER_PAGES) as LegalSlug[])
    .filter((other) => other !== slug)
    .map((other) => `<a href="./${other}.html">${OTHER_PAGES[other]}</a>`)
    .join(' · ');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(doc.title)} — GameLog</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #14171C; color: #E1E4EB;
    font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 680px; margin: 0 auto; padding: 48px 20px 64px; }
  h1 { font-size: 28px; line-height: 1.2; margin: 0 0 8px; }
  h2 { font-size: 18px; margin: 32px 0 8px; }
  p, li { color: #B4BAC5; }
  .updated { color: #8A93A1; font-size: 14px; margin: 0 0 24px; }
  a { color: #2E93E8; }
  nav { margin-top: 48px; font-size: 14px; color: #8A93A1; }
</style>
</head>
<body>
<main>
<h1>${escape(doc.title)}</h1>
<p class="updated">GameLog · Last updated ${escape(LEGAL_UPDATED)}</p>
<p>${inline(doc.intro, email)}</p>
${sections}
<nav>${nav}</nav>
</main>
</body>
</html>
`;
}
