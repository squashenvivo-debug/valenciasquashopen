/**
 * /api/refine-news
 *
 * El "cuadro de chat" del Centro de Prensa IA: recibe una versión de artículo
 * ya generada más una instrucción en lenguaje natural ("hazlo más corto",
 * "quita la última frase", "dale más protagonismo a Iván Pérez"...) y devuelve
 * el artículo completo actualizado, manteniendo la voz de esa versión.
 *
 * Misma protección que /api/generate-news: la API key de OpenAI nunca sale de
 * aquí, y exige una sesión de Supabase válida del panel admin.
 */

"use strict";

const { guardRequest } = require("../lib/apiAuth");
const { callStructuredOpenAi, estimateMaxOutputTokens } = require("../lib/openaiClient");
const { buildRefinePrompt, buildArticleHtml, ARTICLE_JSON_SCHEMA, VERSION_STYLES } = require("../lib/newsPrompt");

const KNOWN_VERSION_IDS = new Set(VERSION_STYLES.map((style) => style.id));

module.exports = async function handler(req, res) {
    const user = await guardRequest(req, res);
    if (!user) return;

    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const versionId = KNOWN_VERSION_IDS.has(body.version) ? body.version : VERSION_STYLES[0].id;
        const article = body.article && typeof body.article === "object" ? body.article : null;
        const instruction = String(body.instruction || "").trim();
        const language = body.language === "en" ? "en" : "es";

        if (!article || !String(article.title || "").trim()) {
            res.status(400).json({ success: false, error: "Falta el artículo actual a modificar." });
            return;
        }
        if (!instruction) {
            res.status(400).json({ success: false, error: "Escribe qué quieres cambiar antes de aplicar." });
            return;
        }
        if (instruction.length > 500) {
            res.status(400).json({ success: false, error: "La instrucción es demasiado larga (máximo 500 caracteres)." });
            return;
        }

        const { system, user: userPrompt } = buildRefinePrompt({ versionId, article, instruction, language });
        const model = process.env.OPENAI_MODEL || "gpt-5";
        const maxOutputTokens = estimateMaxOutputTokens(600);

        const updated = await callStructuredOpenAi({
            system,
            user: userPrompt,
            model,
            maxOutputTokens,
            schema: ARTICLE_JSON_SCHEMA
        });

        res.status(200).json({
            success: true,
            article: { ...updated, html: buildArticleHtml(updated) }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error?.message || "No se pudo aplicar el cambio." });
    }
};
