import {
  type Colour,
  frequency,
  type Move,
  type Pair,
  type Session,
  STRINGS,
  type State,
  type StringId,
  tuningAt,
} from "./tuning";

export interface Note {
  readonly string: StringId;
  readonly hz: number;
  readonly start: number;
  readonly duration: number;
  readonly partial?: number;
}
export interface SoundPlan {
  readonly title: string;
  readonly colour: Colour;
  readonly notes: readonly Note[];
  readonly duration: number;
}
export type Listening = "unclear" | "named" | "strum" | "last" | "cycle";

const PAIR_DURATION = 1.7;
const PAIR_GAP = 0.35;
export const AMPLITUDE = 0.13;

function notesFor(
  state: State,
  strings: readonly StringId[],
  start: number,
  duration: number,
  session: Session,
): Note[] {
  return strings.map((string) => ({
    string,
    hz: frequency(state, string, session.settings.reference),
    start,
    duration,
  }));
}

export function pairPlan(session: Session, pair: Pair, title: string): SoundPlan {
  return {
    title,
    colour: session.settings.colour,
    notes: notesFor(session.current, pair, 0, PAIR_DURATION, session),
    duration: PAIR_DURATION + 0.12,
  };
}

export function stringPlan(session: Session, string: StringId): SoundPlan {
  return {
    title: `String ${string}`,
    colour: session.settings.colour,
    notes: notesFor(session.current, [string], 0, 1.15, session),
    duration: 1.27,
  };
}

export function strumPlan(session: Session): SoundPlan {
  return {
    title: "Nine strings in physical order",
    colour: session.settings.colour,
    notes: STRINGS.flatMap((string, i) =>
      notesFor(session.current, [string], i * 0.44, 0.36, session),
    ),
    duration: 9 * 0.44 + 0.12,
  };
}

export function comparisonPlan(session: Session, move: Move): SoundPlan {
  // Compare the same physical pair. Comparing each state's diagnostic pair would
  // substitute a different sound and conceal what the one-string operation did.
  const changedPair = tuningAt(move.before.tuning).unclear.pair;
  return {
    title: `Before, then after: strings ${changedPair.join(" + ")}`,
    colour: session.settings.colour,
    notes: [
      ...notesFor(move.before, changedPair, 0, PAIR_DURATION, session),
      ...notesFor(move.after, changedPair, PAIR_DURATION + PAIR_GAP, PAIR_DURATION, session),
    ],
    duration: 2 * PAIR_DURATION + PAIR_GAP + 0.12,
  };
}

export function cyclePlan(session: Session): SoundPlan {
  return {
    title: "Initial string 1, then current string 1",
    colour: session.settings.colour,
    notes: [
      ...notesFor(session.initial, [1], 0, PAIR_DURATION, session),
      ...notesFor(session.current, [1], PAIR_DURATION + PAIR_GAP, PAIR_DURATION, session),
    ],
    duration: 2 * PAIR_DURATION + PAIR_GAP + 0.12,
  };
}

/** Two explicitly synthetic colours, both made from sine partials. */
export function partials(colour: Colour): readonly { harmonic: number; weight: number }[] {
  const weights = Array.from({ length: colour === "sine" ? 1 : 6 }, (_, i) => 1 / (i + 1) ** 1.5);
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((weight, i) => ({ harmonic: i + 1, weight: weight / sum }));
}

export function envelope(time: number, duration: number, colour: Colour): number {
  if (time <= 0 || time >= duration) return 0;
  const edge = Math.min(1, time / 0.012, (duration - time) / 0.04);
  const smooth = (1 - Math.cos(Math.PI * edge)) / 2;
  return smooth * (colour === "plucked" ? Math.exp((-2.7 * time) / duration) : 1);
}

/** The live player and downloaded WAV share these exact finite samples. */
export function renderPcm(plan: SoundPlan, sampleRate = 48000): Float32Array {
  if (
    !Number.isInteger(sampleRate) ||
    sampleRate < 8000 ||
    sampleRate > 192000 ||
    !Number.isFinite(plan.duration) ||
    plan.duration <= 0 ||
    plan.duration > 12
  ) {
    throw new RangeError("Unsupported audio render bounds.");
  }
  const result = new Float32Array(Math.ceil(plan.duration * sampleRate));
  const harmonics = partials(plan.colour);
  for (const note of plan.notes) {
    if (
      !Number.isFinite(note.hz) ||
      note.hz <= 0 ||
      note.hz * harmonics.length >= sampleRate / 2 ||
      !Number.isFinite(note.start) ||
      !Number.isFinite(note.duration) ||
      note.start < 0 ||
      note.duration <= 0 ||
      note.start + note.duration > plan.duration
    ) {
      throw new RangeError("The sound plan exceeds its sample or timing bounds.");
    }
    const first = Math.ceil(note.start * sampleRate);
    const last = Math.min(result.length, Math.ceil((note.start + note.duration) * sampleRate));
    for (let i = first; i < last; i++) {
      const time = i / sampleRate - note.start;
      let value = 0;
      for (const partial of harmonics)
        value += partial.weight * Math.sin(2 * Math.PI * note.hz * partial.harmonic * time);
      result[i] = (result[i] ?? 0) + AMPLITUDE * envelope(time, note.duration, plan.colour) * value;
    }
  }
  return result;
}

export function wav(plan: SoundPlan, sampleRate = 48000): Uint8Array<ArrayBuffer> {
  const pcm = renderPcm(plan, sampleRate);
  const bytes = new Uint8Array(44 + pcm.length * 2);
  const view = new DataView(bytes.buffer);
  const word = (offset: number, text: string) =>
    [...text].forEach((c, i) => {
      view.setUint8(offset + i, c.charCodeAt(0));
    });
  word(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  word(8, "WAVE");
  word(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  word(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  pcm.forEach((sample, i) => {
    view.setInt16(44 + 2 * i, Math.round(Math.max(-1, Math.min(1, sample)) * 32767), true);
  });
  return bytes;
}
