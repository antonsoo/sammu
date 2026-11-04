import license from "../../LICENSE?raw";
import { SOURCES } from "../content";
import { cents, divide, ONE, ratioText } from "../core/rational";
import {
  type RouteComparison,
  type RouteListening,
  routeCsv,
  routePlan,
  routeRecord,
  routeWav,
} from "../core/routes";
import { tuningAt } from "../core/tuning";
import { html } from "./escape";
import { routePlot, routeSteps, routeTable } from "./routes-view";
import { base64, type StudyFonts } from "./study";

export function routesStudy(
  comparison: RouteComparison,
  listening: RouteListening,
  fonts: StudyFonts,
  edition: string,
): string {
  const record = routeRecord(comparison, listening, edition);
  const plan = routePlan(comparison, listening);
  const encoded = (value: string) => base64(new TextEncoder().encode(value));
  const json = `${JSON.stringify(record, null, 2)}\n`;
  const csv = routeCsv(comparison, listening.aligned);
  const sound = base64(routeWav(comparison, listening));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; media-src data:; img-src data:; base-uri 'none'; form-action 'none'">
<title>Sammû · Two roads to ${html(tuningAt(comparison.target).name)}</title><style>
@font-face{font-family:Atkinson;src:url(data:font/ttf;base64,${fonts.sans});font-weight:200 800}@font-face{font-family:Noto;src:url(data:font/ttf;base64,${fonts.serif})}*{box-sizing:border-box}body{font:17px/1.5 Atkinson,sans-serif;color:#173441;background:#f4f1e9;max-width:1000px;margin:auto;padding:32px}h1,h2{font-family:Noto,serif;font-weight:400;line-height:1.2}h1{font-size:3rem}h2{margin-top:2rem}a{color:inherit}p{max-width:76ch}.roads{display:grid;grid-template-columns:1fr 1fr;gap:30px}.roads section{border-top:3px solid #216568;padding:15px;background:#e4ebe8}.roads section+section{border-color:#713b77;background:#e9e3eb}.roads ol{padding-left:22px}.roads li{padding:5px}.roads li span{display:block}.roads b{font-weight:500}.pitch-axis{display:flex;justify-content:space-between;font-size:12px;margin:20px 80px 10px 30px}.pitch-strip{display:grid;grid-template-columns:20px minmax(0,1fr) 65px;gap:8px;align-items:center;border-bottom:1px solid #b6c1bd}.pitch-strip svg{width:100%;height:auto;min-height:28px}.pitch-strip span{text-align:right;font-size:12px}.pitch-strip small{display:block;font-size:10px}table{border-collapse:collapse;font-size:13px;width:100%;min-width:620px;font-variant-numeric:tabular-nums}th,td{text-align:left;padding:9px;border-bottom:1px solid #b6c1bd}td small{display:block;white-space:nowrap}.scroll{overflow:auto}audio{width:100%}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.5 Atkinson,sans-serif}details{margin-block:20px}footer{margin-top:35px;font-size:13px;overflow-wrap:anywhere}.downloads{display:flex;flex-wrap:wrap;gap:20px}.stay{list-style:none}.model{border-block:1px solid #b6c1bd;padding-block:15px}@media(max-width:550px){body{padding:18px}h1{font-size:2.2rem}.roads{gap:12px}.roads section{padding:8px}.roads li{font-size:13px;padding:5px 0}th,td{padding:5px;font-size:11px}}@page{size:A4;margin:16mm}@media print{body{background:white;padding:0;font-size:10pt}h1{font-size:27pt}h2{font-size:17pt}audio,.downloads,details,.screen-only{display:none}tr,.pitch-strip,.roads li{break-inside:avoid}table{font-size:8pt}.roads{gap:15px}.roads section{background:white}a{text-decoration:none}}
</style></head><body><main><h1>Two roads, one tuning.</h1>
<p>Start: <b lang="akk-Latn">${html(tuningAt(comparison.origin.current.tuning).name)}</b>, after ${comparison.origin.moves.length} earlier moves. Destination: <b lang="akk-Latn">${html(tuningAt(comparison.target).name)}</b>.</p>
<p>Initial session string 1: ${comparison.origin.settings.reference} Hz. Companion strings: ${comparison.origin.settings.companion}. Sound: ${comparison.origin.settings.colour}.</p>
<p class="model">Modern exact 4/3 and 3/2 realization. These numerical pitches and the comparison transposition are not recorded on the tablets.</p>
<div class="roads"><section><h2>A · ${comparison.a.moves.length ? "Loosen" : "Stay"} (${comparison.a.moves.length} moves)</h2><ol>${routeSteps(comparison.a)}</ol></section><section><h2>B · Tighten (${comparison.b.moves.length} moves)</h2><ol>${routeSteps(comparison.b)}</ol></section></div>
<h2>Same name, different pitches</h2><p>Every raw B pitch is ${html(ratioText(comparison.displacement))} times A, a shift of ${cents(comparison.displacement).toFixed(6)} cents. The interval pattern ${comparison.samePattern ? "matches exactly on all nine strings" : "does not match on all nine strings"}.</p>
<h2>Listen to the comparison</h2><p>${html(plan.title)}.</p><p>${listening.aligned ? `Only the heard B is transposed, by ${html(ratioText(divide(ONE, comparison.displacement)))}. The raw B column keeps the retuned result.` : "Both sounds use the pitches as retuned. No transposition is applied."}</p>
<audio controls preload="none" src="data:audio/wav;base64,${sound}">Embedded synthetic comparison audio.</audio>
<p>Filled circle: A. Open diamond: heard B. Dashed tick: starting pitch. Every string shares one logarithmic ruler.</p>${routePlot(comparison, listening.aligned)}
<h2>Check every string</h2><p>Fractions refer to the original session's initial string 1. The two raw results stay separate from heard B.</p><div class="scroll"><table><caption>Retuned pitches and the chosen listening comparison</caption><thead><tr><th scope="col">String</th><th scope="col">A: ratio / Hz</th><th scope="col">B: ratio / Hz</th><th scope="col">B / A</th><th scope="col">Heard B</th></tr></thead><tbody>${routeTable(comparison, listening.aligned)}</tbody></table></div>
<h2>Keep the experiment</h2><p class="screen-only">This file contains its fonts, audio, exact data and licenses. It opens from disk without a connection. Print to PDF for a paper copy; external source and reopen links need a connection.</p>
<div class="downloads"><a download="sammu-routes.json" href="data:application/json;base64,${encoded(json)}">Exact JSON and sound plan</a><a download="sammu-routes.csv" href="data:text/csv;base64,${encoded(csv)}">Pitch CSV</a><a download="sammu-routes.wav" href="data:audio/wav;base64,${sound}">Comparison WAV</a></div><p><a href="${html(record.reopen)}">Reopen this exact comparison</a></p>
<h2>Text, reconstruction, calculation</h2><p>The seven-name network follows the scholarly reconstruction. Mirelman (2013), figure 5, p. 52 and pp. 53–55 discusses the pattern and interpretation. Rahn (2022), paragraphs 11–16 treats the reversible network and repeated cycles; paragraph 45 explains the editorial basis of tightening terminology. The two routes' exact frequency factor and their transposed equality are deductions from this workshop's chosen 4/3 and 3/2 realization, not recovered ancient measurements.</p><ul>${SOURCES.slice(
    0,
    2,
  )
    .map((s) => `<li><a href="${html(s.url)}">${html(s.title)}</a></li>`)
    .join("")}</ul>
<details><summary>Exact numerical record</summary><pre>${html(json)}</pre></details><details><summary>Font licenses</summary><pre>${html(fonts.licenses)}</pre></details><details><summary>License for original code, diagrams and synthesis</summary><pre>${html(license)}</pre></details>
</main><footer>© 2026 Anthony Mercer · PolyForm Noncommercial 1.0.0. Free for noncommercial use; commercial use needs permission from anthony@praviel.com. Scholarly articles are linked, not redistributed. Edition ${html(edition)}.</footer></body></html>`;
}
