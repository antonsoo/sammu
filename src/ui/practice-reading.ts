import { type Practice, preview } from "../core/practice";
import type { Session } from "../core/tuning";
import { html } from "./escape";

export function practiceReading(session: Session, practice: Practice): string {
  const data = preview(session, practice);
  // The domain covers the entire allowed adjustment. Turning the control cannot
  // move the scale to disguise an overshoot or shrink a frequency difference.
  const bounds = data.beforePartials.flatMap((hz, i) =>
    data.changed.some((n) => n === data.pair[i])
      ? [hz / 2 ** (180 / 1200), hz * 2 ** (180 / 1200)]
      : [hz],
  );
  const low = Math.min(...bounds) * 0.98;
  const high = Math.max(...bounds) * 1.02;
  const position = (hz: number) => 8 + ((hz - low) / (high - low)) * 584;
  const rows = data.pair
    .map((string, i) => {
      const hz = data.afterPartials[i] as number;
      const initial = data.beforePartials[i] as number;
      return `<div class="partial-reading"><p>String ${string} · partial ${data.harmonic[i]}<small>${data.changed.includes(string) ? "adjusted" : "held fixed"}</small></p><svg viewBox="0 0 600 30" aria-hidden="true"><path d="M0 15H600" stroke="#aab7af"/><circle cx="${position(initial)}" cy="15" r="4" fill="#f4f1e9" stroke="#4f6269"/><path d="M${position(initial)} 15H${position(hz)}" stroke="#a23e26" stroke-width="2"/><circle cx="${position(hz)}" cy="15" r="5" fill="${data.changed.includes(string) ? "#a23e26" : "#173441"}"/></svg><p class="partial-hertz">${hz.toFixed(6)} Hz</p></div>`;
    })
    .join("");
  return `<div class="practice-reading"><h3>The two selected partials</h3><p>Open dot: unchanged frequency. Filled dot: your setting. Both rows share a fixed linear axis, from ${low.toFixed(1)} to ${high.toFixed(1)} Hz.</p>${rows}<p class="partial-gap">Frequency difference: <strong>${data.partialDifferenceHz.toFixed(6)} Hz</strong></p><p>When these two partials are isolated as steady sine tones, their frequency difference is the amplitude-beat rate. In the full synthetic pair it is one interaction among several partials.</p><h3>Your setting and the model’s answer</h3><dl class="practice-values"><div><dt>Your ${practice.direction === "L" ? "loosening" : "tightening"}</dt><dd>${data.amount.toFixed(6)} cents${data.exactTargetChosen ? " · exact target selected" : ""}</dd></div><div><dt>Model’s exact adjustment</dt><dd>${data.targetAmount.toFixed(6)} cents · × ${html(data.targetFactor)}</dd></div><div><dt>Difference from the target</dt><dd>${data.errorFromTargetCents.toFixed(6)} cents</dd></div></dl><p>Negative means short of the target; positive means beyond it. This is a numerical comparison, not a pass/fail judgment about your hearing or a threshold for the ancient term <i lang="akk-Latn">zakû</i>.</p><p>The underlying tuning remains <span lang="akk-Latn">${html(data.tuning)}</span>. The model’s exact operation changes string ${data.changed.join(" + ")} and reaches <span lang="akk-Latn">${html(data.destination)}</span>; your tentative setting is kept separately.</p></div>`;
}
