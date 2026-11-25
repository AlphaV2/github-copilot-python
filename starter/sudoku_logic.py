import copy
import random

SIZE = 9
EMPTY = 0


def deep_copy(board):
    return copy.deepcopy(board)


def create_empty_board():
    return [[EMPTY for _ in range(SIZE)] for _ in range(SIZE)]


def is_safe(board, row, col, num):
    # Check row and column
    for x in range(SIZE):
        if board[row][x] == num or board[x][col] == num:
            return False
    # Check 3x3 box
    start_row = row - row % 3
    start_col = col - col % 3
    for i in range(3):
        for j in range(3):
            if board[start_row + i][start_col + j] == num:
                return False
    return True


def fill_board(board):
    for row in range(SIZE):
        for col in range(SIZE):
            if board[row][col] == EMPTY:
                possible = list(range(1, SIZE + 1))
                random.shuffle(possible)
                for candidate in possible:
                    if is_safe(board, row, col, candidate):
                        board[row][col] = candidate
                        if fill_board(board):
                            return True
                        board[row][col] = EMPTY
                return False
    return True


def _validate_clue_count(clues):
    if (
        isinstance(clues, bool)
        or not isinstance(clues, int)
        or not 0 <= clues <= SIZE * SIZE
    ):
        raise ValueError(f"clues must be an integer between 0 and {SIZE * SIZE}")


def remove_cells(board, clues):
    _validate_clue_count(clues)
    attempts = SIZE * SIZE - clues
    cells = [
        (row, col)
        for row in range(SIZE)
        for col in range(SIZE)
        if board[row][col] != EMPTY
    ]
    if attempts > len(cells):
        raise ValueError("board does not contain enough filled cells")
    random.shuffle(cells)
    for row, col in cells[:attempts]:
        board[row][col] = EMPTY


def _has_valid_givens(board):
    rows = [set() for _ in range(SIZE)]
    columns = [set() for _ in range(SIZE)]
    boxes = [set() for _ in range(SIZE)]

    for row in range(SIZE):
        for col in range(SIZE):
            value = board[row][col]
            if isinstance(value, bool) or not isinstance(value, int):
                return False
            if not EMPTY <= value <= SIZE:
                return False
            if value == EMPTY:
                continue

            box = (row // 3) * 3 + col // 3
            if (
                value in rows[row]
                or value in columns[col]
                or value in boxes[box]
            ):
                return False
            rows[row].add(value)
            columns[col].add(value)
            boxes[box].add(value)

    return True


def count_solutions(board, limit=2):
    """Count Sudoku solutions, stopping once ``limit`` solutions are found.

    The input must be a 9x9 list or tuple of rows. Contradictory clues or
    invalid cell values have no solutions; malformed dimensions raise
    ``ValueError``. The supplied board is never modified.
    """
    if isinstance(limit, bool) or not isinstance(limit, int) or limit < 1:
        raise ValueError("limit must be a positive integer")
    if (
        not isinstance(board, (list, tuple))
        or len(board) != SIZE
        or any(not isinstance(row, (list, tuple)) or len(row) != SIZE for row in board)
    ):
        raise ValueError(f"board must have {SIZE} rows and {SIZE} columns")

    working = [list(row) for row in board]
    if not _has_valid_givens(working):
        return 0

    solution_count = 0

    def search():
        nonlocal solution_count
        if solution_count >= limit:
            return

        best_cell = None
        best_candidates = None
        for row in range(SIZE):
            for col in range(SIZE):
                if working[row][col] != EMPTY:
                    continue
                candidates = [
                    number
                    for number in range(1, SIZE + 1)
                    if is_safe(working, row, col, number)
                ]
                if not candidates:
                    return
                if best_candidates is None or len(candidates) < len(best_candidates):
                    best_cell = (row, col)
                    best_candidates = candidates
                    if len(candidates) == 1:
                        break
            if best_candidates is not None and len(best_candidates) == 1:
                break

        if best_cell is None:
            solution_count += 1
            return

        row, col = best_cell
        for number in best_candidates:
            working[row][col] = number
            search()
            working[row][col] = EMPTY
            if solution_count >= limit:
                return

    search()
    return solution_count


def has_unique_solution(board):
    """Return whether ``board`` has exactly one valid completion."""
    return count_solutions(board, limit=2) == 1


def generate_puzzle(clues=35):
    """Generate a Sudoku puzzle with a unique solution.

    The requested clue count is a target: if removing another clue would
    make the puzzle ambiguous, that clue is kept, so the returned puzzle
    can contain more clues than requested.
    """
    _validate_clue_count(clues)

    solution = create_empty_board()
    if not fill_board(solution):
        raise RuntimeError("could not generate a complete Sudoku solution")

    puzzle = deep_copy(solution)
    cells = [
        (row, col)
        for row in range(SIZE)
        for col in range(SIZE)
    ]
    random.shuffle(cells)
    remaining_clues = SIZE * SIZE

    for row, col in cells:
        if remaining_clues <= clues:
            break
        value = puzzle[row][col]
        puzzle[row][col] = EMPTY
        if has_unique_solution(puzzle):
            remaining_clues -= 1
        else:
            puzzle[row][col] = value

    return puzzle, solution
