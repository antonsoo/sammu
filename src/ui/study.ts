import { CLAUSES, MODEL_STATEMENT, SOURCES, WORDS } from "../content";
import { type SoundPlan, wav } from "../core/audio";
import { type Practice, practiceLink } from "../core/practice";
import { experimentLink, record, snapshots } from "../core/records";
import { frequency, type Session, STRING_NAMES, STRINGS, tuningAt } from "../core/tuning";
import { overtoneDiagram, pitchDiagram, trace } from "./diagrams";
import { html } from "./escape";
import { practiceReading } from "./practice-reading";

export interface StudyFonts {
  readonly sans: string;
  readonly serif: string;
  readonly licenses: string;
}

export function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 16384)
    binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return btoa(binary);
}

export async function studyFonts(): Promise<StudyFonts> {
  const fetchFile = async (name: string) => {
    const response = await fetch(`${import.meta.env.BASE_URL}fonts/${name}`);
    if (!response.ok) throw new Error("Unable to embed a local study font.");
    return new Uint8Array(await response.arrayBuffer());
  };
  const [sans, serif, sansLicense, serifLicense] = await Promise.all([
    fetchFile("AtkinsonHyperlegibleNext.ttf"),
    fetchFile("NotoSerif-Regular.ttf"),
    fetchFile("Atkinson-OFL.txt"),
    fetchFile("NotoSerif-OFL.txt"),
  ]);
  return {
    sans: base64(sans),
    serif: base64(serif),
    licenses: `${new TextDecoder().decode(sansLicense)}\n\n${new TextDecoder().decode(serifLicense)}`,
  };
}

