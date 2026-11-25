// Client-side rendering and interaction for the Flask-backed Sudoku
const SIZE = 9;
let puzzle = [];
let newGameController = null;
let gameRequestId = 0;
let gameCompleted = false;
let gameReady = false;
let scoreSubmittedForGame = false;
let currentDifficulty = 'medium';
let currentHintsUsed = 0;
let leaderboardScores = [];
let pendingCompletion = null;

function createBoardElement() {
  const boardDiv = document.getElementById('sudoku-board');
  boardDiv.innerHTML = '';
  for (let i = 0; i < SIZE; i++) {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'sudoku-row';
    for (let j = 0; j < SIZE; j++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 1;
      input.className = 'sudoku-cell';
      input.classList.add(
        (Math.floor(i / 3) + Math.floor(j / 3)) % 2 === 0
          ? 'block-even'
          : 'block-odd'
      );
      input.dataset.row = i;
      input.dataset.col = j;
      input.setAttribute(
        'aria-label',
        `Row ${i + 1}, column ${j + 1}`
      );
      input.setAttribute('aria-describedby', 'input-feedback');
      rowDiv.appendChild(input);
    }
    boardDiv.appendChild(rowDiv);
  }
}

function renderPuzzle(puz) {
  puzzle = puz;
  createBoardElement();
  const boardDiv = document.getElementById('sudoku-board');
  const inputs = boardDiv.getElementsByTagName('input');
  for (let i = 0; i < SIZE; i++) {
    for (let j = 0; j < SIZE; j++) {
      const idx = i * SIZE + j;
      const val = puzzle[i][j];
      const inp = inputs[idx];
      if (val !== 0) {
        inp.value = val;
        inp.disabled = true;
        inp.className += ' prefilled';
      } else {
        inp.value = '';
        inp.disabled = false;
      }
    }
  }
  updateBoardConflicts();
}

async function newGame() {
  gameRequestId += 1;
  const requestId = gameRequestId;
  if (newGameController !== null) {
    newGameController.abort();
  }
  const controller = new AbortController();
  newGameController = controller;
  gameReady = false;
  gameCompleted = false;
  scoreSubmittedForGame = false;
  pendingCompletion = null;
  const nameDialog = document.getElementById('name-dialog');
  if (nameDialog.open) {
    nameDialog.close();
  }
  currentHintsUsed = 0;
  gameTimer.reset();
  document.getElementById('hints-used').innerText = '0';
  document.getElementById('hint').disabled = true;

  const difficulty = document.getElementById('difficulty').value;
  const message = document.getElementById('message');
  message.innerText = '';

  try {
    const res = await fetch(
      `/new?difficulty=${encodeURIComponent(difficulty)}`,
      {signal: controller.signal}
    );
    const data = await res.json();
    if (requestId !== gameRequestId) return;
    if (!res.ok) {
      throw new Error(data.error || 'Unable to start a new game.');
    }
    renderPuzzle(data.puzzle);
    gameReady = true;
    currentDifficulty = difficulty;
    document.getElementById('hint').disabled = false;
    gameTimer.start();
    document.getElementById('input-feedback').innerText = '';
  } catch (error) {
    if (requestId !== gameRequestId || error.name === 'AbortError') return;
    message.style.color = 'var(--error-color)';
    message.innerText = error instanceof Error
      ? error.message
      : 'Unable to start a new game. Please try again.';
  } finally {
    if (newGameController === controller) {
      newGameController = null;
    }
  }
}

function getBoardFromInputs() {
  const inputs = document
    .getElementById('sudoku-board')
    .getElementsByTagName('input');
  const board = [];
  for (let row = 0; row < SIZE; row++) {
    board[row] = [];
    for (let col = 0; col < SIZE; col++) {
      const value = inputs[row * SIZE + col].value;
      board[row][col] = value ? parseInt(value, 10) : 0;
    }
  }
  return board;
}

