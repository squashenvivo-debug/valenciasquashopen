/**
 * player.js — página de detalle de un jugador (player.html?id=... o ?name=...)
 *
 * Los datos base (foto, país, ranking, seed) vienen de la misma colección de
 * jugadores que usa la portada (playersCollection, sincronizada desde Supabase).
 * Edad/altura/mano se intentan enriquecer con la API de PSA en directo cuando
 * ese jugador está en el torneo actual; si no hay dato real, la fila se oculta
 * en vez de mostrar algo inventado.
 */

const PLAYERS_COLLECTION_KEY = "playersCollection";

function resolvePlayerImageSrc(image) {
    const value = String(image || "").trim();
    if (!value) return "";
    if (value.startsWith("data:")) return value;
    if (/^https?:\/\//i.test(value)) return value;
    if (value.includes("/")) return value;
    return `assets/images/players/${value}`;
}

function normalizePlayerName(name) {
    return String(name || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

async function syncPlayersFromCloud() {
    const cloud = window.PSACloudStore;
    if (!cloud?.isReady?.()) return;
    await cloud.syncLocalStorageFromCloud([PLAYERS_COLLECTION_KEY]);
}

function readPlayersCollection() {
    try {
        const raw = localStorage.getItem(PLAYERS_COLLECTION_KEY);
        if (!raw) return [];
        let parsed = JSON.parse(raw);
        while (typeof parsed === "string") parsed = JSON.parse(parsed);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

async function loadPlayersFallback() {
    try {
        const res = await fetch("data/players.json", { cache: "no-store" });
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data;
    } catch (error) {
        // seguimos al siguiente fallback
    }
    try {
        const res = await fetch("data/translations/players.json", { cache: "no-store" });
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    } catch (error) {
        return [];
    }
}

function findPlayer(players, id, name) {
    if (id) {
        const byId = players.find((p) => String(p?.id || "") === id);
        if (byId) return byId;
    }
    if (name) {
        const target = normalizePlayerName(name);
        const byName = players.find((p) => normalizePlayerName(p?.name) === target);
        if (byName) return byName;
    }
    return null;
}

/** Busca edad/altura/mano en la API de PSA en directo, solo si ese jugador está en el torneo actual. */
async function fetchLivePlayerDetails(name) {
    try {
        const config = window.PSA_CONFIG || {};
        const baseUrl = config.supabaseUrl || "https://texjzaanugmssmolzwgb.supabase.co";
        const tournamentId = (localStorage.getItem("psaTournamentId") || config.psaTournamentId || "12711").trim();
        const url = `${baseUrl}/functions/v1/psa-proxy?tournament=${encodeURIComponent(tournamentId)}&expanded=true&include_divisions=true&show_past=true&head_to_head=false`;
        const response = await fetch(url, { headers: { Accept: "application/json" } });
        const payload = await response.json();
        if (!response.ok || payload?.success === false) return null;

        const target = normalizePlayerName(name);
        const divisions = Array.isArray(payload.divisions) ? payload.divisions : [];
        for (const division of divisions) {
            const players = Array.isArray(division.players) ? division.players : [];
            const match = players.find((p) => normalizePlayerName(p?.name) === target);
            if (match) return match;
        }
        return null;
    } catch (error) {
        return null;
    }
}

function setRowVisible(rowId, spanId, value) {
    const row = document.getElementById(rowId);
    const span = document.getElementById(spanId);
    if (!row || !span) return;

    if (value === null || value === undefined || value === "") {
        row.style.display = "none";
        return;
    }
    span.textContent = value;
    row.style.display = "";
}

async function renderPlayerPage() {
    const params = new URLSearchParams(window.location.search);
    const id = (params.get("id") || "").trim();
    const name = (params.get("name") || "").trim();

    const notFoundEl = document.getElementById("playerNotFound");
    const cardEl = document.getElementById("playerHeaderCard");
    if (!notFoundEl || !cardEl) return;

    await syncPlayersFromCloud();
    let players = readPlayersCollection();
    if (players.length === 0) players = await loadPlayersFallback();

    const player = findPlayer(players, id, name);
    if (!player) {
        cardEl.style.display = "none";
        notFoundEl.style.display = "block";
        return;
    }

    const playerName = String(player.name || "").trim();
    document.title = `${playerName || "Jugador"} | PSA Valencia Open`;

    const imageEl = document.getElementById("player-image");
    if (imageEl) {
        const src = resolvePlayerImageSrc(player.image || player.imageSrc || "");
        if (src) imageEl.src = src;
    }

    const nameEl = document.getElementById("player-name");
    if (nameEl) nameEl.textContent = playerName || "-";

    const country = String(player.country || "").trim().toUpperCase();
    const flagEl = document.getElementById("player-flag");
    if (flagEl && country) flagEl.src = `assets/images/flags/${country}.svg`;
    const countryNameEl = document.getElementById("player-country-name");
    if (countryNameEl) countryNameEl.textContent = country || "-";

    const rankingEl = document.getElementById("player-ranking");
    if (rankingEl) rankingEl.textContent = player.ranking || player.current_world_ranking || "-";

    // Edad/altura/mano: solo si tenemos el dato real de PSA para este jugador en el torneo actual.
    const liveDetails = await fetchLivePlayerDetails(playerName);
    setRowVisible("player-age-row", "player-age", liveDetails?.age || "");
    setRowVisible("player-height-row", "player-height", liveDetails?.height_cm ? `${Math.round(Number(liveDetails.height_cm))} cm` : "");
    const handKey = liveDetails?.player_hand?.toLowerCase() === "left" ? "handLeft" : liveDetails?.player_hand ? "handRight" : "";
    const handLabel = handKey ? ((typeof t === "function" ? t(`psaPlayer.${handKey}`) : "") || (handKey === "handLeft" ? "Izquierda" : "Derecha")) : "";
    setRowVisible("player-hand-row", "player-hand", handLabel);
}

document.addEventListener("DOMContentLoaded", renderPlayerPage);
