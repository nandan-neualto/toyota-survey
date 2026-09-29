# Render hosting

The Render target uses Next.js on Node.js 24.15.0 and free Render PostgreSQL.
The local/Sites target continues to use Vinext and Cloudflare D1.

## Service settings

- Region: Oregon (same region as the existing survey service).
- Plan: Free for both the web service and PostgreSQL 17.
- Build: `npm ci --include=dev && npm run build:render`
- Start: `npm run start:render`
- Health check: `/api/health`
- Set `DATABASE_URL` to the database's Internal Database URL.
- Set `STAFF_ACCESS_KEY` to a random secret of at least 16 characters.
- Set `NODE_VERSION=24.15.0`.

`npm run build` and `npm start` automatically select the Render target when
Render's `RENDER` environment variable is present, supporting the existing service.
`render.yaml` defines the complete free setup. Do not create duplicate resources
with a Blueprint if the services already exist.

Retrieve the staff key privately from the service's Environment page to sign into
`/staff`. Never commit credentials or database files. HTTPS staff cookies and
same-origin checks use `RENDER_EXTERNAL_URL`. For a custom domain, set this to
its canonical HTTPS origin.

## Free-plan limits and feedback

The free web service sleeps after 15 minutes of inactivity and can take about a
minute to wake. Free PostgreSQL expires 30 days after creation. This deployment's
database expires October 29, 2026. Export feedback from `/staff` before expiry and
move to another database or choose a paid plan if continuing afterward. No paid
resources are configured. See https://render.com/docs/free for current limits.

Feedback survives web-service restarts because it lives in PostgreSQL. Existing
local or Cloudflare responses are not automatically copied to Render. Use the
authenticated staff CSV export for regular off-platform backups.

## Verification

Run `npm run test:render`, `npm run build:render`, then
`node scripts/test-render-server.mjs`. Local integration tests use isolated SQLite
storage to check Japanese/Kannada saves, retry deduplication, origin validation,
staff authorization, and secure sessions across restart. PostgreSQL is verified
on the deployed service.

Generated builds, local databases, environment files, and dependencies are ignored
by Git. Pushes to connected `main` deploy automatically when enabled.
