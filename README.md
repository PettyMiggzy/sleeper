# Brackets High Limit League

A league site and a Telegram bot for a Sleeper fantasy football league, built on the free
[Sleeper API](https://docs.sleeper.com) (no API key needed).

## The site (`public/` + `api/`)

Static pages plus one small serverless function. No build step.

| Page | What it does |
| --- | --- |
| Home | Hero, results ticker, league stats, this week's matchups, power top 8, awards, latest moves, hot free agents |
| Standings | League table with form, weekly trend, **power rankings** and a **luck index** (real wins vs all-play expected wins) |
| Scores | Any week's scoreboard, click a matchup for both lineups; auto-refreshes while games are live |
| Draft | Full snake board, **replay the whole draft pick by pick**, position filter, tap any pick for details |
| Draft > Value & grades | Biggest steals and busts, and a draft grade per team (starter points its own picks delivered) |
| Draft room | Paste **any** Sleeper draft ID: live board (polls every 4s), on-the-clock card with timer, best available, your roster needs, "you're 2 picks away" alerts. Finished drafts can be simulated pick by pick |
| Awards | Weekly awards and season superlatives, plus a button that copies the recap for the group chat |
| Moves | Every trade, waiver and free-agent move, filterable |
| Market | Most added / dropped players on Sleeper, and who owns them in your league |
| Team pages | Roster with season points, weekly scoring chart, results, draft class |

Open `/?league=<league_id>` to point the site at a different league.

### Deploy to Vercel

1. Import this repo in Vercel. Leave the framework preset as **Other**; `vercel.json` already sets the output directory to `public`.
2. Deploy. There are no environment variables to set for the site.

`api/players.js` trims Sleeper's 15MB player file to about 130KB and lets Vercel's CDN cache it for six hours,
which keeps us inside Sleeper's "fetch the player list at most once a day" request.

### Run locally

```sh
npm run dev   # http://localhost:3000
```

## The Telegram bot (`src/`)

Commands: `/standings /scores /roster <team> /draft [team|id] /trending /moves /awards /luck /help`.
It also posts on its own: every new trade or waiver move, and the awards recap when a week finishes.

1. Create a bot with [@BotFather](https://t.me/BotFather) and copy the token.
2. Add the bot to your group and send `/chatid` to get the group's id.
3. Copy `.env.example` to `.env` (or set real environment variables on your host) and fill in
   `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`. **Never commit the token.**
4. `npm run bot`. It uses long polling, so it needs a host that stays running (not Vercel serverless).

Try any command without Telegram: `node src/cli.js standings`.

## Notes

- Data comes from the public Sleeper API, which is read-only. Nothing here can make picks or change a lineup.
- Draft "value" and "grades" are computed from this league's real points, not from an external ranking.
- Best-available in the draft room is ordered by Sleeper's popularity rank, not an expert ranking.
