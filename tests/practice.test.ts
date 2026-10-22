import assert from "node:assert/strict";
import test from "node:test";
import { renderPcm } from "../src/core/audio";
import {
  applyPractice,
  PRACTICE_DEFAULTS,
  parsePractice,
  practiceLink,
  practicePlan,
  preview,
} from "../src/core/practice";
import { parseQuery } from "../src/core/query";
import { record } from "../src/core/records";
import { DEFAULTS, replay } from "../src/core/tuning";

test("a tentative adjustment changes only its prescribed string, while the exact base remains untouched", () => {
  const session = replay(DEFAULTS);
  const original = structuredClone(session);
  const data = preview(session, { ...PRACTICE_DEFAULTS, amount: 100 });
  assert.deepEqual(data.pair, [5, 2]);
  assert.deepEqual(data.changed, [2, 9]);
  assert.equal(data.before[0], data.after[0]);
  assert.equal(data.after[1], data.before[1] * 2 ** (-100 / 1200));
  assert.deepEqual(session, original);
  assert.ok(data.partialDifferenceHz > 0);
  assert.equal(data.destination, "kitmum");
});

test("all seven starting tunings and both directions expose a true shared-partial target", () => {
  for (let start = 0; start < 7; start++) {
    for (const direction of ["L", "T"] as const) {
      const session = replay({ ...DEFAULTS, start, colour: "sine" });
      const settings = {
        ...PRACTICE_DEFAULTS,
        direction,
        amount: "target" as const,
        listen: "partials" as const,
      };
      const data = preview(session, settings);
      assert.equal(data.partialDifferenceHz, 0);
      assert.ok(Math.abs(data.afterPartials[0] - data.afterPartials[1]) < 1e-10);
      assert.equal(data.errorFromTargetCents, 0);
      const sound = practicePlan(session, settings);
      assert.equal(sound.colour, "sine");
      assert.deepEqual(
        sound.notes.map((note) => note.partial),
        data.harmonic,
      );
      assert.equal(practicePlan(session, { ...settings, listen: "pair" }).colour, "plucked");
    }
  }
});

test("a practice URL preserves exact targets, small adjustments, the base history and revealed state", () => {
  const session = replay({ ...DEFAULTS, start: 4, reference: 220 }, ["L", "L", "T"]);
  for (const amount of ["target", 0, 180, 0.09999999999999998, 1e-9] as const) {
    const practice = {
      direction: "T" as const,
      amount,
      listen: "partials" as const,
      revealed: true,
    };
    const url = new URL(practiceLink(session, practice));
    assert.deepEqual(parsePractice(url.search).practice, practice);
    assert.deepEqual(parseQuery(url.search).sequence, ["L", "L", "T"]);
    assert.deepEqual(parseQuery(url.search).settings, session.settings);
  }
  for (const query of [
    "?cents=-1",
    "?cents=181",
    "?cents=NaN",
    "?cents=Infinity",
    "?cents=1&cents=2",
    "?turn=X",
    "?listen=nope",
  ])
    assert.ok(parsePractice(query).warnings.length);
});

test("applying the model's answer appends its exact move, regardless of the tentative setting", () => {
  const session = replay(DEFAULTS, ["L"]);
  const link = new URL(
    applyPractice(session, { ...PRACTICE_DEFAULTS, amount: 1, direction: "T" }),
    "https://example.test/sammu/practice.html",
  );
  assert.deepEqual(parseQuery(link.search).sequence, ["L", "T"]);
  assert.equal(link.pathname, "/sammu/");
  assert.equal(session.moves.length, 1);
  assert.throws(
    () => applyPractice(replay(DEFAULTS, Array(28).fill("L")), PRACTICE_DEFAULTS),
    RangeError,
  );
});

test("the comparison records the attempt separately, with a finite silent before/after gap", () => {
  const session = replay(DEFAULTS);
  const practice = { ...PRACTICE_DEFAULTS, amount: 110, listen: "partials" as const };
  const plan = practicePlan(session, practice, "comparison");
  const data = record(session, plan, "test-edition", practice);
  assert.equal(data.snapshots.length, 1);
  assert.equal(data.practice?.settings.amount, 110);
  assert.equal(data.practice?.preview.exactTargetChosen, false);
  assert.equal(data.audio.notes.length, 4);
  assert.deepEqual(
    data.audio.notes.map((n) => n.string),
    [5, 2, 5, 2],
  );
  const samples = renderPcm(plan);
  assert.ok(samples.subarray(5.01 * 48000, 5.34 * 48000).every((v) => v === 0));
  assert.ok(samples.subarray(samples.length - 100).every((v) => v === 0));
  assert.ok(samples.every((v) => Number.isFinite(v) && Math.abs(v) <= 0.26));
});
