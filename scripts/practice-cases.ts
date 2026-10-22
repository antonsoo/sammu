import { PRACTICE_DEFAULTS, type Practice, practicePlan, preview } from "../src/core/practice";
import { DEFAULTS, REFERENCES, replay } from "../src/core/tuning";

const cases = [];
for (let start = 0; start < 7; start++) {
  for (const reference of REFERENCES) {
    for (const companion of ["unison", "octave"] as const) {
      for (const direction of ["L", "T"] as const) {
        for (const amount of [0, 110, 180, "target"] as const) {
          for (const listen of ["pair", "partials"] as const) {
            const session = replay({ ...DEFAULTS, start, reference, companion }, ["L", "T", "T"]);
            const practice: Practice = { ...PRACTICE_DEFAULTS, direction, amount, listen };
            cases.push({
              settings: session.settings,
              moves: "LTT",
              practice: { settings: practice, preview: preview(session, practice) },
              audio: practicePlan(session, practice, "comparison"),
            });
          }
        }
      }
    }
  }
}
process.stdout.write(`${JSON.stringify(cases)}\n`);
