/* ==========================================================
   CLOUD STORE (SUPABASE)
   Tabla esperada: public.site_content
   - content_key text primary key
   - content_value jsonb not null
   - updated_at timestamptz default now()
========================================================== */

window.PSACloudStore = (() => {
    const TABLE_NAME = "site_content";
    let schemaCache = null;
    const SCHEMAS = [
        { keyCol: "content_key", valueCol: "content_value" },
        { keyCol: "key", valueCol: "value" }
    ];

    function getClient() {
        return window.AdminSupabase?.getClient?.() || null;
    }

    function isReady() {
        return !!getClient();
    }

    function safeParseJson(raw) {
        if (typeof raw !== "string") return raw;
        try {
            return JSON.parse(raw);
        } catch (error) {
            return raw;
        }
    }

    function safeStringify(value) {
        try {
            return JSON.stringify(value);
        } catch (error) {
            return JSON.stringify(null);
        }
    }

    function getSchemaCandidates() {
        if (!schemaCache) return SCHEMAS;
        return [schemaCache, ...SCHEMAS.filter((s) => s.keyCol !== schemaCache.keyCol)];
    }

    async function pullKeys(keys = []) {
        const client = getClient();
        if (!client) {
            return { ok: false, reason: "missing-client", values: {} };
        }

        if (!Array.isArray(keys) || keys.length === 0) {
            return { ok: true, values: {} };
        }

        const uniqueKeys = Array.from(new Set(keys.filter(Boolean)));
        let lastError = "schema-not-detected";

        for (const schema of getSchemaCandidates()) {
            const { data, error } = await client
                .from(TABLE_NAME)
                .select(`${schema.keyCol}, ${schema.valueCol}`)
                .in(schema.keyCol, uniqueKeys);

            if (error) {
                lastError = error.message;
                continue;
            }

            schemaCache = schema;
            const values = {};
            (data || []).forEach((row) => {
                if (!row || !row[schema.keyCol]) return;
                values[row[schema.keyCol]] = row[schema.valueCol];
            });

            return { ok: true, values };
        }

        return { ok: false, reason: lastError, values: {} };
    }

    async function pushKey(key, value) {
        const client = getClient();
        if (!client) {
            return { ok: false, reason: "missing-client" };
        }

        if (!key) {
            return { ok: false, reason: "missing-key" };
        }

        let lastError = "schema-not-detected";

        for (const schema of getSchemaCandidates()) {
            const row = {
                [schema.keyCol]: key,
                [schema.valueCol]: value,
                updated_at: new Date().toISOString()
            };

            const { error } = await client
                .from(TABLE_NAME)
                .upsert(row, { onConflict: schema.keyCol });

            if (error) {
                lastError = error.message;
                continue;
            }

            schemaCache = schema;
            return { ok: true };
        }

        return { ok: false, reason: lastError };
    }

    async function deleteKey(key) {
        const client = getClient();
        if (!client) {
            return { ok: false, reason: "missing-client" };
        }

        if (!key) {
            return { ok: false, reason: "missing-key" };
        }

        let lastError = "schema-not-detected";

        for (const schema of getSchemaCandidates()) {
            const { error } = await client
                .from(TABLE_NAME)
                .delete()
                .eq(schema.keyCol, key);

            if (error) {
                lastError = error.message;
                continue;
            }

            schemaCache = schema;
            return { ok: true };
        }

        return { ok: false, reason: lastError };
    }

    async function syncLocalStorageFromCloud(keys = []) {
        const result = await pullKeys(keys);
        if (!result.ok) return result;

        const values = result.values || {};
        Object.entries(values).forEach(([key, value]) => {
            localStorage.setItem(key, safeStringify(value));
        });

        return { ok: true, loaded: Object.keys(values).length };
    }

    async function saveLocalStorageKeyToCloud(key) {
        if (!key) return { ok: false, reason: "missing-key" };

        const raw = localStorage.getItem(key);
        if (raw === null || raw === undefined) {
            return deleteKey(key);
        }

        const parsed = safeParseJson(raw);
        return pushKey(key, parsed);
    }

    async function removeLocalStorageKeyFromCloud(key) {
        return deleteKey(key);
    }

    return {
        isReady,
        pullKeys,
        pushKey,
        deleteKey,
        syncLocalStorageFromCloud,
        saveLocalStorageKeyToCloud,
        removeLocalStorageKeyFromCloud
    };
})();
