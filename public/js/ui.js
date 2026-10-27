// Small rendering helpers shared by every view. Views build HTML strings, so
// everything that comes from the API goes through esc().
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const fmt = (n, d = 1) => Number(n ?? 0).toFixed(d);
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const POS_ORDER = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
export const POS_COLOR = {
  QB: '#ff5d7a',
  RB: '#34e0a1',
  WR: '#4cc3ff',
  TE: '#ffb347',
  K: '#b794ff',
  DEF: '#9aa6b8',
};
export const posColor = (pos) => POS_COLOR[pos] ?? '#7d8aa0';

export function initials(name) {
  const parts = String(name ?? '?').trim().split(/\s+/);
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
}

// Initials sit underneath; the CDN image covers them and removes itself if it 404s.
export function avatar(team, size = 36) {
  const img = team?.avatar
    ? `<img src="https://sleepercdn.com/avatars/thumbs/${esc(team.avatar)}" alt="" loading="lazy" onload="this.classList.add('ok')" onerror="this.remove()">`
    : '';
  const hue = ((team?.id ?? 0) * 47) % 360;
  return `<span class="av" style="--s:${size}px;--h:${hue}"><b>${esc(initials(team?.name))}</b>${img}</span>`;
}

export function headshot(p, size = 40) {
  const color = posColor(p.pos);
  const src =
    p.pos === 'DEF'
      ? `https://sleepercdn.com/images/team_logos/nfl/${String(p.id).toLowerCase()}.png`
      : `https://sleepercdn.com/content/nfl/players/thumb/${p.id}.jpg`;
  return `<span class="shot" style="--s:${size}px;--c:${color}"><b>${esc(p.pos)}</b><img src="${src}" alt="" loading="lazy" onload="this.classList.add('ok')" onerror="this.remove()"></span>`;
}

export const posTag = (pos) => `<span class="pos" style="--c:${posColor(pos)}">${esc(pos)}</span>`;

export const teamLink = (t, cls = '') =>
  t ? `<a class="tlink ${cls}" href="#/team/${t.id}">${esc(t.name)}</a>` : '';

export function timeAgo(ms) {
  const s = Math.max(1, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function spark(values, { w = 96, h = 28, color = 'var(--accent)' } = {}) {
  if (!values.length) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = values.length > 1 ? (w - 6) / (values.length - 1) : 0;
  const pts = values.map((v, i) => [3 + i * step, h - 3 - ((v - min) / span) * (h - 6)]);
  const line = pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <polyline points="${line}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="2.6" fill="${color}"/></svg>`;
}

// Weekly bars with a dashed league-average line.
export function weekBars(values, { avg, labels, w = 900, h = 210 } = {}) {
  if (!values.length) return '';
  const pad = { l: 8, r: 8, t: 14, b: 22 };
  const max = Math.max(...values, avg ?? 0) * 1.12 || 1;
  const bw = (w - pad.l - pad.r) / values.length;
  const y = (v) => pad.t + (h - pad.t - pad.b) * (1 - v / max);
  const bars = values
    .map((v, i) => {
      const x = pad.l + i * bw + bw * 0.14;
      const bh = h - pad.b - y(v);
      const above = avg == null || v >= avg;
      return `<g><rect class="bar ${above ? 'up' : 'down'}" x="${x.toFixed(1)}" y="${y(v).toFixed(1)}" width="${(bw * 0.72).toFixed(1)}" height="${bh.toFixed(1)}" rx="4"><title>${esc(labels?.[i] ?? `Wk ${i + 1}`)}: ${fmt(v, 2)}</title></rect>
        <text x="${(x + bw * 0.36).toFixed(1)}" y="${(y(v) - 4).toFixed(1)}" class="bl" text-anchor="middle">${Math.round(v)}</text>
        <text x="${(x + bw * 0.36).toFixed(1)}" y="${h - 6}" class="bx" text-anchor="middle">${esc(labels?.[i] ?? i + 1)}</text></g>`;
    })
    .join('');
  const avgLine =
    avg == null
      ? ''
      : `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y(avg).toFixed(1)}" y2="${y(avg).toFixed(1)}" class="avgline"/>`;
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Weekly points">${avgLine}${bars}</svg>`;
}

export function loading(label = 'Loading') {
  return `<div class="loading"><span class="ball"></span><p>${esc(label)}…</p></div>`;
}

export function empty(msg) {
  return `<div class="empty">${msg}</div>`;
}

export function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 2200);
}

/* ---------- Sleeper deep links + "my team" (device-local, no login) ---------- */
export const sleeperUrl = {
  league: (id) => `https://sleeper.com/leagues/${id}`,
  team: (id) => `https://sleeper.com/leagues/${id}/team`,
  matchup: (id) => `https://sleeper.com/leagues/${id}/matchup`,
  draft: (id) => `https://sleeper.com/draft/nfl/${id}`,
};

export const sleeperBtn = (href, label = 'Open in Sleeper') =>
  `<a class="btn ghost ext" href="${esc(href)}" target="_blank" rel="noreferrer noopener">${esc(label)} <span aria-hidden="true">↗</span></a>`;

export const myTeam = {
  get() {
    try {
      const v = localStorage.getItem('myTeam');
      return v ? Number(v) : null;
    } catch {
      return null;
    }
  },
  set(id) {
    try {
      id == null ? localStorage.removeItem('myTeam') : localStorage.setItem('myTeam', String(id));
    } catch {}
  },
};
