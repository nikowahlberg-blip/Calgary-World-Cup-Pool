// ── PICKS MODULE ─────────────────────────────────────────────────

function teamOpts(pool, sel = "", ph = "— pick —") {
  const sorted = [...pool].sort((a, b) => a.localeCompare(b));
  return `<option value="">${ph}</option>` +
    sorted.map(t => `<option value="${t}"${t === sel ? " selected" : ""}>${flag(t)} ${t}</option>`).join("");
}

function renderPicksForPlayer() {
  const idx = parseInt(document.getElementById("picks-player-sel").value);
  const el  = document.getElementById("picks-content");
  if (isNaN(idx)) { el.innerHTML = ""; return; }
  const p = S.players[idx];

  let html = "";

  if (S.phase === "group") {
    html += `<div style="padding:0 16px 8px;">
      <div class="info amber">📋 <strong>Phase 1 — Group stage.</strong> Predict how each group will finish. Bracket picks open after the group stage ends.</div>
    </div>`;
    html += renderGoldenBootPick(idx, p);
    html += renderGroupPicksForms(idx, p);
  } else {
    html += `<div style="padding:0 16px 8px;">
      <div class="info green">✅ <strong>The bracket is set.</strong> Pick your teams for every knockout round — from Round of 32 all the way to the champion. Each round's options update based on your previous picks.</div>
    </div>`;
    html += renderGoldenBootPick(idx, p);
    html += renderBracketPicksForms(idx, p);
  }

  html += `<div class="picks-save-bar"><button class="btn-primary" onclick="saveAllPicks(${idx})">Save all picks</button></div>`;
  el.innerHTML = html;
}

function renderGoldenBootPick(idx, p) {
  return `<div class="golden-boot-row">
    <div class="golden-boot-inner">
      <div class="golden-boot-icon">⚽</div>
      <div class="golden-boot-content">
        <div class="picks-pts">4 pts if correct</div>
        <label>Golden boot scorer</label>
        <input type="text" id="gb-inp-${idx}" value="${p.goldenBoot || ""}" placeholder="Player name (e.g. Haaland)" />
      </div>
    </div>
  </div><hr class="sep">`;
}

function renderGroupPicksForms(idx, p) {
  let html = `<div style="padding: 0 16px 6px;">
    <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:10px;">
      <div style="font-family:var(--font-display);font-size:22px;font-weight:800;letter-spacing:0.02em;">Group picks</div>
      <div class="pts-pill">1st=3 · 2nd=2 · 3rd=1</div>
    </div>
  </div>
  <div class="group-picks-grid">`;
  Object.entries(GROUPS).forEach(([g, teams]) => {
    const gp = p.groupPicks[g] || {};
    html += `<div class="group-pick-card"><div class="card-title">Group ${g}</div>`;
    [[1,"🥇"],[2,"🥈"],[3,"🥉"],[4,"4️⃣"]].forEach(([pos, icon]) => {
      html += `<div class="place-row">
        <span class="place-icon">${icon}</span>
        <select id="gp-${idx}-${g}-${pos}">${teamOpts(teams, gp[pos] || "")}</select>
      </div>`;
    });
    html += `</div>`;
  });
  html += `</div>`;
  return html;
}

function renderBracketPicksForms(idx, p) {
  let html = "";
  KO_ROUNDS.forEach((round, ri) => {
    const pool   = getBracketPool(idx, ri);
    const picks  = (p.bracketPicks && p.bracketPicks[round.id]) || [];
    const eliminated = getEliminatedTeams();

    html += `<div class="round-picks-section">
      <div class="round-picks-header">
        <div class="round-picks-title">${round.label}</div>
        <div class="pts-pill">${round.pts} pts each</div>
      </div>
      <div class="picks-grid">`;
    for (let i = 0; i < round.size; i++) {
      const cur = picks[i] || "";
      // tint the select if the team is eliminated
      const isElim = cur && eliminated.has(cur);
      html += `<select id="bk-${idx}-${round.id}-${i}"
        style="${isElim ? "border-color:var(--crimson);opacity:0.6;" : ""}"
        onchange="onBracketPickChange(${idx},'${round.id}',${i},this.value)">
        ${teamOpts(pool, cur)}
      </select>`;
    }
    html += `</div></div><hr class="sep">`;
  });
  return html;
}

function getBracketPool(playerIdx, roundIndex) {
  const p = S.players[playerIdx];
  if (roundIndex === 0) return S.bracketTeams.length ? S.bracketTeams : ALL_TEAMS;
  const prev      = KO_ROUNDS[roundIndex - 1];
  const prevPicks = (p.bracketPicks && p.bracketPicks[prev.id]) || [];
  const filtered  = [...new Set(prevPicks.filter(Boolean))];
  return filtered.length ? filtered : (S.bracketTeams.length ? S.bracketTeams : ALL_TEAMS);
}

function onBracketPickChange(idx, roundId, pos, val) {
  const p = S.players[idx];
  if (!p.bracketPicks)           p.bracketPicks = {};
  if (!p.bracketPicks[roundId])  p.bracketPicks[roundId] = [];
  p.bracketPicks[roundId][pos] = val;
  // cascade: clear all downstream rounds (like a real bracket)
  const ri = KO_ROUNDS.findIndex(r => r.id === roundId);
  for (let i = ri + 1; i < KO_ROUNDS.length; i++) p.bracketPicks[KO_ROUNDS[i].id] = [];
  save();
  // re-render just the picks content so downstream selects update
  setTimeout(() => renderPicksForPlayer(), 30);
}

function saveAllPicks(idx) {
  const p = S.players[idx];

  // Golden boot
  const gb = document.getElementById(`gb-inp-${idx}`);
  if (gb) p.goldenBoot = gb.value.trim();

  if (S.phase === "group") {
    // Group picks
    if (!p.groupPicks) p.groupPicks = {};
    Object.keys(GROUPS).forEach(g => {
      p.groupPicks[g] = {};
      [1,2,3,4].forEach(pos => {
        const el = document.getElementById(`gp-${idx}-${g}-${pos}`);
        if (el) p.groupPicks[g][pos] = el.value;
      });
    });
  } else {
    // Bracket picks are saved live via onBracketPickChange
  }

  save();
  renderPlayers();
  toast("✅ Picks saved for " + p.name + "!");
}

function renderPlayers() {
  const el = document.getElementById("players-list-admin");
  if (!el) return;
  if (!S.players.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div>No players yet. Add friends below!</div>`;
    return;
  }
  el.innerHTML = S.players.map((p, i) => {
    const gpDone = Object.values(p.groupPicks || {}).filter(g => g[1]).length;
    const bpDone = p.bracketPicks
      ? Object.values(p.bracketPicks).reduce((a, r) => a + (Array.isArray(r) ? r.filter(Boolean).length : 0), 0)
      : 0;
    return `<div class="player-row-admin">
      <div class="player-avatar-admin">${p.name.slice(0,2).toUpperCase()}</div>
      <div style="flex:1;">
        <div class="player-admin-name">${p.name}</div>
        <div class="player-admin-detail">${gpDone}/12 groups · ${bpDone} bracket picks · ${p.goldenBoot ? "⚽ " + p.goldenBoot : "no golden boot"}</div>
      </div>
      <button class="del-btn" onclick="removePlayer(${i})">✕</button>
    </div>`;
  }).join("");
}

function refreshPicksPlayerSelect() {
  const sel = document.getElementById("picks-player-sel");
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = `<option value="">— select your name —</option>` +
    S.players.map((p, i) => `<option value="${i}">${p.name}</option>`).join("");
  if (cur !== "") sel.value = cur;
}
