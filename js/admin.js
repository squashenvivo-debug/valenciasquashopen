/* ==========================================================
   ADMIN SETTINGS
========================================================== */

const TOURNAMENT_MODE_KEY = "tournamentContentMode";
const TOURNAMENT_API_URL_KEY = "tournamentApiUrl";
const PSA_TOURNAMENT_ID_KEY = "psaTournamentId";
const PSA_API_KEY_KEY = "psaApiKey";
const INSTAGRAM_WIDGET_KEY = "instagramWidgetCode";
const DRAW_BRACKET_KEY = "drawBracketState";
const LIVE_STREAM_URL_KEY = "liveStreamYoutubeUrl";
const LIVE_STREAM_HISTORY_KEY = "liveStreamYoutubeHistory";
const GALLERY_COLLECTION_KEY = "galleryCollections";
const NEWS_COLLECTION_KEY = "newsCollection";
const SPONSORS_COLLECTION_KEY = "sponsorsCollection";
const PLAYERS_COLLECTION_KEY = "playersCollection";
const PROGRAMMING_COLLECTION_KEY = "eventProgrammingCollection";
const TOURNAMENT_MANUAL_CONTENT_KEY = "tournamentManualContent";
const HERO_SETTINGS_KEY = "heroSettings";
const VISITS_TABLE_NAME = "site_visits";
const VISITS_LOCAL_EVENTS_KEY = "psa_local_visit_events";
const ADMIN_ERROR_LOG_KEY = "psa_admin_error_log";
const RUNTIME_ERROR_LOG_KEY = "psa_runtime_error_log";
const ADMIN_MEDIA_SIZE_CACHE_KEY = "psa_admin_media_size_cache";
const LANGS = ["es", "va", "en", "fr"];
const CLOUD_SYNC_KEYS = [
    TOURNAMENT_MODE_KEY,
    TOURNAMENT_API_URL_KEY,
    PSA_TOURNAMENT_ID_KEY,
    PSA_API_KEY_KEY,
    INSTAGRAM_WIDGET_KEY,
    DRAW_BRACKET_KEY,
    LIVE_STREAM_URL_KEY,
    LIVE_STREAM_HISTORY_KEY,
    GALLERY_COLLECTION_KEY,
    NEWS_COLLECTION_KEY,
    SPONSORS_COLLECTION_KEY,
    PLAYERS_COLLECTION_KEY,
    PROGRAMMING_COLLECTION_KEY,
    TOURNAMENT_MANUAL_CONTENT_KEY,
    HERO_SETTINGS_KEY
];

// Automatic Supabase Cloud Sync for all admin save operations
(function installCloudSyncHook() {
    const originalSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (key, value) {
        originalSetItem(key, value);
        if (CLOUD_SYNC_KEYS.includes(key) && window.PSACloudStore && window.PSACloudStore.isReady()) {
            window.PSACloudStore.saveLocalStorageKeyToCloud(key).then(res => {
                if (res && res.ok) {
                    console.log(`[CloudSync] Successfully synced '${key}' to Supabase cloud database.`);
                } else {
                    console.warn(`[CloudSync] Cloud sync for '${key}' deferred/failed:`, res?.reason);
                }
            }).catch(err => {
                console.error(`[CloudSync] Error syncing '${key}':`, err);
            });
        }
    };
})();

let drawState = null;
let pendingGalleryPhotos = [];
const GALLERY_UPLOAD_RESUME_KEY = "psa_gallery_tus_resumes";
const GALLERY_UPLOAD_CHUNK_SIZE = 6 * 1024 * 1024;
const GALLERY_UPLOAD_CONCURRENCY = 3;
let galleryUploadTelemetry = {
    totalBytes: 0,
    startedAt: 0,
    lastTs: 0,
    lastCompletedBytes: 0,
    smoothedBytesPerSecond: 0
};
let galleryUploadRetryPending = false;
let galleryUploadOnlineListenerBound = false;
let galleryEditMode = false;
let pendingNewsImageSrc = "";
let newsEditMode = false;
let adminModulesStarted = false;
let pendingHeroBackgroundSrc = "";
let adminStartPromise = null;
let storageCloudPatchInstalled = false;
let adminSectionViewBound = false;
let adminErrorLoggingBound = false;
const ADMIN_DEFAULT_SECTION = String(window.ADMIN_DEFAULT_SECTION || "dashboard").trim() || "dashboard";
const ADMIN_MULTI_PAGE_MODE = window.ADMIN_MULTI_PAGE_MODE !== false;
const ADMIN_SECTION_IDS = [
    "tournament-mode-panel",
    "hero-admin-panel",
    "tournament-text-panel",
    "players-admin-panel",
    "sponsors-admin-panel",
    "live-settings-panel",
    "news-admin-panel",
    "gallery-admin-panel",
    "programming-admin-panel",
    "draw-schedule-panel",
    "draw-builder-panel",
    "draw-results-panel"
];
const ADMIN_SECTION_TO_PAGE = {
    dashboard: "admin-dashboard.html",
    "news-admin-panel": "admin-news.html",
    "live-settings-panel": "admin-streaming.html",
    "sponsors-admin-panel": "admin-sponsors.html",
    "gallery-admin-panel": "admin-gallery.html",
    "hero-admin-panel": "admin-hero.html",
    "tournament-mode-panel": "admin-tournament.html",
    "tournament-text-panel": "admin-tournament-text.html",
    "players-admin-panel": "admin-players.html",
    "programming-admin-panel": "admin-dashboard.html",
    "draw-schedule-panel": "admin-draw-schedule.html",
    "draw-builder-panel": "admin-draw-builder.html",
    "draw-results-panel": "admin-draw-results.html"
};

function isLocalDevMode() {
    const host = String(window.location.hostname || "").toLowerCase();
    const isLocalHost = host === "127.0.0.1" || host === "localhost" || host === "";
    const params = new URLSearchParams(window.location.search);
    const forceLocal = params.get("local") === "1";
    return forceLocal || isLocalHost;
}

function getSectionFromHash() {
    const raw = (window.location.hash || "").replace(/^#/, "").trim();
    if (!raw || raw === "dashboard") {
        if (ADMIN_DEFAULT_SECTION === "dashboard") return "dashboard";
        return ADMIN_SECTION_IDS.includes(ADMIN_DEFAULT_SECTION) ? ADMIN_DEFAULT_SECTION : "dashboard";
    }
    return ADMIN_SECTION_IDS.includes(raw) ? raw : "dashboard";
}

function updateAdminMenuActiveState(activeView) {
    const menuLinks = document.querySelectorAll(".sidebar nav a[data-section]");
    menuLinks.forEach((link) => {
        const target = String(link.getAttribute("data-section") || "dashboard").trim() || "dashboard";
        const isActive = (activeView === "dashboard" && target === "dashboard") || target === activeView;
        link.classList.toggle("is-active", isActive);
    });
}

function configureAdminMenuLinks() {
    const menuLinks = document.querySelectorAll(".sidebar nav a[data-section]");

    menuLinks.forEach((link) => {
        const section = String(link.getAttribute("data-section") || "dashboard").trim() || "dashboard";
        const targetPage = ADMIN_SECTION_TO_PAGE[section] || "admin-dashboard.html";

        if (ADMIN_MULTI_PAGE_MODE) {
            const hash = section === "dashboard" ? "" : `#${section}`;
            link.setAttribute("href", `${targetPage}${hash}`);
        } else {
            link.setAttribute("href", section === "dashboard" ? "#dashboard" : `#${section}`);
        }
    });
}

function ensureProgrammingAdminMenuLink() {
    const nav = document.querySelector(".sidebar nav");
    if (!nav) return;

    const existing = nav.querySelector('a[data-section="programming-admin-panel"]');
    if (existing) return;

    const link = document.createElement("a");
    link.setAttribute("href", "#programming-admin-panel");
    link.setAttribute("data-section", "programming-admin-panel");
    link.textContent = "Programación";

    const drawScheduleLink = nav.querySelector('a[data-section="draw-schedule-panel"]');
    if (drawScheduleLink && drawScheduleLink.nextSibling) {
        nav.insertBefore(link, drawScheduleLink.nextSibling);
    } else if (drawScheduleLink) {
        nav.appendChild(link);
    } else {
        nav.insertBefore(link, nav.firstChild);
    }
}

function ensureProgrammingAdminPanel() {
    if (document.getElementById("programming-admin-panel")) return;

    const drawSchedulePanel = document.getElementById("draw-schedule-panel");
    if (!drawSchedulePanel) return;

    drawSchedulePanel.insertAdjacentHTML("afterend", `
        <section class="admin-card" id="programming-admin-panel">
            <h2>Programación del Evento</h2>
            <p class="admin-muted">Crea agenda visual de actos (presentación, inauguración, etc.). Es independiente del horario de partidos.</p>

            <label for="programmingDateTime" class="field-label">Fecha y hora visible</label>
            <input id="programmingDateTime" type="text" placeholder="Lunes 11 agosto · 20:00">

            <label for="programmingTitle_es" class="field-label">Título ES</label>
            <input id="programmingTitle_es" type="text" placeholder="Presentación oficial del torneo">

            <label for="programmingSubtitle_es" class="field-label">Subtítulo ES (opcional)</label>
            <input id="programmingSubtitle_es" type="text" placeholder="Apertura y bienvenida institucional">

            <div class="results-actions">
                <button id="saveNewProgrammingItem" type="button">Añadir acto</button>
                <button id="saveProgrammingCollection" type="button" class="btn-secondary-admin">Guardar cambios</button>
                <button id="resetProgrammingCollection" type="button" class="btn-secondary-admin">Restaurar ejemplo</button>
            </div>

            <p id="programmingAdminStatus" class="admin-status" aria-live="polite"></p>

            <h3 class="gallery-admin-subtitle">Actos programados</h3>
            <div id="programmingAdminList" class="gallery-admin-list"></div>
        </section>
    `);
}

function ensureProgrammingAdminUi() {
    ensureProgrammingAdminMenuLink();
    ensureProgrammingAdminPanel();
}

function parseStorageJson(key, fallbackValue) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallbackValue;
        return JSON.parse(raw);
    } catch (error) {
        return fallbackValue;
    }
}

function countTotalDrawMatches() {
    const state = parseStorageJson(DRAW_BRACKET_KEY, null);
    if (!state?.rounds || !Array.isArray(state.rounds)) return 0;

    return state.rounds.reduce((sum, round) => {
        const matches = Array.isArray(round?.matches) ? round.matches.length : 0;
        return sum + matches;
    }, 0);
}

function countScheduledDrawMatches() {
    const state = parseStorageJson(DRAW_BRACKET_KEY, null);
    if (!state?.rounds || !Array.isArray(state.rounds)) return 0;

    let scheduled = 0;
    state.rounds.forEach((round) => {
        const matches = Array.isArray(round?.matches) ? round.matches : [];
        matches.forEach((match) => {
            if (String(match?.date || "").trim()) {
                scheduled += 1;
            }
        });
    });

    return scheduled;
}

function countResolvedDrawMatches() {
    const state = parseStorageJson(DRAW_BRACKET_KEY, null);
    if (!state?.rounds || !Array.isArray(state.rounds)) return 0;

    let resolved = 0;
    state.rounds.forEach((round) => {
        const matches = Array.isArray(round?.matches) ? round.matches : [];
        matches.forEach((match) => {
            if (getMatchWinner(match)) {
                resolved += 1;
            }
        });
    });

    return resolved;
}

function updateDashboardValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = String(value);
}

function getAdminErrorLog() {
    return parseStorageJson(ADMIN_ERROR_LOG_KEY, []);
}

function getRuntimeErrorLog() {
    return parseStorageJson(RUNTIME_ERROR_LOG_KEY, []);
}

function saveAdminErrorLog(entries) {
    try {
        localStorage.setItem(ADMIN_ERROR_LOG_KEY, JSON.stringify(entries));
    } catch (error) {
        // Si el navegador bloquea almacenamiento, el dashboard sigue funcionando.
    }
}

function recordAdminError(message, scope = "general") {
    const text = String(message || "").trim();
    if (!text) return;
    const entries = getAdminErrorLog();
    entries.unshift({
        id: createId("err"),
        scope: String(scope || "general"),
        message: text.slice(0, 400),
        createdAt: new Date().toISOString()
    });
    saveAdminErrorLog(entries.slice(0, 20));
}

function clearAdminErrors() {
    try {
        localStorage.removeItem(ADMIN_ERROR_LOG_KEY);
    } catch (error) {
        // Nada que hacer si no se puede limpiar.
    }
}

function buildAdminBackupPayload() {
    return {
        exportedAt: new Date().toISOString(),
        keys: {
            tournamentMode: parseStorageJson(TOURNAMENT_MODE_KEY, null),
            tournamentApiUrl: localStorage.getItem(TOURNAMENT_API_URL_KEY) || "",
            drawBracket: parseStorageJson(DRAW_BRACKET_KEY, null),
            liveStream: localStorage.getItem(LIVE_STREAM_URL_KEY) || "",
            liveHistory: parseStorageJson(LIVE_STREAM_HISTORY_KEY, []),
            galleries: parseStorageJson(GALLERY_COLLECTION_KEY, []),
            news: parseStorageJson(NEWS_COLLECTION_KEY, []),
            sponsors: parseStorageJson(SPONSORS_COLLECTION_KEY, []),
            players: parseStorageJson(PLAYERS_COLLECTION_KEY, []),
            tournamentManual: parseStorageJson(TOURNAMENT_MANUAL_CONTENT_KEY, null),
            heroSettings: parseStorageJson(HERO_SETTINGS_KEY, null),
            visitsFallback: parseStorageJson(VISITS_LOCAL_EVENTS_KEY, []),
            adminErrors: getAdminErrorLog(),
            publicErrors: getRuntimeErrorLog()
        }
    };
}

