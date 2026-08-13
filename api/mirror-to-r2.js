/**
 * /api/mirror-to-r2
 *
 * El admin sigue subiendo fotos a Supabase Storage exactamente igual que
 * siempre (subida por trozos, reanudable — no se toca). Este endpoint se
 * llama DESPUÉS de esa subida: descarga la foto ya subida, la redimensiona/
 * comprime aquí en el servidor (sharp) y la sube a Cloudflare R2, que es lo
 * que de verdad sirve la web al público — R2 no cobra por transferencia de
 * salida (egress), a diferencia de Supabase Storage, que es justo lo que
 * estaba agotando la cuota gratuita.
 *
 * Supabase Storage se queda como el "original" (lo usa la IA de procesado de
 * fotos ya existente); R2 es solo la copia optimizada que ve el visitante.
 */

"use strict";

const sharp = require("sharp");
const { applyCors, verifySupabaseUser } = require("../lib/apiAuth");
const { uploadToR2 } = require("../lib/r2Client");

const MAX_WIDTH = 2000;
const JPEG_QUALITY = 82;

module.exports = async function handler(req, res) {
    applyCors(req, res);

    if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
    }

    if (req.method !== "POST") {
        res.status(405).json({ success: false, error: "Método no permitido." });
        return;
    }

    const authHeader = String(req.headers.authorization || "");
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const user = await verifySupabaseUser(token);
    if (!user?.id) {
        res.status(401).json({ success: false, error: "Sesión no válida. Inicia sesión en el panel admin de nuevo." });
        return;
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const { sourceUrl, objectKey } = body;
    if (!sourceUrl || !objectKey) {
        res.status(400).json({ success: false, error: "Faltan sourceUrl u objectKey." });
        return;
    }

    try {
        const sourceResponse = await fetch(sourceUrl);
        if (!sourceResponse.ok) {
            throw new Error(`No se pudo descargar la imagen original (HTTP ${sourceResponse.status}).`);
        }
        const originalBuffer = Buffer.from(await sourceResponse.arrayBuffer());

        const resizedBuffer = await sharp(originalBuffer)
            .rotate()
            .resize({ width: MAX_WIDTH, withoutEnlargement: true })
            .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
            .toBuffer();

        const cleanKey = String(objectKey).replace(/^\/+/, "").replace(/\.[a-z0-9]+$/i, "") + ".jpg";
        const publicUrl = await uploadToR2(cleanKey, resizedBuffer, "image/jpeg");

        res.status(200).json({
            success: true,
            publicUrl,
            originalBytes: originalBuffer.length,
            optimizedBytes: resizedBuffer.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error?.message || "Error al copiar la imagen a R2." });
    }
};
