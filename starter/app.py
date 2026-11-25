from flask import Flask, render_template, jsonify, request
import sudoku_logic

app = Flask(__name__)

DIFFICULTY_CLUES = {
    'easy': 40,
    'medium': 32,
    'hard': 26,
}

# Keep a simple in-memory store for current puzzle and solution
CURRENT = {
    'puzzle': None,
    'solution': None,
    'hints_used': 0,
    'hinted_cells': set(),
}


def _read_board():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return None

    board = data.get('board')
    if (
        not isinstance(board, list)
        or len(board) != sudoku_logic.SIZE
        or any(not isinstance(row, list) or len(row) != sudoku_logic.SIZE for row in board)
    ):
        return None
    if any(
        type(value) is not int or not sudoku_logic.EMPTY <= value <= sudoku_logic.SIZE
        for row in board
        for value in row
    ):
        return None
    return board


def _game_is_active():
    return CURRENT.get('puzzle') is not None and CURRENT.get('solution') is not None


def _protected_cells_are_unchanged(board):
    puzzle = CURRENT['puzzle']
    solution = CURRENT['solution']
    for row in range(sudoku_logic.SIZE):
        for col in range(sudoku_logic.SIZE):
            if puzzle[row][col] != sudoku_logic.EMPTY and board[row][col] != puzzle[row][col]:
                return False
    return all(
        board[row][col] == solution[row][col]
        for row, col in CURRENT['hinted_cells']
    )


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/new')
def new_game():
    """Create a puzzle using a named difficulty or the legacy clue target."""
    difficulty = request.args.get('difficulty')
    if difficulty is not None:
        difficulty = difficulty.strip().lower()
        if difficulty not in DIFFICULTY_CLUES:
            return jsonify({
                'error': 'Invalid difficulty. Choose easy, medium, or hard.'
            }), 400
        clues = DIFFICULTY_CLUES[difficulty]
    else:
        try:
            clues = int(request.args.get('clues', 35))
        except ValueError:
            return jsonify({'error': 'clues must be an integer'}), 400

    try:
        puzzle, solution = sudoku_logic.generate_puzzle(clues)
    except ValueError as error:
        return jsonify({'error': str(error)}), 400
    CURRENT['puzzle'] = puzzle
    CURRENT['solution'] = solution
    CURRENT['hints_used'] = 0
    CURRENT['hinted_cells'] = set()
    return jsonify({'puzzle': puzzle})


@app.route('/hint', methods=['POST'])
def provide_hint():
    if not _game_is_active():
        return jsonify({'error': 'No game in progress'}), 400

    board = _read_board()
    if board is None:
        return jsonify({
            'error': 'board must be a 9x9 grid containing integers from 0 to 9'
        }), 400
    if not _protected_cells_are_unchanged(board):
        return jsonify({'error': 'Prefilled and hinted cells cannot be changed'}), 400

    for row in range(sudoku_logic.SIZE):
        for col in range(sudoku_logic.SIZE):
            if board[row][col] == sudoku_logic.EMPTY:
                value = CURRENT['solution'][row][col]
                CURRENT['hinted_cells'].add((row, col))
                CURRENT['hints_used'] += 1
                return jsonify({
                    'row': row,
                    'col': col,
                    'value': value,
                    'hints_used': CURRENT['hints_used'],
                })

    return jsonify({'error': 'No empty cells remain'}), 400


@app.route('/check', methods=['POST'])
def check_solution():
    if not _game_is_active():
        return jsonify({'error': 'No game in progress'}), 400
    board = _read_board()
    if board is None:
        return jsonify({
            'error': 'board must be a 9x9 grid containing integers from 0 to 9'
        }), 400
    if not _protected_cells_are_unchanged(board):
        return jsonify({'error': 'Prefilled and hinted cells cannot be changed'}), 400

    incorrect = []
    for i in range(sudoku_logic.SIZE):
        for j in range(sudoku_logic.SIZE):
            if (
                board[i][j] != sudoku_logic.EMPTY
                and board[i][j] != CURRENT['solution'][i][j]
            ):
                incorrect.append([i, j])
    return jsonify({'incorrect': incorrect})

if __name__ == '__main__':
    app.run(debug=True)