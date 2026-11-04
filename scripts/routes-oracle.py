"""Check saved route data using independent prime-exponent initial solutions.

The existing tuning oracle solves seven linear equations rather than propagating
an application graph. Route changes here use the closed form 2^11 / 3^7 and
source-order string fixtures, not the application's retune/route implementation.
"""
import json
import math
import sys
from fractions import Fraction as F
import runpy
from pathlib import Path

fixture = runpy.run_path(str(Path(__file__).with_name("tuning-oracle.py")))
initial, LOOSEN, TIGHTEN, NAMES = (fixture[k] for k in ("initial", "LOOSEN", "TIGHTEN", "NAMES"))

cases = pitches = 0
factor = F(2) ** 11 / F(3) ** 7
for line in sys.stdin:
    data = json.loads(line)
    values = initial(data['start'], data['companion'])
    mode = data['start']

    def move(direction, mode, values):
        values = values.copy()
        string = (LOOSEN if direction == 'L' else TIGHTEN)[mode]
        multiplier = factor if direction == 'L' else 1 / factor
        values[string - 1] *= multiplier
        if string in (1, 2):
            values[string + 6] *= multiplier
        return (mode + (1 if direction == 'L' else -1)) % 7, values

    for direction in data['history']:
        mode, values = move(direction, mode, values)
    assert [F(v) for v in data['origin']] == values
    record = data['record']
    results = []
    for key, direction in [('a', 'L'), ('b', 'T')]:
        m, v = mode, values.copy()
        length = (data['target'] - mode) % 7 if key == 'a' else 7 - (data['target'] - mode) % 7
        assert len(record[key]['moves']) == length
        for step in record[key]['moves']:
            m, v = move(direction, m, v)
            assert step['tuning'] == NAMES[m]
            assert [F(s['ratioToInitialFirstString']) for s in step['strings']] == v
        assert m == data['target']
        assert [F(s['ratioToInitialFirstString']) for s in record[key]['end']['strings']] == v
        reference = record['origin']['settings']['reference']
        for string, exact in zip(record[key]['end']['strings'], v):
            assert math.isclose(string['hertz'], float(exact * reference), rel_tol=1e-12)
        results.append(v)
    assert all(b / a == 1 / factor for a, b in zip(*results))
    notes = record['sound']['notes']
    assert len(notes) == 18
    assert [n['hz'] for n in notes[:9]] == [n['hz'] for n in notes[9:]]
    assert [n['string'] for n in notes[:9]] == list(range(1, 10))
    cases += 1
    pitches += 18
print(json.dumps({'cases': cases, 'endpoint_pitches': pitches, 'b_over_a': str(1 / factor), 'cents': 1200 * math.log2(1 / factor)}))
