import { loadDraft, draftValue, player } from '../data.js';
import { esc, fmt, avatar, teamLink, headshot, posTag, empty, sleeperUrl, sleeperBtn, $, $$ } from '../ui.js';
import { boardHtml, posFilterBar, wirePosFilter, openDrawer, pickDrawerHtml } from './board.js';

const TABS = [
  ['board', 'Board'],
  ['value', 'Value & grades'],
];

let current; // data for mount()

export default {
  async render({ model, pm }, arg) {
    const tab = TABS.some(([k]) => k === arg) ? arg : 'board';
    const draftId = model.league.draft_id;
    if (!draftId) return empty('This league has no draft yet.');
    const { draft, picks } = await loadDraft(draftId, 60_000);
    const value = draftValue(model, picks);
    current = { draft, picks, value, model, pm };
    const tabs = `<nav class="chips">${TABS.map(([k, l]) => `<a class="chip ${k === tab ? 'on' : ''}" href="#/draft/${k}">${l}</a>`).join('')}</nav>`;
    const meta = `${draft.type} · ${draft.settings.rounds} rounds · ${draft.settings.teams} teams · ${picks.length} picks · ${draft.status}`;

    if (tab === 'value') {
      const item = (it, kind) => {
        const m = it.pick.metadata;
        const p = { id: it.pick.player_id, pos: m.position, name: `${m.first_name} ${m.last_name}` };
        return `<li><span class="rk">${it.pick.pick_no}</span>${headshot(p, 38)}
          <div class="grow"><b>${esc(p.name)}</b><span class="muted">${posTag(p.pos)} ${esc(m.team)} · ${esc(model.teamBy.get(it.pick.roster_id)?.name)}</span></div>
          <div class="vi"><b class="${kind}">${it.delta > 0 ? '+' : ''}${it.delta}</b><small>${fmt(it.pts)} pts</small></div></li>`;
      };
      return `
      <section class="panel"><header class="ph"><h2>Draft recap</h2>${tabs}</header>
        <p class="note pad">Steals and busts compare where a player went at his position to where he ranks at the position in actual league points. Grades rank how many points each team's own draftees delivered in its starting lineup.</p>
        <div class="cols tight">
          <div><h3 class="sub">🟢 Biggest steals</h3><ol class="vlist">${value.steals.map((s) => item(s, 'good')).join('')}</ol></div>
          <div><h3 class="sub">🔴 Biggest busts (top 8 rounds)</h3><ol class="vlist">${value.busts.map((s) => item(s, 'bad')).join('')}</ol></div>
        </div>
      </section>
      <section class="panel"><header class="ph"><h2>Draft grades</h2></header>
        <ol class="grades">${value.teamsRanked
          .map(
            (r) => `<li><span class="rk">${r.rank}</span>${avatar(r.team, 34)}<div class="grow">${teamLink(r.team)}<span class="muted">${fmt(r.haul)} starter points from own picks</span></div><span class="grade g-${esc(r.grade[0])}">${esc(r.grade)}</span></li>`,
          )
          .join('')}</ol>
      </section>`;
    }

    return `
    <section class="panel">
      <header class="ph"><h2>${esc(draft.metadata?.name || model.league.name)} draft</h2>${tabs}</header>
      <div class="toolbar">
        ${posFilterBar()}
        <div class="replay">
          ${sleeperBtn(sleeperUrl.draft(draftId), 'Sleeper draft')}
          <label>Speed <select id="speed"><option value="320">1×</option><option value="140" selected>2×</option><option value="60">5×</option><option value="25">10×</option></select></label>
          <button class="btn primary" id="replay" type="button">▶ Replay draft</button>
        </div>
      </div>
      <div class="replaybar" id="rbar" hidden><div id="rtext"></div><div class="meter"><i id="rfill"></i></div></div>
      <p class="note pad">${esc(meta)} · tap any pick for details.</p>
      ${boardHtml(draft, picks, (slot) => model.teamBy.get(draft.slot_to_roster_id?.[slot]))}
    </section>`;
  },

  mount(root) {
    const { draft, picks, value, model, pm } = current ?? {};
    if (!picks) return;
    const unwire = wirePosFilter(root);
    const byN = new Map($$('.cell[data-n]', root).map((c) => [Number(c.dataset.n), c]));
    const valueBy = new Map(value.scored.map((s) => [s.pick.pick_no, s]));
    const pickBy = new Map(picks.map((p) => [p.pick_no, p]));

    const click = (e) => {
      const cell = e.target.closest('.cell[data-n]');
      if (!cell || cell.classList.contains('empty')) return;
      const pick = pickBy.get(Number(cell.dataset.n));
      openDrawer(pickDrawerHtml({ draft, pick, team: model.teamBy.get(pick.roster_id), model, valueItem: valueBy.get(pick.pick_no) }));
    };
    root.addEventListener('click', click);

    let timer = null;
    const btn = $('#replay', root);
    const bar = $('#rbar', root);
    const stop = () => {
      clearInterval(timer);
      timer = null;
      if (btn) btn.textContent = '▶ Replay draft';
      $$('.cell', root).forEach((c) => c.classList.remove('veiled', 'now'));
      if (bar) bar.hidden = true;
    };
    const play = () => {
      if (timer) return stop();
      const speed = Number($('#speed', root).value);
      byN.forEach((c) => {
        c.classList.add('veiled');
        c.classList.remove('pop', 'now');
      });
      btn.textContent = '■ Stop';
      bar.hidden = false;
      let i = 0;
      timer = setInterval(() => {
        i++;
        const c = byN.get(i);
        const p = pickBy.get(i);
        if (!c || !p) return stop();
        byN.get(i - 1)?.classList.remove('now');
        c.classList.remove('veiled');
        c.classList.add('pop', 'now');
        c.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
        $('#rtext', root).innerHTML = `<b>Pick ${i}</b> — ${esc(model.teamBy.get(p.roster_id)?.name)} selects <b>${esc(p.metadata.first_name)} ${esc(p.metadata.last_name)}</b> <span class="muted">${esc(p.metadata.position)}, ${esc(p.metadata.team)}</span>`;
        $('#rfill', root).style.width = `${(i / picks.length) * 100}%`;
        if (i >= picks.length) {
          clearInterval(timer);
          timer = null;
          btn.textContent = '▶ Replay draft';
          setTimeout(() => byN.get(i)?.classList.remove('now'), 1500);
        }
      }, speed);
    };
    btn?.addEventListener('click', play);
    return () => {
      clearInterval(timer);
      unwire();
      root.removeEventListener('click', click);
    };
  },
};
