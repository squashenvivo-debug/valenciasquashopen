/**
 * Genera una copia congelada del PSA Valencia Open a partir de lo que hay AHORA MISMO en
 * Supabase (galerías, noticias, jugadores, programa, cuadro), sin depender de Supabase, R2,
 * la API de PSA ni ningún otro servicio externo una vez publicada. Descarga cada foto
 * referenciada, las comprime, y vuelca todo en un único index.html autocontenido (sin
 * ficheros .js/.css aparte, para que funcione igual de bien abierto con doble clic que
 * publicado en la web) más una carpeta img/.
 *
 * Uso:
 *   node tools/archive-snapshot/build.js 2027
 *   (si no se indica año, usa el año actual)
 *
 * Ejecutar justo después de que termine cada edición del torneo, antes de que el panel de
 * admin empiece a sobrescribir galerías/noticias/cuadro con los de la siguiente edición —
 * ese contenido vive en una única fila de Supabase (site_content, id=1) que se reutiliza
 * año tras año, no se acumula solo.
 *
 * Salida: archivo/<año>/index.html + archivo/<año>/img/*, y añade el año a archivo/index.html.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TEMPLATE_DIR = path.join(__dirname, "template");
const YEAR = String(process.argv[2] || new Date().getFullYear());
const ARCHIVE_ROOT = path.join(REPO_ROOT, "archivo");
const OUT_DIR = path.join(ARCHIVE_ROOT, YEAR);
const IMG_DIR = path.join(OUT_DIR, "img");

const SUPABASE_URL = "https://texjzaanugmssmolzwgb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_lTEaFAp9lgMMInv-0TjeCA_ViWtDg2J";

function tryParse(v) { try { return JSON.parse(v); } catch (e) { return v; } }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function extFromUrl(url) {
    const clean = url.split("?")[0].split("#")[0];
    const m = clean.match(/\.([a-zA-Z0-9]{2,5})$/);
    let e = (m ? m[1] : "jpg").toLowerCase();
    if (e === "jpeg") e = "jpg";
    if (!/^[a-z0-9]{2,5}$/.test(e)) e = "jpg";
    return e;
}
function localNameFor(url) {
    const hash = crypto.createHash("md5").update(url).digest("hex").slice(0, 12);
    return `${hash}.${extFromUrl(url)}`;
}

async function downloadAll(urls) {
    fs.mkdirSync(IMG_DIR, { recursive: true });
    const manifest = {};
    const list = [...urls];
    let idx = 0, ok = 0, fail = 0, skipped = 0;
    const CONCURRENCY = 5;

    function tryCurl(url, localPath) {
        try {
            execFileSync("curl", ["-sfL", "--max-time", "60", "-o", localPath, url], { stdio: "ignore" });
            return fs.existsSync(localPath) && fs.statSync(localPath).size > 0;
        } catch (err) { return false; }
    }

    async function worker() {
        while (idx < list.length) {
            const url = list[idx++];
            const localPath = path.join(IMG_DIR, localNameFor(url));
            manifest[url] = `img/${localNameFor(url)}`;
            if (fs.existsSync(localPath) && fs.statSync(localPath).size > 0) { skipped++; continue; }

            let success = false;
            for (let attempt = 0; attempt < 3 && !success; attempt++) {
                if (attempt > 0) await sleep(800 * attempt);
                try {
                    const res = await fetch(url, { signal: AbortSignal.timeout(45000) });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    fs.writeFileSync(localPath, Buffer.from(await res.arrayBuffer()));
                    success = true;
                } catch (err) { /* retry */ }
            }
            if (!success) success = tryCurl(url, localPath);
            if (success) ok++; else { fail++; console.error("FAILED:", url); }
            if ((ok + fail + skipped) % 50 === 0) console.log(`descargando… ok=${ok} fail=${fail} skip=${skipped} / ${list.length}`);
        }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    console.log(`Descargas: ok=${ok} fail=${fail} skip=${skipped} total=${list.length}`);
    return manifest;
}

