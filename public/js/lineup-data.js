// Lineup helpers live in their own module (not data.js) and lean only on long-standing
// data.js exports, so a stale cached data.js can never break the pages that use them.
import { player, slotsOf } from './data.js';
import { checkLineup } from './lineup.js';

const sum = (xs) => xs.reduce((a, b) => a + b, 0);

// Points per game over completed weeks the player actually scored in.
export function playerAvg(model, pid) {
  const rec = model.playerPts.get(pid);
  if (!rec) return 0;
  const vals = model.done.map((w) => rec.by[w.week]).filter((v) => v > 0);
  return vals.length ? sum(vals) / vals.length : 0;
}

export function lineupFor(model, pm, team) {
  const info = (pid) => {
    const p = player(pm, pid);
    return { name: p.name, pos: p.pos, inj: p.inj };
  };
  return checkLineup({
    starters: team.starters,
    players: team.players,
    slots: slotsOf(model),
    info,
    avgOf: (pid) => playerAvg(model, pid),
  });
}
