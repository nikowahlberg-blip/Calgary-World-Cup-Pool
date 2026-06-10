// ── SCHEDULE PAGE ─────────────────────────────────────────────────
let _scheduleTimer = null;

function stopScheduleRefresh() {
  clearInterval(_scheduleTimer);
  _scheduleTimer = null;
}

async function renderSchedulePage() {
  const el = document.getElementById("schedule-content");
  if (!el) return;
  stopScheduleRefresh();

  if (!el.dataset.loaded) {
    el.innerHTML = `<div class="live-loading">
      <div class="live-loading-icon">📅</div>
      <div>Loading schedule…</div>
    </div>`;
  }

  try {
    const data = await apiGetSchedule();
    el.dataset.loaded = "1";

    const matches = (data.matches || [])
      .slice()
      .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

    if (!matches.length) {
      el.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📅</div>
        Schedule not available yet.
      </div>`;
      return;
    }

    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    let html = `<div class="live-header">
      <div class="live-header-title">Schedule</div>
      <div class="live-header-right">
        <span class="live-updated">Updated ${now}</span>
        <button class="btn-sync" onclick="renderSchedulePage()">
          <span class="sync-icon">↻</span> Refresh
        </button>
      </div>
    </div>`;

    // Group matches by local date
    const groups = [];
    let lastKey = null;
    matches.forEach(m => {
      const d = new Date(m.utcDate);
      const key = d.toDateString();
      if (key !== lastKey) {
        groups.push({ key, label: d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" }), matches: [] });
        lastKey = key;
      }
      groups[groups.length - 1].matches.push(m);
    });

    html += `<div class="schedule-list">`;
    groups.forEach(g => {
      html += `<div class="schedule-date-header">${g.label}</div>`;
      html += g.matches.map(scheduleMatchRow).join("");
    });
    html += `</div>`;

    el.innerHTML = html;

    // Auto-refresh every 60s while on schedule page
    _scheduleTimer = setInterval(() => {
      if (_currentPage === "schedule") renderSchedulePage();
    }, 60_000);

  } catch (e) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-icon">⚠️</div>
      Could not load schedule.<br>
      <span style="font-size:12px;color:var(--text3);">${e.message}</span>
    </div>`;
  }
}

function scheduleMatchRow(m) {
  const home = normalizeTeam(m.homeTeam?.name || "TBD");
  const away = normalizeTeam(m.awayTeam?.name || "TBD");
  const score = m.score || {};
  const ft  = score.fullTime    || {};
  const reg = score.regularTime || {};

  const homeGoals = ft.home ?? reg.home ?? null;
  const awayGoals = ft.away ?? reg.away ?? null;
  const hasScore  = homeGoals !== null && awayGoals !== null;

  const finished = m.status === "FINISHED";
  const live     = ["IN_PLAY", "PAUSED", "LIVE"].includes(m.status);
  const kickoff  = m.utcDate ? new Date(m.utcDate).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";

  const group = (m.group || "").replace("GROUP_", "");
  const stage = group ? `Group ${group}` : (m.stage || "").replace(/_/g, " ").replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

  return `<div class="schedule-row ${live ? "schedule-row--live" : ""}">
    <div class="schedule-time">
      ${live ? `<span class="live-dot"></span>` : finished ? "FT" : kickoff}
    </div>
    <div class="schedule-teams">
      <div class="schedule-team">
        <span class="match-flag">${flag(home)}</span>
        <span class="match-name">${home}</span>
      </div>
      <div class="schedule-score">
        ${hasScore
          ? `<span class="score-num">${homeGoals}</span><span class="score-sep">:</span><span class="score-num">${awayGoals}</span>`
          : `<span class="score-vs">vs</span>`}
      </div>
      <div class="schedule-team schedule-team--away">
        <span class="match-name">${away}</span>
        <span class="match-flag">${flag(away)}</span>
      </div>
    </div>
    <div class="schedule-stage">${stage}</div>
  </div>`;
}
