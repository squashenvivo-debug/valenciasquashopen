/**
 * newsPrompt.js
 *
 * Construye los prompts que se envían a OpenAI a partir de:
 *  - la plantilla de sesión/ronda correspondiente (/prompts/*.md)
 *  - el análisis de la historia principal (lib/newsAnalyzer.js)
 *  - las opciones elegidas por el redactor (tono, longitud, idioma)
 *
 * Módulo Node puro (CommonJS). Solo se ejecuta en el servidor.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const PROMPTS_DIR = path.join(__dirname, "..", "prompts");
const templateCache = new Map();

const TEMPLATE_FILES = {
    morning: "morning.md",
    afternoon: "afternoon.md",
    quarters: "quarters.md",
    semis: "semis.md",
    final: "final.md",
    preview: "preview.md"
};

const LANGUAGE_NAMES = {
    es: "español",
    en: "inglés"
};

// Esquema JSON que debe devolver el modelo (Structured Outputs). Única fuente de verdad,
// compartida entre las 3 versiones y consumida por api/generate-news.js.
const ARTICLE_JSON_SCHEMA = {
    type: "object",
    additionalProperties: false,
    properties: {
        title: { type: "string" },
        subtitle: { type: "string" },
        lead: { type: "string" },
        body_paragraphs: { type: "array", items: { type: "string" } },
        key_moments: { type: "array", items: { type: "string" } },
        player_of_day: { type: "string" },
        surprise: { type: "string" },
        next_matches: { type: "string" },
        closing: { type: "string" },
        seo: {
            type: "object",
            additionalProperties: false,
            properties: {
                meta_title: { type: "string" },
                meta_description: { type: "string" },
                slug: { type: "string" },
                keywords: { type: "array", items: { type: "string" } }
            },
            required: ["meta_title", "meta_description", "slug", "keywords"]
        }
    },
    required: [
        "title", "subtitle", "lead", "body_paragraphs", "key_moments",
        "player_of_day", "surprise", "next_matches", "closing", "seo"
    ]
};

// Estilo de cada versión: deben leerse como si las hubiera escrito una redacción distinta,
// no solo cambiar el titular.
const VERSION_STYLES = [
    {
        id: "periodistica",
        label: "Periodística",
        systemPrompt: `Eres un redactor veterano de la sección de deportes de un diario de referencia (estilo Marca/AS/L'Équipe).
Escribes crónica de squash profesional: pirámide invertida, dato + contexto, frases de longitud variable, sin adjetivos gratuitos.
Citas los marcadores con precisión. Nunca usas exclamaciones ni frases de efecto vacías. Tono sobrio, informativo, creíble.`
    },
    {
        id: "sensacionalista",
        label: "Sensacionalista",
        systemPrompt: `Eres un redactor de deportes de un medio popular, especializado en titulares de alto impacto emocional.
Escribes con ritmo trepidante, frases cortas, alguna exclamación medida, superlativos cuando el resultado los justifica.
Buscas enganchar desde la primera línea apelando a la épica y el drama del deporte, sin inventar datos que no existan.
El tono debe notarse claramente distinto de una crónica sobria: más viveza, más urgencia, más "gancho".`
    },
    {
        id: "seo",
        label: "SEO",
        systemPrompt: `Eres un redactor especializado en SEO deportivo. Escribes contenido optimizado para buscadores sin sonar robótico:
frases claras y escaneables, la respuesta a "qué ha pasado" en las dos primeras líneas, palabras clave relevantes
(nombres de jugadores, torneo, ronda, resultado) repartidas con naturalidad, subtítulos temáticos dentro del cuerpo.
Nunca sacrificas la legibilidad humana por meter palabras clave a la fuerza.`
    }
];

const SHARED_SYSTEM_SUFFIX = `
Reglas estrictas:
- No debe parecer escrito por una IA: varía el ritmo, la estructura de las frases y el vocabulario respecto a un texto genérico.
- No repitas literalmente el título dentro del subtítulo, la entradilla o el primer párrafo del desarrollo.
- Usa solo los datos que se te proporcionan; no inventes cifras, citas ni nombres que no aparezcan en el contexto.
- Devuelve exclusivamente el objeto JSON solicitado, en el idioma indicado en el contexto.`;

function readTemplate(templateKey) {
    const filename = TEMPLATE_FILES[templateKey] || TEMPLATE_FILES.afternoon;
    if (templateCache.has(filename)) return templateCache.get(filename);

    const fullPath = path.join(PROMPTS_DIR, filename);
    const contents = fs.readFileSync(fullPath, "utf8");
    templateCache.set(filename, contents);
    return contents;
}

/**
 * Elige qué plantilla de contexto usar según la ronda más avanzada disputada hoy;
 * si no hay rondas decisivas, cae en la franja horaria (mañana/tarde, hora de Madrid).
 */
function selectTemplateKey(matches, referenceDate) {
    const rounds = (Array.isArray(matches) ? matches : []).map((m) => String(m.round || "").toLowerCase());

    const isFinal = rounds.some((r) => /\bfinal\b/.test(r) && !r.includes("semi") && !r.includes("cuarto") && !r.includes("quarter"));
    if (isFinal) return "final";

    if (rounds.some((r) => r.includes("semi"))) return "semis";
    if (rounds.some((r) => r.includes("cuarto") || r.includes("quarter"))) return "quarters";

    const madridHour = Number(
        new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hour12: false }).format(referenceDate || new Date())
    );
    return madridHour < 15 ? "morning" : "afternoon";
}

