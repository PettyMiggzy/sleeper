// Data layer: Sleeper API (CORS-open, no key) + everything we derive from it.
import { checkLineup } from './lineup.js';

const SLEEPER = 'https://api.sleeper.app/v1';
export const params = new URLSearchParams(location.search);
export const LEAGUE_ID = params.get('league') || '1395889697909133312';

const memo = new Map();
export const clearCache = () => memo.clear();
export function api(path, ttl = 30_000) {
  const hit = memo.get(path);
  if (hit && Date.now() - hit.at < ttl) return hit.p;
  const p = fetch(SLEEPER + path).then((r) => {
    if (!r.ok) throw new Error(`Sleeper ${r.status} on ${path}`);
    return r.json();
  });
  memo.set(path, { at: Date.now(), p });
  p.catch(() => memo.delete(path));
  return p;
}

/* ---------- players ---------- */

const POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);
function slim(raw) {
  const out = {};
  for (const [id, p] of Object.entries(raw)) {
    if (!POSITIONS.has(p.position)) continue;
    if (p.position !== 'DEF' && !p.team && p.status !== 'Active') continue;
    const name = p.position === 'DEF' ? `${id} D/ST` : p.full_name || `${p.first_name} ${p.last_name}`;
    out[id] = [name, p.position, p.team || 'FA', p.search_rank ?? 9999, p.injury_status || ''];
  }
  return out;
}

let playersP;
export function loadPlayers() {
  return (playersP ??= fetch('/api/players')
    .then((r) => {
      if (!r.ok) throw new Error('players api');
      return r.json();
    })
    .catch(async () => slim(await api('/players/nfl', 3_600_000))));
}

export function player(pm, id, fallback) {
  const a = pm[id];
  if (a) return { id, name: a[0], pos: a[1], team: a[2], rank: a[3], inj: a[4] };
  return {
    id,
    name: fallback?.name ?? `Player ${id}`,
    pos: fallback?.pos ?? '?',
    team: fallback?.team ?? '',
    rank: 9999,
    inj: '',
  };
}

/* ---------- league model ---------- */

const range = (a, b) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

