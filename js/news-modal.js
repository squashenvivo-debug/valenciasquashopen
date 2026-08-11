/**
 * news-modal.js — "Leer más" abre la noticia en una ventana modal en vez de navegar a
 * news.html, así al cerrarla el usuario sigue exactamente donde estaba en la portada.
 * Reutiliza las funciones ya definidas en js/news.js (readNewsCollection, getLocalizedText,
 * formatNewsArticleHtml, shareOrCopyLink, buildShareThumbnail, etc. — news.js se carga antes
 * que este script en index.html) en vez de duplicar esa lógica.
 */
(function () {
    "use strict";

    function tm(key, fallback) {
        return (typeof t === "function" ? t(key) : "") || fallback;
    }

    async function openNewsModal(newsId, newsSlug) {
        const modal = document.getElementById("newsDetailModal");
        const emptyEl = document.getElementById("newsModalEmpty");
        const articleEl = document.getElementById("newsModalArticle");
        if (!modal || !emptyEl || !articleEl) return;

        modal.classList.add("active");
        document.body.style.overflow = "hidden";
        window.PSAModalHistory?.pushModal(hideNewsModal);
        emptyEl.style.display = "none";
        articleEl.style.display = "none";

        const lang = typeof getCurrentLanguage === "function" ? getCurrentLanguage() : "es";
        const collection = await readNewsCollection();
        const item = collection.find((entry) => {
            if (newsId && entry.id === newsId) return true;
            if (newsSlug && (slugifyText(entry?.seo?.slug || "") === newsSlug || slugifyText(entry?.title?.es || "") === newsSlug)) return true;
            return false;
        });

        if (!item) {
            emptyEl.style.display = "block";
            return;
        }

        const title = getLocalizedText(item.title, lang);
        const article = getLocalizedText(item.article, lang);
        const displayDate = item.publishAt || item.createdAt;

        const heading = document.getElementById("newsModalHeading");
        heading.style.display = title ? "" : "none";
        heading.textContent = title || "";

        const body = document.getElementById("newsModalBody");
        body.className = "news-content-body";
        body.innerHTML = formatNewsArticleHtml(article || "", title || "");

        const galleryContainer = document.getElementById("newsModalGallery");
        const allImages = Array.isArray(item.images) && item.images.length ? item.images : [item.imageSrc || ""];
        const validImages = allImages.filter(Boolean);
        const resolveUrl = (src) => (typeof resolveOptimizedAssetUrl === "function" ? resolveOptimizedAssetUrl(src) : src);

        if (validImages.length > 1) {
            galleryContainer.className = "news-detail-gallery news-detail-grid";
            galleryContainer.innerHTML = validImages.map((src, idx) => `
                <img src="${resolveUrl(src)}" alt="${title} (${idx + 1})" loading="lazy" decoding="async" style="width:100%; height:auto; max-height:75vh; object-fit:contain; border-radius:12px; background:#06101a;">
            `).join("");
        } else if (validImages.length === 1) {
            galleryContainer.className = "news-detail-gallery";
            galleryContainer.innerHTML = `
                <img src="${resolveUrl(validImages[0])}" alt="${title}" loading="lazy" decoding="async" style="width:100%; height:auto; max-height:75vh; object-fit:contain; border-radius:12px; background:#06101a;">
            `;
        } else {
            galleryContainer.innerHTML = "";
        }

        document.getElementById("newsModalDate").textContent = formatNewsDate(displayDate, lang);
        const categoryEl = document.getElementById("newsModalCategory");
        if (categoryEl) categoryEl.textContent = item.category || "";
        const playerEl = document.getElementById("newsModalPlayer");
        if (playerEl) playerEl.textContent = item.player ? `Jugador: ${item.player}` : "";
        document.getElementById("newsModalTags").textContent = normalizeStringArray(item.tags).map((tag) => `#${tag}`).join(" · ");

        const shareBar = document.getElementById("newsModalShareBar");
        const shareBtn = document.getElementById("newsModalShareBtn");
        if (shareBar && shareBtn) {
            const slug = item?.seo?.slug || "";
            const shareUrl = slug
                ? `${window.location.origin}/news.html?slug=${encodeURIComponent(slug)}`
                : `${window.location.origin}/news.html?newsId=${encodeURIComponent(item.id || "")}`;
            const shareText = title || (typeof deriveTitleFromArticleHtml === "function" ? deriveTitleFromArticleHtml(article, 100) : "") || "PSA Valencia Open";
            shareBtn.onclick = () => shareOrCopyLink(shareBtn, shareText, shareUrl, item, lang);
            shareBar.style.display = "";
        }

        articleEl.style.display = "";
    }

    window.openNewsModal = openNewsModal;

    function hideNewsModal() {
        const modal = document.getElementById("newsDetailModal");
        if (modal) modal.classList.remove("active");
        document.body.style.overflow = "";
    }

    // El botón atrás del móvil (o la X) cierran el modal en vez de salir de la web — ver
    // js/modal-history.js. Si por lo que sea ese script no está cargado, cae al cierre directo.
    window.closeNewsModal = function () {
        if (window.PSAModalHistory) window.PSAModalHistory.closeModal(hideNewsModal);
        else hideNewsModal();
    };
})();
