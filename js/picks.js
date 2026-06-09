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
  const medals   = ["🥇","🥈","🥉","4️⃣"];
  const ptLabels = ["3pts","2pts","1pt","0pts"];

  let html = `<div style="padding: 0 16px 6px;">
    <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:10px;">
      <div style="font-family:var(--font-display);font-size:22px;font-weight:800;letter-spacing:0.02em;">Group picks</div>
      <div class="pts-pill">Drag to rank · 1st=3pts</div>
    </div>
  </div>
  <div class="group-picks-grid">`;

  Object.entries(GROUPS).forEach(([g, teams]) => {
    const gp = p.groupPicks[g] || {};
    const saved     = [1,2,3,4].map(pos => gp[pos]).filter(Boolean);
    const remaining = teams.filter(t => !saved.includes(t));
    const order     = [...saved, ...remaining];

    html += `<div class="group-pick-card"><div class="card-title">Group ${g}</div>
      <div class="sortable-list" id="sort-${idx}-${g}">`;
    order.forEach((team, i) => {
      html += `<div class="sort-item" data-team="${team}">
        <span class="drag-handle">⠿</span>
        <span class="sort-pos">${medals[i]}</span>
        <span class="sort-flag">${flag(team)}</span>
        <span class="sort-name">${team}</span>
        <span class="sort-pts">${ptLabels[i]}</span>
      </div>`;
    });
    html += `</div></div>`;
  });

  html += `</div>`;
  return html;
}

// ── DRAG-AND-DROP SORTABLE ────────────────────────────────────────
let _drag = { item: null, list: null, placeholder: null, offsetY: 0 };

function initSortable() {
  document.querySelectorAll('.sort-item').forEach(item => {
    item.addEventListener('pointerdown', _dragStart, { passive: false });
  });
}

function _dragStart(e) {
  if (!e.target.closest('.drag-handle')) return;
  e.preventDefault();

  const item = e.currentTarget;
  const list = item.closest('.sortable-list');
  const rect = item.getBoundingClientRect();

  const ph = document.createElement('div');
  ph.className = 'sort-placeholder';
  ph.style.height = rect.height + 'px';
  list.insertBefore(ph, item);

  item.style.cssText = `position:fixed;top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;z-index:999;margin:0;`;
  item.classList.add('dragging');

  _drag = { item, list, placeholder: ph, offsetY: e.clientY - rect.top };

  document.addEventListener('pointermove', _dragMove, { passive: false });
  document.addEventListener('pointerup',   _dragEnd);
  document.addEventListener('pointercancel', _dragEnd);
}

function _dragMove(e) {
  if (!_drag.item) return;
  e.preventDefault();
  _drag.item.style.top = (e.clientY - _drag.offsetY) + 'px';

  const items = [..._drag.list.querySelectorAll('.sort-item:not(.dragging)')];
  let insertBefore = null;
  for (const other of items) {
    const box = other.getBoundingClientRect();
    if (e.clientY < box.top + box.height / 2) { insertBefore = other; break; }
  }
  if (insertBefore) _drag.list.insertBefore(_drag.placeholder, insertBefore);
  else              _drag.list.appendChild(_drag.placeholder);
}

function _dragEnd() {
  if (!_drag.item) return;
  const { item, list, placeholder } = _drag;

  list.insertBefore(item, placeholder);
  placeholder.remove();
  item.style.cssText = '';
  item.classList.remove('dragging');
  _updateSortPositions(list);

  document.removeEventListener('pointermove', _dragMove);
  document.removeEventListener('pointerup',   _dragEnd);
  document.removeEventListener('pointercancel', _dragEnd);
  _drag = { item: null, list: null, placeholder: null, offsetY: 0 };
}

function _updateSortPositions(list) {
  const medals   = ["🥇","🥈","🥉","4️⃣"];
  const ptLabels = ["3pts","2pts","1pt","0pts"];
  [...list.querySelectorAll('.sort-item')].forEach((item, i) => {
    const posEl = item.querySelector('.sort-pos');
    const ptsEl = item.querySelector('.sort-pts');
    if (posEl) posEl.textContent = medals[i];
    if (ptsEl) ptsEl.textContent = ptLabels[i];
  });
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
