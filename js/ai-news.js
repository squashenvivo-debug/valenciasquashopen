/**
 * ai-news.js — Centro de Prensa IA (admin-ai-news.html)
 *
 * Lógica de cliente: pide al backend serverless (api/generate-news en Vercel)
 * que genere la noticia, y publica la versión elegida reutilizando el mismo
 * almacén de noticias (localStorage + Supabase) que ya usa admin-news.html.
 *
 * El backend hace todo el trabajo pesado (consultar PSA, decidir la historia,
 * llamar a OpenAI): este archivo solo manda las preferencias (tono/longitud/
 * idioma), pinta el resultado y gestiona la publicación. No necesita ninguna
 * configuración adicional aparte de `aiNewsApiBase` en config.js.
 *
 * Se carga después de js/admin.js en la misma página, así que reutiliza como
 * funciones globales: readNewsCollection, saveNewsCollection, createId,
 * slugifyText, buildLocalizedFromSpanish, uploadNewsImageFile,
 * normalizeStringArray, resolveNewsPublication, escapeHtml.
 */

"use strict";

let aiNewsVersions = {}; // version -> artículo actual (con las ediciones del redactor)
let aiNewsSelectedVersion = null;

function getAiNewsApiUrl() {
    const base = String(window.PSA_CONFIG?.aiNewsApiBase || "").trim().replace(/\/+$/, "");
    return base ? `${base}/api/generate-news` : "";
}

function setAiNewsStatus(message, isError = false) {
    const el = document.getElementById("aiNewsStatus");
    if (!el) return;
    el.textContent = message;
    el.style.color = isError ? "#ff8f8f" : "#93E4A2";
}

function setAiNewsPublishStatus(message, isError = false) {
    const el = document.getElementById("aiNewsPublishStatusMsg");
    if (!el) return;
    el.textContent = message;
    el.style.color = isError ? "#ff8f8f" : "#93E4A2";
}