function handleBoardInput(event) {
  const input = event.target;
  if (!input.classList.contains('sudoku-cell') || input.disabled) return;

  input.value = input.value.replace(/[^1-9]/g, '').slice(0, 1);
  input.classList.remove('incorrect');
  updateBoardConflicts();
}

function updateBoardConflicts() {
  const inputs = document
    .getElementById('sudoku-board')
    .getElementsByTagName('input');
  const conflicts = window.boardValidation.findConflicts(getBoardFromInputs());

  for (let index = 0; index < inputs.length; index++) {
    const input = inputs[index];
    const hasConflict = conflicts.has(index);
    input.classList.toggle('conflict', hasConflict);
    if (hasConflict) {
      input.setAttribute('aria-invalid', 'true');
    } else {
      input.removeAttribute('aria-invalid');
    }
  }

  const feedback = document.getElementById('input-feedback');
  feedback.innerText = conflicts.size
    ? `Sudoku rule conflict in ${conflicts.size} cells.`
    : 'No Sudoku rule conflicts.';
}

async function requestHint() {
  if (!gameReady) return;

  const message = document.getElementById('message');
  if (gameCompleted) {
    message.style.color = 'var(--error-color)';
    message.innerText = 'No empty cells remain.';
    return;
  }

  const checkedGameId = gameRequestId;
  const hintButton = document.getElementById('hint');
  if (hintButton.disabled) return;
  hintButton.disabled = true;
  try {
    const res = await fetch('/hint', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({board: getBoardFromInputs()})
    });
    const data = await res.json();
    if (checkedGameId !== gameRequestId) return;
    if (!res.ok) {
      throw new Error(data.error || 'Unable to provide a hint.');
    }

    const index = data.row * SIZE + data.col;
    const input = document
      .getElementById('sudoku-board')
      .getElementsByTagName('input')[index];
    input.value = data.value;
    input.disabled = true;
    input.classList.add('hinted');
    input.setAttribute(
      'aria-label',
      `Hinted value ${data.value}, row ${data.row + 1}, column ${data.col + 1}`
    );
    document.getElementById('hints-used').innerText = String(data.hints_used);
    currentHintsUsed = data.hints_used;
    updateBoardConflicts();
    message.style.color = 'var(--success-color)';
    message.innerText = `Hint added at row ${data.row + 1}, column ${data.col + 1}.`;
  } catch (error) {
    if (checkedGameId !== gameRequestId) return;
    message.style.color = 'var(--error-color)';
    message.innerText = error instanceof Error
      ? error.message
      : 'Unable to provide a hint. Please try again.';
  } finally {
    if (checkedGameId === gameRequestId) {
      hintButton.disabled = gameCompleted;
    }
  }
}

function submitPlayerName(event) {
  event.preventDefault();
  if (!pendingCompletion || scoreSubmittedForGame) return;

  const nameInput = document.getElementById('player-name');
  const nameError = document.getElementById('name-error');
  const name = nameInput.value.trim();
  if (!window.sudokuLeaderboard.isValidPlayerName(name)) {
    nameInput.setAttribute('aria-invalid', 'true');
    nameError.innerText = 'Enter a name between 1 and 30 valid characters.';
    nameInput.focus();
    return;
  }

  nameInput.removeAttribute('aria-invalid');
  nameError.innerText = '';
  scoreSubmittedForGame = true;
  const completion = pendingCompletion;
  pendingCompletion = null;
  document.getElementById('name-dialog').close();

  const message = document.getElementById('message');
  message.innerText = `Congratulations, ${name}! You solved it in ${completion.formattedTime}.`;
  const result = window.sudokuLeaderboard.submit({
    name,
    timeSeconds: completion.timeSeconds,
    hintsUsed: completion.hintsUsed,
    difficulty: completion.difficulty,
  });
  leaderboardScores = result.scores;
  window.sudokuLeaderboard.render(result.scores, result.message);
  if (result.reason === 'not-qualified') {
    message.innerText += ' Your time did not qualify for the Top 10.';
  } else if (!result.saved) {
    message.innerText += ' Your score could not be saved.';
  }
}

