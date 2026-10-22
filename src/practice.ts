import "./style.css";
import "./practice.css";
import { wav } from "./core/audio";
import {
  applyPractice,
  type Practice,
  parsePractice,
  practiceLink,
  practicePlan,
  practiceQuery,
  preview,
} from "./core/practice";
import { parseQuery, queryFor } from "./core/query";
import { record } from "./core/records";
import { MAX_MOVES, replay, sequenceOf, tuningAt } from "./core/tuning";
import { offline } from "./offline";
import { actionStrings } from "./ui/diagrams";
import { html } from "./ui/escape";
import { saveFile } from "./ui/files";
import { Player } from "./ui/player";
import { practiceReading } from "./ui/practice-reading";
import { study, studyFonts } from "./ui/study";

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing practice control: ${id}`);
  return found as T;
}

let baseQuery = parseQuery(location.search);
let session = replay(baseQuery.settings, baseQuery.sequence);
let parsed = parsePractice(location.search);
let practice = parsed.practice;
const player = new Player((message, playing) => {
  element("audio-status").textContent = message;
  element("audio-status").dataset.playing = String(playing);
});

function render(): void {
  const data = preview(session, practice);
  const tuning = tuningAt(session.current.tuning);
  element("base-summary").textContent = `${data.tuning} · ${session.moves.length} exact moves`;
  element("practice-heading").textContent = `${tuning.unclear.name} · ${data.pair.join(" + ")}`;
  element("instruction").innerHTML =
    `In <span lang="akk-Latn">${html(data.tuning)}</span>, this pair is called <i lang="akk-Latn">lā zakû</i>, “not clear.” Your chosen action ${practice.direction === "L" ? "loosens" : "tightens"} string <b>${data.changed.join(" + ")}</b>.`;
  const select = element<HTMLSelectElement>("turn");
  if (!select.options.length)
    select.innerHTML = `<option value="L">Loosen string ${actionStrings(tuning.loosen)}</option><option value="T">Tighten string ${actionStrings(tuning.tighten)}</option>`;
  select.value = practice.direction;
  const slider = element<HTMLInputElement>("amount");
  slider.value = String(data.amount);
  slider.setAttribute(
    "aria-valuetext",
    `${data.amount.toFixed(3)} cents of ${practice.direction === "L" ? "loosening" : "tightening"}${data.exactTargetChosen ? ", exact model target" : ""}`,
  );
  element("amount-output").textContent = data.exactTargetChosen
    ? "Exact model target"
    : `${data.amount.toFixed(1)} cents`;
  element<HTMLInputElement>("pair").checked = practice.listen === "pair";
  element<HTMLInputElement>("partials").checked = practice.listen === "partials";
  element("measurements").hidden = !practice.revealed;
  element("listening-guide").hidden = practice.revealed;
  element("reveal").setAttribute("aria-expanded", String(practice.revealed));
  element("reveal").textContent = practice.revealed
    ? "Hide the measurements"
    : "Reveal the measurements";
  element("practice-reading").innerHTML = practiceReading(session, practice);
  element<HTMLButtonElement>("apply-model").disabled = session.moves.length >= MAX_MOVES;
  element("apply-note").textContent =
    session.moves.length >= MAX_MOVES
      ? "This exact session has 28 moves. Return and undo a step before applying another."
      : `This applies the exact operation, including companion strings, and opens ${data.destination} in the main workshop. Your tentative setting is not relabelled as that tuning.`;
  for (const id of ["return-top", "return-bottom"])
    element<HTMLAnchorElement>(id).href =
      `./${queryFor(session.settings, sequenceOf(session))}#bench`;
  element<HTMLAnchorElement>("source-link").href =
    `./${queryFor(session.settings, sequenceOf(session))}#evidence`;
  element("edition").textContent = `Workshop edition: ${__SAMMU_EDITION__}`;
  const warnings = [...baseQuery.warnings, ...parsed.warnings];
  element("warnings").hidden = !warnings.length;
  element("warnings").textContent = warnings.join(" ");
}

function update(change: Partial<Practice>): void {
  if (change.amount !== undefined || change.direction !== undefined || change.listen !== undefined)
    player.stop("Preview changed. Press Listen to hear this setting.");
  practice = { ...practice, ...change };
  history.replaceState(
    null,
    "",
    `${location.pathname}${practiceQuery(session, practice)}${location.hash || "#practice"}`,
  );
  render();
}

