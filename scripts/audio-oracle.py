"""Check real browser downloads and played buffers against an independent signal.

NumPy synthesizes the expected signal from the source-order Fraction model, not
from the app's PCM or from its claimed note frequencies. This checks every sample,
including silence, envelope timing, partial amplitudes and the before/after gap.
It does not measure the sound produced by a physical speaker or ancient instrument.
"""
import importlib.util
import json
import math
from pathlib import Path
import sys
import wave
from fractions import Fraction as F

import numpy as np

spec = importlib.util.spec_from_file_location('tuning_oracle', Path(__file__).with_name('tuning-oracle.py'))
oracle = importlib.util.module_from_spec(spec)
spec.loader.exec_module(oracle)
practice_spec = importlib.util.spec_from_file_location('practice_oracle', Path(__file__).with_name('practice-oracle.py'))
practice_oracle = importlib.util.module_from_spec(practice_spec)
practice_spec.loader.exec_module(practice_oracle)
NAMED = [(2, 6), (6, 3), (3, 7), (7, 4), (4, 1), (1, 5), (5, 2)]

def states(settings, moves):
    values = oracle.initial(settings['start'], settings['companion'])
    history = [(settings['start'], list(values))]
    mode = settings['start']
    for direction in moves:
        string = (oracle.LOOSEN if direction == 'L' else oracle.TIGHTEN)[mode]
        factor = F(2048, 2187) if direction == 'L' else F(2187, 2048)
        values[string - 1] *= factor
        if string in [1, 2]:
            values[string + 6] *= factor
        mode = (mode + (1 if direction == 'L' else -1)) % 7
        history.append((mode, list(values)))
    return history

def plan_for(record, listening):
    history = states(record['settings'], record['moves'])
    mode, values = history[-1]
    reference = record['settings']['reference']
    notes = []
    def add(pitches, strings, start, duration):
        notes.extend({'string': string, 'hz': float(pitches[string - 1]) * reference, 'start': start, 'duration': duration} for string in strings)
    if listening == 'last':
        previous_mode, previous = history[-2]
        pair = oracle.UNCLEAR[previous_mode]
        add(previous, pair, 0, 1.7)
        add(values, pair, 2.05, 1.7)
        duration = 2 * 1.7 + .35 + .12
    elif listening == 'cycle':
        add(history[0][1], [1], 0, 1.7)
        add(values, [1], 2.05, 1.7)
        duration = 2 * 1.7 + .35 + .12
    elif listening == 'strum':
        for i in range(9):
            add(values, [i + 1], i * .44, .36)
        duration = 9 * .44 + .12
    else:
        add(values, NAMED[mode] if listening == 'named' else oracle.UNCLEAR[mode], 0, 1.7)
        duration = 1.7 + .12
    return notes, duration

def synthesize(notes, duration, colour, rate):
    result = np.zeros(math.ceil(duration * rate))
    harmonics = np.arange(1, 2 if colour == 'sine' else 7, dtype=float)
    weights = harmonics ** -1.5
    weights /= weights.sum()
    for note in notes:
        begin = math.ceil(note['start'] * rate)
        end = min(len(result), math.ceil((note['start'] + note['duration']) * rate))
        time = np.arange(begin, end) / rate - note['start']
        edge = np.minimum(1, np.minimum(time / .012, (note['duration'] - time) / .04))
        edge = np.clip(edge, 0, 1)
        envelope = (1 - np.cos(np.pi * edge)) / 2
        envelope[(time <= 0) | (time >= note['duration'])] = 0
        if colour == 'plucked':
            envelope *= np.exp(-2.7 * time / note['duration'])
        signal = np.sin(2 * np.pi * note['hz'] * time[:, None] * harmonics) @ weights
        result[begin:end] += .13 * envelope * signal
    return result

def main():
    report_path = Path(sys.argv[1])
    directory = report_path.parent
    report = json.loads(report_path.read_text())
    assert report['passed'], 'Browser replay did not finish.'
    results = []
    live_results = []
    samples = 0
    for case in report['audio']:
        record = json.loads((directory / case['record']['file']).read_text())
        if 'practice' in record:
            notes, duration, colour, metadata = practice_oracle.expected_practice(record)
            practice_oracle.check_metadata(record['practice']['preview'], metadata)
        else:
            notes, duration = plan_for(record, case['listening'])
            colour = record['settings']['colour']
        assert record['audio']['colour'] == colour
        assert len(notes) == len(record['audio']['notes'])
        for expected, actual in zip(notes, record['audio']['notes']):
            assert expected['string'] == actual['string']
            for key in ['hz', 'start', 'duration']:
                assert abs(expected[key] - actual[key]) < 1e-10, (case, key, expected, actual)
        with wave.open(str(directory / case['wav']['file']), 'rb') as audio:
            assert audio.getnchannels() == 1 and audio.getsampwidth() == 2 and audio.getcomptype() == 'NONE'
            rate = audio.getframerate()
            assert rate == 48000
            pcm = np.frombuffer(audio.readframes(audio.getnframes()), dtype='<i2').astype(float) / 32767
        expected = synthesize(notes, duration, colour, rate)
        assert len(pcm) == len(expected), (case, len(pcm), len(expected))
        error = float(np.max(np.abs(pcm - expected)))
        assert error < 2e-5, (case, error)
        assert np.all(pcm[-100:] == 0), case
        assert np.max(np.abs(pcm)) < .27, case
        samples += len(pcm)
        results.append({'file': case['wav']['file'], 'notes': len(notes), 'samples': len(pcm), 'max_absolute_sample_error': error})
        if 'live' in case:
            live = case['live']
            pcm = np.fromfile(directory / live['file'], dtype='<f4').astype(float)
            expected = synthesize(notes, duration, colour, live['rate'])
            assert len(pcm) == len(expected) == live['length']
            error = float(np.max(np.abs(pcm - expected)))
            assert error < 1e-7, (case, error)
            live_results.append({'file': live['file'], 'sample_rate': live['rate'], 'samples': len(pcm), 'max_absolute_sample_error': error})
        if 'targetLive' in case:
            live = case['targetLive']
            target_notes, target_duration, target_colour, _ = practice_oracle.expected_practice(record, 'target')
            pcm = np.fromfile(directory / live['file'], dtype='<f4').astype(float)
            expected = synthesize(target_notes, target_duration, target_colour, live['rate'])
            assert len(pcm) == len(expected) == live['length']
            error = float(np.max(np.abs(pcm - expected)))
            assert error < 1e-7, (case, error)
            live_results.append({'file': live['file'], 'sample_rate': live['rate'], 'samples': len(pcm), 'kind': 'exact model reference; tentative setting unchanged', 'max_absolute_sample_error': error})
    result = {'passed': True, 'wav_files': len(results), 'wav_samples': samples, 'live_buffers': len(live_results), 'max_wav_sample_error': max(r['max_absolute_sample_error'] for r in results), 'max_live_sample_error': max(r['max_absolute_sample_error'] for r in live_results), 'wav_tolerance': 2e-5, 'live_tolerance': 1e-7, 'method': 'Independent Fraction source fixture and NumPy whole-signal synthesis; played AudioBuffer samples, not speaker output', 'files': results, 'live': live_results}
    print(json.dumps(result, indent=2))

if __name__ == '__main__':
    main()
