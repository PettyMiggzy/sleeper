// Tiny local server: serves public/ and mounts api/players.js like Vercel does.
//   node dev.js        -> http://localhost:3000
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
};

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/players') {
    const { default: handler } = await import('./api/players.js');
    res.status = (code) => ((res.statusCode = code), res);
    res.json = (body) => (res.setHeader('Content-Type', 'application/json'), res.end(JSON.stringify(body)));
    return handler(req, res);
  }
  const rel = normalize(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^(\.\.[/\\])+/, '');
  try {
    const body = await readFile(join(root, rel));
    res.setHeader('Content-Type', types[extname(rel)] ?? 'application/octet-stream');
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end('not found');
  }
}).listen(process.env.PORT || 3000, () => console.log(`http://localhost:${process.env.PORT || 3000}`));
