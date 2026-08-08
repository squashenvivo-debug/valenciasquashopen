/* ==========================================================
   PHOTO ANALYTICS
   - Cuenta descargas y comparticiones de fotos de la galería en
     Supabase (public.photo_events). Escritura pública, solo el
     panel admin (sesión autenticada) puede leer las cifras.
   - Best-effort: si falla (sin conexión, etc.) no interrumpe la
     acción del usuario, simplemente no queda contado.
========================================================== */

window.PSAPhotoAnalytics = (() => {
    const TABLE_NAME = "photo_events";
    const SESSION_KEY = "psa_visit_session_id";

    function getClient() {
        return window.AdminSupabase?.getClient?.() || null;
    }

    function getSessionId() {
        try {
            return localStorage.getItem(SESSION_KEY) || "";
        } catch (error) {
            return "";
        }
    }

    async function trackEvent(action, photo = {}) {
        const client = getClient();
        if (!client) return { ok: false, reason: "missing-client" };

        const payload = {
            action,
            gallery_id: String(photo.galleryId || "").slice(0, 200),
            photo_id: String(photo.photoId || "").slice(0, 200),
            photo_url: String(photo.photoUrl || "").slice(0, 800),
            session_id: getSessionId()
        };

        try {
            const { error } = await client.from(TABLE_NAME).insert(payload);
            if (error) return { ok: false, reason: error.message };
            return { ok: true };
        } catch (error) {
            return { ok: false, reason: String(error?.message || error) };
        }
    }

    return { trackEvent };
})();
