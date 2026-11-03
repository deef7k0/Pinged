import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  DEFAULT_PING_AUDIENCE,
  DIRECT_PING_KINDS,
  DIRECT_PING_MESSAGE_MAX,
  DIRECT_PING_VERB,
  PING_AUDIENCES,
  PING_DESCRIPTION_MAX,
  PING_ERAS,
  PING_FILTER_MAX,
  PING_LENGTHS,
  PING_PAGE_SIZE,
  PING_PLAYERS,
  PING_REFERENCE_MAX,
  PING_STATUSES,
  SUGGESTIONS_PER_PERSON,
  SUGGESTION_MESSAGE_MAX,
  canSuggest,
  directPingRoute,
  familiarity,
  nextStageIndex,
  plateFoot,
  playedFraction,
  spotlightClaim,
  flattenPages,
  groupSuggestions,
  nextCursor,
  pingTags,
  sendLabel,
  suggestedBy,
  suggestionCount,
} from './pings.ts';

const MIGRATION = readFileSync(
  new URL('../../supabase/migrations/0046_pings.sql', import.meta.url),
  'utf8'
);

/** The values of `check (<column> in (...))` in 0046. */
function checkValues(column: string): string[] {
  const match = MIGRATION.match(new RegExp(`check \\(${column} in \\(([^)]*)\\)\\)`));
  assert.ok(match, `0046 has a CHECK on ${column}`);
  return match[1].split(',').map((value) => value.trim().replace(/'/g, ''));
}

describe('the vocabularies are what 0046 accepts', () => {
  it('statuses', () => assert.deepEqual(checkValues('status'), [...PING_STATUSES]));
  it('lengths', () =>
    assert.deepEqual(
      checkValues('play_length'),
      PING_LENGTHS.map((option) => option.value)
    ));
  it('players', () =>
    assert.deepEqual(
      checkValues('player_mode'),
      PING_PLAYERS.map((option) => option.value)
    ));
  it('eras', () =>
    assert.deepEqual(
      checkValues('release_era'),
      PING_ERAS.map((option) => option.value)
    ));
  it('audiences, with followers the default', () => {
    assert.deepEqual(
      checkValues('audience'),
      PING_AUDIENCES.map((option) => option.value)
    );
    assert.equal(DEFAULT_PING_AUDIENCE, 'followers');
    assert.equal(PING_AUDIENCES[0].value, DEFAULT_PING_AUDIENCE);
    assert.match(MIGRATION, /audience\s+text not null default 'followers'/);
  });
  it('what can be pinged to a person', () => {
    assert.deepEqual(checkValues('kind'), [...DIRECT_PING_KINDS]);
    for (const kind of DIRECT_PING_KINDS) assert.ok(DIRECT_PING_VERB[kind], kind);
  });
});

describe('the limits are 0046’s', () => {
  it('a request’s words', () =>
    assert.match(
      MIGRATION,
      new RegExp(`char_length\\(btrim\\(description\\)\\) between 1 and ${PING_DESCRIPTION_MAX}`)
    ));
  it('a suggestion’s message', () =>
    assert.match(
      MIGRATION,
      new RegExp(
        `message\\s+text check \\(char_length\\(message\\) <= ${SUGGESTION_MESSAGE_MAX}\\)`
      )
    ));
  it('a ping’s line', () =>
    assert.match(
      MIGRATION,
      new RegExp(
        `message\\s+text check \\(char_length\\(message\\) <= ${DIRECT_PING_MESSAGE_MAX}\\)`
      )
    ));
  it('reference games', () => {
    assert.match(MIGRATION, new RegExp(`>= ${PING_REFERENCE_MAX} then`));
    assert.match(MIGRATION, new RegExp(`sort_order between 0 and ${PING_REFERENCE_MAX - 1}`));
  });
  it('genres and platforms', () => {
    assert.match(MIGRATION, new RegExp(`cardinality\\(genres\\) <= ${PING_FILTER_MAX}`));
    assert.match(MIGRATION, new RegExp(`cardinality\\(platforms\\) <= ${PING_FILTER_MAX}`));
  });
  it('suggestions per person', () =>
    assert.match(MIGRATION, new RegExp(`\\) >= ${SUGGESTIONS_PER_PERSON} then`)));
  it('a page is at most what the feed returns', () => {
    assert.match(MIGRATION, /p_limit\s+int default 20/);
    assert.equal(PING_PAGE_SIZE, 20);
  });
});

describe('what counts as having played a game', () => {
  it('is playing, played, paused or dropped — never backlog — everywhere 0046 asks', () => {
    const sets = [...MIGRATION.matchAll(/l2?\.status in \(([^)]*)\)/g)].map((match) =>
      match[1]
        .split(',')
        .map((value) => value.trim().replace(/'/g, ''))
        .sort()
    );
    assert.ok(sets.length >= 3);
    for (const set of sets) assert.deepEqual(set, ['dropped', 'paused', 'played', 'playing']);
  });
});

describe('familiarity', () => {
  const at = (reference_count: number, matched_count: number, reviewed_count = 0) =>
    familiarity({ reference_count, matched_count, reviewed_count });

  it('says nothing about a request with no games', () => assert.equal(at(0, 0), null));
  it('says when none match', () =>
    assert.deepEqual(at(3, 0), { tone: 'none', text: 'No direct library matches' }));
  it('counts what was played', () => {
    assert.deepEqual(at(3, 2), {
      tone: 'strong',
      text: 'You’ve played 2 of the 3 reference games',
    });
    assert.deepEqual(at(3, 1), { tone: 'some', text: 'You’ve played 1 of the 3 reference games' });
    assert.deepEqual(at(2, 2), { tone: 'strong', text: 'You’ve played all 2 reference games' });
  });
  it('mentions a review', () => {
    assert.deepEqual(at(1, 1, 1), { tone: 'some', text: 'You reviewed this reference game' });
    assert.deepEqual(at(1, 1, 0), { tone: 'some', text: 'You’ve played this reference game' });
    assert.equal(at(3, 2, 1)!.text, 'You’ve played 2 of the 3 reference games · reviewed one');
    assert.equal(at(3, 3, 3)!.text, 'You’ve played all 3 reference games · reviewed them');
  });
  it('never claims more than there is', () => {
    assert.equal(at(2, 5, 9)!.text, 'You’ve played all 2 reference games · reviewed them');
  });
});

describe('the cursor', () => {
  const row = (id: string, tier = 0) => ({ id, tier, created_at: `2026-10-0${id}T00:00:00Z` });

  it('is the last row’s ranking fields while pages are full', () => {
    assert.deepEqual(nextCursor([row('2', 2), row('1', 1)], 2), {
      tier: 1,
      created_at: '2026-10-01T00:00:00Z',
      id: '1',
    });
  });
  it('ends on a short page', () => assert.equal(nextCursor([row('1')], 2), null));
  it('draws a request seen twice once', () =>
    assert.deepEqual(
      flattenPages([
        [row('3'), row('2')],
        [row('2'), row('1')],
      ]).map((r) => r.id),
      ['3', '2', '1']
    ));
});

describe('suggestions by game', () => {
  const s = (id: string, game_id: string, created_at: string, interesting = false) => ({
    id,
    game_id,
    user_id: `u${id}`,
    created_at,
    interesting,
  });

  it('groups a game suggested twice, its first suggester leading', () => {
    const groups = groupSuggestions([
      s('b', 'g1', '2026-10-02'),
      s('a', 'g1', '2026-10-01'),
      s('c', 'g2', '2026-10-03'),
    ]);
    assert.deepEqual(
      groups.map((group) => [group.gameId, group.suggestions.map((x) => x.id)]),
      [
        ['g1', ['a', 'b']],
        ['g2', ['c']],
      ]
    );
  });
  it('puts the answer first, then what the owner marked', () => {
    const groups = groupSuggestions(
      [
        s('a', 'g1', '2026-10-01'),
        s('b', 'g1', '2026-10-02'),
        s('c', 'g2', '2026-10-03', true),
        s('d', 'g3', '2026-10-04'),
      ],
      'g3'
    );
    assert.deepEqual(
      groups.map((group) => group.gameId),
      ['g3', 'g2', 'g1']
    );
    assert.equal(groups[0].solved, true);
    assert.equal(groups[1].interesting, true);
  });
});

describe('words', () => {
  it('who suggested it', () => {
    assert.equal(suggestedBy(['Ada']), 'Suggested by Ada');
    assert.equal(suggestedBy(['Ada', 'Ben']), 'Suggested by Ada and Ben');
    assert.equal(suggestedBy(['Ada', 'Ben', 'Cho']), 'Suggested by Ada and 2 others');
  });
  it('how many', () => {
    assert.equal(suggestionCount(0), 'No suggestions yet');
    assert.equal(suggestionCount(1), '1 suggestion');
    assert.equal(suggestionCount(4), '4 suggestions');
  });
  it('the send button', () => {
    assert.equal(sendLabel(0), 'Ping');
    assert.equal(sendLabel(1), 'Ping 1 person');
    assert.equal(sendLabel(3), 'Ping 3 people');
  });
  it('a request’s chips, in a fixed order', () =>
    assert.deepEqual(
      pingTags({
        genres: ['rpg', 'horror'],
        platforms: ['pc'],
        play_length: 'short',
        player_mode: 'solo',
        release_era: 'retro',
      }),
      ['RPG', 'Horror', 'PC', 'Short', 'Single-player', 'Retro']
    ));
});

describe('who may answer', () => {
  it('anybody but the owner, while it is open', () => {
    assert.equal(canSuggest({ status: 'open', user_id: 'a' }, 'b'), true);
    assert.equal(canSuggest({ status: 'open', user_id: 'a' }, 'a'), false);
    assert.equal(canSuggest({ status: 'found', user_id: 'a' }, 'b'), false);
    assert.equal(canSuggest({ status: 'open', user_id: 'a' }, null), false);
  });
});

describe('where a ping opens', () => {
  it('every kind has a route that exists', () => {
    for (const kind of DIRECT_PING_KINDS) {
      const { pathname, params } = directPingRoute(kind, 'x');
      assert.equal(params.id, 'x');
      const file = new URL(`../app${pathname}.tsx`, import.meta.url);
      assert.doesNotThrow(() => readFileSync(file), `${kind} opens ${pathname}, which is a route`);
    }
  });
});

describe('the stage and the board', () => {
  const claim = (reference_count: number, matched_count: number) =>
    spotlightClaim({ reference_count, matched_count });

  it('says why a request is on the stage', () => {
    assert.equal(claim(2, 2), 'You’ve played both of these');
    assert.equal(claim(3, 3), 'You’ve played all three of these');
    assert.equal(claim(1, 1), 'You’ve played this one');
    assert.equal(claim(3, 2), 'You’ve played two of these');
    assert.equal(claim(3, 1), 'You’ve played one of these');
    assert.equal(claim(1, 0), 'New to you');
    assert.equal(claim(0, 0), 'Anyone can answer this one');
    assert.equal(claim(2, 7), 'You’ve played both of these');
  });

  it('prints the queue’s fraction', () => {
    assert.equal(playedFraction({ reference_count: 3, matched_count: 2 }), '2/3');
    assert.equal(playedFraction({ reference_count: 1, matched_count: 4 }), '1/1');
  });

  const row = {
    status: 'open' as const,
    reference_count: 3,
    matched_count: 2,
    suggestion_count: 4,
    unseen_count: 0,
  };
  it('words a plate’s foot', () => {
    assert.deepEqual(plateFoot(row, false), {
      left: '2 of 3 played',
      leftLit: true,
      right: '4 suggestions',
      struck: false,
    });
    assert.deepEqual(plateFoot({ ...row, status: 'found' }, false), {
      left: '2 of 3 played',
      leftLit: false,
      right: 'Found it',
      struck: true,
    });
    assert.equal(plateFoot({ ...row, reference_count: 0 }, false).left, 'No games named');
    assert.equal(plateFoot({ ...row, matched_count: 0 }, false).leftLit, false);
  });
  it('words your own plate by what is new', () => {
    assert.deepEqual(plateFoot({ ...row, unseen_count: 2 }, true), {
      left: '2 new',
      leftLit: true,
      right: '4 suggestions',
      struck: false,
    });
    assert.equal(plateFoot(row, true).left, 'Yours');
    assert.equal(plateFoot({ ...row, status: 'closed' }, true).right, 'Closed');
  });

  it('steps the stage, and starts over only at the true end', () => {
    assert.equal(nextStageIndex(0, 3, false), 1);
    assert.equal(nextStageIndex(2, 3, true), null);
    assert.equal(nextStageIndex(2, 3, false), 0);
    assert.equal(nextStageIndex(0, 0, false), null);
  });
});
