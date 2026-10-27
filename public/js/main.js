import { loadModel, loadPlayers, clearCache } from './data.js';
import { loading, esc, $, $$ } from './ui.js';

const VIEWS = {
  home: './views/home.js',
  standings: './views/standings.js',
  scores: './views/scores.js',
  draft: './views/draft.js',
  room: './views/room.js',
  awards: './views/awards.js',
  moves: './views/moves.js',
  market: './views/market.js',
  team: './views/team.js',
};
const NAV = [
  ['home', 'Home'],
  ['standings', 'Standings'],
  ['scores', 'Scores'],
  ['draft', 'Draft'],
  ['room', 'Draft room'],
  ['awards', 'Awards'],
  ['moves', 'Moves'],
  ['market', 'Market'],
];

const app = $('#app');
$('#nav').innerHTML = NAV.map(([k, l]) => `<a href="#/${k === 'home' ? '' : k}" data-k="${k}">${l}</a>`).join('');

let ctxP = null;
const getCtx = () =>
  (ctxP ??= (async () => {
    const [model, pm] = await Promise.all([loadModel(), loadPlayers().catch(() => ({}))]);
    return { model, pm };
  })());

let cleanup = null;
let token = 0;
let headerFor = null;

function fillHeader({ model }) {
  if (headerFor === model) return;
  headerFor = model;
  $('#brandname').textContent = model.league.name;
  $('#brandsub').textContent = `${model.league.season} · week ${model.state.week}`;
  document.title = model.league.name;
  const sel = $('#teampick');
  sel.innerHTML =
    '<option value="">Teams…</option>' +
    [...model.rows].map((r) => `<option value="${r.team.id}">${esc(r.team.name)}</option>`).join('');
}

async function route() {
  cleanup?.();
  cleanup = null;
  const mine = ++token;
  const [rawName, arg] = location.hash.replace(/^#\/?/, '').split('/');
  const name = VIEWS[rawName] ? rawName : 'home';
  $$('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.k === name));
  app.innerHTML = loading('Fetching league data');
  try {
    const ctx = await getCtx();
    if (mine !== token) return;
    fillHeader(ctx);
    $('#teampick').value = name === 'team' ? arg : '';
    const view = (await import(VIEWS[name])).default;
    const html = await view.render(ctx, arg);
    if (mine !== token) return;
    app.innerHTML = html;
    app.classList.remove('enter');
    void app.offsetWidth;
    app.classList.add('enter');
    if (mine === token) cleanup = view.mount?.(app, ctx, arg) ?? null;
  } catch (err) {
    if (mine !== token) return;
    ctxP = null;
    console.error(err);
    app.innerHTML = `<div class="empty"><p><b>Couldn't load league data.</b></p><p class="muted">${esc(err.message)}</p><button class="btn primary" id="retry" type="button">Try again</button></div>`;
    $('#retry').onclick = () => route();
  }
}

const refresh = () => {
  clearCache();
  ctxP = null;
  headerFor = null;
  route();
};

window.addEventListener('hashchange', () => {
  window.scrollTo({ top: 0 });
  route();
});
window.addEventListener('league:refresh', refresh);
$('#refresh').addEventListener('click', refresh);
$('#teampick').addEventListener('change', (e) => e.target.value && (location.hash = `#/team/${e.target.value}`));
route();
