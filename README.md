# Bazarcha

AI-powered B2B sourcing for Uzbekistan's bazaars, delivered as a Telegram bot + Mini App.
A buyer asks for a product; the scoring engine ranks sellers by **price**, **verified quality**
and **distance**, and returns the top 3.

## Layout

```
bazarcha/
├── backend/   Express API + Prisma (SQLite)  →  POST /recommend
│   └── src/scoring.ts   the recommendation engine (pure, unit-tested)
├── bot/       grammY Telegram bot            (/start, text, voice, location → /recommend)
├── miniapp/   Telegram Mini App — plain HTML/CSS/JS, served by the backend at /app/
└── data/      seed.ts — mock sellers × products for Tashkent
```

## Quick start

```bash
npm install
cp .env.example .env            # backend reads DATABASE_URL / PORT from backend/.env or root .env
npm run db:setup                # creates backend/prisma/dev.db and seeds it
npm run dev                     # backend on http://localhost:3000
```

Try it:

```bash
curl -s -X POST http://localhost:3000/recommend \
  -H 'content-type: application/json' \
  -d '{"product":"pomidor","region":"Chilanzar"}' | jq
```

Run the bot (needs a real `BOT_TOKEN` in `bot/.env` — get one from @BotFather, never commit it):

```bash
npm run dev:bot
```

Run all tests (scoring engine + bot; the bot's integration tests run only while the backend is up):

```bash
npm test
```

## The Mini App (`miniapp/`)

Plain HTML/CSS/JS, no build step. The backend serves it at **`http://localhost:3000/app/`**, so one
HTTPS tunnel exposes both the API and the app. Open that URL in a desktop browser to develop —
outside Telegram it runs as a "Guest" with all features working.

Screens: Search (category + region chips, best sellers carousel) → Top matches → Seller profile
(match breakdown, 30-day price history, request offer) · Sellers · Saved · Profile · My requests ·
Notifications & price alerts.

- Search, results, seller profiles and the sellers list are **live** from `/recommend`, `/sellers`, `/meta`.
- The search box understands quantities: `pomidor 500 kg`, `2 t piyoz`. Sellers whose minimum
  order is bigger than the request are excluded.
- Saved sellers, request history, price alerts and language are stored per user in Telegram
  CloudStorage (falls back to localStorage in a browser). No backend tables yet — by design for the checkpoint.
- The price-history chart is a deterministic **sample** series ending at the seller's real current
  price, and is labelled as such in the UI. It becomes real once sellers report daily.
- Deep link from the bot: `/app/?product=tomato&region=Chilanzar&lat=..&lng=..` runs the search on open.
- Language: Uzbek by default, or Russian/English from Telegram's `language_code`; switchable in Profile.
- Brand name and colours live at the top of `miniapp/app.js` (`BRAND`) and `styles.css` (`:root`).

### Putting it in Telegram

Telegram needs an **HTTPS** URL. For the demo, tunnel the backend:

```bash
npx cloudflared tunnel --url http://localhost:3000
```

(or `ngrok http 3000`). Then set `MINIAPP_URL=https://<tunnel-host>/app/` in `bot/.env`, restart the
bot, and the "Open in Mini App" button appears under every result. Optionally register the same URL
in @BotFather → Bot Settings → Menu Button so the app opens from the chat's menu button too.

## The bot (`bot/`)

- `/start` — welcome + quick-pick buttons (🍅 🥔 🧅) and a "share location" button.
- Any text → product + optional district are extracted (`pomidor Chilonzor`, `помидор Чиланзар`,
  `2 tonna kartoshka`) → `POST /recommend` → top 3 as a formatted message with the score breakdown,
  plus an inline **Open in Mini App** button that carries `?product=&region=&lat=&lng=` for step 5.
- 📍 Location messages are remembered per user (in memory) and used for exact distances.
- 🎤 Voice: if `OPENAI_API_KEY` is set, the audio is transcribed (Whisper, plain `fetch`) and
  handled like text; otherwise the bot asks the user to type. Swap providers in `bot/src/stt.ts`.
- Replies in Uzbek by default, Russian or English when Telegram reports that language.
- The Mini App button only appears when `MINIAPP_URL` is `https://` — Telegram rejects anything else.
- `bot/src/bot.ts` exports `createBot()` so tests drive it with fake updates and no token.

## How the scoring works

For every seller listing that matches the requested product, each of the three signals is
normalised to a 0–100 scale **relative to the other candidates in the result set**:

| signal   | raw value                                   | direction        |
|----------|---------------------------------------------|------------------|
| price    | `pricePerKg` (UZS)                          | lower is better  |
| quality  | `rating` + bonus if the seller is verified  | higher is better |
| distance | km from the buyer to the seller (haversine) | lower is better  |

Then:

```
score = 0.45 · priceScore + 0.35 · qualityScore + 0.20 · distanceScore
```

Sorted descending, top 3 returned. The weights live as named constants in
`backend/src/scoring.ts` (`DEFAULT_WEIGHTS`) and can be overridden per request via
`weights` in the `/recommend` body, so buyers can tune them later.

## API

`POST /recommend`

```json
{
  "product": "tomato",          // or an alias: pomidor / помидор / potato / kartoshka / onion / piyoz ...
  "region": "Chilanzar",        // optional — a Tashkent district, used to derive the buyer's location
  "lat": 41.28, "lng": 69.20,   // optional — overrides region
  "limit": 3,                   // optional, default 3
  "weights": { "price": 0.45, "quality": 0.35, "distance": 0.20 }  // optional
}
```

`GET /products` — canonical product names + aliases.
`GET /health` — liveness.
