# PSITS Backend API (MySQL)

This repo now includes a small API server that persists auth + members data to MySQL.

## Requirements
- MySQL running locally (phpMyAdmin/XAMPP is fine)
- Database name: psits_web_system

## Configure
- Optional: create `server/.env` using `server/env.example` as a template.

## Run
Option A (Recommended): start both API + Web together (repo root): `npm run dev`

Option B: start separately
1) Start API (repo root): `npm run api:dev`
2) Start web (PSITS folder): `npm run dev`

## Notes
- In dev, the React app uses a Vite proxy so it can call the API at `/api` without CORS issues.
- The API listens on `http://localhost:3000/api`.
- You can override the frontend API base URL via `VITE_API_URL` (useful for production hosting).

## Seeded Accounts (Migration)
On startup, the backend migration seeds:
- Super Admin: `admin@psits.com` / `AdminPsits@123`
- Demo members (for QA/scripts): `individual.demo@psitsxii.com`, `institution.demo@psitsxii.com`, `industry.demo@psitsxii.com`

To disable demo seeding, set `SEED_DEMO_ACCOUNTS=false` in `server/.env`.
