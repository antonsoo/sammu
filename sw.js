/* Verified offline edition f18c535e5bafc0ed1b95c306c1c868a89475b94177a237b4ce1715bdac577e69. */
const CACHE = "sammu-f18c535e5bafc0ed1b95c306c1c868a89475b94177a237b4ce1715bdac577e69";
const EDITION = "f18c535e5bafc0ed1b95c306c1c868a89475b94177a237b4ce1715bdac577e69";
const BASE = "/sammu/";
const FILES = ["/sammu/assets/main-CeZxHRVD.js","/sammu/assets/practice-B5eJgjVP.js","/sammu/assets/practice-CC_8shvY.css","/sammu/assets/routes-2rb67apI.js","/sammu/assets/routes-CChfZi6K.css","/sammu/assets/study-download-DFBtWXLd.css","/sammu/assets/study-download-bruvpA-i.js","/sammu/favicon.svg","/sammu/fonts/Atkinson-OFL.txt","/sammu/fonts/AtkinsonHyperlegibleNext.ttf","/sammu/fonts/NotoSerif-OFL.txt","/sammu/fonts/NotoSerif-Regular.ttf","/sammu/index.html","/sammu/practice.html","/sammu/routes.html"];
const INTEGRITY = {"/sammu/assets/main-CeZxHRVD.js":"sha256-BeGNcGIwHwsxxMpoORuiW5+jlkkRVhiPtgHP15lFEzI=","/sammu/assets/practice-B5eJgjVP.js":"sha256-OSFqHNPNoLTBjVdN1UEh9BPtyUelfGDaxu2or0rWmJw=","/sammu/assets/practice-CC_8shvY.css":"sha256-qCV44nY1cIiHI+lNWWLgTng9YA260WDW/fF+I/wRvjI=","/sammu/assets/routes-2rb67apI.js":"sha256-zRtJAncA0jCS9Wu6eA3S530qqq4iTwJsqGBdeXMYZyo=","/sammu/assets/routes-CChfZi6K.css":"sha256-gyEUIkgvRH7ZbfHX2MDVgPuFECOf0VSDdThZkxPGivU=","/sammu/assets/study-download-DFBtWXLd.css":"sha256-bvrCueHFaedJbfeknQM+nVIR9rZWtFKdgHBQ9LdIyi8=","/sammu/assets/study-download-bruvpA-i.js":"sha256-rXdfao/88Z7s8zp++eDBZ9l12+65qG1Urky1LEX/Nr8=","/sammu/favicon.svg":"sha256-fSU3UXohsAsJrKtoU0+tyoqGGSrsXhkUrM0+FigwPGc=","/sammu/fonts/Atkinson-OFL.txt":"sha256-rKakKFgJZdIpfRtxgELdQnwqlEPs47DQLXWOFh4MQDA=","/sammu/fonts/AtkinsonHyperlegibleNext.ttf":"sha256-WkVdHPoJm2AatwdRu5Zz6P4YVNxFAMgOGiINDXXjF0U=","/sammu/fonts/NotoSerif-OFL.txt":"sha256-zumJL58MyP6ILJ6VN+5qiWIdhu586vcLAuKyscJcBho=","/sammu/fonts/NotoSerif-Regular.ttf":"sha256-VHPS5DvdAY7hJKSt26gJH9CimJSxIcu3QQI69lSWYrY=","/sammu/index.html":"sha256-7xD7RMYCSeX7cEDsNtOZQr8e3fYdgPDhN4tg9b2HK1A=","/sammu/practice.html":"sha256-45C37x5wH5EsM0glXWsPsuY2AlqwWHWQX4wXtgk/TOM=","/sammu/routes.html":"sha256-nY2sp7jk63p0j1ceY5wqwg4/xxiUvjbbOAJOJGh2Dh0="};
const SIZES = {"/sammu/assets/main-CeZxHRVD.js":10029,"/sammu/assets/practice-B5eJgjVP.js":8796,"/sammu/assets/practice-CC_8shvY.css":6047,"/sammu/assets/routes-2rb67apI.js":18089,"/sammu/assets/routes-CChfZi6K.css":4531,"/sammu/assets/study-download-DFBtWXLd.css":16302,"/sammu/assets/study-download-bruvpA-i.js":52417,"/sammu/favicon.svg":252,"/sammu/fonts/Atkinson-OFL.txt":4431,"/sammu/fonts/AtkinsonHyperlegibleNext.ttf":114552,"/sammu/fonts/NotoSerif-OFL.txt":4396,"/sammu/fonts/NotoSerif-Regular.ttf":444064,"/sammu/index.html":18338,"/sammu/practice.html":10134,"/sammu/routes.html":10216};
const TRANSFER_IDLE_MS = 15000;
const TRANSFER_TOTAL_MS = 180000;

const INSTANCE = crypto.randomUUID();
let sequence = 0;
let revision = 0;
let lastSignature = "";
let lastState;
let auditFlight;
let repairFlight;
let repairing = false;

async function valid(response, path) {
  if (!response || !response.ok) return false;
  try {
    const bytes = await response.clone().arrayBuffer();
    if (bytes.byteLength !== SIZES[path]) return false;
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    const value = "sha256-" + btoa(String.fromCharCode(...digest));
    return value === INTEGRITY[path];
  } catch { return false; }
}

async function publish(failures) {
  const signature = JSON.stringify({ failures, repairing });
  if (signature !== lastSignature) {
    lastSignature = signature;
    lastState = {
      type: "SAMMU_EDITION", edition: EDITION, instance: INSTANCE,
      sequence: ++sequence, complete: failures.length === 0, failures, repairing,
      entries: FILES.filter(path => path.endsWith(".html")),
    };
    const clients = await self.clients.matchAll({ type: "window" });
    for (const client of clients) client.postMessage(lastState);
  }
  return lastState;
}

