import copy

import pytest

import sudoku_logic

import app as app_module


def test_index_returns_successful_response(client):
    response = client.get("/")

    assert response.status_code == 200


def test_index_includes_difficulty_options(client):
    response = client.get("/")

    assert b'value="easy"' in response.data
    assert b'value="medium"' in response.data
    assert b'value="hard"' in response.data


def test_index_includes_timer_and_timer_script(client):
    response = client.get("/")

    assert b'id="timer">00:00</time>' in response.data
    assert b'/static/game_timer.js' in response.data
    assert response.data.count(b'/static/leaderboard.js') == 1
    assert b'<dialog id="name-dialog"' in response.data
    assert b'id="name-entry-form"' in response.data
    assert b'id="hint"' in response.data
    assert b'id="hints-used">0</span>' in response.data
    assert b'/static/board_validation.js' in response.data


def test_new_returns_generated_puzzle(client):
    response = client.get("/new")

    assert response.status_code == 200
    puzzle = response.get_json()["puzzle"]
    assert len(puzzle) == sudoku_logic.SIZE
    assert all(len(row) == sudoku_logic.SIZE for row in puzzle)
    assert sum(value != sudoku_logic.EMPTY for row in puzzle for value in row) == 35


@pytest.mark.parametrize(
    ("difficulty", "expected_clues"),
    [("easy", 40), ("medium", 32), ("hard", 26)],
)
def test_new_generates_unique_puzzle_for_difficulty(
    client, monkeypatch, difficulty, expected_clues
):
    original_generate_puzzle = sudoku_logic.generate_puzzle
    requested_clues = []

    def generate_and_record(clues):
        requested_clues.append(clues)
        return original_generate_puzzle(clues)

    monkeypatch.setattr(
        app_module.sudoku_logic,
        "generate_puzzle",
        generate_and_record,
    )
    response = client.get("/new", query_string={"difficulty": difficulty})

    assert response.status_code == 200
    assert requested_clues == [expected_clues]
    puzzle = response.get_json()["puzzle"]
    assert sum(value != sudoku_logic.EMPTY for row in puzzle for value in row) >= expected_clues
    assert sudoku_logic.count_solutions(puzzle) == 1


def test_new_rejects_invalid_difficulty(client):
    response = client.get("/new", query_string={"difficulty": "expert"})

    assert response.status_code == 400
    assert response.get_json() == {
        "error": "Invalid difficulty. Choose easy, medium, or hard."
    }


def test_new_keeps_clues_parameter_compatible(client, monkeypatch):
    original_generate_puzzle = sudoku_logic.generate_puzzle
    requested_clues = []

    def generate_and_record(clues):
        requested_clues.append(clues)
        return original_generate_puzzle(clues)

    monkeypatch.setattr(
        app_module.sudoku_logic,
        "generate_puzzle",
        generate_and_record,
    )
    response = client.get("/new", query_string={"clues": 40})

    assert response.status_code == 200
    assert requested_clues == [40]


def test_check_accepts_valid_game_state(client):
    client.get("/new")
    solution = app_module.CURRENT["solution"]

    response = client.post("/check", json={"board": solution})

    assert response.status_code == 200
    assert response.get_json() == {"incorrect": []}


def test_check_reports_missing_active_game(client):
    response = client.post("/check", json={"board": sudoku_logic.create_empty_board()})

    assert response.status_code == 400
    assert response.get_json() == {"error": "No game in progress"}


def test_hint_returns_one_correct_cell_without_revealing_solution(client):
    client.get("/new")
    puzzle = copy.deepcopy(app_module.CURRENT["puzzle"])
    solution = app_module.CURRENT["solution"]

    response = client.post("/hint", json={"board": puzzle})

    assert response.status_code == 200
    data = response.get_json()
    assert set(data) == {"row", "col", "value", "hints_used"}
    row, col = data["row"], data["col"]
    assert puzzle[row][col] == sudoku_logic.EMPTY
    assert data["value"] == solution[row][col]
    assert data["hints_used"] == 1
    assert app_module.CURRENT["hints_used"] == 1


