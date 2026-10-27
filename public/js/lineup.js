// Lineup check shared by the site and the Telegram bot, so it must stay free of
// browser and Node APIs. Read-only: it reports problems, it can't change a lineup.
const OUT = new Set(['Out', 'IR', 'PUP', 'Sus', 'NA', 'DNR']);
const WARN = new Set(['Doubtful', 'Questionable']);
const FLEX_SLOTS = {
  FLEX: ['RB', 'WR', 'TE'],
  WRRB_FLEX: ['RB', 'WR'],
  REC_FLEX: ['WR', 'TE'],
  SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
};
const eligible = (slot, pos) => slot === pos || (FLEX_SLOTS[slot] ?? []).includes(pos);
const MIN_EDGE = 3; // bench must out-average a healthy starter by this many points a game

// info(pid) -> { name, pos, inj };  avgOf(pid) -> points per game this season (0 if unknown)
export function checkLineup({ starters, players, slots, info, avgOf }) {
  const issues = [];
  const used = new Set();
  const bench = players.filter((pid) => !starters.includes(pid));
  const flagged = (pid) => OUT.has(info(pid).inj) || WARN.has(info(pid).inj);

  starters.forEach((pid, i) => {
    const slot = slots[i] ?? 'FLEX';
    if (!pid || pid === '0') {
      issues.push({ level: 'bad', kind: 'empty', slot, text: `${slot} slot is empty` });
      return;
    }
    const me = info(pid);
    const status = OUT.has(me.inj) ? 'out' : WARN.has(me.inj) ? 'warn' : null;

    const best = bench
      .filter((b) => !used.has(b) && eligible(slot, info(b).pos) && !flagged(b))
      .sort((a, b) => avgOf(b) - avgOf(a))[0];
    const edge = best ? avgOf(best) - avgOf(pid) : 0;

    if (status) {
      const swap = best && (status === 'out' || edge > 0) ? best : null;
      if (swap) used.add(swap);
      issues.push({
        level: status === 'out' ? 'bad' : 'warn',
        kind: 'injury',
        pid,
        slot,
        swap: swap ?? undefined,
        text: `${me.name} (${me.pos}) is ${me.inj} in the ${slot} slot`,
      });
    } else if (best && edge >= MIN_EDGE && me.pos !== 'K' && me.pos !== 'DEF') {
      used.add(best);
      issues.push({
        level: 'tip',
        kind: 'swap',
        pid,
        slot,
        swap: best,
        text: `${info(best).name} averages ${avgOf(best).toFixed(1)} vs ${avgOf(pid).toFixed(1)} for ${me.name}`,
      });
    }
  });

  const rank = { bad: 3, warn: 2, tip: 1 };
  issues.sort((a, b) => rank[b.level] - rank[a.level]);
  const worst = issues[0]?.level;
  return { issues, status: worst === 'bad' ? 'bad' : worst === 'warn' ? 'warn' : worst === 'tip' ? 'tip' : 'ok' };
}
