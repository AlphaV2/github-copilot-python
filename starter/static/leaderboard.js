(() => {
  const STORAGE_KEY = 'sudoku.top10.v1';
  const MAX_SCORES = 10;
  const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);

  function isValidPlayerName(name) {
    if (typeof name !== 'string') return false;
    const trimmed = name.trim();
    return trimmed.length >= 1
      && trimmed.length <= 30
      && !/[\u0000-\u001f\u007f]/.test(trimmed);
  }

  function normalizeScore(score) {
    if (!score || typeof score !== 'object' || Array.isArray(score)) return null;
    if (!isValidPlayerName(score.name)) return null;
    if (!Number.isSafeInteger(score.timeSeconds) || score.timeSeconds < 0) return null;
    if (!Number.isSafeInteger(score.hintsUsed) || score.hintsUsed < 0) return null;
    if (!DIFFICULTIES.has(score.difficulty)) return null;

    return {
      name: score.name.trim(),
      timeSeconds: score.timeSeconds,
      hintsUsed: score.hintsUsed,
      difficulty: score.difficulty,
    };
  }

  function rankScores(scores) {
    return scores
      .slice()
      .sort((left, right) => left.timeSeconds - right.timeSeconds)
      .slice(0, MAX_SCORES);
  }

  function load() {
    let storage;
    let raw;
    try {
      storage = window.localStorage;
      raw = storage.getItem(STORAGE_KEY);
    } catch (error) {
      return {
        scores: [],
        message: 'Leaderboard storage is unavailable in this browser.',
      };
    }

    if (raw === null) return {scores: [], message: ''};

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      try {
        storage.removeItem(STORAGE_KEY);
      } catch (removeError) {
        return {
          scores: [],
          message: 'Saved leaderboard data is corrupted and could not be cleared.',
        };
      }
      return {
        scores: [],
        message: 'Saved leaderboard data was corrupted and has been cleared.',
      };
    }

    if (!Array.isArray(parsed)) {
      try {
        storage.removeItem(STORAGE_KEY);
      } catch (removeError) {
        return {
          scores: [],
          message: 'Saved leaderboard data is invalid and could not be cleared.',
        };
      }
      return {
        scores: [],
        message: 'Saved leaderboard data was invalid and has been cleared.',
      };
    }

    const validScores = parsed.map(normalizeScore).filter(Boolean);
    const scores = rankScores(validScores);
    const wasCleaned = scores.length !== parsed.length
      || parsed.some((score, index) => {
        const normalized = normalizeScore(score);
        return !normalized || JSON.stringify(normalized) !== JSON.stringify(scores[index]);
      });
    let message = '';
    if (wasCleaned) {
      message = 'Invalid leaderboard entries were removed.';
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(scores));
      } catch (error) {
        message = 'Invalid leaderboard entries were ignored but could not be repaired.';
      }
    }

    return {scores, message};
  }

  function submit(score) {
    const normalized = normalizeScore(score);
    const current = load();
    if (!normalized) {
      return {
        scores: current.scores,
        saved: false,
        reason: 'invalid-score',
        message: 'Score data was invalid and was not saved.',
      };
    }

    const qualifies = current.scores.length < MAX_SCORES
      || normalized.timeSeconds < current.scores[MAX_SCORES - 1].timeSeconds;
    if (!qualifies) {
      return {
        scores: current.scores,
        saved: false,
        reason: 'not-qualified',
        message: 'Your time did not qualify for the Top 10.',
      };
    }

    const scores = rankScores([...current.scores, normalized]);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
      return {
        scores,
        saved: true,
        reason: 'saved',
        message: current.message || 'Score saved to the leaderboard.',
      };
    } catch (error) {
      return {
        scores: current.scores,
        saved: false,
        reason: 'storage-error',
        message: 'The score could not be saved in this browser.',
      };
    }
  }

  function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function render(scores, message = '') {
    const body = document.getElementById('leaderboard-body');
    const table = document.getElementById('leaderboard-table');
    const emptyState = document.getElementById('leaderboard-empty');
    const status = document.getElementById('leaderboard-status');
    const safeScores = rankScores(scores.map(normalizeScore).filter(Boolean));

    body.innerHTML = '';
    for (const [index, score] of safeScores.entries()) {
      const row = document.createElement('tr');
      const values = [
        String(index + 1),
        score.name,
        formatTime(score.timeSeconds),
        String(score.hintsUsed),
        score.difficulty[0].toUpperCase() + score.difficulty.slice(1),
      ];
      for (const value of values) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.appendChild(cell);
      }
      body.appendChild(row);
    }

    table.hidden = safeScores.length === 0;
    emptyState.hidden = safeScores.length !== 0;
    status.textContent = message;
  }

  window.sudokuLeaderboard = {
    isValidPlayerName,
    load,
    render,
    storageKey: STORAGE_KEY,
    submit,
  };
})();
