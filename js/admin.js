// ── ADMIN MODULE ─────────────────────────────────────────────────

function renderAdmin() {
  const el = document.getElementById("admin-content");
  if (!el) return;

  const lastSync = S.lastSync
    ? new Date(S.lastSync).toLocaleString("en-CA", { dateStyle:"short", timeStyle:"short" })
    : "Never";

  let html = `<div class="admin-section">
    <div class="admin-section-title">Admin</div>

    <!-- Sync card -->
    <div class="sync-card">
      <div class="sync-card-info">
        <div class="sync-card-title">Live results sync</div>
        <div class="sync-card-sub">Last synced: ${lastSync}</div>
      </div>
      <button class="btn-secondary btn-sm" onclick="syncAll(this)"><span class="sync-icon">↻</span> Sync now</button>
    </div>

    <!-- Phase indicator -->
    <div class="info ${S.phase === "group" ? "amber" : "green"}">
      ${S.phase === "group"
        ? "⚙️ <strong>Group stage phase.</strong> Sync or manually enter group results. When all groups are done, open the bracket phase so players can fill out their full bracket."
        : "✅ <strong>Bracket phase active.</strong> The bracket is open. Sync or manually enter KO results round by round."}
    </div>`;

  // Golden boot result
  html += `<div class="card">
    <div class="card-title">Golden boot result</div>
    <div style="display:flex;gap:8px;max-width:320px;">
      <input type="text" id="gb-result" value="${S.goldenBootResult || ""}" placeholder="Player name" style="flex:1;" />
      <button class="btn-primary btn-sm" onclick="saveGBResult()">Save</button>
    </div>
  </div>`;

  if (S.phase === "group") {
    html += renderAdminGroups();
    html += `<button class="open-bracket-btn" onclick="openBracketPhase()">Open bracket phase → players can now pick the bracket</button>`;
  } else {
    html += renderAdminKO();
    html += `<div style="margin-top:20px;"><button class="btn-danger btn-sm" onclick="resetToGroupPhase()">↩ Reset to group phase</button></div>`;
  }

  // Player management
  html += `<div style="margin-top:24px;">
    <div class="card-title" style="margin-bottom:12px;">Players (${S.players.length})</div>
    <div class="player-list-admin" id="players-list-admin"></div>
    <div style="display:flex;gap:8px;margin-top:10px;">
      <input type="text" id="new-player-name" placeholder="Add player name" style="flex:1;max-width:280px;" onkeydown="if(event.key==='Enter')addPlayer()" />
      <button class="btn-primary btn-sm" onclick="addPlayer()">Add</button>
    </div>
  </div>`;

  html += `</div>`; // close admin-section
  el.innerHTML = html;
  renderPlayers();
}

function renderAdminGroups() {
  let html = `<div class="card-title" style="margin-bottom:10px;margin-top:20px;">Group results</div>
  <div class="admin-groups-grid">`;
  Object.entries(GROUPS).forEach(([g, teams]) => {
    const res = S.groupResults[g] || {};
    html += `<div class="admin-group-card">
      <div class="card-title">Group ${g}</div>`;
    [[1,"p1"],[2,"p2"],[3,"p3"],[4,"p4"]].forEach(([pos, cls]) => {
      html += `<div class="standing-row">
        <span class="pos-dot ${cls}">${pos}</span>
        <select id="ar-${g}-${pos}">${teamOpts(teams, res[pos] || "")}</select>
      </div>`;
    });
    html += `</div>`;
  });
  html += `</div>
  <div class="btn-row" style="margin-bottom:12px;">
    <button class="btn-primary btn-sm" onclick="saveGroupResultsManual()">Save group results</button>
  </div>`;
  return html;
}

function renderAdminKO() {
  let html = `<div class="card-title" style="margin-bottom:10px;margin-top:20px;">Knockout results</div>`;
  KO_ROUNDS.forEach(round => {
    const matches  = S.koResults[round.id] || [];
    const pool     = getKOPool(round.id);
    const allTeams = pool.length ? pool : ALL_TEAMS;

    html += `<div style="margin-bottom:16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <div style="font-weight:600;font-size:14px;">${round.label}</div>
        <div class="pts-pill">${round.pts} pts each</div>
      </div>`;

    if (round.id === "champ") {
      const cur = matches[0]?.winner || "";
      html += `<div style="max-width:280px;">
        <label style="margin-bottom:6px;">Champion</label>
        <select id="km-champ-0-w">${teamOpts(allTeams, cur)}</select>
      </div>`;
    } else {
      const pairCount = round.size / 2;
      html += `<div class="ko-admin-grid">`;
      for (let i = 0; i < pairCount; i++) {
        const m = matches[i] || { t1:"", t2:"", winner:"" };
        html += `<div class="ko-match-admin">
          <div class="ko-match-num">Match ${i + 1}</div>
          <div class="ko-team-row">
            <select id="km-${round.id}-${i}-t1">${teamOpts(allTeams, m.t1, "— team 1 —")}</select>
          </div>
          <div class="vs-divider">vs</div>
          <div class="ko-team-row">
            <select id="km-${round.id}-${i}-t2">${teamOpts(allTeams, m.t2, "— team 2 —")}</select>
          </div>
          <div class="winner-row">
            <label>Winner</label>
            <select id="km-${round.id}-${i}-w">${teamOpts(allTeams, m.winner, "— select —")}</select>
          </div>
        </div>`;
      }
      html += `</div>`;
    }
    html += `<button class="btn-primary btn-sm" style="margin-top:8px;" onclick="saveKOResults('${round.id}')">
      Save ${round.label}
    </button></div>`;
  });
  return html;
}

