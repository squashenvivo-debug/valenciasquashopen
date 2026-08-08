const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

type TournamentListItem = {
  id: number | string;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
  city?: string | null;
  country?: string | null;
  divisions?: Array<{
    id?: number | string;
    name?: string | null;
    level?: string | null;
    sub_level?: string | null;
  }>;
};

type TournamentPlayer = {
  id?: number | string;
  name?: string | null;
  country?: string | null;
  current_world_ranking?: number | null;
  profile_photo_url?: string | null;
  entry?: {
    seed_number?: number | null;
    status?: string | null;
    draw_type?: string | null;
    is_wildcard?: boolean | null;
  };
};

type TournamentMatch = {
  id?: number | string;
  round?: string | null;
  round_num?: number | null;
  match_num?: number | null;
  date?: string | null;
  time?: string | null;
  court?: string | null;
  court_id?: number | null;
  status?: string | null;
  best?: string | null;
  scoring?: string | null;
  duration_minutes?: number | null;
  streamed?: boolean | null;
  stream_url?: string | null;
  commentator_ids?: number[];
  head_to_head?: Record<string, unknown> | null;
  match_players?: Array<{
    id?: number | string;
    name?: string | null;
    games_won?: number | null;
  }>;
  result?: {
    winner_id?: number | string | null;
    retired?: boolean | null;
    walkover?: boolean | null;
    games?: Array<{
      num?: number | null;
      winner_id?: number | string | null;
      scores?: number[] | null;
    }>;
  };
};

type TournamentDivision = {
  id?: number | string;
  name?: string | null;
  gender?: string | null;
  level?: string | null;
  sub_level?: string | null;
  draw_size?: number | null;
  entries_count?: number | null;
  players?: TournamentPlayer[];
  brackets?: Array<{
    id?: number | string;
    name?: string | null;
    format?: string | null;
    size?: number | null;
    best_of?: number | null;
    scoring_system?: string | null;
    matches?: TournamentMatch[];
  }>;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=30",
    },
  });
}

function readPsaApiKey() {
  return String(
    Deno.env.get("PSA_API_KEY") ||
    Deno.env.get("PSA_TOURNAMENTS_API_KEY") ||
    "",
  ).trim();
}

function readApiBaseUrl() {
  return String(Deno.env.get("PSA_API_BASE_URL") || "https://data.psasquashtour.com").replace(/\/$/, "");
}

function normalizeMatchIds(value: unknown) {
  if (!Array.isArray(value)) return [] as Array<number | string>;

  const ids = value
    .map((item) => {
      if (typeof item === "number" || typeof item === "string") return item;
      if (item && typeof item === "object" && "id" in item) {
        const raw = (item as { id?: unknown }).id;
        if (typeof raw === "number" || typeof raw === "string") return raw;
      }
      return null;
    })
    .filter((item): item is number | string => item !== null)
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0);

  return Array.from(new Set(ids)).map((item) => (/^\d+$/.test(item) ? Number(item) : item));
}

async function subscribeMatches(matchIds: Array<number | string>) {
  const apiKey = readPsaApiKey();
  if (!apiKey) {
    throw new Error("Falta el secreto PSA_API_KEY en la funcion psa-proxy.");
  }

  if (!matchIds.length) {
    throw new Error("No se recibieron match_ids para suscripcion.");
  }

  const baseUrl = readApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/v1/matches/subscribe`, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ match_ids: matchIds }),
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch (_error) {
    payload = text;
  }

  if (!response.ok) {
    throw new Error(`PSA subscribe respondio ${response.status}: ${String(text).slice(0, 400)}`);
  }

  return payload;
}

function toBoolean(value: string | null, fallback = false) {
  if (value === null) return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function toLimit(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function buildQuery(searchParams: URLSearchParams, keys: string[]) {
  const query = new URLSearchParams();
  keys.forEach((key) => {
    const value = searchParams.get(key);
    if (value !== null && String(value).trim() !== "") {
      query.set(key, value);
    }
  });
  return query;
}

async function fetchPsa(path: string, query: URLSearchParams) {
  const apiKey = readPsaApiKey();
  if (!apiKey) {
    throw new Error("Falta el secreto PSA_API_KEY en la funcion psa-proxy.");
  }

  const baseUrl = readApiBaseUrl();
  const url = `${baseUrl}${path}${query.toString() ? `?${query.toString()}` : ""}`;
  const response = await fetch(url, {
    headers: {
      "X-Api-Key": apiKey,
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PSA respondio ${response.status}: ${text.slice(0, 400)}`);
  }

  return response.json();
}

