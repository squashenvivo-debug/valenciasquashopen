/**
 * newsAnalyzer.js
 *
 * Analiza los partidos disputados en el PSA Valencia Open y decide
 * automáticamente cuál es la historia principal de la jornada
 * (sorpresa, remontada, cabeza de serie eliminado, español en pista, etc.).
 *
 * Módulo Node puro (CommonJS), sin dependencias externas. Se usa solo
 * en el servidor (api/generate-news.js) — nunca se sirve al navegador.
 */

"use strict";

// Umbral de duración (minutos) a partir del cual un partido se considera "maratoniano".
// El squash profesional al mejor de 5 suele rondar 35-55 min; por encima de 70 ya es una batalla larga.
const MARATHON_MINUTES = 70;

// Puntos de "interés periodístico" por señal detectada. El partido con más puntos
// se convierte en el ángulo principal de la noticia.
const SIGNAL_WEIGHTS = {
    champion: 100,
    topSeedEliminated: 55,
    finalistConfirmed: 50,
    comeback: 45,
    wildcardRun: 40,
    semifinalistConfirmed: 35,
    upset: 30,
    spanishWin: 28,
    marathon: 22,
    seedEliminated: 15,
    scoreline32: 10,
    dominantWin: 4
};

function normalizeCountry(value) {
    return String(value || "").trim().toUpperCase();
}

function isSpanishPlayer(info) {
    if (!info) return false;
    const country = normalizeCountry(info.country);
    return country === "ESP" || country === "SPAIN" || country === "ESPAÑA";
}

/** Junta el players_sample de todas las divisiones en un único mapa id -> info. */
function buildPlayerInfoMap(divisions) {
    const map = new Map();
    if (!Array.isArray(divisions)) return map;

    divisions.forEach((division) => {
        const sample = Array.isArray(division?.players_sample) ? division.players_sample : [];
        sample.forEach((player) => {
            if (player?.id === null || player?.id === undefined) return;
            map.set(String(player.id), player);
        });
    });

    return map;
}

function getPlayerInfo(playerInfoMap, playerId, fallbackName) {
    const info = playerId !== null && playerId !== undefined ? playerInfoMap.get(String(playerId)) : null;
    if (info) return info;
    return { id: playerId ?? null, name: fallbackName || null, country: null, ranking: null, seed_number: null, draw_type: null };
}

function normalizeRoundLabel(round) {
    return String(round || "").trim().toLowerCase();
}

function isFinalRound(round) {
    const label = normalizeRoundLabel(round);
    return /\bfinal\b/.test(label) && !label.includes("semi") && !label.includes("cuarto") && !label.includes("quarter");
}

function isSemifinalRound(round) {
    const label = normalizeRoundLabel(round);
    return label.includes("semi");
}

function isQuarterfinalRound(round) {
    const label = normalizeRoundLabel(round);
    return label.includes("cuarto") || label.includes("quarter");
}

/** Detecta remontada: el ganador perdió los dos primeros juegos disputados. */
function detectComeback(match) {
    const games = Array.isArray(match.games) ? match.games.slice().sort((a, b) => (a.num || 0) - (b.num || 0)) : [];
    if (games.length < 3 || match.winner_id === null || match.winner_id === undefined) return false;

    const firstTwo = games.slice(0, 2);
    const wonBothFirstByOpponent = firstTwo.length === 2 && firstTwo.every((game) => game.winner_id !== null && game.winner_id !== undefined && String(game.winner_id) !== String(match.winner_id));
    return wonBothFirstByOpponent;
}

function isWildcardOrQualifier(info) {
    const type = String(info?.draw_type || "").trim().toUpperCase();
    return type === "Q" || type === "WC" || type === "QUALIFIER" || type === "WILDCARD";
}

