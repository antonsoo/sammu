import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium, firefox } from "playwright";
import { observe, tapSource } from "./audio-capture.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.resolve(process.argv[2] ?? "/tmp/sammu-live-review/browser.json");
const directory = path.dirname(output);
await mkdir(directory, { recursive: true });
const base = "http://127.0.0.1:4391/sammu/";
// Chromium's worklet loader bypasses Playwright routing. Serve the review-only
// tap beside the unmodified dist files; it is never part of the saved edition.
const mime = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
};
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, base).pathname;
  try {
    if (pathname === "/sammu/live-review-tap.js") {
      response.writeHead(200, { "Content-Type": "text/javascript" });
      response.end(tapSource);
      return;
    }
    assert.ok(pathname.startsWith("/sammu/"));
    const file = path.resolve(root, "dist", decodeURIComponent(pathname.slice(7)) || "index.html");
    assert.ok(file.startsWith(path.join(root, "dist") + path.sep));
    const bytes = await readFile(file);
    response.writeHead(200, {
      "Content-Type": mime[path.extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(bytes);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});
const report = { base, browsers: [], signals: [], passed: false };

async function signal(page, engine, layout, name) {
  // Discard the transition and collect the actual stationary output. The
  // independent oracle fits frequencies from the source fixture, not node values.
  await page.waitForTimeout(220);
  await page.evaluate(() => {
    window.__chunks = [];
    window.__take = true;
  });
  await page.waitForFunction(
    () => window.__chunks.length * 4096 >= window.__captureContext.sampleRate * 1.7,
  );
  const captured = await page.evaluate(() => {
    window.__take = false;
    const pcm = Float32Array.from(window.__chunks.flatMap((c) => c.samples));
    const bytes = new Uint8Array(pcm.buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 16384)
      binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
    return {
      frames: window.__chunks.map((c) => c.frame),
      continuousQuanta: window.__chunks.every((c) =>
        c.quantumFrames.every((f, i, a) => !i || f - a[i - 1] === 128),
      ),
      data: btoa(binary),
      length: pcm.length,
      rate: window.__captureContext.sampleRate,
    };
  });
  assert.ok(
    captured.frames.every((frame, i) => i === 0 || frame - captured.frames[i - 1] === 4096),
    "audio capture has a missing render quantum",
  );
  assert.ok(captured.continuousQuanta, "capture skipped an audio render quantum");
  const file = `${engine}-${layout}-${name}.f32`;
  await writeFile(path.join(directory, file), Buffer.from(captured.data, "base64"));
  const query = Object.fromEntries(new URL(page.url()).searchParams);
  report.signals.push({
    engine,
    layout,
    name,
    file,
    continuousRenderFrames: true,
    length: captured.length,
    rate: captured.rate,
    query,
  });
}

async function performance(page) {
  const events = [];
  await page.locator("#amount").focus();
  await page.keyboard.press("Home");
  for (let i = 0; i < 11; i++) await page.keyboard.press("PageUp");
  await page.waitForTimeout(220);
  await page.evaluate(() => {
    window.__chunks = [];
    window.__take = true;
  });
  for (const [amount, duration, presses] of [
    [110, 2200, 0],
    [112, 2200, 2],
    [114, 6200, 2],
    [120, 2200, 6],
  ]) {
    for (let i = 0; i < presses; i++) await page.keyboard.press("Shift+ArrowRight");
    const time = await page.evaluate(() => window.__oscillators.at(-1).context.currentTime);
    events.push({ amount, time });
    await page.waitForTimeout(duration);
  }
  const end = await page.evaluate(() => window.__oscillators.at(-1).context.currentTime);
  const captured = await page.evaluate(() => {
    window.__take = false;
    const pcm = Float32Array.from(window.__chunks.flatMap((c) => c.samples));
    const bytes = new Uint8Array(pcm.buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 16384)
      binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
    return {
      data: btoa(binary),
      rate: window.__oscillators.at(-1).context.sampleRate,
      firstFrame: window.__chunks[0].frame,
      frames: window.__chunks.map((c) => c.frame),
      length: pcm.length,
    };
  });
  assert.ok(captured.frames.every((f, i) => i === 0 || f - captured.frames[i - 1] === 4096));
  const file = "continuous-adjustment.f32";
  await writeFile(path.join(directory, file), Buffer.from(captured.data, "base64"));
  const query = Object.fromEntries(new URL(page.url()).searchParams);
  for (const [i, event] of events.entries()) {
    const firstSample = Math.max(
      0,
      Math.ceil((event.time + 0.3) * captured.rate - captured.firstFrame),
    );
    const lastSample = Math.min(
      captured.length,
      Math.floor(((events[i + 1]?.time ?? end) - 0.1) * captured.rate - captured.firstFrame),
    );
    report.signals.push({
      engine: "chromium",
      layout: "desktop",
      name: `continuous-${event.amount}`,
      file,
      firstSample,
      lastSample,
      length: lastSample - firstSample,
      rate: captured.rate,
      continuousRenderFrames: true,
      query: { ...query, cents: String(event.amount) },
    });
  }
  report.performance = {
    file,
    rate: captured.rate,
    length: captured.length,
    firstFrame: captured.firstFrame,
    events,
    end,
    query,
    continuousRenderFrames: true,
  };
  // Continue using the same oscillators for the following full-pair comparison.
  await page.keyboard.press("Home");
  for (let i = 0; i < 11; i++) await page.keyboard.press("PageUp");
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Shift+ArrowRight");
}

async function audit(page) {
  const result = await new AxeBuilder({ page }).analyze();
  assert.deepEqual(
    result.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
    [],
  );
  return {
    violations: result.violations.length,
    passes: result.passes.length,
    incomplete: result.incomplete.length,
  };
}

async function engineReview(engine, launcher) {
  const browser = await launcher.launch();
  try {
    for (const [layout, viewport] of [
      ["desktop", { width: 1440, height: 1000 }],
      ["phone", { width: 375, height: 900 }],
    ]) {
      const context = await browser.newContext({
        viewport,
        reducedMotion: "reduce",
        acceptDownloads: true,
      });
      try {
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(String(e)));
        const external = [];
        page.on("request", (r) => {
          if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== new URL(base).origin)
            external.push(r.url());
        });
        await observe(page);
        await page.goto(`${base}practice.html?moves=LL&listen=partials&cents=110`);
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.locator("#measurements").isVisible(), false);
        const adjustment = await page.locator("#amount").boundingBox();
        assert.ok(
          adjustment.y + adjustment.height < viewport.height,
          `slider below first viewport: ${adjustment.y + adjustment.height}`,
        );
        const audits = [await audit(page)];
        await page.locator("#listen").click();
        await page.waitForFunction(
          () => document.getElementById("audio-status").dataset.playing === "true",
        );
        assert.equal(await page.locator("#listen").getAttribute("aria-pressed"), "true");
        assert.equal(await page.evaluate(() => window.__oscillators.length), 12);
        await signal(page, engine, layout, "initial-110");
        await page.locator("#amount").focus();
        await page.keyboard.press("Shift+ArrowRight");
        await page.keyboard.press("Shift+ArrowRight");
        assert.equal(await page.locator("#amount").inputValue(), "112");
        assert.equal(await page.locator("#audio-status").getAttribute("data-playing"), "true");
        assert.equal(await page.evaluate(() => window.__oscillators.length), 12);
        assert.equal(await page.evaluate(() => document.activeElement.id), "amount");
        await signal(page, engine, layout, "adjusted-112");
        if (engine === "chromium" && layout === "desktop") await performance(page);
        await page.locator("#pair").check();
        assert.equal(await page.locator("#audio-status").getAttribute("data-playing"), "true");
        await signal(page, engine, layout, "full-112");
        await page.locator("#partials").check();
        await page.locator("#reveal").click();
        assert.equal(await page.locator("#audio-status").getAttribute("data-playing"), "true");
        audits.push(await audit(page));
        await page.screenshot({
          path: path.join(directory, `${engine}-${layout}-live.png`),
          fullPage: true,
        });
        await page.locator("#target").click();
        assert.match(await page.locator(".partial-gap").textContent(), /0\.000000 Hz/);
        assert.equal(await page.evaluate(() => window.__oscillators.length), 12);
        await signal(page, engine, layout, "target");
        await page.locator("#listen").click();
        assert.equal(await page.locator("#listen").getAttribute("aria-pressed"), "false");
        await signal(page, engine, layout, "stopped");

        // Repeated input cannot create new oscillators or reset their phases.
        await page.locator("#listen").click();
        await page.waitForFunction(
          () => document.getElementById("audio-status").dataset.playing === "true",
        );
        const count = await page.evaluate(() => window.__oscillators.length);
        await page.locator("#amount").focus();
        for (let i = 0; i < 30; i++) await page.keyboard.press(i % 2 ? "ArrowLeft" : "ArrowRight");
        assert.equal(await page.evaluate(() => window.__oscillators.length), count);
        // A fixed comparison owns the output and cancels live listening.
        await page.locator("#compare").click();
        await page.waitForFunction(() => window.__buffers === 1);
        assert.equal(await page.locator("#listen").getAttribute("aria-pressed"), "false");
        await page.locator("#amount").focus();
        await page.keyboard.press("Home");
        assert.equal(await page.locator("#audio-status").getAttribute("data-playing"), "false");

        // Edits during a real delayed resume start the newest setting.
        await page.evaluate(() => {
          window.__holdResume = true;
          window.__releaseResume = undefined;
        });
        await page.locator("#listen").click();
        await page.waitForFunction(() => typeof window.__releaseResume === "function");
        await page.locator("#amount").focus();
        await page.keyboard.press("PageUp");
        await page.evaluate(() => {
          window.__holdResume = false;
          window.__releaseResume();
        });
        await page.waitForFunction(
          () => document.getElementById("audio-status").dataset.playing === "true",
        );
        await signal(page, engine, layout, "pending-edit-10");
        await page.locator("#stop").click();

        // Stop wins over a pending request; releasing it starts no abandoned pair.
        await page.evaluate(() => {
          window.__holdResume = true;
          window.__releaseResume = undefined;
        });
        await page.locator("#listen").click();
        await page.waitForFunction(() => typeof window.__releaseResume === "function");
        const beforeCancel = await page.evaluate(() => window.__oscillators.length);
        await page.locator("#stop").click();
        await page.evaluate(() => {
          window.__holdResume = false;
          window.__releaseResume();
        });
        await page.waitForTimeout(150);
        assert.equal(await page.evaluate(() => window.__oscillators.length), beforeCancel);
        assert.equal(await page.locator("#audio-status").getAttribute("data-playing"), "false");

        await page.locator("#listen").click();
        await page.waitForFunction(
          () => document.getElementById("audio-status").dataset.playing === "true",
        );
        await page.evaluate(() => window.__oscillators.at(-1).context.suspend());
        await page.waitForFunction(() =>
          document.getElementById("audio-status").textContent.includes("interrupted"),
        );
        assert.equal(await page.locator("#listen").getAttribute("aria-pressed"), "false");
        await page.locator("#listen").click();
        await page.waitForFunction(
          () => document.getElementById("audio-status").dataset.playing === "true",
        );
        await page.locator(".practice-options > summary").click();
        await page.locator("#turn").selectOption("T");
        assert.equal(await page.locator("#audio-status").getAttribute("data-playing"), "false");
        assert.equal(await page.locator("#amount").inputValue(), "10");
        await page.locator("#listen").click();
        await page.waitForFunction(
          () => document.getElementById("audio-status").dataset.playing === "true",
        );
        await signal(page, engine, layout, "tighten-10");
        await page.locator("#stop").click();

        await page.waitForFunction(() =>
          document.getElementById("offline-status").textContent.startsWith("Ready offline"),
        );
        await context.setOffline(true);
        await page.reload();
        await page.locator("#listen").click();
        await page.waitForFunction(
          () => document.getElementById("audio-status").dataset.playing === "true",
        );
        await page.locator("#amount").focus();
        await page.keyboard.press("ArrowRight");
        assert.equal(await page.locator("#audio-status").getAttribute("data-playing"), "true");
        await page.locator("#stop").click();
        const waiting = page.waitForEvent("download");
        await page.locator("#save-study").click();
        const download = await waiting;
        const worksheet = `${engine}-${layout}-offline.html`;
        await download.saveAs(path.join(directory, worksheet));
        assert.equal(await download.failure(), null);
        assert.ok(
          (await readFile(path.join(directory, worksheet), "utf8")).includes(
            "not a recording of your live movement",
          ),
        );
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          true,
        );
        assert.deepEqual(await page.evaluate(() => window.__csp), []);
        assert.deepEqual(errors, []);
        assert.deepEqual(external, []);
        report.browsers.push({
          engine,
          layout,
          adjustmentBottom: adjustment.y + adjustment.height,
          audits,
          offline: true,
          pendingEdit: true,
          pendingStop: true,
          interruption: true,
          errors,
          external,
        });
        process.stdout.write(
          `${engine}-${layout}: continuous controls, captured signal, interruption, resume races and offline worksheet passed.\n`,
        );
      } finally {
        await context.close();
      }
    }
    // Run the actual minute. No clock mocking or early ended event stands in
    // for the audio engine stopping every oscillator and updating the controls.
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await observe(page);
      await page.goto(`${base}practice.html?listen=partials`);
      await page.locator("#listen").click();
      await page.waitForFunction(
        () => document.getElementById("audio-status").dataset.playing === "true",
      );
      await page.waitForFunction(
        () => document.getElementById("audio-status").textContent.startsWith("One minute ended"),
        undefined,
        { timeout: 75000 },
      );
      assert.equal(await page.locator("#listen").getAttribute("aria-pressed"), "false");
      const scheduled = await page.evaluate(() => window.__stops);
      assert.equal(scheduled.length, 12);
      report.browsers.find((r) => r.engine === engine && r.layout === "desktop").actualMinuteEnd =
        true;
      process.stdout.write(`${engine}: actual one-minute sound end passed.\n`);
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

try {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(4391, "127.0.0.1", resolve);
  });
  const results = await Promise.allSettled([
    engineReview("chromium", chromium),
    engineReview("firefox", firefox),
  ]);
  for (const result of results) if (result.status === "rejected") throw result.reason;
  report.passed = true;
} finally {
  server.closeAllConnections();
  server.close();
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
}
process.stdout.write(
  `${JSON.stringify({
    output,
    browsers: report.browsers.length,
    signals: report.signals.length,
    passed: report.passed,
  })}\n`,
);
