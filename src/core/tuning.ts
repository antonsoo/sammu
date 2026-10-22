import { cents, divide, equal, fraction, multiply, numeric, ONE, type Rational } from "./rational";

export const PRIMARY_STRINGS = [1, 2, 3, 4, 5, 6, 7] as const;
export const STRINGS = [...PRIMARY_STRINGS, 8, 9] as const;
export type PrimaryString = (typeof PRIMARY_STRINGS)[number];
export type StringId = (typeof STRINGS)[number];
export type Direction = "L" | "T";
export type Pair = readonly [PrimaryString, PrimaryString];
export type Companion = "octave" | "unison";
export type Colour = "sine" | "plucked";
export const MAX_MOVES = 28;
export const REFERENCES = [220, 330, 440] as const;
export type Reference = (typeof REFERENCES)[number];

export interface Dichord {
  readonly id: string;
  readonly name: string;
  readonly pair: Pair;
}

/** String order follows CBS 10996, not ascending pitch or normalized pair order. */
export const DICHORDS: readonly Dichord[] = [
  { id: "nis-tuhrim", name: "nīš tuḫrim", pair: [1, 5] },
  { id: "isartum", name: "išartum", pair: [2, 6] },
  { id: "embubum", name: "embūbum", pair: [3, 7] },
  { id: "nid-qablim", name: "nīd(i) qablim", pair: [4, 1] },
  { id: "qablitum", name: "qablītum", pair: [5, 2] },
  { id: "kitmum", name: "kitmum", pair: [6, 3] },
  { id: "pitum", name: "pītum", pair: [7, 4] },
];

export interface Tuning {
  readonly id: string;
  readonly name: string;
  readonly named: Dichord;
  readonly unclear: Dichord;
  readonly loosen: PrimaryString;
  readonly tighten: PrimaryString;
}

function dichord(id: string): Dichord {
  const found = DICHORDS.find((d) => d.id === id);
  if (!found) throw new Error("Unknown dichord.");
  return found;
}

/** Loosening order: Mirelman 2013, fig. 5; Rahn 2022, paragraphs 11–16. */
export const TUNINGS: readonly Tuning[] = (
  [
    ["isartum", "qablitum", 2, 5],
    ["kitmum", "isartum", 6, 2],
    ["embubum", "kitmum", 3, 6],
    ["pitum", "embubum", 7, 3],
    ["nid-qablim", "pitum", 4, 7],
    ["nis-tuhrim", "nid-qablim", 1, 4],
    ["qablitum", "nis-tuhrim", 5, 1],
  ] as const
).map(([namedId, unclearId, loosen, tighten]) => {
  const named = dichord(namedId);
  return {
    id: named.id,
    name: named.name,
    named,
    unclear: dichord(unclearId),
    loosen,
    tighten,
  };
});

export const STRING_NAMES: Record<StringId, string> = {
  1: "front",
  2: "following",
  3: "third / thin",
  4: "fourth / small",
  5: "fifth / center",
  6: "fourth from behind",
  7: "third from behind",
  8: "second from behind",
  9: "back",
};

export interface Settings {
  readonly start: number;
  readonly reference: Reference;
  readonly companion: Companion;
  readonly colour: Colour;
}
export const DEFAULTS: Settings = {
  start: 0,
  reference: 440,
  companion: "octave",
  colour: "plucked",
};

export interface State {
  readonly tuning: number;
  /** Index is string number minus one. Relative to the INITIAL first string. */
  readonly pitches: readonly Rational[];
}
export interface Move {
  readonly direction: Direction;
  readonly changed: readonly StringId[];
  readonly factor: Rational;
  readonly before: State;
  readonly after: State;
}
export interface Session {
  readonly settings: Settings;
  readonly initial: State;
  readonly current: State;
  readonly moves: readonly Move[];
}

export function tuningAt(index: number): Tuning {
  if (!Number.isInteger(index) || index < 0 || index >= TUNINGS.length) {
    throw new RangeError("Choose one of the seven tunings.");
  }
  return TUNINGS[index] as Tuning;
}

export function pitch(state: State, string: StringId): Rational {
  const value = state.pitches[string - 1];
  if (!value) throw new RangeError("Missing string pitch.");
  return value;
}

/** An assumption of this realization, not a ratio recorded on the tablets. */
export function clearRatio(pair: Pair): Rational {
  return Math.abs(pair[0] - pair[1]) === 4 ? fraction(3, 2) : fraction(4, 3);
}

