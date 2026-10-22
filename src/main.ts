import "./style.css";
import { CLAUSES, MODEL_STATEMENT, SOURCES, WORDS } from "./content";
import {
  comparisonPlan,
  cyclePlan,
  type Listening,
  pairPlan,
  type SoundPlan,
  stringPlan,
  strumPlan,
  wav,
} from "./core/audio";
import { parseQuery, queryFor } from "./core/query";
import { cents, ratioText } from "./core/rational";
import { csv, experimentLink, record, snapshots } from "./core/records";
import {
  type Colour,
  type Companion,
  type Direction,
  frequency,
  MAX_MOVES,
  pitch,
  type Reference,
  replay,
  type Session,
  type Settings,
  STRING_NAMES,
  STRINGS,
  sequenceOf,
  shift,
  shortestRoute,
  TUNINGS,
  tuningAt,
} from "./core/tuning";
import { offline } from "./offline";
import {
  actionStrings,
  cycleDiagram,
  overtoneDiagram,
  pitchDiagram,
  stringLabel,
  trace,
} from "./ui/diagrams";
import { html } from "./ui/escape";
import { Player } from "./ui/player";
import { study, studyFonts } from "./ui/study";

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing workshop element: ${id}`);
  return found as T;
}

let locationState = parseQuery(location.search);
let session = replay(locationState.settings, locationState.sequence);
let goal = 2;
const player = new Player((message, playing) => {
  element("audio-status").textContent = message;
  element("audio-status").dataset.playing = String(playing);
});

function selectedPlan(snapshot: Session = session): SoundPlan {
  const type = element<HTMLSelectElement>("export-sound").value as Listening;
  const tuning = tuningAt(snapshot.current.tuning);
  const last = snapshot.moves.at(-1);
  if (type === "last" && last) return comparisonPlan(snapshot, last);
  if (type === "cycle") return cyclePlan(snapshot);
  if (type === "strum") return strumPlan(snapshot);
  return type === "named"
    ? pairPlan(snapshot, tuning.named.pair, `Named clear pair ${tuning.named.name}`)
    : pairPlan(snapshot, tuning.unclear.pair, `Unclear pair ${tuning.unclear.name}`);
}

function listen(type: Listening): void {
  element<HTMLSelectElement>("export-sound").value = type;
  void player.play(selectedPlan());
}

function showWarnings(): void {
  const warnings = element("warnings");
  warnings.hidden = locationState.warnings.length === 0;
  warnings.textContent = locationState.warnings.join(" ");
}

function renderRoute(): void {
  const steps = shortestRoute(session.current.tuning, goal);
  element("route-summary").textContent = steps.length
    ? `${steps.length} move${steps.length === 1 ? "" : "s"} to ${tuningAt(goal).name}:`
    : "You already have this tuning name. Absolute pitches depend on the path taken.";
  let mode = session.current.tuning;
  element("route").innerHTML = steps
    .map((direction) => {
      const current = tuningAt(mode);
      const string = direction === "L" ? current.loosen : current.tighten;
      const next = (mode + (direction === "L" ? 1 : 6)) % 7;
      mode = next;
      return `<li>${direction === "L" ? "Loosen" : "Tighten"} string ${actionStrings(string)} → <span lang="akk-Latn">${html(tuningAt(next).name)}</span></li>`;
    })
    .join("");
  element<HTMLButtonElement>("apply-route").disabled =
    steps.length === 0 || session.moves.length >= MAX_MOVES;
  element("cycle-diagram").innerHTML = cycleDiagram(session, goal);
}

function render(): void {
  const tuning = tuningAt(session.current.tuning);
  const last = session.moves.at(-1);
  const atLimit = session.moves.length >= MAX_MOVES;
  element("tuning-name").textContent = tuning.name;
  element("diagnosis").innerHTML =
    `Test <b lang="akk-Latn">${html(tuning.unclear.name)}</b>, strings <b>${tuning.unclear.pair.join(" + ")}</b>. In this tuning, the pair is <em>lā zakû</em> — “not clear.”`;
  element("unclear-name").textContent = tuning.unclear.name;
  element("unclear-detail").textContent = `${tuning.unclear.pair.join(" + ")} · unclear pair`;
  element("named-name").textContent = tuning.named.name;
  element("named-detail").textContent = `${tuning.named.pair.join(" + ")} · named clear pair`;
  element("move-count").textContent = session.moves.length
    ? `Move ${session.moves.length} of ${MAX_MOVES}`
    : "Starting arrangement";
  element("loosen").textContent = `Loosen string ${actionStrings(tuning.loosen)}`;
  element("tighten").textContent = `Tighten string ${actionStrings(tuning.tighten)}`;
  element<HTMLButtonElement>("loosen").disabled = atLimit;
  element<HTMLButtonElement>("tighten").disabled = atLimit;
  element("action-explanation").textContent = atLimit
    ? "This session has reached 28 moves. Undo a step or start again to continue."
    : `Either action makes ${tuning.unclear.name} clear. A different pair becomes unclear, identifying the next tuning.`;
  element<HTMLButtonElement>("play-last").disabled = !last;
  element<HTMLButtonElement>("undo").disabled = !last;
  element<HTMLButtonElement>("reset").disabled = !last;
  element<HTMLButtonElement>("cycle-loosen").disabled = session.moves.length + 7 > MAX_MOVES;
  element<HTMLButtonElement>("cycle-tighten").disabled = session.moves.length + 7 > MAX_MOVES;
  element("companion-caption").textContent =
    `Strings 1 + 8 and 2 + 9 change together. Here, 8 and 9 are ${session.settings.companion === "octave" ? "one octave below" : "in unison with"} 1 and 2. Change this assumption in the settings.`;
  for (const string of STRINGS) {
    const row = element<HTMLButtonElement>(`string-${string}`);
    const changed = last?.changed.includes(string) ?? false;
    const diagnostic = tuning.unclear.pair.some((n) => n === string);
    row.className = `string-row${string > 7 ? " companion" : ""}${changed ? " last-changed" : ""}${diagnostic ? " diagnostic" : ""}`;
    row.title = stringLabel(session, string);
    row.dataset.ratio = ratioText(pitch(session.current, string));
    row.dataset.hertz = String(frequency(session.current, string, session.settings.reference));
    row.innerHTML = `<span class="number">${string}</span><span class="string-name">${html(STRING_NAMES[string])}${string > 7 ? `<small>paired with ${string - 7}</small>` : changed ? "<small>last changed</small>" : ""}</span>${trace(session, string)}<span class="hz">${frequency(session.current, string, session.settings.reference).toFixed(2)}<small>Hz</small></span>`;
  }
  element<HTMLSelectElement>("start").value = String(session.settings.start);
  element<HTMLSelectElement>("reference").value = String(session.settings.reference);
  element<HTMLSelectElement>("companion").value = session.settings.companion;
  element<HTMLSelectElement>("colour").value = session.settings.colour;
  const lastOption =
    element<HTMLSelectElement>("export-sound").querySelector<HTMLOptionElement>(
      'option[value="last"]',
    );
  if (lastOption) lastOption.disabled = !last;
  if (!last && element<HTMLSelectElement>("export-sound").value === "last")
    element<HTMLSelectElement>("export-sound").value = "unclear";
  const displacement = shift(session);
  const returned = session.current.tuning === session.initial.tuning;
  element("cycle-result").innerHTML =
    `${returned ? "The initial tuning name is present." : `Current name: ${html(tuning.name)}.`} String 1 has shifted <strong>${cents(displacement) >= 0 ? "+" : ""}${cents(displacement).toFixed(3)} cents</strong> from its initial pitch (× ${html(ratioText(displacement))}).`;
  element("tuning-table").innerHTML = TUNINGS.map(
    (t, i) =>
      `<tr class="${i === session.current.tuning ? "current" : ""}"><th scope="row" lang="akk-Latn">${html(t.name)}${i === session.current.tuning ? " · current" : ""}</th><td>${t.named.pair.join(" + ")}</td><td>${t.unclear.pair.join(" + ")}</td><td>${actionStrings(t.loosen)}</td><td>${actionStrings(t.tighten)}</td></tr>`,
  ).join("");
  const current = snapshots(session).at(-1);
  element("pitch-table").innerHTML =
    current?.strings
      .map(
        (string) =>
          `<tr><th scope="row">${string.string}</th><td>${html(string.ratioToInitialFirstString)}</td><td>${string.hertz.toFixed(6)}</td><td>${string.shiftCents.toFixed(6)}</td></tr>`,
      )
      .join("") ?? "";
  element("move-table").innerHTML = session.moves.length
    ? session.moves
        .map(
          (move, i) =>
            `<tr><th scope="row">${i + 1}</th><td>${move.direction === "L" ? "Loosen" : "Tighten"}</td><td>${move.changed.join(" + ")}</td><td lang="akk-Latn">${html(tuningAt(move.after.tuning).name)}</td></tr>`,
        )
        .join("")
    : '<tr><td colspan="4">No actions yet. Test a pair and choose a string to retune.</td></tr>';
  element("overtone-diagram").innerHTML = overtoneDiagram(session);
  renderRoute();
}

function commit(next: Session, message: string, push = true): void {
  player.stop("Stopped for the updated experiment.");
  session = next;
  const url = `${location.pathname}${queryFor(session.settings, sequenceOf(session))}${location.hash || "#bench"}`;
  if (push) history.pushState(null, "", url);
  else history.replaceState(null, "", url);
  render();
  element("session-status").textContent = message;
}

function append(directions: readonly Direction[]): void {
  if (directions.length + session.moves.length > MAX_MOVES) return;
  const next = replay(session.settings, [...sequenceOf(session), ...directions]);
  const last = next.moves.at(-1);
  commit(
    next,
    directions.length === 7
      ? `Seven ${directions[0] === "L" ? "loosening" : "tightening"} steps complete. The name returns; compare the pitches below.`
      : `${last?.direction === "L" ? "Loosened" : "Tightened"} string ${last?.changed.join(" + ")}. Now ${tuningAt(next.current.tuning).name}. Hear the last change to compare the same pair.`,
  );
}

function settingsChanged(change: Partial<Settings>, restart = false): void {
  const settings = { ...session.settings, ...change };
  commit(
    replay(settings, restart ? [] : sequenceOf(session)),
    restart
      ? "A new starting arrangement is ready."
      : "Settings changed; your retuning moves are preserved.",
  );
}

function download(
  content: string | Uint8Array<ArrayBuffer>,
  type: string,
  extension: string,
  snapshot = session,
): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `sammu-${tuningAt(snapshot.current.tuning).id}-${snapshot.moves.length}-moves.${extension}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const options = TUNINGS.map(
  (t, i) => `<option value="${i}" lang="akk-Latn">${html(t.name)}</option>`,
).join("");
element("start").innerHTML = options;
element("goal").innerHTML = options;
element<HTMLSelectElement>("goal").value = String(goal);
element("strings").innerHTML = STRINGS.map(
  (n) => `<button type="button" id="string-${n}" class="string-row"></button>`,
).join("");
element("clauses").innerHTML = CLAUSES.map(
  (c) =>
    `<article class="clause"><div><h3 lang="akk-Latn">${html(c.title)}</h3><p>${html(c.summary)}</p><small>${html(c.evidence)}</small></div><p class="preservation">${html(c.preservation)}</p></article>`,
).join("");
element("words").innerHTML = WORDS.map(
  ([word, meaning, note]) =>
    `<div class="word"><dt lang="akk-Latn">${html(word)}</dt><dd><strong>${html(meaning)}</strong>${html(note)}</dd></div>`,
).join("");
element("sources").innerHTML = SOURCES.map(
  (s) => `<li><a href="${html(s.url)}">${html(s.title)}</a><p>${html(s.note)}</p></li>`,
).join("");
element("model-statement").textContent = MODEL_STATEMENT;
element("edition").textContent = `Workshop edition: ${__SAMMU_EDITION__}`;
element("loosen").addEventListener("click", () => append(["L"]));
element("tighten").addEventListener("click", () => append(["T"]));
element("undo").addEventListener("click", () =>
  commit(
    replay(session.settings, sequenceOf(session).slice(0, -1)),
    "Undid the last move, including its exact pitches.",
  ),
);
element("reset").addEventListener("click", () =>
  commit(replay(session.settings), "Returned to the initial arrangement."),
);
element("play-unclear").addEventListener("click", () => listen("unclear"));
element("play-named").addEventListener("click", () => listen("named"));
element("play-last").addEventListener("click", () => listen("last"));
element("play-cycle").addEventListener("click", () => listen("cycle"));
element("strum").addEventListener("click", () => listen("strum"));
element("stop").addEventListener("click", () => player.stop());
for (const string of STRINGS)
  element(`string-${string}`).addEventListener("click", () => {
    void player.play(stringPlan(session, string));
  });
