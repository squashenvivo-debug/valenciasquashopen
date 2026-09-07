/* Archivo estático del PSA Valencia Open. No hace ninguna llamada de red: todo el contenido
   y las imágenes viven embebidos en esta misma página y en img/, congelados en la fecha
   indicada en la cabecera. */
(function () {
    "use strict";

    var DATA = window.ARCHIVE_DATA || {};

    function text(loc) {
        if (!loc) return "";
        if (typeof loc === "string") return loc;
        return loc.es || loc.en || loc.va || loc.fr || "";
    }

    function el(tag, attrs, html) {
        var node = document.createElement(tag);
        if (attrs) {
            Object.keys(attrs).forEach(function (k) {
                if (attrs[k] === undefined || attrs[k] === null) return;
                if (k === "class") node.className = attrs[k];
                else node.setAttribute(k, attrs[k]);
            });
        }
        if (html !== undefined) node.innerHTML = html;
        return node;
    }

    function formatDate(iso) {
        if (!iso) return "";
        var d = new Date(iso);
        if (isNaN(d.getTime())) return String(iso);
        return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
    }

    // ---------- Hero ----------
    function renderHero() {
        var h1 = document.getElementById("heroHeadline");
        if (h1) h1.textContent = text(DATA.headline) || "PSA Valencia Open";
        var snap = document.getElementById("snapshotDate");
        if (snap && DATA.snapshotDate) {
            snap.textContent = formatDate(DATA.snapshotDate);
        }
    }

    // ---------- Programa ----------
    function renderProgramme() {
        var host = document.getElementById("programmeGrid");
        if (!host) return;
        var items = (DATA.intro || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
        if (items.length === 0) {
            host.innerHTML = '<p class="section-sub">No hay programación guardada.</p>';
            return;
        }
        items.forEach(function (item) {
            var card = el("div", { class: "programme-card" });
            card.appendChild(el("div", { class: "p-date" }, item.dateTime || item.eventDate || ""));
            card.appendChild(el("h3", null, text(item.title)));
            card.appendChild(el("p", null, text(item.subtitle)));
            host.appendChild(card);
        });
    }

    // ---------- Cuadro ----------
    function renderDraw() {
        var host = document.getElementById("drawRounds");
        if (!host) return;
        var rounds = (DATA.draw && DATA.draw.rounds) || [];
        if (rounds.length === 0) {
            host.innerHTML = '<p class="section-sub">No hay cuadro guardado.</p>';
            return;
        }
        rounds.forEach(function (round) {
            var col = el("div", { class: "draw-round" });
            col.appendChild(el("h3", null, round.title || ""));
            (round.matches || []).forEach(function (m) {
                var box = el("div", { class: "draw-match" });
                [m.p1, m.p2].forEach(function (p) {
                    var name = p ? p.name : "BYE";
                    var isTbd = !name || name === "TBD" || name === "BYE";
                    var row = el("div", { class: "draw-p" + (isTbd ? " tbd" : "") });
                    if (p && p.image && !isTbd) {
                        row.appendChild(el("img", { src: p.image, alt: "", loading: "lazy" }));
                    }
                    row.appendChild(document.createTextNode(name || "BYE"));
                    box.appendChild(row);
                });
                if (m.date) box.appendChild(el("div", { class: "draw-date" }, m.date));
                col.appendChild(box);
            });
            host.appendChild(col);
        });
    }

    // ---------- Noticias ----------
    function renderNews() {
        var list = document.getElementById("newsList");
        var articleHost = document.getElementById("newsArticle");
        if (!list) return;
        var items = (DATA.news || []).slice().sort(function (a, b) {
            return new Date(b.publishAt || b.createdAt || 0) - new Date(a.publishAt || a.createdAt || 0);
        });

        if (items.length === 0) {
            list.innerHTML = '<p class="section-sub">No hay noticias guardadas.</p>';
        }

        items.forEach(function (item) {
            var card = el("div", { class: "news-card" });
            if (item.imageSrc) {
                card.appendChild(el("img", { src: item.imageSrc, alt: "", loading: "lazy" }));
            }
            var body = el("div", { class: "news-card-body" });
            body.appendChild(el("div", { class: "news-date" }, formatDate(item.publishAt || item.createdAt)));
            var title = text(item.title) || extractTitleFromArticle(text(item.article)) || "Noticia";
            body.appendChild(el("h3", null, title));
            card.appendChild(body);
            card.addEventListener("click", function () { openArticle(item); });
            list.appendChild(card);
        });

        function extractTitleFromArticle(html) {
            if (!html) return "";
            var m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
            if (!m) return "";
            var tmp = document.createElement("div");
            tmp.innerHTML = m[1];
            return tmp.textContent.trim();
        }

        function openArticle(item) {
            if (!articleHost) return;
            articleHost.innerHTML =
                '<button type="button" class="close-article">Cerrar ✕</button>' +
                (text(item.article) || "<p>Sin contenido.</p>");
            articleHost.classList.add("open");
            articleHost.querySelector(".close-article").addEventListener("click", function () {
                articleHost.classList.remove("open");
            });
            articleHost.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }

    // ---------- Galería ----------
    var lightboxImages = [];
    var lightboxIndex = 0;

    function openLightbox(images, index) {
        lightboxImages = images;
        lightboxIndex = index;
        showLightboxImage();
        document.getElementById("lightbox").classList.add("open");
    }

    function showLightboxImage() {
        var img = document.getElementById("lightboxImg");
        if (img && lightboxImages[lightboxIndex]) img.src = lightboxImages[lightboxIndex];
    }

    function renderGallery() {
        var tabsHost = document.getElementById("galleryTabs");
        var gridHost = document.getElementById("galleryGrid");
        if (!tabsHost || !gridHost) return;
        var galleries = DATA.galleries || [];
        if (galleries.length === 0) {
            gridHost.innerHTML = '<p class="section-sub">No hay galería guardada.</p>';
            return;
        }

        function renderGalleryGrid(gallery) {
            gridHost.innerHTML = "";
            var photoSrcs = (gallery.photos || [])
                .filter(function (p) { return p.type !== "video"; })
                .map(function (p) { return p.src; });

            (gallery.photos || []).forEach(function (p) {
                if (p.type === "video") {
                    var a = el("a", {
                        class: "video-tile",
                        href: p.videoUrl || "#",
                        target: "_blank",
                        rel: "noopener"
                    }, "&#9654;");
                    gridHost.appendChild(a);
                    return;
                }
                var img = el("img", { src: p.src, alt: "", loading: "lazy" });
                img.addEventListener("click", function () {
                    openLightbox(photoSrcs, photoSrcs.indexOf(p.src));
                });
                gridHost.appendChild(img);
            });
        }

        galleries.forEach(function (gallery, i) {
            var tab = el("button", { type: "button", class: "gallery-tab" + (i === 0 ? " active" : "") }, text(gallery.title) || "Galería");
            tab.addEventListener("click", function () {
                tabsHost.querySelectorAll(".gallery-tab").forEach(function (t) { t.classList.remove("active"); });
                tab.classList.add("active");
                renderGalleryGrid(gallery);
            });
            tabsHost.appendChild(tab);
        });

        renderGalleryGrid(galleries[0]);
    }

    function wireLightbox() {
        var box = document.getElementById("lightbox");
        if (!box) return;
        box.querySelector(".lb-close").addEventListener("click", function () { box.classList.remove("open"); });
        box.addEventListener("click", function (e) { if (e.target === box) box.classList.remove("open"); });
        box.querySelector(".lb-prev").addEventListener("click", function () {
            lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
            showLightboxImage();
        });
        box.querySelector(".lb-next").addEventListener("click", function () {
            lightboxIndex = (lightboxIndex + 1) % lightboxImages.length;
            showLightboxImage();
        });
        document.addEventListener("keydown", function (e) {
            if (!box.classList.contains("open")) return;
            if (e.key === "Escape") box.classList.remove("open");
            if (e.key === "ArrowLeft") box.querySelector(".lb-prev").click();
            if (e.key === "ArrowRight") box.querySelector(".lb-next").click();
        });
    }

    // ---------- Jugadores ----------
    function renderPlayers() {
        var host = document.getElementById("playersGrid");
        if (!host) return;
        var players = DATA.players || [];
        if (players.length === 0) {
            host.innerHTML = '<p class="section-sub">No hay jugadores guardados.</p>';
            return;
        }
        players.forEach(function (p) {
            var card = el("div", { class: "player-card" });
            card.appendChild(el("img", { src: p.image || "", alt: p.name || "", loading: "lazy" }));
            card.appendChild(el("div", { class: "p-name" }, p.name || ""));
            var metaBits = [p.country, p.ranking ? ("#" + p.ranking) : ""].filter(Boolean).join(" · ");
            card.appendChild(el("div", { class: "p-meta" }, metaBits));
            host.appendChild(card);
        });
    }

    // ---------- Footer ----------
    function renderFooter() {
        var yt = document.getElementById("youtubeLink");
        if (yt && DATA.youtubeUrl) {
            yt.href = DATA.youtubeUrl;
            yt.textContent = "Ver la retransmisión en YouTube ↗";
        } else if (yt) {
            yt.style.display = "none";
        }
    }

    document.addEventListener("DOMContentLoaded", function () {
        renderHero();
        renderProgramme();
        renderDraw();
        renderNews();
        renderGallery();
        renderPlayers();
        renderFooter();
        wireLightbox();
    });
})();
