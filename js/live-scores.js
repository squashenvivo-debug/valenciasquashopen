(function () {
    const PSA_DIRECT_API_URL = "https://data.psasquashtour.com";
    const DEFAULT_API_KEY = (window.PSA_CONFIG?.psaApiKey || "854800fc3a4b365e531b39594fd3aed7eb2f42a573887d5f").trim();
    const STORAGE_KEY_API = "psaApiKey";
    const STORAGE_KEY_WEBHOOK = "psaWebhookUrl";

    // Initial Matches for PSA Valencia Open 2026 - Memorial Chimo Marmaneu (ID: 12711)
    const MOCK_MATCHES = [
        {
            id: 12711_01,
            round: "MENS ROUND 1",
            court: "PISTA CENTRAL - OLYMPIA",
            dateTime: "11 AUG, 11:00",
            status: "scheduled",
            player1: { name: "Muhammad Ashab Irfan", country: "PAK", seed: "[1]", score: null },
            player2: { name: "Marwan Tamer", country: "EGY", seed: "", score: null },
            scores: []
        },
        {
            id: 12711_02,
            round: "MENS ROUND 1",
            court: "PISTA 2 - OLYMPIA",
            dateTime: "11 AUG, 11:45",
            status: "scheduled",
            player1: { name: "Balazs Farkas", country: "HUN", seed: "[5]", score: null },
            player2: { name: "Brice Nicolas", country: "FRA", seed: "", score: null },
            scores: []
        },
        {
            id: 12711_03,
            round: "MENS ROUND 1",
            court: "PISTA CENTRAL - OLYMPIA",
            dateTime: "11 AUG, 12:30",
            status: "in_progress",
            player1: { name: "Ivan Perez", country: "ESP", seed: "[4]", score: 1 },
            player2: { name: "Will Salter", country: "ENG", seed: "", score: 2 },
            scores: ["11-9", "8-11", "9-11", "12-10 (jugando)"]
        },
        {
            id: 12711_04,
            round: "MENS ROUND 1",
            court: "PISTA CENTRAL - OLYMPIA",
            dateTime: "11 AUG, 18:30",
            status: "scheduled",
            player1: { name: "Sergio Garcia Pollan", country: "ESP", seed: "WC [2]", score: null },
            player2: { name: "Patrick Rooney", country: "ENG", seed: "[2]", score: null },
            scores: []
        },
        {
            id: 12711_05,
            round: "MENS ROUND 1",
            court: "PISTA CENTRAL - OLYMPIA",
            dateTime: "11 AUG, 19:15",
            status: "completed",
            player1: { name: "Ernesto Revert", country: "ESP", seed: "WC [1]", score: 3 },
            player2: { name: "Marek Panacek", country: "CZE", seed: "", score: 1 },
            scores: ["13-11", "8-11", "11-7", "11-9"]
        }
    ];

    let matchesData = [...MOCK_MATCHES];

    async function fetchRealPsaMatches() {
        const apiKey = getApiKey();
        const proxyUrl = getProxyUrl();

        try {
            let url = `${proxyUrl}?tournament=12711&expanded=true`;
            let res = await fetch(url).catch(() => null);

            let data = null;
            if (res && res.ok) {
                data = await res.json().catch(() => null);
            }

            if (!data?.divisions || data?.divisions?.length === 0) {
                const directUrl = `${PSA_DIRECT_API_URL}/api/v1/tournaments/12711/expanded`;
                const directRes = await fetch(directUrl, {
                    headers: { "X-Api-Key": apiKey, "Accept": "application/json" }
                }).catch(() => null);

                if (directRes && directRes.ok) {
                    data = await directRes.json().catch(() => null);
                }
            }

            const rawDivisions = data?.divisions || data?.psa?.divisions || [];
            const realMatches = [];

            rawDivisions.forEach((div) => {
                const brackets = div.brackets || [];
                brackets.forEach((br) => {
                    const matches = br.matches || [];
                    matches.forEach((m, idx) => {
                        const p1Name = m.players?.[0]?.name || m.match_players?.[0]?.name || "TBD";
                        const p2Name = m.players?.[1]?.name || m.match_players?.[1]?.name || "TBD";
                        const p1Country = m.players?.[0]?.country || "ESP";
                        const p2Country = m.players?.[1]?.country || "ESP";

                        const gameScores = Array.isArray(m.games)
                            ? m.games.map((g) => {
                                const s1 = g.scores?.[0] ?? g.p1;
                                const s2 = g.scores?.[1] ?? g.p2;
                                return (s1 !== undefined && s2 !== undefined) ? `${s1}-${s2}` : "";
                            }).filter(Boolean)
                            : [];

                        realMatches.push({
                            id: m.id || `real_${idx}`,
                            round: (m.round || "ROUND 1").toUpperCase(),
                            court: m.court ? `COURT ${m.court}` : "PISTA CENTRAL",
                            dateTime: m.date ? `${m.date} ${m.time || ''}`.trim() : "11 AUG, 12:00",
                            status: m.status || "scheduled",
                            player1: { name: p1Name, country: p1Country, seed: "", score: m.players?.[0]?.games_won ?? null },
                            player2: { name: p2Name, country: p2Country, seed: "", score: m.players?.[1]?.games_won ?? null },
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
            // Try direct fetch or fallback to psa-proxy
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
                // If CORS blocks direct fetch, call proxy
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

    // Render matches UI
    function renderMatches(filter = "all") {
        const container = $("lsMatchesContainer");
        if (!container) return;

        const filtered = matchesData.filter((match) => {
            if (filter === "all") return true;
            return match.status === filter;
        });

        if (filtered.length === 0) {
            container.innerHTML = `<p style="text-align: center; color: var(--ls-muted); padding: 32px;">No hay partidos en esta categoría.</p>`;
            return;
        }

        container.innerHTML = filtered.map((match) => {
            const p1Flag = `assets/images/flags/${match.player1.country || "ENG"}.svg`;
            const p2Flag = `assets/images/flags/${match.player2.country || "ENG"}.svg`;

            const statusClass = `ls-status-${match.status}`;
            const statusLabel = match.status === "in_progress" ? "EN JUEGO LIVE" : match.status === "completed" ? "FINALIZADO" : "PROGRAMADO";

            const scoresMarkup = match.scores && match.scores.length
                ? match.scores.map((sc) => `<span class="ls-score-pill">${sc}</span>`).join("")
                : "";

            return `
                <div class="ls-match-card-wrapper">
                    <div class="ls-match-header-pill">
                        <div class="ls-match-header-info">
                            <span class="ls-match-round">${match.round}</span>
                            <span class="ls-match-court">${match.court}</span>
                        </div>
                        <span class="ls-match-datetime">${match.dateTime}</span>
                    </div>
                    <div class="ls-match-card">
                        <div class="ls-player left">
                            <img class="ls-player-flag" src="${p1Flag}" alt="${match.player1.country}" onerror="this.src='assets/images/flags/xx.svg'">
                            <span class="ls-player-name">
                                ${match.player1.name}
                                ${match.player1.seed ? `<span class="ls-player-seed">${match.player1.seed}</span>` : ""}
                            </span>
                        </div>

                        <div class="ls-vs-badge">V</div>

                        <div class="ls-player right">
                            <span class="ls-player-name">
                                ${match.player2.name}
                                ${match.player2.seed ? `<span class="ls-player-seed">${match.player2.seed}</span>` : ""}
                            </span>
                            <img class="ls-player-flag" src="${p2Flag}" alt="${match.player2.country}" onerror="this.src='assets/images/flags/xx.svg'">
                        </div>

                        <div class="ls-live-details">
                            <div class="ls-scores-summary">
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
        // Preset values
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

        // Action Buttons
        const subscribeBtn = $("lsSubscribeBtn");
        const checkBtn = $("lsCheckBtn");
        const cancelBtn = $("lsCancelBtn");

        if (subscribeBtn) subscribeBtn.addEventListener("click", requestSubscription);
        if (checkBtn) checkBtn.addEventListener("click", checkSubscriptionStatus);
        if (cancelBtn) cancelBtn.addEventListener("click", cancelSubscription);

        // Filter Tabs
        document.querySelectorAll(".ls-tab-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
                document.querySelectorAll(".ls-tab-btn").forEach((b) => b.classList.remove("active"));
                btn.classList.add("active");
                renderMatches(btn.getAttribute("data-filter"));
            });
        });

        // Clock
        updateClock();
        setInterval(updateClock, 1000);

        // Initial render & fetch from real PSA API
        renderMatches("all");
        fetchRealPsaMatches();
    });
})();
