"""Shared fixtures for the ML trainer test suite.

Data factories live in tests/factories.py; this module only exposes fixtures.
"""

from __future__ import annotations

import pandas as pd
import pytest

from tests.factories import make_training_df


@pytest.fixture
def training_df() -> pd.DataFrame:
    return make_training_df()