function downloadAdminBackup() {
    const payload = buildAdminBackupPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const fileName = `psa-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    if (window.PSAOptimizations?.downloadBlob) {
        window.PSAOptimizations.downloadBlob(fileName, blob);
        return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function buildErrorReportPayload() {
    const origin = window.location.origin;
    const basePath = window.location.pathname.includes("/valenciasquashopen/") ? "/valenciasquashopen" : "";
    const resourceChecks = [
        "data/config.json",
        "data/schedule.json",
        "data/draw-bracket.json",
        "data/translations/players.json",
        "data/translations/news.json",
        "config.js",
        "js/runtime-optimizations.js?v=20260803-1",
        "js/app.js?v=20260726-11"
    ];

    const checks = [];
    for (const path of resourceChecks) {
        const normalized = path.replace(/^\/+/, "");
        const url = `${origin}${basePath}/${normalized}`;
        try {
            const response = await fetch(url, { cache: "no-store" });
            checks.push({
                path: normalized,
                url,
                status: response.status,
                contentType: response.headers.get("content-type") || ""
            });
        } catch (error) {
            checks.push({
                path: normalized,
                url,
                status: null,
                error: String(error?.message || error || "network-error")
            });
        }
    }

    return {
        exportedAt: new Date().toISOString(),
        location: {
            href: window.location.href,
            origin: window.location.origin,
            pathname: window.location.pathname,
            userAgent: navigator.userAgent
        },
        adminErrors: getAdminErrorLog(),
        runtimeErrors: getRuntimeErrorLog(),
        resourceChecks: checks
    };
}

async function downloadAdminErrorReport() {
    const payload = await buildErrorReportPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const fileName = `psa-error-log-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;

    if (window.PSAOptimizations?.downloadBlob) {
        window.PSAOptimizations.downloadBlob(fileName, blob);
        return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

function clearOptimizationCaches() {
    const clearedFetchEntries = window.PSAOptimizations?.clearFetchCache?.() || 0;
    try {
        localStorage.removeItem(ADMIN_MEDIA_SIZE_CACHE_KEY);
    } catch (error) {
        // Ignorado.
    }
    return clearedFetchEntries;
}

function bindAdminErrorLogging() {
    if (adminErrorLoggingBound) return;

    window.addEventListener("error", (event) => {
        const message = event?.message || event?.error?.message || "Error desconocido en la interfaz";
        recordAdminError(message, "runtime");
    });

    window.addEventListener("unhandledrejection", (event) => {
        const reason = event?.reason;
        const message = reason?.message || String(reason || "Promesa rechazada sin capturar");
        recordAdminError(message, "promise");
    });

    adminErrorLoggingBound = true;
}

function formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (!Number.isFinite(value) || value <= 0) return "0 MB";
    const units = ["B", "KB", "MB", "GB"];
    let size = value;
    let index = 0;
    while (size >= 1024 && index < units.length - 1) {
        size /= 1024;
        index += 1;
    }
    return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDuration(seconds) {
    const value = Number(seconds || 0);
    if (!Number.isFinite(value) || value <= 0) return "0s";
    const rounded = Math.max(1, Math.round(value));
    const h = Math.floor(rounded / 3600);
    const m = Math.floor((rounded % 3600) / 60);
    const s = rounded % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

function formatUploadRate(bytesPerSecond) {
    const value = Number(bytesPerSecond || 0);
    if (!Number.isFinite(value) || value <= 0) return "0 B/s";
    return `${formatBytes(value)}/s`;
}

function estimateDataUrlBytes(dataUrl) {
    const raw = String(dataUrl || "");
    const commaIndex = raw.indexOf(",");
    if (!raw.startsWith("data:") || commaIndex === -1) return 0;
    const payload = raw.slice(commaIndex + 1);
    const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
    return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

function getMediaSizeCache() {
    return parseStorageJson(ADMIN_MEDIA_SIZE_CACHE_KEY, {});
}

function saveMediaSizeCache(cache) {
    try {
        localStorage.setItem(ADMIN_MEDIA_SIZE_CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
        // El dashboard puede recalcular si la caché no se puede persistir.
    }
}

function collectManagedMediaUrls({ galleries = [], news = [] } = {}) {
    const urls = [];
    galleries.forEach((gallery) => {
        (gallery?.photos || []).forEach((photo) => {
            if (photo?.src) urls.push(photo.src);
            if (photo?.processedSrc) urls.push(photo.processedSrc);
            if (photo?.sourceSrc) urls.push(photo.sourceSrc);
        });
    });
    news.forEach((item) => {
        if (item?.imageSrc) urls.push(item.imageSrc);
    });
    return Array.from(new Set(urls.filter(Boolean)));
}

async function resolveRemoteFileSize(url, cache) {
    const cached = cache[url];
    if (Number.isFinite(Number(cached))) return Number(cached);

    try {
        const response = await fetch(url, { method: "GET", cache: "force-cache" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const size = Number(blob.size || 0);
        cache[url] = size;
        return size;
    } catch (error) {
        recordAdminError(`No se pudo medir ${url}: ${error?.message || "error de red"}`, "storage");
        cache[url] = 0;
        return 0;
    }
}

async function estimateManagedStorageUsage(mediaUrls = []) {
    const cache = getMediaSizeCache();
    let totalBytes = 0;

    for (const url of mediaUrls) {
        if (String(url).startsWith("data:")) {
            totalBytes += estimateDataUrlBytes(url);
            continue;
        }
        totalBytes += await resolveRemoteFileSize(url, cache);
    }

    saveMediaSizeCache(cache);
    return totalBytes;
}

async function loadUserMetrics() {
    const client = window.AdminSupabase?.getClient?.();
    if (!client || isLocalDevMode()) {
        return {
            source: "local",
            total: 1,
            roles: {}
        };
    }

    try {
        const profilesReq = await client.from("profiles").select("id", { count: "exact", head: true });
        const rolesReq = await client.from("user_roles").select("role").limit(2000);

        if (profilesReq.error) throw profilesReq.error;
        if (rolesReq.error) throw rolesReq.error;

        const roles = {};
        (rolesReq.data || []).forEach((row) => {
            const role = String(row?.role || "user").trim() || "user";
            roles[role] = (roles[role] || 0) + 1;
        });

        return {
            source: "cloud",
            total: Number(profilesReq.count || 0),
            roles
        };
    } catch (error) {
        recordAdminError(error?.message || "No se pudieron cargar usuarios", "users");
        return {
            source: "fallback",
            total: 1,
            roles: {}
        };
    }
}

function computeGalleryProcessMetrics(galleries = [], news = []) {
    const photos = galleries.flatMap((gallery) => Array.isArray(gallery?.photos) ? gallery.photos : []);
    const totalPhotos = photos.length;
    const processedPhotos = photos.filter((photo) => !!(photo?.processedSrc || photo?.processedStoragePath)).length;
    const aiPending = photos.filter((photo) => !!photo?.storagePath && !(photo?.processedSrc || photo?.processedStoragePath)).length;
    const uploadQueue = Array.isArray(pendingGalleryPhotos) ? pendingGalleryPhotos.length : 0;
    const scheduledNews = (news || []).filter((item) => normalizeNewsStatus(item?.status) === "scheduled").length;

    return {
        totalPhotos,
        processedPhotos,
        aiPending,
        uploadQueue,
        scheduledNews,
        inFlight: aiPending + uploadQueue
    };
}

function renderDashboardChipList(id, entries = []) {
    const host = document.getElementById(id);
    if (!host) return;
    if (!entries.length) {
        host.innerHTML = '<span class="dashboard-chip">Sin datos</span>';
        return;
    }
    host.innerHTML = entries.map((entry) => `<span class="dashboard-chip">${entry}</span>`).join("");
}

function renderDashboardErrors(errors = []) {
    const host = document.getElementById("dashboardErrorsList");
    const summary = document.getElementById("dashboardErrorsSummary");
    if (!host || !summary) return;

    if (!errors.length) {
        summary.textContent = "No hay errores registrados.";
        host.innerHTML = "";
        return;
    }

    summary.textContent = `${errors.length} error(es) recientes registrados en esta administración.`;
    host.innerHTML = errors.map((item) => `
        <article class="dashboard-error-item">
            <strong>${item.scope || "general"}</strong>
            <span>${item.message || "Error sin mensaje"}</span>
            <span>${formatAdminDateTime(item.createdAt)}</span>
        </article>
    `).join("");
}

function getTodayStartIso() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
}

function computeTopPage(rows = []) {
    const pageMap = new Map();
    rows.forEach((row) => {
        const page = String(row?.page_path || "-").trim() || "-";
        pageMap.set(page, (pageMap.get(page) || 0) + 1);
    });

    let topPage = "-";
    let topHits = 0;
    for (const [page, hits] of pageMap.entries()) {
        if (hits > topHits) {
            topPage = page;
            topHits = hits;
        }
    }

    return topPage;
}

async function getCloudVisitMetrics() {
    const client = window.AdminSupabase?.getClient?.();
    if (!client) {
        return { ok: false, reason: "missing-client" };
    }

    const todayIso = getTodayStartIso();

    const totalReq = await client
        .from(VISITS_TABLE_NAME)
        .select("id", { count: "exact", head: true });

    if (totalReq.error) {
        return { ok: false, reason: totalReq.error.message };
    }

    const todayReq = await client
        .from(VISITS_TABLE_NAME)
        .select("session_id,page_path")
        .gte("visited_at", todayIso)
        .limit(5000);

    if (todayReq.error) {
        return { ok: false, reason: todayReq.error.message };
    }

    const todayRows = Array.isArray(todayReq.data) ? todayReq.data : [];
    const uniqueToday = new Set(
        todayRows
            .map((row) => String(row?.session_id || "").trim())
            .filter(Boolean)
    );

    return {
        ok: true,
        source: "cloud",
        totalVisits: Number(totalReq.count || 0),
        todayVisits: todayRows.length,
        uniqueToday: uniqueToday.size,
        topPage: computeTopPage(todayRows)
    };
}

function getLocalVisitMetrics() {
    const events = parseStorageJson(VISITS_LOCAL_EVENTS_KEY, []);
    const rows = Array.isArray(events) ? events : [];
    const todayIso = getTodayStartIso();
    const todayRows = rows.filter((row) => String(row?.visited_at || "") >= todayIso);

    const uniqueToday = new Set(
        todayRows
            .map((row) => String(row?.session_id || "").trim())
            .filter(Boolean)
    );

    return {
        ok: true,
        source: "local",
        totalVisits: rows.length,
        todayVisits: todayRows.length,
        uniqueToday: uniqueToday.size,
        topPage: computeTopPage(todayRows)
    };
}

async function loadVisitMetrics() {
    try {
        const cloud = await getCloudVisitMetrics();
        if (cloud.ok) return cloud;
    } catch (error) {
        recordAdminError(error?.message || "No se pudieron leer visitas cloud", "visits");
        // Si la tabla/policies no están listas en Supabase, usamos fallback local.
    }

    return getLocalVisitMetrics();
}

async function initAdminDashboard() {
    const host = document.getElementById("adminDashboardIntro");
    if (!host) return;

    const players = parseStorageJson(PLAYERS_COLLECTION_KEY, []);
    const sponsors = parseStorageJson(SPONSORS_COLLECTION_KEY, []);
    const news = parseStorageJson(NEWS_COLLECTION_KEY, []);
    const galleries = parseStorageJson(GALLERY_COLLECTION_KEY, []);
    const liveHistory = parseStorageJson(LIVE_STREAM_HISTORY_KEY, []);
    const tournamentMode = localStorage.getItem(TOURNAMENT_MODE_KEY) === "api" ? "API" : "Manual";

    const totalDrawMatches = countTotalDrawMatches();
    const scheduledDrawMatches = countScheduledDrawMatches();
    const resolvedDrawMatches = countResolvedDrawMatches();
    const processMetrics = computeGalleryProcessMetrics(galleries, news);
    const userMetrics = await loadUserMetrics();
    const mediaUrls = collectManagedMediaUrls({ galleries, news });
    const storageBytes = await estimateManagedStorageUsage(mediaUrls);
    const errorLog = getAdminErrorLog();
    const publicErrorLog = getRuntimeErrorLog();
    const mergedErrors = errorLog.concat(publicErrorLog)
        .sort((a, b) => (Date.parse(b?.createdAt || "") || 0) - (Date.parse(a?.createdAt || "") || 0))
        .slice(0, 20);

    updateDashboardValue("dashboardPlayersCount", Array.isArray(players) ? players.length : 0);
    updateDashboardValue("dashboardSponsorsCount", Array.isArray(sponsors) ? sponsors.length : 0);
    updateDashboardValue("dashboardNewsCount", Array.isArray(news) ? news.length : 0);
    updateDashboardValue("dashboardGalleriesCount", Array.isArray(galleries) ? galleries.length : 0);
    updateDashboardValue("dashboardLiveHistoryCount", Array.isArray(liveHistory) ? liveHistory.length : 0);
    updateDashboardValue("dashboardTournamentMode", tournamentMode);
    updateDashboardValue("dashboardDrawScheduled", `${scheduledDrawMatches}/${totalDrawMatches || 0}`);
    updateDashboardValue("dashboardDrawResolved", `${resolvedDrawMatches}/${totalDrawMatches || 0}`);
    updateDashboardValue("dashboardPhotosCount", processMetrics.totalPhotos);
    updateDashboardValue("dashboardPhotosProcessed", processMetrics.processedPhotos);
    updateDashboardValue("dashboardStorageUsed", formatBytes(storageBytes));
    updateDashboardValue("dashboardUsersCount", userMetrics.total || 0);
    updateDashboardValue("dashboardProcessesCount", processMetrics.inFlight);
    updateDashboardValue("dashboardErrorsCount", mergedErrors.length);

    const visitMetrics = await loadVisitMetrics();
    updateDashboardValue("dashboardVisitsTotal", visitMetrics.totalVisits || 0);
    updateDashboardValue("dashboardVisitsToday", visitMetrics.todayVisits || 0);
    updateDashboardValue("dashboardVisitsUniqueToday", visitMetrics.uniqueToday || 0);
    updateDashboardValue("dashboardVisitsTopPage", visitMetrics.topPage || "-");
    updateDashboardValue(
        "dashboardVisitsSource",
        visitMetrics.source === "cloud" ? "Supabase" : "Local (fallback)"
    );

    const roleEntries = Object.entries(userMetrics.roles || {}).map(([role, count]) => `${role}: ${count}`);
    renderDashboardChipList("dashboardRolesBreakdown", roleEntries);
    const mediaEntries = [
        `Fotos: ${processMetrics.totalPhotos}`,
        `IA: ${processMetrics.processedPhotos}`,
        `Pendientes IA: ${processMetrics.aiPending}`,
        `Subidas en cola: ${processMetrics.uploadQueue}`,
        `Noticias programadas: ${processMetrics.scheduledNews}`
    ];
    renderDashboardChipList("dashboardMediaBreakdown", mediaEntries);
    const statsEntries = [
        `Visitas hoy: ${visitMetrics.todayVisits || 0}`,
        `Usuarios únicos hoy: ${visitMetrics.uniqueToday || 0}`,
        `Top hoy: ${visitMetrics.topPage || "-"}`,
        `Horarios: ${scheduledDrawMatches}/${totalDrawMatches || 0}`,
        `Resultados: ${resolvedDrawMatches}/${totalDrawMatches || 0}`
    ];
    renderDashboardChipList("dashboardStatsBreakdown", statsEntries);

    const usersSummary = document.getElementById("dashboardUsersSummary");
    if (usersSummary) {
        usersSummary.textContent = `${userMetrics.total || 0} usuario(s) cargados desde ${userMetrics.source === "cloud" ? "Supabase" : "fallback local"}.`;
    }
    const processSummary = document.getElementById("dashboardProcessesSummary");
    if (processSummary) {
        processSummary.textContent = processMetrics.inFlight > 0
            ? `${processMetrics.inFlight} proceso(s) activos entre IA pendiente y cola de subida.`
            : "No hay procesos activos en este momento.";
    }
    const statsSummary = document.getElementById("dashboardStatsSummary");
    if (statsSummary) {
        statsSummary.textContent = `Espacio dinámico estimado: ${formatBytes(storageBytes)} en ${mediaUrls.length} recurso(s) gestionados.`;
    }

    renderDashboardErrors(mergedErrors);

    const clearErrorsBtn = document.getElementById("dashboardClearErrors");
    if (clearErrorsBtn && !clearErrorsBtn.dataset.bound) {
        clearErrorsBtn.addEventListener("click", () => {
            clearAdminErrors();
            updateDashboardValue("dashboardErrorsCount", 0);
            renderDashboardErrors([]);
        });
        clearErrorsBtn.dataset.bound = "1";
    }

    const downloadBackupBtn = document.getElementById("dashboardDownloadBackup");
    if (downloadBackupBtn && !downloadBackupBtn.dataset.bound) {
        downloadBackupBtn.addEventListener("click", () => {
            downloadAdminBackup();
        });
        downloadBackupBtn.dataset.bound = "1";
    }

    const downloadErrorLogBtn = document.getElementById("dashboardDownloadErrorLog");
    if (downloadErrorLogBtn && !downloadErrorLogBtn.dataset.bound) {
        downloadErrorLogBtn.addEventListener("click", async () => {
            const statsSummary = document.getElementById("dashboardStatsSummary");
            try {
                await downloadAdminErrorReport();
                if (statsSummary) {
                    statsSummary.textContent = "Registro de errores descargado correctamente.";
                }
            } catch (error) {
                recordAdminError(error?.message || "No se pudo descargar el registro de errores", "dashboard");
                if (statsSummary) {
                    statsSummary.textContent = "Error descargando registro. Revisa consola o vuelve a intentar.";
                }
            }
        });
        downloadErrorLogBtn.dataset.bound = "1";
    }

    const clearCachesBtn = document.getElementById("dashboardClearCaches");
    if (clearCachesBtn && !clearCachesBtn.dataset.bound) {
        clearCachesBtn.addEventListener("click", () => {
            const clearedEntries = clearOptimizationCaches();
            const statsSummary = document.getElementById("dashboardStatsSummary");
            if (statsSummary) {
                statsSummary.textContent = `Caché limpiada: ${clearedEntries} entrada(s) de datos temporales eliminadas.`;
            }
        });
        clearCachesBtn.dataset.bound = "1";
    }

    const clearPublicErrorsBtn = document.getElementById("dashboardClearPublicErrors");
    if (clearPublicErrorsBtn && !clearPublicErrorsBtn.dataset.bound) {
        clearPublicErrorsBtn.addEventListener("click", () => {
            window.PSAOptimizations?.clearErrorLog?.();
            updateDashboardValue("dashboardErrorsCount", getAdminErrorLog().length);
            renderDashboardErrors(getAdminErrorLog());
        });
        clearPublicErrorsBtn.dataset.bound = "1";
    }

    const quickActions = host.querySelectorAll("[data-dashboard-target]");
    quickActions.forEach((button) => {
        button.addEventListener("click", () => {
            const target = String(button.getAttribute("data-dashboard-target") || "").trim();
            if (!target) return;

            if (ADMIN_MULTI_PAGE_MODE) {
                const page = ADMIN_SECTION_TO_PAGE[target] || "admin-dashboard.html";
                window.location.href = page;
                return;
            }

            const nextHash = target === "dashboard" ? "#dashboard" : `#${target}`;
            window.location.hash = nextHash;
        });
    });
}

function showAdminSection(sectionId) {
    const dashboardIntro = document.getElementById("adminDashboardIntro");
    const allSections = document.querySelectorAll("main.content .admin-card");

    if (sectionId === "dashboard") {
        if (dashboardIntro) dashboardIntro.classList.remove("is-hidden");
        allSections.forEach((section) => {
            section.classList.remove("is-view-visible");
        });
        updateAdminMenuActiveState("dashboard");
        return;
    }

    if (dashboardIntro) dashboardIntro.classList.add("is-hidden");

    allSections.forEach((section) => {
        const shouldShow = section.id === sectionId;
        section.classList.toggle("is-view-visible", shouldShow);
    });

    updateAdminMenuActiveState(sectionId);
}

function applyAdminViewFromHash() {
    const section = getSectionFromHash();
    showAdminSection(section);
}

function bindAdminSectionView() {
    if (adminSectionViewBound) return;

    configureAdminMenuLinks();

    const menuLinks = document.querySelectorAll(".sidebar nav a[data-section]");

    if (ADMIN_MULTI_PAGE_MODE) {
        adminSectionViewBound = true;
        applyAdminViewFromHash();
        return;
    }

    menuLinks.forEach((link) => {
        link.addEventListener("click", (event) => {
            const href = String(link.getAttribute("href") || "").trim();
            if (!href.startsWith("#")) return;

            event.preventDefault();
            const target = href.replace(/^#/, "").trim() || "dashboard";
            const nextHash = target === "dashboard" ? "#dashboard" : `#${target}`;

            if (window.location.hash !== nextHash) {
                window.location.hash = nextHash;
            } else {
                applyAdminViewFromHash();
            }
        });
    });

    window.addEventListener("hashchange", applyAdminViewFromHash);
    adminSectionViewBound = true;
    applyAdminViewFromHash();
}

function installCloudStorageAutosync() {
    if (storageCloudPatchInstalled) return;

    const cloud = window.PSACloudStore;
    if (!cloud?.isReady?.()) return;

    const syncKeys = new Set(CLOUD_SYNC_KEYS);
    const originalSetItem = localStorage.setItem.bind(localStorage);
    const originalRemoveItem = localStorage.removeItem.bind(localStorage);

    localStorage.setItem = function patchedSetItem(key, value) {
        originalSetItem(key, value);

        if (syncKeys.has(key)) {
            cloud.saveLocalStorageKeyToCloud(key).catch(() => {
                // No interrumpimos UX de admin si la nube falla.
            });
        }
    };

    localStorage.removeItem = function patchedRemoveItem(key) {
        originalRemoveItem(key);

        if (syncKeys.has(key)) {
            cloud.removeLocalStorageKeyFromCloud(key).catch(() => {
                // No interrumpimos UX de admin si la nube falla.
            });
        }
    };

    storageCloudPatchInstalled = true;
}

async function hydrateAdminStateFromCloud() {
    const cloud = window.PSACloudStore;
    if (!cloud?.isReady?.()) return;

    await cloud.syncLocalStorageFromCloud(CLOUD_SYNC_KEYS);
}

function setAdminAuthStatus(message, isError = false) {
    const status = document.getElementById("adminAuthStatus");
    if (!status) return;
    status.textContent = message;
    status.style.color = isError ? "#ff8f8f" : "#93E4A2";
}

function showAdminApp() {
    const authSection = document.getElementById("admin-auth");
    const app = document.getElementById("adminApp");
    if (authSection) {
        authSection.hidden = true;
        authSection.style.display = "none";
    }
    if (app) {
        app.hidden = false;
        app.style.display = "grid";
    }
}

function showAuthScreen() {
    const authSection = document.getElementById("admin-auth");
    const app = document.getElementById("adminApp");
    if (authSection) {
        authSection.hidden = false;
        authSection.style.display = "grid";
    }
    if (app) {
        app.hidden = true;
        app.style.display = "none";
    }
}

async function startAdminModulesOnce() {
    if (adminModulesStarted) return;
    if (adminStartPromise) return adminStartPromise;

    adminStartPromise = (async () => {
        bindAdminErrorLogging();
        ensureProgrammingAdminUi();
        bindAdminSectionView();

        if (window.PSACloudStore?.isReady?.()) {
            await hydrateAdminStateFromCloud();
            installCloudStorageAutosync();
        }

        adminModulesStarted = true;

        const safeRun = async (runner) => {
            try {
                await runner();
            } catch (error) {
                console.error("Error iniciando módulo admin:", error);
                recordAdminError(error?.message || "Error iniciando módulo admin", "startup");
            }
        };

        await safeRun(async () => loadTournamentSettings());
        await safeRun(async () => bindTournamentSettings());
        await safeRun(async () => initAdminDashboard());
        await safeRun(async () => initHeroAdmin());
        await safeRun(async () => initTournamentManualAdmin());
        await safeRun(async () => loadLiveSettings());
        await safeRun(async () => bindLiveSettings());
        await safeRun(async () => initPlayersAdmin());
        await safeRun(async () => initSponsorsAdmin());
        await safeRun(async () => initNewsAdmin());
        await safeRun(async () => initGalleryAdmin());
        await safeRun(async () => initProgrammingAdmin());
        await safeRun(async () => initDrawAdmin());
    })();

    return adminStartPromise;
}

async function isAuthorizedStaff(supabaseClient) {
    if (!supabaseClient) return false;

    const { data, error } = await supabaseClient.rpc("is_staff");
    return !error && data === true;
}

async function initAdminAuth() {
    const loginBtn = document.getElementById("adminLoginBtn");
    const emailInput = document.getElementById("adminEmail");
    const passwordInput = document.getElementById("adminPassword");
    const logoutBtn = document.getElementById("adminLogoutBtn");

    const supabaseClient = window.AdminSupabase?.getClient?.();

    if (isLocalDevMode()) {
        showAdminApp();
        setAdminAuthStatus("Modo local activo: sin login cloud.");
        await startAdminModulesOnce();
        return;
    }

    if (!supabaseClient) {
        showAuthScreen();
        setAdminAuthStatus("Configura Supabase en supabase.js (URL y anon key).", true);
        return;
    }

    if (loginBtn) {
        loginBtn.addEventListener("click", async () => {
            const email = (emailInput?.value || "").trim();
            const password = passwordInput?.value || "";

            if (!email || !password) {
                setAdminAuthStatus("Introduce email y contraseña.", true);
                return;
            }

            loginBtn.disabled = true;
            setAdminAuthStatus("Verificando acceso...");

            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

            loginBtn.disabled = false;
            if (error) {
                setAdminAuthStatus(`No se pudo iniciar sesión: ${error.message}`, true);
                return;
            }

            setAdminAuthStatus("Acceso correcto.");

            // Abrir panel inmediatamente tras login correcto.
            if (data?.session && await isAuthorizedStaff(supabaseClient)) {
                showAdminApp();
                await startAdminModulesOnce();
                return;
            }

            // Fallback por si la sesión tarda en hidratarse en el cliente.
            const fallback = await supabaseClient.auth.getSession();
            if (fallback?.data?.session && await isAuthorizedStaff(supabaseClient)) {
                showAdminApp();
                await startAdminModulesOnce();
            } else {
                setAdminAuthStatus("Acceso correcto, pero no se pudo abrir el panel. Recarga la página.", true);
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", async (event) => {
            event.preventDefault();
            const { error } = await supabaseClient.auth.signOut();
            if (!error) {
                window.location.href = "index.html";
                return;
            }

            setAdminAuthStatus(`No se pudo cerrar sesión: ${error.message}`, true);
        });
    }

    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
        if (session && await isAuthorizedStaff(supabaseClient)) {
            showAdminApp();
            await startAdminModulesOnce();
        } else {
            // Evita falsos negativos por eventos transitorios: verificamos sesión real.
            const fallback = await supabaseClient.auth.getSession();
            if (fallback?.data?.session && await isAuthorizedStaff(supabaseClient)) {
                showAdminApp();
                await startAdminModulesOnce();
                return;
            }

            showAuthScreen();
        }
    });

    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
        showAuthScreen();
        setAdminAuthStatus(`Error de sesión: ${error.message}`, true);
        return;
    }

    if (data?.session && await isAuthorizedStaff(supabaseClient)) {
        showAdminApp();
        await startAdminModulesOnce();
    } else {
        showAuthScreen();
        setAdminAuthStatus("Inicia sesión para entrar al panel.");
    }
}

function getSavedTournamentMode() {
    const mode = localStorage.getItem(TOURNAMENT_MODE_KEY);
    return mode === "manual" ? "manual" : "api";
}

function setStatus(message) {
    const status = document.getElementById("adminStatus");
    if (!status) return;
    status.textContent = message;
}

function loadTournamentSettings() {
    const mode = getSavedTournamentMode();
    const apiUrl = localStorage.getItem(TOURNAMENT_API_URL_KEY) || "";
    const psaId = localStorage.getItem(PSA_TOURNAMENT_ID_KEY) || (window.PSA_CONFIG?.psaTournamentId || "12711");
    const psaToken = localStorage.getItem(PSA_API_KEY_KEY) || (window.PSA_CONFIG?.psaApiKey || "854800fc3a4b365e531b39594fd3aed7eb2f42a573887d5f");
    const igWidgetCode = localStorage.getItem(INSTAGRAM_WIDGET_KEY) || "";

    const selectedInput = document.querySelector(
        `input[name="tournamentMode"][value="${mode}"]`
    );

    if (selectedInput) selectedInput.checked = true;

    const urlInput = document.getElementById("tournamentApiUrl");
    if (urlInput) {
        urlInput.value = apiUrl;
        urlInput.disabled = mode !== "api";
    }

    const idInput = document.getElementById("tournamentPsaId");
    if (idInput) {
        idInput.value = psaId;
        idInput.disabled = mode !== "api";
    }

    const tokenInput = document.getElementById("tournamentPsaToken");
    if (tokenInput) {
        tokenInput.value = psaToken;
        tokenInput.disabled = mode !== "api";
    }

    const igWidgetInput = document.getElementById("instagramWidgetCode");
    if (igWidgetInput) {
        igWidgetInput.value = igWidgetCode;
    }

    const configGroup = document.getElementById("tournamentApiConfigGroup");
    if (configGroup) {
        configGroup.style.display = mode === "api" ? "block" : "none";
    }
}

async function saveTournamentSettings() {
    const checked = document.querySelector("input[name='tournamentMode']:checked");
    const mode = checked ? checked.value : "api";
    const urlInput = document.getElementById("tournamentApiUrl");
    const apiUrl = (urlInput?.value || "").trim();
    const idInput = document.getElementById("tournamentPsaId");
    const psaId = (idInput?.value || "").trim();
    const tokenInput = document.getElementById("tournamentPsaToken");
    const psaToken = (tokenInput?.value || "").trim();
    const igWidgetInput = document.getElementById("instagramWidgetCode");
    const igWidgetCode = (igWidgetInput?.value || "").trim();

    localStorage.setItem(TOURNAMENT_MODE_KEY, mode);

    if (apiUrl) {
        localStorage.setItem(TOURNAMENT_API_URL_KEY, apiUrl);
    } else {
        localStorage.removeItem(TOURNAMENT_API_URL_KEY);
    }

    if (psaId) {
        localStorage.setItem(PSA_TOURNAMENT_ID_KEY, psaId);
    } else {
        localStorage.removeItem(PSA_TOURNAMENT_ID_KEY);
    }

    if (psaToken) {
        localStorage.setItem(PSA_API_KEY_KEY, psaToken);
    } else {
        localStorage.removeItem(PSA_API_KEY_KEY);
    }

    if (igWidgetCode) {
        localStorage.setItem(INSTAGRAM_WIDGET_KEY, igWidgetCode);
    } else {
        localStorage.removeItem(INSTAGRAM_WIDGET_KEY);
    }

    if (window.PSACloudStore?.saveLocalStorageKeyToCloud) {
        await window.PSACloudStore.saveLocalStorageKeyToCloud(TOURNAMENT_MODE_KEY);
        await window.PSACloudStore.saveLocalStorageKeyToCloud(TOURNAMENT_API_URL_KEY);
        await window.PSACloudStore.saveLocalStorageKeyToCloud(PSA_TOURNAMENT_ID_KEY);
        await window.PSACloudStore.saveLocalStorageKeyToCloud(PSA_API_KEY_KEY);
        await window.PSACloudStore.saveLocalStorageKeyToCloud(INSTAGRAM_WIDGET_KEY);
    }

    setStatus(
        mode === "api"
            ? `Guardado: modo API activado (ID: ${psaId || "12711"}).`
            : "Guardado: modo manual (sin livescore) activado."
    );
}

async function fetchPsaTournamentsList() {
    const select = document.getElementById("psaTournamentSelect");
    if (!select) return;

    select.innerHTML = '<option value="">⏳ Cargando lista de torneos PSA...</option>';

    try {
        const proxyUrl = "https://texjzaanugmssmolzwgb.supabase.co/functions/v1/psa-proxy?show_past=true&limit=50";
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error("HTTP " + response.status);

        const payload = await response.json();
        const items = Array.isArray(payload?.tournaments) ? payload.tournaments : (Array.isArray(payload) ? payload : []);

        const currentPsaId = (document.getElementById("tournamentPsaId")?.value || "").trim();

        let html = '<option value="">-- Seleccionar torneo oficial de la PSA --</option>';
        html += `<option value="12711" ${currentPsaId === "12711" ? "selected" : ""}>12711 - PSA Valencia Open 2026</option>`;

        items.forEach((item) => {
            const id = String(item.id || item.slug || "").trim();
            if (!id || id === "12711") return;
            const name = item.name || item.title || "Torneo PSA";
            const dates = item.dates || item.start_date || "";
            const isSel = id === currentPsaId ? "selected" : "";
            html += `<option value="${id}" ${isSel}>${id} - ${escapeHtml(name)} ${dates ? "(" + escapeHtml(dates) + ")" : ""}</option>`;
        });

        select.innerHTML = html;
    } catch (err) {
        console.warn("No se pudo cargar el listado automático de torneos PSA:", err);
        select.innerHTML = `
            <option value="">-- Escribe el ID del torneo manualmente abajo --</option>
            <option value="12711">12711 - PSA Valencia Open 2026</option>
        `;
    }
}

function bindPsaTournamentSelector() {
    const select = document.getElementById("psaTournamentSelect");
    if (select) {
        select.addEventListener("change", (e) => {
            const chosenId = (e.target.value || "").trim();
            if (chosenId) {
                const idInput = document.getElementById("tournamentPsaId");
                if (idInput) {
                    idInput.value = chosenId;
                }
            }
        });
    }

    const btn = document.getElementById("fetchPsaTournamentsBtn");
    if (btn) {
        btn.addEventListener("click", () => {
            fetchPsaTournamentsList();
        });
    }
}

function bindTournamentSettings() {
    document.querySelectorAll("input[name='tournamentMode']").forEach((input) => {
        input.addEventListener("change", () => {
            const isApi = input.value === "api" && input.checked;
            const configGroup = document.getElementById("tournamentApiConfigGroup");
            if (configGroup) {
                configGroup.style.display = isApi ? "block" : "none";
            }
            const urlInput = document.getElementById("tournamentApiUrl");
            if (urlInput) urlInput.disabled = !isApi;
            const idInput = document.getElementById("tournamentPsaId");
            if (idInput) idInput.disabled = !isApi;
            const tokenInput = document.getElementById("tournamentPsaToken");
            if (tokenInput) tokenInput.disabled = !isApi;
        });
    });

    const saveButton = document.getElementById("saveTournamentSettings");
    if (saveButton) {
        saveButton.addEventListener("click", saveTournamentSettings);
    }

    bindPsaTournamentSelector();
}

function updateLiveStatus(message) {
    const el = document.getElementById("liveAdminStatus");
    if (!el) return;
    el.textContent = message;
}

function loadLiveSettings() {
    const titleInput = document.getElementById("liveStreamTitle");
    const input = document.getElementById("liveYoutubeUrl");
    if (!input) return;
    const history = readLiveHistory();
    const latest = history.length > 0 ? history[history.length - 1] : null;
    input.value = latest?.url || (localStorage.getItem(LIVE_STREAM_URL_KEY) || "");
    if (titleInput) {
        titleInput.value = latest?.title || "";
    }
    renderLiveHistoryInfo(history);
    renderLiveHistoryAdminList(history);
}

function renderLiveHistoryInfo(history = readLiveHistory()) {
    const info = document.getElementById("liveHistoryInfo");
    if (!info) return;

    if (!history.length) {
        info.textContent = "Historial de directos: 0";
        return;
    }

    info.textContent = `Historial de directos: ${history.length} (actual: 1, miniaturas: ${Math.max(0, history.length - 1)})`;
}

function persistLiveHistory(history) {
    const normalized = Array.isArray(history)
        ? history.filter((item) => item && typeof item === "object" && String(item.url || "").trim())
        : [];

    if (normalized.length === 0) {
        localStorage.removeItem(LIVE_STREAM_URL_KEY);
        localStorage.removeItem(LIVE_STREAM_HISTORY_KEY);
        if (window.PSACloudStore?.saveLocalStorageKeyToCloud) {
            window.PSACloudStore.saveLocalStorageKeyToCloud(LIVE_STREAM_URL_KEY);
        }
        window.PSAOptimizations?.clearFetchCache?.();
        return;
    }

    const latest = normalized[normalized.length - 1];
    const latestUrl = String(latest.url || "").trim();
    localStorage.setItem(LIVE_STREAM_URL_KEY, latestUrl);
    localStorage.setItem(LIVE_STREAM_HISTORY_KEY, JSON.stringify(normalized));

    if (window.PSACloudStore?.saveLocalStorageKeyToCloud) {
        window.PSACloudStore.saveLocalStorageKeyToCloud(LIVE_STREAM_URL_KEY);
    }
    window.PSAOptimizations?.clearFetchCache?.();
}

function renderLiveHistoryAdminList(history = readLiveHistory()) {
    const host = document.getElementById("liveHistoryAdminList");
    if (!host) return;

    if (!history.length) {
        host.innerHTML = "";
        return;
    }

    host.innerHTML = history.map((item, index) => {
        const title = escapeHtml(item.title || `Directo ${index + 1}`);
        const url = escapeHtml(item.url || "");
        const badge = index === history.length - 1 ? " (actual)" : "";
        return `
            <div class="live-history-admin-item">
                <div class="live-history-admin-text">
                    <div class="live-history-admin-title">${title}${badge}</div>
                    <div class="live-history-admin-url">${url}</div>
                </div>
                <button type="button" class="btn-live-delete-one" data-live-remove-index="${index}">Borrar</button>
            </div>
        `;
    }).join("");

    host.querySelectorAll("[data-live-remove-index]").forEach((button) => {
        button.addEventListener("click", () => {
            const idx = Number(button.getAttribute("data-live-remove-index"));
            if (!Number.isInteger(idx) || idx < 0) return;

            const current = readLiveHistory();
            if (idx >= current.length) return;

            current.splice(idx, 1);
            persistLiveHistory(current);

            const titleInput = document.getElementById("liveStreamTitle");
            const urlInput = document.getElementById("liveYoutubeUrl");
            const latest = current.length ? current[current.length - 1] : null;

            if (titleInput) titleInput.value = latest?.title || "";
            if (urlInput) urlInput.value = latest?.url || "";

            renderLiveHistoryInfo(current);
            renderLiveHistoryAdminList(current);
            updateLiveStatus("Directo eliminado del historial.");
        });
    });
}

function readLiveHistory() {
    try {
        const raw = localStorage.getItem(LIVE_STREAM_HISTORY_KEY);
        const current = (localStorage.getItem(LIVE_STREAM_URL_KEY) || "").trim();

        if (!raw) {
            return current
                ? [{ url: current, title: "Directo", createdAt: new Date().toISOString() }]
                : [];
        }

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return current
                ? [{ url: current, title: "Directo", createdAt: new Date().toISOString() }]
                : [];
        }

        const cleaned = parsed
            .map((item) => {
                if (typeof item === "string") {
                    const url = item.trim();
                    return url ? { url, title: "Directo", createdAt: new Date().toISOString() } : null;
                }

                if (item && typeof item === "object") {
                    const url = String(item.url || "").trim();
                    if (!url) return null;
                    return {
                        url,
                        title: String(item.title || "Directo").trim() || "Directo",
                        createdAt: item.createdAt || new Date().toISOString()
                    };
                }

                return null;
            })
            .filter(Boolean);

        if (cleaned.length === 0 && current) {
            return [{ url: current, title: "Directo", createdAt: new Date().toISOString() }];
        }

        return cleaned;
    } catch (error) {
        const current = (localStorage.getItem(LIVE_STREAM_URL_KEY) || "").trim();
        return current
            ? [{ url: current, title: "Directo", createdAt: new Date().toISOString() }]
            : [];
    }
}

async function fetchYouTubeTitle(videoUrl) {
    try {
        const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;
        const response = await fetch(endpoint);
        if (!response.ok) return "";

        const payload = await response.json();
        return String(payload?.title || "").trim();
    } catch (error) {
        return "";
    }
}

function extractYouTubeVideoId(url) {
    if (!url) return "";

    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

        if (host === "youtu.be") {
            return parsed.pathname.split("/").filter(Boolean)[0] || "";
        }

        if (host.endsWith("youtube.com")) {
            if (parsed.searchParams.get("v")) {
                return parsed.searchParams.get("v") || "";
            }

            const pathParts = parsed.pathname.split("/").filter(Boolean);
            const marker = pathParts[0];
            if (["embed", "shorts", "live"].includes(marker) && pathParts[1]) {
                return pathParts[1];
            }
        }
    } catch (error) {
        return "";
    }

    return "";
}

async function saveLiveSettings() {
    const titleInput = document.getElementById("liveStreamTitle");
    const input = document.getElementById("liveYoutubeUrl");
    if (!input) return;

    const value = (input.value || "").trim();

    if (!value) {
        localStorage.removeItem(LIVE_STREAM_URL_KEY);
        localStorage.removeItem(LIVE_STREAM_HISTORY_KEY);
        updateLiveStatus("Enlace eliminado. Se mostrara el placeholder en LIVE.");
        return;
    }

    const isYouTubeLink = /(?:youtube\.com|youtu\.be)/i.test(value);
    if (!isYouTubeLink) {
        updateLiveStatus("URL no valida: usa un enlace de YouTube.");
        return;
    }

    const fetchedTitle = await fetchYouTubeTitle(value);
    const videoId = extractYouTubeVideoId(value);
    const title = fetchedTitle || (videoId ? `Directo ${videoId}` : "Directo");
    if (titleInput) titleInput.value = title;

    const history = readLiveHistory();
    const last = history[history.length - 1] || null;
    if (!last || value !== last.url) {
        history.push({
            url: value,
            title,
            createdAt: new Date().toISOString()
        });
    } else {
        last.title = title;
    }

    persistLiveHistory(history);
    updateLiveStatus(`Enlace guardado. Historial de directos: ${history.length}.`);
    renderLiveHistoryInfo(history);
    renderLiveHistoryAdminList(history);
}

function bindLiveSettings() {
    const saveButton = document.getElementById("saveLiveSettings");
    const clearButton = document.getElementById("clearLiveHistory");

    if (saveButton) {
        saveButton.addEventListener("click", saveLiveSettings);
    }

    if (clearButton) {
        clearButton.addEventListener("click", () => {
            localStorage.removeItem(LIVE_STREAM_URL_KEY);
            localStorage.removeItem(LIVE_STREAM_HISTORY_KEY);

            const titleInput = document.getElementById("liveStreamTitle");
            const input = document.getElementById("liveYoutubeUrl");
            if (titleInput) titleInput.value = "";
            if (input) input.value = "";

            updateLiveStatus("Directo e historial borrados. Ya puedes hacer pruebas desde cero.");
            renderLiveHistoryInfo([]);
            renderLiveHistoryAdminList([]);
        });
    }
}

function updateGalleryStatus(message) {
    const el = document.getElementById("galleryAdminStatus");
    if (!el) return;
    el.textContent = message;
}

function updateNewsStatus(message) {
    const el = document.getElementById("newsAdminStatus");
    if (!el) return;
    el.textContent = message;
}

function createId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function extractStringFromLocalized(val) {
    if (val === null || val === undefined) return "";
    if (typeof val === "string") {
        const trimmed = val.trim();
        if (trimmed.startsWith("{")) {
            try {
                const parsed = JSON.parse(trimmed);
                if (parsed && typeof parsed === "object") {
                    return extractStringFromLocalized(parsed);
                }
            } catch (e) {}
        }
        return val;
    }
    if (typeof val === "number" || typeof val === "boolean") return String(val);
    if (typeof val === "object") {
        if (typeof val.es === "string") return val.es;
        if (typeof val.va === "string") return val.va;
        if (typeof val.en === "string") return val.en;
        if (typeof val.fr === "string") return val.fr;
        for (const k in val) {
            if (typeof val[k] === "string") return val[k];
            if (typeof val[k] === "object" && val[k] !== null) {
                const sub = extractStringFromLocalized(val[k]);
                if (sub) return sub;
            }
        }
    }
    return "";
}

function normalizeLocalizedText(value) {
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.startsWith("{")) {
            try {
                const parsed = JSON.parse(trimmed);
                if (parsed && typeof parsed === "object") {
                    value = parsed;
                }
            } catch (e) {}
        }
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
        const esStr = extractStringFromLocalized(value.es);
        const vaStr = extractStringFromLocalized(value.va);
        const enStr = extractStringFromLocalized(value.en);
        const frStr = extractStringFromLocalized(value.fr);
        const base = esStr || vaStr || enStr || frStr || "";

        return {
            es: esStr || base,
            va: vaStr || base,
            en: enStr || base,
            fr: frStr || base
        };
    }

    const text = extractStringFromLocalized(value);
    return { es: text, va: text, en: text, fr: text };
}

function localizedInputValue(prefix, lang) {
    const input = document.getElementById(`${prefix}_${lang}`);
    return (input?.value || "").trim();
}

function getLocalizedFromInputs(prefix) {
    return {
        es: localizedInputValue(prefix, "es"),
        va: localizedInputValue(prefix, "va"),
        en: localizedInputValue(prefix, "en"),
        fr: localizedInputValue(prefix, "fr")
    };
}

function clearLocalizedInputs(prefix) {
    LANGS.forEach((lang) => {
        const input = document.getElementById(`${prefix}_${lang}`);
        if (input) input.value = "";
    });
}

function hasAllLanguages(localizedMap) {
    return LANGS.every((lang) => String(localizedMap?.[lang] || "").trim().length > 0);
}

async function translateFromSpanish(text, targetLang) {
    const source = String(text || "").trim();
    if (!source) return "";
    if (targetLang === "es") return source;

    const langMap = { va: "ca", en: "en", fr: "fr" };
    const target = langMap[targetLang] || targetLang;

    try {
        const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=es&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(source)}`;
        const googleResponse = await fetch(googleUrl, { cache: "no-store" });
        if (googleResponse.ok) {
            const payload = await googleResponse.json();
            const translated = Array.isArray(payload?.[0])
                ? payload[0].map((part) => String(part?.[0] || "")).join("").trim()
                : "";
            if (translated) return translated;
        }
    } catch (error) {
        // Intentamos fallback si este proveedor falla.
    }

    try {
        const memoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(source)}&langpair=es|${encodeURIComponent(target)}`;
        const memoryResponse = await fetch(memoryUrl, { cache: "no-store" });
        if (!memoryResponse.ok) return source;

        const payload = await memoryResponse.json();
        const translated = decodeHtmlEntities(String(payload?.responseData?.translatedText || "").trim());
        return translated || source;
    } catch (error) {
        return source;
    }
}

