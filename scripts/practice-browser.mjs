import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium, firefox } from "playwright";
import { reviewPreview } from "./review-preview.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.resolve(process.argv[2] ?? "/tmp/sammu-practice-review/browser.json");
const directory = path.dirname(output);
await mkdir(directory, { recursive: true });
const base = process.env.SAMMU_BASE ?? "http://127.0.0.1:4390/sammu/";
const preview = process.env.SAMMU_BASE ? null : reviewPreview(root, 4390);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const report = { base, browsers: [], audio: [], screenshots: [], passed: false };

async function download(page, selector, name) {
  const waiting = page.waitForEvent("download");
  await page.locator(selector).click();
  const item = await waiting;
  await item.saveAs(path.join(directory, name));
  assert.equal(await item.failure(), null);
  const bytes = await readFile(path.join(directory, name));
  return { file: name, bytes: bytes.length, sha256: hash(bytes) };
}

async function capture(page, tag, metadata = {}) {
  const record = await download(page, "#save-json", `${tag}.json`);
  const wav = await download(page, "#save-wav", `${tag}.wav`);
  const entry = { ...metadata, listening: "comparison", record, wav };
  report.audio.push(entry);
  return entry;
}

async function live(page, index, name) {
  const value = await page.evaluate((i) => window.__buffers[i], index);
  await writeFile(path.join(directory, name), Buffer.from(value.data, "base64"));
  return { file: name, rate: value.rate, length: value.length };
}

async function audit(page, label) {
  const result = await new AxeBuilder({ page }).analyze();
  assert.deepEqual(
    result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    [],
    label,
  );
  return {
    label,
    violations: result.violations.length,
    passes: result.passes.length,
    incomplete: result.incomplete.length,
  };
}

