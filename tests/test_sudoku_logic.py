import copy

import pytest

import sudoku_logic


UNIQUE_PUZZLE = [
    [5, 3, 0, 0, 7, 0, 0, 0, 0],
    [6, 0, 0, 1, 9, 5, 0, 0, 0],
    [0, 9, 8, 0, 0, 0, 0, 6, 0],
    [8, 0, 0, 0, 6, 0, 0, 0, 3],
    [4, 0, 0, 8, 0, 3, 0, 0, 1],
    [7, 0, 0, 0, 2, 0, 0, 0, 6],
    [0, 6, 0, 0, 0, 0, 2, 8, 0],
    [0, 0, 0, 4, 1, 9, 0, 0, 5],
    [0, 0, 0, 0, 8, 0, 0, 7, 9],
]


def test_empty_board_has_expected_dimensions():
    board = sudoku_logic.create_empty_board()

    assert len(board) == sudoku_logic.SIZE
    assert all(len(row) == sudoku_logic.SIZE for row in board)
    assert all(
        cell == sudoku_logic.EMPTY
        for row in board
        for cell in row
    )


def test_generated_solution_satisfies_sudoku_constraints():
    _, solution = sudoku_logic.generate_puzzle()
    expected_values = set(range(1, sudoku_logic.SIZE + 1))

    assert all(set(row) == expected_values for row in solution)
    assert all(
        {solution[row][col] for row in range(sudoku_logic.SIZE)} == expected_values
        for col in range(sudoku_logic.SIZE)
    )
    assert all(
        {
            solution[row][col]
            for row in range(box_row, box_row + 3)
            for col in range(box_col, box_col + 3)
        }
        == expected_values
        for box_row in range(0, sudoku_logic.SIZE, 3)
        for box_col in range(0, sudoku_logic.SIZE, 3)
    )


def test_generated_puzzle_has_expected_dimensions_and_clue_count():
    clues = 35
    puzzle, _ = sudoku_logic.generate_puzzle(clues)

    assert len(puzzle) == sudoku_logic.SIZE
    assert all(len(row) == sudoku_logic.SIZE for row in puzzle)
    assert sum(
        cell != sudoku_logic.EMPTY
        for row in puzzle
        for cell in row
    ) == clues


def test_count_solutions_finds_one_solution_for_known_puzzle():
    assert sudoku_logic.count_solutions(UNIQUE_PUZZLE) == 1
    assert sudoku_logic.has_unique_solution(UNIQUE_PUZZLE)


def test_count_solutions_stops_at_limit_for_ambiguous_puzzle():
    ambiguous_puzzle = sudoku_logic.create_empty_board()

    assert sudoku_logic.count_solutions(ambiguous_puzzle, limit=2) == 2
    assert not sudoku_logic.has_unique_solution(ambiguous_puzzle)


def test_count_solutions_returns_zero_for_invalid_puzzle():
    invalid_puzzle = copy.deepcopy(UNIQUE_PUZZLE)
    invalid_puzzle[0][1] = 5

    assert sudoku_logic.count_solutions(invalid_puzzle) == 0


def test_count_solutions_does_not_mutate_input():
    puzzle = copy.deepcopy(UNIQUE_PUZZLE)
    original = copy.deepcopy(puzzle)

    sudoku_logic.count_solutions(puzzle)

    assert puzzle == original


def test_generated_puzzle_has_one_solution_and_preserves_requested_clues():
    clues = 35
    puzzle, solution = sudoku_logic.generate_puzzle(clues)
    expected_values = set(range(1, sudoku_logic.SIZE + 1))

    assert sudoku_logic.count_solutions(puzzle) == 1
    assert all(set(row) == expected_values for row in solution)
    assert all(
        {solution[row][col] for row in range(sudoku_logic.SIZE)} == expected_values
        for col in range(sudoku_logic.SIZE)
    )
    assert all(
        {
            solution[row][col]
            for row in range(box_row, box_row + 3)
            for col in range(box_col, box_col + 3)
        }
        == expected_values
        for box_row in range(0, sudoku_logic.SIZE, 3)
        for box_col in range(0, sudoku_logic.SIZE, 3)
    )
    assert all(
        puzzle[row][col] in (sudoku_logic.EMPTY, solution[row][col])
        for row in range(sudoku_logic.SIZE)
        for col in range(sudoku_logic.SIZE)
    )
    assert sum(
        cell != sudoku_logic.EMPTY
        for row in puzzle
        for cell in row
    ) >= clues


@pytest.mark.parametrize("clues", [-1, 82, 1.5, "35", True])
def test_generate_puzzle_rejects_invalid_clue_counts(clues):
    with pytest.raises(ValueError):
        sudoku_logic.generate_puzzle(clues)
