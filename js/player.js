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
const PLAYER_SILHOUETTE_SRC = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcng9IjI0IiBmaWxsPSIjMWMyNTMwIi8+PGNpcmNsZSBjeD0iNTAiIGN5PSIzOCIgcj0iMTgiIGZpbGw9IiM0YTU1NjgiLz48cGF0aCBkPSJNMTggOTBjMC0yNCAxMy0zNCAzMi0zNHMzMiAxMCAzMiAzNHoiIGZpbGw9IiM0YTU1NjgiLz48L3N2Zz4=";

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

/** Trae el cuadro completo del torneo en directo (mismo proxy que usa el cuadro y las noticias). */
async function fetchLiveTournamentSnapshot() {
    try {
        const config = window.PSA_CONFIG || {};
        const baseUrl = config.supabaseUrl || "https://texjzaanugmssmolzwgb.supabase.co";
        const tournamentId = (localStorage.getItem("psaTournamentId") || config.psaTournamentId || "12711").trim();
        const url = `${baseUrl}/functions/v1/psa-proxy?tournament=${encodeURIComponent(tournamentId)}&expanded=true&include_divisions=true&show_past=true&head_to_head=true`;
        const response = await fetch(url, { headers: { Accept: "application/json" } });
        const payload = await response.json();
        if (!response.ok || payload?.success === false) return null;
        return payload;
    } catch (error) {
        return null;
    }
}

/** Ficha biográfica real (edad/altura/mano) del jugador, solo si está en el torneo actual. */
function findLivePlayerDetails(divisions, name) {
    const target = normalizePlayerName(name);
    for (const division of divisions || []) {
        const players = Array.isArray(division.players) ? division.players : [];
        const match = players.find((p) => normalizePlayerName(p?.name) === target);
        if (match) return match;
    }
    return null;
}

/** Todos los partidos reales (sin huecos de bye) de este jugador en el cuadro actual, en orden de ronda. */
function getPlayerMatches(divisions, name) {
    const target = normalizePlayerName(name);
    const matches = [];

    (divisions || []).forEach((division) => {
        (division.brackets || []).forEach((bracket) => {
            (bracket.matches || []).forEach((match) => {
                if (match.bye) return;
                const players = Array.isArray(match.players) ? match.players : [];
                const meIdx = players.findIndex((p) => normalizePlayerName(p?.name) === target);
                if (meIdx === -1) return;
                const opponent = players[meIdx === 0 ? 1 : 0];
                if (!opponent?.name) return;

                matches.push({
                    round: match.round || "",
                    round_num: match.round_num ?? 0,
                    status: match.status || "scheduled",
                    date: match.date || "",
                    time: match.time || "",
                    scoreline: match.scoreline || "",
                    opponentName: opponent.name,
                    isWinner: match.winner_id !== null && match.winner_id !== undefined
                        && String(match.winner_id) === String(players[meIdx].id)
                });
            });
        });
    });

    return matches.sort((a, b) => a.round_num - b.round_num);
}

/**
 * Últimos enfrentamientos reales (head-to-head) contra los rivales que le tocan en este
 * torneo. No hay un endpoint de "historial general" de un jugador en la API de PSA que
 * tengamos conectada — solo el head-to-head entre dos jugadores concretos cuando coinciden
 * en un cruce — así que construimos el historial a partir de esos enfrentamientos reales
 * en vez de inventar datos de partidos que no tenemos.
 */
function getPlayerRecentMeetings(divisions, name) {
    const target = normalizePlayerName(name);
    const meetings = [];

    (divisions || []).forEach((division) => {
        (division.brackets || []).forEach((bracket) => {
            (bracket.matches || []).forEach((match) => {
                if (match.bye) return;
                const players = Array.isArray(match.players) ? match.players : [];
                const meIdx = players.findIndex((p) => normalizePlayerName(p?.name) === target);
                if (meIdx === -1) return;
                const opponent = players[meIdx === 0 ? 1 : 0];
                if (!opponent?.name) return;
                const myId = players[meIdx]?.id;

                const recent = Array.isArray(match.head_to_head?.recent_meetings) ? match.head_to_head.recent_meetings : [];
                recent.forEach((meeting) => {
                    if (!meeting?.date) return;
                    meetings.push({
                        date: meeting.date,
                        tournament: meeting.tournament || "",
                        round: meeting.round || "",
                        opponentName: opponent.name,
                        gamesScore: meeting.games_score || "",
                        isWinner: meeting.winner_id !== null && meeting.winner_id !== undefined
                            && String(meeting.winner_id) === String(myId)
                    });
                });
            });
        });
    });

    return meetings
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);
}

