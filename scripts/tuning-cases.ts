import { ratioText } from "../src/core/rational";
import {
  DEFAULTS,
  DICHORDS,
  type Direction,
  isClear,
  replay,
  shortestRoute,
  TUNINGS,
} from "../src/core/tuning";

const states = [];
for (let start = 0; start < 7; start++) {
  for (const companion of ["octave", "unison"] as const) {
    for (const direction of ["L", "T"] as const) {
      for (let count = 0; count <= 28; count++) {
        const session = replay(
          { ...DEFAULTS, start, companion },
          Array<Direction>(count).fill(direction),
        );
        const last = session.moves.at(-1);
        states.push({
          start,
          companion,
          direction,
          count,
          tuning: session.current.tuning,
          pitches: session.current.pitches.map(ratioText),
          unclear: DICHORDS.filter((d) => !isClear(session.current, d)).map((d) => d.id),
          lastFactor: last ? ratioText(last.factor) : null,
        });
      }
    }
  }
}
const routes = TUNINGS.flatMap((_, from) =>
  TUNINGS.map((__, to) => ({ from, to, route: shortestRoute(from, to) })),
);
process.stdout.write(`${JSON.stringify({ states, routes })}\n`);
