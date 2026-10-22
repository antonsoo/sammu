import assert from "node:assert/strict";
import test from "node:test";
import { comparisonPlan, renderPcm, wav } from "../src/core/audio";
import { parseQuery, queryFor } from "../src/core/query";
import { equal, fraction, ratioText } from "../src/core/rational";
import { csv, record } from "../src/core/records";
import {
  DEFAULTS,
  DICHORDS,
  isClear,
  MAX_MOVES,
  pitch,
  replay,
  STRINGS,
  sequenceOf,
  shift,
  shortestRoute,
  tuningAt,
} from "../src/core/tuning";

test("išartum realizes the six clear-pair constraints without clearing qablītum", () => {
  const session = replay(DEFAULTS);
  assert.deepEqual(session.current.pitches.map(ratioText), [
    "1/1",
    "243/256",
    "27/32",
    "3/4",
    "2/3",
    "81/128",
    "9/16",
    "1/2",
    "243/512",
  ]);
  assert.deepEqual(
    DICHORDS.filter((d) => !isClear(session.current, d)).map((d) => d.id),
    ["qablitum"],
  );
});

test("the first published case changes 2 + 9 and compares the same pair", () => {
  const session = replay(DEFAULTS, ["L"]);
  const move = session.moves[0];
  assert.ok(move);
  assert.deepEqual(move.changed, [2, 9]);
  assert.equal(tuningAt(session.current.tuning).id, "kitmum");
  assert.equal(ratioText(move.factor), "2048/2187");
  assert.ok(isClear(session.current, tuningAt(0).unclear));
  assert.deepEqual(
    comparisonPlan(session, move).notes.map((n) => n.string),
    [5, 2, 5, 2],
  );
  for (const string of STRINGS.filter((n) => n !== 2 && n !== 9))
    assert.ok(equal(pitch(move.before, string), pitch(move.after, string)));
});

test("every move and its inverse restore every exact pitch in both companion models", () => {
  for (let start = 0; start < 7; start++) {
    for (const companion of ["unison", "octave"] as const) {
      for (const sequence of [
        ["L", "T"],
        ["T", "L"],
      ] as const) {
        const session = replay({ ...DEFAULTS, start, companion }, sequence);
        assert.equal(session.current.tuning, start);
        for (const string of STRINGS)
          assert.ok(equal(pitch(session.initial, string), pitch(session.current, string)));
      }
    }
  }
});

test("a complete name cycle shifts all pitches; reversing the cycle cancels the shift", () => {
  for (let start = 0; start < 7; start++) {
    for (const direction of ["L", "T"] as const) {
      const sequence = Array(7).fill(direction);
      const session = replay({ ...DEFAULTS, start }, sequence);
      assert.equal(session.current.tuning, start);
      const factor = direction === "L" ? fraction(2048, 2187) : fraction(2187, 2048);
      assert.ok(equal(shift(session), factor));
      const undone = replay(session.settings, [
        ...sequence,
        ...Array(7).fill(direction === "L" ? "T" : "L"),
      ]);
      for (const string of STRINGS)
        assert.ok(equal(pitch(undone.current, string), pitch(undone.initial, string)));
    }
  }
});

test("all forty-nine shortest routes arrive in at most three one-string operations", () => {
  for (let from = 0; from < 7; from++) {
    for (let to = 0; to < 7; to++) {
      const route = shortestRoute(from, to);
      assert.ok(route.length <= 3);
      assert.equal(replay({ ...DEFAULTS, start: from }, route).current.tuning, to);
    }
  }
});

test("links reject ambiguity, malformed sequences and unsupported values without losing valid settings", () => {
  const sequence = ["L", "L", "T"] as const;
  const settings = { ...DEFAULTS, reference: 220 as const, start: 5, companion: "unison" as const };
  const parsed = parseQuery(queryFor(settings, sequence));
  assert.deepEqual(parsed.settings, settings);
  assert.deepEqual(parsed.sequence, sequence);
  assert.equal(parsed.warnings.length, 0);
  for (const query of [
    "?moves=L&moves=T",
    `?moves=${"L".repeat(MAX_MOVES + 1)}`,
    "?moves=l",
    "?moves=L%3Cscript%3E",
    "?a=4.4e2",
  ])
    assert.ok(parseQuery(query).warnings.length);
  assert.equal(parseQuery("?start=kitmum&moves=nope").settings.start, 1);
  assert.throws(() => replay(DEFAULTS, Array(29).fill("L")), RangeError);
});

test("CSV and the study record preserve every intermediate pitch, including companion strings", () => {
  const session = replay(DEFAULTS, ["L", "L", "L"]);
  const move = session.moves.at(-1);
  assert.ok(move);
  const data = record(session, comparisonPlan(session, move), "test-edition");
  assert.equal(data.snapshots.length, 4);
  assert.equal(data.snapshots[1]?.strings[8]?.ratioToInitialFirstString, "4/9");
  assert.deepEqual(data.moves, sequenceOf(session).join(""));
  assert.equal(csv(session).trim().split("\r\n").length, 1 + 4 * 9);
  assert.ok(data.model.includes("not a recovered ancient performance"));
});

test("finite before/after PCM has a silent gap, finite endpoints and a valid uncompressed WAV", () => {
  const session = replay({ ...DEFAULTS, colour: "sine" }, ["L"]);
  const move = session.moves[0];
  assert.ok(move);
  const plan = comparisonPlan(session, move);
  const pcm = renderPcm(plan);
  assert.equal(pcm[0], 0);
  assert.ok(pcm.subarray(Math.ceil(1.71 * 48000), Math.floor(2.04 * 48000)).every((v) => v === 0));
  assert.ok(pcm.subarray(pcm.length - 100).every((v) => v === 0));
  assert.ok(pcm.every((v) => Number.isFinite(v) && Math.abs(v) <= 0.26));
  const bytes = wav(plan);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "RIFF");
  assert.equal(new DataView(bytes.buffer).getUint32(40, true), pcm.length * 2);
});
