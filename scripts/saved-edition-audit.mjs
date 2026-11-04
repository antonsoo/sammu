import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { chromium, firefox } from "playwright";

const [
  currentDirectory = "dist",
  nextDirectory,
  outputFile = "/tmp/claude-1000/sammu-audit/saved-edition.json",
  legacyDirectory,
] = process.argv.slice(2);
assert.ok(nextDirectory, "Supply a separately built next-edition fixture");
const output = path.resolve(outputFile);
await mkdir(path.dirname(output), { recursive: true });
async function inventory(directory) {
  const root = path.resolve(directory),
    files = new Map();
  async function visit(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) await visit(file);
      else files.set(path.relative(root, file).split(path.sep).join("/"), await readFile(file));
    }
  }
  await visit(root);
  return files;
}
const current = await inventory(currentDirectory),
  next = await inventory(nextDirectory);
const edition = (files) => /const EDITION = "([a-f0-9]+)"/.exec(files.get("sw.js").toString())[1];
assert.notEqual(edition(current), edition(next));
const mime = {
  ".js": "text/javascript",
  ".html": "text/html",
  ".css": "text/css",
  ".ttf": "font/ttf",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
};
let served = current,
  workerFiles = current,
  unavailable = false;
const server = createServer((req, res) => {
  if (unavailable) {
    req.socket.destroy();
    return;
  }
  const name = new URL(req.url, "http://local").pathname.slice(7) || "index.html";
  const body = (name === "sw.js" ? workerFiles : served).get(name);
  if (!body) {
    res.writeHead(404).end();
    return;
  }
  res
    .writeHead(200, {
      "content-type": mime[path.extname(name)] ?? "application/octet-stream",
      "cache-control": "no-store",
    })
    .end(body);
});
const rows = [];
async function ready(page) {
  await page.waitForFunction(() =>
    document.querySelector("#offline-status").textContent.startsWith("Ready offline"),
  );
}
async function json(page) {
  const waiting = page.waitForEvent("download");
  await page.locator("#save-json").click();
  const download = await waiting;
  const file = path.join(path.dirname(output), `snapshot-${rows.length}.json`);
  await download.saveAs(file);
  assert.equal(await download.failure(), null);
  return JSON.parse(await readFile(file, "utf8"));
}
try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}/sammu/`;
  for (const [engine, launcher] of Object.entries({ chromium, firefox })) {
    served = current;
    workerFiles = current;
    unavailable = false;
    const browser = await launcher.launch();
    try {
      const context = await browser.newContext({
        viewport: { width: 375, height: 1000 },
        acceptDownloads: true,
      });
      const route = await context.newPage(),
        practice = await context.newPage();
      const url = `${base}routes.html?moves=LLLLLLL&target=pitum&listen=all&aligned=true`;
      await route.goto(url);
      await ready(route);
      const before = await json(route);
      await practice.goto(`${base}practice.html?moves=LLLLLLL&cents=110&listen=partials&reveal=1`);
      await ready(practice);
      served = next;
      workerFiles = next;
      await route.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
      for (const page of [route, practice]) {
        await page.waitForFunction(
          () =>
            document.querySelector("#offline-repair").textContent === "Reload saved edition" &&
            !document.querySelector("#offline-repair").hidden,
        );
        assert.equal(await page.locator("#offline-repair").isEnabled(), true);
        assert.equal(
          (await page.locator("#offline-status").textContent()).startsWith("Ready offline"),
          false,
        );
      }
      unavailable = true;
      // Neither the next entry nor its scripts may require a live origin here.
      await route.locator("#offline-repair").click();
      await route.waitForFunction(
        (next) => document.querySelector("#edition").textContent.endsWith(next),
        edition(next),
      );
      await ready(route);
      assert.equal(route.url(), url);
      const after = await json(route);
      for (const field of ["origin", "a", "b", "target", "listening"])
        assert.deepEqual(after[field], before[field]);
      assert.equal(after.edition, edition(next));
      await practice.locator("#offline-repair").click();
      await practice.waitForFunction(
        (next) => document.querySelector("#edition").textContent.endsWith(next),
        edition(next),
      );
      await ready(practice);
      assert.equal(await practice.locator("#amount").inputValue(), "110");
      const identities = Object.fromEntries(
        [...next]
          .filter(([name]) => name !== "sw.js")
          .map(([name, bytes]) => [name, createHash("sha256").update(bytes).digest("hex")]),
      );
      const verified = await route.evaluate(async (expected) => {
        const names = (await caches.keys()).filter((key) => key.startsWith("sammu-"));
        if (names.length !== 1) return false;
        const cache = await caches.open(names[0]);
        for (const [file, hash] of Object.entries(expected)) {
          const response = await cache.match(`/sammu/${file}`);
          if (!response) return false;
          const digest = [
            ...new Uint8Array(await crypto.subtle.digest("SHA-256", await response.arrayBuffer())),
          ]
            .map((n) => n.toString(16).padStart(2, "0"))
            .join("");
          if (digest !== hash) return false;
        }
        return Object.keys(expected).length;
      }, identities);
      assert.equal(verified, Object.keys(identities).length);
      rows.push({
        engine,
        previousEdition: edition(current),
        nextEdition: edition(next),
        bothTabsOfferReload: true,
        originUnavailableDuringReload: true,
        exactForkAndAttemptPreserved: true,
        verifiedFiles: verified,
      });
      await context.close();
      if (legacyDirectory) {
        const legacy = await inventory(legacyDirectory);
        served = legacy;
        workerFiles = legacy;
        unavailable = false;
        const oldContext = await browser.newContext();
        const oldPage = await oldContext.newPage();
        await oldPage.goto(base);
        await ready(oldPage);
        served = current;
        const newRoom = await oldContext.newPage();
        await newRoom.goto(`${base}routes.html?moves=LLLLLLL&target=embubum`);
        await newRoom.waitForFunction(
          () =>
            document.querySelector("#offline-status").textContent.includes("differ") ||
            document.querySelector("#offline-repair").textContent === "Reload page",
        );
        if (await newRoom.locator("#offline-repair").isVisible()) {
          assert.equal(
            await newRoom.locator("#offline-repair").textContent(),
            "Reload page",
            "A legacy worker may offer an online reload, never promise an unsupported saved room",
          );
          await newRoom.locator("#offline-repair").click();
          await newRoom.waitForFunction(
            () =>
              document.querySelector("#offline-status").textContent.includes("differ") ||
              document.querySelector("#offline-repair").textContent === "Reload page",
          );
        }
        assert.equal(
          (await newRoom.locator("#offline-status").textContent()).startsWith("Ready offline"),
          false,
        );
        workerFiles = current;
        await newRoom.evaluate(async () =>
          (await navigator.serviceWorker.getRegistration()).update(),
        );
        await ready(newRoom);
        assert.match(await newRoom.locator("#origin-description").textContent(), /7 bench moves/);
        rows.push({
          engine,
          legacyEdition: edition(legacy),
          currentEdition: edition(current),
          unavailableLegacyRoomDoesNotOfferSavedReload: true,
          newRoomInstallsAndKeepsExperiment: true,
        });
        await oldContext.close();
      }
    } catch (error) {
      const diagnostic = [];
      for (const context of browser.contexts())
        for (const page of context.pages()) {
          diagnostic.push(
            await page
              .evaluate(async () => {
                const registration = await navigator.serviceWorker.getRegistration();
                return {
                  url: location.href,
                  status: document.querySelector("#offline-status")?.textContent,
                  controller: !!navigator.serviceWorker.controller,
                  active: registration?.active?.state,
                  waiting: registration?.waiting?.state,
                  installing: registration?.installing?.state,
                  repair: document.querySelector("#offline-repair")?.textContent,
                };
              })
              .catch(() => ({})),
          );
        }
      await writeFile(
        path.join(path.dirname(output), `${engine}-saved-edition-failure.json`),
        JSON.stringify({ error: String(error), diagnostic }, null, 2),
      );
      throw error;
    } finally {
      await browser.close();
    }
  }
} finally {
  server.closeAllConnections();
  server.close();
  await writeFile(
    output,
    `${JSON.stringify({ fixture: "Two real builds with the same runtime and a deliberately different index title; not a public release", rows, passed: rows.length === (legacyDirectory ? 4 : 2) }, null, 2)}\n`,
  );
}
console.log(
  JSON.stringify({
    workflows: rows.length,
    passed: rows.length === (legacyDirectory ? 4 : 2),
    output,
  }),
);
