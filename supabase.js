/* ==========================================================
   SUPABASE CLIENT (ADMIN)
   Rellena URL y anon key para activar login en admin
========================================================== */

window.AdminSupabase = (() => {
    const runtimeConfig = window.PSA_CONFIG || {};
    const config = {
        url: String(runtimeConfig.supabaseUrl || runtimeConfig.SUPABASE_URL || "").trim(),
        anonKey: String(runtimeConfig.supabaseAnonKey || runtimeConfig.SUPABASE_ANON_KEY || "").trim()
    };

    let client = null;

    function isConfigured() {
        return Boolean(config.url && config.anonKey);
    }

    function getClient() {
        if (!isConfigured()) return null;
        if (client) return client;

        if (!window.supabase || typeof window.supabase.createClient !== "function") {
            return null;
        }

        client = window.supabase.createClient(config.url, config.anonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true
            }
        });

        return client;
    }

    async function getAccessToken() {
        const activeClient = getClient();
        if (!activeClient) return "";

        const { data } = await activeClient.auth.getSession();
        return data?.session?.access_token || "";
    }

    return {
        getClient,
        getAccessToken,
        isConfigured
    };
})();
