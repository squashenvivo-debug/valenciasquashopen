(function () {
    const PSA_DIRECT_API_URL = "https://data.psasquashtour.com";

    // Official PSA Valencia Open 2026 Round 1 Matchups & Players
    const OFFICIAL_PSA_ROUND_1 = [
        {
            round: "Round 1",
            dateTime: "11 Aug 2026 • 12:00",
            status: "scheduled",
            player1: { name: "Sergio Garcia Pollan", country: "ESP", ranking: "#151", seed: "WC", mugshot: "assets/images/players/player-23.jpg" },
            player2: { name: "Brice Nicolas", country: "FRA", ranking: "#136", seed: "", mugshot: "assets/images/players/player-17.jpg" },
            scores: []
        },
        {
            round: "Round 1",
            dateTime: "11 Aug 2026 • 12:45",
            status: "scheduled",
            player1: { name: "Daniel Poleshchuk", country: "ISR", ranking: "#099", seed: "", mugshot: "assets/images/players/player-14.jpg" },
            player2: { name: "Aly Tolba", country: "EGY", ranking: "#122", seed: "", mugshot: "assets/images/players/player-18.jpg" },
            scores: []
        },
        {
            round: "Round 1",
            dateTime: "11 Aug 2026 • 17:00",
            status: "scheduled",
            player1: { name: "Khaled Labib", country: "EGY", ranking: "#137", seed: "", mugshot: "assets/images/players/player-21.jpg" },
            player2: { name: "Muhammad Asim Khan", country: "PAK", ranking: "#077", seed: "", mugshot: "assets/images/players/player-10.jpg" },
            scores: []
        },
        {
            round: "Round 1",
            dateTime: "11 Aug 2026 • 17:45",
            status: "scheduled",
            player1: { name: "Marwan Tamer", country: "EGY", ranking: "#114", seed: "", mugshot: "assets/images/players/player-16.jpg" },
            player2: { name: "Aqeel Rehman", country: "AUT", ranking: "#146", seed: "", mugshot: "assets/images/players/aqeel-rehman.jpg" },
            scores: []
        },
        {
            round: "Round 1",
            dateTime: "11 Aug 2026 • 18:30",
            status: "scheduled",
            player1: { name: "Omar Said", country: "EGY", ranking: "#105", seed: "", mugshot: "assets/images/players/player-13.jpg" },
            player2: { name: "Hamza Khan", country: "PAK", ranking: "#169", seed: "", mugshot: "assets/images/players/player-20.jpg" },
            scores: []
        },
        {
            round: "Round 1",
            dateTime: "11 Aug 2026 • 19:15",
            status: "scheduled",
            player1: { name: "Ernesto Revert", country: "ESP", ranking: "#866", seed: "WC", mugshot: "assets/images/players/player-24.jpg" },
            player2: { name: "Yannik Omlor", country: "GER", ranking: "#112", seed: "", mugshot: "assets/images/players/player-15.jpg" },
            scores: []
        },
        {
            round: "Round 1",
            dateTime: "11 Aug 2026 • 13:30",
            status: "scheduled",
            player1: { name: "Will Salter", country: "ENG", ranking: "#120", seed: "", mugshot: "assets/images/players/player-19.jpg" },
            player2: { name: "Rhys Evans", country: "WAL", ranking: "#128", seed: "", mugshot: "assets/images/players/player-12.jpg" },
            scores: []
        },
        {
            round: "Round 1",
            dateTime: "11 Aug 2026 • 14:15",
            status: "scheduled",
            player1: { name: "Joseph White", country: "AUS", ranking: "#108", seed: "", mugshot: "assets/images/players/player-11.jpg" },
            player2: { name: "Marek Panacek", country: "CZE", ranking: "#115", seed: "", mugshot: "assets/images/players/player-22.jpg" },
            scores: []
        }
    ];

    const SEEDED_BYES = [
        { name: "Samuel Osborne - Wylde", seed: "(2)", country: "ENG", ranking: "#051", mugshot: "assets/images/players/player-03.jpg" },
        { name: "Mohamed Nasser", seed: "(7)", country: "EGY", ranking: "#065", mugshot: "assets/images/players/player-08.jpg" },
        { name: "Simon Herbert", seed: "(5)", country: "ENG", ranking: "#058", mugshot: "assets/images/players/player-06.jpg" },
        { name: "Ivan Perez", seed: "(3)", country: "ESP", ranking: "#052", mugshot: "assets/images/players/player-04.jpg" },
        { name: "Balazs Farkas", seed: "(4)", country: "HUN", ranking: "#055", mugshot: "assets/images/players/player-05.jpg" },
        { name: "Abdulla Al-Tamimi", seed: "(6)", country: "QAT", ranking: "#060", mugshot: "assets/images/players/player-07.jpg" },
        { name: "Yassin Elshafei", seed: "(8)", country: "EGY", ranking: "#070", mugshot: "assets/images/players/player-09.jpg" },
        { name: "Patrick Rooney", seed: "(1)", country: "ENG", ranking: "#045", mugshot: "assets/images/players/player-02.jpg" }
    ];

    function getProxyUrl() {
        const config = window.PSA_CONFIG || {};
        const baseUrl = config.supabaseUrl || "https://texjzaanugmssmolzwgb.supabase.co";
        return `${baseUrl}/functions/v1/psa-proxy`;
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

    function renderPlayerRow(player) {
        const isPlaceholder = !player || !player.mugshot || player.name === "BYE" || 
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

        const avatarHtml = isPlaceholder 
            ? RED_SILHOUETTE_SVG 
            : `<img class="psa-player-mugshot" src="${player.mugshot}" alt="${player.name}" onerror="this.src='assets/images/players/player-01.jpg'">`;

        return `
            <div class="psa-player-row ${isPlaceholder ? 'is-placeholder-row' : ''}">
                ${avatarHtml}
                ${flagHtml}
                <span class="psa-player-name-box ${isPlaceholder ? 'psa-placeholder-name' : ''}">
                    ${player.name} ${seedHtml}
                </span>
            </div>
        `;
    }

    function renderMatchCard(match) {
        const isLive = match.status === "in_progress";
        const metaDate = match.dateTime || "11 Aug 2026";
        const p1Name = match.player1?.name || "";
        const p2Name = match.player2?.name || "";
        const showH2H = p1Name && p1Name !== "BYE" && p2Name && p2Name !== "BYE";

        const p1Safe = p1Name.replace(/'/g, "\\'");
        const p2Safe = p2Name.replace(/'/g, "\\'");

        return `
            <div class="psa-match-item ${isLive ? 'is-live' : ''}">
                ${renderPlayerRow(match.player1)}
                ${renderPlayerRow(match.player2)}
                <div class="psa-match-footer">
                    <span>${metaDate}</span>
                    ${showH2H 
                        ? `<button class="psa-h2h-btn" onclick="openH2HModal('${p1Safe}', '${p2Safe}')">Head-to-head</button>` 
                        : ''}
                </div>
            </div>
        `;
    }

    function buildRound1Column() {
        const listContainer = document.getElementById("r1Matches");
        if (!listContainer) return;

        let html = "";
        // Round 1 alternates between Bye matches for seeds and real pairings
        let matchIdx = 0;
        for (let i = 0; i < 4; i++) {
            // Seed BYE match
            const seed = SEEDED_BYES[i];
            html += renderMatchCard({
                round: "Round 1",
                dateTime: "-",
                player1: { name: seed.name, seed: seed.seed, country: seed.country, mugshot: seed.mugshot },
                player2: { name: "BYE" }
            });

            // Real pairing
            if (OFFICIAL_PSA_ROUND_1[matchIdx]) {
                html += renderMatchCard(OFFICIAL_PSA_ROUND_1[matchIdx]);
                matchIdx++;
            }
        }
        for (let i = 4; i < 8; i++) {
            // Real pairing
            if (OFFICIAL_PSA_ROUND_1[matchIdx]) {
                html += renderMatchCard(OFFICIAL_PSA_ROUND_1[matchIdx]);
                matchIdx++;
            }
            // Seed BYE match
            const seed = SEEDED_BYES[i];
            html += renderMatchCard({
                round: "Round 1",
                dateTime: "-",
                player1: { name: "BYE" },
                player2: { name: seed.name, seed: seed.seed, country: seed.country, mugshot: seed.mugshot }
            });
        }

        listContainer.innerHTML = html;
    }

    function buildRound2Column() {
        const listContainer = document.getElementById("r2Matches");
        if (!listContainer) return;

        let html = "";
        for (let i = 0; i < 8; i++) {
            const seed = SEEDED_BYES[i] || { name: "Seed" };
            html += renderMatchCard({
                round: "Round 2",
                dateTime: "12 Aug 2026 • 16:00",
                player1: { name: seed.name, seed: seed.seed, country: seed.country, mugshot: seed.mugshot },
                player2: { name: "TBD", seed: "", country: "", mugshot: "" }
            });
        }
        listContainer.innerHTML = html;
    }

    function buildQFColumn() {
        const listContainer = document.getElementById("qfMatches");
        if (!listContainer) return;

        let html = "";
        for (let i = 1; i <= 4; i++) {
            html += renderMatchCard({
                round: "Cuarto de Final",
                dateTime: "13 Aug 2026",
                player1: { name: "TBD" },
                player2: { name: "TBD" }
            });
        }
        listContainer.innerHTML = html;
    }

    function buildSFColumn() {
        const listContainer = document.getElementById("sfMatches");
        if (!listContainer) return;

        let html = "";
        for (let i = 1; i <= 2; i++) {
            html += renderMatchCard({
                round: "Semifinal",
                dateTime: "14 Aug 2026",
                player1: { name: "TBD" },
                player2: { name: "TBD" }
            });
        }
        listContainer.innerHTML = html;
    }

    function buildFinalColumn() {
        const listContainer = document.getElementById("finalMatches");
        if (!listContainer) return;

        listContainer.innerHTML = renderMatchCard({
            round: "Gran Final",
            dateTime: "15 Aug 2026 • 18:30",
            player1: { name: "TBD" },
            player2: { name: "TBD" }
        });
    }

    const H2H_DATABASE = {
        "will salter|rhys evans": {
            matchesCount: "1 - 0",
            lastMeeting: "PSA European Tour 2025 (3-1)",
            winPct: "100% - 0%"
        },
        "sergio garcia pollan|brice nicolas": {
            matchesCount: "1 - 1",
            lastMeeting: "PSA Challenger 2024 (3-2)",
            winPct: "50% - 50%"
        },
        "daniel poleshchuk|aly tolba": {
            matchesCount: "1 - 0",
            lastMeeting: "PSA World Tour 2025 (3-0)",
            winPct: "100% - 0%"
        },
        "khaled labib|muhammad asim khan": {
            matchesCount: "0 - 2",
            lastMeeting: "PSA International 2025 (1-3)",
            winPct: "0% - 100%"
        },
        "marwan tamer|aqeel rehman": {
            matchesCount: "1 - 0",
            lastMeeting: "PSA Challenger 2025 (3-1)",
            winPct: "100% - 0%"
        },
        "omar said|hamza khan": {
            matchesCount: "0 - 1",
            lastMeeting: "World Junior Champ 2024 (2-3)",
            winPct: "0% - 100%"
        },
        "ernesto revert|yannik omlor": {
            matchesCount: "0 - 1",
            lastMeeting: "PSA European Tour 2024 (0-3)",
            winPct: "0% - 100%"
        },
        "joseph white|marek panacek": {
            matchesCount: "1 - 1",
            lastMeeting: "PSA Open 2025 (3-2)",
            winPct: "50% - 50%"
        }
    };

    // Modal Head to Head Handler
    window.openH2HModal = function (p1Name, p2Name) {
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
                    <div class="psa-h2h-stat-row">
                        <span style="color: var(--psa-text-muted, #8E9BAE);">Porcentaje de victorias:</span>
                        <strong id="h2hStatPct">50% - 50%</strong>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        const el1 = document.getElementById("h2hP1Name");
        const el2 = document.getElementById("h2hP2Name");
        if (el1) el1.textContent = p1Name;
        if (el2) el2.textContent = p2Name;

        const k1 = `${p1Name.toLowerCase()}|${p2Name.toLowerCase()}`;
        const k2 = `${p2Name.toLowerCase()}|${p1Name.toLowerCase()}`;

        let h2h = H2H_DATABASE[k1];
        let reversed = false;
        if (!h2h && H2H_DATABASE[k2]) {
            h2h = H2H_DATABASE[k2];
            reversed = true;
        }

        const matchesEl = document.getElementById("h2hStatMatches");
        const lastEl = document.getElementById("h2hStatLast");
        const pctEl = document.getElementById("h2hStatPct");

        if (h2h) {
            const countStr = reversed ? h2h.matchesCount.split(" - ").reverse().join(" - ") : h2h.matchesCount;
            const pctStr = reversed ? h2h.winPct.split(" - ").reverse().join(" - ") : h2h.winPct;

            if (matchesEl) matchesEl.textContent = countStr;
            if (lastEl) lastEl.textContent = h2h.lastMeeting;
            if (pctEl) pctEl.textContent = pctStr;
        } else {
            if (matchesEl) matchesEl.textContent = "0 - 0";
            if (lastEl) lastEl.textContent = "Primer enfrentamiento oficial";
            if (pctEl) pctEl.textContent = "50% - 50%";
        }

        modal.classList.add("active");
    };

    window.closeH2HModal = function () {
        const modal = document.getElementById("h2hModal");
        if (modal) modal.classList.remove("active");
    };

    document.addEventListener("DOMContentLoaded", () => {
        buildRound1Column();
        buildRound2Column();
        buildQFColumn();
        buildSFColumn();
        buildFinalColumn();
    });
})();
