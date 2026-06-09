// ── BRACKET PAGE ─────────────────────────────────────────────────

function renderBracketPage() {
  const el = document.getElementById("bracket-content");
  if (!el) return;

  if (S.phase === "group") {
    el.innerHTML = `<div class="bracket-empty">
      <div style="font-size:40px;margin-bottom:12px;">🗂</div>
      <div>The bracket opens after the group stage.<br>Come back when all groups are complete.</div>
    </div>`;
    return;
  }

  // Player selector
  let html = `<div class="bracket-player-sel">
    <label>View a player's picks</label>
    <select id="bracket-player-sel" onchange="renderBracketForPlayer()" style="max-width:280px;">
      <option value="">— all results —</option>
      ${S.players.map((p,i) => `<option value="${i}">${p.name}</option>`).join("")}
    </select>
  </div>`;
  el.innerHTML = html;
  renderBracketForPlayer();
}

function renderBracketForPlayer() {
  const el  = document.getElementById("bracket-content");
  const sel = document.getElementById("bracket-player-sel");
  if (!el || !sel) return;

  const idx = sel ? parseInt(sel.value) : NaN;
  const p   = (!isNaN(idx) && idx >= 0) ? S.players[idx] : null;

  const eliminated = getEliminatedTeams();
  let html = `<div class="bracket-player-sel">
    <label>View a player's picks</label>
    <select id="bracket-player-sel" onchange="renderBracketForPlayer()" style="max-width:280px;">
      <option value="">— all results —</option>
      ${S.players.map((p,i) => `<option value="${i}"${i === idx?" selected":""}>${p.name}</option>`).join("")}
    </select>
  </div>`;

  KO_ROUNDS.forEach(round => {
    const matches  = S.koResults[round.id] || [];
    const picks    = p ? ((p.bracketPicks && p.bracketPicks[round.id]) || []) : [];
    const pickSet  = new Set(picks.filter(Boolean));

    html += `<div class="bracket-round">
      <div class="bracket-round-header">
        <div class="bracket-round-title">${round.label}</div>
        <div class="pts-pill">${round.pts} pts</div>
      </div>`;

    if (round.id === "champ") {
      // Champion: single winner display
      const winner = (matches[0] && matches[0].winner) || "";
      html += `<div class="bracket-match">`;
      if (winner) {
        const correct = pickSet.has(winner);
        html += bracketTeamRow(winner, correct ? "correct" : (pickSet.size > 0 ? "wrong" : "pending"), p ? correct : null);
      } else {
        // show pick if exists
        const pick = picks[0] || "";
        html += bracketTeamRow(pick || "TBD", pick && eliminated.has(pick) ? "eliminated" : "pending", null);
      }
      html += `</div>`;
    } else if (matches.length) {
      // Matches known — show each match with result
      matches.forEach(m => {
        html += `<div class="bracket-match">`;
        [m.t1, m.t2].forEach(team => {
          if (!team) return;
          const isWinner   = m.winner === team;
          const isLoser    = m.winner && m.winner !== team;
          const playerPick = pickSet.has(team);
          let status = "pending";
          if (isWinner && playerPick && p)  status = "correct";
          else if (isWinner && p)           status = "pending"; // match decided but player didn't pick this
          else if (isLoser)                 status = "eliminated";
          else if (playerPick)              status = "picked-winner";
          html += bracketTeamRow(team, status, p ? (isWinner && playerPick) : null, isWinner);
        });
        html += `</div>`;
      });
    } else if (picks.length) {
      // No matches yet — show player's picks
      const pairCount = round.size / 2;
      for (let i = 0; i < pairCount && i * 2 < picks.length; i++) {
        const t1 = picks[i * 2]     || "";
        const t2 = picks[i * 2 + 1] || "";
        html += `<div class="bracket-match">`;
        if (t1) html += bracketTeamRow(t1, eliminated.has(t1) ? "eliminated" : "pending", null);
        if (t2) html += bracketTeamRow(t2, eliminated.has(t2) ? "eliminated" : "pending", null);
        html += `</div>`;
      }
    } else {
      html += `<div style="padding:14px;font-size:13px;color:var(--text3);">No picks or results yet for this round.</div>`;
    }

    html += `</div>`;
  });

  el.innerHTML = html;
}

function bracketTeamRow(team, status, correct, isActualWinner = false) {
  const statusIcon = correct === true ? "✅" : correct === false ? "❌" : (isActualWinner ? "✅" : "");
  return `<div class="bracket-team ${status}">
    <span class="flag">${flag(team)}</span>
    <span class="team-name">${team || "TBD"}</span>
    ${statusIcon ? `<span class="pick-status">${statusIcon}</span>` : ""}
  </div>`;
}
