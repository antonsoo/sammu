import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium, firefox } from "playwright";
import { reviewPreview } from "./review-preview.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const directory = path.resolve(process.argv[2] ?? "/tmp/claude-1000/sammu-routes/browser");
await mkdir(directory, { recursive: true });
const base = process.env.SAMMU_BASE ?? "http://127.0.0.1:4397/sammu/";
const preview = process.env.SAMMU_BASE ? null : reviewPreview(root, 4397);
const report = { base, journeys: [], downloads: [], audio: [], passed: false };
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function download(page, selector, name) {
  const waiting = page.waitForEvent("download");
  await page.locator(selector).click();
  const item = await waiting;
  assert.equal(await item.failure(), null);
  const file = path.join(directory, name);
  await item.saveAs(file);
  const bytes = await readFile(file);
  report.downloads.push({ file: name, bytes: bytes.length, sha256: hash(bytes) });
  return { file, bytes };
}
async function captureAudio(page, tag, record) {
  const value = await page.evaluate(() => window.__played.at(-1));
  const file = `${tag}.f32`;
  await writeFile(path.join(directory, file), Buffer.from(value.data, "base64"));
  report.audio.push({ file, sampleRate: value.sampleRate, record });
}

async function audit(page) {
  const results = await new AxeBuilder({ page }).analyze();
  assert.deepEqual(
    results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    [],
  );
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
    "page must not overflow",
  );
  return results.passes.length;
}

