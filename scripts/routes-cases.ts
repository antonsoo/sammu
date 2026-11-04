import { ratioText } from "../src/core/rational";
import { compareRoutes, routeRecord } from "../src/core/routes";
import { DEFAULTS, type Direction, replay } from "../src/core/tuning";

for (let start = 0; start < 7; start++) {
  for (const companion of ["octave", "unison"] as const) {
    for (const reference of [220, 330, 440] as const) {
      for (const history of [
        "",
        "LLLLLLL",
        "TTTTTTT",
        "LTLTTLLT",
        "L".repeat(28),
        "T".repeat(28),
      ]) {
        const origin = replay({ ...DEFAULTS, start, companion, reference }, [
          ...history,
        ] as Direction[]);
        for (let target = 0; target < 7; target++) {
          const c = compareRoutes(origin, target);
          process.stdout.write(
            `${JSON.stringify({ start, companion, history, target, origin: origin.current.pitches.map(ratioText), record: routeRecord(c, { string: "all", aligned: true }, "oracle") })}\n`,
          );
        }
      }
    }
  }
}
