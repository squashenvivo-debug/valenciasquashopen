/**
 * /api/generate-news
 *
 * Función serverless de Vercel (Node.js runtime). Recibe los partidos disputados
 * del PSA Valencia Open desde el panel admin (admin-ai-news.html / js/ai-news.js),
 * decide la historia principal de la jornada y genera 3 versiones del artículo
 * (periodística, sensacionalista, SEO) con la Responses API de OpenAI.
 *
 * La API key de OpenAI vive solo aquí (variable de entorno de Vercel) y nunca
 * llega al navegador. El endpoint exige un token de sesión de Supabase válido,
 * el mismo que usa el panel admin, como control de acceso.
 *
 * No publica nada: solo devuelve las 3 versiones para revisión humana.
 */

"use strict";

const { analyzeStory } = require("../lib/newsAnalyzer");
const { buildPromptsForVersions, ARTICLE_JSON_SCHEMA } = require("../lib/newsPrompt");

const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const OPENAI_TIMEOUT_MS = 45000;
const MAX_MATCHES_PER_REQUEST = 40;

// Ajusta esta lista (o usa la env var ALLOWED_ORIGINS) a los orígenes reales desde los que se llamará al endpoint.
const DEFAULT_ALLOWED_ORIGINS = [
    "https://psavalenciaopen.com",
    "https://www.psavalenciaopen.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5500",
    "http://127.0.0.1:5500"
];

function getAllowedOrigins() {
    const fromEnv = String(process.env.ALLOWED_ORIGINS || "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
    return fromEnv.length > 0 ? fromEnv : DEFAULT_ALLOWED_ORIGINS;
}

function applyCors(req, res) {
    const origin = req.headers.origin || "";
    const allowed = getAllowedOrigins();
    if (allowed.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
    }
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

/** Verifica el token de sesión de Supabase que ya usa el panel admin (window.AdminSupabase.getAccessToken()). */
async function verifySupabaseUser(token) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey || !token) return null;

    try {
        const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: { Authorization: `Bearer ${token}`, apikey: anonKey }
        });
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        return null;
    }
}

/** Extrae el texto de salida de una respuesta de la Responses API sin depender del SDK oficial. */
function extractOutputText(responseJson) {
    const items = Array.isArray(responseJson?.output) ? responseJson.output : [];
    for (const item of items) {
        if (item?.type !== "message" || !Array.isArray(item.content)) continue;
        const textPart = item.content.find((part) => part?.type === "output_text" && typeof part.text === "string");
        if (textPart) return textPart.text;
    }
    return "";
}

async function callOpenAiVersion({ system, user, model, maxOutputTokens }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

    try {
        const response = await fetch(OPENAI_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model,
                input: [
                    { role: "system", content: system },
                    { role: "user", content: user }
                ],
                text: {
                    format: {
                        type: "json_schema",
                        name: "news_article",
                        schema: ARTICLE_JSON_SCHEMA,
                        strict: true
                    }
                },
                max_output_tokens: maxOutputTokens
            }),
            signal: controller.signal
        });

        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload?.error?.message || `OpenAI respondió ${response.status}`);
        }

        const rawText = extractOutputText(payload);
        if (!rawText) throw new Error("La respuesta de OpenAI no incluyó contenido de texto.");

        return JSON.parse(rawText);
    } finally {
        clearTimeout(timeout);
    }
}

function estimateMaxOutputTokens(wordCount) {
    const safeWordCount = Number(wordCount) || 500;
    // ~2.2 tokens por palabra en español/inglés + margen para el JSON envolvente.
    return Math.min(4000, Math.max(600, Math.round(safeWordCount * 2.2) + 400));
}

module.exports = async function handler(req, res) {
    applyCors(req, res);

    if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
    }

    if (req.method !== "POST") {
        res.status(405).json({ success: false, error: "Método no permitido." });
        return;
    }

    if (!process.env.OPENAI_API_KEY) {
        res.status(500).json({ success: false, error: "El servidor no tiene configurada OPENAI_API_KEY." });
        return;
    }

    const authHeader = String(req.headers.authorization || "");
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const user = await verifySupabaseUser(token);
    if (!user?.id) {
        res.status(401).json({ success: false, error: "Sesión no válida. Inicia sesión en el panel admin de nuevo." });
        return;
    }

    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const rawMatches = Array.isArray(body.matches) ? body.matches : [];
        const divisions = Array.isArray(body.divisions) ? body.divisions : [];
        const tournament = body.tournament && typeof body.tournament === "object" ? body.tournament : {};
        const options = body.options && typeof body.options === "object" ? body.options : {};

        // Defensa en profundidad: solo partidos realmente completados, y con un tope de tamaño.
        const completedStatuses = new Set(["completed", "retired", "walkover"]);
        const matches = rawMatches
            .filter((match) => completedStatuses.has(String(match?.status || "")))
            .slice(0, MAX_MATCHES_PER_REQUEST);

        if (matches.length === 0) {
            res.status(400).json({ success: false, error: "No hay partidos completados que analizar desde la última noticia publicada." });
            return;
        }

        const storyAnalysis = analyzeStory(matches, divisions);
        const prompts = buildPromptsForVersions({ storyAnalysis, matches, tournament, options });
        const model = process.env.OPENAI_MODEL || "gpt-5";
        const maxOutputTokens = estimateMaxOutputTokens(options.length);

        const results = await Promise.allSettled(
            prompts.map((prompt) =>
                callOpenAiVersion({ system: prompt.system, user: prompt.user, model, maxOutputTokens }).then((article) => ({
                    version: prompt.version,
                    label: prompt.label,
                    article
                }))
            )
        );

        const versions = results.map((result, index) => {
            if (result.status === "fulfilled") return result.value;
            return {
                version: prompts[index].version,
                label: prompts[index].label,
                error: result.reason?.message || "No se pudo generar esta versión."
            };
        });

        const anySucceeded = versions.some((version) => !version.error);
        if (!anySucceeded) {
            res.status(502).json({ success: false, error: "OpenAI no devolvió ninguna versión válida.", versions });
            return;
        }

        res.status(200).json({
            success: true,
            story: {
                angleKey: storyAnalysis.angleKey,
                mainStoryLabel: storyAnalysis.mainStoryLabel,
                mainStoryBrief: storyAnalysis.mainStoryBrief,
                playerOfDay: storyAnalysis.playerOfDay,
                totalMatchesAnalyzed: storyAnalysis.totalMatchesAnalyzed,
                topMatches: storyAnalysis.topMatches
            },
            versions
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error?.message || "Error inesperado generando la noticia." });
    }
};
