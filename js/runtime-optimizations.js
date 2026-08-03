window.PSAOptimizations = (() => {
    const FETCH_CACHE_PREFIX = "psa_fetch_cache:";
    const ERROR_LOG_KEY = "psa_runtime_error_log";
    const MAX_ERROR_LOGS = 40;
    const scriptCache = new Map();
    let errorBindingDone = false;
    let swRegistrationStarted = false;
    let assetRewriteObserver = null;

    function getAssetCdnBase() {
        return String(window.PSA_CONFIG?.assetCdnBase || "").trim().replace(/\/+$/, "");
    }

    function isAbsoluteUrl(url) {
        return /^(?:[a-z]+:)?\/\//i.test(String(url || ""));
    }

    function isAssetPath(url) {
        const value = String(url || "").trim();
        return /^(?:\.\/)?assets\//i.test(value) || /^\/assets\//i.test(value);
    }

    function resolveAssetUrl(url) {
        const value = String(url || "").trim();
        if (!value || value.startsWith("data:") || value.startsWith("blob:")) return value;
        if (!isAssetPath(value)) return value;
        if (isAbsoluteUrl(value)) return value;
        const cdnBase = getAssetCdnBase();
        if (!cdnBase) return value;
        return `${cdnBase}/${value.replace(/^\/+/, "")}`;
    }

    function rewriteSrcsetValue(value) {
        const text = String(value || "").trim();
        if (!text) return text;
        return text
            .split(",")
            .map((part) => {
                const chunk = part.trim();
                if (!chunk) return chunk;
                const pieces = chunk.split(/\s+/);
                if (!pieces.length) return chunk;
                pieces[0] = resolveAssetUrl(pieces[0]);
                return pieces.join(" ");
            })
            .join(", ");
    }

    function rewriteAssetAttributes(root = document) {
        const host = root?.querySelectorAll ? root : document;
        const nodes = host.querySelectorAll("[src], [href], [poster], [srcset]");
        nodes.forEach((node) => {
            if (node.hasAttribute("src")) {
                const current = node.getAttribute("src");
                const next = resolveAssetUrl(current);
                if (next && next !== current) node.setAttribute("src", next);
            }
            if (node.hasAttribute("href")) {
                const current = node.getAttribute("href");
                const next = resolveAssetUrl(current);
                if (next && next !== current) node.setAttribute("href", next);
            }
            if (node.hasAttribute("poster")) {
                const current = node.getAttribute("poster");
                const next = resolveAssetUrl(current);
                if (next && next !== current) node.setAttribute("poster", next);
            }
            if (node.hasAttribute("srcset")) {
                const current = node.getAttribute("srcset");
                const next = rewriteSrcsetValue(current);
                if (next && next !== current) node.setAttribute("srcset", next);
            }
        });
    }

    function bindAssetRewriteObserver() {
        if (assetRewriteObserver || typeof MutationObserver === "undefined") return;
        assetRewriteObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === "attributes" && mutation.target) {
                    rewriteAssetAttributes(mutation.target.parentNode || document);
                    return;
                }
                mutation.addedNodes.forEach((node) => {
                    if (node?.nodeType === 1) {
                        rewriteAssetAttributes(node);
                    }
                });
            });
        });
        assetRewriteObserver.observe(document.documentElement, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ["src", "href", "poster", "srcset"]
        });
    }

    function readJsonStorage(key, fallbackValue) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return fallbackValue;
            return JSON.parse(raw);
        } catch (error) {
            return fallbackValue;
        }
    }

    function writeJsonStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            return false;
        }
    }

    function getErrorLog() {
        return readJsonStorage(ERROR_LOG_KEY, []);
    }

    function clearErrorLog() {
        try {
            localStorage.removeItem(ERROR_LOG_KEY);
        } catch (error) {
            // Ignorado a propósito.
        }
    }

    function logError(scope, message, extra = null) {
        const text = String(message || "").trim();
        if (!text) return;
        const entries = getErrorLog();
        entries.unshift({
            id: `runtime_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            scope: String(scope || "runtime"),
            message: text.slice(0, 500),
            extra: extra || null,
            createdAt: new Date().toISOString()
        });
        writeJsonStorage(ERROR_LOG_KEY, entries.slice(0, MAX_ERROR_LOGS));
    }

    function bindErrorLogging() {
        if (errorBindingDone) return;

        window.addEventListener("error", (event) => {
            const message = event?.message || event?.error?.message || "Error público no identificado";
            logError("public-runtime", message);
        });

        window.addEventListener("unhandledrejection", (event) => {
            const reason = event?.reason;
            const message = reason?.message || String(reason || "Promesa rechazada sin capturar");
            logError("public-promise", message);
        });

        errorBindingDone = true;
    }

    async function fetchJson(url, options = {}) {
        const ttlMs = Number(options.ttlMs || 300000);
        const cacheKey = `${FETCH_CACHE_PREFIX}${options.cacheKey || url}`;
        const now = Date.now();
        const cached = readJsonStorage(cacheKey, null);

        if (!options.forceFresh && cached?.storedAt && now - cached.storedAt < ttlMs) {
            return cached.data;
        }

        const response = await fetch(resolveAssetUrl(url), {
            cache: options.requestCache || "default",
            headers: options.headers || undefined
        });
        if (!response.ok) {
            throw new Error(`No se pudo cargar ${url} (${response.status})`);
        }

        const data = await response.json();
        writeJsonStorage(cacheKey, {
            url,
            storedAt: now,
            data
        });
        return data;
    }

    function clearFetchCache() {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (key && key.startsWith(FETCH_CACHE_PREFIX)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
        return keysToRemove.length;
    }

    function applyLazyMedia(root = document) {
        const images = root.querySelectorAll("img:not([loading])");
        images.forEach((image) => {
            if (!image.closest("#hero")) {
                image.loading = "lazy";
            }
            image.decoding = "async";
        });

        const iframes = root.querySelectorAll("iframe:not([loading])");
        iframes.forEach((iframe) => {
            iframe.loading = "lazy";
        });
    }

    async function loadScriptOnce(url, globalName) {
        const resolvedUrl = resolveAssetUrl(url);
        if (globalName && window[globalName]) return window[globalName];
        if (scriptCache.has(resolvedUrl)) return scriptCache.get(resolvedUrl);

        const loadingPromise = new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[data-runtime-src="${resolvedUrl}"]`);
            if (existing) {
                existing.addEventListener("load", () => resolve(globalName ? window[globalName] : true), { once: true });
                existing.addEventListener("error", () => reject(new Error(`No se pudo cargar ${resolvedUrl}`)), { once: true });
                return;
            }

            const script = document.createElement("script");
            script.src = resolvedUrl;
            script.async = true;
            script.dataset.runtimeSrc = resolvedUrl;
            script.onload = () => resolve(globalName ? window[globalName] : true);
            script.onerror = () => reject(new Error(`No se pudo cargar ${resolvedUrl}`));
            document.head.appendChild(script);
        });

        scriptCache.set(resolvedUrl, loadingPromise);
        return loadingPromise;
    }

    function downloadBlob(fileName, blob) {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    async function registerServiceWorker() {
        if (swRegistrationStarted) return;
        swRegistrationStarted = true;

        if (!("serviceWorker" in navigator)) return;
        if (!window.isSecureContext && window.location.hostname !== "127.0.0.1" && window.location.hostname !== "localhost") return;

        try {
            await navigator.serviceWorker.register("./sw.js");
        } catch (error) {
            logError("service-worker", error?.message || "No se pudo registrar el service worker");
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            bindErrorLogging();
            rewriteAssetAttributes(document);
            bindAssetRewriteObserver();
            applyLazyMedia(document);
            registerServiceWorker();
        });
    } else {
        bindErrorLogging();
        rewriteAssetAttributes(document);
        bindAssetRewriteObserver();
        applyLazyMedia(document);
        registerServiceWorker();
    }

    return {
        resolveAssetUrl,
        fetchJson,
        clearFetchCache,
        getErrorLog,
        clearErrorLog,
        logError,
        rewriteAssetAttributes,
        applyLazyMedia,
        loadScriptOnce,
        downloadBlob,
        registerServiceWorker
    };
})();
