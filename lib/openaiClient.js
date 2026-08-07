/**
 * openaiClient.js
 *
 * Llamada compartida a la Responses API de OpenAI con salida estructurada
 * (JSON Schema). La usan tanto la generación inicial (api/generate-news)
 * como los refinamientos por chat (api/refine-news).
 */

"use strict";

const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const OPENAI_TIMEOUT_MS = 45000;

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

/**
 * @param {Object} params
 * @param {string} params.system
 * @param {string} params.user
 * @param {string} params.model
 * @param {number} params.maxOutputTokens
 * @param {Object} params.schema - JSON Schema que debe cumplir la respuesta
 * @param {string} [params.schemaName]
 * @returns {Promise<Object>} el objeto JSON ya parseado
 */
async function callStructuredOpenAi({ system, user, model, maxOutputTokens, schema, schemaName = "news_article" }) {
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
                        name: schemaName,
                        schema,
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

module.exports = { callStructuredOpenAi, estimateMaxOutputTokens };
