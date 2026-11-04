import "./style.css";
import "./routes.css";
import { parseQuery, queryFor } from "./core/query";
import { cents, divide, numeric, ONE, ratioText } from "./core/rational";
import {
  compareRoutes,
  parseRouteOptions,
  type RouteListening,
  routeCsv,
  routePlan,
  routeQuery,
  routeRecord,
  routeWav,
} from "./core/routes";
import { MAX_MOVES, pitch, replay, STRINGS, sequenceOf, TUNINGS, tuningAt } from "./core/tuning";
import { offline } from "./offline";
import { html } from "./ui/escape";
import { saveFile } from "./ui/files";
import { Player } from "./ui/player";
import { routesStudy } from "./ui/routes-study";
import { routePlot, routeSteps, routeTable } from "./ui/routes-view";
import { StudyDownload } from "./ui/study-download";

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing route element: ${id}`);
  return value as T;
}

function fromLocation() {
  const parsed = parseQuery(location.search);
  const session = replay(parsed.settings, parsed.sequence);
  const options = parseRouteOptions(location.search, session);
  return {
    session,
    comparison: compareRoutes(session, options.target),
    listening: options.listening,
    warnings: [...parsed.warnings, ...options.warnings],
  };
}
let state = fromLocation();
const player = new Player((message, playing) => {
  el("audio-status").textContent = message;
  el("audio-status").dataset.playing = String(playing);
});
const originalLink = () => `./${queryFor(state.session.settings, sequenceOf(state.session))}#bench`;

function render(): void {
  const { session, comparison, listening } = state;
  el<HTMLAnchorElement>("bench-link").href = originalLink();
  el<HTMLAnchorElement>("evidence-link").href =
    `./${queryFor(session.settings, sequenceOf(session))}#evidence`;
  el("origin-description").innerHTML =
    `Your fork starts in <b lang="akk-Latn">${html(tuningAt(session.current.tuning).name)}</b>, after ${session.moves.length} bench moves. String 1 is ${(numeric(pitch(session.current, 1)) * session.settings.reference).toFixed(3)} Hz.`;
  el("fork-origin").textContent = tuningAt(session.current.tuning).name;
  el<HTMLSelectElement>("target").value = String(comparison.target);
  el<HTMLSelectElement>("listen-string").value = String(listening.string);
  for (const input of document.querySelectorAll<HTMLInputElement>('input[name="alignment"]'))
    input.checked = (input.value === "aligned") === listening.aligned;
  for (const key of ["a", "b"] as const) {
    const route = comparison[key];
    el(`${key}-heading`).textContent =
      `${key.toUpperCase()} · ${route.moves.length ? (route.direction === "L" ? "Loosen" : "Tighten") : "Stay"}`;
    el(`${key}-count`).textContent =
      `${route.moves.length} move${route.moves.length === 1 ? "" : "s"}`;
    el(`${key}-steps`).innerHTML = routeSteps(route);
    el(`${key}-end`).innerHTML =
      `<b lang="akk-Latn">${html(tuningAt(route.end.tuning).name)}</b>String 1: ${(numeric(pitch(route.end, 1)) * session.settings.reference).toFixed(3)} Hz`;
    el<HTMLButtonElement>(`take-${key}`).disabled =
      route.moves.length === 0 || session.moves.length + route.moves.length > MAX_MOVES;
  }
  el("limit-note").hidden = [comparison.a, comparison.b].every(
    (r) => session.moves.length + r.moves.length <= MAX_MOVES,
  );
  el("result-name").textContent = "Same name. Different pitches.";
  el("result-description").textContent =
    `Every B pitch is ${ratioText(comparison.displacement)} times A: +${cents(comparison.displacement).toFixed(3)} cents. ${comparison.samePattern ? "All nine strings share exactly the same interval pattern." : "The interval patterns differ."}`;
  el("alignment-note").textContent = listening.aligned
    ? `Heard B is multiplied by ${ratioText(divide(ONE, comparison.displacement))}. All nine frequencies now match A exactly. This is a modern listening transposition; the retuned B stays in the table.`
    : "Hear both routes exactly as retuned. Then transpose B: does the difference disappear on every string?";
  el("pitch-plot").innerHTML = routePlot(comparison, listening.aligned);
  el("route-table").innerHTML = routeTable(comparison, listening.aligned);
  el("warnings").hidden = state.warnings.length === 0;
  el("warnings").textContent = state.warnings.join(" ");
}

