# Water Billing System

A digital water billing system for drinking-water schemes — built for the Meenambalam / Kollam water scheme by **Altiora Capital Solution**.

It replaces paper meter-reading and billing with a simple web app:

- **Meter Reader** — take readings on an Android phone, auto-calculate the bill (units × rate + fixed charge + old arrears), and print a 58mm thermal receipt with a UPI scan-to-pay QR.
- **Admin Dashboard** — manage consumers, record payments (with mismatched-payer support), view a full per-consumer ledger, reports with charts, and edit tariff rates.

## Tech
- React + Vite + Tailwind CSS
- Supabase (Postgres + Auth + Row Level Security)
- `qrcode.react` for the UPI QR

## Setup
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in your Supabase URL + anon key.
3. In Supabase → SQL Editor, run `supabase/setup.sql` (creates tables, security, sample data).
4. Create a staff login in Supabase → Authentication → Users.
5. `npm run dev`

## Build & deploy
- `npm run build` → outputs a static site to `dist/`
- Deploy `dist/` to any static host (Netlify, Vercel).

## Structure
- `src/billing.js` — data model + billing/ledger calculations
- `src/lib/` — Supabase client + data access
- `src/App.jsx` — app shell, auth, meter-reader flow
- `src/admin.jsx` — dashboard, consumer detail, reports, settings
- `src/receipts.jsx` — printable bill + payment receipts
- `src/ui.jsx`, `src/toast.jsx` — shared UI

---
© Altiora Capital Solution
