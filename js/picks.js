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

  const myIdx   = localStorage.getItem("wc26myidx");
  const isOwner = myIdx !== null && parseInt(myIdx) === idx;

  const locked  = S.phase === "group" ? isGroupPicksLocked() : isKOPicksLocked();
  const canEdit = isOwner && !locked;

  let html = "";

  if (!isOwner) {
    html += `<div style="padding:0 16px 8px;">
      <div class="info">👀 <strong>Viewing ${p.name}'s picks.</strong> You can only edit your own picks.</div>
    </div>`;
  } else if (locked) {
    const msg = S.phase === "group"
      ? "🔒 <strong>Picks locked</strong> — the tournament has started. Group picks can no longer be changed."
      : "🔒 <strong>Picks locked</strong> — the knockout stage has begun. Bracket picks can no longer be changed.";
    html += `<div style="padding:0 16px 8px;">
      <div class="info amber">${msg}</div>
    </div>`;
  }

  if (S.phase === "group") {
    if (canEdit) {
      html += `<div style="padding:0 16px 8px;">
        <div class="info amber">📋 <strong>Phase 1 — Group stage.</strong> Predict how each group will finish. Bracket picks open after the group stage ends.</div>
      </div>`;
    }
    html += renderGoldenBootPick(idx, p, canEdit);
    html += renderGroupPicksForms(idx, p, canEdit);
  } else {
    if (canEdit) {
      html += `<div style="padding:0 16px 8px;">
        <div class="info green">✅ <strong>The bracket is set.</strong> Pick your teams for every knockout round — from Round of 32 all the way to the champion. Each round's options update based on your previous picks.</div>
      </div>`;
    }
    html += renderGoldenBootPick(idx, p, canEdit);
    html += renderBracketPicksForms(idx, p, canEdit);
  }

  if (canEdit) {
    html += `<div class="picks-save-bar"><button class="btn-primary" onclick="saveAllPicks(${idx})">Save all picks</button></div>`;
  }
  el.innerHTML = html;

  if (S.phase === "group" && canEdit) initSortable();
}

function renderGoldenBootPick(idx, p, isOwner = true) {
  return `<div class="golden-boot-row">
    <div class="golden-boot-inner">
      <div class="golden-boot-icon">⚽</div>
      <div class="golden-boot-content">
        <div class="picks-pts">4 pts if correct</div>
        <label>Golden boot scorer</label>
        <input type="text" id="gb-inp-${idx}" value="${p.goldenBoot || ""}" placeholder="Player name (e.g. Haaland)" ${isOwner ? "" : "disabled"} />
      </div>
    </div>
  </div><hr class="sep">`;
}

function renderGroupPicksForms(idx, p, isOwner = true) {
  const medals   = ["🥇","🥈","🥉","4️⃣"];
  const ptLabels = ["2pts","2pts","2pts","2pts"];

  let html = `<div style="padding: 0 16px 6px;">
    <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:10px;">
      <div style="font-family:var(--font-display);font-size:22px;font-weight:800;letter-spacing:0.02em;">Group picks</div>
      <div class="pts-pill">${isOwner ? "Drag to rank · 2pts each" : "2pts each"}</div>
    </div>
  </div>
  <div class="group-picks-grid">`;

  Object.entries(GROUPS).forEach(([g, teams]) => {
    const gp = p.groupPicks[g] || {};
    const saved     = [1,2,3,4].map(pos => gp[pos]).filter(Boolean);
    const remaining = teams.filter(t => !saved.includes(t));
    const order     = [...saved, ...remaining];

    html += `<div class="group-pick-card"><div class="card-title">Group ${g}</div>
      <div class="sortable-list${isOwner ? "" : " sortable-list--readonly"}" id="sort-${idx}-${g}">`;
    order.forEach((team, i) => {
      html += `<div class="sort-item${isOwner ? "" : " sort-item--readonly"}" data-team="${team}">
        ${isOwner ? `<span class="drag-handle">⠿</span>` : ""}
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
  const ptLabels = ["2pts","2pts","2pts","2pts"];
  [...list.querySelectorAll('.sort-item')].forEach((item, i) => {
    const posEl = item.querySelector('.sort-pos');
    const ptsEl = item.querySelector('.sort-pts');
    if (posEl) posEl.textContent = medals[i];
    if (ptsEl) ptsEl.textContent = ptLabels[i];
  });
}

function renderBracketPicksForms(idx, p, isOwner = true) {
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
      if (isOwner) {
        html += `<select id="bk-${idx}-${round.id}-${i}"
          style="${isElim ? "border-color:var(--crimson);opacity:0.6;" : ""}"
          onchange="onBracketPickChange(${idx},'${round.id}',${i},this.value)">
          ${teamOpts(pool, cur)}
        </select>`;
      } else {
        html += `<select disabled style="${isElim ? "border-color:var(--crimson);opacity:0.6;" : ""}">
          ${teamOpts(pool, cur)}
        </select>`;
      }
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
    if (!p.groupPicks) p.groupPicks = {};
    Object.keys(GROUPS).forEach(g => {
      p.groupPicks[g] = {};
      const list = document.getElementById(`sort-${idx}-${g}`);
      if (list) {
        [...list.querySelectorAll('.sort-item')].forEach((item, i) => {
          p.groupPicks[g][i + 1] = item.dataset.team;
        });
      }
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
  const myIdx = localStorage.getItem("wc26myidx");
  const cur   = myIdx !== null && S.players[parseInt(myIdx)] ? myIdx : sel.value;
  sel.innerHTML = `<option value="">— select your name —</option>` +
    S.players.map((p, i) => `<option value="${i}">${p.name}${String(i) === myIdx ? " (you)" : ""}</option>`).join("");
  if (cur !== "") sel.value = cur;
}
