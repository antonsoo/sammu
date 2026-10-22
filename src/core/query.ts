import { DEFAULTS, type Direction, MAX_MOVES, REFERENCES, type Settings, TUNINGS } from "./tuning";

export interface LocationState {
  readonly settings: Settings;
  readonly sequence: readonly Direction[];
  readonly warnings: readonly string[];
}

export function parseQuery(search: string): LocationState {
  const query = new URLSearchParams(search);
  const warnings: string[] = [];
  let settings = { ...DEFAULTS };
  let sequence: Direction[] = [];
  const keys = ["start", "a", "companions", "sound", "moves"];
  if (search.length > 1024 || keys.some((key) => query.getAll(key).length > 1)) {
    return {
      settings,
      sequence,
      warnings: ["This link is ambiguous or too long. The starting session is shown."],
    };
  }
  const start = query.get("start");
  const index = TUNINGS.findIndex((t) => t.id === start);
  if (start !== null) {
    if (index < 0) warnings.push("Unknown starting tuning; išartum is shown.");
    else settings = { ...settings, start: index };
  }
  const reference = query.get("a");
  if (reference !== null) {
    const offered = REFERENCES.find((a) => String(a) === reference);
    if (!offered) warnings.push("Unknown reference pitch; 440 Hz is used.");
    else settings = { ...settings, reference: offered };
  }
  const companion = query.get("companions");
  if (companion !== null) {
    if (companion !== "octave" && companion !== "unison")
      warnings.push("Unknown companion model; lower octaves are used.");
    else settings = { ...settings, companion };
  }
  const colour = query.get("sound");
  if (colour !== null) {
    if (colour !== "sine" && colour !== "plucked")
      warnings.push("Unknown sound; the synthetic pluck is used.");
    else settings = { ...settings, colour };
  }
  const moves = query.get("moves");
  if (moves !== null) {
    if (!/^[LT]*$/.test(moves) || moves.length > MAX_MOVES)
      warnings.push(
        `The move sequence is invalid; start again with at most ${MAX_MOVES} L/T moves.`,
      );
    else sequence = [...moves] as Direction[];
  }
  return { settings, sequence, warnings };
}

export function queryFor(settings: Settings, sequence: readonly Direction[]): string {
  const query = new URLSearchParams({
    start: TUNINGS[settings.start]?.id ?? "isartum",
    a: String(settings.reference),
    companions: settings.companion,
    sound: settings.colour,
    moves: sequence.join(""),
  });
  return `?${query}`;
}