async function runAiNewsGeneration() {
    const apiUrl = getAiNewsApiUrl();
    if (!apiUrl) {
        setAiNewsStatus("Falta configurar aiNewsApiBase en config.js (URL del backend IA en Vercel).", true);
        return;
    }

    const tone = document.getElementById("aiNewsTone")?.value || "periodistico";
    const length = document.getElementById("aiNewsLength")?.value || "500";
    const language = document.getElementById("aiNewsLanguage")?.value || "es";

    const generateBtn = document.getElementById("generateAiNewsBtn");
    if (generateBtn) generateBtn.disabled = true;

    try {
        setAiNewsStatus("Consultando PSA y generando 3 versiones con IA (puede tardar unos segundos)...");

        const token = await window.AdminSupabase?.getAccessToken?.();
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token || ""}`
            },
            body: JSON.stringify({ options: { tone, length, language } })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.success) {
            throw new Error(payload?.error || `El backend de IA respondió con error (${response.status}).`);
        }

        renderAiNewsStory(payload.story);
        renderAiNewsVersions(payload.versions, language);
        setAiNewsStatus("Listo. Revisa las 3 versiones antes de publicar.");
    } catch (error) {
        setAiNewsStatus(`No se pudo generar la noticia: ${error?.message || "error inesperado"}`, true);
    } finally {
        if (generateBtn) generateBtn.disabled = false;
    }
}

function renderAiNewsStory(story) {
    const box = document.getElementById("aiNewsStoryBox");
    if (!box || !story) return;

    box.hidden = false;
    box.innerHTML = `
        <p class="ai-news-story-label">Historia detectada: <strong>${escapeHtml(story.mainStoryLabel || "")}</strong></p>
        <p>${escapeHtml(story.mainStoryBrief || "")}</p>
        <p class="admin-muted">Jugador del día: ${escapeHtml(story.playerOfDay || "sin protagonista único")} · ${Number(story.totalMatchesAnalyzed) || 0} partido(s) analizados</p>
    `;
}

function fieldsToTextarea(values) {
    return (Array.isArray(values) ? values : []).join("\n\n");
}

function renderAiNewsVersions(versions, language) {
    aiNewsVersions = {};
    const container = document.getElementById("aiNewsResults");
    if (!container) return;

    container.innerHTML = (Array.isArray(versions) ? versions : []).map((entry) => {
        if (entry.error || !entry.article) {
            return `
                <article class="ai-news-version-card is-error" data-version="${escapeHtml(entry.version)}">
                    <h3>${escapeHtml(entry.label || entry.version)}</h3>
                    <p class="admin-status" style="color:#ff8f8f;">No se pudo generar: ${escapeHtml(entry.error || "error desconocido")}</p>
                    <div class="results-actions">
                        <button type="button" class="ai-news-regenerar-btn" data-version="${escapeHtml(entry.version)}">Reintentar</button>
                    </div>
                </article>`;
        }

        aiNewsVersions[entry.version] = { ...entry.article, language };
        const a = entry.article;
        const v = entry.version;

        return `
            <article class="ai-news-version-card" data-version="${escapeHtml(v)}">
                <h3>${escapeHtml(entry.label)}</h3>

                <label class="field-label">Título</label>
                <input type="text" data-field="title" data-version="${escapeHtml(v)}" value="${escapeHtml(a.title)}" disabled>

                <label class="field-label">Subtítulo</label>
                <input type="text" data-field="subtitle" data-version="${escapeHtml(v)}" value="${escapeHtml(a.subtitle || "")}" disabled>

                <label class="field-label">Entradilla</label>
                <textarea data-field="lead" data-version="${escapeHtml(v)}" disabled>${escapeHtml(a.lead || "")}</textarea>

                <label class="field-label">Desarrollo</label>
                <textarea data-field="body_paragraphs" data-version="${escapeHtml(v)}" rows="8" disabled>${escapeHtml(fieldsToTextarea(a.body_paragraphs))}</textarea>

                <label class="field-label">Momentos clave</label>
                <textarea data-field="key_moments" data-version="${escapeHtml(v)}" disabled>${escapeHtml(fieldsToTextarea(a.key_moments))}</textarea>

                <label class="field-label">Jugador del día</label>
                <input type="text" data-field="player_of_day" data-version="${escapeHtml(v)}" value="${escapeHtml(a.player_of_day || "")}" disabled>

                <label class="field-label">La sorpresa</label>
                <textarea data-field="surprise" data-version="${escapeHtml(v)}" disabled>${escapeHtml(a.surprise || "")}</textarea>

                <label class="field-label">Próximos partidos</label>
                <textarea data-field="next_matches" data-version="${escapeHtml(v)}" disabled>${escapeHtml(a.next_matches || "")}</textarea>

                <label class="field-label">Cierre</label>
                <textarea data-field="closing" data-version="${escapeHtml(v)}" disabled>${escapeHtml(a.closing || "")}</textarea>

                <div class="results-actions">
                    <button type="button" class="ai-news-editar-btn" data-version="${escapeHtml(v)}">Editar</button>
                    <button type="button" class="ai-news-aceptar-btn" data-version="${escapeHtml(v)}">Aceptar</button>
                    <button type="button" class="ai-news-regenerar-btn btn-secondary-admin" data-version="${escapeHtml(v)}">Regenerar</button>
                </div>
            </article>`;
    }).join("");
}

function toggleVersionEditing(version, button) {
    const card = document.querySelector(`.ai-news-version-card[data-version="${CSS.escape(version)}"]`);
    if (!card) return;

    const fields = card.querySelectorAll("input[data-field], textarea[data-field]");
    const nowEditing = button.textContent.trim() === "Editar";
    fields.forEach((field) => { field.disabled = !nowEditing; });
    button.textContent = nowEditing ? "Bloquear" : "Editar";
}

function readVersionFromCard(version) {
    const card = document.querySelector(`.ai-news-version-card[data-version="${CSS.escape(version)}"]`);
    if (!card) return null;

    const getValue = (field) => card.querySelector(`[data-field="${field}"]`)?.value || "";
    const stored = aiNewsVersions[version] || {};

    return {
        title: getValue("title"),
        subtitle: getValue("subtitle"),
        lead: getValue("lead"),
        body_paragraphs: getValue("body_paragraphs").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
        key_moments: getValue("key_moments").split("\n").map((p) => p.trim()).filter(Boolean),
        player_of_day: getValue("player_of_day"),
        surprise: getValue("surprise"),
        next_matches: getValue("next_matches"),
        closing: getValue("closing"),
        seo: stored.seo || {},
        language: stored.language || "es"
    };
}

/** Construye el HTML del artículo a partir de los campos estructurados (mismo formato que el editor manual). */
function buildArticleHtml(article) {
    const parts = [];
    if (article.subtitle) parts.push(`<p><strong>${article.subtitle}</strong></p>`);
    if (article.lead) parts.push(`<p>${article.lead}</p>`);
    article.body_paragraphs.forEach((paragraph) => parts.push(`<p>${paragraph}</p>`));
    if (article.key_moments.length > 0) {
        parts.push(`<h3>Momentos clave</h3><ul>${article.key_moments.map((item) => `<li>${item}</li>`).join("")}</ul>`);
    }
    if (article.player_of_day) parts.push(`<p><strong>Jugador del día:</strong> ${article.player_of_day}</p>`);
    if (article.surprise) parts.push(`<p><strong>La sorpresa:</strong> ${article.surprise}</p>`);
    if (article.next_matches) parts.push(`<p><strong>Próximos partidos:</strong> ${article.next_matches}</p>`);
    if (article.closing) parts.push(`<p>${article.closing}</p>`);
    return parts.join("\n");
}

function openPublishPanelForVersion(version) {
    const article = readVersionFromCard(version);
    if (!article || !article.title.trim()) {
        setAiNewsStatus("Esa versión no tiene título; revísala antes de aceptarla.", true);
        return;
    }

    aiNewsSelectedVersion = article;

    const panel = document.getElementById("aiNewsPublishPanel");
    if (!panel) return;
    panel.hidden = false;

    const playerField = document.getElementById("aiNewsPublishPlayer");
    if (playerField && !playerField.value) playerField.value = article.player_of_day || "";

    panel.scrollIntoView({ behavior: "smooth", block: "start" });
    setAiNewsPublishStatus("");
}

async function confirmPublishAiNews() {
    if (!aiNewsSelectedVersion) {
        setAiNewsPublishStatus("Selecciona primero una versión con 'Aceptar'.", true);
        return;
    }

    const imageInput = document.getElementById("aiNewsPublishImage");
    const imageFile = imageInput?.files?.[0];
    if (!imageFile) {
        setAiNewsPublishStatus("Sube una foto para la noticia.", true);
        return;
    }

    const confirmBtn = document.getElementById("aiNewsConfirmPublishBtn");
    if (confirmBtn) confirmBtn.disabled = true;

    try {
        const article = aiNewsSelectedVersion;
        const statusValue = document.getElementById("aiNewsPublishStatus")?.value || "published";
        const publishAtValue = document.getElementById("aiNewsPublishAt")?.value || "";
        const categoryValue = (document.getElementById("aiNewsPublishCategory")?.value || "").trim();
        const playerValue = (document.getElementById("aiNewsPublishPlayer")?.value || "").trim();
        const tagsValue = document.getElementById("aiNewsPublishTags")?.value || "";

        const publication = resolveNewsPublication(statusValue, publishAtValue);
        if (publication.error) {
            setAiNewsPublishStatus(publication.error, true);
            return;
        }

        const articleHtml = buildArticleHtml(article);
        const slugSource = article.seo?.slug || article.title;
        const slug = slugifyText(slugSource);
        if (!slug) {
            setAiNewsPublishStatus("El título no permite generar un slug válido.", true);
            return;
        }

        const newsId = createId("news");
        const uploadedImage = await uploadNewsImageFile(imageFile, newsId);

        // Solo traducimos automáticamente cuando el artículo se generó en español: traducir
        // "desde español" un texto que ya está en inglés produciría una traducción incorrecta.
        const isSpanish = article.language !== "en";
        const localizedTitle = isSpanish
            ? await buildLocalizedFromSpanish(article.title)
            : { es: article.title, va: article.title, en: article.title, fr: article.title };
        const localizedArticle = isSpanish
            ? await buildLocalizedFromSpanish(articleHtml)
            : { es: articleHtml, va: articleHtml, en: articleHtml, fr: articleHtml };
        const seoTitleSource = article.seo?.meta_title || article.title;
        const seoDescriptionSource = article.seo?.meta_description || article.lead;
        const localizedSeoTitle = isSpanish
            ? await buildLocalizedFromSpanish(seoTitleSource)
            : { es: seoTitleSource, va: seoTitleSource, en: seoTitleSource, fr: seoTitleSource };
        const localizedSeoDescription = isSpanish
            ? await buildLocalizedFromSpanish(seoDescriptionSource)
            : { es: seoDescriptionSource, va: seoDescriptionSource, en: seoDescriptionSource, fr: seoDescriptionSource };

        const collection = readNewsCollection();
        collection.unshift({
            id: newsId,
            imageSrc: uploadedImage.imageSrc || "",
            imageStoragePath: uploadedImage.imageStoragePath || "",
            title: localizedTitle,
            article: localizedArticle,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            publishAt: publication.publishAt,
            status: publication.status,
            category: categoryValue,
            player: playerValue,
            tags: normalizeStringArray(tagsValue),
            seo: {
                slug,
                title: localizedSeoTitle,
                description: localizedSeoDescription
            }
        });

        const saved = saveNewsCollection(collection);
        if (!saved) {
            setAiNewsPublishStatus("No se pudo guardar la noticia: almacenamiento lleno.", true);
            return;
        }

        setAiNewsPublishStatus("Noticia publicada correctamente.");
        document.getElementById("aiNewsPublishPanel").hidden = true;
        if (imageInput) imageInput.value = "";
        aiNewsSelectedVersion = null;
    } catch (error) {
        setAiNewsPublishStatus(`No se pudo publicar: ${error?.message || "error inesperado"}`, true);
    } finally {
        if (confirmBtn) confirmBtn.disabled = false;
    }
}

function bindAiNewsResultsDelegation() {
    const container = document.getElementById("aiNewsResults");
    if (!container) return;

    container.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const version = target.getAttribute("data-version");
        if (!version) return;

        if (target.classList.contains("ai-news-editar-btn")) {
            toggleVersionEditing(version, target);
        } else if (target.classList.contains("ai-news-aceptar-btn")) {
            openPublishPanelForVersion(version);
        } else if (target.classList.contains("ai-news-regenerar-btn")) {
            runAiNewsGeneration();
        }
    });
}

function initAiNewsAdmin() {
    const panel = document.getElementById("ai-news-panel");
    if (!panel) return;

    document.getElementById("generateAiNewsBtn")?.addEventListener("click", runAiNewsGeneration);

    document.getElementById("aiNewsConfirmPublishBtn")?.addEventListener("click", confirmPublishAiNews);
    document.getElementById("aiNewsCancelPublishBtn")?.addEventListener("click", () => {
        document.getElementById("aiNewsPublishPanel").hidden = true;
        aiNewsSelectedVersion = null;
    });

    bindAiNewsResultsDelegation();
}
