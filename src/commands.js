import { api, players, playerLabel } from './sleeper.js';
import { loadLeague, findTeam, weekGames, scoreWeek, lastCompletedWeek } from './league.js';
import { esc, num, padR, padL, pre } from './format.js';

const arg = (args) => args.join(' ').trim();
const nope = (q) => `Couldn't find a team matching <b>${esc(q)}</b>. Try /standings for names.`;

export async function standings() {
  const m = await loadLeague();
  const rows = [...m.teams.values()].sort((a, b) => b.w - a.w || b.pf - a.pf);
  const lines = rows.map(
    (t, i) => `${padL(i + 1, 2)} ${padR(t.name, 18)} ${padL(`${t.w}-${t.l}${t.t ? `-${t.t}` : ''}`, 5)} ${padL(num(t.pf), 7)}`,
  );
  return `<b>${esc(m.league.name)}</b> standings\n${pre(['#  Team                 W-L      PF', ...lines])}`;
}

export async function scores(args) {
  const m = await loadLeague();
  const week = Number(args[0]) || (await scoreWeek(m));
  const { games } = await weekGames(m, week);
  if (!games.length) return `No matchups found for week ${week}.`;
  const lines = games.map(([a, b]) => {
    const ta = m.teams.get(a.roster_id)?.name ?? a.roster_id;
    const tb = m.teams.get(b.roster_id)?.name ?? b.roster_id;
    const aw = a.points > b.points;
    const bw = b.points > a.points;
    return `${aw ? '🏆' : '▫️'} <b>${esc(ta)}</b> ${num(a.points, 2)}\n${bw ? '🏆' : '▫️'} <b>${esc(tb)}</b> ${num(b.points, 2)}`;
  });
  return `<b>Week ${week} scoreboard</b>\n\n${lines.join('\n\n')}`;
}

export async function roster(args) {
  const m = await loadLeague();
  const q = arg(args);
  const team = findTeam(m, q);
  if (!team) return q ? nope(q) : 'Usage: /roster &lt;team or username&gt;';
  const [pm, week] = await Promise.all([players(), scoreWeek(m)]);
  const { entries } = await weekGames(m, week);
  const pts = entries.find((e) => e.roster_id === team.id)?.players_points ?? {};
  const slots = m.league.roster_positions.filter((p) => p !== 'BN');
  const line = (slot, id) =>
    `${padR(slot, 5)} ${padR(pm[id]?.name ?? id, 22)} ${padR(pm[id]?.team ?? '', 3)} ${padL(num(pts[id] ?? 0), 6)}`;
  const starters = team.starters.map((id, i) => line(slots[i] ?? 'FLX', id));
  const bench = team.players.filter((id) => !team.starters.includes(id)).map((id) => line('BN', id));
  return (
    `<b>${esc(team.name)}</b> (${esc(team.owner)}) ${team.w}-${team.l}, ${num(team.pf)} PF — week ${week} pts\n` +
    pre(starters) +
    '\n' +
    pre(bench)
  );
}

export async function trending() {
  const [m, pm, list] = await Promise.all([
    loadLeague(),
    players(),
    api('/players/nfl/trending/add?lookback_hours=24&limit=40', 300_000),
  ]);
  const owned = new Set([...m.teams.values()].flatMap((t) => t.players));
  const free = list.filter((x) => !owned.has(x.player_id)).slice(0, 10);
  if (!free.length) return 'Nobody trending is available right now.';
  const lines = free.map((x) => `${padR(pm[x.player_id]?.name ?? x.player_id, 22)} ${padR(pm[x.player_id]?.pos ?? '', 3)} ${padR(pm[x.player_id]?.team ?? '', 3)} +${x.count}`);
  return `<b>Hot free agents</b> (most added across Sleeper, last 24h, unrostered in our league)\n${pre(lines)}`;
}

