import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { api, players } from './sleeper.js';
import { loadLeague } from './league.js';
import { awards, describeTx } from './commands.js';

const STATE_FILE = new URL('../data/watcher.json', import.meta.url);

async function readState() {
  try {
    return JSON.parse(await readFile(STATE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

async function writeState(state) {
  await mkdir(new URL('../data/', import.meta.url), { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(state));
}

// Posts new trades/waivers as they happen and the awards recap when a week rolls over.
// The first run only records what already exists, so it never floods the chat.
export function startWatcher(post, intervalMs = 60_000) {
  async function tick() {
    const m = await loadLeague();
    const pm = await players();
    const weeks = [m.state.week, m.state.week - 1].filter((w) => w >= 1);
    const txs = (await Promise.all(weeks.map((w) => api(`/league/${m.id}/transactions/${w}`, 0)))).flat();
    const done = txs.filter((t) => t.status === 'complete').sort((a, b) => a.created - b.created);

    const state = await readState();
    if (!state) {
      return writeState({ seen: done.map((t) => t.transaction_id), awardsWeek: m.state.week - 1 });
    }

    const seen = new Set(state.seen);
    for (const tx of done) {
      if (seen.has(tx.transaction_id)) continue;
      await post(describeTx(m, tx, pm));
      seen.add(tx.transaction_id);
    }

    let awardsWeek = state.awardsWeek;
    const finished = m.state.week - 1;
    if (finished >= 1 && finished > awardsWeek) {
      await post(await awards([], finished));
      awardsWeek = finished;
    }
    await writeState({ seen: [...seen], awardsWeek });
  }

  const run = () => tick().catch((err) => console.error('watcher error:', err.message));
  run();
  return setInterval(run, intervalMs);
}
