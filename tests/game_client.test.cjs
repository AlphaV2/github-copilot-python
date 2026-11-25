const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');

const staticDirectory = path.join(__dirname, '..', 'starter', 'static');
const clientSource = [
  'game_timer.js',
  'board_validation.js',
  'leaderboard.js',
  'main.js',
].map(file => fs.readFileSync(path.join(staticDirectory, file), 'utf8')).join('\n');

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.style = {};
    this.listeners = {};
    this.className = '';
    this.disabled = false;
    this.hidden = false;
    this.open = false;
    this.value = '';
    this.innerText = '';
    this.textContent = '';
    this._innerHTML = '';
  }

  set innerHTML(value) {
    this._innerHTML = value;
    this.children = [];
  }

  get innerHTML() {
    return this._innerHTML;
  }

  get classList() {
    const element = this;
    const classes = () => element.className.split(/\s+/).filter(Boolean);
    return {
      add(name) {
        if (!classes().includes(name)) element.className = [...classes(), name].join(' ');
      },
      contains(name) {
        return classes().includes(name);
      },
      remove(name) {
        element.className = classes().filter(item => item !== name).join(' ');
      },
      toggle(name, force) {
        const shouldAdd = force === undefined ? !classes().includes(name) : force;
        if (shouldAdd) this.add(name);
        else this.remove(name);
        return shouldAdd;
      },
    };
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  addEventListener(name, callback) {
    this.listeners[name] = callback;
  }

  showModal() {
    this.open = true;
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.dispatch('close');
  }

  focus() {
    this.focused = true;
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  getElementsByTagName(tagName) {
    return this.children.flatMap(child => [
      ...(child.tagName === tagName ? [child] : []),
      ...child.getElementsByTagName(tagName),
    ]);
  }

  dispatch(name, event = {}) {
    return this.listeners[name]?.({
      target: this,
      preventDefault() {
        this.defaultPrevented = true;
      },
      ...event,
    });
  }
}

function createClientHarness() {
  const solution = [
    [5, 3, 4, 6, 7, 8, 9, 1, 2],
    [6, 7, 2, 1, 9, 5, 3, 4, 8],
    [1, 9, 8, 3, 4, 2, 5, 6, 7],
    [8, 5, 9, 7, 6, 1, 4, 2, 3],
    [4, 2, 6, 8, 5, 3, 7, 9, 1],
    [7, 1, 3, 9, 2, 4, 8, 5, 6],
    [9, 6, 1, 5, 3, 7, 2, 8, 4],
    [2, 8, 7, 4, 1, 9, 6, 3, 5],
    [3, 4, 5, 2, 8, 6, 1, 7, 9],
  ];
  const puzzle = solution.map(row => row.slice());
  puzzle[0][0] = 0;
  puzzle[0][1] = 0;
  puzzle[0][2] = 0;
  let now = 0;
  let nextIntervalId = 1;
  let activeHints = 0;
  const intervals = new Map();
  const storedValues = new Map();
  const localStorage = {
    getItem(key) {
      return storedValues.has(key) ? storedValues.get(key) : null;
    },
    removeItem(key) {
      storedValues.delete(key);
    },
    setItem(key, value) {
      storedValues.set(key, String(value));
    },
  };
  const elements = new Map([
    ['sudoku-board', new FakeElement()],
    ['timer', new FakeElement('time')],
    ['hints-used', new FakeElement('span')],
    ['difficulty', Object.assign(new FakeElement('select'), {value: 'medium'})],
    ['message', new FakeElement('span')],
    ['name-dialog', new FakeElement('dialog')],
    ['name-entry-form', new FakeElement('form')],
    ['player-name', new FakeElement('input')],
    ['name-error', new FakeElement('p')],
    ['skip-name', new FakeElement('button')],
    ['input-feedback', new FakeElement('span')],
    ['leaderboard-body', new FakeElement('tbody')],
    ['leaderboard-table', new FakeElement('table')],
    ['leaderboard-empty', new FakeElement('p')],
    ['leaderboard-status', new FakeElement('p')],
    ['new-game', new FakeElement('button')],
    ['check-solution', new FakeElement('button')],
    ['hint', new FakeElement('button')],
  ]);
  const document = {
    createElement: tagName => new FakeElement(tagName),
    getElementById(id) {
      assert.ok(elements.has(id), `Unexpected element id: ${id}`);
      return elements.get(id);
    },
  };
  const context = {
    AbortController,
    Date: {now: () => now},
    clearInterval: id => intervals.delete(id),
    document,
    fetch: async (url, options = {}) => {
      if (url.startsWith('/new?')) {
        activeHints = 0;
        return {ok: true, json: async () => ({puzzle: puzzle.map(row => row.slice())})};
      }
      const {board} = JSON.parse(options.body);
      if (url === '/hint') {
        for (let row = 0; row < 9; row++) {
          for (let col = 0; col < 9; col++) {
            if (board[row][col] === 0) {
              activeHints++;
              return {
                ok: true,
                json: async () => ({
                  row,
                  col,
                  value: solution[row][col],
                  hints_used: activeHints,
                }),
              };
            }
          }
        }
        return {ok: false, json: async () => ({error: 'No empty cells remain'})};
      }
      if (url === '/check') {
        const incorrect = [];
        for (let row = 0; row < 9; row++) {
          for (let col = 0; col < 9; col++) {
            if (board[row][col] !== 0 && board[row][col] !== solution[row][col]) {
              incorrect.push([row, col]);
            }
          }
        }
        return {ok: true, json: async () => ({incorrect})};
      }
      throw new Error(`Unexpected request: ${url}`);
    },
    localStorage,
    setInterval(callback, delay) {
      const id = nextIntervalId++;
      intervals.set(id, {callback, delay});
      return id;
    },
    window: null,
    addEventListener(name, callback) {
      this[`${name}Handler`] = callback;
    },
  };
  context.window = context;
  vm.runInNewContext(clientSource, context);

  return {
    context,
    elements,
    intervals,
    storedValues,
    inputs() {
      return elements.get('sudoku-board').getElementsByTagName('input');
    },
    advance(seconds) {
      now += seconds * 1000;
      for (const {callback} of [...intervals.values()]) callback();
    },
    async input(index, value) {
      const input = this.inputs()[index];
      input.value = String(value);
      elements.get('sudoku-board').dispatch('input', {target: input});
    },
  };
}

test('hints, checking, completion, and timer lifecycle work together', async () => {
  const game = createClientHarness();
  await game.context.loadHandler();
  assert.equal(game.intervals.size, 1);

  await game.elements.get('hint').dispatch('click');
  const inputs = game.inputs();
  assert.equal(inputs[0].disabled, true);
  assert.ok(inputs[0].classList.contains('hinted'));
  assert.equal(game.elements.get('hints-used').innerText, '1');

  await game.input(1, 5);
  assert.ok(inputs[0].classList.contains('conflict'));
  assert.ok(inputs[1].classList.contains('conflict'));
  assert.equal(inputs[1].attributes['aria-invalid'], 'true');
  assert.match(game.elements.get('input-feedback').innerText, /rule conflict/);

  await game.input(1, 3);
  assert.ok(!inputs[0].classList.contains('conflict'));
  assert.ok(!inputs[1].classList.contains('conflict'));

  await game.elements.get('check-solution').dispatch('click');
  assert.equal(game.elements.get('message').innerText, 'Fill all cells before completing the puzzle.');
  assert.equal(game.intervals.size, 1);
  assert.equal(game.storedValues.size, 0);

  await game.input(1, 4);
  await game.elements.get('check-solution').dispatch('click');
  assert.ok(game.inputs()[1].classList.contains('incorrect'));
  assert.ok(!game.inputs()[2].classList.contains('incorrect'));
  assert.equal(game.intervals.size, 1);
  assert.equal(game.storedValues.size, 0);

  game.advance(73);
  await game.input(1, 3);
  await game.input(2, 4);
  await game.elements.get('check-solution').dispatch('click');

  assert.equal(game.elements.get('name-dialog').open, true);
  assert.equal(game.storedValues.size, 0);
  assert.match(game.elements.get('message').innerText, /Enter your name/);

  game.elements.get('player-name').value = '   ';
  await game.elements.get('name-entry-form').dispatch('submit');
  assert.equal(game.elements.get('name-dialog').open, true);
  assert.equal(game.elements.get('player-name').attributes['aria-invalid'], 'true');
  assert.equal(game.storedValues.size, 0);

  game.elements.get('player-name').value = 'Player';
  await game.elements.get('name-entry-form').dispatch('submit');
  assert.equal(game.elements.get('name-dialog').open, false);
  assert.equal(game.intervals.size, 0);
  assert.equal(game.elements.get('timer').textContent, '01:13');
  assert.match(game.elements.get('message').innerText, /Player! You solved it in 01:13/);
  assert.deepEqual(
    JSON.parse(game.storedValues.get('sudoku.top10.v1')),
    [{name: 'Player', timeSeconds: 73, hintsUsed: 1, difficulty: 'medium'}]
  );
  assert.equal(game.elements.get('leaderboard-body').children.length, 1);
  const savedScore = game.storedValues.get('sudoku.top10.v1');
  await game.elements.get('name-entry-form').dispatch('submit');
  assert.equal(game.storedValues.get('sudoku.top10.v1'), savedScore);

  await game.elements.get('check-solution').dispatch('click');
  assert.equal(game.elements.get('leaderboard-body').children.length, 1);

  await game.elements.get('new-game').dispatch('click');
  assert.equal(game.elements.get('timer').textContent, '00:00');
  assert.equal(game.elements.get('hints-used').innerText, '0');
  assert.equal(game.intervals.size, 1);
  assert.equal(JSON.parse(game.storedValues.get('sudoku.top10.v1')).length, 1);

  await Promise.all([
    game.elements.get('new-game').dispatch('click'),
    game.elements.get('new-game').dispatch('click'),
  ]);
  assert.equal(game.intervals.size, 1);
});

test('board cells identify alternating 3x3 regions', async () => {
  const game = createClientHarness();
  await game.context.loadHandler();
  const inputs = game.inputs();

  assert.ok(inputs[0].classList.contains('block-even'));
  assert.ok(inputs[3].classList.contains('block-odd'));
  assert.ok(inputs[27].classList.contains('block-odd'));
  assert.ok(inputs[30].classList.contains('block-even'));
});

test('skipping the name dialog does not save a completed game', async () => {
  const game = createClientHarness();
  await game.context.loadHandler();
  await game.input(0, 5);
  await game.input(1, 3);
  await game.input(2, 4);
  await game.elements.get('check-solution').dispatch('click');

  assert.equal(game.elements.get('name-dialog').open, true);
  await game.elements.get('skip-name').dispatch('click');

  assert.equal(game.elements.get('name-dialog').open, false);
  assert.equal(game.storedValues.size, 0);
  assert.match(game.elements.get('message').innerText, /score was not saved/);
  assert.match(game.elements.get('leaderboard-status').textContent, /no player name/);
  await game.elements.get('check-solution').dispatch('click');
  assert.equal(game.elements.get('name-dialog').open, false);
  assert.equal(game.storedValues.size, 0);
});