export async function loadModel() {
  const id = LEAGUE_ID;
  const [league, users, rosters, state] = await Promise.all([
    api(`/league/${id}`, 60_000),
    api(`/league/${id}/users`, 60_000),
    api(`/league/${id}/rosters`, 30_000),
    api('/state/nfl', 60_000),
  ]);
  const userBy = new Map(users.map((u) => [u.user_id, u]));
  const teams = rosters
    .map((r) => {
      const u = userBy.get(r.owner_id);
      return {
        id: r.roster_id,
        name: u?.metadata?.team_name || u?.display_name || `Team ${r.roster_id}`,
        owner: u?.display_name || 'unknown',
        avatar: u?.avatar || null,
        userId: r.owner_id,
        players: r.players ?? [],
        starters: r.starters ?? [],
        reserve: r.reserve ?? [],
      };
    })
    .sort((a, b) => a.id - b.id);
  const teamBy = new Map(teams.map((t) => [t.id, t]));

  const maxWeek = Math.min(Math.max(state.week, 0), 18);
  const weeks = await Promise.all(
    range(1, maxWeek).map(async (week) => {
      const entries = (await api(`/league/${id}/matchups/${week}`, week < state.week ? 3_600_000 : 30_000)).filter(
        (e) => e.matchup_id != null,
      );
      const by = new Map();
      for (const e of entries) (by.get(e.matchup_id) ?? by.set(e.matchup_id, []).get(e.matchup_id)).push(e);
      const games = [...by.entries()].sort((a, b) => a[0] - b[0]).map(([, g]) => g).filter((g) => g.length === 2);
      const total = sum(entries.map((e) => e.points || 0));
      return { week, entries, games, total, complete: week < state.week && total > 0, live: week === state.week && total > 0 };
    }),
  );

  const rows = new Map(
    teams.map((t) => [
      t.id,
      { team: t, pts: [], opp: [], res: [], oppId: [], w: 0, l: 0, t: 0, pf: 0, pa: 0, ap: 0, bench: 0, bestWeek: null },
    ]),
  );
  const done = weeks.filter((w) => w.complete);
  const nOthers = Math.max(1, teams.length - 1);
  for (const wk of done) {
    for (const [a, b] of wk.games) {
      for (const [me, them] of [[a, b], [b, a]]) {
        const r = rows.get(me.roster_id);
        if (!r) continue;
        r.pts.push(me.points);
        r.opp.push(them.points);
        r.oppId.push(them.roster_id);
        r.pf += me.points;
        r.pa += them.points;
        const res = me.points > them.points ? 'W' : me.points < them.points ? 'L' : 'T';
        r.res.push(res);
        r[res.toLowerCase()]++;
        if (!r.bestWeek || me.points > r.bestWeek.pts) r.bestWeek = { week: wk.week, pts: me.points };
      }
    }
    for (const e of wk.entries) {
      const r = rows.get(e.roster_id);
      if (!r) continue;
      for (const o of wk.entries) {
        if (o === e) continue;
        r.ap += e.points > o.points ? 1 : e.points === o.points ? 0.5 : 0;
      }
      const starters = new Set(e.starters);
      r.bench += sum(Object.entries(e.players_points ?? {}).filter(([pid]) => !starters.has(pid)).map(([, p]) => p));
    }
  }
  const list = [...rows.values()];
  const n = Math.max(1, done.length);
  const recent = (r) => {
    const last = r.pts.slice(-3);
    return last.length ? sum(last) / last.length : 0;
  };
  const rec = list.map(recent);
  const lo = Math.min(...rec);
  const hi = Math.max(...rec);
  for (const r of list) {
    r.games = r.pts.length;
    r.avg = r.games ? r.pf / r.games : 0;
    r.winPct = r.games ? (r.w + r.t / 2) / r.games : 0;
    r.apPct = r.games ? r.ap / (r.games * nOthers) : 0;
    r.expW = r.apPct * r.games;
    r.luck = r.w + r.t / 2 - r.expW;
    r.recent = recent(r);
    r.power = 100 * (0.45 * r.apPct + 0.3 * r.winPct + 0.25 * (hi > lo ? (r.recent - lo) / (hi - lo) : 0.5));
  }
  const byStanding = [...list].sort((a, b) => b.w - a.w || b.pf - a.pf);
  byStanding.forEach((r, i) => (r.rank = i + 1));
  [...list].sort((a, b) => b.power - a.power).forEach((r, i) => (r.powerRank = i + 1));
  [...list].sort((a, b) => b.pf - a.pf).forEach((r, i) => (r.pfRank = i + 1));

  const playerPts = new Map();
  for (const wk of weeks) {
    for (const e of wk.entries) {
      const starters = new Set(e.starters);
      for (const [pid, p] of Object.entries(e.players_points ?? {})) {
        const rec = playerPts.get(pid) ?? { total: 0, by: {}, started: 0 };
        rec.total += p;
        rec.by[wk.week] = p;
        if (starters.has(pid) && wk.complete) rec.started++;
        playerPts.set(pid, rec);
      }
    }
  }

  return { id, league, state, teams, teamBy, weeks, done, rows: byStanding, rowBy: rows, playerPts, doneCount: n };
}

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
  return checkLineup({ starters: team.starters, players: team.players, slots: slotsOf(model), info, avgOf: (pid) => playerAvg(model, pid) });
}

export function slotsOf(model) {
  return model.league.roster_positions.filter((p) => p !== 'BN');
}

/* ---------- draft ---------- */

export async function loadDraft(draftId, ttl = 5_000) {
  const [draft, picks] = await Promise.all([api(`/draft/${draftId}`, ttl), api(`/draft/${draftId}/picks`, ttl)]);
  return { draft, picks };
}

