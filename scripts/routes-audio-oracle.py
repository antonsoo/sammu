"""Verify PCM supplied to Web Audio against an independent numerical realization.

Uses source fixtures and a prime-exponent linear solver for initial pitches,
closed-form retuning multipliers, then NumPy sine synthesis. Does not import
application notes, samples, envelopes or partial generation. This checks the
scheduled buffer, not a physical speaker or a listener's subjective response.
"""
import json
from pathlib import Path
import runpy
import sys
import wave
from fractions import Fraction as F
import numpy as np

fixture = runpy.run_path(str(Path(__file__).with_name('tuning-oracle.py')))
initial = fixture['initial']
report_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/tmp/claude-1000/sammu-routes/browser/report.json')
report = json.loads(report_path.read_text())
assert report['passed']
directory = report_path.parent
errors = []
checked_notes = 0

for entry in report['audio']:
    data = json.loads((directory / entry['record']).read_text())
    settings = data['origin']['settings']
    values = initial(settings['start'], settings['companion'])
    mode = settings['start']
    factor = F(2048, 2187)

    def walk(directions, mode, values):
        values = values.copy()
        for direction in directions:
            string = fixture['LOOSEN' if direction == 'L' else 'TIGHTEN'][mode]
            multiplier = factor if direction == 'L' else 1 / factor
            values[string - 1] *= multiplier
            if string in (1, 2):
                values[string + 6] *= multiplier
            mode = (mode + (1 if direction == 'L' else -1)) % 7
        return mode, values

    mode, values = walk(data['origin']['priorMoves'], mode, values)
    target = fixture['NAMES'].index(data['target'])
    count = (target - mode) % 7
    _, a = walk('L' * count, mode, values)
    _, b = walk('T' * (7 - count), mode, values)
    if data['listening']['aligned']:
        b = [value * factor for value in b]
    strings = list(range(1, 10)) if data['listening']['string'] == 'all' else [data['listening']['string']]
    duration = 0.36 if len(strings) == 9 else 1.7
    spacing = 0.44 if len(strings) == 9 else 0
    block = (len(strings) - 1) * spacing + duration
    rate = entry['sampleRate']
    total = 2 * block + 0.55 + 0.12
    expected = np.zeros(int(np.ceil(total * rate)), dtype=np.float32)
    harmonics = np.arange(1, 7 if settings['colour'] == 'plucked' else 2)
    weights = 1 / harmonics.astype(float) ** 1.5
    weights /= weights.sum()
    for second, pitches in enumerate([a, b]):
        for i, string in enumerate(strings):
            start = second * (block + 0.55) + i * spacing
            hz = float(pitches[string - 1] * settings['reference'])
            first, last = int(np.ceil(start * rate)), int(np.ceil((start + duration) * rate))
            times = np.arange(first, last) / rate - start
            edge = np.clip(np.minimum(times / 0.012, (duration - times) / 0.04), 0, 1)
            envelope = (1 - np.cos(np.pi * edge)) / 2
            if settings['colour'] == 'plucked':
                envelope *= np.exp(-2.7 * times / duration)
            value = sum(weight * np.sin(2 * np.pi * hz * harmonic * times) for harmonic, weight in zip(harmonics, weights))
            expected[first:last] += (0.13 * envelope * value).astype(np.float32)
            checked_notes += 1
    actual = np.fromfile(directory / entry['file'], dtype='<f4')
    assert actual.shape == expected.shape
    error = float(np.max(np.abs(actual - expected)))
    assert error < 4e-8, (entry['file'], error)
    errors.append(error)
    # The comparison WAV and standalone HTML's native WAV must agree byte for byte.
    if data['listening']['aligned']:
        tag = entry['file'].removesuffix('-aligned.f32')
        assert (directory / f'{tag}.wav').read_bytes() == (directory / f'{tag}-embedded.wav').read_bytes()
        with wave.open(str(directory / f'{tag}.wav'), 'rb') as sound:
            wav_rate = sound.getframerate()
            samples = np.frombuffer(sound.readframes(sound.getnframes()), dtype='<i2')
            assert sound.getnchannels() == 1 and sound.getsampwidth() == 2
            if wav_rate == rate:
                quantized = np.floor(expected.astype(float) * 32767 + 0.5).astype(np.int16)
                assert np.max(np.abs(samples.astype(int) - quantized.astype(int))) <= 1
print(json.dumps({'passed': True, 'scheduled_buffers': len(errors), 'independent_notes': checked_notes, 'max_sample_error': max(errors)}))
