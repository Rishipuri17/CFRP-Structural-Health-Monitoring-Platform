"""
simulate.py — Synthetic CFRP Lamb Wave Data Generator
Generates realistic .mat files matching NASA CFRP dataset conventions.
Each file represents one fatigue cycle measurement across 16 PZT sensors.
"""
import numpy as np
import scipy.io
import os
import sys
import logging

# Allow running from any location
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import DATA_RAW_PATH, N_SENSORS, SIGNAL_LENGTH, PANEL_CATALOGUE, RANDOM_STATE

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

rng = np.random.default_rng(RANDOM_STATE)


# ── Physics-based signal model ─────────────────────────────────────────────────

def _lamb_wave_packet(
    t: np.ndarray,
    center_freq_khz: float = 150.0,
    arrival_time_us: float = 50.0,
    amplitude: float = 1.0,
    damage_factor: float = 0.0,
) -> np.ndarray:
    """
    Generate a realistic Lamb wave packet (S0/A0 mode mixture).

    Args:
        t: Time vector in microseconds.
        center_freq_khz: Center frequency of excitation tone-burst.
        arrival_time_us: Arrival time of wave packet.
        amplitude: Baseline amplitude.
        damage_factor: 0.0 = pristine, 1.0 = severely damaged.

    Returns:
        1-D ndarray of signal amplitudes.
    """
    omega = 2 * np.pi * center_freq_khz * 1e3  # rad/s (converted)
    # Hanning-windowed tone-burst
    n_cycles = 5
    burst_duration = n_cycles / (center_freq_khz * 1e3)  # seconds
    t_shifted = (t - arrival_time_us * 1e-6)
    hanning = np.where(
        (t_shifted >= 0) & (t_shifted <= burst_duration),
        0.5 * (1 - np.cos(2 * np.pi * t_shifted / burst_duration)),
        0.0,
    )
    carrier = np.sin(omega * t_shifted)
    s0_mode = amplitude * hanning * carrier

    # A0 mode (slower, lower freq, attenuated)
    a0_arrival = arrival_time_us * 1.6e-6
    t_a0 = t - a0_arrival
    hanning_a0 = np.where(
        (t_a0 >= 0) & (t_a0 <= burst_duration * 1.5),
        0.5 * (1 - np.cos(2 * np.pi * t_a0 / (burst_duration * 1.5))),
        0.0,
    )
    a0_mode = amplitude * 0.45 * hanning_a0 * np.sin(0.6 * omega * t_a0)

    # Damage effects: scattered waves, attenuation, baseline shift
    scatter_phase = rng.uniform(0, 2 * np.pi)
    scatter = (
        damage_factor
        * amplitude
        * 0.35
        * np.exp(-((t - arrival_time_us * 2.5e-6) ** 2) / (2 * (arrival_time_us * 0.4e-6) ** 2))
        * np.sin(omega * 0.7 * t + scatter_phase)
    )

    noise_std = 0.03 + 0.07 * damage_factor
    noise = rng.normal(0, noise_std * amplitude, size=len(t))

    # Amplitude decay due to delamination / crack growth
    attenuation = 1.0 - 0.4 * damage_factor
    return attenuation * (s0_mode + a0_mode + scatter) + noise


