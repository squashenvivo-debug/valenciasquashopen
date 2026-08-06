(function () {
    const PSA_DIRECT_API_URL = "https://data.psasquashtour.com";

    // Official PSA Valencia Open 2026 Round 1 Matchups & Players
    const OFFICIAL_PSA_ROUND_1 = [
        {
            round: "Round 1",
            dateTime: "11 Aug 2026 • 12:00",
            status: "scheduled",
            player1: { name: "Sergio Garcia Pollan", country: "ESP", ranking: "#151", seed: "WC", mugshot: "https://secure.psasquashtour.com/players/cf4742efbc/headshot" },
            player2: { name: "Brice Nicolas", country: "FRA", ranking: "#136", seed: "", mugshot: "https://secure.psasquashtour.com/players/9fc0265926/headshot" },
            scores: []
        },
        {
            round: "Round 1",
            dateTime: "11 Aug 2026 • 12:45",
            status: "scheduled",
            player1: { name: "Daniel Poleshchuk", country: "ISR", ranking: "#099", seed: "", mugshot: "https://www.psasquashtour.com/wp-content/uploads/2026/06/Daniel-Poleshchuk-1024x991.png" },
            player2: { name: "Aly Tolba", country: "EGY", ranking: "#122", seed: "", mugshot: "https://secure.psasquashtour.com/players/00637c76cf/headshot" },
            scores: []
        },
        {
            round: "Round 1",
            dateTime: "11 Aug 2026 • 17:00",
            status: "scheduled",
            player1: { name: "Khaled Labib", country: "EGY", ranking: "#137", seed: "", mugshot: "https://secure.psasquashtour.com/players/a7359e8a67/headshot" },
            player2: { name: "Muhammad Asim Khan", country: "PAK", ranking: "#077", seed: "", mugshot: "https://www.psasquashtour.com/wp-content/uploads/2026/06/Muhammad-Asim-Khan-1024x977.png" },
            scores: []
        },
        {
            round: "Round 1",
            dateTime: "11 Aug 2026 • 17:45",
            status: "scheduled",
            player1: { name: "Marwan Tamer", country: "EGY", ranking: "#114", seed: "", mugshot: "https://secure.psasquashtour.com/players/0393163130/headshot" },
            player2: { name: "Aqeel Rehman", country: "AUT", ranking: "#146", seed: "", mugshot: "https://secure.psasquashtour.com/players/101e27f7e5/headshot" },
            scores: []
        },
        {
            round: "Round 1",
            dateTime: "11 Aug 2026 • 18:30",
            status: "scheduled",
            player1: { name: "Omar Said", country: "EGY", ranking: "#105", seed: "", mugshot: "https://secure.psasquashtour.com/players/44f3ebd9cb/headshot" },
            player2: { name: "Hamza Khan", country: "PAK", ranking: "#169", seed: "", mugshot: "https://secure.psasquashtour.com/players/cb8b286bef/headshot" },
            scores: []
        },
        {
            round: "Round 1",
            dateTime: "11 Aug 2026 • 19:15",
            status: "scheduled",
            player1: { name: "Ernesto Revert", country: "ESP", ranking: "#866", seed: "WC", mugshot: "https://secure.psasquashtour.com/players/a29ff8048d/headshot" },
            player2: { name: "Yannik Omlor", country: "GER", ranking: "#112", seed: "", mugshot: "https://www.psasquashtour.com/wp-content/uploads/2026/06/Yannik-Omlor-1024x995.png" },
            scores: []
        },
        {
            round: "Round 1",
            dateTime: "11 Aug 2026 • 13:30",
            status: "scheduled",
            player1: { name: "Will Salter", country: "ENG", ranking: "#120", seed: "", mugshot: "https://secure.psasquashtour.com/players/3a5e840a1b/headshot" },
            player2: { name: "Rhys Evans", country: "WAL", ranking: "#128", seed: "", mugshot: "https://secure.psasquashtour.com/players/7b2e910c2d/headshot" },
            scores: []
        },
        {
            round: "Round 1",
            dateTime: "11 Aug 2026 • 14:15",
            status: "scheduled",
            player1: { name: "Joseph White", country: "AUS", ranking: "#108", seed: "", mugshot: "https://secure.psasquashtour.com/players/1c2a3d4e5f/headshot" },
            player2: { name: "Marek Panacek", country: "CZE", ranking: "#115", seed: "", mugshot: "https://secure.psasquashtour.com/players/6f5e4d3c2b/headshot" },
            scores: []
        }
    ];

    const SEEDED_BYES = [
        { name: "Samuel Osborne - Wylde", seed: "(2)", country: "ENG", ranking: "#051", mugshot: "https://secure.psasquashtour.com/players/5aef440b5a/headshot" },
        { name: "Mohamed Nasser", seed: "(7)", country: "EGY", ranking: "#065", mugshot: "https://secure.psasquashtour.com/players/e45ea8af88/headshot" },
        { name: "Simon Herbert", seed: "(5)", country: "ENG", ranking: "#058", mugshot: "https://www.psasquashtour.com/wp-content/uploads/2026/06/Simon-Herbert-1024x1024.png" },
        { name: "Ivan Perez", seed: "(3)", country: "ESP", ranking: "#052", mugshot: "https://www.psasquashtour.com/wp-content/uploads/2025/10/Ivan-Perez.png" },
        { name: "Balazs Farkas", seed: "(4)", country: "HUN", ranking: "#055", mugshot: "https://www.psasquashtour.com/wp-content/uploads/2026/06/Balazs-Farkas-1024x1024.png" },
        { name: "Abdulla Al-Tamimi", seed: "(6)", country: "QAT", ranking: "#060", mugshot: "https://www.psasquashtour.com/wp-content/uploads/2025/08/PSA-Rankings-Headshots-%E2%80%93-_0007_Abdullah-Al-Tamimi.png" },
        { name: "Yassin Elshafei", seed: "(8)", country: "EGY", ranking: "#070", mugshot: "https://secure.psasquashtour.com/players/01a2b3c4d5/headshot" },
        { name: "Patrick Rooney", seed: "(1)", country: "ENG", ranking: "#045", mugshot: "https://secure.psasquashtour.com/players/9e8d7c6b5a/headshot" }
    ];

    function getProxyUrl() {
        const config = window.PSA_CONFIG || {};
        const baseUrl = config.supabaseUrl || "https://texjzaanugmssmolzwgb.supabase.co";
        return `${baseUrl}/functions/v1/psa-proxy`;
    }

    function renderPlayerRow(player) {
        if (!player || !player.name || player.name === "BYE") {
            return `
                <div class="psa-player-row">
                    <div class="psa-player-mugshot" style="display:flex;align-items:center;justify-content:center;color:#666;font-size:0.8rem;">-</div>
                    <span class="psa-player-name-box psa-bye-label">BYE</span>
                </div>
            `;
        }

        const seedHtml = player.seed ? `<span class="psa-seed-tag">${player.seed}</span>` : "";
        const flagUrl = player.country ? `assets/images/flags/${player.country}.svg` : "";
        const flagHtml = player.country ? `<img class="psa-player-flag" src="${flagUrl}" alt="${player.country}" onerror="this.style.display='none'">` : "";
        const mugshotSrc = player.mugshot || "https://www.psasquashtour.com/wp-content/uploads/2025/11/default-player-img.png";

        return `
            <div class="psa-player-row">
                <img class="psa-player-mugshot" src="${mugshotSrc}" alt="${player.name}" onerror="this.src='https://www.psasquashtour.com/wp-content/uploads/2025/11/default-player-img.png'">
                ${flagHtml}
                <span class="psa-player-name-box">
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
                player2: { name: "Ganador R1", seed: "", country: "", mugshot: "" }
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
                player1: { name: `Ganador Octavo ${i*2-1}` },
                player2: { name: `Ganador Octavo ${i*2}` }
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
                player1: { name: `Ganador Cuarto ${i*2-1}` },
                player2: { name: `Ganador Cuarto ${i*2}` }
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
            player1: { name: "Semifinalista 1" },
            player2: { name: "Semifinalista 2" }
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
