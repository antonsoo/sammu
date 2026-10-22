"""Independent exact linear constraints, source-order fixture and breadth-first routes.

The application propagates fractions through a graph. This oracle instead solves
two seven-variable linear systems of prime exponents by Gaussian elimination.
Transitions use the independently derived alteration factor, not that graph code.
"""
import json
import sys
from collections import deque
from fractions import Fraction as F

# Mirelman (2013), fig. 5, p. 52, with source pair order preserved.
NAMES = ['isartum', 'kitmum', 'embubum', 'pitum', 'nid-qablim', 'nis-tuhrim', 'qablitum']
PAIRS = [(1, 5), (2, 6), (3, 7), (4, 1), (5, 2), (6, 3), (7, 4)]
UNCLEAR = [(5, 2), (2, 6), (6, 3), (3, 7), (7, 4), (4, 1), (1, 5)]
LOOSEN = [2, 6, 3, 7, 4, 1, 5]
TIGHTEN = [5, 2, 6, 3, 7, 4, 1]

def solve(rows):
    a = [[F(v) for v in row] for row in rows]
    for col in range(7):
        pivot = next(i for i in range(col, 7) if a[i][col])
        a[col], a[pivot] = a[pivot], a[col]
        scale = a[col][col]
        a[col] = [v / scale for v in a[col]]
        for row in range(7):
            if row != col:
                scale = a[row][col]
                a[row] = [a[row][j] - scale * a[col][j] for j in range(8)]
    return [row[-1] for row in a]

def initial(mode, companion):
    exponents = []
    for prime in [2, 3]:
        rows = [[1, 0, 0, 0, 0, 0, 0, 0]]
        for pair in PAIRS:
            if pair == UNCLEAR[mode]:
                continue
            row = [0] * 8
            row[min(pair) - 1] = 1
            row[max(pair) - 1] = -1
            # 3/2 for a four-position span; 4/3 for a three-position span.
            row[-1] = (-1 if prime == 2 else 1) if abs(pair[0] - pair[1]) == 4 else (2 if prime == 2 else -1)
            rows.append(row)
        exponents.append(solve(rows))
    values = [F(2) ** int(exponents[0][i]) * F(3) ** int(exponents[1][i]) for i in range(7)]
    offset = F(1, 2) if companion == 'octave' else F(1)
    return values + [values[0] * offset, values[1] * offset]

def main():
    data = json.load(sys.stdin)
    checked_pitches = 0
    for case in data['states']:
        values = initial(case['start'], case['companion'])
        mode = case['start']
        factor = F(2048, 2187) if case['direction'] == 'L' else F(2187, 2048)
        for _ in range(case['count']):
            changed = (LOOSEN if case['direction'] == 'L' else TIGHTEN)[mode]
            values[changed - 1] *= factor
            if changed in [1, 2]:
                values[changed + 6] *= factor
            mode = (mode + (1 if case['direction'] == 'L' else -1)) % 7
        assert mode == case['tuning'], case
        assert [F(value) for value in case['pitches']] == values, case
        names_by_pair = dict(zip(PAIRS, ['nis-tuhrim', 'isartum', 'embubum', 'nid-qablim', 'qablitum', 'kitmum', 'pitum']))
        assert case['unclear'] == [names_by_pair[UNCLEAR[mode]]], case
        if case['count']:
            assert F(case['lastFactor']) == factor, case
        checked_pitches += len(values)

    for case in data['routes']:
        queue = deque([(case['from'], [])])
        seen = set()
        while queue:
            node, path = queue.popleft()
            if node == case['to']:
                break
            if node in seen:
                continue
            seen.add(node)
            queue.append(((node + 1) % 7, path + ['L']))
            queue.append(((node - 1) % 7, path + ['T']))
        assert case['route'] == path, case

    print(json.dumps({'states': len(data['states']), 'exact_string_pitches': checked_pitches, 'shortest_routes': len(data['routes']), 'max_moves': 28, 'method': 'Fraction Gaussian elimination of prime-exponent constraints; independent source fixture; BFS routes', 'passed': True}, indent=2))


if __name__ == "__main__":
    main()
