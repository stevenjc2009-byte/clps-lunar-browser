"""Tests for the pure helpers in compute.py (no ephemeris data needed)."""
import sys
import types

import numpy as np
import pytest

try:
    import skyfield.api  # noqa: F401
except ImportError:
    # compute.py imports skyfield at module level; the helpers under test don't use it.
    _sky = types.ModuleType("skyfield")
    _api = types.ModuleType("skyfield.api")
    _api.Loader = _api.PlanetaryConstants = object
    _sky.api = _api
    sys.modules["skyfield"] = _sky
    sys.modules["skyfield.api"] = _api

import compute  # noqa: E402  (main() sits under a __main__ guard, so import runs nothing)
from compute import longest_run, percent, round_keep_sign  # noqa: E402


def test_round_keep_sign_small_positive_becomes_one_step():
    out = round_keep_sign(np.array([0.004]), 2)
    assert out[0] == pytest.approx(0.01)


def test_round_keep_sign_rounds_normally():
    out = round_keep_sign(np.array([1.234, 12.3456]), 2)
    assert out.tolist() == pytest.approx([1.23, 12.35])


def test_round_keep_sign_floor_follows_nd():
    out = round_keep_sign(np.array([0.0004]), 3)
    assert out[0] == pytest.approx(0.001)


def test_round_keep_sign_negatives_unchanged():
    a = np.array([-0.004, -1.236])
    out = round_keep_sign(a, 2)
    assert out.tolist() == np.round(a, 2).tolist()
    assert out[0] <= 0  # a tiny negative must stay "not above the horizon"
    assert out[1] == pytest.approx(-1.24)


def test_round_keep_sign_zero_stays_zero():
    assert round_keep_sign(np.array([0.0]), 2)[0] == 0.0


def test_round_keep_sign_mixed_array():
    out = round_keep_sign(np.array([0.004, -0.004, 0.0, 5.0]), 2)
    assert out[0] == pytest.approx(0.01)
    assert out[1] <= 0
    assert out[2] == 0.0
    assert out[3] == 5.0


def test_round_keep_sign_positive_flag_preserved_for_every_positive():
    a = np.array([0.0001, 0.004, 0.0049, 0.3])
    assert (round_keep_sign(a, 2) > 0).all()


def test_longest_run_empty():
    assert longest_run([]) == 0


def test_longest_run_all_true():
    assert longest_run([True] * 5) == 5


def test_longest_run_all_false():
    assert longest_run([False] * 5) == 0


def test_longest_run_at_start():
    assert longest_run([True, True, True, False, True]) == 3


def test_longest_run_at_end():
    assert longest_run([True, False, True, True, True, True]) == 4


def test_longest_run_numpy_mask():
    assert longest_run(np.array([0, 1, 1, 0, 1]) > 0) == 2


def test_percent_values():
    assert percent(np.array([True, False, False, False])) == 25.0
    assert percent(np.array([True, True, False])) == 66.7
    assert percent(np.array([True, True])) == 100.0
    assert percent(np.array([False, False])) == 0.0


def test_percent_from_comparison_zero_is_not_above():
    assert percent(np.array([-1.0, 0.0, 0.5, 2.0]) > 0) == 50.0


def test_import_does_not_run_main():
    assert callable(compute.main)
