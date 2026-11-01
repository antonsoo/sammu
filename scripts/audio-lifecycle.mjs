import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { chromium, firefox } from "playwright";
import { observe, tapSource } from "./audio-capture.mjs";

const directory = path.resolve(process.argv[2] ?? "dist");
const output = path.resolve(process.argv[3] ?? "/tmp/sammu-audio-lifecycle/receipt.json");
const phase = process.argv[4] ?? "after";
await mkdir(path.dirname(output), { recursive: true });
const mime = {
  ".js": "text/javascript",
  ".html": "text/html",
  ".css": "text/css",
  ".ttf": "font/ttf",
  ".svg": "image/svg+xml",
};
const server = createServer(async (req, res) => {
  const name =
    decodeURIComponent(new URL(req.url, "http://localhost").pathname.slice("/sammu/".length)) ||
    "index.html";
  try {
    if (name === "live-review-tap.js") {
      res.writeHead(200, { "content-type": "text/javascript" });
      res.end(tapSource);
      return;
    }
    const file = path.resolve(directory, name);
    assert.ok(file.startsWith(directory + path.sep));
    const bytes = await readFile(file);
    res.writeHead(200, {
      "content-type": mime[path.extname(file)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
const rows = [];
async function begin(page) {
  await page.evaluate(() => {
    window.__take = true;
    window.__chunks = [];
  });
}
async function finish(page, name) {
  await page.waitForFunction(() => window.__chunks.length >= 6);
  const value = await page.evaluate(() => {
    window.__take = false;
    let first = 0;
    for (const [i, chunk] of window.__chunks.entries()) {
      if (i && chunk.frame - window.__chunks[i - 1].frame !== 4096) first = Math.max(first, i);
      if (chunk.quantumFrames.some((f, n) => n && f - chunk.quantumFrames[n - 1] !== 128))
        first = i + 1;
    }
    const chunks = window.__chunks.slice(first);
    if (chunks.length < 2)
      throw new Error("The audio-thread capture has no sufficient contiguous suffix.");
    const samples = Float32Array.from(chunks.flatMap((c) => c.samples));
    let binary = "";
    const bytes = new Uint8Array(samples.buffer);
    for (let i = 0; i < bytes.length; i += 16384)
      binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
    return {
      rate: window.__captureContext.sampleRate,
      firstFrame: chunks[0].frame,
      droppedStartupChunks: first,
      frames: chunks.map((c) => c.frame),
      data: btoa(binary),
    };
  });
  assert.ok(
    value.frames.every((f, i) => !i || f - value.frames[i - 1] === 4096),
    JSON.stringify(value.frames),
  );
  const bytes = Buffer.from(value.data, "base64");
  await writeFile(path.join(path.dirname(output), name), bytes);
  return {
    file: name,
    rate: value.rate,
    firstFrame: value.firstFrame,
    samples: bytes.length / 4,
    droppedStartupChunks: value.droppedStartupChunks,
  };
}
try {
  await new Promise((ok, bad) => {
    server.once("error", bad);
    server.listen(0, "127.0.0.1", ok);
  });
  const base = `http://127.0.0.1:${server.address().port}/sammu/`;
  for (const [engine, launcher] of Object.entries({ chromium, firefox })) {
    const browser = await launcher.launch();
    try {
      const page = await browser.newPage();
      await observe(page);
      await page.goto(`${base}practice.html?moves=LL&listen=partials&cents=112`);
      await page.locator("#listen").click();
      await page.waitForFunction(
        () => document.getElementById("audio-status").dataset.playing === "true",
      );
      await page.waitForTimeout(200);
      await page.evaluate(() => window.__captureContext.suspend());
      await page.waitForFunction(() =>
        document.getElementById("audio-status").textContent.includes("interrupted"),
      );
      await begin(page);
      const resumeFrame = await page.evaluate(async () => {
        const c = window.__captureContext;
        const f = Math.ceil(c.currentTime * c.sampleRate);
        await c.resume();
        return f;
      });
      const resumed = await finish(page, `${engine}-resumed.f32`);
      assert.equal(await page.locator("#listen").getAttribute("aria-pressed"), "false");
      // Explicit retries must recover even after the previous context closes.
      await page.evaluate(() => window.__captureContext.close());
      await page.locator("#listen").click();
      if (phase === "after")
        await page.waitForFunction(
          () => document.getElementById("audio-status").dataset.playing === "true",
        );
      else await page.waitForTimeout(250);
      const recoveredClosed =
        (await page.locator("#audio-status").getAttribute("data-playing")) === "true";
      if (phase === "after") {
        await page.evaluate(() => window.__captureContext.close());
        await page.waitForFunction(() =>
          document.getElementById("audio-status").textContent.includes("interrupted"),
        );
        await page.locator("#listen").click();
        await page.waitForFunction(
          () => document.getElementById("audio-status").dataset.playing === "true",
        );
      }
      await page.locator("#stop").click();
      // A fresh page gives before/after editions the same working audio context.
      await page.goto(`${base}practice.html?moves=LL&listen=partials&cents=112`);
      const stops = [];
      for (let i = 0; i < 3; i++) {
        await page.locator("#listen").click();
        await page.waitForFunction(
          () => document.getElementById("audio-status").dataset.playing === "true",
        );
        await begin(page);
        await page.waitForTimeout(150 + i * 30);
        await page.locator("#stop").click();
        const at = await page.evaluate(() => window.__stops.at(-1).time);
        stops.push({ ...(await finish(page, `${engine}-stop-${i}.f32`)), at });
      }
      await page.locator("#compare").click();
      await page.waitForFunction(
        () => document.getElementById("audio-status").dataset.playing === "true",
      );
      await begin(page);
      await page.waitForTimeout(180);
      await page.locator("#stop").click();
      const bufferAt = await page.evaluate(() => window.__bufferStops.at(-1).time);
      const comparison = { ...(await finish(page, `${engine}-comparison-stop.f32`)), at: bufferAt };
      let comparisonResumed;
      if (phase === "after") {
        await page.locator("#compare").click();
        await page.waitForFunction(
          () => document.getElementById("audio-status").dataset.playing === "true",
        );
        await page.waitForTimeout(150);
        await page.evaluate(() => window.__captureContext.suspend());
        await page.waitForFunction(() =>
          document.getElementById("audio-status").textContent.includes("interrupted"),
        );
        await begin(page);
        const resumeFrame = await page.evaluate(async () => {
          const context = window.__captureContext;
          const frame = Math.ceil(context.currentTime * context.sampleRate);
          await context.resume();
          return frame;
        });
        comparisonResumed = {
          ...(await finish(page, `${engine}-comparison-resumed.f32`)),
          resumeFrame,
        };
        assert.equal(await page.locator("#audio-status").getAttribute("data-playing"), "false");
        await page.evaluate(() => window.__captureContext.close());
        await page.locator("#compare").click();
        await page.waitForFunction(
          () => document.getElementById("audio-status").dataset.playing === "true",
        );
        await page.locator("#stop").click();
      }
      rows.push({
        engine,
        resumed: { ...resumed, resumeFrame },
        stops,
        comparison,
        comparisonResumed,
        recoveredClosed,
      });
    } finally {
      await browser.close();
    }
  }
} finally {
  server.closeAllConnections();
  server.close();
  await writeFile(output, `${JSON.stringify({ phase, rows }, null, 2)}\n`);
}
console.log(
  `Captured actual interruption, closed-context recovery and stop tails in ${rows.length} engines.`,
);