function update(listening = state.listening): void {
  player.stop("Comparison changed. Press Hear A, then B to listen.");
  state = { ...state, listening };
  history.pushState(
    null,
    "",
    `${location.pathname}${routeQuery(state.comparison, listening)}${location.hash}`,
  );
  render();
}

el("target").innerHTML = TUNINGS.map(
  (t, i) => `<option value="${i}" lang="akk-Latn">${html(t.name)}</option>`,
).join("");
el("listen-string").innerHTML = [
  ...STRINGS.map((s) => `<option value="${s}">String ${s}</option>`),
  '<option value="all">All nine, in physical order</option>',
].join("");
el("target").addEventListener("change", () => {
  state = {
    ...state,
    comparison: compareRoutes(state.session, Number(el<HTMLSelectElement>("target").value)),
  };
  update();
});
el("listen-string").addEventListener("change", () => {
  const value = el<HTMLSelectElement>("listen-string").value;
  update({
    ...state.listening,
    string: value === "all" ? "all" : (Number(value) as RouteListening["string"]),
  });
});
for (const input of document.querySelectorAll<HTMLInputElement>('input[name="alignment"]'))
  input.addEventListener("change", () =>
    update({ ...state.listening, aligned: input.value === "aligned" }),
  );
el("play").addEventListener("click", () => {
  void player.play(routePlan(state.comparison, state.listening));
});
el("stop").addEventListener("click", () => player.stop());
for (const key of ["a", "b"] as const)
  el(`take-${key}`).addEventListener("click", () => {
    const route = state.comparison[key];
    const moves = [...sequenceOf(state.session), ...route.moves.map((m) => m.direction)];
    if (moves.length > MAX_MOVES || !route.moves.length) return;
    location.assign(`./${queryFor(state.session.settings, moves)}#bench`);
  });
el("save-json").addEventListener("click", () => {
  saveFile(
    `${JSON.stringify(routeRecord(state.comparison, state.listening, __SAMMU_EDITION__), null, 2)}\n`,
    "application/json",
    "sammu-routes.json",
  );
  el("export-status").textContent =
    "Saved both routes, every intermediate pitch and the listening plan as JSON.";
});
el("save-csv").addEventListener("click", () => {
  saveFile(
    routeCsv(state.comparison, state.listening.aligned),
    "text/csv;charset=utf-8",
    "sammu-routes.csv",
  );
  el("export-status").textContent =
    "Saved all nine raw A/B pitches and heard B as separate CSV columns.";
});
el("save-wav").addEventListener("click", () => {
  const plan = routePlan(state.comparison, state.listening);
  saveFile(routeWav(state.comparison, state.listening), "audio/wav", "sammu-routes.wav");
  el("export-status").textContent = `Saved ${plan.title}. Mono PCM16, 48 kHz.`;
});
const studyDownload = new StudyDownload(
  el<HTMLButtonElement>("save-study"),
  el<HTMLButtonElement>("cancel-study"),
  el("export-status"),
);
el("save-study").addEventListener("click", () => {
  const { comparison, listening } = state;
  void studyDownload.start("sammu-routes.html", (fonts) =>
    routesStudy(comparison, listening, fonts, __SAMMU_EDITION__),
  );
});
el("copy-link").addEventListener("click", async () => {
  const link = new URL(`routes.html${routeQuery(state.comparison, state.listening)}`, location.href)
    .href;
  try {
    await navigator.clipboard.writeText(link);
    el("export-status").textContent =
      "Copied the origin, destination, earlier moves and listening settings.";
  } catch {
    el("export-status").innerHTML =
      `Copy this comparison: <a href="${html(link)}">${html(link)}</a>`;
  }
});
window.addEventListener("popstate", () => {
  player.stop("Restored the linked comparison.");
  state = fromLocation();
  render();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) player.stop("Stopped while the workshop is in the background.");
});
el("edition").textContent = `Workshop edition: ${__SAMMU_EDITION__}`;
const tableRegion = el("route-table").closest<HTMLElement>(".table-scroll");
if (tableRegion) tableRegion.tabIndex = 0;
render();
void offline(el("offline-status"));