// Who picks at overall pick n (1-indexed). Returns null for unsupported (auction) drafts.
export function pickOwner(draft, n) {
  if (draft.type === 'auction') return null;
  const teams = draft.settings.teams;
  const round = Math.ceil(n / teams);
  const idx = (n - 1) % teams;
  const snake = draft.type === 'snake';
  const reversed = snake && round % 2 === 0;
  const slot = reversed ? teams - idx : idx + 1;
  return { n, round, slot, rosterId: draft.slot_to_roster_id?.[slot] ?? null };
}

const GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'F'];

export function draftValue(model, picks) {
  const byPos = new Map();
  for (const p of picks) {
    const pos = p.metadata.position;
    (byPos.get(pos) ?? byPos.set(pos, []).get(pos)).push({
      pick: p,
      pts: model.playerPts.get(p.player_id)?.total ?? 0,
    });
  }
  const scored = [];
  for (const items of byPos.values()) {
    const byPick = [...items].sort((a, b) => a.pick.pick_no - b.pick.pick_no);
    const byPts = [...items].sort((a, b) => b.pts - a.pts);
    for (const it of items) {
      it.pickRank = byPick.indexOf(it) + 1;
      it.ptsRank = byPts.indexOf(it) + 1;
      it.delta = it.pickRank - it.ptsRank;
      scored.push(it);
    }
  }
  const steals = scored.filter((s) => s.pts > 0).sort((a, b) => b.delta - a.delta || b.pts - a.pts).slice(0, 8);
  const busts = scored.filter((s) => s.pick.round <= 8).sort((a, b) => a.delta - b.delta || a.pts - b.pts).slice(0, 8);

  // Points each team's own draftees delivered while in its starting lineup.
  const haul = new Map(model.teams.map((t) => [t.id, 0]));
  const owner = new Map(picks.map((p) => [p.player_id, p.roster_id]));
  for (const wk of model.weeks) {
    if (!wk.complete && !wk.live) continue;
    for (const e of wk.entries) {
      for (const pid of e.starters) {
        if (owner.get(pid) === e.roster_id) haul.set(e.roster_id, haul.get(e.roster_id) + (e.players_points?.[pid] ?? 0));
      }
    }
  }
  const teamsRanked = model.teams
    .map((t) => ({ team: t, haul: haul.get(t.id) ?? 0 }))
    .sort((a, b) => b.haul - a.haul)
    .map((x, i, arr) => ({ ...x, rank: i + 1, grade: GRADES[Math.min(GRADES.length - 1, Math.floor((i / arr.length) * GRADES.length))] }));
  return { steals, busts, teamsRanked, scored };
}

/* ---------- awards ---------- */

export function weekAwards(model, pm, week) {
  const wk = model.weeks.find((w) => w.week === week);
  if (!wk) return [];
  const scored = wk.entries.filter((e) => e.points > 0);
  if (!scored.length) return [];
  const T = (id) => model.teamBy.get(id);
  const top = scored.reduce((a, b) => (b.points > a.points ? b : a));
  const low = scored.reduce((a, b) => (b.points < a.points ? b : a));
  const margin = (g) => Math.abs(g[0].points - g[1].points);
  const win = (g) => (g[0].points >= g[1].points ? g[0] : g[1]);
  const lose = (g) => (g[0].points >= g[1].points ? g[1] : g[0]);
  const blow = wk.games.reduce((a, b) => (margin(b) > margin(a) ? b : a));
  const close = wk.games.reduce((a, b) => (margin(b) < margin(a) ? b : a));
  let star = null;
  let bench = null;
  for (const e of scored) {
    const starters = new Set(e.starters);
    for (const [pid, p] of Object.entries(e.players_points ?? {})) {
      if (starters.has(pid)) {
        if (!star || p > star.p) star = { e, pid, p };
      } else if (!bench || p > bench.p) bench = { e, pid, p };
    }
  }
  const out = [
    { icon: '👑', title: 'Top score', team: T(top.roster_id), text: `${top.points.toFixed(2)} points`, tone: 'gold' },
    { icon: '🗑️', title: 'Toilet bowl', team: T(low.roster_id), text: `Managed only ${low.points.toFixed(2)}`, tone: 'bad' },
    {
      icon: '💥',
      title: 'Blowout',
      team: T(win(blow).roster_id),
      text: `Beat ${T(lose(blow).roster_id).name} by ${margin(blow).toFixed(2)}`,
      tone: 'hot',
    },
    {
      icon: '😬',
      title: 'Nail-biter',
      team: T(win(close).roster_id),
      text: `Edged ${T(lose(close).roster_id).name} by ${margin(close).toFixed(2)}`,
      tone: 'cool',
    },
  ];
  if (star) {
    const p = player(pm, star.pid);
    out.push({ icon: '⭐', title: 'Best starter', team: T(star.e.roster_id), text: `${p.name} put up ${star.p.toFixed(1)}`, tone: 'gold', pid: star.pid });
  }
  if (bench) {
    const p = player(pm, bench.pid);
    out.push({ icon: '🪑', title: 'Bench regret', team: T(bench.e.roster_id), text: `${p.name} scored ${bench.p.toFixed(1)} sitting`, tone: 'bad', pid: bench.pid });
  }
  return out;
}

