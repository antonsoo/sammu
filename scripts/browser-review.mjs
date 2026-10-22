import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium, firefox } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.resolve(process.argv[2] ?? "/tmp/sammu-review/browser.json");
const directory = path.dirname(output);
await mkdir(directory, { recursive: true });
const base = process.env.SAMMU_BASE ?? "http://127.0.0.1:4385/sammu/";
const preview = process.env.SAMMU_BASE
  ? null
  : spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "preview",
        "--host",
        "127.0.0.1",
        "--port",
        "4385",
        "--strictPort",
      ],
      { cwd: root, stdio: "pipe" },
    );
let previewErrors = "";
preview?.stderr.on("data", (chunk) => {
  previewErrors += chunk;
});
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const names = ["išartum", "kitmum", "embūbum", "pītum", "nīd(i) qablim", "nīš tuḫrim", "qablītum"];
const ids = ["isartum", "kitmum", "embubum", "pitum", "nid-qablim", "nis-tuhrim", "qablitum"];
const report = { base, browsers: [], audio: [], screenshots: [], passed: false };

async function downloaded(page, button, name) {
  const waiting = page.waitForEvent("download");
  await page.locator(button).click();
  const download = await waiting;
  const destination = path.join(directory, name);
  await download.saveAs(destination);
  assert.equal(await download.failure(), null);
  const bytes = await readFile(destination);
  return {
    file: name,
    bytes: bytes.length,
    sha256: sha256(bytes),
    suggestedFilename: download.suggestedFilename(),
  };
}

async function shot(page, name, fullPage = false) {
  await page.screenshot({ path: path.join(directory, name), fullPage, animations: "disabled" });
  report.screenshots.push(name);
}

async function noOverflow(page) {
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    true,
    "page has horizontal overflow",
  );
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

async function captureAudio(page, tag, listening, metadata) {
  await page.locator("#export-sound").selectOption(listening);
  const jsonFile = await downloaded(page, "#save-json", `${tag}.json`);
  const record = JSON.parse(await readFile(path.join(directory, jsonFile.file), "utf8"));
  const wavFile = await downloaded(page, "#save-wav", `${tag}.wav`);
  report.audio.push({ ...metadata, listening, record: jsonFile, wav: wavFile });
  return record;
}