function audit() {
  if (auditFlight) return auditFlight;
  auditFlight = (async () => {
    let failures;
    let started;
    do {
      started = revision;
      const cache = await caches.open(CACHE);
      failures = (await Promise.all(FILES.map(async path => {
        const response = await cache.match(path);
        if (!response) return { path, reason: "missing" };
        if (!await valid(response, path)) return { path, reason: "damaged" };
        return null;
      }))).filter(Boolean);
    } while (started !== revision);
    return publish(failures);
  })().finally(() => { auditFlight = undefined; });
  return auditFlight;
}

async function networkFile(path, outerSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort(outerSignal.reason);
  if (outerSignal?.aborted) abort();
  else outerSignal?.addEventListener("abort", abort, { once: true });
  let idle;
  const progress = () => {
    clearTimeout(idle);
    idle = setTimeout(() => controller.abort(new Error("Offline transfer stopped progressing.")), TRANSFER_IDLE_MS);
  };
  const total = setTimeout(() => controller.abort(new Error("Offline transfer exceeded its total window.")), TRANSFER_TOTAL_MS);
  let reader;
  try {
    progress();
    // Native SRI can withhold the response until its entire body arrives. Read
    // bounded chunks ourselves so active transfer and body inactivity differ.
    const response = await fetch(new Request(path, { cache: "reload", signal: controller.signal }));
    if (!response.ok || !response.body) throw new Error("Unavailable offline file: " + path);
    reader = response.body.getReader();
    const chunks = [];
    let length = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value.length) continue;
      length += value.length;
      if (length > SIZES[path]) throw new Error("Oversized offline file: " + path);
      chunks.push(value);
      progress();
    }
    if (length !== SIZES[path]) throw new Error("Truncated offline file: " + path);
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const headers = new Headers(response.headers);
    headers.delete("content-encoding");
    headers.delete("content-length");
    const verified = new Response(bytes, { status: response.status, statusText: response.statusText, headers });
    if (!await valid(verified, path)) throw new Error("Unverified offline file: " + path);
    return verified;
  } finally {
    clearTimeout(idle);
    clearTimeout(total);
    outerSignal?.removeEventListener("abort", abort);
    controller.abort();
    if (reader) { void reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
}

function repair() {
  if (repairFlight) return repairFlight;
  repairing = true;
  ++revision;
  repairFlight = (async () => {
    try {
      await audit();
      const cache = await caches.open(CACHE);
      await Promise.all(FILES.map(async path => {
        const response = await cache.match(path);
        if (await valid(response, path)) return;
        if (response) { await cache.delete(path); ++revision; }
        try {
          const fresh = await networkFile(path);
          await cache.put(path, fresh);
          ++revision;
        } catch { /* Keep the incomplete inventory visible; a later repair can retry. */ }
      }));
    } finally {
      repairing = false;
      ++revision;
    }
    return audit();
  })().finally(() => { repairFlight = undefined; });
  return repairFlight;
}

async function retained(path, allowNetwork) {
  const cache = await caches.open(CACHE);
  const response = await cache.match(path);
  if (await valid(response, path)) return response;
  if (response) await cache.delete(path);
  ++revision;
  await audit();
  if (allowNetwork) {
    try {
      const fresh = await networkFile(path);
      await cache.put(path, fresh.clone());
      ++revision;
      await audit();
      return fresh;
    } catch { /* Never return missing or damaged bytes as this edition's file. */ }
  }
  return Response.error();
}

self.addEventListener("install", event => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TRANSFER_TOTAL_MS);
  event.waitUntil((async () => {
    try {
      // Publish no partial edition: every bounded response must verify before
      // any entries are written, and a failed write removes the incomplete copy.
      const responses = await Promise.all(FILES.map(path => networkFile(path, controller.signal)));
      const cache = await caches.open(CACHE);
      await Promise.all(FILES.map((path, i) => cache.put(path, responses[i])));
      await self.skipWaiting();
    } catch (error) {
      controller.abort();
      await caches.delete(CACHE);
      throw error;
    } finally { clearTimeout(timer); }
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith("sammu-") && key !== CACHE)
    .map(key => caches.delete(key))))
    .then(() => self.clients.claim()).then(() => audit()));
});

self.addEventListener("message", event => {
  const data = event.data;
  if (!event.ports[0] || !["SAMMU_INSPECT", "SAMMU_REPAIR"].includes(data?.type)) return;
  const reply = event.ports[0];
  event.waitUntil((async () => {
    // Old open pages may inspect the new worker, but cannot invalidate or
    // repair it using the previous edition's assumptions.
    const sameEdition = data.edition === EDITION;
    if (data.claim) await self.clients.claim();
    if (sameEdition && data.invalidate) ++revision;
    const state = sameEdition && data.type === "SAMMU_REPAIR" ? await repair() : await audit();
    reply.postMessage(state);
  })().catch(() => reply.postMessage({
    type: "SAMMU_EDITION", edition: EDITION, instance: INSTANCE,
    sequence: ++sequence, complete: false, failures: [], repairing: false,
  })));
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  const path = url.pathname === BASE ? BASE + "index.html" : url.pathname;
  if (!FILES.includes(path)) return;
  if (event.request.mode === "navigate") {
    // A controlled navigation belongs to this complete, verified edition.
    // Network-first accepted maintenance bodies and could wait forever after
    // headers or mid-body. Registering/updating sw.js installs the next edition;
    // it must finish before its entry pages and asset hashes can be used together.
    event.respondWith(retained(path, true));
  } else event.respondWith(retained(path, true));
});