element("turn").addEventListener("change", () =>
  update({ direction: element<HTMLSelectElement>("turn").value as Practice["direction"] }),
);
element("amount").addEventListener("input", () =>
  update({ amount: Number(element<HTMLInputElement>("amount").value) }),
);
element("amount").addEventListener("keydown", (event) => {
  const amount = preview(session, practice).amount;
  const increment = event.shiftKey ? 1 : 0.1;
  const desired = (
    {
      ArrowRight: amount + increment,
      ArrowUp: amount + increment,
      ArrowLeft: amount - increment,
      ArrowDown: amount - increment,
      PageUp: amount + 10,
      PageDown: amount - 10,
      Home: 0,
      End: 180,
    } as Record<string, number>
  )[event.key];
  if (desired === undefined) return;
  event.preventDefault();
  update({ amount: Number(Math.min(180, Math.max(0, desired)).toFixed(6)) });
});
for (const listen of ["pair", "partials"] as const)
  element(listen).addEventListener("change", () => update({ listen }));
element("listen").addEventListener("click", () => {
  void player.play(practicePlan(session, practice));
});
element("compare").addEventListener("click", () => {
  void player.play(practicePlan(session, practice, "comparison"));
});
element("stop").addEventListener("click", () => player.stop());
element("reset-preview").addEventListener("click", () => update({ amount: 0 }));
element("reveal").addEventListener("click", () => update({ revealed: !practice.revealed }));
element("target").addEventListener("click", () => update({ amount: "target" }));
element("hear-target").addEventListener("click", () => {
  void player.play(practicePlan(session, practice, "target"));
});
element("apply-model").addEventListener("click", () => {
  if (session.moves.length < MAX_MOVES) {
    player.stop();
    location.assign(applyPractice(session, practice));
  }
});
element("save-wav").addEventListener("click", () => {
  saveFile(
    wav(practicePlan(session, practice, "comparison")),
    "audio/wav",
    "sammu-listening-practice.wav",
  );
  element("save-status").textContent =
    "Saved the unchanged/adjusted comparison: mono PCM16, 48 kHz.";
});
element("save-json").addEventListener("click", () => {
  saveFile(
    `${JSON.stringify(record(session, practicePlan(session, practice, "comparison"), __SAMMU_EDITION__, practice), null, 2)}\n`,
    "application/json",
    "sammu-listening-practice.json",
  );
  element("save-status").textContent =
    "Saved your preview, the exact base session, and its audio plan.";
});
element("save-study").addEventListener("click", async () => {
  const snapshot = session;
  const attempt = practice;
  const button = element<HTMLButtonElement>("save-study");
  button.disabled = true;
  element("save-status").textContent =
    "Embedding your practice, comparison audio, diagram, fonts and sources…";
  try {
    const fonts = await studyFonts();
    saveFile(
      study(
        snapshot,
        practicePlan(snapshot, attempt, "comparison"),
        fonts,
        __SAMMU_EDITION__,
        attempt,
      ),
      "text/html;charset=utf-8",
      "sammu-listening-practice.html",
    );
    element("save-status").textContent =
      "Saved the complete practice worksheet. Open it offline or print it to PDF.";
  } catch {
    element("save-status").textContent =
      "The worksheet could not embed its local fonts. Try again after reloading online; WAV and JSON are still available.";
  } finally {
    button.disabled = false;
  }
});
element("copy-link").addEventListener("click", async () => {
  const link = practiceLink(session, practice);
  try {
    await navigator.clipboard.writeText(link);
    element("save-status").textContent =
      "Copied your base tuning, exact move history and tentative adjustment.";
  } catch {
    element("save-status").innerHTML = `Copy this link: <a href="${html(link)}">${html(link)}</a>`;
  }
});
window.addEventListener("popstate", () => {
  player.stop();
  baseQuery = parseQuery(location.search);
  session = replay(baseQuery.settings, baseQuery.sequence);
  parsed = parsePractice(location.search);
  practice = parsed.practice;
  element<HTMLSelectElement>("turn").innerHTML = "";
  render();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) player.stop("Stopped while the practice is in the background.");
});
render();
void offline(element("offline-status"));
