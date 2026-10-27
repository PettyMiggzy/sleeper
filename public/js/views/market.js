import { api, player } from '../data.js';
import { esc, headshot, posTag, avatar, teamLink } from '../ui.js';

export default {
  async render({ model, pm }) {
    const [adds, drops] = await Promise.all([
      api('/players/nfl/trending/add?lookback_hours=24&limit=30', 300_000),
      api('/players/nfl/trending/drop?lookback_hours=24&limit=30', 300_000),
    ]);
    const owner = new Map();
    for (const t of model.teams) for (const pid of t.players) owner.set(pid, t);
    const row = (t, sign) => {
      const p = player(pm, t.player_id);
      const o = owner.get(t.player_id);
      return `<li>${headshot(p, 44)}
        <div class="grow"><b>${esc(p.name)}</b><span class="muted">${esc(p.team)}${p.inj ? ` · <span class="inj">${esc(p.inj)}</span>` : ''}</span></div>
        ${posTag(p.pos)}
        <span class="own">${o ? `${avatar(o, 20)} ${teamLink(o)}` : '<span class="fa">Free agent</span>'}</span>
        <span class="${sign > 0 ? 'adds' : 'drops'}">${sign > 0 ? '+' : '−'}${t.count}</span></li>`;
    };
    return `<div class="cols">
      <section class="panel"><header class="ph"><h2>🔥 Most added</h2><span class="muted">last 24h · all of Sleeper</span></header>
        <ul class="hot big">${adds.map((t) => row(t, 1)).join('')}</ul></section>
      <section class="panel"><header class="ph"><h2>🧊 Most dropped</h2><span class="muted">last 24h · all of Sleeper</span></header>
        <ul class="hot big">${drops.map((t) => row(t, -1)).join('')}</ul></section>
    </div>`;
  },
};
