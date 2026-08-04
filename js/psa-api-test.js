(function () {
    const DEFAULT_TOURNAMENT_ID = "12711";
    const PSA_TEST_SUPABASE_FALLBACK_URL = "https://texjzaanugmssmolzwgb.supabase.co";
    const STORAGE_KEY = "psaApiTestTournament";
    const PROXY_URL_STORAGE_KEY = "psaApiTestProxyUrl";
    const AUTO_REFRESH_MS = 60000;
    let selectedTournament = "";
    let refreshTimer = null;

    const state = {
        list: [],
        detail: null,
    };

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function $(id) {
        return document.getElementById(id);
    }

    function setStatus(message, isError) {
        const status = $("psaTestStatus");
        if (!status) return;
        status.textContent = message;
        status.classList.toggle("psa-error", Boolean(isError));
    }

    function getFunctionUrl() {
        const manualUrl = normalizeProxyUrl(localStorage.getItem(PROXY_URL_STORAGE_KEY) || "");
        if (manualUrl) return manualUrl;

        const config = window.PSA_CONFIG || {};
        const baseUrl = String(config.supabaseUrl || config.SUPABASE_URL || "").trim();
        const fallbackUrl = shouldUseSupabaseFallback() ? PSA_TEST_SUPABASE_FALLBACK_URL : "";
        const resolvedBaseUrl = baseUrl || fallbackUrl;
        if (!resolvedBaseUrl) {
            throw new Error("Falta SUPABASE_URL en config.js. Puedes pegar manualmente la URL desplegada de psa-proxy para probar en local.");
        }

        return new URL("/functions/v1/psa-proxy", resolvedBaseUrl).toString();
    }

    function shouldUseSupabaseFallback() {
        const host = String(window.location.hostname || "").toLowerCase();
        return host === "localhost" || host === "127.0.0.1" || host === "";
    }

    function readInitialProxyUrl() {
        const url = new URL(window.location.href);
        const fromUrl = normalizeProxyUrl(url.searchParams.get("proxyUrl") || "");
        if (fromUrl) return fromUrl;
        return normalizeProxyUrl(localStorage.getItem(PROXY_URL_STORAGE_KEY) || "");
    }

    function persistProxyUrl(value) {
        const clean = normalizeProxyUrl(value);
        if (clean) {
            localStorage.setItem(PROXY_URL_STORAGE_KEY, clean);
        } else {
            localStorage.removeItem(PROXY_URL_STORAGE_KEY);
        }

        const input = $("psaProxyUrlInput");
        if (input && input.value !== clean) {
            input.value = clean;
        }

        const url = new URL(window.location.href);
        if (clean) {
            url.searchParams.set("proxyUrl", clean);
        } else {
            url.searchParams.delete("proxyUrl");
        }
        window.history.replaceState({}, "", url);
    }

    async function fetchProxy(params) {
        const url = new URL(getFunctionUrl());
        Object.entries(params || {}).forEach(([key, value]) => {
            if (value === undefined || value === null || value === "") return;
            url.searchParams.set(key, String(value));
        });

        const response = await fetch(url.toString(), {
            headers: { "Accept": "application/json" },
        });

        const payload = await response.json().catch(() => ({}));
        if (response.status === 404) {
            throw new Error("La funcion psa-proxy todavia no esta desplegada en Supabase. Revisa supabase/functions/psa-proxy/DEPLOY.md.");
        }
        if (!response.ok || payload?.success === false) {
            throw new Error(payload?.error || `Error ${response.status} consultando psa-proxy.`);
        }

        return payload;
    }

    function updateUrl(tournament) {
        const url = new URL(window.location.href);
        if (tournament) {
            url.searchParams.set("tournament", tournament);
        } else {
            url.searchParams.delete("tournament");
        }
        window.history.replaceState({}, "", url);
    }

    function readInitialTournament() {
        const url = new URL(window.location.href);
        const fromUrl = String(url.searchParams.get("tournament") || "").trim();
        if (isValidTournamentValue(fromUrl)) return fromUrl;

        const fromStorage = String(localStorage.getItem(STORAGE_KEY) || "").trim();
        if (isValidTournamentValue(fromStorage)) return fromStorage;

        return DEFAULT_TOURNAMENT_ID;
    }

    function isValidTournamentValue(value) {
        const clean = String(value || "").trim();
        if (!clean) return false;

        if (/^[a-f0-9]{24,}$/i.test(clean)) return false;

        if (/^[0-9]+$/.test(clean)) return true;
        if (/^[a-z0-9]+(?:-[a-z0-9]+)+$/i.test(clean)) return true;

        return false;
    }

    function normalizeProxyUrl(value) {
        const clean = String(value || "").trim();
        if (!clean) return "";

        try {
            const parsed = new URL(clean);
            if (!/^https?:$/i.test(parsed.protocol)) return "";
            if (!/\/functions\/v1\/psa-proxy\/?$/i.test(parsed.pathname)) return "";
            return parsed.toString();
        } catch (error) {
            return "";
        }
    }

    function persistTournament(value) {
        const raw = String(value || "").trim();
        const clean = isValidTournamentValue(raw) ? raw : DEFAULT_TOURNAMENT_ID;
        selectedTournament = clean;
        if (clean) {
            localStorage.setItem(STORAGE_KEY, clean);
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
        updateUrl(clean);
        const input = $("psaTournamentInput");
        if (input && input.value !== clean) {
            input.value = clean;
        }
    }

    function formatDateRange(dates) {
        if (!dates) return "Sin fechas";
        const start = dates.start || dates.start_date || "";
        const end = dates.end || dates.end_date || "";
        if (start && end) return `${start} - ${end}`;
        return start || end || "Sin fechas";
    }

    function renderTournamentList(list) {
        state.list = Array.isArray(list) ? list : [];
        const host = $("psaTournamentList");
        const count = $("psaTournamentCount");
        if (count) count.textContent = String(state.list.length);
        if (!host) return;

        if (!state.list.length) {
            host.innerHTML = '<p class="psa-empty">No hay torneos disponibles.</p>';
            return;
        }

        host.innerHTML = state.list.map((item) => {
            const id = String(item.id || "");
            const active = id === selectedTournament || String(item.name || "") === selectedTournament;
            return `
                <button class="psa-tournament-button ${active ? "is-active" : ""}" type="button" data-tournament-id="${escapeHtml(id)}">
                    <strong>${escapeHtml(item.name || id)}</strong>
                    <small>${escapeHtml(item.city || "Ciudad pendiente")} · ${escapeHtml(item.country || "Pais pendiente")}</small>
                    <small>${escapeHtml(formatDateRange(item))}</small>
                </button>
            `;
        }).join("");

        host.querySelectorAll("[data-tournament-id]").forEach((button) => {
            button.addEventListener("click", async () => {
                const tournamentId = button.getAttribute("data-tournament-id") || "";
                if (!tournamentId || tournamentId === selectedTournament) return;
                persistTournament(tournamentId);
                await loadDetail();
                renderTournamentList(state.list);
            });
        });
    }

    function statusChip(status) {
        const value = String(status || "unknown");
        const className = value === "in_progress"
            ? "psa-status-live"
            : value === "scheduled"
                ? "psa-status-scheduled"
                : value === "completed"
                    ? "psa-status-completed"
                    : "";
        return `<span class="psa-status-chip ${className}">${escapeHtml(value)}</span>`;
    }

    function renderSummary(detail) {
        const host = $("psaTournamentSummary");
        if (!host) return;

        if (!detail?.tournament) {
            host.innerHTML = '<div class="psa-summary-card"><h2>Sin torneo cargado</h2><p>Selecciona un torneo para ver los datos de PSA.</p></div>';
            return;
        }

        const tournament = detail.tournament;
        const live = detail.live || {};
        const divisions = Array.isArray(detail.divisions) ? detail.divisions : [];

        host.innerHTML = `
            <article class="psa-summary-card">
                <h2>${escapeHtml(tournament.name || "Torneo")}</h2>
                <p>${escapeHtml(formatDateRange(tournament.dates))}</p>
                <p>${escapeHtml(tournament.location?.city || "")}${tournament.location?.country ? ` · ${escapeHtml(tournament.location.country)}` : ""}</p>
                <p>${statusChip(tournament.status)}</p>
                ${tournament.stream_url ? `<p><a class="psa-link" href="${escapeHtml(tournament.stream_url)}" target="_blank" rel="noopener noreferrer">Abrir stream del torneo</a></p>` : ""}
            </article>
            <article class="psa-summary-card">
                <h2>En juego</h2>
                <strong>${Array.isArray(live.in_progress) ? live.in_progress.length : 0}</strong>
                <p>Partidos con estado in_progress.</p>
            </article>
            <article class="psa-summary-card">
                <h2>Proximos</h2>
                <strong>${Array.isArray(live.upcoming) ? live.upcoming.length : 0}</strong>
                <p>Partidos programados visibles en la respuesta actual.</p>
            </article>
            <article class="psa-summary-card">
                <h2>Divisiones</h2>
                <strong>${divisions.length}</strong>
                <p>${escapeHtml(String(detail.summary?.total_entries || tournament.metadata?.updated_at || "Sin resumen"))}</p>
            </article>
        `;
    }

    function renderMatchList(elementId, matches, counterId) {
        const host = $(elementId);
        const counter = $(counterId);
        const items = Array.isArray(matches) ? matches : [];
        if (counter) counter.textContent = String(items.length);
        if (!host) return;

        if (!items.length) {
            host.innerHTML = '<p class="psa-empty">Sin partidos en esta categoria.</p>';
            return;
        }

        host.innerHTML = items.map((match) => {
            const players = Array.isArray(match.players) ? match.players : [];
            const playerNames = players.map((player) => escapeHtml(player.name || "TBD")).join(" vs ");
            return `
                <article class="psa-match-card">
                    <div class="psa-match-head">
                        <h3>${playerNames || "Partido pendiente"}</h3>
                        ${statusChip(match.status)}
                    </div>
                    <p class="psa-match-meta">${escapeHtml(match.division || "Division")}${match.round ? ` · ${escapeHtml(match.round)}` : ""}</p>
                    <p class="psa-match-meta">${escapeHtml(match.date || "Sin fecha")}${match.time ? ` · ${escapeHtml(match.time)}` : ""}${match.court ? ` · Pista ${escapeHtml(match.court)}` : ""}</p>
                    <div class="psa-match-score">
                        <span class="psa-match-score-value">${escapeHtml(match.scoreline || "-")}</span>
                        ${match.stream_url ? `<a class="psa-link" href="${escapeHtml(match.stream_url)}" target="_blank" rel="noopener noreferrer">stream</a>` : ""}
                    </div>
                </article>
            `;
        }).join("");
    }

    function renderDivisions(divisions) {
        const host = $("psaDivisions");
        const count = $("psaDivisionCount");
        const items = Array.isArray(divisions) ? divisions : [];
        if (count) count.textContent = String(items.length);
        if (!host) return;

        if (!items.length) {
            host.innerHTML = '<p class="psa-empty">No hay divisiones disponibles.</p>';
            return;
        }

        host.innerHTML = items.map((division) => `
            <article class="psa-division-card">
                <div class="psa-panel-head">
                    <h3>${escapeHtml(division.name || "Division")}</h3>
                    <span class="psa-badge">${escapeHtml(String(division.entries_count || 0))} jugadores</span>
                </div>
                <p>${escapeHtml(division.level || "Nivel pendiente")}${division.sub_level ? ` · ${escapeHtml(division.sub_level)}` : ""}</p>
                <p>Draw size: ${escapeHtml(String(division.draw_size || "-"))}</p>
                <ul class="psa-player-list">
                    ${(Array.isArray(division.players_sample) ? division.players_sample : []).map((player) => `
                        <li>${escapeHtml(player.name || "Jugador")}${player.ranking ? ` · Ranking ${escapeHtml(String(player.ranking))}` : ""}${player.country ? ` · ${escapeHtml(player.country)}` : ""}</li>
                    `).join("") || "<li>Sin muestra de jugadores</li>"}
                </ul>
            </article>
        `).join("");
    }

    function renderRawPayload(detail) {
        const host = $("psaRawPayload");
        if (!host) return;
        host.textContent = detail ? JSON.stringify(detail, null, 2) : "";
    }

    async function loadList() {
        const payload = await fetchProxy({ limit: 8, include_divisions: true, show_past: false });
        renderTournamentList(payload.tournaments || []);
        if ((!selectedTournament || !isValidTournamentValue(selectedTournament)) && Array.isArray(payload.tournaments) && payload.tournaments.length > 0) {
            persistTournament(String(payload.tournaments[0].id || ""));
            renderTournamentList(payload.tournaments || []);
        }
    }

    async function loadDetail() {
        if (!selectedTournament) {
            renderSummary(null);
            renderMatchList("psaLiveMatches", [], "psaLiveCount");
            renderMatchList("psaUpcomingMatches", [], "psaUpcomingCount");
            renderMatchList("psaCompletedMatches", [], "psaCompletedCount");
            renderDivisions([]);
            renderRawPayload(null);
            return;
        }

        const payload = await fetchProxy({ tournament: selectedTournament, expanded: true, head_to_head: false, limit: 8, include_divisions: true, show_past: false });
        state.detail = payload;
        renderSummary(payload);
        renderMatchList("psaLiveMatches", payload.live?.in_progress || [], "psaLiveCount");
        renderMatchList("psaUpcomingMatches", payload.live?.upcoming || [], "psaUpcomingCount");
        renderMatchList("psaCompletedMatches", payload.live?.completed || [], "psaCompletedCount");
        renderDivisions(payload.divisions || []);
        renderRawPayload(payload);
    }

    async function reloadAll() {
        setStatus("Consultando PSA...");
        try {
            await loadList();
            await loadDetail();
            setStatus(`Datos actualizados ${new Date().toLocaleTimeString("es-ES")}.`);
        } catch (error) {
            setStatus(error instanceof Error ? error.message : "No se pudo consultar PSA.", true);
        }
    }

    function startAutoRefresh() {
        if (refreshTimer) {
            window.clearInterval(refreshTimer);
        }
        refreshTimer = window.setInterval(() => {
            reloadAll();
        }, AUTO_REFRESH_MS);
    }

    function bindEvents() {
        const form = $("psaTestForm");
        const refreshButton = $("psaRefreshButton");

        if (form) {
            form.addEventListener("submit", async (event) => {
                event.preventDefault();
                const input = $("psaTournamentInput");
                const proxyInput = $("psaProxyUrlInput");
                persistProxyUrl((proxyInput?.value || "").trim());
                persistTournament((input?.value || "").trim());
                renderTournamentList(state.list);
                await reloadAll();
            });
        }

        if (refreshButton) {
            refreshButton.addEventListener("click", async () => {
                await reloadAll();
            });
        }
    }

    document.addEventListener("DOMContentLoaded", async () => {
        persistProxyUrl(readInitialProxyUrl());
        persistTournament(readInitialTournament());
        bindEvents();
        await reloadAll();
        startAutoRefresh();
    });
})();