element("cycle-loosen").addEventListener("click", () => append(Array<Direction>(7).fill("L")));
element("cycle-tighten").addEventListener("click", () => append(Array<Direction>(7).fill("T")));
element("goal").addEventListener("change", () => {
  goal = Number(element<HTMLSelectElement>("goal").value);
  renderRoute();
});
element("apply-route").addEventListener("click", () =>
  append(shortestRoute(session.current.tuning, goal).slice(0, 1)),
);
element("start").addEventListener("change", () =>
  settingsChanged({ start: Number(element<HTMLSelectElement>("start").value) }, true),
);
element("reference").addEventListener("change", () =>
  settingsChanged({
    reference: Number(element<HTMLSelectElement>("reference").value) as Reference,
  }),
);
element("colour").addEventListener("change", () =>
  settingsChanged({ colour: element<HTMLSelectElement>("colour").value as Colour }),
);
element("companion").addEventListener("change", () =>
  settingsChanged({ companion: element<HTMLSelectElement>("companion").value as Companion }, true),
);
element("save-csv").addEventListener("click", () => {
  download(csv(session), "text/csv;charset=utf-8", "csv");
  element("export-status").textContent = "Saved every pitch at every step as CSV.";
});
element("save-json").addEventListener("click", () => {
  download(
    `${JSON.stringify(record(session, selectedPlan(), __SAMMU_EDITION__), null, 2)}\n`,
    "application/json",
    "json",
  );
  element("export-status").textContent = "Saved the complete session and audio plan as JSON.";
});
element("save-svg").addEventListener("click", () => {
  download(pitchDiagram(session), "image/svg+xml", "svg");
  element("export-status").textContent = "Saved the current and initial pitches as an SVG diagram.";
});
element("save-wav").addEventListener("click", () => {
  const plan = selectedPlan();
  download(wav(plan), "audio/wav", "wav");
  element("export-status").textContent = `Saved: ${plan.title}. Mono PCM16, 48 kHz.`;
});
element("save-study").addEventListener("click", async () => {
  const button = element<HTMLButtonElement>("save-study");
  const snapshot = session;
  const plan = selectedPlan(snapshot);
  button.disabled = true;
  element("export-status").textContent = "Embedding the diagram, audio, fonts and source notes…";
  try {
    const fonts = await studyFonts();
    download(
      study(snapshot, plan, fonts, __SAMMU_EDITION__),
      "text/html;charset=utf-8",
      "html",
      snapshot,
    );
    element("export-status").textContent =
      `Saved the ${snapshot.moves.length}-move study. Open it offline or print it to PDF.`;
  } catch {
    element("export-status").textContent =
      "The study could not embed its local fonts. Try again after reloading online; CSV, JSON and WAV are still available.";
  } finally {
    button.disabled = false;
  }
});
element("copy-link").addEventListener("click", async () => {
  const link = experimentLink(session);
  try {
    await navigator.clipboard.writeText(link);
    element("export-status").textContent =
      "Copied the starting settings and every move as an experiment link.";
  } catch {
    element("export-status").innerHTML =
      `Copy this link: <a href="${html(link)}">${html(link)}</a>`;
  }
});
window.addEventListener("popstate", () => {
  locationState = parseQuery(location.search);
  showWarnings();
  commit(
    replay(locationState.settings, locationState.sequence),
    "Restored the linked experiment.",
    false,
  );
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) player.stop("Stopped while the workshop is in the background.");
});
// A scrollable table region needs focus so keyboard users can move it horizontally.
for (const region of document.querySelectorAll<HTMLElement>(".table-scroll")) region.tabIndex = 0;
showWarnings();
render();
void offline(element("offline-status"));
