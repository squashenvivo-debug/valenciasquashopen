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
    supabaseUrl: "",
    supabaseAnonKey: "",
    assetCdnBase: getLocalhostCdnFallback()
}, window.PSA_CONFIG || {});
