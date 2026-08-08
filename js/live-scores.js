(function () {
    const PSA_DIRECT_API_URL = "https://data.psasquashtour.com";
    const DEFAULT_API_KEY = (window.PSA_CONFIG?.psaApiKey || "854800fc3a4b365e531b39594fd3aed7eb2f42a573887d5f").trim();
    const STORAGE_KEY_API = "psaApiKey";
    const STORAGE_KEY_WEBHOOK = "psaWebhookUrl";

    function isInvalidPlayer(name) {
        if (!name) return true;
        const clean = String(name).trim().toLowerCase();
        if (!clean) return true;
        if (clean === "tbd" || clean === "bye" || clean === "stb" || clean === "tba" || clean === "pending") return true;
        if (clean.startsWith("tbd") || clean.startsWith("bye") || clean.startsWith("tba") || clean.startsWith("pending")) return true;
        if (clean.includes("tbd") || clean.includes("bye")) return true;
        return false;
    }

    // Official Round 1 matches for PSA Valencia Open 2026
    const MOCK_MATCHES = [
        {
            id: "12711_01",
            round: "MENS ROUND 1",
            court: "",
            dateTime: "11 AUG, 12:00",
            status: "scheduled",
            player1: { name: "Sergio Garcia Pollan", country: "ESP", seed: "WC", score: null },
            player2: { name: "Brice Nicolas", country: "FRA", seed: "", score: null },
            scores: []
        },
        {
            id: "12711_02",
            round: "MENS ROUND 1",
            court: "",
            dateTime: "11 AUG, 12:45",
            status: "scheduled",
            player1: { name: "Daniel Poleshchuk", country: "ISR", seed: "", score: null },
            player2: { name: "Yusuf Sheikh", country: "ENG", seed: "", score: null },
            scores: []
        },
        {
            id: "12711_03",
            round: "MENS ROUND 1",
            court: "",
            dateTime: "11 AUG, 17:00",
            status: "scheduled",
            player1: { name: "Khaled Labib", country: "EGY", seed: "", score: null },
            player2: { name: "Muhammad Asim Khan", country: "PAK", seed: "", score: null },
            scores: []
        },
        {
            id: "12711_04",
            round: "MENS ROUND 1",
            court: "",
            dateTime: "11 AUG, 17:45",
            status: "scheduled",
            player1: { name: "Marwan Tamer", country: "EGY", seed: "", score: null },
            player2: { name: "Aqeel Rehman", country: "AUT", seed: "", score: null },
            scores: []
        },
        {
            id: "12711_05",
            round: "MENS ROUND 1",
            court: "",
            dateTime: "11 AUG, 18:30",
            status: "scheduled",
            player1: { name: "Omar Said", country: "EGY", seed: "", score: null },
            player2: { name: "Hamza Khan", country: "PAK", seed: "", score: null },
            scores: []
        },
        {
            id: "12711_06",
            round: "MENS ROUND 1",
            court: "",
            dateTime: "11 AUG, 19:15",
            status: "scheduled",
            player1: { name: "Ernesto Revert", country: "ESP", seed: "WC", score: null },
            player2: { name: "Yannik Omlor", country: "GER", seed: "", score: null },
            scores: []
        },
        {
            id: "12711_07",
            round: "MENS ROUND 1",
            court: "",
            dateTime: "11 AUG, 13:30",
            status: "scheduled",
            player1: { name: "Will Salter", country: "ENG", seed: "", score: null },
            player2: { name: "Rhys Evans", country: "WAL", seed: "", score: null },
            scores: []
        },
        {
            id: "12711_08",
            round: "MENS ROUND 1",
            court: "",
            dateTime: "11 AUG, 14:15",
            status: "scheduled",
            player1: { name: "Joseph White", country: "AUS", seed: "", score: null },
            player2: { name: "Marek Panacek", country: "CZE", seed: "", score: null },
            scores: []
        }
    ];

    let matchesData = [...MOCK_MATCHES];

    async function fetchRealPsaMatches() {
        const apiKey = getApiKey();
        const proxyUrl = getProxyUrl();
        const tournamentId = (localStorage.getItem("psaTournamentId") || window.PSA_CONFIG?.psaTournamentId || "12711").trim();

        try {
            let url = `${proxyUrl}?tournament=${encodeURIComponent(tournamentId)}&expanded=true`;
            let res = await fetch(url).catch(() => null);

            let data = null;
            if (res && res.ok) {
                data = await res.json().catch(() => null);
            }

            if (!data?.divisions || data?.divisions?.length === 0) {
                const directUrl = `${PSA_DIRECT_API_URL}/api/v1/tournaments/${encodeURIComponent(tournamentId)}/expanded`;
                const directRes = await fetch(directUrl, {
                    headers: { "X-Api-Key": apiKey, "Accept": "application/json" }
                }).catch(() => null);

                if (directRes && directRes.ok) {
                    data = await directRes.json().catch(() => null);
                }
            }

            const rawDivisions = data?.divisions || data?.psa?.divisions || [];
            const realMatches = [];
            const seenMatchKeys = new Set();

            rawDivisions.forEach((div) => {
                const brackets = div.brackets || [];
                brackets.forEach((br) => {
                    const matches = br.matches || [];
                    matches.forEach((m, idx) => {
                        // Skip BYEs or matches flagged as bye
                        if (m.bye) return;

                        const playersList = m.players || m.match_players || [];

                        // A valid match MUST have at least 2 players
                        if (playersList.length < 2) return;

                        const p1Name = playersList[0]?.name || "";
                        const p2Name = playersList[1]?.name || "";

                        // Filter out matches with TBD / BYE / empty players
                        if (isInvalidPlayer(p1Name) || isInvalidPlayer(p2Name)) {
                            return;
                        }

                        const matchId = String(m.id || `real_${idx}`);
                        const playersKey = [p1Name.toLowerCase().trim(), p2Name.toLowerCase().trim()].sort().join(" vs ");
                        if (seenMatchKeys.has(matchId) || seenMatchKeys.has(playersKey)) {
                            return;
                        }
                        seenMatchKeys.add(matchId);
                        seenMatchKeys.add(playersKey);

                        const p1Country = playersList[0]?.country || "";
                        const p2Country = playersList[1]?.country || "";

                        const gameScores = Array.isArray(m.games)
                            ? m.games.map((g) => {
                                const s1 = g.scores?.[0] ?? g.p1;
                                const s2 = g.scores?.[1] ?? g.p2;
                                return (s1 !== undefined && s2 !== undefined) ? `${s1}-${s2}` : "";
                            }).filter(Boolean)
                            : [];

                        let courtName = "";

                        let dateStr = "11 AUG";
                        if (m.date) {
                            dateStr = m.date;
                        }
                        const dateTimeStr = m.time ? `${dateStr}, ${m.time}` : dateStr;

                        realMatches.push({
                            id: matchId,
                            round: (m.round || "ROUND 1").toUpperCase(),
                            court: courtName,
                            dateTime: dateTimeStr,
                            status: m.status || "scheduled",
                            player1: { name: p1Name, country: p1Country, seed: "", score: (m.status === "scheduled" ? null : (playersList[0]?.games_won ?? null)) },
                            player2: { name: p2Name, country: p2Country, seed: "", score: (m.status === "scheduled" ? null : (playersList[1]?.games_won ?? null)) },
                            scores: gameScores
                        });
                    });
                });
            });

            if (realMatches.length > 0) {
                matchesData = realMatches;
                renderMatches("all");
            }
        } catch (err) {
            console.warn("Error cargando partidos en tiempo real de PSA API:", err);
        }
    }

    function $(id) {
        return document.getElementById(id);
    }

    function showStatus(msg, isError = false) {
        const box = $("lsStatusBox");
        if (!box) return;
        box.textContent = msg;
        box.className = "ls-status-box active" + (isError ? " error" : "");
    }

    function getApiKey() {
        const input = $("lsApiKeyInput");
        return (input?.value || localStorage.getItem(STORAGE_KEY_API) || DEFAULT_API_KEY).trim();
    }

    function getWebhookUrl() {
        const input = $("lsWebhookUrlInput");
        return (input?.value || localStorage.getItem(STORAGE_KEY_WEBHOOK) || "https://tu-dominio.com/webhooks/psa-live-scores").trim();
    }

    function getProxyUrl() {
        const config = window.PSA_CONFIG || {};
        const baseUrl = config.supabaseUrl || config.SUPABASE_URL || "https://texjzaanugmssmolzwgb.supabase.co";
        return `${baseUrl}/functions/v1/psa-proxy`;
    }

    // 1. Subscribe API
    async function requestSubscription() {
        const apiKey = getApiKey();
        const endpointUrl = getWebhookUrl();

        if (!apiKey) {
            showStatus("❌ Error: Introduce tu API Key de PSA para realizar la suscripción.", true);
            return;
        }

        if (!endpointUrl || !endpointUrl.startsWith("https://")) {
            showStatus("⚠️ La URL del Webhook debe comenzar por HTTPS.", true);
            return;
        }

        showStatus("⏳ Enviando solicitud de suscripción a POST /api/v1/matches/subscribe ...");

        try {
            const response = await fetch(`${PSA_DIRECT_API_URL}/api/v1/matches/subscribe`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Api-Key": apiKey
                },
                body: JSON.stringify({
                    endpoint_url: endpointUrl,
                    api_key: apiKey,
                    api_key_header_name: "x-api-key"
                })
            }).catch(async () => {
                return await fetch(`${getProxyUrl()}?action=subscribe`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        apiKey: apiKey,
                        endpoint_url: endpointUrl
                    })
                });
            });

            const data = await response.json().catch(() => ({}));
            showStatus("✅ Respuesta de Suscripción PSA:\n" + JSON.stringify(data, null, 2));
        } catch (err) {
            showStatus("❌ Error en la comunicación con la API de PSA: " + err.message, true);
        }
    }

    // 2. Check Subscription Status
    async function checkSubscriptionStatus() {
        const apiKey = getApiKey();
        showStatus("⏳ Consultando GET /api/v1/matches/subscription ...");

        try {
            const response = await fetch(`${PSA_DIRECT_API_URL}/api/v1/matches/subscription`, {
                method: "GET",
                headers: {
                    "X-Api-Key": apiKey
                }
            }).catch(async () => {
                return await fetch(`${getProxyUrl()}?action=subscription-status&apiKey=${apiKey}`);
            });

            const data = await response.json().catch(() => ({}));
            showStatus("ℹ️ Estado actual de la suscripción:\n" + JSON.stringify(data, null, 2));
        } catch (err) {
            showStatus("❌ Error consultando el estado: " + err.message, true);
        }
    }

    // 3. Cancel Subscription
    async function cancelSubscription() {
        const apiKey = getApiKey();
        showStatus("⏳ Solicitando DELETE /api/v1/matches/subscription ...");

        try {
            const response = await fetch(`${PSA_DIRECT_API_URL}/api/v1/matches/subscription`, {
                method: "DELETE",
                headers: {
                    "X-Api-Key": apiKey
                }
            }).catch(async () => {
                return await fetch(`${getProxyUrl()}?action=unsubscribe&apiKey=${apiKey}`, { method: "DELETE" });
            });

            const data = await response.json().catch(() => ({}));
            showStatus("🗑️ Respuesta de cancelación:\n" + JSON.stringify(data, null, 2));
        } catch (err) {
            showStatus("❌ Error al cancelar suscripción: " + err.message, true);
        }
    }

    // Helper to resolve player country accurately
    function resolvePlayerCountry(name, countryCode) {
        const cleanName = String(name || "").trim();
        if (isInvalidPlayer(cleanName)) {
            return "";
        }

        const code = String(countryCode || "").trim().toUpperCase();
        if (code && code.length >= 2 && code.length <= 3 && code !== "ESP") {
            return code;
        }

        try {
            const rawCollection = localStorage.getItem("playersCollection");
            const players = rawCollection ? JSON.parse(rawCollection) : [];
            const match = players.find(p => p.name && p.name.toLowerCase() === cleanName.toLowerCase());
            if (match && match.country) {
                return match.country.toUpperCase();
            }
        } catch (_err) {}

        const PLAYER_COUNTRY_MAP = {
            "muhammad ashab irfan": "PAK",
            "m. ashab irfan": "PAK",
            "patrick rooney": "ENG",
            "p. rooney": "ENG",
            "samuel osborne-wylde": "ENG",
            "s. osborne-wylde": "ENG",
            "ivan perez": "ESP",
            "i. perez": "ESP",
            "balazs farkas": "HUN",
            "b. farkas": "HUN",
            "simon herbert": "ENG",
            "s. herbert": "ENG",
            "abdulla al-tamimi": "QAT",
            "a. al-tamimi": "QAT",
            "mohamed nasser": "EGY",
            "m. nasser": "EGY",
            "yassin elshafei": "EGY",
            "y. elshafei": "EGY",
            "muhammad asim khan": "PAK",
            "m. asim khan": "PAK",
            "joseph white": "AUS",
            "j. white": "AUS",
            "rhys evans": "WAL",
            "r. evans": "WAL",
            "omar said": "EGY",
            "o. said": "EGY",
            "daniel poleshchuk": "ISR",
            "d. poleshchuk": "ISR",
            "yannik omlor": "GER",
            "y. omlor": "GER",
            "marwan tamer": "EGY",
            "m. tamer": "EGY",
            "brice nicolas": "FRA",
            "b. nicolas": "FRA",
            "aly tolba": "EGY",
            "a. tolba": "EGY",
            "will salter": "ENG",
            "w. salter": "ENG",
            "hamza khan": "PAK",
            "h. khan": "PAK",
            "khaled labib": "EGY",
            "k. labib": "EGY",
            "marek panacek": "CZE",
            "m. panacek": "CZE",
            "sergio garcia pollan": "ESP",
            "s. garcia pollan": "ESP",
            "ernesto revert": "ESP",
            "e. revert": "ESP"
        };

        const mapped = PLAYER_COUNTRY_MAP[cleanName.toLowerCase()];
        if (mapped) return mapped;

        return code || "ESP";
    }

    // Render matches UI
    function renderMatches(filter = "all") {
        const container = $("lsMatchesContainer");
        if (!container) return;

        const filtered = matchesData.filter((match) => {
            if (isInvalidPlayer(match.player1?.name) || isInvalidPlayer(match.player2?.name)) {
                return false;
            }
            if (filter === "all") return true;
            return match.status === filter;
        });

        if (filtered.length === 0) {
            container.innerHTML = `<p style="text-align: center; color: var(--ls-muted); padding: 32px; font-size: 1.05rem;">No hay partidos en esta categoría.</p>`;
            return;
        }

        container.innerHTML = filtered.map((match) => {
            const p1Country = resolvePlayerCountry(match.player1.name, match.player1.country);
            const p2Country = resolvePlayerCountry(match.player2.name, match.player2.country);

            const p1FlagHtml = p1Country
                ? `<img class="ls-player-flag" src="assets/images/flags/${p1Country}.svg" alt="${p1Country}" onerror="this.style.display='none'">`
                : `<span style="display:inline-block; width:38px; height:25px;"></span>`;

            const p2FlagHtml = p2Country
                ? `<img class="ls-player-flag" src="assets/images/flags/${p2Country}.svg" alt="${p2Country}" onerror="this.style.display='none'">`
                : `<span style="display:inline-block; width:38px; height:25px;"></span>`;

            const statusClass = `ls-status-${match.status}`;
            const statusLabel = match.status === "in_progress"
                ? "● EN JUEGO LIVE"
                : match.status === "completed"
                ? "✓ FINALIZADO"
                : "PROGRAMADO";

            const p1Score = (match.player1.score !== null && match.player1.score !== undefined) ? match.player1.score : null;
            const p2Score = (match.player2.score !== null && match.player2.score !== undefined) ? match.player2.score : null;

            const p1Winner = match.status === "completed" && p1Score !== null && p2Score !== null && p1Score > p2Score;
            const p2Winner = match.status === "completed" && p1Score !== null && p2Score !== null && p2Score > p1Score;

            let scoreBadgeHtml = `<div class="ls-vs-badge">VS</div>`;
            if (match.status !== "scheduled" && p1Score !== null && p2Score !== null) {
                const liveClass = match.status === "in_progress" ? "is-live-score" : "is-final-score";
                scoreBadgeHtml = `<div class="ls-vs-badge ${liveClass}"><span class="${p1Winner ? 'winner-num' : ''}">${p1Score}</span> - <span class="${p2Winner ? 'winner-num' : ''}">${p2Score}</span></div>`;
            }

            const scoresMarkup = match.scores && match.scores.length
                ? match.scores.map((sc) => {
                    const isLiveSet = sc.includes("(LIVE)") || sc.includes("(jugando)");
                    const cleanSc = sc.replace("(LIVE)", "").replace("(jugando)", "").trim();
                    return `<span class="ls-score-pill ${isLiveSet ? 'is-live-pill' : ''}">${cleanSc}${isLiveSet ? ' <span class="live-dot">●</span>' : ''}</span>`;
                }).join("")
                : `<span style="color: var(--ls-muted); font-size: 0.85rem; font-style: italic;">Sin juegos iniciados</span>`;

            const courtHtml = match.court
                ? `<span class="ls-match-court">· ${match.court}</span>`
                : "";

            return `
                <div class="ls-match-card-wrapper">
                    <div class="ls-match-header-pill">
                        <div class="ls-match-header-info">
                            <span class="ls-match-round">${match.round}</span>
                            ${courtHtml}
                        </div>
                        <span class="ls-match-datetime">${match.dateTime}</span>
                    </div>
                    <div class="ls-match-card ${match.status === 'in_progress' ? 'card-live' : ''}">
                        <div class="ls-player left ${p1Winner ? 'is-winner' : ''}">
                            ${p1FlagHtml}
                            <span class="ls-player-name">
                                ${match.player1.name}
                                ${match.player1.seed ? `<span class="ls-player-seed">${match.player1.seed}</span>` : ""}
                                ${p1Winner ? `<span class="ls-winner-badge" title="Ganador">✓</span>` : ""}
                            </span>
                        </div>

                        ${scoreBadgeHtml}

                        <div class="ls-player right ${p2Winner ? 'is-winner' : ''}">
                            <span class="ls-player-name">
                                ${p2Winner ? `<span class="ls-winner-badge" title="Ganador">✓</span>` : ""}
                                ${match.player2.name}
                                ${match.player2.seed ? `<span class="ls-player-seed">${match.player2.seed}</span>` : ""}
                            </span>
                            ${p2FlagHtml}
                        </div>

                        <div class="ls-live-details">
                            <div class="ls-scores-summary">
                                <span class="ls-sets-label">PARCIALES:</span>
                                ${scoresMarkup}
                            </div>
                            <span class="ls-status-badge ${statusClass}">${statusLabel}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    }

    // Live Digital Clock
    function updateClock() {
        const el = $("lsDigitalClock");
        if (!el) return;
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, "0");
        const mins = String(now.getMinutes()).padStart(2, "0");
        el.textContent = `${hours}:${mins}`;
    }

    document.addEventListener("DOMContentLoaded", () => {
        const apiInput = $("lsApiKeyInput");
        const webhookInput = $("lsWebhookUrlInput");

        if (apiInput) apiInput.value = localStorage.getItem(STORAGE_KEY_API) || DEFAULT_API_KEY;
        if (webhookInput) webhookInput.value = localStorage.getItem(STORAGE_KEY_WEBHOOK) || "https://tu-dominio.com/webhooks/psa-live-scores";

        if (apiInput) {
            apiInput.addEventListener("change", () => localStorage.setItem(STORAGE_KEY_API, apiInput.value.trim()));
        }
        if (webhookInput) {
            webhookInput.addEventListener("change", () => localStorage.setItem(STORAGE_KEY_WEBHOOK, webhookInput.value.trim()));
        }

        const subscribeBtn = $("lsSubscribeBtn");
        const checkBtn = $("lsCheckBtn");
        const cancelBtn = $("lsCancelBtn");

        if (subscribeBtn) subscribeBtn.addEventListener("click", requestSubscription);
        if (checkBtn) checkBtn.addEventListener("click", checkSubscriptionStatus);
        if (cancelBtn) cancelBtn.addEventListener("click", cancelSubscription);

        document.querySelectorAll(".ls-tab-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
                document.querySelectorAll(".ls-tab-btn").forEach((b) => b.classList.remove("active"));
                btn.classList.add("active");
                renderMatches(btn.getAttribute("data-filter"));
            });
        });

        updateClock();
        setInterval(updateClock, 1000);

        renderMatches("all");
        fetchRealPsaMatches();
    });
})();

