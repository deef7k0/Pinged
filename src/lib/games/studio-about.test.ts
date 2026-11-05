import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { countryName, foundedYear, roleOf, studioMetaLine } from './studio-about.ts';

/* Real IGDB answers, read through the deployed function on 2026-11-05. */
describe('foundedYear', () => {
  it('reads a year-only date in UTC, not the next year', () => {
    /* Supergiant Games: 1262217600, format 2 — 31 December 2009. */
    assert.equal(foundedYear(1262217600, 2), 2009);
  });
  it('reads a day-precise date, before 1970 too', () => {
    assert.equal(foundedYear(531187200, 0), 1986); // FromSoftware
    assert.equal(foundedYear(-2533161600, 0), 1889); // Nintendo
  });
  it('says nothing for no date or a vaguer precision', () => {
    assert.equal(foundedYear(null, 0), null);
    assert.equal(foundedYear(undefined, undefined), null);
    assert.equal(foundedYear(473299200, 7), null);
  });
});

describe('roleOf', () => {
  it('names what the company is listed as having made', () => {
    assert.equal(roleOf(12, 0), 'developer');
    assert.equal(roleOf(0, 40), 'publisher');
    assert.equal(roleOf(3, 9), 'both');
    assert.equal(roleOf(0, 0), null);
  });
});

describe('countryName', () => {
  it('reads ISO numeric codes and leaves unknown ones unsaid', () => {
    assert.equal(countryName(392), 'Japan');
    assert.equal(countryName(840), 'the United States');
    assert.equal(countryName(32), 'Argentina');
    assert.equal(countryName(999), null);
    assert.equal(countryName(null), null);
  });
});

describe('studioMetaLine', () => {
  it('is the role, the year and the count', () => {
    assert.equal(
      studioMetaLine({ description: null, founded: 1986, country: 392, role: 'developer' }, 155),
      'Developer · Since 1986 · 155 games'
    );
  });
  it('is the count alone without an answer from IGDB', () => {
    assert.equal(studioMetaLine(null, 1), '1 game');
  });
});
