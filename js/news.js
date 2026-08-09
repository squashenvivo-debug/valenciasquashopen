const NEWS_COLLECTION_KEY = "newsCollection";
const DYNAMIC_LANGS = ["es", "va", "en", "fr"];

async function syncNewsStateFromCloud() {
    const cloud = window.PSACloudStore;
    if (!cloud?.isReady?.()) return;

    await cloud.syncLocalStorageFromCloud([NEWS_COLLECTION_KEY]);
}

function getCurrentLanguage() {
    const lang = (localStorage.getItem("language") || "es").toLowerCase();
    return DYNAMIC_LANGS.includes(lang) ? lang : "es";
}

/** Texto plano seguro para usar como resumen/descripción: quita TODAS las etiquetas antes de
 *  recortar, para no dejar nunca HTML a medio cortar (a diferencia de un simple
 *  string.slice() sobre HTML en crudo, que corta donde caiga sin mirar las etiquetas). */
function stripHtmlTagsForSummary(html, maxLen = 160) {
    const text = String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!text) return "";
    if (text.length <= maxLen) return text;
    return `${text.slice(0, maxLen).replace(/\s+\S*$/, "")}…`;
}

function normalizeLocalizedText(value) {
    if (value && typeof value === "object") {
        const base = value.es || value.va || value.en || value.fr || "";
        return {
            es: String(value.es ?? base),
            va: String(value.va ?? base),
            en: String(value.en ?? base),
            fr: String(value.fr ?? base)
        };
    }

    const text = String(value || "");
    return { es: text, va: text, en: text, fr: text };
}

function getLocalizedText(value, lang) {
    const localized = normalizeLocalizedText(value);
    return localized[lang] || localized.es || "";
}

function resolveOptimizedAssetUrl(url) {
    return window.PSAOptimizations?.resolveAssetUrl?.(url) || url;
}

async function fetchCachedJson(url, options = {}) {
    if (window.PSAOptimizations?.fetchJson) {
        return window.PSAOptimizations.fetchJson(url, options);
    }
    const response = await fetch(url, { cache: options.requestCache || "default" });
    if (!response.ok) throw new Error(`No se pudo cargar ${url} (${response.status})`);
    return response.json();
}

function reportNewsError(scope, error) {
    const message = error?.message || String(error || "error desconocido");
    window.PSAOptimizations?.logError?.(scope, message);
}

function slugifyText(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 120);
}

function normalizeStringArray(value) {
    if (Array.isArray(value)) {
        return Array.from(new Set(value.map((entry) => String(entry || "").trim()).filter(Boolean)));
    }
    if (typeof value === "string") {
        return Array.from(new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean)));
    }
    return [];
}

function normalizeNewsStatus(value) {
    return ["draft", "scheduled", "published"].includes(value) ? value : "published";
}

function isNewsPublished(item, at = Date.now()) {
    const status = normalizeNewsStatus(item?.status);
    if (status === "draft") return false;
    if (status === "scheduled") {
        const publishTime = Date.parse(item?.publishAt || "");
        return Number.isFinite(publishTime) && publishTime <= at;
    }
    return true;
}

