const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');

const timerSource = fs.readFileSync(
  path.join(__dirname, '..', 'starter', 'static', 'game_timer.js'),
  'utf8'
);

function createTimerHarness() {
  let now = 0;
  let nextIntervalId = 1;
  const intervals = new Map();
  const display = {textContent: '00:00'};
  const context = {
    Date: {now: () => now},
    clearInterval: (id) => intervals.delete(id),
    document: {
      getElementById: (id) => {
        assert.equal(id, 'timer');
        return display;
      },
    },
    setInterval: (callback, delay) => {
      const id = nextIntervalId++;
      intervals.set(id, {callback, delay});
      return id;
    },
    window: {},
  };

  vm.runInNewContext(timerSource, context);

  return {
    display,
    intervals,
    timer: context.window.gameTimer,
    advance(seconds) {
      now += seconds * 1000;
      for (const {callback} of intervals.values()) {
        callback();
      }
    },
  };
}

test('timer formats elapsed time and freezes after stopping', () => {
  const {display, intervals, timer, advance} = createTimerHarness();

  timer.start();
  advance(65);
  assert.equal(display.textContent, '01:05');
  timer.stop();
  advance(20);

  assert.equal(display.textContent, '01:05');
  assert.equal(timer.getFormattedTime(), '01:05');
  assert.equal(intervals.size, 0);
});

test('reset and repeated starts leave at most one active interval', () => {
  const {display, intervals, timer, advance} = createTimerHarness();

  timer.start();
  advance(8);
  timer.start();
  assert.equal(display.textContent, '00:00');
  assert.equal(intervals.size, 1);

  advance(3);
  assert.equal(display.textContent, '00:03');
  timer.reset();

  assert.equal(display.textContent, '00:00');
  assert.equal(intervals.size, 0);
});
