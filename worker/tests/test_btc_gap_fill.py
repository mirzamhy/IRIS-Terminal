import numpy as np
import pandas as pd

from iris_worker.data.sources import fill_btc_gaps


def test_fills_missing_day_from_patch_and_carries_volume():
    idx = pd.to_datetime(["2026-10-18", "2026-10-19"])
    btc = pd.DataFrame({"open": [1.0, 2.0], "high": [1.0, 2.0], "low": [1.0, 2.0], "close": [1.0, 2.0], "volume": [10.0, 20.0]}, index=idx)
    patch = pd.DataFrame(
        {"open": [2.0, 3.0], "high": [2.0, 3.0], "low": [2.0, 3.0], "close": [2.5, 3.5], "volume": [np.nan, np.nan]},
        index=pd.to_datetime(["2026-10-19", "2026-10-20"]),
    )
    out = fill_btc_gaps(btc, pd.Timestamp("2026-10-20"), patch)
    assert out.index.max() == pd.Timestamp("2026-10-20")
    assert out.loc["2026-10-20", "close"] == 3.5
    assert out.loc["2026-10-20", "volume"] == 20.0
    # Existing Yahoo rows are never overwritten.
    assert out.loc["2026-10-19", "close"] == 2.0


def test_no_gap_returns_input():
    idx = pd.to_datetime(["2026-10-19", "2026-10-20"])
    btc = pd.DataFrame({"open": 1.0, "high": 1.0, "low": 1.0, "close": 1.0, "volume": 1.0}, index=idx)
    assert fill_btc_gaps(btc, pd.Timestamp("2026-10-20"), btc) is btc
