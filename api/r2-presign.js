/**
 * /api/r2-presign
 *
 * Las fotos de galería ya no pasan por Supabase Storage: el navegador las
 * redimensiona/comprime localmente (canvas) y las sube directamente a
 * Cloudflare R2 con una URL firmada de un solo uso que devuelve este
 * endpoint. R2 no cobra por transferencia de salida (egress) ni tiene la
 * cuota gratuita de 1 GB de Supabase Storage, que es lo que se estaba
 * agotando.
 */

"use strict";

const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { applyCors, verifySupabaseUser } = require("../lib/apiAuth");

const SIGNED_URL_TTL_SECONDS = 300;

function getClient() {
    const endpoint = process.env.R2_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    if (!endpoint || !accessKeyId || !secretAccessKey) {
        throw new Error("Faltan variables de entorno de R2 (R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY).");
    }

    return new S3Client({
        region: "auto",
        endpoint,
        credentials: { accessKeyId, secretAccessKey }
    });
}

function isValidObjectKey(value) {
    const key = String(value || "");
    if (!key || key.length > 300) return false;
    if (key.includes("..") || key.startsWith("/")) return false;
    return /^(gallery|news)\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/.test(key);
}

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
    const { objectKey, contentType } = body;
    if (!isValidObjectKey(objectKey)) {
        res.status(400).json({ success: false, error: "objectKey no válido." });
        return;
    }

    const bucket = process.env.R2_BUCKET_NAME;
    const publicUrlBase = String(process.env.R2_PUBLIC_URL || "").replace(/\/+$/, "");
    if (!bucket) {
        res.status(500).json({ success: false, error: "Falta R2_BUCKET_NAME en el servidor." });
        return;
    }
    if (!publicUrlBase) {
        res.status(500).json({ success: false, error: "Falta R2_PUBLIC_URL en el servidor." });
        return;
    }

    try {
        const client = getClient();
        const command = new PutObjectCommand({
            Bucket: bucket,
            Key: objectKey,
            ContentType: contentType || "image/jpeg",
            CacheControl: "public, max-age=31536000, immutable"
        });
        const uploadUrl = await getSignedUrl(client, command, { expiresIn: SIGNED_URL_TTL_SECONDS });

        res.status(200).json({
            success: true,
            uploadUrl,
            publicUrl: `${publicUrlBase}/${objectKey}`,
            headers: {
                "Content-Type": contentType || "image/jpeg",
                "Cache-Control": "public, max-age=31536000, immutable"
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error?.message || "No se pudo generar la URL de subida." });
    }
};
