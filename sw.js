/* Offline edition 80387d6a91467cbf1cb37888655e94574aea4c313564b39c6fcac0a348de47de. Generated from the complete build. */
const CACHE = "sammu-80387d6a91467cbf1cb37888655e94574aea4c313564b39c6fcac0a348de47de";
const EDITION = "80387d6a91467cbf1cb37888655e94574aea4c313564b39c6fcac0a348de47de";
const BASE = "/sammu/";
const FILES = ["/sammu/assets/main-DfjZv9OU.js","/sammu/assets/practice-C4hf9I29.js","/sammu/assets/practice-DSOpFAys.css","/sammu/assets/study-BLHHzp9_.js","/sammu/assets/study-DDuBUp75.css","/sammu/favicon.svg","/sammu/fonts/Atkinson-OFL.txt","/sammu/fonts/AtkinsonHyperlegibleNext.ttf","/sammu/fonts/NotoSerif-OFL.txt","/sammu/fonts/NotoSerif-Regular.ttf","/sammu/index.html","/sammu/practice.html"];
const INTEGRITY = {"/sammu/assets/main-DfjZv9OU.js":"sha256-xIh8P7v/YpEKsMJ3ERqSy096oB0KpGR75oyC/oNx9uY=","/sammu/assets/practice-C4hf9I29.js":"sha256-lCWAJBbH8vLeygDPlZyj4lhbFFUwYxU49aBd6/zc/wY=","/sammu/assets/practice-DSOpFAys.css":"sha256-OiQlAg2HuA2oCx3YoNveqTkkhknO7J2Q8C/zCs/kSBs=","/sammu/assets/study-BLHHzp9_.js":"sha256-iVsguoxJLT7oG2RIdURsPBQGbXCwckl98IsbIS46RFA=","/sammu/assets/study-DDuBUp75.css":"sha256-SDOqHMCB17zOsJUkAuLZBAcpVZH1C6wTifdTk1H6+II=","/sammu/favicon.svg":"sha256-fSU3UXohsAsJrKtoU0+tyoqGGSrsXhkUrM0+FigwPGc=","/sammu/fonts/Atkinson-OFL.txt":"sha256-rKakKFgJZdIpfRtxgELdQnwqlEPs47DQLXWOFh4MQDA=","/sammu/fonts/AtkinsonHyperlegibleNext.ttf":"sha256-WkVdHPoJm2AatwdRu5Zz6P4YVNxFAMgOGiINDXXjF0U=","/sammu/fonts/NotoSerif-OFL.txt":"sha256-zumJL58MyP6ILJ6VN+5qiWIdhu586vcLAuKyscJcBho=","/sammu/fonts/NotoSerif-Regular.ttf":"sha256-VHPS5DvdAY7hJKSt26gJH9CimJSxIcu3QQI69lSWYrY=","/sammu/index.html":"sha256-HKNw8mUVTEKPFKruaelntv+mv6/KRXbemxA5R+258tE=","/sammu/practice.html":"sha256-kZYOpHUQS74GQaRNFS8f+LnLyOAalrYGJrICOzgdjg4="};
self.addEventListener("install", event => {
  // HTTP success does not establish edition identity. A stale entry page or
  // substituted scan must fail the complete install before this worker activates.
  const requests = FILES.map(url => new Request(url, { cache: "reload", integrity: INTEGRITY[url] }));
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(requests)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("sammu-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("message", event => {
  if (event.data?.type !== "SAMMU_INSPECT" || !event.ports[0]) return;
  event.waitUntil(caches.open(CACHE).then(cache => cache.keys()).then(keys => {
    const saved = new Set(keys.map(request => new URL(request.url).pathname));
    event.ports[0].postMessage({ type: "SAMMU_EDITION", edition: EDITION, complete: FILES.every(file => saved.has(file)) });
  }).catch(() => event.ports[0].postMessage({ type: "SAMMU_EDITION", edition: EDITION, complete: false })));
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (event.request.mode === "navigate") {
    const page = url.pathname === BASE || url.pathname === BASE + "index.html" ? BASE + "index.html" : url.pathname;
    if (FILES.includes(page)) event.respondWith(fetch(event.request).catch(() => caches.open(CACHE).then(cache => cache.match(page))));
  } else if (FILES.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(url.pathname)).then(cached => cached || fetch(event.request)));
  }
});
