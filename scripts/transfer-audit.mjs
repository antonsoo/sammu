import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { chromium, firefox } from "playwright";

const directory = path.resolve(process.argv[2] ?? "dist");
const output = path.resolve(process.argv[3] ?? "/tmp/claude-1000/sammu-audit/transfers.json");
await mkdir(path.dirname(output), { recursive: true });
const files = new Map();
async function collect(folder) {
  for (const item of await readdir(folder, { withFileTypes: true })) {
    const file = path.join(folder, item.name);
    if (item.isDirectory()) await collect(file);
    else files.set(path.relative(directory, file).split(path.sep).join("/"), await readFile(file));
  }
}
await collect(directory);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const expected = Object.fromEntries(
  [...files].filter(([name]) => name !== "sw.js").map(([name, bytes]) => [name, sha(bytes)]),
);
const mime = {
  ".js": "text/javascript",
  ".html": "text/html",
  ".css": "text/css",
  ".ttf": "font/ttf",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
};
let rate = Infinity,
  fault = "none",
  sent = 0;
const queue = [],
  requests = [],
  held = new Set();
const server = createServer((req, res) => {
  const name = new URL(req.url, "http://local").pathname.slice(7) || "index.html";
  if (fault === "disconnect") {
    req.socket.destroy();
    return;
  }
  const bytes = files.get(name);
  if (!bytes) {
    res.writeHead(404).end();
    return;
  }
  requests.push({ name, bytes: bytes.length, destination: req.headers["sec-fetch-dest"] });
  if (name === "fonts/NotoSerif-Regular.ttf" && ["header-stall", "body-stall"].includes(fault)) {
    held.add(res);
    res.on("close", () => held.delete(res));
    if (fault === "body-stall") {
      res.writeHead(200, { "content-type": "font/ttf", "content-length": bytes.length });
      res.write(bytes.subarray(0, 1024));
    }
    return;
  }
  const body =
    name === "fonts/NotoSerif-Regular.ttf" && fault === "oversized"
      ? Buffer.concat([bytes, Buffer.alloc(1024)])
      : bytes;
  res.writeHead(200, {
    "content-type": mime[path.extname(name)] ?? "application/octet-stream",
    "cache-control": "no-store",
  });
  if (!Number.isFinite(rate)) {
    res.end(body);
    return;
  }
  const item = { res, bytes: body, offset: 0, closed: false };
  res.on("close", () => {
    item.closed = true;
  });
  queue.push(item);
});
// One shared origin budget, round-robin chunks. Foreground fonts and worker
// installation compete for the same bytes rather than each getting this rate.
const tick = setInterval(() => {
  let budget = Number.isFinite(rate) ? rate / 20 : Infinity;
  while (budget > 0 && queue.length) {
    const item = queue.shift();
    if (item.closed) continue;
    const n = Math.min(1024, budget, item.bytes.length - item.offset);
    item.res.write(item.bytes.subarray(item.offset, item.offset + n));
    item.offset += n;
    sent += n;
    budget -= n;
    if (item.offset === item.bytes.length) item.res.end();
    else queue.push(item);
  }
}, 50);
const rows = [];
async function ready(page) {
  await page.waitForFunction(
    () => document.querySelector("#offline-status").textContent.startsWith("Ready offline"),
    null,
    { timeout: 45000 },
  );
  assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller));
}
async function cacheMatches(page) {
  return page.evaluate(async (expected) => {
    const cache = await caches.open((await caches.keys()).find((k) => k.startsWith("sammu-")));
    for (const [name, digest] of Object.entries(expected)) {
      const response = await cache.match(`/sammu/${name}`);
      if (!response) return false;
      const hash = [
        ...new Uint8Array(await crypto.subtle.digest("SHA-256", await response.arrayBuffer())),
      ]
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("");
      if (hash !== digest) return false;
    }
    return Object.keys(expected).length;
  }, expected);
}
async function saved(page, filename) {
  const waiting = page.waitForEvent("download", { timeout: 45000 });
  await page.locator("#save-study").click();
  const download = await waiting;
  assert.equal(await download.failure(), null);
  const file = path.join(path.dirname(output), filename);
  await download.saveAs(file);
  return { file, text: await readFile(file, "utf8") };
}
function release() {
  fault = "none";
  rate = Infinity;
  for (const response of held) response.destroy();
  held.clear();
}
try {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const base = `http://127.0.0.1:${server.address().port}/sammu/`;
  for (const [engine, launcher] of Object.entries({ chromium, firefox })) {
    const browser = await launcher.launch();
    try {
      // Cold, shared transfer continues past the old ten-second batch cutoff.
      rate = 96000;
      fault = "none";
      sent = 0;
      requests.length = 0;
      const cold = await browser.newContext({
        viewport: { width: 375, height: 1000 },
        acceptDownloads: true,
      });
      const page = await cold.newPage();
      const start = Date.now();
      await page.goto(`${base}routes.html?moves=LLLLLLL&target=embubum`, {
        waitUntil: "domcontentloaded",
      });
      await ready(page);
      const elapsedMs = Date.now() - start;
      assert.ok(elapsedMs > 10000, "The cold probe must genuinely exceed the former deadline");
      assert.equal(await cacheMatches(page), Object.keys(expected).length);
      rows.push({
        engine,
        scenario: "cold-install",
        bytesPerSecond: rate,
        elapsedMs,
        bytesSent: sent,
        requests: [...requests],
        completeVerifiedCache: true,
      });
      fault = "disconnect";
      await page.reload();
      await ready(page);
      await page.locator("#target").selectOption("3");
      await saved(page, `${engine}-cold-offline.html`);
      await cold.close();
      release();
      // A failed first installation must have an idle bound and an actual retry.
      fault = "body-stall";
      const failed = await browser.newContext();
      const failedPage = await failed.newPage();
      await failedPage.goto(`${base}routes.html?moves=LLLLLLL`, { waitUntil: "domcontentloaded" });
      await failedPage.waitForFunction(
        () => document.querySelector("#offline-status").textContent.includes("did not finish"),
        null,
        { timeout: 22000 },
      );
      assert.equal(await failedPage.evaluate(() => !!navigator.serviceWorker.controller), false);
      release();
      await failedPage.locator("#offline-repair").click();
      await ready(failedPage);
      rows.push({
        engine,
        scenario: "stalled-first-install",
        retryVerified: true,
        experimentPreserved: (
          await failedPage.locator("#origin-description").textContent()
        ).includes("7 bench moves"),
      });
      await failed.close();
      for (const entry of ["index.html", "practice.html", "routes.html"]) {
        release();
        const context = await browser.newContext({
          serviceWorkers: "block",
          acceptDownloads: true,
          viewport: { width: 375, height: 1000 },
        });
        const p = await context.newPage();
        let downloads = 0;
        p.on("download", () => downloads++);
        await p.goto(`${base}${entry}?moves=LLLLLLL&target=embubum&cents=110&listen=partials`);
        await p.evaluate(() => document.fonts.ready);
        const status = entry === "practice.html" ? "#save-status" : "#export-status";
        rate = 24000;
        const started = Date.now();
        const result = await saved(p, `${engine}-${entry}-slow.html`);
        const duration = Date.now() - started;
        assert.ok(
          duration > 15000,
          "The export probe must genuinely exceed the former total deadline",
        );
        assert.equal(downloads, 1);
        const embedded = [...result.text.matchAll(/data:font\/ttf;base64,([A-Za-z0-9+/=]+)/g)].map(
          (m) => sha(Buffer.from(m[1], "base64")),
        );
        assert.deepEqual(embedded, [
          expected["fonts/AtkinsonHyperlegibleNext.ttf"],
          expected["fonts/NotoSerif-Regular.ttf"],
        ]);
        rows.push({
          engine,
          entry,
          scenario: "slow-export",
          bytesPerSecond: rate,
          elapsedMs: duration,
          fontsVerified: true,
        });
        release();
        for (const mode of ["header-stall", "body-stall", "oversized"]) {
          fault = mode;
          const before = downloads;
          const time = Date.now();
          await p.locator("#save-study").click();
          await p.waitForFunction(() => !document.querySelector("#save-study").disabled, null, {
            timeout: 22000,
          });
          assert.equal(downloads, before);
          assert.match(
            await p.locator(status).textContent(),
            mode === "oversized" ? /could not verify/ : /did not finish/,
          );
          const elapsedMs = Date.now() - time;
          assert.ok(elapsedMs < 21000);
          rows.push({ engine, entry, scenario: mode, elapsedMs, partialDownload: false });
          release();
        }
        // Cancel is independent of the longer total allowance and stays operable.
        fault = "body-stall";
        await p.locator("#save-study").click();
        await p.locator("#cancel-study").click();
        await p.waitForFunction(() => !document.querySelector("#save-study").disabled);
        assert.match(await p.locator(status).textContent(), /cancelled/);
        release();
        await saved(p, `${engine}-${entry}-retry.html`);
        rows.push({
          engine,
          entry,
          scenario: "cancel-and-retry",
          cancelledWithoutDownload: true,
          retryVerified: true,
        });
        await context.close();
      }
    } finally {
      await browser.close();
      release();
    }
  }
} finally {
  release();
  clearInterval(tick);
  for (const item of queue) item.res.destroy();
  server.closeAllConnections();
  server.close();
  await writeFile(
    output,
    `${JSON.stringify(
      {
        edition: /const EDITION = "([a-f0-9]+)"/.exec(files.get("sw.js").toString())[1],
        scope:
          "Real shared bandwidth, active slow bodies, headers/body inactivity, oversized files, cancellation and retry",
        rows,
        passed: rows.length === 34,
      },
      null,
      2,
    )}\n`,
  );
}
console.log(JSON.stringify({ workflows: rows.length, passed: rows.length === 34, output }));
