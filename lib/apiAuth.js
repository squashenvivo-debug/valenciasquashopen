/**
 * apiAuth.js
 *
 * CORS y verificación de sesión compartidas por todos los endpoints de
 * /api (generate-news, refine-news...). Un único sitio para esta lógica
 * evita que los distintos endpoints diverjan en cómo protegen el acceso.
 */

"use strict";

// Ajusta esta lista (o usa la env var ALLOWED_ORIGINS) a los orígenes reales desde los que se llamará al endpoint.
const DEFAULT_ALLOWED_ORIGINS = [
    "https://psavalenciaopen.com",
    "https://www.psavalenciaopen.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5500",
    "http://127.0.0.1:5500"
];

function getAllowedOrigins() {
    const fromEnv = String(process.env.ALLOWED_ORIGINS || "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
    return fromEnv.length > 0 ? fromEnv : DEFAULT_ALLOWED_ORIGINS;
}

function applyCors(req, res) {
    const origin = req.headers.origin || "";
    const allowed = getAllowedOrigins();
    if (allowed.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
    }
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

/** Verifica el token de sesión de Supabase que ya usa el panel admin (window.AdminSupabase.getAccessToken()). */
async function verifySupabaseUser(token) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey || !token) return null;

    try {
        const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: { Authorization: `Bearer ${token}`, apikey: anonKey }
        });
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        return null;
    }
}

/** Aplica CORS, exige POST y una sesión válida. Devuelve el usuario autenticado, o null si ya respondió con un error. */
async function guardRequest(req, res) {
    applyCors(req, res);

    if (req.method === "OPTIONS") {
        res.status(204).end();
        return null;
    }

    if (req.method !== "POST") {
        res.status(405).json({ success: false, error: "Método no permitido." });
        return null;
    }

    if (!process.env.OPENAI_API_KEY) {
        res.status(500).json({ success: false, error: "El servidor no tiene configurada OPENAI_API_KEY." });
        return null;
    }

    const authHeader = String(req.headers.authorization || "");
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const user = await verifySupabaseUser(token);
    if (!user?.id) {
        res.status(401).json({ success: false, error: "Sesión no válida. Inicia sesión en el panel admin de nuevo." });
        return null;
    }

    return user;
}

module.exports = { applyCors, verifySupabaseUser, guardRequest };
