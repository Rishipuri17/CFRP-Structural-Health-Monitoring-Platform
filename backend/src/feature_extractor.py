"""
feature_extractor.py — Signal Feature Engineering
Extracts 272 time/frequency domain features across 16 PZT channels per cycle.
"""
import logging
from typing import Dict, List

import numpy as np
import pandas as pd
import scipy.fft
import scipy.stats

logger = logging.getLogger(__name__)

# Features extracted per channel (total = 16 × 17 = 272)
_TIME_FEATURES = [
    "mean", "std", "rms", "peak_amplitude", "crest_factor",
    "kurtosis", "skewness", "energy", "peak_to_peak",
    "zero_crossing_rate", "shape_factor",
]
_FREQ_FEATURES = [
    "spectral_mean", "spectral_peak", "spectral_entropy",
    "dominant_frequency", "spectral_rolloff", "spectral_centroid",
    "spectral_bandwidth",
]
FEATURE_NAMES_PER_CHANNEL = _TIME_FEATURES + _FREQ_FEATURES  # 18 features
N_FEATURES_PER_CHANNEL    = len(FEATURE_NAMES_PER_CHANNEL)


def _safe_divide(num: float, den: float, default: float = 0.0) -> float:
    return num / den if den != 0 else default


class FeatureExtractor:
    """Extract time and frequency domain features from PZT Lamb wave signals."""

    def __init__(self, sample_rate: float = 1.2e6) -> None:
        """
        Args:
            sample_rate: Sampling rate in Hz (default 1.2 MHz).
        """
        self.sample_rate = sample_rate

    # ── Public API ──────────────────────────────────────────────────────────────

    def extract_one(self, signals: np.ndarray) -> Dict[str, float]:
        """
        Extract full feature vector for one cycle.

        Args:
            signals: ndarray of shape (N_SENSORS, N_SAMPLES).

        Returns:
            Flat dict mapping "CH{i}_{feature_name}" → float value.
        """
        features: Dict[str, float] = {}
        n_sensors = signals.shape[0]
        for ch in range(n_sensors):
            sig = signals[ch].astype(np.float64)
            ch_feats = self._extract_channel(sig)
            for fname, fval in ch_feats.items():
                features[f"CH{ch:02d}_{fname}"] = fval
        return features

    def extract_all(self, data: List[Dict]) -> pd.DataFrame:
        """
        Extract features for all cycle records.

        Args:
            data: List of record dicts with 'signals', 'cycle', 'panel_id'.

        Returns:
            DataFrame with one row per cycle; includes cycle, panel_id, and all features.
        """
        rows = []
        for rec in data:
            feats = self.extract_one(rec["signals"])
            feats["cycle"]      = rec["cycle"]
            feats["panel_id"]   = rec["panel_id"]
            feats["max_cycles"] = rec.get("max_cycles", 18000)
            rows.append(feats)

        df = pd.DataFrame(rows)
        logger.info(f"Extracted features: {len(df)} rows × {len(df.columns)} columns")
        return df

    def get_feature_names(self, n_sensors: int = 16) -> List[str]:
        """Return ordered list of feature column names."""
        return [f"CH{ch:02d}_{f}" for ch in range(n_sensors) for f in FEATURE_NAMES_PER_CHANNEL]

    # ── Per-channel extraction ──────────────────────────────────────────────────

    def _extract_channel(self, sig: np.ndarray) -> Dict[str, float]:
        """Extract all features for a single channel signal."""
        feats: Dict[str, float] = {}

        # ── Time domain ────────────────────────────────────────────────────────
        feats["mean"]           = float(np.mean(sig))
        feats["std"]            = float(np.std(sig))
        rms                     = float(np.sqrt(np.mean(sig ** 2)))
        feats["rms"]            = rms
        peak                    = float(np.max(np.abs(sig)))
        feats["peak_amplitude"] = peak
        feats["crest_factor"]   = _safe_divide(peak, rms)
        feats["kurtosis"]       = float(scipy.stats.kurtosis(sig, fisher=True))
        feats["skewness"]       = float(scipy.stats.skew(sig))
        feats["energy"]         = float(np.sum(sig ** 2))
        feats["peak_to_peak"]   = float(np.max(sig) - np.min(sig))
        feats["shape_factor"]   = _safe_divide(rms, float(np.mean(np.abs(sig))))

        # Zero-crossing rate
        sign_changes = np.diff(np.sign(sig))
        feats["zero_crossing_rate"] = float(np.sum(sign_changes != 0)) / len(sig)

        # ── Frequency domain ────────────────────────────────────────────────────
        N      = len(sig)
        fft_vals = scipy.fft.rfft(sig)
        fft_mag  = np.abs(fft_vals)
        freqs    = scipy.fft.rfftfreq(N, d=1.0 / self.sample_rate)

        feats["spectral_mean"] = float(np.mean(fft_mag))
        feats["spectral_peak"] = float(np.max(fft_mag))

        # Spectral entropy (normalised)
        psd = fft_mag ** 2
        psd_norm = psd / (np.sum(psd) + 1e-12)
        feats["spectral_entropy"] = float(-np.sum(psd_norm * np.log2(psd_norm + 1e-12)))

        # Dominant frequency (Hz)
        feats["dominant_frequency"] = float(freqs[np.argmax(fft_mag)])

        # Spectral rolloff (85 % energy)
        cumsum = np.cumsum(psd)
        rolloff_idx = np.searchsorted(cumsum, 0.85 * cumsum[-1])
        feats["spectral_rolloff"] = float(freqs[min(rolloff_idx, len(freqs) - 1)])

        # Spectral centroid
        total_psd = np.sum(psd) + 1e-12
        feats["spectral_centroid"] = float(np.sum(freqs * psd) / total_psd)

        # Spectral bandwidth
        centroid = feats["spectral_centroid"]
        feats["spectral_bandwidth"] = float(
            np.sqrt(np.sum(((freqs - centroid) ** 2) * psd) / total_psd)
        )

        return feats