function decodeHtmlEntities(value) {
    const parser = document.createElement("textarea");
    parser.innerHTML = String(value || "");
    return parser.value;
}

async function buildLocalizedFromSpanish(sourceText) {
    const es = String(sourceText || "").trim();
    if (!es) {
        return { es: "", va: "", en: "", fr: "" };
    }

    const [va, en, fr] = await Promise.all([
        translateFromSpanish(es, "va"),
        translateFromSpanish(es, "en"),
        translateFromSpanish(es, "fr")
    ]);

    return { es, va, en, fr };
}

function updateTournamentManualStatus(message) {
    const el = document.getElementById("tournamentManualStatus");
    if (!el) return;
    el.textContent = message;
}

function readTournamentManualContent() {
    try {
        const raw = localStorage.getItem(TOURNAMENT_MANUAL_CONTENT_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return null;

        return {
            title: normalizeLocalizedText(parsed.title),
            body: normalizeLocalizedText(parsed.body),
            updatedAt: parsed.updatedAt || new Date().toISOString()
        };
    } catch (error) {
        return null;
    }
}

function fillTournamentManualInputs() {
    const saved = readTournamentManualContent();
    const titleInput = document.getElementById("tournamentManualTitle_es");
    const bodyInput = document.getElementById("tournamentManualBody_es");
    if (!titleInput || !bodyInput) return;

    titleInput.value = saved?.title?.es || "";
    bodyInput.value = saved?.body?.es || "";
}

async function saveTournamentManualContent() {
    const titleEs = (document.getElementById("tournamentManualTitle_es")?.value || "").trim();
    const bodyEs = (document.getElementById("tournamentManualBody_es")?.value || "").trim();

    if (!titleEs || !bodyEs) {
        updateTournamentManualStatus("Escribe título y texto en español.");
        return;
    }

    updateTournamentManualStatus("Traduciendo contenido...");
    const [title, body] = await Promise.all([
        buildLocalizedFromSpanish(titleEs),
        buildLocalizedFromSpanish(bodyEs)
    ]);

    const payload = {
        title,
        body,
        updatedAt: new Date().toISOString()
    };

    localStorage.setItem(TOURNAMENT_MANUAL_CONTENT_KEY, JSON.stringify(payload));
    updateTournamentManualStatus("Contenido del torneo guardado y traducido.");
}

function resetTournamentManualContent() {
    localStorage.removeItem(TOURNAMENT_MANUAL_CONTENT_KEY);
    fillTournamentManualInputs();
    updateTournamentManualStatus("Contenido manual eliminado. Se usará el texto base de la web.");
}

function initTournamentManualAdmin() {
    const panel = document.getElementById("tournament-text-panel");
    if (!panel) return;

    const saveButton = document.getElementById("saveTournamentManualContent");
    const resetButton = document.getElementById("resetTournamentManualContent");

    if (saveButton) {
        saveButton.addEventListener("click", saveTournamentManualContent);
    }
    if (resetButton) {
        resetButton.addEventListener("click", resetTournamentManualContent);
    }

    fillTournamentManualInputs();
}

function updateHeroStatus(message) {
    const el = document.getElementById("heroAdminStatus");
    if (!el) return;
    el.textContent = message;
}

function normalizeHeroSettings(payload) {
    if (!payload || typeof payload !== "object") return null;

    return {
        eventLabel: normalizeLocalizedText(payload.eventLabel),
        eventTitle: normalizeLocalizedText(payload.eventTitle),
        eventLocation: normalizeLocalizedText(payload.eventLocation),
        countdownDate: String(payload.countdownDate || "").trim(),
        backgroundImage: String(payload.backgroundImage || "").trim(),
        updatedAt: payload.updatedAt || new Date().toISOString()
    };
}

function readHeroSettings() {
    try {
        const raw = localStorage.getItem(HERO_SETTINGS_KEY);
        if (!raw) return null;
        return normalizeHeroSettings(JSON.parse(raw));
    } catch (error) {
        return null;
    }
}

function toDateTimeLocalInputValue(value) {
    const dt = new Date(value || "");
    if (Number.isNaN(dt.getTime())) return "";
    const pad = (num) => String(num).padStart(2, "0");
    const yyyy = dt.getFullYear();
    const mm = pad(dt.getMonth() + 1);
    const dd = pad(dt.getDate());
    const hh = pad(dt.getHours());
    const mi = pad(dt.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fromDateTimeLocalInputValue(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toISOString();
}

function fillHeroInputs() {
    const saved = readHeroSettings();

    const labelInput = document.getElementById("heroEventLabel_es");
    const titleInput = document.getElementById("heroEventTitle_es");
    const locationInput = document.getElementById("heroEventLocation_es");
    const countdownInput = document.getElementById("heroCountdownDate");
    const bgPathInput = document.getElementById("heroBackgroundPath");

    if (labelInput) labelInput.value = saved?.eventLabel?.es || "";
    if (titleInput) titleInput.value = saved?.eventTitle?.es || "";
    if (locationInput) locationInput.value = saved?.eventLocation?.es || "";
    if (countdownInput) countdownInput.value = toDateTimeLocalInputValue(saved?.countdownDate || "");
    if (bgPathInput) bgPathInput.value = saved?.backgroundImage || "";
}

async function onHeroBackgroundChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
        pendingHeroBackgroundSrc = "";
        return;
    }

    pendingHeroBackgroundSrc = await readFileAsDataUrl(file);
}

async function saveHeroSettings() {
    const existing = readHeroSettings();

    const labelEs = (document.getElementById("heroEventLabel_es")?.value || "").trim();
    const titleEs = (document.getElementById("heroEventTitle_es")?.value || "").trim();
    const locationEs = (document.getElementById("heroEventLocation_es")?.value || "").trim();
    const countdownRaw = (document.getElementById("heroCountdownDate")?.value || "").trim();
    const bgPath = (document.getElementById("heroBackgroundPath")?.value || "").trim();

    const nextCountdownDate = fromDateTimeLocalInputValue(countdownRaw) || existing?.countdownDate || "";
    const nextBackgroundImage = pendingHeroBackgroundSrc || bgPath || existing?.backgroundImage || "";

    const finalLabelEs = labelEs || existing?.eventLabel?.es || "";
    const finalTitleEs = titleEs || existing?.eventTitle?.es || "";
    const finalLocationEs = locationEs || existing?.eventLocation?.es || "";

    if (!finalLabelEs && !finalTitleEs && !finalLocationEs && !nextCountdownDate && !nextBackgroundImage) {
        updateHeroStatus("No hay cambios para guardar.");
        return;
    }

    let eventLabel = existing?.eventLabel || normalizeLocalizedText("");
    let eventTitle = existing?.eventTitle || normalizeLocalizedText("");
    let eventLocation = existing?.eventLocation || normalizeLocalizedText("");

    const needsTranslate = Boolean(labelEs || titleEs || locationEs);
    if (needsTranslate) {
        updateHeroStatus("Traduciendo campos del hero...");
        [eventLabel, eventTitle, eventLocation] = await Promise.all([
            buildLocalizedFromSpanish(finalLabelEs),
            buildLocalizedFromSpanish(finalTitleEs),
            buildLocalizedFromSpanish(finalLocationEs)
        ]);
    }

    const payload = {
        eventLabel,
        eventTitle,
        eventLocation,
        countdownDate: nextCountdownDate,
        backgroundImage: nextBackgroundImage,
        updatedAt: new Date().toISOString()
    };

    localStorage.setItem(HERO_SETTINGS_KEY, JSON.stringify(payload));
    pendingHeroBackgroundSrc = "";
    const fileInput = document.getElementById("heroBackgroundFile");
    if (fileInput) fileInput.value = "";

    if (!needsTranslate && nextCountdownDate) {
        updateHeroStatus("Countdown guardado correctamente.");
    } else {
        updateHeroStatus("Hero guardado correctamente.");
    }
}

function resetHeroSettings() {
    localStorage.removeItem(HERO_SETTINGS_KEY);
    pendingHeroBackgroundSrc = "";
    fillHeroInputs();

    const fileInput = document.getElementById("heroBackgroundFile");
    if (fileInput) fileInput.value = "";

    updateHeroStatus("Hero restaurado a la configuración base.");
}

function initHeroAdmin() {
    const panel = document.getElementById("hero-admin-panel");
    if (!panel) return;

    const saveButton = document.getElementById("saveHeroSettings");
    const resetButton = document.getElementById("resetHeroSettings");
    const bgFileInput = document.getElementById("heroBackgroundFile");

    if (saveButton) {
        saveButton.addEventListener("click", saveHeroSettings);
    }
    if (resetButton) {
        resetButton.addEventListener("click", resetHeroSettings);
    }
    if (bgFileInput) {
        bgFileInput.addEventListener("change", onHeroBackgroundChange);
    }

    fillHeroInputs();
}

function normalizeGalleryDateValue(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const directMatch = raw.match(/^\d{4}-\d{2}-\d{2}$/);
    if (directMatch) return directMatch[0];
    const time = Date.parse(raw);
    if (!Number.isFinite(time)) return "";
    return new Date(time).toISOString().slice(0, 10);
}

function normalizeGalleryMeta(meta) {
    return {
        tournament: String(meta?.tournament || "").trim(),
        club: String(meta?.club || "").trim(),
        date: normalizeGalleryDateValue(meta?.date),
        category: String(meta?.category || "").trim()
    };
}

function titleCaseWords(value) {
    return String(value || "")
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ");
}

function inferPlayerNameFromFileName(fileName) {
    const base = String(fileName || "")
        .replace(/\.[^.]+$/, "")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    return titleCaseWords(base);
}

function normalizeGalleryPhotoMeta(photo, galleryMeta = {}) {
    return {
        tournament: String(photo?.tournament || galleryMeta?.tournament || "").trim(),
        club: String(photo?.club || galleryMeta?.club || "").trim(),
        date: normalizeGalleryDateValue(photo?.date || galleryMeta?.date),
        player: String(photo?.player || "").trim(),
        category: String(photo?.category || galleryMeta?.category || "").trim()
    };
}

function readNewGalleryMetaInputs() {
    return normalizeGalleryMeta({
        tournament: document.getElementById("newGalleryTournament")?.value || "",
        club: document.getElementById("newGalleryClub")?.value || "",
        date: document.getElementById("newGalleryDate")?.value || "",
        category: document.getElementById("newGalleryCategory")?.value || ""
    });
}

function formatGalleryTitleDate(value) {
    const normalized = normalizeGalleryDateValue(value);
    if (!normalized) return "";
    const dt = new Date(`${normalized}T00:00:00`);
    if (Number.isNaN(dt.getTime())) return normalized;
    return dt.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function buildFallbackGalleryTitle(galleryMeta = {}) {
    const parts = [];
    const dateLabel = formatGalleryTitleDate(galleryMeta?.date);
    const tournament = String(galleryMeta?.tournament || "").trim();
    const club = String(galleryMeta?.club || "").trim();

    if (dateLabel) parts.push(dateLabel);
    if (tournament) parts.push(tournament);
    if (club) parts.push(club);

    return parts.length > 0 ? parts.join(" · ") : "Galería";
}

function normalizeGallery(gallery) {
    const meta = normalizeGalleryMeta(gallery?.meta);
    const photos = Array.isArray(gallery?.photos) ? gallery.photos : [];
    return {
        id: gallery?.id || createId("gallery"),
        title: normalizeLocalizedText(gallery?.title),
        meta,
        photos: photos.map((photo) => ({
            id: photo?.id || createId("photo"),
            src: photo?.src || "",
            storagePath: photo?.storagePath || "",
            sourceSrc: photo?.sourceSrc || "",
            sourceStoragePath: photo?.sourceStoragePath || "",
            processedSrc: photo?.processedSrc || "",
            processedStoragePath: photo?.processedStoragePath || "",
            ai: photo?.ai || null,
            caption: normalizeLocalizedText(photo?.caption),
            meta: normalizeGalleryPhotoMeta(photo?.meta || photo, meta)
        })).filter((photo) => !!photo.src),
        createdAt: gallery?.createdAt || new Date().toISOString()
    };
}

function normalizeNewsItem(item) {
    const legacyArticle = item?.article || item?.summary || "";
    const title = normalizeLocalizedText(item?.title);
    const article = normalizeLocalizedText(legacyArticle);
    const fallbackSeoDescription = {
        es: String(item?.seo?.description?.es || article.es || "").slice(0, 160),
        va: String(item?.seo?.description?.va || article.va || article.es || "").slice(0, 160),
        en: String(item?.seo?.description?.en || article.en || article.es || "").slice(0, 160),
        fr: String(item?.seo?.description?.fr || article.fr || article.es || "").slice(0, 160)
    };
    const fallbackSlug = slugifyText(item?.seo?.slug || item?.slug || title.es || item?.id || createId("news"));

    return {
        id: item?.id || createId("news"),
        imageSrc: item?.imageSrc || item?.image || "",
        imageStoragePath: item?.imageStoragePath || "",
        player: String(item?.player || item?.meta?.player || "").trim(),
        title,
        article,
        createdAt: item?.createdAt || new Date().toISOString(),
        updatedAt: item?.updatedAt || item?.createdAt || new Date().toISOString(),
        publishAt: item?.publishAt || item?.publishedAt || "",
        status: normalizeNewsStatus(item?.status),
        category: String(item?.category || "").trim(),
        tags: normalizeStringArray(item?.tags),
        seo: {
            slug: fallbackSlug,
            title: normalizeLocalizedText(item?.seo?.title || title),
            description: normalizeLocalizedText(item?.seo?.description || fallbackSeoDescription)
        }
    };
}

function slugifyText(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 120);
}

function normalizeStringArray(value) {
    if (Array.isArray(value)) {
        return Array.from(new Set(value.map((entry) => String(entry || "").trim()).filter(Boolean)));
    }

    if (typeof value === "string") {
        return Array.from(new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean)));
    }

    return [];
}

