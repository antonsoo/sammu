import assert from "node:assert/strict";
import test from "node:test";
import { renderPcm } from "../src/core/audio";
import { parseQuery } from "../src/core/query";
import { divide, equal, fraction, ratioText } from "../src/core/rational";
import {
  compareRoutes,
  heardB,
  parseRouteOptions,
  routeCsv,
  routePlan,
  routeQuery,
  routeRecord,
  routeWav,
} from "../src/core/routes";
import { DEFAULTS, type Direction, pitch, replay, STRINGS } from "../src/core/tuning";

const histories = ["", "LLLLLLL", "TTTTTTT", "LTLTTLLT", "L".repeat(28), "T".repeat(28)];

test("two roads keep their common origin and reach one name with a uniform exact displacement", () => {
  for (let start = 0; start < 7; start++)
    for (const companion of ["octave", "unison"] as const)
      for (const history of histories) {
        const session = replay({ ...DEFAULTS, start, companion }, [...history] as Direction[]);
        const before = session.current.pitches.map(ratioText);
        for (let target = 0; target < 7; target++) {
          const c = compareRoutes(session, target);
          assert.equal(c.a.end.tuning, target);
          assert.equal(c.b.end.tuning, target);
          assert.equal(c.a.moves.length + c.b.moves.length, 7);
          assert.ok(c.samePattern);
          for (const s of STRINGS) {
            assert.ok(equal(divide(pitch(c.b.end, s), pitch(c.a.end, s)), fraction(2187, 2048)));
            assert.ok(equal(heardB(c, s, true), pitch(c.a.end, s)));
            assert.ok(equal(heardB(c, s, false), pitch(c.b.end, s)));
          }
          assert.deepEqual(session.current.pitches.map(ratioText), before);
        }
      }
});

test("staying at the origin is compared with one complete tightening circuit", () => {
  const session = replay(DEFAULTS, Array<Direction>(28).fill("L"));
  const c = compareRoutes(session, session.current.tuning);
  assert.equal(c.a.end, session.current);
  assert.equal(c.a.moves.length, 0);
  assert.equal(c.b.moves.length, 7);
  assert.equal(ratioText(divide(pitch(c.b.end, 1), pitch(session.current, 1))), "2187/2048");
  assert.throws(() => compareRoutes(session, -1), RangeError);
});

test("links round-trip earlier drift, destination, physical string and transposition", () => {
  const session = replay(
    { ...DEFAULTS, start: 4, reference: 330, companion: "unison", colour: "sine" },
    [..."LLLLLLLTT"] as Direction[],
  );
  const c = compareRoutes(session, 3);
  const listening = { string: "all", aligned: true } as const;
  const query = routeQuery(c, listening);
  const origin = parseQuery(query);
  const restored = replay(origin.settings, origin.sequence);
  assert.deepEqual(restored, session);
  assert.deepEqual(parseRouteOptions(query, restored), { target: 3, listening, warnings: [] });
  for (const malformed of [
    "?target=bad&listen=0&aligned=perhaps",
    "?target=kitmum&target=pitum",
    `?${"x".repeat(1025)}`,
  ]) {
    const parsed = parseRouteOptions(malformed, session);
    assert.ok(parsed.warnings.length > 0);
    assert.ok(parsed.target >= 0 && parsed.target < 7);
    assert.equal(parsed.listening.aligned, false);
  }
});

test("transposition changes only heard B; A and raw B records and CSV stay separate", () => {
  const c = compareRoutes(replay(DEFAULTS), 2);
  const raw = routeRecord(c, { string: 9, aligned: false }, "test");
  const aligned = routeRecord(c, { string: 9, aligned: true }, "test");
  assert.deepEqual(raw.a, aligned.a);
  assert.deepEqual(raw.b, aligned.b);
  assert.equal(aligned.listening.bMultiplier, "2048/2187");
  assert.equal(aligned.sound.notes[0]?.hz, aligned.sound.notes[1]?.hz);
  assert.notEqual(raw.sound.notes[0]?.hz, raw.sound.notes[1]?.hz);
  const lines = routeCsv(c, true).trim().split("\n");
  assert.equal(lines.length, 10);
  for (const row of lines.slice(1).map((line) => line.split(","))) {
    assert.equal(row.length, 11);
    assert.equal(row[10], "PolyForm-Noncommercial-1.0.0");
    assert.equal(row[2], row[7]);
    assert.equal(row[5], row[8]);
    assert.notEqual(row[2], row[3]);
  }
});

test("audio compares the same strings with equal timing, bounded samples and a silent gap", () => {
  const c = compareRoutes(replay(DEFAULTS), 2);
  for (const string of [1, 9, "all"] as const)
    for (const aligned of [true, false]) {
      const plan = routePlan(c, { string, aligned });
      const count = string === "all" ? 9 : 1;
      assert.deepEqual(
        plan.notes.slice(0, count).map((n) => n.string),
        plan.notes.slice(count).map((n) => n.string),
      );
      if (aligned)
        assert.deepEqual(
          plan.notes.slice(0, count).map((n) => n.hz),
          plan.notes.slice(count).map((n) => n.hz),
        );
      const pcm = renderPcm(plan, 8000);
      let peak = 0;
      for (const sample of pcm) {
        assert.ok(Number.isFinite(sample));
        peak = Math.max(peak, Math.abs(sample));
      }
      assert.ok(peak > 0.01 && peak <= 0.14);
      const lastA = plan.notes[count - 1];
      const firstB = plan.notes[count];
      assert.ok(lastA && firstB);
      assert.ok(Math.abs(firstB.start - lastA.start - lastA.duration - 0.55) < 1e-10);
      const gap = pcm.slice(
        Math.ceil((lastA.start + lastA.duration) * 8000),
        Math.floor(firstB.start * 8000),
      );
      assert.ok(gap.every((n) => n === 0));
    }
});

test("downloaded WAV retains a standards-compatible synthesis license notice", () => {
  const c = compareRoutes(replay(DEFAULTS), 2);
  const bytes = routeWav(c, { string: 1, aligned: false });
  const view = new DataView(bytes.buffer);
  assert.equal(view.getUint32(4, true), bytes.length - 8);
  const metadata = 44 + view.getUint32(40, true);
  assert.equal(new TextDecoder().decode(bytes.slice(metadata, metadata + 4)), "LIST");
  assert.equal(new TextDecoder().decode(bytes.slice(metadata + 8, metadata + 16)), "INFOICOP");
  assert.ok(new TextDecoder().decode(bytes).includes("PolyForm Noncommercial 1.0.0"));
});