function handleNameDialogClose() {
  if (!pendingCompletion) return;

  const completion = pendingCompletion;
  pendingCompletion = null;
  document.getElementById('message').innerText =
    `Congratulations! You solved it in ${completion.formattedTime}. Your score was not saved.`;
  window.sudokuLeaderboard.render(
    leaderboardScores,
    'Score not saved because no player name was provided.'
  );
}

async function checkSolution() {
  if (!gameReady || gameCompleted) return;

  const checkedGameId = gameRequestId;
  const board = getBoardFromInputs();
  const inputs = document
    .getElementById('sudoku-board')
    .getElementsByTagName('input');
  const msg = document.getElementById('message');
  let res;
  let data;
  try {
    res = await fetch('/check', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({board})
    });
    data = await res.json();
  } catch (error) {
    if (checkedGameId !== gameRequestId) return;
    msg.style.color = 'var(--error-color)';
    msg.innerText = error instanceof Error
      ? error.message
      : 'Unable to check the solution. Please try again.';
    return;
  }

  if (checkedGameId !== gameRequestId || gameCompleted) return;
  if (!res.ok || data.error) {
    msg.style.color = 'var(--error-color)';
    msg.innerText = data.error || 'Unable to check the solution.';
    return;
  }

  const incorrect = new Set(data.incorrect.map(x => x[0]*SIZE + x[1]));
  for (let idx = 0; idx < inputs.length; idx++) {
    const inp = inputs[idx];
    if (inp.disabled) continue;
    inp.classList.toggle('incorrect', incorrect.has(idx));
  }
  const isComplete = board.every(row => row.every(value => value !== 0));
  if (incorrect.size === 0 && isComplete) {
    gameCompleted = true;
    document.getElementById('hint').disabled = true;
    gameTimer.stop();
    const completionTime = gameTimer.getFormattedTime();
    const completionTimeSeconds = gameTimer.getElapsedSeconds();
    pendingCompletion = {
      formattedTime: completionTime,
      timeSeconds: completionTimeSeconds,
      hintsUsed: currentHintsUsed,
      difficulty: currentDifficulty,
    };
    msg.style.color = 'var(--success-color)';
    msg.innerText = `Congratulations! You solved it in ${completionTime}. Enter your name to save your score.`;
    document.getElementById('player-name').value = '';
    document.getElementById('name-error').innerText = '';
    document.getElementById('name-dialog').showModal();
  } else if (incorrect.size === 0) {
    msg.style.color = 'var(--error-color)';
    msg.innerText = 'Fill all cells before completing the puzzle.';
  } else {
    msg.style.color = 'var(--error-color)';
    msg.innerText = 'Some cells are incorrect.';
  }
}

// Wire buttons
window.addEventListener('load', () => {
  const savedLeaderboard = window.sudokuLeaderboard.load();
  leaderboardScores = savedLeaderboard.scores;
  window.sudokuLeaderboard.render(
    savedLeaderboard.scores,
    savedLeaderboard.message
  );
  document.getElementById('sudoku-board').addEventListener('input', handleBoardInput);
  document.getElementById('new-game').addEventListener('click', newGame);
  document.getElementById('check-solution').addEventListener('click', checkSolution);
  document.getElementById('hint').addEventListener('click', requestHint);
  document.getElementById('name-entry-form').addEventListener('submit', submitPlayerName);
  document.getElementById('skip-name').addEventListener('click', () => {
    document.getElementById('name-dialog').close();
  });
  document.getElementById('name-dialog').addEventListener('close', handleNameDialogClose);
  document.getElementById('player-name').addEventListener('input', event => {
    event.target.removeAttribute('aria-invalid');
    document.getElementById('name-error').innerText = '';
  });
  // initialize
  return newGame();
});