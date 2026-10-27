import { loadDraft, draftValue, loadMoves, player, slotsOf, lineupFor } from '../data.js';
import { esc, fmt, avatar, headshot, posTag, weekBars, empty, sleeperUrl, sleeperBtn, myTeam, toast, $ } from '../ui.js';
import { lineupCard } from './lineups.js';
import { moveCard } from './shared.js';

const stat = (label, value, note = '') => `<div class="stat"><span>${esc(label)}</span><b>${value}</b>${note ? `<em>${note}</em>` : ''}</div>`;

export default {
  async render({ model, pm }, arg) {
    const team = model.teamBy.get(Number(arg));
    if (!team) return empty('Team not found. <a href="#/standings">Back to standings</a>');
    const r = model.rowBy.get(team.id);
    const leagueAvg = model.rows.reduce((a, x) => a + x.pf, 0) / Math.max(1, model.rows.reduce((a, x) => a + x.games, 0));
    const slots = slotsOf(model);
    const rec = (id) => model.playerPts.get(id)?.total ?? 0;

    const lineRow = (pid, slot) => {
      const p = player(pm, pid);
      return `<li>${slot ? `<span class="slot">${esc(slot)}</span>` : ''}${headshot(p, 38)}
        <div class="grow"><b>${esc(p.name)}</b><span class="muted">${esc(p.team)}${p.inj ? ` · <span class="inj">${esc(p.inj)}</span>` : ''}</span></div>
        ${posTag(p.pos)}<span class="pts">${fmt(rec(pid))}</span></li>`;
    };
    const starters = team.starters.map((pid, i) => lineRow(pid, slots[i] ?? 'FLX'));
    const bench = team.players.filter((pid) => !team.starters.includes(pid)).map((pid) => lineRow(pid, 'BN'));

    let draftHtml = '';
    if (model.league.draft_id) {
      try {
        const { picks } = await loadDraft(model.league.draft_id, 60_000);
        const value = draftValue(model, picks);
        const by = new Map(value.scored.map((s) => [s.pick.pick_no, s]));
        const grade = value.teamsRanked.find((x) => x.team.id === team.id);
        draftHtml = `<section class="panel"><header class="ph"><h2>Draft class</h2><span class="grade g-${esc(grade.grade[0])}">${esc(grade.grade)}</span></header>
          <ol class="plain">${picks
            .filter((p) => p.roster_id === team.id)
            .map((p) => {
              const m = p.metadata;
              const it = by.get(p.pick_no);
              const d = it?.delta ?? 0;
              return `<li><span class="rk">${p.round}.${String(((p.pick_no - 1) % model.league.total_rosters) + 1).padStart(2, '0')}</span>${headshot({ id: p.player_id, pos: m.position }, 32)}
                <div class="grow"><b>${esc(m.first_name)} ${esc(m.last_name)}</b><span class="muted">${esc(m.position)} · ${esc(m.team)}</span></div>
                <span class="pts">${fmt(it?.pts ?? 0)}</span><span class="dl ${d >= 3 ? 'good' : d <= -3 ? 'bad' : ''}">${d > 0 ? '+' : ''}${d}</span></li>`;
            })
            .join('')}</ol></section>`;
      } catch {}
    }

    const moves = (await loadMoves(model).catch(() => [])).filter((m) => m.roster_ids?.includes(team.id)).slice(0, 5);
    const sched = r.pts
      .map(
        (p, i) => `<li><span class="wk">Wk ${i + 1}</span><span class="res ${r.res[i]}">${r.res[i]}</span>
        <span class="grow">vs ${esc(model.teamBy.get(r.oppId[i])?.name)}</span><b>${fmt(p, 2)}</b><span class="muted">– ${fmt(r.opp[i], 2)}</span></li>`,
      )
      .join('');

    const lineup = lineupFor(model, pm, team);
    const isMine = myTeam.get() === team.id;
    return `
    <section class="teamhead">
      ${avatar(team, 84)}
      <div><p class="eyebrow">Manager · ${esc(team.owner)}</p><h1>${esc(team.name)}</h1>
        <p class="lede">${r.w}-${r.l}${r.t ? `-${r.t}` : ''} · <b>#${r.rank}</b> in standings · <b>#${r.powerRank}</b> power ranking</p>
        <div class="cta"><button class="btn ${isMine ? 'primary' : ''}" id="mine" type="button">${isMine ? '★ This is my team' : '☆ Make this my team'}</button>${sleeperBtn(sleeperUrl.team(model.id), 'Open in Sleeper')}</div></div>
    </section>
    ${lineupCard(model, pm, team, lineup, { link: false })}
    <section class="stats">
      ${stat('Points for', fmt(r.pf), `#${r.pfRank} in league`)}
      ${stat('Points against', fmt(r.pa))}
      ${stat('Best week', r.bestWeek ? fmt(r.bestWeek.pts, 1) : '—', r.bestWeek ? `Week ${r.bestWeek.week}` : '')}
      ${stat('Luck', `${r.luck >= 0 ? '+' : ''}${fmt(r.luck)}`, `deserved ${fmt(r.expW)} wins`)}
    </section>
    <section class="panel"><header class="ph"><h2>Weekly scoring</h2><span class="legend"><i></i>league avg ${fmt(leagueAvg)}</span></header>
      ${r.pts.length ? weekBars(r.pts, { avg: leagueAvg, labels: r.pts.map((_, i) => `W${i + 1}`) }) : '<p class="muted pad">No games played yet.</p>'}
    </section>
    <div class="cols">
      <section class="panel"><header class="ph"><h2>Roster</h2><span class="muted">season pts</span></header>
        <ul class="roster">${starters.join('')}</ul><div class="divider">Bench</div><ul class="roster bench">${bench.join('')}</ul></section>
      <div class="stackcol">
        <section class="panel"><header class="ph"><h2>Results</h2></header><ol class="sched">${sched || '<li class="muted">No results yet.</li>'}</ol></section>
        ${draftHtml}
      </div>
    </div>
    ${moves.length ? `<section class="panel"><header class="ph"><h2>Recent moves</h2></header><div class="stack">${moves.map((m) => moveCard(model, pm, m)).join('')}</div></section>` : ''}`;
  },

  mount(root, { model }, arg) {
    const id = Number(arg);
    const btn = $('#mine', root);
    const click = () => {
      const on = myTeam.get() === id;
      myTeam.set(on ? null : id);
      btn.classList.toggle('primary', !on);
      btn.textContent = on ? '☆ Make this my team' : '★ This is my team';
      document.dispatchEvent(new Event('myteam'));
      toast(on ? 'Forgot your team' : `Saved — ${model.teamBy.get(id).name} is your team on this device`);
    };
    btn?.addEventListener('click', click);
    return () => btn?.removeEventListener('click', click);
  },
};
