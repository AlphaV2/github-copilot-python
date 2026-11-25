import sys
from pathlib import Path

import pytest


STARTER_DIR = Path(__file__).resolve().parents[1] / "starter"
sys.path.insert(0, str(STARTER_DIR))

import app as app_module


@pytest.fixture
def client():
    app_module.CURRENT.update(
        puzzle=None,
        solution=None,
        hints_used=0,
        hinted_cells=set(),
    )
    with app_module.app.test_client() as test_client:
        yield test_client
    app_module.CURRENT.update(
        puzzle=None,
        solution=None,
        hints_used=0,
        hinted_cells=set(),
    )
