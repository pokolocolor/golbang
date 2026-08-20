const SW_VERSION = 'golbang-sw-v3';
const STATIC_CACHE = `${SW_VERSION}-static`;
const RUNTIME_CACHE = `${SW_VERSION}-runtime`;

const APP_SHELL = [
  './',
  './index.html',
  './app.js',
  './style.css',
  './manifest.webmanifest',
  './icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map(key => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
    return;
  }

  event.respondWith(networkFirstAsset(request));
});

async function networkFirstPage(request) {
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put('./index.html', networkResponse.clone());
    return networkResponse;
  } catch (error) {
    const cachedPage =
      await caches.match(request) ||
      await caches.match('./index.html') ||
      await caches.match('./');

    if (cachedPage) return cachedPage;

    return new Response(
      `
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>골방</title>
        <style>
          body {
            margin: 0;
            font-family: sans-serif;
            background: #08131f;
            color: #f4f8fb;
            display: grid;
            place-items: center;
            min-height: 100vh;
            padding: 24px;
            text-align: center;
          }
          .box {
            max-width: 420px;
            padding: 24px;
            border-radius: 16px;
            background: #10263c;
            border: 1px solid rgba(255,255,255,0.08);
          }
          h1 { margin: 0 0 10px; font-size: 24px; }
          p { margin: 0; line-height: 1.6; color: #c8d4df; }
        </style>
      </head>
      <body>
        <div class="box">
          <h1>오프라인 상태예요</h1>
          <p>네트워크 연결 후 다시 시도해주세요.</p>
        </div>
      </body>
      </html>
      `,
      {
        headers: { 'Content-Type': 'text/html; charset=UTF-8' }
      }
    );
  }
}

async function networkFirstAsset(request) {
  const cache = await caches.open(RUNTIME_CACHE);

  try {
    const networkResponse = await fetch(request);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    const cachedResponse =
      await caches.match(request) ||
      await caches.open(STATIC_CACHE).then(c => c.match(request));

    if (cachedResponse) return cachedResponse;

    throw error;
  }
}

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