function normalizeNewsStatus(value) {
    return ["draft", "scheduled", "published"].includes(value) ? value : "published";
}

function getNewsStatusLabel(status) {
    switch (normalizeNewsStatus(status)) {
        case "draft":
            return "Borrador";
        case "scheduled":
            return "Programada";
        default:
            return "Publicada";
    }
}

function getNewsSortTime(item) {
    return Date.parse(item?.publishAt || item?.createdAt || "") || 0;
}

function isNewsPublished(item, at = Date.now()) {
    const status = normalizeNewsStatus(item?.status);
    if (status === "draft") return false;
    if (status === "scheduled") {
        const publishTime = Date.parse(item?.publishAt || "");
        return Number.isFinite(publishTime) && publishTime <= at;
    }
    return true;
}

function resolveNewsPublication(statusValue, publishAtValue) {
    const status = normalizeNewsStatus(statusValue);
    const rawPublishAt = String(publishAtValue || "").trim();
    if (status === "scheduled") {
        if (!rawPublishAt) {
            return { error: "Indica la fecha de publicación para programar la noticia." };
        }
        const scheduledTime = Date.parse(rawPublishAt);
        if (!Number.isFinite(scheduledTime)) {
            return { error: "La fecha programada no es válida." };
        }
        return { status, publishAt: new Date(scheduledTime).toISOString() };
    }

    if (status === "published") {
        if (!rawPublishAt) {
            return { status, publishAt: new Date().toISOString() };
        }
        const publishTime = Date.parse(rawPublishAt);
        return { status, publishAt: Number.isFinite(publishTime) ? new Date(publishTime).toISOString() : new Date().toISOString() };
    }

    return { status, publishAt: rawPublishAt ? new Date(rawPublishAt).toISOString() : "" };
}

function formatAdminDateTime(value) {
    const dt = new Date(value || "");
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function formatDateTimeLocalValue(value) {
    const dt = new Date(value || "");
    if (Number.isNaN(dt.getTime())) return "";
    const offsetMs = dt.getTimezoneOffset() * 60 * 1000;
    return new Date(dt.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatTagsInput(tags) {
    return normalizeStringArray(tags).join(", ");
}

function getNewsPublicUrl(item) {
    const slug = slugifyText(item?.seo?.slug || "");
    if (slug) return `news.html?slug=${encodeURIComponent(slug)}`;
    return `news.html?newsId=${encodeURIComponent(item?.id || "")}`;
}

function readGalleryCollection() {
    try {
        const raw = localStorage.getItem(GALLERY_COLLECTION_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];

        return parsed.map(normalizeGallery).sort((a, b) => {
            const ta = Date.parse(a?.createdAt || "") || 0;
            const tb = Date.parse(b?.createdAt || "") || 0;
            return ta - tb;
        });
    } catch (error) {
        return [];
    }
}

function saveGalleryCollection(collection) {
    try {
        localStorage.setItem(GALLERY_COLLECTION_KEY, JSON.stringify(collection));

        const cloud = window.PSACloudStore;
        if (cloud?.isReady?.()) {
            cloud.saveLocalStorageKeyToCloud(GALLERY_COLLECTION_KEY).catch(() => {
                // Si la nube falla, mantenemos al menos la copia local.
            });
        }

        return true;
    } catch (error) {
        return false;
    }
}

function readNewsCollection() {
    try {
        const raw = localStorage.getItem(NEWS_COLLECTION_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed.map(normalizeNewsItem).sort((a, b) => {
                    const ta = getNewsSortTime(a);
                    const tb = getNewsSortTime(b);
                    return tb - ta;
                });
            }
        }
    } catch (error) {
        return [];
    }

    return [];
}

function insertFormatTag(targetInputId, tagBefore, tagAfter = "") {
    const el = document.getElementById(targetInputId);
    if (!el) return;

    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const selectedText = el.value.substring(start, end) || "Texto";
    const replacement = tagBefore + selectedText + tagAfter;

    el.value = el.value.substring(0, start) + replacement + el.value.substring(end);
    el.focus();
    el.selectionStart = start + tagBefore.length;
    el.selectionEnd = start + tagBefore.length + selectedText.length;
}
window.insertFormatTag = insertFormatTag;

function saveNewsCollection(collection) {
    try {
        localStorage.setItem(NEWS_COLLECTION_KEY, JSON.stringify(collection));

        const cloud = window.PSACloudStore;
        if (cloud?.isReady?.()) {
            cloud.saveLocalStorageKeyToCloud(NEWS_COLLECTION_KEY).catch(() => {
                // Mantenemos al menos la copia local.
            });
        }

        return true;
    } catch (error) {
        return false;
    }
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("No se pudo leer una imagen."));
        reader.readAsDataURL(file);
    });
}

function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("No se pudo procesar una imagen."));
        img.src = dataUrl;
    });
}

async function readFileAsDataUrl(file) {
    const originalDataUrl = await fileToDataUrl(file);
    const image = await loadImage(originalDataUrl);

    const maxWidth = 720;
    const scale = image.width > maxWidth ? maxWidth / image.width : 1;
    const targetWidth = Math.max(1, Math.round(image.width * scale));
    const targetHeight = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return originalDataUrl;

    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
    return canvas.toDataURL("image/jpeg", 0.72);
}

function dataUrlToBlob(dataUrl) {
    const [meta, base64] = String(dataUrl || "").split(",");
    const mime = /data:([^;]+)/.exec(meta || "")?.[1] || "image/jpeg";
    const binary = atob(base64 || "");
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
}

function sanitizeFileName(name) {
    const cleaned = String(name || "image")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");
    return cleaned || "image";
}

async function uploadNewsImageFile(file, newsId) {
    const compressedDataUrl = await readFileAsDataUrl(file);
    const client = window.AdminSupabase?.getClient?.();

    if (!client) {
        return { imageSrc: compressedDataUrl, imageStoragePath: "" };
    }

    const extension = String(file.name || "image.jpg").split(".").pop()?.toLowerCase() || "jpg";
    const safeName = sanitizeFileName(String(file.name || `news-${newsId}.${extension}`));
    const objectPath = `news/${newsId}/${Date.now()}-${safeName}`;
    const blob = dataUrlToBlob(compressedDataUrl);
    const { error } = await client.storage.from("news").upload(objectPath, blob, {
        contentType: blob.type || file.type || "image/jpeg",
        upsert: false
    });
    if (error) {
        throw new Error(`No se pudo subir la imagen de noticia: ${error.message || "error desconocido"}`);
    }

    const { data } = client.storage.from("news").getPublicUrl(objectPath);
    return {
        imageSrc: data?.publicUrl || compressedDataUrl,
        imageStoragePath: objectPath
    };
}

function getGalleryUploadResumeMap() {
    return parseStorageJson(GALLERY_UPLOAD_RESUME_KEY, {});
}

function saveGalleryUploadResumeMap(value) {
    try {
        localStorage.setItem(GALLERY_UPLOAD_RESUME_KEY, JSON.stringify(value));
    } catch (error) {
        // La subida sigue funcionando aunque el navegador no permita persistir la reanudación.
    }
}

function makeGalleryUploadFingerprint(file) {
    return [file.name, file.size, file.lastModified, file.webkitRelativePath || ""].join(":");
}

function encodeTusMetadata(value) {
    return btoa(unescape(encodeURIComponent(String(value || ""))));
}

function sanitizeStorageFileName(fileName) {
    const extension = (String(fileName).match(/\.[a-z0-9]{1,10}$/i) || [""])[0].toLowerCase();
    const base = String(fileName).replace(/\.[^.]+$/, "").normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || "foto";
    return `${base}${extension}`;
}

function getGalleryPublicUrl(path) {
    const client = window.AdminSupabase?.getClient?.();
    return client?.storage?.from("photos").getPublicUrl(path)?.data?.publicUrl || "";
}

function extractPhotosStoragePathFromUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (raw.startsWith("gallery/") || raw.startsWith("processed/")) {
        return raw;
    }

    const markers = [
        "/storage/v1/object/public/photos/",
        "/storage/v1/object/sign/photos/",
        "/storage/v1/object/authenticated/photos/"
    ];

    for (const marker of markers) {
        const index = raw.indexOf(marker);
        if (index === -1) continue;
        const sliced = raw.slice(index + marker.length);
        const clean = sliced.split("?")[0].split("#")[0];
        if (!clean) continue;
        try {
            return decodeURIComponent(clean);
        } catch (_error) {
            return clean;
        }
    }

    return "";
}

function resolvePhotoSourcePath(photo) {
    return String(
        photo?.sourceStoragePath
        || photo?.storagePath
        || extractPhotosStoragePathFromUrl(photo?.sourceSrc)
        || extractPhotosStoragePathFromUrl(photo?.src)
        || ""
    ).trim();
}

async function getTusHeaders(extra = {}) {
    const token = await window.AdminSupabase?.getAccessToken?.();
    const apiKey = String(window.PSA_CONFIG?.supabaseAnonKey || window.PSA_CONFIG?.SUPABASE_ANON_KEY || "").trim();
    if (!token || !apiKey) throw new Error("Inicia sesión y configura Supabase antes de subir fotos.");
    return {
        "Tus-Resumable": "1.0.0",
        authorization: `Bearer ${token}`,
        apikey: apiKey,
        ...extra
    };
}

async function tusRequest(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) {
        const details = await response.text().catch(() => "");
        const error = new Error(details || `Error de subida (${response.status}).`);
        error.status = response.status;
        throw error;
    }
    return response;
}

async function getTusOffset(uploadUrl) {
    const response = await tusRequest(uploadUrl, { method: "HEAD", headers: await getTusHeaders() });
    return Number(response.headers.get("Upload-Offset") || 0);
}

async function createTusUpload(file, objectPath) {
    const baseUrl = String(window.PSA_CONFIG?.supabaseUrl || window.PSA_CONFIG?.SUPABASE_URL || "").replace(/\/$/, "");
    if (!baseUrl) throw new Error("Configura la URL de Supabase antes de subir fotos.");

    const metadata = [
        `bucketName ${encodeTusMetadata("photos")}`,
        `objectName ${encodeTusMetadata(objectPath)}`,
        `contentType ${encodeTusMetadata(file.type || "application/octet-stream")}`
    ].join(",");
    const response = await tusRequest(`${baseUrl}/storage/v1/upload/resumable`, {
        method: "POST",
        headers: await getTusHeaders({
            "Upload-Length": String(file.size),
            "Upload-Metadata": metadata,
            "x-upsert": "false"
        })
    });
    const location = response.headers.get("Location");
    if (!location) throw new Error("Supabase no devolvió una URL de reanudación.");
    return new URL(location, baseUrl).toString();
}

function updateGalleryUploadProgress(photos = pendingGalleryPhotos) {
    const total = photos.reduce((sum, photo) => sum + Number(photo.file?.size || 0), 0);
    const completed = photos.reduce((sum, photo) => sum + Math.min(Number(photo.uploadedBytes || 0), Number(photo.file?.size || 0)), 0);
    const percent = total ? Math.round((completed / total) * 100) : 0;
    const now = Date.now();
    if (total === 0) {
        galleryUploadTelemetry = {
            totalBytes: 0,
            startedAt: 0,
            lastTs: 0,
            lastCompletedBytes: 0,
            smoothedBytesPerSecond: 0
        };
    } else if (!galleryUploadTelemetry.startedAt || galleryUploadTelemetry.totalBytes !== total) {
        galleryUploadTelemetry = {
            totalBytes: total,
            startedAt: now,
            lastTs: now,
            lastCompletedBytes: completed,
            smoothedBytesPerSecond: 0
        };
    } else {
        const deltaTimeSeconds = Math.max((now - galleryUploadTelemetry.lastTs) / 1000, 0.001);
        const deltaBytes = Math.max(0, completed - galleryUploadTelemetry.lastCompletedBytes);
        const instantRate = deltaBytes / deltaTimeSeconds;
        if (instantRate > 0) {
            galleryUploadTelemetry.smoothedBytesPerSecond = galleryUploadTelemetry.smoothedBytesPerSecond
                ? (galleryUploadTelemetry.smoothedBytesPerSecond * 0.75) + (instantRate * 0.25)
                : instantRate;
        }
        galleryUploadTelemetry.lastTs = now;
        galleryUploadTelemetry.lastCompletedBytes = completed;
    }

    const remaining = Math.max(total - completed, 0);
    const speed = galleryUploadTelemetry.smoothedBytesPerSecond;
    const etaSeconds = speed > 0 ? (remaining / speed) : 0;
    const summary = document.getElementById("galleryUploadSummary");
    const bar = document.getElementById("galleryUploadProgressBar");
    const progress = summary?.querySelector("[role='progressbar']");
    const text = document.getElementById("galleryUploadProgressText");
    if (summary) summary.hidden = total === 0;
    if (bar) bar.style.width = `${percent}%`;
    if (progress) progress.setAttribute("aria-valuenow", String(percent));
    if (text) {
        const done = photos.filter((photo) => photo.uploadedUrl).length;
        const speedText = formatUploadRate(speed);
        const etaText = remaining > 0 ? formatDuration(etaSeconds) : "0s";
        text.textContent = `${done}/${photos.length} fotos listas · ${percent}% · ${formatBytes(completed)}/${formatBytes(total)} · Restan ${formatBytes(remaining)} · ${speedText} · ETA ${etaText}`;
    }
}

async function uploadGalleryPhoto(photo, galleryId, progressPhotos = pendingGalleryPhotos) {
    if (photo.uploadedUrl) return photo.uploadedUrl;
    const file = photo.file;
    if (!file) throw new Error(`Vuelve a seleccionar ${photo.name || "la foto"} para reanudarla.`);

    photo.status = "Subiendo…";
    const fingerprint = makeGalleryUploadFingerprint(file);
    const resumes = getGalleryUploadResumeMap();
    const objectPath = resumes[fingerprint]?.objectPath || photo.objectPath || `gallery/${galleryId}/${photo.id}-${sanitizeStorageFileName(file.name)}`;
    photo.objectPath = objectPath;
    let uploadUrl = resumes[fingerprint]?.uploadUrl || "";
    let offset = 0;

    try {
        offset = uploadUrl ? await getTusOffset(uploadUrl) : 0;
    } catch (error) {
        uploadUrl = "";
        offset = 0;
    }
    if (!uploadUrl) {
        uploadUrl = await createTusUpload(file, objectPath);
        resumes[fingerprint] = { uploadUrl, objectPath, updatedAt: new Date().toISOString() };
        saveGalleryUploadResumeMap(resumes);
    }

    photo.uploadedBytes = offset;
    updateGalleryUploadProgress(progressPhotos);
    for (let start = offset; start < file.size;) {
        const chunk = file.slice(start, Math.min(start + GALLERY_UPLOAD_CHUNK_SIZE, file.size));
        let attempts = 0;
        while (true) {
            try {
                const response = await tusRequest(uploadUrl, {
                    method: "PATCH",
                    headers: await getTusHeaders({
                        "Upload-Offset": String(start),
                        "Content-Type": "application/offset+octet-stream"
                    }),
                    body: chunk
                });
                start = Number(response.headers.get("Upload-Offset") || (start + chunk.size));
                break;
            } catch (error) {
                attempts += 1;
                if (attempts > 4) throw error;
                await new Promise((resolve) => setTimeout(resolve, 500 * attempts));
                start = await getTusOffset(uploadUrl);
            }
        }
        photo.uploadedBytes = start;
        updateGalleryUploadProgress(progressPhotos);
    }

    delete resumes[fingerprint];
    saveGalleryUploadResumeMap(resumes);
    photo.uploadedUrl = getGalleryPublicUrl(objectPath);
    if (!photo.uploadedUrl) throw new Error("No se pudo obtener la URL pública de la foto subida.");
    photo.status = "Subida";
    photo.uploadedBytes = file.size;
    updateGalleryUploadProgress(progressPhotos);
    return photo.uploadedUrl;
}

async function uploadGalleryQueue(galleryId, photos = pendingGalleryPhotos) {
    let nextIndex = 0;
    const workers = Array.from({ length: Math.min(GALLERY_UPLOAD_CONCURRENCY, photos.length) }, async () => {
        while (nextIndex < photos.length) {
            const photo = photos[nextIndex++];
            await uploadGalleryPhoto(photo, galleryId, photos);
            if (photos === pendingGalleryPhotos) renderPendingGalleryPhotos();
        }
    });
    await Promise.all(workers);
}

async function processGalleryPhotoWithAI(photo, galleriesInner, galleryStatusMessage = "Analizando y mejorando la foto con IA…") {
    const client = window.AdminSupabase?.getClient?.();
    const sourcePath = resolvePhotoSourcePath(photo);
    if (!photo || !sourcePath || !client) {
        throw new Error("Esta foto no tiene una ruta válida en Supabase Storage.");
    }

    updateGalleryStatus(galleryStatusMessage);
    const { data, error } = await client.functions.invoke("process-photo", { body: { sourcePath } });
    if (error) throw error;
    if (!data?.processedUrl || !data?.processedPath) {
        throw new Error(data?.error || "La IA no devolvió un resultado válido.");
    }

    photo.sourceSrc = photo.sourceSrc || photo.src;
    photo.storagePath = photo.storagePath || sourcePath;
    photo.sourceStoragePath = sourcePath;
    photo.processedSrc = data.processedUrl;
    photo.processedStoragePath = data.processedPath;
    photo.ai = { detection: data.detection || null, quality: data.quality || null, processedAt: new Date().toISOString() };

    if (galleriesInner && !saveGalleryCollection(galleriesInner)) {
        throw new Error("No se pudo guardar el resultado IA.");
    }

    return photo;
}

async function processGalleryPhotosWithAI(photos, galleriesInner) {
    for (const photo of photos) {
        if (!photo?.uploadedUrl) continue;
        if (photo.processedSrc && photo.processedStoragePath) continue;
        photo.status = "Procesando con IA…";
        await processGalleryPhotoWithAI(photo, galleriesInner, `Procesando ${photo.name || "foto"} con IA para mejorar el contraluz…`);
    }
}

function createGalleryUploadPhoto(file) {
    return {
        id: createId("photo"),
        file,
        name: file.webkitRelativePath || file.name,
        previewUrl: URL.createObjectURL(file),
        uploadedBytes: 0,
        status: "En cola",
        caption: normalizeLocalizedText(""),
        meta: {
            tournament: "",
            club: "",
            date: "",
            player: inferPlayerNameFromFileName(file.name),
            category: ""
        }
    };
}

function renderPendingGalleryPhotos() {
    const host = document.getElementById("newGalleryPhotosEditor");
    if (!host) return;

    if (pendingGalleryPhotos.length === 0) {
        host.innerHTML = "";
        return;
    }

    host.innerHTML = pendingGalleryPhotos.map((photo, i) => `
        <div class="gallery-new-photo-item">
            <img class="gallery-thumb" src="${photo.previewUrl}" alt="Nueva foto ${i + 1}">
            <strong>${escapeHtml(photo.name || `Foto ${i + 1}`)}</strong>
            <span class="gallery-upload-file-status">${escapeHtml(photo.status || "En cola")}</span>
            <label class="field-label" for="pendingPlayer_${i}">Jugador</label>
            <input id="pendingPlayer_${i}" type="text" value="${escapeHtml(photo.meta?.player || "")}" placeholder="Nombre del jugador">
            <label class="field-label" for="pendingCaption_${i}_es">Pie ES</label>
            <input id="pendingCaption_${i}_es" type="text" value="${escapeHtml(photo.caption?.es || "")}" placeholder="Texto ES (se traduce automático)">
            <label class="gallery-cover-check" for="pendingCover_${i}">
                <input id="pendingCover_${i}" type="radio" name="pendingCover" value="${i}" ${i === 0 ? "checked" : ""}>
                Imagen de portada
            </label>
        </div>
    `).join("");

    pendingGalleryPhotos.forEach((_, i) => {
        const playerInput = document.getElementById(`pendingPlayer_${i}`);
        if (playerInput) {
            playerInput.addEventListener("input", () => {
                pendingGalleryPhotos[i].meta.player = playerInput.value;
            });
        }
        const captionInput = document.getElementById(`pendingCaption_${i}_es`);
        if (captionInput) {
            captionInput.addEventListener("input", () => {
                pendingGalleryPhotos[i].caption.es = captionInput.value;
            });
        }
    });

    host.querySelectorAll("input[name='pendingCover']").forEach((input) => {
        input.addEventListener("change", () => {
            const index = Number(input.value);
            if (!Number.isInteger(index) || index < 0 || index >= pendingGalleryPhotos.length) return;
            if (index === 0) return;

            const selected = pendingGalleryPhotos[index];
            pendingGalleryPhotos.splice(index, 1);
            pendingGalleryPhotos.unshift(selected);

            renderPendingGalleryPhotos();
            updateGalleryStatus("Portada seleccionada para la nueva galería.");
        });
    });
}

async function onNewGalleryFilesChange(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const additions = files.filter((file) => file.type.startsWith("image/")).map(createGalleryUploadPhoto);

    pendingGalleryPhotos = pendingGalleryPhotos.concat(additions);
    renderPendingGalleryPhotos();
    updateGalleryUploadProgress();
    event.target.value = "";
}

function getGalleryById(collection, galleryId) {
    return collection.find((item) => item.id === galleryId);
}

