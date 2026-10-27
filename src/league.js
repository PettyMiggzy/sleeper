import { api } from './sleeper.js';

export const leagueId = () => process.env.LEAGUE_ID || '1395889697909133312';

export async function loadLeague() {
  const id = leagueId();
  const [league, users, rosters, state] = await Promise.all([
    api(`/league/${id}`, 60_000),
    api(`/league/${id}/users`, 60_000),
    api(`/league/${id}/rosters`, 30_000),
    api('/state/nfl', 60_000),
  ]);
  const userById = new Map(users.map((u) => [u.user_id, u]));
  const teams = new Map();
  for (const r of rosters) {
    const u = userById.get(r.owner_id);
    const s = r.settings;
    teams.set(r.roster_id, {
      id: r.roster_id,
      name: u?.metadata?.team_name || u?.display_name || `Team ${r.roster_id}`,
      owner: u?.display_name || 'unknown',
      w: s.wins ?? 0,
      l: s.losses ?? 0,
      t: s.ties ?? 0,
      pf: (s.fpts ?? 0) + (s.fpts_decimal ?? 0) / 100,
      pa: (s.fpts_against ?? 0) + (s.fpts_against_decimal ?? 0) / 100,
      players: r.players ?? [],
      starters: r.starters ?? [],
    });
  }
  return { id, league, state, teams };
}

// Match on team name or Sleeper username, case-insensitive, exact before partial.
export function findTeam(model, query) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const all = [...model.teams.values()];
  const exact = all.find((t) => t.name.toLowerCase() === q || t.owner.toLowerCase() === q);
  if (exact) return exact;
  return all.find((t) => t.name.toLowerCase().includes(q) || t.owner.toLowerCase().includes(q)) ?? null;
}

export async function weekGames(model, week) {
  const entries = await api(`/league/${model.id}/matchups/${week}`, 30_000);
  const byId = new Map();
  for (const e of entries) {
    if (e.matchup_id == null) continue;
    if (!byId.has(e.matchup_id)) byId.set(e.matchup_id, []);
    byId.get(e.matchup_id).push(e);
  }
  const games = [...byId.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, g]) => g)
    .filter((g) => g.length === 2);
  return { entries, games };
}

// The week to show scores for: the current week, or the previous one if
// nothing has been scored yet (e.g. Tuesday after Sleeper rolls the week).
export async function scoreWeek(model) {
  const w = model.state.week;
  const { entries } = await weekGames(model, w);
  return entries.every((e) => !e.points) && w > 1 ? w - 1 : w;
}

export const lastCompletedWeek = (model) => Math.max(0, model.state.week - 1);
