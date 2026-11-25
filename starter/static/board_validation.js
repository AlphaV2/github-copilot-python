(() => {
  const SIZE = 9;

  function findConflicts(board) {
    const conflicts = new Set();
    const groups = [];

    for (let row = 0; row < SIZE; row++) {
      groups.push(Array.from({length: SIZE}, (_, col) => row * SIZE + col));
    }
    for (let col = 0; col < SIZE; col++) {
      groups.push(Array.from({length: SIZE}, (_, row) => row * SIZE + col));
    }
    for (let boxRow = 0; boxRow < SIZE; boxRow += 3) {
      for (let boxCol = 0; boxCol < SIZE; boxCol += 3) {
        const box = [];
        for (let row = boxRow; row < boxRow + 3; row++) {
          for (let col = boxCol; col < boxCol + 3; col++) {
            box.push(row * SIZE + col);
          }
        }
        groups.push(box);
      }
    }

    for (const group of groups) {
      const positionsByValue = new Map();
      for (const index of group) {
        const value = board[Math.floor(index / SIZE)][index % SIZE];
        if (!Number.isInteger(value) || value < 1 || value > SIZE) continue;
        if (!positionsByValue.has(value)) {
          positionsByValue.set(value, []);
        }
        positionsByValue.get(value).push(index);
      }
      for (const positions of positionsByValue.values()) {
        if (positions.length > 1) {
          positions.forEach(index => conflicts.add(index));
        }
      }
    }

    return conflicts;
  }

  window.boardValidation = {findConflicts};
})();
