// ── STATE ─────────────────────────────────────────────────────────
let S = JSON.parse(localStorage.getItem("wc26pool") || "null") || DEFAULT_STATE();
const save = () => { try { localStorage.setItem("wc26pool", JSON.stringify(S)); } catch(e) {} };

// ── TOAST ─────────────────────────────────────────────────────────
let _toastTimer;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

// ── ADMIN AUTH ────────────────────────────────────────────────────
let _adminUnlocked = false;
let _pendingAdminPage = null;

function requireAdmin(page) {
  if (_adminUnlocked) { showPage(page); return; }
  _pendingAdminPage = page;
  document.getElementById("admin-modal").classList.remove("hidden");
  document.getElementById("admin-pw-input").focus();
}
function adminLoginFromSetup() {
  _pendingAdminPage = "admin";
  document.getElementById("admin-modal").classList.remove("hidden");
  document.getElementById("admin-pw-input").focus();
}
function checkAdminPw() {
  const pw     = document.getElementById("admin-pw-input").value;
  const stored = localStorage.getItem("wc26adminpw") || "";
  if (pw === stored) {
    _adminUnlocked = true;
    closeModal();
    document.getElementById("setup-screen").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");
    if (_pendingAdminPage) { showPage(_pendingAdminPage); _pendingAdminPage = null; }
  } else {
    document.getElementById("admin-pw-error").classList.remove("hidden");
    document.getElementById("admin-pw-input").value = "";
    document.getElementById("admin-pw-input").focus();
  }
}
function closeModal() {
  document.getElementById("admin-modal").classList.add("hidden");
  document.getElementById("admin-pw-input").value = "";
  document.getElementById("admin-pw-error").classList.add("hidden");
}

// ── SETUP ─────────────────────────────────────────────────────────
function renderSetupPlayerList() {
  const list  = document.getElementById("setup-player-list");
  const empty = document.getElementById("setup-no-players");
  if (!list || !empty) return;

  if (!S.players.length) {
    list.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  list.innerHTML = S.players.map((p, i) =>
    `<button class="setup-player-btn" onclick="claimPlayer(${i})">
      <span class="setup-player-avatar">${p.name.slice(0,2).toUpperCase()}</span>
      <span class="setup-player-name">${p.name}</span>
    </button>`
  ).join("");
}

function claimPlayer(idx) {
  const p = S.players[idx];
  if (!p) return;

  localStorage.setItem("wc26myname", p.name);
  localStorage.setItem("wc26myidx",  String(idx));

  document.getElementById("setup-screen").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  showPage("picks");
  toast("Welcome, " + p.name + "!");
}

function switchUser() {
  localStorage.removeItem("wc26myname");
  localStorage.removeItem("wc26myidx");
  location.reload();
}

function toggleAdminSetup() {
  const fields = document.getElementById("admin-setup-fields");
  fields.classList.toggle("hidden");
  if (!fields.classList.contains("hidden")) {
    const hasPw = !!localStorage.getItem("wc26adminpw");
    document.getElementById("admin-setup-pw-section").classList.toggle("hidden", hasPw);
    document.getElementById("admin-setup-save-btn").classList.toggle("hidden", hasPw);
  }
}

function saveAdminSetup() {
  const pw = document.getElementById("setup-admin-pw").value.trim();
  if (!pw) { alert("Please set an admin password."); return; }
  localStorage.setItem("wc26adminpw", pw);
  document.getElementById("admin-setup-fields").classList.add("hidden");
  toast("Admin settings saved!");
}

// ── PAGE ROUTING ──────────────────────────────────────────────────
let _currentPage = "leaderboard";
function showPage(name) {
  if (_currentPage === "live"        && name !== "live")        stopLiveRefresh();
  if (_currentPage === "stats"       && name !== "stats")       stopStatsRefresh();
  if (_currentPage === "schedule"    && name !== "schedule")    stopScheduleRefresh();
  if (_currentPage === "leaderboard" && name !== "leaderboard") stopCountdownTimer();
  _currentPage = name;
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.page === name));
  document.getElementById(`page-${name}`).classList.add("active");

  if (name === "leaderboard") renderLeaderboardPage();
  if (name === "picks")       { refreshPicksPlayerSelect(); renderPicksForPlayer(); }
  if (name === "bracket")     renderBracketPage();
  if (name === "groups")      renderGroupsRef();
  if (name === "live")        renderLivePage();
  if (name === "stats")       renderStatsPage();
  if (name === "admin")       renderAdmin();
}

