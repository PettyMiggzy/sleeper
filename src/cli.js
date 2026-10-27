// Try any bot command without Telegram:  node src/cli.js standings
//                                        node src/cli.js roster papasilk
import { commands } from './commands.js';

const [name = 'help', ...args] = process.argv.slice(2);
const handler = commands[name];
if (!handler) {
  console.error(`Unknown command "${name}". Try: ${Object.keys(commands).join(', ')}`);
  process.exit(1);
}
const html = await handler(args);
console.log(html.replace(/<\/?(pre|b|code)>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