try {
  if (preview) await preview.ready;
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {}
    if (i === 79) throw new Error("The served practice page did not become ready.");
    await pause(100);
  }
  for (const [engine, launcher] of [
    ["chromium", chromium],
    ["firefox", firefox],
  ]) {
    const browser = await launcher.launch();
    try {
      for (const [layout, viewport] of [
        ["desktop", { width: 1440, height: 1000 }],
        ["phone", { width: 375, height: 900 }],
      ]) {
        const context = await browser.newContext({
          viewport,
          acceptDownloads: true,
          reducedMotion: "reduce",
        });
        try {
          const label = `${engine}-${layout}`;
          const page = await context.newPage();
          const errors = [];
          const external = [];
          page.on("pageerror", (error) => errors.push(String(error)));
          page.on("console", (message) => {
            if (message.type() === "error") errors.push(message.text());
          });
          page.on("request", (request) => {
            if (
              /^https?:/.test(request.url()) &&
              new URL(request.url()).origin !== new URL(base).origin
            )
              external.push(request.url());
          });
          await page.addInitScript(() => {
            window.__buffers = [];
            window.__csp = [];
            document.addEventListener("securitypolicyviolation", (e) =>
              window.__csp.push(e.violatedDirective),
            );
            const resume = AudioContext.prototype.resume;
            AudioContext.prototype.resume = function (...args) {
              const resumed = resume.apply(this, args);
              if (!window.__holdResume) return resumed;
              return resumed.then(
                () =>
                  new Promise((resolve) => {
                    window.__releaseResume = resolve;
                  }),
              );
            };
            const start = AudioBufferSourceNode.prototype.start;
            AudioBufferSourceNode.prototype.start = function (...args) {
              if (this.buffer) {
                const bytes = new Uint8Array(this.buffer.getChannelData(0).buffer);
                let binary = "";
                for (let i = 0; i < bytes.length; i += 16384)
                  binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
                window.__buffers.push({
                  rate: this.buffer.sampleRate,
                  length: this.buffer.length,
                  data: btoa(binary),
                });
              }
              return start.apply(this, args);
            };
          });
          await page.goto(`${base}?moves=LL&sound=sine`);
          const link = page.locator("#practice-link");
          await link.focus();
          await Promise.all([page.waitForNavigation(), page.keyboard.press("Enter")]);
          assert.equal(new URL(page.url()).searchParams.get("moves"), "LL");
          assert.match(new URL(page.url()).pathname, /practice\.html$/);
          await page.evaluate(() => document.fonts.ready);
          await page.waitForFunction(() =>
            document.getElementById("edition")?.textContent.startsWith("Workshop edition:"),
          );
          assert.equal(await page.locator("#measurements").isVisible(), false);
          const firstListen = await page.locator("#listen").boundingBox();
          const adjustment = await page.locator("#amount").boundingBox();
          assert.ok(firstListen.y < 780, `listen control too low: ${firstListen.y}`);
          assert.ok(
            adjustment.y + adjustment.height < viewport.height,
            `adjustment below initial viewport: ${adjustment.y}`,
          );
          const audits = [await audit(page, `${label}: hidden measurements`)];
          await page.screenshot({
            path: path.join(directory, `${label}-initial.png`),
            animations: "disabled",
          });
          report.screenshots.push(`${label}-initial.png`);
          await page.locator("#amount").focus();
          await page.keyboard.press("PageUp");
          await page.keyboard.press("Shift+ArrowRight");
          await page.keyboard.press("ArrowRight");
          assert.equal(await page.locator("#amount").inputValue(), "11.1");
          assert.equal(await page.evaluate(() => document.activeElement.id), "amount");
          await page.locator("#listen").click();
          await page.waitForFunction(() => window.__buffers.length === 1);
          await page.locator("#amount").focus();
          await page.keyboard.press("End");
          assert.equal(await page.locator("#audio-status").getAttribute("data-playing"), "false");
          assert.equal(await page.evaluate(() => window.__buffers.length), 1);
          await page.keyboard.press("Home");
          for (let i = 0; i < 11; i++) await page.keyboard.press("PageUp");
          assert.equal(await page.locator("#amount").inputValue(), "110");
          await page.locator("#partials").check();
          // Hold a real resume after audio is unlocked, then change the setting.
          // Releasing that older request must not start an abandoned sound.
          await page.evaluate(() => {
            window.__holdResume = true;
          });
          await page.locator("#listen").click();
          await page.waitForFunction(() => typeof window.__releaseResume === "function");
          await page.locator("#amount").focus();
          await page.keyboard.press("ArrowRight");
          await page.evaluate(async () => {
            window.__holdResume = false;
            window.__releaseResume();
            await new Promise(requestAnimationFrame);
          });
          assert.equal(await page.evaluate(() => window.__buffers.length), 1);
          assert.equal(await page.locator("#audio-status").getAttribute("data-playing"), "false");
          await page.keyboard.press("ArrowLeft");
          await page.locator("#listen").click();
          await page.waitForFunction(() => window.__buffers.length === 2);
          await page.locator("#reveal").click();
          assert.equal(await page.locator("#audio-status").getAttribute("data-playing"), "true");
          assert.equal(await page.locator("#measurements").isVisible(), true);
          assert.equal(await page.evaluate(() => document.activeElement.id), "reveal");
          await page.locator("#stop").click();
          await page.locator("#compare").click();
          await page.waitForFunction(() => window.__buffers.length === 3);
          const captured = await live(page, 2, `${label}-comparison.f32`);
          await page.locator("#stop").click();
          const urlBeforeTarget = page.url();
          await page.locator("#hear-target").click();
          await page.waitForFunction(() => window.__buffers.length === 4);
          const target = await live(page, 3, `${label}-target.f32`);
          assert.equal(page.url(), urlBeforeTarget);
          assert.equal(await page.locator("#amount").inputValue(), "110");
          await page.locator("#stop").click();
          const entry = await capture(page, `${label}-practice`, {
            engine,
            layout,
            live: captured,
            targetLive: target,
          });
          const record = JSON.parse(
            await readFile(path.join(directory, entry.record.file), "utf8"),
          );
          assert.equal(record.moves, "LL");
          assert.equal(record.settings.colour, "sine");
          assert.equal(record.practice.settings.amount, 110);
          audits.push(await audit(page, `${label}: revealed measurements`));
          await page.screenshot({
            path: path.join(directory, `${label}-revealed.png`),
            fullPage: true,
            animations: "disabled",
          });
          report.screenshots.push(`${label}-revealed.png`);
          const worksheet = await download(page, "#save-study", `${label}-worksheet.html`);
          const native = await context.newPage();
          const nativeErrors = [];
          const nativeRequests = [];
          native.on("pageerror", (error) => nativeErrors.push(String(error)));
          native.on("request", (request) => {
            if (/^https?:/.test(request.url())) nativeRequests.push(request.url());
          });
          await native.goto(pathToFileURL(path.join(directory, worksheet.file)).href);
          await native.evaluate(() => document.fonts.ready);
          const embeddedRecord = JSON.parse(
            await native.locator("#numerical-record").textContent(),
          );
          assert.equal(embeddedRecord.practice.settings.amount, 110);
          assert.equal(embeddedRecord.moves, "LL");
          assert.equal(await native.locator(".study-words dt").count(), 9);
          assert.equal(
            await native.getByRole("heading", { name: "The last change’s overtones" }).count(),
            0,
          );
          assert.ok(
            (await native.locator("main").textContent()).includes(
              "equally loud, steady sine tones",
            ),
          );
          assert.equal(await native.locator(".study-clause").count(), 3);
          assert.ok((await native.locator(".study-words").textContent()).includes("nasāḫum"));
          const encoded = await native.locator("audio").getAttribute("src");
          assert.equal(hash(Buffer.from(encoded.split(",")[1], "base64")), entry.wav.sha256);
          await native.locator("audio").evaluate((audio) => {
            audio.preload = "auto";
            audio.load();
          });
          await native.waitForFunction(() => document.querySelector("audio").readyState >= 2);
          audits.push(await audit(native, `${label}: native worksheet`));
          assert.equal(
            await native.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            true,
          );
          await native.screenshot({
            path: path.join(directory, `${label}-worksheet.png`),
            animations: "disabled",
          });
          report.screenshots.push(`${label}-worksheet.png`);
          if (engine === "chromium" && layout === "desktop")
            await native.pdf({
              path: path.join(directory, "practice-worksheet.pdf"),
              format: "A4",
              printBackground: true,
              tagged: true,
            });
          assert.deepEqual(nativeErrors, []);
          assert.deepEqual(nativeRequests, []);
          await native.close();
          await page.bringToFront();
          await page.locator("#target").click();
          assert.equal(new URL(page.url()).searchParams.get("cents"), "target");
          assert.match(await page.locator(".partial-gap").textContent(), /0\.000000 Hz/);
          await page.locator("#amount").focus();
          await page.keyboard.press("ArrowRight");
          assert.notEqual(new URL(page.url()).searchParams.get("cents"), "target");
          await page.locator(".practice-options > summary").click();
          await page.locator("#turn").selectOption("T");
          await page.locator("#target").click();
          await page.locator("#apply-model").click();
          await page.waitForURL((url) => !url.pathname.includes("practice.html"));
          await page.waitForFunction(
            (edition) =>
              document.getElementById("edition")?.textContent === `Workshop edition: ${edition}`,
            record.edition,
          );
          assert.equal(new URL(page.url()).searchParams.get("moves"), "LLT");
          assert.equal(await page.locator("#tuning-name").textContent(), "kitmum");
          assert.equal(await page.locator("#string-6").getAttribute("data-ratio"), "81/128");
          // A fresh offline navigation must load the new entry and its own exports.
          await page.goto(`${base}practice.html?moves=LL&cents=110&listen=partials&reveal=1`);
          await page.waitForFunction(() =>
            document.getElementById("offline-status").textContent.startsWith("Ready offline"),
          );
          await context.setOffline(true);
          await page.reload();
          assert.equal(await page.locator("#amount").inputValue(), "110");
          await page.locator("#listen").click();
          await page.waitForFunction(
            () => document.getElementById("audio-status").dataset.playing === "true",
          );
          await page.locator("#stop").click();
          await download(page, "#save-study", `${label}-offline-worksheet.html`);
          await page.locator("#return-top").click();
          assert.equal(new URL(page.url()).searchParams.get("moves"), "LL");
          await page.waitForFunction(
            (edition) =>
              document.getElementById("edition")?.textContent === `Workshop edition: ${edition}`,
            record.edition,
          );
          assert.equal(await page.locator("#tuning-name").textContent(), "embūbum");
          await context.setOffline(false);
          await page.goto(`${base}practice.html?cents=110&cents=target`);
          assert.equal(await page.locator("#warnings").isVisible(), true);
          assert.equal(await page.locator("#amount").inputValue(), "0");
          await page.goto(`${base}practice.html?moves=${"L".repeat(28)}&reveal=1`);
          assert.equal(await page.locator("#apply-model").isDisabled(), true);
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            true,
          );
          assert.deepEqual(await page.evaluate(() => window.__csp), []);
          assert.deepEqual(errors, []);
          assert.deepEqual(external, []);
          process.stdout.write(`${label}: practice, exports and offline navigation passed.\n`);
          report.browsers.push({
            engine,
            layout,
            firstListenY: firstListen.y,
            adjustmentBottom: adjustment.y + adjustment.height,
            audits,
            worksheet,
            offline: true,
            errors,
            external,
          });
        } finally {
          await context.close();
        }
      }
      if (engine === "chromium") {
        const context = await browser.newContext({ acceptDownloads: true });
        try {
          const page = await context.newPage();
          const ids = [
            "isartum",
            "kitmum",
            "embubum",
            "pitum",
            "nid-qablim",
            "nis-tuhrim",
            "qablitum",
          ];
          for (let start = 0; start < 7; start++) {
            for (const direction of ["L", "T"]) {
              for (const listen of ["pair", "partials"]) {
                for (const amount of ["110", "target"]) {
                  const reference = [220, 330, 440][start % 3];
                  await page.goto(
                    `${base}practice.html?start=${ids[start]}&a=${reference}&sound=sine&companions=${start % 2 ? "unison" : "octave"}&moves=LTT&turn=${direction}&listen=${listen}&cents=${amount}&reveal=1`,
                  );
                  await capture(page, `matrix-${start}-${direction}-${listen}-${amount}`, {
                    engine,
                    layout: "matrix",
                  });
                }
              }
            }
          }
        } finally {
          await context.close();
        }
      }
    } finally {
      await browser.close();
    }
  }
  report.passed = true;
} finally {
  preview?.stop();
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
}
process.stdout.write(
  `${JSON.stringify({ output, browsers: report.browsers.length, audioExports: report.audio.length, passed: report.passed }, null, 2)}\n`,
);
