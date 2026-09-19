# Bozorchi AI

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
- Saved sellers, request history, price alerts, language and the seller-side **"Add a product"**
  listings (Profile tab) are stored per user in Telegram CloudStorage (falls back to localStorage in
  a browser). No backend tables yet — by design for the checkpoint; wiring "Add a product" to a real
  `POST /listings` is the next step.
- The bottom tab bar is always visible; the layout is sized from Telegram's viewport and safe-area
  CSS variables so it fits every phone, including in-app keyboard and fullscreen modes.
- Seller reviews come from the seed (8 fake buyers, 2–4 reviews per seller, deterministic).
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

## LLM query parsing (`backend/src/nlp.ts`)

The bot no longer keyword-matches the raw message. Every text or transcribed voice message goes
through `parseQuery()` first — one small-model call (200 max tokens, JSON-only system prompt) that
returns `{product, quantity, unit, region}` from messy Uzbek / Russian / mixed input, typos and
voice-transcript run-ons. It is exposed as `POST /parse` and the bot calls it right before `/recommend`.

Two providers, picked from whichever key is in `backend/.env` (`NLP_PROVIDER` overrides):

| provider | key | model |
|---|---|---|
| `gemini` (default when set) | `GEMINI_API_KEY` — Gemini Developer API; `AQ.…` express keys work too | `gemini-3.6-flash`, thinking off (`gemini-2.5-flash` is closed to new accounts) |
| `anthropic` | `ANTHROPIC_API_KEY` | `claude-haiku-4-5` |

Free-tier Gemini keys have tight per-minute limits; when a call is rate-limited the parser returns
nulls and `/parse` falls back to keyword matching on the raw text, so a plain "kartoshka" still works.

Rules in the bot (`resolveQuery()` in `bot/src/bot.ts`):

- **No product found** → the bot asks what they need; it never calls `/recommend` blind.
- **No region** → the district named anywhere in the text, else the user's last used region, else Tashkent.
- **No quantity** → no minimum-order filter. Weight units are normalised to kg (`2 tonna` → 2000).
- **No key** (or any API failure) → `parseQuery` returns all nulls and the bot falls back
  to the old keyword path, so the demo never breaks mid-conversation.

Verified live (Gemini): `500 kg pomidor kerak, Toshkent` → pomidor · 500 kg · Toshkent;
`menga span piyoz kerakk tezroq` → piyoz, no quantity; a mixed Uzbek/Russian run-on with
"две тонны картошка … yunusobodga" → kartoshka · 2000 kg · Yunusobod; nonsense and empty → all nulls.
Re-run any time with:

```bash
npm run nlp:check --workspace backend
```

## The five AI / data-quality components

Each is a separate module with unit tests, plugged into the existing pipeline. The history and
interaction data behind 2–5 is **seeded** (synthetic) until sellers and buyers generate real
data — say so if a judge asks, same as the reviews.

| # | What | Where | Method | Where a judge sees it |
|---|---|---|---|---|
| 1 | Query parsing | `backend/src/nlp.ts` → `POST /parse` | small LLM call, JSON-only prompt (Gemini or Claude) | bot: "🧠 Got it: pomidor · 500 kg · Chilanzar" |
| 2 | Price anomalies | `backend/src/anomaly.ts` → `GET /anomalies` | z-score > 2 within product × region (sample σ, groups ≥ 4) | admin dashboard `/app/admin.html`: Parkent's 38 000 tomato, z ≈ 2.9 |
| 3 | Price trends | `backend/src/forecast.ts` (`forecastTrend`) | least-squares line over 30 days of reports, one vote per seller per day | seller profile & price history: "Narx tendensiyasi: so'nggi 30 kunda +10%"; admin trend table |
| 4 | Personal weights | `backend/src/scoring.ts` (`inferPersonalWeights`, `getPersonalWeights`) | rank of contacted listings vs. what was on offer → nudge the winning factor +0.15 | admin dashboard: `demo-cheap` vs `demo-quality` top-3 differ; results banner "Ranking tuned to your habits" |
| 5 | Seller reliability | `backend/src/reliability.ts` | 0.4·recency + 0.3·frequency + 0.3·change-ratio over a rolling 30 days → Gold/Silver/Bronze/New; **a gate on the top-N, not a weight** (score ≥ 20 and last report ≤ 48h) | Gold badge on profiles; "1 listing hidden: stale or unreliable" under results; admin leaderboard |

Seeded reporting patterns (`data/seed.ts`): most sellers report daily with varied prices (Gold);
some every other day (Silver); **Sergeli Dehqon** files the identical price ten times a day (Silver,
never Gold — the anti-farming check); **Parkent Sabzavot** went quiet 10 days ago (Bronze, gated out
of top-3 as stale); **Andijon Dehqon** has never reported (New, gated out as unreliable). If everyone
in a region fails the gate it is relaxed and the response says so (`gate.relaxed`).

`/recommend` keeps its shape; it gains `weights`, `personalized`, `personalization`, `gate`,
`excluded[]` and a `reliability` field per result.

## Buyer plans: Free / Pro / Max

Search, AI ranking, prices, weights, forecasts and basket quotes are **free and unmetered for every
tier**. The only gated action is revealing a seller's **phone number and exact location**
("contact unlock"), counted in a rolling 30-day window. Everything lives in `backend/src/tiers.ts`
(constants) and `backend/src/contactUnlock.ts` (logic).

| plan | contact unlocks / 30 days | price (placeholder) | extra |
|---|---|---|---|
| Free | 5 | $0 | |
| Pro | 20 | $7/mo | |
| Max | "unlimited" (500 anti-abuse cap) | $79/mo | `verifiedBuyer = true` → sellers see **✅ Tasdiqlangan xaridor** when the buyer reaches out |

Rules in `unlockContact()`: a seller already unlocked by this buyer is returned again and **never
charged twice**; otherwise unlocks in the window are counted and either a new `ContactUnlock` row
is created or `quota_exceeded` is returned with the next tier to offer.

Endpoints: `GET /me` (tier + usage), `POST /me/upgrade {tier}` (mock checkout — `tiers.setTier()` is
the single write path so Payme/Click/Stars plug in there), `POST /sellers/:id/unlock`. Public
seller/result payloads no longer include phone or lat/lng.

Bot: every result has a **📞 <seller>** button; `/upgrade pro|max|free` is the demo tier switch.
Mini App: "Reveal contact" on a seller profile; the plan card in Profile shows usage and the
Pro/Max offers. If a seller row has `telegramUserId` set, the bot sends them the notice for real.

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
