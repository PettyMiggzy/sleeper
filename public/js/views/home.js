import { api, loadMoves, weekAwards, player, lineupFor } from '../data.js';
import { esc, fmt, avatar, teamLink, headshot, posTag, myTeam } from '../ui.js';
import { awardCard, moveCard, matchupCard } from './shared.js';

function heroArt() {
  const ys = Array.from({ length: 8 }, (_, i) => 34 + i * 42);
  let cur = ys;
  let x = 10;
  const step = 70;
  let d = '';
  for (let r = 0; r < 3; r++) {
    const next = [];
    for (let i = 0; i < cur.length; i += 2) {
      const m = (cur[i] + cur[i + 1]) / 2;
      d += `M${x} ${cur[i]}H${x + step}V${cur[i + 1]}H${x}M${x + step} ${m}H${x + step * 1.6}`;
      next.push(m);
    }
    cur = next;
    x += step * 1.6;
  }
  d += `M${x} ${cur[0]}H${x + 44}`;
  return `<div class="hero-visual"><svg class="hero-art" viewBox="0 0 580 360" aria-hidden="true">
    <defs>
      <linearGradient id="ln" x1="0" x2="1"><stop offset="0" stop-color="#7c5cff"/><stop offset="1" stop-color="#c6ff3d"/></linearGradient>
      <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".45" stop-color="#ffc83d"/><stop offset="1" stop-color="#d98a00"/></linearGradient>
      <radialGradient id="halo"><stop offset="0" stop-color="#ffd966" stop-opacity=".55"/><stop offset="1" stop-color="#ffd966" stop-opacity="0"/></radialGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <circle cx="446" cy="150" r="118" fill="url(#halo)" class="halo"/>
    <path d="${d}" pathLength="1" fill="none" stroke="url(#ln)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)" class="draw"/>
  </svg><div class="trophy3d" id="trophy"><img src="/assets/trophy.png" alt="Championship trophy" width="512" height="512" fetchpriority="high"></div></div>`;
}

const statCard = (label, value, note = '') =>
  `<div class="stat"><span>${esc(label)}</span><b>${value}</b>${note ? `<em>${note}</em>` : ''}</div>`;