function renderGalleryAdminList() {
    const host = document.getElementById("galleryAdminList");
    if (!host) return;

    const galleries = readGalleryCollection();
    if (galleries.length === 0) {
        host.innerHTML = '<p class="admin-muted">No hay galerías todavía.</p>';
        return;
    }

    const selectedGalleryId = document.getElementById("galleryDeleteSelect")?.value || "";
    const galleriesToRender = selectedGalleryId
        ? galleries.filter((item) => item.id === selectedGalleryId)
        : galleries;

    if (galleriesToRender.length === 0) {
        host.innerHTML = '<p class="admin-muted">Selecciona una galería para editar.</p>';
        return;
    }

    host.innerHTML = galleriesToRender.map((gallery) => {
        const meta = normalizeGalleryMeta(gallery.meta);
        const photos = Array.isArray(gallery.photos) ? gallery.photos : [];
        const photosMarkup = photos.map((photo, photoIndex) => `
            <div class="gallery-photo-item" data-photo-item="${photo.id}">
                <img class="gallery-thumb" src="${photo.processedSrc || photo.src}" alt="${escapeHtml(photo.caption?.es || "Foto")}">
                <p class="gallery-ai-state">${photo.processedSrc ? "IA procesada y validada" : "Original sin procesar"}</p>
                <label class="field-label" for="player_${photo.id}">Jugador</label>
                <input id="player_${photo.id}" type="text" value="${escapeHtml(photo.meta?.player || "")}" placeholder="Nombre del jugador">
                <label class="field-label" for="caption_${photo.id}_es">Pie ES</label>
                <input id="caption_${photo.id}_es" type="text" value="${escapeHtml(photo.caption?.es || "")}" placeholder="Texto ES (se traduce automático)">
                <label class="gallery-cover-check" for="cover_${gallery.id}_${photo.id}">
                    <input id="cover_${gallery.id}_${photo.id}" type="radio" name="cover_${gallery.id}" value="${photo.id}" ${photoIndex === 0 ? "checked" : ""} data-action="set-cover" data-gallery-id="${gallery.id}" data-photo-id="${photo.id}">
                    Imagen de portada
                </label>
                <label class="field-label" for="replace_${photo.id}">Reemplazar imagen (opcional)</label>
                <input id="replace_${photo.id}" type="file" accept="image/*">
                <div class="gallery-photo-actions">
                    <button type="button" class="btn-gallery-save" data-action="save-photo" data-gallery-id="${gallery.id}" data-photo-id="${photo.id}">Guardar foto</button>
                    <button type="button" class="btn-gallery-ai" data-action="process-photo" data-gallery-id="${gallery.id}" data-photo-id="${photo.id}" title="${resolvePhotoSourcePath(photo) ? "Procesar esta foto con IA" : "Primero sube esta foto a Supabase Storage para poder procesarla"}">Procesar con IA</button>
                    <button type="button" class="btn-gallery-danger" data-action="delete-photo" data-gallery-id="${gallery.id}" data-photo-id="${photo.id}">Borrar foto</button>
                </div>
            </div>
        `).join("");

        return `
            <article class="gallery-admin-card" data-gallery-id="${gallery.id}">
                <div class="gallery-admin-head">
                    <input type="text" id="galleryTitle_${gallery.id}_es" value="${escapeHtml(gallery.title?.es || "")}" placeholder="Título ES">
                    <button type="button" class="btn-gallery-save" data-action="save-title" data-gallery-id="${gallery.id}">Guardar título</button>
                </div>
                <div class="results-grid">
                    <div>
                        <label class="field-label" for="galleryTournament_${gallery.id}">Torneo</label>
                        <input type="text" id="galleryTournament_${gallery.id}" value="${escapeHtml(meta.tournament)}" placeholder="PSA Valencia Open 2026">
                    </div>
                    <div>
                        <label class="field-label" for="galleryClub_${gallery.id}">Club</label>
                        <input type="text" id="galleryClub_${gallery.id}" value="${escapeHtml(meta.club)}" placeholder="Olympia Alboraya">
                    </div>
                    <div>
                        <label class="field-label" for="galleryDate_${gallery.id}">Fecha</label>
                        <input type="date" id="galleryDate_${gallery.id}" value="${escapeHtml(meta.date)}">
                    </div>
                    <div>
                        <label class="field-label" for="galleryCategory_${gallery.id}">Categoría</label>
                        <input type="text" id="galleryCategory_${gallery.id}" value="${escapeHtml(meta.category)}" placeholder="Primera ronda, Club...">
                    </div>
                </div>
                <div class="gallery-admin-actions">
                    <input type="file" id="appendFiles_${gallery.id}" accept="image/*" multiple>
                    <button type="button" class="btn-gallery-add" data-action="append-photos" data-gallery-id="${gallery.id}">Añadir fotos</button>
                    <button type="button" class="btn-gallery-save" data-action="save-meta" data-gallery-id="${gallery.id}">Guardar metadatos</button>
                </div>
                <div class="gallery-photo-grid">${photosMarkup || '<p class="admin-muted">Sin fotos.</p>'}</div>
            </article>
        `;
    }).join("");

    host.querySelectorAll("[data-action='save-title']").forEach((button) => {
        button.addEventListener("click", async () => {
            const galleryId = button.getAttribute("data-gallery-id");
            const galleriesInner = readGalleryCollection();
            const gallery = getGalleryById(galleriesInner, galleryId);
            if (!gallery) return;

            const sourceInput = document.getElementById(`galleryTitle_${galleryId}_es`);
            const sourceEs = (sourceInput?.value || "").trim();
            if (!sourceEs) {
                updateGalleryStatus("Escribe el título en español para traducir automáticamente.");
                return;
            }

            const newTitle = await buildLocalizedFromSpanish(sourceEs);
            gallery.title = newTitle;
            const saved = saveGalleryCollection(galleriesInner);
            if (!saved) {
                updateGalleryStatus("No se pudo guardar el título de la galería.");
                return;
            }
            updateGalleryStatus("Título de galería actualizado.");
            renderGalleryDeleteSelect();
            renderGalleryAdminList();
        });
    });

    host.querySelectorAll("[data-action='append-photos']").forEach((button) => {
        button.addEventListener("click", async () => {
            const galleryId = button.getAttribute("data-gallery-id");
            const fileInput = document.getElementById(`appendFiles_${galleryId}`);
            const files = Array.from(fileInput?.files || []);
            if (files.length === 0) {
                updateGalleryStatus("Selecciona fotos para añadir.");
                return;
            }

            const galleriesInner = readGalleryCollection();
            const gallery = getGalleryById(galleriesInner, galleryId);
            if (!gallery) return;

            const uploadPhotos = files.filter((file) => file.type.startsWith("image/")).map(createGalleryUploadPhoto);
            if (uploadPhotos.length === 0) {
                updateGalleryStatus("Selecciona archivos de imagen válidos.");
                return;
            }
            const galleryMeta = normalizeGalleryMeta(gallery.meta);
            uploadPhotos.forEach((photo) => {
                photo.meta = normalizeGalleryPhotoMeta(photo.meta, galleryMeta);
            });
            updateGalleryStatus(`Subiendo ${uploadPhotos.length} fotos a Supabase Storage…`);
            try {
                await uploadGalleryQueue(galleryId, uploadPhotos);
            } catch (error) {
                updateGalleryStatus(`No se pudieron añadir todas las fotos: ${error?.message || "error de subida"}`);
                return;
            }
            const newPhotos = uploadPhotos.map((photo) => ({
                id: photo.id,
                src: photo.uploadedUrl,
                storagePath: photo.objectPath,
                caption: photo.caption,
                meta: normalizeGalleryPhotoMeta(photo.meta, galleryMeta)
            }));
            uploadPhotos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));

            if (!Array.isArray(gallery.photos)) {
                gallery.photos = [];
            }

            gallery.photos = gallery.photos.concat(newPhotos);

            try {
                await processGalleryPhotosWithAI(newPhotos, galleriesInner);
            } catch (error) {
                updateGalleryStatus(`Las fotos se subieron, pero el procesado IA falló en alguna imagen: ${error?.message || "error de IA"}`);
            }

            const saved = saveGalleryCollection(galleriesInner);
            if (!saved) {
                updateGalleryStatus("No se pudo guardar: almacenamiento lleno. Reduce el número o tamaño de fotos.");
                return;
            }
            updateGalleryStatus("Fotos añadidas a la galería.");
            renderGalleryAdminList();
            renderGalleryDeleteSelect();
        });
    });

    host.querySelectorAll("[data-action='save-photo']").forEach((button) => {
        button.addEventListener("click", async () => {
            const galleryId = button.getAttribute("data-gallery-id");
            const photoId = button.getAttribute("data-photo-id");
            const galleriesInner = readGalleryCollection();
            const gallery = getGalleryById(galleriesInner, galleryId);
            if (!gallery || !Array.isArray(gallery.photos)) return;

            const photo = gallery.photos.find((item) => item.id === photoId);
            if (!photo) return;

            const captionInputEs = document.getElementById(`caption_${photoId}_es`);
            const captionEs = (captionInputEs?.value || "").trim();
            const playerInput = document.getElementById(`player_${photoId}`);
            photo.caption = captionEs
                ? await buildLocalizedFromSpanish(captionEs)
                : normalizeLocalizedText("");
            photo.meta = normalizeGalleryPhotoMeta({
                ...photo.meta,
                player: playerInput?.value || ""
            }, gallery.meta);

            const replaceInput = document.getElementById(`replace_${photoId}`);
            const replacement = replaceInput?.files?.[0];
            if (replacement) {
                if (!replacement.type.startsWith("image/")) {
                    updateGalleryStatus("Selecciona un archivo de imagen válido.");
                    return;
                }
                const uploadPhoto = createGalleryUploadPhoto(replacement);
                updateGalleryStatus("Subiendo la imagen de reemplazo a Supabase Storage…");
                try {
                    await uploadGalleryQueue(galleryId, [uploadPhoto]);
                } catch (error) {
                    updateGalleryStatus(`No se pudo subir el reemplazo: ${error?.message || "error de subida"}`);
                    return;
                }
                photo.src = uploadPhoto.uploadedUrl;
                photo.storagePath = uploadPhoto.objectPath;
                photo.sourceSrc = "";
                photo.sourceStoragePath = "";
                photo.processedSrc = "";
                photo.processedStoragePath = "";
                photo.ai = null;
                URL.revokeObjectURL(uploadPhoto.previewUrl);
            }

            const saved = saveGalleryCollection(galleriesInner);
            if (!saved) {
                updateGalleryStatus("No se pudo guardar: almacenamiento lleno. Reduce el número o tamaño de fotos.");
                return;
            }
            updateGalleryStatus("Foto actualizada.");
            renderGalleryAdminList();
        });
    });

    host.querySelectorAll("[data-action='save-meta']").forEach((button) => {
        button.addEventListener("click", () => {
            const galleryId = button.getAttribute("data-gallery-id");
            const galleriesInner = readGalleryCollection();
            const gallery = getGalleryById(galleriesInner, galleryId);
            if (!gallery) return;

            gallery.meta = normalizeGalleryMeta({
                tournament: document.getElementById(`galleryTournament_${galleryId}`)?.value || "",
                club: document.getElementById(`galleryClub_${galleryId}`)?.value || "",
                date: document.getElementById(`galleryDate_${galleryId}`)?.value || "",
                category: document.getElementById(`galleryCategory_${galleryId}`)?.value || ""
            });
            gallery.photos = (gallery.photos || []).map((photo) => ({
                ...photo,
                meta: normalizeGalleryPhotoMeta(photo.meta, gallery.meta)
            }));

            const saved = saveGalleryCollection(galleriesInner);
            if (!saved) {
                updateGalleryStatus("No se pudieron guardar los metadatos de la galería.");
                return;
            }
            updateGalleryStatus("Metadatos de galería actualizados.");
            renderGalleryAdminList();
        });
    });

    host.querySelectorAll("[data-action='process-photo']").forEach((button) => {
        button.addEventListener("click", async () => {
            const galleryId = button.getAttribute("data-gallery-id");
            const photoId = button.getAttribute("data-photo-id");
            const galleriesInner = readGalleryCollection();
            const gallery = getGalleryById(galleriesInner, galleryId);
            const photo = gallery?.photos?.find((item) => item.id === photoId);
            const sourcePath = resolvePhotoSourcePath(photo);

            if (!window.AdminSupabase?.isConfigured?.() || !window.AdminSupabase?.getClient?.()) {
                updateGalleryStatus("Configura Supabase e inicia sesión para usar IA.");
                return;
            }

            if (!photo || !sourcePath) {
                updateGalleryStatus("Esta foto no está en Supabase Storage. Súbela o reemplázala y vuelve a intentar IA.");
                return;
            }

            button.disabled = true;
            const originalText = button.textContent;
            button.textContent = "Procesando...";
            updateGalleryStatus("Procesando foto con IA...");
            try {
                await processGalleryPhotoWithAI(photo, galleriesInner);
                updateGalleryStatus("Foto procesada y validada; resultado guardado en photos/processed.");
                renderGalleryAdminList();
            } catch (error) {
                updateGalleryStatus(`No se procesó la foto: ${error?.message || "error de IA"}`);
            } finally {
                button.textContent = originalText || "Procesar con IA";
                button.disabled = false;
            }
        });
    });

    host.querySelectorAll("[data-action='delete-photo']").forEach((button) => {
        button.addEventListener("click", () => {
            const galleryId = button.getAttribute("data-gallery-id");
            const photoId = button.getAttribute("data-photo-id");
            const galleriesInner = readGalleryCollection();
            const gallery = getGalleryById(galleriesInner, galleryId);
            if (!gallery || !Array.isArray(gallery.photos)) return;

            gallery.photos = gallery.photos.filter((photo) => photo.id !== photoId);
            const saved = saveGalleryCollection(galleriesInner);
            if (!saved) {
                updateGalleryStatus("No se pudo guardar cambios en la galería.");
                return;
            }
            updateGalleryStatus("Foto eliminada.");
            renderGalleryAdminList();
        });
    });

    host.querySelectorAll("input[data-action='set-cover']").forEach((input) => {
        input.addEventListener("change", () => {
            const galleryId = input.getAttribute("data-gallery-id");
            const photoId = input.getAttribute("data-photo-id");
            const galleriesInner = readGalleryCollection();
            const gallery = getGalleryById(galleriesInner, galleryId);
            if (!gallery || !Array.isArray(gallery.photos)) return;

            const index = gallery.photos.findIndex((photo) => photo.id === photoId);
            if (index <= 0) return;

            const [selected] = gallery.photos.splice(index, 1);
            gallery.photos.unshift(selected);

            const saved = saveGalleryCollection(galleriesInner);
            if (!saved) {
                updateGalleryStatus("No se pudo guardar cambios en la portada.");
                return;
            }
            updateGalleryStatus("Foto de portada actualizada.");
            renderGalleryAdminList();
        });
    });
}

function renderGalleryDeleteSelect() {
    const select = document.getElementById("galleryDeleteSelect");
    if (!select) return;

    const galleries = readGalleryCollection();
    if (galleries.length === 0) {
        select.innerHTML = '<option value="">No hay galerías</option>';
        return;
    }

    const previousValue = select.value;

    select.innerHTML = galleries
        .map((gallery) => `<option value="${gallery.id}">${escapeHtml(gallery.title?.es || "Galería")}</option>`)
        .join("");

    if (previousValue && galleries.some((gallery) => gallery.id === previousValue)) {
        select.value = previousValue;
    }
}

function deleteSelectedGallery() {
    const select = document.getElementById("galleryDeleteSelect");
    const galleryId = select?.value || "";

    if (!galleryId) {
        updateGalleryStatus("Selecciona una galería para borrar.");
        return;
    }

    const galleries = readGalleryCollection().filter((item) => item.id !== galleryId);
    const saved = saveGalleryCollection(galleries);
    if (!saved) {
        updateGalleryStatus("No se pudo guardar la galería: almacenamiento lleno. Prueba con menos fotos o más pequeñas.");
        return;
    }

    renderGalleryDeleteSelect();
    renderGalleryAdminList();
    updateGalleryStatus("Galería eliminada.");
}

function toggleGalleryEditMode() {
    const editor = document.getElementById("galleryAdminEditor");
    const button = document.getElementById("toggleGalleryEditMode");
    if (!editor || !button) return;

    galleryEditMode = !galleryEditMode;
    editor.classList.toggle("is-hidden", !galleryEditMode);
    button.textContent = galleryEditMode ? "Cerrar editor" : "Editar galerías";
}

async function saveNewGallery() {
    const title = getLocalizedFromInputs("newGalleryTitle");
    const galleryMeta = readNewGalleryMetaInputs();
    const fallbackTitle = buildFallbackGalleryTitle(galleryMeta);
    const hasCustomTitle = String(title.es || "").trim().length > 0;
    const localizedTitle = hasCustomTitle
        ? await buildLocalizedFromSpanish(title.es)
        : normalizeLocalizedText(fallbackTitle);

    if (pendingGalleryPhotos.length === 0) {
        updateGalleryStatus("Sube al menos una foto.");
        return;
    }

    const saveButton = document.getElementById("saveNewGallery");
    if (!window.AdminSupabase?.isConfigured?.() || !window.AdminSupabase?.getClient?.()) {
        updateGalleryStatus("Configura Supabase e inicia sesión para subir fotos.");
        return;
    }

    const galleryId = createId("gallery");
    if (saveButton) saveButton.disabled = true;
    try {
        updateGalleryStatus(`Subiendo ${pendingGalleryPhotos.length} fotos a Supabase Storage…`);
        await uploadGalleryQueue(galleryId);
    } catch (error) {
        const message = error?.message || "No se pudieron subir todas las fotos.";
        galleryUploadRetryPending = true;
        updateGalleryStatus(`Subida pausada: ${message} Se reanudará al recuperar la conexión o al volver a guardar.`);
        renderPendingGalleryPhotos();
        return;
    } finally {
        if (saveButton) saveButton.disabled = false;
    }

    const galleries = readGalleryCollection();

    const localizedPhotos = await Promise.all(pendingGalleryPhotos.map(async (photo) => ({
        id: photo.id,
        src: photo.uploadedUrl,
        storagePath: photo.objectPath,
        sourceSrc: photo.uploadedUrl,
        sourceStoragePath: photo.objectPath,
        processedSrc: "",
        processedStoragePath: "",
        caption: await buildLocalizedFromSpanish(photo.caption?.es || ""),
        meta: normalizeGalleryPhotoMeta(photo.meta, galleryMeta),
        ai: null
    })));

    try {
        await processGalleryPhotosWithAI(localizedPhotos, galleries);
    } catch (error) {
        updateGalleryStatus(`La galería se subió, pero el procesado IA falló en alguna imagen: ${error?.message || "error de IA"}`);
    }

    galleries.push({
        id: galleryId,
        title: localizedTitle,
        meta: galleryMeta,
        photos: localizedPhotos,
        createdAt: new Date().toISOString()
    });

    const saved = saveGalleryCollection(galleries);
    if (!saved) {
        updateGalleryStatus("No se pudo guardar la galería: almacenamiento lleno. Prueba con menos fotos o más pequeñas.");
        return;
    }

    pendingGalleryPhotos.forEach((photo) => {
        if (photo.previewUrl) URL.revokeObjectURL(photo.previewUrl);
    });
    pendingGalleryPhotos = [];
    galleryUploadRetryPending = false;
    clearLocalizedInputs("newGalleryTitle");
    const tournamentInput = document.getElementById("newGalleryTournament");
    const clubInput = document.getElementById("newGalleryClub");
    const dateInput = document.getElementById("newGalleryDate");
    const categoryInput = document.getElementById("newGalleryCategory");
    if (tournamentInput) tournamentInput.value = "";
    if (clubInput) clubInput.value = "";
    if (dateInput) dateInput.value = "";
    if (categoryInput) categoryInput.value = "";
    renderPendingGalleryPhotos();
    renderGalleryDeleteSelect();
    renderGalleryAdminList();
    updateGalleryStatus("Galería guardada correctamente.");

    window.location.href = "index.html#gallery";
}

function renderNewsDeleteSelect() {
    const select = document.getElementById("newsDeleteSelect");
    if (!select) return;

    const newsItems = readNewsCollection();
    if (newsItems.length === 0) {
        select.innerHTML = '<option value="">No hay noticias</option>';
        return;
    }

    select.innerHTML = newsItems
        .map((item) => `<option value="${item.id}">${escapeHtml(item.title?.es || "Noticia")} · ${escapeHtml(getNewsStatusLabel(item.status))}</option>`)
        .join("");
}

function deleteSelectedNews() {
    const select = document.getElementById("newsDeleteSelect");
    const newsId = select?.value || "";
    if (!newsId) {
        updateNewsStatus("Selecciona una noticia para borrar.");
        return;
    }

    const nextCollection = readNewsCollection().filter((item) => item.id !== newsId);
    const saved = saveNewsCollection(nextCollection);
    if (!saved) {
        updateNewsStatus("No se pudo borrar la noticia.");
        return;
    }

    renderNewsDeleteSelect();
    renderNewsAdminList();
    updateNewsStatus("Noticia eliminada.");
}

function toggleNewsEditMode() {
    const editor = document.getElementById("newsAdminEditor");
    const button = document.getElementById("toggleNewsEditMode");
    if (!editor || !button) return;

    newsEditMode = !newsEditMode;
    editor.classList.toggle("is-hidden", !newsEditMode);
    button.textContent = newsEditMode ? "Cerrar editor" : "Editar noticias";
}

