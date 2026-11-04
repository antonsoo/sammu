import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { chromium, firefox } from "playwright";

const directory = path.resolve(process.argv[2] ?? "dist");
const output = path.resolve(process.argv[3] ?? "/tmp/claude-1000/sammu-audit/navigation.json");
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
const expected = Object.fromEntries(
  [...files]
    .filter(([name]) => name !== "sw.js")
    .map(([name, bytes]) => [name, createHash("sha256").update(bytes).digest("hex")]),
);
const mime = {
  ".js": "text/javascript",
  ".html": "text/html",
  ".css": "text/css",
  ".ttf": "font/ttf",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
};
let fault = "none";
const held = new Set();
const requests = [];
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://local");
  if (!url.pathname.startsWith("/sammu/")) {
    res.writeHead(404).end();
    return;
  }
  const name = url.pathname.slice(7) || "index.html";
  requests.push({ name, document: req.headers["sec-fetch-dest"] === "document", fault });
  if (fault === "disconnect") {
    req.socket.destroy();
    return;
  }
  const bytes = files.get(name);
  if (!bytes) {
    res.writeHead(404).end();
    return;
  }
  if (name.endsWith(".html") && fault !== "none") {
    if (fault === "unavailable") {
      res.writeHead(503).end("Temporary outage");
      return;
    }
    if (fault === "maintenance") {
      res
        .writeHead(200, { "content-type": "text/html" })
        .end("<!doctype html><h1>Maintenance</h1>");
      return;
    }
    if (fault === "wrong-room") {
      res
        .writeHead(200, { "content-type": "text/html" })
        .end(files.get(name === "index.html" ? "practice.html" : "index.html"));
      return;
    }
    held.add(res);
    res.on("close", () => held.delete(res));
    if (fault === "body-stall") {
      res.writeHead(200, { "content-type": "text/html", "content-length": bytes.length });
      res.write(bytes.subarray(0, 100));
    }
    return;
  }
  res
    .writeHead(200, {
      "content-type": mime[path.extname(name)] ?? "application/octet-stream",
      "cache-control": "no-store",
    })
    .end(bytes);
});
const rows = [];
async function ready(page) {
  await page.waitForFunction(() =>
    document.querySelector("#offline-status").textContent.startsWith("Ready offline"),
  );
  assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller));
}
async function inventory(page) {
  return page.evaluate(async (expected) => {
    const cache = await caches.open((await caches.keys()).find((key) => key.startsWith("sammu-")));
    for (const [name, hash] of Object.entries(expected)) {
      const response = await cache.match(`/sammu/${name}`);
      if (!response) return false;
      const digest = new Uint8Array(
        await crypto.subtle.digest("SHA-256", await response.arrayBuffer()),
      );
      if ([...digest].map((n) => n.toString(16).padStart(2, "0")).join("") !== hash) return false;
    }
    return Object.keys(expected).length;
  }, expected);
}
const entries = [
  {
    name: "index.html",
    query: "moves=LLLLLLL",
    selector: "#string-1",
    attribute: "data-ratio",
    expected: "2048/2187",
  },
  {
    name: "practice.html",
    query: "moves=LLLLLLL&cents=110&listen=partials&reveal=1",
    selector: "#amount",
    attribute: "value",
    expected: "110",
  },
  {
    name: "routes.html",
    query: "moves=LLLLLLL&target=embubum&listen=all&aligned=true",
    selector: "#target",
    attribute: "value",
    expected: "2",
  },
];
try {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const base = `http://127.0.0.1:${server.address().port}/sammu/`;
  for (const [engine, launcher] of Object.entries({ chromium, firefox })) {
    const browser = await launcher.launch();
    try {
      const context = await browser.newContext({
        viewport: { width: 375, height: 1000 },
        acceptDownloads: true,
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${base}routes.html?moves=LLLLLLL&target=embubum`);
      await ready(page);
      assert.equal(await inventory(page), Object.keys(expected).length);
      // All rooms must survive each real origin fault, not merely an emulated
      // offline flag (which does not reliably disable Firefox worker requests).
      for (const mode of [
        "unavailable",
        "maintenance",
        "wrong-room",
        "header-stall",
        "body-stall",
        "disconnect",
      ]) {
        fault = mode;
        for (const entry of entries) {
          const before = requests.length;
          const started = Date.now();
          await page.goto(`${base}${entry.name}?${entry.query}`, {
            waitUntil: "domcontentloaded",
            timeout: 5000,
          });
          await ready(page);
          const value =
            entry.attribute === "value"
              ? await page.locator(entry.selector).inputValue()
              : await page.locator(entry.selector).getAttribute(entry.attribute);
          assert.equal(value, entry.expected);
          assert.equal(
            requests.slice(before).filter((r) => r.document).length,
            0,
            "A controlled navigation should use the verified saved entry",
          );
          rows.push({
            engine,
            entry: entry.name,
            fault: mode,
            elapsedMs: Date.now() - started,
            experimentPreserved: true,
            verifiedCache: true,
          });
        }
      }
      fault = "none";
      for (const response of held) response.destroy();
      await page.goto(`${base}routes.html?moves=LLLLLLL&target=embubum`);
      // Consulting the text must not silently reset this fork's earlier cycle.
      await page.locator("#evidence-link").click();
      await page.waitForURL((url) => url.hash === "#evidence");
      assert.equal(await page.locator("#string-1").getAttribute("data-ratio"), "2048/2187");
      assert.deepEqual(errors, []);
      await context.close();
    } finally {
      await browser.close();
    }
  }
} finally {
  for (const response of held) response.destroy();
  server.closeAllConnections();
  server.close();
  await writeFile(
    output,
    `${JSON.stringify(
      {
        edition: /const EDITION = "([a-f0-9]+)"/.exec(files.get("sw.js").toString())[1],
        scope:
          "Real server faults after verified worker takeover; cached entry, exact experiment state and source journey",
        rows,
        passed: rows.length === 36,
      },
      null,
      2,
    )}\n`,
  );
}
console.log(JSON.stringify({ workflows: rows.length, passed: rows.length === 36, output }));