function parseMatchDate(match: TournamentMatch) {
  const date = String(match?.date || "").trim();
  const time = String(match?.time || "").trim();
  if (!date) return null;
  const iso = time ? `${date}T${time}` : `${date}T00:00:00`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sortMatchesAscending(a: Record<string, unknown>, b: Record<string, unknown>) {
  const aDate = a.sort_time instanceof Date ? a.sort_time.getTime() : Number.POSITIVE_INFINITY;
  const bDate = b.sort_time instanceof Date ? b.sort_time.getTime() : Number.POSITIVE_INFINITY;
  return aDate - bDate;
}

function sortMatchesDescending(a: Record<string, unknown>, b: Record<string, unknown>) {
  return sortMatchesAscending(b, a);
}

function simplifyTournamentList(items: TournamentListItem[]) {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    start_date: item.start_date || null,
    end_date: item.end_date || null,
    status: item.status || null,
    city: item.city || null,
    country: item.country || null,
    divisions: Array.isArray(item.divisions)
      ? item.divisions.map((division) => ({
          id: division.id || null,
          name: division.name || null,
          level: division.level || null,
          sub_level: division.sub_level || null,
        }))
      : [],
  }));
}

function simplifyMatch(match: TournamentMatch, division: TournamentDivision, bracketName: string, tournamentStreamUrl: string | null) {
  const sortTime = parseMatchDate(match);
  const rawPlayers = Array.isArray(match.match_players) && match.match_players.length > 0
    ? match.match_players
    : (Array.isArray((match as unknown as { players?: Array<{ id?: number | string; name?: string; games_won?: number }> }).players)
        ? (match as unknown as { players: Array<{ id?: number | string; name?: string; games_won?: number }> }).players
        : []);

  const players = rawPlayers.map((player) => ({
    id: player.id ?? null,
    name: player.name || null,
    games_won: player.games_won ?? null,
  }));

  return {
    id: match.id ?? null,
    division: division.name || null,
    bracket: bracketName || null,
    round: match.round || null,
    round_num: match.round_num ?? null,
    match_num: match.match_num ?? null,
    status: match.status || null,
    date: match.date || null,
    time: match.time || null,
    court: match.court || null,
    court_id: match.court_id ?? null,
    best: match.best || null,
    scoring: match.scoring || null,
    duration_minutes: match.duration_minutes ?? null,
    streamed: Boolean(match.streamed || match.stream_url || tournamentStreamUrl),
    stream_url: match.stream_url || tournamentStreamUrl || null,
    bye: Boolean((match as unknown as { bye?: boolean }).bye),
    players,
    scoreline: players.length === 2
      ? `${players[0].games_won ?? 0}-${players[1].games_won ?? 0}`
      : null,
    winner_id: match.result?.winner_id ?? null,
    retired: Boolean(match.result?.retired),
    walkover: Boolean(match.result?.walkover),
    games: Array.isArray(match.result?.games) ? match.result?.games : [],
    commentator_ids: Array.isArray(match.commentator_ids) ? match.commentator_ids : [],
    head_to_head: match.head_to_head || null,
    sort_time: sortTime,
  };
}

function simplifyDivision(division: TournamentDivision, tournamentStreamUrl: string | null) {
  const brackets = Array.isArray(division.brackets) ? division.brackets : [];
  const players = Array.isArray(division.players) ? division.players : [];

  return {
    id: division.id ?? null,
    name: division.name || null,
    gender: division.gender || null,
    level: division.level || null,
    sub_level: division.sub_level || null,
    draw_size: division.draw_size ?? null,
    entries_count: division.entries_count ?? null,
    players: players.map((player) => ({
      id: player.id ?? null,
      name: player.name || null,
      country: player.country || null,
      current_world_ranking: player.current_world_ranking ?? null,
      profile_photo_url: player.profile_photo_url || null,
      entry: {
        seed_number: player.entry?.seed_number ?? null,
        draw_type: player.entry?.draw_type || null,
        status: player.entry?.status || null,
        is_wildcard: Boolean(player.entry?.is_wildcard),
      },
    })),
    brackets: brackets.map((bracket) => ({
      id: bracket.id ?? null,
      name: bracket.name || null,
      format: bracket.format || null,
      size: bracket.size ?? null,
      best_of: bracket.best_of ?? null,
      scoring_system: bracket.scoring_system || null,
      matches_count: Array.isArray(bracket.matches) ? bracket.matches.length : 0,
      matches: Array.isArray(bracket.matches)
        ? bracket.matches.map((match) => simplifyMatch(match, division, String(bracket.name || ""), tournamentStreamUrl))
        : [],
    })),
  };
}

