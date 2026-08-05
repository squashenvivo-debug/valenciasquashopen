/*
 * Runtime configuration injected by the hosting environment.
 * Do not add a service_role key here. For local development, create a
 * non-versioned config.local.js that assigns these public values.
 */
const PSA_LOCALHOST_CDN_FALLBACK = "https://psavalenciaopen.com";

function getLocalhostCdnFallback() {
    const host = String(window.location.hostname || "").toLowerCase();
    const isLocal = host === "localhost" || host === "127.0.0.1";
    return isLocal ? PSA_LOCALHOST_CDN_FALLBACK : "";
}

window.PSA_CONFIG = Object.assign({
    supabaseUrl: "https://texjzaanugmssmolzwgb.supabase.co",
    supabaseAnonKey: "sb_publishable_lTEaFAp9lgMMInv-0TjeCA_ViWtDg2J",
    psaApiKey: "854800fc3a4b365e531b39594fd3aed7eb2f42a573887d5f",
    psaTournamentId: "12711",
    assetCdnBase: getLocalhostCdnFallback()
}, window.PSA_CONFIG || {});