function renderNewsAdminList() {
    const host = document.getElementById("newsAdminList");
    if (!host) return;

    const newsItems = readNewsCollection();
    if (newsItems.length === 0) {
        host.innerHTML = '<p class="admin-muted">No hay noticias todavía.</p>';
        return;
    }

    host.innerHTML = newsItems.map((item) => `
        <article class="gallery-admin-card" data-news-id="${item.id}">
            <p class="admin-muted">Estado: <strong>${escapeHtml(getNewsStatusLabel(item.status))}</strong>${item.publishAt ? ` · Publicación: ${escapeHtml(formatAdminDateTime(item.publishAt))}` : ""}</p>
            <img class="gallery-thumb" src="${item.imageSrc}" alt="${escapeHtml(item.title?.es || "Noticia")}">
            <label class="field-label" for="newsReplaceImage_${item.id}">Reemplazar imagen</label>
            <input id="newsReplaceImage_${item.id}" class="news-replace-image" type="file" accept="image/*">
            <label class="field-label" for="newsTitle_${item.id}_es">Título ES</label>
            <input id="newsTitle_${item.id}_es" type="text" value="${escapeHtml(item.title?.es || "")}">

            <div class="results-grid">
                <div>
                    <label class="field-label" for="newsStatus_${item.id}">Estado</label>
                    <select id="newsStatus_${item.id}">
                        <option value="draft" ${item.status === "draft" ? "selected" : ""}>Borrador</option>
                        <option value="published" ${item.status === "published" ? "selected" : ""}>Publicada</option>
                        <option value="scheduled" ${item.status === "scheduled" ? "selected" : ""}>Programada</option>
                    </select>
                </div>
                <div>
                    <label class="field-label" for="newsPublishAt_${item.id}">Fecha publicación</label>
                    <input id="newsPublishAt_${item.id}" type="datetime-local" value="${escapeHtml(formatDateTimeLocalValue(item.publishAt))}">
                </div>
            </div>

            <label class="field-label" for="newsSlug_${item.id}">Slug SEO</label>
            <input id="newsSlug_${item.id}" type="text" value="${escapeHtml(item.seo?.slug || "")}">

            <label class="field-label" for="newsCategory_${item.id}">Categoría</label>
            <input id="newsCategory_${item.id}" type="text" value="${escapeHtml(item.category || "")}">

            <label class="field-label" for="newsPlayer_${item.id}">Jugador</label>
            <input id="newsPlayer_${item.id}" type="text" value="${escapeHtml(item.player || "")}" placeholder="Nombre del jugador (opcional)">

            <label class="field-label" for="newsTags_${item.id}">Etiquetas</label>
            <input id="newsTags_${item.id}" type="text" value="${escapeHtml(formatTagsInput(item.tags))}">

            <label class="field-label" for="newsSeoTitle_${item.id}_es">SEO title ES</label>
            <input id="newsSeoTitle_${item.id}_es" type="text" value="${escapeHtml(item.seo?.title?.es || item.title?.es || "")}">

            <label class="field-label" for="newsSeoDescription_${item.id}_es">SEO description ES</label>
            <textarea id="newsSeoDescription_${item.id}_es" rows="3">${escapeHtml(item.seo?.description?.es || "")}</textarea>

            <label class="field-label" for="newsArticle_${item.id}_es">Artículo ES</label>
            <div class="wysiwyg-toolbar" style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px; padding:6px; background:#081a2a; border:1px solid #1a2a3a; border-radius:6px;">
                <button type="button" class="wysiwyg-btn" onclick="insertFormatTag('newsArticle_${item.id}_es', '<strong>', '</strong>')" style="padding:4px 10px; background:#122b42; color:#fff; border:1px solid #234567; border-radius:4px; font-weight:bold; cursor:pointer;" title="Negrita"><b>B</b> Negrita</button>
                <button type="button" class="wysiwyg-btn" onclick="insertFormatTag('newsArticle_${item.id}_es', '<em>', '</em>')" style="padding:4px 10px; background:#122b42; color:#fff; border:1px solid #234567; border-radius:4px; font-style:italic; cursor:pointer;" title="Cursiva"><i>I</i> Cursiva</button>
                <button type="button" class="wysiwyg-btn" onclick="insertFormatTag('newsArticle_${item.id}_es', '<h2>', '</h2>')" style="padding:4px 10px; background:#122b42; color:#F0D7A2; border:1px solid #234567; border-radius:4px; font-weight:bold; cursor:pointer;" title="Subtítulo">H2 Subtítulo</button>
                <button type="button" class="wysiwyg-btn" onclick="insertFormatTag('newsArticle_${item.id}_es', '<span style=&quot;font-size:1.25em;&quot;>', '</span>')" style="padding:4px 10px; background:#122b42; color:#fff; border:1px solid #234567; border-radius:4px; cursor:pointer;" title="Aumentar tamaño">A+ Tamaño</button>
                <button type="button" class="wysiwyg-btn" onclick="insertFormatTag('newsArticle_${item.id}_es', '<ul>\n  <li>', '</li>\n</ul>')" style="padding:4px 10px; background:#122b42; color:#fff; border:1px solid #234567; border-radius:4px; cursor:pointer;" title="Lista">• Lista</button>
                <button type="button" class="wysiwyg-btn" onclick="insertFormatTag('newsArticle_${item.id}_es', '<a href=&quot;https://&quot; target=&quot;_blank&quot;>', '</a>')" style="padding:4px 10px; background:#122b42; color:#64B5F6; border:1px solid #234567; border-radius:4px; cursor:pointer;" title="Enlace">🔗 Enlace</button>
                <button type="button" class="wysiwyg-btn" onclick="insertFormatTag('newsArticle_${item.id}_es', '<img src=&quot;', '&quot; alt=&quot;Imagen&quot; style=&quot;width:100%; border-radius:8px; margin:15px 0;&quot;>')" style="padding:4px 10px; background:#122b42; color:#81C784; border:1px solid #234567; border-radius:4px; cursor:pointer;" title="Imagen HTML">🖼️ Imagen HTML</button>
                <button type="button" class="wysiwyg-btn" onclick="insertFormatTag('newsArticle_${item.id}_es', '<p>', '</p>')" style="padding:4px 10px; background:#1e3a5f; color:#81D4FA; border:1px solid #29b6f6; border-radius:4px; font-weight:bold; cursor:pointer;" title="Etiqueta HTML Párrafo">&lt;&gt; HTML</button>
                <button type="button" class="wysiwyg-btn" onclick="insertFormatTag('newsArticle_${item.id}_es', '<div style=&quot;margin:20px 0;padding:16px 20px;background:rgba(199,140,50,0.12);border-left:4px solid #C78C32;border-radius:10px;color:#fff;&quot;><h3 style=&quot;margin-top:0;color:#F0D7A2;&quot;>🏆 Título destacado</h3><p style=&quot;margin-bottom:0;&quot;>', '</p></div>')" style="padding:4px 10px; background:#C78C32; color:#000; border:none; border-radius:4px; font-weight:bold; cursor:pointer;" title="Cuadro Destacado">🏆 Cuadro Destacado</button>
            </div>
            <textarea id="newsArticle_${item.id}_es" rows="6">${escapeHtml(item.article?.es || "")}</textarea>

            <p class="admin-muted">URL pública: <a href="${escapeHtml(getNewsPublicUrl(item))}" target="_blank" rel="noopener noreferrer">${escapeHtml(getNewsPublicUrl(item))}</a></p>
            <div class="gallery-photo-actions">
                <button type="button" class="btn-gallery-save" data-action="save-news" data-news-id="${item.id}">Guardar noticia</button>
            </div>
        </article>
    `).join("");

    host.querySelectorAll("[data-action='save-news']").forEach((button) => {
        button.addEventListener("click", async () => {
            try {
                const newsId = button.getAttribute("data-news-id");
                const collection = readNewsCollection();
                const item = collection.find((entry) => entry.id === newsId);
                if (!item) return;

                const titleEs = (document.getElementById(`newsTitle_${newsId}_es`)?.value || "").trim();
                const articleEs = (document.getElementById(`newsArticle_${newsId}_es`)?.value || "").trim();
                const statusValue = document.getElementById(`newsStatus_${newsId}`)?.value || "draft";
                const publishAtValue = document.getElementById(`newsPublishAt_${newsId}`)?.value || "";
                const slugValue = (document.getElementById(`newsSlug_${newsId}`)?.value || "").trim();
                const categoryValue = (document.getElementById(`newsCategory_${newsId}`)?.value || "").trim();
                const playerValue = (document.getElementById(`newsPlayer_${newsId}`)?.value || "").trim();
                const tagsValue = document.getElementById(`newsTags_${newsId}`)?.value || "";
                const seoTitleEs = (document.getElementById(`newsSeoTitle_${newsId}_es`)?.value || "").trim();
                const seoDescriptionEs = (document.getElementById(`newsSeoDescription_${newsId}_es`)?.value || "").trim();

                if (!titleEs || !articleEs) {
                    updateNewsStatus("Escribe título y artículo en español para traducir automáticamente.");
                    return;
                }

                const publication = resolveNewsPublication(statusValue, publishAtValue);
                if (publication.error) {
                    updateNewsStatus(publication.error);
                    return;
                }

                const slug = slugifyText(slugValue || titleEs);
                if (!slug) {
                    updateNewsStatus("Escribe un título válido para generar el slug SEO.");
                    return;
                }

                const title = await buildLocalizedFromSpanish(titleEs);
                const article = await buildLocalizedFromSpanish(articleEs);
                const seoTitle = await buildLocalizedFromSpanish(seoTitleEs || titleEs);
                const seoDescription = await buildLocalizedFromSpanish(seoDescriptionEs || articleEs.slice(0, 160));

                const imageInput = document.getElementById(`newsReplaceImage_${newsId}`);
                const replacement = imageInput?.files?.[0];
                if (replacement) {
                    const uploadedImage = await uploadNewsImageFile(replacement, newsId);
                    item.imageSrc = uploadedImage.imageSrc;
                    item.imageStoragePath = uploadedImage.imageStoragePath;
                }

                item.title = title;
                item.article = article;
                item.status = publication.status;
                item.publishAt = publication.publishAt;
                item.updatedAt = new Date().toISOString();
                item.category = categoryValue;
                item.player = playerValue;
                item.tags = normalizeStringArray(tagsValue);
                item.seo = {
                    slug,
                    title: seoTitle,
                    description: seoDescription
                };

                const saved = saveNewsCollection(collection);
                if (!saved) {
                    updateNewsStatus("No se pudo guardar la noticia.");
                    return;
                }

                updateNewsStatus("Noticia actualizada.");
                renderNewsDeleteSelect();
                renderNewsAdminList();
            } catch (error) {
                updateNewsStatus(`No se pudo actualizar la noticia: ${error?.message || "error inesperado"}`);
            }
        });
    });
}

async function onNewNewsImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
        pendingNewsImageSrc = "";
        return;
    }

    pendingNewsImageSrc = await readFileAsDataUrl(file);
}

async function saveNewNews() {
    try {
        const title = getLocalizedFromInputs("newNewsTitle");
        const article = getLocalizedFromInputs("newNewsArticle");
        const statusValue = document.getElementById("newNewsStatus")?.value || "draft";
        const publishAtValue = document.getElementById("newNewsPublishAt")?.value || "";
        const slugInput = (document.getElementById("newNewsSlug")?.value || "").trim();
        const categoryValue = (document.getElementById("newNewsCategory")?.value || "").trim();
        const playerValue = (document.getElementById("newNewsPlayer")?.value || "").trim();
        const tagsValue = document.getElementById("newNewsTags")?.value || "";
        const seoTitleEs = (document.getElementById("newNewsSeoTitle_es")?.value || "").trim();
        const seoDescriptionEs = (document.getElementById("newNewsSeoDescription_es")?.value || "").trim();

        if (!String(title.es || "").trim() || !String(article.es || "").trim()) {
            updateNewsStatus("Escribe título y artículo en español.");
            return;
        }

        const publication = resolveNewsPublication(statusValue, publishAtValue);
        if (publication.error) {
            updateNewsStatus(publication.error);
            return;
        }

        const slug = slugifyText(slugInput || title.es);
        if (!slug) {
            updateNewsStatus("Escribe un título válido para generar el slug SEO.");
            return;
        }

        if (!pendingNewsImageSrc) {
            updateNewsStatus("Sube una foto para la noticia.");
            return;
        }

        const collection = readNewsCollection();
        const newsId = createId("news");

        const localizedTitle = await buildLocalizedFromSpanish(title.es);
        const localizedArticle = await buildLocalizedFromSpanish(article.es);
        const localizedSeoTitle = await buildLocalizedFromSpanish(seoTitleEs || title.es);
        const localizedSeoDescription = await buildLocalizedFromSpanish(seoDescriptionEs || article.es.slice(0, 160));
        const imageInput = document.getElementById("newNewsImage");
        const imageFile = imageInput?.files?.[0];
        const uploadedImage = imageFile
            ? await uploadNewsImageFile(imageFile, newsId)
            : { imageSrc: pendingNewsImageSrc, imageStoragePath: "" };

        collection.unshift({
            id: newsId,
            imageSrc: uploadedImage.imageSrc || pendingNewsImageSrc,
            imageStoragePath: uploadedImage.imageStoragePath || "",
            title: localizedTitle,
            article: localizedArticle,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            publishAt: publication.publishAt,
            status: publication.status,
            category: categoryValue,
            player: playerValue,
            tags: normalizeStringArray(tagsValue),
            seo: {
                slug,
                title: localizedSeoTitle,
                description: localizedSeoDescription
            }
        });

        const saved = saveNewsCollection(collection);
        if (!saved) {
            updateNewsStatus("No se pudo guardar la noticia: almacenamiento lleno.");
            return;
        }

        clearLocalizedInputs("newNewsTitle");
        clearLocalizedInputs("newNewsArticle");
        if (imageInput) imageInput.value = "";
        const statusInput = document.getElementById("newNewsStatus");
        const publishInput = document.getElementById("newNewsPublishAt");
        const slugField = document.getElementById("newNewsSlug");
        const categoryField = document.getElementById("newNewsCategory");
        const playerField = document.getElementById("newNewsPlayer");
        const tagsField = document.getElementById("newNewsTags");
        const seoTitleField = document.getElementById("newNewsSeoTitle_es");
        const seoDescriptionField = document.getElementById("newNewsSeoDescription_es");
        if (statusInput) statusInput.value = "draft";
        if (publishInput) publishInput.value = "";
        if (slugField) slugField.value = "";
        if (categoryField) categoryField.value = "";
        if (playerField) playerField.value = "";
        if (tagsField) tagsField.value = "";
        if (seoTitleField) seoTitleField.value = "";
        if (seoDescriptionField) seoDescriptionField.value = "";
        pendingNewsImageSrc = "";

        renderNewsDeleteSelect();
        renderNewsAdminList();
        updateNewsStatus("Noticia guardada correctamente.");
    } catch (error) {
        updateNewsStatus(`No se pudo guardar la noticia: ${error?.message || "error inesperado"}`);
    }
}

function initNewsAdmin() {
    const panel = document.getElementById("news-admin-panel");
    if (!panel) return;

    const saveButton = document.getElementById("saveNewNews");
    const imageInput = document.getElementById("newNewsImage");
    const toggleEditorButton = document.getElementById("toggleNewsEditMode");
    const deleteButton = document.getElementById("deleteSelectedNews");
    const titleInput = document.getElementById("newNewsTitle_es");
    const slugInput = document.getElementById("newNewsSlug");

    // Add the player field dynamically so all admin pages get it without editing each HTML file.
    if (!document.getElementById("newNewsPlayer")) {
        const categoryInput = document.getElementById("newNewsCategory");
        if (categoryInput && categoryInput.parentElement) {
            const label = document.createElement("label");
            label.setAttribute("for", "newNewsPlayer");
            label.className = "field-label";
            label.textContent = "Jugador";

            const input = document.createElement("input");
            input.id = "newNewsPlayer";
            input.type = "text";
            input.placeholder = "Nombre del jugador (opcional)";

            categoryInput.parentElement.insertBefore(label, categoryInput.nextSibling);
            categoryInput.parentElement.insertBefore(input, label.nextSibling);
        }
    }

    if (saveButton) {
        saveButton.addEventListener("click", saveNewNews);
    }
    if (imageInput) {
        imageInput.addEventListener("change", onNewNewsImageChange);
    }
    if (toggleEditorButton) {
        toggleEditorButton.addEventListener("click", toggleNewsEditMode);
    }
    if (deleteButton) {
        deleteButton.addEventListener("click", deleteSelectedNews);
    }
    if (titleInput && slugInput) {
        titleInput.addEventListener("input", () => {
            if (slugInput.dataset.edited === "1" && slugInput.value) return;
            slugInput.value = slugifyText(titleInput.value);
        });
        slugInput.addEventListener("input", () => {
            slugInput.dataset.edited = slugInput.value ? "1" : "";
        });
    }

    renderNewsDeleteSelect();
    renderNewsAdminList();
}

function initGalleryAdmin() {
    const panel = document.getElementById("gallery-admin-panel");
    if (!panel) return;

    const filesInput = document.getElementById("newGalleryFiles");
    const folderInput = document.getElementById("newGalleryFolder");
    const saveButton = document.getElementById("saveNewGallery");
    const toggleEditorButton = document.getElementById("toggleGalleryEditMode");
    const deleteGalleryButton = document.getElementById("deleteSelectedGallery");
    const gallerySelect = document.getElementById("galleryDeleteSelect");
    const newGalleryTitleVa = document.getElementById("newGalleryTitle_va");
    const newGalleryTitleEn = document.getElementById("newGalleryTitle_en");
    const newGalleryTitleFr = document.getElementById("newGalleryTitle_fr");

    if (filesInput) {
        filesInput.addEventListener("change", onNewGalleryFilesChange);
    }

    if (folderInput) {
        folderInput.addEventListener("change", onNewGalleryFilesChange);
    }

    if (!galleryUploadOnlineListenerBound) {
        window.addEventListener("online", () => {
            if (!galleryUploadRetryPending || pendingGalleryPhotos.length === 0) return;
            galleryUploadRetryPending = false;
            saveNewGallery();
        });
        galleryUploadOnlineListenerBound = true;
    }

    if (saveButton) {
        saveButton.addEventListener("click", saveNewGallery);
    }

    if (toggleEditorButton) {
        toggleEditorButton.addEventListener("click", toggleGalleryEditMode);
    }

    if (deleteGalleryButton) {
        deleteGalleryButton.addEventListener("click", deleteSelectedGallery);
    }

    if (gallerySelect) {
        gallerySelect.addEventListener("change", () => {
            renderGalleryAdminList();
        });
    }

    [newGalleryTitleVa, newGalleryTitleEn, newGalleryTitleFr].forEach((input) => {
        if (!input) return;
        input.value = "";
        input.disabled = true;
        input.placeholder = "Automático desde ES";
        const container = input.closest("div");
        if (container) {
            container.style.display = "none";
        }
    });

    renderPendingGalleryPhotos();
    renderGalleryDeleteSelect();
    renderGalleryAdminList();
}

function updatePlayersStatus(message) {
    const el = document.getElementById("playersAdminStatus");
    if (!el) return;
    el.textContent = message;
}

function updateSponsorsStatus(message) {
    const el = document.getElementById("sponsorsAdminStatus");
    if (!el) return;
    el.textContent = message;
}

function normalizePlayerImagePath(pathValue) {
    const raw = String(pathValue || "").trim();
    if (!raw) return "";
    if (raw.startsWith("data:")) return raw;
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.includes("/")) return raw;
    return `assets/images/players/${raw}`;
}

function normalizeSponsorImagePath(pathValue) {
    const raw = String(pathValue || "").trim();
    if (!raw) return "";
    if (raw.startsWith("data:")) return raw;
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.includes("/")) return raw;
    return `assets/images/sponsors/${raw}`;
}