export default {
  async render({ model, pm }) {
    const { league, state, rows, weeks, done, teamBy } = model;
    const [moves, trend] = await Promise.all([
      loadMoves(model).catch(() => []),
      api('/players/nfl/trending/add?lookback_hours=24&limit=30', 300_000).catch(() => []),
    ]);

    const cur = weeks.find((w) => w.week === state.week) ?? weeks.at(-1);
    const last = done.at(-1);
    const totalPts = rows.reduce((a, r) => a + r.pf, 0);
    const teamGames = rows.reduce((a, r) => a + r.games, 0);
    const high = rows.reduce((a, r) => ((r.bestWeek?.pts ?? 0) > (a?.bestWeek?.pts ?? 0) ? r : a), rows[0]);
    const trades = moves.filter((m) => m.type === 'trade').length;

    const ticker = last
      ? last.games
          .map(([a, b]) => {
            const [w, l] = a.points >= b.points ? [a, b] : [b, a];
            return `<span class="tick"><b>${esc(teamBy.get(w.roster_id).name)}</b> ${fmt(w.points)} <i>def.</i> ${esc(teamBy.get(l.roster_id).name)} ${fmt(l.points)}</span>`;
          })
          .join('')
      : '';

    const owned = new Set(model.teams.flatMap((t) => t.players));
    const hot = trend.filter((t) => !owned.has(t.player_id)).slice(0, 5);

    const lineupRows = model.teams.map((t) => ({ t, res: lineupFor(model, pm, t) }));
    const flagged = lineupRows.filter((r) => r.res.status === 'bad' || r.res.status === 'warn');
    const mine = lineupRows.find((r) => r.t.id === myTeam.get());
    const lineupBanner = mine && mine.res.issues.length
      ? `<div class="banner ${mine.res.status === 'bad' ? 'bad' : ''}">🚨 <span><b>${esc(mine.t.name)}</b> has ${mine.res.issues.length} lineup issue${mine.res.issues.length > 1 ? 's' : ''}: ${esc(mine.res.issues[0].text)}</span><a href="#/team/${mine.t.id}">Fix it →</a></div>`
      : flagged.length
        ? `<div class="banner">⚠️ <span><b>${flagged.length}</b> team${flagged.length > 1 ? 's have' : ' has'} a starter who is out or questionable.</span><a href="#/lineups">Lineup check →</a></div>`
        : '';

    const spotlight = cur?.games ?? [];
    const awards = last ? weekAwards(model, pm, last.week).slice(0, 4) : [];

    return `
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Season ${esc(league.season)} · Week ${esc(state.week)}</p>
        <h1>${esc(league.name)}</h1>
        <p class="lede">${model.teams.length} teams, PPR, high stakes. Live standings, power rankings, draft replays and a full war room — all in one place.</p>
        <div class="cta">
          <a class="btn primary" href="#/standings">Standings</a>
          <a class="btn" href="#/draft">Draft board</a>
          <a class="btn ghost" href="#/room">Draft room</a>
        </div>
      </div>
      ${heroArt()}
    </section>

    ${ticker ? `<div class="ticker" aria-label="Last week's results"><div class="track">${ticker}${ticker}</div></div>` : ''}

    ${lineupBanner}

    <section class="stats">
      ${statCard('Points scored', fmt(totalPts, 0), `${done.length} weeks played`)}
      ${statCard('Avg team score', teamGames ? fmt(totalPts / teamGames) : '—', 'per game')}
      ${statCard('Season high', high?.bestWeek ? fmt(high.bestWeek.pts, 1) : '—', high?.bestWeek ? `${esc(high.team.name)} · wk ${high.bestWeek.week}` : '')}
      ${statCard('Trades', trades, `${moves.length} total transactions`)}
    </section>

    <div class="cols">
      <section class="panel">
        <header class="ph"><h2>Week ${esc(cur?.week ?? state.week)} matchups</h2><a href="#/scores">All scores →</a></header>
        ${
          spotlight.length
            ? `<div class="match-grid">${spotlight.slice(0, 6).map((g) => matchupCard(model, pm, g)).join('')}</div>`
            : '<p class="muted pad">No matchups yet.</p>'
        }
      </section>

      <section class="panel">
        <header class="ph"><h2>Power rankings</h2><a href="#/standings">Full table →</a></header>
        <ol class="power">
          ${[...rows]
            .sort((a, b) => a.powerRank - b.powerRank)
            .slice(0, 8)
            .map(
              (r) => `<li>
                <span class="rk">${r.powerRank}</span>${avatar(r.team, 34)}
                <div class="grow">${teamLink(r.team)}<div class="meter"><i style="width:${Math.max(4, r.power).toFixed(0)}%"></i></div></div>
                <span class="rec">${r.w}-${r.l}${r.t ? `-${r.t}` : ''}</span></li>`,
            )
            .join('')}
        </ol>
      </section>
    </div>

    ${
      awards.length
        ? `<section class="panel"><header class="ph"><h2>Week ${last.week} awards</h2><a href="#/awards">All awards →</a></header>
           <div class="award-grid">${awards.map((a) => awardCard(a, pm)).join('')}</div></section>`
        : ''
    }

    <div class="cols">
      <section class="panel">
        <header class="ph"><h2>Latest moves</h2><a href="#/moves">Full feed →</a></header>
        <div class="stack">${moves.slice(0, 4).map((m) => moveCard(model, pm, m)).join('') || '<p class="muted pad">No moves yet.</p>'}</div>
      </section>
      <section class="panel">
        <header class="ph"><h2>Hot on the wire</h2><a href="#/market">Market →</a></header>
        <ul class="hot">
          ${hot
            .map((t) => {
              const p = player(pm, t.player_id);
              return `<li>${headshot(p, 40)}<div class="grow"><b>${esc(p.name)}</b><span class="muted">${esc(p.team)}</span></div>${posTag(p.pos)}<span class="adds">+${t.count}</span></li>`;
            })
            .join('') || '<li class="muted">Nothing trending is available right now.</li>'}
        </ul>
        <p class="note">Most added across Sleeper in 24h, and unrostered in this league.</p>
      </section>
    </div>`;
  },

  // Progressive enhancement: the 88KB PNG shows everywhere; wide screens on a normal
  // connection swap in the interactive 3D model (7.6MB) once the page is idle.
  mount(root) {
    const slot = root.querySelector('#trophy');
    const heavy = navigator.connection?.saveData || !matchMedia('(min-width: 900px)').matches;
    if (!slot || heavy) return;
    let cancelled = false;
    const upgrade = async () => {
      try {
        await import('https://unpkg.com/@google/model-viewer@3.5.0/dist/model-viewer.min.js');
        if (cancelled) return;
        const mv = document.createElement('model-viewer');
        mv.setAttribute('src', '/assets/trophy.glb');
        mv.setAttribute('alt', 'Spinning 3D championship trophy');
        mv.setAttribute('auto-rotate', '');
        mv.setAttribute('rotation-per-second', '24deg');
        mv.setAttribute('camera-controls', '');
        mv.setAttribute('disable-zoom', '');
        mv.setAttribute('interaction-prompt', 'none');
        mv.setAttribute('shadow-intensity', '0.8');
        mv.setAttribute('exposure', '1.8');
        mv.setAttribute('environment-image', 'neutral');
        mv.addEventListener(
          'load',
          () => {
            if (cancelled) return;
            mv.style.cssText = '';
            slot.replaceChildren(mv);
            slot.classList.add('live');
          },
          { once: true },
        );
        mv.style.cssText = 'position:absolute;opacity:0;pointer-events:none';
        slot.append(mv);
      } catch {
        /* keep the PNG */
      }
    };
    const id = 'requestIdleCallback' in window ? requestIdleCallback(upgrade, { timeout: 2500 }) : setTimeout(upgrade, 1200);
    return () => {
      cancelled = true;
      'cancelIdleCallback' in window ? cancelIdleCallback(id) : clearTimeout(id);
    };
  },
};
