# Bazarcha

AI-powered B2B sourcing for Uzbekistan's bazaars, delivered as a Telegram bot + Mini App.
A buyer asks for a product; the scoring engine ranks sellers by **price**, **verified quality**
and **distance**, and returns the top 3.

## Layout

```
bazarcha/
├── backend/   Express API + Prisma (SQLite)  →  POST /recommend
│   └── src/scoring.ts   the recommendation engine (pure, unit-tested)
├── bot/       grammY Telegram bot            (checkpoint step 4)
├── miniapp/   Telegram Mini App frontend     (checkpoint step 5)
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

Run the scoring-engine tests:

```bash
npm test
```

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
