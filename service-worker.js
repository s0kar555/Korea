const CACHE = 'pwa-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/app.js',
  './js/converter.js',
  './js/finance.js',
  './js/store.js',
  './js/sync.js'
];

self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});
self.addEventListener('activate', (e)=>{
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
});
self.addEventListener('fetch', (e)=>{
  const url = new URL(e.request.url);
  if (ASSETS.includes(url.pathname.replace(self.registration.scope, './'))) {
    e.respondWith(caches.match(e.request));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(res=> res || fetch(e.request).then(resp=>{
      const clone = resp.clone();
      caches.open(CACHE).then(c=>c.put(e.request, clone));
      return resp;
    }).catch(()=>res))
  );
});
