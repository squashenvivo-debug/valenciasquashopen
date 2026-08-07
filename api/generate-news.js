/**
 * /api/generate-news
 *
 * Función serverless de Vercel (Node.js runtime). Todo el flujo ocurre aquí,
 * sin que el panel admin tenga que preparar ni enviar datos:
 *
 *   1. Consulta la API oficial de PSA (vía el proxy de Supabase Edge Functions
 *      que ya usa el resto del proyecto) para traer el cuadro del torneo.
 *   2. Lee las noticias ya publicadas (Supabase) para saber desde cuándo hay
 *      que analizar partidos nuevos.
 *   3. Decide la historia principal de la jornada (lib/newsAnalyzer). Si aún
 *      no hay partidos completados, cae a una previa del torneo.
 *   4. Construye los prompts (lib/newsPrompt) y genera 3 versiones del
 *      artículo con la Responses API de OpenAI, con el HTML ya listo.
 *
 * La API key de OpenAI vive solo aquí (variable de entorno de Vercel) y nunca
 * llega al navegador. El endpoint exige un token de sesión de Supabase válido
 * (el mismo que usa el panel admin) como control de acceso.
 *
 * No publica nada: solo devuelve las versiones generadas para revisión humana.
 */

"use strict";

const { guardRequest } = require("../lib/apiAuth");
const { callStructuredOpenAi, estimateMaxOutputTokens } = require("../lib/openaiClient");
const { analyzeStory, buildTournamentPreview } = require("../lib/newsAnalyzer");
const { buildPromptsForVersions, buildPreviewPrompts, buildArticleHtml, ARTICLE_JSON_SCHEMA } = require("../lib/newsPrompt");

const MAX_MATCHES_PER_REQUEST = 40;
const COMPLETED_STATUSES = new Set(["completed", "retired", "walkover"]);

/** Trae el cuadro/partidos del torneo a través del proxy de PSA ya desplegado en Supabase Edge Functions. */
async function fetchPsaSnapshot() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const tournamentId = process.env.PSA_TOURNAMENT_ID || "12711";
    if (!supabaseUrl) throw new Error("Falta SUPABASE_URL en el servidor.");

    const url = `${supabaseUrl}/functions/v1/psa-proxy?tournament=${encodeURIComponent(tournamentId)}&expanded=true&include_divisions=true&show_past=true&head_to_head=false`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || `No se pudo consultar la API de PSA (${response.status}).`);
    }
    return payload;
}

/** Lee la colección de noticias ya publicadas directamente de Supabase (misma tabla que usa el panel admin). */
async function fetchPublishedNews() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) throw new Error("Falta configuración de Supabase en el servidor.");

    const response = await fetch(`${supabaseUrl}/rest/v1/site_content?id=eq.1&select=qf`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
    });
    if (!response.ok) throw new Error(`No se pudo leer el listado de noticias (${response.status}).`);

    const rows = await response.json().catch(() => []);
    const rawQf = rows?.[0]?.qf;
    const collection = typeof rawQf === "string" ? JSON.parse(rawQf || "[]") : rawQf;
    if (!Array.isArray(collection)) return [];

    const now = Date.now();
    return collection.filter((item) => {
        const status = ["draft", "scheduled", "published"].includes(item?.status) ? item.status : "published";
        if (status === "draft") return false;
        if (status === "scheduled") {
            const publishTime = Date.parse(item?.publishAt || "");
            return Number.isFinite(publishTime) && publishTime <= now;
        }
        return true;
    });
}

function getLastPublishedTimestamp(publishedNews) {
    return publishedNews.reduce((max, item) => {
        const ts = Date.parse(item?.publishAt || item?.createdAt || "");
        return Number.isFinite(ts) ? Math.max(max, ts) : max;
    }, 0);
}

function getMatchTimestamp(match) {
    if (!match?.date) return NaN;
    const parsed = Date.parse(`${match.date}T${match.time || "00:00"}`);
    return Number.isFinite(parsed) ? parsed : NaN;
}

/** Aplana divisions[].brackets[].matches[] y filtra a partidos completados desde la última noticia publicada. */
function collectRecentCompletedMatches(divisions, sinceTs) {
    const all = (Array.isArray(divisions) ? divisions : []).flatMap((division) =>
        (Array.isArray(division?.brackets) ? division.brackets : []).flatMap((bracket) =>
            Array.isArray(bracket?.matches) ? bracket.matches : []
        )
    );

    const completed = all.filter((match) => COMPLETED_STATUSES.has(String(match?.status || "")));

    const filtered = sinceTs > 0
        ? completed.filter((match) => {
            const ts = getMatchTimestamp(match);
            // Sin fecha fiable y ya hay noticias previas: mejor excluir que repetir un resultado antiguo.
            return Number.isFinite(ts) && ts > sinceTs;
        })
        : completed;

    return filtered
        .sort((a, b) => (getMatchTimestamp(b) || 0) - (getMatchTimestamp(a) || 0))
        .slice(0, MAX_MATCHES_PER_REQUEST);
}

function describeTournamentLocation(tournament) {
    const location = tournament?.location;
    if (!location) return "Valencia, España";
    if (typeof location === "string") return location;
    return location.city || location.name || location.country || "Valencia, España";
}

module.exports = async function handler(req, res) {
    const user = await guardRequest(req, res);
    if (!user) return;

    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const options = body.options && typeof body.options === "object" ? body.options : {};

        const [snapshot, publishedNews] = await Promise.all([fetchPsaSnapshot(), fetchPublishedNews()]);
        const sinceTs = getLastPublishedTimestamp(publishedNews);
        const divisions = Array.isArray(snapshot.divisions) ? snapshot.divisions : [];
        const matches = collectRecentCompletedMatches(divisions, sinceTs);

        const tournament = {
            name: snapshot.tournament?.name || "PSA Valencia Open",
            location: describeTournamentLocation(snapshot.tournament)
        };

        // Sin partidos completados todavía (antes de empezar el torneo, o justo tras la última
        // noticia): en vez de fallar, generamos una previa del torneo a partir del cuadro. Así el
        // botón siempre produce algo que revisar, incluso sin resultados en vivo.
        const storyAnalysis = matches.length > 0 ? analyzeStory(matches, divisions) : buildTournamentPreview(divisions);
        const prompts = matches.length > 0
            ? buildPromptsForVersions({ storyAnalysis, matches, tournament, options })
            : buildPreviewPrompts({ preview: storyAnalysis, tournament, options });
        const model = process.env.OPENAI_MODEL || "gpt-5";
        const maxOutputTokens = estimateMaxOutputTokens(options.length);

        const results = await Promise.allSettled(
            prompts.map((prompt) =>
                callStructuredOpenAi({ system: prompt.system, user: prompt.user, model, maxOutputTokens, schema: ARTICLE_JSON_SCHEMA }).then((article) => ({
                    version: prompt.version,
                    label: prompt.label,
                    article: { ...article, html: buildArticleHtml(article) }
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
                topMatches: storyAnalysis.topMatches,
                isPreview: Boolean(storyAnalysis.isPreview)
            },
            versions
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error?.message || "Error inesperado generando la noticia." });
    }
};