function renderPlayerRecentMeetings(meetings) {
    const section = document.getElementById("playerRecentMeetingsSection");
    const list = document.getElementById("playerRecentMeetingsList");
    if (!section || !list) return;

    if (!meetings.length) {
        section.style.display = "none";
        return;
    }

    list.innerHTML = meetings.map((meeting) => {
        const resultClass = meeting.isWinner ? "is-win" : "is-loss";
        const resultLabel = meeting.isWinner ? tp("won", "Victoria") : tp("lost", "Derrota");
        const context = [meeting.round, meeting.tournament].filter(Boolean).join(" · ");

        return `
            <div class="player-match-row ${resultClass}">
                <span class="player-match-round">${formatMatchDate(meeting.date, "")}</span>
                <span class="player-match-opponent">${tp("vs", "vs")} ${meeting.opponentName}${context ? `<br><small>${context}</small>` : ""}</span>
                <span class="player-match-score">${meeting.gamesScore}</span>
                <span class="player-match-result">${resultLabel}</span>
            </div>
        `;
    }).join("");

    section.style.display = "";
}

function formatMatchDate(date, time) {
    if (!date) return "";
    const parsed = new Date(`${date}T${time || "00:00"}`);
    if (Number.isNaN(parsed.getTime())) return date;
    const datePart = parsed.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
    return time ? `${datePart} · ${time}` : datePart;
}

function tp(key, fallback) {
    return (typeof t === "function" ? t(`psaPlayer.${key}`) : "") || fallback;
}

function renderPlayerMatches(matches) {
    const section = document.getElementById("playerMatchesSection");
    const list = document.getElementById("playerMatchList");
    if (!section || !list) return;

    if (!matches.length) {
        section.style.display = "none";
        return;
    }

    const completedStatuses = new Set(["completed", "retired", "walkover"]);

    list.innerHTML = matches.map((match) => {
        const isDone = completedStatuses.has(match.status);
        const resultClass = !isDone ? "is-pending" : (match.isWinner ? "is-win" : "is-loss");
        const resultLabel = !isDone
            ? tp("upcoming", "Próximo")
            : (match.isWinner ? tp("won", "Victoria") : tp("lost", "Derrota"));
        const scoreOrDate = isDone ? (match.scoreline || "") : formatMatchDate(match.date, match.time);

        return `
            <div class="player-match-row ${resultClass}">
                <span class="player-match-round">${match.round}</span>
                <span class="player-match-opponent">${tp("vs", "vs")} ${match.opponentName}</span>
                <span class="player-match-score">${scoreOrDate}</span>
                <span class="player-match-result">${resultLabel}</span>
            </div>
        `;
    }).join("");

    section.style.display = "";
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
        if (src) {
            imageEl.onerror = () => { imageEl.onerror = null; imageEl.src = PLAYER_SILHOUETTE_SRC; };
            imageEl.src = src;
        }
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

    // Edad/altura/mano/historial: solo si tenemos datos reales de PSA para este jugador en el torneo actual.
    const snapshot = await fetchLiveTournamentSnapshot();
    const divisions = Array.isArray(snapshot?.divisions) ? snapshot.divisions : [];

    const liveDetails = findLivePlayerDetails(divisions, playerName);
    setRowVisible("player-age-row", "player-age", liveDetails?.age || "");
    setRowVisible("player-height-row", "player-height", liveDetails?.height_cm ? `${Math.round(Number(liveDetails.height_cm))} cm` : "");
    const handKey = liveDetails?.player_hand?.toLowerCase() === "left" ? "handLeft" : liveDetails?.player_hand ? "handRight" : "";
    const handLabel = handKey ? tp(handKey, handKey === "handLeft" ? "Izquierda" : "Derecha") : "";
    setRowVisible("player-hand-row", "player-hand", handLabel);

    renderPlayerMatches(getPlayerMatches(divisions, playerName));
    renderPlayerRecentMeetings(getPlayerRecentMeetings(divisions, playerName));
}

document.addEventListener("DOMContentLoaded", renderPlayerPage);