export function seasonAwards(model) {
  const rows = model.rows;
  if (!rows.length || !model.done.length) return [];
  const best = (fn, dir = 1) => rows.reduce((a, b) => (dir * fn(b) > dir * fn(a) ? b : a));
  const T = (r) => r.team;
  const high = best((r) => r.bestWeek?.pts ?? 0);
  const luckiest = best((r) => r.luck);
  const unlucky = best((r) => r.luck, -1);
  const pfMost = best((r) => r.pf);
  const paMost = best((r) => r.pa);
  const benchMost = best((r) => r.bench);
  let blow = null;
  let close = null;
  for (const wk of model.done)
    for (const g of wk.games) {
      const m = Math.abs(g[0].points - g[1].points);
      const w = g[0].points >= g[1].points ? g[0] : g[1];
      const l = w === g[0] ? g[1] : g[0];
      if (!blow || m > blow.m) blow = { m, w, l, week: wk.week };
      if (!close || m < close.m) close = { m, w, l, week: wk.week };
    }
  const t = (id) => model.teamBy.get(id);
  return [
    { icon: '🚀', title: 'Single-week high', team: T(high), text: `${high.bestWeek.pts.toFixed(2)} in week ${high.bestWeek.week}` },
    { icon: '🔥', title: 'Points machine', team: T(pfMost), text: `${pfMost.pf.toFixed(1)} PF (${pfMost.avg.toFixed(1)} / game)` },
    { icon: '🍀', title: 'Luckiest', team: T(luckiest), text: `${luckiest.w}-${luckiest.l} but deserved ${luckiest.expW.toFixed(1)} wins` },
    { icon: '😭', title: 'Most robbed', team: T(unlucky), text: `${unlucky.w}-${unlucky.l} but deserved ${unlucky.expW.toFixed(1)} wins` },
    { icon: '🛡️', title: 'Punching bag', team: T(paMost), text: `${paMost.pa.toFixed(1)} points against` },
    { icon: '🪑', title: 'Bench warmer', team: T(benchMost), text: `${benchMost.bench.toFixed(1)} pts left on the bench` },
    { icon: '💥', title: 'Biggest blowout', team: t(blow.w.roster_id), text: `Week ${blow.week} over ${t(blow.l.roster_id).name} by ${blow.m.toFixed(2)}` },
    { icon: '😬', title: 'Closest game', team: t(close.w.roster_id), text: `Week ${close.week} over ${t(close.l.roster_id).name} by ${close.m.toFixed(2)}` },
  ];
}

/* ---------- transactions ---------- */

export async function loadMoves(model) {
  const weeks = range(1, Math.max(1, model.state.week));
  const all = (await Promise.all(weeks.map((w) => api(`/league/${model.id}/transactions/${w}`, 60_000).catch(() => [])))).flat();
  return all.filter((t) => t.status === 'complete').sort((a, b) => b.created - a.created);
}
