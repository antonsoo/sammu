import assert from "node:assert/strict";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { chromium, firefox } from "playwright";

const directory = path.resolve(process.argv[2] ?? "dist");
const output = path.resolve(process.argv[3] ?? "/tmp/claude-1000/sammu-audit/control-race.json");
const phase = process.argv[4] ?? "after";
await mkdir(path.dirname(output), { recursive: true });
const files = new Map();
async function visit(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) await visit(file);
    else files.set(path.relative(directory, file).split(path.sep).join("/"), await readFile(file));
  }
}
await visit(directory);
const mime = {
  ".js": "text/javascript",
  ".html": "text/html",
  ".css": "text/css",
  ".ttf": "font/ttf",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
};
let delay = 0;
const server = createServer((req, res) => {
  const name = new URL(req.url, "http://local").pathname.slice(7) || "index.html";
  const bytes = files.get(name);
  if (!bytes) {
    res.writeHead(404).end();
    return;
  }
  const send = () => {
    if (!res.destroyed)
      res
        .writeHead(200, {
          "content-type": mime[path.extname(name)] ?? "application/octet-stream",
          "cache-control": "no-store",
        })
        .end(bytes);
  };
  // Vary a real entry response across activation, without intercepting browser
  // controller state, worker promises, cache reads or the claim operation.
  if (name === "routes.html" && req.headers["sec-fetch-dest"] === "document")
    setTimeout(send, delay);
  else send();
});
const rows = [];
try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}/sammu/`;
  for (const [engine, launcher] of Object.entries({ chromium, firefox })) {
    const browser = await launcher.launch();
    try {
      for (let trial = 0; trial < 20; trial++) {
        delay = (trial % 5) * 20;
        const context = await browser.newContext(),
          page = await context.newPage();
        await page.addInitScript(() => {
          window.__initialController = !!navigator.serviceWorker.controller;
          window.__claims = 0;
          const post = ServiceWorker.prototype.postMessage;
          ServiceWorker.prototype.postMessage = function (message, transfer) {
            if (message?.claim) window.__claims++;
            return post.call(this, message, transfer);
          };
        });
        await page.goto(`${base}?moves=LLLLLLL`, { waitUntil: "domcontentloaded" });
        await page.evaluate(() => document.querySelector("#routes-link").click());
        await page.waitForURL((url) => url.pathname.endsWith("routes.html"), {
          waitUntil: "domcontentloaded",
        });
        let ready = true;
        try {
          await page.waitForFunction(
            () => document.querySelector("#offline-status").textContent.startsWith("Ready offline"),
            null,
            { timeout: 5000 },
          );
        } catch {
          ready = false;
        }
        const value = await page.evaluate(async () => ({
          initialController: window.__initialController,
          claimRequests: window.__claims,
          controller: !!navigator.serviceWorker.controller,
          active: (await navigator.serviceWorker.getRegistration())?.active?.state,
          status: document.querySelector("#offline-status").textContent,
        }));
        rows.push({ engine, trial, entryDelayMs: delay, ready, ...value });
        if (phase === "after") {
          assert.equal(ready, true);
          assert.equal(value.controller, true);
        }
        await context.close();
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  server.closeAllConnections();
  server.close();
  await writeFile(
    output,
    `${JSON.stringify({ phase, edition: /const EDITION = "([a-f0-9]+)"/.exec(files.get("sw.js").toString())[1], rows, passed: rows.length === 40 && rows.every((r) => r.ready) }, null, 2)}\n`,
  );
}
console.log(
  JSON.stringify({
    trials: rows.length,
    initiallyUncontrolled: rows.filter((r) => !r.initialController).length,
    claimRequests: rows.reduce((n, r) => n + r.claimRequests, 0),
    ready: rows.filter((r) => r.ready).length,
    phase,
    output,
  }),
);
