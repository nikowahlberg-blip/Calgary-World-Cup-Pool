// ── LIVE PAGE ─────────────────────────────────────────────────────
let _liveTimer = null;

function stopLiveRefresh() {
  clearInterval(_liveTimer);
  _liveTimer = null;
}

async function renderLivePage() {
  const el = document.getElementById("live-content");
  if (!el) return;
  stopLiveRefresh();

  // Show skeleton only on first load
  if (!el.dataset.loaded) {
    el.innerHTML = `<div class="live-loading">
      <div class="live-loading-icon">📡</div>
      <div>Loading live data…</div>
    </div>`;
  }

  try {
    const [matchData, scorerData, standingsData] = await Promise.all([
      apiGetLiveMatches(),
      apiGetScorers(),
      apiGetLiveStandings(),
    ]);

    el.dataset.loaded = "1";
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    let html = `<div class="live-header">
      <div class="live-header-title">Live Updates</div>
      <div class="live-header-right">
        <span class="live-updated">Updated ${now}</span>
        <button class="btn-sync" onclick="renderLivePage()">
          <span class="sync-icon">↻</span> Refresh
        </button>
      </div>
    </div>`;

    html += renderMatchSection(matchData.matches || []);
    html += renderStandingsSection(standingsData.standings || []);
    html += renderScorersSection(scorerData.scorers || []);

    el.innerHTML = html;

    // Auto-refresh every 60s while on live page
    _liveTimer = setInterval(() => {
      if (_currentPage === "live") renderLivePage();
    }, 60_000);

  } catch (e) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-icon">⚠️</div>
      Could not load live data.<br>
      <span style="font-size:12px;color:var(--text3);">${e.message}</span>
    </div>`;
  }
}

// ── MATCHES SECTION ───────────────────────────────────────────────
function renderMatchSection(matches) {
  if (!matches.length) {
    return `<div class="live-section">
      <div class="live-section-title">Matches</div>
      <div class="empty-state" style="padding:24px;">No matches found for this window.</div>
    </div>`;
  }

  const live     = matches.filter(m => ["IN_PLAY","PAUSED","LIVE"].includes(m.status));
  const upcoming = matches.filter(m => m.status === "SCHEDULED");
  const finished = matches.filter(m => m.status === "FINISHED");

  let html = `<div class="live-section">`;

  if (live.length) {
    html += `<div class="live-section-title"><span class="live-dot"></span> Live Now</div>`;
    html += live.map(m => matchCard(m, "live")).join("");
  }

  if (upcoming.length) {
    html += `<div class="live-section-title" style="margin-top:${live.length ? 16 : 0}px;">Upcoming</div>`;
    html += upcoming.map(m => matchCard(m, "upcoming")).join("");
  }

  if (finished.length) {
    html += `<div class="live-section-title" style="margin-top:${(live.length || upcoming.length) ? 16 : 0}px;">Results</div>`;
    html += finished.map(m => matchCard(m, "finished")).join("");
  }

  html += `</div>`;
  return html;
}

function matchCard(m, type) {
  const home = normalizeTeam(m.homeTeam?.name || "TBD");
  const away = normalizeTeam(m.awayTeam?.name || "TBD");
  const score = m.score || {};
  const ft    = score.fullTime  || {};
  const ht    = score.halfTime  || {};
  const reg   = score.regularTime || {};

  const homeGoals = ft.home ?? reg.home ?? null;
  const awayGoals = ft.away ?? reg.away ?? null;
  const hasScore  = homeGoals !== null && awayGoals !== null;

  const kickoff = m.utcDate ? new Date(m.utcDate).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) : "";
  const kickoffDate = m.utcDate ? new Date(m.utcDate).toLocaleDateString([], { month:"short", day:"numeric" }) : "";
  const minute  = m.minute ? `${m.minute}'` : "";
  const group   = (m.group || "").replace("GROUP_", "Group ");

  const statusBadge = type === "live"
    ? `<span class="match-status live-badge">${minute || "Live"}</span>`
    : type === "finished"
    ? `<span class="match-status fin-badge">FT</span>`
    : `<span class="match-status sch-badge">${kickoffDate} ${kickoff}</span>`;

  return `<div class="match-card match-card--${type}">
    <div class="match-meta">${group}${group && statusBadge ? " · " : ""}${statusBadge}</div>
    <div class="match-teams">
      <div class="match-team">
        <span class="match-flag">${flag(home)}</span>
        <span class="match-name">${home}</span>
      </div>
      <div class="match-score">
        ${hasScore
          ? `<span class="score-num">${homeGoals}</span><span class="score-sep">:</span><span class="score-num">${awayGoals}</span>`
          : `<span class="score-vs">vs</span>`}
      </div>
      <div class="match-team match-team--away">
        <span class="match-name">${away}</span>
        <span class="match-flag">${flag(away)}</span>
      </div>
    </div>
    ${ht.home !== null && ht.home !== undefined && type !== "upcoming"
      ? `<div class="match-ht">HT: ${ht.home ?? "–"} : ${ht.away ?? "–"}</div>`
      : ""}
  </div>`;
}

