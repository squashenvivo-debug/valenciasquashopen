/**
 * Genera una imagen PNG del cuadro final del torneo (nombres + marcador de cada partido, por
 * ronda), a partir de lo que haya guardado ahora mismo en Supabase (site_content.r1). Útil para
 * compartir/guardar el resultado sin depender de abrir la web.
 *
 * Uso:
 *   node tools/archive-snapshot/render-bracket.js 2026
 *   (el año solo se usa para el título y el nombre del fichero de salida)
 *
 * Salida: archivo/<año>/img/cuadro-final.png (si existe esa carpeta de archivo) y además una
 * copia en tools/archive-snapshot/output/cuadro-<año>.png para descargar directamente.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const YEAR = String(process.argv[2] || new Date().getFullYear());

const SUPABASE_URL = "https://texjzaanugmssmolzwgb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_lTEaFAp9lgMMInv-0TjeCA_ViWtDg2J";

function esc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function countSets(games, side) {
    const mine = side === "p1" ? "p1" : "p2", opp = side === "p1" ? "p2" : "p1";
    return (games || []).reduce((sum, g) => {
        if (g?.[mine] === null || g?.[mine] === undefined || g?.[opp] === null || g?.[opp] === undefined) return sum;
        return g[mine] > g[opp] ? sum + 1 : sum;
    }, 0);
}

function gameLine(games) {
    return (games || [])
        .filter((g) => g?.p1 !== null && g?.p1 !== undefined)
        .map((g) => `${g.p1}-${g.p2}`)
        .join("  ");
}

async function main() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/site_content?select=r1`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
    });
    if (!res.ok) throw new Error(`Supabase fetch failed: HTTP ${res.status}`);
    const row = (await res.json())[0];
    const draw = JSON.parse(row.r1);

    const COL_WIDTH = 300;
    const COL_GAP = 40;
    const MATCH_H = 62;
    const MATCH_GAP = 14;
    const TOP_PAD = 110;
    const SIDE_PAD = 40;
    const rounds = draw.rounds;
    const maxMatches = Math.max(...rounds.map((r) => r.matches.length));
    const width = SIDE_PAD * 2 + rounds.length * COL_WIDTH + (rounds.length - 1) * COL_GAP;
    const height = TOP_PAD + maxMatches * (MATCH_H + MATCH_GAP) + 60;

    const NAVY = "#071a31";
    const NAVY_LIGHT = "#0e2c4d";
    const GOLD = "#d4af37";
    const CARD = "#0f2440";
    const BORDER = "#1c3a5e";
    const TEXT = "#eaf1f8";
    const MUTED = "#8ea3bc";
    const WIN = "#2fb772";

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
    svg += `<rect width="${width}" height="${height}" fill="${NAVY}"/>`;
    svg += `<rect x="0" y="0" width="${width}" height="6" fill="${GOLD}"/>`;
    svg += `<text x="${width / 2}" y="46" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="700" fill="${TEXT}">PSA Valencia Open ${esc(YEAR)} — Cuadro Final</text>`;
    svg += `<text x="${width / 2}" y="70" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="13" letter-spacing="2" fill="${GOLD}">MEMORIAL CHIMO MARMANEU · ALBORAYA</text>`;

    rounds.forEach((round, colIndex) => {
        const x = SIDE_PAD + colIndex * (COL_WIDTH + COL_GAP);
        const n = round.matches.length;
        const totalColH = maxMatches * (MATCH_H + MATCH_GAP) - MATCH_GAP;
        const blockH = n * (MATCH_H + MATCH_GAP) - MATCH_GAP;
        const startY = TOP_PAD + (totalColH - blockH) / 2;

        svg += `<rect x="${x}" y="${TOP_PAD - 34}" width="${COL_WIDTH}" height="26" fill="${NAVY_LIGHT}" rx="4"/>`;
        svg += `<text x="${x + COL_WIDTH / 2}" y="${TOP_PAD - 16}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="12" font-weight="700" letter-spacing="1" fill="${GOLD}">${esc(round.title)}</text>`;

        round.matches.forEach((match, i) => {
            const y = startY + i * (MATCH_H + MATCH_GAP);
            const p1Sets = countSets(match.games, "p1");
            const p2Sets = countSets(match.games, "p2");
            const hasScore = (match.games || []).some((g) => g?.p1 !== null && g?.p1 !== undefined);
            const p1Win = hasScore && p1Sets > p2Sets;
            const p2Win = hasScore && p2Sets > p1Sets;
            const p1Bye = match.p1?.name === "BYE", p2Bye = match.p2?.name === "BYE";
            const p1Tbd = !match.p1?.name || match.p1.name === "TBD";
            const p2Tbd = !match.p2?.name || match.p2.name === "TBD";

            svg += `<rect x="${x}" y="${y}" width="${COL_WIDTH}" height="${MATCH_H}" rx="6" fill="${CARD}" stroke="${BORDER}"/>`;
            svg += `<line x1="${x}" y1="${y + MATCH_H / 2}" x2="${x + COL_WIDTH}" y2="${y + MATCH_H / 2}" stroke="${BORDER}"/>`;

            function row(name, sets, isWin, isBye, isTbd, ry) {
                const color = isTbd || isBye ? MUTED : (isWin ? WIN : TEXT);
                const weight = isWin ? "700" : "400";
                const label = isBye ? "BYE" : (isTbd ? "TBD" : name);
                svg += `<text x="${x + 12}" y="${ry}" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="${weight}" fill="${color}">${esc(label).slice(0, 34)}</text>`;
                if (hasScore && !isBye && !isTbd) {
                    svg += `<text x="${x + COL_WIDTH - 14}" y="${ry}" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="14" font-weight="700" fill="${color}">${sets}</text>`;
                }
            }
            row(match.p1?.name, p1Sets, p1Win, p1Bye, p1Tbd, y + MATCH_H / 2 - 8);
            row(match.p2?.name, p2Sets, p2Win, p2Bye, p2Tbd, y + MATCH_H - 8);
        });
    });

    svg += `<text x="${width / 2}" y="${height - 20}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="11" fill="${MUTED}">psavalenciaopen.com/archivo/${esc(YEAR)}/</text>`;
    svg += `</svg>`;

    const sharp = require(path.join(REPO_ROOT, "node_modules", "sharp"));
    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

    const outDir = path.join(__dirname, "output");
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `cuadro-${YEAR}.png`);
    fs.writeFileSync(outPath, pngBuffer);
    console.log("Guardado:", outPath, `(${(pngBuffer.length / 1024).toFixed(0)} KB, ${width}x${height})`);

    const archiveImgDir = path.join(REPO_ROOT, "archivo", YEAR, "img");
    if (fs.existsSync(archiveImgDir)) {
        fs.writeFileSync(path.join(archiveImgDir, "cuadro-final.png"), pngBuffer);
        console.log("Copiado también a", path.join(archiveImgDir, "cuadro-final.png"));
    }
}

main().catch((err) => { console.error("FALLÓ:", err); process.exit(1); });
