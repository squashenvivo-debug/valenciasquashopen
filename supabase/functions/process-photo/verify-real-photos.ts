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

type VerificationResult = {
  file: string;
  approved: boolean;
  detection: SceneReport;
  quality: SceneReport;
  outputPath: string;
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
if (!OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY no está definido.");
  Deno.exit(1);
}

const repoRoot = new URL("../../../", import.meta.url);
const outputDir = new URL("./_qa-output/", import.meta.url);
await Deno.mkdir(outputDir, { recursive: true });

const defaultPhotos = [
  "assets/images/players/player-01.jpg",
  "assets/images/players/player-08.jpg",
  "assets/images/players/player-16.jpg",
  "assets/images/sponsors/sponsor-01.jpg",
  "assets/images/sponsors/sponsor-06.jpg",
  "assets/images/hero/chimo.jpeg",
  "assets/images/hero/banner.png",
  "assets/images/logos/psa.png",
];

const selected = Deno.args.length > 0 ? Deno.args : defaultPhotos;

function contentTypeFromPath(path: string) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
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

async function openAiJson(prompt: string, imageUrls: string[]): Promise<SceneReport> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: [{
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              prompt,
              "Devuelve exclusivamente JSON con player_detected, ball_detected, sponsor_or_logo_visible, sponsor_or_logo_preserved, player_confidence, ball_confidence, sponsor_or_logo_confidence, quality_ok y notes.",
              "Las confianzas son decimales entre 0 y 1.",
            ].join("\n"),
          },
          ...imageUrls.map((image_url) => ({ type: "input_image", image_url, detail: "high" })),
        ],
      }],
    }),
  });
  if (!response.ok) throw new Error(`Detección IA falló (${response.status}).`);
  const payload = await response.json();
  const parsed = JSON.parse(extractJsonObject(responseText(payload)));
  return toSceneReport(parsed);
}

async function editImage(fileBytes: Uint8Array, contentType: string) {
  const fileBuffer = Uint8Array.from(fileBytes).buffer;
  const form = new FormData();
  form.append("model", "gpt-image-1");
  form.append("image", new File([fileBuffer], "input", { type: contentType }));
  form.append("output_format", "webp");
  form.append("input_fidelity", "high");
  form.append("prompt", [
    "Professional sports photo restoration only.",
    "Correct backlighting naturally, reduce digital noise, and improve sharpness modestly.",
    "Do not crop, add, remove, move, redraw, or alter people, the ball, uniforms, sponsors, logos, text, scoreboards, or branding.",
    "Preserve the exact composition and all visible sponsor marks and logos.",
    "Avoid halos, over-smoothing, fake textures, and color shifts.",
  ].join(" "));

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  if (!response.ok) throw new Error(`Edición IA falló (${response.status}).`);
  const payload = await response.json();
  const b64 = payload?.data?.[0]?.b64_json;
  if (!b64) throw new Error("La IA no devolvió imagen procesada.");
  return b64;
}

function approvedByQuality(before: SceneReport, after: SceneReport) {
  return after.quality_ok
    && (!before.player_detected || after.player_detected)
    && (!before.ball_detected || after.ball_detected)
    && (!before.sponsor_or_logo_visible || after.sponsor_or_logo_preserved === true);
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function verifyOne(relPath: string): Promise<VerificationResult> {
  const absolute = new URL(relPath, repoRoot);
  const fileBytes = await Deno.readFile(absolute);
  const contentType = contentTypeFromPath(relPath);
  const originalDataUrl = `data:${contentType};base64,${bytesToBase64(fileBytes)}`;

  const detection = await openAiJson(
    "Analiza esta fotografía deportiva. Detecta si hay al menos un jugador y una pelota. Indica si aparecen patrocinadores o logotipos visibles.",
    [originalDataUrl],
  );

  const editedB64 = await editImage(fileBytes, contentType);
  const quality = await openAiJson(
    "Compara estas dos imágenes deportivas: la primera es original y la segunda es procesada. quality_ok DEBE ser false si la segunda cambia identidad, rostro, pelo, cuerpo, pose, encuadre, recorte, perspectiva, ropa, jugador, pelota, texto, letras, patrocinadores, logotipos, marcadores o cualquier objeto. Solo acepta mejoras conservadoras de luz, ruido o nitidez sin artefactos. Confirma que jugador, pelota y todos los patrocinadores/logotipos visibles se mantienen sin cambios.",
    [originalDataUrl, `data:image/webp;base64,${editedB64}`],
  );

  const approved = approvedByQuality(detection, quality);
  const safeName = relPath.replace(/[\\/]/g, "_").replace(/[^a-zA-Z0-9_.-]/g, "_");
  const outUrl = new URL(`${safeName}.webp`, outputDir);
  const outBytes = Uint8Array.from(atob(editedB64), (c) => c.charCodeAt(0));
  await Deno.writeFile(outUrl, outBytes);

  return {
    file: relPath,
    approved,
    detection,
    quality,
    outputPath: outUrl.pathname,
  };
}

const results: VerificationResult[] = [];
for (const relPath of selected) {
  try {
    const result = await verifyOne(relPath);
    results.push(result);
    console.log(`[OK] ${relPath} -> approved=${result.approved}`);
  } catch (error) {
    console.error(`[ERROR] ${relPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const approvedCount = results.filter((r) => r.approved).length;
console.log("\nResumen QA Fase 3");
console.log(`Total verificados: ${results.length}`);
console.log(`Aprobados: ${approvedCount}`);
console.log(`No aprobados: ${results.length - approvedCount}`);
console.log("Detalles:");
for (const item of results) {
  console.log(JSON.stringify({
    file: item.file,
    approved: item.approved,
    detection: item.detection,
    quality: item.quality,
    outputPath: item.outputPath,
  }));
}
