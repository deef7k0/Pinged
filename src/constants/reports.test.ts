import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  CONTENT_REPORT_REASONS,
  CONTENT_REPORT_REASON_HINT,
  CONTENT_REPORT_REASON_LABEL,
  MAX_REPORT_NOTE,
  PROFILE_REPORT_REASONS,
  USER_CONTENT_REASON_LABEL,
  USER_CONTENT_REPORT_REASONS,
  isReportKind,
} from './reports.ts';

const SAFETY = readFileSync(
  new URL('../../supabase/migrations/0045_account_safety.sql', import.meta.url),
  'utf8'
);

const MIGRATION = readFileSync(
  new URL('../../supabase/migrations/0031_content_reports.sql', import.meta.url),
  'utf8'
);

describe('content report reasons', () => {
  it('are exactly what both report tables accept', () => {
    const checks = [...MIGRATION.matchAll(/check \(reason in \(([^)]*)\)\)/g)].map((match) =>
      match[1].split(',').map((value) => value.trim().replace(/'/g, ''))
    );

    // One CHECK per table: suggestions and reviews.
    assert.equal(checks.length, 2);
    for (const accepted of checks) {
      assert.deepEqual([...accepted].sort(), [...CONTENT_REPORT_REASONS].sort());
    }
  });

  it('each has a label and a hint', () => {
    for (const reason of CONTENT_REPORT_REASONS) {
      assert.ok(CONTENT_REPORT_REASON_LABEL[reason]);
      assert.ok(CONTENT_REPORT_REASON_HINT[reason]);
    }
  });

  it('cap the note where the tables do', () => {
    const caps = [...MIGRATION.matchAll(/char_length\(note\) <= (\d+)/g)].map((match) =>
      Number(match[1])
    );
    assert.deepEqual(caps, [MAX_REPORT_NOTE, MAX_REPORT_NOTE]);
  });
});

describe('reports on comments, wall posts and profiles (0045)', () => {
  it('offer exactly what the table accepts', () => {
    const check = SAFETY.match(/check \(reason in \(([^)]*)\)\)/);
    assert.ok(check, '0045 has a CHECK on reason');
    const accepted = check[1].split(',').map((value) => value.trim().replace(/'/g, ''));
    assert.deepEqual([...accepted].sort(), [...USER_CONTENT_REPORT_REASONS].sort());
    for (const reason of PROFILE_REPORT_REASONS) assert.ok(accepted.includes(reason), reason);
  });

  it('name every reason', () => {
    for (const reason of USER_CONTENT_REPORT_REASONS) assert.ok(USER_CONTENT_REASON_LABEL[reason]);
  });

  it('cap the note where the table does', () => {
    assert.match(SAFETY, new RegExp(`char_length\\(note\\) <= ${MAX_REPORT_NOTE}`));
  });

  it('cover the kinds the table does', () => {
    const kinds = SAFETY.match(/check \(kind in \(([^)]*)\)\)/)![1]
      .split(',')
      .map((value) => value.trim().replace(/'/g, ''));
    for (const kind of kinds) assert.ok(isReportKind(kind), kind);
  });
});

describe('reports on requests and suggestions (0046)', () => {
  it('cover the kinds 0046 widens the table to', () => {
    const pings = readFileSync(
      new URL('../../supabase/migrations/0046_pings.sql', import.meta.url),
      'utf8'
    );
    const kinds = pings
      .match(/user_content_reports_kind_check\s+check \(kind in \(([^)]*)\)\)/)![1]
      .split(',')
      .map((value) => value.trim().replace(/'/g, ''));
    for (const kind of kinds) assert.ok(isReportKind(kind), kind);
    assert.ok(kinds.includes('ping') && kinds.includes('ping_suggestion'));
  });
});

describe('isReportKind', () => {
  it('accepts the eight kinds and nothing else', () => {
    assert.ok(isReportKind('pick'));
    assert.ok(isReportKind('suggestion'));
    assert.ok(isReportKind('review'));
    assert.ok(isReportKind('comment'));
    assert.ok(isReportKind('wall_post'));
    assert.ok(isReportKind('profile'));
    assert.ok(isReportKind('ping'));
    assert.ok(isReportKind('ping_suggestion'));
    assert.equal(isReportKind('post'), false);
    assert.equal(isReportKind(undefined), false);
  });
});
