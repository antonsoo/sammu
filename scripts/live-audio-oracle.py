"""Measure captured live output against the independent source-order fixture.

The browser review taps the real output graph; it does not ask the application
for samples. Fit sine/cosine components at independently calculated frequencies.
Phase is free because a continuous oscillator must retain its phase when tuned.
This checks a stationary signal after the glide, not a physical speaker.
"""
import importlib.util
import json
from pathlib import Path
import sys

import numpy as np

spec = importlib.util.spec_from_file_location('practice_oracle', Path(__file__).with_name('practice-oracle.py'))
practice = importlib.util.module_from_spec(spec)
spec.loader.exec_module(practice)


def inspect(entry, directory):
    query = entry['query']
    settings = {
        'start': practice.oracle.NAMES.index(query.get('start', 'isartum')),
        'reference': int(query.get('a', 440)),
        'companion': query.get('companions', 'octave'),
    }
    attempt = {
        'direction': query.get('turn', 'L'),
        'listen': query.get('listen', 'pair'),
        'amount': 'target' if query.get('cents') == 'target' else float(query.get('cents', 0)),
    }
    _, _, _, expected = practice.expected_practice({
        'settings': settings, 'moves': query.get('moves', ''), 'practice': {'settings': attempt},
    })
    samples = np.fromfile(directory / entry['file'], dtype='<f4').astype(float)
    samples = samples[entry.get('firstSample', 0):entry.get('lastSample', None)]
    assert len(samples) == entry['length'] and len(samples) > entry['rate']
    assert np.isfinite(samples).all()
    peak = float(np.max(np.abs(samples)))
    assert peak <= .2341, (entry['file'], peak)
    if entry['name'] == 'stopped':
        assert peak < 1e-8, (entry['file'], 'sound continued after stop', peak)
        return {'file': entry['file'], 'samples': len(samples), 'peak': peak, 'stopped': True}

    components = []
    weights = np.arange(1, 7, dtype=float) ** -1.5
    weights /= weights.sum()
    for voice in range(2):
        if attempt['listen'] == 'partials':
            components.append((expected['afterPartials'][voice], .13 * (1 if voice == 0 else .8)))
        else:
            components.extend((expected['after'][voice] * (i + 1), .13 * (1 if voice == 0 else .8) * weight) for i, weight in enumerate(weights))
    # Equal-frequency components combine with their retained relative phase.
    grouped = []
    for hz, amplitude in components:
        group = next((g for g in grouped if abs(g['hz'] - hz) < 1e-7), None)
        if group is None:
            grouped.append({'hz': hz, 'levels': [amplitude]})
        else:
            group['levels'].append(amplitude)
    time = np.arange(len(samples)) / entry['rate']
    frequencies = np.array([g['hz'] for g in grouped])
    expected_frequencies = frequencies.copy()
    def fit(frequencies, begin=0, end=None):
        times = time[begin:end]
        matrix = np.column_stack([fn(2 * np.pi * hz * times) for hz in frequencies for fn in [np.sin, np.cos]])
        coefficients, _, _, _ = np.linalg.lstsq(matrix, samples[begin:end], rcond=None)
        return matrix, coefficients
    # AudioParam and engine oscillator arithmetic have finite precision. Estimate
    # the very small frequency offset, bound it independently, then fit the phase.
    # A wrong tuning cannot be absorbed by an unrestricted frequency fit.
    half = len(samples) // 2
    for _ in range(4):
        _, first = fit(frequencies, 0, half)
        _, last = fit(frequencies, half, None)
        first_phase = np.arctan2(first[1::2], first[0::2])
        last_phase = np.arctan2(last[1::2], last[0::2])
        delta = np.angle(np.exp(1j * (last_phase - first_phase)))
        frequencies += delta / (2 * np.pi * (np.mean(time[half:]) - np.mean(time[:half])))
    offsets = frequencies - expected_frequencies
    assert np.max(np.abs(offsets)) < .002, (entry['file'], 'frequency offset', offsets.tolist())
    matrix, coefficients = fit(frequencies)
    residual = samples - matrix @ coefficients
    rms = float(np.sqrt(np.mean(samples ** 2)))
    error = float(np.sqrt(np.mean(residual ** 2)))
    assert error < 5e-5, (entry['file'], 'unexpected frequency components', error, rms)
    measured = []
    for i, group in enumerate(grouped):
        amplitude = float(np.hypot(coefficients[2 * i], coefficients[2 * i + 1]))
        if len(group['levels']) == 1:
            assert abs(amplitude - group['levels'][0]) < 1e-4, (entry['file'], group, amplitude)
        else:
            assert abs(group['levels'][0] - group['levels'][1]) - 1e-4 <= amplitude <= sum(group['levels']) + 1e-4, (entry['file'], group, amplitude)
        measured.append({'hz': group['hz'], 'measuredHz': float(frequencies[i]), 'offsetHz': float(offsets[i]), 'amplitude': amplitude})
    return {'file': entry['file'], 'name': entry['name'], 'samples': len(samples), 'peak': peak, 'rms': rms, 'residualRms': error, 'components': measured, 'independentPartialGapHz': expected['partialDifferenceHz']}


def main():
    source = Path(sys.argv[1])
    data = json.loads(source.read_text())
    results = [inspect(entry, source.parent) for entry in data['signals']]
    print(json.dumps({
        'passed': True,
        'captures': len(results),
        'samples': sum(r['samples'] for r in results),
        'maximumResidualRms': max(r.get('residualRms', 0) for r in results),
        'method': 'Actual browser output; independent Fraction/Decimal pitches; free-phase least-squares harmonic fit; amplitude and stopped-silence checks',
        'results': results,
    }, indent=2))


if __name__ == '__main__':
    main()
