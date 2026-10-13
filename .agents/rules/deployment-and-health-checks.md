# PSITS Deployment & Health Check Guidelines

## Mandatory Pre-Deployment Checklist
1. Execute `npm test -- --run` in `PSITS/` to ensure all unit and integration tests pass (all 20+ tests).
2. Execute `npm run build` in `PSITS/` (`tsc -b && vite build`) to confirm clean TypeScript compilation and zero bundle errors.
3. Validate database migrations in `server/migrate.js` for backward compatibility.
4. Verify backend syntax with `node -c server/index.js server/events.js server/migrate.js server/db.js`.

## Media & Static Asset Handling
1. Critical administrative settings images (such as GCash QR code) must be stored persistently as Data URLs in MySQL `settings` table to withstand cloud container restarts.
2. Maintain `/uploads/(.*)` and `/api/(.*)` rewrites in `PSITS/vercel.json` pointing directly to Render.
3. Always wrap image sources with `resolveImageUrl()` to support both absolute URLs and relative upload paths.

## Post-Deployment Verification
1. Ping `GET https://psits-web-system.onrender.com/api/health` and verify `ok: true`, `db.ok: true`, and `migration.ok: true` (allow 30-60s for cold-start wake up if idle).
2. Inspect `https://psits-web-system.vercel.app` to verify active HTTP `200 OK` status, title tag, and Google site verification meta tags.
3. Inspect public legal routes `https://psits-web-system.vercel.app/privacy` and `https://psits-web-system.vercel.app/terms` to verify 200 status.