function normalizeNewsItem(item) {
    const article = item?.article || item?.summary || "";
    const title = normalizeLocalizedText(item?.title);
    const body = normalizeLocalizedText(article);
    // Recorte defensivo: si algún día llega un seo.description vacío, generamos uno de
    // repuesto quitando las etiquetas ANTES de recortar (recortar el HTML en crudo puede
    // cortar a mitad de una etiqueta y guardar/mostrar HTML roto).
    const fallbackSeoDescription = {
        es: stripHtmlTagsForSummary(item?.seo?.description?.es || body.es || "", 160),
        va: stripHtmlTagsForSummary(item?.seo?.description?.va || body.va || body.es || "", 160),
        en: stripHtmlTagsForSummary(item?.seo?.description?.en || body.en || body.es || "", 160),
        fr: stripHtmlTagsForSummary(item?.seo?.description?.fr || body.fr || body.es || "", 160)
    };

    const mainImage = item?.imageSrc || item?.image || "";
    const rawExtra = Array.isArray(item?.images) ? item.images : (Array.isArray(item?.gallery) ? item.gallery : []);
    const images = Array.from(new Set([mainImage, ...rawExtra].map((s) => String(s || "").trim()).filter(Boolean)));

    return {
        id: item?.id || "",
        imageSrc: mainImage,
        images: images,
        imageStoragePath: item?.imageStoragePath || "",
        player: String(item?.player || item?.meta?.player || "").trim(),
        title,
        article: body,
        createdAt: item?.createdAt || "",
        updatedAt: item?.updatedAt || item?.createdAt || "",
        publishAt: item?.publishAt || item?.publishedAt || "",
        status: normalizeNewsStatus(item?.status),
        category: String(item?.category || "").trim(),
        tags: normalizeStringArray(item?.tags),
        seo: {
            slug: slugifyText(item?.seo?.slug || item?.slug || title.es || item?.id || ""),
            title: normalizeLocalizedText(item?.seo?.title || title),
            description: normalizeLocalizedText(item?.seo?.description || fallbackSeoDescription)
        }
    };
}

function formatNewsDate(value, lang) {
    const dt = new Date(value || Date.now());
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleDateString(lang === "va" ? "ca-ES" : lang, {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function getNewsIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("newsId") || "";
}

function getNewsSlugFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return slugifyText(params.get("slug") || "");
}

/** Token de vista previa: debe coincidir con el id real (no adivinable) de la noticia
 *  para poder ver un borrador/programada antes de que se publique. */
function getPreviewTokenFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return String(params.get("preview") || "").trim();
}

/** El título es opcional: si el admin no lo rellenó (porque ya escribió el titular dentro
 *  del artículo con texto enriquecido), esto saca un texto de repuesto SOLO para lo que
 *  técnicamente necesita texto plano (pestaña del navegador, meta SEO, tarjetas de la
 *  portada) — nunca se usa para pintar una cabecera visible duplicada en la propia noticia. */
function deriveTitleFromArticleHtml(html, maxLen = 100) {
    const source = String(html || "");
    // Si el artículo empieza con un encabezado (h1-h3), usamos justo ese texto — normalmente
    // es el titular que el admin ya escribió ahí. Si no, recurrimos al primer texto plano.
    const headingMatch = source.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
    const raw = headingMatch ? headingMatch[1] : source;
    const text = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!text) return "";
    if (text.length <= maxLen) return text;
    return `${text.slice(0, maxLen).replace(/\s+\S*$/, "")}…`;
}

function ensureMetaTag(name) {
    let tag = document.querySelector(`meta[name="${name}"]`);
    if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", name);
        document.head.appendChild(tag);
    }
    return tag;
}

function applyNewsSeo(item, lang, title, article) {
    const seoTitle = getLocalizedText(item?.seo?.title, lang) || title || deriveTitleFromArticleHtml(article, 70) || "Noticia";
    const seoDescription = getLocalizedText(item?.seo?.description, lang) || stripHtmlTagsForSummary(article, 160);
    document.title = `${seoTitle} | PSA Valencia Open`;
    ensureMetaTag("description").setAttribute("content", seoDescription);
    ensureMetaTag("keywords").setAttribute("content", normalizeStringArray(item?.tags).join(", "));
}

function readNewsCollectionSync() {
    try {
        const raw = localStorage.getItem(NEWS_COLLECTION_KEY);
        if (raw !== null) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed.map(normalizeNewsItem);
            }
        }
    } catch (error) {
        return null;
    }
    return null;
}

async function readNewsCollection(includeUnpublished = false) {
    try {
        const raw = localStorage.getItem(NEWS_COLLECTION_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                const items = parsed.map(normalizeNewsItem);
                return includeUnpublished ? items : items.filter((item) => isNewsPublished(item));
            }
        }
    } catch (error) {
        return [];
    }

    try {
        const fallback = await fetchCachedJson("data/translations/news.json", { cacheKey: "news-detail-fallback", ttlMs: 300000 });
        if (!Array.isArray(fallback)) return [];

        return fallback.map((item, index) => ({
            id: `legacy_${index}`,
            imageSrc: `assets/images/news/${item.image}`,
            images: [`assets/images/news/${item.image}`],
            title: normalizeLocalizedText(item.title || ""),
            article: normalizeLocalizedText(item.summary || ""),
            createdAt: ""
        }));
    } catch (error) {
        reportNewsError("news-fallback", error);
        return [];
    }
}