function guessSponsorNameFromImage(imagePath, imageFile) {
    const fromFile = String(imageFile?.name || "").trim();
    const fromPath = String(imagePath || "").trim();
    const source = fromFile || fromPath;
    if (!source) return "";

    const fileName = source.split("/").pop() || source;
    const noExt = fileName.replace(/\.[^.]+$/, "");
    const readable = noExt
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (!readable) return "";

    return readable
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function normalizePlayerItem(item) {
    return {
        id: item?.id || createId("player"),
        name: String(item?.name || "").trim(),
        country: String(item?.country || "").trim().toUpperCase(),
        ranking: Number(item?.ranking) || "",
        image: normalizePlayerImagePath(item?.image || item?.imageSrc || ""),
        seed: String(item?.seed || "").trim(),
        photoPosition: String(item?.photoPosition || "").trim()
    };
}

function normalizeSponsorItem(item) {
    return {
        id: item?.id || createId("sponsor"),
        name: String(item?.name || "Sponsor").trim() || "Sponsor",
        link: String(item?.link || item?.href || "#").trim() || "#",
        imageSrc: normalizeSponsorImagePath(item?.imageSrc || item?.src || ""),
        cardClass: String(item?.cardClass || "sponsor-card").trim() || "sponsor-card"
    };
}

function readPlayersFromStorage() {
    try {
        const raw = localStorage.getItem(PLAYERS_COLLECTION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return null;
        return parsed.map(normalizePlayerItem).filter((item) => item.name && item.country && item.image);
    } catch (error) {
        return null;
    }
}

function savePlayersToStorage(collection) {
    try {
        localStorage.setItem(PLAYERS_COLLECTION_KEY, JSON.stringify(collection));
        if (window.PSACloudStore?.saveLocalStorageKeyToCloud) {
            window.PSACloudStore.saveLocalStorageKeyToCloud(PLAYERS_COLLECTION_KEY);
        }
        window.PSAOptimizations?.clearFetchCache?.();
        return true;
    } catch (error) {
        return false;
    }
}

async function readBasePlayersFromFile() {
    try {
        const response = await fetch("data/players.json", { cache: "no-store" });
        if (!response.ok) return [];
        const payload = await response.json();
        if (!Array.isArray(payload)) return [];
        return payload
            .map((item, index) => normalizePlayerItem({ ...item, id: `player_base_${index}` }))
            .filter((entry) => entry.name && entry.country && entry.image);
    } catch (error) {
        return [];
    }
}

async function getPlayersCollectionForAdmin() {
    const stored = readPlayersFromStorage();
    if (stored) return stored;
    return readBasePlayersFromFile();
}

function readSponsorsFromStorage() {
    try {
        const raw = localStorage.getItem(SPONSORS_COLLECTION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return null;
        return parsed.map(normalizeSponsorItem).filter((item) => item.imageSrc);
    } catch (error) {
        return null;
    }
}

function saveSponsorsToStorage(collection) {
    try {
        localStorage.setItem(SPONSORS_COLLECTION_KEY, JSON.stringify(collection));
        return true;
    } catch (error) {
        return false;
    }
}

function getSponsorsCollectionForAdmin() {
    const stored = readSponsorsFromStorage();
    if (Array.isArray(stored) && stored.length > 0) {
        return stored;
    }
    return getDefaultSponsors();
}

function getDefaultSponsors() {
    return [
        { id: "sponsor_default_olympia", name: "Olympia", link: "https://www.olympiahotel.com/", imageSrc: "assets/images/sponsors/olympia.png", cardClass: "sponsor-card sponsor-card-olympia" },
        { id: "sponsor_default_01", name: "Sponsor 01", link: "#", imageSrc: "assets/images/sponsors/sponsor-01.jpg", cardClass: "sponsor-card" },
        { id: "sponsor_default_02", name: "Sponsor 02", link: "#", imageSrc: "assets/images/sponsors/sponsor-02.jpg", cardClass: "sponsor-card" },
        { id: "sponsor_default_03", name: "Sponsor 03", link: "#", imageSrc: "assets/images/sponsors/sponsor-03.jpg", cardClass: "sponsor-card" },
        { id: "sponsor_default_04", name: "Sponsor 04", link: "#", imageSrc: "assets/images/sponsors/sponsor-04.jpg", cardClass: "sponsor-card" },
        { id: "sponsor_default_05", name: "Sponsor 05", link: "#", imageSrc: "assets/images/sponsors/sponsor-05.jpg", cardClass: "sponsor-card" },
        { id: "sponsor_default_06", name: "Sponsor 06", link: "#", imageSrc: "assets/images/sponsors/sponsor-06.jpg", cardClass: "sponsor-card" },
        { id: "sponsor_default_07", name: "Sponsor 07", link: "#", imageSrc: "assets/images/sponsors/sponsor-07.jpg", cardClass: "sponsor-card" },
        { id: "sponsor_default_08", name: "Sponsor 08", link: "#", imageSrc: "assets/images/sponsors/sponsor-08.jpg", cardClass: "sponsor-card" },
        { id: "sponsor_default_09", name: "Sponsor 09", link: "#", imageSrc: "assets/images/sponsors/sponsor-09.jpg", cardClass: "sponsor-card" },
        { id: "sponsor_default_10", name: "Sponsor 10", link: "#", imageSrc: "assets/images/sponsors/sponsor-10.jpg", cardClass: "sponsor-card" }
    ].map(normalizeSponsorItem);
}

async function createPlayerFromInputs() {
    const name = (document.getElementById("newPlayerName")?.value || "").trim();
    const country = (document.getElementById("newPlayerCountry")?.value || "").trim().toUpperCase();
    const rankingRaw = (document.getElementById("newPlayerRanking")?.value || "").trim();
    const seed = (document.getElementById("newPlayerSeed")?.value || "").trim();
    const photoPosition = (document.getElementById("newPlayerPhotoPosition")?.value || "").trim();
    const imagePath = normalizePlayerImagePath((document.getElementById("newPlayerImagePath")?.value || "").trim());
    const imageFile = document.getElementById("newPlayerImage")?.files?.[0] || null;

    if (!name || !country || !rankingRaw) {
        updatePlayersStatus("Nombre, país y ranking son obligatorios.");
        return null;
    }

    let image = imagePath;
    if (imageFile) {
        image = await readFileAsDataUrl(imageFile);
    }

    if (!image) {
        updatePlayersStatus("Indica ruta de imagen o sube una foto para el jugador.");
        return null;
    }

    return normalizePlayerItem({
        id: createId("player"),
        name,
        country,
        ranking: Number(rankingRaw),
        image,
        seed,
        photoPosition
    });
}

async function createSponsorFromInputs() {
    const name = (document.getElementById("newSponsorName")?.value || "").trim();
    const link = (document.getElementById("newSponsorLink")?.value || "").trim();
    const imagePath = normalizeSponsorImagePath((document.getElementById("newSponsorImagePath")?.value || "").trim());
    const imageFile = document.getElementById("newSponsorImage")?.files?.[0] || null;

    let imageSrc = imagePath;
    if (imageFile) {
        imageSrc = await readFileAsDataUrl(imageFile);
    }

    if (!imageSrc) {
        updateSponsorsStatus("Indica ruta de imagen o sube una imagen para el sponsor.");
        return null;
    }

    const resolvedName = name || guessSponsorNameFromImage(imagePath, imageFile) || "Sponsor";

    return normalizeSponsorItem({
        id: createId("sponsor"),
        name: resolvedName,
        link: link || "#",
        imageSrc,
        cardClass: "sponsor-card"
    });
}

async function renderPlayersAdminList() {
    const host = document.getElementById("playersAdminList");
    if (!host) return;

    const players = await getPlayersCollectionForAdmin();
    if (players.length === 0) {
        host.innerHTML = '<p class="admin-muted">No hay jugadores cargados.</p>';
        return;
    }

    host.innerHTML = players.map((player) => `
        <article class="gallery-admin-card" data-player-id="${player.id}">
            <img class="gallery-thumb" src="${escapeHtml(player.image)}" alt="${escapeHtml(player.name)}">
            <label class="field-label" for="playerName_${player.id}">Nombre</label>
            <input id="playerName_${player.id}" type="text" value="${escapeHtml(player.name)}">
            <div class="results-grid">
                <div>
                    <label class="field-label" for="playerCountry_${player.id}">País</label>
                    <input id="playerCountry_${player.id}" type="text" value="${escapeHtml(player.country)}" maxlength="3">
                </div>
                <div>
                    <label class="field-label" for="playerRanking_${player.id}">Ranking</label>
                    <input id="playerRanking_${player.id}" type="number" min="1" value="${escapeHtml(player.ranking)}">
                </div>
            </div>
            <div class="results-grid">
                <div>
                    <label class="field-label" for="playerSeed_${player.id}">Seed</label>
                    <input id="playerSeed_${player.id}" type="text" value="${escapeHtml(player.seed || "")}">
                </div>
                <div>
                    <label class="field-label" for="playerPhotoPos_${player.id}">Posición foto</label>
                    <input id="playerPhotoPos_${player.id}" type="text" value="${escapeHtml(player.photoPosition || "")}">
                </div>
            </div>
            <label class="field-label" for="playerImagePath_${player.id}">Ruta imagen</label>
            <input id="playerImagePath_${player.id}" type="text" value="${escapeHtml(player.image)}">
            <label class="field-label" for="playerImageFile_${player.id}">O subir imagen nueva</label>
            <input id="playerImageFile_${player.id}" type="file" accept="image/*">
            <div class="gallery-photo-actions">
                <button type="button" class="btn-gallery-save" data-action="save-player" data-player-id="${player.id}">Guardar</button>
                <button type="button" class="btn-gallery-danger" data-action="delete-player" data-player-id="${player.id}">Borrar</button>
            </div>
        </article>
    `).join("");

    host.querySelectorAll("[data-action='save-player']").forEach((button) => {
        button.addEventListener("click", async () => {
            const playerId = button.getAttribute("data-player-id");
            const collection = await getPlayersCollectionForAdmin();
            const player = collection.find((entry) => entry.id === playerId);
            if (!player) return;

            const name = (document.getElementById(`playerName_${playerId}`)?.value || "").trim();
            const country = (document.getElementById(`playerCountry_${playerId}`)?.value || "").trim().toUpperCase();
            const rankingRaw = (document.getElementById(`playerRanking_${playerId}`)?.value || "").trim();
            const seed = (document.getElementById(`playerSeed_${playerId}`)?.value || "").trim();
            const photoPosition = (document.getElementById(`playerPhotoPos_${playerId}`)?.value || "").trim();
            const imagePath = normalizePlayerImagePath((document.getElementById(`playerImagePath_${playerId}`)?.value || "").trim());
            const fileInput = document.getElementById(`playerImageFile_${playerId}`);
            const file = fileInput?.files?.[0] || null;

            if (!name || !country || !rankingRaw) {
                updatePlayersStatus("Nombre, país y ranking son obligatorios para guardar.");
                return;
            }

            let image = imagePath;
            if (file) {
                image = await readFileAsDataUrl(file);
            }

            if (!image) {
                updatePlayersStatus("Cada jugador debe tener imagen.");
                return;
            }

            Object.assign(player, normalizePlayerItem({
                id: player.id,
                name,
                country,
                ranking: Number(rankingRaw),
                image,
                seed,
                photoPosition
            }));

            const saved = savePlayersToStorage(collection);
            if (!saved) {
                updatePlayersStatus("No se pudo guardar la lista de jugadores.");
                return;
            }

            updatePlayersStatus("Jugador actualizado.");
            renderPlayersAdminList();
        });
    });

    host.querySelectorAll("[data-action='delete-player']").forEach((button) => {
        button.addEventListener("click", async () => {
            const playerId = button.getAttribute("data-player-id");
            const collection = await getPlayersCollectionForAdmin();
            const next = collection.filter((entry) => entry.id !== playerId);
            const saved = savePlayersToStorage(next);
            if (!saved) {
                updatePlayersStatus("No se pudo borrar el jugador.");
                return;
            }

            updatePlayersStatus("Jugador eliminado.");
            renderPlayersAdminList();
        });
    });
}

async function renderSponsorsAdminList() {
    const host = document.getElementById("sponsorsAdminList");
    if (!host) return;

    const sponsors = getSponsorsCollectionForAdmin();
    if (sponsors.length === 0) {
        host.innerHTML = '<p class="admin-muted">No hay sponsors cargados.</p>';
        return;
    }

    host.innerHTML = sponsors.map((sponsor) => `
        <article class="gallery-admin-card" data-sponsor-id="${sponsor.id}">
            <img class="gallery-thumb" src="${escapeHtml(sponsor.imageSrc)}" alt="${escapeHtml(sponsor.name)}">
            <label class="field-label" for="sponsorName_${sponsor.id}">Nombre</label>
            <input id="sponsorName_${sponsor.id}" type="text" value="${escapeHtml(sponsor.name)}">
            <label class="field-label" for="sponsorLink_${sponsor.id}">Enlace</label>
            <input id="sponsorLink_${sponsor.id}" type="url" value="${escapeHtml(sponsor.link || "#")}">
            <label class="field-label" for="sponsorImagePath_${sponsor.id}">Ruta imagen</label>
            <input id="sponsorImagePath_${sponsor.id}" type="text" value="${escapeHtml(sponsor.imageSrc)}">
            <label class="field-label" for="sponsorImageFile_${sponsor.id}">O subir imagen nueva</label>
            <input id="sponsorImageFile_${sponsor.id}" type="file" accept="image/*">
            <div class="gallery-photo-actions">
                <button type="button" class="btn-gallery-save" data-action="save-sponsor" data-sponsor-id="${sponsor.id}">Guardar</button>
                <button type="button" class="btn-gallery-danger" data-action="delete-sponsor" data-sponsor-id="${sponsor.id}">Borrar</button>
            </div>
        </article>
    `).join("");

    host.querySelectorAll("[data-action='save-sponsor']").forEach((button) => {
        button.addEventListener("click", async () => {
            const sponsorId = button.getAttribute("data-sponsor-id");
            const collection = getSponsorsCollectionForAdmin();
            const sponsor = collection.find((entry) => entry.id === sponsorId);
            if (!sponsor) return;

            const name = (document.getElementById(`sponsorName_${sponsorId}`)?.value || "").trim();
            const link = (document.getElementById(`sponsorLink_${sponsorId}`)?.value || "").trim();
            const pathValue = normalizeSponsorImagePath((document.getElementById(`sponsorImagePath_${sponsorId}`)?.value || "").trim());
            const fileInput = document.getElementById(`sponsorImageFile_${sponsorId}`);
            const file = fileInput?.files?.[0] || null;

            if (!name) {
                updateSponsorsStatus("El nombre del sponsor es obligatorio.");
                return;
            }

            let imageSrc = pathValue;
            if (file) {
                imageSrc = await readFileAsDataUrl(file);
            }

            if (!imageSrc) {
                updateSponsorsStatus("Cada sponsor debe tener imagen.");
                return;
            }

            Object.assign(sponsor, normalizeSponsorItem({
                id: sponsor.id,
                name,
                link: link || "#",
                imageSrc,
                cardClass: sponsor.cardClass || "sponsor-card"
            }));

            const saved = saveSponsorsToStorage(collection);
            if (!saved) {
                updateSponsorsStatus("No se pudo guardar la lista de sponsors.");
                return;
            }

            updateSponsorsStatus("Sponsor actualizado.");
            renderSponsorsAdminList();
        });
    });

    host.querySelectorAll("[data-action='delete-sponsor']").forEach((button) => {
        button.addEventListener("click", () => {
            const sponsorId = button.getAttribute("data-sponsor-id");
            const collection = getSponsorsCollectionForAdmin();
            const next = collection.filter((entry) => entry.id !== sponsorId);

            const saved = saveSponsorsToStorage(next);
            if (!saved) {
                updateSponsorsStatus("No se pudo borrar el sponsor.");
                return;
            }

            updateSponsorsStatus("Sponsor eliminado.");
            renderSponsorsAdminList();
        });
    });
}

async function saveNewPlayer() {
    const newPlayer = await createPlayerFromInputs();
    if (!newPlayer) return;

    const collection = await getPlayersCollectionForAdmin();
    collection.push(newPlayer);

    const saved = savePlayersToStorage(collection);
    if (!saved) {
        updatePlayersStatus("No se pudo guardar el nuevo jugador.");
        return;
    }

    ["newPlayerName", "newPlayerCountry", "newPlayerRanking", "newPlayerSeed", "newPlayerPhotoPosition", "newPlayerImagePath"].forEach((id) => {
        const input = document.getElementById(id);
        if (input) input.value = "";
    });
    const imageInput = document.getElementById("newPlayerImage");
    if (imageInput) imageInput.value = "";

    updatePlayersStatus("Jugador añadido correctamente.");
    renderPlayersAdminList();
}

async function saveNewSponsor() {
    const newSponsor = await createSponsorFromInputs();
    if (!newSponsor) return;

    const collection = getSponsorsCollectionForAdmin();
    collection.push(newSponsor);

    const saved = saveSponsorsToStorage(collection);
    if (!saved) {
        updateSponsorsStatus("No se pudo guardar el nuevo sponsor.");
        return;
    }

    ["newSponsorName", "newSponsorLink", "newSponsorImagePath"].forEach((id) => {
        const input = document.getElementById(id);
        if (input) input.value = "";
    });
    const imageInput = document.getElementById("newSponsorImage");
    if (imageInput) imageInput.value = "";

    updateSponsorsStatus("Sponsor añadido correctamente.");
    renderSponsorsAdminList();
}

function resetSponsorsCollection() {
    const defaults = getDefaultSponsors();
    const saved = saveSponsorsToStorage(defaults);
    if (!saved) {
        updateSponsorsStatus("No se pudo restaurar la lista base de sponsors.");
        return;
    }

    updateSponsorsStatus("Sponsors base restaurados.");
    renderSponsorsAdminList();
}

function resetPlayersCollection() {
    localStorage.removeItem(PLAYERS_COLLECTION_KEY);
    updatePlayersStatus("Jugadores base restaurados.");
    renderPlayersAdminList();
}

function initPlayersAdmin() {
    const panel = document.getElementById("players-admin-panel");
    if (!panel) return;

    const saveBtn = document.getElementById("saveNewPlayer");
    const resetBtn = document.getElementById("resetPlayersCollection");

    if (saveBtn) {
        saveBtn.addEventListener("click", saveNewPlayer);
    }
    if (resetBtn) {
        resetBtn.addEventListener("click", resetPlayersCollection);
    }

    renderPlayersAdminList();
}

function initSponsorsAdmin() {
    const panel = document.getElementById("sponsors-admin-panel");
    if (!panel) return;

    const saveBtn = document.getElementById("saveNewSponsor");
    const resetBtn = document.getElementById("resetSponsorsCollection");

    if (saveBtn) {
        saveBtn.addEventListener("click", saveNewSponsor);
    }
    if (resetBtn) {
        resetBtn.addEventListener("click", resetSponsorsCollection);
    }

    renderSponsorsAdminList();
}

function toScore(value) {
    if (value === "" || value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function isMutedPlayer(name) {
    return !name || name === "TBD" || name === "BYE";
}

function isByePlayer(name) {
    return name === "BYE";
}

function countSetsWon(games, side) {
    const mine = side === "p1" ? "p1" : "p2";
    const opp = side === "p1" ? "p2" : "p1";
    return games.reduce((sum, game) => {
        const m = toScore(game?.[mine]);
        const o = toScore(game?.[opp]);
        if (m === null || o === null) return sum;
        return m > o ? sum + 1 : sum;
    }, 0);
}

function getMatchWinner(match) {
    if (match.p1?.name === "BYE" && !isMutedPlayer(match.p2?.name)) return match.p2;
    if (match.p2?.name === "BYE" && !isMutedPlayer(match.p1?.name)) return match.p1;
    if (isMutedPlayer(match.p1?.name) || isMutedPlayer(match.p2?.name)) return null;

    const p1Sets = countSetsWon(match.games, "p1");
    const p2Sets = countSetsWon(match.games, "p2");
    if (p1Sets === p2Sets) return null;
    return p1Sets > p2Sets ? match.p1 : match.p2;
}

function buildGamesFromSets(p1Sets, p2Sets) {
    const games = [];

    for (let i = 0; i < p1Sets; i += 1) {
        games.push({ p1: 11, p2: 7 });
    }

    for (let i = 0; i < p2Sets; i += 1) {
        games.push({ p1: 7, p2: 11 });
    }

    return Array.from({ length: 5 }, (_, i) => games[i] || { p1: null, p2: null });
}

function normalizeBracket(bracket) {
    bracket.rounds.forEach((round) => {
        round.matches.forEach((match) => {
            if (!match.p1) match.p1 = { name: "TBD" };
            if (!match.p2) match.p2 = { name: "TBD" };
            if (!Array.isArray(match.games)) {
                match.games = Array.from({ length: 5 }, () => ({ p1: null, p2: null }));
            }
            if (match.games.length < 5) {
                const missing = 5 - match.games.length;
                for (let i = 0; i < missing; i += 1) {
                    match.games.push({ p1: null, p2: null });
                }
            }
        });
    });
}

function autoAdvanceBracket(bracket) {
    for (let roundIndex = 1; roundIndex < bracket.rounds.length; roundIndex += 1) {
        bracket.rounds[roundIndex].matches.forEach((match) => {
            match.p1 = { name: "TBD" };
            match.p2 = { name: "TBD" };
            if (!Array.isArray(match.games)) {
                match.games = Array.from({ length: 5 }, () => ({ p1: null, p2: null }));
            }
            match.games = match.games.map(() => ({ p1: null, p2: null }));
        });
    }

    for (let roundIndex = 0; roundIndex < bracket.rounds.length - 1; roundIndex += 1) {
        const currentRound = bracket.rounds[roundIndex];
        const nextRound = bracket.rounds[roundIndex + 1];

        currentRound.matches.forEach((match, matchIndex) => {
            const winner = getMatchWinner(match);
            if (!winner) return;
            const nextMatchIndex = Math.floor(matchIndex / 2);
            const slot = matchIndex % 2 === 0 ? "p1" : "p2";
            if (!nextRound.matches[nextMatchIndex]) return;
            nextRound.matches[nextMatchIndex][slot] = {
                name: winner.name,
                image: winner.image || null
            };
        });
    }
}

function updateDrawStatus(message) {
    const el = document.getElementById("drawAdminStatus");
    if (!el) return;
    el.textContent = message;
}

function updateScheduleStatus(message) {
    const el = document.getElementById("scheduleAdminStatus");
    if (!el) return;
    el.textContent = message;
}

function updateDrawBuilderStatus(message) {
    const el = document.getElementById("drawBuilderStatus");
    if (!el) return;
    el.textContent = message;
}

function normalizeDrawPlayerName(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\(\d+\)$/, "")
        .replace(/[^a-zA-Z0-9]+/g, " ")
        .toLowerCase()
        .trim();
}

function extractSeedNumber(seedValue) {
    const raw = String(seedValue || "").trim();
    const match = raw.match(/\[(\d+)\]/);
    return match ? match[1] : "";
}

function formatDrawPlayerName(player) {
    const name = String(player?.name || "").trim();
    if (!name) return "";
    const seedNumber = extractSeedNumber(player?.seed);
    return seedNumber ? `${name} (${seedNumber})` : name;
}

async function getDrawBuilderPlayers() {
    const players = await getPlayersCollectionForAdmin();
    return [...players].sort((a, b) => {
        const rankA = Number(a?.ranking) || Number.MAX_SAFE_INTEGER;
        const rankB = Number(b?.ranking) || Number.MAX_SAFE_INTEGER;
        return rankA - rankB;
    });
}

function findPlayerForDrawName(name, players) {
    const target = normalizeDrawPlayerName(name);
    if (!target) return null;

    for (const player of players) {
        const byName = normalizeDrawPlayerName(player?.name);
        const byFormatted = normalizeDrawPlayerName(formatDrawPlayerName(player));
        if (target === byName || target === byFormatted) {
            return player;
        }
    }

    return null;
}

function findPlayerBySeed(players, seedNumber) {
    const target = String(seedNumber || "").trim();
    if (!target) return null;
    return players.find((player) => extractSeedNumber(player?.seed) === target) || null;
}

function getForcedSeedAssignments(players, totalMatches) {
    const seed1 = findPlayerBySeed(players, "1");
    const seed2 = findPlayerBySeed(players, "2");
    const lastMatchIndex = Math.max(0, totalMatches - 1);

    return {
        seed1,
        seed2,
        bySlot: {
            "0_p1": seed1?.id || "",
            [`${lastMatchIndex}_p2`]: seed2?.id || ""
        }
    };
}

function resolveSelectionKeyForDuplicates(selectedValue, existingSlot, players) {
    if (selectedValue === "__BYE__" || selectedValue === "__TBD__") {
        return "";
    }

    if (selectedValue === "__KEEP__") {
        const currentName = String(existingSlot?.name || "").trim();
        if (isMutedPlayer(currentName)) return "";

        const matched = findPlayerForDrawName(currentName, players);
        if (matched?.id) return `player:${matched.id}`;

        const normalized = normalizeDrawPlayerName(currentName);
        return normalized ? `name:${normalized}` : "";
    }

    return `player:${selectedValue}`;
}

function getSelectionLabel(selectedValue, existingSlot, players) {
    if (selectedValue === "__BYE__") return "BYE";
    if (selectedValue === "__TBD__") return "TBD";
    if (selectedValue === "__KEEP__") return String(existingSlot?.name || "TBD").trim() || "TBD";

    const player = players.find((entry) => entry.id === selectedValue);
    return player ? (formatDrawPlayerName(player) || player.name) : "Jugador";
}

function buildDrawBuilderSelect(selectId, currentName, players) {
    const cleanName = String(currentName || "").trim();
    const isBye = cleanName === "BYE";
    const isTbd = cleanName === "TBD" || !cleanName;
    const matchedPlayer = findPlayerForDrawName(cleanName, players);

    const options = [];
    options.push(`<option value="__TBD__" ${isTbd ? "selected" : ""}>TBD</option>`);
    options.push(`<option value="__BYE__" ${isBye ? "selected" : ""}>BYE</option>`);

    players.forEach((player) => {
        const label = formatDrawPlayerName(player) || player.name;
        const selected = matchedPlayer?.id === player.id ? "selected" : "";
        options.push(`<option value="${escapeHtml(player.id)}" ${selected}>${escapeHtml(label)}</option>`);
    });
    if (!isBye && !isTbd && !matchedPlayer) {
        options.unshift(`<option value="__KEEP__" selected>${escapeHtml(cleanName)}</option>`);
    }

    return `
        <select id="${selectId}" class="draw-builder-select">
            ${options.join("")}
        </select>
    `;
}

async function renderDrawBuilder() {
    const panel = document.getElementById("draw-builder-panel");
    const host = document.getElementById("drawBuilderGrid");
    if (!panel || !host || !drawState?.rounds?.[0]?.matches) return;

    const players = await getDrawBuilderPlayers();
    const roundOneMatches = drawState.rounds[0].matches;

    host.innerHTML = roundOneMatches.map((match, index) => {
        const p1SelectId = `drawBuilder_${index}_p1`;
        const p2SelectId = `drawBuilder_${index}_p2`;
        const p1CurrentName = match?.p1?.name;
        const p2CurrentName = match?.p2?.name;

        return `
            <article class="draw-builder-card" data-match-index="${index}">
                <h3>Partido ${index + 1}</h3>
                <label class="field-label" for="${p1SelectId}">Posición ${index * 2 + 1}</label>
                ${buildDrawBuilderSelect(p1SelectId, p1CurrentName, players)}
                <label class="field-label" for="${p2SelectId}">Posición ${index * 2 + 2}</label>
                ${buildDrawBuilderSelect(p2SelectId, p2CurrentName, players)}
            </article>
        `;
    }).join("");

    updateDrawBuilderStatus("Selecciona libremente cada jugador para los cruces.");
}

function buildDrawSlotFromSelection(selectedValue, existingSlot, players) {
    if (selectedValue === "__BYE__") {
        return { name: "BYE" };
    }
    if (selectedValue === "__TBD__") {
        return { name: "TBD" };
    }
    if (selectedValue === "__KEEP__") {
        return {
            name: String(existingSlot?.name || "TBD").trim() || "TBD",
            image: existingSlot?.image || null
        };
    }

    const player = players.find((entry) => entry.id === selectedValue);
    if (!player) {
        return { name: "TBD" };
    }

    return {
        name: formatDrawPlayerName(player) || player.name,
        image: player.image || null
    };
}

async function saveDrawBuilderAssignments() {
    const panel = document.getElementById("draw-builder-panel");
    if (!panel || !drawState?.rounds?.[0]?.matches) return;

    const players = await getDrawBuilderPlayers();
    const roundOneMatches = drawState.rounds[0].matches;
    const selections = [];

    roundOneMatches.forEach((match, index) => {
        const p1Value = document.getElementById(`drawBuilder_${index}_p1`)?.value || "__TBD__";
        const p2Value = document.getElementById(`drawBuilder_${index}_p2`)?.value || "__TBD__";

        selections.push({
            index,
            slot: "p1",
            value: p1Value,
            existingSlot: match.p1
        });
        selections.push({
            index,
            slot: "p2",
            value: p2Value,
            existingSlot: match.p2
        });
    });

    const used = new Map();
    for (const entry of selections) {
        const key = resolveSelectionKeyForDuplicates(entry.value, entry.existingSlot, players);
        if (!key) continue;

        const label = getSelectionLabel(entry.value, entry.existingSlot, players);
        if (used.has(key)) {
            updateDrawBuilderStatus(`Jugador duplicado: ${label}. Cada jugador solo puede aparecer una vez.`);
            return;
        }
        used.set(key, true);
    }

    roundOneMatches.forEach((match, index) => {
        const p1Entry = selections.find((entry) => entry.index === index && entry.slot === "p1");
        const p2Entry = selections.find((entry) => entry.index === index && entry.slot === "p2");
        const p1Value = p1Entry?.value || "__TBD__";
        const p2Value = p2Entry?.value || "__TBD__";

        match.p1 = buildDrawSlotFromSelection(p1Value, match.p1, players);
        match.p2 = buildDrawSlotFromSelection(p2Value, match.p2, players);
        match.games = Array.from({ length: 5 }, () => ({ p1: null, p2: null }));
    });

    autoAdvanceBracket(drawState);
    saveDrawState();
    populateRoundSelect();
    populateScheduleRoundSelect();
    fillMatchEditor();
    fillScheduleEditor();
    updateDrawBuilderStatus("Cruces guardados correctamente.");
}

function initDrawBuilder() {
    const panel = document.getElementById("draw-builder-panel");
    if (!panel) return;

    const saveBtn = document.getElementById("saveDrawBuilder");
    const resetBtn = document.getElementById("resetDrawBuilderToBase");

    if (saveBtn) {
        saveBtn.addEventListener("click", saveDrawBuilderAssignments);
    }
    if (resetBtn) {
        resetBtn.addEventListener("click", async () => {
            await createDrawFromZero();
            await renderDrawBuilder();
            updateDrawBuilderStatus("Cruces base restaurados.");
        });
    }

    renderDrawBuilder();
}

function getSelectedMatch() {
    const roundSelect = document.getElementById("roundSelect");
    const matchSelect = document.getElementById("matchSelect");
    if (!drawState || !roundSelect || !matchSelect) return null;
    const r = Number(roundSelect.value);
    const m = Number(matchSelect.value);
    if (!drawState.rounds[r] || !drawState.rounds[r].matches[m]) return null;
    return { roundIndex: r, matchIndex: m, match: drawState.rounds[r].matches[m] };
}

function setResultInputsDisabled(disabled) {
    const ids = [
        "p1Sets", "p2Sets",
        "p1g1", "p1g2", "p1g3", "p1g4", "p1g5",
        "p2g1", "p2g2", "p2g3", "p2g4", "p2g5",
        "saveMatchResult"
    ];

    ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.disabled = disabled;
    });
}

function clearMatchEditor(message) {
    document.getElementById("p1Name").textContent = "P1";
    document.getElementById("p2Name").textContent = "P2";
    document.getElementById("playersPreview").textContent = message;

    ["p1Sets", "p2Sets", "p1g1", "p1g2", "p1g3", "p1g4", "p1g5", "p2g1", "p2g2", "p2g3", "p2g4", "p2g5"]
        .forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.value = "";
        });
}

