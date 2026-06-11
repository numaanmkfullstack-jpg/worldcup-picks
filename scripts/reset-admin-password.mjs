import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

function loadEnvFile(path) {
  const env = {};
  if (!existsSync(path)) {
    return env;
  }

  const contents = readFileSync(path, "utf8");

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex);
    const value = trimmed.slice(equalsIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    env[key] = value;
  }

  return env;
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");

  return `scrypt:${salt}:${hash}`;
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "matchday-crew";
}

const [, , emailArg, passwordArg, orgNameArg = "Matchday Crew"] = process.argv;

if (!emailArg || !passwordArg) {
  console.error("Usage: npm run auth:reset-admin -- admin@example.com NewPassword123");
  process.exit(1);
}

if (passwordArg.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const env = {
  ...loadEnvFile(".env.local"),
  ...process.env,
};
if (!env.DATABASE_URL) {
  console.error("DATABASE_URL is missing from .env.local.");
  process.exit(1);
}

const sql = neon(env.DATABASE_URL);
const email = emailArg.trim().toLowerCase();
const passwordHash = hashPassword(passwordArg);

try {
  const users = await sql`
    UPDATE app_users
    SET password_hash = ${passwordHash},
        password_set_at = now(),
        must_change_password = false,
        disabled_at = NULL
    WHERE email = ${email}
    RETURNING id, display_name
  `;

  const user = users[0];
  if (!user) {
    console.error(`No user exists for ${email}.`);
    process.exit(1);
  }

  const existingMembership = await sql`
    SELECT organization_id
    FROM organization_members
    WHERE user_id = ${user.id}
    ORDER BY joined_at ASC
    LIMIT 1
  `;

  let organizationId = existingMembership[0]?.organization_id;
  if (!organizationId) {
    const orgRows = await sql`
      INSERT INTO organizations (name, slug, created_by_user_id)
      VALUES (${orgNameArg}, ${slugify(orgNameArg)}, ${user.id})
      ON CONFLICT (slug) DO UPDATE
      SET name = EXCLUDED.name
      RETURNING id
    `;
    organizationId = orgRows[0].id;
  }

  await sql`
    INSERT INTO organization_members (organization_id, user_id, role)
    VALUES (${organizationId}, ${user.id}, 'admin')
    ON CONFLICT (organization_id, user_id) DO UPDATE
    SET role = 'admin'
  `;

  console.log(`Admin password reset for ${email}. You can log in now.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
