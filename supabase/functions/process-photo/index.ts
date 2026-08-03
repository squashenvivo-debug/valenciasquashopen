import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

type SceneReport = {
  player_detected: boolean;
  ball_detected: boolean;
  sponsor_or_logo_visible: boolean;
  sponsor_or_logo_preserved?: boolean;
  player_confidence?: number;
  ball_confidence?: number;
  sponsor_or_logo_confidence?: number;
  quality_ok: boolean;
  notes: string;
};

type EnhancementCandidate = {
  processedPath: string;
  signedUrl: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getSecretKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const keys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!keys) return "";
  try { return JSON.parse(keys).default || ""; } catch { return ""; }
}

function clampConfidence(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function extractJsonObject(raw: string) {
  const stripped = raw.replace(/^```json\s*|\s*```$/g, "").trim();
  const first = stripped.indexOf("{");
  const last = stripped.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return "{}";
  return stripped.slice(first, last + 1);
}

function responseText(payload: any) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text;
  const out = Array.isArray(payload?.output) ? payload.output : [];
  for (const item of out) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (part?.type === "output_text" && typeof part?.text === "string") return part.text;
      if (typeof part?.text === "string") return part.text;
    }
  }
  return "{}";
}

function toSceneReport(parsed: any): SceneReport {
  return {
    player_detected: Boolean(parsed?.player_detected),
    ball_detected: Boolean(parsed?.ball_detected),
    sponsor_or_logo_visible: Boolean(parsed?.sponsor_or_logo_visible),
    sponsor_or_logo_preserved: parsed?.sponsor_or_logo_preserved === undefined
      ? undefined
      : Boolean(parsed?.sponsor_or_logo_preserved),
    player_confidence: clampConfidence(parsed?.player_confidence),
    ball_confidence: clampConfidence(parsed?.ball_confidence),
    sponsor_or_logo_confidence: clampConfidence(parsed?.sponsor_or_logo_confidence),
    quality_ok: Boolean(parsed?.quality_ok),
    notes: String(parsed?.notes || ""),
  };
}

async function openAiJson(apiKey: string, prompt: string, imageUrls: string[]): Promise<SceneReport> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: [{ role: "user", content: [
        {
          type: "input_text",
          text: [
            prompt,
            "Devuelve exclusivamente JSON con player_detected, ball_detected, sponsor_or_logo_visible, sponsor_or_logo_preserved, player_confidence, ball_confidence, sponsor_or_logo_confidence, quality_ok y notes.",
            "Las confianzas son decimales entre 0 y 1.",
          ].join("\n"),
        },
        ...imageUrls.map((image_url) => ({ type: "input_image", image_url, detail: "high" })),
      ] }],
    }),
  });
  if (!response.ok) throw new Error(`La detección IA falló (${response.status}).`);
  const payload = await response.json();
  const parsed = JSON.parse(extractJsonObject(responseText(payload)));
  return toSceneReport(parsed);
}

async function enhanceAndUpload(
  admin: SupabaseClient,
  openAiKey: string,
  original: Blob,
): Promise<EnhancementCandidate> {
  const editForm = new FormData();
  editForm.append("model", "gpt-image-1");
  editForm.append("image", new File([original], "original", { type: original.type || "image/jpeg" }));
  editForm.append("output_format", "webp");
  editForm.append("input_fidelity", "high");
  editForm.append("prompt", [
    "Professional sports photo restoration only.",
    "Correct backlighting naturally, reduce digital noise, and improve sharpness modestly.",
    "Do not crop, add, remove, move, redraw, or alter people, the ball, uniforms, sponsors, logos, text, scoreboards, or branding.",
    "Preserve the exact composition and all visible sponsor marks and logos.",
    "Avoid halos, over-smoothing, fake textures, and color shifts.",
  ].join(" "));

  const editResponse = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { "Authorization": `Bearer ${openAiKey}` },
    body: editForm,
  });
  if (!editResponse.ok) throw new Error(`La mejora IA falló (${editResponse.status}).`);

  const editPayload = await editResponse.json();
  const encoded = editPayload.data?.[0]?.b64_json;
  if (!encoded) throw new Error("La IA no devolvió una imagen procesada.");

  const processedPath = `gallery/${crypto.randomUUID()}.webp`;
  const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
  const { error: uploadError } = await admin.storage.from("processed").upload(processedPath, bytes, {
    contentType: "image/webp",
    upsert: false,
  });
  if (uploadError) throw new Error("No se pudo guardar el resultado procesado.");

  const { data: signed, error: signedError } = await admin.storage.from("processed").createSignedUrl(processedPath, 600);
  if (signedError || !signed?.signedUrl) {
    await admin.storage.from("processed").remove([processedPath]);
    throw new Error("No se pudo verificar el resultado.");
  }
  return { processedPath, signedUrl: signed.signedUrl };
}

