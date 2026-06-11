# Database Setup

1. Create a Neon project.
2. Open the Neon SQL Editor.
3. Run `db/schema.sql`.
4. Copy your pooled Neon connection string into `.env.local` as `DATABASE_URL`.
5. Add `AUTH_SECRET` to `.env.local` for signed login cookies.

If you already ran `db/schema.sql` before auth was added, run `db/auth-rbac-migration.sql` once.

For the Next.js app, use Neon serverless:

```bash
npm install @neondatabase/serverless
```

Example server-side client:

```ts
import { neon } from "@neondatabase/serverless";

export const sql = neon(process.env.DATABASE_URL!);
```

The schema stores:

- users, organizations, memberships, and admin/member roles
- password auth, first-login password reset, and invited users
- FIFA teams, venues, and 104 World Cup fixtures
- one prediction per user per organization per match
- manual or API-sourced match results
- scoring views for exact score and correct outcome
- an organization leaderboard view
