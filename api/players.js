// Slimmed NFL player list for the site. Sleeper's raw /players/nfl is ~15MB and
// they ask for at most one fetch a day, so we trim it to fantasy-relevant
// players and let Vercel's CDN cache the result.
const POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);
const TTL_MS = 6 * 60 * 60 * 1000;

let cache = null;
let cachedAt = 0;

async function build() {
  const res = await fetch('https://api.sleeper.app/v1/players/nfl');
  if (!res.ok) throw new Error(`Sleeper responded ${res.status}`);
  const raw = await res.json();
  const out = {};
  for (const [id, p] of Object.entries(raw)) {
    if (!POSITIONS.has(p.position)) continue;
    if (p.position !== 'DEF' && !p.team && p.status !== 'Active') continue;
    const name = p.position === 'DEF' ? `${id} D/ST` : p.full_name || `${p.first_name} ${p.last_name}`;
    // [name, position, team, search_rank, injury_status]
    out[id] = [name, p.position, p.team || 'FA', p.search_rank ?? 9999, p.injury_status || ''];
  }
  return out;
}

export default async function handler(req, res) {
  try {
    if (!cache || Date.now() - cachedAt > TTL_MS) {
      cache = await build();
      cachedAt = Date.now();
    }
    res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
    res.status(200).json(cache);
  } catch (err) {
    res.status(502).json({ error: String(err.message || err) });
  }
}
