const CACHE = 'job-checklist-shell-v3';
const FILES = ['./', './index.html', './src/styles.css', './src/app.js', './src/domain.js', './src/description-parser.js', './icon.svg', './vendor/ocr/tesseract.esm.min.js', './vendor/ocr/worker.min.js', './vendor/ocr/core/tesseract-core-lstm.wasm.js', './vendor/ocr/core/tesseract-core-simd-lstm.wasm.js', './vendor/ocr/core/tesseract-core-relaxedsimd-lstm.wasm.js', './vendor/ocr/lang/eng.traineddata.gz'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('job-checklist-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  // Network first prevents stale source during development; cache serves the shell offline.
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok && FILES.some(file => new URL(file, self.registration.scope).href === event.request.url)) {
      const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)));
    }
    return response;
  }).catch(() => caches.match(event.request).then(cached => cached || (event.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