// ── STANDINGS SECTION ─────────────────────────────────────────────
function renderStandingsSection(standings) {
  const groups = standings.filter(s => s.type === "TOTAL" && s.stage === "GROUP_STAGE");
  if (!groups.length) return "";

  let html = `<div class="live-section">
    <div class="live-section-title">Group Standings</div>
    <div class="live-standings-grid">`;

  groups.forEach(group => {
    const letter = (group.group || "").replace("GROUP_", "");
    html += `<div class="live-group-card">
      <div class="live-group-label">Group ${letter}</div>
      <div class="live-table-header">
        <span class="lt-team-col"></span>
        <span class="lt-stat">P</span>
        <span class="lt-stat">W</span>
        <span class="lt-stat">D</span>
        <span class="lt-stat">L</span>
        <span class="lt-stat">GD</span>
        <span class="lt-pts">Pts</span>
      </div>`;

    (group.table || []).forEach((row, i) => {
      const team = normalizeTeam(row.team?.name || "");
      const gd   = row.goalDifference >= 0 ? `+${row.goalDifference}` : String(row.goalDifference);
      const through = i < 2 ? "lt-row--through" : "";
      html += `<div class="lt-row ${through}">
        <span class="lt-team-col">
          <span class="lt-pos">${row.position}</span>
          <span class="lt-flag">${flag(team)}</span>
          <span class="lt-name">${team}</span>
        </span>
        <span class="lt-stat">${row.playedGames}</span>
        <span class="lt-stat">${row.won}</span>
        <span class="lt-stat">${row.draw}</span>
        <span class="lt-stat">${row.lost}</span>
        <span class="lt-stat lt-gd">${gd}</span>
        <span class="lt-pts lt-pts-val">${row.points}</span>
      </div>`;
    });

    html += `</div>`;
  });

  html += `</div></div>`;
  return html;
}

// ── SCORERS SECTION ───────────────────────────────────────────────
function renderScorersSection(scorers) {
  if (!scorers.length) return "";

  let html = `<div class="live-section">
    <div class="live-section-title">Top Scorers</div>
    <div class="scorers-card">
      <div class="scorers-header">
        <span class="sc-player-col">Player</span>
        <span class="sc-stat">⚽</span>
        <span class="sc-stat">🅰️</span>
        <span class="sc-stat">Pen</span>
      </div>`;

  scorers.forEach((s, i) => {
    const name    = s.player?.name || "Unknown";
    const team    = normalizeTeam(s.team?.name || "");
    const goals   = s.goals ?? 0;
    const assists = s.assists ?? "–";
    const pens    = s.penalties ?? 0;
    html += `<div class="sc-row">
      <span class="sc-player-col">
        <span class="sc-rank">${i + 1}</span>
        <span class="sc-flag">${flag(team)}</span>
        <span class="sc-name">${name}</span>
      </span>
      <span class="sc-stat sc-goals">${goals}</span>
      <span class="sc-stat">${assists}</span>
      <span class="sc-stat sc-pen">${pens}</span>
    </div>`;
  });

  html += `</div></div>`;
  return html;
}
