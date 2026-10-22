import assert from "node:assert/strict";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium, firefox } from "playwright";

const [oldDirectory, outputFile, phase = "after"] = process.argv.slice(2);
assert(oldDirectory && outputFile && ["before", "after"].includes(phase));
const output = path.resolve(outputFile);
await mkdir(path.dirname(output), { recursive: true });

async function inventory(root) {
  const files = new Map();
  async function visit(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile())
        files.set(path.relative(root, file).split(path.sep).join("/"), await readFile(file));
    }
  }
  await visit(root);
  assert(files.has("index.html") && files.has("sw.js"));
  return files;
}

const oldFiles = await inventory(path.resolve(oldDirectory));
const newFiles = await inventory(path.resolve("dist"));
assert(!oldFiles.has("practice.html") && newFiles.has("practice.html"));
const oldEdition = /const EDITION = "([a-f0-9]+)"/.exec(oldFiles.get("sw.js").toString())[1];
const newEdition = /const EDITION = "([a-f0-9]+)"/.exec(newFiles.get("sw.js").toString())[1];
let served = oldFiles;
let workerFiles = oldFiles;
let fault = "none";
let pending = [];
let badResponses = [];
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".ttf": "font/ttf",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
};
function send(response, name, bytes) {
  response.writeHead(200, {
    "content-type": mime[path.extname(name)] ?? "application/octet-stream",
    "cache-control": "no-store",
  });
  response.end(bytes);
}
const server = http.createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  if (!url.pathname.startsWith("/sammu/")) {
    response.writeHead(404).end();
    return;
  }
  const name = decodeURIComponent(url.pathname.slice("/sammu/".length)) || "index.html";
  const bytes = (name === "sw.js" ? workerFiles : served).get(name);
  if (!bytes) {
    response.writeHead(404).end();
    return;
  }
  if (
    served === newFiles &&
    name === "practice.html" &&
    request.headers["sec-fetch-dest"] !== "document"
  ) {
    if (fault === "hold") {
      pending.push({ response, name, bytes });
      return;
    }
    if (fault === "wrong") {
      badResponses.push({ url: url.pathname, status: 200, oldEntryInsteadOfNewPractice: true });
      send(response, name, oldFiles.get("index.html"));
      return;
    }
  }
  send(response, name, bytes);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/sammu/`;
const records = [];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitUntil(predicate, message) {
  const started = Date.now();
  while (!(await predicate())) {
    if (Date.now() - started > 12000) throw new Error(message);
    await pause(30);
  }
}

async function inspect(page) {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const worker = navigator.serviceWorker.controller;
        if (!worker) {
          resolve(null);
          return;
        }
        const channel = new MessageChannel();
        const timeout = setTimeout(() => {
          channel.port1.close();
          reject(new Error("inspector timeout"));
        }, 1500);
        channel.port1.onmessage = (event) => {
          clearTimeout(timeout);
          channel.port1.close();
          resolve(event.data);
        };
        worker.postMessage({ type: "SAMMU_INSPECT" }, [channel.port2]);
      }),
  );
}

async function triggerUpdate(page) {
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    window.__workerStates ??= [];
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => window.__workerStates.push(worker.state));
    });
    void registration.update().catch(() => {});
  });
}

try {
  for (const [engine, launcher] of [
    ["chromium", chromium],
    ["firefox", firefox],
  ]) {
    const browser = await launcher.launch();
    try {
      for (const mode of phase === "before" ? ["hold", "wrong"] : ["hold", "wrong", "late"]) {
        served = oldFiles;
        workerFiles = oldFiles;
        fault = "none";
        pending = [];
        badResponses = [];
        const context = await browser.newContext();
        try {
          const oldPage = await context.newPage();
          await oldPage.goto(`${base}?moves=LL`);
          await oldPage.waitForFunction(() =>
            document.getElementById("offline-status").textContent.startsWith("Ready offline"),
          );
          await oldPage.waitForFunction(() => navigator.serviceWorker.controller !== null);
          assert.equal((await inspect(oldPage)).edition, oldEdition);
          served = newFiles;
          // A new entry can arrive before the matching worker becomes available.
          // Let it inspect the actual complete older edition first.
          const current = await context.newPage();
          const consoleErrors = [];
          current.on("console", (message) => {
            if (message.type() === "error") consoleErrors.push(message.text());
          });
          if (mode === "late") {
            // Delay an actual old-worker reply without changing either its data
            // or cache behavior. The next worker reply follows the real channel.
            await current.addInitScript(() => {
              const post = ServiceWorker.prototype.postMessage;
              ServiceWorker.prototype.postMessage = function (message, transfer) {
                if (
                  message?.type !== "SAMMU_INSPECT" ||
                  sessionStorage.getItem("sammu-review-held")
                )
                  return post.call(this, message, transfer);
                sessionStorage.setItem("sammu-review-held", "1");
                const relay = new MessageChannel();
                relay.port1.onmessage = (event) => {
                  relay.port1.close();
                  window.__heldReply = event.data;
                  window.__heldAt = performance.now();
                  window.__deliverOldReply = () => {
                    transfer[0].postMessage(event.data);
                    transfer[0].close();
                  };
                };
                return post.call(this, message, [relay.port2]);
              };
            });
          }
          await current.goto(`${base}practice.html?moves=LL&cents=110&listen=partials&reveal=1`);
          await current.waitForFunction(
            (edition) => document.getElementById("edition").textContent.endsWith(edition),
            newEdition,
          );
          if (mode === "late")
            await current.waitForFunction(
              (edition) => window.__heldReply?.edition === edition,
              oldEdition,
            );
          else
            await current.waitForFunction(
              () => !document.getElementById("offline-status").textContent.startsWith("Checking"),
            );
          const before = await current.locator("#offline-status").textContent();
          assert(
            !before.startsWith("Ready offline"),
            "The new page claimed readiness before its edition was complete.",
          );
          workerFiles = newFiles;
          fault = mode === "wrong" ? "wrong" : "hold";
          await triggerUpdate(oldPage);
          await waitUntil(
            () => (mode === "wrong" ? badResponses.length > 0 : pending.length > 0),
            "The new practice page was not requested by precaching.",
          );
          // Stop any additional precache request from inheriting the failure.
          fault = "none";
          if (mode === "wrong") {
            await oldPage.waitForFunction(() => window.__workerStates.includes("redundant"));
            await triggerUpdate(oldPage);
          } else {
            for (const item of pending.splice(0))
              if (!item.response.destroyed) send(item.response, item.name, item.bytes);
          }
          await waitUntil(async () => {
            const value = await inspect(current);
            return value?.edition === newEdition && value.complete === true;
          }, "The complete new worker never controlled the page.");
          const readyWorker = await inspect(current);
          if (phase === "after")
            await current.waitForFunction(() =>
              document.getElementById("offline-status").textContent.startsWith("Ready offline"),
            );
          const after = await current.locator("#offline-status").textContent();
          assert.equal(after.startsWith("Ready offline"), phase === "after");
          if (mode === "late") {
            assert(await current.evaluate(() => performance.now() - window.__heldAt < 6000));
            await current.evaluate(async () => {
              window.__deliverOldReply();
              await new Promise(requestAnimationFrame);
              await new Promise(requestAnimationFrame);
            });
            assert(
              (await current.locator("#offline-status").textContent()).startsWith("Ready offline"),
              "An older reply overwrote readiness for the current edition.",
            );
          }
          await context.setOffline(true);
          await current.reload();
          await current.waitForFunction(
            (edition) => document.getElementById("edition").textContent.endsWith(edition),
            newEdition,
          );
          await current.waitForFunction(() =>
            document.getElementById("offline-status").textContent.startsWith("Ready offline"),
          );
          await current.locator("#listen").click();
          await current.waitForFunction(
            () => document.getElementById("audio-status").dataset.playing === "true",
          );
          await current.locator("#stop").click();
          const waiting = current.waitForEvent("download");
          await current.locator("#save-study").click();
          const worksheet = await waiting;
          await worksheet.saveAs(path.join(path.dirname(output), `${engine}-${mode}-offline.html`));
          assert.equal(await worksheet.failure(), null);
          await current.locator("#return-top").click();
          await current.waitForFunction(
            (edition) => document.getElementById("edition").textContent.endsWith(edition),
            newEdition,
          );
          assert.equal(await current.locator("#tuning-name").textContent(), "embūbum");
          records.push({
            engine,
            mode,
            oldEdition,
            newEdition,
            before,
            workerAfter: readyWorker,
            after,
            automaticallyAcknowledged: phase === "after",
            staleReplyIgnored: mode === "late",
            wrongHttp200Responses: [...badResponses],
            expectedIntegrityConsoleErrors: consoleErrors,
            offlinePracticeAndMain: true,
            offlineWorksheetSaved: true,
          });
          process.stdout.write(
            `${engine}/${mode}: ${phase === "before" ? "stale readiness reproduced" : "readiness and offline upgrade verified"}.\n`,
          );
        } finally {
          await context.close();
        }
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  for (const item of pending.splice(0)) item.response.destroy();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await writeFile(
    output,
    `${JSON.stringify({ phase, oldFileCount: oldFiles.size, newFileCount: newFiles.size, records }, null, 2)}\n`,
  );
}
