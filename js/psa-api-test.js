(function () {
    const DEFAULT_TOURNAMENT_ID = "12711";
    const PSA_TEST_SUPABASE_FALLBACK_URL = "https://texjzaanugmssmolzwgb.supabase.co";
    const PSA_DIRECT_API_URL = "https://data.psasquashtour.com";
    const PSA_DIRECT_API_KEY = "854800fc3a4b365e531b39594fd3aed7eb2f42a573887d5f";
    const STORAGE_KEY = "psaApiTestTournament";
    const PROXY_URL_STORAGE_KEY = "psaApiTestProxyUrl";
    const AUTO_REFRESH_MS = 60000;
    let selectedTournament = "";
    let refreshTimer = null;

    const state = {
        list: [],
        detail: null,
        sourceMode: "proxy",
        subscriptionMode: "proxy",
        subscribableMatchIds: [],
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

    async function fetchProxySubscribe(matchIds) {
        const url = new URL(getFunctionUrl());
        const response = await fetch(url.toString(), {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                action: "subscribe",
                match_ids: Array.isArray(matchIds) ? matchIds : [],
            }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.success === false) {
            throw new Error(payload?.error || `Error ${response.status} solicitando suscripcion live.`);
        }

        return payload;
    }

    function buildDirectQuery(params) {
        const query = new URLSearchParams();
        Object.entries(params || {}).forEach(([key, value]) => {
            if (value === undefined || value === null || value === "") return;
            query.set(key, String(value));
        });
        return query;
    }

    function parseSortTime(match) {
        const date = String(match?.date || "").trim();
        const time = String(match?.time || "").trim();
        if (!date) return Number.POSITIVE_INFINITY;
        const parsed = new Date(`${date}T${time || "00:00:00"}`);
        return Number.isNaN(parsed.getTime()) ? Number.POSITIVE_INFINITY : parsed.getTime();
    }

    function simplifyDirectTournamentList(items) {
        return (items || []).map((item) => ({
            id: item.id,
            name: item.name,
            start_date: item.start_date || null,
            end_date: item.end_date || null,
            status: item.status || null,
            city: item.city || null,
            country: item.country || null,
            divisions: Array.isArray(item.divisions)
                ? item.divisions.map((division) => ({
                    id: division.id || null,
                    name: division.name || null,
                    level: division.level || null,
                    sub_level: division.sub_level || null,
                }))
                : [],
        }));
    }

    function flattenDirectMatches(divisions, tournamentStreamUrl) {
        return (divisions || []).flatMap((division) => (division.brackets || []).flatMap((bracket) => (bracket.matches || []).map((match) => {
            const players = Array.isArray(match.match_players)
                ? match.match_players.map((player) => ({
                    id: player.id ?? null,
                    name: player.name || null,
                    games_won: player.games_won ?? null,
                }))
                : [];

            return {
                id: match.id ?? null,
                division: division.name || null,
                bracket: bracket.name || null,
                round: match.round || null,
                round_num: match.round_num ?? null,
                match_num: match.match_num ?? null,
                status: match.status || null,
                date: match.date || null,
                time: match.time || null,
                court: match.court || null,
                court_id: match.court_id ?? null,
                best: match.best || null,
                scoring: match.scoring || null,
                duration_minutes: match.duration_minutes ?? null,
                streamed: Boolean(match.streamed || match.stream_url || tournamentStreamUrl),
                stream_url: match.stream_url || tournamentStreamUrl || null,
                players,
                scoreline: players.length === 2
                    ? `${players[0].games_won ?? 0}-${players[1].games_won ?? 0}`
                    : null,
                winner_id: match.result?.winner_id ?? null,
                retired: Boolean(match.result?.retired),
                walkover: Boolean(match.result?.walkover),
                games: Array.isArray(match.result?.games) ? match.result.games : [],
                commentator_ids: Array.isArray(match.commentator_ids) ? match.commentator_ids : [],
                head_to_head: match.head_to_head || null,
                sort_time: parseSortTime(match),
            };
        })));
    }

    function stripSortTime(match) {
        const { sort_time: _sortTime, ...rest } = match;
        return rest;
    }

    function simplifyDirectDivisions(divisions, tournamentStreamUrl) {
        return (divisions || []).map((division) => ({
            id: division.id ?? null,
            name: division.name || null,
            gender: division.gender || null,
            level: division.level || null,
            sub_level: division.sub_level || null,
            draw_size: division.draw_size ?? null,
            entries_count: division.entries_count ?? null,
            players_sample: Array.isArray(division.players)
                ? division.players.slice(0, 8).map((player) => ({
                    id: player.id ?? null,
                    name: player.name || null,
                    country: player.country || null,
                    ranking: player.ranking ?? null,
                    seed_number: player.entry?.seed_number ?? null,
                    draw_type: player.entry?.draw_type || null,
                    entry_status: player.entry?.status || null,
                }))
                : [],
            brackets: Array.isArray(division.brackets)
                ? division.brackets.map((bracket) => ({
                    id: bracket.id ?? null,
                    name: bracket.name || null,
                    format: bracket.format || null,
                    size: bracket.size ?? null,
                    best_of: bracket.best_of ?? null,
                    scoring_system: bracket.scoring_system || null,
                    matches_count: Array.isArray(bracket.matches) ? bracket.matches.length : 0,
                    matches: Array.isArray(bracket.matches)
                        ? bracket.matches.map((match) => stripSortTime(flattenDirectMatches([
                            { name: division.name || null, brackets: [{ name: bracket.name || null, matches: [match] }] }
                        ], tournamentStreamUrl)[0]))
                        : [],
                }))
                : [],
        }));
    }

    async function fetchDirectPsa(params) {
        const tournament = String(params?.tournament || "").trim();

        const listQuery = buildDirectQuery({
            search: params?.search,
            level: params?.level,
            sublevel: params?.sublevel,
            status: params?.status,
            start_date: params?.start_date,
            end_date: params?.end_date,
            dizplai: params?.dizplai,
            sportradar: params?.sportradar,
            redzone: params?.redzone,
            squashlevels: params?.squashlevels,
            squashtv: params?.squashtv,
            tnt_sports: params?.tnt_sports,
            supersports: params?.supersports,
            skysports_nz: params?.skysports_nz,
            squashref: params?.squashref,
            show_past: params?.show_past ?? false,
            include_divisions: params?.include_divisions ?? true,
            limit: params?.limit ?? 10,
        });

        const listResponse = await fetch(`${PSA_DIRECT_API_URL}/api/v1/tournaments?${listQuery.toString()}`, {
            headers: {
                "Accept": "application/json",
                "X-Api-Key": PSA_DIRECT_API_KEY,
            },
        });
        if (!listResponse.ok) {
            throw new Error(`PSA directo respondio ${listResponse.status} en listado.`);
        }

        const listPayload = await listResponse.json();
        const listItems = Array.isArray(listPayload?.psa?.tournaments) ? listPayload.psa.tournaments : [];

        if (!tournament) {
            return {
                success: true,
                mode: "list",
                fetched_at: new Date().toISOString(),
                source: {
                    api: listPayload?.api || null,
                    timestamp: listPayload?.timestamp || null,
                    transport: "direct",
                },
                tournaments: simplifyDirectTournamentList(listItems),
            };
        }

        const detailQuery = new URLSearchParams();
        if (params?.expanded !== false && params?.head_to_head) {
            detailQuery.set("head_to_head", "true");
        }

        const detailPath = `${PSA_DIRECT_API_URL}/api/v1/tournaments/${encodeURIComponent(tournament)}/expanded${detailQuery.toString() ? `?${detailQuery.toString()}` : ""}`;
        const detailResponse = await fetch(detailPath, {
            headers: {
                "Accept": "application/json",
                "X-Api-Key": PSA_DIRECT_API_KEY,
            },
        });
        if (!detailResponse.ok) {
            throw new Error(`PSA directo respondio ${detailResponse.status} en detalle.`);
        }

        const detailPayload = await detailResponse.json();
        const tournamentData = detailPayload?.psa?.tournament || null;
        const rawDivisions = Array.isArray(detailPayload?.psa?.divisions) ? detailPayload.psa.divisions : [];
        const tournamentStreamUrl = tournamentData?.stream_url || null;
        const allMatches = flattenDirectMatches(rawDivisions, tournamentStreamUrl);
        const asc = (a, b) => a.sort_time - b.sort_time;
        const desc = (a, b) => b.sort_time - a.sort_time;

        return {
            success: true,
            mode: "detail",
            fetched_at: new Date().toISOString(),
            source: {
                api: detailPayload?.api || null,
                timestamp: detailPayload?.timestamp || null,
                expanded: true,
                transport: "direct",
            },
            tournament: tournamentData ? {
                id: tournamentData.id ?? null,
                name: tournamentData.name || null,
                status: tournamentData.status || null,
                stream_url: tournamentData.stream_url || null,
                dates: tournamentData.dates || null,
                location: tournamentData.location || null,
                metadata: tournamentData.metadata || null,
                title_sponsor: tournamentData.title_sponsor || null,
                commentators: Array.isArray(tournamentData.commentators) ? tournamentData.commentators : [],
            } : null,
            summary: detailPayload?.psa?.summary || detailPayload?.summary || null,
            divisions: simplifyDirectDivisions(rawDivisions, tournamentStreamUrl),
            live: {
                in_progress: allMatches.filter((match) => match.status === "in_progress").sort(asc).map(stripSortTime),
                upcoming: allMatches.filter((match) => match.status === "scheduled").sort(asc).slice(0, 12).map(stripSortTime),
                completed: allMatches.filter((match) => ["completed", "retired", "walkover"].includes(String(match.status || ""))).sort(desc).slice(0, 12).map(stripSortTime),
            },
            tournaments: simplifyDirectTournamentList(listItems).slice(0, 10),
        };
    }

    async function fetchDirectSubscribe(matchIds) {
        const response = await fetch(`${PSA_DIRECT_API_URL}/api/v1/matches/subscribe`, {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "X-Api-Key": PSA_DIRECT_API_KEY,
            },
            body: JSON.stringify({
                match_ids: Array.isArray(matchIds) ? matchIds : [],
            }),
        });

        const payload = await response.json().catch(async () => {
            const text = await response.text().catch(() => "");
            return text ? { raw: text } : {};
        });

        if (!response.ok) {
            throw new Error(payload?.error || payload?.message || `PSA directo respondio ${response.status} en subscribe.`);
        }

        return {
            success: true,
            mode: "subscribe",
            transport: "direct",
            requested_match_ids: Array.isArray(matchIds) ? matchIds : [],
            psa: payload,
        };
    }

    async function fetchTournamentData(params) {
        try {
            const payload = await fetchProxy(params);
            state.sourceMode = "proxy";
            return payload;
        } catch (error) {
            const payload = await fetchDirectPsa(params);
            state.sourceMode = "direct";
            return payload;
        }
    }

    async function fetchMatchSubscription(matchIds) {
        try {
            const payload = await fetchProxySubscribe(matchIds);
            state.subscriptionMode = "proxy";
            return payload;
        } catch (error) {
            const payload = await fetchDirectSubscribe(matchIds);
            state.subscriptionMode = "direct";
            return payload;
        }
    }

    function collectSubscribableMatchIds(payload) {
        const ids = [];
        const live = Array.isArray(payload?.live?.in_progress) ? payload.live.in_progress : [];
        const upcoming = Array.isArray(payload?.live?.upcoming) ? payload.live.upcoming : [];

        [...live, ...upcoming].forEach((match) => {
            const raw = match?.id;
            if (raw === undefined || raw === null) return;
            const clean = String(raw).trim();
            if (!clean) return;
            ids.push(/^\d+$/.test(clean) ? Number(clean) : clean);
        });

        return Array.from(new Set(ids));
    }

    async function requestLiveSubscription(options = {}) {
        const silent = Boolean(options?.silent);
        const matchIds = Array.isArray(state.subscribableMatchIds) ? state.subscribableMatchIds : [];

        if (!matchIds.length) {
            return { requested: false, count: 0, message: "sin partidos en juego o proximos" };
        }

        if (!silent) {
            setStatus(`Solicitando live scores para ${matchIds.length} partidos...`);
        }

        const payload = await fetchMatchSubscription(matchIds);

        if (state.detail && typeof state.detail === "object") {
            state.detail.live_subscription = {
                requested_match_ids: matchIds,
                requested_at: new Date().toISOString(),
                mode: state.subscriptionMode,
                response: payload,
            };
        }

        renderRawPayload(state.detail);

        return {
            requested: true,
            count: matchIds.length,
            mode: state.subscriptionMode,
        };
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

        host.innerHTML = items.map((division) => {
            const divisionPlayers = getDivisionPlayers(division);
            const confirmedCount = divisionPlayers.filter((player) => isConfirmedPlayer(player)).length;
            const playersCount = confirmedCount || division.entries_count || divisionPlayers.length || 0;

            return `
            <article class="psa-division-card">
                <div class="psa-panel-head">
                    <h3>${escapeHtml(division.name || "Division")}</h3>
                    <span class="psa-badge">${escapeHtml(String(playersCount))} jugadores</span>
                </div>
                <p>${escapeHtml(division.level || "Nivel pendiente")}${division.sub_level ? ` · ${escapeHtml(division.sub_level)}` : ""}</p>
                <p>Draw size: ${escapeHtml(String(division.draw_size || "-"))}</p>
                <ul class="psa-player-list">
                    ${(Array.isArray(division.players_sample) ? division.players_sample : []).map((player) => `
                        <li>${escapeHtml(player.name || "Jugador")}${player.ranking ? ` · Ranking ${escapeHtml(String(player.ranking))}` : ""}${player.country ? ` · ${escapeHtml(player.country)}` : ""}</li>
                    `).join("") || "<li>Sin muestra de jugadores</li>"}
                </ul>
            </article>
        `;
        }).join("");
    }

    function getDivisionPlayers(division) {
        if (Array.isArray(division?.players) && division.players.length) {
            return division.players;
        }
        if (Array.isArray(division?.players_sample) && division.players_sample.length) {
            return division.players_sample;
        }
        return [];
    }

    function isConfirmedPlayer(player) {
        const status = String(player?.entry?.status || player?.entry_status || "").trim().toLowerCase();
        return status === "confirmed";
    }

    function resolvePlayerPhoto(player) {
        return String(
            player?.player_image_url ||
            player?.image_url ||
            player?.photo_url ||
            player?.image ||
            player?.avatar ||
            ""
        ).trim();
    }

    function renderPlayersRoster(divisions) {
        const host = $("psaPlayersList");
        const count = $("psaPlayersCount");
        if (!host) return;

        const allPlayers = [];
        (Array.isArray(divisions) ? divisions : []).forEach((division) => {
            const divisionPlayers = getDivisionPlayers(division);
            const confirmedPlayers = divisionPlayers.filter((player) => isConfirmedPlayer(player));
            const sourcePlayers = confirmedPlayers.length ? confirmedPlayers : divisionPlayers;

            sourcePlayers.forEach((player) => {
                const id = String(player?.id || "").trim();
                const key = id || String(player?.name || "").trim().toLowerCase();
                if (!key) return;
                allPlayers.push({
                    key,
                    id: player?.id ?? null,
                    name: player?.name || "Jugador",
                    country: player?.country || null,
                    ranking: player?.ranking ?? null,
                    seed: player?.entry?.seed_number ?? player?.seed_number ?? null,
                    photo: resolvePlayerPhoto(player),
                });
            });
        });

        const unique = [];
        const seen = new Set();
        allPlayers.forEach((player) => {
            if (seen.has(player.key)) return;
            seen.add(player.key);
            unique.push(player);
        });

        unique.sort((a, b) => {
            const ar = Number.isFinite(Number(a.ranking)) ? Number(a.ranking) : Number.POSITIVE_INFINITY;
            const br = Number.isFinite(Number(b.ranking)) ? Number(b.ranking) : Number.POSITIVE_INFINITY;
            if (ar !== br) return ar - br;
            return String(a.name || "").localeCompare(String(b.name || ""), "es", { sensitivity: "base" });
        });

        if (count) count.textContent = String(unique.length);

        if (!unique.length) {
            host.innerHTML = '<p class="psa-empty">Sin jugadores en la respuesta actual.</p>';
            return;
        }

        host.innerHTML = unique.map((player) => {
            const photo = player.photo
                ? `<img src="${escapeHtml(player.photo)}" alt="${escapeHtml(player.name)}" loading="lazy">`
                : `<span>${escapeHtml(String(player.name || "?").slice(0, 1).toUpperCase())}</span>`;

            return `
                <article class="psa-player-card">
                    <div class="psa-player-avatar">${photo}</div>
                    <div class="psa-player-meta">
                        <h3>${escapeHtml(player.name)}</h3>
                        <p>${player.country ? escapeHtml(player.country) : "Pais N/D"}</p>
                        <p>Ranking: ${player.ranking ?? "N/D"}${player.seed ? ` · Seed ${escapeHtml(String(player.seed))}` : ""}</p>
                    </div>
                </article>
            `;
        }).join("");
    }

    function normalizeDrawMatches(divisions) {
        const rows = [];
        (Array.isArray(divisions) ? divisions : []).forEach((division) => {
            const brackets = Array.isArray(division?.brackets) ? division.brackets : [];
            brackets.forEach((bracket) => {
                const matches = Array.isArray(bracket?.matches) ? bracket.matches : [];
                matches.forEach((match) => {
                    const players = Array.isArray(match?.match_players)
                        ? match.match_players
                        : Array.isArray(match?.players)
                            ? match.players
                            : [];

                    rows.push({
                        division: division?.name || "Division",
                        bracket: bracket?.name || match?.bracket || "Bracket",
                        round: match?.round || "Round",
                        round_num: Number(match?.round_num ?? 999),
                        match_num: Number(match?.match_num ?? 999),
                        status: match?.status || null,
                        date: match?.date || null,
                        time: match?.time || null,
                        court: match?.court || null,
                        players,
                        scoreline: match?.scoreline || (players.length === 2 ? `${players[0]?.games_won ?? 0}-${players[1]?.games_won ?? 0}` : "-"),
                    });
                });
            });
        });
        return rows;
    }

    function renderDrawBoard(divisions) {
        const host = $("psaDrawBoard");
        const count = $("psaDrawCount");
        if (!host) return;

        const matches = normalizeDrawMatches(divisions).sort((a, b) => {
            if (a.round_num !== b.round_num) return a.round_num - b.round_num;
            return a.match_num - b.match_num;
        });

        if (count) count.textContent = String(matches.length);

        if (!matches.length) {
            host.innerHTML = '<p class="psa-empty">Sin cruces disponibles en este torneo.</p>';
            return;
        }

        const roundMap = new Map();
        matches.forEach((match) => {
            const key = `${match.round_num}|${match.round}`;
            if (!roundMap.has(key)) {
                roundMap.set(key, []);
            }
            roundMap.get(key).push(match);
        });

        host.innerHTML = Array.from(roundMap.entries()).map(([key, roundMatches]) => {
            const roundLabel = String(key.split("|")[1] || "Round");
            return `
                <section class="psa-draw-round">
                    <h3>${escapeHtml(roundLabel)}</h3>
                    <div class="psa-draw-round-list">
                        ${roundMatches.map((match) => {
                            const names = (match.players || []).map((p) => escapeHtml(p?.name || "TBD"));
                            return `
                                <article class="psa-draw-match">
                                    <p class="psa-match-meta">${escapeHtml(match.division)} · ${escapeHtml(match.bracket)}</p>
                                    <p class="psa-draw-names">${names[0] || "TBD"} vs ${names[1] || "TBD"}</p>
                                    <p class="psa-match-meta">${escapeHtml(match.date || "Sin fecha")}${match.time ? ` · ${escapeHtml(match.time)}` : ""}${match.court ? ` · Pista ${escapeHtml(match.court)}` : ""}</p>
                                    <div class="psa-match-score">
                                        <span class="psa-match-score-value">${escapeHtml(match.scoreline || "-")}</span>
                                        ${statusChip(match.status)}
                                    </div>
                                </article>
                            `;
                        }).join("")}
                    </div>
                </section>
            `;
        }).join("");
    }

    function renderLiveScoreBoard(payload) {
        const host = $("psaLiveBoard");
        const count = $("psaLiveBoardCount");
        if (!host) return;

        const liveNow = Array.isArray(payload?.live?.in_progress) ? payload.live.in_progress : [];
        const liveList = liveNow.length
            ? liveNow
            : (Array.isArray(payload?.live?.upcoming) ? payload.live.upcoming.slice(0, 8) : []);

        if (count) count.textContent = String(liveList.length);

        if (!liveList.length) {
            host.innerHTML = '<p class="psa-empty">No hay partidos en directo ahora mismo.</p>';
            return;
        }

        host.innerHTML = liveList.map((match) => {
            const players = Array.isArray(match?.players) ? match.players : [];
            const p1 = players[0]?.name || "TBD";
            const p2 = players[1]?.name || "TBD";
            const score = match?.scoreline || "-";
            const status = String(match?.status || "scheduled");
            return `
                <article class="psa-live-item ${status === "in_progress" ? "is-live" : ""}">
                    <div class="psa-panel-head">
                        <h3>${escapeHtml(p1)} vs ${escapeHtml(p2)}</h3>
                        ${statusChip(status)}
                    </div>
                    <p class="psa-match-meta">${escapeHtml(match?.division || "Division")}${match?.round ? ` · ${escapeHtml(match.round)}` : ""}</p>
                    <div class="psa-live-score">${escapeHtml(score)}</div>
                </article>
            `;
        }).join("");
    }

    function renderRawPayload(detail) {
        const host = $("psaRawPayload");
        if (!host) return;
        host.textContent = detail ? JSON.stringify(detail, null, 2) : "";
    }

    async function loadList() {
        const payload = await fetchTournamentData({ limit: 8, include_divisions: true, show_past: false });
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
            state.subscribableMatchIds = [];
            return;
        }

        const payload = await fetchTournamentData({ tournament: selectedTournament, expanded: true, head_to_head: false, limit: 8, include_divisions: true, show_past: false });
        state.detail = payload;
        renderSummary(payload);
        renderMatchList("psaLiveMatches", payload.live?.in_progress || [], "psaLiveCount");
        renderMatchList("psaUpcomingMatches", payload.live?.upcoming || [], "psaUpcomingCount");
        renderMatchList("psaCompletedMatches", payload.live?.completed || [], "psaCompletedCount");
        renderDivisions(payload.divisions || []);
        renderLiveScoreBoard(payload);
        renderPlayersRoster(payload.divisions || []);
        renderDrawBoard(payload.divisions || []);
        state.subscribableMatchIds = collectSubscribableMatchIds(payload);
        renderRawPayload(payload);
    }

    async function reloadAll() {
        setStatus("Consultando PSA...");
        try {
            await loadList();
            await loadDetail();
            let subscription = null;
            try {
                subscription = await requestLiveSubscription({ silent: true });
            } catch (error) {
                subscription = {
                    requested: false,
                    count: 0,
                    message: error instanceof Error ? error.message : "fallo en subscribe",
                };
            }

            const modeLabel = state.sourceMode === "proxy" ? "proxy Supabase" : "modo directo temporal";
            const subLabel = subscription?.requested
                ? ` · subscribe ${subscription.count} (${state.subscriptionMode === "proxy" ? "proxy" : "directo"})`
                : ` · subscribe: ${subscription?.message || "sin datos"}`;
            setStatus(`Datos actualizados ${new Date().toLocaleTimeString("es-ES")} · ${modeLabel}${subLabel}.`);
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
        const subscribeButton = $("psaSubscribeButton");

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

        if (subscribeButton) {
            subscribeButton.addEventListener("click", async () => {
                try {
                    const subscription = await requestLiveSubscription({ silent: false });
                    if (subscription?.requested) {
                        const via = state.subscriptionMode === "proxy" ? "proxy Supabase" : "modo directo temporal";
                        setStatus(`Live scores solicitados para ${subscription.count} partidos via ${via}.`);
                    } else {
                        setStatus(`No se envio subscribe: ${subscription?.message || "sin partidos"}.`, true);
                    }
                } catch (error) {
                    setStatus(error instanceof Error ? error.message : "No se pudo solicitar live scores.", true);
                }
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