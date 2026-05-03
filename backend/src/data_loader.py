"""
data_loader.py — NASA CFRP .mat File Loader
Reads all .mat files from data/raw/, parses metadata and signals.
"""
import os
import re
import logging
from typing import List, Dict, Optional

import numpy as np
import scipy.io

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import DATA_RAW_PATH, N_SENSORS, SIGNAL_LENGTH

logger = logging.getLogger(__name__)


class DataLoader:
    """Loads and parses NASA CFRP Composites .mat files."""

    # NASA filename pattern: <PanelID>_C<cycle>.mat
    _FNAME_RE = re.compile(r"^(?P<panel>.+?)_C(?P<cycle>\d+)\.mat$")

    def __init__(self, raw_path: str = DATA_RAW_PATH) -> None:
        self.raw_path = raw_path
        self._cache: Dict[str, List[Dict]] = {}

    # ── Public API ──────────────────────────────────────────────────────────────

    def get_panel_ids(self) -> List[str]:
        """Return sorted list of unique panel IDs found in raw data directory."""
        panels = set()
        for fname in os.listdir(self.raw_path):
            m = self._FNAME_RE.match(fname)
            if m:
                panels.add(m.group("panel"))
        return sorted(panels)

    def load_mat_files(self, path: Optional[str] = None) -> List[Dict]:
        """
        Load ALL .mat files from directory.

        Args:
            path: Override directory (defaults to DATA_RAW_PATH).

        Returns:
            List of dicts with keys: cycle, panel_id, signals, max_cycles, material, layup.
        """
        path = path or self.raw_path
        records: List[Dict] = []
        mat_files = sorted(f for f in os.listdir(path) if f.endswith(".mat"))
        logger.info(f"Found {len(mat_files)} .mat files in {path}")

        for fname in mat_files:
            m = self._FNAME_RE.match(fname)
            if not m:
                logger.warning(f"Skipping unrecognized filename: {fname}")
                continue
            panel_id = m.group("panel")
            cycle    = int(m.group("cycle"))
            fpath    = os.path.join(path, fname)

            try:
                rec = self._parse_mat(fpath, panel_id, cycle)
                records.append(rec)
            except Exception as exc:
                logger.error(f"Failed to parse {fname}: {exc}")

        logger.info(f"Loaded {len(records)} records across {len(set(r['panel_id'] for r in records))} panels")
        return records

    def load_panel(self, panel_id: str) -> List[Dict]:
        """
        Load all cycle records for a single panel, sorted by cycle number.

        Args:
            panel_id: Panel identifier string.

        Returns:
            Sorted list of cycle record dicts.
        """
        if panel_id in self._cache:
            return self._cache[panel_id]

        all_files = sorted(
            f for f in os.listdir(self.raw_path)
            if f.endswith(".mat") and f.startswith(panel_id + "_C")
        )
        records = []
        for fname in all_files:
            m = self._FNAME_RE.match(fname)
            if not m:
                continue
            cycle = int(m.group("cycle"))
            fpath = os.path.join(self.raw_path, fname)
            try:
                rec = self._parse_mat(fpath, panel_id, cycle)
                records.append(rec)
            except Exception as exc:
                logger.error(f"Failed to parse {fname}: {exc}")

        records.sort(key=lambda r: r["cycle"])
        self._cache[panel_id] = records
        logger.info(f"Loaded panel '{panel_id}': {len(records)} cycles")
        return records

    def get_panel_metadata(self, panel_id: str) -> Dict:
        """
        Return metadata for a panel without loading all signals into memory.

        Args:
            panel_id: Panel identifier.

        Returns:
            Dict with material, layup, max_cycles, min_cycle, sensor_count, cycle_count.
        """
        records = self.load_panel(panel_id)
        if not records:
            return {}
        cycles = [r["cycle"] for r in records]
        first  = records[0]
        return {
            "panel_id":     panel_id,
            "material":     first.get("material", "Unknown"),
            "layup":        first.get("layup", "Unknown"),
            "max_cycles":   int(first.get("max_cycles", max(cycles))),
            "min_cycle":    int(min(cycles)),
            "cycle_count":  len(cycles),
            "sensor_count": N_SENSORS,
            "available_cycles": cycles,
        }

    # ── Internal helpers ────────────────────────────────────────────────────────

    def _parse_mat(self, fpath: str, panel_id: str, cycle: int) -> Dict:
        """
        Parse a single .mat file and return a standardised record dict.

        Args:
            fpath: Full path to .mat file.
            panel_id: Panel ID derived from filename.
            cycle: Cycle number derived from filename.

        Returns:
            Dict with cycle, panel_id, signals (ndarray[N_SENSORS, N_SAMPLES]),
            max_cycles, material, layup.
        """
        mat = scipy.io.loadmat(fpath, squeeze_me=True)

        # ── Signals ────────────────────────────────────────────────────────────
        signals = self._extract_signals(mat)

        # ── Scalars ────────────────────────────────────────────────────────────
        max_cycles = int(float(self._scalar(mat, "max_cycles", 18000)))
        material   = self._string(mat, "material", "Unknown")
        layup      = self._string(mat, "layup", "Unknown")

        return {
            "cycle":      cycle,
            "panel_id":   panel_id,
            "signals":    signals,
            "max_cycles": max_cycles,
            "material":   material,
            "layup":      layup,
        }

    @staticmethod
    def _extract_signals(mat: Dict) -> np.ndarray:
        """Extract (N_SENSORS, SIGNAL_LENGTH) signal array from mat dict."""
        if "signals" in mat:
            sig = np.array(mat["signals"], dtype=np.float32)
            if sig.ndim == 1:
                sig = sig.reshape(1, -1)
            if sig.shape[0] != N_SENSORS and sig.shape[1] == N_SENSORS:
                sig = sig.T
            if sig.shape[0] != N_SENSORS:
                # Pad / trim channels
                padded = np.zeros((N_SENSORS, sig.shape[1] if sig.ndim > 1 else SIGNAL_LENGTH), dtype=np.float32)
                n = min(sig.shape[0], N_SENSORS)
                padded[:n] = sig[:n]
                sig = padded
            return sig.astype(np.float32)

        # Fallback: zeros
        logger.warning("No 'signals' key found in .mat file; returning zeros.")
        return np.zeros((N_SENSORS, SIGNAL_LENGTH), dtype=np.float32)

    @staticmethod
    def _scalar(mat: Dict, key: str, default: float) -> float:
        """Safely extract a scalar from mat dict."""
        if key not in mat:
            return default
        val = mat[key]
        return float(np.squeeze(val))

    @staticmethod
    def _string(mat: Dict, key: str, default: str) -> str:
        """Safely extract a string from mat dict."""
        if key not in mat:
            return default
        val = mat[key]
        if isinstance(val, np.ndarray):
            val = val.squeeze()
            if val.ndim == 0:
                return str(val)
            return str(val[0]) if len(val) > 0 else default
        return str(val)
