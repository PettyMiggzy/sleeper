// Draft room: works on any Sleeper draft ID. Live drafts poll every few seconds;
// finished drafts can be "simulated" pick by pick so the room can be tried any time.
import { api, loadDraft, pickOwner, player } from '../data.js';
import { esc, avatar, headshot, posTag, posColor, POS_ORDER, sleeperUrl, sleeperBtn, $, $$, toast } from '../ui.js';
import { boardHtml, openDrawer, pickDrawerHtml } from './board.js';

const store = {
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    o.start();
    o.stop(ctx.currentTime + 0.5);
  } catch {}
}

async function teamsFor(draft, model) {
  if (draft.league_id && draft.league_id === model.id) return model.teamBy;
  const out = new Map();
  if (!draft.league_id) return out;
  try {
    const [users, rosters] = await Promise.all([api(`/league/${draft.league_id}/users`, 60_000), api(`/league/${draft.league_id}/rosters`, 60_000)]);
    const by = new Map(users.map((u) => [u.user_id, u]));
    for (const r of rosters) {
      const u = by.get(r.owner_id);
      out.set(r.roster_id, { id: r.roster_id, name: u?.metadata?.team_name || u?.display_name || `Team ${r.roster_id}`, avatar: u?.avatar, owner: u?.display_name });
    }
  } catch {}
  return out;
}

