#!/bin/sh
set -eu

SUPABASE_URL_VALUE="${SUPABASE_URL:-}"
SUPABASE_ANON_KEY_VALUE="${SUPABASE_ANON_KEY:-}"
ASSET_CDN_BASE_VALUE="${ASSET_CDN_BASE:-}"

cat > /usr/share/nginx/html/config.js <<EOF
/*
 * Runtime configuration injected by the hosting environment.
 * Do not add a service_role key here.
 */
window.PSA_CONFIG = Object.assign({
    supabaseUrl: "",
    supabaseAnonKey: "",
    assetCdnBase: ""
}, window.PSA_CONFIG || {}, {
    supabaseUrl: "${SUPABASE_URL_VALUE}",
    supabaseAnonKey: "${SUPABASE_ANON_KEY_VALUE}",
    assetCdnBase: "${ASSET_CDN_BASE_VALUE}"
});
EOF

exec nginx -g 'daemon off;'
