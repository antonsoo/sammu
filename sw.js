/* Offline edition cf03122b7f3329e6403f1a6db987d0174479cda64c31f2fdff84998ca0d0b32c. Generated from the complete build. */
const CACHE = "sammu-cf03122b7f3329e6403f1a6db987d0174479cda64c31f2fdff84998ca0d0b32c";
const EDITION = "cf03122b7f3329e6403f1a6db987d0174479cda64c31f2fdff84998ca0d0b32c";
const BASE = "/sammu/";
const FILES = ["/sammu/assets/main-C7-5KG6S.js","/sammu/assets/main-tGNh2i3-.css","/sammu/favicon.svg","/sammu/fonts/Atkinson-OFL.txt","/sammu/fonts/AtkinsonHyperlegibleNext.ttf","/sammu/fonts/NotoSerif-OFL.txt","/sammu/fonts/NotoSerif-Regular.ttf","/sammu/index.html"];
const INTEGRITY = {"/sammu/assets/main-C7-5KG6S.js":"sha256-uOhWh6DW3bevbr4X3nqytru8BRA5mQqnWOQiycmYZgM=","/sammu/assets/main-tGNh2i3-.css":"sha256-65mIw7rgxD/qSAVienTSxjr6FQhRZ/XfKGyrkVS4tSs=","/sammu/favicon.svg":"sha256-fSU3UXohsAsJrKtoU0+tyoqGGSrsXhkUrM0+FigwPGc=","/sammu/fonts/Atkinson-OFL.txt":"sha256-rKakKFgJZdIpfRtxgELdQnwqlEPs47DQLXWOFh4MQDA=","/sammu/fonts/AtkinsonHyperlegibleNext.ttf":"sha256-WkVdHPoJm2AatwdRu5Zz6P4YVNxFAMgOGiINDXXjF0U=","/sammu/fonts/NotoSerif-OFL.txt":"sha256-zumJL58MyP6ILJ6VN+5qiWIdhu586vcLAuKyscJcBho=","/sammu/fonts/NotoSerif-Regular.ttf":"sha256-VHPS5DvdAY7hJKSt26gJH9CimJSxIcu3QQI69lSWYrY=","/sammu/index.html":"sha256-fo84eatZnZj9y5b7VEKTsFJXEunfgu2J76bFtv2G5rA="};
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
