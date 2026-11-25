const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');

const themeSource = fs.readFileSync(
  path.join(__dirname, '..', 'starter', 'static', 'theme.js'),
  'utf8'
);

class FakeElement {
  constructor() {
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.innerText = '';
  }

  addEventListener(name, callback) {
    this.listeners[name] = callback;
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  dispatch(name) {
    return this.listeners[name]?.({target: this});
  }
}

function loadTheme(storage) {
  const root = new FakeElement();
  const toggle = new FakeElement();
  const status = new FakeElement();
  const elements = new Map([
    ['theme-toggle', toggle],
    ['theme-status', status],
  ]);
  const document = {
    documentElement: root,
    getElementById: id => elements.get(id),
  };
  const window = {localStorage: storage};
  vm.runInNewContext(themeSource, {document, window});
  return {root, status, toggle};
}

test('theme toggle persists the choice and restores it on load', () => {
  const values = new Map();
  const storage = {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
  };

  const firstLoad = loadTheme(storage);
  assert.equal(firstLoad.root.dataset.theme, 'light');
  assert.equal(firstLoad.toggle.attributes['aria-pressed'], 'false');
  firstLoad.toggle.dispatch('click');
  assert.equal(firstLoad.root.dataset.theme, 'dark');
  assert.equal(firstLoad.toggle.attributes['aria-pressed'], 'true');
  assert.equal(values.get('sudoku.theme.v1'), 'dark');

  const secondLoad = loadTheme(storage);
  assert.equal(secondLoad.root.dataset.theme, 'dark');
  assert.equal(secondLoad.toggle.innerText, 'Switch to light mode');
});

test('invalid saved themes fall back to light mode', () => {
  const {root, status} = loadTheme({
    getItem: () => 'sepia',
    setItem() {},
  });

  assert.equal(root.dataset.theme, 'light');
  assert.match(status.innerText, /Invalid saved theme/);
});

test('theme remains usable when localStorage is unavailable', () => {
  const {root, status, toggle} = loadTheme({
    getItem() {
      throw new Error('Storage unavailable');
    },
    setItem() {
      throw new Error('Storage unavailable');
    },
  });

  assert.equal(root.dataset.theme, 'light');
  assert.match(status.innerText, /could not be loaded/);
  toggle.dispatch('click');
  assert.equal(root.dataset.theme, 'dark');
  assert.match(status.innerText, /could not be saved/);
});