def test_hint_locked_cell_cannot_be_changed(client):
    client.get("/new")
    board = copy.deepcopy(app_module.CURRENT["puzzle"])
    hint = client.post("/hint", json={"board": board}).get_json()
    board[hint["row"]][hint["col"]] = hint["value"]
    board[hint["row"]][hint["col"]] = hint["value"] % sudoku_logic.SIZE + 1

    response = client.post("/check", json={"board": board})

    assert response.status_code == 400
    assert response.get_json() == {
        "error": "Prefilled and hinted cells cannot be changed"
    }


def test_hint_counter_resets_when_new_game_starts(client):
    client.get("/new")
    board = copy.deepcopy(app_module.CURRENT["puzzle"])
    client.post("/hint", json={"board": board})
    assert app_module.CURRENT["hints_used"] == 1

    response = client.get("/new")

    assert response.status_code == 200
    assert app_module.CURRENT["hints_used"] == 0
    assert app_module.CURRENT["hinted_cells"] == set()


def test_hint_returns_no_cell_when_board_is_complete(client):
    client.get("/new")
    solution = app_module.CURRENT["solution"]

    response = client.post("/hint", json={"board": solution})

    assert response.status_code == 400
    assert response.get_json() == {"error": "No empty cells remain"}
    assert app_module.CURRENT["hints_used"] == 0


def test_hint_reports_missing_game(client):
    response = client.post(
        "/hint",
        json={"board": sudoku_logic.create_empty_board()},
    )

    assert response.status_code == 400
    assert response.get_json() == {"error": "No game in progress"}


@pytest.mark.parametrize(
    ("endpoint", "payload"),
    [
        ("/hint", {}),
        ("/check", {"board": [[0] * 8 for _ in range(9)]}),
        ("/hint", {"board": [[0] * 9 for _ in range(8)]}),
        ("/check", {"board": [[0] * 9 for _ in range(8)]}),
        ("/hint", {"board": [[0] * 9 for _ in range(8)] + [[False] * 9]}),
        ("/check", {"board": [[0] * 9 for _ in range(8)] + [[10] * 9]}),
    ],
)
def test_hint_and_check_reject_malformed_boards(client, endpoint, payload):
    client.get("/new")

    response = client.post(endpoint, json=payload)

    assert response.status_code == 400
    assert response.get_json() == {
        "error": "board must be a 9x9 grid containing integers from 0 to 9"
    }


@pytest.mark.parametrize("endpoint", ["/hint", "/check"])
def test_hint_and_check_reject_malformed_json(client, endpoint):
    client.get("/new")

    response = client.post(
        endpoint,
        data="{invalid json",
        content_type="application/json",
    )

    assert response.status_code == 400
    assert response.get_json() == {
        "error": "board must be a 9x9 grid containing integers from 0 to 9"
    }


def test_check_ignores_empty_cells_but_reports_incorrect_entries(client):
    client.get("/new")
    puzzle = app_module.CURRENT["puzzle"]
    solution = app_module.CURRENT["solution"]
    board = copy.deepcopy(solution)
    empty_cells = [
        (row, col)
        for row in range(sudoku_logic.SIZE)
        for col in range(sudoku_logic.SIZE)
        if puzzle[row][col] == sudoku_logic.EMPTY
    ]
    incorrect_cell, empty_cell = empty_cells[:2]
    row, col = incorrect_cell
    board[row][col] = solution[row][col] % sudoku_logic.SIZE + 1
    board[empty_cell[0]][empty_cell[1]] = sudoku_logic.EMPTY

    response = client.post("/check", json={"board": board})

    assert response.status_code == 200
    assert response.get_json() == {"incorrect": [[row, col]]}