export function interval(state: State, pair: Pair): Rational {
  return divide(
    pitch(state, Math.min(...pair) as StringId),
    pitch(state, Math.max(...pair) as StringId),
  );
}

export function companions(string: PrimaryString): readonly StringId[] {
  return string === 1 ? [1, 8] : string === 2 ? [2, 9] : [string];
}

/** Six pure constraints form a path through seven strings; the seventh is omitted. */
export function initialState(index: number, companion: Companion): State {
  const tuning = tuningAt(index);
  const pitches: (Rational | undefined)[] = Array(9);
  pitches[0] = ONE;
  const remaining = DICHORDS.filter((d) => d.id !== tuning.unclear.id);
  for (let pass = 0; pass < 7; pass++) {
    for (const { pair } of remaining) {
      const high = Math.min(...pair) - 1;
      const low = Math.max(...pair) - 1;
      const highPitch = pitches[high];
      const lowPitch = pitches[low];
      if (highPitch && !lowPitch) pitches[low] = divide(highPitch, clearRatio(pair));
      if (lowPitch && !highPitch) pitches[high] = multiply(lowPitch, clearRatio(pair));
    }
  }
  if (PRIMARY_STRINGS.some((string) => !pitches[string - 1]))
    throw new Error("Disconnected tuning constraints.");
  const offset = companion === "octave" ? fraction(1, 2) : ONE;
  pitches[7] = multiply(pitches[0] as Rational, offset);
  pitches[8] = multiply(pitches[1] as Rational, offset);
  return {
    tuning: index,
    pitches: STRINGS.map((string) => {
      const value = pitches[string - 1];
      if (!value) throw new Error("Missing a modeled pitch.");
      return value;
    }),
  };
}

/** Solve the unclear pair by moving only the prescribed string and its companion. */
export function retune(before: State, direction: Direction): Move {
  const tuning = tuningAt(before.tuning);
  const string = direction === "L" ? tuning.loosen : tuning.tighten;
  const pair = tuning.unclear.pair;
  const other = pair.find((n) => n !== string);
  if (!other) throw new Error("Retuning string is outside the diagnosed pair.");
  const target =
    string < other
      ? multiply(pitch(before, other), clearRatio(pair))
      : divide(pitch(before, other), clearRatio(pair));
  const factor = divide(target, pitch(before, string));
  const changed = companions(string);
  const pitches = before.pitches.map((p, i) =>
    changed.includes((i + 1) as StringId) ? multiply(p, factor) : p,
  );
  return {
    direction,
    changed,
    factor,
    before,
    after: { tuning: (before.tuning + (direction === "L" ? 1 : 6)) % 7, pitches },
  };
}

export function replay(settings: Settings, sequence: readonly Direction[] = []): Session {
  if (!REFERENCES.includes(settings.reference))
    throw new RangeError("Choose an offered reference.");
  if (settings.companion !== "octave" && settings.companion !== "unison")
    throw new RangeError("Unknown companion model.");
  if (settings.colour !== "sine" && settings.colour !== "plucked")
    throw new RangeError("Unknown synthetic sound.");
  if (sequence.length > MAX_MOVES || sequence.some((d) => d !== "L" && d !== "T")) {
    throw new RangeError(`A session may contain at most ${MAX_MOVES} L/T moves.`);
  }
  const initial = initialState(settings.start, settings.companion);
  const moves: Move[] = [];
  let current = initial;
  for (const direction of sequence) {
    const move = retune(current, direction);
    moves.push(move);
    current = move.after;
  }
  return { settings, initial, current, moves };
}

export function shortestRoute(from: number, to: number): readonly Direction[] {
  tuningAt(from);
  tuningAt(to);
  const forward = (to - from + 7) % 7;
  return forward <= 3
    ? Array<Direction>(forward).fill("L")
    : Array<Direction>(7 - forward).fill("T");
}

export const frequency = (state: State, string: StringId, reference: Reference): number =>
  numeric(pitch(state, string)) * reference;
export const shift = (session: Session, string: StringId = 1): Rational =>
  divide(pitch(session.current, string), pitch(session.initial, string));
export const shiftedCents = (session: Session): number => cents(shift(session));
export const isClear = (state: State, dichord: Dichord): boolean =>
  equal(interval(state, dichord.pair), clearRatio(dichord.pair));

export function sequenceOf(session: Session): Direction[] {
  return session.moves.map((m) => m.direction);
}
