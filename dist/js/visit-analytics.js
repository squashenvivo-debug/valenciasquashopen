/* ==========================================================
   VISIT ANALYTICS
   - Tracks public page visits to Supabase table: public.site_visits
   - Falls back to localStorage when cloud is unavailable
========================================================== */

window.PSAVisitAnalytics = (() => {
    const TABLE_NAME = "site_visits";
    const SESSION_KEY = "psa_visit_session_id";
    const FALLBACK_EVENTS_KEY = "psa_local_visit_events";
    const MAX_FALLBACK_EVENTS = 2000;

    function getClient() {
        return window.AdminSupabase?.getClient?.() || null;
    }

    function isPublicPage() {
        const path = String(window.location.pathname || "").toLowerCase();
        return !path.includes("admin");
    }

    function createSessionId() {
        const now = Date.now().toString(36);
        const rand = Math.random().toString(36).slice(2, 10);
        return `sess_${now}_${rand}`;
    }

    function getSessionId() {
        const existing = localStorage.getItem(SESSION_KEY);
        if (existing) return existing;

        const next = createSessionId();
        localStorage.setItem(SESSION_KEY, next);
        return next;
    }

    function getPagePath() {
        const path = String(window.location.pathname || "/").trim() || "/";
        return path.replace(/\\/g, "/");
    }

    function normalizeReferrer(value) {
        const ref = String(value || "").trim();
        if (!ref) return "direct";
        return ref.slice(0, 300);
    }

    function buildVisitEvent() {
        return {
            page_path: getPagePath(),
            page_title: String(document.title || "").trim().slice(0, 200),
            session_id: getSessionId(),
            referrer: normalizeReferrer(document.referrer),
            user_agent: String(navigator.userAgent || "").slice(0, 300),
            language: String(navigator.language || "").slice(0, 16),
            visited_at: new Date().toISOString()
        };
    }

    function getFallbackEvents() {
        try {
            const raw = localStorage.getItem(FALLBACK_EVENTS_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed;
        } catch (error) {
            return [];
        }
    }

    function saveFallbackEvent(eventPayload) {
        const current = getFallbackEvents();
        current.push(eventPayload);

        const trimmed = current.slice(-MAX_FALLBACK_EVENTS);
        localStorage.setItem(FALLBACK_EVENTS_KEY, JSON.stringify(trimmed));
    }

    async function saveVisitToCloud(eventPayload) {
        const client = getClient();
        if (!client) return { ok: false, reason: "missing-client" };

        const { error } = await client.from(TABLE_NAME).insert(eventPayload);
        if (error) {
            return { ok: false, reason: error.message };
        }

        return { ok: true };
    }

    async function trackVisit() {
        if (!isPublicPage()) return { ok: false, reason: "admin-page" };

        const eventPayload = buildVisitEvent();

        try {
            const cloud = await saveVisitToCloud(eventPayload);
            if (cloud.ok) return { ok: true, source: "cloud" };

            saveFallbackEvent(eventPayload);
            return { ok: true, source: "local", reason: cloud.reason || "cloud-failed" };
        } catch (error) {
            saveFallbackEvent(eventPayload);
            return { ok: true, source: "local", reason: String(error?.message || error) };
        }
    }

    function getLocalMetrics() {
        const events = getFallbackEvents();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayIso = today.toISOString();

        const todayRows = events.filter((item) => String(item?.visited_at || "") >= todayIso);
        const uniqueToday = new Set(todayRows.map((item) => String(item?.session_id || "").trim()).filter(Boolean));

        const pageMap = new Map();
        todayRows.forEach((item) => {
            const page = String(item?.page_path || "-").trim() || "-";
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

        return {
            totalVisits: events.length,
            todayVisits: todayRows.length,
            uniqueToday: uniqueToday.size,
            topPage,
            source: "local"
        };
    }

    return {
        trackVisit,
        getLocalMetrics,
        getFallbackEvents
    };
})();

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        window.PSAVisitAnalytics?.trackVisit?.();
    });
} else {
    window.PSAVisitAnalytics?.trackVisit?.();
}