try {
  if (preview) await preview.ready;
  for (const [name, engine] of [
    ["chromium", chromium],
    ["firefox", firefox],
  ]) {
    const browser = await engine.launch({ headless: true });
    try {
      for (const width of [1440, 375]) {
        const tag = `${name}-${width}`;
        const context = await browser.newContext({
          viewport: { width, height: 1000 },
          acceptDownloads: true,
        });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.addInitScript(() => {
          window.__violations = [];
          window.__played = [];
          const start = AudioBufferSourceNode.prototype.start;
          AudioBufferSourceNode.prototype.start = function (...args) {
            if (this.buffer) {
              const bytes = new Uint8Array(this.buffer.getChannelData(0).buffer);
              let binary = "";
              for (let i = 0; i < bytes.length; i += 16384)
                binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
              window.__played.push({ sampleRate: this.buffer.sampleRate, data: btoa(binary) });
            }
            return start.apply(this, args);
          };
          window.addEventListener("securitypolicyviolation", (e) =>
            window.__violations.push(e.violatedDirective),
          );
        });
        // A whole preceding cycle must survive discovery, both forks and return.
        await page.goto(
          `${base}?start=isartum&a=440&companions=octave&sound=plucked&moves=LLLLLLL#cycle`,
        );
        await page.locator("#routes-link").click();
        await page.waitForURL("**/routes.html?**");
        assert.match(
          await page.locator("#origin-description").textContent(),
          /after 7 bench moves/,
        );
        assert.match(await page.locator("#a-end").textContent(), /412\.035/);
        assert.match(await page.locator("#b-end").textContent(), /440\.000/);
        assert.match(await page.locator("#result-description").textContent(), /2187\/2048/);
        const accessibility = await audit(page);
        await page.waitForFunction(
          () => document.querySelector("#offline-status").textContent.startsWith("Ready offline"),
          null,
          { timeout: 30000 },
        );
        await page.screenshot({ path: path.join(directory, `${tag}-raw.png`), fullPage: true });
        const raw = await download(page, "#save-json", `${tag}-raw.json`);
        const rawRecord = JSON.parse(raw.bytes);
        assert.equal(rawRecord.origin.priorMoves, "LLLLLLL");
        assert.equal(rawRecord.a.moves.length, 2);
        assert.equal(rawRecord.b.moves.length, 5);
        assert.equal(rawRecord.sound.notes.length, 2);
        await page.locator("#play").click();
        await page.waitForFunction(
          () => document.querySelector("#audio-status").dataset.playing === "true",
        );
        await captureAudio(page, `${tag}-raw`, `${tag}-raw.json`);
        await page.locator("#stop").click();
        const originalAxis = await page.locator(".pitch-axis").textContent();
        const originalA = await page
          .locator(".pitch-strip circle")
          .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("cx")));
        await page.locator('input[value="aligned"]').check();
        await page.locator("#listen-string").selectOption("all");
        assert.equal(await page.locator(".pitch-axis").textContent(), originalAxis);
        assert.deepEqual(
          await page
            .locator(".pitch-strip circle")
            .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("cx"))),
          originalA,
        );
        await page.locator("#play").click();
        await page.waitForFunction(
          () => document.querySelector("#audio-status").dataset.playing === "true",
        );
        await page.locator("#stop").click();
        assert.equal(await page.locator("#audio-status").getAttribute("data-playing"), "false");
        const aligned = await download(page, "#save-json", `${tag}-aligned.json`);
        const record = JSON.parse(aligned.bytes);
        assert.deepEqual(record.a, rawRecord.a);
        assert.deepEqual(record.b, rawRecord.b);
        assert.equal(record.listening.bMultiplier, "2048/2187");
        await captureAudio(page, `${tag}-aligned`, `${tag}-aligned.json`);
        assert.deepEqual(
          record.sound.notes.slice(0, 9).map((n) => n.hz),
          record.sound.notes.slice(9).map((n) => n.hz),
        );
        await download(page, "#save-csv", `${tag}.csv`);
        await download(page, "#save-wav", `${tag}.wav`);
        const reading = await download(page, "#save-study", `${tag}.html`);
        assert.ok(reading.bytes.includes(Buffer.from("PolyForm Noncommercial License 1.0.0")));
        assert.ok(reading.bytes.includes(Buffer.from("SIL OPEN FONT LICENSE")));
        const comparisonUrl = page.url();
        // Removing this room from the saved edition must withdraw readiness.
        await page.evaluate(async () => {
          const name = (await caches.keys()).find((name) => name.startsWith("sammu-"));
          const cache = await caches.open(name);
          await cache.delete(new URL("routes.html", location.href));
        });
        await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
        await page.waitForFunction(() =>
          document.querySelector("#offline-status").textContent.includes("needs repair"),
        );
        await page.locator("#offline-repair").click();
        await page.waitForFunction(() =>
          document.querySelector("#offline-status").textContent.startsWith("Ready offline"),
        );
        // Route B applies real moves; no normalization to a fresh tuning.
        await page.locator("#take-b").click();
        await page.waitForURL(
          (url) => url.pathname === "/sammu/" && url.searchParams.get("moves") === "LLLLLLLTTTTT",
        );
        assert.equal(
          await page.locator("#string-1").getAttribute("data-ratio"),
          record.b.end.strings[0].ratioToInitialFirstString,
        );
        await page.goto(comparisonUrl);
        // Browser history must restore both destination and listening controls.
        await page.locator("#target").selectOption("0");
        assert.match(await page.locator("#a-count").textContent(), /0 moves/);
        assert.equal(await page.locator("#take-a").isDisabled(), true);
        await page.goBack();
        assert.equal(await page.locator("#target").inputValue(), "2");
        assert.equal(await page.locator('input[value="aligned"]').isChecked(), true);
        await page.locator("#target").focus();
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");
        assert.equal(await page.locator("#target").inputValue(), "3");
        await page.goto(comparisonUrl);
        await context.setOffline(true);
        await page.reload();
        assert.match(await page.locator("#alignment-note").textContent(), /2048\/2187/);
        await page.waitForFunction(() =>
          document.querySelector("#offline-status").textContent.startsWith("Ready offline"),
        );
        await download(page, "#save-study", `${tag}-offline.html`);
        await page.locator("#play").click();
        await page.waitForFunction(
          () => document.querySelector("#audio-status").dataset.playing === "true",
        );
        await page.locator("#stop").click();
        await context.setOffline(false);
        // A complete 28-move bench still permits inspection, but cannot apply extra moves.
        await page.goto(`${base}routes.html?moves=${"T".repeat(28)}&target=embubum`);
        assert.equal(await page.locator("#take-a").isDisabled(), true);
        assert.equal(await page.locator("#take-b").isDisabled(), true);
        assert.equal(await page.locator("#limit-note").isVisible(), true);
        // Malformed comparison options must explain the fallback.
        await page.goto(`${base}routes.html?target=wrong&listen=0&aligned=perhaps`);
        assert.equal(await page.locator("#warnings").isVisible(), true);
        assert.equal(await page.locator('input[value="raw"]').isChecked(), true);
        await page.goto(comparisonUrl);
        await page.locator("#comparison").scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(directory, `${tag}-aligned.png`), fullPage: true });
        const alignedAccessibility = await audit(page);
        assert.deepEqual(errors, []);
        assert.deepEqual(await page.evaluate(() => window.__violations), []);
        // Test the artifact from disk with the network disabled, including native data downloads.
        const disk = await browser.newContext({
          viewport: { width, height: 1000 },
          offline: true,
          acceptDownloads: true,
        });
        const saved = await disk.newPage();
        const requests = [];
        saved.on("request", (r) => {
          if (/^https?:/.test(r.url())) requests.push(r.url());
        });
        await saved.goto(pathToFileURL(reading.file).href);
        await saved.evaluate(() => document.fonts.ready);
        assert.equal(await saved.locator("tbody tr").count(), 9);
        assert.equal(
          await saved.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
        );
        await saved.locator("audio").evaluate((audio) => audio.play());
        assert.equal(await saved.locator("audio").evaluate((audio) => audio.paused), false);
        await saved.locator("audio").evaluate((audio) => audio.pause());
        const embedded = await download(
          saved,
          'a[download="sammu-routes.json"]',
          `${tag}-embedded.json`,
        );
        assert.deepEqual(JSON.parse(embedded.bytes), record);
        await download(saved, 'a[download="sammu-routes.wav"]', `${tag}-embedded.wav`);
        if (name === "chromium" && width === 1440)
          await saved.pdf({
            path: path.join(directory, "reading.pdf"),
            printBackground: true,
            preferCSSPageSize: true,
          });
        await saved.screenshot({ path: path.join(directory, `${tag}-disk.png`), fullPage: true });
        assert.deepEqual(requests, []);
        report.journeys.push({
          browser: name,
          width,
          accessibility,
          alignedAccessibility,
          offline: true,
          disk: true,
          pageErrors: errors,
        });
        await disk.close();
        await context.close();
      }
    } finally {
      await browser.close();
    }
  }
  report.passed = true;
} finally {
  preview?.stop();
  await writeFile(path.join(directory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
}
console.log(
  JSON.stringify({
    passed: report.passed,
    journeys: report.journeys.length,
    downloads: report.downloads.length,
    directory,
  }),
);