function extractInlineImgSrcs(html) {
    const out = [];
    const re = /<img\b[^>]*?\ssrc\s*=\s*("([^"]*)"|'([^']*)')/gi;
    let m;
    while ((m = re.exec(html || ""))) {
        const url = m[2] !== undefined ? m[2] : m[3];
        if (url) out.push(url);
    }
    return out;
}
function rewriteInlineImgSrcs(html, manifest) {
    if (!html) return html;
    return html.replace(/(<img\b[^>]*?\ssrc\s*=\s*)("([^"]*)"|'([^']*)')/gi, (full, prefix, quoted, dUrl, sUrl) => {
        const url = dUrl !== undefined ? dUrl : sUrl;
        const local = manifest[url];
        if (!local) return full;
        const q = quoted.startsWith('"') ? '"' : "'";
        return `${prefix}${q}${local}${q}`;
    });
}
function normalizePlayerImagePath(img, manifest) {
    if (!img) return "";
    if (img.startsWith("data:")) return manifest[img] || img;
    if (/^https?:\/\//.test(img)) return manifest[img] || img;
    let clean = img.replace(/^\/+/, "");
    if (!clean.startsWith("assets/")) clean = `assets/images/players/${clean}`;
    // El archivo vive en archivo/<año>/, dos niveles por debajo de la raíz del repo donde
    // está assets/ — de ahí el "../../".
    return `../../${clean}`;
}

async function compressImages() {
    const sharp = require(path.join(REPO_ROOT, "node_modules", "sharp"));
    const files = fs.readdirSync(IMG_DIR).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
    console.log(`Comprimiendo ${files.length} imágenes...`);
    let before = 0, after = 0, idx = 0;
    const CONCURRENCY = 4;

    async function worker() {
        while (idx < files.length) {
            const f = files[idx++];
            const p = path.join(IMG_DIR, f);
            const origSize = fs.statSync(p).size;
            before += origSize;
            try {
                const buf = fs.readFileSync(p);
                const out = await sharp(buf, { failOn: "none" })
                    .rotate()
                    .resize({ width: 1600, withoutEnlargement: true })
                    .jpeg({ quality: 78, mozjpeg: true })
                    .toBuffer();
                if (out.length < origSize) { fs.writeFileSync(p, out); after += out.length; }
                else after += origSize;
            } catch (err) {
                after += origSize;
                console.error("no se pudo comprimir", f, err.message);
            }
        }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    console.log(`Compresión: ${(before / 1024 / 1024).toFixed(1)} MB -> ${(after / 1024 / 1024).toFixed(1)} MB`);
}

function decodeRemainingDataUris(rawJsonText) {
    // Jugadores añadidos con una imagen que nunca se subió a Storage se quedan como
    // data:image/...;base64,... embebido — se decodifica igual que cualquier otra foto.
    const re = /data:image\/([a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)/g;
    const seen = new Map();
    let m;
    while ((m = re.exec(rawJsonText))) {
        const full = m[0];
        if (seen.has(full)) continue;
        const subtype = m[1].toLowerCase().replace("jpeg", "jpg");
        const ext = /^[a-z0-9]{2,5}$/.test(subtype) ? subtype : "jpg";
        const buf = Buffer.from(m[2], "base64");
        const hash = crypto.createHash("md5").update(full).digest("hex").slice(0, 12);
        const fileName = `datauri-${hash}.${ext}`;
        fs.writeFileSync(path.join(IMG_DIR, fileName), buf);
        seen.set(full, `img/${fileName}`);
    }
    let out = rawJsonText;
    seen.forEach((localPath, dataUri) => { out = out.split(dataUri).join(localPath); });
    return out;
}

function updateYearsIndex(year) {
    const indexPath = path.join(ARCHIVE_ROOT, "index.html");
    if (!fs.existsSync(indexPath)) {
        console.warn("archivo/index.html no existe; no se pudo añadir el año automáticamente.");
        return;
    }
    let html = fs.readFileSync(indexPath, "utf8");
    if (html.includes(`href="${year}/"`)) {
        console.log(`archivo/index.html ya incluye ${year}.`);
        return;
    }
    const card = `    <a class="year-card" href="${year}/">\n` +
        `      <div class="year">${year}</div>\n` +
        `      <div class="year-sub">PSA Valencia Open ${year}</div>\n` +
        `      <div class="year-tag">Ver edición ↗</div>\n` +
        `    </a>\n`;
    html = html.replace('<div class="years-grid">\n', `<div class="years-grid">\n${card}`);
    fs.writeFileSync(indexPath, html);
    console.log(`archivo/index.html actualizado con ${year}.`);
}

async function main() {
    console.log(`Archivando edición ${YEAR}...`);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/site_content?select=*`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
    });
    if (!res.ok) throw new Error(`Supabase fetch failed: HTTP ${res.status}`);
    const row = (await res.json())[0];

    const headline = tryParse(row.headline);
    const intro = tryParse(row.intro) || [];
    const draw = tryParse(row.r1) || { title: "", rounds: [] };
    const players = tryParse(row.r2) || [];
    const news = tryParse(row.qf) || [];
    const galleries = tryParse(row.sf) || [];
    const youtubeUrl = row.youtube_url || "";

    const urlSet = new Set();
    galleries.forEach(g => (g.photos || []).forEach(p => { if (p.type !== "video" && p.src) urlSet.add(p.src); }));
    news.forEach(n => {
        if (n.imageSrc) urlSet.add(n.imageSrc);
        ["es", "va", "en", "fr"].forEach(lang => extractInlineImgSrcs(n.article?.[lang]).forEach(u => {
            if (/^https?:\/\//.test(u)) urlSet.add(u);
        }));
    });

    console.log(`Fotos a descargar: ${urlSet.size}`);
    const manifest = await downloadAll(urlSet);

    const outGalleries = galleries.map(g => ({
        id: g.id, title: g.title, meta: g.meta,
        photos: (g.photos || []).map(p => p.type === "video"
            ? { id: p.id, type: "video", videoUrl: p.videoUrl, caption: p.caption, meta: p.meta }
            : { id: p.id, type: "photo", src: manifest[p.src] || p.src, caption: p.caption, meta: p.meta })
    }));
    const outNews = news.map(n => ({
        id: n.id, title: n.title, imageSrc: manifest[n.imageSrc] || n.imageSrc,
        player: n.player, publishAt: n.publishAt, createdAt: n.createdAt, category: n.category, tags: n.tags,
        article: {
            es: rewriteInlineImgSrcs(n.article?.es, manifest),
            va: rewriteInlineImgSrcs(n.article?.va, manifest),
            en: rewriteInlineImgSrcs(n.article?.en, manifest),
            fr: rewriteInlineImgSrcs(n.article?.fr, manifest)
        }
    }));
    const outPlayers = players.map(p => ({
        id: p.id, name: p.name, country: p.country, ranking: p.ranking,
        image: normalizePlayerImagePath(p.image, manifest), seed: p.seed
    }));
    const outDraw = {
        title: draw.title,
        rounds: (draw.rounds || []).map(r => ({
            title: r.title,
            matches: (r.matches || []).map(m => ({
                p1: m.p1 ? { name: m.p1.name, image: normalizePlayerImagePath(m.p1.image, manifest) } : null,
                p2: m.p2 ? { name: m.p2.name, image: normalizePlayerImagePath(m.p2.image, manifest) } : null,
                date: m.date || ""
            }))
        }))
    };

    const data = {
        snapshotDate: new Date().toISOString(),
        headline, intro, draw: outDraw, players: outPlayers, news: outNews, galleries: outGalleries, youtubeUrl
    };

    let dataJson = JSON.stringify(data);
    dataJson = decodeRemainingDataUris(dataJson);
    if (dataJson.includes("</script")) {
        // Salvaguarda: si algún día un artículo contiene literalmente "</script", cortaría el
        // <script> a medias al incrustarlo en el HTML. Se escapa la barra para neutralizarlo.
        dataJson = dataJson.replace(/<\/script/gi, "<\\/script");
    }

    await compressImages();

    const html = fs.readFileSync(path.join(TEMPLATE_DIR, "index.html"), "utf8");
    const css = fs.readFileSync(path.join(TEMPLATE_DIR, "style.css"), "utf8");
    const appJs = fs.readFileSync(path.join(TEMPLATE_DIR, "app.js"), "utf8");

    const finalHtml = html
        .replace(/\{\{YEAR\}\}/g, YEAR)
        .replace("{{STYLE}}", css)
        .replace("{{SCRIPT_DATA}}", `window.ARCHIVE_DATA = ${dataJson};`)
        .replace("{{SCRIPT_APP}}", appJs);

    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, "index.html"), finalHtml);

    updateYearsIndex(YEAR);

    const imgFiles = fs.readdirSync(IMG_DIR);
    const totalMb = imgFiles.reduce((sum, f) => sum + fs.statSync(path.join(IMG_DIR, f)).size, 0) / 1024 / 1024;
    console.log(`\nListo: archivo/${YEAR}/index.html (${(finalHtml.length / 1024 / 1024).toFixed(2)} MB) + ${imgFiles.length} fotos (${totalMb.toFixed(1)} MB).`);
}

main().catch(err => { console.error("FALLÓ:", err); process.exit(1); });
