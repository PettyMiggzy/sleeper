import { lineupFor, player } from '../data.js';
import { esc, avatar, teamLink, sleeperUrl, sleeperBtn, myTeam } from '../ui.js';
import { playerChip } from './shared.js';

const ICON = { bad: '🚨', warn: '⚠️', tip: '💡' };
const LABEL = { bad: 'Needs a fix', warn: 'Check it', tip: 'Could improve', ok: 'Set' };
const RANK = { bad: 0, warn: 1, tip: 2, ok: 3 };

export function lineupIssues(pm, issues) {
  return issues
    .map(
      (i) => `<li class="issue ${i.level}"><span class="ic">${ICON[i.level]}</span><div>
        <p>${esc(i.text)}</p>
        ${i.swap ? `<div class="swap"><span class="muted">${i.level === 'tip' ? 'Consider starting' : 'Replace with'}</span> ${playerChip(pm, i.swap)}</div>` : i.kind === 'injury' ? '<div class="swap muted">No healthy bench player fits that slot.</div>' : ''}
      </div></li>`,
    )
    .join('');
}

export const lineupCard = (model, pm, t, res, { link = true } = {}) => `
  <article class="lcard ${res.status}">
    <header>${avatar(t, 34)}<div class="grow">${link ? teamLink(t) : `<b>${esc(t.name)}</b>`}<span class="muted">${esc(t.owner)}</span></div>
      <span class="status ${res.status}">${LABEL[res.status]}</span></header>
    ${res.issues.length ? `<ul class="issues">${lineupIssues(pm, res.issues)}</ul>${sleeperBtn(sleeperUrl.team(model.id), 'Fix it in Sleeper')}` : '<p class="ok-line">✓ Healthy starters in every slot.</p>'}
  </article>`;

export default {
  render({ model, pm }) {
    const mine = myTeam.get();
    const rows = model.teams
      .map((t) => ({ t, res: lineupFor(model, pm, t) }))
      .sort((a, b) => RANK[a.res.status] - RANK[b.res.status] || (a.t.id === mine ? -1 : b.t.id === mine ? 1 : 0) || model.rowBy.get(a.t.id).rank - model.rowBy.get(b.t.id).rank);
    const count = (s) => rows.filter((r) => r.res.status === s).length;
    const needs = count('bad') + count('warn');
    return `
    <section class="panel">
      <header class="ph"><h2>Lineup check</h2>${sleeperBtn(sleeperUrl.league(model.id), 'Open league in Sleeper')}</header>
      <p class="note pad">${needs ? `<b>${needs}</b> of ${rows.length} teams have a starter who is out or questionable.` : 'Every lineup looks healthy right now.'}
        This page is read-only — Sleeper only lets you change a lineup inside Sleeper, so each fix button opens the app. Suggestions use injury status and season scoring averages, not projections, and can't see bye weeks (Sleeper's API doesn't expose them) — double-check before swapping.</p>
      <div class="summary">
        <span class="status bad">${count('bad')} need a fix</span><span class="status warn">${count('warn')} to check</span><span class="status tip">${count('tip')} could improve</span><span class="status ok">${count('ok')} set</span>
      </div>
    </section>
    <div class="lgrid">${rows.map((r) => `<div ${r.t.id === mine ? 'class="mine"' : ''}>${lineupCard(model, pm, r.t, r.res)}</div>`).join('')}</div>`;
  },
};
