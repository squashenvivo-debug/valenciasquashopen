/* ==========================================================
   PSA VALENCIA OPEN
   app.js
========================================================== */

/* ==========================================================
   INICIO
========================================================== */
(() => {

    let CONFIG = {};
    const LIVE_STREAM_URL_KEY = "liveStreamYoutubeUrl";
    const LIVE_STREAM_HISTORY_KEY = "liveStreamYoutubeHistory";
    const GALLERY_COLLECTION_KEY = "galleryCollections";
    const NEWS_COLLECTION_KEY = "newsCollection";
    const SPONSORS_COLLECTION_KEY = "sponsorsCollection";
    const PLAYERS_COLLECTION_KEY = "playersCollection";
    const PROGRAMMING_COLLECTION_KEY = "eventProgrammingCollection";
    const HERO_SETTINGS_KEY = "heroSettings";
    const TOURNAMENT_MODE_KEY = "tournamentContentMode";
    const TOURNAMENT_API_URL_KEY = "tournamentApiUrl";
    const PSA_TOURNAMENT_ID_KEY = "psaTournamentId";
    const PSA_API_KEY_KEY = "psaApiKey";
    const INSTAGRAM_WIDGET_KEY = "instagramWidgetCode";
    const TOURNAMENT_MANUAL_CONTENT_KEY = "tournamentManualContent";
    const DRAW_BRACKET_KEY = "drawBracketState";
    const DYNAMIC_LANGS = ["es", "va", "en", "fr"];
    let countdownTimerId = null;
    const CLOUD_PUBLIC_KEYS = [
        LIVE_STREAM_URL_KEY,
        LIVE_STREAM_HISTORY_KEY,
        GALLERY_COLLECTION_KEY,
        NEWS_COLLECTION_KEY,
        SPONSORS_COLLECTION_KEY,
        PLAYERS_COLLECTION_KEY,
        PROGRAMMING_COLLECTION_KEY,
        HERO_SETTINGS_KEY,
        TOURNAMENT_MODE_KEY,
        TOURNAMENT_API_URL_KEY,
        PSA_TOURNAMENT_ID_KEY,
        PSA_API_KEY_KEY,
        INSTAGRAM_WIDGET_KEY,
        TOURNAMENT_MANUAL_CONTENT_KEY,
        DRAW_BRACKET_KEY
    ];

    function isLocalHostRuntime() {
        const host = String(window.location.hostname || "").toLowerCase();
        return host === "127.0.0.1" || host === "localhost" || host === "";
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

    function reportPublicError(scope, error) {
        const message = error?.message || String(error || "error desconocido");
        window.PSAOptimizations?.logError?.(scope, message);
    }

    document.addEventListener("DOMContentLoaded", async () => {

        await syncPublicStateFromCloud();

        await loadConfig();

        applyHeroSettings();

        initHeader();

        initCountdown();

        revealSections();

        initLiveStream();
        loadSponsors();
        loadHomeGallery();

        await Promise.all([
            loadPlayers(),
            loadNews(),
            loadProgramming(),
            loadDraws()
        ]);
        loadTournamentCenter();
        window.PSAOptimizations?.applyLazyMedia?.(document);

        document.addEventListener("app-language-changed", () => {
            applyHeroSettings();
            initCountdown();
            initLiveStream();
            loadHomeGallery();
            loadNews();
            loadProgramming();
        });
    });

    function wait(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // En conexiones móviles lentas, el script de Supabase (CDN externo, antes de este script)
    // a veces todavía no ha terminado de cargar cuando llegamos aquí — antes, en ese caso, nos
    // rendíamos a la primera y la página se quedaba con los datos locales de la última visita
    // (p.ej. el directo de ayer) en vez de los reales. Reintentamos unas cuantas veces antes de
    // darnos por vencidos.
    async function syncPublicStateFromCloud() {
        if (isLocalHostRuntime()) return;

        const cloud = window.PSACloudStore;
        if (!cloud) return;

        let ready = cloud.isReady?.();
        for (let attempt = 0; !ready && attempt < 12; attempt++) {
            await wait(500);
            ready = cloud.isReady?.();
        }
        if (!ready) return;

        try {
            await cloud.syncLocalStorageFromCloud(CLOUD_PUBLIC_KEYS);
        } catch (error) {
            console.warn("Cloud sync pública falló. Continuamos con local.", error);
        }
    }

    function readHeroSettings() {
        try {
            const raw = localStorage.getItem(HERO_SETTINGS_KEY);
            if (!raw) return null;

            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object") return null;

            return {
                eventLabel: parsed?.eventLabel || null,
                eventTitle: parsed?.eventTitle || null,
                eventLocation: parsed?.eventLocation || null,
                countdownDate: String(parsed?.countdownDate || "").trim(),
                backgroundImage: String(parsed?.backgroundImage || "").trim()
            };
        } catch (error) {
            return null;
        }
    }

    function resolveDynamicImage(pathValue, folder) {
        const raw = String(pathValue || "").trim();
        if (!raw) return "";
        if (raw.startsWith("data:")) return raw;
        if (/^https?:\/\//i.test(raw)) return raw;
        if (raw.includes("/")) return raw;
        return `${folder}/${raw}`;
    }

    function getLocalizedHeroText(value, lang) {
        if (!value) return "";
        if (typeof value === "string") return value;
        if (typeof value === "object") {
            return String(value?.[lang] || value?.es || value?.va || value?.en || value?.fr || "").trim();
        }
        return "";
    }

    function applyHeroSettings() {
        const heroSettings = readHeroSettings();
        if (!heroSettings) return;

        const lang = getCurrentLanguage();

        const label = getLocalizedHeroText(heroSettings.eventLabel, lang);
        const title = getLocalizedHeroText(heroSettings.eventTitle, lang);
        const location = getLocalizedHeroText(heroSettings.eventLocation, lang);

        const labelEl = document.querySelector("#hero .event-label");
        const titleEl = document.querySelector("#hero .event-title");
        const locationEl = document.querySelector("#hero .event-location");
        const heroBgImage = document.querySelector("#hero .hero-background img");

        if (labelEl && label) labelEl.textContent = label;
        if (titleEl && title) titleEl.textContent = title;
        if (locationEl && location) locationEl.textContent = location;

        if (heroBgImage && heroSettings.backgroundImage) {
            const src = resolveDynamicImage(heroSettings.backgroundImage, "assets/images/hero");
            if (src) {
                heroBgImage.src = resolveOptimizedAssetUrl(src);
            }
        }
    }


    /* ==========================================================
       HEADER
    ========================================================== */

    function initHeader() {

        const header = document.getElementById("header");

        if (!header) return;

        window.addEventListener("scroll", () => {

            if (window.scrollY > 60) {
                header.classList.add("scrolled");
            } else {
                header.classList.remove("scrolled");
            }

        });

    }



    /* ==========================================================
       COUNTDOWN
    ========================================================== */

    function initCountdown() {

        const heroSettings = readHeroSettings();
        const fallback = "2026-08-11T12:00:00";
        const targetDateRaw = String(heroSettings?.countdownDate || fallback).trim();

        let targetDate = new Date(targetDateRaw).getTime();
        if (!Number.isFinite(targetDate)) {
            targetDate = new Date(fallback).getTime();
        }

        const days = document.getElementById("days");
        const hours = document.getElementById("hours");
        const minutes = document.getElementById("minutes");
        const seconds = document.getElementById("seconds");
        const countdownBox = document.querySelector(".countdown");
        const liveBadge = document.getElementById("tournamentLiveBadge");

        if (!days) return;

        // Antes de esto, al pasar la fecha de inicio el contador se quedaba en 00:00:00:00 y,
        // en la siguiente vuelta, saltaba en silencio a contar hasta el año siguiente — nada
        // avisaba de que el torneo ya había empezado. Ahora, al llegar a cero, se para de verdad
        // y se cambia el bloque de números por un aviso "el torneo ya ha comenzado".
        function updateCountdown() {

            const now = new Date().getTime();

            const distance = targetDate - now;

            if (distance <= 0) {
                if (countdownTimerId) {
                    clearInterval(countdownTimerId);
                    countdownTimerId = null;
                }
                if (countdownBox) countdownBox.style.display = "none";
                if (liveBadge) liveBadge.style.display = "";
                return;
            }

            if (countdownBox) countdownBox.style.display = "";
            if (liveBadge) liveBadge.style.display = "none";

            const d = Math.floor(distance / (1000 * 60 * 60 * 24));
            const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((distance % (1000 * 60)) / 1000);

            days.textContent = String(d).padStart(2, "0");
            hours.textContent = String(h).padStart(2, "0");
            minutes.textContent = String(m).padStart(2, "0");
            seconds.textContent = String(s).padStart(2, "0");

        }

        updateCountdown();

        if (countdownTimerId) {
            clearInterval(countdownTimerId);
        }

        countdownTimerId = setInterval(updateCountdown, 1000);

    }


    /* ==========================================================
       REVEAL
    ========================================================== */

    function revealSections() {

        const observer = new IntersectionObserver((entries) => {

            entries.forEach(entry => {

                if (entry.isIntersecting) {

                    entry.target.classList.add("visible");

                }

            });

        }, {

            threshold: 0.20

        });

        document.querySelectorAll("section").forEach(section => {

            observer.observe(section);

        });

    }


    /* ==========================================================
       PLAYERS
    ========================================================== */

    function normalizePlayerName(name) {
        return String(name || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .replace(/[^a-z0-9]+/g, " ")
            .trim();
    }

    /** Nombres (normalizados) de jugadores que ya han perdido algún partido en el cuadro
     *  en vivo de PSA — mismo criterio que ya usa el cuadro (js/psa-draw.js): un partido
     *  con winner_id decidido en el que este jugador no es el ganador. Si la consulta
     *  falla (torneo en modo manual, proxy caído...) no se marca a nadie como eliminado. */
    async function fetchEliminatedPlayerNames() {
        const mode = localStorage.getItem(TOURNAMENT_MODE_KEY) || "api";
        if (mode === "manual") return new Set();

        try {
            const baseUrl = window.PSA_CONFIG?.supabaseUrl || "https://texjzaanugmssmolzwgb.supabase.co";
            const tournamentId = (localStorage.getItem(PSA_TOURNAMENT_ID_KEY) || window.PSA_CONFIG?.psaTournamentId || "12711").trim();
            const url = `${baseUrl}/functions/v1/psa-proxy?tournament=${encodeURIComponent(tournamentId)}&expanded=true&show_past=true`;
            const response = await fetch(url, { headers: { Accept: "application/json" } });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || payload?.success === false) return new Set();

            const division = (Array.isArray(payload?.divisions) ? payload.divisions : [])[0];
            const brackets = Array.isArray(division?.brackets) ? division.brackets : [];
            const matches = brackets.flatMap((bracket) => Array.isArray(bracket?.matches) ? bracket.matches : []);
            const eliminated = new Set();
            matches.forEach((match) => {
                const winnerId = match?.winner_id;
                if (winnerId === undefined || winnerId === null) return;
                (Array.isArray(match?.players) ? match.players : []).forEach((player) => {
                    if (player?.id !== undefined && String(player.id) !== String(winnerId) && player?.name) {
                        eliminated.add(normalizePlayerName(player.name));
                    }
                });
            });
            return eliminated;
        } catch (error) {
            return new Set();
        }
    }

    async function loadPlayers() {

        const grid = document.querySelector(".players-grid");

        if (!grid) return;

        try {

            const customPlayers = readPlayersCollection();
            let players = customPlayers;

            if (!Array.isArray(players) || players.length === 0) {
                let playersData = null;
                try {
                    playersData = await fetchCachedJson("data/players.json", { cacheKey: "players-primary", ttlMs: 600000 });
                } catch (error) {
                    playersData = await fetchCachedJson("data/translations/players.json", { cacheKey: "players-fallback", ttlMs: 600000 });
                }

                players = Array.isArray(playersData) ? playersData : [];
                if (players.length === 0) throw new Error("No se pudo cargar data/players.json ni data/translations/players.json");
            }

            grid.innerHTML = "";

            const eliminatedNames = await fetchEliminatedPlayerNames();

            players.forEach(player => {

                const seedBadge = player.seed
                    ? `<span class="player-seed">${player.seed}</span>`
                    : `<span class="player-seed player-seed-empty">seed</span>`;

                const positionStyle = player.photoPosition
                    ? ` style="object-position:${player.photoPosition};"`
                    : "";

                const imageSrc = resolvePlayerImageSrc(player.image || player.imageSrc || "");
                const playerLinkParam = player.id ? `id=${encodeURIComponent(player.id)}` : `name=${encodeURIComponent(player.name)}`;
                const isEliminated = eliminatedNames.has(normalizePlayerName(player.name));

                grid.innerHTML += `

                <a class="player-card${isEliminated ? " is-eliminated" : ""}" href="player.html?${playerLinkParam}" data-player-id="${player.id || ""}" data-player-name="${player.name || ""}">

                    <div class="player-photo">
                        <img src="${resolveOptimizedAssetUrl(imageSrc)}" alt="${player.name}" loading="lazy" decoding="async"${positionStyle}>
                    </div>

                    <div class="player-info">

                        <div class="player-head">

                            <div class="player-name">${player.name}</div>

                            <div class="player-seed-row">${seedBadge}</div>

                        </div>

                        <p class="player-meta">WR: ${player.ranking}</p>

                        <div class="player-flag-row">
                            <img class="player-flag"
                                 src="${resolveOptimizedAssetUrl(`assets/images/flags/${player.country}.svg`)}"
                                 alt="${player.country}">
                        </div>

                    </div>

                </a>

            `;

            });

            // Abre la ficha del jugador en una ventana modal (igual que el head-to-head del
            // cuadro) en vez de navegar a player.html, así no se pierde el sitio de la portada
            // en el que estaba el usuario. Ctrl/Cmd/clic central siguen abriendo en pestaña
            // nueva con normalidad.
            if (!grid.dataset.playerModalBound) {
                grid.dataset.playerModalBound = "1";
                grid.addEventListener("click", (event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
                    const card = event.target.closest(".player-card");
                    if (!card || typeof window.openPlayerModal !== "function") return;
                    event.preventDefault();
                    window.openPlayerModal(card.dataset.playerId || "", card.dataset.playerName || "");
                });
            }

        } catch (error) {

            console.error("Error cargando jugadores:", error);
            reportPublicError("players", error);

        }

    }

    function resolvePlayerImageSrc(image) {
        const value = String(image || "").trim();
        if (!value) return "";
        if (value.startsWith("data:")) return value;
        if (/^https?:\/\//i.test(value)) return value;
        if (value.includes("/")) return value;
        return `assets/images/players/${value}`;
    }

    function readPlayersCollection() {
        try {
            const raw = localStorage.getItem(PLAYERS_COLLECTION_KEY);
            if (!raw) return null;

            let parsed = JSON.parse(raw);
            while (typeof parsed === "string") {
                parsed = JSON.parse(parsed);
            }
            if (!Array.isArray(parsed) || parsed.length === 0) return null;

            const list = parsed
                .map((player) => ({
                    id: String(player?.id || "").trim(),
                    name: String(player?.name || "").trim(),
                    country: String(player?.country || "").trim().toUpperCase(),
                    ranking: player?.ranking ?? "",
                    image: String(player?.image || player?.imageSrc || "").trim(),
                    seed: String(player?.seed || "").trim(),
                    photoPosition: String(player?.photoPosition || "").trim()
                }))
                .filter((player) => Boolean(player.name));

            return list.length > 0 ? list : null;
        } catch (error) {
            return null;
        }
    }

    function readSponsorsCollection() {
        try {
            const raw = localStorage.getItem(SPONSORS_COLLECTION_KEY);
            if (!raw) return null;

            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return null;

            return parsed
                .map((sponsor) => ({
                    name: String(sponsor?.name || "Sponsor").trim() || "Sponsor",
                    link: String(sponsor?.link || sponsor?.href || "#").trim() || "#",
                    imageSrc: String(sponsor?.imageSrc || sponsor?.src || "").trim(),
                    cardClass: String(sponsor?.cardClass || "sponsor-card").trim() || "sponsor-card"
                }))
                .filter((sponsor) => !!sponsor.imageSrc);
        } catch (error) {
            return null;
        }
    }

    function resolveSponsorImageSrc(image) {
        const value = String(image || "").trim();
        if (!value) return "";
        if (value.startsWith("data:")) return value;
        if (/^https?:\/\//i.test(value)) return value;
        if (value.includes("/")) return value;
        return `assets/images/sponsors/${value}`;
    }

    function loadSponsors() {
        const grid = document.querySelector("#sponsors .sponsors-grid");
        if (!grid) return;

        const sponsors = readSponsorsCollection();
        if (!sponsors) {
            return;
        }

        if (sponsors.length === 0) {
            // Si la colección dinámica está vacía, mantenemos los sponsors base del HTML.
            return;
        }

        grid.innerHTML = sponsors.map((sponsor) => {
            const imageSrc = resolveSponsorImageSrc(sponsor.imageSrc);
            const safeName = escapeHtml(sponsor.name || "Sponsor");
            const safeLink = escapeHtml(sponsor.link || "#");
            const classes = escapeHtml(sponsor.cardClass || "sponsor-card");

            return `<a class="${classes}" href="${safeLink}" target="_blank" rel="noopener noreferrer"><img src="${resolveOptimizedAssetUrl(imageSrc)}" alt="${safeName}" loading="lazy" decoding="async"></a>`;
        }).join("");
    }


    /* ==========================================================
       NEWS
    ========================================================== */

    function renderNewsGridItems(grid, newsItems, lang) {
        if (!grid || !Array.isArray(newsItems)) return;
        const ctaText = {
            es: "Leer más",
            va: "Llegir més",
            en: "Read more",
            fr: "Lire plus"
        };

        grid.innerHTML = newsItems.map((item) => {
            const title = getLocalizedText(item.title, lang);
            const article = getLocalizedText(item.article, lang);
            // El título es opcional (se puede dejar puesto solo dentro del artículo): la
            // tarjeta de la portada sí necesita un titular visible, así que si no hay uno
            // propio sacamos uno de repuesto del artículo (deriveTitleFromArticleHtml viene
            // de js/news.js, cargado antes que este script en index.html).
            const displayTitle = title || (typeof deriveTitleFromArticleHtml === "function" ? deriveTitleFromArticleHtml(article, 70) : "");
            const seoDescription = getLocalizedText(item.seo?.description, lang);
            // El .replace(/<[^>]*$/, "") de más quita cualquier etiqueta que se haya quedado
            // a medias al final (p.ej. una descripción guardada con un recorte antiguo que
            // cortaba el HTML en crudo) — sin esto, ese trozo suelto rompe la tarjeta entera.
            let summaryBase = String(seoDescription || article || "")
                .replace(/<[^>]*>/g, "")
                .replace(/<[^>]*$/, "")
                .replace(/(\*\*|__|[*_])/g, "")
                .trim();
            if (title) {
                const cleanTitle = title.replace(/<[^>]*>/g, "").trim();
                if (cleanTitle && summaryBase.toLowerCase().startsWith(cleanTitle.toLowerCase())) {
                    summaryBase = summaryBase.slice(cleanTitle.length).replace(/^[\s:.\-–—]+/, "").trim();
                }
            }
            const summary = summaryBase.length > 150 ? `${summaryBase.slice(0, 150)}...` : summaryBase;
            const imageSrc = item.imageSrc || item.image || "";
            const newsUrl = getNewsPublicUrl(item);
            const displayDate = item.publishAt || item.createdAt;
            const category = String(item.category || "").trim();
            const player = String(item.player || item.meta?.player || "").trim();

            // Sin imageSrc no hay nada que enseñar (todavía no se ha subido foto para esta
            // noticia): mejor un bloque neutro del mismo tamaño que un <img src=""> roto.
            const imageHtml = imageSrc
                ? `<img src="${resolveOptimizedAssetUrl(imageSrc)}" alt="${displayTitle}" loading="lazy" decoding="async" fetchpriority="high" width="400" height="240">`
                : `<div class="news-card-noimage" aria-hidden="true">🎾</div>`;

            return `
            <a class="news-card" href="${newsUrl}" data-news-id="${item.id || ""}" data-news-slug="${item?.seo?.slug || ""}">
                ${imageHtml}
                <div class="news-content">
                    <span class="news-date">${formatNewsDate(displayDate, lang)}</span>
                    ${category ? `<span class="news-date">${category}</span>` : ""}
                    ${player ? `<span class="news-date">Jugador: ${escapeHtml(player)}</span>` : ""}
                    <h3>${displayTitle}</h3>
                    <p>${summary}</p>
                    <span class="btn btn-primary">
                        ${ctaText[lang] || ctaText.es}
                    </span>
                </div>
            </a>`;
        }).join("");

        // Abre la noticia en una ventana modal (igual que el jugador/el cuadro) en vez de
        // navegar a news.html, así no se pierde el sitio de la portada. Ctrl/Cmd/clic central
        // siguen abriendo en pestaña nueva con normalidad.
        if (!grid.dataset.newsModalBound) {
            grid.dataset.newsModalBound = "1";
            grid.addEventListener("click", (event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
                const card = event.target.closest(".news-card");
                if (!card || typeof window.openNewsModal !== "function") return;
                event.preventDefault();
                window.openNewsModal(card.dataset.newsId || "", card.dataset.newsSlug || "");
            });
        }
    }

    async function loadNews() {
        const grid = document.querySelector(".news-grid");
        if (!grid) return;

        const lang = getCurrentLanguage();

        // 1. Instant 0ms cache-first render
        try {
            const syncCollection = typeof readNewsCollectionSync === "function" ? readNewsCollectionSync() : null;
            if (Array.isArray(syncCollection) && syncCollection.length > 0) {
                const publishedSync = syncCollection.filter((item) => isNewsPublished(item));
                if (publishedSync.length > 0) {
                    renderNewsGridItems(grid, publishedSync, lang);
                }
            }
        } catch (err) {}

        // 2. Non-blocking cloud/fallback fetch for complete consistency
        try {
            const dynamicNews = await readNewsCollection();
            let news = dynamicNews.filter((item) => isNewsPublished(item));

            if (news.length === 0) {
                const fallbackNews = await fetchCachedJson("data/translations/news.json", { cacheKey: "news-fallback", ttlMs: 300000 });
                news = (Array.isArray(fallbackNews) ? fallbackNews : []).map((item, index) => ({
                    id: `legacy_${index}`,
                    imageSrc: `assets/images/news/${item.image}`,
                    title: normalizeLocalizedText(item.title || ""),
                    article: normalizeLocalizedText(item.summary || ""),
                    createdAt: new Date().toISOString()
                }));
            }

            renderNewsGridItems(grid, news, lang);
        } catch (error) {
            console.error("Error cargando noticias:", error);
            reportPublicError("news", error);
        }

    }
    /*==================================================
    CONFIG
    ==================================================*/

    async function loadConfig() {

        try {

            CONFIG = await fetchCachedJson("data/config.json", { cacheKey: "site-config", ttlMs: 600000 });

            document.title = CONFIG.event.name;

        }

        catch (error) {

            console.error(error);
            reportPublicError("config", error);

        }

    }
    /* ==========================================================
       SCHEDULE
    ========================================================== */

    async function loadSchedule() {

        const list = document.querySelector(".schedule-list");

        if (!list) return;

        try {
            const matches = await fetchCachedJson("data/schedule.json", { cacheKey: "schedule", ttlMs: 300000 });
            list.innerHTML = "";

            matches.forEach(match => {

                list.innerHTML += `

        <div class="schedule-match">

            <strong>${match.time}</strong>

            <span>${match.court}</span>

            <span>${match.match}</span>

        </div>

        `;

            });
        } catch (error) {
            console.error("Error cargando schedule:", error);
            reportPublicError("schedule", error);
            list.innerHTML = "";
        }
    }

    function getCurrentLanguage() {
        return localStorage.getItem("language") || "es";
    }

    function normalizeLocalizedText(value) {
        if (typeof value === "string") {
            const s = value.trim();
            return { es: s, va: s, en: s, fr: s };
        }
        if (value && typeof value === "object") {
            const es = String(value.es || value.va || value.en || value.fr || "").trim();
            return {
                es,
                va: String(value.va || es).trim(),
                en: String(value.en || es).trim(),
                fr: String(value.fr || es).trim()
            };
        }
        return { es: "", va: "", en: "", fr: "" };
    }

    function getLocalizedText(obj, lang = "es") {
        if (typeof obj === "string") return obj;
        if (!obj || typeof obj !== "object") return "";
        return obj[lang] || obj.es || obj.en || obj.va || obj.fr || "";
    }

    function escapeHtml(str) {
        if (typeof str !== "string") return str || "";
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    function formatLocalizedDateTime(str, lang) {
        return str || "";
    }

    function getProgrammingDefaultCollection() {
        return [
            {
                id: "program_demo_1",
                dateTime: "Lunes 11 agosto · 20:00",
                title: {
                    es: "Presentación oficial",
                    va: "Presentació oficial",
                    en: "Official presentation",
                    fr: "Présentation officielle"
                },
                subtitle: {
                    es: "Bienvenida del PSA Valencia Open",
                    va: "Benvinguda del PSA Valencia Open",
                    en: "Welcome to PSA Valencia Open",
                    fr: "Bienvenue au PSA Valencia Open"
                },
                order: 1
            },
            {
                id: "program_demo_2",
                dateTime: "Martes 12 agosto · 11:00",
                title: {
                    es: "Primeras rondas",
                    va: "Primeres rondes",
                    en: "First rounds",
                    fr: "Premiers tours"
                },
                subtitle: {
                    es: "Apertura de pistas y primeros enfrentamientos",
                    va: "Obertura de pistes i primers enfrontaments",
                    en: "Courts open and first matchups",
                    fr: "Ouverture des courts et premiers enfrentaments"
                },
                order: 2
            },
            {
                id: "program_demo_3",
                dateTime: "Miércoles 13 agosto · 17:00",
                title: {
                    es: "Octavos de final",
                    va: "Vuitens de final",
                    en: "Round of 16",
                    fr: "Huitièmes de finale"
                },
                subtitle: {
                    es: "Jornada de partidos de octavos",
                    va: "Jornada de partits de vuitens",
                    en: "Round of 16 match day",
                    fr: "Journée de matchs des huitièmes"
                },
                order: 3
            },
            {
                id: "program_demo_4",
                dateTime: "Jueves 14 agosto · 18:00",
                title: {
                    es: "Cuartos de final",
                    va: "Quarts de final",
                    en: "Quarter-finals",
                    fr: "Quarts de finale"
                },
                subtitle: {
                    es: "Partidos decisivos por el pase a semifinales",
                    va: "Partits decisius pel pas a semifinals",
                    en: "Decisive matches for semi-finals qualification",
                    fr: "Matchs décisifs pour la qualification en demi-finales"
                },
                order: 4
            },
            {
                id: "program_demo_5",
                dateTime: "Viernes 15 agosto · 19:00",
                title: {
                    es: "Semifinales",
                    va: "Semifinals",
                    en: "Semi-finals",
                    fr: "Demi-finales"
                },
                subtitle: {
                    es: "Batallas de alto nivel por un puesto en la gran final",
                    va: "Batalles d'alt nivell per un lloc a la gran final",
                    en: "High-level battles for a spot in the grand final",
                    fr: "Combats de haut niveau pour une place en grande finale"
                },
                order: 5
            },
            {
                id: "program_demo_6",
                dateTime: "Sábado 16 agosto · 18:30",
                title: {
                    es: "Gran Final y Entrega de Trofeos",
                    va: "Gran Final i Lliurament de Trofeus",
                    en: "Grand Final & Trophy Ceremony",
                    fr: "Grande Finale et Cérémonie de Remise des Prix"
                },
                subtitle: {
                    es: "Partido por el título y ceremonia de premios",
                    va: "Partit pel títol i cerimònia de premis",
                    en: "Championship match and awards ceremony",
                    fr: "Match pour le titre et cérémonie des récompenses"
                },
                order: 6
            }
        ];
    }

    function normalizeProgrammingItem(item, index = 0) {
        return {
            id: String(item?.id || `program_${index}`).trim(),
            dateTime: String(item?.dateTime || item?.date || "").trim(),
            // Fecha real (YYYY-MM-DD) del día al que pertenece este acto — se usa solo para
            // saber cuándo ocultarlo automáticamente, no se muestra tal cual (para eso está
            // dateTime, el texto ya formateado). Si no tiene fecha real, nunca se oculta.
            eventDate: String(item?.eventDate || "").trim(),
            title: normalizeLocalizedText(item?.title || ""),
            subtitle: normalizeLocalizedText(item?.subtitle || ""),
            order: Number(item?.order) || index + 1
        };
    }

    /** Un acto sigue "vigente" mientras su día (fecha real, no el texto) no haya terminado
     *  todavía — así el martes desaparece solo en cuanto empieza el miércoles, sin tener que
     *  borrarlo a mano cada día. Los actos sin fecha real (dato antiguo) nunca se ocultan. */
    function isProgrammingItemUpcoming(item) {
        const eventDate = String(item?.eventDate || "").trim();
        if (!eventDate) return true;

        const parsed = new Date(`${eventDate}T00:00:00`);
        if (Number.isNaN(parsed.getTime())) return true;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return parsed.getTime() >= today.getTime();
    }

    function readProgrammingCollection() {
        try {
            const raw = localStorage.getItem(PROGRAMMING_COLLECTION_KEY);
            if (!raw) return getProgrammingDefaultCollection();

            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed) || parsed.length === 0) {
                return getProgrammingDefaultCollection();
            }

            return parsed
                .map((item, index) => normalizeProgrammingItem(item, index))
                .sort((a, b) => (a.order || 0) - (b.order || 0));
        } catch (error) {
            return getProgrammingDefaultCollection();
        }
    }

    async function loadProgramming() {
        const list = document.getElementById("programmingList");
        if (!list) return;

        try {
            const lang = getCurrentLanguage();
            const collection = readProgrammingCollection().filter(isProgrammingItemUpcoming);

            list.innerHTML = collection.map((item) => {
                const title = getLocalizedText(item.title, lang);
                const subtitle = getLocalizedText(item.subtitle, lang);
                const rawDateTime = getLocalizedText(item.dateTime, lang) || item.dateTime || "";
                const dateTimeStr = formatLocalizedDateTime(rawDateTime, lang);
                const dateTime = escapeHtml(dateTimeStr);

                return `
                <article class="programming-card">
                    <p class="programming-date">${dateTime}</p>
                    <h3 class="programming-title">${escapeHtml(title)}</h3>
                    ${subtitle ? `<p class="programming-subtitle">${escapeHtml(subtitle)}</p>` : ""}
                </article>
            `;
            }).join("");
        } catch (error) {
            console.error("Error cargando programación:", error);
            reportPublicError("programming", error);
            list.innerHTML = "";
        }
    }
    /* ==========================================================
    DRAWS
    ========================================================== */

    function showManualDrawFallback() {
        const psaViewport = document.querySelector(".psa-bracket-viewport");
        const legacyContainer = document.getElementById("legacyDrawBackupContainer");
        if (psaViewport) psaViewport.style.display = "none";
        if (legacyContainer) {
            legacyContainer.style.display = "block";
            legacyContainer.setAttribute("aria-hidden", "false");
        }
        renderManualDrawBracket();
    }

    async function loadDraws() {
        const mode = localStorage.getItem(TOURNAMENT_MODE_KEY) || "api";
        const psaViewport = document.querySelector(".psa-bracket-viewport");
        const legacyContainer = document.getElementById("legacyDrawBackupContainer");

        if (mode === "manual") {
            showManualDrawFallback();
            return;
        }

        // Modo API (por defecto): mostramos el cuadro en vivo. Si js/psa-draw.js no consigue
        // cargar datos reales de PSA (torneo nuevo sin acceso, red caída, etc.), cae automáticamente
        // al cuadro manual guardado en vez de dejar la página vacía.
        if (psaViewport) psaViewport.style.display = "block";
        if (legacyContainer) {
            legacyContainer.style.display = "none";
            legacyContainer.setAttribute("aria-hidden", "true");
        }
        window.addEventListener("psa-draw-status", (event) => {
            if (!event.detail?.ok) showManualDrawFallback();
        }, { once: true });
        return;
    }

    async function renderManualDrawBracket() {
        const bracket = document.querySelector(".draw-bracket");
        if (!bracket) return;

        initDrawOpenInNewTab();

        try {
            let bracketData = null;
            try {
                bracketData = await fetchCachedJson("data/draw-bracket.json", { cacheKey: "draw-bracket", ttlMs: 300000, forceFresh: true });
            } catch (e) {
                const res = await fetch("data/draw-bracket.json", { cache: "no-store" });
                bracketData = await res.json();
            }

            if (!bracketData || !Array.isArray(bracketData.rounds)) {
                const res = await fetch("data/draw-bracket.json", { cache: "no-store" });
                bracketData = await res.json();
            }

            const storedState = localStorage.getItem("drawBracketState");
            let parsedState = null;
            if (storedState) {
                try {
                    parsedState = JSON.parse(storedState);
                    while (typeof parsedState === "string") {
                        parsedState = JSON.parse(parsedState);
                    }
                } catch (e) {
                    parsedState = null;
                }
            }

            const activeBracket = (parsedState?.rounds && Array.isArray(parsedState.rounds) && parsedState.rounds.length > 0)
                ? parsedState
                : bracketData;

            normalizeBracket(activeBracket);
            autoAdvanceBracket(activeBracket);

            const firstRoundCount = bracketData.rounds[0]?.matches?.length || 0;
            const mobile = window.matchMedia("(max-width: 600px)").matches;
            const matchHeight = mobile ? 50 : 112;
            const matchStep = mobile ? 58 : 132;
            const roundHeight = Math.max(
                mobile ? 760 : 1980,
                (Math.max(firstRoundCount - 1, 0) * matchStep) + matchHeight
            );

            bracket.style.setProperty("--round-height", `${roundHeight}px`);
            bracket.style.setProperty("--match-height", `${matchHeight}px`);
            bracket.innerHTML = "";

            activeBracket.rounds.forEach((round, index) => {
                const roundCol = document.createElement("div");
                roundCol.className = "draw-round";
                roundCol.classList.add(`draw-round-${index + 1}`);

                roundCol.innerHTML = `
                <div class="draw-round-title">${round.title}</div>
                <div class="draw-round-matches"></div>
            `;

                const matchHost = roundCol.querySelector(".draw-round-matches");

                round.matches.forEach((match, matchIndex) => {
                    const card = document.createElement("div");
                    card.className = "draw-match";

                    const factor = 2 ** index;
                    const top = ((factor * matchIndex) + ((factor - 1) / 2)) * matchStep;
                    card.style.top = `${Math.round(top)}px`;

                    const p1Muted = isMutedPlayer(match.p1.name);
                    const p2Muted = isMutedPlayer(match.p2.name);
                    const hasPlayedGames = hasAnyPlayedGame(match.games);
                    const p1Sets = (!hasPlayedGames || p1Muted) ? "" : countSetsWon(match.games, "p1");
                    const p2Sets = (!hasPlayedGames || p2Muted) ? "" : countSetsWon(match.games, "p2");
                    const gameCells1 = renderGameCells(match.games, "p1");
                    const gameCells2 = renderGameCells(match.games, "p2");
                    const footerDate = match.date || "-";
                    const p1Image = resolveDrawPlayerImage(match.p1.image);
                    const p2Image = resolveDrawPlayerImage(match.p2.image);

                    card.innerHTML = `
                    <div class="draw-player ${p1Muted ? "is-muted" : ""}">
                        <div class="draw-player-main">
                            <span class="draw-avatar-wrap">
                                ${p1Image ? `<img class="draw-avatar" src="${p1Image}" alt="${match.p1.name}">` : ""}
                            </span>
                            <span class="draw-player-name">${match.p1.name}</span>
                        </div>
                        <div class="draw-scoreline">
                            <span class="draw-sets-won">${p1Sets}</span>
                            ${gameCells1}
                        </div>
                    </div>
                    <div class="draw-player ${p2Muted ? "is-muted" : ""}">
                        <div class="draw-player-main">
                            <span class="draw-avatar-wrap">
                                ${p2Image ? `<img class="draw-avatar" src="${p2Image}" alt="${match.p2.name}">` : ""}
                            </span>
                            <span class="draw-player-name">${match.p2.name}</span>
                        </div>
                        <div class="draw-scoreline">
                            <span class="draw-sets-won">${p2Sets}</span>
                            ${gameCells2}
                        </div>
                    </div>
                    <div class="draw-match-footer">
                        <span class="draw-match-date">${footerDate}</span>
                    </div>
                `;

                    matchHost.appendChild(card);
                });

                bracket.appendChild(roundCol);
            });
        } catch (error) {
            console.error("Error cargando bracket:", error);
            reportPublicError("draw", error);
            bracket.innerHTML = '<p class="draw-error">No se pudo cargar el cuadro.</p>';
        }

    }

    function resolveDrawPlayerImage(value) {

        const raw = String(value || "").trim();
        if (!raw) return "";
        if (raw.startsWith("data:")) return raw;
        if (/^https?:\/\//i.test(raw)) return raw;
        if (raw.includes("/")) return raw;
        return `assets/images/players/${raw}`;

    }

    function initDrawOpenInNewTab() {

        const wrapper = document.querySelector("#draw .draw-bracket-wrapper");
        if (!wrapper) return;
        if (wrapper.dataset.openLargeBound === "1") return;

        const openLargeDraw = () => {
            window.open("draw.html", "_blank", "noopener,noreferrer");
        };

        wrapper.dataset.openLargeBound = "1";
        wrapper.classList.add("draw-openable");
        wrapper.setAttribute("role", "link");
        wrapper.setAttribute("tabindex", "0");
        wrapper.setAttribute("title", "Abrir cuadro en grande");

        wrapper.addEventListener("click", (event) => {
            const interactiveTarget = event.target.closest("a, button, input, select, textarea, label");
            if (interactiveTarget) return;
            openLargeDraw();
        });

        wrapper.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            openLargeDraw();
        });

    }

    function isMutedPlayer(name) {

        return name === "TBD" || name === "BYE" || !name;

    }

    function normalizeBracket(bracket) {

        bracket.rounds.forEach((round) => {
            round.matches.forEach((match) => {
                if (!match.p1) match.p1 = { name: "TBD" };
                if (!match.p2) match.p2 = { name: "TBD" };
                if (!Array.isArray(match.games)) {
                    match.games = Array.from({ length: 5 }, () => ({ p1: null, p2: null }));
                }
                if (match.games.length < 5) {
                    const missing = 5 - match.games.length;
                    for (let i = 0; i < missing; i += 1) {
                        match.games.push({ p1: null, p2: null });
                    }
                }
            });
        });

    }

    function autoAdvanceBracket(bracket) {

        for (let roundIndex = 1; roundIndex < bracket.rounds.length; roundIndex += 1) {
            bracket.rounds[roundIndex].matches.forEach((match) => {
                match.p1 = { name: "TBD" };
                match.p2 = { name: "TBD" };
            });
        }

        for (let roundIndex = 0; roundIndex < bracket.rounds.length - 1; roundIndex += 1) {
            const currentRound = bracket.rounds[roundIndex];
            const nextRound = bracket.rounds[roundIndex + 1];

            currentRound.matches.forEach((match, matchIndex) => {
                const winner = getMatchWinner(match);
                if (!winner) return;

                const nextMatchIndex = Math.floor(matchIndex / 2);
                const targetSlot = matchIndex % 2 === 0 ? "p1" : "p2";

                if (nextRound.matches[nextMatchIndex]) {
                    nextRound.matches[nextMatchIndex][targetSlot] = {
                        name: winner.name,
                        image: winner.image || null
                    };
                }
            });
        }

    }

    function getMatchWinner(match) {

        if (match.p1?.name === "BYE" && !isMutedPlayer(match.p2?.name)) return match.p2;
        if (match.p2?.name === "BYE" && !isMutedPlayer(match.p1?.name)) return match.p1;
        if (isMutedPlayer(match.p1?.name) || isMutedPlayer(match.p2?.name)) return null;

        const p1Sets = countSetsWon(match.games, "p1");
        const p2Sets = countSetsWon(match.games, "p2");

        if (p1Sets === p2Sets) return null;

        return p1Sets > p2Sets ? match.p1 : match.p2;

    }

    function countSetsWon(games, side) {

        const sideKey = side === "p1" ? "p1" : "p2";
        const oppKey = side === "p1" ? "p2" : "p1";

        return games.reduce((sum, game) => {
            const mine = toValidScore(game?.[sideKey]);
            const opp = toValidScore(game?.[oppKey]);

            if (mine === null || opp === null) return sum;

            return mine > opp ? sum + 1 : sum;
        }, 0);

    }

    function toValidScore(value) {

        if (value === null || value === undefined || value === "") return null;

        const num = Number(value);
        return Number.isFinite(num) ? num : null;

    }

    function renderGameCells(games, side) {

        const key = side === "p1" ? "p1" : "p2";

        return games.slice(0, 5).map((game) => {
            const score = toValidScore(game?.[key]);
            return `<span class="draw-game-score">${score === null ? "" : score}</span>`;
        }).join("");

    }

    function hasAnyPlayedGame(games) {

        return (games || []).some((game) => {
            const p1 = toValidScore(game?.p1);
            const p2 = toValidScore(game?.p2);
            return p1 !== null || p2 !== null;
        });

    }

    function loadTournamentCenter() {
        const liveNow = document.getElementById("liveNow");
        const todayMatches = document.getElementById("todayMatches");
        const latestResults = document.getElementById("latestResults");
        const nextMatches = document.getElementById("nextMatches");

        if (liveNow) {
            liveNow.innerHTML = "No hay partidos en directo";
        }
        if (todayMatches) {
            todayMatches.innerHTML = "No hay partidos programados";
        }
        if (latestResults) {
            latestResults.innerHTML = "Sin resultados";
        }
        if (nextMatches) {
            nextMatches.innerHTML = "Sin próximos partidos";
        }

    }

    function extractYouTubeVideoId(url) {

        if (!url) return null;

        try {
            const parsed = new URL(url);
            const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

            if (host === "youtu.be") {
                return parsed.pathname.split("/").filter(Boolean)[0] || null;
            }

            if (host.endsWith("youtube.com")) {
                if (parsed.searchParams.get("v")) {
                    return parsed.searchParams.get("v");
                }

                const pathParts = parsed.pathname.split("/").filter(Boolean);
                const marker = pathParts[0];
                if (["embed", "shorts", "live"].includes(marker) && pathParts[1]) {
                    return pathParts[1];
                }
            }
        } catch (error) {
            return null;
        }

        return null;

    }

    function initLiveStream() {

        const videoContainer = document.querySelector("#live .live-video");
        const archivePanel = document.getElementById("liveArchivePanel");
        const archiveGrid = document.getElementById("liveArchiveGrid");
        if (!videoContainer) return;

        const history = readLiveHistory();
        const validHistory = history.filter((item) => item?.url && extractYouTubeVideoId(item.url));
        const currentItem = validHistory.length ? validHistory[validHistory.length - 1] : null;

        const isOldDefaultStream = Boolean(currentItem?.url?.includes("8Th2hgkl1v8"));
        const titleEl = document.getElementById("liveVideoTitle");
        if (currentItem?.url && extractYouTubeVideoId(currentItem.url) && !isOldDefaultStream) {
            renderLivePlayer(videoContainer, currentItem.url);
            if (titleEl) {
                const title = String(currentItem.title || "").trim();
                titleEl.textContent = title;
                titleEl.style.display = title ? "" : "none";
            }
        } else {
            if (titleEl) titleEl.style.display = "none";
            videoContainer.innerHTML = `
            <div class="video-placeholder">
                📺
                <h3 data-i18n="live.videoTitle">Streaming PSA Valencia Open</h3>
                <p data-i18n="live.videoIntro">
                    Aquí aparecerá el reproductor de YouTube cuando el directo esté activo.
                </p>
            </div>
        `;
        }

        if (validHistory.length <= 1) {
            if (archivePanel) archivePanel.hidden = true;
            if (archiveGrid) archiveGrid.innerHTML = "";
            return;
        }

        if (!archivePanel || !archiveGrid) return;

        const previous = validHistory.slice(0, -1);
        archivePanel.hidden = false;
        archiveGrid.innerHTML = previous.map((item) => {
            const id = extractYouTubeVideoId(item.url);
            if (!id) return "";
            const thumb = `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
            const title = escapeHtml(item.title || "Directo anterior");
            const safeUrl = escapeHtml(item.url);
            return `
            <a class="live-archive-card" href="${safeUrl}" target="_blank" rel="noopener noreferrer" aria-label="${title}">
                <img class="live-archive-thumb" src="${thumb}" alt="${title}" onerror="this.style.display='none'; this.nextElementSibling.style.display='';">
                <div class="live-archive-thumb-fallback" style="display:none;">📺</div>
                <div class="live-archive-meta">${title}</div>
            </a>
        `;
        }).join("");

    }

    function readLiveHistory() {
        try {
            const raw = localStorage.getItem(LIVE_STREAM_HISTORY_KEY);
            const current = (localStorage.getItem(LIVE_STREAM_URL_KEY) || "").trim();
            if (!raw) {
                return current
                    ? [{ url: current, title: "Directo", createdAt: new Date().toISOString() }]
                    : [];
            }

            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                return current
                    ? [{ url: current, title: "Directo", createdAt: new Date().toISOString() }]
                    : [];
            }

            const urls = parsed
                .map((value) => {
                    if (typeof value === "string") {
                        const url = value.trim();
                        if (!url || !extractYouTubeVideoId(url)) return null;
                        return { url, title: "Directo", createdAt: new Date().toISOString() };
                    }

                    if (value && typeof value === "object") {
                        const url = String(value.url || "").trim();
                        if (!url || !extractYouTubeVideoId(url)) return null;
                        return {
                            url,
                            title: String(value.title || "Directo").trim() || "Directo",
                            createdAt: value.createdAt || new Date().toISOString()
                        };
                    }

                    return null;
                })
                .filter(Boolean);

            if (urls.length === 0 && current) {
                return [{ url: current, title: "Directo", createdAt: new Date().toISOString() }];
            }

            return urls;
        } catch (error) {
            const current = (localStorage.getItem(LIVE_STREAM_URL_KEY) || "").trim();
            return current ? [{ url: current, title: "Directo", createdAt: new Date().toISOString() }] : [];
        }
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function renderLivePlayer(container, streamUrl) {
        const videoId = extractYouTubeVideoId(streamUrl);
        if (!videoId) return;

        const embedUrl = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;

        container.innerHTML = `
        <iframe
            src="${embedUrl}"
            title="PSA Valencia Open Live"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen
            loading="lazy"
            referrerpolicy="strict-origin-when-cross-origin">
        </iframe>
    `;
    }

    function getCurrentLanguage() {
        const lang = (localStorage.getItem("language") || "es").toLowerCase();
        return DYNAMIC_LANGS.includes(lang) ? lang : "es";
    }

    function extractStringFromLocalized(val) {
        if (val === null || val === undefined) return "";
        if (typeof val === "string") {
            const trimmed = val.trim();
            if (trimmed.startsWith("{")) {
                try {
                    const parsed = JSON.parse(trimmed);
                    if (parsed && typeof parsed === "object") {
                        return extractStringFromLocalized(parsed);
                    }
                } catch (e) { }
            }
            return val;
        }
        if (typeof val === "number" || typeof val === "boolean") return String(val);
        if (typeof val === "object") {
            if (typeof val.es === "string") return val.es;
            if (typeof val.va === "string") return val.va;
            if (typeof val.en === "string") return val.en;
            if (typeof val.fr === "string") return val.fr;
            for (const k in val) {
                if (typeof val[k] === "string") return val[k];
                if (typeof val[k] === "object" && val[k] !== null) {
                    const sub = extractStringFromLocalized(val[k]);
                    if (sub) return sub;
                }
            }
        }
        return "";
    }

    function normalizeLocalizedText(value) {
        if (typeof value === "string") {
            const trimmed = value.trim();
            if (trimmed.startsWith("{")) {
                try {
                    const parsed = JSON.parse(trimmed);
                    if (parsed && typeof parsed === "object") {
                        value = parsed;
                    }
                } catch (e) { }
            }
        }

        if (value && typeof value === "object" && !Array.isArray(value)) {
            const esStr = extractStringFromLocalized(value.es);
            const vaStr = extractStringFromLocalized(value.va);
            const enStr = extractStringFromLocalized(value.en);
            const frStr = extractStringFromLocalized(value.fr);
            const base = esStr || vaStr || enStr || frStr || "";

            return {
                es: esStr || base,
                va: vaStr || base,
                en: enStr || base,
                fr: frStr || base
            };
        }

        const text = extractStringFromLocalized(value);
        return { es: text, va: text, en: text, fr: text };
    }

    function getLocalizedText(value, lang) {
        const localized = normalizeLocalizedText(value);
        const target = localized[lang] || localized.es || "";
        return extractStringFromLocalized(target);
    }

    const PROGRAMMING_DAY_MAP = {
        lunes: { es: "Lunes", va: "Dilluns", en: "Monday", fr: "Lundi" },
        martes: { es: "Martes", va: "Dimarts", en: "Tuesday", fr: "Mardi" },
        miercoles: { es: "Miércoles", va: "Dimecres", en: "Wednesday", fr: "Mercredi" },
        miércoles: { es: "Miércoles", va: "Dimecres", en: "Wednesday", fr: "Mercredi" },
        jueves: { es: "Jueves", va: "Dijous", en: "Thursday", fr: "Jeudi" },
        viernes: { es: "Viernes", va: "Divendres", en: "Friday", fr: "Vendredi" },
        sabado: { es: "Sábado", va: "Dissabte", en: "Saturday", fr: "Samedi" },
        sábado: { es: "Sábado", va: "Dissabte", en: "Saturday", fr: "Samedi" },
        domingo: { es: "Domingo", va: "Diumenge", en: "Sunday", fr: "Dimanche" }
    };

    const PROGRAMMING_MONTH_MAP = {
        enero: { es: "enero", va: "gener", en: "January", fr: "janvier" },
        febrero: { es: "febrero", va: "febrer", en: "February", fr: "février" },
        marzo: { es: "marzo", va: "març", en: "March", fr: "mars" },
        abril: { es: "abril", va: "abril", en: "April", fr: "avril" },
        mayo: { es: "mayo", va: "maig", en: "May", fr: "mai" },
        junio: { es: "junio", va: "juny", en: "June", fr: "juin" },
        julio: { es: "julio", va: "juliol", en: "July", fr: "juillet" },
        agosto: { es: "agosto", va: "agost", en: "August", fr: "août" },
        septiembre: { es: "septiembre", va: "setembre", en: "September", fr: "septembre" },
        octubre: { es: "octubre", va: "octubre", en: "October", fr: "octobre" },
        noviembre: { es: "noviembre", va: "novembre", en: "November", fr: "novembre" },
        diciembre: { es: "diciembre", va: "desembre", en: "December", fr: "décembre" },
        ago: { es: "AGO", va: "AGO", en: "AUG", fr: "AOÛT" }
    };

    function formatLocalizedDateTime(raw, lang) {
        if (!raw) return "";

        const locText = getLocalizedText(raw, lang);
        if (locText && locText !== "[object Object]") {
            raw = locText;
        }

        let text = String(raw || "").trim();
        if (!text || lang === "es") return text;

        Object.keys(PROGRAMMING_DAY_MAP).forEach((dayKey) => {
            const regex = new RegExp(`\\b${dayKey}\\b`, "gi");
            if (regex.test(text)) {
                const replacement = PROGRAMMING_DAY_MAP[dayKey][lang] || PROGRAMMING_DAY_MAP[dayKey].es;
                text = text.replace(regex, replacement);
            }
        });

        Object.keys(PROGRAMMING_MONTH_MAP).forEach((monthKey) => {
            const regex = new RegExp(`\\b${monthKey}\\b`, "gi");
            if (regex.test(text)) {
                const replacement = PROGRAMMING_MONTH_MAP[monthKey][lang] || PROGRAMMING_MONTH_MAP[monthKey].es;
                text = text.replace(regex, replacement);
            }
        });

        return text;
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

    function getNewsPublicUrl(item) {
        const slug = slugifyText(item?.seo?.slug || "");
        if (slug) return `news.html?slug=${encodeURIComponent(slug)}`;
        return `news.html?newsId=${encodeURIComponent(item?.id || "")}`;
    }

    function stripHtmlTagsForSummaryLocal(html, maxLen) {
        if (typeof stripHtmlTagsForSummary === "function") return stripHtmlTagsForSummary(html, maxLen);
        const text = String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        return text.length <= maxLen ? text : `${text.slice(0, maxLen).replace(/\s+\S*$/, "")}…`;
    }

    function normalizeNewsItem(item) {
        const article = item?.article || item?.summary || "";
        const title = normalizeLocalizedText(item?.title);
        const body = normalizeLocalizedText(article);
        // Recorte defensivo: si algún día llega un seo.description vacío, generamos uno de
        // repuesto quitando las etiquetas ANTES de recortar (recortar el HTML en crudo puede
        // cortar a mitad de una etiqueta y guardar/mostrar HTML roto).
        const fallbackSeoDescription = {
            es: stripHtmlTagsForSummaryLocal(item?.seo?.description?.es || body.es || "", 160),
            va: stripHtmlTagsForSummaryLocal(item?.seo?.description?.va || body.va || body.es || "", 160),
            en: stripHtmlTagsForSummaryLocal(item?.seo?.description?.en || body.en || body.es || "", 160),
            fr: stripHtmlTagsForSummaryLocal(item?.seo?.description?.fr || body.fr || body.es || "", 160)
        };
        return {
            id: item?.id || `news_${Math.random().toString(36).slice(2, 8)}`,
            imageSrc: item?.imageSrc || item?.image || "",
            imageStoragePath: item?.imageStoragePath || "",
            title,
            article: body,
            createdAt: item?.createdAt || new Date().toISOString(),
            updatedAt: item?.updatedAt || item?.createdAt || new Date().toISOString(),
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

    function readNewsCollection() {
        try {
            const raw = localStorage.getItem(NEWS_COLLECTION_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];

            return parsed.map(normalizeNewsItem).sort((a, b) => {
                const ta = Date.parse(a?.publishAt || a?.createdAt || "") || 0;
                const tb = Date.parse(b?.publishAt || b?.createdAt || "") || 0;
                return tb - ta;
            });
        } catch (error) {
            return [];
        }
    }

    function normalizeGalleryItem(item) {
        const photos = Array.isArray(item?.photos) ? item.photos : [];
        return {
            id: item?.id || `gallery_${Math.random().toString(36).slice(2, 8)}`,
            title: normalizeLocalizedText(item?.title),
            meta: item?.meta && typeof item.meta === "object" ? item.meta : {},
            photos: photos.map((photo) => ({
                id: photo?.id || `photo_${Math.random().toString(36).slice(2, 8)}`,
                type: photo?.type === "video" ? "video" : "photo",
                videoUrl: photo?.type === "video" ? String(photo?.videoUrl || "").trim() : "",
                src: photo?.src || "",
                caption: normalizeLocalizedText(photo?.caption)
            })).filter((photo) => (photo.type === "video" ? !!photo.videoUrl : !!photo.src)),
            createdAt: item?.createdAt || new Date().toISOString()
        };
    }

    function readGalleryCollection() {

        try {
            const raw = localStorage.getItem(GALLERY_COLLECTION_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];

            return parsed.map(normalizeGalleryItem).sort((a, b) => {
                const ta = Date.parse(a?.createdAt || "") || 0;
                const tb = Date.parse(b?.createdAt || "") || 0;
                return ta - tb;
            });
        } catch (error) {
            return [];
        }

    }

    function loadHomeGallery() {

        const grid = document.getElementById("galleryHomeGrid");
        if (!grid) return;

        const galleries = readGalleryCollection();
        const lang = getCurrentLanguage();
        const photosWord = {
            es: "fotos",
            va: "fotos",
            en: "photos",
            fr: "photos"
        };

        if (galleries.length === 0) {
            grid.innerHTML = '<p class="gallery-empty">Todavia no hay galerias publicadas.</p>';
            return;
        }

        grid.innerHTML = "";

        galleries.forEach((gallery) => {
            const photos = Array.isArray(gallery.photos) ? gallery.photos : [];
            if (photos.length === 0) return;

            // Preferimos una foto real como portada; si la galería solo tiene vídeos
            // enlazados (sin imagen propia), usamos un icono de "play" en vez de un <img>
            // con src vacío, que se vería como imagen rota.
            const cover = photos.find((photo) => photo.type !== "video" && photo.src) || photos[0];
            const card = document.createElement("a");
            card.className = "gallery-home-card";
            card.href = `gallery.html?galleryId=${encodeURIComponent(gallery.id)}`;

            const baseTitle = getLocalizedText(gallery.title, lang) || "Galería";
            const galleryDate = String(gallery.meta?.date || "").trim();
            const title = galleryDate ? `${baseTitle} · ${formatNewsDate(galleryDate, lang)}` : baseTitle;
            const thumbHtml = cover.type === "video" || !cover.src
                ? `<div class="gallery-home-thumb-video" aria-hidden="true">▶</div>`
                : `<img src="${resolveOptimizedAssetUrl(cover.processedSrc || cover.src)}" alt="${title}" loading="lazy" decoding="async">`;

            card.innerHTML = `
            <div class="gallery-home-thumb">
                ${thumbHtml}
            </div>
            <div class="gallery-home-info">
                <div class="gallery-home-title">${title}</div>
                <div class="gallery-home-count">${photos.length} ${photosWord[lang] || photosWord.es}</div>
            </div>
        `;

            grid.appendChild(card);
        });

        if (!grid.innerHTML.trim()) {
            grid.innerHTML = '<p class="gallery-empty">Todavia no hay galerias publicadas.</p>';
        }

        window.PSAOptimizations?.applyLazyMedia?.(grid);

    }

})();
