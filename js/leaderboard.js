// ── SCORING ENGINE ────────────────────────────────────────────────

// All teams that have been eliminated from KO rounds (have lost a match)
function getEliminatedTeams() {
  const eliminated = new Set();
  KO_ROUNDS.forEach(round => {
    if (round.id === "champ") return;
    const matches = S.koResults[round.id] || [];
    matches.forEach(m => {
      if (m.winner && m.t1 && m.t2) {
        // loser is eliminated
        const loser = m.winner === m.t1 ? m.t2 : m.t1;
        if (loser) eliminated.add(loser);
      }
    });
  });
  return eliminated;
}

// Teams still in the tournament (in R32 bracket and not eliminated)
function getStillAliveTeams() {
  const allInBracket = new Set(S.bracketTeams);
  const eliminated = getEliminatedTeams();
  return new Set([...allInBracket].filter(t => !eliminated.has(t)));
}

// Compute a player's current earned points
function calcCurrentPts(p) {
  let pts = 0;

  // Group picks
  Object.keys(GROUPS).forEach(g => {
    const res  = S.groupResults[g] || {};
    const pick = p.groupPicks[g]   || {};
    [1,2,3,4].forEach(pos => {
      if (res[pos] && pick[pos] && res[pos] === pick[pos]) pts += GROUP_PTS[pos];
    });
  });

  // Golden boot
  if (S.goldenBootResult && p.goldenBoot &&
      p.goldenBoot.trim().toLowerCase() === S.goldenBootResult.trim().toLowerCase()) {
    pts += GOLDEN_PTS;
  }

  // KO bracket picks
  KO_ROUNDS.forEach(round => {
    const results = S.koResults[round.id] || [];
    const winners = new Set(results.map(m => m.winner).filter(Boolean));
    const picks   = (p.bracketPicks && p.bracketPicks[round.id]) || [];
    picks.forEach(t => { if (t && winners.has(t)) pts += round.pts; });
  });

  return pts;
}

// Breakdown of points per category (for leaderboard detail row)
function calcBreakdown(p) {
  const parts = [];

  let gPts = 0;
  Object.keys(GROUPS).forEach(g => {
    const res  = S.groupResults[g] || {};
    const pick = p.groupPicks[g]   || {};
    [1,2,3,4].forEach(pos => {
      if (res[pos] && pick[pos] && res[pos] === pick[pos]) gPts += GROUP_PTS[pos];
    });
  });
  if (gPts) parts.push(`Groups ${gPts}`);

  if (S.goldenBootResult && p.goldenBoot &&
      p.goldenBoot.trim().toLowerCase() === S.goldenBootResult.trim().toLowerCase()) {
    parts.push("Boot +4");
  }

  KO_ROUNDS.forEach(round => {
    const results = S.koResults[round.id] || [];
    const winners = new Set(results.map(m => m.winner).filter(Boolean));
    const picks   = (p.bracketPicks && p.bracketPicks[round.id]) || [];
    let rPts = 0;
    picks.forEach(t => { if (t && winners.has(t)) rPts += round.pts; });
    if (rPts) parts.push(`${round.label.split(" ")[0]} +${rPts}`);
  });

  return parts.join(" · ");
}

// Compute maximum possible points a player can still achieve
function calcMaxPossible(p) {
  let max = calcCurrentPts(p);
  const eliminated = getEliminatedTeams();

  // Remaining group pts — for groups not yet decided, assume all picks could be right
  Object.keys(GROUPS).forEach(g => {
    const res  = S.groupResults[g] || {};
    const pick = p.groupPicks[g]   || {};
    [1,2,3,4].forEach(pos => {
      // only add if result not yet set AND pick exists
      if (!res[pos] && pick[pos]) max += GROUP_PTS[pos];
    });
  });

  // Golden boot — if not yet decided and has a pick, could still get it
  if (!S.goldenBootResult && p.goldenBoot) max += GOLDEN_PTS;

  // KO rounds — for each pick that isn't already eliminated, could still score
  KO_ROUNDS.forEach(round => {
    const results = S.koResults[round.id] || [];
    const winners = new Set(results.map(m => m.winner).filter(Boolean));
    const picks   = (p.bracketPicks && p.bracketPicks[round.id]) || [];
    picks.forEach(t => {
      if (!t) return;
      if (winners.has(t)) return; // already counted in current
      if (!eliminated.has(t)) max += round.pts; // still alive = could score
    });
  });

  return max;
}

// Per-round survival: for each KO round, is the player still alive to score points?
// "alive" = they have at least one pick in that round that hasn't been eliminated
function calcSurvival(p) {
  const eliminated = getEliminatedTeams();
  const hasResults = phase => (S.koResults[phase] || []).some(m => m.winner);

  return KO_ROUNDS.map(round => {
    const picks = (p.bracketPicks && p.bracketPicks[round.id]) || [];
    const validPicks = picks.filter(Boolean);
    if (!validPicks.length) return "pending"; // no picks made

    const results = S.koResults[round.id] || [];
    const winners = new Set(results.map(m => m.winner).filter(Boolean));

    // Already got some right in this round
    const gotSome = validPicks.some(t => winners.has(t));
    if (gotSome) return "correct";

    // Round finished — did they get anything?
    if (hasResults(round.id)) {
      const allBust = validPicks.every(t => !winners.has(t));
      if (allBust && results.length >= round.size / 2) return "busted";
    }

    // Round not finished — are any of their picks still alive?
    const anyAlive = validPicks.some(t => !eliminated.has(t));
    return anyAlive ? "alive" : "busted";
  });
}

// Rank all players for the leaderboard
function getRankedPlayers() {
  return S.players
    .map(p => ({
      ...p,
      pts:         calcCurrentPts(p),
      maxPossible: calcMaxPossible(p),
      breakdown:   calcBreakdown(p),
      survival:    calcSurvival(p),
    }))
    .sort((a, b) => b.pts - a.pts || b.maxPossible - a.maxPossible);
}