function approvedByQuality(before: SceneReport, after: SceneReport) {
  return after.quality_ok
    && (!before.player_detected || after.player_detected)
    && (!before.ball_detected || after.ball_detected)
    && (!before.sponsor_or_logo_visible || after.sponsor_or_logo_preserved === true);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  try {
    const authorization = req.headers.get("Authorization") || "";
    const jwt = authorization.replace(/^Bearer\s+/i, "");
    const url = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = getSecretKey();
    const openAiKey = Deno.env.get("OPENAI_API_KEY") || "";
    if (!url || !serviceKey || !openAiKey) return json({ error: "Faltan secretos de la función." }, 500);
    if (!jwt) return json({ error: "Sesión requerida." }, 401);

    const admin = createClient(url, serviceKey);
    const { data: userData, error: userError } = await admin.auth.getUser(jwt);
    if (userError || !userData.user) return json({ error: "Sesión no válida." }, 401);
    const { data: roles, error: roleError } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id);
    if (roleError || !(roles || []).some((item) => ["administrator", "photographer"].includes(item.role))) {
      return json({ error: "Solo administradores y fotógrafos pueden procesar fotos." }, 403);
    }

    const { sourcePath } = await req.json();
    if (typeof sourcePath !== "string" || !sourcePath.startsWith("gallery/") || sourcePath.includes("..")) {
      return json({ error: "Ruta de fotografía no válida." }, 400);
    }

    const { data: original, error: downloadError } = await admin.storage.from("photos").download(sourcePath);
    if (downloadError || !original) throw new Error("No se pudo leer la foto original.");
    if (original.size > 25 * 1024 * 1024) return json({ error: "La IA admite fotos de hasta 25 MiB." }, 413);

    const { data: signedOriginal, error: signedError } = await admin.storage.from("photos").createSignedUrl(sourcePath, 600);
    if (signedError || !signedOriginal?.signedUrl) throw new Error("No se pudo preparar la foto para IA.");
    const before = await openAiJson(
      openAiKey,
      "Analiza esta fotografía deportiva. Detecta si hay al menos un jugador y una pelota. Indica si aparecen patrocinadores o logotipos visibles.",
      [signedOriginal.signedUrl],
    );

    const maxAttempts = 2;
    let selectedPath = "";
    let selectedUrl = "";
    let latestQuality: SceneReport | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const candidate = await enhanceAndUpload(admin, openAiKey, original);
      const after = await openAiJson(
        openAiKey,
        "Compara estas dos imágenes deportivas: la primera es original y la segunda es procesada. quality_ok DEBE ser false si la segunda cambia identidad, rostro, pelo, cuerpo, pose, encuadre, recorte, perspectiva, ropa, jugador, pelota, texto, letras, patrocinadores, logotipos, marcadores o cualquier objeto. Solo acepta mejoras conservadoras de luz, ruido o nitidez sin artefactos. Confirma que jugador, pelota y todos los patrocinadores/logotipos visibles se mantienen sin cambios.",
        [signedOriginal.signedUrl, candidate.signedUrl],
      );
      latestQuality = after;

      if (approvedByQuality(before, after)) {
        const { data: publicUrl } = admin.storage.from("processed").getPublicUrl(candidate.processedPath);
        selectedPath = candidate.processedPath;
        selectedUrl = publicUrl.publicUrl;
        break;
      }

      await admin.storage.from("processed").remove([candidate.processedPath]);
    }

    if (!selectedPath || !latestQuality) {
      return json({
        error: "Control de calidad IA no aprobado; se conserva la original.",
        detection: before,
        quality: latestQuality,
      }, 422);
    }

    return json({
      processedPath: selectedPath,
      processedUrl: selectedUrl,
      detection: before,
      quality: latestQuality,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Error procesando la foto." }, 500);
  }
});