def generate_panel_signals(
    panel_id: str,
    cycle: int,
    max_cycle: int,
) -> np.ndarray:
    """
    Generate 16-channel Lamb wave signals for a given fatigue cycle.

    Args:
        panel_id: Unique panel identifier string.
        cycle: Current fatigue cycle number.
        max_cycle: Maximum cycle count for this panel (total life).

    Returns:
        ndarray of shape (N_SENSORS, SIGNAL_LENGTH).
    """
    life_fraction = cycle / max_cycle  # 0 → 1
    # Non-linear damage progression (Paris law inspired)
    damage_factor = min(1.0, (life_fraction / 0.75) ** 2.5) if life_fraction < 0.75 else 1.0
    damage_factor = max(0.0, damage_factor + rng.normal(0, 0.01))  # small stochastic noise

    sample_rate = 1.2e6  # 1.2 MHz
    t = np.linspace(0, SIGNAL_LENGTH / sample_rate, SIGNAL_LENGTH)

    signals = np.zeros((N_SENSORS, SIGNAL_LENGTH), dtype=np.float32)
    for ch in range(N_SENSORS):
        # Each sensor has slightly different path length / response
        path_factor = 1.0 + 0.3 * np.sin(2 * np.pi * ch / N_SENSORS)
        arrival = 30.0 + 20.0 * path_factor  # µs
        freq = 120.0 + 60.0 * (ch % 4) / 4  # kHz, varies by sensor position
        amp = rng.uniform(0.8, 1.2) * path_factor

        # Localized damage: sensors near crack show stronger scattering
        local_damage = damage_factor * (1.0 + 0.5 * np.sin(np.pi * ch / (N_SENSORS - 1)))
        local_damage = min(1.0, local_damage)

        signals[ch] = _lamb_wave_packet(t, freq, arrival, amp, local_damage)

    return signals


def generate_dataset(
    panel_id: str,
    max_cycles: int,
    n_snapshots: int = 60,
    out_dir: str = DATA_RAW_PATH,
) -> None:
    """
    Generate synthetic dataset for one panel and save as .mat files.
    Filenames follow NASA convention: <PanelID>_C<cycle:06d>.mat

    Args:
        panel_id: Panel identifier.
        max_cycles: Total fatigue life of the coupon.
        n_snapshots: Number of cycle snapshots to generate.
        out_dir: Output directory for .mat files.
    """
    os.makedirs(out_dir, exist_ok=True)
    # Sample cycles more densely near end-of-life (crack acceleration)
    t_norm = np.linspace(0, 1, n_snapshots) ** 0.6
    cycles = (t_norm * max_cycles).astype(int)
    cycles = np.unique(np.clip(cycles, 0, max_cycles))

    logger.info(f"Generating {len(cycles)} snapshots for panel '{panel_id}' (max_cycles={max_cycles})")

    for cycle in cycles:
        signals = generate_panel_signals(panel_id, cycle, max_cycles)
        mat_data = {
            "signals":    signals,          # (16, 1500) float32
            "cycle":      np.array([[cycle]], dtype=np.float64),
            "panel_id":   np.array([[panel_id]]),
            "max_cycles": np.array([[max_cycles]], dtype=np.float64),
            "n_sensors":  np.array([[N_SENSORS]], dtype=np.float64),
            "sample_rate": np.array([[1.2e6]], dtype=np.float64),
            "material":   np.array([[PANEL_CATALOGUE[panel_id]["material"]]]),
            "layup":      np.array([[PANEL_CATALOGUE[panel_id]["layup"]]]),
        }
        fname = f"{panel_id}_C{cycle:06d}.mat"
        scipy.io.savemat(os.path.join(out_dir, fname), mat_data)

    logger.info(f"  ✓ Saved {len(cycles)} files to {out_dir}")


def main() -> None:
    """Entry point: generate synthetic datasets for all panels in catalogue."""
    logger.info("=" * 60)
    logger.info("CFRP SHM — Synthetic Data Generator")
    logger.info("=" * 60)

    existing = [f for f in os.listdir(DATA_RAW_PATH) if f.endswith(".mat")]
    if existing:
        logger.info(f"Found {len(existing)} existing .mat files — skipping generation.")
        logger.info("Delete data/raw/*.mat to force regeneration.")
        return

    for panel_id, specs in PANEL_CATALOGUE.items():
        generate_dataset(
            panel_id=panel_id,
            max_cycles=specs["max_cycles"],
            n_snapshots=60,
        )

    total = len([f for f in os.listdir(DATA_RAW_PATH) if f.endswith(".mat")])
    logger.info(f"\n✓ Generation complete. Total .mat files: {total}")


if __name__ == "__main__":
    main()
