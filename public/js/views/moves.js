import { loadMoves } from '../data.js';
import { $$ } from '../ui.js';
import { moveCard } from './shared.js';

const FILTERS = [
  ['all', 'All'],
  ['trade', 'Trades'],
  ['waiver', 'Waivers'],
  ['free_agent', 'Free agents'],
];

export default {
  async render({ model, pm }) {
    const moves = await loadMoves(model);
    const count = (k) => (k === 'all' ? moves.length : moves.filter((m) => m.type === k).length);
    return `<section class="panel">
      <header class="ph"><h2>Trades &amp; waivers</h2>
        <nav class="chips" id="filters">${FILTERS.map(([k, l]) => `<button class="chip ${k === 'all' ? 'on' : ''}" data-f="${k}" type="button">${l} <small>${count(k)}</small></button>`).join('')}</nav>
      </header>
      <div class="feed">${moves.map((m) => `<div class="feed-item" data-type="${m.type}">${moveCard(model, pm, m)}</div>`).join('') || '<p class="muted pad">Nothing yet.</p>'}</div>
    </section>`;
  },
  mount(root) {
    const bar = root.querySelector('#filters');
    const click = (e) => {
      const b = e.target.closest('[data-f]');
      if (!b) return;
      $$('.chip', bar).forEach((c) => c.classList.toggle('on', c === b));
      $$('.feed-item', root).forEach((el) => (el.hidden = b.dataset.f !== 'all' && el.dataset.type !== b.dataset.f));
    };
    bar?.addEventListener('click', click);
    return () => bar?.removeEventListener('click', click);
  },
};
