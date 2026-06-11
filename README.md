# World Cup Picks

A Next.js app for private World Cup score predictions.

## What is built

- World Cup themed landing page
- Fixture cards with flags and venues
- Prediction room for score picks
- Organization setup and invite code flow
- Admin result entry screen
- Leaderboard page backed by Postgres scoring views
- Neon-ready API routes
- RBAC auth: first signup becomes admin, admins create invited users
- Forced password change on invited users' first login

## Run locally

```bash
npm run dev
```

The app works in preview mode without secrets. Once your Neon SQL has run:

1. Copy `.env.local.example` to `.env.local`.
2. Add your pooled Neon connection string as `DATABASE_URL`.
3. Add a long random `AUTH_SECRET`.
4. Restart `npm run dev`.

## Main Routes

- `/` landing page
- `/fixtures` all fixtures
- `/predict` submit score predictions
- `/leaderboard` org leaderboard
- `/org` create org and invite friends
- `/admin` enter confirmed results
- `/signup` first admin signup
- `/login` user login
- `/change-password` forced first-login password reset
- `/users` admin-only user creation

## Docker

Run the app container against Neon:

```bash
docker compose up --build
```

The compose service reads `.env.local`, exposes port `3000`, and does not run a local Postgres container because Neon is the database.

## Admin Recovery

If the first admin account exists but you cannot log in, reset it locally:

```bash
npm run auth:reset-admin -- admin@example.com NewPassword123
```

Then log in at `/login` with that email and new password.

## Custom Results API

You can push finished match scores from a script, phone shortcut, or external worker.

Add this to `.env.local`:

```env
RESULTS_API_SECRET="a-long-random-results-secret"
```

Update a result by `scheduleOrder`:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3000/api/results" `
  -Headers @{ "x-results-secret" = "a-long-random-results-secret" } `
  -ContentType "application/json" `
  -Body '{"scheduleOrder":1,"homeScore":2,"awayScore":0,"status":"full_time"}'
```

Read results:

```powershell
Invoke-RestMethod "http://localhost:3000/api/results?scheduleOrder=1"
```

The admin **Pull from results API** button uses a best-effort FIFA scraper:

- Source: `RESULTS_SCRAPE_URL`, or FIFA's official Match Centre by default
- If FIFA does not expose a final score, it tries a no-key Bing RSS search fallback
- It only updates when a plausible final score is visible in FIFA or search snippets
- If neither source has the result, it returns a clear "No final result found" message
- Manual admin score entry remains the reliable fallback

## Database

Run `db/schema.sql` in Neon SQL Editor. The schema seeds teams, venues, and all 104 fixtures from FIFA's official schedule.

If you already ran the old schema before auth was added, run `db/auth-rbac-migration.sql` in Neon too.