function getKOPool(roundId) {
  const ri = KO_ROUNDS.findIndex(r => r.id === roundId);
  if (ri === 0) return S.bracketTeams.length ? S.bracketTeams : [];
  const prev        = KO_ROUNDS[ri - 1];
  const prevMatches = S.koResults[prev.id] || [];
  const winners     = prevMatches.map(m => m.winner).filter(Boolean);
  return winners.length ? winners : (S.bracketTeams.length ? S.bracketTeams : []);
}

// ── ADMIN ACTIONS ─────────────────────────────────────────────────

function saveGroupResultsManual() {
  Object.keys(GROUPS).forEach(g => {
    if (!S.groupResults[g]) S.groupResults[g] = {};
    [1,2,3,4].forEach(pos => {
      const el = document.getElementById(`ar-${g}-${pos}`);
      if (el) S.groupResults[g][pos] = el.value;
    });
  });
  save(); toast("Group results saved!");
}

function openBracketPhase() {
  if (!confirm("Open the bracket phase? Players will be able to fill out their full bracket. Make sure all group results are entered first.")) return;
  // Collect 32 teams: top 2 from each group (24) + 8 best 3rd place
  const teams = [];
  const thirds = [];
  Object.entries(S.groupResults).forEach(([, res]) => {
    if (res[1]) teams.push(res[1]);
    if (res[2]) teams.push(res[2]);
    if (res[3]) thirds.push(res[3]);
  });
  thirds.slice(0, 8).forEach(t => { if (t) teams.push(t); });
  S.bracketTeams = [...new Set(teams)].filter(Boolean);
  S.phase = "bracket";
  save();
  renderAdmin();
  updatePhaseUI();
  toast("✅ Bracket phase open — players can now fill out the bracket!");
}

function saveKOResults(roundId) {
  const round = KO_ROUNDS.find(r => r.id === roundId);
  if (!S.koResults[roundId]) S.koResults[roundId] = [];
  if (roundId === "champ") {
    const w = document.getElementById("km-champ-0-w")?.value || "";
    S.koResults["champ"] = [{ t1:"", t2:"", winner: w }];
  } else {
    const pairCount = round.size / 2;
    for (let i = 0; i < pairCount; i++) {
      S.koResults[roundId][i] = {
        t1:     document.getElementById(`km-${roundId}-${i}-t1`)?.value || "",
        t2:     document.getElementById(`km-${roundId}-${i}-t2`)?.value || "",
        winner: document.getElementById(`km-${roundId}-${i}-w`)?.value  || "",
      };
    }
  }
  save();
  toast(`${round.label} results saved!`);
}

function saveGBResult() {
  const el = document.getElementById("gb-result");
  if (el) { S.goldenBootResult = el.value.trim(); save(); toast("Golden boot result saved!"); }
}

function addPlayer() {
  const inp  = document.getElementById("new-player-name");
  const name = inp?.value.trim();
  if (!name) return;
  if (S.players.find(p => p.name.toLowerCase() === name.toLowerCase())) { toast("Name already exists"); return; }
  S.players.push({ name, groupPicks:{}, bracketPicks:{}, goldenBoot:"" });
  save(); inp.value = "";
  renderPlayers();
  refreshPicksPlayerSelect();
  toast(`${name} added!`);
}

function removePlayer(i) {
  if (!confirm("Remove " + S.players[i].name + "?")) return;
  S.players.splice(i, 1);
  save(); renderPlayers(); refreshPicksPlayerSelect();
}

function resetToGroupPhase() {
  if (!confirm("Reset to group phase? Bracket results and bracket teams will be cleared. Player picks are kept.")) return;
  S.phase = "group"; S.koResults = {}; S.bracketTeams = [];
  save(); renderAdmin(); updatePhaseUI();
}
