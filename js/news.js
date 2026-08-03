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
    const fallbackSeoDescription = {
        es: String(item?.seo?.description?.es || body.es || "").slice(0, 160),
        va: String(item?.seo?.description?.va || body.va || body.es || "").slice(0, 160),
        en: String(item?.seo?.description?.en || body.en || body.es || "").slice(0, 160),
        fr: String(item?.seo?.description?.fr || body.fr || body.es || "").slice(0, 160)
    };
    return {
        id: item?.id || "",
        imageSrc: item?.imageSrc || item?.image || "",
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
    const seoTitle = getLocalizedText(item?.seo?.title, lang) || title || "Noticia";
    const seoDescription = getLocalizedText(item?.seo?.description, lang) || article.slice(0, 160);
    document.title = `${seoTitle} | PSA Valencia Open`;
    ensureMetaTag("description").setAttribute("content", seoDescription);
    ensureMetaTag("keywords").setAttribute("content", normalizeStringArray(item?.tags).join(", "));
}

async function readNewsCollection() {
    try {
        const raw = localStorage.getItem(NEWS_COLLECTION_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed.map(normalizeNewsItem).filter((item) => isNewsPublished(item));
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
            title: normalizeLocalizedText(item.title || ""),
            article: normalizeLocalizedText(item.summary || ""),
            createdAt: ""
        }));
    } catch (error) {
        reportNewsError("news-fallback", error);
        return [];
    }
}

async function renderNewsDetail() {
    const titleEl = document.getElementById("newsPageTitle");
    const card = document.getElementById("newsPageArticle");
    const image = document.getElementById("newsPageImage");
    const dateEl = document.getElementById("newsPageDate");
    const category = document.getElementById("newsPageCategory");
    const player = document.getElementById("newsPagePlayer");
    const heading = document.getElementById("newsPageHeading");
    const body = document.getElementById("newsPageBody");
    const tags = document.getElementById("newsPageTags");
    const empty = document.getElementById("newsPageEmpty");

    if (!titleEl || !card || !image || !dateEl || !heading || !body || !empty) return;

    const lang = getCurrentLanguage();
    const newsId = getNewsIdFromUrl();
    const newsSlug = getNewsSlugFromUrl();
    const collection = await readNewsCollection();
    const item = collection.find((entry) => {
        if (newsSlug && slugifyText(entry?.seo?.slug || "") === newsSlug) return true;
        return entry.id === newsId;
    });

    if (!item) {
        card.style.display = "none";
        empty.style.display = "block";
        return;
    }

    const title = getLocalizedText(item.title, lang);
    const article = getLocalizedText(item.article, lang);
    const displayDate = item.publishAt || item.createdAt;

    titleEl.textContent = title || "Noticia";
    heading.textContent = title || "";
    body.textContent = article || "";
    image.loading = "lazy";
    image.decoding = "async";
    image.src = resolveOptimizedAssetUrl(item.imageSrc || "");
    image.alt = title || "Noticia";
    dateEl.textContent = formatNewsDate(displayDate, lang);
    if (category) category.textContent = item.category || "";
    if (player) player.textContent = item.player ? `Jugador: ${item.player}` : "";
    if (tags) tags.textContent = normalizeStringArray(item.tags).map((tag) => `#${tag}`).join(" · ");
    applyNewsSeo(item, lang, title, article);
}

document.addEventListener("DOMContentLoaded", async () => {
    await syncNewsStateFromCloud();
    await renderNewsDetail();
    window.PSAOptimizations?.applyLazyMedia?.(document);
});