function renderTemplate(templateText, tokens) {
    return Object.entries(tokens).reduce(
        (text, [key, value]) => text.split(`{{${key}}}`).join(String(value ?? "")),
        templateText
    );
}

function summarizeMatchesForPrompt(matches) {
    return (Array.isArray(matches) ? matches : []).map((match) => ({
        round: match.round,
        division: match.division,
        scoreline: match.scoreline,
        duration_minutes: match.duration_minutes,
        court: match.court,
        players: (match.players || []).map((p) => p.name).filter(Boolean),
        games: (match.games || []).map((g) => g.scores).filter(Boolean),
        retired: Boolean(match.retired),
        walkover: Boolean(match.walkover)
    }));
}

/**
 * Construye los 3 prompts (uno por versión) listos para enviar a la Responses API.
 *
 * @param {Object} params
 * @param {Object} params.storyAnalysis - salida de newsAnalyzer.analyzeStory()
 * @param {Array} params.matches - partidos completados de la jornada
 * @param {Object} params.tournament - { name, location } del torneo
 * @param {Object} params.options - { tone, length, language } elegidos por el redactor
 * @returns {Array<{version:string, label:string, system:string, user:string}>}
 */
function buildVersionPrompts(userPrompt, options) {
    const toneHint = String(options?.tone || "periodistico").trim();
    return VERSION_STYLES.map((style) => ({
        version: style.id,
        label: style.label,
        system: `${style.systemPrompt}\n${SHARED_SYSTEM_SUFFIX}\nTono adicional pedido por el redactor: ${toneHint}.`,
        user: userPrompt
    }));
}

function resolveLanguageAndWordCount(options) {
    const languageCode = options?.language === "en" ? "en" : "es";
    return { languageName: LANGUAGE_NAMES[languageCode], wordCount: Number(options?.length) || 500 };
}

function buildPromptsForVersions({ storyAnalysis, matches, tournament, options }) {
    const templateKey = selectTemplateKey(matches);
    const templateText = readTemplate(templateKey);
    const { languageName, wordCount } = resolveLanguageAndWordCount(options);

    const userPrompt = renderTemplate(templateText, {
        TOURNAMENT_NAME: tournament?.name || "PSA Valencia Open",
        TOURNAMENT_LOCATION: tournament?.location || "Valencia, España",
        TODAY: new Date().toISOString().slice(0, 10),
        MAIN_STORY_LABEL: storyAnalysis.mainStoryLabel,
        MAIN_STORY_BRIEF: storyAnalysis.mainStoryBrief,
        PLAYER_OF_DAY: storyAnalysis.playerOfDay || "sin protagonista único",
        MATCHES_JSON: JSON.stringify(summarizeMatchesForPrompt(matches), null, 2),
        WORD_COUNT: wordCount,
        LANGUAGE_NAME: languageName
    });

    return buildVersionPrompts(userPrompt, options);
}

/** Igual que buildPromptsForVersions pero para cuando aún no hay partidos completados (previa del torneo). */
function buildPreviewPrompts({ preview, tournament, options }) {
    const templateText = readTemplate("preview");
    const { languageName, wordCount } = resolveLanguageAndWordCount(options);

    const userPrompt = renderTemplate(templateText, {
        TOURNAMENT_NAME: tournament?.name || "PSA Valencia Open",
        TOURNAMENT_LOCATION: tournament?.location || "Valencia, España",
        TODAY: new Date().toISOString().slice(0, 10),
        DRAW_SIZE: preview.drawSize || "por confirmar",
        TOP_SEEDS_JSON: JSON.stringify(preview.topSeeds || [], null, 2),
        MAIN_STORY_BRIEF: preview.mainStoryBrief,
        WORD_COUNT: wordCount,
        LANGUAGE_NAME: languageName
    });

    return buildVersionPrompts(userPrompt, options);
}

/** Construye el HTML final del artículo a partir de los campos estructurados que devuelve el modelo. */
function buildArticleHtml(article) {
    const parts = [];
    if (article.subtitle) parts.push(`<p><strong>${article.subtitle}</strong></p>`);
    if (article.lead) parts.push(`<p>${article.lead}</p>`);
    (article.body_paragraphs || []).forEach((paragraph) => parts.push(`<p>${paragraph}</p>`));
    if ((article.key_moments || []).length > 0) {
        parts.push(`<h3>Momentos clave</h3><ul>${article.key_moments.map((item) => `<li>${item}</li>`).join("")}</ul>`);
    }
    if (article.player_of_day) parts.push(`<p><strong>Jugador del día:</strong> ${article.player_of_day}</p>`);
    if (article.surprise) parts.push(`<p><strong>La sorpresa:</strong> ${article.surprise}</p>`);
    if (article.next_matches) parts.push(`<p><strong>Próximos partidos:</strong> ${article.next_matches}</p>`);
    if (article.closing) parts.push(`<p>${article.closing}</p>`);
    return parts.join("\n");
}

module.exports = {
    buildPromptsForVersions,
    buildPreviewPrompts,
    buildArticleHtml,
    selectTemplateKey,
    ARTICLE_JSON_SCHEMA,
    VERSION_STYLES
};
