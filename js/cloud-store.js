/* ==========================================================
   CLOUD STORE (SUPABASE)
   Tabla esperada: public.site_content (id = 1)
   Mapeo de columnas:
   - r1: drawBracketState
   - intro: eventProgrammingCollection
   - youtube_url: liveStreamYoutubeUrl
   - headline: heroSettings
========================================================== */

window.PSACloudStore = (() => {
    const TABLE_NAME = "site_content";
    let schemaCache = null;
    const SCHEMAS = [
        { keyCol: "content_key", valueCol: "content_value" },
        { keyCol: "key", valueCol: "value" }
    ];

    const COLUMN_MAP = {
        drawBracketState: "r1",
        playersCollection: "r2",
        eventProgrammingCollection: "intro",
        newsCollection: "qf",
        galleryCollections: "sf",
        liveStreamYoutubeUrl: "youtube_url",
        heroSettings: "headline"
    };

    const REVERSE_COLUMN_MAP = {
        r1: "drawBracketState",
        r2: "playersCollection",
        intro: "eventProgrammingCollection",
        qf: "newsCollection",
        sf: "galleryCollections",
        youtube_url: "liveStreamYoutubeUrl",
        headline: "heroSettings"
    };

    function getClient() {
        return window.AdminSupabase?.getClient?.() || null;
    }

    function isReady() {
        return !!getClient();
    }

    function safeParseJson(raw) {
        if (typeof raw !== "string") return raw;
        const trimmed = raw.trim();
        if (!trimmed) return raw;
        try {
            let parsed = JSON.parse(trimmed);
            while (typeof parsed === "string") {
                const s = parsed.trim();
                if (s.startsWith("{") || s.startsWith("[")) {
                    try {
                        parsed = JSON.parse(s);
                    } catch (e) {
                        break;
                    }
                } else {
                    break;
                }
            }
            return parsed;
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

        const values = {};

        // 1. Mapeo por columnas de fila única (site_content id = 1)
        try {
            const { data, error } = await client
                .from(TABLE_NAME)
                .select("*")
                .eq("id", 1);

            if (!error && Array.isArray(data) && data.length > 0) {
                const row = data[0];
                Object.entries(REVERSE_COLUMN_MAP).forEach(([col, key]) => {
                    if (keys.includes(key) && row[col] !== undefined && row[col] !== null && String(row[col]).trim() !== "") {
                        const parsed = safeParseJson(row[col]);
                        if (parsed !== null && parsed !== undefined) {
                            values[key] = parsed;
                        }
                    }
                });
                if (Object.keys(values).length > 0) {
                    return { ok: true, values };
                }
            }
        } catch (err) {
            // Fallback a esquema genérico
        }

        // 2. Fallback a esquema genérico clave-valor
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

        // 1. Si la clave mapea a una columna de site_content (id = 1)
        if (COLUMN_MAP[key]) {
            const colName = COLUMN_MAP[key];
            const parsed = safeParseJson(value);
            const textToSave = typeof parsed === "string" ? parsed : safeStringify(parsed);
            const { data, error } = await client
                .from(TABLE_NAME)
                .update({
                    [colName]: textToSave,
                    updated_at: new Date().toISOString()
                })
                .eq("id", 1)
                .select();

            if (!error && Array.isArray(data) && data.length > 0) {
                return { ok: true };
            }

            // Fallback: si update no devolvió filas (ej. RLS o id=1 no existe), probar upsert
            const { error: upsertErr } = await client
                .from(TABLE_NAME)
                .upsert({
                    id: 1,
                    [colName]: textToSave,
                    updated_at: new Date().toISOString()
                }, { onConflict: "id" });

            if (!upsertErr) {
                return { ok: true };
            }
        }

        // 2. Fallback a esquema genérico clave-valor
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
            if (value === undefined || value === null) return;
            const parsed = safeParseJson(value);
            const textToStore = typeof parsed === "string" ? parsed : safeStringify(parsed);
            localStorage.setItem(key, textToStore);
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
