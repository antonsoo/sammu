import { MODEL_STATEMENT, SOURCES } from "../content";
import type { SoundPlan } from "./audio";
import { queryFor } from "./query";
import { cents, divide, ratioText } from "./rational";
import { frequency, pitch, type Session, STRINGS, sequenceOf, tuningAt } from "./tuning";

export const experimentLink = (session: Session): string =>
  `https://antonsoo.github.io/sammu/${queryFor(session.settings, sequenceOf(session))}#bench`;

export function snapshots(session: Session) {
  return [session.initial, ...session.moves.map((move) => move.after)].map((state, step) => ({
    step,
    action:
      step === 0 ? "initial" : session.moves[step - 1]?.direction === "L" ? "loosen" : "tighten",
    tuning: tuningAt(state.tuning).id,
    name: tuningAt(state.tuning).name,
    namedClearPair: tuningAt(state.tuning).named.pair,
    diagnosticUnclearPair: tuningAt(state.tuning).unclear.pair,
    changed: step === 0 ? [] : (session.moves[step - 1]?.changed ?? []),
    strings: STRINGS.map((string) => ({
      string,
      ratioToInitialFirstString: ratioText(pitch(state, string)),
      hertz: frequency(state, string, session.settings.reference),
      shiftRatio: ratioText(divide(pitch(state, string), pitch(session.initial, string))),
      shiftCents: cents(divide(pitch(state, string), pitch(session.initial, string))),
    })),
  }));
}

export function record(session: Session, plan: SoundPlan, edition: string) {
  return {
    format: "sammu-study-v1",
    edition,
    experiment: experimentLink(session),
    model: MODEL_STATEMENT,
    settings: session.settings,
    moves: sequenceOf(session).join(""),
    snapshots: snapshots(session),
    audio: {
      ...plan,
      format: "mono PCM16 WAV",
      sampleRate: 48000,
      synthesis:
        "Amplitude 0.13 per tone; one or six normalized sine partials; 12 ms attack, 40 ms release; six-partial colour decays exponentially.",
    },
    sources: SOURCES,
  };
}

export function csv(session: Session): string {
  const rows: (string | number | boolean)[][] = [
    [
      "step",
      "action",
      "tuning",
      "string",
      "changed",
      "ratio_to_initial_string_1",
      "hertz",
      "shift_ratio",
      "shift_cents",
      "initial_string_1_hertz",
      "companion_model",
    ],
  ];
  for (const snapshot of snapshots(session)) {
    for (const string of snapshot.strings) {
      rows.push([
        snapshot.step,
        snapshot.action,
        snapshot.name,
        string.string,
        snapshot.changed.includes(string.string),
        string.ratioToInitialFirstString,
        string.hertz,
        string.shiftRatio,
        string.shiftCents,
        session.settings.reference,
        session.settings.companion,
      ]);
    }
  }
  return `${rows.map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\r\n")}\r\n`;
}
