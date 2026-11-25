const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'starter', 'static', 'board_validation.js'),
  'utf8'
);
const context = {window: {}};
vm.runInNewContext(source, context);

function emptyBoard() {
  return Array.from({length: 9}, () => Array(9).fill(0));
}

test('detects duplicates in rows, columns, and 3x3 boxes', () => {
  const rowBoard = emptyBoard();
  rowBoard[0][0] = 4;
  rowBoard[0][8] = 4;
  assert.deepEqual(
    Array.from(context.window.boardValidation.findConflicts(rowBoard)).sort((a, b) => a - b),
    [0, 8]
  );

  const columnBoard = emptyBoard();
  columnBoard[0][0] = 4;
  columnBoard[8][0] = 4;
  assert.deepEqual(
    Array.from(context.window.boardValidation.findConflicts(columnBoard)).sort((a, b) => a - b),
    [0, 72]
  );

  const boxBoard = emptyBoard();
  boxBoard[0][0] = 4;
  boxBoard[2][2] = 4;
  assert.deepEqual(
    Array.from(context.window.boardValidation.findConflicts(boxBoard)).sort((a, b) => a - b),
    [0, 20]
  );
});

test('conflicts disappear when duplicate values are corrected', () => {
  const board = emptyBoard();
  board[1][2] = 7;
  board[1][5] = 7;

  assert.equal(context.window.boardValidation.findConflicts(board).size, 2);

  board[1][5] = 3;
  assert.equal(context.window.boardValidation.findConflicts(board).size, 0);
});