function fillMatchEditor() {
    const selected = getSelectedMatch();
    if (!selected) {
        setResultInputsDisabled(true);
        clearMatchEditor("No hay partido editable en esta ronda.");
        return;
    }
    const { match } = selected;

    if (isMutedPlayer(match.p1?.name) || isMutedPlayer(match.p2?.name)) {
        setResultInputsDisabled(true);
        clearMatchEditor("Partido automatico (BYE/TBD). No requiere resultado manual.");
        return;
    }

    setResultInputsDisabled(false);

    document.getElementById("p1Name").textContent = match.p1?.name || "P1";
    document.getElementById("p2Name").textContent = match.p2?.name || "P2";
    document.getElementById("playersPreview").textContent = `${match.p1?.name || "P1"} vs ${match.p2?.name || "P2"}`;

    const p1Sets = countSetsWon(match.games, "p1");
    const p2Sets = countSetsWon(match.games, "p2");
    document.getElementById("p1Sets").value = p1Sets;
    document.getElementById("p2Sets").value = p2Sets;

    for (let i = 0; i < 5; i += 1) {
        const g = match.games[i] || { p1: null, p2: null };
        document.getElementById(`p1g${i + 1}`).value = g.p1 ?? "";
        document.getElementById(`p2g${i + 1}`).value = g.p2 ?? "";
    }
}

function populateMatchSelect() {
    const roundSelect = document.getElementById("roundSelect");
    const matchSelect = document.getElementById("matchSelect");
    if (!drawState || !roundSelect || !matchSelect) return;

    const roundIndex = Number(roundSelect.value);
    const round = drawState.rounds[roundIndex];
    matchSelect.innerHTML = "";

    const editableMatches = [];

    round.matches.forEach((match, i) => {
        const p1Auto = isMutedPlayer(match.p1?.name);
        const p2Auto = isMutedPlayer(match.p2?.name);
        if (!p1Auto && !p2Auto) {
            editableMatches.push(i);
        }
    });

    if (editableMatches.length === 0) {
        matchSelect.innerHTML = '<option value="" selected>Sin partidos editables</option>';
        fillMatchEditor();
        return;
    }

    editableMatches.forEach((matchIndex) => {
        matchSelect.innerHTML += `<option value="${matchIndex}">Partido ${matchIndex + 1}</option>`;
    });

    fillMatchEditor();
}

function populateRoundSelect() {
    const roundSelect = document.getElementById("roundSelect");
    if (!drawState || !roundSelect) return;

    roundSelect.innerHTML = "";
    drawState.rounds.forEach((round, i) => {
        roundSelect.innerHTML += `<option value="${i}">${round.title}</option>`;
    });

    populateMatchSelect();
}

async function saveDrawState() {
    localStorage.setItem(DRAW_BRACKET_KEY, JSON.stringify(drawState));
    if (window.PSACloudStore?.saveLocalStorageKeyToCloud) {
        try {
            const res = await window.PSACloudStore.saveLocalStorageKeyToCloud(DRAW_BRACKET_KEY);
            if (res && res.ok) {
                updateScheduleStatus("Horario guardado y sincronizado online.");
                updateDrawStatus("Cuadro guardado y sincronizado online.");
            } else {
                updateScheduleStatus("Horario guardado en este navegador.");
            }
        } catch (err) {
            console.error("Error guardando cuadro en la nube:", err);
        }
    }
    window.PSAOptimizations?.clearFetchCache?.();
}

async function saveMatchResult() {
    const selected = getSelectedMatch();
    if (!selected) return;
    const { match } = selected;

    const enteredGames = Array.from({ length: 5 }, (_, i) => ({
        p1: toScore(document.getElementById(`p1g${i + 1}`).value),
        p2: toScore(document.getElementById(`p2g${i + 1}`).value)
    }));

    const hasAnyGameScore = enteredGames.some((game) => game.p1 !== null || game.p2 !== null);

    if (hasAnyGameScore) {
        match.games = enteredGames;
    } else {
        const p1SetsInput = toScore(document.getElementById("p1Sets")?.value);
        const p2SetsInput = toScore(document.getElementById("p2Sets")?.value);

        if (p1SetsInput === null || p2SetsInput === null || p1SetsInput === p2SetsInput) {
            updateDrawStatus("Introduce tanteo por juego o sets validos para publicar el resultado.");
            return;
        }

        match.games = buildGamesFromSets(p1SetsInput, p2SetsInput);
    }

    autoAdvanceBracket(drawState);
    await saveDrawState();
    populateRoundSelect();
    populateScheduleRoundSelect();
    updateDrawStatus("Resultado guardado y cuadro actualizado.");
}

function getSelectedScheduleMatch() {
    const roundSelect = document.getElementById("scheduleRoundSelect");
    const matchSelect = document.getElementById("scheduleMatchSelect");
    if (!drawState || !roundSelect || !matchSelect) return null;

    const r = Number(roundSelect.value);
    const m = Number(matchSelect.value);

    if (!drawState.rounds[r] || !drawState.rounds[r].matches[m]) return null;

    return { roundIndex: r, matchIndex: m, match: drawState.rounds[r].matches[m] };
}

function fillScheduleEditor() {
    const selected = getSelectedScheduleMatch();
    const preview = document.getElementById("schedulePlayersPreview");
    const dateInput = document.getElementById("scheduleDate");
    const saveBtn = document.getElementById("saveMatchSchedule");

    if (!selected) {
        if (preview) preview.textContent = "No hay partido seleccionado.";
        if (dateInput) dateInput.value = "";
        if (saveBtn) saveBtn.disabled = true;
        return;
    }

    const { match } = selected;
    if (isByePlayer(match.p1?.name) || isByePlayer(match.p2?.name)) {
        if (preview) preview.textContent = "Partido automatico (BYE). No requiere horario.";
        if (dateInput) dateInput.value = "";
        if (saveBtn) saveBtn.disabled = true;
        return;
    }

    if (preview) {
        preview.textContent = `${match.p1?.name || "TBD"} vs ${match.p2?.name || "TBD"}`;
    }
    if (dateInput) {
        dateInput.value = match.date || "";
    }
    if (saveBtn) saveBtn.disabled = false;
}

function populateScheduleMatchSelect() {
    const roundSelect = document.getElementById("scheduleRoundSelect");
    const matchSelect = document.getElementById("scheduleMatchSelect");
    if (!drawState || !roundSelect || !matchSelect) return;

    const roundIndex = Number(roundSelect.value);
    const round = drawState?.rounds?.[roundIndex];
    matchSelect.innerHTML = "";

    if (!round || !Array.isArray(round.matches)) {
        matchSelect.innerHTML = '<option value="" selected>Sin partidos programables</option>';
        fillScheduleEditor();
        return;
    }

    const schedulableMatches = [];
    round.matches.forEach((match, i) => {
        if (!match) return;
        const hasBye = isByePlayer(match.p1?.name) || isByePlayer(match.p2?.name);
        if (!hasBye) {
            schedulableMatches.push(i);
        }
    });

    if (schedulableMatches.length === 0) {
        matchSelect.innerHTML = '<option value="" selected>Sin partidos programables</option>';
        fillScheduleEditor();
        return;
    }

    const options = schedulableMatches.map((matchIndex) => `<option value="${matchIndex}">Partido ${matchIndex + 1}</option>`);
    matchSelect.innerHTML = options.join("");

    fillScheduleEditor();
}

function populateScheduleRoundSelect() {
    const roundSelect = document.getElementById("scheduleRoundSelect");
    if (!drawState || !Array.isArray(drawState.rounds) || !roundSelect) return;

    const options = [];
    drawState.rounds.forEach((round, i) => {
        if (round && round.title) {
            options.push(`<option value="${i}">${round.title}</option>`);
        }
    });

    roundSelect.innerHTML = options.join("");
    populateScheduleMatchSelect();
}

async function saveMatchSchedule() {
    const selected = getSelectedScheduleMatch();
    if (!selected) return;

    const dateInput = document.getElementById("scheduleDate");
    const newDate = (dateInput?.value || "").trim();

    selected.match.date = newDate;

    await saveDrawState();
    updateScheduleStatus("Horario guardado correctamente y sincronizado en la nube.");
}

function updateProgrammingStatus(message) {
    const el = document.getElementById("programmingAdminStatus");
    if (!el) return;
    el.textContent = message;
}

function getProgrammingDefaultCollection() {
    return [
        {
            id: createId("program"),
            dateTime: "Lunes 11 agosto · 20:00",
            title: {
                es: "Presentación oficial",
                va: "Presentació oficial",
                en: "Official presentation",
                fr: "Présentation officielle"
            },
            subtitle: {
                es: "Bienvenida del PSA Valencia Open",
                va: "Benvinguda del PSA Valencia Open",
                en: "Welcome to PSA Valencia Open",
                fr: "Bienvenue au PSA Valencia Open"
            },
            order: 1
        },
        {
            id: createId("program"),
            dateTime: "Martes 12 agosto · 11:00",
            title: {
                es: "Primeras rondas",
                va: "Primeres rondes",
                en: "First rounds",
                fr: "Premiers tours"
            },
            subtitle: {
                es: "Apertura de pistas y primeros enfrentamientos",
                va: "Obertura de pistes i primers enfrontaments",
                en: "Courts open and first matchups",
                fr: "Ouverture des courts et premiers affrontements"
            },
            order: 2
        },
        {
            id: createId("program"),
            dateTime: "Miércoles 13 agosto · 17:00",
            title: {
                es: "Octavos de final",
                va: "Vuitens de final",
                en: "Round of 16",
                fr: "Huitièmes de finale"
            },
            subtitle: {
                es: "Jornada de partidos de octavos",
                va: "Jornada de partits de vuitens",
                en: "Round of 16 match day",
                fr: "Journée de matchs des huitièmes"
            },
            order: 3
        },
        {
            id: createId("program"),
            dateTime: "Jueves 14 agosto · 18:00",
            title: {
                es: "Cuartos de final",
                va: "Quarts de final",
                en: "Quarter-finals",
                fr: "Quarts de finale"
            },
            subtitle: {
                es: "Partidos decisivos por el pase a semifinales",
                va: "Partits decisius pel pas a semifinals",
                en: "Decisive matches for semi-finals qualification",
                fr: "Matchs décisifs pour la qualification en demi-finales"
            },
            order: 4
        },
        {
            id: createId("program"),
            dateTime: "Viernes 15 agosto · 19:00",
            title: {
                es: "Semifinales",
                va: "Semifinals",
                en: "Semi-finals",
                fr: "Demi-finales"
            },
            subtitle: {
                es: "Batallas de alto nivel por un puesto en la gran final",
                va: "Batalles d'alt nivell per un lloc a la gran final",
                en: "High-level battles for a spot in the grand final",
                fr: "Combats de haut niveau pour une place en grande finale"
            },
            order: 5
        },
        {
            id: createId("program"),
            dateTime: "Sábado 16 agosto · 18:30",
            title: {
                es: "Gran Final y Entrega de Trofeos",
                va: "Gran Final i Lliurament de Trofeus",
                en: "Grand Final & Trophy Ceremony",
                fr: "Grande Finale et Cérémonie de Remise des Prix"
            },
            subtitle: {
                es: "Partido por el título y ceremonia de premios",
                va: "Partit pel títol i cerimònia de premis",
                en: "Championship match and awards ceremony",
                fr: "Match pour le titre et cérémonie des récompenses"
            },
            order: 6
        }
    ];
}

function normalizeProgrammingItem(item, index = 0) {
    const title = normalizeLocalizedText(item?.title || "");
    const subtitle = normalizeLocalizedText(item?.subtitle || "");
    return {
        id: String(item?.id || createId("program")).trim(),
        dateTime: String(item?.dateTime || item?.date || "").trim(),
        title,
        subtitle,
        order: Number(item?.order) || index + 1
    };
}

function readProgrammingCollection() {
    const parsed = parseStorageJson(PROGRAMMING_COLLECTION_KEY, null);
    if (!Array.isArray(parsed) || parsed.length === 0) {
        return getProgrammingDefaultCollection();
    }

    return parsed
        .map((item, index) => normalizeProgrammingItem(item, index))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
}

async function saveProgrammingCollection(collection) {
    const normalized = (Array.isArray(collection) ? collection : [])
        .map((item, index) => normalizeProgrammingItem(item, index))
        .sort((a, b) => (a.order || 0) - (b.order || 0));

    localStorage.setItem(PROGRAMMING_COLLECTION_KEY, JSON.stringify(normalized));
    if (window.PSACloudStore?.saveLocalStorageKeyToCloud) {
        try {
            await window.PSACloudStore.saveLocalStorageKeyToCloud(PROGRAMMING_COLLECTION_KEY);
        } catch (err) {
            console.error("Error guardando programación en la nube:", err);
        }
    }
    window.PSAOptimizations?.clearFetchCache?.();
    return normalized;
}

function getProgrammingRowLocalizedInput(itemId, field, lang) {
    return (document.getElementById(`programming_${field}_${lang}_${itemId}`)?.value || "").trim();
}

function getProgrammingRowLocalized(field, itemId, fallbackMap = {}) {
    return {
        es: getProgrammingRowLocalizedInput(itemId, field, "es") || String(fallbackMap?.es || ""),
        va: getProgrammingRowLocalizedInput(itemId, field, "va") || String(fallbackMap?.va || ""),
        en: getProgrammingRowLocalizedInput(itemId, field, "en") || String(fallbackMap?.en || ""),
        fr: getProgrammingRowLocalizedInput(itemId, field, "fr") || String(fallbackMap?.fr || "")
    };
}

function renderProgrammingAdminList(collection) {
    const host = document.getElementById("programmingAdminList");
    if (!host) return;

    const rows = [...collection].sort((a, b) => (a.order || 0) - (b.order || 0));
    if (!rows.length) {
        host.innerHTML = "<p class=\"admin-muted\">No hay actos todavía.</p>";
        return;
    }

    host.innerHTML = rows.map((item, index) => `
        <article class="gallery-admin-card" data-programming-id="${escapeHtml(item.id)}">
            <label class="field-label" for="programming_order_${item.id}">Orden</label>
            <input id="programming_order_${item.id}" type="number" min="1" value="${Number(item.order || index + 1)}">

            <label class="field-label" for="programming_date_${item.id}">Fecha y hora visible</label>
            <input id="programming_date_${item.id}" type="text" value="${escapeHtml(item.dateTime || "")}" placeholder="Lunes 11 agosto · 20:00">

            <label class="field-label" for="programming_title_es_${item.id}">Título ES</label>
            <input id="programming_title_es_${item.id}" type="text" value="${escapeHtml(item.title?.es || "")}">

            <label class="field-label" for="programming_subtitle_es_${item.id}">Subtítulo ES</label>
            <input id="programming_subtitle_es_${item.id}" type="text" value="${escapeHtml(item.subtitle?.es || "")}">

            <div class="gallery-admin-actions">
                <button type="button" class="btn-gallery-save" data-programming-action="translate" data-programming-id="${escapeHtml(item.id)}">Traducir ES</button>
                <button type="button" class="btn-gallery-danger" data-programming-action="delete" data-programming-id="${escapeHtml(item.id)}">Eliminar</button>
            </div>
        </article>
    `).join("");
}

async function translateProgrammingRowFromSpanish(collection, itemId) {
    const item = collection.find((entry) => entry.id === itemId);
    if (!item) return collection;

    const titleEs = getProgrammingRowLocalizedInput(itemId, "title", "es");
    const subtitleEs = getProgrammingRowLocalizedInput(itemId, "subtitle", "es");

    if (!titleEs) {
        updateProgrammingStatus("Escribe al menos el título en español para traducir.");
        return collection;
    }

    updateProgrammingStatus("Traduciendo acto...");

    const [titleLoc, subtitleLoc] = await Promise.all([
        buildLocalizedFromSpanish(titleEs),
        subtitleEs ? buildLocalizedFromSpanish(subtitleEs) : Promise.resolve({ es: "", va: "", en: "", fr: "" })
    ]);

    const next = collection.map((entry) => {
        if (entry.id !== itemId) return entry;
        return {
            ...entry,
            title: titleLoc,
            subtitle: subtitleLoc
        };
    });

    saveProgrammingCollection(next);
    renderProgrammingAdminList(next);
    bindProgrammingRowActions();
    updateProgrammingStatus("Traducciones actualizadas.");
    return next;
}

function collectProgrammingFromEditor(currentCollection) {
    return currentCollection.map((item, index) => {
        const dateTime = (document.getElementById(`programming_date_${item.id}`)?.value || "").trim();
        const orderValue = Number(document.getElementById(`programming_order_${item.id}`)?.value || index + 1);
        const title = getProgrammingRowLocalized("title", item.id, item.title);
        const subtitle = getProgrammingRowLocalized("subtitle", item.id, item.subtitle);

        return normalizeProgrammingItem({
            ...item,
            dateTime,
            title,
            subtitle,
            order: Number.isFinite(orderValue) ? orderValue : index + 1
        }, index);
    });
}

function bindProgrammingRowActions() {
    const host = document.getElementById("programmingAdminList");
    if (!host) return;

    host.querySelectorAll("[data-programming-action]").forEach((btn) => {
        if (btn.dataset.bound === "1") return;
        btn.dataset.bound = "1";

        btn.addEventListener("click", async () => {
            let collection = readProgrammingCollection();
            collection = collectProgrammingFromEditor(collection);

            const action = String(btn.getAttribute("data-programming-action") || "").trim();
            const itemId = String(btn.getAttribute("data-programming-id") || "").trim();

            if (action === "delete") {
                const next = collection.filter((entry) => entry.id !== itemId)
                    .map((entry, index) => ({ ...entry, order: index + 1 }));
                saveProgrammingCollection(next);
                renderProgrammingAdminList(next);
                bindProgrammingRowActions();
                updateProgrammingStatus("Acto eliminado.");
                return;
            }

            if (action === "translate") {
                await translateProgrammingRowFromSpanish(collection, itemId);
            }
        });
    });
}

async function initProgrammingAdmin() {
    const panel = document.getElementById("programming-admin-panel");
    if (!panel) return;

    let collection = readProgrammingCollection();
    saveProgrammingCollection(collection);
    renderProgrammingAdminList(collection);
    bindProgrammingRowActions();

    const saveNewBtn = document.getElementById("saveNewProgrammingItem");
    const saveCollectionBtn = document.getElementById("saveProgrammingCollection");
    const resetBtn = document.getElementById("resetProgrammingCollection");

    if (saveNewBtn && !saveNewBtn.dataset.bound) {
        saveNewBtn.addEventListener("click", async () => {
            const dateTime = (document.getElementById("programmingDateTime")?.value || "").trim();
            const titleEs = (document.getElementById("programmingTitle_es")?.value || "").trim();
            const subtitleEs = (document.getElementById("programmingSubtitle_es")?.value || "").trim();

            if (!dateTime || !titleEs) {
                updateProgrammingStatus("Fecha/hora y título en español son obligatorios.");
                return;
            }

            updateProgrammingStatus("Traduciendo y añadiendo acto...");
            const [titleLoc, subtitleLoc] = await Promise.all([
                buildLocalizedFromSpanish(titleEs),
                subtitleEs ? buildLocalizedFromSpanish(subtitleEs) : Promise.resolve({ es: "", va: "", en: "", fr: "" })
            ]);

            collection = collectProgrammingFromEditor(collection);
            collection.push(normalizeProgrammingItem({
                id: createId("program"),
                dateTime,
                title: titleLoc,
                subtitle: subtitleLoc,
                order: collection.length + 1
            }, collection.length));

            collection = saveProgrammingCollection(collection);
            renderProgrammingAdminList(collection);
            bindProgrammingRowActions();

            const dateInput = document.getElementById("programmingDateTime");
            const titleInput = document.getElementById("programmingTitle_es");
            const subtitleInput = document.getElementById("programmingSubtitle_es");
            if (dateInput) dateInput.value = "";
            if (titleInput) titleInput.value = "";
            if (subtitleInput) subtitleInput.value = "";

            updateProgrammingStatus("Acto añadido correctamente.");
        });
        saveNewBtn.dataset.bound = "1";
    }

    if (saveCollectionBtn && !saveCollectionBtn.dataset.bound) {
        saveCollectionBtn.addEventListener("click", () => {
            collection = collectProgrammingFromEditor(collection)
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map((item, index) => ({ ...item, order: index + 1 }));
            collection = saveProgrammingCollection(collection);
            renderProgrammingAdminList(collection);
            bindProgrammingRowActions();
            updateProgrammingStatus("Programación guardada.");
        });
        saveCollectionBtn.dataset.bound = "1";
    }

    if (resetBtn && !resetBtn.dataset.bound) {
        resetBtn.addEventListener("click", () => {
            collection = saveProgrammingCollection(getProgrammingDefaultCollection());
            renderProgrammingAdminList(collection);
            bindProgrammingRowActions();
            updateProgrammingStatus("Programación de ejemplo restaurada.");
        });
        resetBtn.dataset.bound = "1";
    }
}

function resetDrawState() {
    localStorage.removeItem(DRAW_BRACKET_KEY);
    updateDrawStatus("Cuadro reseteado. Recarga para tomar el JSON base.");
}

async function createDrawFromZero() {
    const response = await fetch("data/draw-bracket.json", { cache: "no-store" });
    const baseBracket = await response.json();

    drawState = baseBracket;
    normalizeBracket(drawState);
    autoAdvanceBracket(drawState);
    saveDrawState();

    populateRoundSelect();
    populateScheduleRoundSelect();
    await renderDrawBuilder();
    updateDrawStatus("Cuadro creado desde 0 con cruces base.");
    updateScheduleStatus("Cuadro base cargado correctamente.");
}

async function initDrawAdmin() {
    const hasDrawControls = document.getElementById("draw-results-panel") ||
                            document.getElementById("draw-schedule-panel") ||
                            document.getElementById("draw-builder-panel") ||
                            document.getElementById("scheduleRoundSelect") ||
                            document.getElementById("roundSelect");
    if (!hasDrawControls) return;

    let baseBracket = null;
    try {
        const response = await fetch("data/draw-bracket.json", { cache: "no-store" });
        baseBracket = await response.json();
    } catch (err) {
        console.error("Error cargando data/draw-bracket.json:", err);
    }

    const stored = localStorage.getItem(DRAW_BRACKET_KEY);
    let parsed = null;
    if (stored) {
        try {
            parsed = JSON.parse(stored);
            while (typeof parsed === "string") {
                parsed = JSON.parse(parsed);
            }
        } catch (e) {
            parsed = null;
        }
    }

    drawState = (parsed?.rounds && Array.isArray(parsed.rounds) && parsed.rounds.length > 0) ? parsed : baseBracket;
    if (!drawState) return;

    normalizeBracket(drawState);
    autoAdvanceBracket(drawState);

    populateRoundSelect();
    populateScheduleRoundSelect();

    const roundSelect = document.getElementById("roundSelect");
    const matchSelect = document.getElementById("matchSelect");
    const saveBtn = document.getElementById("saveMatchResult");
    const resetBtn = document.getElementById("resetDrawState");
    const scheduleRoundSelect = document.getElementById("scheduleRoundSelect");
    const scheduleMatchSelect = document.getElementById("scheduleMatchSelect");
    const saveScheduleBtn = document.getElementById("saveMatchSchedule");
    const createDrawFromZeroBtn = document.getElementById("createDrawFromZero");

    if (roundSelect) roundSelect.addEventListener("change", populateMatchSelect);
    if (matchSelect) matchSelect.addEventListener("change", fillMatchEditor);
    if (saveBtn) saveBtn.addEventListener("click", saveMatchResult);
    if (resetBtn) resetBtn.addEventListener("click", resetDrawState);

    if (scheduleRoundSelect) {
        scheduleRoundSelect.addEventListener("change", populateScheduleMatchSelect);
    }
    if (scheduleMatchSelect) {
        scheduleMatchSelect.addEventListener("change", fillScheduleEditor);
    }
    if (saveScheduleBtn) {
        saveScheduleBtn.addEventListener("click", saveMatchSchedule);
    }
    if (createDrawFromZeroBtn) {
        createDrawFromZeroBtn.addEventListener("click", createDrawFromZero);
    }

    initDrawBuilder();
}

document.addEventListener("DOMContentLoaded", () => {
    initAdminAuth();
});
