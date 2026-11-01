"""Inspect actual audio-thread captures independently of the player code.

The last pre-stop sample is bounded by one sample of a linear release from
the maximum possible signal. A stop must leave exact digital silence. Capture
coordinates come from render frames, not wall-clock guesses.
"""
import array
import json
import math
from pathlib import Path
import sys


def inspect(source):
    data = json.loads(source.read_text())
    results = []
    for row in data['rows']:
        stops = []
        for entry in row['stops'] + [row['comparison']]:
            samples = array.array('f')
            samples.frombytes((source.parent / entry['file']).read_bytes())
            if sys.byteorder != 'little':
                samples.byteswap()
            assert len(samples) == entry['samples']
            assert all(math.isfinite(x) for x in samples)
            cutoff = math.ceil(entry['at'] * entry['rate']) - entry['firstFrame']
            assert 2 < cutoff < len(samples) - 128, entry
            assert max(map(abs, samples[cutoff:])) == 0, entry
            comparison = entry == row['comparison']
            bound = (.26 / .02 if comparison else .234 / .04) / entry['rate'] + 2e-6
            jump = abs(samples[cutoff - 1])
            stops.append({'file': entry['file'], 'lastSampleMagnitude': jump,
                          'linearReleaseBound': bound, 'withinBound': jump <= bound,
                          'exactSilenceAfterCutoff': True})
        entry = row['resumed']
        samples = array.array('f')
        samples.frombytes((source.parent / entry['file']).read_bytes())
        if sys.byteorder != 'little':
            samples.byteswap()
        start = entry['resumeFrame'] - entry['firstFrame'] + math.ceil(.008 * entry['rate'])
        assert 0 <= start < len(samples) - entry['rate'] // 4, entry
        peak = max(map(abs, samples[start:]))
        if data['phase'] == 'after':
            assert all(s['withinBound'] for s in stops), stops
            assert peak == 0, (row['engine'], peak)
            assert row['recoveredClosed'] is True
        comparison_peak = None
        if 'comparisonResumed' in row:
            entry = row['comparisonResumed']
            other = array.array('f')
            other.frombytes((source.parent / entry['file']).read_bytes())
            if sys.byteorder != 'little':
                other.byteswap()
            begin = entry['resumeFrame'] - entry['firstFrame'] + math.ceil(.008 * entry['rate'])
            assert 0 <= begin < len(other) - entry['rate'] // 4, entry
            comparison_peak = max(map(abs, other[begin:]))
            assert comparison_peak == 0, (row['engine'], comparison_peak)
        results.append({'engine': row['engine'], 'stops': stops,
                        'resumedWithoutStartPeakAfter8ms': peak,
                        'comparisonResumedWithoutStartPeakAfter8ms': comparison_peak,
                        'explicitClosedContextRetry': row['recoveredClosed']})
    return {'phase': data['phase'], 'engines': results,
            'method': 'Actual contiguous audio-thread samples; one-sample linear release bound; exact post-stop silence; resume probe after 8 ms; explicit retry'}


print(json.dumps(inspect(Path(sys.argv[1])), indent=2))
