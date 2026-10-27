// Reusable cards used by several views.
import { player } from '../data.js';
import { esc, fmt, avatar, headshot, posTag, teamLink, timeAgo } from '../ui.js';

export function playerChip(pm, id, extra = '') {
  const p = player(pm, id);
  return `<span class="pchip">${headshot(p, 28)}<span class="pn">${esc(p.name)}</span>${posTag(p.pos)}${extra}</span>`;
}

export function awardCard(a, pm) {
  const who = a.pid ? player(pm, a.pid) : null;
  return `<article class="award ${a.tone ?? ''}">
    <div class="aw-ic">${a.icon}</div>
    <div class="aw-body">
      <h4>${esc(a.title)}</h4>
      <div class="aw-team">${avatar(a.team, 22)} ${teamLink(a.team)}</div>
      <p>${esc(a.text)}</p>
    </div>
    ${who ? headshot(who, 46) : ''}
  </article>`;
}

export function moveCard(model, pm, tx) {
  const team = (id) => model.teamBy.get(id);
  const side = (rid) => {
    const t = team(rid);
    const got = Object.entries(tx.adds ?? {}).filter(([, r]) => r === rid).map(([pid]) => playerChip(pm, pid));
    const lost = Object.entries(tx.drops ?? {}).filter(([, r]) => r === rid).map(([pid]) => playerChip(pm, pid));
    const picks = (tx.draft_picks ?? [])
      .filter((d) => d.owner_id === rid)
      .map((d) => `<span class="pchip pick">${esc(d.season)} round ${esc(d.round)} pick</span>`);
    return { t, got, lost, picks };
  };
  const ago = `<span class="muted">${timeAgo(tx.created)} · wk ${esc(tx.leg)}</span>`;

  if (tx.type === 'trade') {
    const sides = tx.roster_ids.map(side);
    return `<article class="move trade">
      <header><span class="mv-ic">🔁</span><b>Trade</b>${ago}</header>
      <div class="trade-grid">${sides
        .map(
          (s) => `<div class="trade-side"><div class="who">${avatar(s.t, 26)} ${teamLink(s.t)} <span class="muted">receives</span></div>
          <div class="chips">${[...s.got, ...s.picks].join('') || '<span class="muted">nothing</span>'}</div></div>`,
        )
        .join('')}</div></article>`;
  }

  const s = side(tx.roster_ids?.[0]);
  const kind = tx.type === 'waiver' ? 'Waiver claim' : tx.type === 'commissioner' ? 'Commissioner move' : 'Free agent pickup';
  const bid = tx.type === 'waiver' && tx.settings?.waiver_bid != null ? `<span class="bid">$${esc(tx.settings.waiver_bid)}</span>` : '';
  return `<article class="move">
    <header><span class="mv-ic">${tx.type === 'waiver' ? '📝' : '⚡'}</span><b>${kind}</b>${bid}${ago}</header>
    <div class="who">${avatar(s.t, 26)} ${teamLink(s.t)}</div>
    <div class="chips">
      ${s.got.map((c) => `<span class="plus">＋</span>${c}`).join('')}
      ${s.lost.map((c) => `<span class="minus">−</span>${c}`).join('')}
    </div></article>`;
}

// One head-to-head card. `expand` adds a click-to-open starter breakdown.
export function matchupCard(model, pm, game, { week, expand = false } = {}) {
  const [a, b] = game;
  const ta = model.teamBy.get(a.roster_id);
  const tb = model.teamBy.get(b.roster_id);
  const total = (a.points || 0) + (b.points || 0);
  const pa = total ? ((a.points || 0) / total) * 100 : 50;
  const played = total > 0;
  const lead = a.points === b.points ? 0 : a.points > b.points ? 1 : 2;
  const rowFor = (e, t, side) => {
    const ra = model.rowBy.get(t.id);
    return `<div class="side ${lead === side ? 'lead' : ''}">
      ${avatar(t, 40)}
      <div class="nm">${teamLink(t)}<span class="muted">${ra.w}-${ra.l}${ra.t ? `-${ra.t}` : ''}${t.owner !== t.name ? ` · ${esc(t.owner)}` : ''}</span></div>
      <div class="pts">${played ? fmt(e.points, 2) : '—'}</div></div>`;
  };
  const detail = expand ? `<div class="detail" hidden>${lineups(model, pm, a, b)}</div>` : '';
  return `<article class="match ${expand ? 'expandable' : ''}" data-week="${week ?? ''}">
    ${rowFor(a, ta, 1)}
    <div class="vsbar" aria-hidden="true"><i style="width:${pa.toFixed(1)}%"></i></div>
    ${rowFor(b, tb, 2)}
    ${expand ? '<button class="more" type="button">Lineups</button>' : ''}
    ${detail}</article>`;
}

function lineups(model, pm, a, b) {
  const slots = model.league.roster_positions.filter((p) => p !== 'BN');
  const col = (e) => {
    const rows = e.starters.map((pid, i) => {
      const p = player(pm, pid);
      const pts = e.starters_points?.[i] ?? e.players_points?.[pid] ?? 0;
      return `<li><span class="slot">${esc(slots[i] ?? 'FLX')}</span>${headshot(p, 26)}<span class="pn">${esc(p.name)}</span><b>${fmt(pts)}</b></li>`;
    });
    return `<ul class="lineup">${rows.join('')}</ul>`;
  };
  return `<div class="lineups">${col(a)}${col(b)}</div>`;
}
