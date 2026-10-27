import { commands } from './commands.js';
import { poll, send } from './telegram.js';
import { startWatcher } from './watcher.js';
import { esc } from './format.js';

const allowed = process.env.TELEGRAM_CHAT_ID;

async function onMessage(msg) {
  const match = msg.text.match(/^\/(\w+)(?:@\w+)?(?:\s+(.*))?$/s);
  if (!match) return;
  const [, name, rest = ''] = match;
  const chatId = msg.chat.id;

  // Always answer /chatid so setup works before TELEGRAM_CHAT_ID is known.
  if (name === 'chatid') return send(chatId, `This chat's id is <code>${esc(chatId)}</code>`);
  if (allowed && String(chatId) !== String(allowed)) return;

  const handler = commands[name.toLowerCase()];
  if (!handler) return;
  try {
    await send(chatId, await handler(rest.split(/\s+/).filter(Boolean)));
  } catch (err) {
    console.error(`/${name} failed:`, err);
    await send(chatId, 'Something went wrong talking to Sleeper — try again in a minute.');
  }
}

if (allowed) startWatcher((html) => send(allowed, html));
else console.log('TELEGRAM_CHAT_ID not set: auto-posts are off. Add the bot to the group and send /chatid.');

console.log('League bot is running.');
poll(onMessage);
