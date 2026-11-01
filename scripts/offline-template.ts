/** Generate a classic worker whose own file is outside the retained inventory. */
export function offlineScript(config: {
  edition: string;
  base: string;
  urls: readonly string[];
  integrity: Readonly<Record<string, string>>;
}): string {
  return (
    `/* Verified offline edition ${config.edition}. */
const CACHE = ${JSON.stringify(`sammu-${config.edition}`)};
const EDITION = ${JSON.stringify(config.edition)};
const BASE = ${JSON.stringify(config.base)};
const FILES = ${JSON.stringify(config.urls)};
const INTEGRITY = ${JSON.stringify(config.integrity)};
` +
    `
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

async function networkFile(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(new Request(path, {
      cache: "reload", integrity: INTEGRITY[path], signal: controller.signal,
    }));
    if (!await valid(response, path)) throw new Error("Unverified offline file: " + path);
    return response;
  } finally { clearTimeout(timer); }
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
  const timer = setTimeout(() => controller.abort(), 10000);
  const requests = FILES.map(url => new Request(url, {
    cache: "reload", integrity: INTEGRITY[url], signal: controller.signal,
  }));
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(requests))
    .then(() => self.skipWaiting()).finally(() => clearTimeout(timer)));
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
    event.respondWith((async () => {
      // Live entry pages may belong to a newer edition. Keep them out of this
      // cache; the new worker must install and verify its complete inventory.
      try {
        const response = await fetch(event.request);
        if (response.ok) return response;
      } catch { /* Use this worker's independently verified entry offline. */ }
      return retained(path, false);
    })());
  } else event.respondWith(retained(path, true));
});
`
  );
}
