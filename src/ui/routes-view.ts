import { cents, divide, numeric, ratioText } from "../core/rational";
import { heardB, type Route, type RouteComparison } from "../core/routes";
import { pitch, STRINGS, tuningAt } from "../core/tuning";
import { html } from "./escape";

export function routeSteps(route: Route): string {
  if (!route.moves.length)
    return '<li class="stay">Stay at the starting pitches. No strings move.</li>';
  return route.moves
    .map(
      (m) =>
        `<li><span>${m.direction === "L" ? "Loosen" : "Tighten"} ${m.changed.join(" + ")}</span><b lang="akk-Latn">${html(tuningAt(m.after.tuning).name)}</b></li>`,
    )
    .join("");
}

export function routeTable(comparison: RouteComparison, aligned: boolean): string {
  const hz = (r: ReturnType<typeof pitch>) =>
    (numeric(r) * comparison.origin.settings.reference).toFixed(6);
  return STRINGS.map((s) => {
    const a = pitch(comparison.a.end, s),
      b = pitch(comparison.b.end, s);
    return `<tr><th scope="row">${s}</th><td>${html(ratioText(a))}<small>${hz(a)} Hz</small></td><td>${html(ratioText(b))}<small>${hz(b)} Hz</small></td><td>${html(ratioText(divide(b, a)))}</td><td>${hz(heardB(comparison, s, aligned))} Hz</td></tr>`;
  }).join("");
}

/** One shared logarithmic axis for every string; never autoscale each row. */
export function routePlot(comparison: RouteComparison, aligned: boolean): string {
  const origin = pitch(comparison.origin.current, 1);
  const position = (r: ReturnType<typeof pitch>) => cents(divide(r, origin));
  const values = STRINGS.flatMap((s) => [
    position(pitch(comparison.origin.current, s)),
    position(pitch(comparison.a.end, s)),
    position(pitch(comparison.b.end, s)),
  ]);
  const min = Math.floor((Math.min(...values) - 90) / 100) * 100;
  const max = Math.ceil((Math.max(...values) + 90) / 100) * 100;
  const x = (v: number) => 12 + ((v - min) / (max - min)) * 476;
  const hz = (v: number) =>
    (numeric(origin) * comparison.origin.settings.reference * 2 ** (v / 1200)).toFixed(1);
  return `<div class="pitch-axis"><span>${hz(min)} Hz</span><span>One shared pitch ruler</span><span>${hz(max)} Hz</span></div><div class="pitch-strips">${STRINGS.map(
    (s) => {
      const a = position(pitch(comparison.a.end, s)),
        b = position(heardB(comparison, s, aligned)),
        start = position(pitch(comparison.origin.current, s));
      return `<div class="pitch-strip"><b>${s}</b><svg viewBox="0 0 500 32" role="img" aria-label="String ${s}: A ${(numeric(pitch(comparison.a.end, s)) * comparison.origin.settings.reference).toFixed(3)} hertz, heard B ${(numeric(heardB(comparison, s, aligned)) * comparison.origin.settings.reference).toFixed(3)} hertz"><path d="M12 16H488" stroke="#b6c1bd"/><path d="M${x(start)} 4V28" stroke="#65777c" stroke-dasharray="2 2"/><path d="M${x(a)} 16H${x(b)}" stroke="#65777c" stroke-width="2"/><circle cx="${x(a)}" cy="16" r="7" fill="#216568"/><path d="M${x(b)} 6l10 10-10 10-10-10Z" fill="none" stroke="#713b77" stroke-width="2.5"/></svg><span>${(b - a).toFixed(3)}<small>cents B / A</small></span></div>`;
    },
  ).join("")}</div>`;
}