export default {
  render({ model }, arg) {
    const id = arg || model.league.draft_id || '';
    return `
    <section class="panel room">
      <header class="ph"><h2>Draft room</h2><span class="muted">any Sleeper draft · live or replayed</span></header>
      <form class="roombar" id="roomform">
        <label>Draft ID <input id="did" inputmode="numeric" value="${esc(id)}" placeholder="paste a draft ID" autocomplete="off"></label>
        <label>I am <select id="me"><option value="">spectating</option></select></label>
        <button class="btn primary" type="submit">Load</button>
      </form>
      <div id="roomstate" class="roomstate"></div>
    </section>`;
  },

  mount(root, { model, pm }, arg) {
    const S = { draft: null, picks: [], teams: new Map(), simN: null, me: null, notify: false, notified: 0, sim: null, poll: null, clock: null, pos: '' };
    const stateEl = $('#roomstate', root);
    const meSel = $('#me', root);
    const form = $('#roomform', root);

    const slotTeam = (slot) => S.teams.get(S.draft.slot_to_roster_id?.[slot]);
    const shown = () => (S.simN == null ? S.picks : S.picks.slice(0, S.simN));
    const total = () => S.draft.settings.teams * S.draft.settings.rounds;

    const stopTimers = () => {
      clearInterval(S.sim);
      clearInterval(S.poll);
      clearInterval(S.clock);
      S.sim = S.poll = S.clock = null;
    };

    async function load(id) {
      stopTimers();
      stateEl.innerHTML = '<div class="loading"><span class="ball"></span><p>Loading draft…</p></div>';
      try {
        const { draft, picks } = await loadDraft(id, 0);
        S.draft = draft;
        S.picks = picks;
        S.simN = null;
        S.notified = 0;
        S.teams = await teamsFor(draft, model);
        meSel.innerHTML = '<option value="">spectating</option>' + [...S.teams.values()].map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
        const saved = store.get(`me:${id}`);
        if (saved && S.teams.has(Number(saved))) meSel.value = saved;
        S.me = meSel.value ? Number(meSel.value) : null;
        if (draft.type === 'auction') {
          stateEl.innerHTML = '<p class="empty">Auction drafts aren\'t supported in the room yet — snake and linear drafts only.</p>';
          return;
        }
        paint();
        if (draft.status === 'drafting') S.poll = setInterval(refresh, 4000);
        S.clock = setInterval(tickClock, 500);
      } catch (e) {
        stateEl.innerHTML = `<p class="empty">Couldn't load that draft (${esc(e.message)}). Check the draft ID.</p>`;
      }
    }

    async function refresh() {
      if (S.simN != null) return;
      try {
        const { draft, picks } = await loadDraft(S.draft.draft_id, 0);
        const changed = picks.length !== S.picks.length || draft.status !== S.draft.status;
        S.draft = draft;
        S.picks = picks;
        if (changed) paint();
        if (draft.status !== 'drafting') clearInterval(S.poll);
      } catch {}
    }

    function nextInfo() {
      const done = shown().length;
      if (done >= total()) return null;
      const owner = pickOwner(S.draft, done + 1);
      let away = null;
      if (S.me != null) {
        for (let n = done + 1; n <= total(); n++) {
          if (pickOwner(S.draft, n)?.rosterId === S.me) {
            away = n - (done + 1);
            break;
          }
        }
      }
      return { owner, away, n: done + 1 };
    }

    function tickClock() {
      const el = $('#clock', root);
      if (!el || !S.draft) return;
      if (S.simN != null || S.draft.status !== 'drafting') return (el.textContent = '');
      const timer = S.draft.settings.pick_timer;
      const base = Number(S.draft.last_picked) || Number(S.draft.start_time) || Date.now();
      const left = Math.max(0, Math.round(timer - (Date.now() - base) / 1000));
      el.textContent = timer ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : '';
    }

    function paint() {
      const d = S.draft;
      const list = shown();
      const taken = new Set(list.map((p) => p.player_id));
      const info = nextInfo();
      const onClock = info?.owner ? S.teams.get(info.owner.rosterId) : null;
      const mine = list.filter((p) => p.roster_id === S.me);
      const counts = Object.fromEntries(POS_ORDER.map((p) => [p, mine.filter((x) => x.metadata.position === p).length]));
      const pool = Object.entries(pm)
        .filter(([id, a]) => !taken.has(id) && a[3] < 9000 && a[2] !== 'FA' && (S.pos ? a[1] === S.pos : a[1] !== 'K' && a[1] !== 'DEF'))
        .sort((a, b) => a[1][3] - b[1][3])
        .slice(0, 14);
      const live = d.status === 'drafting' && S.simN == null;

      const banner = !info
        ? `<div class="otc-card done"><b>Draft complete</b><span>${list.length} picks made</span></div>`
        : S.me != null && info.away === 0
          ? `<div class="otc-card you"><small>YOU'RE ON THE CLOCK</small><b>Pick #${info.n} · round ${info.owner.round}</b><span id="clock" class="clock"></span></div>`
          : `<div class="otc-card"><small>ON THE CLOCK${live ? ' · LIVE' : S.simN != null ? ' · SIMULATED' : ''}</small>
              <b>${onClock ? `${avatar(onClock, 26)} ${esc(onClock.name)}` : `Slot ${info.owner.slot}`}</b>
              <span>Pick #${info.n} · round ${info.owner.round}${info.away != null ? ` · you're ${info.away} away` : ''}</span><span id="clock" class="clock"></span></div>`;

      const recent = list.slice(-6).reverse().map((p) => {
        const m = p.metadata;
        return `<li>${headshot({ id: p.player_id, pos: m.position }, 30)}<div class="grow"><b>${esc(m.first_name)} ${esc(m.last_name)}</b>
          <span class="muted">${esc(S.teams.get(p.roster_id)?.name ?? `Team ${p.roster_id}`)}</span></div>${posTag(m.position)}<span class="rk">#${p.pick_no}</span></li>`;
      });

      const bestHtml = pool
        .map(([id, a]) => `<li>${headshot({ id, pos: a[1] }, 32)}<div class="grow"><b>${esc(a[0])}</b><span class="muted">${esc(a[2])}${a[4] ? ` · <span class="inj">${esc(a[4])}</span>` : ''}</span></div>${posTag(a[1])}<span class="rk">${a[3]}</span></li>`)
        .join('');

      stateEl.innerHTML = `
      ${banner}
      <div class="roomctl">
        <button class="btn" id="simbtn" type="button">${S.simN != null && S.sim ? '■ Pause' : S.simN != null ? '▶ Resume simulation' : '▶ Simulate this draft'}</button>
        ${S.simN != null ? '<button class="btn ghost" id="golive" type="button">Back to real picks</button>' : ''}
        <label class="scrub">Pick <input id="scrub" type="range" min="0" max="${total()}" value="${list.length}"> <b>${list.length}/${total()}</b></label>
        ${sleeperBtn(sleeperUrl.draft(d.draft_id), 'Open in Sleeper')}
        <button class="btn ghost" id="notif" type="button">${S.notify ? '🔔 Alerts on' : '🔕 Alert me when I\'m close'}</button>
      </div>
      <div class="roomgrid">
        <div class="roomside">
          <div class="subpanel"><h3>Best available <small class="muted">by Sleeper popularity rank</small></h3>
            <nav class="chips" id="roompos"><button class="chip ${S.pos ? '' : 'on'}" data-pos="" type="button">Flex</button>${POS_ORDER.map((p) => `<button class="chip ${S.pos === p ? 'on' : ''}" data-pos="${p}" type="button" style="--c:${posColor(p)}"><i class="dot"></i>${p}</button>`).join('')}</nav>
            <ul class="hot compact">${bestHtml || '<li class="muted">Nobody left in the pool.</li>'}</ul></div>
          <div class="subpanel"><h3>Latest picks</h3><ul class="hot compact">${recent.join('') || '<li class="muted">No picks yet.</li>'}</ul></div>
          ${S.me != null ? `<div class="subpanel"><h3>My roster <small class="muted">${mine.length} picks</small></h3>
            <div class="needs">${POS_ORDER.map((p) => `<span class="need" style="--c:${posColor(p)}"><b>${counts[p]}</b>${p}</span>`).join('')}</div>
            <ul class="hot compact">${mine.map((p) => `<li>${headshot({ id: p.player_id, pos: p.metadata.position }, 28)}<div class="grow"><b>${esc(p.metadata.first_name)} ${esc(p.metadata.last_name)}</b></div>${posTag(p.metadata.position)}<span class="rk">#${p.pick_no}</span></li>`).join('') || '<li class="muted">Nothing yet.</li>'}</ul></div>` : ''}
        </div>
        <div class="roommain">${boardHtml(d, list, slotTeam)}</div>
      </div>`;

      if (info) $(`.cell[data-n="${info.n}"]`, stateEl)?.classList.add('otc');
      tickClock();
      maybeNotify(info, onClock);
    }

    function maybeNotify(info, onClock) {
      if (!S.notify || !info || S.me == null || info.away == null || info.away > 2 || S.notified === info.n) return;
      S.notified = info.n;
      beep();
      const msg = info.away === 0 ? "You're on the clock!" : `You pick in ${info.away + 1} picks`;
      toast(msg);
      try {
        if (Notification.permission === 'granted') new Notification('Draft room', { body: msg });
      } catch {}
    }

    const onSubmit = (e) => {
      e.preventDefault();
      const id = $('#did', root).value.trim();
      if (!/^\d{6,}$/.test(id)) return toast('Draft IDs are long numbers — copy it from the Sleeper URL');
      history.replaceState(null, '', `#/room/${id}`);
      load(id);
    };
    form.addEventListener('submit', onSubmit);
    meSel.addEventListener('change', () => {
      S.me = meSel.value ? Number(meSel.value) : null;
      if (S.draft) store.set(`me:${S.draft.draft_id}`, meSel.value);
      S.notified = 0;
      if (S.draft) paint();
    });

    const onClick = async (e) => {
      if (!S.draft) return;
      const t = e.target;
      if (t.closest('#simbtn')) {
        if (S.sim) {
          clearInterval(S.sim);
          S.sim = null;
          return paint();
        }
        if (S.simN == null || S.simN >= total()) S.simN = 0;
        S.sim = setInterval(() => {
          S.simN++;
          if (S.simN >= total()) {
            clearInterval(S.sim);
            S.sim = null;
          }
          paint();
        }, 1100);
        paint();
      } else if (t.closest('#golive')) {
        clearInterval(S.sim);
        S.sim = null;
        S.simN = null;
        paint();
      } else if (t.closest('#notif')) {
        S.notify = !S.notify;
        if (S.notify && 'Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
        toast(S.notify ? 'Alerts on — you\'ll get a ping 2 picks before yours' : 'Alerts off');
        paint();
      } else if (t.closest('#roompos [data-pos]')) {
        S.pos = t.closest('[data-pos]').dataset.pos;
        paint();
      } else {
        const cell = t.closest('.cell[data-n]');
        if (cell && !cell.classList.contains('empty')) {
          const pick = S.picks.find((p) => p.pick_no === Number(cell.dataset.n));
          if (pick) openDrawer(pickDrawerHtml({ draft: S.draft, pick, team: S.teams.get(pick.roster_id), model: S.draft.league_id === model.id ? model : null }));
        }
      }
    };
    const onInput = (e) => {
      if (e.target.id !== 'scrub' || !S.draft) return;
      clearInterval(S.sim);
      S.sim = null;
      S.simN = Number(e.target.value);
      paint();
    };
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);

    const start = $('#did', root).value.trim();
    if (start) load(start);

    return () => {
      stopTimers();
      form.removeEventListener('submit', onSubmit);
      root.removeEventListener('click', onClick);
      root.removeEventListener('input', onInput);
    };
  },
};