function rerenderAll() {
  if (_currentPage === "leaderboard") renderLeaderboardPage();
  if (_currentPage === "bracket")     renderBracketPage();
  if (_currentPage === "admin")       renderAdmin();
}

// ── LEADERBOARD RENDER ────────────────────────────────────────────
function renderLeaderboardPage() {
  const el = document.getElementById("lb-content");
  if (!el) return;

  const ranked     = getRankedPlayers();
  const hasResults = Object.keys(S.groupResults).some(g => S.groupResults[g][1]) ||
                     Object.keys(S.koResults).some(r => S.koResults[r].some(m => m.winner));

  if (!ranked.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🏆</div>
      No players in the pool yet. Ask the admin to add players in the Admin tab.
    </div>`;
    return;
  }

  let html = `<div class="lb-hero">
    <div class="lb-hero-title">Standings</div>
    <div class="lb-hero-sub">${hasResults ? "Live scores · " : "Waiting for results · "}${ranked.length} players</div>
    <div class="lb-countdown" id="lb-countdown"></div>
  </div>`;

  if (!hasResults) {
    html += `<div style="padding:0 12px;margin-top:10px;">
      <div class="info">Results haven't been entered yet. Check back once the tournament starts!</div>
    </div>`;
  }

  const myIdx = localStorage.getItem("wc26myidx");

  html += `<div class="lb-list">`;
  ranked.forEach((p, i) => {
    const medals = ["🥇","🥈","🥉"];
    const gap        = i > 0 ? ranked[0].pts - p.pts : 0;
    const stillAlive = p.maxPossible >= ranked[0].pts;
    const isMe       = myIdx !== null && String(p.idx) === myIdx;

    html += `<div class="lb-row ${i < 3 ? "lb-row--top3" : ""} ${isMe ? "lb-row--me" : ""}" onclick="toggleLbDetail(${p.idx})">
      <div class="lb-rank">${medals[i] || (i + 1)}</div>
      <div class="lb-avatar">${p.name.slice(0,2).toUpperCase()}</div>
      <div class="lb-info">
        <div class="lb-name">${p.name}${isMe ? ` <span class="lb-me-tag">You</span>` : ""}</div>
        ${hasResults && p.breakdown
          ? `<div class="lb-detail">${p.breakdown}</div>`
          : `<div class="lb-picks-preview">${formatPicksPreview(p)}</div>`}
        ${hasResults && S.phase === "bracket" ? renderSurvivalPips(p.survival) : ""}
      </div>
      <div class="lb-scores">
        <div class="lb-pts-main ${p.pts === 0 && hasResults ? "zero" : ""}">${hasResults ? p.pts : "—"}</div>
        ${hasResults ? `<div class="lb-pts-max">
          max <span class="${stillAlive ? "alive" : "busted"}">${p.maxPossible}</span>
          ${i > 0 && gap > 0 ? `<br>–${gap} behind` : ""}
        </div>` : ""}
      </div>
      <div class="lb-expand-arrow" id="lb-arrow-${p.idx}">▾</div>
    </div>
    <div class="lb-detail-panel hidden" id="lb-sheet-${p.idx}">${renderPlayerPickSheet(p)}</div>`;
  });

  html += `</div>`;

  // Scoring key at the bottom
  html += `<div style="padding:14px 16px 24px;">
    <div style="font-size:11px;color:var(--text3);line-height:1.8;">
      Scoring: Groups any correct position=2 · Golden boot=4<br>
      Bracket: R32=2 · R16=3 · QF=4 · SF=5 · Final=6 · Champion=8
    </div>
  </div>`;

  el.innerHTML = html;
  startCountdownTimer();
}

// ── KICKOFF COUNTDOWN ─────────────────────────────────────────────
let _countdownTimer = null;
function stopCountdownTimer() {
  clearInterval(_countdownTimer);
  _countdownTimer = null;
}

function startCountdownTimer() {
  stopCountdownTimer();
  renderCountdownTick();
  _countdownTimer = setInterval(renderCountdownTick, 1000);
}

function renderCountdownTick() {
  const el = document.getElementById("lb-countdown");
  if (!el) { stopCountdownTimer(); return; }

  const diff = GROUP_STAGE_KICKOFF - new Date();
  if (diff <= 0) {
    el.innerHTML = `<div class="countdown-started">⚽ The tournament has kicked off!</div>`;
    stopCountdownTimer();
    return;
  }

  const days  = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins  = Math.floor((diff % 3600000) / 60000);
  const secs  = Math.floor((diff % 60000) / 1000);

  el.innerHTML = `
    <div class="countdown-label">Kickoff in</div>
    <div class="countdown-row">
      <div class="countdown-unit"><span class="countdown-num">${days}</span><span class="countdown-unit-label">Days</span></div>
      <div class="countdown-unit"><span class="countdown-num">${String(hours).padStart(2,"0")}</span><span class="countdown-unit-label">Hrs</span></div>
      <div class="countdown-unit"><span class="countdown-num">${String(mins).padStart(2,"0")}</span><span class="countdown-unit-label">Min</span></div>
      <div class="countdown-unit"><span class="countdown-num">${String(secs).padStart(2,"0")}</span><span class="countdown-unit-label">Sec</span></div>
    </div>`;
}

function toggleLbDetail(idx) {
  const panel = document.getElementById(`lb-sheet-${idx}`);
  const arrow = document.getElementById(`lb-arrow-${idx}`);
  if (!panel) return;
  panel.classList.toggle("hidden");
  if (arrow) arrow.classList.toggle("lb-expand-arrow--open", !panel.classList.contains("hidden"));
}

// Full pick sheet for a player: groups, golden boot, bracket — with correct/wrong/pending status
function renderPlayerPickSheet(p) {
  let html = `<div class="pick-sheet">`;

  // Golden boot
  const gbPick = (p.goldenBoot || "").trim();
  const gbStatus = !S.goldenBootResult ? "pending"
    : (gbPick && gbPick.toLowerCase() === S.goldenBootResult.trim().toLowerCase()) ? "correct" : "wrong";
  html += `<div class="ps-section">
    <div class="ps-label">⚽ Golden Boot — 4pts</div>
    <div class="ps-row ps-${gbStatus}">
      <span class="ps-name">${gbPick || "— no pick —"}</span>
      <span class="ps-icon">${gbStatus === "correct" ? "✅" : gbStatus === "wrong" ? "❌" : ""}</span>
    </div>
  </div>`;

  // Group picks
  html += `<div class="ps-section">
    <div class="ps-label">🌍 Group Picks — 2pts each</div>
    <div class="ps-groups-grid">`;
  Object.keys(GROUPS).forEach(g => {
    const gp  = p.groupPicks[g] || {};
    const res = S.groupResults[g] || {};
    html += `<div class="ps-group-card"><div class="ps-group-title">Group ${g}</div>`;
    [1,2,3,4].forEach(pos => {
      const pick = gp[pos];
      if (!pick) {
        html += `<div class="ps-row ps-pending"><span class="ps-pos">${pos}.</span><span class="ps-name">—</span></div>`;
        return;
      }
      const status = !res[pos] ? "pending" : (res[pos] === pick ? "correct" : "wrong");
      html += `<div class="ps-row ps-${status}">
        <span class="ps-pos">${pos}.</span>
        <span class="ps-flag">${flag(pick)}</span>
        <span class="ps-name">${pick}</span>
        <span class="ps-icon">${status === "correct" ? "✅" : status === "wrong" ? "❌" : ""}</span>
      </div>`;
    });
    html += `</div>`;
  });
  html += `</div></div>`;

  // Bracket picks
  if (S.phase === "bracket") {
    const eliminated = getEliminatedTeams();
    let bracketHtml = "";
    KO_ROUNDS.forEach(round => {
      const picks = ((p.bracketPicks && p.bracketPicks[round.id]) || []).filter(Boolean);
      if (!picks.length) return;
      const results = S.koResults[round.id] || [];
      const winners = new Set(results.map(m => m.winner).filter(Boolean));
      bracketHtml += `<div class="ps-round">
        <div class="ps-round-title">${round.label} — ${round.pts}pts each</div>
        <div class="ps-round-teams">`;
      picks.forEach(team => {
        let status = "pending";
        if (winners.has(team)) status = "correct";
        else if (eliminated.has(team)) status = "wrong";
        bracketHtml += `<span class="ps-pill ps-pill-${status}">${flag(team)} ${team}${status === "correct" ? " ✅" : status === "wrong" ? " ❌" : ""}</span>`;
      });
      bracketHtml += `</div></div>`;
    });
    if (bracketHtml) {
      html += `<div class="ps-section">
        <div class="ps-label">🗂 Bracket Picks</div>
        ${bracketHtml}
      </div>`;
    }
  }

  html += `</div>`;
  return html;
}

function renderSurvivalPips(survival) {
  if (!survival || !survival.length) return "";
  const labels = ["R32","R16","QF","SF","F","🏆"];
  const pips = survival.map((s, i) => {
    const cls = s === "correct" || s === "alive" ? "pip-alive" : s === "busted" ? "pip-busted" : "pip-pending";
    return `<span class="survival-pip ${cls}">${labels[i]}</span>`;
  }).join("");
  return `<div class="survival-bar">${pips}</div>`;
}

function formatPicksPreview(p) {
  const champ = p.bracketPicks?.champ?.[0] || "";
  if (champ) return `Picked ${flag(champ)} ${champ} to win`;
  const gKeys = Object.keys(p.groupPicks || {});
  if (gKeys.length) return `${gKeys.length}/12 groups picked`;
  return "No picks yet";
}

// ── GROUPS REFERENCE ──────────────────────────────────────────────
function renderGroupsRef() {
  const el = document.getElementById("groups-ref");
  if (!el) return;

  const hasStandings = Object.keys(S.groupStandings || {}).length > 0;

  if (hasStandings) {
    el.className = "live-standings-grid";
    el.innerHTML = Object.keys(GROUPS).map(g => {
      const rows = S.groupStandings[g] || [];
      if (!rows.length) return "";
      return `<div class="live-group-card">
        <div class="live-group-label">Group ${g}</div>
        <div class="live-table-header">
          <span class="lt-team-col"></span>
          <span class="lt-stat">GP</span>
          <span class="lt-stat">GF</span>
          <span class="lt-stat">GA</span>
          <span class="lt-stat">GD</span>
          <span class="lt-pts">P</span>
        </div>
        ${rows.map((row, i) => {
          const team = row.team;
          const gd   = row.goalDifference >= 0 ? `+${row.goalDifference}` : String(row.goalDifference);
          const through = i < 2 ? "lt-row--through" : "";
          return `<div class="lt-row ${through}">
            <span class="lt-team-col">
              <span class="lt-pos">${row.position}</span>
              <span class="lt-flag">${flag(team)}</span>
              <span class="lt-name">${team}</span>
            </span>
            <span class="lt-stat">${row.playedGames}</span>
            <span class="lt-stat">${row.goalsFor}</span>
            <span class="lt-stat">${row.goalsAgainst}</span>
            <span class="lt-stat lt-gd">${gd}</span>
            <span class="lt-pts lt-pts-val">${row.points}</span>
          </div>`;
        }).join("")}
      </div>`;
    }).join("");
    return;
  }

  el.className = "groups-ref-grid";
  el.innerHTML = Object.entries(GROUPS).map(([g, teams]) => {
    const res = S.groupResults[g] || {};
    const standings = res[1] ? teams.slice().sort((a,b) => {
      const posA = Object.entries(res).find(([,v])=>v===a)?.[0] || 9;
      const posB = Object.entries(res).find(([,v])=>v===b)?.[0] || 9;
      return posA - posB;
    }) : teams;
    return `<div class="group-ref-card">
      <div class="group-ref-label">Group ${g}</div>
      ${standings.map(t => {
        const pos = Object.entries(res).find(([,v]) => v === t)?.[0];
        const posCls = pos === "1" || pos === "2" ? "pos-through" : pos === "3" ? "pos-maybe" : pos === "4" ? "pos-out" : "";
        const posLabel = pos ? `<span class="group-pos ${posCls}">${pos}</span>` : "";
        return `<div class="team-ref-row"><span class="flag">${flag(t)}</span>${t}${posLabel}</div>`;
      }).join("")}
    </div>`;
  }).join("");
}

// ── PHASE UI ──────────────────────────────────────────────────────
function updatePhaseUI() {
  const label = document.getElementById("header-phase-label");
  if (label) label.textContent = S.phase === "group" ? "Group stage" : "Knockout bracket";
  document.querySelectorAll(".nav-btn[data-page='bracket']").forEach(b => {
    b.style.opacity = S.phase === "bracket" ? "1" : "0.5";
  });
}

// ── INIT ──────────────────────────────────────────────────────────
(function init() {
  const myName = localStorage.getItem("wc26myname");
  const myIdx  = localStorage.getItem("wc26myidx");
  const valid  = myName && myIdx !== null && S.players[parseInt(myIdx)] && S.players[parseInt(myIdx)].name === myName;

  if (valid) {
    document.getElementById("setup-screen").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");
    showPage("picks");
  } else {
    localStorage.removeItem("wc26myname");
    localStorage.removeItem("wc26myidx");
    document.getElementById("setup-screen").classList.remove("hidden");
    document.getElementById("app").classList.add("hidden");
    renderSetupPlayerList();
  }

  updatePhaseUI();
  updateSyncInfo();
  renderLeaderboardPage();
  renderGroupsRef();

  syncAll(null).catch(() => {});
  setInterval(updateSyncInfo, 60_000);
})();
