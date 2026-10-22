import { partials } from "../core/audio";
import { cents, divide, equal, fraction, multiply, numeric, ratioText } from "../core/rational";
import {
  companions,
  frequency,
  pitch,
  type Session,
  STRING_NAMES,
  STRINGS,
  type StringId,
  TUNINGS,
  tuningAt,
} from "../core/tuning";
import { html } from "./escape";

export function pitchDomain(session: Session): { min: number; max: number } {
  const points = [session.initial, session.current].flatMap((state) =>
    state.pitches.map((p) => cents(p)),
  );
  return { min: Math.min(...points) - 110, max: Math.max(...points) + 110 };
}

export function position(session: Session, string: StringId, initial = false): number {
  const domain = pitchDomain(session);
  return (
    (cents(pitch(initial ? session.initial : session.current, string)) - domain.min) /
    (domain.max - domain.min)
  );
}

export function trace(session: Session, string: StringId): string {
  const x = 8 + position(session, string) * 284;
  const before = 8 + position(session, string, true) * 284;
  const changed = session.moves.at(-1)?.changed.includes(string) ?? false;
  return `<svg viewBox="0 0 300 30" aria-hidden="true"><path d="M0 15H300" stroke="#aab7af" stroke-width="1"/><circle data-point="initial" cx="${before}" cy="15" r="4" fill="#f4f1e9" stroke="#4f6269" stroke-width="1.5"/><path d="M${before} 15H${x}" stroke="${changed ? "#a23e26" : "#173441"}" stroke-width="2"/><circle data-point="current" cx="${x}" cy="15" r="5" fill="${changed ? "#a23e26" : "#173441"}"/></svg>`;
}

export function stringLabel(session: Session, string: StringId): string {
  const changed = session.moves.at(-1)?.changed.includes(string);
  const tuning = tuningAt(session.current.tuning);
  const diagnostic = tuning.unclear.pair.some((n) => n === string);
  return `Play string ${string}, ${STRING_NAMES[string]}, ${frequency(session.current, string, session.settings.reference).toFixed(2)} hertz${diagnostic ? ", in the unclear pair" : ""}${changed ? ", changed on the last move" : ""}`;
}