/** Analiza un único partido y devuelve sus señales narrativas + puntuación. */
function analyzeMatch(match, playerInfoMap) {
    const players = Array.isArray(match.players) ? match.players : [];
    if (players.length !== 2) return null;

    const [p1, p2] = players;
    const info1 = getPlayerInfo(playerInfoMap, p1.id, p1.name);
    const info2 = getPlayerInfo(playerInfoMap, p2.id, p2.name);

    const winnerIsP1 = match.winner_id !== null && match.winner_id !== undefined && String(match.winner_id) === String(p1.id);
    const winnerIsP2 = match.winner_id !== null && match.winner_id !== undefined && String(match.winner_id) === String(p2.id);
    if (!winnerIsP1 && !winnerIsP2) return null; // sin ganador claro, no aporta historia

    const winnerInfo = winnerIsP1 ? info1 : info2;
    const loserInfo = winnerIsP1 ? info2 : info1;

    const winnerSeed = Number(winnerInfo.seed_number) || null;
    const loserSeed = Number(loserInfo.seed_number) || null;

    const signals = {
        comeback: detectComeback(match),
        marathon: Number(match.duration_minutes) >= MARATHON_MINUTES,
        scoreline32: match.scoreline === "3-2",
        spanishWin: isSpanishPlayer(winnerInfo),
        seedEliminated: Boolean(loserSeed),
        topSeedEliminated: Boolean(loserSeed && loserSeed <= 4),
        // Sorpresa: el ganador no iba cabeza de serie (o iba peor sembrado) frente a un rival sembrado.
        upset: Boolean(loserSeed) && (!winnerSeed || winnerSeed > loserSeed),
        wildcardRun: isWildcardOrQualifier(winnerInfo) && (isQuarterfinalRound(match.round) || isSemifinalRound(match.round) || isFinalRound(match.round)),
        championshipMatch: isFinalRound(match.round),
        semifinalMatch: isSemifinalRound(match.round),
        dominantWin: match.scoreline === "3-0"
    };

    let score = 0;
    if (signals.championshipMatch) score += SIGNAL_WEIGHTS.champion;
    if (signals.topSeedEliminated) score += SIGNAL_WEIGHTS.topSeedEliminated;
    if (signals.semifinalMatch) score += SIGNAL_WEIGHTS.finalistConfirmed;
    if (signals.comeback) score += SIGNAL_WEIGHTS.comeback;
    if (signals.wildcardRun) score += SIGNAL_WEIGHTS.wildcardRun;
    if (signals.upset) score += SIGNAL_WEIGHTS.upset;
    if (signals.spanishWin) score += SIGNAL_WEIGHTS.spanishWin;
    if (signals.marathon) score += SIGNAL_WEIGHTS.marathon;
    if (signals.seedEliminated && !signals.topSeedEliminated) score += SIGNAL_WEIGHTS.seedEliminated;
    if (signals.scoreline32) score += SIGNAL_WEIGHTS.scoreline32;
    if (signals.dominantWin) score += SIGNAL_WEIGHTS.dominantWin;

    return { match, winnerInfo, loserInfo, signals, score };
}

