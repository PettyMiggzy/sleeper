import { mkdir, readFile, writeFile } from 'node:fs/promises';

const BASE = 'https://api.sleeper.app/v1';
const DATA_DIR = new URL('../data/', import.meta.url);
const PLAYERS_TTL_MS = 24 * 60 * 60 * 1000;

const cache = new Map();

export async function api(path, ttlMs = 30_000) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`Sleeper ${res.status} on ${path}`);
  const value = await res.json();
  cache.set(path, { at: Date.now(), value });
  return value;
}

let playerMap = null;

// id -> { name, pos, team }. The raw file is ~15MB and Sleeper asks for at most
// one fetch a day, so we keep a slimmed copy on disk and in memory.
export async function players() {
  if (playerMap) return playerMap;
  const file = new URL('players.json', DATA_DIR);
  try {
    const saved = JSON.parse(await readFile(file, 'utf8'));
    if (Date.now() - saved.at < PLAYERS_TTL_MS) return (playerMap = saved.map);
  } catch {}

  const res = await fetch(`${BASE}/players/nfl`);
  if (!res.ok) throw new Error(`Sleeper ${res.status} on /players/nfl`);
  const raw = await res.json();
  const map = {};
  for (const [id, p] of Object.entries(raw)) {
    const isDef = p.position === 'DEF';
    map[id] = {
      name: isDef ? `${id} D/ST` : p.full_name || `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || id,
      pos: p.position ?? '?',
      team: p.team ?? 'FA',
    };
  }
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(file, JSON.stringify({ at: Date.now(), map }));
  return (playerMap = map);
}

export const playerLabel = (pm, id) => {
  const p = pm[id];
  return p ? `${p.name} (${p.pos})` : String(id);
};
