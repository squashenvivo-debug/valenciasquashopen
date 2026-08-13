/**
 * r2Client.js
 *
 * Cliente mínimo para subir objetos al bucket de Cloudflare R2 (compatible S3)
 * que sirve las fotos de galería al público. Solo se usa en el servidor
 * (nunca en el navegador): las claves de R2 viven exclusivamente en variables
 * de entorno de Vercel.
 */

"use strict";

const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

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

/** Sube un buffer al bucket configurado y devuelve la URL pública (R2_PUBLIC_URL). */
async function uploadToR2(objectKey, buffer, contentType) {
    const bucket = process.env.R2_BUCKET_NAME;
    const publicUrlBase = String(process.env.R2_PUBLIC_URL || "").replace(/\/+$/, "");
    if (!bucket) throw new Error("Falta R2_BUCKET_NAME en el servidor.");
    if (!publicUrlBase) throw new Error("Falta R2_PUBLIC_URL en el servidor.");

    const client = getClient();
    await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: buffer,
        ContentType: contentType || "image/jpeg",
        CacheControl: "public, max-age=31536000, immutable"
    }));

    return `${publicUrlBase}/${objectKey}`;
}

module.exports = { uploadToR2 };
