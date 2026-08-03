const GALLERY_COLLECTION_KEY = "galleryCollections";
const DYNAMIC_LANGS = ["es", "va", "en", "fr"];
let lastRenderedGalleryEntries = [];

async function syncGalleryStateFromCloud() {
    const cloud = window.PSACloudStore;
    if (!cloud?.isReady?.()) return;

    try {
        await cloud.syncLocalStorageFromCloud([GALLERY_COLLECTION_KEY]);
    } catch (error) {
        reportGalleryError("gallery-sync", error);
    }
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

function reportGalleryError(scope, error) {
    const message = error?.message || String(error || "error desconocido");
    window.PSAOptimizations?.logError?.(scope, message);
}

function normalizeGalleryDateValue(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const directMatch = raw.match(/^\d{4}-\d{2}-\d{2}$/);
    if (directMatch) return directMatch[0];
    const time = Date.parse(raw);
    if (!Number.isFinite(time)) return "";
    return new Date(time).toISOString().slice(0, 10);
}

function normalizeGalleryMeta(meta) {
    return {
        tournament: String(meta?.tournament || "").trim(),
        club: String(meta?.club || "").trim(),
        date: normalizeGalleryDateValue(meta?.date),
        category: String(meta?.category || "").trim()
    };
}

function normalizeGalleryPhotoMeta(photo, galleryMeta = {}) {
    return {
        tournament: String(photo?.tournament || galleryMeta?.tournament || "").trim(),
        club: String(photo?.club || galleryMeta?.club || "").trim(),
        date: normalizeGalleryDateValue(photo?.date || galleryMeta?.date),
        player: String(photo?.player || "").trim(),
        category: String(photo?.category || galleryMeta?.category || "").trim()
    };
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function normalizeGalleryItem(item) {
    const meta = normalizeGalleryMeta(item?.meta);
    const photos = Array.isArray(item?.photos) ? item.photos : [];
    return {
        id: item?.id || "",
        title: normalizeLocalizedText(item?.title),
        meta,
        photos: photos.map((photo) => ({
            id: photo?.id || "",
            src: photo?.src || "",
            storagePath: photo?.storagePath || "",
            processedSrc: photo?.processedSrc || "",
            processedStoragePath: photo?.processedStoragePath || "",
            ai: photo?.ai || null,
            caption: normalizeLocalizedText(photo?.caption),
            meta: normalizeGalleryPhotoMeta(photo?.meta || photo, meta)
        })).filter((photo) => !!photo.src)
    };
}

function openLightbox(src, caption) {
    const lightbox = document.getElementById("galleryLightbox");
    const image = document.getElementById("galleryLightboxImage");
    const captionEl = document.getElementById("galleryLightboxCaption");
    if (!lightbox || !image || !captionEl) return;

    image.src = src;
    captionEl.textContent = caption || "";
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function closeLightbox() {
    const lightbox = document.getElementById("galleryLightbox");
    const image = document.getElementById("galleryLightboxImage");
    if (!lightbox || !image) return;

    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    image.src = "";
    document.body.style.overflow = "";
}

function bindLightboxEvents() {
    const lightbox = document.getElementById("galleryLightbox");
    const closeBtn = document.getElementById("galleryLightboxClose");
    if (!lightbox || !closeBtn) return;

    closeBtn.addEventListener("click", closeLightbox);
    lightbox.addEventListener("click", (event) => {
        if (event.target === lightbox) {
            closeLightbox();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeLightbox();
        }
    });
}

function readGalleryCollection() {
    try {
        const raw = localStorage.getItem(GALLERY_COLLECTION_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(normalizeGalleryItem) : [];
    } catch (error) {
        return [];
    }
}

function getGalleryIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("galleryId") || "";
}

function formatGalleryDate(value, lang) {
    const normalized = normalizeGalleryDateValue(value);
    if (!normalized) return "";
    const dt = new Date(`${normalized}T00:00:00`);
    if (Number.isNaN(dt.getTime())) return normalized;
    return dt.toLocaleDateString(lang === "va" ? "ca-ES" : lang, {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function getGalleryScope() {
    const galleries = readGalleryCollection();
    const galleryId = getGalleryIdFromUrl();
    if (!galleryId) {
        return { galleryId: "", galleries, selectedGallery: null };
    }
    const selectedGallery = galleries.find((item) => item.id === galleryId) || null;
    return {
        galleryId,
        galleries: selectedGallery ? [selectedGallery] : [],
        selectedGallery
    };
}

function flattenGalleryPhotos(galleries, lang) {
    return galleries.flatMap((gallery) => {
        const galleryTitle = getLocalizedText(gallery.title, lang) || "Galeria";
        return (Array.isArray(gallery.photos) ? gallery.photos : []).map((photo, index) => {
            const meta = normalizeGalleryPhotoMeta(photo.meta, gallery.meta);
            const caption = getLocalizedText(photo.caption, lang);
            const imageSrc = resolveOptimizedAssetUrl(photo.processedSrc || photo.src);
            const searchBlob = [
                galleryTitle,
                caption,
                meta.tournament,
                meta.club,
                meta.date,
                meta.player,
                meta.category
            ].join(" ").toLowerCase();
            return {
                id: photo.id || `${gallery.id}_${index}`,
                galleryId: gallery.id,
                galleryTitle,
                imageSrc,
                caption,
                meta,
                searchBlob
            };
        });
    });
}

function populateSelect(select, values, placeholder) {
    if (!select) return;
    const current = select.value;
    const options = ["", ...values];
    select.innerHTML = options.map((value) => {
        const label = value || placeholder;
        const selected = value === current ? " selected" : "";
        return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(label)}</option>`;
    }).join("");
    if (!options.includes(current)) {
        select.value = "";
    }
}

function setupGalleryFilters(photoEntries, lang) {
    const tournamentValues = Array.from(new Set(photoEntries.map((item) => item.meta.tournament).filter(Boolean))).sort();
    const clubValues = Array.from(new Set(photoEntries.map((item) => item.meta.club).filter(Boolean))).sort();
    const dateValues = Array.from(new Set(photoEntries.map((item) => item.meta.date).filter(Boolean))).sort();
    const playerValues = Array.from(new Set(photoEntries.map((item) => item.meta.player).filter(Boolean))).sort();
    const categoryValues = Array.from(new Set(photoEntries.map((item) => item.meta.category).filter(Boolean))).sort();

    populateSelect(document.getElementById("galleryTournamentFilter"), tournamentValues, lang === "en" ? "All tournaments" : "Todos los torneos");
    populateSelect(document.getElementById("galleryClubFilter"), clubValues, lang === "en" ? "All clubs" : "Todos los clubs");
    populateSelect(document.getElementById("galleryDateFilter"), dateValues.map((value) => formatGalleryDate(value, lang)), lang === "en" ? "All dates" : "Todas las fechas");

    const dateSelect = document.getElementById("galleryDateFilter");
    if (dateSelect) {
        const current = dateSelect.dataset.rawValue || "";
        dateSelect.innerHTML = ["", ...dateValues].map((value) => {
            const label = value ? formatGalleryDate(value, lang) : (lang === "en" ? "All dates" : "Todas las fechas");
            const selected = value === current ? " selected" : "";
            return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(label)}</option>`;
        }).join("");
        if (!["", ...dateValues].includes(current)) {
            dateSelect.dataset.rawValue = "";
            dateSelect.value = "";
        } else {
            dateSelect.value = current;
        }
    }

    populateSelect(document.getElementById("galleryPlayerFilter"), playerValues, lang === "en" ? "All players" : "Todos los jugadores");
    populateSelect(document.getElementById("galleryCategoryFilter"), categoryValues, lang === "en" ? "All categories" : "Todas las categorias");
}

function getGalleryFilterState() {
    return {
        search: String(document.getElementById("gallerySearchInput")?.value || "").trim().toLowerCase(),
        tournament: String(document.getElementById("galleryTournamentFilter")?.value || "").trim(),
        club: String(document.getElementById("galleryClubFilter")?.value || "").trim(),
        date: String(document.getElementById("galleryDateFilter")?.value || "").trim(),
        player: String(document.getElementById("galleryPlayerFilter")?.value || "").trim(),
        category: String(document.getElementById("galleryCategoryFilter")?.value || "").trim()
    };
}

function filterGalleryPhotos(photoEntries, filters) {
    return photoEntries.filter((item) => {
        if (filters.search && !item.searchBlob.includes(filters.search)) return false;
        if (filters.tournament && item.meta.tournament !== filters.tournament) return false;
        if (filters.club && item.meta.club !== filters.club) return false;
        if (filters.date && item.meta.date !== filters.date) return false;
        if (filters.player && item.meta.player !== filters.player) return false;
        if (filters.category && item.meta.category !== filters.category) return false;
        return true;
    });
}

function renderGalleryArchive() {
    const { galleries, selectedGallery, galleryId } = getGalleryScope();
    const lang = getCurrentLanguage();

    const titleEl = document.getElementById("galleryPageTitle");
    const grid = document.getElementById("galleryDetailGrid");
    const empty = document.getElementById("galleryDetailEmpty");
    const summary = document.getElementById("galleryResultsSummary");

    if (!titleEl || !grid || !empty || !summary) return;

    if (galleryId && !selectedGallery) {
        titleEl.textContent = "Galeria no encontrada";
        empty.style.display = "block";
        empty.textContent = "Esta galeria no existe o fue eliminada.";
        grid.innerHTML = "";
        summary.textContent = "";
        return;
    }

    titleEl.textContent = selectedGallery
        ? (getLocalizedText(selectedGallery.title, lang) || "Galeria")
        : "Archivo de galerias";

    const photoEntries = flattenGalleryPhotos(galleries, lang);
    setupGalleryFilters(photoEntries, lang);
    const filters = getGalleryFilterState();
    const filteredEntries = filterGalleryPhotos(photoEntries, filters);
    lastRenderedGalleryEntries = filteredEntries;

    summary.textContent = `${filteredEntries.length} foto(s) de ${photoEntries.length}`;

    if (filteredEntries.length === 0) {
        grid.innerHTML = "";
        empty.style.display = "block";
        empty.textContent = photoEntries.length === 0
            ? "No hay fotos disponibles en esta galeria."
            : "Ninguna foto coincide con los filtros seleccionados.";
        return;
    }

    empty.style.display = "none";
    grid.innerHTML = "";

    filteredEntries.forEach((photo) => {
        const metaParts = [photo.meta.tournament, photo.meta.club, formatGalleryDate(photo.meta.date, lang), photo.meta.player, photo.meta.category]
            .filter(Boolean);
        const card = document.createElement("figure");
        card.className = "gallery-detail-card";
        card.innerHTML = `
            <img class="gallery-detail-image" src="${photo.imageSrc}" alt="${escapeHtml(photo.caption || photo.galleryTitle || "Foto")}">
            <figcaption class="gallery-detail-caption">${escapeHtml(photo.caption || photo.galleryTitle || "Sin pie de foto")}</figcaption>
            <div class="gallery-detail-meta">${metaParts.map((part) => `<span class="gallery-detail-chip">${escapeHtml(part)}</span>`).join("")}</div>
        `;

        const image = card.querySelector(".gallery-detail-image");
        if (image) {
            image.loading = "lazy";
            image.decoding = "async";
            image.addEventListener("click", () => {
                openLightbox(photo.imageSrc, photo.caption || photo.galleryTitle || "");
            });
        }
        grid.appendChild(card);
    });

    window.PSAOptimizations?.applyLazyMedia?.(grid);
}

async function downloadCurrentGalleryZip() {
    if (lastRenderedGalleryEntries.length === 0) return;

    const button = document.getElementById("galleryDownloadZip");
    const title = document.getElementById("galleryPageTitle")?.textContent || "galeria";
    if (button) button.disabled = true;

    try {
        const JSZip = await window.PSAOptimizations?.loadScriptOnce?.("https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js", "JSZip");
        if (!JSZip) throw new Error("No se pudo cargar el compresor ZIP.");

        const zip = new JSZip();
        const folder = zip.folder("galeria") || zip;
        await Promise.all(lastRenderedGalleryEntries.map(async (photo, index) => {
            const response = await fetch(resolveOptimizedAssetUrl(photo.imageSrc), { cache: "force-cache" });
            if (!response.ok) throw new Error(`No se pudo descargar ${photo.imageSrc}`);
            const blob = await response.blob();
            const extension = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
            const player = String(photo.meta?.player || `foto-${index + 1}`).replace(/[^a-z0-9_-]+/gi, "-");
            folder.file(`${String(index + 1).padStart(2, "0")}-${player}.${extension}`, blob);
        }));

        const content = await zip.generateAsync({ type: "blob" });
        window.PSAOptimizations?.downloadBlob?.(`${title.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase() || "galeria"}.zip`, content);
    } catch (error) {
        reportGalleryError("gallery-zip", error);
    } finally {
        if (button) button.disabled = false;
    }
}

function bindGalleryFilterEvents() {
    const searchInput = document.getElementById("gallerySearchInput");
    const tournamentFilter = document.getElementById("galleryTournamentFilter");
    const clubFilter = document.getElementById("galleryClubFilter");
    const dateFilter = document.getElementById("galleryDateFilter");
    const playerFilter = document.getElementById("galleryPlayerFilter");
    const categoryFilter = document.getElementById("galleryCategoryFilter");
    const resetButton = document.getElementById("galleryResetFilters");
    const zipButton = document.getElementById("galleryDownloadZip");

    [searchInput, tournamentFilter, clubFilter, dateFilter, playerFilter, categoryFilter].forEach((control) => {
        if (!control) return;
        control.addEventListener(control.tagName === "INPUT" ? "input" : "change", () => {
            if (control === dateFilter) {
                dateFilter.dataset.rawValue = dateFilter.value || "";
            }
            renderGalleryArchive();
        });
    });

    if (resetButton) {
        resetButton.addEventListener("click", () => {
            if (searchInput) searchInput.value = "";
            if (tournamentFilter) tournamentFilter.value = "";
            if (clubFilter) clubFilter.value = "";
            if (dateFilter) {
                dateFilter.value = "";
                dateFilter.dataset.rawValue = "";
            }
            if (playerFilter) playerFilter.value = "";
            if (categoryFilter) categoryFilter.value = "";
            renderGalleryArchive();
        });
    }

    if (zipButton) {
        zipButton.addEventListener("click", () => {
            downloadCurrentGalleryZip();
        });
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await syncGalleryStateFromCloud();
    bindLightboxEvents();
    bindGalleryFilterEvents();
    renderGalleryArchive();
});
