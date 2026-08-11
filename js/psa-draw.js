(function () {
    "use strict";

    /**
     * Cuadro del torneo — siempre en vivo desde la API oficial de PSA (vía el
     * proxy de Supabase Edge Functions), nunca datos escritos a mano. Si un
     * jugador tiene foto propia subida en el panel admin (playersCollection),
     * se usa esa; si no, se usa la foto oficial de PSA; si tampoco hay, una
     * silueta genérica.
     */

    function getProxyUrl() {
        const config = window.PSA_CONFIG || {};
        const baseUrl = config.supabaseUrl || "https://texjzaanugmssmolzwgb.supabase.co";
        return `${baseUrl}/functions/v1/psa-proxy`;
    }

    function getTournamentId() {
        return (localStorage.getItem("psaTournamentId") || window.PSA_CONFIG?.psaTournamentId || "12711").trim();
    }

    const RED_SILHOUETTE_SVG = `
        <svg class="psa-player-mugshot psa-red-silhouette" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="psaRedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#FF5252"/>
                    <stop offset="100%" stop-color="#B71C1C"/>
                </linearGradient>
            </defs>
            <circle cx="18" cy="18" r="18" fill="url(#psaRedGrad)"/>
            <circle cx="18" cy="13" r="5.5" fill="#FFFFFF" opacity="0.95"/>
            <path d="M 9 29 C 9 22, 12 20, 18 20 C 24 20, 27 22, 27 29 Z" fill="#FFFFFF" opacity="0.95"/>
        </svg>
    `;

    function normalizeName(name) {
        return String(name || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, " ")
            .trim();
    }

    /** Fotos que el admin ha subido a mano (panel Jugadores), para usarlas por encima de la foto oficial de PSA. */
    function getCuratedPhotoMap() {
        const map = new Map();
        try {
            const raw = localStorage.getItem("playersCollection");
            const list = raw ? JSON.parse(raw) : [];
            (Array.isArray(list) ? list : []).forEach((player) => {
                if (player?.name && player?.image) {
                    map.set(normalizeName(player.name), player.image);
                }
            });
        } catch (error) {
            // Sin colección local todavía: seguimos solo con las fotos de PSA.
        }
        return map;
    }

    function buildPlayerLookup(rawPlayers) {
        const byId = new Map();
        (Array.isArray(rawPlayers) ? rawPlayers : []).forEach((player) => {
            if (player?.id !== undefined && player?.id !== null) {
                byId.set(String(player.id), player);
            }
        });
        return byId;
    }

    /** Convierte un jugador de partido (id/nombre) + su ficha completa en el objeto que pinta renderPlayerRow. */
    function toDisplayPlayer(matchPlayer, playerById, curatedMap) {
        if (!matchPlayer) return null;

        const full = matchPlayer.id !== undefined ? playerById.get(String(matchPlayer.id)) : null;
        const name = matchPlayer.name || full?.name || "";
        const country = full?.country || "";
        const ranking = full?.current_world_ranking ? `#${String(full.current_world_ranking).padStart(3, "0")}` : "";
        const seedNumber = full?.entry?.seed_number;
        const seed = seedNumber ? `(${seedNumber})` : (full?.entry?.is_wildcard ? "WC" : "");
        const curatedPhoto = curatedMap.get(normalizeName(name));
        const mugshot = curatedPhoto || full?.profile_photo_url || "";
        const id = matchPlayer.id ?? full?.id ?? null;
        const gamesWon = matchPlayer.games_won ?? null;

        return { id, name, country, ranking, seed, mugshot, gamesWon };
    }

    function formatMatchDateTime(match) {
        if (!match?.date) return "Fecha por confirmar";
        const parsed = new Date(`${match.date}T${match.time || "00:00"}`);
        if (Number.isNaN(parsed.getTime())) return match.date;
        const datePart = parsed.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
        return match.time ? `${datePart} • ${match.time}` : datePart;
    }

    function renderPlayerRow(player, isWinner) {
        const isPlaceholder = !player || !player.mugshot || player.name === "BYE" || player.name === "TBD" ||
            /^(Ganador|Guanyador|Winner|Vainqueur|Semifinalist|Semifinalista)/i.test(player.name || "");

        if (!player || player.name === "BYE") {
            return `
                <div class="psa-player-row">
                    ${RED_SILHOUETTE_SVG}
                    <span class="psa-player-name-box psa-bye-label">BYE</span>
                </div>
            `;
        }

        const seedHtml = player.seed ? `<span class="psa-seed-tag">${player.seed}</span>` : "";
        const flagUrl = player.country ? `assets/images/flags/${player.country}.svg` : "";
        const flagHtml = player.country ? `<img class="psa-player-flag" src="${flagUrl}" alt="${player.country}" onerror="this.style.display='none'">` : "";

        // Se pinta la foto y, debajo escondida, la silueta genérica; si la foto falla al cargar
        // (algo habitual con las fotos oficiales de PSA para jugadores sin ficha completa),
        // el onerror simplemente intercambia cuál de las dos se ve.
        const avatarHtml = isPlaceholder
            ? RED_SILHOUETTE_SVG
            : `<span class="psa-mugshot-wrap">
                    <img class="psa-player-mugshot" src="${player.mugshot}" alt="${player.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='';">
                    <span class="psa-mugshot-fallback" style="display:none;">${RED_SILHOUETTE_SVG}</span>
               </span>`;

        // Resultado real de PSA (games ganados, p.ej. "3"): solo aparece si el partido ya tiene
        // marcador (partidos por jugar no llevan esta celda). El ganador se resalta en verde,
        // igual que ya preveía el CSS de .psa-score-cell/.winner-score sin usarse hasta ahora.
        const scoreHtml = (player.gamesWon !== null && player.gamesWon !== undefined)
            ? `<div class="psa-scores-grid"><span class="psa-score-cell ${isWinner ? "winner-score" : ""}">${player.gamesWon}</span></div>`
            : "";

        return `
            <div class="psa-player-row ${isPlaceholder ? "is-placeholder-row" : ""} ${isWinner ? "is-winner" : ""}">
                ${avatarHtml}
                ${flagHtml}
                <span class="psa-player-name-box ${isPlaceholder ? "psa-placeholder-name" : ""}">
                    ${player.name} ${seedHtml}
                </span>
                ${scoreHtml}
            </div>
        `;
    }

    function renderMatchCard(match) {
        const isLive = match.status === "in_progress";
        const metaDate = match.dateTime || "Fecha por confirmar";
        const p1Name = match.player1?.name || "";
        const p2Name = match.player2?.name || "";
        const showH2H = p1Name && p1Name !== "BYE" && p1Name !== "TBD" && p2Name && p2Name !== "BYE" && p2Name !== "TBD";

        const p1Safe = p1Name.replace(/'/g, "\\'");
        const p2Safe = p2Name.replace(/'/g, "\\'");
        const matchId = match.id !== undefined && match.id !== null ? String(match.id) : "";
        const p1Id = match.player1?.id !== undefined && match.player1?.id !== null ? String(match.player1.id) : "";
        const p2Id = match.player2?.id !== undefined && match.player2?.id !== null ? String(match.player2.id) : "";

        const winnerId = match.winnerId !== undefined && match.winnerId !== null ? String(match.winnerId) : "";
        const p1IsWinner = !!winnerId && winnerId === p1Id;
        const p2IsWinner = !!winnerId && winnerId === p2Id;

        return `
            <div class="psa-match-item ${isLive ? "is-live" : ""}">
                ${renderPlayerRow(match.player1, p1IsWinner)}
                ${renderPlayerRow(match.player2, p2IsWinner)}
                <div class="psa-match-footer">
                    <span>${metaDate}</span>
                    ${showH2H
                        ? `<button class="psa-h2h-btn" onclick="openH2HModal('${p1Safe}', '${p2Safe}', '${matchId}', '${p1Id}', '${p2Id}')">Head-to-head</button>`
                        : ""}
                </div>
            </div>
        `;
    }

    function renderColumn(elementId, html, emptyMessage) {
        const el = document.getElementById(elementId);
        if (!el) return;
        el.innerHTML = html || `<p class="psa-empty-msg">${emptyMessage || "Por determinar"}</p>`;
    }

    /**
     * Traduce el número de partidos de cada columna usando js/language.js (si está cargado en
     * la página) para que cambie con el idioma en vez de quedar fijo en español.
     */
    function updateColumnCount(elementId, count) {
        const el = document.getElementById(elementId);
        if (!el) return;

        // translations/currentLanguage vienen de js/language.js (variables globales de script
        // clásico, no propiedades de window): si esa página no lo carga, usamos el español fijo.
        const psaDraw = typeof translations !== "undefined" && typeof currentLanguage !== "undefined"
            ? translations[currentLanguage]?.psaDraw
            : null;
        const singular = psaDraw?.matchSingular || "partido";
        const plural = psaDraw?.matchPlural || "partidos";
        el.textContent = `${count} ${count === 1 ? singular : plural}`;
    }

    /** Agrupa los partidos del cuadro por ronda a partir del nombre real que devuelve PSA. */
    function groupMatchesByRound(matches) {
        const groups = { round1: [], round2: [], quarter: [], semi: [], final: [] };

        (Array.isArray(matches) ? matches : []).forEach((match) => {
            const round = String(match.round || "").toLowerCase();
            if (/\bfinal\b/.test(round) && !round.includes("semi") && !round.includes("quarter")) {
                groups.final.push(match);
            } else if (round.includes("semi")) {
                groups.semi.push(match);
            } else if (round.includes("quarter")) {
                groups.quarter.push(match);
            } else if (round.includes("round 2") || match.round_num === 2) {
                groups.round2.push(match);
            } else {
                groups.round1.push(match);
            }
        });

        // PSA no devuelve los partidos en orden de posición dentro del cuadro (p.ej. junta
        // primero los partidos "normales" y luego los byes al final del array) — "match_num"
        // es el número de hueco real dentro de la ronda, así que ordenamos por él para que las
        // tarjetas salgan en su sitio correcto.
        Object.values(groups).forEach((list) => {
            list.sort((a, b) => (a.match_num ?? 0) - (b.match_num ?? 0));
        });

        return groups;
    }

    function renderStageColumn(elementId, matches, playerById, curatedMap) {
        if (!matches.length) {
            renderColumn(elementId, renderMatchCard({ dateTime: "Por determinar", player1: { name: "TBD" }, player2: { name: "TBD" } }));
            return;
        }

        const html = matches.map((match) => renderMatchCard({
            id: match.id,
            dateTime: formatMatchDateTime(match),
            status: match.status,
            winnerId: match.winner_id ?? null,
            player1: toDisplayPlayer(match.players?.[0], playerById, curatedMap) || { name: "TBD" },
            player2: toDisplayPlayer(match.players?.[1], playerById, curatedMap) || { name: "TBD" }
        })).join("");
        renderColumn(elementId, html);
    }

    // Nota: llamar directo a data.psasquashtour.com desde el navegador falla por CORS
    // (probado). Por eso todo pasa por el proxy de Supabase, que sí tiene cabeceras CORS
    // para este sitio. El proxy actualmente desplegado no reenvía el head-to-head aunque se
    // lo pidamos aquí — cuando se corrija/redeploye, esto empezará a traer datos reales sin
    // tocar el frontend.
    async function fetchLiveDraw() {
        const url = `${getProxyUrl()}?tournament=${encodeURIComponent(getTournamentId())}&expanded=true&include_divisions=true&show_past=true&head_to_head=true`;
        const response = await fetch(url, { headers: { Accept: "application/json" } });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.success === false) {
            throw new Error(payload?.error || `PSA respondió ${response.status}`);
        }
        return payload;
    }

    /** id de partido -> estadísticas head_to_head, cuando el proxy las incluya. */
    let headToHeadMap = new Map();

    /** id de jugador -> ficha completa (ranking, altura, DOB, ciudad, stats de carrera...),
     *  para poder pintar la comparativa del modal Head-to-head sin volver a pedir nada. */
    let currentPlayerById = new Map();

    function buildHeadToHeadMap(matches) {
        const map = new Map();
        (Array.isArray(matches) ? matches : []).forEach((match) => {
            if (match?.id !== undefined && match?.head_to_head) {
                map.set(String(match.id), match.head_to_head);
            }
        });
        return map;
    }

    function showLoadError() {
        document.querySelectorAll(".psa-live-indicator").forEach((el) => { el.style.display = "none"; });
        ["r1Matches", "r2Matches", "qfMatches", "sfMatches", "finalMatches"].forEach((id) => {
            renderColumn(id, "", "No se pudo cargar el cuadro en directo de PSA. Inténtalo de nuevo en unos minutos.");
        });
    }

    async function renderAllColumns() {
        // Modo manual explícito (torneo sin acceso a la API de PSA): no intentamos llamar a
        // nada, draw.html / index.html ya muestran el cuadro guardado a mano en ese caso.
        const mode = localStorage.getItem("tournamentContentMode") || "api";
        if (mode === "manual") return;

        let payload;
        try {
            payload = await fetchLiveDraw();
        } catch (error) {
            console.error("No se pudo cargar el cuadro en directo de PSA:", error);
            showLoadError();
            window.dispatchEvent(new CustomEvent("psa-draw-status", { detail: { ok: false } }));
            return;
        }

        const division = (Array.isArray(payload.divisions) ? payload.divisions : [])[0];
        if (!division) {
            showLoadError();
            window.dispatchEvent(new CustomEvent("psa-draw-status", { detail: { ok: false } }));
            return;
        }

        window.dispatchEvent(new CustomEvent("psa-draw-status", { detail: { ok: true } }));
        document.querySelectorAll(".psa-live-indicator").forEach((el) => { el.style.display = ""; });

        const playerById = buildPlayerLookup(division.players);
        currentPlayerById = playerById;
        const curatedMap = getCuratedPhotoMap();
        const matches = (Array.isArray(division.brackets) ? division.brackets : []).flatMap((bracket) => Array.isArray(bracket.matches) ? bracket.matches : []);
        headToHeadMap = buildHeadToHeadMap(matches);
        const groups = groupMatchesByRound(matches);

        // PSA marca los huecos de bye dentro de Round 1 con "bye": true (un partido de un solo
        // jugador, el cabeza de serie que pasa directo a Round 2), pero una baja de última hora
        // puede dejar un partido con un solo jugador SIN esa marca (el walkover aún no
        // formalizado por PSA) — por eso tratamos como hueco automático cualquier entrada de
        // Round 1 que no tenga dos jugadores, tenga o no el flag puesto. Ya no intercalamos "cada
        // 2 partidos" a ciegas: usamos match_num (posición real en el cuadro, ver
        // groupMatchesByRound) para que cada tarjeta salga en su hueco correcto.
        let round1Html = "";
        groups.round1.forEach((match) => {
            const players = match.players || [];
            if (players.length === 2) {
                round1Html += renderMatchCard({
                    id: match.id,
                    dateTime: formatMatchDateTime(match),
                    status: match.status,
                    winnerId: match.winner_id ?? null,
                    player1: toDisplayPlayer(players[0], playerById, curatedMap),
                    player2: toDisplayPlayer(players[1], playerById, curatedMap)
                });
            } else {
                const byePlayer = toDisplayPlayer(players[0], playerById, curatedMap) || { name: "TBD" };
                round1Html += renderMatchCard({ dateTime: "-", player1: byePlayer, player2: { name: "BYE" } });
            }
        });
        renderColumn("r1Matches", round1Html);
        updateColumnCount("r1Count", groups.round1.length);

        // El rival de Round 2 empieza como TBD (aún no ha terminado su partido de Round 1),
        // pero en cuanto PSA lo resuelve, match.players[1] ya viene relleno con el ganador —
        // por eso lo leemos de los datos reales en vez de fijarlo a "TBD".
        const round2Html = groups.round2.map((match) => renderMatchCard({
            id: match.id,
            dateTime: formatMatchDateTime(match),
            status: match.status,
            winnerId: match.winner_id ?? null,
            player1: toDisplayPlayer(match.players?.[0], playerById, curatedMap) || { name: "TBD" },
            player2: toDisplayPlayer(match.players?.[1], playerById, curatedMap) || { name: "TBD" }
        })).join("");
        renderColumn("r2Matches", round2Html);
        updateColumnCount("r2Count", groups.round2.length);

        renderStageColumn("qfMatches", groups.quarter, playerById, curatedMap);
        updateColumnCount("qfCount", groups.quarter.length);
        renderStageColumn("sfMatches", groups.semi, playerById, curatedMap);
        updateColumnCount("sfCount", groups.semi.length);
        renderStageColumn("finalMatches", groups.final, playerById, curatedMap);

        scheduleBracketConnectorsRedraw();
    }

    /**
     * Líneas conectoras entre rondas, dibujadas con SVG midiendo la posición REAL de cada
     * tarjeta ya renderizada — no con desplazamientos CSS fijos por ronda. Esos desplazamientos
     * fijos se desalineaban en cuartos/semifinales/final porque .psa-matches-list usa
     * justify-content:space-around, que reparte el espacio de forma distinta según cuántas
     * tarjetas tenga cada columna (16 en Round 1 frente a 1 sola en la Final); un mismo valor
     * en píxeles no puede cuadrar con todas las rondas a la vez. Midiendo con
     * getBoundingClientRect() en vez de calcularlo a ciegas, siempre queda alineado sea cual
     * sea el reparto real que haga el navegador.
     */
    function drawBracketConnectors() {
        const tree = document.querySelector(".psa-bracket-tree");
        if (!tree) return;

        let svg = tree.querySelector(":scope > svg.psa-connector-svg");
        if (!svg) {
            svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("class", "psa-connector-svg");
            tree.insertBefore(svg, tree.firstChild);
        }

        const treeRect = tree.getBoundingClientRect();
        if (!treeRect.width || !treeRect.height) return;

        svg.setAttribute("width", treeRect.width);
        svg.setAttribute("height", treeRect.height);
        svg.setAttribute("viewBox", `0 0 ${treeRect.width} ${treeRect.height}`);
        svg.innerHTML = "";

        const roundIds = ["r1Matches", "r2Matches", "qfMatches", "sfMatches", "finalMatches"];
        const columns = roundIds.map((id) => document.getElementById(id)).filter(Boolean);

        for (let c = 0; c < columns.length - 1; c++) {
            const sourceCards = Array.from(columns[c].querySelectorAll(".psa-match-item"));
            const targetCards = Array.from(columns[c + 1].querySelectorAll(".psa-match-item"));
            if (!sourceCards.length || !targetCards.length) continue;

            targetCards.forEach((targetCard, i) => {
                const a = sourceCards[i * 2];
                const b = sourceCards[i * 2 + 1];
                if (!a || !b) return;

                const aRect = a.getBoundingClientRect();
                const bRect = b.getBoundingClientRect();
                const targetRect = targetCard.getBoundingClientRect();

                const ay = aRect.top + aRect.height / 2 - treeRect.top;
                const by = bRect.top + bRect.height / 2 - treeRect.top;
                const ty = targetRect.top + targetRect.height / 2 - treeRect.top;
                const startX = aRect.right - treeRect.left;
                const endX = targetRect.left - treeRect.left;
                const midX = startX + (endX - startX) / 2;

                const bracket = document.createElementNS("http://www.w3.org/2000/svg", "path");
                bracket.setAttribute("class", "psa-connector-line");
                bracket.setAttribute("d", `M ${startX} ${ay} H ${midX} V ${by} H ${startX}`);
                svg.appendChild(bracket);

                const connector = document.createElementNS("http://www.w3.org/2000/svg", "path");
                connector.setAttribute("class", "psa-connector-line");
                connector.setAttribute("d", `M ${midX} ${(ay + by) / 2} L ${endX} ${ty}`);
                svg.appendChild(connector);
            });
        }
    }

    let connectorRedrawFrame = null;
    function scheduleBracketConnectorsRedraw() {
        if (connectorRedrawFrame) cancelAnimationFrame(connectorRedrawFrame);
        connectorRedrawFrame = requestAnimationFrame(() => {
            connectorRedrawFrame = null;
            drawBracketConnectors();
        });
    }

    let connectorResizeTimer = null;
    window.addEventListener("resize", () => {
        clearTimeout(connectorResizeTimer);
        connectorResizeTimer = setTimeout(scheduleBracketConnectorsRedraw, 150);
    });
    // Las fotos de jugador pueden llegar tarde y desplazar un poco la altura de la tarjeta;
    // redibuja una vez más cuando todo (imágenes incluidas) ha terminado de cargar.
    window.addEventListener("load", scheduleBracketConnectorsRedraw);

    function formatH2HDate(isoDate) {
        if (!isoDate) return "";
        const parsed = new Date(isoDate);
        if (Number.isNaN(parsed.getTime())) return isoDate;
        return parsed.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
    }

    function tdraw(key, fallback) {
        return (typeof t === "function" ? t(`psaDraw.${key}`) : "") || fallback;
    }

    /** Ficha bio/carrera real de un jugador (ranking, altura, fecha de nacimiento, ciudad,
     *  victorias y títulos de carrera) — todo tal cual lo da la API de PSA, sin inventar nada.
     *  El peso y el ranking "Road to Tour Finals" no están en nuestros datos (nuestra API key
     *  no tiene acceso al endpoint de rankings de PSA), así que esas dos filas no se muestran. */
    function buildH2HCompareRows(p1, p2) {
        const rows = [
            [tdraw("h2hRanking", "Ranking Mundial"), p1?.current_world_ranking ? `#${p1.current_world_ranking}` : "", p2?.current_world_ranking ? `#${p2.current_world_ranking}` : ""],
            [tdraw("h2hWins", "Victorias (carrera)"), p1?.stats?.matches_won ?? "", p2?.stats?.matches_won ?? ""],
            [tdraw("h2hTitles", "Títulos"), p1?.stats?.titles_count ?? "", p2?.stats?.titles_count ?? ""],
            [tdraw("h2hHeight", "Altura"), p1?.height_cm ? `${Math.round(Number(p1.height_cm))} cm` : "", p2?.height_cm ? `${Math.round(Number(p2.height_cm))} cm` : ""],
            [tdraw("h2hCity", "Ciudad"), p1?.city || "", p2?.city || ""],
            [tdraw("h2hDob", "Fecha de nacimiento"), p1?.date_of_birth ? formatH2HDate(p1.date_of_birth) : "", p2?.date_of_birth ? formatH2HDate(p2.date_of_birth) : ""],
        ];

        return rows
            .filter(([, v1, v2]) => v1 !== "" || v2 !== "")
            .map(([label, v1, v2]) => `
                <div class="psa-h2h-compare-row">
                    <span class="psa-h2h-compare-value">${v1 || "-"}</span>
                    <span class="psa-h2h-compare-label">${label}</span>
                    <span class="psa-h2h-compare-value">${v2 || "-"}</span>
                </div>
            `)
            .join("");
    }

    // Modal Head to Head — usa el histórico real que devuelve la API de PSA (fetchHeadToHeadMap)
    // más la ficha bio/carrera real de cada jugador (currentPlayerById). Si esta pareja de
    // jugadores no tiene enfrentamientos previos registrados (lo habitual: la mayoría son
    // primeros cruces) o algún dato bio no está disponible, se muestra ese estado honesto en
    // vez de inventar cifras.
    window.openH2HModal = function (p1Name, p2Name, matchId, p1Id, p2Id) {
        let modal = document.getElementById("h2hModal");
        if (!modal) {
            modal = document.createElement("div");
            modal.className = "psa-modal-overlay";
            modal.id = "h2hModal";
            modal.onclick = function (e) { if (e.target === modal) closeH2HModal(); };
            modal.innerHTML = `
                <div class="psa-modal-card">
                    <button class="psa-modal-close" onclick="closeH2HModal()">&times;</button>
                    <div class="psa-h2h-header">
                        <h3 style="color: var(--psa-green, #00E676); font-size: 1.1rem; text-transform: uppercase;">Head-to-head Stats</h3>
                        <p style="color: var(--psa-text-muted, #8E9BAE); font-size: 0.85rem; margin-top: 4px;">Histórico de enfrentamientos en el PSA World Tour</p>
                    </div>
                    <div class="psa-h2h-versus">
                        <div class="psa-h2h-player-box">
                            <div id="h2hP1Name" style="font-weight: 800; font-size: 0.95rem;">Jugador 1</div>
                        </div>
                        <div class="psa-h2h-vs-badge">VS</div>
                        <div class="psa-h2h-player-box">
                            <div id="h2hP2Name" style="font-weight: 800; font-size: 0.95rem;">Jugador 2</div>
                        </div>
                    </div>
                    <div class="psa-h2h-stat-row">
                        <span style="color: var(--psa-text-muted, #8E9BAE);">Enfrentamientos directos:</span>
                        <strong style="color: var(--psa-green, #00E676);" id="h2hStatMatches">0 - 0</strong>
                    </div>
                    <div class="psa-h2h-stat-row">
                        <span style="color: var(--psa-text-muted, #8E9BAE);">Último duelo:</span>
                        <strong id="h2hStatLast">Primer enfrentamiento oficial</strong>
                    </div>
                    <div id="h2hCompareSection" style="display:none;">
                        <div class="psa-h2h-compare-title">${tdraw("h2hCompareTitle", "Perfil de los jugadores")}</div>
                        <div id="h2hCompareStats"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        const el1 = document.getElementById("h2hP1Name");
        const el2 = document.getElementById("h2hP2Name");
        if (el1) el1.textContent = p1Name;
        if (el2) el2.textContent = p2Name;

        const matchesEl = document.getElementById("h2hStatMatches");
        const lastEl = document.getElementById("h2hStatLast");
        const h2h = matchId ? headToHeadMap.get(String(matchId)) : null;

        if (h2h && h2h.total_matches > 0) {
            if (matchesEl) matchesEl.textContent = `${h2h.player1_wins} - ${h2h.player2_wins}`;
            if (lastEl) {
                const lm = h2h.last_meeting;
                lastEl.textContent = lm
                    ? `${lm.tournament || "Torneo PSA"} · ${lm.round || ""} (${formatH2HDate(lm.date)})`
                    : `${h2h.total_matches} enfrentamiento(s) previo(s)`;
            }
        } else {
            if (matchesEl) matchesEl.textContent = "0 - 0";
            if (lastEl) lastEl.textContent = "Primer enfrentamiento oficial";
        }

        const p1Full = p1Id ? currentPlayerById.get(String(p1Id)) : null;
        const p2Full = p2Id ? currentPlayerById.get(String(p2Id)) : null;
        const compareSection = document.getElementById("h2hCompareSection");
        const compareStats = document.getElementById("h2hCompareStats");
        const compareHtml = buildH2HCompareRows(p1Full, p2Full);
        if (compareStats) compareStats.innerHTML = compareHtml;
        if (compareSection) compareSection.style.display = compareHtml ? "" : "none";

        modal.classList.add("active");
        window.PSAModalHistory?.pushModal(hideH2HModal);
    };

    function hideH2HModal() {
        const modal = document.getElementById("h2hModal");
        if (modal) modal.classList.remove("active");
    }

    // El botón atrás del móvil (o la X) cierran el modal en vez de salir de la web — ver
    // js/modal-history.js. Si por lo que sea ese script no está cargado, cae al cierre directo.
    window.closeH2HModal = function () {
        if (window.PSAModalHistory) window.PSAModalHistory.closeModal(hideH2HModal);
        else hideH2HModal();
    };

    document.addEventListener("DOMContentLoaded", renderAllColumns);
    document.addEventListener("app-language-changed", renderAllColumns);

    // Para cuando el cuadro se mueve de sitio en el DOM (p.ej. al modal de "Cuadro completo"
    // en index.html) — las líneas conectoras se miden por posición real en pantalla, así que
    // hay que recalcularlas después de cualquier cambio de tamaño/posición del propio cuadro.
    window.redrawPsaBracketConnectors = scheduleBracketConnectorsRedraw;
})();
