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

function getGalleryDisplayTitle(gallery, lang) {
    const explicitTitle = String(getLocalizedText(gallery?.title, lang) || "").trim();
    if (explicitTitle) return explicitTitle;

    const meta = normalizeGalleryMeta(gallery?.meta || {});
    const metaParts = [
        String(meta.tournament || "").trim(),
        String(meta.club || "").trim(),
        formatGalleryDate(meta.date, lang),
        String(meta.category || "").trim()
    ].filter(Boolean);

    if (metaParts.length) return metaParts.join(" · ");
    return "Galeria";
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function isLikelyFileNameCaption(value) {
    const text = String(value || "").trim();
    if (!text) return false;

    const compact = text.toLowerCase();
    if (/\.(jpe?g|png|gif|webp|heic|bmp)$/i.test(compact)) return true;
    if (/^(img|dsc|pxl|whatsapp|image)[\s_-]*\d{3,}$/i.test(compact)) return true;
    if (/^[a-z]{2,10}[\s_-]?\d{5,}$/i.test(compact)) return true;

    const hasSpace = /\s/.test(text);
    const hasManyDigits = (text.match(/\d/g) || []).length >= 4;
    const hasSeparator = /[_-]/.test(text);
    return !hasSpace && hasManyDigits && hasSeparator;
}

function getVisiblePhotoCaption(photo) {
    const caption = String(photo?.caption || "").trim();
    if (!caption) return "";
    if (isLikelyFileNameCaption(caption)) return "";
    return caption;
}

function resolvePublicCaption(photo) {
    const cleanCaption = getVisiblePhotoCaption(photo?.caption);
    if (cleanCaption) return cleanCaption;

    const playerLabel = String(photo?.meta?.player || "").trim();
    return playerLabel;
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

let currentLightboxPhoto = null;

function openLightbox(src, caption, photoMeta = {}) {
    const lightbox = document.getElementById("galleryLightbox");
    const image = document.getElementById("galleryLightboxImage");
    const captionEl = document.getElementById("galleryLightboxCaption");
    if (!lightbox || !image || !captionEl) return;

    image.src = src;
    captionEl.textContent = caption || "";
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    window.PSAModalHistory?.pushModal(hideLightbox);

    currentLightboxPhoto = { imageSrc: src, caption: caption || "", ...photoMeta };
}

/** Descarga la foto de verdad (no solo abrirla) trayéndola como blob — un <a download> normal
 *  no funciona en imágenes de otro origen (Supabase Storage), el navegador solo la abriría. */
async function downloadCurrentPhoto() {
    const photo = currentLightboxPhoto;
    if (!photo?.imageSrc) return;

    try {
        const response = await fetch(photo.imageSrc, { mode: "cors" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = `psa-valencia-open-${photo.photoId || Date.now()}.${ext}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
    } catch (error) {
        window.open(photo.imageSrc, "_blank", "noopener");
    }

    window.PSAPhotoAnalytics?.trackEvent?.("download", {
        galleryId: photo.galleryId,
        photoId: photo.photoId,
        photoUrl: photo.imageSrc
    });
}

/** Trae la imagen como blob con un fetch CORS explícito y la carga desde un blob: URL (mismo
 *  origen, nunca "contamina" el lienzo). Si en vez de esto se pone crossOrigin="anonymous" en
 *  un <img> normal, el navegador puede reutilizar en caché la copia YA cargada sin ese
 *  permiso en otra parte de la página (p.ej. la miniatura de la propia galería) y el
 *  lienzo queda contaminado — toBlob() falla en silencio y todo cae al modo solo-texto. */
async function loadImageForCanvas(src) {
    const response = await fetch(src, { mode: "cors", cache: "reload" });
    if (!response.ok) throw new Error(`No se pudo cargar la imagen (HTTP ${response.status})`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("No se pudo decodificar la imagen"));
        img.src = objectUrl;
    });
}

/** Solo la foto, a su resolución real, con la marca "psavalenciaopen.com" al pie (escalada
 *  según el tamaño de la imagen) — así queda visible se comparta donde se comparta, en vez
 *  de una etiqueta separable que se pueda perder al reenviar. */
async function buildWatermarkedPhoto(imageUrl) {
    try {
        const img = await loadImageForCanvas(imageUrl);
        const width = img.naturalWidth;
        const height = img.naturalHeight;

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const label = "psavalenciaopen.com";
        const fontSize = Math.max(20, Math.round(width * 0.024));
        const paddingX = Math.round(fontSize * 0.7);
        const boxHeight = Math.round(fontSize * 1.8);
        ctx.font = `600 ${fontSize}px Arial, Helvetica, sans-serif`;
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = "rgba(13, 35, 64, 0.8)";
        ctx.fillRect(0, height - boxHeight, textWidth + paddingX * 2, boxHeight);
        ctx.fillStyle = "#ffffff";
        ctx.textBaseline = "middle";
        ctx.fillText(label, paddingX, height - boxHeight / 2 + 1);

        return await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    } catch (error) {
        return null;
    }
}

/** Trae la foto marcada como File para compartirla de verdad (no solo el enlace). Esto es lo
 *  que hace que Instagram ofrezca "Historia"/"Reel" en su propio selector: si solo le mandas
 *  texto/enlace, Instagram lo trata como contenido no visual y únicamente deja reenviarlo
 *  como mensaje directo. Compartiendo la imagen real, sí aparecen esas opciones. */
async function fetchShareableImageFile(imageUrl, filename) {
    try {
        const blob = await buildWatermarkedPhoto(imageUrl);
        if (!blob) return null;
        return new File([blob], `${filename}.jpg`, { type: "image/jpeg" });
    } catch (error) {
        return null;
    }
}

/** Un único botón "Compartir": panel nativo del dispositivo (ahí elige Instagram, WhatsApp,
 *  Facebook, etc. — Instagram no tiene enlace público de compartir, solo esta vía funciona).
 *  Si el navegador no lo soporta, copiamos el enlace en vez de ocultar el botón. */
async function shareOrCopyLink(button, shareTitle, shareUrl, onShared, imageUrl) {
    if (typeof navigator.share === "function") {
        if (imageUrl && typeof navigator.canShare === "function") {
            const file = await fetchShareableImageFile(imageUrl, "psa-valencia-open");
            if (file && navigator.canShare({ files: [file] })) {
                navigator.share({ files: [file], title: shareTitle, text: shareTitle, url: shareUrl }).then(onShared).catch(() => {});
                return;
            }
        }
        navigator.share({ title: shareTitle, url: shareUrl }).then(onShared).catch(() => {});
        return;
    }

    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(shareUrl).then(() => {
            onShared?.();
            const original = button.innerHTML;
            button.innerHTML = `✅ ${(typeof t === "function" ? t("psaGallery.linkCopied") : "") || "Enlace copiado"}`;
            setTimeout(() => { button.innerHTML = original; }, 2000);
        }).catch(() => {
            window.open(shareUrl, "_blank", "noopener");
        });
        return;
    }

    window.open(shareUrl, "_blank", "noopener");
}

function shareCurrentPhoto() {
    const photo = currentLightboxPhoto;
    if (!photo?.imageSrc) return;

    const shareUrl = photo.galleryId
        ? `${window.location.origin}/gallery.html?galleryId=${encodeURIComponent(photo.galleryId)}`
        : window.location.href;
    const button = document.getElementById("galleryShareNative");

    shareOrCopyLink(button, photo.caption || "PSA Valencia Open", shareUrl, () => {
        window.PSAPhotoAnalytics?.trackEvent?.("share_native", {
            galleryId: photo.galleryId,
            photoId: photo.photoId,
            photoUrl: photo.imageSrc
        });
    }, photo.imageSrc);
}

function hideLightbox() {
    const lightbox = document.getElementById("galleryLightbox");
    const image = document.getElementById("galleryLightboxImage");
    if (!lightbox || !image) return;

    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    image.src = "";
    document.body.style.overflow = "";
}

// El botón atrás del móvil (o la X) cierran el visor de foto en vez de salir de la web — ver
// js/modal-history.js. Si por lo que sea ese script no está cargado, cae al cierre directo.
function closeLightbox() {
    if (window.PSAModalHistory) window.PSAModalHistory.closeModal(hideLightbox);
    else hideLightbox();
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

    const downloadBtn = document.getElementById("galleryDownloadBtn");
    if (downloadBtn) downloadBtn.addEventListener("click", downloadCurrentPhoto);

    const nativeBtn = document.getElementById("galleryShareNative");
    if (nativeBtn) nativeBtn.addEventListener("click", shareCurrentPhoto);
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
        const galleryTitle = getGalleryDisplayTitle(gallery, lang);
        return (Array.isArray(gallery.photos) ? gallery.photos : []).map((photo, index) => {
            const meta = normalizeGalleryPhotoMeta(photo.meta, gallery.meta);
            const caption = resolvePublicCaption({
                caption: getLocalizedText(photo.caption, lang),
                meta
            });
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

    const tAll = (key, fallback) => (typeof t === "function" ? t(`psaGallery.${key}`) : "") || fallback;

    populateSelect(document.getElementById("galleryTournamentFilter"), tournamentValues, tAll("allTournaments", "Todos los torneos"));
    populateSelect(document.getElementById("galleryClubFilter"), clubValues, tAll("allClubs", "Todos los clubs"));
    populateSelect(document.getElementById("galleryDateFilter"), dateValues.map((value) => formatGalleryDate(value, lang)), tAll("allDates", "Todas las fechas"));

    const dateSelect = document.getElementById("galleryDateFilter");
    if (dateSelect) {
        const current = dateSelect.dataset.rawValue || "";
        dateSelect.innerHTML = ["", ...dateValues].map((value) => {
            const label = value ? formatGalleryDate(value, lang) : tAll("allDates", "Todas las fechas");
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

    populateSelect(document.getElementById("galleryPlayerFilter"), playerValues, tAll("allPlayers", "Todos los jugadores"));
    populateSelect(document.getElementById("galleryCategoryFilter"), categoryValues, tAll("allCategories", "Todas las categorias"));
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

    const tg = (key, fallback) => (typeof t === "function" ? t(`psaGallery.${key}`) : "") || fallback;

    if (galleryId && !selectedGallery) {
        titleEl.textContent = tg("notFoundTitle", "Galeria no encontrada");
        empty.style.display = "block";
        empty.textContent = tg("notFoundText", "Esta galeria no existe o fue eliminada.");
        grid.innerHTML = "";
        summary.textContent = "";
        return;
    }

    titleEl.textContent = selectedGallery
        ? getGalleryDisplayTitle(selectedGallery, lang)
        : tg("archiveTitle", "Archivo de galerias");

    const photoEntries = flattenGalleryPhotos(galleries, lang);
    setupGalleryFilters(photoEntries, lang);
    const filters = getGalleryFilterState();
    const filteredEntries = filterGalleryPhotos(photoEntries, filters);
    lastRenderedGalleryEntries = filteredEntries;

    summary.textContent = `${filteredEntries.length} ${tg("photosOfLabel", "foto(s) de")} ${photoEntries.length}`;

    if (filteredEntries.length === 0) {
        grid.innerHTML = "";
        empty.style.display = "block";
        empty.textContent = photoEntries.length === 0
            ? tg("noPhotos", "No hay fotos disponibles en esta galeria.")
            : tg("noMatch", "Ninguna foto coincide con los filtros seleccionados.");
        return;
    }

    empty.style.display = "none";
    grid.innerHTML = "";

    filteredEntries.forEach((photo) => {
        const card = document.createElement("figure");
        card.className = "gallery-detail-card";
        card.innerHTML = `
            <img class="gallery-detail-image" src="${photo.imageSrc}" alt="${escapeHtml(photo.caption || "Foto")}">
            ${photo.caption ? `<figcaption class="gallery-detail-caption">${escapeHtml(photo.caption)}</figcaption>` : ""}
        `;

        const image = card.querySelector(".gallery-detail-image");
        if (image) {
            image.loading = "lazy";
            image.decoding = "async";
            image.addEventListener("click", () => {
                openLightbox(photo.imageSrc, photo.caption || "", { galleryId: photo.galleryId, photoId: photo.id });
            });
        }
        grid.appendChild(card);
    });

    window.PSAOptimizations?.applyLazyMedia?.(grid);
}

function bindGalleryFilterEvents() {
    const searchInput = document.getElementById("gallerySearchInput");
    const tournamentFilter = document.getElementById("galleryTournamentFilter");
    const clubFilter = document.getElementById("galleryClubFilter");
    const dateFilter = document.getElementById("galleryDateFilter");
    const playerFilter = document.getElementById("galleryPlayerFilter");
    const categoryFilter = document.getElementById("galleryCategoryFilter");
    const resetButton = document.getElementById("galleryResetFilters");

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
}

document.addEventListener("DOMContentLoaded", async () => {
    await syncGalleryStateFromCloud();
    bindLightboxEvents();
    bindGalleryFilterEvents();
    renderGalleryArchive();
});
