// ── API MODULE ───────────────────────────────────────────────────
const API_BASE = "https://api.football-data.org/v4";
const WC = "WC";

let _apiKey = "";
const getApiKey = () => _apiKey;
const setApiKey = k => { _apiKey = k; };

async function apiFetch(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "X-Auth-Token": _apiKey }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body.slice(0,120)}`);
  }
  return res.json();
}

// Pull group standings and write into S.groupResults
async function apiSyncStandings() {
  const data = await apiFetch(`/competitions/${WC}/standings`);
  const updated = {};
  (data.standings || []).forEach(group => {
    const letter = (group.group || "").replace("GROUP_","");
    if (!letter || !GROUPS[letter]) return;
    updated[letter] = {};
    (group.table || []).forEach((row, i) => {
      updated[letter][i + 1] = normalizeTeam(row.team?.name || "");
    });
  });
  // merge — don't overwrite manual entries that API didn't return
  Object.assign(S.groupResults, updated);
}

// Pull all KO match results and write into S.koResults
async function apiSyncMatches() {
  const stages = KO_ROUNDS.filter(r => r.apiStage).map(r => r.apiStage).join(",");
  const data = await apiFetch(`/competitions/${WC}/matches?stage=${stages}`);
  const byStage = {};
  (data.matches || []).forEach(m => {
    const round = KO_ROUNDS.find(r => r.apiStage === m.stage);
    if (!round) return;
    if (!byStage[round.id]) byStage[round.id] = [];
    const t1 = normalizeTeam(m.homeTeam?.name || "");
    const t2 = normalizeTeam(m.awayTeam?.name || "");
    let winner = "";
    if (m.status === "FINISHED") {
      if      (m.score?.winner === "HOME_TEAM") winner = t1;
      else if (m.score?.winner === "AWAY_TEAM") winner = t2;
    }
    byStage[round.id].push({ t1, t2, winner });
  });

  KO_ROUNDS.filter(r => r.apiStage).forEach(r => {
    if (byStage[r.id]) S.koResults[r.id] = byStage[r.id];
  });

  // Derive champion
  const finalMatches = byStage["final"] || [];
  if (finalMatches.length && finalMatches[0].winner) {
    S.koResults["champ"] = [{ t1:"", t2:"", winner: finalMatches[0].winner }];
  }

  // Populate bracketTeams from R32 if not already set
  if (!S.bracketTeams.length && (byStage["r32"] || []).length) {
    const teams = new Set();
    byStage["r32"].forEach(m => { if (m.t1) teams.add(m.t1); if (m.t2) teams.add(m.t2); });
    S.bracketTeams = [...teams];
  }
}

// Full sync — called by the Sync button and on page load
async function syncAll(btnEl) {
  if (!_apiKey) { showSetup(); return; }
  if (btnEl) {
    btnEl.classList.add("syncing");
    btnEl.disabled = true;
    btnEl.innerHTML = `<span class="sync-icon">↻</span> Syncing…`;
  }
  try {
    await apiSyncStandings();
    if (S.phase === "bracket") await apiSyncMatches();
    S.lastSync = new Date().toISOString();
    save();
    updateSyncInfo();
    toast("✅ Results synced!");
    rerenderAll();
  } catch (e) {
    console.error("Sync error:", e);
    toast("❌ Sync failed — " + e.message);
  } finally {
    if (btnEl) {
      btnEl.classList.remove("syncing");
      btnEl.disabled = false;
      btnEl.innerHTML = `<span class="sync-icon">↻</span> Sync`;
    }
  }
}

function updateSyncInfo() {
  const el = document.getElementById("sync-info");
  if (!el) return;
  if (!S.lastSync) { el.textContent = "Not synced yet"; return; }
  const ago = Math.round((Date.now() - new Date(S.lastSync)) / 60000);
  el.textContent = ago < 1 ? "Just synced" : ago < 60 ? `${ago}m ago` : `${Math.round(ago/60)}h ago`;
}
