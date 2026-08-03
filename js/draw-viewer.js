(() => {
const DRAW_BRACKET_KEY = "drawBracketState";

function toValidScore(value) {
    if (value === null || value === undefined || value === "") return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function isMutedPlayer(name) {
    return name === "TBD" || name === "BYE" || !name;
}

function countSetsWon(games, side) {
    const sideKey = side === "p1" ? "p1" : "p2";
    const oppKey = side === "p1" ? "p2" : "p1";

    return (games || []).reduce((sum, game) => {
        const mine = toValidScore(game?.[sideKey]);
        const opp = toValidScore(game?.[oppKey]);
        if (mine === null || opp === null) return sum;
        return mine > opp ? sum + 1 : sum;
    }, 0);
}

function getMatchWinner(match) {
    if (match.p1?.name === "BYE" && !isMutedPlayer(match.p2?.name)) return match.p2;
    if (match.p2?.name === "BYE" && !isMutedPlayer(match.p1?.name)) return match.p1;
    if (isMutedPlayer(match.p1?.name) || isMutedPlayer(match.p2?.name)) return null;

    const p1Sets = countSetsWon(match.games, "p1");
    const p2Sets = countSetsWon(match.games, "p2");
    if (p1Sets === p2Sets) return null;

    return p1Sets > p2Sets ? match.p1 : match.p2;
}

function normalizeBracket(bracket) {
    bracket.rounds.forEach((round) => {
        round.matches.forEach((match) => {
            if (!match.p1) match.p1 = { name: "TBD" };
            if (!match.p2) match.p2 = { name: "TBD" };
            if (!Array.isArray(match.games)) {
                match.games = Array.from({ length: 5 }, () => ({ p1: null, p2: null }));
            }
            if (match.games.length < 5) {
                const missing = 5 - match.games.length;
                for (let i = 0; i < missing; i += 1) {
                    match.games.push({ p1: null, p2: null });
                }
            }
        });
    });
}

function autoAdvanceBracket(bracket) {
    for (let roundIndex = 1; roundIndex < bracket.rounds.length; roundIndex += 1) {
        bracket.rounds[roundIndex].matches.forEach((match) => {
            match.p1 = { name: "TBD" };
            match.p2 = { name: "TBD" };
        });
    }

    for (let roundIndex = 0; roundIndex < bracket.rounds.length - 1; roundIndex += 1) {
        const currentRound = bracket.rounds[roundIndex];
        const nextRound = bracket.rounds[roundIndex + 1];

        currentRound.matches.forEach((match, matchIndex) => {
            const winner = getMatchWinner(match);
            if (!winner) return;

            const nextMatchIndex = Math.floor(matchIndex / 2);
            const targetSlot = matchIndex % 2 === 0 ? "p1" : "p2";

            if (nextRound.matches[nextMatchIndex]) {
                nextRound.matches[nextMatchIndex][targetSlot] = {
                    name: winner.name,
                    image: winner.image || null
                };
            }
        });
    }
}

function resolveDrawPlayerImage(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (raw.startsWith("data:")) return raw;
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.includes("/")) return raw;
    return `assets/images/players/${raw}`;
}

function renderGameCells(games, side) {
    const key = side === "p1" ? "p1" : "p2";
    return (games || []).slice(0, 5).map((game) => {
        const score = toValidScore(game?.[key]);
        return `<span class="draw-game-score">${score === null ? "" : score}</span>`;
    }).join("");
}

function hasAnyPlayedGame(games) {
    return (games || []).some((game) => {
        const p1 = toValidScore(game?.p1);
        const p2 = toValidScore(game?.p2);
        return p1 !== null || p2 !== null;
    });
}

async function renderDrawPage() {
    const bracket = document.getElementById("drawPageBracket");
    if (!bracket) return;

    try {
        const bracketResponse = await fetch("data/draw-bracket.json", { cache: "no-store" });
        if (!bracketResponse.ok) {
            throw new Error("No se pudo cargar draw-bracket.json");
        }

        const bracketData = await bracketResponse.json();
        const storedState = localStorage.getItem(DRAW_BRACKET_KEY);
        const parsedState = storedState ? JSON.parse(storedState) : null;
        const activeBracket = parsedState?.rounds ? parsedState : bracketData;

        normalizeBracket(activeBracket);
        autoAdvanceBracket(activeBracket);

        const firstRoundCount = bracketData.rounds[0]?.matches?.length || 0;
        const mobile = window.matchMedia("(max-width: 600px)").matches;
        const matchHeight = mobile ? 50 : 112;
        const matchStep = mobile ? 58 : 132;
        const roundHeight = Math.max(
            mobile ? 760 : 1980,
            (Math.max(firstRoundCount - 1, 0) * matchStep) + matchHeight
        );

        bracket.style.setProperty("--round-height", `${roundHeight}px`);
        bracket.style.setProperty("--match-height", `${matchHeight}px`);
        bracket.innerHTML = "";

        activeBracket.rounds.forEach((round, index) => {
            const roundCol = document.createElement("div");
            roundCol.className = "draw-round";
            roundCol.classList.add(`draw-round-${index + 1}`);
            roundCol.innerHTML = `
                <div class="draw-round-title">${round.title}</div>
                <div class="draw-round-matches"></div>
            `;

            const matchHost = roundCol.querySelector(".draw-round-matches");

            round.matches.forEach((match, matchIndex) => {
                const card = document.createElement("div");
                card.className = "draw-match";

                const factor = 2 ** index;
                const top = ((factor * matchIndex) + ((factor - 1) / 2)) * matchStep;
                card.style.top = `${Math.round(top)}px`;

                const p1Muted = isMutedPlayer(match.p1.name);
                const p2Muted = isMutedPlayer(match.p2.name);
                const hasPlayedGames = hasAnyPlayedGame(match.games);
                const p1Sets = (!hasPlayedGames || p1Muted) ? "" : countSetsWon(match.games, "p1");
                const p2Sets = (!hasPlayedGames || p2Muted) ? "" : countSetsWon(match.games, "p2");
                const gameCells1 = renderGameCells(match.games, "p1");
                const gameCells2 = renderGameCells(match.games, "p2");
                const footerDate = match.date || "-";
                const p1Image = resolveDrawPlayerImage(match.p1.image);
                const p2Image = resolveDrawPlayerImage(match.p2.image);

                card.innerHTML = `
                    <div class="draw-player ${p1Muted ? "is-muted" : ""}">
                        <div class="draw-player-main">
                            <span class="draw-avatar-wrap">
                                ${p1Image ? `<img class="draw-avatar" src="${p1Image}" alt="${match.p1.name}">` : ""}
                            </span>
                            <span class="draw-player-name">${match.p1.name}</span>
                        </div>
                        <div class="draw-scoreline">
                            <span class="draw-sets-won">${p1Sets}</span>
                            ${gameCells1}
                        </div>
                    </div>
                    <div class="draw-player ${p2Muted ? "is-muted" : ""}">
                        <div class="draw-player-main">
                            <span class="draw-avatar-wrap">
                                ${p2Image ? `<img class="draw-avatar" src="${p2Image}" alt="${match.p2.name}">` : ""}
                            </span>
                            <span class="draw-player-name">${match.p2.name}</span>
                        </div>
                        <div class="draw-scoreline">
                            <span class="draw-sets-won">${p2Sets}</span>
                            ${gameCells2}
                        </div>
                    </div>
                    <div class="draw-match-footer">
                        <span class="draw-match-date">${footerDate}</span>
                    </div>
                `;

                matchHost.appendChild(card);
            });

            bracket.appendChild(roundCol);
        });
    } catch (error) {
        console.error("Error cargando cuadro:", error);
        bracket.innerHTML = '<p class="draw-error">No se pudo cargar el cuadro.</p>';
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const refreshBtn = document.getElementById("refreshDrawPage");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", renderDrawPage);
    }
    renderDrawPage();
});
})();
