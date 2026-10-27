import { chunk } from './format.js';

const token = () => {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  return t;
};

async function call(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`Telegram ${method}: ${json.description}`);
  return json.result;
}

export async function send(chatId, html) {
  for (const part of chunk(html)) {
    await call('sendMessage', { chat_id: chatId, text: part, parse_mode: 'HTML', disable_web_page_preview: true });
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Long polling: no public URL or webhook needed, so it runs anywhere.
export async function poll(onMessage) {
  let offset = 0;
  for (;;) {
    try {
      const updates = await call('getUpdates', { offset, timeout: 50, allowed_updates: ['message'] });
      for (const u of updates) {
        offset = u.update_id + 1;
        if (u.message?.text) await onMessage(u.message);
      }
    } catch (err) {
      console.error('poll error:', err.message);
      await sleep(5000);
    }
  }
}