export async function draft(args) {
  const m = await loadLeague();
  const draftId = /^\d{10,}$/.test(args[0] ?? '') ? args[0] : m.league.draft_id;
  const rest = /^\d{10,}$/.test(args[0] ?? '') ? args.slice(1) : args;
  const [info, picks] = await Promise.all([api(`/draft/${draftId}`, 60_000), api(`/draft/${draftId}/picks`, 5_000)]);
  const teams = info.settings.teams;
  const label = (p) => `${p.round}.${String(p.pick_no - (p.round - 1) * teams).padStart(2, '0')}`;
  const who = (p) => m.teams.get(p.roster_id)?.name ?? `Team ${p.roster_id}`;
  const name = (p) => `${p.metadata.first_name} ${p.metadata.last_name}`;
  const q = arg(rest);

  if (q) {
    const team = findTeam(m, q);
    if (!team) return nope(q);
    const mine = picks.filter((p) => p.roster_id === team.id);
    return `<b>${esc(team.name)}</b> draft\n${pre(mine.map((p) => `${padR(label(p), 5)} ${padR(name(p), 22)} ${p.metadata.position} ${p.metadata.team}`))}`;
  }

  const status = `${info.type} draft, ${info.settings.rounds} rounds, ${teams} teams — ${info.status}`;
  const r1 = picks.filter((p) => p.round === 1).map((p) => `${padR(label(p), 5)} ${padR(name(p), 22)} ${padR(p.metadata.position, 2)} ${who(p)}`);
  const tail = picks.length && info.status !== 'complete' ? `\nLast pick: #${picks.length} ${name(picks[picks.length - 1])}` : '';
  return `<b>${esc(status)}</b>${tail}\n${pre(r1)}\nSee any team: /draft &lt;team&gt;`;
}

// All-play record: every week, how many of the other teams would each team have beaten.
// Luck = real wins minus the wins that record "should" have produced.
export async function luck() {
  const m = await loadLeague();
  const done = lastCompletedWeek(m);
  const stats = new Map([...m.teams.keys()].map((id) => [id, { real: 0, ap: 0, games: 0 }]));
  for (let w = 1; w <= done; w++) {
    const { entries, games } = await weekGames(m, w);
    for (const e of entries) {
      const s = stats.get(e.roster_id);
      if (!s) continue;
      s.ap += entries.filter((o) => o !== e && o.points < e.points).length;
      s.games++;
    }
    for (const [a, b] of games) {
      if (a.points > b.points) stats.get(a.roster_id).real++;
      else if (b.points > a.points) stats.get(b.roster_id).real++;
    }
  }
  const n = m.teams.size - 1;
  const rows = [...stats.entries()]
    .map(([id, s]) => ({ team: m.teams.get(id), real: s.real, exp: s.ap / n, games: s.games }))
    .map((r) => ({ ...r, diff: r.real - r.exp }))
    .sort((a, b) => b.diff - a.diff);
  const lines = rows.map((r) => `${padR(r.team.name, 18)} ${padL(`${r.real}`, 2)}W  exp ${padL(num(r.exp), 4)}  ${r.diff >= 0 ? '+' : ''}${num(r.diff)}`);
  return `<b>Luck index</b> through week ${done} (real wins vs wins your scores deserved)\n${pre(lines)}\n🍀 luckiest: <b>${esc(rows[0].team.name)}</b>   😭 unluckiest: <b>${esc(rows[rows.length - 1].team.name)}</b>`;
}