/** A schematic of name transitions. It deliberately does not imply pitch closure. */
export function cycleDiagram(session: Session, goal: number): string {
  const points = TUNINGS.map((_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 7;
    return { x: 280 + 177 * Math.cos(angle), y: 263 + 177 * Math.sin(angle) };
  });
  const paths = points
    .map((p, i) => {
      const q = points[(i + 1) % 7];
      return `<path d="M${p.x} ${p.y}L${q?.x} ${q?.y}" stroke="#aab7af" stroke-width="1.3" fill="none"/>`;
    })
    .join("");
  const nodes = points
    .map((p, i) => {
      const current = session.current.tuning === i;
      const next = tuningAt(i);
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 7;
      const labelX = 280 + 237 * Math.cos(angle);
      const labelY = 263 + 215 * Math.sin(angle);
      return `<g><circle cx="${p.x}" cy="${p.y}" r="${current ? 20 : 14}" fill="${current ? "#173441" : "#f4f1e9"}" stroke="${i === goal ? "#a23e26" : "#173441"}" stroke-width="${i === goal ? 3 : 1}"/><text x="${p.x}" y="${p.y + 5}" text-anchor="middle" font-size="14" fill="${current ? "#f4f1e9" : "#173441"}">${i + 1}</text><text x="${labelX}" y="${labelY + 5}" text-anchor="middle" font-family="Noto,serif" font-size="17" fill="${current ? "#a23e26" : "#173441"}">${html(next.name)}</text></g>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 530" role="img" aria-labelledby="cycle-title cycle-desc"><title id="cycle-title">Seven tuning names, two directions</title><desc id="cycle-desc">Current tuning: ${html(tuningAt(session.current.tuning).name)}. Clockwise loosening order: ${html(TUNINGS.map((t) => t.name).join(", "))}. Tightening reverses this order. These are names, not absolute pitch positions.</desc>${paths}${nodes}<text x="280" y="246" text-anchor="middle" font-size="14" fill="#4f6269">LOOSEN →</text><text x="280" y="276" text-anchor="middle" font-size="14" fill="#4f6269">← TIGHTEN</text><text x="280" y="314" text-anchor="middle" font-size="11" fill="#4f6269">one string changes per step</text><text x="280" y="493" text-anchor="middle" font-size="12" fill="#4f6269">filled = current · rust outline = destination</text></svg>`;
}

export function pitchDiagram(session: Session): string {
  const tuning = tuningAt(session.current.tuning);
  const rows = STRINGS.map((string, i) => {
    const y = 132 + i * 47;
    const x = 200 + 385 * position(session, string);
    const original = 200 + 385 * position(session, string, true);
    const changed = session.moves.at(-1)?.changed.includes(string);
    const delta = cents(divide(pitch(session.current, string), pitch(session.initial, string)));
    return `<g><text x="28" y="${y + 5}" font-size="21">${string}</text><text x="62" y="${y + 4}" font-size="12">${html(STRING_NAMES[string])}</text><path d="M195 ${y}H590" stroke="#b6c1bd"/><circle cx="${original}" cy="${y}" r="4" stroke="#4f6269" fill="#f4f1e9"/><path d="M${original} ${y}H${x}" stroke="${changed ? "#a23e26" : "#173441"}" stroke-width="2"/><circle cx="${x}" cy="${y}" r="5" fill="${changed ? "#a23e26" : "#173441"}"/><text x="700" y="${y + 4}" text-anchor="end" font-size="12">${frequency(session.current, string, session.settings.reference).toFixed(3)} Hz</text><text x="785" y="${y + 4}" text-anchor="end" font-size="11">${delta >= 0 ? "+" : ""}${delta.toFixed(3)} c</text></g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 820 630" role="img" aria-labelledby="pitch-title pitch-desc"><title id="pitch-title">Sammû: ${html(tuning.name)}, ${session.moves.length} retuning moves</title><desc id="pitch-desc">Current and initial pitches on a shared logarithmic axis. Open circle: initial. Filled circle: current. Rust: last changed. Companion model: ${html(session.settings.companion)}. This is a modern fourths-and-fifths realization.</desc><rect width="820" height="630" fill="#f4f1e9"/><g font-family="Atkinson,sans-serif" fill="#173441"><text x="28" y="38" font-size="25">Sammû · ${html(tuning.name)}</text><text x="28" y="64" font-size="12">Initial string 1: ${session.settings.reference} Hz · moves: ${session.moves.length} · companions: ${html(session.settings.companion)}</text><text x="28" y="87" font-size="11">Open: initial · filled: current · rust: last changed · c: cents relative to each initial string</text>${rows}<text x="28" y="582" font-size="11">Modern numerical realization, not an excavated instrument or an ancient absolute-pitch claim.</text><text x="28" y="605" font-size="11">Six designated clear pairs use 4/3 or 3/2. Relative string 1: ${html(ratioText(pitch(session.current, 1)))}</text></g></svg>`;
}

export function actionStrings(string: 1 | 2 | 3 | 4 | 5 | 6 | 7): string {
  return companions(string).join(" + ");
}

/** Original acoustic diagram; exact fraction equality decides shared partials. */
export function overtoneDiagram(session: Session): string {
  const move = session.moves.at(-1);
  if (!move)
    return '<p class="small">Retune a string first. This view will compare the same pair before and after your last action.</p>';
  const pair = tuningAt(move.before.tuning).unclear.pair;
  const harmonics = partials(session.settings.colour);
  const maxHz =
    Math.max(
      ...[move.before, move.after].flatMap((state) =>
        pair.map((string) => frequency(state, string, session.settings.reference)),
      ),
    ) *
    harmonics.length *
    1.07;
  const chart = [move.before, move.after]
    .map((state, index) => {
      const y = 65 + index * 160;
      const shared: number[] = [];
      for (const a of harmonics) {
        for (const b of harmonics) {
          const first = multiply(pitch(state, pair[0]), fraction(a.harmonic));
          const second = multiply(pitch(state, pair[1]), fraction(b.harmonic));
          if (equal(first, second)) shared.push(numeric(first) * session.settings.reference);
        }
      }
      const guides = shared
        .map((hz) => {
          const x = 85 + (hz / maxHz) * 390;
          return `<path d="M${x} ${y + 13}V${y + 82}" stroke="#216568" stroke-width="2" stroke-dasharray="3 3"/>`;
        })
        .join("");
      const rows = pair
        .map((string, row) => {
          const marks = harmonics
            .map((p) => {
              const x =
                85 +
                ((frequency(state, string, session.settings.reference) * p.harmonic) / maxHz) * 390;
              return `<path d="M${x} ${y + 40 * row + 25}v-24" stroke="${row ? "#a23e26" : "#173441"}" stroke-width="2"/><rect x="${x - 7}" y="${y + 40 * row + 30}" width="14" height="14" fill="#f4f1e9"/><text x="${x}" y="${y + 40 * row + 41}" text-anchor="middle" font-size="10">${p.harmonic}</text>`;
            })
            .join("");
          return `<text x="0" y="${y + 40 * row + 27}" font-size="12">String ${string}</text><path d="M80 ${y + 40 * row + 25}H480" stroke="#b6c1bd"/>${marks}`;
        })
        .join("");
      return `<text x="0" y="${y - 16}" font-size="16">${index ? "After" : "Before"} · ${shared.length} shared partial${shared.length === 1 ? "" : "s"}</text>${guides}${rows}`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 385" role="img" aria-labelledby="overtones-title overtones-desc"><title id="overtones-title">Before and after: partials of strings ${pair.join(" and ")}</title><desc id="overtones-desc">The same physical pair before and after ${move.direction === "L" ? "loosening" : "tightening"} string ${move.changed.join(" and ")}. ${harmonics.length} partial${harmonics.length === 1 ? "" : "s"} per tone. Guides connect partials whose exact frequency ratios coincide. Frequency increases to the right on a shared linear axis.</desc><g fill="#173441" font-family="Atkinson,sans-serif">${chart}<text x="85" y="370" font-size="11">0 Hz</text><text x="480" y="370" font-size="11" text-anchor="end">${maxHz.toFixed(0)} Hz →</text></g></svg>`;
}