try {
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {}
    if (i === 79) throw new Error(`Preview did not become ready. ${previewErrors}`);
    await pause(100);
  }
  for (const [browserName, browserType] of [
    ["chromium", chromium],
    ["firefox", firefox],
  ]) {
    const browser = await browserType.launch({ headless: true });
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
        const page = await context.newPage();
        const label = `${browserName}-${layout}`;
        const errors = [];
        const csp = [];
        const externalRequests = [];
        page.on("pageerror", (error) => errors.push(String(error)));
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(message.text());
        });
        page.on("request", (request) => {
          if (
            new URL(request.url()).origin !== new URL(base).origin &&
            /^https?:/.test(request.url())
          )
            externalRequests.push(request.url());
        });
        await page.addInitScript(() => {
          window.__csp = [];
          window.__buffers = [];
          document.addEventListener("securitypolicyviolation", (event) =>
            window.__csp.push({ directive: event.violatedDirective, blocked: event.blockedURI }),
          );
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
        await page.goto(base);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(() =>
          document.getElementById("offline-status").textContent.startsWith("Ready offline"),
        );
        await noOverflow(page);
        assert.equal(await page.locator("#tuning-name").textContent(), names[0]);
        const firstPlay = await page.locator("#play-unclear").boundingBox();
        assert.ok(
          firstPlay && firstPlay.y < (layout === "phone" ? 760 : 720),
          `first listening control too low: ${firstPlay?.y}`,
        );
        const stopPosition = await page.locator("#stop").boundingBox();
        assert.ok(
          stopPosition && stopPosition.y < firstPlay.y,
          "stop control should be within reach before playback",
        );
        await page.keyboard.press("Tab");
        assert.equal(await page.evaluate(() => document.activeElement.className), "skip");
        assert.ok((await page.locator(".skip").boundingBox()).y >= 0);
        await page.keyboard.press("Enter");
        assert.equal(await page.evaluate(() => document.activeElement.id), "bench");
        await page.evaluate(() => scrollTo(0, 0));
        const audits = [await audit(page, `${label}: initial`)];
        await shot(page, `${label}-initial.png`);
        // Exercise a real keyboard action, preserving focus when text changes.
        await page.locator("#loosen").focus();
        await page.keyboard.press("Enter");
        assert.equal(await page.locator("#tuning-name").textContent(), names[1]);
        assert.equal(await page.evaluate(() => document.activeElement.id), "loosen");
        assert.equal(await page.locator("#string-2").getAttribute("data-ratio"), "8/9");
        assert.equal(await page.locator("#string-9").getAttribute("data-ratio"), "4/9");
        await page.locator(".overtones > summary").click();
        assert.match(
          await page.locator("#overtone-diagram").textContent(),
          /After · 1 shared partial/,
        );
        await page.locator("#bench").screenshot({
          path: path.join(directory, `${label}-retuned.png`),
          animations: "disabled",
        });
        report.screenshots.push(`${label}-retuned.png`);
        await page.locator("#play-last").click();
        await page.waitForFunction(() => window.__buffers.length === 1);
        const live = await page.evaluate(() => window.__buffers[0]);
        const liveName = `${label}-live.f32`;
        await writeFile(path.join(directory, liveName), Buffer.from(live.data, "base64"));
        await page.locator("#stop").click();
        assert.equal(await page.locator("#audio-status").textContent(), "Stopped.");
        const liveRecord = await captureAudio(page, `${label}-last-plucked`, "last", {
          browser: browserName,
          layout,
          live: { file: liveName, rate: live.rate, length: live.length },
        });
        assert.deepEqual(
          liveRecord.audio.notes.map((note) => note.string),
          [5, 2, 5, 2],
        );
        // Check reversibility through buttons, browser history, and copied URL state.
        await page.locator("#tighten").click();
        assert.equal(await page.locator("#string-2").getAttribute("data-ratio"), "243/256");
        await page.goBack();
        assert.equal(await page.locator("#string-2").getAttribute("data-ratio"), "8/9");
        await page.locator("#undo").click();
        assert.equal(await page.locator("#tuning-name").textContent(), names[0]);
        await page.locator("#cycle-loosen").click();
        assert.equal(await page.locator("#tuning-name").textContent(), names[0]);
        assert.equal(await page.locator("#string-1").getAttribute("data-ratio"), "2048/2187");
        assert.match(await page.locator("#cycle-result").textContent(), /-113\.685 cents/);
        await page.locator("#cycle-tighten").click();
        assert.equal(await page.locator("#string-1").getAttribute("data-ratio"), "1/1");
        await page.locator("#reset").click();
        // Goal navigation performs the displayed operation, rather than replacing a scale.
        await page.locator("#goal").selectOption("5");
        assert.match(await page.locator("#route-summary").textContent(), /^2 moves/);
        await page.locator("#apply-route").click();
        await page.locator("#apply-route").click();
        assert.equal(await page.locator("#tuning-name").textContent(), names[5]);
        await page.locator(".numbers > summary").click();
        assert.equal(await page.locator("#move-table tr").count(), 2);
        await noOverflow(page);
        audits.push(await audit(page, `${label}: retuned, overtone and pitch details open`));
        const csvFile = await downloaded(page, "#save-csv", `${label}-history.csv`);
        assert.equal(
          (await readFile(path.join(directory, csvFile.file), "utf8")).trim().split("\r\n").length,
          28,
        );
        const svgFile = await downloaded(page, "#save-svg", `${label}-diagram.svg`);
        assert.match(
          await readFile(path.join(directory, svgFile.file), "utf8"),
          /Current and initial pitches/,
        );
        await page.locator("#export-sound").selectOption("last");
        await captureAudio(page, `${label}-study-audio`, "last", { browser: browserName, layout });
        const studyFile = await downloaded(page, "#save-study", `${label}-study.html`);
        const studyPage = await context.newPage();
        const studyErrors = [];
        const studyRequests = [];
        studyPage.on("pageerror", (error) => studyErrors.push(String(error)));
        studyPage.on("console", (message) => {
          if (message.type() === "error") studyErrors.push(message.text());
        });
        studyPage.on("request", (request) => {
          if (/^https?:/.test(request.url())) studyRequests.push(request.url());
        });
        await studyPage.goto(pathToFileURL(path.join(directory, studyFile.file)).href);
        await studyPage.evaluate(() => document.fonts.ready);
        await noOverflow(studyPage);
        const embedded = JSON.parse(await studyPage.locator("#numerical-record").textContent());
        assert.equal(embedded.moves, "TT");
        assert.equal(embedded.snapshots.length, 3);
        assert.equal(await studyPage.locator("audio").count(), 1);
        const embeddedAudio = await studyPage.locator("audio").getAttribute("src");
        assert.equal(
          sha256(Buffer.from(embeddedAudio.split(",")[1], "base64")),
          sha256(await readFile(path.join(directory, `${label}-study-audio.wav`))),
        );
        await studyPage.locator("audio").evaluate((audio) => {
          audio.preload = "auto";
          audio.load();
        });
        await studyPage.waitForFunction(() => document.querySelector("audio").readyState >= 2);
        assert.ok(
          Math.abs(
            (await studyPage.locator("audio").evaluate((audio) => audio.duration)) -
              embedded.audio.duration,
          ) <
            1 / 48000,
        );
        audits.push(await audit(studyPage, `${label}: standalone study`));
        await shot(studyPage, `${label}-study.png`);
        if (browserName === "chromium" && layout === "desktop")
          await studyPage.pdf({
            path: path.join(directory, "sammu-study.pdf"),
            format: "A4",
            tagged: true,
            printBackground: true,
          });
        assert.deepEqual(studyErrors, []);
        assert.deepEqual(studyRequests, []);
        await studyPage.close();
        await page.bringToFront();
        // The setting changes retain the move sequence, while companion changes restart.
        await page.locator(".settings > summary").click();
        await page.locator("#colour").selectOption("sine");
        assert.equal(new URL(page.url()).searchParams.get("moves"), "TT");
        await page.locator("#reference").selectOption("220");
        await captureAudio(page, `${label}-last-sine`, "last", { browser: browserName, layout });
        await page.locator("#companion").selectOption("unison");
        assert.equal(new URL(page.url()).searchParams.get("moves"), "");
        assert.equal(await page.locator("#string-8").getAttribute("data-ratio"), "1/1");
        await page.locator("#loosen").click();
        const linkedUrl = page.url();
        await page.reload();
        assert.equal(page.url(), linkedUrl);
        assert.equal(await page.locator("#tuning-name").textContent(), names[1]);
        await context.setOffline(true);
        await page.reload();
        assert.equal(await page.locator("#tuning-name").textContent(), names[1]);
        await downloaded(page, "#save-study", `${label}-offline-study.html`);
        await page.locator("#play-named").click();
        await page.waitForFunction(
          () => document.getElementById("audio-status").dataset.playing === "true",
        );
        await page.locator("#stop").click();
        await context.setOffline(false);
        // Query failure is visible and a bounded experiment can still be run.
        await page.goto(`${base}?moves=LT&moves=bad`);
        assert.equal(await page.locator("#warnings").isVisible(), true);
        assert.equal(await page.locator("#tuning-name").textContent(), names[0]);
        await page.goto(`${base}?moves=${"L".repeat(28)}`);
        assert.equal(await page.locator("#loosen").isDisabled(), true);
        assert.equal(await page.locator("#cycle-tighten").isDisabled(), true);
        await page.locator("#undo").click();
        assert.equal(await page.locator("#loosen").isEnabled(), true);
        await noOverflow(page);
        csp.push(...(await page.evaluate(() => window.__csp)));
        assert.deepEqual(errors, [], `${label}: console/page errors`);
        assert.deepEqual(csp, [], `${label}: CSP violations`);
        assert.deepEqual(externalRequests, [], `${label}: external requests`);
        report.browsers.push({
          browser: browserName,
          layout,
          firstPlayY: firstPlay.y,
          audits,
          csv: csvFile,
          svg: svgFile,
          study: studyFile,
          offline: true,
          pageErrors: errors,
          csp,
          externalRequests,
        });
        await context.close();
      }
      // One browser covers the full named-tuning/audio matrix; both engines above
      // exercise live synthesis, retuning, native downloads and offline studies.
      if (browserName === "chromium") {
        const context = await browser.newContext({ acceptDownloads: true });
        const page = await context.newPage();
        for (let start = 0; start < 7; start++) {
          for (const sound of ["sine", "plucked"]) {
            for (const direction of ["L", "T"]) {
              await page.goto(
                `${base}?start=${ids[start]}&a=330&sound=${sound}&moves=${direction}`,
              );
              await captureAudio(page, `matrix-${start}-${sound}-${direction}`, "last", {
                browser: browserName,
                layout: "matrix",
              });
            }
          }
        }
        await context.close();
      }
    } finally {
      await browser.close();
    }
  }
  report.passed = true;
} finally {
  preview?.kill("SIGTERM");
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
}
process.stdout.write(
  `${JSON.stringify({ output, browsers: report.browsers.length, audioExports: report.audio.length, passed: report.passed }, null, 2)}\n`,
);