export async function awards(args, forWeek) {
  const m = await loadLeague();
  const week = forWeek ?? (Number(args?.[0]) || Math.max(1, lastCompletedWeek(m)));
  const [pm, { entries, games }] = await Promise.all([players(), weekGames(m, week)]);
  const scored = entries.filter((e) => e.points > 0);
  if (!scored.length) return `No scores for week ${week} yet.`;
  const name = (id) => m.teams.get(id)?.name ?? `Team ${id}`;
  const top = scored.reduce((a, b) => (b.points > a.points ? b : a));
  const low = scored.reduce((a, b) => (b.points < a.points ? b : a));
  const margin = (g) => Math.abs(g[0].points - g[1].points);
  const blowout = games.reduce((a, b) => (margin(b) > margin(a) ? b : a));
  const close = games.reduce((a, b) => (margin(b) < margin(a) ? b : a));
  const winner = (g) => (g[0].points >= g[1].points ? g[0] : g[1]);
  const loser = (g) => (g[0].points >= g[1].points ? g[1] : g[0]);

  let star = null;
  let benched = null;
  for (const e of scored) {
    for (const [pid, p] of Object.entries(e.players_points ?? {})) {
      const isStarter = e.starters.includes(pid);
      if (isStarter && (!star || p > star.p)) star = { e, pid, p };
      if (!isStarter && (!benched || p > benched.p)) benched = { e, pid, p };
    }
  }

  const out = [
    `<b>🏅 Week ${week} awards</b>`,
    `👑 <b>Top score:</b> ${esc(name(top.roster_id))} — ${num(top.points, 2)}`,
    `🗑️ <b>Toilet bowl:</b> ${esc(name(low.roster_id))} — ${num(low.points, 2)}`,
    `💥 <b>Blowout:</b> ${esc(name(winner(blowout).roster_id))} over ${esc(name(loser(blowout).roster_id))} by ${num(margin(blowout), 2)}`,
    `😬 <b>Nail-biter:</b> ${esc(name(winner(close).roster_id))} edged ${esc(name(loser(close).roster_id))} by ${num(margin(close), 2)}`,
  ];
  if (star) out.push(`⭐ <b>Best starter:</b> ${esc(playerLabel(pm, star.pid))} — ${num(star.p)} for ${esc(name(star.e.roster_id))}`);
  if (benched) out.push(`🪑 <b>Bench regret:</b> ${esc(playerLabel(pm, benched.pid))} dropped ${num(benched.p)} on ${esc(name(benched.e.roster_id))}'s bench`);
  return out.join('\n');
}

export function describeTx(m, tx, pm) {
  const team = (id) => esc(m.teams.get(id)?.name ?? `Team ${id}`);
  const names = (obj, rid) =>
    Object.entries(obj ?? {})
      .filter(([, r]) => r === rid)
      .map(([pid]) => playerLabel(pm, pid));

  if (tx.type === 'trade') {
    const sides = tx.roster_ids.map((rid) => {
      const picks = (tx.draft_picks ?? []).filter((d) => d.owner_id === rid).map((d) => `${d.season} R${d.round}`);
      const got = [...names(tx.adds, rid), ...picks];
      return `<b>${team(rid)}</b> gets ${esc(got.join(', ') || 'nothing')}`;
    });
    return `🔁 <b>TRADE ALERT</b>\n${sides.join('\n')}`;
  }
  const rid = tx.roster_ids?.[0];
  const added = names(tx.adds, rid);
  const dropped = names(tx.drops, rid);
  const bid = tx.type === 'waiver' && tx.settings?.waiver_bid != null ? ` for $${tx.settings.waiver_bid}` : '';
  const parts = [];
  if (added.length) parts.push(`➕ added ${esc(added.join(', '))}${bid}`);
  if (dropped.length) parts.push(`➖ dropped ${esc(dropped.join(', '))}`);
  return `<b>${team(rid)}</b>: ${parts.join('  ') || tx.type}`;
}

export async function moves() {
  const m = await loadLeague();
  const pm = await players();
  const weeks = [m.state.week, m.state.week - 1].filter((w) => w >= 1);
  const all = (await Promise.all(weeks.map((w) => api(`/league/${m.id}/transactions/${w}`, 30_000)))).flat();
  const done = all.filter((t) => t.status === 'complete').sort((a, b) => b.created - a.created).slice(0, 8);
  if (!done.length) return 'No recent moves.';
  return `<b>Recent moves</b>\n\n${done.map((t) => describeTx(m, t, pm)).join('\n\n')}`;
}

export const help = () =>
  [
    '<b>League bot commands</b>',
    '/standings — records and points',
    '/scores [week] — matchup scoreboard',
    '/roster &lt;team&gt; — lineup with points',
    '/draft [team | draft_id] — draft recap, or any draft by ID',
    '/trending — hot free agents',
    '/moves — recent trades and waivers',
    '/awards [week] — weekly awards and roasts',
    '/luck — who is lucky, who is robbed',
    '/chatid — this chat\'s id (for setup)',
  ].join('\n');

export const commands = { standings, scores, roster, draft, trending, moves, awards, luck, help, start: help };
