const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'starter', 'static', 'leaderboard.js'),
  'utf8'
);

function createLeaderboardHarness(values = new Map(), options = {}) {
  const elements = new Map([
    ['leaderboard-body', {
      children: [],
      innerHTML: '',
      appendChild(child) {
        this.children.push(child);
      },
    }],
    ['leaderboard-table', {hidden: true}],
    ['leaderboard-empty', {hidden: false}],
    ['leaderboard-status', {textContent: ''}],
  ]);
  const body = elements.get('leaderboard-body');
  Object.defineProperty(body, 'innerHTML', {
    set() {
      body.children = [];
    },
  });
  const localStorage = {
    getItem(key) {
      if (options.failGet) throw new Error('Storage read denied');
      return values.has(key) ? values.get(key) : null;
    },
    removeItem(key) {
      if (options.failRemove) throw new Error('Storage remove denied');
      values.delete(key);
    },
    setItem(key, value) {
      if (options.failSet) throw new Error('Storage write denied');
      values.set(key, String(value));
    },
  };
  const context = {
    document: {
      createElement: () => ({
        children: [],
        appendChild(child) {
          this.children.push(child);
        },
        textContent: '',
      }),
      getElementById(id) {
        assert.ok(elements.has(id), `Unexpected element id: ${id}`);
        return elements.get(id);
      },
    },
    localStorage,
    window: null,
  };
  context.window = context;
  vm.runInNewContext(source, context);

  return {
    api: context.sudokuLeaderboard,
    elements,
    values,
  };
}

function score(name, timeSeconds, hintsUsed = 0, difficulty = 'easy') {
  return {name, timeSeconds, hintsUsed, difficulty};
}

test('stores valid score fields, ranks by time, and keeps only ten', () => {
  const game = createLeaderboardHarness();

  for (let index = 1; index <= 12; index++) {
    const result = game.api.submit(score(`Player ${index}`, 120 - index, index, 'hard'));
    assert.equal(result.saved, true);
  }

  const stored = JSON.parse(game.values.get(game.api.storageKey));
  assert.equal(stored.length, 10);
  assert.deepEqual(stored.map(entry => entry.timeSeconds), [
    108, 109, 110, 111, 112, 113, 114, 115, 116, 117,
  ]);
  assert.deepEqual(stored[0], {
    name: 'Player 12',
    timeSeconds: 108,
    hintsUsed: 12,
    difficulty: 'hard',
  });
});

test('loads stored scores after a fresh leaderboard module is created', () => {
  const values = new Map();
  const firstPage = createLeaderboardHarness(values);
  firstPage.api.submit(score('Alex', 88, 2, 'medium'));

  const reloadedPage = createLeaderboardHarness(values);
  const result = reloadedPage.api.load();
  reloadedPage.api.render(result.scores, result.message);

  assert.deepEqual(JSON.parse(JSON.stringify(result.scores)), [
    score('Alex', 88, 2, 'medium'),
  ]);
  assert.equal(reloadedPage.elements.get('leaderboard-table').hidden, false);
  assert.equal(reloadedPage.elements.get('leaderboard-body').children.length, 1);
});

test('renders an empty-state message when no scores are saved', () => {
  const game = createLeaderboardHarness();
  const result = game.api.load();
  game.api.render(result.scores, result.message);

  assert.equal(game.elements.get('leaderboard-empty').hidden, false);
  assert.equal(game.elements.get('leaderboard-table').hidden, true);
});

test('clears malformed storage and ignores invalid score entries', () => {
  const values = new Map();
  const game = createLeaderboardHarness(values);
  values.set(game.api.storageKey, '{broken');

  const corrupted = game.api.load();
  assert.deepEqual(JSON.parse(JSON.stringify(corrupted.scores)), []);
  assert.match(corrupted.message, /corrupted/);
  assert.equal(values.has(game.api.storageKey), false);

  values.set(game.api.storageKey, JSON.stringify([
    score('   ', 15),
    score('Morgan', 15, 1, 'easy'),
    score('Morgan', -1),
  ]));
  const cleaned = game.api.load();
  assert.deepEqual(JSON.parse(JSON.stringify(cleaned.scores)), [
    score('Morgan', 15, 1, 'easy'),
  ]);
  assert.match(cleaned.message, /Invalid leaderboard entries/);
});

test('rejects invalid names and handles unavailable localStorage', () => {
  const game = createLeaderboardHarness(new Map(), {failGet: true, failSet: true});

  assert.equal(game.api.isValidPlayerName('   '), false);
  assert.equal(game.api.isValidPlayerName('A'.repeat(31)), false);
  assert.equal(game.api.isValidPlayerName('Ada'), true);

  const loaded = game.api.load();
  assert.match(loaded.message, /unavailable/);
  const submitted = game.api.submit(score('Ada', 60));
  assert.equal(submitted.saved, false);
  assert.equal(submitted.reason, 'storage-error');
});

test('rejects invalid score field values', () => {
  const game = createLeaderboardHarness();
  const invalidScores = [
    score('Ada', -1),
    score('Ada', 20, -1),
    score('Ada', 20, 0, 'expert'),
    {...score('Ada', 20), timeSeconds: 1.5},
    {...score('Ada', 20), hintsUsed: Number.MAX_SAFE_INTEGER + 1},
    score('Ada\nPlayer', 20),
  ];

  for (const invalidScore of invalidScores) {
    const result = game.api.submit(invalidScore);
    assert.equal(result.saved, false);
    assert.equal(result.reason, 'invalid-score');
  }
  assert.equal(game.values.size, 0);
});

test('does not replace a full leaderboard with a slower score', () => {
  const values = new Map();
  const game = createLeaderboardHarness(values);
  for (let time = 10; time < 20; time++) {
    game.api.submit(score(`Player ${time}`, time));
  }
  const before = values.get(game.api.storageKey);

  const result = game.api.submit(score('Slower', 25));

  assert.equal(result.saved, false);
  assert.equal(result.reason, 'not-qualified');
  assert.equal(values.get(game.api.storageKey), before);
});
