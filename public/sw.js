const CACHE = 'toyota-kiosk-v3-languages';
const CORE = ['/', '/toyota-supra.jpg', '/toyota-logo.svg', '/fonts/inter-latin.woff2', '/fonts/notosansjp.ttf', '/fonts/notosanskannada.ttf', '/favicon.svg', '/manifest.webmanifest'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE))); });
self.addEventListener('activate', event => { event.waitUntil((async () => { for (const name of await caches.keys()) if (name.startsWith('toyota-kiosk-') && name !== CACHE) await caches.delete(name); await self.clients.claim(); })()); });
self.addEventListener('message', event => { if(event.data?.type !== 'CACHE_KIOSK') return; event.waitUntil((async () => {
 const cache = await caches.open(CACHE);
 // Normalize before deduplicating: CORE paths and observed resource URLs may name the same font.
 const urls = [...new Set([...CORE, ...(Array.isArray(event.data.urls) ? event.data.urls : [])].flatMap(value => {
  try { const u = new URL(value, self.location.origin); return u.origin === self.location.origin && !u.pathname.startsWith('/api/') && !u.pathname.startsWith('/staff') ? [u.href] : []; } catch { return []; }
 }))];
 await cache.addAll(urls); event.source?.postMessage({type:'KIOSK_CACHED'});
 })()); });
self.addEventListener('fetch', event => {
 const url = new URL(event.request.url);
 if(event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/staff') || url.pathname.includes('chatgpt') || url.searchParams.has('_rsc')) return;
 if(event.request.mode === 'navigate') { if(url.pathname !== '/') return; event.respondWith(fetch(event.request).then(async response => { if(response.ok && !response.redirected && response.headers.get('content-type')?.includes('text/html')) (await caches.open(CACHE)).put('/', response.clone()); return response; }).catch(async () => (await caches.match('/')) || new Response('Please reconnect to install the kiosk.',{status:503}))); return; }
 if(/\.(js|css|woff2|ttf|jpg|png|svg|webmanifest)$/.test(url.pathname)) event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(async response => { if(response.ok) (await caches.open(CACHE)).put(event.request,response.clone()); return response; })));
});
