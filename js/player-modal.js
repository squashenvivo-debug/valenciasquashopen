/**
 * player-modal.js — ficha de jugador como ventana modal (igual patrón que el modal de
 * head-to-head en psa-draw.js), para no navegar fuera de la página en la que está el
 * usuario (portada, cuadro...). Reutiliza las funciones de datos ya definidas en
 * js/player.js (findPlayer, fetchLiveTournamentSnapshot, getPlayerMatches, etc.) — este
 * fichero solo añade el marcado del modal y su propio render, con ids distintos para no
 * chocar con los de player.html cuando ambos scripts conviven en la misma página.
 */

(function () {
    "use strict";

    let modalBuilt = false;

    function tm(key, fallback) {
        return (typeof t === "function" ? t(`psaPlayer.${key}`) : "") || fallback;
    }

    function ensureModal() {
        if (modalBuilt) return;
        modalBuilt = true;

        const modal = document.createElement("div");
        modal.className = "psa-modal-overlay";
        modal.id = "playerDetailModal";
        modal.onclick = function (e) { if (e.target === modal) window.closePlayerModal(); };
        modal.innerHTML = `
            <div class="psa-modal-card player-modal-card">
                <button class="psa-modal-close" onclick="closePlayerModal()">&times;</button>

                <p id="playerModalLoading" class="gallery-empty">${tm("loading", "Cargando...")}</p>
                <p id="playerModalNotFound" class="gallery-empty" style="display:none;">${tm("notFound", "Jugador no encontrado.")}</p>

                <div class="player-header" id="playerModalHeader" style="display:none;">
                    <div class="player-photo">
                        <img id="playerModalImage" src="${typeof PLAYER_SILHOUETTE_SRC !== "undefined" ? PLAYER_SILHOUETTE_SRC : ""}" alt="">
                    </div>
                    <div class="player-data">
                        <h1 id="playerModalName">-</h1>
                        <div class="player-country">
                            <img id="playerModalFlag" src="assets/images/flags/ESP.svg" alt="">
                            <span id="playerModalCountryName">-</span>
                        </div>
                        <div class="player-ranking">World Nº <span id="playerModalRanking">-</span></div>
                        <div class="player-info-grid">
                            <div id="playerModalAgeRow"><strong>${tm("age", "Edad")}</strong> <span id="playerModalAge"></span></div>
                            <div id="playerModalHeightRow"><strong>${tm("height", "Altura")}</strong> <span id="playerModalHeight"></span></div>
                            <div id="playerModalHandRow"><strong>${tm("hand", "Mano")}</strong> <span id="playerModalHand"></span></div>
                        </div>
                    </div>
                </div>

                <section id="playerModalMatchesSection" class="player-matches" style="display:none;">
                    <h2>${tm("matchHistory", "Historial de partidos")}</h2>
                    <div id="playerModalMatchList" class="player-match-list"></div>
                </section>

                <section id="playerModalMeetingsSection" class="player-matches" style="display:none;">
                    <h2>${tm("recentMeetings", "Últimos enfrentamientos")}</h2>
                    <div id="playerModalMeetingsList" class="player-match-list"></div>
                </section>
            </div>
        `;
        document.body.appendChild(modal);
    }

    function setModalRow(rowId, spanId, value) {
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

    window.closePlayerModal = function () {
        const modal = document.getElementById("playerDetailModal");
        if (modal) modal.classList.remove("active");
        document.body.style.overflow = "";
    };

    window.openPlayerModal = async function (id, name) {
        ensureModal();
        const modal = document.getElementById("playerDetailModal");
        modal.classList.add("active");
        document.body.style.overflow = "hidden";

        const loadingEl = document.getElementById("playerModalLoading");
        const notFoundEl = document.getElementById("playerModalNotFound");
        const headerEl = document.getElementById("playerModalHeader");

        loadingEl.style.display = "";
        notFoundEl.style.display = "none";
        headerEl.style.display = "none";
        document.getElementById("playerModalMatchesSection").style.display = "none";
        document.getElementById("playerModalMeetingsSection").style.display = "none";

        await syncPlayersFromCloud();
        let players = readPlayersCollection();
        if (players.length === 0) players = await loadPlayersFallback();

        const player = findPlayer(players, id, name);
        if (!player) {
            loadingEl.style.display = "none";
            notFoundEl.style.display = "block";
            return;
        }

        const playerName = String(player.name || "").trim();

        const imageEl = document.getElementById("playerModalImage");
        const src = resolvePlayerImageSrc(player.image || player.imageSrc || "");
        if (src) {
            imageEl.onerror = () => { imageEl.onerror = null; imageEl.src = PLAYER_SILHOUETTE_SRC; };
            imageEl.src = src;
        }

        document.getElementById("playerModalName").textContent = playerName || "-";

        const country = String(player.country || "").trim().toUpperCase();
        const flagEl = document.getElementById("playerModalFlag");
        if (country) flagEl.src = `assets/images/flags/${country}.svg`;
        document.getElementById("playerModalCountryName").textContent = country || "-";
        document.getElementById("playerModalRanking").textContent = player.ranking || player.current_world_ranking || "-";

        const snapshot = await fetchLiveTournamentSnapshot();
        const divisions = Array.isArray(snapshot?.divisions) ? snapshot.divisions : [];
        const liveDetails = findLivePlayerDetails(divisions, playerName);

        setModalRow("playerModalAgeRow", "playerModalAge", liveDetails?.age || "");
        setModalRow("playerModalHeightRow", "playerModalHeight", liveDetails?.height_cm ? `${Math.round(Number(liveDetails.height_cm))} cm` : "");
        const handKey = liveDetails?.player_hand?.toLowerCase() === "left" ? "handLeft" : liveDetails?.player_hand ? "handRight" : "";
        setModalRow("playerModalHandRow", "playerModalHand", handKey ? tm(handKey, handKey === "handLeft" ? "Izquierda" : "Derecha") : "");

        renderPlayerMatches(getPlayerMatches(divisions, playerName), "playerModalMatchesSection", "playerModalMatchList");
        renderPlayerRecentMeetings(getPlayerRecentMeetings(divisions, playerName), "playerModalMeetingsSection", "playerModalMeetingsList");

        loadingEl.style.display = "none";
        headerEl.style.display = "";
    };
})();