function flattenMatches(divisions: ReturnType<typeof simplifyDivision>[]) {
  const matches = divisions.flatMap((division) => division.brackets.flatMap((bracket) => bracket.matches));
  const seenIds = new Set<string | number>();
  const uniqueMatches: typeof matches = [];
  for (const m of matches) {
    if (m.bye) continue;
    if (!Array.isArray(m.players) || m.players.length < 2) continue;
    const p1 = String(m.players[0]?.name || "").trim().toLowerCase();
    const p2 = String(m.players[1]?.name || "").trim().toLowerCase();
    if (!p1 || !p2 || p1 === "tbd" || p2 === "tbd" || p1 === "bye" || p2 === "bye" || p1.startsWith("tbd") || p2.startsWith("bye")) continue;

    if (m.id !== null && m.id !== undefined) {
      if (seenIds.has(m.id)) continue;
      seenIds.add(m.id);
    }
    uniqueMatches.push(m);
  }
  return uniqueMatches;
}

function stripSortTime(match: Record<string, unknown>) {
  const { sort_time: _sortTime, ...rest } = match;
  return rest;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "POST") {
    try {
      const body = await req.json().catch(() => ({}));
      const action = String((body as { action?: unknown })?.action || "").trim().toLowerCase();
      const userApiKey = String((body as { apiKey?: unknown; api_key?: unknown }).apiKey || (body as { api_key?: unknown }).api_key || readPsaApiKey()).trim();
      const baseUrl = readApiBaseUrl();

      if (action === "subscribe" || (body as { endpoint_url?: unknown }).endpoint_url) {
        const endpointUrl = String((body as { endpoint_url?: unknown }).endpoint_url || "").trim();
        const apiKeyHeaderName = String((body as { api_key_header_name?: unknown }).api_key_header_name || "x-api-key").trim();
        const useSportyIds = Boolean((body as { use_sporty_ids?: unknown }).use_sporty_ids);

        if (!userApiKey) {
          return json({ success: false, error: "Falta API Key de PSA para realizar la suscripcion." }, 400);
        }

        const response = await fetch(`${baseUrl}/api/v1/matches/subscribe`, {
          method: "POST",
          headers: {
            "X-Api-Key": userApiKey,
            "Accept": "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            endpoint_url: endpointUrl,
            use_sporty_ids: useSportyIds,
            api_key: userApiKey,
            api_key_header_name: apiKeyHeaderName
          }),
        });

        const text = await response.text();
        let payload: unknown = null;
        try {
          payload = text ? JSON.parse(text) : null;
        } catch (_err) {
          payload = text;
        }

        return json({
          success: response.ok,
          status: response.status,
          mode: "subscribe",
          fetched_at: new Date().toISOString(),
          data: payload
        }, response.ok ? 200 : response.status);
      }

      const matchIds = normalizeMatchIds(
        (body as { match_ids?: unknown; matches?: unknown; matchIds?: unknown }).match_ids ||
          (body as { matches?: unknown }).matches ||
          (body as { matchIds?: unknown }).matchIds,
      );

      if (!matchIds.length) {
        return json({ success: false, error: "Debes enviar match_ids o endpoint_url para suscripcion." }, 400);
      }

      const subscribePayload = await subscribeMatches(matchIds);

      return json({
        success: true,
        mode: "subscribe",
        requested_match_ids: matchIds,
        subscribed_count: matchIds.length,
        fetched_at: new Date().toISOString(),
        psa: subscribePayload,
      });
    } catch (error) {
      return json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Error inesperado suscribiendo live scores.",
        },
        500,
      );
    }
  }

  if (req.method === "DELETE") {
    try {
      const url = new URL(req.url);
      const userApiKey = String(url.searchParams.get("apiKey") || readPsaApiKey()).trim();
      const baseUrl = readApiBaseUrl();

      if (!userApiKey) {
        return json({ success: false, error: "Falta API Key de PSA para cancelar la suscripcion." }, 400);
      }

      const response = await fetch(`${baseUrl}/api/v1/matches/subscription`, {
        method: "DELETE",
        headers: {
          "X-Api-Key": userApiKey,
          "Accept": "application/json"
        }
      });

      const text = await response.text();
      let payload: unknown = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch (_err) {
        payload = text;
      }

      return json({
        success: response.ok,
        status: response.status,
        mode: "unsubscribe",
        fetched_at: new Date().toISOString(),
        data: payload
      }, response.ok ? 200 : response.status);
    } catch (error) {
      return json({ success: false, error: error instanceof Error ? error.message : "Error al cancelar." }, 500);
    }
  }

  if (req.method !== "GET") {
    return json({ error: "Metodo no permitido." }, 405);
  }

  try {
    const url = new URL(req.url);
    const action = String(url.searchParams.get("action") || "").trim().toLowerCase();

    if (action === "subscription-status") {
      const userApiKey = String(url.searchParams.get("apiKey") || readPsaApiKey()).trim();
      const baseUrl = readApiBaseUrl();

      if (!userApiKey) {
        return json({ success: false, error: "Falta API Key de PSA para consultar el estado." }, 400);
      }

      const response = await fetch(`${baseUrl}/api/v1/matches/subscription`, {
        method: "GET",
        headers: {
          "X-Api-Key": userApiKey,
          "Accept": "application/json"
        }
      });

      const text = await response.text();
      let payload: unknown = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch (_err) {
        payload = text;
      }

      return json({
        success: response.ok,
        status: response.status,
        mode: "subscription-status",
        fetched_at: new Date().toISOString(),
        data: payload
      }, response.ok ? 200 : response.status);
    }

    const tournament = String(url.searchParams.get("tournament") || "").trim();
    const expanded = toBoolean(url.searchParams.get("expanded"), true);
    const includeDivisions = toBoolean(url.searchParams.get("include_divisions"), true);

    const listQuery = buildQuery(url.searchParams, [
      "search",
      "level",
      "sublevel",
      "status",
      "start_date",
      "end_date",
      "dizplai",
      "sportradar",
      "redzone",
      "squashlevels",
      "squashtv",
      "tnt_sports",
      "supersports",
      "skysports_nz",
      "squashref",
    ]);
    listQuery.set("show_past", toBoolean(url.searchParams.get("show_past"), false) ? "true" : "false");
    listQuery.set("limit", String(toLimit(url.searchParams.get("limit"), 10, 100)));
    listQuery.set("include_divisions", includeDivisions ? "true" : "false");

    const listPayload = await fetchPsa("/api/v1/tournaments", listQuery);
    const listItems = Array.isArray(listPayload?.psa?.tournaments) ? listPayload.psa.tournaments : [];

    if (!tournament) {
      return json({
        success: true,
        mode: "list",
        fetched_at: new Date().toISOString(),
        source: {
          api: listPayload?.api || null,
          timestamp: listPayload?.timestamp || null,
        },
        tournaments: simplifyTournamentList(listItems),
      });
    }

    const detailQuery = new URLSearchParams();
    if (expanded && toBoolean(url.searchParams.get("head_to_head"), false)) {
      detailQuery.set("head_to_head", "true");
    }

    const detailPath = expanded
      ? `/api/v1/tournaments/${encodeURIComponent(tournament)}/expanded`
      : `/api/v1/tournaments/${encodeURIComponent(tournament)}`;

    const detailPayload = await fetchPsa(detailPath, detailQuery);
    const tournamentData = detailPayload?.psa?.tournament;
    const rawDivisions = Array.isArray(detailPayload?.psa?.divisions) ? detailPayload.psa.divisions : [];
    const tournamentStreamUrl = tournamentData?.stream_url || null;
    const divisions = rawDivisions.map((division: TournamentDivision) => simplifyDivision(division, tournamentStreamUrl));
    const allMatches = flattenMatches(divisions);

    const inProgress = allMatches
      .filter((match) => match.status === "in_progress")
      .sort(sortMatchesAscending)
      .map(stripSortTime);

    const upcoming = allMatches
      .filter((match) => match.status === "scheduled")
      .sort(sortMatchesAscending)
      .slice(0, 12)
      .map(stripSortTime);

    const completed = allMatches
      .filter((match) => ["completed", "retired", "walkover"].includes(String(match.status || "")))
      .sort(sortMatchesDescending)
      .slice(0, 12)
      .map(stripSortTime);

    return json({
      success: true,
      mode: "detail",
      fetched_at: new Date().toISOString(),
      source: {
        api: detailPayload?.api || null,
        timestamp: detailPayload?.timestamp || null,
        expanded,
      },
      tournament: tournamentData
        ? {
            id: tournamentData.id ?? null,
            name: tournamentData.name || null,
            status: tournamentData.status || null,
            stream_url: tournamentData.stream_url || null,
            dates: tournamentData.dates || null,
            location: tournamentData.location || null,
            metadata: tournamentData.metadata || null,
            title_sponsor: tournamentData.title_sponsor || null,
            commentators: Array.isArray(tournamentData.commentators) ? tournamentData.commentators : [],
          }
        : null,
      summary: detailPayload?.psa?.summary || detailPayload?.summary || null,
      divisions,
      live: {
        in_progress: inProgress,
        upcoming,
        completed,
      },
      tournaments: simplifyTournamentList(listItems).slice(0, 10),
    });
  } catch (error) {
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Error inesperado consultando PSA.",
    }, 500);
  }
});