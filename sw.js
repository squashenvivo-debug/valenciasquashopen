const STATIC_CACHE = "psa-static-v20260806-10";
const RUNTIME_CACHE = "psa-runtime-v2";
const STATIC_EXTENSIONS = /\.(?:css|js|json|png|jpe?g|webp|svg|ico|woff2?)$/i;

self.addEventListener("install", (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(
            keys
                .filter((key) => ![STATIC_CACHE, RUNTIME_CACHE].includes(key))
                .map((key) => caches.delete(key))
        );
        await self.clients.claim();
    })());
});

async function staleWhileRevalidate(request) {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(request);
    const networkPromise = fetch(request)
        .then((response) => {
            if (response && response.ok) {
                cache.put(request, response.clone());
            }
            return response;
        })
        .catch(() => cached);
    return cached || networkPromise;
}

async function networkFirst(request) {
    const cache = await caches.open(RUNTIME_CACHE);
    try {
        const response = await fetch(request);
        if (response && response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        const cached = await cache.match(request);
        if (cached) return cached;
        throw error;
    }
}

self.addEventListener("fetch", (event) => {
    const request = event.request;
    if (request.method !== "GET") return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    if (request.mode === "navigate") {
        event.respondWith(networkFirst(request));
        return;
    }

    if (STATIC_EXTENSIONS.test(url.pathname) || url.pathname.startsWith("/assets/")) {
        event.respondWith(staleWhileRevalidate(request));
    }
});
