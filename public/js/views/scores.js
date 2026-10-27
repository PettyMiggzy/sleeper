import { matchupCard } from './shared.js';
import { $$, sleeperUrl, sleeperBtn } from '../ui.js';

export default {
  render({ model, pm }, arg) {
    const wk =
      model.weeks.find((w) => w.week === Number(arg)) ??
      (model.weeks.find((w) => w.week === model.state.week && w.total > 0) ?? model.done.at(-1) ?? model.weeks.at(-1));
    if (!wk) return `<section class="panel"><header class="ph"><h2>Scoreboard</h2></header><p class="muted pad">No weeks to show yet.</p></section>`;
    const chips = model.weeks
      .map((w) => `<a class="chip ${w.week === wk.week ? 'on' : ''}" href="#/scores/${w.week}">${w.week}</a>`)
      .join('');
    const status = wk.live ? '<span class="live">● LIVE</span>' : wk.complete ? '<span class="final">FINAL</span>' : '<span class="soon">UPCOMING</span>';
    return `<section class="panel">
      <header class="ph"><h2>Week ${wk.week} ${status}</h2><nav class="chips weeks">${chips}</nav>${sleeperBtn(sleeperUrl.matchup(model.id), 'Open in Sleeper')}</header>
      <div class="match-grid wide">${wk.games.map((g) => matchupCard(model, pm, g, { week: wk.week, expand: true })).join('')}</div>
    </section>`;
  },
  mount(root, { model }, arg) {
    const onClick = (e) => {
      const btn = e.target.closest('.more');
      if (!btn) return;
      const card = btn.closest('.match');
      const d = card.querySelector('.detail');
      d.hidden = !d.hidden;
      btn.textContent = d.hidden ? 'Lineups' : 'Hide';
      card.classList.toggle('open', !d.hidden);
    };
    root.addEventListener('click', onClick);
    const wk = model.weeks.find((w) => w.week === Number(arg)) ?? model.weeks.find((w) => w.week === model.state.week);
    const timer = wk?.live ? setInterval(() => window.dispatchEvent(new Event('league:refresh')), 60_000) : null;
    return () => {
      root.removeEventListener('click', onClick);
      if (timer) clearInterval(timer);
    };
  },
};
