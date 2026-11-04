import { SOURCES } from "../content";
import { type Note, type SoundPlan, wav } from "./audio";
import { queryFor } from "./query";
import { divide, equal, multiply, numeric, ONE, type Rational, ratioText } from "./rational";
import {
  type Direction,
  type Move,
  pitch,
  retune,
  type Session,
  STRINGS,
  type State,
  type StringId,
  sequenceOf,
  tuningAt,
} from "./tuning";

export interface Route {
  readonly direction: Direction;
  readonly moves: readonly Move[];
  readonly end: State;
}
export interface RouteComparison {
  readonly origin: Session;
  readonly target: number;
  readonly a: Route;
  readonly b: Route;
  /** B / A, measured on string 1 and checked on all nine strings. */
  readonly displacement: Rational;
  readonly samePattern: boolean;
}
export interface RouteListening {
  readonly string: StringId | "all";
  readonly aligned: boolean;
}
export const ROUTE_LISTENING: RouteListening = { string: 1, aligned: false };

function walk(start: State, direction: Direction, count: number): Route {
  const moves: Move[] = [];
  let end = start;
  for (let i = 0; i < count; i++) {
    const move = retune(end, direction);
    moves.push(move);
    end = move.after;
  }
  return { direction, moves, end };
}

/** Fork the actual pitches, including any earlier cycles; never re-anchor a tuning. */
export function compareRoutes(origin: Session, target: number): RouteComparison {
  tuningAt(target);
  const count = (target - origin.current.tuning + 7) % 7;
  const a = walk(origin.current, "L", count);
  // At the origin name compare staying put against one complete tightening cycle.
  const b = walk(origin.current, "T", 7 - count);
  const displacement = divide(pitch(b.end, 1), pitch(a.end, 1));
  const samePattern = STRINGS.every((s) =>
    equal(divide(pitch(b.end, s), pitch(a.end, s)), displacement),
  );
  return { origin, target, a, b, displacement, samePattern };
}

export function heardB(comparison: RouteComparison, string: StringId, aligned: boolean): Rational {
  return multiply(
    pitch(comparison.b.end, string),
    aligned ? divide(ONE, comparison.displacement) : ONE,
  );
}

/** A then B, identical string order and envelopes; only B's optional transposition changes. */
export function routePlan(comparison: RouteComparison, listening: RouteListening): SoundPlan {
  const strings = listening.string === "all" ? STRINGS : [listening.string];
  if (!strings.every((s) => STRINGS.includes(s))) throw new RangeError("Unknown listening string.");
  const duration = strings.length === 1 ? 1.7 : 0.36;
  const spacing = strings.length === 1 ? 0 : 0.44;
  const block = (strings.length - 1) * spacing + duration;
  const gap = 0.55;
  const notes = (second: boolean): Note[] =>
    strings.map((string, i) => ({
      string,
      hz:
        numeric(
          second ? heardB(comparison, string, listening.aligned) : pitch(comparison.a.end, string),
        ) * comparison.origin.settings.reference,
      start: (second ? block + gap : 0) + i * spacing,
      duration,
    }));
  return {
    title: `Route A, then route B: ${listening.string === "all" ? "nine strings" : `string ${listening.string}`}${listening.aligned ? "; B transposed to match A on string 1" : "; pitches as retuned"}`,
    colour: comparison.origin.settings.colour,
    notes: [...notes(false), ...notes(true)],
    duration: 2 * block + gap + 0.12,
  };
}

export function routeQuery(comparison: RouteComparison, listening: RouteListening): string {
  const q = new URLSearchParams(
    queryFor(comparison.origin.settings, sequenceOf(comparison.origin)),
  );
  q.set("target", tuningAt(comparison.target).id);
  q.set("listen", String(listening.string));
  q.set("aligned", String(listening.aligned));
  return `?${q}`;
}

export function parseRouteOptions(
  search: string,
  origin: Session,
): {
  target: number;
  listening: RouteListening;
  warnings: string[];
} {
  const q = new URLSearchParams(search);
  const warnings: string[] = [];
  const fallback = (origin.current.tuning + 2) % 7;
  if (
    search.length > 1024 ||
    ["target", "listen", "aligned"].some((key) => q.getAll(key).length > 1)
  )
    return {
      target: fallback,
      listening: ROUTE_LISTENING,
      warnings: ["Ambiguous comparison options; the default comparison is shown."],
    };
  const targetValue = q.get("target");
  const found =
    targetValue === null
      ? fallback
      : Array.from({ length: 7 }, (_, i) => i).find((i) => tuningAt(i).id === targetValue);
  if (found === undefined) warnings.push("Unknown destination; the default comparison is shown.");
  const stringValue = q.get("listen");
  const string = stringValue === "all" ? "all" : STRINGS.find((s) => String(s) === stringValue);
  if (stringValue !== null && string === undefined)
    warnings.push("Unknown listening string; string 1 is selected.");
  const aligned = q.get("aligned");
  if (aligned !== null && aligned !== "true" && aligned !== "false")
    warnings.push("Unknown alignment setting; the retuned pitches are used.");
  return {
    target: found ?? fallback,
    listening: { string: string ?? 1, aligned: aligned === "true" },
    warnings,
  };
}

