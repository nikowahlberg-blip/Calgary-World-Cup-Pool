// Proxies football-data.org API requests so the static site (GitHub Pages)
// can call them without hitting football-data.org's CORS restrictions.
// The API key lives only here as a Cloudflare secret, never in the browser.
//
// Also serves /pool/* routes backed by Workers KV — this is the shared
// pool state (players, picks, results, locks) so everyone's picks and
// the admin's results sync across devices instead of living only in
// each browser's localStorage.

const STATE_KEY = "pool_state";

const EMPTY_STATE = () => ({
  players: [],
  phase: "group",
  groupResults: {},
  groupStandings: {},
  bracketTeams: [],
  koResults: {},
  goldenBootResult: "",
  lastSync: null,
  locks: { group: null, ko: null },
  adminPwHash: null,
});

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (url.pathname === "/pool" || url.pathname.startsWith("/pool/")) {
      return handlePool(request, env, url, corsHeaders);
    }

    // ── football-data.org proxy ──
    const apiUrl = `https://api.football-data.org/v4${url.pathname}${url.search}`;

    const apiRes = await fetch(apiUrl, {
      headers: { "X-Auth-Token": env.FOOTBALL_DATA_API_KEY },
    });

    return new Response(apiRes.body, {
      status: apiRes.status,
      headers: {
        ...corsHeaders,
        "Content-Type": apiRes.headers.get("Content-Type") || "application/json",
      },
    });
  },
};

// ── KV STATE HELPERS ────────────────────────────────────────────────

async function getState(env) {
  const raw = await env.POOL_DATA.get(STATE_KEY);
  return raw ? { ...EMPTY_STATE(), ...JSON.parse(raw) } : EMPTY_STATE();
}

async function putState(env, state) {
  await env.POOL_DATA.put(STATE_KEY, JSON.stringify(state));
}

// strip server-only fields before sending state to clients
function publicState(state) {
  const { adminPwHash, ...rest } = state;
  return rest;
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function json(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── /pool ROUTES ─────────────────────────────────────────────────────

async function handlePool(request, env, url, corsHeaders) {
  const path = url.pathname.replace(/^\/pool\/?/, "");

  // GET /pool — full shared pool state
  if (request.method === "GET" && path === "") {
    const state = await getState(env);
    return json(publicState(state), 200, corsHeaders);
  }

  if (request.method !== "POST") {
    return json({ error: "Not found" }, 404, corsHeaders);
  }

  let body;
  try { body = await request.json(); } catch { body = {}; }

  // POST /pool/sync — merge live group/KO results pulled from football-data.org
  // (no auth — this is just public sports data, any client can refresh it)
  if (path === "sync") {
    const state = await getState(env);
    ["groupResults", "groupStandings", "koResults", "bracketTeams", "lastSync"].forEach(k => {
      if (body[k] !== undefined) state[k] = body[k];
    });
    await putState(env, state);
    return json(publicState(state), 200, corsHeaders);
  }

  // POST /pool/picks — a player saves their own picks
  if (path === "picks") {
    const state = await getState(env);
    const { idx, name, groupPicks, bracketPicks, goldenBoot } = body;
    const player = state.players[idx];
    if (!player || player.name !== name) {
      return json({ error: "Player not found" }, 404, corsHeaders);
    }
    if (groupPicks   !== undefined) player.groupPicks   = groupPicks;
    if (bracketPicks !== undefined) player.bracketPicks = bracketPicks;
    if (goldenBoot   !== undefined) player.goldenBoot   = goldenBoot;
    await putState(env, state);
    return json(publicState(state), 200, corsHeaders);
  }

  // POST /pool/join — a new player adds themselves to the pool (no auth needed)
  if (path === "join") {
    const state = await getState(env);
    const name = (body.name || "").trim().slice(0, 30);
    if (!name) return json({ error: "Name required" }, 400, corsHeaders);
    if (state.players.find(p => p.name.toLowerCase() === name.toLowerCase())) {
      return json({ error: "That name is already taken" }, 409, corsHeaders);
    }
    state.players.push({ name, groupPicks: {}, bracketPicks: {}, goldenBoot: "" });
    await putState(env, state);
    return json({ ...publicState(state), idx: state.players.length - 1 }, 200, corsHeaders);
  }

  // POST /pool/admin/checkpw — validate admin password without writing
  if (path === "admin/checkpw") {
    const state = await getState(env);
    if (!state.adminPwHash) return json({ valid: false, needsSetup: true }, 200, corsHeaders);
    const hash = await sha256Hex(body.adminPw || "");
    return json({ valid: hash === state.adminPwHash }, 200, corsHeaders);
  }

  // POST /pool/admin — admin writes (results, players, locks, phase, golden boot, etc.)
  if (path === "admin") {
    const state = await getState(env);
    const pw = body.adminPw || "";
    if (!state.adminPwHash) {
      state.adminPwHash = await sha256Hex(pw);
    } else {
      const hash = await sha256Hex(pw);
      if (hash !== state.adminPwHash) return json({ error: "Unauthorized" }, 401, corsHeaders);
    }
    const patch = body.patch || {};
    ["players", "phase", "goldenBootResult", "bracketTeams", "koResults", "groupResults", "groupStandings", "locks", "lastSync"].forEach(k => {
      if (patch[k] !== undefined) state[k] = patch[k];
    });
    await putState(env, state);
    return json(publicState(state), 200, corsHeaders);
  }

  // POST /pool/admin/seed — one-time full overwrite from a client's local state
  // (used to migrate existing localStorage data into the cloud)
  if (path === "admin/seed") {
    const state = await getState(env);
    const pw = body.adminPw || "";
    if (!state.adminPwHash) {
      state.adminPwHash = await sha256Hex(pw);
    } else {
      const hash = await sha256Hex(pw);
      if (hash !== state.adminPwHash) return json({ error: "Unauthorized" }, 401, corsHeaders);
    }
    const incoming = body.state || {};
    const merged = { ...EMPTY_STATE(), ...incoming, adminPwHash: state.adminPwHash };
    await putState(env, merged);
    return json(publicState(merged), 200, corsHeaders);
  }

  return json({ error: "Not found" }, 404, corsHeaders);
}
