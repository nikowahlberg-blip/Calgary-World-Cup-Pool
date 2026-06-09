// ── STATS PAGE ───────────────────────────────────────────────────
let _statsTimer = null;

function stopStatsRefresh() {
  clearInterval(_statsTimer);
  _statsTimer = null;
}

async function renderStatsPage() {
  const el = document.getElementById("stats-content");
  if (!el) return;
  stopStatsRefresh();

  if (!el.dataset.loaded) {
    el.innerHTML = `<div class="live-loading">
      <div class="live-loading-icon">📊</div>
      <div>Loading stat leaders…</div>
    </div>`;
  }

  try {
    const scorerData = await apiGetScorers(25);
    const scorers = scorerData.scorers || [];

    el.dataset.loaded = "1";
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    let html = `<div class="live-header">
      <div class="live-header-title">Stat Leaders</div>
      <div class="live-header-right">
        <span class="live-updated">Updated ${now}</span>
        <button class="btn-sync" onclick="renderStatsPage()">
          <span class="sync-icon">↻</span> Refresh
        </button>
      </div>
    </div>`;

    html += renderScorerLeaders(scorers);
    html += renderAssistLeaders(scorers);

    el.innerHTML = html;

    _statsTimer = setInterval(() => {
      if (_currentPage === "stats") renderStatsPage();
    }, 60_000);

  } catch (e) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-icon">⚠️</div>
      Could not load stat leaders.<br>
      <span style="font-size:12px;color:var(--text3);">${e.message}</span>
    </div>`;
  }
}

function renderScorerLeaders(scorers) {
  const top = [...scorers]
    .filter(s => (s.goals ?? 0) > 0)
    .sort((a, b) => (b.goals ?? 0) - (a.goals ?? 0))
    .slice(0, 10);

  if (!top.length) {
    return `<div class="live-section">
      <div class="live-section-title">⚽ Top Scorers</div>
      <div class="empty-state" style="padding:24px;">No goals scored yet.</div>
    </div>`;
  }

  return `<div class="live-section">
    <div class="live-section-title">⚽ Top Scorers</div>
    <div class="scorers-card">
      <div class="scorers-header">
        <span class="sc-player-col">Player</span>
        <span class="sc-stat">⚽</span>
        <span class="sc-stat">🅰️</span>
        <span class="sc-stat">Pen</span>
      </div>
      ${top.map((s, i) => statRow(s, i)).join("")}
    </div>
  </div>`;
}

function renderAssistLeaders(scorers) {
  const top = [...scorers]
    .filter(s => (s.assists ?? 0) > 0)
    .sort((a, b) => (b.assists ?? 0) - (a.assists ?? 0))
    .slice(0, 10);

  if (!top.length) {
    return `<div class="live-section">
      <div class="live-section-title">🅰️ Top Assists</div>
      <div class="empty-state" style="padding:24px;">No assists recorded yet.</div>
    </div>`;
  }

  return `<div class="live-section">
    <div class="live-section-title">🅰️ Top Assists</div>
    <div class="scorers-card">
      <div class="scorers-header">
        <span class="sc-player-col">Player</span>
        <span class="sc-stat">⚽</span>
        <span class="sc-stat">🅰️</span>
        <span class="sc-stat">Pen</span>
      </div>
      ${top.map((s, i) => statRow(s, i)).join("")}
    </div>
  </div>`;
}

function statRow(s, i) {
  const name    = s.player?.name || "Unknown";
  const team    = normalizeTeam(s.team?.name || "");
  const goals   = s.goals ?? 0;
  const assists = s.assists ?? "–";
  const pens    = s.penalties ?? 0;
  return `<div class="sc-row">
    <span class="sc-player-col">
      <span class="sc-rank">${i + 1}</span>
      <span class="sc-flag">${flag(team)}</span>
      <span class="sc-name">${name}</span>
    </span>
    <span class="sc-stat sc-goals">${goals}</span>
    <span class="sc-stat">${assists}</span>
    <span class="sc-stat sc-pen">${pens}</span>
  </div>`;
}
