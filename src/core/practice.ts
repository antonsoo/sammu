import type { Note, SoundPlan } from "./audio";
import { queryFor } from "./query";
import { cents, ratioText } from "./rational";
import {
  clearRatio,
  type Direction,
  frequency,
  MAX_MOVES,
  type Pair,
  retune,
  type Session,
  sequenceOf,
  tuningAt,
} from "./tuning";

export interface Practice {
  readonly direction: Direction;
  readonly amount: number | "target";
  readonly listen: "pair" | "partials";
  readonly revealed: boolean;
}
export const PRACTICE_DEFAULTS: Practice = {
  direction: "L",
  amount: 0,
  listen: "pair",
  revealed: false,
};

/** This is a tentative listening setting; it never relabels the exact base state. */
export function preview(session: Session, practice: Practice) {
  if (practice.direction !== "L" && practice.direction !== "T")
    throw new RangeError("Unknown retuning direction.");
  if (practice.listen !== "pair" && practice.listen !== "partials")
    throw new RangeError("Unknown practice sound.");
  if (
    practice.amount !== "target" &&
    (!Number.isFinite(practice.amount) || practice.amount < 0 || practice.amount > 180)
  )
    throw new RangeError("Choose an adjustment from 0 to 180 cents.");
  const base = session.current;
  const tuning = tuningAt(base.tuning);
  const move = retune(base, practice.direction);
  const targetAmount = Math.abs(cents(move.factor));
  const amount = practice.amount === "target" ? targetAmount : practice.amount;
  const signedAmount = (practice.direction === "L" ? -1 : 1) * amount;
  const factor = 2 ** (signedAmount / 1200);
  const pair = tuning.unclear.pair;
  const before = pair.map((string) => frequency(base, string, session.settings.reference)) as [
    number,
    number,
  ];
  const after = pair.map((string, i) =>
    !move.changed.includes(string)
      ? (before[i] as number)
      : practice.amount === "target"
        ? frequency(move.after, string, session.settings.reference)
        : (before[i] as number) * factor,
  ) as [number, number];
  const ratio = clearRatio(pair);
  const harmonic = pair.map((string) =>
    Number(string === Math.min(...pair) ? ratio.d : ratio.n),
  ) as [number, number];
  const beforePartials = before.map((hz, i) => hz * (harmonic[i] as number)) as [number, number];
  const afterPartials = after.map((hz, i) => hz * (harmonic[i] as number)) as [number, number];
  return {
    tuning: tuning.name,
    pair: pair as Pair,
    changed: move.changed,
    direction: practice.direction,
    amount,
    signedAmount,
    exactTargetChosen: practice.amount === "target",
    targetAmount,
    targetFactor: ratioText(move.factor),
    destination: tuningAt(move.after.tuning).name,
    errorFromTargetCents: amount - targetAmount,
    before,
    after,
    harmonic,
    beforePartials,
    afterPartials,
    partialDifferenceHz:
      practice.amount === "target" ? 0 : Math.abs(afterPartials[0] - afterPartials[1]),
  };
}

export function practicePlan(
  session: Session,
  practice: Practice,
  kind: "attempt" | "comparison" | "target" = "attempt",
): SoundPlan {
  const data = preview(session, kind === "target" ? { ...practice, amount: "target" } : practice);
  const toneDuration = 5;
  const notesFor = (pitches: readonly number[], start: number): Note[] =>
    data.pair.map((string, i) => ({
      string,
      hz:
        (pitches[i] as number) *
        (practice.listen === "partials" ? (data.harmonic[i] as number) : 1),
      start,
      duration: toneDuration,
      ...(practice.listen === "partials" ? { partial: data.harmonic[i] as number } : {}),
    }));
  const title = `${kind === "comparison" ? "Unchanged, then your adjustment" : kind === "target" ? "Exact model target" : "Your adjustment"}: strings ${data.pair.join(" + ")}${practice.listen === "partials" ? ", isolated partials" : ", synthetic pair"}`;
  return {
    title,
    // The isolated frequencies must exist in the full signal even when the
    // learner arrived from the main workshop's one-partial colour.
    colour: practice.listen === "partials" ? "sine" : "plucked",
    notes:
      kind === "comparison"
        ? [...notesFor(data.before, 0), ...notesFor(data.after, toneDuration + 0.35)]
        : notesFor(data.after, 0),
    duration: kind === "comparison" ? 2 * toneDuration + 0.35 + 0.12 : toneDuration + 0.12,
  };
}

export function parsePractice(search: string): { practice: Practice; warnings: readonly string[] } {
  const query = new URLSearchParams(search);
  const warnings: string[] = [];
  let practice = { ...PRACTICE_DEFAULTS };
  if (
    search.length > 1024 ||
    ["turn", "cents", "listen", "reveal"].some((key) => query.getAll(key).length > 1)
  )
    return {
      practice,
      warnings: ["The practice settings are ambiguous. The starting adjustment is shown."],
    };
  const direction = query.get("turn");
  if (direction !== null) {
    if (direction === "L" || direction === "T") practice = { ...practice, direction };
    else warnings.push("Unknown practice direction; loosening is selected.");
  }
  const amount = query.get("cents");
  if (amount !== null) {
    if (amount === "target") practice = { ...practice, amount };
    else if (
      /^(?:0|[1-9]\d{0,2})(?:\.\d{1,20})?(?:e[-+]?\d{1,3})?$/i.test(amount) &&
      Number.isFinite(Number(amount)) &&
      Number(amount) <= 180
    )
      practice = { ...practice, amount: Number(amount) };
    else warnings.push("The adjustment is outside 0–180 cents; the unchanged pair is shown.");
  }
  const listen = query.get("listen");
  if (listen !== null) {
    if (listen === "pair" || listen === "partials") practice = { ...practice, listen };
    else warnings.push("Unknown practice sound; the synthetic pair is selected.");
  }
  const reveal = query.get("reveal");
  if (reveal !== null) {
    if (reveal === "1" || reveal === "0") practice = { ...practice, revealed: reveal === "1" };
    else warnings.push("Unknown reveal setting; measurements are hidden.");
  }
  return { practice, warnings };
}

export function practiceQuery(session: Session, practice: Practice): string {
  preview(session, practice);
  const query = new URLSearchParams(queryFor(session.settings, sequenceOf(session)));
  query.set("turn", practice.direction);
  query.set("cents", String(practice.amount));
  query.set("listen", practice.listen);
  query.set("reveal", practice.revealed ? "1" : "0");
  return `?${query}`;
}

export function practiceLink(session: Session, practice: Practice): string {
  return `https://antonsoo.github.io/sammu/practice.html${practiceQuery(session, practice)}#practice`;
}

export function applyPractice(session: Session, practice: Practice): string {
  if (session.moves.length >= MAX_MOVES)
    throw new RangeError("Undo a move before applying another retuning.");
  return `./${queryFor(session.settings, [...sequenceOf(session), practice.direction])}#bench`;
}