export function routeRecord(
  comparison: RouteComparison,
  listening: RouteListening,
  edition: string,
) {
  const { origin } = comparison;
  const serialize = (state: State) => ({
    tuning: tuningAt(state.tuning).id,
    strings: STRINGS.map((string) => ({
      string,
      ratioToInitialFirstString: ratioText(pitch(state, string)),
      hertz: numeric(pitch(state, string)) * origin.settings.reference,
    })),
  });
  const route = (r: Route) => ({
    direction: r.direction,
    moves: r.moves.map((m, i) => ({
      step: i + 1,
      changed: m.changed,
      factor: ratioText(m.factor),
      ...serialize(m.after),
    })),
    end: serialize(r.end),
  });
  return {
    schema: "sammu-route-comparison-v1",
    sources: SOURCES.slice(0, 2),
    audioFormat: "Mono PCM16 WAV, 48000 Hz; A then B with 0.55 seconds between blocks.",
    edition,
    license: "PolyForm-Noncommercial-1.0.0",
    author: "Anthony Mercer",
    model:
      "Modern exact 4/3 and 3/2 realization. Numerical pitches and the optional transposition are not recorded on the tablets.",
    origin: {
      settings: origin.settings,
      priorMoves: sequenceOf(origin).join(""),
      ...serialize(origin.current),
    },
    target: tuningAt(comparison.target).id,
    a: route(comparison.a),
    b: route(comparison.b),
    bOverA: ratioText(comparison.displacement),
    samePattern: comparison.samePattern,
    listening: {
      ...listening,
      bMultiplier: ratioText(listening.aligned ? divide(ONE, comparison.displacement) : ONE),
    },
    sound: routePlan(comparison, listening),
    reopen: `https://antonsoo.github.io/sammu/routes.html${routeQuery(comparison, listening)}`,
  };
}

export function routeCsv(comparison: RouteComparison, aligned: boolean): string {
  const reference = comparison.origin.settings.reference;
  return `${[
    "string,origin_ratio,a_ratio,b_ratio,b_over_a,a_hz,b_hz,heard_b_ratio,heard_b_hz,b_transposed,license",
    ...STRINGS.map((s) => {
      const a = pitch(comparison.a.end, s),
        b = pitch(comparison.b.end, s),
        heard = heardB(comparison, s, aligned);
      return [
        s,
        ratioText(pitch(comparison.origin.current, s)),
        ratioText(a),
        ratioText(b),
        ratioText(divide(b, a)),
        numeric(a) * reference,
        numeric(b) * reference,
        ratioText(heard),
        numeric(heard) * reference,
        aligned,
        "PolyForm-Noncommercial-1.0.0",
      ].join(",");
    }),
  ].join("\n")}\n`;
}

/** Retain the original synthesis notice inside the otherwise ordinary PCM WAV. */
export function routeWav(
  comparison: RouteComparison,
  listening: RouteListening,
): Uint8Array<ArrayBuffer> {
  const pcm = wav(routePlan(comparison, listening));
  const notice = new TextEncoder().encode(
    "Copyright (c) 2026 Anthony Mercer. PolyForm Noncommercial 1.0.0: https://polyformproject.org/licenses/noncommercial/1.0.0/ . Modern synthetic tuning realization.\0",
  );
  const padded = notice.length + (notice.length % 2);
  const result = new Uint8Array(pcm.length + 20 + padded);
  result.set(pcm);
  const view = new DataView(result.buffer);
  view.setUint32(4, result.length - 8, true);
  result.set(new TextEncoder().encode("LIST"), pcm.length);
  view.setUint32(pcm.length + 4, 12 + padded, true);
  result.set(new TextEncoder().encode("INFOICOP"), pcm.length + 8);
  view.setUint32(pcm.length + 16, notice.length, true);
  result.set(notice, pcm.length + 20);
  return result;
}
