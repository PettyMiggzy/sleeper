// Draft board grid + player drawer, shared by the draft recap and the draft room.
import { pickOwner } from '../data.js';
import { esc, fmt, avatar, headshot, posTag, posColor, spark, POS_ORDER, $ } from '../ui.js';

const cellLabel = (draft, n) => {
  const o = pickOwner(draft, n);
  return o ? `${o.round}.${String(((n - 1) % draft.settings.teams) + 1).padStart(2, '0')}` : String(n);
};

export function boardHtml(draft, picks, slotTeam) {
  const teams = draft.settings.teams;
  const rounds = draft.settings.rounds;
  const bySlot = new Map(picks.map((p) => [`${p.round}-${p.draft_slot}`, p]));
  const head = Array.from({ length: teams }, (_, i) => {
    const slot = i + 1;
    const t = slotTeam(slot);
    return `<div class="bh" title="${esc(t?.name ?? `Slot ${slot}`)}"><span class="sl">${slot}</span>${t ? avatar(t, 28) : ''}<b>${esc(t?.name ?? `Slot ${slot}`)}</b></div>`;
  }).join('');
  let body = '';
  for (let r = 1; r <= rounds; r++) {
    body += `<div class="rl">R${r}</div>`;
    for (let s = 1; s <= teams; s++) {
      const p = bySlot.get(`${r}-${s}`);
      const idx = draft.type === 'snake' && r % 2 === 0 ? teams - s : s - 1;
      const n = (r - 1) * teams + idx + 1;
      const label = `${r}.${String(idx + 1).padStart(2, '0')}`;
      if (!p) {
        body += `<div class="cell empty" data-n="${n}" data-slot="${s}"><small>${label}</small></div>`;
        continue;
      }
      const m = p.metadata;
      body += `<button class="cell" type="button" data-n="${p.pick_no}" data-slot="${s}" data-pos="${esc(m.position)}" data-roster="${p.roster_id}" style="--c:${posColor(m.position)}">
        <small>${label}${p.is_keeper ? ' · K' : ''}</small><b>${esc(m.last_name || m.first_name)}</b>
        <span>${esc((m.first_name || '')[0] ?? '')}. · ${esc(m.position)} · ${esc(m.team || 'FA')}</span></button>`;
    }
  }
  return `<div class="boardwrap"><div class="board" style="--cols:${teams}"><div class="corner"></div>${head}${body}</div></div>`;
}

export const posFilterBar = () =>
  `<nav class="chips" id="posfilter"><button class="chip on" data-pos="" type="button">All</button>${POS_ORDER.map(
    (p) => `<button class="chip" data-pos="${p}" type="button" style="--c:${posColor(p)}"><i class="dot"></i>${p}</button>`,
  ).join('')}</nav>`;

export function wirePosFilter(root) {
  const bar = $('#posfilter', root);
  if (!bar) return () => {};
  const click = (e) => {
    const b = e.target.closest('[data-pos]');
    if (!b) return;
    bar.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === b));
    root.querySelectorAll('.cell[data-pos]').forEach((c) => c.classList.toggle('dim', !!b.dataset.pos && c.dataset.pos !== b.dataset.pos));
  };
  bar.addEventListener('click', click);
  return () => bar.removeEventListener('click', click);
}

/* ---------- drawer ---------- */

let drawer;
export function openDrawer(html) {
  if (!drawer) {
    drawer = document.createElement('aside');
    drawer.className = 'drawer';
    drawer.innerHTML = '<div class="scrim"></div><div class="sheet" role="dialog" aria-modal="true"><button class="x" type="button" aria-label="Close">×</button><div class="body"></div></div>';
    drawer.addEventListener('click', (e) => {
      if (e.target.closest('.x') || e.target.classList.contains('scrim')) closeDrawer();
    });
    document.body.append(drawer);
    document.addEventListener('keydown', (e) => e.key === 'Escape' && closeDrawer());
  }
  drawer.querySelector('.body').innerHTML = html;
  requestAnimationFrame(() => drawer.classList.add('open'));
}
export const closeDrawer = () => drawer?.classList.remove('open');

export function pickDrawerHtml({ draft, pick, team, model, valueItem }) {
  const m = pick.metadata;
  const p = { id: pick.player_id, pos: m.position, name: `${m.first_name} ${m.last_name}`, team: m.team };
  const rec = model?.playerPts.get(pick.player_id);
  const weekly = rec ? model.weeks.filter((w) => w.complete || w.live).map((w) => rec.by[w.week] ?? 0) : [];
  const delta = valueItem?.delta ?? 0;
  const verdict = !valueItem
    ? ''
    : delta >= 3
      ? `<p class="verdict good">Steal — drafted as ${esc(p.pos)}${valueItem.pickRank}, scoring like ${esc(p.pos)}${valueItem.ptsRank}.</p>`
      : delta <= -3
        ? `<p class="verdict bad">Disappointing — drafted as ${esc(p.pos)}${valueItem.pickRank}, scoring like ${esc(p.pos)}${valueItem.ptsRank}.</p>`
        : `<p class="verdict">Right on value — ${esc(p.pos)}${valueItem.pickRank} pick, ${esc(p.pos)}${valueItem.ptsRank} producer.</p>`;
  return `<div class="pd">
    ${headshot(p, 84)}
    <h3>${esc(p.name)}</h3>
    <p class="muted">${posTag(p.pos)} ${esc(p.team || 'FA')}</p>
    <dl>
      <div><dt>Pick</dt><dd>#${pick.pick_no} <small>(round ${pick.round})</small></dd></div>
      <div><dt>Drafted by</dt><dd>${team ? `${avatar(team, 22)} ${esc(team.name)}` : '—'}</dd></div>
      ${rec ? `<div><dt>Season points</dt><dd>${fmt(rec.total)}</dd></div>` : ''}
    </dl>
    ${weekly.length ? `<div class="pd-spark">${spark(weekly, { w: 260, h: 56, color: posColor(p.pos) })}<small class="muted">points by week</small></div>` : ''}
    ${verdict}
  </div>`;
}
