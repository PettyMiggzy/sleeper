export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const num = (n, d = 1) => Number(n).toFixed(d);
export const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
export const padR = (s, n) => clip(String(s), n).padEnd(n);
export const padL = (s, n) => String(s).padStart(n);

// Monospace block; contents are escaped here.
export const pre = (lines) => `<pre>${esc(lines.join('\n'))}</pre>`;

// Telegram caps messages at 4096 chars. Sections are separated by blank lines
// and are self-contained, so splitting between them never breaks a tag.
export function chunk(text, max = 4000) {
  const out = [];
  let cur = '';
  for (const part of text.split('\n\n')) {
    if (cur && cur.length + part.length + 2 > max) {
      out.push(cur);
      cur = part;
    } else {
      cur = cur ? `${cur}\n\n${part}` : part;
    }
  }
  if (cur) out.push(cur);
  return out;
}
