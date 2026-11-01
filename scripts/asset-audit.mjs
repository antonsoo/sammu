import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium, firefox } from "playwright";

const output = path.resolve(process.argv[2] ?? "/tmp/sammu-assets/receipt.json");
const directory = path.dirname(output);
await mkdir(directory, { recursive: true });
const root = path.resolve("dist");
const files = new Map();
async function collect(folder) {
  for (const e of await readdir(folder, { withFileTypes: true })) {
    const file = path.join(folder, e.name);
    if (e.isDirectory()) await collect(file);
    else files.set(path.relative(root, file).split(path.sep).join("/"), await readFile(file));
  }
}
await collect(root);
const sha = (b) => createHash("sha256").update(b).digest("hex");
const canonical = Object.fromEntries(
  [...files].filter(([p]) => p !== "sw.js").map(([p, b]) => [p, sha(b)]),
);
const mime = {
  ".js": "text/javascript",
  ".html": "text/html",
  ".css": "text/css",
  ".ttf": "font/ttf",
  ".txt": "text/plain",
  ".svg": "image/svg+xml",
};
let fault = "none",
  held = [],
  requests = [];
const server = createServer((req, res) => {
  const name =
    decodeURIComponent(new URL(req.url, "http://localhost").pathname.slice("/sammu/".length)) ||
    "index.html";
  if (fault === "offline") {
    req.socket.destroy();
    return;
  }
  const bytes = files.get(name);
  if (!bytes) {
    res.writeHead(404);
    res.end();
    return;
  }
  requests.push(name);
  if (name === "fonts/NotoSerif-Regular.ttf" && fault === "hold") {
    held.push(res);
    return;
  }
  let body = bytes;
  if (name === "fonts/NotoSerif-Regular.ttf" && fault === "wrong") {
    body = Buffer.from(bytes);
    body[500] ^= 255;
  }
  res.writeHead(200, {
    "content-type": mime[path.extname(name)] ?? "application/octet-stream",
    "cache-control": "no-store",
  });
  res.end(body);
});
async function network(context, offline) {
  fault = offline ? "offline" : "none";
  await context.setOffline(offline);
}
const rows = [];
async function ready(page) {
  await page.waitForFunction(() =>
    document.getElementById("offline-status").textContent.startsWith("Ready offline"),
  );
}
async function bad(page) {
  await page.waitForFunction(() =>
    document.getElementById("offline-status").textContent.includes("needs repair"),
  );
}
async function verifyCache(page) {
  return page.evaluate(async (expected) => {
    const keys = await caches.keys();
    const cache = await caches.open(keys.find((k) => k.startsWith("sammu-")));
    const rows = [];
    for (const [file, hash] of Object.entries(expected)) {
      const r = await cache.match(`/sammu/${file}`);
      if (!r) return false;
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", await r.arrayBuffer()));
      if (Array.from(digest, (n) => n.toString(16).padStart(2, "0")).join("") !== hash)
        return false;
      rows.push(file);
    }
    return rows.length;
  }, canonical);
}
async function download(page, name) {
  const waiting = page.waitForEvent("download");
  await page.locator("#save-study").click();
  const d = await waiting;
  await d.saveAs(path.join(directory, name));
  assert.equal(await d.failure(), null);
  return readFile(path.join(directory, name), "utf8");
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
      for (const width of [1440, 375]) {
        const context = await browser.newContext({
          viewport: { width, height: 1000 },
          acceptDownloads: true,
        });
        try {
          const p = await context.newPage(),
            other = await context.newPage();
          let downloads = 0;
          p.on("download", () => downloads++);
          await p.goto(`${base}practice.html?moves=LL&cents=112&listen=partials`);
          await ready(p);
          await other.goto(base);
          await ready(other);
          // Same-length wrong bodies exercise digests, rather than a size-only check.
          await p.evaluate(async () => {
            const c = await caches.open((await caches.keys()).find((k) => k.startsWith("sammu-")));
            for (const name of ["NotoSerif-Regular.ttf", "NotoSerif-OFL.txt"]) {
              const path = `/sammu/fonts/${name}`;
              const r = await c.match(path),
                b = new Uint8Array(await r.arrayBuffer());
              b[500] ^= 255;
              await c.put(path, new Response(b, { status: 200 }));
            }
          });
          await network(context, true);
          await bad(p);
          await bad(other);
          await p.locator("#save-study").click();
          await p.waitForFunction(() => !document.getElementById("save-study").disabled);
          assert.equal(downloads, 0);
          assert.match(await p.locator("#save-status").textContent(), /could not verify/);
          await bad(p);
          await bad(other);
          await p.evaluate(async () => {
            const c = await caches.open((await caches.keys()).find((k) => k.startsWith("sammu-")));
            const keys = await c.keys();
            await c.delete(
              keys.find(
                (k) =>
                  new URL(k.url).pathname.includes("/assets/practice-") && k.url.endsWith(".js"),
              ),
            );
          });
          await p.locator("#offline-repair").click();
          await p.waitForFunction(() => !document.getElementById("offline-repair").disabled);
          await bad(p);
          await bad(other);
          const failureAudit = await new AxeBuilder({ page: p }).analyze();
          assert.deepEqual(
            failureAudit.violations.map((v) => v.id),
            [],
          );
          await p.screenshot({
            path: path.join(directory, `${engine}-${width}-damaged.png`),
            fullPage: true,
          });
          requests = [];
          await network(context, false);
          await ready(p);
          await ready(other);
          const repairedRequests = requests.filter(
            (n) => n.startsWith("fonts/") || n.includes("/practice-"),
          );
          assert.ok((await verifyCache(p)) === Object.keys(canonical).length);
          await network(context, true);
          await p.reload();
          await ready(p);
          await p.locator("#listen").click();
          await p.waitForFunction(
            () => document.getElementById("audio-status").dataset.playing === "true",
          );
          await p.locator("#amount").focus();
          await p.keyboard.press("ArrowRight");
          assert.equal(await p.locator("#audio-status").getAttribute("data-playing"), "true");
          await p.locator("#stop").click();
          const html = await download(p, `${engine}-${width}-verified.html`);
          const fontData = [...html.matchAll(/data:font\/ttf;base64,([A-Za-z0-9+/=]+)/g)].map((m) =>
            sha(Buffer.from(m[1], "base64")),
          );
          assert.deepEqual(fontData, [
            canonical["fonts/AtkinsonHyperlegibleNext.ttf"],
            canonical["fonts/NotoSerif-Regular.ttf"],
          ]);
          assert.ok(html.includes("Anthony Mercer"));
          const native = await context.newPage();
          const remote = [];
          native.on("request", (r) => {
            if (/^https?:/.test(r.url())) remote.push(r.url());
          });
          await native.goto(
            pathToFileURL(path.join(directory, `${engine}-${width}-verified.html`)).href,
          );
          await native.evaluate(() => document.fonts.ready);
          const licenseText = await native.locator("details").last().locator("pre").textContent();
          for (const name of ["Atkinson-OFL.txt", "NotoSerif-OFL.txt"])
            assert.ok(licenseText.includes(files.get(`fonts/${name}`).toString()));
          assert.deepEqual(remote, []);
          await native.close();
          // Entire cache loss is detected across both already-open pages and repaired.
          await p.evaluate(async () => {
            for (const key of await caches.keys())
              if (key.startsWith("sammu-")) await caches.delete(key);
          });
          await p.bringToFront();
          await network(context, true);
          await bad(p);
          await bad(other);
          await network(context, false);
          await ready(p);
          await ready(other);
          assert.equal(await verifyCache(p), Object.keys(canonical).length);
          rows.push({
            engine,
            width,
            wrongFontAndLicenseRefused: true,
            missingScriptDetected: true,
            bothTabsInvalidated: true,
            repairedRequests,
            verifiedFiles: Object.keys(canonical).length,
            nativeFontsAndLicensesMatch: true,
            offlineLiveAdjustment: true,
            wholeCacheRecovery: true,
            a11yViolations: 0,
          });
        } catch (error) {
          const diagnostic = await Promise.all(
            context.pages().map(async (page) => ({
              url: page.url(),
              status: await page
                .locator("#offline-status")
                .textContent()
                .catch(() => null),
              visibility: await page.evaluate(() => document.visibilityState).catch(() => null),
            })),
          );
          await writeFile(
            path.join(directory, `${engine}-${width}-failure.json`),
            JSON.stringify({ error: String(error), fault, diagnostic, requests }, null, 2),
          );
          throw error;
        } finally {
          await context.close();
        }
      }
      const fresh = await browser.newContext();
      try {
        fault = "wrong";
        const p = await fresh.newPage();
        await p.goto(`${base}practice.html?cents=112`);
        await p.locator("#amount").focus();
        await p.keyboard.press("Shift+ArrowRight");
        await p.waitForFunction(
          () => document.getElementById("offline-status").textContent.includes("did not finish"),
          undefined,
          { timeout: 20000 },
        );
        await p.waitForFunction(() => !document.getElementById("offline-repair").disabled);
        fault = "none";
        await p.locator("#offline-repair").click();
        await ready(p);
        assert.equal(await p.locator("#amount").inputValue(), "113");
        await network(fresh, true);
        await p.reload();
        await ready(p);
        assert.equal(await p.locator("#amount").inputValue(), "113");
        rows.push({
          engine,
          failedInitialInstall: true,
          explicitInstallRetry: true,
          attemptPreserved: true,
          offlineReload: true,
        });
      } finally {
        fault = "none";
        await fresh.close();
      }
      // HTTP-200 substitutions, cancellation and a real timeout on both entry pages.
      for (const entry of ["index.html", "practice.html"]) {
        const context = await browser.newContext({
          serviceWorkers: "block",
          acceptDownloads: true,
        });
        try {
          const p = await context.newPage();
          let downloads = 0;
          p.on("download", () => downloads++);
          await p.goto(`${base + entry}?moves=LL&cents=112`);
          await p.evaluate(() => document.fonts.ready);
          const status = entry === "index.html" ? "#export-status" : "#save-status";
          fault = "wrong";
          await p.locator("#save-study").click();
          await p.waitForFunction(() => !document.getElementById("save-study").disabled);
          assert.equal(downloads, 0);
          assert.match(await p.locator(status).textContent(), /could not verify/);
          fault = "hold";
          await p.locator("#save-study").click();
          await p.waitForFunction(() => document.getElementById("cancel-study").hidden === false);
          await p.locator("#cancel-study").click();
          await p.waitForFunction(() => !document.getElementById("save-study").disabled);
          assert.match(await p.locator(status).textContent(), /cancelled/);
          assert.equal(downloads, 0);
          await p.locator("#save-study").click();
          await p.waitForFunction(
            () => !document.getElementById("save-study").disabled,
            undefined,
            { timeout: 20000 },
          );
          assert.match(await p.locator(status).textContent(), /did not finish/);
          assert.equal(downloads, 0);
          fault = "none";
          for (const res of held.splice(0)) res.destroy();
          await download(p, `${engine}-${entry}-recovered.html`);
          assert.equal(downloads, 1);
          rows.push({
            engine,
            entry,
            http200WrongBodyRefused: true,
            cancelledWithoutDownload: true,
            actualTimeout: true,
            retrySucceeded: true,
          });
        } finally {
          fault = "none";
          for (const res of held.splice(0)) res.destroy();
          await context.close();
        }
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  for (const res of held) res.destroy();
  server.closeAllConnections();
  server.close();
  await writeFile(
    output,
    `${JSON.stringify({ scope: "Real service workers, Cache Storage mutations, font/license byte checks, offline reload, network faults and actual export deadlines", rows, passed: rows.length === 10 }, null, 2)}\n`,
  );
}
console.log("Ten asset, offline and export fault workflows passed.");
