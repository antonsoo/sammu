"""An independent source fixture and 60-digit Decimal calculation for previews."""
from decimal import Decimal as D, localcontext
from fractions import Fraction as F
import importlib.util
import json
from pathlib import Path
import sys

spec = importlib.util.spec_from_file_location('tuning_oracle', Path(__file__).with_name('tuning-oracle.py'))
oracle = importlib.util.module_from_spec(spec)
spec.loader.exec_module(oracle)

def exact_state(settings, moves):
    values = oracle.initial(settings['start'], settings['companion'])
    mode = settings['start']
    for direction in moves:
        string = (oracle.LOOSEN if direction == 'L' else oracle.TIGHTEN)[mode]
        factor = F(2048, 2187) if direction == 'L' else F(2187, 2048)
        values[string - 1] *= factor
        if string in [1, 2]:
            values[string + 6] *= factor
        mode = (mode + (1 if direction == 'L' else -1)) % 7
    return mode, values

def expected_practice(record, kind='comparison'):
    settings = record['settings']
    practice = record['practice']['settings']
    mode, values = exact_state(settings, record['moves'])
    pair = oracle.UNCLEAR[mode]
    changed = (oracle.LOOSEN if practice['direction'] == 'L' else oracle.TIGHTEN)[mode]
    factor = F(2048, 2187) if practice['direction'] == 'L' else F(2187, 2048)
    harmonic = [2 if n == min(pair) else 3 for n in pair] if abs(pair[0] - pair[1]) == 4 else [3 if n == min(pair) else 4 for n in pair]
    with localcontext() as ctx:
        ctx.prec = 60
        ratio = D(factor.numerator) / D(factor.denominator)
        target = abs(D(1200) * ratio.ln() / D(2).ln())
        selected_target = practice['amount'] == 'target' or kind == 'target'
        amount = target if selected_target else D(str(practice['amount']))
        assert 0 <= amount <= 180
        alteration = ratio if selected_target else D(2) ** (amount / D(1200) * (-1 if practice['direction'] == 'L' else 1))
        before = [D(values[n - 1].numerator) / D(values[n - 1].denominator) * D(settings['reference']) for n in pair]
        after = [hz * alteration if n == changed else hz for n, hz in zip(pair, before)]
        partials = [hz * h for hz, h in zip(after, harmonic)]
        gap = 0.0 if selected_target else float(abs(partials[0] - partials[1]))
    notes = []
    def add(pitches, start):
        for string, hz, h in zip(pair, pitches, harmonic):
            notes.append({'string': string, 'hz': float(hz * h if practice['listen'] == 'partials' else hz), 'start': start, 'duration': 5.0})
    if kind == 'comparison':
        add(before, 0)
        add(after, 5.35)
        duration = 10 + .35 + .12
    else:
        add(after, 0)
        duration = 5 + .12
    colour = 'sine' if practice['listen'] == 'partials' else 'plucked'
    metadata = {'pair': list(pair), 'changed': [changed] + ([changed + 7] if changed in [1, 2] else []), 'before': list(map(float, before)), 'after': list(map(float, after)), 'harmonic': harmonic, 'afterPartials': list(map(float, partials)), 'partialDifferenceHz': gap, 'targetAmount': float(target), 'errorFromTargetCents': float(amount - target)}
    return notes, duration, colour, metadata

def check_metadata(actual, expected):
    for key in ['pair', 'changed', 'harmonic']:
        assert actual[key] == expected[key], (key, actual, expected)
    for key in ['before', 'after', 'afterPartials']:
        assert len(actual[key]) == len(expected[key])
        assert all(abs(a - b) < 1e-9 for a, b in zip(actual[key], expected[key])), (key, actual, expected)
    for key in ['partialDifferenceHz', 'targetAmount', 'errorFromTargetCents']:
        assert abs(actual[key] - expected[key]) < 1e-9, (key, actual, expected)

def main():
    cases = json.load(sys.stdin)
    notes_checked = 0
    for case in cases:
        notes, duration, colour, metadata = expected_practice(case)
        check_metadata(case['practice']['preview'], metadata)
        assert len(notes) == len(case['audio']['notes'])
        assert case['audio']['colour'] == colour
        assert abs(case['audio']['duration'] - duration) < 1e-12
        for expected, actual in zip(notes, case['audio']['notes']):
            assert actual['string'] == expected['string']
            for key in ['hz', 'start', 'duration']:
                assert abs(actual[key] - expected[key]) < 1e-9, (key, actual, expected)
            notes_checked += 1
    print(json.dumps({'passed': True, 'cases': len(cases), 'note_frequencies_and_times': notes_checked, 'tolerance': 1e-9, 'method': 'Independent Fraction source fixture and 60-digit Decimal exponentials; tentative previews kept separate from exact base'}, indent=2))

if __name__ == '__main__':
    main()