/** Construye una frase breve en español que resume el ángulo elegido (contexto para el prompt). */
function describeAngle(analysis, allFavoritesWon) {
    if (!analysis) {
        return allFavoritesWon
            ? "Jornada sin sobresaltos: todos los cabezas de serie cumplieron el pronóstico."
            : "Jornada de resultados sin un ángulo dominante claro; cubrir como resumen coral de la sesión.";
    }

    const { match, winnerInfo, loserInfo, signals } = analysis;
    const winnerName = winnerInfo.name || "El jugador";
    const loserName = loserInfo.name || "su rival";

    if (signals.championshipMatch) {
        return `${winnerName} se proclama campeón del torneo tras superar a ${loserName} por ${match.scoreline} en la final.`;
    }
    if (signals.topSeedEliminated) {
        return `${winnerName} elimina al cabeza de serie nº${loserInfo.seed_number} (${loserName}) por ${match.scoreline}, la gran sorpresa de la jornada.`;
    }
    if (signals.semifinalMatch) {
        return `${winnerName} se mete en la final tras vencer a ${loserName} por ${match.scoreline}.`;
    }
    if (signals.comeback) {
        return `${winnerName} remonta un 0-2 en contra y acaba ganando a ${loserName} por ${match.scoreline}, en un partido de mérito.`;
    }
    if (signals.wildcardRun) {
        return `${winnerName}, entrado por clasificación/wildcard, sigue vivo tras ganar a ${loserName} (${match.scoreline}) y se perfila como la revelación del cuadro.`;
    }
    if (signals.upset) {
        return `${winnerName} da la sorpresa y elimina a ${loserName} por ${match.scoreline}.`;
    }
    if (signals.spanishWin) {
        return `${winnerName} firma una victoria española ante ${loserName} por ${match.scoreline}.`;
    }
    if (signals.marathon) {
        return `${winnerName} y ${loserName} protagonizan el partido más largo de la jornada (${match.duration_minutes} min), resuelto ${match.scoreline} a favor de ${winnerName}.`;
    }
    return `${winnerName} bate a ${loserName} por ${match.scoreline}, el resultado más destacado de la jornada.`;
}

/**
 * Punto de entrada: analiza todos los partidos disputados desde la última
 * noticia publicada y devuelve la historia principal + contexto agregado.
 *
 * @param {Array} matches - partidos completados (status completed/retired/walkover), ya filtrados por fecha.
 * @param {Array} divisions - divisiones del torneo (para el lookup de seed/ranking/país por jugador).
 * @returns {Object} resultado del análisis, listo para inyectar en el prompt.
 */
function analyzeStory(matches, divisions) {
    const playerInfoMap = buildPlayerInfoMap(divisions);
    const list = Array.isArray(matches) ? matches : [];

    const analyzed = list
        .map((match) => analyzeMatch(match, playerInfoMap))
        .filter(Boolean)
        .sort((a, b) => b.score - a.score);

    const mainAnalysis = analyzed[0] || null;
    const allFavoritesWon = analyzed.length > 0 && analyzed.every((entry) => !entry.signals.upset && !entry.signals.seedEliminated);

    const angleKey = !mainAnalysis
        ? (allFavoritesWon ? "favorites_dominate" : "no_clear_angle")
        : mainAnalysis.signals.championshipMatch ? "champion"
        : mainAnalysis.signals.topSeedEliminated ? "top_seed_eliminated"
        : mainAnalysis.signals.semifinalMatch ? "finalist_confirmed"
        : mainAnalysis.signals.comeback ? "comeback"
        : mainAnalysis.signals.wildcardRun ? "wildcard_run"
        : mainAnalysis.signals.upset ? "upset"
        : mainAnalysis.signals.spanishWin ? "spanish_win"
        : mainAnalysis.signals.marathon ? "marathon"
        : "notable_result";

    // Jugador del día: protagonista del partido principal, o el nombre más repetido entre victorias con señal.
    const playerOfDay = mainAnalysis ? mainAnalysis.winnerInfo.name : null;

    return {
        angleKey,
        mainStoryLabel: angleKey.replace(/_/g, " "),
        mainStoryBrief: describeAngle(mainAnalysis, allFavoritesWon),
        mainMatch: mainAnalysis ? mainAnalysis.match : null,
        playerOfDay,
        totalMatchesAnalyzed: analyzed.length,
        allFavoritesWon,
        // Top 5 partidos más relevantes, para dar contexto adicional al modelo sin saturar el prompt.
        topMatches: analyzed.slice(0, 5).map((entry) => ({
            round: entry.match.round,
            scoreline: entry.match.scoreline,
            duration_minutes: entry.match.duration_minutes,
            winner: entry.winnerInfo.name,
            loser: entry.loserInfo.name,
            signals: entry.signals,
            score: entry.score
        }))
    };
}

module.exports = { analyzeStory, buildPlayerInfoMap, MARATHON_MINUTES };