export function study(
  session: Session,
  plan: SoundPlan,
  fonts: StudyFonts,
  edition: string,
  practice?: Practice,
): string {
  const data = record(session, plan, edition, practice);
  const current = snapshots(session).at(-1);
  if (!current) throw new Error("No study state.");
  const rows = current.strings
    .map(
      (string) =>
        `<tr>
<td>${string.string}</td>
<td>${html(string.ratioToInitialFirstString)}</td>
<td>${string.hertz.toFixed(6)}</td>
<td>${html(string.shiftRatio)}</td>
<td>${string.shiftCents.toFixed(6)}</td>
</tr>`,
    )
    .join("");
  const compactDiagram = `<section class="compact-diagram" aria-label="Current and initial pitches">
<h2>Current and initial pitches</h2>
<p>Open dot: initial · filled dot: current · rust: last changed.</p>${STRINGS.map(
    (string) => `<div class="compact-pitch">
<b>${string}</b>
<span>${html(STRING_NAMES[string])}</span>${trace(session, string)}<span>${frequency(session.current, string, session.settings.reference).toFixed(2)} Hz</span>
</div>`,
  ).join("")}</section>`;
  const history = data.snapshots
    .map(
      (snapshot) =>
        `<tr>
<td>${snapshot.step}</td>
<td>${snapshot.action}</td>
<td lang="akk-Latn">${html(snapshot.name)}</td>
<td>${snapshot.changed.join(" + ") || "—"}</td>
<td>${html(snapshot.strings[0]?.ratioToInitialFirstString ?? "")}</td>
</tr>`,
    )
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; media-src data:; img-src data:; base-uri 'none'; form-action 'none'">
<title>Sammû study · ${html(current.name)}</title>
<style>
@font-face{font-family:Atkinson;src:url(data:font/ttf;base64,${fonts.sans}) format('truetype');font-weight:200 800}@font-face{font-family:Noto;src:url(data:font/ttf;base64,${fonts.serif}) format('truetype')}*{box-sizing:border-box}body{font-family:Atkinson,sans-serif;color:#173441;background:#f4f1e9;margin:0 auto;padding:35px;max-width:1000px;line-height:1.5}h1,h2{font-family:Noto,serif;font-weight:400;line-height:1.2}h1{font-size:2.6rem}h2{margin-top:2.5rem}a{color:inherit}svg{width:100%;height:auto}table{border-collapse:collapse;width:100%;font-size:.85rem;font-variant-numeric:tabular-nums}th,td{text-align:left;border-bottom:1px solid #b6c1bd;padding:9px;overflow-wrap:anywhere}.scroll{overflow-x:auto}small{font-size:.8rem}pre{font:12px/1.5 Atkinson,sans-serif;white-space:pre-wrap;overflow-wrap:anywhere}audio{width:100%}.model{border-block:1px solid #b6c1bd;padding-block:15px}.sources li{margin-bottom:15px}.sources p{font-size:.85rem}details{margin-top:22px}summary{cursor:pointer}footer{margin-top:40px;font-size:.75rem;overflow-wrap:anywhere}@media(max-width:550px){body{padding:18px}h1{font-size:2rem}th,td{padding:6px}table{font-size:.7rem}}.compact-diagram{display:none}.compact-pitch{display:grid;grid-template-columns:22px 78px minmax(0,1fr) 66px;gap:8px;align-items:center;border-bottom:1px solid #b6c1bd;padding:14px 0;font-size:12px}.compact-pitch b{font:22px Noto,serif}.compact-pitch svg{width:100%;height:26px}.compact-diagram>p{font-size:12px}.compact-diagram h2{font-size:22px}@media screen and (max-width:550px){.desktop-diagram{display:none}.compact-diagram{display:block}}.partial-reading{border-top:1px solid #b6c1bd;padding-block:12px;display:grid;grid-template-columns:140px 1fr 125px;gap:12px;align-items:center}.partial-reading p{margin:0;font-size:13px}.partial-reading small{display:block}.partial-reading svg{width:100%;height:30px}.partial-hertz{text-align:right}.practice-values>div{display:grid;grid-template-columns:1fr 1fr;gap:12px;border-bottom:1px solid #b6c1bd;padding-block:10px}.practice-values dt,.practice-values dd{margin:0}.practice-reading>p{font-size:.9rem}@media(max-width:550px){.partial-reading{grid-template-columns:1fr 1fr}.partial-reading svg{grid-column:1/-1;grid-row:2}.partial-hertz{grid-column:2;grid-row:1}.practice-values>div{grid-template-columns:1fr;font-size:.85rem}.partial-reading p{font-size:13px}}.study-clause{border-top:1px solid #b6c1bd;padding-top:12px;break-inside:avoid}.study-clause h3{font:18px Noto,serif}.study-clause p{font-size:.9rem}.study-words>div{display:grid;grid-template-columns:120px 1fr;gap:20px;border-top:1px solid #b6c1bd;padding-block:15px;break-inside:avoid}.study-words dt{font:19px Noto,serif}.study-words dd{margin:0;font-size:.86rem}.study-words p{margin-bottom:0}.study-words strong{font-weight:500}@media(max-width:550px){.study-words>div{grid-template-columns:90px 1fr;gap:12px}.study-words dt{font-size:17px}.study-words dd{font-size:.81rem}}@page{size:A4;margin:16mm}@media print{body{padding:0;background:#fff;max-width:none;font-size:10pt}audio,.screen-only{display:none}h1{font-size:25pt}h2{font-size:17pt}table{font-size:8pt}svg{max-height:190mm}tr{break-inside:avoid}h2,h3{break-after:avoid}.sources li{break-inside:avoid}details{display:none}a{text-decoration:none}}
</style>
</head>
<body>
<main>
<p>MESOPOTAMIA · A MODERN AUDIBLE REALIZATION</p>
<h1>Sammû · ${practice ? "listening practice" : html(tuningAt(session.current.tuning).name)}</h1>
<p>${session.moves.length} retuning moves · initial string 1: ${session.settings.reference} Hz · companion strings: ${html(session.settings.companion)} · sound: ${html(plan.colour)}</p>
<p class="model">${html(MODEL_STATEMENT)}</p>
<p class="screen-only">This file includes its fonts, diagram, audio and numerical record. Open it offline, or use your browser’s Print command to save a PDF. External source links need a connection.</p>
${practice ? `<section aria-label="Your listening practice"><h2>Your tentative adjustment</h2>${practiceReading(session, practice)}<p><a href="${html(practiceLink(session, practice))}">Reopen this listening practice</a></p></section><h2>Underlying exact tuning, before the preview</h2>` : ""}<div class="desktop-diagram">${pitchDiagram(session)}</div>${compactDiagram}<h2>Hear the experiment</h2>
<p>${html(plan.title)}. Each sound is synthetic.${practice ? (practice.listen === "partials" ? " The two selected partials are isolated as equally loud, steady sine tones." : " Both strings use six decaying sine partials; the base bench’s sound setting is kept separately.") : ""}</p>
<audio controls preload="none" src="data:audio/wav;base64,${base64(wav(plan))}">
</audio>${!practice && session.moves.length ? `<h2>The last change’s overtones</h2>${overtoneDiagram(session)}<p>Marks are the sine partials in this synthetic sound. A guide connects partials at exactly the same frequency; it does not establish what the ancient term “clear” meant.</p>` : ""}<h2>Current pitches</h2>
<p>Exact ratios are relative to the initial first string, not a new reference after every move. Shifts compare each string with its own initial pitch.</p>
<section class="scroll" tabindex="0" aria-label="Current string pitches">
<table>
<thead>
<tr>
<th>String</th>
<th>Ratio to initial 1</th>
<th>Hertz</th>
<th>Shift ratio</th>
<th>Shift, cents</th>
</tr>
</thead>
<tbody>${rows}</tbody>
</table>
</section>
<h2>Every retuning step</h2>
<section class="scroll" tabindex="0" aria-label="Retuning history">
<table>
<thead>
<tr>
<th>Step</th>
<th>Action</th>
<th>Resulting tuning</th>
<th>Strings changed</th>
<th>String 1 ratio</th>
</tr>
</thead>
<tbody>${history}</tbody>
</table>
</section>
<h2>Read the procedure and its preservation</h2>
<p>These are our summaries of three neighboring cases in the published translation. A supplied scribal omission and a restoration across damaged text are different kinds of editorial intervention.</p>
${CLAUSES.map((clause) => `<article class="study-clause"><h3 lang="akk-Latn">${html(clause.title)}</h3><p>${html(clause.summary)}</p><p>${html(clause.preservation)}</p><p><small>${html(clause.evidence)}</small></p></article>`).join("")}
<h2>Akkadian word notes</h2>
<p>Normalized romanization, with selected meanings in this context. The notes distinguish a preserved action word from a restored interpretation.</p>
<dl class="study-words">${WORDS.map(([word, meaning, note]) => `<div><dt lang="akk-Latn">${html(word)}</dt><dd><strong>${html(meaning)}</strong><p>${html(note)}</p></dd></div>`).join("")}</dl>
<h2>How to read this model</h2>
<p>Six pairs of strings are assigned exact 4/3 or 3/2 frequency ratios. The remaining diagnostic pair is left unclear. Each operation changes only the prescribed string (and its companion for strings 1 or 2), making that diagnostic pair clear. The next diagnostic pair then becomes unclear.</p>
<p>Seven moves in one direction return the tuning name but shift every string by 2048/2187 when loosening, or 2187/2048 when tightening. These fractions are consequences of this model, not ratios written on a tablet. No ancient reference pitch, recorded performance, instrument shape, or exact ancient sound colour is claimed.</p>
<p>The two tuning manuscripts from Ur are fragmentary. Combining them with later string-pair evidence is a scholarly reconstruction. In Mirelman’s edition, supplied scribal omissions use ⟨ ⟩ and text restored across a break uses [ ]. For example, the first loosening case has an editorially supplied description of the diagnostic pair; the third is mostly restored.</p>
<h2>Sources and provenance</h2>
<ol class="sources">${SOURCES.map(
    (source) => `<li>
<a href="${html(source.url)}">${html(source.title)}</a>
<p>${html(source.note)}</p>
</li>`,
  ).join("")}</ol>
<p>
<a href="${html(experimentLink(session))}">Reopen the experiment in Sammû</a>
</p>
<details>
<summary>Full numerical and audio record · JSON</summary>
<pre id="numerical-record">${html(JSON.stringify(data, null, 2))}</pre>
</details>
<details>
<summary>Embedded font licenses · SIL Open Font License 1.1</summary>
<pre>${html(fonts.licenses)}</pre>
</details>
</main>
<footer>Original code, diagrams and synthesis © 2026 Anton Soloviev · MIT. Source articles and photographs are linked, not redistributed. Edition ${html(edition)}.</footer>
</body>
</html>`;
}