function decodeAllHtmlEntities(str) {
    if (!str) return "";
    let decoded = String(str || "");

    for (let i = 0; i < 4; i++) {
        if (!/&[a-z0-9#]+;/i.test(decoded)) break;
        decoded = decoded
            .replace(/&amp;lt;/gi, "<")
            .replace(/&amp;gt;/gi, ">")
            .replace(/&lt;/gi, "<")
            .replace(/&gt;/gi, ">")
            .replace(/&#60;/gi, "<")
            .replace(/&#62;/gi, ">")
            .replace(/&#x3c;/gi, "<")
            .replace(/&#x3e;/gi, ">")
            .replace(/&quot;/gi, '"')
            .replace(/&#34;/gi, '"')
            .replace(/&#39;/gi, "'")
            .replace(/&apos;/gi, "'")
            .replace(/&nbsp;/gi, " ")
            .replace(/&amp;/gi, "&");
    }

    return decoded;
}

function formatNewsArticleHtml(text, mainTitle = "") {
    if (!text) return "";
    let str = decodeAllHtmlEntities(text).trim();

    if (mainTitle) {
        const cleanTitle = mainTitle.replace(/<[^>]*>/g, "").trim().toLowerCase();
        str = str.replace(/^(?:\s*<p>\s*)?<h[1-2]\b[^>]*>(.*?)<\/h[1-2]>(?:\s*<\/p>)?/i, (match, p1) => {
            const cleanP1 = p1.replace(/<[^>]*>/g, "").trim().toLowerCase();
            if (!cleanTitle || cleanP1.includes(cleanTitle) || cleanTitle.includes(cleanP1)) {
                return "";
            }
            return match;
        }).trim();

        str = str.replace(/^(?:\s*<p>\s*)(.*?)(?:\s*<\/p>)/i, (match, p1) => {
            const cleanP1 = p1.replace(/<[^>]*>/g, "").trim().toLowerCase();
            if (cleanTitle && (cleanP1 === cleanTitle || cleanP1.includes(cleanTitle))) {
                return "";
            }
            return match;
        }).trim();
    }

    if (/<[a-z][\s\S]*>/i.test(str)) {
        return str;
    }

    str = str.replace(/(\*\*|__)(.*?)\1/g, "<strong>$2</strong>");
    str = str.replace(/(\*|_)(.*?)\1/g, "<em>$2</em>");
    const paragraphs = str.split(/\n\s*\n/);
    return paragraphs.map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
}

async function renderNewsDetail() {
    const titleEl = document.getElementById("newsPageTitle");
    const card = document.getElementById("newsPageArticle");
    const galleryContainer = document.getElementById("newsPageGallery");
    const singleImage = document.getElementById("newsPageImage");
    const dateEl = document.getElementById("newsPageDate");
    const category = document.getElementById("newsPageCategory");
    const player = document.getElementById("newsPagePlayer");
    const heading = document.getElementById("newsPageHeading");
    const body = document.getElementById("newsPageBody");
    const tags = document.getElementById("newsPageTags");
    const empty = document.getElementById("newsPageEmpty");

    if (!card || !dateEl || !heading || !body || !empty) return;

    const lang = getCurrentLanguage();
    const newsId = getNewsIdFromUrl();
    const newsSlug = getNewsSlugFromUrl();
    const previewToken = getPreviewTokenFromUrl();

    // Solo pedimos la colección sin filtrar cuando hay un token de vista previa en la URL
    // (?preview=<id real de la noticia>) — para el resto de visitas seguimos usando solo
    // noticias publicadas, igual que antes.
    const collection = await readNewsCollection(Boolean(previewToken));
    let item = collection.find((entry) => {
        if (newsId && entry.id === newsId) return true;
        if (newsSlug && (slugifyText(entry?.seo?.slug || "") === newsSlug || slugifyText(entry?.title?.es || "") === newsSlug)) return true;
        return false;
    });

    // El token de vista previa solo vale si coincide EXACTAMENTE con el id real (no
    // adivinable) de esa noticia concreta — así ?preview=1 no destapa borradores ajenos.
    const isPreview = Boolean(item) && !isNewsPublished(item);
    if (isPreview && item.id !== previewToken) {
        item = null;
    }

    // Si no se pidió una noticia concreta (news.html sin parámetros), mostramos la más
    // reciente como valor por defecto. Pero si SÍ se pidió un slug/id concreto y no está
    // entre las publicadas (borrador, programada para el futuro, o slug inexistente) ni
    // tiene un token de vista previa válido, no sustituimos por otra noticia distinta sin
    // avisar — mostramos el estado de "no encontrada" en vez de confundir mostrando un
    // artículo que no es el pedido.
    if (!item && !newsId && !newsSlug && !previewToken && collection.length > 0) {
        item = collection[0];
    }

    const previewBanner = document.getElementById("newsPreviewBanner");
    if (previewBanner) previewBanner.style.display = isPreview && item ? "block" : "none";

    if (!item) {
        card.style.display = "none";
        empty.style.display = "block";
        return;
    }

    const title = getLocalizedText(item.title, lang);
    const article = getLocalizedText(item.article, lang);
    const displayDate = item.publishAt || item.createdAt;

    if (titleEl) titleEl.textContent = (typeof t === "function" ? t("psaNews.pageTitle") : "") || "Noticias";
    // El título es opcional: si no se rellenó porque ya está puesto dentro del artículo con
    // texto enriquecido, no pintamos una cabecera vacía/duplicada — el propio artículo ya
    // trae su titular con el formato que eligió el admin.
    heading.style.display = title ? "" : "none";
    heading.textContent = title || "";
    body.className = "news-content-body";
    body.style.whiteSpace = "normal";
    body.innerHTML = formatNewsArticleHtml(article || "", title || "");

    // Render all images complete & uncropped
    const allImages = Array.isArray(item.images) && item.images.length ? item.images : [item.imageSrc || ""];
    const validImages = allImages.filter(Boolean);

    if (galleryContainer) {
        if (validImages.length > 1) {
            galleryContainer.className = "news-detail-gallery news-detail-grid";
            galleryContainer.innerHTML = validImages.map((src, idx) => `
                <img src="${resolveOptimizedAssetUrl(src)}" alt="${title} (${idx + 1})" loading="lazy" decoding="async" style="width:100%; height:auto; max-height:75vh; object-fit:contain; border-radius:12px; background:#06101a;">
            `).join("");
        } else if (validImages.length === 1) {
            galleryContainer.className = "news-detail-gallery";
            galleryContainer.innerHTML = `
                <img src="${resolveOptimizedAssetUrl(validImages[0])}" alt="${title}" loading="lazy" decoding="async" style="width:100%; height:auto; max-height:75vh; object-fit:contain; border-radius:12px; background:#06101a;">
            `;
        } else if (singleImage) {
            singleImage.style.display = "none";
        }
    } else if (singleImage && validImages[0]) {
        singleImage.src = resolveOptimizedAssetUrl(validImages[0]);
        singleImage.alt = title || "Noticia";
        singleImage.style.objectFit = "contain";
        singleImage.style.height = "auto";
        singleImage.style.maxHeight = "75vh";
    }

    dateEl.textContent = formatNewsDate(displayDate, lang);
    if (category) category.textContent = item.category || "";
    if (player) player.textContent = item.player ? `Jugador: ${item.player}` : "";
    if (tags) tags.textContent = normalizeStringArray(item.tags).map((tag) => `#${tag}`).join(" · ");
    applyNewsSeo(item, lang, title, article);
    renderNewsShareBar(item, title, article, isPreview);
}

function loadImageForCanvas(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
        img.src = src;
    });
}

/** Genera la miniatura tal cual se ve en la tarjeta de la portada (mismo recorte 5:3 que
 *  css/news.css usa para .news-card img) y le añade la marca "psavalenciaopen.com" abajo a
 *  la izquierda — esta es la imagen que se comparte, no la foto original sin marcar. */
async function buildShareThumbnail(imageUrl) {
    try {
        const img = await loadImageForCanvas(imageUrl);
        const width = 1200;
        const height = 720; // misma proporción 5:3 que .news-card img (100% × 240px)

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
        const drawWidth = img.naturalWidth * scale;
        const drawHeight = img.naturalHeight * scale;
        ctx.drawImage(img, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);

        const label = "psavalenciaopen.com";
        const paddingX = 18;
        const boxHeight = 46;
        ctx.font = "600 26px Arial, Helvetica, sans-serif";
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = "rgba(13, 35, 64, 0.78)";
        ctx.fillRect(0, height - boxHeight, textWidth + paddingX * 2, boxHeight);
        ctx.fillStyle = "#ffffff";
        ctx.textBaseline = "middle";
        ctx.fillText(label, paddingX, height - boxHeight / 2 + 1);

        return await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    } catch (error) {
        return null;
    }
}

/** Trae la miniatura ya marcada como File para compartirla de verdad, no solo el enlace — es
 *  lo que hace que Instagram ofrezca "Historia"/"Reel" en su propio selector (si solo recibe
 *  texto/enlace, Instagram únicamente deja reenviarlo como mensaje directo, ya que un enlace
 *  no es contenido visual válido para una historia). */
async function fetchShareableImageFile(imageUrl, filename) {
    const blob = await buildShareThumbnail(imageUrl);
    if (!blob) return null;
    return new File([blob], `${filename}.jpg`, { type: "image/jpeg" });
}

/**
 * Un único botón "Compartir" que abre el panel nativo de compartir del dispositivo (Web
 * Share API) — ahí es donde el usuario elige WhatsApp, Instagram, Facebook, Telegram, etc.
 * Instagram en concreto no tiene ningún enlace público de "compartir" que una web pueda usar
 * directamente (solo su propia app), así que el panel nativo del sistema es la única vía
 * real para ofrecerlo. Si el navegador no soporta esa API (algunos de escritorio), en vez de
 * ocultar el botón copiamos el enlace al portapapeles — siempre hace algo útil.
 */
async function shareOrCopyLink(button, shareTitle, shareUrl, imageUrl) {
    if (typeof navigator.share === "function") {
        if (imageUrl && typeof navigator.canShare === "function") {
            const file = await fetchShareableImageFile(imageUrl, "psa-valencia-open");
            if (file && navigator.canShare({ files: [file] })) {
                navigator.share({ files: [file], title: shareTitle, text: shareTitle, url: shareUrl }).catch(() => {});
                return;
            }
        }
        navigator.share({ title: shareTitle, url: shareUrl }).catch(() => {});
        return;
    }

    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(shareUrl).then(() => {
            const original = button.innerHTML;
            button.innerHTML = `✅ ${(typeof t === "function" ? t("psaNews.linkCopied") : "") || "Enlace copiado"}`;
            setTimeout(() => { button.innerHTML = original; }, 2000);
        }).catch(() => {
            window.open(shareUrl, "_blank", "noopener");
        });
        return;
    }

    window.open(shareUrl, "_blank", "noopener");
}

function renderNewsShareBar(item, title, article, isPreview) {
    const bar = document.getElementById("newsShareBar");
    const button = document.getElementById("newsShareNative");
    if (!bar || !button) return;

    if (isPreview) {
        bar.style.display = "none";
        return;
    }

    const slug = item?.seo?.slug || "";
    const shareUrl = slug
        ? `${window.location.origin}${window.location.pathname}?slug=${encodeURIComponent(slug)}`
        : window.location.href.split("&preview=")[0];
    const shareText = title || deriveTitleFromArticleHtml(article, 100) || "PSA Valencia Open";

    button.onclick = () => shareOrCopyLink(button, shareText, shareUrl, item?.imageSrc || "");
    bar.style.display = "";
}

document.addEventListener("DOMContentLoaded", async () => {
    await syncNewsStateFromCloud();
    await renderNewsDetail();
    window.PSAOptimizations?.applyLazyMedia?.(document);
});
