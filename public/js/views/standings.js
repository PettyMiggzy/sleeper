import { esc, fmt, avatar, teamLink, spark } from '../ui.js';

const MODES = [
  ['standings', 'Standings'],
  ['power', 'Power rankings'],
  ['luck', 'Luck index'],
];

const dots = (res) =>
  `<span class="form">${res
    .slice(-5)
    .map((r) => `<i class="${r}" title="${r}">${r}</i>`)
    .join('')}</span>`;

export default {
  render({ model }, arg) {
    const mode = MODES.some(([k]) => k === arg) ? arg : 'standings';
    const sorted = [...model.rows].sort(
      {
        standings: (a, b) => a.rank - b.rank,
        power: (a, b) => a.powerRank - b.powerRank,
        luck: (a, b) => b.luck - a.luck,
      }[mode],
    );
    if (!model.done.length) {
      return `<section class="panel"><header class="ph"><h2>Standings</h2></header><p class="muted pad">No completed weeks yet — check back after the first games.</p></section>`;
    }
    const maxPower = Math.max(...sorted.map((r) => r.power), 1);
    const rows = sorted
      .map((r, i) => {
        const luckCls = r.luck > 0.4 ? 'pos-v' : r.luck < -0.4 ? 'neg-v' : '';
        return `<tr>
          <td class="num rk">${i + 1}</td>
          <td class="teamcell">${avatar(r.team, 34)}<div>${teamLink(r.team)}${r.team.owner !== r.team.name ? `<span class="muted">${esc(r.team.owner)}</span>` : ''}</div></td>
          <td class="num strong">${r.w}-${r.l}${r.t ? `-${r.t}` : ''}</td>
          <td class="num">${fmt(r.pf)}</td>
          <td class="num hide-sm">${fmt(r.pa)}</td>
          <td class="num hide-sm">${fmt(r.avg)}</td>
          <td class="hide-sm">${dots(r.res)}</td>
          <td class="hide-md">${spark(r.pts, { color: r.pts.at(-1) >= r.avg ? 'var(--good)' : 'var(--bad)' })}</td>
          <td class="num"><span class="powerbar"><i style="width:${((r.power / maxPower) * 100).toFixed(0)}%"></i><b>${fmt(r.power, 0)}</b></span></td>
          <td class="num ${luckCls}">${r.luck >= 0 ? '+' : ''}${fmt(r.luck)}</td>
        </tr>`;
      })
      .join('');
    return `
    <section class="panel">
      <header class="ph"><h2>League table</h2>
        <nav class="chips">${MODES.map(([k, l]) => `<a class="chip ${k === mode ? 'on' : ''}" href="#/standings/${k}">${l}</a>`).join('')}</nav>
      </header>
      <div class="tablewrap"><table class="tbl">
        <thead><tr><th>#</th><th>Team</th><th>W-L</th><th>PF</th><th class="hide-sm">PA</th><th class="hide-sm">Avg</th><th class="hide-sm">Form</th><th class="hide-md">Trend</th><th title="Blend of all-play record, win % and recent scoring">Power</th><th title="Real wins minus the wins your scores deserved">Luck</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      <p class="note">Power = 45% all-play record (would you beat everyone every week?), 30% win %, 25% last-3-week scoring. Luck = real wins minus all-play expected wins.</p>
    </section>`;
  },
};
