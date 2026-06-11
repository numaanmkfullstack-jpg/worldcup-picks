import { existsSync, readFileSync } from "node:fs";
import pg from "pg";

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }

  const env = {};
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

    env[trimmed.slice(0, equalsIndex)] = trimmed.slice(equalsIndex + 1).trim().replace(/^['"]|['"]$/g, "");
  }

  return env;
}

const [, , filePath] = process.argv;

if (!filePath) {
  console.error("Usage: node scripts/run-sql-file.mjs db/some-migration.sql");
  process.exit(1);
}

const env = {
  ...loadEnvFile(".env.local"),
  ...process.env,
};

if (!env.DATABASE_URL) {
  console.error("DATABASE_URL is missing.");
  process.exit(1);
}

const { Client } = pg;
const migration = readFileSync(filePath, "utf8");
const client = new Client({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(migration);
  await client.end();
  console.log(`Applied ${filePath}`);
} catch (error) {
  await client.end().catch(() => undefined);
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
