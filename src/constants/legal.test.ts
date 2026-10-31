import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { renderLegalHtml } from './legal-html.ts';
import { LEGAL_DOCS, LEGAL_SLUGS, contactPhrase, fillContact, isLegalSlug } from './legal.ts';

const page = (slug: string) =>
  readFileSync(new URL(`../../public/legal/${slug}.html`, import.meta.url), 'utf8');

describe('legal pages', () => {
  it('on disk are exactly what the text renders to', () => {
    for (const slug of LEGAL_SLUGS) {
      assert.equal(
        page(slug),
        renderLegalHtml(slug),
        `public/legal/${slug}.html is stale — run: node --import ./scripts/esm-register.mjs scripts/legal-pages.mjs`
      );
    }
  });

  it('leave no placeholder unfilled', () => {
    for (const slug of LEGAL_SLUGS) {
      assert.doesNotMatch(renderLegalHtml(slug), /\{contact\}/);
    }
  });

  it('link the contact address when there is one, and escape the text', () => {
    const html = renderLegalHtml('privacy', 'privacy@example.com');
    assert.match(html, /<a href="mailto:privacy@example\.com">privacy@example\.com<\/a>/);
    assert.doesNotMatch(html, /<script/i);
    assert.match(fillContact('write to {contact}', null), new RegExp(contactPhrase(null)));
  });

  it('say how to delete an account, in the app and without it', () => {
    const text = JSON.stringify(LEGAL_DOCS['delete-account']);
    assert.match(text, /Settings/);
    assert.match(text, /Delete account/);
    assert.match(text, /\{contact\}/);
    assert.match(JSON.stringify(LEGAL_DOCS.privacy), /Delete account/);
  });

  it('the terms forbid abuse and say it is reported, blocked and removed', () => {
    const text = JSON.stringify(LEGAL_DOCS.terms);
    for (const word of ['harass', 'report', 'block', 'remove']) {
      assert.match(text, new RegExp(word, 'i'), word);
    }
  });

  it('knows its slugs', () => {
    assert.ok(isLegalSlug('privacy'));
    assert.ok(isLegalSlug('delete-account'));
    assert.equal(isLegalSlug('cookies'), false);
    assert.equal(isLegalSlug(undefined), false);
  });
});
