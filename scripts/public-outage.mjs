import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { connect } from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, firefox } from "playwright";

// TLS stays end-to-end. The proxy forwards the actual public origin while
// online, then destroys its tunnels and refuses new connections. No browser
// offline emulation, route fulfillment, certificate bypass or local app server.
const base = "https://antonsoo.github.io/sammu/";
const directory = path.resolve(process.argv[2] ?? "/tmp/claude-1000/sammu-public-outage");
await mkdir(directory, { recursive: true });
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const files = new Map();
async function collect(folder) {
  for (const item of await readdir(folder, { withFileTypes: true })) {
    const file = path.join(folder, item.name);
    if (item.isDirectory()) await collect(file);
    else files.set(path.relative("dist", file).split(path.sep).join("/"), await readFile(file));
  }
}
await collect("dist");
const edition = /const EDITION = "([a-f0-9]+)"/.exec(files.get("sw.js").toString())[1];
const license = await readFile("LICENSE", "utf8");
const fontLicenses = ["Atkinson-OFL.txt", "NotoSerif-OFL.txt"]
  .map((name) => files.get(`fonts/${name}`).toString())
  .join("\n\n");
const expected = Object.fromEntries(
  [...files].filter(([name]) => name !== "sw.js").map(([name, bytes]) => [name, hash(bytes)]),
);
let blocked = false;
let refused = 0;
let forwardedBytes = 0;
const sockets = new Set();
function track(socket) {
  sockets.add(socket);
  socket.on("close", () => sockets.delete(socket));
  socket.on("error", () => socket.destroy());
  return socket;
}
function disconnect() {
  blocked = true;
  for (const socket of sockets) socket.destroy();
}
const server = createServer((_request, response) => response.writeHead(502).end());
server.on("connection", track);
server.on("connect", (request, client, head) => {
  if (blocked || request.url !== "antonsoo.github.io:443") {
    if (request.url === "antonsoo.github.io:443") refused++;
    client.end("HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n");
    return;
  }
  const remote = track(connect({ host: "antonsoo.github.io", port: 443 }));
  remote.setTimeout(30000, () => remote.destroy());
  remote.on("error", () => client.destroy());
  remote.on("close", () => client.destroy());
  client.on("close", () => remote.destroy());
  remote.on("data", (bytes) => {
    forwardedBytes += bytes.length;
  });
  remote.once("connect", () => {
    if (blocked) {
      remote.destroy();
      client.destroy();
      return;
    }
    client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    if (head.length) remote.write(head);
    remote.pipe(client);
    client.pipe(remote);
  });
});
async function ready(page) {
  await page.waitForFunction(
    () => document.querySelector("#offline-status").textContent.startsWith("Ready offline"),
    null,
    { timeout: 45000 },
  );
  assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller));
  assert.equal(await page.locator("#edition").textContent(), `Workshop edition: ${edition}`);
}
async function inventory(page) {
  return page.evaluate(async (expected) => {
    const keys = await caches.keys();
    if (keys.filter((name) => name.startsWith("sammu-")).length !== 1) return false;
    const cache = await caches.open(keys.find((name) => name.startsWith("sammu-")));
    for (const [name, expectedHash] of Object.entries(expected)) {
      const response = await cache.match(`/sammu/${name}`);
      if (!response) return false;
      const digest = new Uint8Array(
        await crypto.subtle.digest("SHA-256", await response.arrayBuffer()),
      );
      if ([...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("") !== expectedHash)
        return false;
    }
    return Object.keys(expected).length;
  }, expected);
}
async function download(page, selector, filename) {
  const waiting = page.waitForEvent("download");
  await page.locator(selector).click();
  const download = await waiting;
  assert.equal(await download.failure(), null);
  await download.saveAs(path.join(directory, filename));
  return readFile(path.join(directory, filename));
}
const rows = [];
try {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const proxy = { server: `http://127.0.0.1:${server.address().port}` };
  for (const [engine, launcher] of Object.entries({ chromium, firefox })) {
    const browser = await launcher.launch({ proxy });
    try {
      for (const width of [1440, 375]) {
        blocked = false;
        const context = await browser.newContext({
          viewport: { width, height: 1000 },
          acceptDownloads: true,
        });
        try {
          const page = await context.newPage();
          const errors = [];
          page.on("pageerror", (error) => errors.push(error.message));
          const beforeBytes = forwardedBytes;
          const initial = await page.goto(base);
          assert.deepEqual(await initial.body(), files.get("index.html"));
          await ready(page);
          assert.equal(await inventory(page), Object.keys(expected).length);
          assert.ok(forwardedBytes > beforeBytes);
          // An uncached, unsupported path must reach the real origin before
          // the cut, and fail through the broken transport afterward.
          const probe = `${base}__transport_probe`;
          assert.equal(await page.evaluate(async (url) => (await fetch(url)).status, probe), 404);
          const beforeRefused = refused;
          disconnect();
          const probeFailure = await page.evaluate(async (url) => {
            try {
              await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
              return null;
            } catch (error) {
              return error.name;
            }
          }, probe);
          assert.ok(probeFailure);
          assert.ok(refused > beforeRefused, "the browser must try the refused real transport");
          assert.equal(await page.evaluate(() => navigator.onLine), true);
          const rooms = [
            ["index.html?moves=LLLLLLL", "bench"],
            ["practice.html?moves=LLLLLLL&cents=110&listen=partials&reveal=1", "practice"],
            ["routes.html?moves=LLLLLLL&target=embubum&listen=all&aligned=true", "routes"],
          ];
          const readings = [];
          for (const [room, name] of rooms) {
            const started = Date.now();
            await page.goto(`${base}${room}`, { waitUntil: "domcontentloaded", timeout: 10000 });
            await ready(page);
            if (name === "bench")
              assert.equal(await page.locator("#string-1").getAttribute("data-ratio"), "2048/2187");
            if (name === "practice")
              assert.equal(await page.locator("#amount").inputValue(), "110");
            if (name === "routes") {
              assert.match(
                await page.locator("#origin-description").textContent(),
                /7 bench moves/,
              );
              assert.equal(await page.locator('input[value="aligned"]').isChecked(), true);
              await page.locator("#play").click();
              await page.waitForFunction(
                () => document.querySelector("#audio-status").dataset.playing === "true",
              );
              await page.locator("#stop").click();
            }
            const filename = `${engine}-${width}-${name}.html`;
            const bytes = await download(page, "#save-study", filename);
            assert.ok(bytes.includes(Buffer.from("PolyForm Noncommercial License 1.0.0")));
            assert.ok(bytes.includes(Buffer.from("SIL OPEN FONT LICENSE")));
            for (const font of ["AtkinsonHyperlegibleNext.ttf", "NotoSerif-Regular.ttf"])
              assert.ok(bytes.includes(Buffer.from(files.get(`fonts/${font}`).toString("base64"))));
            const saved = await context.newPage();
            const externalRequests = [];
            saved.on("request", (request) => {
              if (/^https?:/.test(request.url())) externalRequests.push(request.url());
            });
            await saved.goto(pathToFileURL(path.join(directory, filename)).href);
            await saved.evaluate(() => document.fonts.ready);
            const notices = await saved.locator("details pre").allTextContents();
            assert.ok(notices.includes(license), "original license must be retained in full");
            assert.ok(notices.includes(fontLicenses), "both font notices must be retained in full");
            assert.deepEqual(externalRequests, []);
            await saved.close();
            readings.push({
              room: name,
              filename,
              bytes: bytes.length,
              sha256: hash(bytes),
              elapsedMs: Date.now() - started,
            });
          }
          assert.equal(await inventory(page), Object.keys(expected).length);
          assert.deepEqual(errors, []);
          blocked = false;
          const canonical = await fetch(base, { signal: AbortSignal.timeout(20000) });
          assert.equal(canonical.status, 200);
          const bytes = Buffer.from(await canonical.arrayBuffer());
          assert.deepEqual(bytes, files.get("index.html"));
          rows.push({
            engine,
            width,
            edition,
            browserOnline: true,
            offlineEmulation: false,
            refusedConnections: refused - beforeRefused,
            probeFailure,
            verifiedFiles: Object.keys(expected).length,
            readings,
            canonicalEntrySha256: hash(bytes),
          });
        } finally {
          blocked = false;
          await context.close();
        }
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  disconnect();
  server.close();
  await writeFile(
    path.join(directory, "receipt.json"),
    `${JSON.stringify({ base, edition, scope: "Actual public HTTPS bytes and worker; end-to-end TLS tunnels destroyed and refused after verified installation; browser offline emulation remains disabled", rows, passed: rows.length === 4 }, null, 2)}\n`,
  );
}
console.log(
  JSON.stringify({
    passed: rows.length === 4,
    contexts: rows.length,
    rooms: rows.length * 3,
    directory,
  }),
);
