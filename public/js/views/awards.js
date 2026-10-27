import { weekAwards, seasonAwards } from '../data.js';
import { esc, toast, $ } from '../ui.js';
import { awardCard } from './shared.js';

const recapText = (model, pm, week) =>
  [`🏅 ${model.league.name} — Week ${week} awards`, ...weekAwards(model, pm, week).map((a) => `${a.icon} ${a.title}: ${a.team.name} — ${a.text}`)].join('\n');

export default {
  render({ model, pm }, arg) {
    const playable = model.weeks.filter((w) => w.complete || w.live);
    const wk = playable.find((w) => w.week === Number(arg)) ?? playable.at(-1);
    if (!wk) return `<section class="panel"><header class="ph"><h2>Awards</h2></header><p class="muted pad">Awards unlock after the first games.</p></section>`;
    const chips = playable.map((w) => `<a class="chip ${w.week === wk.week ? 'on' : ''}" href="#/awards/${w.week}">${w.week}</a>`).join('');
    const season = seasonAwards(model);
    return `
    <section class="panel">
      <header class="ph"><h2>Week ${wk.week} awards</h2><nav class="chips weeks">${chips}</nav></header>
      <div class="award-grid">${weekAwards(model, pm, wk.week).map((a) => awardCard(a, pm)).join('')}</div>
      <div class="actions"><button class="btn" id="copy" data-week="${wk.week}" type="button">Copy recap for the group chat</button></div>
    </section>
    <section class="panel">
      <header class="ph"><h2>Season superlatives</h2></header>
      <div class="award-grid">${season.map((a) => awardCard(a, pm)).join('')}</div>
    </section>`;
  },
  mount(root, { model, pm }) {
    const btn = $('#copy', root);
    const click = async () => {
      const text = recapText(model, pm, Number(btn.dataset.week));
      try {
        await navigator.clipboard.writeText(text);
        toast('Recap copied — paste it in Telegram');
      } catch {
        toast('Copy failed; select the text manually');
      }
    };
    btn?.addEventListener('click', click);
    return () => btn?.removeEventListener('click', click);
  },
};
