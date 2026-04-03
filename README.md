# HomeDirectAI

AI-powered real estate platform — buy and sell homes without traditional real estate agents. 1% platform fee at closing.

## Features

- **Browse & Search** — Filter listings by price, beds, baths, sqft, property type
- **AI Negotiation** — AI agent helps negotiate offers between buyer and seller
- **Walkthrough Chaperones** — DoorDash-style $20 gig economy for walkthrough escorts
- **Sell Your Home** — 4-step listing wizard, no agent required
- **Document Management** — Auto-generated title, disclosures, and closing paperwork
- **Dashboard** — Buyer, seller, and chaperone views with transaction tracking

## Tech Stack

- **Frontend:** React, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Express.js, Node.js
- **Database:** SQLite (better-sqlite3) + Drizzle ORM
- **Routing:** Wouter (hash-based)

## Getting Started

```bash
npm install
npm run dev
```

## Deploy to Railway

1. Push this repo to GitHub
2. Connect the repo on [railway.app](https://railway.app)
3. Railway auto-detects Node.js and uses the config in `railway.json`
4. A public URL is generated — the app seeds demo data on first boot

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Buyer | mike@example.com | demo123 |
| Seller | sarah@example.com | demo123 |
| Chaperone | lisa@example.com | demo123 |

## Environment

No environment variables required — the app runs fully self-contained with SQLite.
