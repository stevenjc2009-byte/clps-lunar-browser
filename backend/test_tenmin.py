"""Pure helpers in tenmin.py: Catmull-Rom spline and crossing refinement."""
import numpy as np
import pytest

pytest.importorskip("skyfield")

from tenmin import catmull_rom, crossings, match_errors  # noqa: E402


def test_catmull_rom_hits_samples():
    y = np.array([0.0, 1.0, -2.0, 5.0, 3.0])
    assert catmull_rom(y, np.arange(5.0)) == pytest.approx(y)


def test_catmull_rom_exact_for_quadratic_inside():
    x = np.arange(10.0)
    y = 0.3 * x ** 2 - 2 * x + 1
    xs = np.linspace(1, 8, 141)
    assert catmull_rom(y, xs) == pytest.approx(0.3 * xs ** 2 - 2 * xs + 1, abs=1e-12)


def test_crossings_linear_refinement():
    y = np.array([-1.0, 1.0, 3.0, -1.0])
    assert crossings(y, 10.0) == pytest.approx([5.0, 27.5])


def test_crossings_zero_counts_as_not_above():
    assert crossings(np.array([1.0, 0.0, 1.0]), 1.0) == pytest.approx([1.0, 1.0])


def test_match_errors():
    assert match_errors(np.array([10.0, 50.0]), np.array([11.0, 48.0])) == (2.0, 0)
    dt, mism = match_errors(np.array([10.0]), np.array([]))
    assert dt == float("inf") and mism == 1
